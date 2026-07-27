"""(선택) 스텝에 기간 delta 적용 (Docs/05 §5.3).

녹화한 스텝의 문자열 토큰('2월' 등)을 다음 기간으로 시프트해 새 스텝을 만든다.
COM 무관 → 테스트 가능. 코어(record & replay)는 이 모듈 없이도 동작한다.
"""
from __future__ import annotations

import copy
from typing import List, Optional

from ..model.skill import Skill, Step
from . import month_shift as ms


def _shift_cell(v, delta, anchor_year):
    if isinstance(v, str) and ms.has_month_token(v):
        return ms.shift_text(v, delta, anchor_year)
    return v


def _shift_grid(grid, delta, anchor_year):
    return [[_shift_cell(v, delta, anchor_year) for v in row] for row in grid]


def _shift_name(name, delta, anchor_year):
    if name and ms.has_month_token(name):
        return ms.shift_text(name, delta, anchor_year)
    return name


def apply_delta(steps: List[Step], delta: int, anchor_year: int = 2000) -> List[Step]:
    """스텝 리스트에 월 delta 를 적용한 새 리스트를 반환(원본 불변).

    시프트 대상: 셀 문자열 값/수식, 시트명, 워크북명(파일 슬롯), 설명.
    범위 주소(A1 등)·숫자 값은 그대로.
    """
    if delta == 0:
        return [copy.deepcopy(s) for s in steps]

    out: List[Step] = []
    for s in steps:
        s2 = copy.deepcopy(s)
        for t in (s2.target, s2.source):
            if t is not None:
                t.sheet = _shift_name(t.sheet, delta, anchor_year)
                t.book = _shift_name(t.book, delta, anchor_year)
        for grid_key in ("values", "formulas"):
            if grid_key in s2.payload and isinstance(s2.payload[grid_key], list):
                s2.payload[grid_key] = _shift_grid(s2.payload[grid_key], delta, anchor_year)
        s2.description = _shift_name(s2.description, delta, anchor_year)
        out.append(s2)
    return out


def _anchor_year(skill: Skill) -> int:
    if skill.anchor_period:
        try:
            return ms.parse_period(skill.anchor_period)[0]
        except ValueError:
            pass
    return 2000


def resolve_skill(skill: Skill, *, run_index: int = 0,
                  current_period: Optional[str] = None) -> List[Step]:
    """스킬의 월 파라미터 정책으로 delta 를 정하고 스텝에 적용.

    월 타입 파라미터가 없으면 녹화한 그대로(delta=0)를 반환한다.
    """
    month_params = [p for p in skill.params if p.type in ("month", "date")]
    if not month_params:
        return apply_delta(skill.steps, 0)
    p = month_params[0]
    anchor = p.anchor or skill.anchor_period or "2000-01"
    delta = ms.resolve_delta(p.policy, anchor, run_index=run_index,
                             current_period=current_period)
    return apply_delta(skill.steps, delta, _anchor_year(skill))
