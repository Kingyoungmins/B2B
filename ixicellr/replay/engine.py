"""단일 재적용 함수 (Docs/03 §3.8, Docs/05 §5.1).

dispatch(ctx, step): 스텝 → ctx 동사 라우팅. **COM 무관** → 가짜 ctx 로 테스트.
replay(app, ctx_for, steps): 실제 Excel 에 적용(앱 설정 묶기/복원).

eval_eca ver0.5.8 교훈: 모든 실행 경로(정제 적용/리플레이/온오프/삭제/undo)는
이 한 함수로 수렴한다. 새 실행기를 만들지 않는다.
"""
from __future__ import annotations

from ..model import a1
from ..model.action_ir import (
    CELL_EDIT, CHART_ADD, CLEAR, COMMENT_SET, COND_FORMAT, COPY_PASTE, COPY_SHEET,
    DELETE_COLS, DELETE_ROWS, DIMENSION, FILTER, FORMAT, FREEZE, GROUP, HYPERLINK_ADD,
    INSERT_COLS, INSERT_ROWS, MERGE, NAME_ADD, PIVOT, PIVOT_ADD, RANGE_FILL, SHEET_ADD,
    SHEET_DELETE, SHEET_RENAME, SORT, TABLE_ADD, UNMERGE, VALIDATION,
)

# 앱 설정 상수
_XL_MANUAL, _XL_AUTOMATIC = -4135, -4105


class UnsupportedStep(RuntimeError):
    pass


def _start_cell(rng: str) -> str:
    """'A1:A3' -> 'A1'. 단일 셀/특수표기는 그대로."""
    parsed = a1.parse_range(rng)
    if not parsed:
        return rng
    return a1.make_cell(*parsed[0])


def dispatch(ctx, step, session=None) -> None:
    """한 스텝을 ctx 동사로 라우팅. ctx 는 동일 워크북 컨텍스트.

    session 이 주어지고 copy_paste 가 교차파일이면 세션 레벨로 라우팅한다(Docs/07).
    """
    if not step.enabled:
        return
    k = step.kind
    t = step.target
    p = step.payload or {}

    if k in (RANGE_FILL, CELL_EDIT):
        start = _start_cell(t.range)
        if p.get("mode") == "formula":
            grid = p.get("formulas")
            if grid is None:
                raise UnsupportedStep("수식 데이터 없음(deferred 미해결)")
            ctx.write_formulas(t.sheet, start, grid)
        else:
            grid = p.get("values")
            if grid is None:
                raise UnsupportedStep(f"값 데이터 없음(mode={p.get('mode')!r}, 큰 붙여넣기 deferred?)")
            ctx.write(t.sheet, start, grid)
    elif k == CLEAR:
        ctx.clear(t.sheet, t.range)
    elif k == COPY_PASTE:
        s = step.source
        src_range = s.range if s else t.range
        # 동적 의도(RangeSpec)가 붙어 있으면 '현재 데이터' 기준으로 소스 범위를 해석.
        # (고정 주소를 얼리지 않고 '데이터 끝까지/텍스트 찬 행만/상위 N'을 재현 시 계산)
        spec_d = p.get("source_spec")
        if spec_d and s:
            from ..model.rangespec import RangeSpec
            spec = RangeSpec.from_dict({**spec_d, "sheet": s.sheet})
            src_ctx = session.ctx_for(s.book) if session is not None else ctx
            resolved = src_ctx.resolve_spec(spec)
            if resolved:
                src_range = resolved
        if session is not None and s and t and s.book != t.book:
            session.paste_cross(
                {"book": s.book, "sheet": s.sheet, "range": src_range}, t, p.get("mode", "all"))
        else:
            ctx.paste_special(s.sheet, src_range, t.sheet, t.range, p.get("mode", "all"))
    elif k == SORT:
        ctx.sort(t.sheet, t.range, p.get("key_col", 1),
                 p.get("ascending", True), p.get("has_header", True))
    elif k == FILTER:
        ctx.apply_filter(t.sheet, t.range, p.get("fields") or [])
    elif k == FORMAT:
        ctx.apply_format_state(t.sheet, t.range, p.get("format") or p)
    elif k == MERGE:
        ctx.merge(t.sheet, t.range)
    elif k == UNMERGE:
        ctx.unmerge(t.sheet, t.range)
    elif k == DIMENSION:
        if p.get("axis") == "row":
            ctx.set_row_height(t.sheet, p["index"], p["size"])
        else:
            ctx.set_column_width(t.sheet, p["index"], p["size"])
    elif k == INSERT_COLS:
        ctx.insert_cols(t.sheet, p.get("index") or t.range, p.get("count", 1))
    elif k == INSERT_ROWS:
        ctx.insert_rows(t.sheet, p.get("index") or t.range, p.get("count", 1))
    elif k == DELETE_COLS:
        ctx.delete_cols(t.sheet, p.get("index") or t.range, p.get("count", 1))
    elif k == DELETE_ROWS:
        ctx.delete_rows(t.sheet, p.get("index") or t.range, p.get("count", 1))
    elif k == COPY_SHEET:
        s = step.source
        ctx.copy_sheet(s.sheet, new_name=p.get("new_name"))
    elif k == NAME_ADD:
        ctx.add_name(p["name"], p["refers_to"], scope_sheet=p.get("scope_sheet"))
    elif k == COMMENT_SET:
        ctx.set_comment(t.sheet, t.range, p.get("text", ""))
    elif k == HYPERLINK_ADD:
        ctx.add_hyperlink(t.sheet, t.range, address=p.get("address", ""),
                          sub_address=p.get("sub_address", ""),
                          text=p.get("text"), screen_tip=p.get("screen_tip", ""))
    elif k == TABLE_ADD:
        ctx.add_table(t.sheet, t.range, name=p.get("name"),
                      has_headers=p.get("has_headers", True), style=p.get("style"))
    elif k == FREEZE:
        ctx.set_freeze(t.sheet, rows=p.get("rows", 0), cols=p.get("cols", 0))
    elif k == GROUP:
        ctx.group_axis(t.sheet, p.get("axis", "row"), p.get("band") or t.range)
    elif k == VALIDATION:
        ctx.add_validation(t.sheet, t.range, p["vtype"], operator=p.get("operator"),
                           formula1=p.get("formula1"), formula2=p.get("formula2"),
                           alert_style=p.get("alert_style"),
                           ignore_blank=p.get("ignore_blank"),
                           in_cell_dropdown=p.get("in_cell_dropdown"),
                           show_input=p.get("show_input"), show_error=p.get("show_error"),
                           input_title=p.get("input_title"),
                           input_message=p.get("input_message"),
                           error_title=p.get("error_title"),
                           error_message=p.get("error_message"))
    elif k == COND_FORMAT:
        ctx.add_cond_format(t.sheet, t.range, p["ctype"], operator=p.get("operator"),
                            formula1=p.get("formula1"), formula2=p.get("formula2"),
                            fill=p.get("fill"), font_color=p.get("font_color"),
                            priority=p.get("priority"), stop_if_true=p.get("stop_if_true"),
                            font_bold=p.get("font_bold"), font_italic=p.get("font_italic"),
                            font_underline=p.get("font_underline"),
                            number_format=p.get("number_format"))
    elif k == CHART_ADD:
        ctx.add_chart(t.sheet, chart_type=p.get("chart_type"),
                      source_range=p.get("src_range") or None,
                      left=p.get("left", 100.0), top=p.get("top", 100.0),
                      width=p.get("width", 360.0), height=p.get("height", 216.0),
                      name=p.get("name"), title=p.get("title"),
                      legend_position=p.get("legend_position"),
                      x_axis_title=p.get("x_axis_title"), y_axis_title=p.get("y_axis_title"))
    elif k == PIVOT_ADD:
        ctx.add_pivot(p["src_data"], p["dest_sheet"], p["dest_cell"], name=p.get("name"),
                      row_fields=p.get("rows"), col_fields=p.get("cols"),
                      page_fields=p.get("pages"), data_fields=p.get("datas"),
                      page_values=p.get("page_values"), style=p.get("style"),
                      row_stripes=p.get("row_stripes"), col_stripes=p.get("col_stripes"))
    elif k == PIVOT:
        pass  # 옛 피벗 마커 — 재구성은 PIVOT_ADD 가 한다(마커는 무시, 크래시 방지)
    elif k == SHEET_ADD:
        ctx.add_sheet(t.sheet, after=p.get("after", True))
    elif k == SHEET_DELETE:
        ctx.delete_sheet(t.sheet)
    elif k == SHEET_RENAME:
        ctx.rename_sheet(p.get("old", t.sheet), p.get("new") or t.sheet)
    else:
        raise UnsupportedStep(f"리플레이 미지원 스텝: {k}")


def _reset_step_budget(ctx_for, book, session):
    """스텝 경계: 이 스텝이 건드릴 수 있는 모든 ctx 의 COM 예산을 리셋.

    교차파일/RangeSpec 해석은 소스 워크북 ctx 도 쓰므로, 세션이 가진 ctx 전부를
    리셋한다(없으면 현재 book ctx 하나)."""
    ctxs = []
    if session is not None and hasattr(session, "_ctx"):
        ctxs = list(session._ctx.values())
    try:
        ctxs.append(ctx_for(book))
    except Exception:
        pass
    for c in ctxs:
        reset = getattr(c, "reset_budget", None)
        if callable(reset):
            try:
                reset()
            except Exception:
                pass


def _freeze_app(app):
    return {
        "screen": app.ScreenUpdating,
        "calc": app.Calculation,
        "events": app.EnableEvents,
        "alerts": app.DisplayAlerts,
    }


def _set_fast(app):
    app.ScreenUpdating = False
    app.EnableEvents = False        # 리플레이 변경이 레코더에 재귀 캡처되지 않도록
    app.DisplayAlerts = False
    app.Calculation = _XL_MANUAL


def _thaw_app(app, prev):
    app.ScreenUpdating = prev["screen"]
    app.EnableEvents = prev["events"]
    app.DisplayAlerts = prev["alerts"]
    app.Calculation = prev["calc"]


def replay(app, steps, *, registry=None, ctx_for=None, restore: bool = True,
           results=None, sheet_map=None) -> int:
    """실제 Excel 에 스텝들을 **단계별로** 적용. 한 단계가 실패해도 멈추지 않고
    다음 단계로 진행하며, 각 단계 결과를 results(리스트)에 적재한다.

    results 원소: {"id","kind","sheet","range","desc","ok","error"}
    반환: 성공한 단계 수.
    """
    from ..runtime import log
    from .session import ReplaySession

    session = ReplaySession(app, registry, sheet_map=sheet_map) if registry is not None else None
    if ctx_for is None:
        if session is not None:
            ctx_for = session.ctx_for
        else:
            raise ValueError("replay 에는 registry 또는 ctx_for 가 필요하다")

    prev = _freeze_app(app) if restore else None
    applied = 0
    enabled = [s for s in steps if s.enabled]
    log.info(f"replay: 단계 {len(enabled)}개 시작")
    try:
        _set_fast(app)
        for step in enabled:
            book = step.target.book if step.target else None
            rec = {"id": getattr(step, "id", "?"), "kind": step.kind,
                   "sheet": step.target.sheet if step.target else "",
                   "range": step.target.range if step.target else "",
                   "desc": getattr(step, "description", ""), "ok": False, "error": ""}
            # COM 예산은 '스텝당' 한도 — 스텝 시작 시 모든 ctx 카운터를 리셋한다.
            # (ctx 가 워크북당 캐시 재사용되어 누적되면 후속 스텝이 가드에 걸리는 버그)
            _reset_step_budget(ctx_for, book, session)
            try:
                dispatch(ctx_for(book), step, session=session)
                rec["ok"] = True
                applied += 1
                log.info(f"  ✓ {rec['id']} {rec['kind']} {rec['sheet']}!{rec['range']}")
            except Exception as e:
                rec["error"] = f"{type(e).__name__}: {e}"
                log.error(f"  ✗ {rec['id']} {rec['kind']} {rec['sheet']}!{rec['range']} — {rec['error']}")
            if results is not None:
                results.append(rec)
        try:
            app.Calculate()
        except Exception:
            pass
    finally:
        if session is not None:
            session.close_opened()
        if restore and prev:
            _thaw_app(app, prev)
    log.info(f"replay: 완료 — 성공 {applied}/{len(enabled)}")
    return applied
