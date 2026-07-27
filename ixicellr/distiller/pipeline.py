"""정제 파이프라인: 원시 Action IR → 정규화 Step 리스트 (Docs/04 §4.4).

  1) drop_weak       : selection 등 약한 신호 제거
  2) coalesce_edits  : 연속 단일 셀 편집 → range_fill
  3) to_steps        : Step 으로 변환(설명 부여, source 분리)
"""
from __future__ import annotations

from typing import List

from ..model.action_ir import (
    CLEAR, COND_FORMAT, COPY_PASTE, COPY_SHEET, DELETE_COLS, DELETE_ROWS, FILTER, FORMAT,
    HYPERLINK_ADD, INSERT_COLS, INSERT_ROWS, MERGE, RANGE_FILL, CELL_EDIT, SHEET_ADD,
    SHEET_DELETE, SHEET_RENAME, SORT, UNMERGE, WEAK_KINDS, Action, Target,
)
from ..model.skill import Step
from ..workbooks.registry import basename_of
from .coalesce import coalesce_edits


def drop_weak(actions: List[Action]) -> List[Action]:
    return [a for a in actions if not a.weak and a.kind not in WEAK_KINDS]


def _loc(t: Target) -> str:
    return f"{t.sheet}!{t.range}" if t and t.range else (t.sheet if t else "?")


def _shape(payload: dict) -> str:
    grid = payload.get("values") or payload.get("formulas")
    if isinstance(grid, list) and grid:
        return f"{len(grid)}x{len(grid[0]) if grid[0] else 0}"
    return ""


def _describe(kind: str, target, source, payload: dict) -> str:
    if kind == RANGE_FILL:
        return f"값 채우기: {_loc(target)} ({_shape(payload)})"
    if kind == CELL_EDIT:
        grid = payload.get("values") or payload.get("formulas") or [[None]]
        return f"입력: {_loc(target)} = {grid[0][0]!r}"
    if kind == COPY_PASTE:
        mode = payload.get("mode", "all")
        tag = " (교차파일)" if source and target and source.book != target.book else ""
        spec = payload.get("source_spec")
        if spec:
            from ..model.rangespec import HEIGHT_LABELS
            lab = HEIGHT_LABELS.get(spec.get("height_mode"), spec.get("height_mode", ""))
            tag += f" · 의도:{lab}{' +필터행' if spec.get('visible_only') else ''}"
        return f"복붙[{mode}]: {_loc(source)} → {_loc(target)}{tag}"
    if kind == CLEAR:
        return f"셀 삭제: {_loc(target)}"
    if kind == FORMAT:
        return f"서식: {_loc(target)}"
    if kind == MERGE:
        return f"병합: {_loc(target)}"
    if kind == UNMERGE:
        return f"병합 해제: {_loc(target)}"
    if kind == SORT:
        return f"정렬: {_loc(target)}"
    if kind == INSERT_COLS:
        return f"열 삽입: {target.sheet}!{payload.get('index', target.range)} x {payload.get('count', 1)}"
    if kind == INSERT_ROWS:
        return f"행 삽입: {target.sheet}!{payload.get('index', target.range)} x {payload.get('count', 1)}"
    if kind == DELETE_COLS:
        return f"열 삭제: {target.sheet}!{payload.get('index', target.range)} x {payload.get('count', 1)}"
    if kind == DELETE_ROWS:
        return f"행 삭제: {target.sheet}!{payload.get('index', target.range)} x {payload.get('count', 1)}"
    if kind == "filter":
        n = len(payload.get("fields") or [])
        return f"필터: {_loc(target)} (조건 {n}개)"
    if kind == COPY_SHEET:
        return f"시트 복사: {_loc(source)} → {target.book if target else '?'}"
    if kind == SHEET_ADD:
        return f"시트 추가: {target.sheet}"
    if kind == SHEET_DELETE:
        return f"시트 삭제: {target.sheet}"
    if kind == SHEET_RENAME:
        return f"시트 이름변경: {payload.get('old', '?')} → {payload.get('new', target.sheet)}"
    return f"{kind}: {_loc(target)}"


def to_steps(actions: List[Action]) -> List[Step]:
    steps: List[Step] = []
    for i, a in enumerate(actions):
        src = a.payload.get("source")
        # payload['source'] 는 복붙 소스(dict) 전용. 다른 종류가 문자열 등을 넣어도
        # 깨지지 않도록 dict 일 때만 Target 으로 해석한다(방어).
        source_t = Target.from_dict(src) if isinstance(src, dict) else None
        payload = {k: v for k, v in a.payload.items() if k != "source"}
        steps.append(Step(
            id=f"{i:03d}", kind=a.kind, target=a.target, source=source_t,
            payload=payload, description=_describe(a.kind, a.target, source_t, payload),
        ))
    return steps


def dedupe_consecutive(actions: List[Action]) -> List[Action]:
    """연속으로 같은 대상(kind·book·sheet·range)을 다시 쓰면 마지막 것만 남긴다.

    전체 시트 편집(A1:DV8641 같은)이 여러 번 반복 캡처되는 노이즈를 제거한다.
    """
    additive = {COND_FORMAT, HYPERLINK_ADD}
    out: List[Action] = []
    for a in actions:
        if out and a.kind not in additive:
            p = out[-1]
            if (p.kind == a.kind and p.target.book == a.target.book
                    and p.target.sheet == a.target.sheet and p.target.range == a.target.range):
                out[-1] = a  # 마지막 값 유지
                continue
        out.append(a)
    return out


def dedupe_sheet_creations(actions: List[Action]) -> List[Action]:
    """같은 (book, sheet) 를 만드는 생성 액션(SHEET_ADD/COPY_SHEET) 중복을 하나로.

    같은 시트가 두 번 캡처될 수 있다 — 라이브 이벤트(OnWorkbookNewSheet)와 정지 시
    diff(diff_new_sheets)가 이름 보정 시점/이벤트 미발화 차이로 서로를 못 알아보는
    경우. 재현 시 두 번째 생성(특히 copy_sheet 의 rename)이 '같은 이름의 시트가
    이미 있습니다' COM 오류로 스텝 전체를 죽인다(사용자 실사례: TEST4).

    규칙: 첫 생성의 '시간 위치'를 지키되, 빈 시트만 만드는 SHEET_ADD 보다 내용을
    가져오는 COPY_SHEET 가 정보가 많으므로 [ADD 먼저 + COPY 나중] 이면 첫 자리를
    COPY_SHEET 로 승격하고 뒤 것을 버린다. 같은 종류 중복은 첫 것만 남긴다.
    SHEET_DELETE 가 나오면 그 이름의 추적을 리셋한다(삭제 후 재생성은 정상)."""
    creations = {}  # (book, sheet) -> out 리스트 인덱스
    out: List[Action] = []
    for a in actions:
        t = a.target
        if t is None:
            out.append(a)
            continue
        key = (t.book, t.sheet)
        if a.kind in (SHEET_ADD, COPY_SHEET):
            prev_idx = creations.get(key)
            if prev_idx is not None:
                if out[prev_idx].kind == SHEET_ADD and a.kind == COPY_SHEET:
                    # ADD→COPY 승격: COPY 를 ADD 의 이른 자리로 올린다. 그런데 ADD 와 COPY
                    # 사이에 같은 시트를 만지는 write/format 이 있으면, 승격 후 템플릿 복사가
                    # 그 편집보다 앞서 실행돼 편집이 템플릿에 덮이거나 순서 의미가 바뀔 수
                    # 있다. 크래시 방지(중복 생성 COM 오류)를 위해 승격은 유지하되 hazard 로
                    # 표기해 사용자에게 알린다.
                    for mid in out[prev_idx + 1:]:
                        mt = mid.target
                        if mt and mt.book == t.book and mt.sheet == t.sheet \
                                and mid.kind in (RANGE_FILL, CELL_EDIT, FORMAT, CLEAR):
                            a.payload["_reorder_hazard"] = True
                            break
                    out[prev_idx] = a  # 빈 생성 → 내용 있는 복사로 승격(위치 유지)
                continue  # 중복 생성 제거
            creations[key] = len(out)
        elif a.kind == SHEET_DELETE:
            creations.pop(key, None)
        out.append(a)
    return out


def _copy_source_key(a: Action):
    """COPY_PASTE 액션이 읽는 소스 (basename(book), sheet). 아니면 None."""
    if a.kind != COPY_PASTE:
        return None
    src = a.payload.get("source")
    if not isinstance(src, dict):
        return None
    return (basename_of(src.get("book") or ""), src.get("sheet"))


def order_source_mutations_before_copy(actions: List[Action]) -> List[Action]:
    """정렬/필터를 '그 시트를 읽는 복사'보다 앞으로 재배치한다(Docs/17 버그3·4).

    정렬/필터는 이벤트가 없어 정지 시 한꺼번에 액션 뒤에 붙는다(높은 seq). 그러나
    복붙은 재현 시 원본 범위를 다시 읽으므로, 정렬이 복사보다 뒤에 실행되면 복사가
    정렬 안 된 데이터를 읽는다(상위 12행이 정렬 전 순서). 그래서 '복사 소스 시트'를
    대상으로 하는 SORT/FILTER 만, 그 시트를 처음 읽는 복사 직전으로 옮긴다.

    복사 소스가 아닌 시트의 정렬/필터(예: 출력 시트의 필터+색칠)는 건드리지 않으므로
    회귀가 없다. 매칭되는 복사가 없으면 그대로 둔다."""
    copy_keys = {k for k in (_copy_source_key(a) for a in actions) if k}
    if not copy_keys:
        return actions
    movers, rest = [], []
    for a in actions:
        if a.kind in (SORT, FILTER) and a.target \
                and (basename_of(a.target.book), a.target.sheet) in copy_keys:
            movers.append(a)
        else:
            rest.append(a)
    if not movers:
        return actions
    by_key = {}
    for a in movers:
        by_key.setdefault((basename_of(a.target.book), a.target.sheet), []).append(a)
    # 각 소스 시트에 대해 '복사 이후에 같은 시트를 만지는 편집(write/clear/edit)'이 있으면,
    # 정렬을 복사 앞으로 옮기는 순간 그 편집보다도 앞서게 되어 재현 순서가 사용자가 한
    # sort→edit→copy 순서와 갈릴 수 있다(Docs/17 버그, 캡처 구조 한계). 이동은 흔한
    # sort→copy 를 맞추려 유지하되, 개입 편집이 있으면 hazard 로 표기해 사용자에게 알린다.
    copy_idx = {}
    for idx, a in enumerate(rest):
        k = _copy_source_key(a)
        if k and k in by_key and k not in copy_idx:
            copy_idx[k] = idx
    hazard_keys = set()
    for k, ci in copy_idx.items():
        _, sheet = k
        for a in rest[ci + 1:]:
            if a.kind in (RANGE_FILL, CELL_EDIT, CLEAR) and a.target \
                    and basename_of(a.target.book) == k[0] and a.target.sheet == sheet:
                hazard_keys.add(k)
                break
    out, inserted = [], set()
    for a in rest:
        k = _copy_source_key(a)
        if k and k in by_key and k not in inserted:
            for m in by_key[k]:
                if k in hazard_keys:
                    m.payload["_reorder_hazard"] = True
            out.extend(by_key[k])   # 이 시트의 정렬/필터를 복사 직전에
            inserted.add(k)
        out.append(a)
    for k, ms in by_key.items():     # 매칭 복사 못 찾은 것은 끝에(안전망)
        if k not in inserted:
            out.extend(ms)
    return out


def distill(actions: List[Action]) -> List[Step]:
    acts = drop_weak(actions)
    acts = coalesce_edits(acts)
    acts = dedupe_consecutive(acts)
    acts = dedupe_sheet_creations(acts)
    acts = order_source_mutations_before_copy(acts)
    return to_steps(acts)
