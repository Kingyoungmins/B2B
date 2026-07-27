"""하이브리드 캡처: 정지 시 서식 스냅샷 diff (Docs/09 §9.3, Docs/10 §10.2).

서식 변경엔 COM 이벤트가 없다. 그래서 작업 중엔 서식을 안 읽고(버벅임 방지),
정지 시점에 '건드린 범위'만 bounded 스냅샷을 떠 baseline 과 비교해 FORMAT 액션을
만든다. diff/그룹핑은 COM 무관 → 테스트 가능.
"""
from __future__ import annotations

from collections import defaultdict

from ..model import a1
from ..model.action_ir import FORMAT, Action, Target

#: 셀별로 스냅샷하는 서식 속성(가벼운 핵심만)
STATE_KEYS = ("fill", "number_format", "merge", "bold")


def cell_state(cell_rng) -> dict:
    """단일 셀의 서식 상태(COM). 예외 속성은 건너뛴다."""
    st = {}
    for key, getter in (
        ("fill", lambda: int(cell_rng.Interior.Color)),
        ("number_format", lambda: cell_rng.NumberFormat),
        ("merge", lambda: bool(cell_rng.MergeCells)),
        ("bold", lambda: bool(cell_rng.Font.Bold)),
    ):
        try:
            st[key] = getter()
        except Exception:
            pass
    return st


def snapshot_range(ws, top_left, bottom_right, *, max_cells):
    """범위를 셀별 서식 상태 dict 로(COM). 셀 수가 상한을 넘으면 None(bounded)."""
    (r1, c1), (r2, c2) = top_left, bottom_right
    if (r2 - r1 + 1) * (c2 - c1 + 1) > max_cells:
        return None
    snap = {}
    for r in range(r1, r2 + 1):
        for c in range(c1, c2 + 1):
            snap[(r, c)] = cell_state(ws.Cells(r, c))
    return snap


def diff_snapshots(baseline: dict, current: dict) -> dict:
    """baseline→current 에서 셀별로 바뀐 속성만 추린다(순수)."""
    changes = {}
    for pos, cur in current.items():
        base = baseline.get(pos, {})
        chg = {k: v for k, v in cur.items() if cur.get(k) != base.get(k)}
        if chg:
            changes[pos] = chg
    return changes


def _change_key(chg: dict):
    return tuple(sorted((k, str(v)) for k, v in chg.items()))


def _rectangles(positions):
    """같은 변경을 가진 셀들을 범위로. 꽉 찬 직사각형이면 1개, 아니면 같은
    가로 구간을 가진 행들을 세로로 병합하고, 마지막으로 열별 연속 행 런으로 묶는다.

    기존의 열별 런만으로는 A1:Z100 같은 넓은 행 방향 서식이 A열/B열/...로 쪼개질
    수 있었다. 가로 구간 병합을 먼저 해 replay COM 호출 수를 크게 줄인다."""
    cells = set(positions)
    rows = [r for r, _ in cells]
    cols = [c for _, c in cells]
    minr, maxr, minc, maxc = min(rows), max(rows), min(cols), max(cols)
    if len(cells) == (maxr - minr + 1) * (maxc - minc + 1):
        return [a1.make_range((minr, minc), (maxr, maxc))]

    # 1) 행별 contiguous column interval 을 만들고, 같은 interval 을 가진 연속 행을
    # 세로로 병합한다. 예: A1:Z1, A2:Z2, ... → A1:Z100 한 스텝.
    by_row = defaultdict(list)
    for r, c in cells:
        by_row[r].append(c)
    intervals = defaultdict(list)  # (c1,c2) -> rows
    for r, cs in by_row.items():
        cs = sorted(cs)
        start = prev = cs[0]
        for c in cs[1:]:
            if c == prev + 1:
                prev = c
                continue
            intervals[(start, prev)].append(r)
            start = prev = c
        intervals[(start, prev)].append(r)
    row_rects = []
    for (c1, c2), rs in intervals.items():
        rs = sorted(rs)
        start = prev = rs[0]
        for r in rs[1:]:
            if r == prev + 1:
                prev = r
                continue
            row_rects.append(a1.make_range((start, c1), (prev, c2)))
            start = prev = r
        row_rects.append(a1.make_range((start, c1), (prev, c2)))

    # 2) 매우 드문 세로 위주 sparse 패턴에서는 기존 열별 런이 더 작을 수 있다.
    by_col = defaultdict(list)
    for r, c in cells:
        by_col[c].append(r)
    col_rects = []
    for c in sorted(by_col):
        rs = sorted(by_col[c])
        start = prev = rs[0]
        for r in rs[1:]:
            if r == prev + 1:
                prev = r
                continue
            col_rects.append(a1.make_range((start, c), (prev, c)))
            start = prev = r
        col_rects.append(a1.make_range((start, c), (prev, c)))
    return row_rects if len(row_rects) <= len(col_rects) else col_rects


#: union 주소("A1:B2,A4:B4") 한 덩어리의 최대 길이. Range() 주소 문자열 한계(255자)
#: 아래로 보수적으로 잡는다.
UNION_ADDR_MAX_CHARS = 200


def _union_chunks(rects):
    """직사각형 주소들을 union 주소 문자열 덩어리로 합친다(길이 상한 준수)."""
    chunks, cur = [], ""
    for r in rects:
        cand = f"{cur},{r}" if cur else r
        if len(cand) > UNION_ADDR_MAX_CHARS and cur:
            chunks.append(cur)
            cur = r
        else:
            cur = cand
    if cur:
        chunks.append(cur)
    return chunks


def group_changes(changes: dict, book: str, sheet: str, *, start_seq: int = 1):
    """셀별 변경을 동일 변경끼리 묶어 FORMAT 액션 리스트로(순수).

    같은 서식의 떨어진 직사각형들은 union 주소로 다시 합쳐 스텝 1개로 만든다
    (줄무늬 표 서식이 행 run 수백 개 = FORMAT 스텝 수백 개가 되는 것 방지).
    단 테두리/병합이 있는 서식은 다중영역 적용 시 변(邊) 해석이 영역별로 달라
    위험하므로 기존처럼 직사각형별 스텝으로 둔다."""
    groups = defaultdict(list)
    for pos, chg in changes.items():
        groups[_change_key(chg)].append(pos)

    actions = []
    seq = start_seq
    for positions in groups.values():
        chg = dict(changes[positions[0]])
        rects = _rectangles(positions)
        unionable = not (chg.get("borders") or chg.get("merge") or chg.get("merge_area"))
        rngs = _union_chunks(rects) if unionable and len(rects) > 1 else rects
        for rng in rngs:
            actions.append(Action(seq, FORMAT, Target(book, sheet, rng),
                                  payload={"format": chg},
                                  evidence={"capture": "snapshot_diff"}))
            seq += 1
    return actions


def diff_to_actions(baseline, current, book, sheet, *, start_seq=1):
    """baseline/current 스냅샷 → FORMAT 액션 리스트(diff + 그룹핑)."""
    return group_changes(diff_snapshots(baseline, current), book, sheet, start_seq=start_seq)


# === 전체-서식 자동 스냅샷 (시작/정지 diff) — read_format_state 충실 캡처 사용 ===

def snapshot_sheet_formats(ws, *, max_cells):
    """시트 used range 의 셀별 전체 서식 상태. 셀 수 상한 초과 시 None(bounded)."""
    from .format_capture import read_format_state
    ur = ws.UsedRange
    r1, c1 = int(ur.Row), int(ur.Column)
    rows, cols = int(ur.Rows.Count), int(ur.Columns.Count)
    if rows * cols > max_cells:
        return None
    cells = ur.Cells
    snap = {}
    for i in range(rows):
        for j in range(cols):
            snap[(r1 + i, c1 + j)] = read_format_state(cells(i + 1, j + 1))
    return snap


def snapshot_region_formats(ws, r1, c1, r2, c2, *, max_cells):
    """지정한 사각 영역만 셀별 전체 서식 상태로(COM). 큰 시트에서 전체 UsedRange
    대신 '작업한 영역'만 떠 저사양을 유지하면서도 수동 병합/서식을 살린다."""
    from .format_capture import read_format_state
    if r2 < r1 or c2 < c1 or (r2 - r1 + 1) * (c2 - c1 + 1) > max_cells:
        return None
    snap = {}
    for r in range(r1, r2 + 1):
        for c in range(c1, c2 + 1):
            snap[(r, c)] = read_format_state(ws.Cells(r, c))
    return snap


def default_format_state(ws):
    """빈 셀의 기본 서식(새로 생긴 셀의 baseline 비교용)."""
    from .format_capture import read_format_state
    try:
        return read_format_state(ws.Cells(1048576, 16384))
    except Exception:
        return {}


def format_diff_actions(base, current, default, book, sheet, *, start_seq=1):
    """전체 서식 스냅샷 base→current diff → FORMAT 액션(그룹핑) + 병합 대칭 diff.

    병합은 셀별 bool 을 사각형으로 묶으면 행별 병합이 한 덩어리로 합쳐지므로,
    '병합 영역(merge_area)' 단위로 처리한다. 대칭 diff:
      - 새로 생긴 영역(cur-base) → MERGE
      - 없어진 영역(base-cur)   → UNMERGE  ← 병합 해제/모양변경 복원(예전엔 add-only 라
        사용자가 병합을 풀거나 좁혀도 재현이 옛 병합을 그대로 남겨 겹쳤다).
    모양 변경(예: A1:C1→A1:B1)은 base-cur={A1:C1}, cur-base={A1:B1} 로 자연히
    'UNMERGE(A1:C1) 다음 MERGE(A1:B1)' 가 방출된다. 겹침 방지를 위해 **모든 UNMERGE 를
    MERGE 보다 앞 seq** 로 둔다.

    [주의] base 가 빈 dict({}) 인 baseline-없음 경로(com_events.capture_format_diffs)에서는
    base_areas 가 비어 UNMERGE 가 방출되지 않는다 — baseline 이 없으면 무엇이 사라졌는지
    알 수 없으므로 의도적으로 add-only 로 동작(가짜 UNMERGE 방지).
    """
    from ..model.action_ir import MERGE, UNMERGE, Action, Target
    from .format_capture import format_state_diff
    # 1) 서식(병합 제외) diff → 그룹핑
    changes = {}
    for pos, cur in current.items():
        d = format_state_diff(base.get(pos, default or {}), cur)
        if d:
            changes[pos] = d
    actions = group_changes(changes, book, sheet, start_seq=start_seq)
    # 2) 병합 영역 대칭 diff — UNMERGE(제거/모양변경 옛 영역) 먼저, 그 다음 MERGE(신규)
    base_areas = {st["merge_area"] for st in base.values() if st.get("merge_area")}
    cur_areas = {st["merge_area"] for st in current.values() if st.get("merge_area")}
    seq = start_seq + len(actions)
    for area in sorted(base_areas - cur_areas):
        actions.append(Action(seq, UNMERGE, Target(book, sheet, area),
                              evidence={"capture": "merge_diff"}))
        seq += 1
    for area in sorted(cur_areas - base_areas):
        actions.append(Action(seq, MERGE, Target(book, sheet, area),
                              evidence={"capture": "merge_diff"}))
        seq += 1
    return actions


def snapshot_dimensions(ws, *, max_cols: int, max_rows: int):
    """UsedRange 안의 열너비/행높이 스냅샷(COM). 값/서식 셀 read 는 하지 않는다.

    **저사양 핵심**: 행/열별로 RowHeight/ColumnWidth 를 다 읽으면 대용량 시트에서
    수천 COM 호출(행 2000개 ≈ 2.5s)로 녹화 시작이 느려진다. 그래서 먼저 범위 전체의
    값을 1회 읽어(`ur.RowHeight`/`ur.ColumnWidth`) **균일이면 행/열별 스캔을 건너뛴다**
    (None=혼합일 때만 스캔). 균일값은 default 로 보관해 diff 가 기준으로 쓴다(실측).
    """
    from ..model import a1 as _a1
    try:
        ur = ws.UsedRange
        r1, c1 = int(ur.Row), int(ur.Column)
        rows, cols = int(ur.Rows.Count), int(ur.Columns.Count)
    except Exception:
        return {"cols": {}, "rows": {}, "col_default": None, "row_default": None}
    out = {"cols": {}, "rows": {}, "col_default": None, "row_default": None}
    # 열: 균일이면 default 만, 혼합(None)이면 균일블록 분할정복 스캔.
    try:
        cw = ur.ColumnWidth
    except Exception:
        cw = None
    if cw is None:
        cend = c1 + min(cols, max_cols) - 1
        runs = []
        _dim_uniform_runs(lambda a, b: ws.Range(ws.Columns(a), ws.Columns(b)).ColumnWidth,
                          c1, cend, runs)
        out["col_default"], entries = _runs_to_sparse(runs)
        out["cols"] = {_a1.num_to_col(c): v for c, v in entries}
    else:
        out["col_default"] = float(cw)
    # 행: 균일이면 default 만(대용량의 핵심 단축), 혼합이면 균일블록 분할정복 스캔.
    # 예전엔 행별 RowHeight/Hidden 을 다 읽어 5000행 ≈ 7.5s(COM 1만콜) — 13MB 빌링
    # 파일에서 녹화 시작/정지를 수십 초로 만들던 주범(실측). 균일블록은 범위 1콜로
    # 끝나므로 높이 구간이 k개면 ≈ 2k·log n 콜로 준다. 숨김 행/열은 값 0 → 제외 규칙 유지.
    try:
        rh = ur.RowHeight
    except Exception:
        rh = None
    if rh is None:
        rend = r1 + min(rows, max_rows) - 1
        runs = []
        _dim_uniform_runs(lambda a, b: ws.Range(ws.Rows(a), ws.Rows(b)).RowHeight,
                          r1, rend, runs)
        out["row_default"], entries = _runs_to_sparse(runs)
        out["rows"] = {str(r): v for r, v in entries}
    else:
        out["row_default"] = float(rh)
    return out


def _dim_uniform_runs(get_dim, lo, hi, runs):
    """[lo,hi] 를 균일 높이/너비 블록으로 분할 정복 — get_dim(a,b) 는 범위가 균일하면
    float, 혼합이면 None(Excel COM 규약). 실패/혼합 단일 인덱스는 건너뛴다(종전 except pass 동일)."""
    if hi < lo:
        return
    try:
        v = get_dim(lo, hi)
    except Exception:
        v = None
    if v is not None:
        runs.append((lo, hi, float(v)))
        return
    if lo == hi:
        return
    mid = (lo + hi) // 2
    _dim_uniform_runs(get_dim, lo, mid, runs)
    _dim_uniform_runs(get_dim, mid + 1, hi, runs)


def _runs_to_sparse(runs):
    """균일블록 run 목록 → (최빈 default, [(index, 값)…] 예외 항목).

    가장 많은 행/열을 덮는 값을 default 로 잡고 나머지만 예외로 — dimension_diff_actions
    는 'current 항목 vs base(없으면 default)' 비교라 sparse 표현과 호환된다.
    값 0(숨김 행/열)은 default 후보/예외 모두에서 제외(필터 숨김 오인 방지, Docs/17 §14)."""
    weight = {}
    for lo, hi, v in runs:
        if v and v > 0:
            weight[v] = weight.get(v, 0) + (hi - lo + 1)
    default = max(weight, key=weight.get) if weight else None
    entries = []
    for lo, hi, v in runs:
        if not v or v <= 0 or v == default:
            continue
        for i in range(lo, hi + 1):
            entries.append((i, v))
    return default, entries


def dimension_diff_actions(base, current, book, sheet, *, start_seq=1, tolerance=0.01):
    """열너비/행높이 스냅샷 diff → DIMENSION 액션."""
    from ..model.action_ir import DIMENSION
    actions = []
    seq = start_seq
    base = base or {}
    current = current or {}
    base_cols, cur_cols = base.get("cols", {}), current.get("cols", {})
    col_def = base.get("col_default")  # 균일 baseline 이면 행/열별 항목 대신 default 비교
    row_def = base.get("row_default")
    for col, width in cur_cols.items():
        old = base_cols.get(col, col_def)
        if old is not None and abs(float(width) - float(old)) > tolerance:
            # target.range 에 인덱스를 넣어 각 행/열 변경이 구분되게 한다(빈 range 면
            # dedupe_consecutive 가 연속 DIMENSION 을 하나로 합쳐 마지막만 남는다).
            # 재현은 payload['index'] 를 쓰므로 range 값은 표시·구분용.
            actions.append(Action(seq, DIMENSION, Target(book, sheet, str(col)),
                                  payload={"axis": "col", "index": col, "size": float(width)},
                                  evidence={"capture": "dimension_diff"}))
            seq += 1
    base_rows, cur_rows = base.get("rows", {}), current.get("rows", {})
    for row, height in cur_rows.items():
        old = base_rows.get(str(row), row_def)
        if old is not None and abs(float(height) - float(old)) > tolerance:
            actions.append(Action(seq, DIMENSION, Target(book, sheet, str(row)),
                                  payload={"axis": "row", "index": int(row), "size": float(height)},
                                  evidence={"capture": "dimension_diff"}))
            seq += 1
    return actions
