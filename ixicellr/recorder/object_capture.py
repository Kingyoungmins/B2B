"""정지 시 스냅샷 diff 로 잡는 객체/속성 캡처 (Docs/15).

이벤트가 없는 기능들(이름정의·메모·표·틀고정·그룹·유효성·조건부서식)을 begin/stop
스냅샷의 차이로 액션화한다 — 정렬/필터/서식 자동 캡처와 같은 철학(버튼 불필요).

각 기능은 COM 스냅샷(snap_*)과 **순수 diff(diff_*)** 로 나뉜다. diff 는 Excel 없이
단위테스트한다. 다중 인스턴스 액션은 target.range 를 서로 다르게 둬서 distiller 의
dedupe_consecutive 가 하나로 합치지 않게 한다(빈 range 충돌 방지 — Docs/15 §1).
"""
from __future__ import annotations

import hashlib
import re

from ..model.action_ir import (
    CHART_ADD, COMMENT_SET, COND_FORMAT, COPY_SHEET, FREEZE, GROUP, HYPERLINK_ADD,
    NAME_ADD, PIVOT_ADD, TABLE_ADD, VALIDATION, Action, Target,
)
from ..model import a1 as _a1


def _norm(addr):
    return str(addr).replace("$", "")


def _safe_count(obj, attr, default=0):
    try:
        return int(getattr(obj, attr).Count)
    except Exception:
        return default


def _get(obj, attr, default=None):
    try:
        return getattr(obj, attr)
    except Exception:
        return default


def _bool_or_none(value):
    if value is None:
        return None
    try:
        return bool(value)
    except Exception:
        return None


def _style_name(value):
    """스타일 속성을 직렬화 가능한 이름 문자열로. PivotTable.TableStyle2 는 gen_py
    바인딩에서 문자열이 아니라 TableStyle COM 객체를 돌려줄 수 있어(payload 가 JSON
    직렬화 불가가 됨 — 피벗 포함 녹화 저장 크래시), .Name 으로 좁힌다(실측)."""
    if value is None:
        return None
    name = _get(value, "Name", None)  # COM 객체면 .Name, 문자열이면 없음 → None
    if name is not None:
        try:
            return str(name)
        except Exception:
            return None
    try:
        s = str(value)
        return s or None
    except Exception:
        return None


def cheap_sheet_signature(ws):
    """begin/stop 에 저렴하게 읽는 시트 메타. dirty 모드의 deep diff 후보 판정용."""
    try:
        ur = ws.UsedRange
        sig = {
            "used": _norm(ur.Address),
            "rows": int(ur.Rows.Count),
            "cols": int(ur.Columns.Count),
            "comments": _safe_count(ws, "Comments"),
            "hyperlinks": _safe_count(ws, "Hyperlinks"),
            "tables": _safe_count(ws, "ListObjects"),
            "charts": 0,
            "pivots": 0,
        }
        try:
            sig["charts"] = int(ws.ChartObjects().Count)
        except Exception:
            pass
        try:
            sig["pivots"] = int(ws.PivotTables().Count)
        except Exception:
            pass
        try:
            sig["filter"] = bool(ws.AutoFilterMode)
        except Exception:
            sig["filter"] = False
        return sig
    except Exception:
        return {}


def _bands(nums):
    """정렬된 정수 목록을 연속 구간 [(start,end), ...] 으로."""
    nums = sorted(set(int(n) for n in nums))
    out = []
    if not nums:
        return out
    start = prev = nums[0]
    for n in nums[1:]:
        if n == prev + 1:
            prev = n
            continue
        out.append((start, prev))
        start = prev = n
    out.append((start, prev))
    return out


# ============================ 이름 정의 (워크북) ============================
def snap_names(wb):
    out = {}
    try:
        names = wb.Names
    except Exception:
        return out
    for nm in names:
        try:
            name = str(nm.Name)
            base = name.split("!")[-1]
            if base.startswith("_") or base in ("Print_Area", "Print_Titles"):
                continue  # 인쇄영역 등 내장 이름 제외
            try:
                if nm.Visible is False:
                    continue
            except Exception:
                pass
            out[name] = str(nm.RefersTo)
        except Exception:
            continue
    return out


def diff_names(base, cur, book, *, start_seq=1):
    acts, seq = [], start_seq
    for name, refers in cur.items():
        if (base or {}).get(name) != refers:
            acts.append(Action(seq, NAME_ADD, Target(book, "", name),
                               payload={"name": name, "refers_to": refers},
                               evidence={"capture": "name_diff"}))
            seq += 1
    return acts


# ============================ 셀 메모 (시트) ============================
def snap_comments(ws):
    out = {}
    try:
        comments = ws.Comments
    except Exception:
        return out
    for c in comments:
        try:
            out[_norm(c.Parent.Address)] = str(c.Text())
        except Exception:
            continue
    return out


def diff_comments(base, cur, book, sheet, *, start_seq=1):
    acts, seq = [], start_seq
    for addr, text in cur.items():
        if (base or {}).get(addr) != text:
            acts.append(Action(seq, COMMENT_SET, Target(book, sheet, addr),
                               payload={"text": text}, evidence={"capture": "comment_diff"}))
            seq += 1
    return acts


# ============================ 하이퍼링크 (시트) ============================
def snap_hyperlinks(ws):
    out = {}
    try:
        links = ws.Hyperlinks
    except Exception:
        return out
    for i, link in enumerate(links, 1):
        try:
            anchor = _norm(link.Range.Address)
        except Exception:
            try:
                anchor = _norm(link.Parent.Address)
            except Exception:
                anchor = f"link{i}"
        try:
            text = str(link.TextToDisplay)
        except Exception:
            text = None
        out[anchor] = {
            "address": _get(link, "Address", "") or "",
            "sub_address": _get(link, "SubAddress", "") or "",
            "text": text,
            "screen_tip": _get(link, "ScreenTip", "") or "",
        }
    return out


def diff_hyperlinks(base, cur, book, sheet, *, start_seq=1):
    acts, seq = [], start_seq
    for addr, spec in cur.items():
        if (base or {}).get(addr) == spec:
            continue
        acts.append(Action(seq, HYPERLINK_ADD, Target(book, sheet, addr),
                           payload=dict(spec),
                           evidence={"capture": "hyperlink_diff"}))
        seq += 1
    return acts


# ============================ 표 / ListObject (시트) ============================
def snap_tables(ws):
    out = {}
    try:
        los = ws.ListObjects
    except Exception:
        return out
    for lo in los:
        try:
            has_headers = True
            try:
                has_headers = lo.HeaderRowRange is not None
            except Exception:
                pass
            style = None
            try:
                style = str(lo.TableStyle.Name)
            except Exception:
                pass
            out[str(lo.Name)] = {"range": _norm(lo.Range.Address),
                                 "has_headers": has_headers, "style": style}
        except Exception:
            continue
    return out


def diff_tables(base, cur, book, sheet, *, start_seq=1):
    acts, seq = [], start_seq
    for name, spec in cur.items():
        if (base or {}).get(name) == spec:
            continue
        acts.append(Action(seq, TABLE_ADD, Target(book, sheet, spec["range"]),
                           payload={"name": name, "has_headers": spec.get("has_headers", True),
                                    "style": spec.get("style")},
                           evidence={"capture": "table_diff"}))
        seq += 1
    return acts


# ============================ 틀 고정 (창/활성시트) ============================
def snap_freeze(app):
    """활성 창의 틀 고정 상태. 없으면 None. (틀고정은 창 단위라 활성 시트 기준)."""
    try:
        win = app.ActiveWindow
        if not win.FreezePanes:
            return None
        return {"sheet": app.ActiveSheet.Name,
                "rows": int(win.SplitRow), "cols": int(win.SplitColumn)}
    except Exception:
        return None


def diff_freeze(base, cur, book, *, start_seq=1):
    if not cur or cur == base:
        return []
    return [Action(start_seq, FREEZE, Target(book, cur["sheet"], ""),
                   payload={"rows": cur["rows"], "cols": cur["cols"]},
                   evidence={"capture": "freeze_diff"})]


# ============================ 행/열 그룹 (시트) ============================
def snap_outline(ws, *, max_rows, max_cols):
    """행/열 그룹(개요) 스냅샷. **저사양 핵심**: OutlineLevel 을 행/열마다 읽으면
    대용량에서 느리므로, 먼저 범위 전체의 OutlineLevel 을 1회 읽어 **균일(=그룹 없음)
    이면 스캔을 건너뛴다**(None=혼합일 때만 행/열별 스캔). 대부분 시트는 그룹이 없어
    행 2000회 스캔이 1회 읽기로 줄어든다(실측)."""
    out = {"rows": [], "cols": []}
    if max_rows <= 0 and max_cols <= 0:
        return out  # 비활성(저사양에서 끔)
    try:
        ur = ws.UsedRange
        r1, c1 = int(ur.Row), int(ur.Column)
        rows, cols = int(ur.Rows.Count), int(ur.Columns.Count)
    except Exception:
        return out
    # 행: 균일(혹은 전부 level 1)이면 그룹 없음 → 스캔 생략
    if max_rows > 0 and _axis_has_outline(ur, "rows"):
        grouped_rows = []
        for i in range(min(rows, max_rows)):
            r = r1 + i
            try:
                if int(ws.Rows(r).OutlineLevel) > 1:
                    grouped_rows.append(r)
            except Exception:
                pass
        out["rows"] = _bands(grouped_rows)
    if max_cols > 0 and _axis_has_outline(ur, "cols"):
        grouped_cols = []
        for j in range(min(cols, max_cols)):
            c = c1 + j
            try:
                if int(ws.Columns(c).OutlineLevel) > 1:
                    grouped_cols.append(c)
            except Exception:
                pass
        out["cols"] = _bands(grouped_cols)
    return out


def _axis_has_outline(ur, axis):
    """범위 전체 OutlineLevel 1회 읽기로 그룹 존재 가능성 판단. None(혼합) 또는 >1 이면
    스캔 필요, 균일 1 이면 그룹 없음(스캔 생략). 실패 시 보수적으로 True(스캔)."""
    try:
        lvl = (ur.Rows.OutlineLevel if axis == "rows" else ur.Columns.OutlineLevel)
    except Exception:
        return True
    if lvl is None:
        return True            # 혼합 → 스캔 필요
    try:
        return int(lvl) > 1    # 균일이지만 전체가 그룹된 경우도 스캔
    except Exception:
        return True


def diff_outline(base, cur, book, sheet, *, start_seq=1):
    acts, seq = [], start_seq
    base = base or {"rows": [], "cols": []}
    for (s, e) in cur.get("rows", []):
        if (s, e) in base.get("rows", []):
            continue
        band = f"{s}:{e}"
        acts.append(Action(seq, GROUP, Target(book, sheet, band),
                           payload={"axis": "row", "band": band},
                           evidence={"capture": "outline_diff"}))
        seq += 1
    for (s, e) in cur.get("cols", []):
        if (s, e) in base.get("cols", []):
            continue
        band = f"{_a1.num_to_col(s)}:{_a1.num_to_col(e)}"
        acts.append(Action(seq, GROUP, Target(book, sheet, band),
                           payload={"axis": "col", "band": band},
                           evidence={"capture": "outline_diff"}))
        seq += 1
    return acts


def _special_areas(ws, xl_type):
    """SpecialCells 로 특정 종류 셀만 영역(Area) 단위로. 없으면 빈 리스트.

    유효성/조건부서식 셀만 한 번에 받아 used range 전체 스캔(비쌈)을 피한다(저사양)."""
    try:
        sc = ws.Cells.SpecialCells(xl_type)
    except Exception:
        return []  # 해당 셀 없음 → com_error
    try:
        return [a for a in sc.Areas]
    except Exception:
        return [sc]


# ============================ 데이터 유효성 (시트) ============================
def _merge_area_specs(area_addr, cell_specs, *, count, max_split):
    """SpecialCells 영역의 (cell_addr, spec) 목록을 (spec, addr) 출력으로 정규화(순수).

    - 균일(모든 셀 spec 동일) 또는 큰 영역(count>max_split, 셀별 미독) → [(spec, area_addr)]
      = 기존 '대표셀 + 영역 주소' 동작과 동일(회귀 없음).
    - 작은 혼합 영역만 셀별 [(spec, cell_addr), ...] 로 분해해 인접한 서로 다른 규칙이
      대표셀 하나로 섞이지 않게 한다(실측 갭 보강).
    cell_specs 가 비면(큰 영역이라 안 읽음) rep 만으로 영역 주소 1건."""
    if not cell_specs:
        return []
    rep_spec = cell_specs[0][1]
    if count > max_split or all(s == rep_spec for _, s in cell_specs):
        return [(rep_spec, area_addr)]
    return [(s, a) for a, s in cell_specs]


def _validation_split_cap(count, remaining_budget, max_split):
    """이 area 를 셀별로 분해할지 결정하는 순수 가드."""
    try:
        count = int(count)
    except Exception:
        count = 1
    try:
        remaining_budget = int(remaining_budget)
    except Exception:
        remaining_budget = 0
    try:
        max_split = int(max_split)
    except Exception:
        max_split = 0
    if count <= 1 or max_split <= 0 or remaining_budget <= 0:
        return 0
    if count > max_split or count > remaining_budget:
        return 0
    return max_split


def _read_validation_spec(cell):
    """단일 셀의 유효성 spec 튜플. 유효성 없으면 None."""
    try:
        v = cell.Validation
        vt = int(v.Type)
    except Exception:
        return None
    if vt == 0:
        return None
    op = f1 = f2 = alert = None
    try:
        op = int(v.Operator)
    except Exception:
        pass
    try:
        alert = int(v.AlertStyle)
    except Exception:
        pass
    try:
        f1 = v.Formula1
    except Exception:
        pass
    try:
        f2 = v.Formula2
    except Exception:
        pass
    return (
        vt, op, f1, f2, alert,
        _bool_or_none(_get(v, "IgnoreBlank")),
        _bool_or_none(_get(v, "InCellDropdown")),
        _bool_or_none(_get(v, "ShowInput")),
        _bool_or_none(_get(v, "ShowError")),
        _get(v, "InputTitle", None),
        _get(v, "InputMessage", None),
        _get(v, "ErrorTitle", None),
        _get(v, "ErrorMessage", None),
    )


def _area_specs(area, read_spec, *, max_split, count=None):
    """SpecialCells 영역 → [(spec, addr)]. 작은 영역만 셀별로 읽어 혼합 여부를 보고,
    균일/대형은 대표셀+영역 주소(기존 동작). read_spec(cell)->spec|None."""
    try:
        area_addr = _norm(area.Address)
    except Exception:
        return []
    try:
        rep = read_spec(area.Cells(1, 1))
    except Exception:
        rep = None
    if rep is None:
        return []
    if count is None:
        try:
            count = int(area.Count)
        except Exception:
            count = 1
    cell_specs = [(area_addr, rep)]  # 폴백 기본값(대표셀)
    if 1 < count <= max_split:
        cells = []
        try:
            for cell in area.Cells:
                s = read_spec(cell)
                if s is not None:
                    cells.append((_norm(cell.Address), s))
        except Exception:
            cells = []
        if cells:
            cell_specs = cells
    return _merge_area_specs(area_addr, cell_specs, count=count, max_split=max_split)


def snap_validation(ws):
    """유효성 셀을 {(spec, addr)} 로. SpecialCells 로 영역 단위만 읽어 저렴.

    영역이 작고 규칙이 섞여 있으면 셀별로 분해하고(인접 혼합 섞임 방지), 균일하거나 큰
    영역은 대표(좌상단) 셀 + 영역 주소로 둔다(기존 동작·저사양 보호). 셀별 분해는
    시트당 누적 예산 안에서만 수행해 validation area 가 많아도 begin/stop 부하를 제한한다."""
    from ..runtime import constants as C
    out = set()
    max_split = getattr(C, "VALIDATION_SPLIT_MAX_CELLS", 256)
    remaining = getattr(C, "VALIDATION_SPLIT_MAX_TOTAL_CELLS", 1024)
    for area in _special_areas(ws, -4174):  # xlCellTypeAllValidation
        try:
            count = int(area.Count)
        except Exception:
            count = 1
        split_cap = _validation_split_cap(count, remaining, max_split)
        if split_cap:
            remaining -= count
        for spec, addr in _area_specs(area, _read_validation_spec,
                                     max_split=split_cap, count=count):
            out.add((spec, addr))
    return out


def _validation_payload(spec):
    vals = list(spec) + [None] * (13 - len(spec))
    vt, op, f1, f2, alert, ignore_blank, dropdown, show_input, show_error, it, im, et, em = vals[:13]
    payload = {"vtype": vt, "operator": op, "formula1": f1, "formula2": f2}
    for key, val in (
        ("alert_style", alert),
        ("ignore_blank", ignore_blank),
        ("in_cell_dropdown", dropdown),
        ("show_input", show_input),
        ("show_error", show_error),
        ("input_title", it),
        ("input_message", im),
        ("error_title", et),
        ("error_message", em),
    ):
        if val is not None:
            payload[key] = val
    return payload


def diff_validation(base, cur, book, sheet, *, start_seq=1):
    acts, seq = [], start_seq
    for spec, addr in sorted(cur - (base or set()), key=lambda x: x[1]):
        acts.append(Action(seq, VALIDATION, Target(book, sheet, addr),
                           payload=_validation_payload(spec),
                           evidence={"capture": "validation_diff"}))
        seq += 1
    return acts


# ============================ 조건부 서식 (시트) ============================
def snap_condformat(ws):
    """조건부 서식 셀을 {(spec, area_addr)} 로. SpecialCells 로 영역 단위만 읽어 저렴."""
    out = set()
    for area in _special_areas(ws, -4172):  # xlCellTypeAllFormatConditions
        try:
            fcs = area.Cells(1, 1).FormatConditions
            count = int(fcs.Count)
            if count < 1:
                continue
        except Exception:
            continue
        addr = _norm(area.Address)
        for idx in range(1, count + 1):
            try:
                fc = fcs.Item(idx)
                ctype = int(fc.Type)
            except Exception:
                continue
            op = f1 = f2 = fill = fcolor = priority = stop = None
            try:
                op = int(fc.Operator)
            except Exception:
                pass
            try:
                f1 = fc.Formula1
            except Exception:
                pass
            try:
                f2 = fc.Formula2
            except Exception:
                pass
            try:
                fill = int(fc.Interior.Color)
            except Exception:
                pass
            try:
                fcolor = int(fc.Font.Color)
            except Exception:
                pass
            try:
                priority = int(fc.Priority)
            except Exception:
                pass
            stop = _bool_or_none(_get(fc, "StopIfTrue"))
            font = _get(fc, "Font")
            spec = (
                idx, ctype, op, f1, f2, fill, fcolor, priority, stop,
                _bool_or_none(_get(font, "Bold")),
                _bool_or_none(_get(font, "Italic")),
                _get(font, "Underline", None),
                _get(fc, "NumberFormat", None),
            )
            out.add((spec, addr))
    return out


def _condformat_payload(spec):
    # Backward-compatible: old tests/bundles used (ctype, op, f1, f2, fill, fcolor).
    if len(spec) <= 6:
        vals = [None, *list(spec), None, None, None, None, None, None]
    else:
        vals = list(spec) + [None] * (13 - len(spec))
    rule_index, ctype, op, f1, f2, fill, fcolor, priority, stop, bold, italic, underline, number_format = vals[:13]
    payload = {"ctype": ctype, "operator": op, "formula1": f1,
               "formula2": f2, "fill": fill, "font_color": fcolor}
    for key, val in (
        ("rule_index", rule_index),
        ("priority", priority),
        ("stop_if_true", stop),
        ("font_bold", bold),
        ("font_italic", italic),
        ("font_underline", underline),
        ("number_format", number_format),
    ):
        if val is not None:
            payload[key] = val
    return payload


def diff_condformat(base, cur, book, sheet, *, start_seq=1):
    acts, seq = [], start_seq
    for spec, addr in sorted(cur - (base or set()), key=lambda x: (x[1], x[0])):
        acts.append(Action(seq, COND_FORMAT, Target(book, sheet, addr),
                           payload=_condformat_payload(spec),
                           evidence={"capture": "condformat_diff"}))
        seq += 1
    return acts


# ============================ 차트 (시트) ============================
_RANGE_RE = re.compile(r"(?:'[^']+'|[^,()'!]+)!(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)")


def _chart_source(ch):
    """차트의 소스 범위를 SERIES 수식들에서 추출해 경계상자로 합친다(같은 시트 가정)."""
    try:
        sc = ch.SeriesCollection()
        n = int(sc.Count)
    except Exception:
        return None
    ranges = []
    for i in range(1, n + 1):
        try:
            f = str(sc.Item(i).Formula)
        except Exception:
            continue
        for m in _RANGE_RE.findall(f):
            ranges.append(m.replace("$", ""))
    box = _a1.bounding_box(ranges) if ranges else None
    if not box:
        return None
    r1, c1, r2, c2 = box
    return _a1.make_range((r1, c1), (r2, c2))


def snap_charts(ws):
    out = {}
    try:
        cos = ws.ChartObjects()
        n = int(cos.Count)
    except Exception:
        return out
    for i in range(1, n + 1):
        try:
            co = cos.Item(i)
            ch = co.Chart
            out[str(co.Name)] = {
                "chart_type": int(ch.ChartType),
                "source": _chart_source(ch),
                "left": float(co.Left), "top": float(co.Top),
                "width": float(co.Width), "height": float(co.Height),
                "title": _chart_title(ch),
                "legend_position": _chart_legend_position(ch),
                "x_axis_title": _axis_title(ch, 1),
                "y_axis_title": _axis_title(ch, 2),
            }
        except Exception:
            continue
    return out


def diff_charts(base, cur, book, sheet, *, start_seq=1):
    acts, seq = [], start_seq
    for name, spec in cur.items():
        if name in (base or {}):
            continue
        acts.append(Action(seq, CHART_ADD, Target(book, sheet, name),
                           payload={"name": name, "chart_type": spec.get("chart_type"),
                                    # 'source' 가 아니라 'src_range' — payload['source'] 는
                                    # 복붙 소스 전용이라 to_steps 가 떼어낸다(소스 유실 방지)
                                    "src_range": spec.get("source"),
                                    "left": spec.get("left", 100.0), "top": spec.get("top", 100.0),
                                    "width": spec.get("width", 360.0),
                                    "height": spec.get("height", 216.0),
                                    "title": spec.get("title"),
                                    "legend_position": spec.get("legend_position"),
                                    "x_axis_title": spec.get("x_axis_title"),
                                    "y_axis_title": spec.get("y_axis_title")},
                           evidence={"capture": "chart_diff"}))
        seq += 1
    return acts


def _chart_title(ch):
    try:
        if ch.HasTitle:
            return str(ch.ChartTitle.Text)
    except Exception:
        pass
    return None


def _chart_legend_position(ch):
    try:
        if ch.HasLegend:
            return int(ch.Legend.Position)
    except Exception:
        pass
    return None


def _axis_title(ch, axis_type):
    try:
        ax = ch.Axes(axis_type)
        if ax.HasTitle:
            return str(ax.AxisTitle.Text)
    except Exception:
        pass
    return None


# ============================ 피벗 테이블 (워크북) ============================
def snap_pivots(wb):
    out = {}
    try:
        sheets = wb.Worksheets
    except Exception:
        return out
    for ws in sheets:
        try:
            pts = ws.PivotTables()
            n = int(pts.Count)
        except Exception:
            continue
        for i in range(1, n + 1):
            try:
                pt = pts.Item(i)
                src = str(pt.PivotCache().SourceData)
                table_range = _norm(pt.TableRange2.Address)
                dest = _norm(pt.TableRange2.Cells(1, 1).Address)
                rows, cols, pages = [], [], []
                page_values = {}
                for pf in pt.PivotFields():
                    try:
                        o = int(pf.Orientation)
                    except Exception:
                        continue
                    nm = str(pf.Name)
                    if o == 1:
                        rows.append((int(pf.Position), nm))
                    elif o == 2:
                        cols.append((int(pf.Position), nm))
                    elif o == 3:
                        pages.append((int(pf.Position), nm))
                        cur_page = _get(pf, "CurrentPageName", None) or _get(pf, "CurrentPage", None)
                        if cur_page:
                            page_values[nm] = str(cur_page)
                datas = []
                for df in pt.DataFields:  # 속성(괄호 호출은 일부 환경서 TypeError)
                    try:
                        datas.append((str(df.SourceName), int(df.Function),
                                      _get(df, "NumberFormat", None),
                                      _get(df, "Name", None)))
                    except Exception:
                        try:
                            datas.append((str(df.SourceName), None,
                                          _get(df, "NumberFormat", None),
                                          _get(df, "Name", None)))
                        except Exception:
                            pass
                rows.sort(); cols.sort(); pages.sort()
                out[(ws.Name, str(pt.Name))] = {
                    "source": src, "dest_sheet": ws.Name, "dest_cell": dest,
                    "dest_range": table_range,
                    "rows": [n for _, n in rows], "cols": [n for _, n in cols],
                    "pages": [n for _, n in pages], "page_values": page_values,
                    "datas": datas,
                    "style": _style_name(_get(pt, "TableStyle2", None)),
                    "row_stripes": _bool_or_none(_get(pt, "ShowTableStyleRowStripes")),
                    "col_stripes": _bool_or_none(_get(pt, "ShowTableStyleColumnStripes")),
                }
            except Exception:
                continue
    return out


def diff_pivots(base, cur, book, *, start_seq=1):
    acts, seq = [], start_seq
    for key, spec in cur.items():
        if key in (base or {}):
            continue
        sheet, name = key
        acts.append(Action(seq, PIVOT_ADD, Target(book, sheet, spec["dest_cell"]),
                           payload={"name": name, "src_data": spec["source"],
                                    "dest_sheet": spec["dest_sheet"], "dest_cell": spec["dest_cell"],
                                    "dest_range": spec.get("dest_range"),
                                    "rows": spec["rows"], "cols": spec["cols"],
                                    "pages": spec["pages"],
                                    "page_values": spec.get("page_values", {}),
                                    "datas": spec["datas"],
                                    "style": spec.get("style"),
                                    "row_stripes": spec.get("row_stripes"),
                                    "col_stripes": spec.get("col_stripes")},
                           evidence={"capture": "pivot_diff"}))
        seq += 1
    return acts


# ============================ 시트 복사/추가 (정지 diff) ============================
def _sample_positions(r1, c1, rows, cols):
    r2, c2 = r1 + rows - 1, c1 + cols - 1
    row_candidates = [r1, r1 + 1, r1 + 2, r1 + rows // 2, r2 - 2, r2 - 1, r2]
    col_candidates = [c1, c1 + 1, c1 + 2, c1 + cols // 2, c2 - 2, c2 - 1, c2]
    rs = sorted({r for r in row_candidates if r1 <= r <= r2})
    cs = sorted({c for c in col_candidates if c1 <= c <= c2})
    out = []
    for r in rs:
        for c in cs:
            out.append((r, c))
    return out


def _cell_sample_value(ws, row, col):
    cell = ws.Cells(row, col)
    try:
        v = cell.Formula
    except Exception:
        try:
            v = cell.Value
        except Exception:
            v = None
    return repr(v)


def value_signature(ws, *, max_cells=2000):
    """시트 내용의 가벼운 시그니처(복사 원본 추정용).

    작은 시트는 기존처럼 UsedRange.Value 전체를 읽고, 큰 시트는 UsedRange 주소만으로
    판정하지 않는다. 네 모서리/초반/중간/끝 일부 셀만 샘플링해 해시를 만들면 COM read
    를 수십 회로 제한하면서도 서로 다른 대형 시트를 복사로 오판할 가능성을 낮춘다.
    """
    try:
        ur = ws.UsedRange
        r1, c1 = int(ur.Row), int(ur.Column)
        rows, cols = int(ur.Rows.Count), int(ur.Columns.Count)
        addr = _norm(ur.Address)
        if rows * cols > max_cells:
            h = hashlib.sha1()
            samples = 0
            for r, c in _sample_positions(r1, c1, rows, cols):
                h.update(f"{r}:{c}=".encode("utf-8"))
                h.update(_cell_sample_value(ws, r, c).encode("utf-8", errors="replace"))
                h.update(b"\0")
                samples += 1
            if samples == 0:
                return ("large-unverified", addr, rows, cols)
            return ("large-sample", addr, rows, cols, samples, h.hexdigest())
        return (str(ur.Value),)
    except Exception:
        return None


def _copy_signature(sig):
    return not (isinstance(sig, tuple) and sig and sig[0] == "large-unverified")


def diff_new_sheets(base_names, cur_pairs, recorded_sheets, book, *, start_seq=1):
    """begin 이후 새로 생긴 시트를 COPY_SHEET 또는 SHEET_ADD 로.

    cur_pairs: [(name, signature)], recorded_sheets: 이벤트로 이미 잡힌 시트명 set,
    base_pairs 비교용 base_sig: {name: signature}. 시그니처가 기존 시트와 같으면 복사로 본다.
    """
    from ..model.action_ir import SHEET_ADD
    acts, seq = [], start_seq
    base_sig = dict(base_names)  # {name: signature}
    for name, sig in cur_pairs:
        if name in base_sig or name in recorded_sheets:
            continue  # 시작부터 있던 시트 / 이벤트로 이미 잡힘
        # 복사 추정: 같은 시그니처의 기존 시트가 있으면 복사
        src = None
        if sig is not None and _copy_signature(sig):
            for bname, bsig in base_sig.items():
                if bsig is not None and _copy_signature(bsig) and bsig == sig:
                    src = bname
                    break
        if src is not None:
            # payload['source'] dict 라야 to_steps 가 step.source 로 만들고 엔진이 복사 원본을 안다
            acts.append(Action(seq, COPY_SHEET, Target(book, name, ""),
                               payload={"new_name": name,
                                        "source": {"book": book, "sheet": src, "range": ""}},
                               evidence={"capture": "sheet_copy_diff"}))
        else:
            acts.append(Action(seq, SHEET_ADD, Target(book, name, ""),
                               evidence={"capture": "sheet_add_diff"}))
        seq += 1
    return acts
