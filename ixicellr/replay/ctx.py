"""COM 리플레이 컨텍스트 (Docs/05 §5.1, Docs/10 §10.3). 실제 Excel 필요.

벌크 표면(셀 단위 루프 불가) + 서식 동사 확장 + PasteSpecial 전 모드.
모든 메서드는 COM 예산을 센다(저사양 가드).
"""
from __future__ import annotations

import re

from typing import List

from ..model import a1

_FULLCOL_RE = re.compile(r"^[A-Za-z]+(:[A-Za-z]+)?$")
_FULLCOL_ROWS = re.compile(r"^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$")
_XL_MAX_ROW = 1048576


def _is_full_column_ref(addr) -> bool:
    """주소가 '전체 열' 참조인가(예: A:F, $A:$F, A1:F1048576).

    전체 열을 복사하면 Excel 은 열 너비까지 옮기지만 xlPasteAll 붙여넣기는 너비를
    포함하지 않는다. 이 경우에만 열너비 패스를 추가하기 위한 판별(Docs/17 버그1)."""
    a = str(addr).replace("$", "").strip()
    if not a:
        return False
    if _FULLCOL_RE.match(a):  # A:F, A, A:A — 행 번호 없는 열 참조
        return True
    m = _FULLCOL_ROWS.match(a)  # A1:F1048576 — 1행~최대행 = 사실상 전체 열
    if m and int(m.group(2)) == 1 and int(m.group(4)) >= _XL_MAX_ROW:
        return True
    return False


# xlPasteType (win32 상수 의존 제거 위해 리터럴)
PASTE_MODES = {
    "all": -4104,            # xlPasteAll
    "values": -4163,         # xlPasteValues
    "formulas": -4123,       # xlPasteFormulas
    "formats": -4122,        # xlPasteFormats
    "values_numfmt": 14,     # xlPasteValuesAndNumberFormats
    "col_widths": 8,         # xlPasteColumnWidths
    "all_no_borders": 7,     # xlPasteAllExceptBorders
    "comments": -4144,       # xlPasteComments
    "validation": 6,         # xlPasteValidation
}

# 정렬/계산 상수
XL_ASC, XL_DESC = 1, 2
XL_YES, XL_NO = 1, 2


class ComBudgetExceeded(RuntimeError):
    pass


class SheetNotFound(RuntimeError):
    """재현 대상 시트를 워크북에서 못 찾음. 사람이 읽는 메시지 + 후보를 담는다.

    캡처가 '의도'를 못 보는 대표 증상: 임시 시트(Sheet1)에 한 작업을, 그 시트가
    없는 다른 파일/다음 달 파일에 재현하면 여기서 걸린다(저수준 com_error 대신
    '시트 X 없음, 현재 시트: [...]' 로 보여 사용자가 매핑할 수 있게 한다)."""


def _norm_sheet(name: str) -> str:
    return (name or "").replace(" ", "").strip().casefold()


def match_sheet(wanted: str, available, sheet_map=None):
    """원하는 시트명을 실제 시트 목록에 맞춘다. **COM 무관 순수 함수**(테스트 가능).

    우선순위: 사용자 매핑 → 정확 일치 → 공백/대소문자 정규화 일치 → 시트가
    딱 하나면 그것. 그 외엔 None(상위에서 SheetNotFound).
    엉뚱한 시트로 조용히 쓰는 사고를 막으려 다중 시트 + 불명확이면 매핑하지 않는다.
    """
    avail = list(available)
    if sheet_map and wanted in sheet_map and sheet_map[wanted] in avail:
        return sheet_map[wanted]
    if wanted in avail:
        return wanted
    nmap = {}
    for a in avail:
        nmap.setdefault(_norm_sheet(a), a)
    hit = nmap.get(_norm_sheet(wanted))
    if hit is not None:
        return hit
    if len(avail) == 1:
        return avail[0]
    return None


def _to_grid(v):
    if v is None:
        return [[None]]
    if isinstance(v, tuple):
        return [list(r) if isinstance(r, tuple) else [r] for r in v]
    return [[v]]


def _to_tuples(grid):
    return tuple(tuple(row) for row in grid)


def _expand(a1_start: str, rows: int, cols: int) -> str:
    """시작 셀 + 크기 → 명시 범위 'A1:A3'.

    동적 COM 디스패치에서 Range.Resize 가 단일 셀로 둔갑하는 버그(실측)를
    피하려고 범위를 직접 계산해 ws.Range(full) 로 쓴다.
    """
    parsed = a1.parse_cell(a1_start.replace("$", ""))
    if not parsed:  # 이미 범위/특수표기면 그대로
        return a1_start
    r, c = parsed
    return a1.make_range((r, c), (r + rows - 1, c + cols - 1))


class ExcelComContext:
    def __init__(self, app, workbook, *, budget: int = 400, sheet_map=None):
        self.app = app
        self.wb = workbook
        self.budget = budget
        self.calls = 0
        self.sheet_map = dict(sheet_map) if sheet_map else {}
        self._sheet_names = None  # 워크북 시트명 캐시(해석 실패 시 1회 조회)
        self._ws_cache = {}  # 요청명 → Worksheet COM 객체 (스텝마다 Worksheets() 재조회 방지)

    def _tick(self, n: int = 1):
        self.calls += n
        if self.calls > self.budget:
            raise ComBudgetExceeded(f"COM 예산 {self.budget} 초과 (저사양 가드)")

    def reset_budget(self):
        """스텝 경계에서 호출 — 예산은 '스텝당' 한도다(Docs/05 §5.1).

        ctx 는 워크북당 1개 캐시·재사용되므로, 리셋하지 않으면 카운터가 재현 전체에
        누적돼(서식 스텝 수백 개 등) 멀쩡한 후속 스텝이 저사양 가드에 걸린다."""
        self.calls = 0

    def _available_sheets(self):
        if self._sheet_names is None:
            try:
                self._sheet_names = [w.Name for w in self.wb.Worksheets]
            except Exception:
                self._sheet_names = []
        return self._sheet_names

    def _invalidate_sheets(self):
        """시트 구성이 바뀌는 동사(추가/삭제/이름변경/복사) 후 캐시 무효화."""
        self._ws_cache.clear()
        self._sheet_names = None

    def ws(self, sheet):
        self._tick()
        cached = self._ws_cache.get(sheet)
        if cached is not None:
            return cached
        # 빠른 경로: 이름 그대로. 실패(없는 시트)면 매핑/정규화/단일시트로 회복하고,
        # 그래도 안 되면 저수준 com_error 대신 사람이 읽는 SheetNotFound 를 던진다.
        try:
            ws = self.wb.Worksheets(sheet)
            self._ws_cache[sheet] = ws
            return ws
        except Exception:
            avail = self._available_sheets()
            resolved = match_sheet(sheet, avail, self.sheet_map)
            if resolved is not None and resolved != sheet:
                self.sheet_map[sheet] = resolved  # 같은 재현 내 후속 스텝 재사용
                ws = self.wb.Worksheets(resolved)
                self._ws_cache[sheet] = ws
                return ws
            raise SheetNotFound(
                f"시트 '{sheet}' 없음. 이 워크북의 시트: {avail or '(없음)'}. "
                f"임시 시트(예: Sheet1)에 한 작업이면, 재현 대상 파일엔 그 시트가 "
                f"없을 수 있습니다 — 시트 매핑이 필요합니다."
            )

    # --- 읽기 (벌크) ---
    def read(self, sheet: str, a1: str) -> List[list]:
        rng = self.ws(sheet).Range(a1)
        self._tick()
        return _to_grid(rng.Value)

    # --- 동적 범위 해석 (RangeSpec → 현재 데이터 기준 구체 주소) ---
    def resolve_spec(self, spec, *, max_rows: int = 100_000):
        """RangeSpec 을 현재 시트 데이터에 맞춰 구체 주소로 해석한다.

        앵커 아래 직사각형을 **1회 벌크 read**(End 로 하한 추정) 후, 순수
        resolver 에 위임한다. 셀 단위 루프 없음(저사양). 데이터 0행이면 None.
        """
        from ..model import a1 as _a1
        from ..model.rangespec import W_FIXED, resolve as _resolve
        ws = self.ws(spec.sheet)
        parsed = _a1.parse_cell(spec.anchor.replace("$", ""))
        if not parsed:
            return spec.anchor
        r0, c0 = parsed
        # 너비: 고정이면 그 값, 아니면 앵커행에서 오른쪽 End 로 추정.
        if spec.width_mode == W_FIXED:
            width = max(spec.width, 1)
        else:
            self._tick()
            last_c = ws.Cells(r0, c0).End(-4161).Column  # xlToRight
            width = max(int(last_c) - c0 + 1, 1)
        # 높이 하한: 키열 End(xlDown) 로 마지막 데이터 행 추정(빈칸이면 자기 자신).
        self._tick()
        end_r = ws.Cells(r0, c0 + spec.key_col - 1).End(-4121).Row  # xlDown
        last_r = min(max(int(end_r), r0), r0 + max_rows - 1)
        rng = ws.Range(ws.Cells(r0, c0), ws.Cells(last_r, c0 + width - 1))
        self._tick()
        grid = _to_grid(rng.Value)
        resolved = _resolve(spec, grid)
        if resolved and getattr(spec, "visible_only", False):
            # 필터 결과(보이는 행)만 — 숨은 행 제외한 부분집합 주소(다중영역 가능).
            try:
                self._tick()
                vis = ws.Range(resolved).SpecialCells(12)  # xlCellTypeVisible
                return str(vis.Address).replace("$", "")
            except Exception:
                return resolved  # 필터 없음/전부 보임 → 전체 범위 그대로
        return resolved

    # --- 쓰기 (벌크) ---
    def write(self, sheet: str, a1_start: str, grid) -> int:
        ws = self.ws(sheet)
        self._tick()
        rows = len(grid)
        cols = len(grid[0]) if rows else 0
        if rows == 1 and cols == 1:
            ws.Range(a1_start).Value = grid[0][0]
        else:
            ws.Range(_expand(a1_start, rows, cols)).Value = _to_tuples(grid)
        return rows * cols

    def write_formulas(self, sheet: str, a1_start: str, grid) -> int:
        ws = self.ws(sheet)
        self._tick()
        rows = len(grid)
        cols = len(grid[0]) if rows else 0
        if rows == 1 and cols == 1:
            ws.Range(a1_start).Formula = grid[0][0]
        else:
            ws.Range(_expand(a1_start, rows, cols)).Formula = _to_tuples(grid)
        return rows * cols

    def clear(self, sheet: str, a1: str) -> bool:
        self.ws(sheet).Range(a1).ClearContents()
        self._tick()
        return True

    def sort(self, sheet: str, a1: str, key_col=1, ascending=True, has_header=True) -> bool:
        # 동적 디스패치에서 Range.Sort(Key1=..) 는 인자가 꼬여 열이 뒤바뀌는 버그가
        # 있어, Worksheet.Sort 객체 API(SortFields+SetRange+Apply)를 쓴다.
        ws = self.ws(sheet)
        rng = ws.Range(a1)
        self._tick(3)
        key = rng.Columns(key_col) if isinstance(key_col, int) else ws.Range(key_col)
        so = ws.Sort
        so.SortFields.Clear()
        so.SortFields.Add(Key=key, Order=XL_ASC if ascending else XL_DESC)
        so.SetRange(rng)
        so.Header = XL_YES if has_header else XL_NO
        so.Apply()
        return True

    # --- 복붙 (PasteSpecial 전 모드) ---
    def paste_special(self, src_sheet, src_range, dst_sheet, dst_cell, mode="all") -> bool:
        sws = self.ws(src_sheet)
        dws = self.ws(dst_sheet)
        self._tick(3)
        sws.Range(src_range).Copy()
        dws.Range(dst_cell).PasteSpecial(Paste=PASTE_MODES.get(mode, PASTE_MODES["all"]))
        # 전체 열 복사는 열 너비도 옮겨야 한다 — xlPasteAll 은 너비를 포함하지 않으므로
        # 너비 전용 패스를 한 번 더(Docs/17 버그1). 부분 범위는 건너뜀(회귀 없음).
        if mode == "all" and _is_full_column_ref(src_range):
            try:
                dws.Range(dst_cell).PasteSpecial(Paste=PASTE_MODES["col_widths"])
            except Exception:
                pass
        self.app.CutCopyMode = False
        return True

    # --- 서식 동사 (range 단위 1콜, 저사양 저렴) ---
    def set_fill(self, sheet, a1, rgb):
        self.ws(sheet).Range(a1).Interior.Color = rgb
        self._tick()

    def set_number_format(self, sheet, a1, fmt):
        self.ws(sheet).Range(a1).NumberFormat = fmt
        self._tick()

    def apply_filter(self, sheet, a1, fields):
        """자동필터 재적용 — 범위에 필드별 조건을 건다(대규모 테이블도 저렴).

        기존 필터를 끄고 깨끗이 다시 적용한다(멱등). fields 는 캡처된 조건 리스트."""
        ws = self.ws(sheet)
        self._tick(1 + len(fields or []))
        try:
            if ws.AutoFilterMode:
                ws.AutoFilterMode = False
        except Exception:
            pass
        rng = ws.Range(a1)
        for f in fields or []:
            kw = {"Field": int(f.get("field", 1))}
            if f.get("criteria1") is not None:
                kw["Criteria1"] = f["criteria1"]
            if f.get("operator"):
                kw["Operator"] = int(f["operator"])
            if f.get("criteria2") is not None:
                kw["Criteria2"] = f["criteria2"]
            rng.AutoFilter(**kw)
        if not fields:
            # 필드 없으면 필터 헤더만 토글. 무인자 AutoFilter() 는 번들 gen_py
            # (조기바인딩)에서 실패하므로 Field=1 만 줘서 화살표를 켠다(조건 없음 →
            # 행은 숨지 않고 헤더 토글만, 화면 결과 동일).
            rng.AutoFilter(Field=1)
        return True

    def merge(self, sheet, a1):
        self.ws(sheet).Range(a1).Merge()
        self._tick()

    def unmerge(self, sheet, a1):
        self.ws(sheet).Range(a1).UnMerge()
        self._tick()

    def set_borders(self, sheet, a1, weight=2, line_style=1):
        rng = self.ws(sheet).Range(a1)
        self._tick()
        rng.Borders.LineStyle = line_style  # xlContinuous=1
        rng.Borders.Weight = weight          # xlThin=2

    def set_column_width(self, sheet, cols, width):
        self.ws(sheet).Columns(cols).ColumnWidth = width
        self._tick()

    def set_row_height(self, sheet, rows, height):
        self.ws(sheet).Rows(rows).RowHeight = height
        self._tick()

    def insert_cols(self, sheet, col, count=1):
        """col 앞에 count개 열 삽입. col 은 'F' 또는 6 모두 허용.

        N개 범위를 잡아 Insert 1회 — Insert 는 전체 시트 시프트라 저사양에서
        회당 수 초씩 걸릴 수 있으므로 루프 금지."""
        ws = self.ws(sheet)
        self._tick()
        first = int(col) if isinstance(col, int) or str(col).isdigit() else a1.col_to_num(str(col))
        last = first + max(int(count), 1) - 1
        ws.Range(f"{a1.num_to_col(first)}:{a1.num_to_col(last)}").Insert()
        return True

    def insert_rows(self, sheet, row, count=1):
        """row 위에 count개 행 삽입. row 는 6 또는 '6' 모두 허용. Insert 1회(위 참조)."""
        ws = self.ws(sheet)
        self._tick()
        first = int(row)
        last = first + max(int(count), 1) - 1
        ws.Range(f"{first}:{last}").Insert()
        return True

    def delete_cols(self, sheet, col, count=1):
        """col부터 count개 열 삭제. col 은 'F' 또는 6 모두 허용."""
        ws = self.ws(sheet)
        self._tick()
        first = int(col) if isinstance(col, int) or str(col).isdigit() else a1.col_to_num(str(col))
        last = first + max(int(count), 1) - 1
        ws.Range(f"{a1.num_to_col(first)}:{a1.num_to_col(last)}").Delete()
        return True

    def delete_rows(self, sheet, row, count=1):
        """row부터 count개 행 삭제. row 는 6 또는 '6' 모두 허용."""
        ws = self.ws(sheet)
        self._tick()
        first = int(row)
        last = first + max(int(count), 1) - 1
        ws.Range(f"{first}:{last}").Delete()
        return True

    def copy_sheet(self, src_sheet, new_name=None, after=True):
        """같은 워크북 내 시트 복제(교차 워크북은 세션 레이어에서 — Docs/07)."""
        self._tick(2)
        sheets = self.wb.Worksheets
        # add_sheet 와 같은 멱등 규칙: 대상 이름 시트가 이미 있으면 재사용한다.
        # 이게 없으면 rename 에서 이름충돌 COM 오류('같은 이름의 시트가 이미
        # 있습니다')로 스텝 전체가 죽는다(녹화 재현 실사례: TEST4). 기존 시트를
        # 지우고 대체하지 않는 이유 — 리셋 이상 등으로 남은 시트가 사용자 데이터일
        # 수 있어, 삭제보다 재사용이 항상 안전하다.
        if new_name:
            for ws in sheets:
                if ws.Name == new_name:
                    return new_name
        src = sheets(src_sheet)
        if after:
            src.Copy(After=sheets(sheets.Count))
        else:
            src.Copy(Before=sheets(1))
        new = self.app.ActiveSheet
        if new_name:
            new.Name = new_name
        self._invalidate_sheets()
        return new.Name

    # --- 시트 추가/삭제/이름변경 ---
    def add_sheet(self, name=None, after=True):
        self._tick(2)
        sheets = self.wb.Worksheets
        # 이미 같은 이름 시트가 있으면 재사용(중복 빈 시트·이름충돌로 뒤 단계가
        # 엉뚱한 시트로 가는 문제 방지). 재현 멱등성에도 유리.
        if name:
            for ws in sheets:
                if ws.Name == name:
                    return name
        ws = sheets.Add(After=sheets(sheets.Count)) if after else sheets.Add(Before=sheets(1))
        if name:
            try:
                ws.Name = name
            except Exception:
                pass
        self._invalidate_sheets()
        return ws.Name

    def delete_sheet(self, name):
        self._tick()
        prev = self.app.DisplayAlerts
        self.app.DisplayAlerts = False
        try:
            self.wb.Worksheets(name).Delete()
        finally:
            self.app.DisplayAlerts = prev
        self._invalidate_sheets()
        return True

    def rename_sheet(self, old, new):
        self._tick()
        self.wb.Worksheets(old).Name = new
        self._invalidate_sheets()
        return True

    # --- 객체/속성 재현 (정지 스냅샷 diff 로 캡처 — Docs/15) ---
    def add_name(self, name, refers_to, scope_sheet=None):
        """이름 정의(Named Range). 같은 이름이 있으면 갱신(멱등)."""
        self._tick()
        target = self.wb
        if scope_sheet:
            try:
                target = self.wb.Worksheets(scope_sheet)
            except Exception:
                target = self.wb
        try:
            target.Names(name).Delete()
        except Exception:
            pass
        target.Names.Add(Name=name, RefersTo=refers_to)
        return True

    def set_comment(self, sheet, a1, text):
        """셀 메모(주석). 기존 메모는 지우고 새로 단다(멱등)."""
        rng = self.ws(sheet).Range(a1)
        self._tick()
        try:
            if rng.Comment is not None:
                rng.Comment.Delete()
        except Exception:
            pass
        c = rng.AddComment()
        c.Text(text or "")
        return True

    def add_hyperlink(self, sheet, a1, address="", sub_address="", text=None, screen_tip=""):
        """하이퍼링크. 같은 anchor 의 기존 링크는 지우고 새로 단다(멱등)."""
        ws = self.ws(sheet)
        rng = ws.Range(a1)
        self._tick()
        try:
            for link in list(ws.Hyperlinks):
                try:
                    if str(link.Range.Address).replace("$", "") == str(a1).replace("$", ""):
                        link.Delete()
                except Exception:
                    pass
        except Exception:
            pass
        kwargs = {"Anchor": rng, "Address": address or "", "SubAddress": sub_address or ""}
        if text is not None:
            kwargs["TextToDisplay"] = text
        if screen_tip:
            kwargs["ScreenTip"] = screen_tip
        ws.Hyperlinks.Add(**kwargs)
        return True

    def add_table(self, sheet, a1, name=None, has_headers=True, style=None):
        """표(ListObject) 생성. 이미 같은 이름 표가 있으면 건너뜀(멱등)."""
        ws = self.ws(sheet)
        self._tick()
        if name:
            for lo in ws.ListObjects:
                if lo.Name == name:
                    return True
        lo = ws.ListObjects.Add(SourceType=1, Source=ws.Range(a1),
                                XlListObjectHasHeaders=1 if has_headers else 2)
        if name:
            try:
                lo.Name = name
            except Exception:
                pass
        if style:
            try:
                lo.TableStyle = style
            except Exception:
                pass
        return True

    def set_freeze(self, sheet, rows=0, cols=0):
        """틀 고정. rows/cols=고정할 행/열 수(0,0이면 해제)."""
        ws = self.ws(sheet)
        ws.Activate()
        win = self.app.ActiveWindow
        self._tick(2)
        win.FreezePanes = False
        if rows or cols:
            ws.Cells(int(rows) + 1, int(cols) + 1).Select()
            win.FreezePanes = True
        return True

    def group_axis(self, sheet, axis, band):
        """행/열 그룹(개요). band 는 '3:5'(행) 또는 'B:D'(열)."""
        ws = self.ws(sheet)
        self._tick()
        if axis == "row":
            ws.Rows(band).Group()
        else:
            ws.Columns(band).Group()
        return True

    def add_validation(self, sheet, a1, vtype, operator=None, formula1=None, formula2=None,
                       alert_style=None, ignore_blank=None, in_cell_dropdown=None,
                       show_input=None, show_error=None, input_title=None, input_message=None,
                       error_title=None, error_message=None):
        """데이터 유효성 검사. 기존 유효성은 지우고 새로 적용(멱등)."""
        rng = self.ws(sheet).Range(a1)
        self._tick()
        v = rng.Validation
        try:
            v.Delete()
        except Exception:
            pass
        kw = {"Type": int(vtype), "AlertStyle": int(alert_style if alert_style is not None else 1)}
        if operator is not None:
            kw["Operator"] = int(operator)
        if formula1 is not None:
            kw["Formula1"] = formula1
        if formula2 is not None:
            kw["Formula2"] = formula2
        v.Add(**kw)
        for attr, val in (
            ("IgnoreBlank", ignore_blank),
            ("InCellDropdown", in_cell_dropdown),
            ("ShowInput", show_input),
            ("ShowError", show_error),
            ("InputTitle", input_title),
            ("InputMessage", input_message),
            ("ErrorTitle", error_title),
            ("ErrorMessage", error_message),
        ):
            if val is None:
                continue
            try:
                setattr(v, attr, val)
            except Exception:
                pass
        return True

    def add_cond_format(self, sheet, a1, ctype, operator=None, formula1=None,
                        formula2=None, fill=None, font_color=None, priority=None,
                        stop_if_true=None, font_bold=None, font_italic=None,
                        font_underline=None, number_format=None):
        """조건부 서식 1개 추가(best-effort: 복수 규칙/우선순위/핵심 서식)."""
        rng = self.ws(sheet).Range(a1)
        self._tick()
        kw = {"Type": int(ctype)}
        if operator is not None:
            kw["Operator"] = int(operator)
        if formula1 is not None:
            kw["Formula1"] = formula1
        if formula2 is not None:
            kw["Formula2"] = formula2
        fc = rng.FormatConditions.Add(**kw)
        if fill is not None:
            try:
                fc.Interior.Color = fill
            except Exception:
                pass
        if font_color is not None:
            try:
                fc.Font.Color = font_color
            except Exception:
                pass
        for attr, val in (
            ("Bold", font_bold),
            ("Italic", font_italic),
            ("Underline", font_underline),
        ):
            if val is None:
                continue
            try:
                setattr(fc.Font, attr, val)
            except Exception:
                pass
        if number_format is not None:
            try:
                fc.NumberFormat = number_format
            except Exception:
                pass
        if stop_if_true is not None:
            try:
                fc.StopIfTrue = bool(stop_if_true)
            except Exception:
                pass
        if priority is not None:
            try:
                fc.Priority = int(priority)
            except Exception:
                pass
        return True

    def add_chart(self, sheet, chart_type=None, source_range=None,
                  left=100.0, top=100.0, width=360.0, height=216.0, name=None,
                  title=None, legend_position=None, x_axis_title=None, y_axis_title=None):
        """차트 생성(best-effort): 종류 + 소스범위 + 위치 + 주요 제목/범례."""
        ws = self.ws(sheet)
        self._tick(2)
        co = ws.ChartObjects().Add(float(left), float(top), float(width), float(height))
        ch = co.Chart
        if source_range:
            try:
                ch.SetSourceData(Source=ws.Range(source_range))
            except Exception:
                pass
        if chart_type is not None:
            try:
                ch.ChartType = int(chart_type)
            except Exception:
                pass
        if name:
            try:
                co.Name = name
            except Exception:
                pass
        if title:
            try:
                ch.HasTitle = True
                ch.ChartTitle.Text = title
            except Exception:
                pass
        if legend_position is not None:
            try:
                ch.HasLegend = True
                ch.Legend.Position = int(legend_position)
            except Exception:
                pass
        for axis_type, axis_title in ((1, x_axis_title), (2, y_axis_title)):
            if not axis_title:
                continue
            try:
                ax = ch.Axes(axis_type)
                ax.HasTitle = True
                ax.AxisTitle.Text = axis_title
            except Exception:
                pass
        return True

    def add_pivot(self, source_data, dest_sheet, dest_cell, name=None,
                  row_fields=None, col_fields=None, page_fields=None, data_fields=None,
                  page_values=None, style=None, row_stripes=None, col_stripes=None):
        """피벗 테이블 재구성(best-effort): 소스 + 필드배치 + 핵심 스타일/필터."""
        dws = self.ws(dest_sheet)
        self._tick(4)
        pc = self.wb.PivotCaches().Create(SourceType=1, SourceData=source_data)  # xlDatabase
        pt = pc.CreatePivotTable(TableDestination=dws.Range(dest_cell),
                                 TableName=name or "PivotTable_ixi")
        for fname in (page_fields or []):
            try:
                pt.PivotFields(fname).Orientation = 3   # xlPageField
            except Exception:
                pass
        for fname, val in (page_values or {}).items():
            try:
                pt.PivotFields(fname).CurrentPage = val
            except Exception:
                pass
        for fname in (row_fields or []):
            try:
                pt.PivotFields(fname).Orientation = 1   # xlRowField
            except Exception:
                pass
        for fname in (col_fields or []):
            try:
                pt.PivotFields(fname).Orientation = 2   # xlColumnField
            except Exception:
                pass
        for item in (data_fields or []):
            if isinstance(item, (list, tuple)):
                fname = item[0]
                func = item[1] if len(item) > 1 else None
                number_format = item[2] if len(item) > 2 else None
                caption = item[3] if len(item) > 3 else None
            else:
                fname, func, number_format, caption = item, None, None, None
            try:
                df = pt.AddDataField(pt.PivotFields(fname))
                if func is not None:
                    df.Function = int(func)
                if number_format:
                    df.NumberFormat = number_format
                if caption:
                    df.Name = caption
            except Exception:
                pass
        if style:
            try:
                pt.TableStyle2 = style
            except Exception:
                pass
        for attr, val in (
            ("ShowTableStyleRowStripes", row_stripes),
            ("ShowTableStyleColumnStripes", col_stripes),
        ):
            if val is None:
                continue
            try:
                setattr(pt, attr, bool(val))
            except Exception:
                pass
        return True

    _EDGES = {"left": 7, "top": 8, "bottom": 9, "right": 10}
    _XL_NONE = -4142

    def apply_format_state(self, sheet, a1, fmt: dict):
        rng = self.ws(sheet).Range(a1)
        self._tick()
        # 채우기(패턴 인지: '채우기 없음' 보존 — 흰색 덮어쓰기 방지)
        if fmt.get("fill_pattern") == self._XL_NONE:
            rng.Interior.Pattern = self._XL_NONE
        elif fmt.get("fill") is not None:
            rng.Interior.Color = fmt["fill"]
        if fmt.get("number_format"):
            rng.NumberFormat = fmt["number_format"]
        # 정렬
        al = fmt.get("align") or {}
        if "h" in al:
            rng.HorizontalAlignment = al["h"]
        if "v" in al:
            rng.VerticalAlignment = al["v"]
        if "wrap" in al:
            rng.WrapText = al["wrap"]
        # 글꼴
        font = fmt.get("font") or {}
        if "bold" in font:
            rng.Font.Bold = font["bold"]
        if "italic" in font:
            rng.Font.Italic = font["italic"]
        if "underline" in font:
            rng.Font.Underline = font["underline"]
        if font.get("color") is not None:
            rng.Font.Color = font["color"]
        if font.get("name"):
            rng.Font.Name = font["name"]
        if font.get("size"):
            rng.Font.Size = font["size"]
        # 테두리(4 변 개별 — 기본/중앙정렬 등 손실 방지)
        for name, spec in (fmt.get("borders") or {}).items():
            edge = self._EDGES.get(name)
            if not edge:
                continue
            try:
                b = rng.Borders(edge)
                style = spec.get("style", self._XL_NONE)
                b.LineStyle = style
                if style != self._XL_NONE:
                    if "weight" in spec:
                        b.Weight = spec["weight"]
                    if spec.get("color") is not None:
                        b.Color = spec["color"]
            except Exception:
                pass
        # 병합: merge_area(정확 캡처 영역)가 있으면 그 주소로만. 넓은 a1 로 통짜 Merge 하면
        # 여러 행 병합이 한 칸으로 합쳐져 값이 소실된다(serve_b2b 실행부와 동일 규칙).
        area = fmt.get("merge_area")
        target = area if area else (a1 if fmt.get("merge") else None)
        if target:
            for part in str(target).split(","):
                part = part.strip()
                if not part:
                    continue
                mrng = self.ws(sheet).Range(part)
                try:
                    if mrng.MergeCells and str(mrng.MergeArea.Address).replace("$", "") \
                            == str(mrng.Address).replace("$", ""):
                        continue  # 이미 정확히 병합됨 — 멱등
                except Exception:
                    pass
                mrng.Merge()
