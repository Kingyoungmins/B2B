"""연속 단일 셀 편집 병합 (Docs/04 §4.4).

제공 프로토타입이 셀마다 코드를 뱉던 문제를 해결한다:
연속된 단일 셀 cell_edit 이 직사각형을 꽉 채우면 range_fill 하나로 묶고,
같은 셀을 여러 번 고치면 마지막 값만 남긴다(last-write-wins).
"""
from __future__ import annotations

from typing import List

from ..model import a1
from ..model.action_ir import CELL_EDIT, RANGE_FILL, Action, Target


def _scalar(payload: dict):
    """단일 셀 payload 에서 (mode, scalar) 추출."""
    mode = payload.get("mode", "value")
    if mode == "formula":
        grid = payload.get("formulas") or [[None]]
    else:
        grid = payload.get("values") or [[None]]
    cell = grid[0][0] if grid and grid[0] else None
    return mode, cell


def _is_single_cell(target: Target) -> bool:
    return a1.parse_cell(target.range.replace("$", "")) is not None


def _grid_payload(mode: str, grid):
    return {"mode": mode, ("formulas" if mode == "formula" else "values"): grid}


def _flush(run, key, first_seq, out):
    """누적된 단일 셀 run 을 직사각형이면 range_fill, 아니면 개별 cell_edit 로."""
    if not run:
        return
    book, sheet, mode = key
    cells = {}
    for r, c, val in run:  # last-write-wins
        cells[(r, c)] = val

    if len(cells) == 1:
        (r, c), val = next(iter(cells.items()))
        out.append(Action(first_seq, CELL_EDIT, Target(book, sheet, a1.make_cell(r, c)),
                          _grid_payload(mode, [[val]])))
        return

    rows = [r for r, _ in cells]
    cols = [c for _, c in cells]
    minr, maxr, minc, maxc = min(rows), max(rows), min(cols), max(cols)
    area = (maxr - minr + 1) * (maxc - minc + 1)

    if len(cells) == area:  # 직사각형을 꽉 채움 → range_fill 1개
        grid = [[cells[(minr + i, minc + j)] for j in range(maxc - minc + 1)]
                for i in range(maxr - minr + 1)]
        rng = a1.make_range((minr, minc), (maxr, maxc))
        out.append(Action(first_seq, RANGE_FILL, Target(book, sheet, rng),
                          _grid_payload(mode, grid)))
    else:
        # 듬성듬성 → 꽉 찬 부분 직사각형(run)들로 묶어 range_fill 로.
        # 셀당 스텝 1개는 재현 시 COM 왕복 폭발의 주범(스텝 수백 개 = 분 단위).
        # _rectangles 가 돌려주는 각 범위는 입력 셀로 꽉 차 있어 덮어쓰기 위험이 없다.
        from ..recorder.snapshot import _rectangles
        for rng in _rectangles(cells.keys()):
            parsed = a1.parse_range(rng)
            first = parsed[0] if parsed else a1.parse_cell(rng.replace("$", ""))
            last = parsed[1] if parsed else first
            if first == last:  # 단일 셀 → 기존과 동일하게 cell_edit
                r, c = first
                out.append(Action(first_seq, CELL_EDIT, Target(book, sheet, a1.make_cell(r, c)),
                                  _grid_payload(mode, [[cells[(r, c)]]])))
                continue
            (r1, c1), (r2, c2) = first, last
            grid = [[cells[(r, c)] for c in range(c1, c2 + 1)] for r in range(r1, r2 + 1)]
            out.append(Action(first_seq, RANGE_FILL, Target(book, sheet, rng),
                              _grid_payload(mode, grid)))


def coalesce_edits(actions: List[Action]) -> List[Action]:
    out: List[Action] = []
    run = []
    key = None
    first_seq = None

    for a in actions:
        if a.kind == CELL_EDIT and _is_single_cell(a.target):
            mode, val = _scalar(a.payload)
            k = (a.target.book, a.target.sheet, mode)
            cell = a1.parse_cell(a.target.range.replace("$", ""))
            if key is None or k != key:
                _flush(run, key, first_seq, out)
                run, key, first_seq = [], k, a.seq
            run.append((cell[0], cell[1], val))
        else:
            _flush(run, key, first_seq, out)
            run, key, first_seq = [], None, None
            # 다중 셀 cell_edit(범위 Target)은 이미 블록 → range_fill 로 재라벨
            if a.kind == CELL_EDIT:
                a = Action(a.seq, RANGE_FILL, a.target, a.payload, a.evidence)
            out.append(a)

    _flush(run, key, first_seq, out)
    return out
