"""결정론 월/날짜 시프트 (Docs/05 §5.3, eval_eca _shift_months_in_text 이식).

"2월 작업 → 3월 → … → 다음 해 1월" 을 LLM 없이 처리하는 핵심 엔진.
- 공백 차이 흡수: '2 월', '2   월', '2월' 모두 매칭(eval_eca normalizeText 철학).
- 연도 롤오버: 12월 +1 → 다음 해 1월.
- 말일 보정: 1월 31일 +1 → 2월 28/29일(윤년 고려).

출력은 정규화된 형태(년/월/일 사이 단일 공백)다.
"""
from __future__ import annotations

import re

# (연도)? (월) (일)?  — 모든 토큰 사이 공백 허용
_PAT = re.compile(r"(?:(\d{2,4})\s*년\s*)?(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일)?")
_DAYS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)


def is_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def days_in_month(month: int, year: int) -> int:
    if month == 2 and is_leap(year):
        return 29
    return _DAYS[month - 1]


def shift_text(s: str, delta: int, anchor_year: int = 2000) -> str:
    """문자열 안의 모든 'N월' 토큰을 delta 만큼 이동.

    연도가 명시된 토큰만 연도를 롤오버한다(예: '2026년 12월'). 연도 없는 '12월'은
    월만 1월로 바뀌고 연도 표기는 추가하지 않는다(원문 형태 유지).
    """
    def repl(m: "re.Match") -> str:
        y_s, mon_s, day_s = m.group(1), m.group(2), m.group(3)
        year = int(y_s) if y_s else anchor_year
        mon = int(mon_s)
        idx = (mon - 1) + delta
        new_m = idx % 12 + 1
        new_y = year + (idx // 12)  # 음수 delta 에도 floor 나눗셈으로 정상 동작

        mon_out = f"{new_m:02d}" if len(mon_s) == 2 else str(new_m)
        if y_s:
            out = f"{new_y}년 {mon_out}월"
        else:
            out = f"{mon_out}월"
        if day_s:
            d = min(int(day_s), days_in_month(new_m, new_y))
            day_out = f"{d:02d}" if len(day_s) == 2 else str(d)
            out += f" {day_out}일"
        return out

    return _PAT.sub(repl, s)


def has_month_token(s: str) -> bool:
    """문자열에 'N월' 토큰이 있는지(변수 후보 탐지용)."""
    return bool(_PAT.search(s))


# --- 기간(period) 및 delta 정책 (Docs/05 §5.2) ---

_PERIOD_RE = re.compile(r"^(\d{4})-(\d{1,2})$")


def parse_period(period: str):
    """'2026-02' -> (2026, 2)."""
    m = _PERIOD_RE.match(period.strip())
    if not m:
        raise ValueError(f"기간 형식이 아님: {period!r} (기대: 'YYYY-MM')")
    return int(m.group(1)), int(m.group(2))


def period_index(year: int, month: int) -> int:
    """절대 월 인덱스(연도 비교용)."""
    return year * 12 + (month - 1)


def resolve_delta(policy: str, anchor_period: str, *,
                  run_index: int = 0, current_period: str | None = None,
                  offset: int = 0) -> int:
    """정책에 따라 적용할 월 delta 를 계산한다.

    - advance_by_run : 실행 회차마다 +1 (run_index 그대로).
    - to_current_month: 현재 기간 - 기준 기간(절대).
    - fixed_offset    : 고정 offset.
    """
    if policy == "advance_by_run":
        return run_index
    if policy == "fixed_offset":
        return offset
    if policy == "to_current_month":
        if not current_period:
            raise ValueError("to_current_month 정책에는 current_period 가 필요하다")
        ay, am = parse_period(anchor_period)
        cy, cm = parse_period(current_period)
        return period_index(cy, cm) - period_index(ay, am)
    raise ValueError(f"알 수 없는 정책: {policy!r}")
