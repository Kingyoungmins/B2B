# ctx.pivot 2D 크로스탭의 핵심(순수 함수 _pivot_crosstab/_pivot_agg) 검증.
# 모델이 손코딩하던 2D 크로스탭을 백엔드 결정적 처리로 옮긴 것의 회귀 가드.
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import serve_b2b as s  # noqa: E402

# (회사, 지점, 월, 매출, 사업자번호) — test_data/피벗_샘플.xlsx 와 동일
DATA = [
    ["가", "서울", 1, 100, "001"],
    ["가", "서울", 2, 200, "001"],
    ["가", "부산", 1, 50, "001"],
    ["나", "서울", 1, 300, "002"],
    ["나", "부산", 2, 150, "002"],
    ["다", "부산", 1, 80, "010"],
    ["가", "부산", 2, 120, "001"],
    ["나", "서울", 2, 220, "002"],
]

pass_ = 0
fail = 0


def ck(name, cond):
    global pass_, fail
    if cond:
        pass_ += 1; print(" OK  " + name)
    else:
        fail += 1; print("FAIL " + name)


# 2D 크로스탭: 행=지점(1), 열=월(2), 값=매출(3), sum
out, rk, ck_keys = s._pivot_crosstab(DATA, 1, 2, 3, "sum", row_label="지점")
ck("헤더 = [지점, 1, 2]", out[0] == ["지점", 1, 2])
ck("부산 행 = [부산, 130, 270]", out[1] == ["부산", 130.0, 270.0])
ck("서울 행 = [서울, 400, 420]", out[2] == ["서울", 400.0, 420.0])
ck("행 정렬(가나다): 부산<서울", rk == ["부산", "서울"])
ck("열 정렬(숫자): 1<2", ck_keys == [1, 2])

# count (value 없음)
outc, _, _ = s._pivot_crosstab(DATA, 1, 2, None, "count")
ck("count: 부산 2/2", outc[1][1] == 2 and outc[1][2] == 2)

# avg
outa, _, _ = s._pivot_crosstab(DATA, 1, 2, 3, "avg")
# 서울 월1 = (100+300)/2 = 200
seoul = [r for r in outa[1:] if r[0] == "서울"][0]
ck("avg: 서울 월1 = 200", seoul[1] == 200.0)

# 빈 행 skip + 미존재 셀 0
DATA2 = [["", "", "", "", ""], ["가", "서울", 1, 10, ""]]
out2, _, _ = s._pivot_crosstab(DATA2, 1, 2, 3, "sum")
ck("빈 행 무시 + 1셀만", len(out2) == 2 and out2[1] == ["서울", 10.0])

# _pivot_agg 단위
ck("_pivot_agg sum", s._pivot_agg([1, 2, "3"], "sum") == 6.0)
ck("_pivot_agg max", s._pivot_agg([1, 5, 3], "max") == 5.0)
ck("_pivot_agg count(빈값 포함)", s._pivot_agg(["a", "", 2], "count") == 3)

print(f"\n=== {pass_} PASS / {fail} FAIL ===")
sys.exit(2 if fail else 0)
