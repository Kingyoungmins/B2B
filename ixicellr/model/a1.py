"""A1 주소 파싱 헬퍼 (COM 무관, 순수 함수).

distiller 가 셀 인접성을 판정하려면 'A1' <-> (row, col) 변환이 필요하다.
전열('A:E')/전행('1:6') 같은 표기는 단일 셀이 아니므로 None 반환(상위에서 분기).
"""
from __future__ import annotations

import re

_CELL_RE = re.compile(r"^\$?([A-Za-z]{1,3})\$?(\d+)$")
_RANGE_RE = re.compile(r"^([^:]+):([^:]+)$")


def col_to_num(col: str) -> int:
    """'A' -> 1, 'Z' -> 26, 'AA' -> 27."""
    n = 0
    for ch in col.upper():
        n = n * 26 + (ord(ch) - ord("A") + 1)
    return n


def num_to_col(n: int) -> str:
    """1 -> 'A', 27 -> 'AA'."""
    s = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        s = chr(ord("A") + rem) + s
    return s


def parse_cell(addr: str):
    """'$A$1' / 'A1' -> (row, col) 1-based. 단일 셀이 아니면 None."""
    m = _CELL_RE.match(addr.strip())
    if not m:
        return None
    return (int(m.group(2)), col_to_num(m.group(1)))


def make_cell(row: int, col: int) -> str:
    """(1, 1) -> 'A1'."""
    return f"{num_to_col(col)}{row}"


def parse_range(addr: str):
    """'A1' -> ((r,c),(r,c)); 'A1:B2' -> ((r1,c1),(r2,c2)). 정규화 불가 시 None.

    전열/전행(예: 'A:E', '1:6')은 셀 좌표가 없으므로 None.
    """
    addr = addr.replace("$", "").strip()
    single = parse_cell(addr)
    if single:
        return (single, single)
    m = _RANGE_RE.match(addr)
    if not m:
        return None
    a, b = parse_cell(m.group(1)), parse_cell(m.group(2))
    if not a or not b:
        return None
    (r1, c1), (r2, c2) = a, b
    return ((min(r1, r2), min(c1, c2)), (max(r1, r2), max(c1, c2)))


def make_range(top_left, bottom_right) -> str:
    """((1,1),(2,2)) -> 'A1:B2'. 단일 셀이면 'A1'."""
    tl = make_cell(*top_left)
    if top_left == bottom_right:
        return tl
    return f"{tl}:{make_cell(*bottom_right)}"


def bounding_box(ranges):
    """여러 A1 범위/셀의 합집합 경계상자 (r1,c1,r2,c2). 셀 좌표 없는 표기는 무시.

    '사용자가 작업한 영역'을 추정해, 큰 시트에서 전체 대신 그 영역만 스냅샷할 때 쓴다.
    파싱 가능한 범위가 하나도 없으면 None.
    """
    r1 = c1 = r2 = c2 = None
    for rng in ranges:
        parsed = parse_range(rng) if rng else None
        if not parsed:
            continue
        (rr1, cc1), (rr2, cc2) = parsed
        r1 = rr1 if r1 is None else min(r1, rr1)
        c1 = cc1 if c1 is None else min(c1, cc1)
        r2 = rr2 if r2 is None else max(r2, rr2)
        c2 = cc2 if c2 is None else max(c2, cc2)
    if r1 is None:
        return None
    return (r1, c1, r2, c2)
