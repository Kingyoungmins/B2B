"""서식 캡처 (Docs/04, Docs/10 §10.2). 서식엔 COM 이벤트가 없으므로 '상태 스냅샷'.

  - read_format_state(rng): 범위의 서식 상태를 데이터로 읽는다(COM).
  - format_state_diff(baseline, current): 무엇이 바뀌었나(순수 → 테스트).
  - build_format_action: FORMAT 액션 생성(순수).
  - capture_format(app, sink): 명시 트리거(COM).
  - diff_touched(...): 정지 시 bounded 스냅샷 diff(하이브리드, Docs/09 §9.3).
"""
from __future__ import annotations

from ..model.action_ir import FORMAT, Action, Target

XL_NONE = -4142  # xlNone (채우기/테두리 없음)
#: 테두리 4 변 (xlEdgeLeft/Top/Bottom/Right)
EDGES = {"left": 7, "top": 8, "bottom": 9, "right": 10}


def read_format_state(rng) -> dict:
    """Range 의 서식 상태를 읽는다(채우기·정렬·글꼴·테두리·숫자서식·병합).

    혼합 범위/예외 속성은 건너뛴다. 테두리·정렬을 포함해 재현 충실도를 높인다.
    """
    st: dict = {}
    # 채우기: 패턴까지 캡처해 '채우기 없음'을 보존(흰색으로 덮어쓰는 문제 방지)
    try:
        pat = int(rng.Interior.Pattern)
        st["fill_pattern"] = pat
        if pat != XL_NONE:
            st["fill"] = int(rng.Interior.Color)
    except Exception:
        pass
    try:
        st["number_format"] = rng.NumberFormat
    except Exception:
        pass
    # 병합: 셀별 bool 이 아니라 '병합 영역 주소'를 잡는다(행별 병합을 한 덩어리로
    # 합쳐버리는 그룹핑 버그 방지). 병합 안 됐으면 키 없음.
    try:
        if rng.MergeCells:
            st["merge_area"] = str(rng.MergeArea.Address).replace("$", "")
    except Exception:
        pass
    # 정렬(수평/수직/줄바꿈)
    align = {}
    for ak, getter in (
        ("h", lambda: int(rng.HorizontalAlignment)),
        ("v", lambda: int(rng.VerticalAlignment)),
        ("wrap", lambda: bool(rng.WrapText)),
    ):
        try:
            align[ak] = getter()
        except Exception:
            pass
    if align:
        st["align"] = align
    # 글꼴
    font = {}
    for fk, getter in (
        ("bold", lambda: bool(rng.Font.Bold)),
        ("italic", lambda: bool(rng.Font.Italic)),
        ("underline", lambda: int(rng.Font.Underline)),
        ("color", lambda: int(rng.Font.Color)),
        ("name", lambda: rng.Font.Name),
        ("size", lambda: float(rng.Font.Size)),
    ):
        try:
            font[fk] = getter()
        except Exception:
            pass
    if font:
        st["font"] = font
    # 테두리(4 변)
    borders = {}
    for name, edge in EDGES.items():
        try:
            b = rng.Borders(edge)
            ls = int(b.LineStyle)
            if ls == XL_NONE:
                borders[name] = {"style": XL_NONE}
            else:
                borders[name] = {"style": ls, "weight": int(b.Weight), "color": int(b.Color)}
        except Exception:
            pass
    if borders:
        st["borders"] = borders
    return st


def format_state_diff(baseline: dict, current: dict):
    """baseline 대비 current 에서 바뀐 서식만 추려 반환(없으면 None)."""
    changed: dict = {}
    # merge_area 는 그룹핑과 별도로(영역 단위) 처리하므로 여기선 제외.
    for k in ("fill", "fill_pattern", "number_format", "align", "borders"):
        if current.get(k) is not None and current.get(k) != baseline.get(k):
            changed[k] = current.get(k)
    fb = baseline.get("font") or {}
    fc = current.get("font") or {}
    fchg = {k: v for k, v in fc.items() if v is not None and fc.get(k) != fb.get(k)}
    if fchg:
        changed["font"] = fchg
    return changed or None


def build_format_action(seq: int, book: str, sheet: str, rng: str, fmt: dict) -> Action:
    return Action(seq, FORMAT, Target(book, sheet, rng),
                  payload={"format": fmt}, evidence={"capture": "format"})


def capture_format(app, sink, registry):
    """현재 선택 범위의 서식을 통째로 캡처(명시 트리거)."""
    try:
        sel = app.Selection
        book = registry.register(app.ActiveWorkbook)
        sheet = app.ActiveSheet.Name
        rng = str(sel.Address).replace("$", "")
        fmt = read_format_state(sel)
    except Exception as e:
        return None, f"서식 읽기 실패: {e}"
    a = build_format_action(sink._seq + 1, book, sheet, rng, fmt)
    sink.actions.append(a)
    sink._seq += 1
    return a, ""
