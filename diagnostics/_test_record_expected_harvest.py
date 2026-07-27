# -*- coding: utf-8 -*-
"""[회귀] 네이티브 녹화 stop 의 expected(재현 검증 다이제스트) 수확 — 오프라인(Excel/COM 불필요).

배경: 엔진은 항상 VBA(네이티브)인데 stop 결과에 expected 가 없어 프론트 검증 블록과
/api/excel/record/verify 인프라가 통째로 死코드였다(이중 반영·시트 어긋남을 잡을 유일한 그물).
수정: stop_native_recording_impl 이 _touched_sheet_pairs(청크 시트 리터럴 + 정지 시점 활성
시트)로 touched 를 만들고 record_service.capture_expected_states 로 다이제스트를 실어 준다.

실행: python diagnostics/_test_record_expected_harvest.py   (B2B_ver 루트에서)
"""
import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from native_macro_recorder import _touched_sheet_pairs  # noqa: E402

PASS = FAIL = 0


def t(name, cond):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS " + name)
    else:
        FAIL += 1
        print("FAIL " + name)


# 1. 활성 시트 + 청크 시트 리터럴 합집합, 워크북별 귀속
harvested = [
    ("정산서.xlsx", r"C:\t\정산서.xlsx",
     'Sub Macro1()\n    Sheets("정산").Select\n    Range("A1").Copy\n    Worksheets("요약").Range("B1").PasteSpecial\nEnd Sub'),
    ("청구내역.xlsx", r"C:\t\청구내역.xlsx",
     'Sub Macro2()\n    Range("A1:G13").Copy\nEnd Sub'),
]
pairs = _touched_sheet_pairs(harvested, ["정산", "청구"])
t("1a 활성 시트 수확(청크별)", ("정산서.xlsx", "정산") in pairs and ("청구내역.xlsx", "청구") in pairs)
t("1b 청크 시트 리터럴 수확", ("정산서.xlsx", "요약") in pairs)
t("1c 타 워크북으로 오귀속 없음", ("청구내역.xlsx", "정산") not in pairs and ("청구내역.xlsx", "요약") not in pairs)

# 2. 중복 제거 + 활성 시트가 리터럴과 겹쳐도 1회
pairs2 = _touched_sheet_pairs(
    [("a.xlsx", "", 'Sheets("정산").Select\nSheets("정산").Select')], ["정산"])
t("2a 중복 제거", pairs2 == [("a.xlsx", "정산")])

# 3. 워크북당 상한(활성 시트 우선 포함)
many = "\n".join('Sheets("S%d").Select' % i for i in range(20))
pairs3 = _touched_sheet_pairs([("a.xlsx", "", many)], ["활성"])
t("3a 워크북당 상한 적용(폭주 방지)", len(pairs3) <= 6)
t("3b 활성 시트 우선 포함", ("a.xlsx", "활성") in pairs3)

# 4. 빈 입력 안전
t("4a 빈 harvested 안전", _touched_sheet_pairs([], []) == [])
t("4b 활성 시트 없음(빈 문자열) 안전", ("a.xlsx", "") not in _touched_sheet_pairs([("a.xlsx", "", "")], [""]))

# 5. 배선(소스) — stop 반환에 expected, serve 가 결과로 전달, 워커 타임아웃 확장
nm = (ROOT / "native_macro_recorder.py").read_text(encoding="utf-8")
t("5a stop 반환에 expected 포함", '"expected": expected' in nm)
t("5b capture_expected_states 재사용(포맷 일치)", "from record_service import capture_expected_states" in nm)
sv = (ROOT / "serve_b2b.py").read_text(encoding="utf-8")
t("5c serve 네이티브 stop 이 expected 전달", 'result["expected"] = rec.get("expected")' in sv)
t("5d 네이티브 stop 워커 타임아웃 120s", re.search(r"excel_call\(_stop_native, timeout=120\)", sv) is not None)

# 6. verify 소비자와 포맷 계약 — expected 항목에 book 이 붙는다(capture_expected_states)
rs = (ROOT / "record_service.py").read_text(encoding="utf-8")
t("6a capture_expected_states 가 book 필드를 채운다", 'st["book"] = base' in rs)

print("\n%d PASS / %d FAIL" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
