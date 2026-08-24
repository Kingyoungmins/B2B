# -*- coding: utf-8 -*-
"""[0.7.5 실험] filter_to_sheet 선언적 조건(ColumnIs) — 결과는 '기본 꺼짐'.

무엇을 해보려 했나
  실측(29.8MB·326,114행·21열)에서 filter_to_sheet 가 44초였다. read 15.9초 + write 24.8초.
  같은 파일의 네이티브 피벗은 2~3초. 차이가 '전 칸을 COM 으로 왕복시키느냐'로 보여서,
  흔한 요청(한 열의 값으로 거르기)만 Excel 자동필터로 넘기면 그만큼 빠질 것이라 봤다.
  임의의 파이썬 람다는 자동필터로 옮길 수 없으므로 선언적 조건을 따로 열었다.

실측 결과 — 가설이 틀렸다
  4열 × 4만행  (16만 칸):  자동필터  1.92초 vs 값 0.34초   → 값이 5.6배 빠름
  21열 × 12만행(252만 칸): 자동필터 14.76초 vs 값 5.00초  → 값이 3.0배 빠름
  정확성과 서식(음영·표시형식·열너비)은 두 경로가 동일했다. 속도만 뒤집혔다.

  병목은 '값을 COM 으로 옮기는 것'이 아니라 '흩어진 행을 복사하는 것'이었다.
  매칭이 한 행 건너 하나면 SpecialCells 가 영역 수만 개짜리 다중영역이 되고 Excel 이
  영역마다 처리한다. 값 경로는 매칭이 아무리 흩어져도 읽기 1회 + 쓰기 1회다.

그래서 켜지 않는다(B2B_FILTER_NATIVE=1 로 실험만 가능). 코드와 숫자는 남겨 둔다 —
정렬돼 뭉쳐 있는 표에서는 반대일 수 있어, 다음에 '연속 구간 비율'을 먼저 재는 식으로
다시 볼 수 있다.

이 테스트가 잠그는 것: 선언적 조건이 값 경로에서도 그대로 동작하고(호출 가능),
기본이 검증된 값 경로라는 것. 실제로 여기가 한 번 터졌다 — 네이티브가 폴백하면
ColumnIs 가 predicate 로 불려야 하는데 __call__ 이 없어 스킬이 통째로 죽었다.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import serve_b2b as S  # noqa: E402

fails = 0


def check(name, cond, detail=None):
    global fails
    if cond:
        print("  PASS  " + name)
    else:
        fails += 1
        print("  FAIL  " + name + (("  -> " + str(detail)[:160]) if detail is not None else ""))


print("[1] ColumnIs 는 predicate 로도 동작한다(폴백 경로에서 필수)")
c = S.ColumnIs("B", "안전제일")
check("맞는 행", c([1, "안전제일", 3]) is True)
check("다른 값", c([1, "기타", 3]) is False)
check("앞뒤 공백은 무시(값 경로와 자동필터의 판정을 맞춘다)", c([1, " 안전제일 ", 3]) is True)
check("여러 값 중 하나", S.ColumnIs("B", ["가", "안전제일"])([1, "안전제일"]) is True)
check("행이 짧으면 False(예외 대신)", c([1]) is False)
check("숫자 열 번호도 받는다", S.ColumnIs(2, "안전제일")([1, "안전제일"]) is True)
check("None 셀도 안전", S.ColumnIs("B", "x")([1, None]) is False)

print("[2] 열 문자 → 번호")
check("A=1", S._col_letter_to_index("A") == 1)
check("H=8", S._col_letter_to_index("H") == 8)
check("AA=27", S._col_letter_to_index("AA") == 27)
check("소문자도 받는다", S._col_letter_to_index("h") == 8)

print("[3] 기본은 검증된 값 경로다(자동필터는 실험용으로만)")
os.environ.pop("B2B_FILTER_NATIVE", None)


class _FakeUsed:
    Rows = type("R", (), {"Count": 100000})()
    Columns = type("C", (), {"Count": 50})()


class _FakeWs:
    UsedRange = _FakeUsed()


ctx = S.PythonComSkillContext.__new__(S.PythonComSkillContext)
ctx._shared = {"com_calls": 0}
ctx._tick = lambda n=1: None
check("환경변수 없으면 자동필터를 타지 않는다(칸 수가 커도)",
      S.PythonComSkillContext._filter_native_worth_it(ctx, _FakeWs()) is False)
os.environ["B2B_FILTER_NATIVE"] = "1"
check("실험 플래그를 켜면 큰 표에서만 탄다",
      S.PythonComSkillContext._filter_native_worth_it(ctx, _FakeWs()) is True)


class _SmallWs:
    UsedRange = type("U", (), {"Rows": type("R", (), {"Count": 100})(),
                               "Columns": type("C", (), {"Count": 5})()})()


check("플래그를 켜도 작은 표는 값 경로(고정 비용이 손해)",
      S.PythonComSkillContext._filter_native_worth_it(ctx, _SmallWs()) is False)
os.environ.pop("B2B_FILTER_NATIVE", None)

print("")
print("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL")
sys.exit(0 if fails == 0 else 1)
