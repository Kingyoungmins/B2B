# 실제 백엔드 함수 serve_b2b._shift_months_in_text 를 직접 검증(ctx.shift_months 의 핵심 로직).
# 모델이 VBA 정규식/한글에 공백을 끼워 깨뜨리던 문제를 백엔드 결정적 헬퍼로 옮긴 것의 회귀 가드.
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import serve_b2b  # noqa: E402

shift = serve_b2b._shift_months_in_text

CASES = [
    ("26년 06월 (05월 1일 ~ 05월 31일) 요금확정 내역", 1, "26년 07월 (06월 1일 ~ 06월 30일) 요금확정 내역"),
    ("26년 12월 (11월 1일 ~ 11월 30일) 요금확정 내역", 1, "27년 01월 (12월 1일 ~ 12월 30일) 요금확정 내역"),
    ("26년 01월 (12월 1일 ~ 12월 31일) 요금확정 내역", 1, "26년 02월 (01월 1일 ~ 01월 31일) 요금확정 내역"),
    ("2026년 02월 (01월 28일 ~ 01월 31일)", 1, "2026년 03월 (02월 28일 ~ 02월 28일)"),   # 비윤년 Feb=28
    ("2024년 02월 (01월 31일 ~ 01월 31일)", 1, "2024년 03월 (02월 29일 ~ 02월 29일)"),   # 윤년 Feb=29
    ("6월 매출", 1, "7월 매출"),                                                          # 비패딩 단독월
    ("26년 11월 (10월 1일 ~ 10월 31일)", 2, "27년 01월 (12월 1일 ~ 12월 31일)"),          # +2, 11->1 연도+1
    ("3월", -1, "2월"),                                                                   # 음수 delta
    ("01월", -1, "12월"),                                                                 # 1->12 (연도 없는 토큰)
    ("2026년 06월", 1, "2026년 07월"),                                                    # 연도+월만
]


def main():
    ok = 0
    for inp, d, exp in CASES:
        got = shift(inp, d)
        if got == exp:
            ok += 1
        else:
            print(f"  FAIL {d:+d}: got[{got}] exp[{exp}]")
    print(f"_shift_months_in_text: {ok}/{len(CASES)} pass")
    if ok != len(CASES):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
