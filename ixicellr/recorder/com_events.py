"""앱 레벨 COM 이벤트 캡처 (Docs/04, Docs/07, Docs/09). 실제 Excel 필요.

저사양 핫패스 규칙(Docs/09 §9.2):
  - SelectionChange: 주소만, weak, COM read 0.
  - SheetChange: 작은 Target 만 즉시 읽고, 큰 Target 은 deferred(범위만).
  - 워크북 키 캐시로 매 이벤트 FullName 호출 절감.
  - 서식 read 안 함(이벤트도 없음 → 정지 시 스냅샷, Docs/10).
"""
from __future__ import annotations

import time

from ..model.action_ir import (
    CELL_EDIT, PIVOT, SELECTION, SHEET_ADD, SHEET_DELETE,
)
from ..runtime import constants as C

def _extract(target):
    """Target(Range) 에서 값/수식을 데이터로 추출. 아주 큰 범위만 deferred(정지 시 채움)."""
    try:
        count = target.Count
    except Exception:
        count = 1
    if count > C.LARGE_TARGET_CELLS:
        return {"mode": "deferred", "cells": int(count)}  # 정지 시 resolve_deferred 가 값 채움
    try:
        formula = target.Formula
    except Exception:
        formula = None
    if isinstance(formula, tuple):
        has_f = any(str(c).startswith("=")
                    for row in formula for c in (row if isinstance(row, tuple) else (row,)))
        grid = [list(r) if isinstance(r, tuple) else [r] for r in formula]
        if has_f:
            return {"mode": "formula", "formulas": grid}
        val = target.Value
        vgrid = [list(r) if isinstance(r, tuple) else [r] for r in val] if isinstance(val, tuple) else [[val]]
        return {"mode": "value", "values": vgrid}
    if isinstance(formula, str) and formula.startswith("="):
        return {"mode": "formula", "formulas": [[formula]]}
    return {"mode": "value", "values": [[target.Value]]}


def _norm(addr):
    return str(addr).replace("$", "")


import re as _re
_FULLCOL_RE = _re.compile(r"^([A-Za-z]+):([A-Za-z]+)$")
_FULLROW_RE = _re.compile(r"^(\d+):(\d+)$")


def _band_dims(addr):
    """붙여넣기 크기 비교용 (kind, n_rows, n_cols). 전체 열/행 참조도 처리.

    일반 범위 → ('cell', rows, cols). 전체 열 A:F → ('col', None, cols).
    전체 행 2:5 → ('row', rows, None). parse 실패 시 None. 전체 열 복사붙여넣기를
    copy_paste 로 인식하기 위함(parse_range 는 전체 열/행 참조를 못 다룸 — Docs/17 §15)."""
    from ..model import a1
    a = _norm(addr)
    parsed = a1.parse_range(a)
    if parsed:
        (r1, c1), (r2, c2) = parsed
        return ("cell", r2 - r1 + 1, c2 - c1 + 1)
    m = _FULLCOL_RE.match(a)
    if m:
        try:
            return ("col", None, abs(a1.col_to_num(m.group(2)) - a1.col_to_num(m.group(1))) + 1)
        except Exception:
            return None
    m = _FULLROW_RE.match(a)
    if m:
        return ("row", abs(int(m.group(2)) - int(m.group(1))) + 1, None)
    return None


def _filter_sig(ws):
    """시트의 현재 자동필터 시그니처(범위 + 필드별 조건). 필터 없으면 None.

    셀이 아니라 필터 메타만 읽으므로 대규모 테이블에서도 저렴(열 수만큼). 정렬과 같은
    철학으로, 이벤트 없는 필터를 정지 시 상태로 잡는다. 조건이 없어도 필터 화살표만
    켠 상태는 fields=[] 로 캡처해야 재현 시 헤더 토글이 살아난다."""
    try:
        if not ws.AutoFilterMode:
            return None
        af = ws.AutoFilter
        rng = af.Range
        filters = af.Filters
        fields = []
        for i in range(1, int(filters.Count) + 1):
            f = filters.Item(i)
            try:
                if not f.On:
                    continue
            except Exception:
                continue
            spec = {"field": i}
            for key, attr in (("criteria1", "Criteria1"), ("criteria2", "Criteria2")):
                try:
                    spec[key] = getattr(f, attr)
                except Exception:
                    pass
            try:
                spec["operator"] = int(f.Operator)
            except Exception:
                pass
            fields.append(spec)
        return (str(rng.Address), fields)
    except Exception:
        return None


def _used_box(ws):
    """시트 UsedRange 경계상자 (first_row, first_col, last_row, last_col).
    구조 변경(삽입/삭제) 판별용. 셀 read 0(메타만).

    개수가 아니라 경계상자를 보는 이유: 가장자리 열/행 '내용 지우기'는 UsedRange 가
    축소돼 삭제처럼 보이지만, 좌/상 경계가 안쪽으로 이동하는지로 구분된다(실측)."""
    try:
        ur = ws.UsedRange
        fr, fc = int(ur.Row), int(ur.Column)
        return (fr, fc, fr + int(ur.Rows.Count) - 1, fc + int(ur.Columns.Count) - 1)
    except Exception:
        return None


def _sort_sig_from_sort(sort_obj, range_obj=None):
    """Excel Sort 객체 → (range_addr, ((absolute_key_col, order), ...), header)."""
    try:
        sf = sort_obj.SortFields
        if sf.Count < 1:
            return None
        try:
            rng = getattr(sort_obj, "Rng", None)
        except Exception:
            rng = None
        rng = rng or range_obj
        if rng is None:
            return None
        fields = tuple((int(sf.Item(i).Key.Column), int(sf.Item(i).Order))
                       for i in range(1, sf.Count + 1))
        try:
            header = int(sort_obj.Header)
        except Exception:
            header = 1
        return (str(rng.Address), fields, header)
    except Exception:
        return None


def _sort_sig(ws):
    """시트의 현재 정렬 시그니처(범위·키열·방향·헤더). 정렬 없으면 None.

    리본/데이터 메뉴 정렬은 `Worksheet.Sort` 에 남지만, AutoFilter 드롭다운에서
    '내림차순/오름차순'을 누른 경우 `Worksheet.AutoFilter.Sort` 쪽에만 남는 일이 있다.
    둘 다 확인해야 필터 헤더 정렬을 놓치지 않는다.
    """
    sig = _sort_sig_from_sort(getattr(ws, "Sort", None))
    if sig:
        return sig
    try:
        if ws.AutoFilterMode:
            af = ws.AutoFilter
            return _sort_sig_from_sort(af.Sort, af.Range)
    except Exception:
        return None
    return None


class AppEvents:
    """pywin32 WithEvents 는 인자 없이 생성하므로 기본값만 둔다."""

    def __init__(self):
        self.sink = None
        self.registry = None
        self.replaying = False
        self.capturing = False  # 바인딩은 미리, 실제 캡처는 녹화 중에만
        self.active_book = None
        self.active_sheet = None
        self._key_cache = {}  # id(wb) -> key (핫패스 캐시)
        self.known_books = set()
        self.started = False
        self.on_new_book = None  # 녹화 중 새 워크북 등장 경고 콜백(Docs/07 §7.7)
        self._new_sheets = []    # [(action, Sh COM)] — 정지 시 최종 이름 보정용
        self._fmt_base = {}      # (book, sheet) -> 시작 서식 스냅샷
        self._fmt_default = {}   # (book, sheet) -> 빈 셀 기본 서식
        self._dim_base = {}      # (book, sheet) -> 시작 열너비/행높이 스냅샷
        self.fmt_skipped = []    # 서식 스냅샷 생략된(너무 큰) 시트
        self.auto_format = True  # 서식 시작/정지 자동 스냅샷 사용 여부(UI 토글)
        self._sort_base = {}     # (book, sheet) -> 시작 정렬 시그니처
        self._filter_base = {}   # (book, sheet) -> 시작 자동필터 시그니처
        self.copy_watcher = None  # 붙여넣기 자동 인식용 복사 소스 감시자(UI 주입)
        self._fmt_dirty = {}     # (book, sheet) -> 최근 건드린 영역 bbox(증분 서식 캡처 대기)
        self._fmt_live = {}      # (book, sheet) -> {pos: state} 녹화 중 누적 서식 스냅샷
        self._dims = {}          # (book, sheet) -> (행수, 열수) UsedRange — 삽입/삭제 자동 판별
        # 정지 시 스냅샷 diff 로 잡는 객체/속성 baseline (Docs/15)
        self._name_base = {}     # book -> {name: refers_to}
        self._comment_base = {}  # (book, sheet) -> {addr: text}
        self._hyperlink_base = {}  # (book, sheet) -> {addr: spec}
        self._table_base = {}    # (book, sheet) -> {name: spec}
        self._outline_base = {}  # (book, sheet) -> {"rows":[...],"cols":[...]}
        self._valid_base = {}    # (book, sheet) -> {(spec, addr)}
        self._condfmt_base = {}  # (book, sheet) -> {(spec, addr)}
        self._freeze_base = None # 활성 창 틀 고정 스냅샷
        self._sheets_base = {}   # book -> {sheet_name: value_signature}
        self._chart_base = {}    # (book, sheet) -> {name: spec}
        self._pivot_base = {}    # book -> {(sheet,name): spec}
        self._object_dirty = set()       # (book, sheet) -> 객체 deep diff 후보
        self._object_meta_base = {}      # (book, sheet) -> cheap_sheet_signature
        # 사용자가 녹화 중 '방문/편집한' 시트 집합. 서식/열너비 전수 스냅샷을 이 집합으로
        # 좁혀(방문 안 한 시트는 스캔 자체를 생략) begin/stop 을 크게 단축한다. 안전근거:
        # 시트를 활성화하지 않고는 그 시트의 셀/서식/열너비를 바꿀 수 없다.
        self._touched_sheets = set()     # (book, sheet)

    def _object_mode(self):
        mode = getattr(C, "OBJECT_CAPTURE_MODE", "dirty")
        return mode if mode in ("full", "dirty", "off") else "dirty"

    def _mark_object_dirty(self, book, sheet):
        if book and sheet:
            self._object_dirty.add((book, sheet))
            self._touched_sheets.add((book, sheet))

    def _mark_touched(self, book, sheet):
        if book and sheet:
            self._touched_sheets.add((book, sheet))

    def capture_sort_diffs(self, app):
        """정지 시 — 정렬이 바뀐 시트를 자동 SORT 액션으로(버튼 없이). 이벤트가 없는
        재정렬을 ws.Sort 상태로 잡는다. 시작 대비 시그니처가 바뀐 경우만."""
        from ..model.action_ir import SORT, Action, Target
        from ..runtime import log
        t0 = time.time()
        added = 0
        for wb in app.Workbooks:
            try:
                bk = self._book_key(wb)
            except Exception:
                continue
            for ws in wb.Worksheets:
                try:
                    sig = _sort_sig(ws)
                    if not sig or sig == self._sort_base.get((bk, ws.Name)):
                        continue
                    rng_addr, fields, header = sig
                    key_abs_col, order = fields[0]
                    try:
                        from ..model import a1
                        parsed = a1.parse_range(_norm(rng_addr))
                        first_col = parsed[0][1] if parsed else key_abs_col
                    except Exception:
                        first_col = key_abs_col
                    key_col = int(key_abs_col) - int(first_col) + 1
                    a = Action(self.sink._seq + 1, SORT, Target(bk, ws.Name, _norm(rng_addr)),
                               payload={"key_col": key_col, "ascending": int(order) == 1,
                                        # 'source' 가 아니라 'sort_source' — payload['source'] 는
                                        # 복붙 소스(dict) 전용이라 to_steps/UI 가 그렇게 해석한다.
                                        # 문자열을 넣으면 Target.from_dict() 가 깨진다(실측).
                                        "sort_source": "auto_filter" if getattr(ws, "AutoFilterMode", False) else "worksheet",
                                        "has_header": int(header) == 1},
                               evidence={"capture": "sort_diff"})
                    self.sink.actions.append(a)
                    self.sink._seq += 1
                    added += 1
                except Exception as e:
                    log.error(f"정렬 자동 캡처 실패 ({getattr(ws, 'Name', '?')})", e)
        log.info(f"stop: 정렬 자동 {added}건, {time.time()-t0:.2f}s")

    def capture_filter_diffs(self, app):
        """정지 시 — 자동필터가 걸린/바뀐 시트를 FILTER 액션으로(버튼 없이).

        필터는 COM 이벤트가 없어 정지 시 ws.AutoFilter 상태로 잡는다. 시작 대비 시그니처가
        바뀐 경우만. 셀이 아니라 필터 메타만 읽어 대규모 테이블에서도 저렴하다."""
        from ..model.action_ir import FILTER, Action, Target
        from ..runtime import log
        t0 = time.time()
        added = 0
        for wb in app.Workbooks:
            try:
                bk = self._book_key(wb)
            except Exception:
                continue
            for ws in wb.Worksheets:
                try:
                    sig = _filter_sig(ws)
                    if not sig or sig == self._filter_base.get((bk, ws.Name)):
                        continue
                    rng_addr, fields = sig
                    a = Action(self.sink._seq + 1, FILTER,
                               Target(bk, ws.Name, _norm(rng_addr)),
                               payload={"fields": fields},
                               evidence={"capture": "filter_diff"})
                    self.sink.actions.append(a)
                    self.sink._seq += 1
                    added += 1
                except Exception as e:
                    log.error(f"필터 자동 캡처 실패 ({getattr(ws, 'Name', '?')})", e)
        log.info(f"stop: 필터 자동 {added}건, {time.time()-t0:.2f}s")

    def capture_format_diffs(self, app):
        """정지 시 — 서식 시작/정지 스냅샷 diff 로 FORMAT 액션을 자동 생성.

        서식엔 COM 이벤트가 없으므로(붙여넣기·삭제·값은 이벤트로 이미 잡힘),
        시작 baseline 대비 바뀐 서식만 떠서 스킬에 반영한다(버튼 불필요).
        """
        import time

        from ..runtime import constants as C
        from ..runtime import log
        from . import snapshot as snap
        self.fmt_skipped = []
        if not self.auto_format:
            log.info("stop: auto_format=off → 서식 자동 캡처 생략")
            return
        t0 = time.time()
        added = 0
        for wb in app.Workbooks:
            try:
                bk = self._book_key(wb)
            except Exception:
                continue
            for ws in wb.Worksheets:
                try:
                    key = (bk, ws.Name)
                    # 방문 안 한 시트는 서식 변경이 불가능 → 셀단위 스냅샷(비쌈) 자체를 생략.
                    if key not in self._touched_sheets and key not in self._fmt_dirty:
                        continue
                    default = self._fmt_default.get(key) or snap.default_format_state(ws)
                    base = self._fmt_base.get(key)
                    if base is None:
                        # baseline 없음 — 이유 불문(스냅샷 에러, 녹화 시작 시 이미 활성이라
                        # Activate 미발화, ActiveSheet 판별 실패 등). 빈 baseline 과 전체
                        # diff 하면 시트 전체가 '변경'으로 오인돼 가짜 서식이 수백 건 생긴다
                        # (실측 3회 재발: 297/571/304건) → 녹화 중 실제로 만진 증분(_fmt_live)만 반영.
                        live = self._fmt_live.get(key)
                        if live:
                            acts = snap.format_diff_actions({}, dict(live), default, bk, ws.Name,
                                                            start_seq=self.sink._seq + 1)
                            for a in acts:
                                self.sink.actions.append(a)
                                self.sink._seq += 1
                                added += 1
                        else:
                            self.fmt_skipped.append(ws.Name)
                        continue
                    cur = snap.snapshot_sheet_formats(ws, max_cells=C.AUTO_FORMAT_MAX_CELLS)
                    if cur is None:
                        # 큰 시트: 통째로 생략하지 말고 '작업한 영역'(액션 타깃 경계상자)만
                        # 스냅샷한다. 안 그러면 수동 병합/서식이 통째로 누락된다.
                        box = self._worked_bbox(bk, ws.Name)
                        if box is not None:
                            cur = snap.snapshot_region_formats(
                                ws, *box, max_cells=C.SNAPSHOT_DIFF_MAX_CELLS)
                    # 녹화 중 증분으로 누적한 서식(_fmt_live)을 합친다. 정지 스냅샷이
                    # 빗나가거나(큰 영역) None 이어도 중간중간 잡아둔 서식이 살아남는다.
                    live = self._fmt_live.get((bk, ws.Name))
                    if live:
                        merged = dict(live)
                        if cur:
                            merged.update(cur)  # 최종 상태(정지 스냅샷)가 우선
                        cur = merged
                    if cur is None:
                        self.fmt_skipped.append(ws.Name)
                        continue
                    acts = snap.format_diff_actions(base, cur, default, bk, ws.Name,
                                                    start_seq=self.sink._seq + 1)
                    for a in acts:
                        self.sink.actions.append(a)
                        self.sink._seq += 1
                        added += 1
                except Exception as e:
                    log.error(f"stop: 서식 diff 실패 ({getattr(ws,'Name','?')})", e)
        log.info(f"stop: 서식 자동 {added}건, 생략 {len(self.fmt_skipped)}시트, {time.time()-t0:.2f}s")

    def capture_dimension_diffs(self, app):
        """정지 시 — 열너비/행높이 변경을 DIMENSION 액션으로 자동 생성."""
        from ..runtime import constants as C
        from ..runtime import log
        from . import snapshot as snap
        t0 = time.time()
        added = 0
        for wb in app.Workbooks:
            try:
                bk = self._book_key(wb)
            except Exception:
                continue
            for ws in wb.Worksheets:
                try:
                    key = (bk, ws.Name)
                    # 방문 안 한 시트는 열너비/행높이 변경이 불가능 → 전체 스캔(느림) 생략.
                    # (로그 실측: 이 스캔이 미방문 시트 때문에 0건에도 12초 소요)
                    if key not in self._touched_sheets:
                        continue
                    cur = snap.snapshot_dimensions(
                        ws, max_cols=C.DIMENSION_MAX_COLS, max_rows=C.DIMENSION_MAX_ROWS)
                    acts = snap.dimension_diff_actions(
                        self._dim_base.get(key, {}), cur, bk, ws.Name,
                        start_seq=self.sink._seq + 1)
                    for a in acts:
                        self.sink.actions.append(a)
                        self.sink._seq += 1
                        added += 1
                except Exception as e:
                    log.error(f"stop: 열너비/행높이 diff 실패 ({getattr(ws,'Name','?')})", e)
        log.info(f"stop: 열너비/행높이 자동 {added}건, {time.time()-t0:.2f}s")

    def capture_object_diffs(self, app):
        """정지 시 — 이벤트 없는 객체/속성(이름·메모·표·틀고정·그룹·유효성·조건부서식·
        시트복사)을 begin baseline 과의 diff 로 자동 캡처(버튼 불필요, Docs/15)."""
        from . import object_capture as oc
        from ..runtime import log

        mode = self._object_mode()
        if mode == "off":
            log.info("stop: object_capture=off → 객체/속성 자동 캡처 생략")
            return

        def _emit(acts):
            n = 0
            for a in acts:
                a.seq = self.sink._seq + 1
                self.sink.actions.append(a)
                self.sink._seq += 1
                n += 1
            return n

        t0 = time.time()
        added = 0
        nsheets = 0   # 순회한 시트 수
        ndeep = 0     # 실제 deep diff 한 시트 수(dirty 에서 후보만)
        # 이미 이벤트로 잡힌 시트명(중복 캡처 방지). reconcile() 은 아직 안 돌아 액션의
        # target.sheet 가 생성 순간의 옛 이름(예: Sheet2)일 수 있으므로, 라이브 시트 참조의
        # '현재 이름'도 함께 넣어 이름변경된 시트가 sheet_add 로 중복 캡처되지 않게 한다(Docs/17 §14).
        recorded_sheets = {a.target.sheet for a in self.sink.actions
                           if a.kind in (SHEET_ADD,) and a.target}
        for _a, _sh in self._new_sheets:
            try:
                recorded_sheets.add(_sh.Name)
            except Exception:
                pass
        for wb in app.Workbooks:
            try:
                bk = self._book_key(wb)
            except Exception:
                continue
            try:
                added += _emit(oc.diff_names(self._name_base.get(bk, {}), oc.snap_names(wb), bk))
            except Exception as e:
                log.error("stop: 이름정의 diff 실패", e)
            # 새 시트(복사/추가) — begin 이후 생긴 시트
            try:
                cur_pairs = [(ws.Name, oc.value_signature(
                    ws, max_cells=C.SHEET_SIGNATURE_MAX_CELLS)) for ws in wb.Worksheets]
                added += _emit(oc.diff_new_sheets(self._sheets_base.get(bk, {}),
                                                  cur_pairs, recorded_sheets, bk))
            except Exception as e:
                log.error("stop: 시트 추가/복사 diff 실패", e)
            for ws in wb.Worksheets:
                key = (bk, ws.Name)
                nsheets += 1
                if mode == "dirty":
                    try:
                        meta = oc.cheap_sheet_signature(ws)
                    except Exception:
                        meta = {}
                    if key not in self._object_dirty and meta == self._object_meta_base.get(key, {}):
                        continue
                ndeep += 1
                for label, fn in (
                    ("메모", lambda: oc.diff_comments(self._comment_base.get(key, {}),
                                                      oc.snap_comments(ws), bk, ws.Name)),
                    ("하이퍼링크", lambda: oc.diff_hyperlinks(
                        self._hyperlink_base.get(key, {}),
                        oc.snap_hyperlinks(ws), bk, ws.Name)),
                    ("표", lambda: oc.diff_tables(self._table_base.get(key, {}),
                                                  oc.snap_tables(ws), bk, ws.Name)),
                    ("그룹", lambda: oc.diff_outline(
                        self._outline_base.get(key, {}),
                        oc.snap_outline(ws, max_rows=C.OUTLINE_MAX_ROWS,
                                        max_cols=C.OUTLINE_MAX_COLS), bk, ws.Name)),
                    ("유효성", lambda: oc.diff_validation(self._valid_base.get(key, set()),
                                                        oc.snap_validation(ws), bk, ws.Name)),
                    ("조건부서식", lambda: oc.diff_condformat(self._condfmt_base.get(key, set()),
                                                          oc.snap_condformat(ws), bk, ws.Name)),
                    ("차트", lambda: oc.diff_charts(self._chart_base.get(key, {}),
                                                   oc.snap_charts(ws), bk, ws.Name)),
                ):
                    try:
                        added += _emit(fn())
                    except Exception as e:
                        log.error(f"stop: {label} diff 실패 ({getattr(ws,'Name','?')})", e)
            # 피벗 테이블(워크북 단위) + 출력 셀/서식 노이즈 정리
            try:
                pivot_acts = oc.diff_pivots(self._pivot_base.get(bk, {}), oc.snap_pivots(wb), bk)
                if pivot_acts:
                    self._prune_pivot_output(bk, pivot_acts)
                    added += _emit(pivot_acts)
            except Exception as e:
                log.error("stop: 피벗 diff 실패", e)
        # 틀 고정(활성 창 단위)
        try:
            book0 = self.active_book or (self._book_key(app.ActiveWorkbook)
                                        if app.Workbooks.Count else "")
            added += _emit(oc.diff_freeze(self._freeze_base, oc.snap_freeze(app), book0))
        except Exception as e:
            log.error("stop: 틀고정 diff 실패", e)
        log.info(f"stop: 객체/속성 자동 {added}건, mode={mode}, "
                 f"deep {ndeep}/{nsheets}시트, {time.time()-t0:.2f}s")

    def _prune_pivot_output(self, book, pivot_acts):
        """피벗 출력 범위의 값/서식 스텝을 제거 — 라이브 피벗 재구성과 충돌 방지.

        피벗 생성 시 출력 셀들이 cell_edit/format 으로도 잡히는데, 그 위에 PIVOT_ADD 로
        피벗을 다시 만들면 겹쳐서 깨진다. 기존에는 대상 시트 전체를 지웠지만, 리포트
        시트 위에 피벗을 만들 때 사용자 편집까지 날아가므로 TableRange2 와 겹치는
        작업만 제거한다."""
        from ..model.action_ir import (
            CELL_EDIT as CE, RANGE_FILL as RF, FORMAT as FM, MERGE as MG, UNMERGE as UM,
            DIMENSION as DM, CLEAR as CL, PIVOT as PV,
        )
        from ..workbooks.registry import basename_of
        drop = {CE, RF, FM, MG, UM, DM, CL}
        pivot_ranges = {}
        for p in pivot_acts:
            try:
                sheet = p.payload.get("dest_sheet") or p.target.sheet
                rng = p.payload.get("dest_range") or p.target.range
                if sheet and rng:
                    pivot_ranges.setdefault(sheet, []).append(rng)
            except Exception:
                continue
        pivot_sheets = set(pivot_ranges)
        want = basename_of(book)
        kept = []
        for a in self.sink.actions:
            if not a.target or basename_of(a.target.book) != want:
                kept.append(a)
                continue
            if a.kind == PV and a.target.sheet in pivot_sheets:
                continue
            if (a.kind in drop and a.target.sheet in pivot_ranges
                    and self._action_overlaps_any(a, pivot_ranges[a.target.sheet])):
                continue
            kept.append(a)
        self.sink.actions = kept

    def _action_overlaps_any(self, action, ranges):
        from ..model import a1

        def _box(addr):
            parsed = a1.parse_range(_norm(addr)) if addr else None
            if not parsed:
                return None
            (r1, c1), (r2, c2) = parsed
            return (r1, c1, r2, c2)

        def _intersects(left, right):
            return not (left[2] < right[0] or right[2] < left[0]
                        or left[3] < right[1] or right[3] < left[1])

        boxes = [_box(r) for r in ranges]
        boxes = [b for b in boxes if b]
        if not boxes:
            return False
        if action.kind == "dimension":
            p = action.payload or {}
            if p.get("axis") == "row":
                try:
                    row = int(p.get("index"))
                except Exception:
                    return False
                return any(b[0] <= row <= b[2] for b in boxes)
            if p.get("axis") == "col":
                try:
                    col = a1.col_to_num(str(p.get("index")))
                except Exception:
                    return False
                return any(b[1] <= col <= b[3] for b in boxes)
            return False
        abox = _box(action.target.range)
        return any(_intersects(abox, b) for b in boxes) if abox else False

    def _mark_fmt_dirty(self, book, sheet, rng):
        """방금 건드린 영역을 '증분 서식 캡처 대기'로 표시(주소 math 만, 서식 read 0).

        [대용량 수정] 예전엔 시트당 union bbox 하나로 합쳤는데, 멀리 떨어진 두 작업
        (예: 1행 붙여넣기 + 200행 입력)이 합쳐지면 상한 초과로 flush 가 통째로 건너뛰어
        큰 시트에서 서식이 전부 유실됐다(실측: '생략 1시트'). 개별 영역 리스트로 유지하고,
        서로 겹치거나 인접한 것만 합친다. 항목이 과다하면(>24) union 으로 접는다(폴백)."""
        from ..model import a1
        box = a1.bounding_box([rng])
        if box is None:
            return
        key = (book, sheet)
        boxes = self._fmt_dirty.setdefault(key, [])
        merged = False
        for i, prev in enumerate(boxes):
            # 겹침/인접(1행·열 여유) 시에만 합침 — 멀리 떨어진 작업은 별도 유지
            if (box[0] <= prev[2] + 1 and prev[0] <= box[2] + 1
                    and box[1] <= prev[3] + 1 and prev[1] <= box[3] + 1):
                boxes[i] = (min(prev[0], box[0]), min(prev[1], box[1]),
                            max(prev[2], box[2]), max(prev[3], box[3]))
                merged = True
                break
        if not merged:
            boxes.append(box)
        if len(boxes) > 24:
            u = boxes[0]
            for b in boxes[1:]:
                u = (min(u[0], b[0]), min(u[1], b[1]), max(u[2], b[2]), max(u[3], b[3]))
            self._fmt_dirty[key] = [u]

    def _find_ws(self, app, book_key, sheet):
        from ..workbooks.registry import basename_of, normalize_book_name
        want = basename_of(book_key)
        for wb in app.Workbooks:
            try:
                if (basename_of(normalize_book_name(wb.FullName)) == want
                        or normalize_book_name(wb.Name) == want):
                    return wb.Worksheets(sheet)
            except Exception:
                continue
        return None

    def flush_dirty_formats(self, app, *, max_cells=None):
        """녹화 중 throttle 호출 — 방금 건드린 작은 영역의 서식을 떠 누적한다.

        '정지 때 1회'의 취약점을 메운다(중간중간 서식 보존). 영역이 크면(상한 초과)
        이번엔 건너뛰고 정지 스냅샷에 맡긴다. 서식 read 는 비싸므로 작은 영역만, throttle.
        서식 read 는 이벤트를 발생시키지 않아 녹화 중 안전하다. 상한은 환경변수로 조절."""
        if max_cells is None:
            max_cells = C.FMT_DIRTY_MAX_CELLS
        if not self.auto_format or not self.capturing or not self._fmt_dirty:
            return
        from . import snapshot as snap
        pending = self._fmt_dirty
        self._fmt_dirty = {}
        for (book, sheet), boxes in pending.items():
            ws = None
            for box in boxes:
                r1, c1, r2, c2 = box
                if (r2 - r1 + 1) * (c2 - c1 + 1) > max_cells:
                    continue  # 너무 큰 영역만 개별 생략(다른 작은 영역 서식은 보존)
                if ws is None:
                    ws = self._find_ws(app, book, sheet)
                    if ws is None:
                        break
                try:
                    reg = snap.snapshot_region_formats(ws, r1, c1, r2, c2, max_cells=max_cells)
                except Exception:
                    reg = None
                if reg:
                    self._fmt_live.setdefault((book, sheet), {}).update(reg)

    def _worked_bbox(self, book_key, sheet):
        """이 시트에서 사용자가 작업한 영역의 경계상자(r1,c1,r2,c2). 큰 시트에서
        전체 대신 이 영역만 서식 스냅샷하려는 용도. 녹화된 액션 타깃에서 추정."""
        from ..model import a1
        from ..workbooks.registry import basename_of
        want = basename_of(book_key)
        ranges = [a.target.range for a in self.sink.actions
                  if a.target and a.target.sheet == sheet
                  and basename_of(a.target.book) == want]
        return a1.bounding_box(ranges)

    def reconcile(self):
        """정지 시 호출 — 생성한 시트의 최종(현재) 이름으로 sheet_add 를 보정.

        시트 이름변경엔 COM 이벤트가 없고 CodeName 도 비어 있을 수 있어, 생성 순간의
        라이브 COM 시트 참조를 들고 있다가 정지 때 현재 이름을 읽는다.
        """
        for action, sh in self._new_sheets:
            try:
                action.target.sheet = sh.Name
            except Exception:
                pass

    def resolve_deferred(self, app):
        """정지 시 — 큰 붙여넣기로 deferred(값 미보관)였던 단계의 실제 값을 읽어 채운다."""
        from ..model.action_ir import CELL_EDIT, RANGE_FILL
        from ..runtime import log
        from ..workbooks.registry import basename_of, normalize_book_name
        wbs = {}
        for wb in app.Workbooks:
            try:
                wbs[basename_of(normalize_book_name(wb.FullName)) or normalize_book_name(wb.Name)] = wb
            except Exception:
                pass
        cnt = 0
        clipped = 0
        drop_ids = set()
        cap = C.DEFERRED_RESOLVE_MAX_CELLS
        for a in self.sink.actions:
            if a.kind in (CELL_EDIT, RANGE_FILL) and a.payload.get("mode") == "deferred":
                wb = wbs.get(basename_of(a.target.book))
                if wb is None:
                    if int(a.payload.get("cells", 0)) > cap:
                        drop_ids.add(id(a))
                    continue
                try:
                    ws = wb.Worksheets(a.target.sheet)
                    rng = ws.Range(a.target.range)
                    # 전체 열/행에 붙여넣은 과대 편집은 '드롭'하지 않고 실제 데이터(UsedRange)
                    # 와의 교집합으로 클립해 값을 살린다. 클립해도 너무 크면 그때 제외.
                    if int(a.payload.get("cells", 0)) > cap:
                        inter = None
                        try:
                            inter = app.Intersect(rng, ws.UsedRange)
                        except Exception:
                            inter = None
                        if inter is None or int(inter.Count) > cap:
                            drop_ids.add(id(a))
                            continue
                        rng = inter
                        a.target.range = _norm(rng.Address)  # 실제 데이터 범위로 교정
                        clipped += 1
                    v = rng.Value
                    grid = ([list(r) if isinstance(r, tuple) else [r] for r in v]
                            if isinstance(v, tuple) else [[v]])
                    a.payload = {"mode": "value", "values": grid}
                    cnt += 1
                except Exception as e:
                    log.error(f"deferred 해결 실패 {a.target.sheet}!{a.target.range}", e)
        if drop_ids:
            self.sink.actions = [a for a in self.sink.actions if id(a) not in drop_ids]
            log.warn(f"stop: 과대 편집 {len(drop_ids)}건 제외(클립 후에도 과대 — 📋 복붙 버튼 권장)")
        if cnt:
            log.info(f"stop: deferred {cnt}건 값 해결{f' (과대 {clipped}건 UsedRange 클립)' if clipped else ''}")

    def begin(self, app):
        """녹화 시작 — 워크북 등록(필수) + (선택)서식 baseline 스냅샷.

        format baseline 은 무거울 수 있어 절대 녹화 시작을 막지 않도록 격리한다.
        """
        import time

        from ..runtime import log
        from . import object_capture as oc
        mode = self._object_mode()
        self._dims = {}  # 삽입/삭제 기준선 초기화(새 녹화) — 아래 루프에서 시트별로 채움
        self._object_dirty = set()
        self._object_meta_base = {}
        self._fmt_dirty = {}   # 증분 서식 누적 초기화(새 녹화)
        self._fmt_live = {}
        # [초반 유실 방지] 캡처를 baseline 작업 '앞'에서 켠다. baseline(객체/서식)이 저사양에서
        # 수십 초 걸리는 동안(실측 16.6s) 사용자가 이미 복붙/입력을 시작하는데, 예전엔 capturing
        # 이 baseline 뒤에 켜져 그 사이 이벤트가 통째로 유실됐다(복붙이 스킬에 안 남던 원인 중 하나).
        # 이벤트는 STA 메시지큐에 쌓였다가 begin 중 COM 재진입/이후 펌프에서 발화하므로, 먼저 켜두면
        # baseline 진행 중의 작업도 캡처된다. (그 변경이 baseline 에 일부 섞일 수 있으나, 액션이
        # 통째로 사라지는 것보다 항상 낫다 — diff 는 중복만 만들 뿐 누락은 안 만든다.)
        self.started = True
        self.capturing = True
        # 1) 워크북 등록(필수) + 정렬 baseline(가벼움, 항상).
        t_obj0 = time.time()
        nsheets = 0
        try:
            for wb in app.Workbooks:
                try:
                    bk = self._book_key(wb)
                    self.known_books.add(bk)
                    self._sheets_base[bk] = {}                          # 시트 추가/복사 baseline
                    if mode != "off":
                        self._name_base[bk] = oc.snap_names(wb)          # 이름 정의 baseline
                    else:
                        self._name_base[bk] = {}
                    self._pivot_base[bk] = {}
                    pivot_baseline_needed = False
                    for ws in wb.Worksheets:
                        try:
                            key = (bk, ws.Name)
                            nsheets += 1
                            try:
                                self._object_meta_base[key] = oc.cheap_sheet_signature(ws)
                            except Exception:
                                self._object_meta_base[key] = {}
                            self._sort_base[(bk, ws.Name)] = _sort_sig(ws)
                            self._filter_base[(bk, ws.Name)] = _filter_sig(ws)
                            self._dims[(bk, ws.Name)] = _used_box(ws)  # 삽입/삭제 기준선
                            try:
                                from . import snapshot as snap
                                self._dim_base[(bk, ws.Name)] = snap.snapshot_dimensions(
                                    ws, max_cols=C.DIMENSION_MAX_COLS, max_rows=C.DIMENSION_MAX_ROWS)
                            except Exception:
                                pass
                            if mode != "off":
                                meta = self._object_meta_base.get(key, {})
                                full = mode == "full"
                                # 객체/속성 baseline (이벤트 없음 → 정지 diff). dirty 모드에서는
                                # 빈 컬렉션을 전부 순회하지 않고, 기존 객체가 있는 시트만 깊게
                                # 뜬다. 유효성/조건부서식/그룹은 SpecialCells/메타 기반이라
                                # baseline 없을 때 오탐하지 않도록 계속 보관한다.
                                self._comment_base[key] = (
                                    oc.snap_comments(ws) if full or meta.get("comments", 0) else {})
                                self._hyperlink_base[key] = (
                                    oc.snap_hyperlinks(ws) if full or meta.get("hyperlinks", 0) else {})
                                self._table_base[key] = (
                                    oc.snap_tables(ws) if full or meta.get("tables", 0) else {})
                                self._outline_base[key] = oc.snap_outline(
                                    ws, max_rows=C.OUTLINE_MAX_ROWS, max_cols=C.OUTLINE_MAX_COLS)
                                self._valid_base[key] = oc.snap_validation(ws)
                                self._condfmt_base[key] = oc.snap_condformat(ws)
                                self._chart_base[key] = (
                                    oc.snap_charts(ws) if full or meta.get("charts", 0) else {})
                                self._sheets_base[bk][ws.Name] = oc.value_signature(
                                    ws, max_cells=C.SHEET_SIGNATURE_MAX_CELLS)
                                if meta.get("pivots", 0):
                                    pivot_baseline_needed = True
                        except Exception:
                            pass
                    if mode != "off" and pivot_baseline_needed:
                        try:
                            self._pivot_base[bk] = oc.snap_pivots(wb)
                        except Exception:
                            self._pivot_base[bk] = {}
                except Exception as e:
                    log.error("begin: book 등록 실패", e)
        except Exception as e:
            log.error("begin: Workbooks 순회 실패", e)
        try:
            self._freeze_base = oc.snap_freeze(app)
        except Exception:
            self._freeze_base = None
        log.info(f"begin: 객체 baseline {nsheets}시트, mode={mode}, {time.time()-t_obj0:.2f}s")
        # 주의: capturing/_fmt_dirty/_fmt_live 초기화는 begin 최상단(유실 방지). _dims 는 위 루프가 채움.
        try:
            log.info(f"begin: 워크북 {app.Workbooks.Count}개, auto_format={self.auto_format}")
        except Exception:
            pass
        # 2) (선택) 서식 baseline — 지연(lazy) 캡처. 예전엔 모든 시트를 여기서 전수 스냅샷해
        # begin 이 수십 초 걸렸다(로그: 6시트 11초). 이제 '각 워크북의 활성 시트'만 뜨고, 나머지는
        # 사용자가 그 시트로 전환할 때(OnSheetActivate) 편집 직전 상태로 지연 캡처한다.
        # 근거: 시트를 활성화하지 않고는 그 시트 서식을 못 바꾼다. baseline 이 없는 시트는
        # capture_format_diffs 가 전체 diff 대신 증분(_fmt_live)만 반영하므로 실패해도 안전.
        self._fmt_base_failed = set()  # baseline 스냅샷이 '에러로' 실패한 시트(bounded 생략과 구분)
        if not self.auto_format:
            return
        t0 = time.time()
        # 임베디드 공유 인스턴스에서 app.ActiveSheet 는 신뢰 불가(실측 AttributeError) —
        # 워크북별 ActiveSheet 로 잡는다(사용자가 보던 시트 = 각 워크북의 활성 시트).
        for wb in list(app.Workbooks):
            try:
                bk = self._book_key(wb)
                ws = wb.ActiveSheet
                self._ensure_fmt_baseline(bk, ws)
                self._mark_touched(bk, ws.Name)
            except Exception as e:
                log.error("begin: 활성 시트 서식 baseline 실패", e)
        log.info(f"begin: 서식 baseline(활성 시트만) {len(self._fmt_base)}시트, {time.time()-t0:.2f}s")

    def _ensure_fmt_baseline(self, bk, ws):
        """이 시트의 서식/열너비 baseline 이 없으면 지금(편집 직전) 뜬다. 이미 있으면 no-op.
        OnSheetActivate 에서 방문 시트마다 호출 → begin 전수 스캔을 방문분으로 분산."""
        if not self.auto_format:
            return
        try:
            key = (bk, ws.Name)
        except Exception:
            return
        if key in self._fmt_base or key in self._fmt_base_failed:
            return
        # 이미 이 시트를 편집한 뒤라면(baseline 에 편집분이 섞임) 늦은 baseline 은 왜곡만
        # 만든다 → 뜨지 않고 증분(_fmt_live) 경로에 맡긴다.
        if key in self._fmt_dirty or key in self._fmt_live:
            return
        from . import snapshot as snap
        for attempt in (0, 1):
            try:
                base = snap.snapshot_sheet_formats(ws, max_cells=C.AUTO_FORMAT_MAX_CELLS)
                if base is not None:
                    self._fmt_base[key] = base
                    self._fmt_default[key] = snap.default_format_state(ws)
                # 열너비/행높이 baseline 도 같이(방문 시트만 정지 시 diff 대상이 되므로 정합)
                if key not in self._dim_base:
                    try:
                        self._dim_base[key] = snap.snapshot_dimensions(
                            ws, max_cols=C.DIMENSION_MAX_COLS, max_rows=C.DIMENSION_MAX_ROWS)
                    except Exception:
                        pass
                return
            except Exception as e:
                if attempt == 0:
                    time.sleep(0.5)
                    continue
                from ..runtime import log
                log.error(f"lazy 서식 baseline 실패 ({getattr(ws, 'Name', '?')})", e)
                self._fmt_base_failed.add(key)

    def _book_key(self, wb):
        wid = id(wb)
        key = self._key_cache.get(wid)
        if key is None:
            key = self.registry.register(wb)
            self._key_cache[wid] = key
            if key not in self.known_books:
                self.known_books.add(key)
                # 녹화 중 새 워크북 등장: 다른 인스턴스에서 연 파일일 수 있음
                if self.started and self.on_new_book:
                    self.on_new_book(key)
        return key

    # --- 활성 컨텍스트 추적 ---
    def OnWorkbookActivate(self, Wb):
        self.active_book = self._book_key(Wb)

    def OnSheetActivate(self, Sh):
        try:
            self.active_book = self._book_key(Sh.Parent)
            self.active_sheet = Sh.Name
            self._mark_touched(self.active_book, self.active_sheet)  # 방문 시트 기록(스캔 대상)
            if self.capturing:
                # 방문 즉시(편집 전) 이 시트 서식/열너비 baseline 을 지연 캡처(begin 분산).
                self._ensure_fmt_baseline(self.active_book, Sh)
        except Exception:
            pass

    def OnWorkbookOpen(self, Wb):
        self._book_key(Wb)

    def _refresh_dims(self, Sh, book):
        """이 시트 UsedRange 경계상자를 최신으로 갱신(다음 구조 이벤트의 기준선)."""
        d = _used_box(Sh)
        if d is not None:
            self._dims[(book, Sh.Name)] = d

    def _maybe_structure(self, Sh, Target, book):
        """SheetChange 가 '행/열 삽입·삭제'면 자동으로 구조 액션을 만든다(➕/➖ 버튼 불필요).

        붙여넣기 자동 인식과 같은 철학. 행/열 삽입·삭제·지우기는 모두 SheetChange 가
        전체 밴드(`$C:$D`/`$2:$2`)로 발화하는데, 삽입과 '전체열 지우기'는 Target 이
        동일하다. 그래서 UsedRange 차원 델타(삽입 +N/삭제 −N/지우기 0)로 가른다.
        기준선이 없으면(첫 이벤트) 보수적으로 건너뛰고 기준선만 잡는다(오인 방지).

        반환: Action(구조) 또는 None. None 이면 호출부가 일반 경로로 진행한다.
        """
        from . import structure_capture as sc
        try:
            if int(Target.Areas.Count) != 1:
                return None  # 다중 영역은 보수적으로 구조로 보지 않음
            is_full_cols = int(Target.Rows.Count) == int(Sh.Rows.Count)
            is_full_rows = int(Target.Columns.Count) == int(Sh.Columns.Count)
        except Exception:
            return None
        if not (is_full_cols or is_full_rows):
            return None  # 전체 밴드가 아니면 구조 변경이 아님 → 일반 경로(호출부가 dims 갱신)
        key = (book, Sh.Name)
        cur = _used_box(Sh)
        if cur is None:
            return None
        prev = self._dims.get(key)
        self._dims[key] = cur  # 전체 밴드 이벤트면 여기서 기준선 갱신(이후 일반 갱신 불필요)
        if prev is None:
            return None  # 기준선 없음 → 이번엔 건너뛰고 다음부터 판별
        # 경계상자 (first_row, first_col, last_row, last_col) 의 변화로 판정
        d_first_row, d_first_col = cur[0] - prev[0], cur[1] - prev[1]
        d_last_row, d_last_col = cur[2] - prev[2], cur[3] - prev[3]
        kind = sc.classify_band_change(
            is_full_cols=is_full_cols, is_full_rows=is_full_rows,
            d_first_col=d_first_col, d_last_col=d_last_col,
            d_first_row=d_first_row, d_last_row=d_last_row)
        if kind is None:
            return None  # 삽입/삭제 아님(전체 행/열 내용 지우기 등)
        seq = self.sink._seq + 1
        try:
            from ..model.action_ir import INSERT_COLS, INSERT_ROWS
            if is_full_cols:
                first_col, count = int(Target.Column), int(Target.Columns.Count)
                if kind == INSERT_COLS:
                    a = sc.build_insert_cols_action(seq, book, Sh.Name, first_col, count)
                else:
                    a = sc.build_delete_cols_action(seq, book, Sh.Name, first_col, count)
            else:
                first_row, count = int(Target.Row), int(Target.Rows.Count)
                if kind == INSERT_ROWS:
                    a = sc.build_insert_rows_action(seq, book, Sh.Name, first_row, count)
                else:
                    a = sc.build_delete_rows_action(seq, book, Sh.Name, first_row, count)
        except Exception:
            return None
        a.evidence = {"event": "AutoStructure", "kind": kind,
                      "box_prev": prev, "box_cur": cur}
        return a

    def _maybe_paste(self, Sh, Target, book):
        """SheetChange 가 '붙여넣기'면 자동으로 copy_paste 액션을 만든다(📋 버튼 불필요).

        조건(보수적, 오인 방지): 복사 소스가 대기 중 + CutCopyMode 활성(marching ants) +
        붙여넣은 범위가 **다중 셀**이고 소스와 크기 일치. 입력(타이핑)은 단일 셀이거나
        CutCopyMode 가 꺼져 있어 걸리지 않는다."""
        from ..model import a1
        from ..model.action_ir import COPY_PASTE, Action, Target as T
        w = self.copy_watcher
        src = getattr(w, "last_source", None) if w else None
        if not src or not src.get("range"):
            return None
        # CutCopyMode 는 참고만 한다(게이트 아님). Enter/우클릭 붙여넣기는 붙여넣는 즉시
        # CutCopyMode 가 꺼져, 여기서 요구하면 그 붙여넣기를 통째로 놓쳤다(실측: 복사만 되고
        # 값이 안 옮겨짐). 다중 셀 + 소스와 크기 일치는 그 자체로 붙여넣기의 강한 신호(타이핑은
        # 단일 셀이라 크기가 안 맞음)라, 크기 일치를 판정 기준으로 쓴다.
        try:
            cut_mode_on = bool(Sh.Application.CutCopyMode)
        except Exception:
            cut_mode_on = False
        sdim = _band_dims(src["range"])
        tdim = _band_dims(_norm(Target.Address))
        # 전체 열/행 복사는 ('col'/'row', ...) 로 비교(parse_range 가 못 다룸). 크기 불일치/
        # 단일 셀(타이핑)은 붙여넣기로 보지 않는다.
        if not sdim or not tdim or sdim != tdim or sdim == ("cell", 1, 1):
            return None
        # 소스 값 스냅샷(복사 시점)은 재현 결정성을 위해 payload 최상위 paste_values 로 옮긴다.
        # (source dict 안에 두면 to_steps 의 Target.from_dict 가 book/sheet/range 만 남기고 버림)
        src_no_vals = {k: v for k, v in src.items() if k != "values"}
        pp = {"mode": "all", "source": src_no_vals}
        if src.get("values") is not None:
            pp["paste_values"] = src["values"]
        a = Action(self.sink._seq + 1, COPY_PASTE, T(book, Sh.Name, _norm(Target.Address)),
                   payload=pp,
                   evidence={"event": "AutoPaste", "cutCopyMode": cut_mode_on})
        try:
            from .copypaste_capture import infer_source_intent  # 소스 동적의도 후보 부착
            infer_source_intent(Sh.Application, a)
        except Exception:
            pass
        # 소스 소비: 잘라내기(cut)는 1회성이라 소비. 복사(copy)는 한 번 Ctrl+C 로 여러 곳에
        # 붙여넣는 워크플로가 흔하므로, CutCopyMode 가 살아 있으면 소스를 유지한다.
        if src.get("cut") or not cut_mode_on:
            w.last_source = None
        return a

    # --- 값/수식 입력 (모든 워크북) ---
    def OnSheetChange(self, Sh, Target):
        if self.replaying or not self.capturing:
            return
        try:
            book = self._book_key(Sh.Parent)
            self._mark_object_dirty(book, Sh.Name)
            # 붙여넣기면 값 대신 copy_paste 로 자동 캡처(서식·수식까지 PasteSpecial 로 재현).
            addr = _norm(Target.Address)
            self._mark_fmt_dirty(book, Sh.Name, addr)  # 이 영역 서식을 증분으로 떠둔다
            # 붙여넣기를 구조(삽입)보다 먼저 본다 — 전체 열 복사붙여넣기는 전체-열 밴드라
            # _maybe_structure 가 INSERT_COLS 로 오인하기 때문(복사 대기 없으면 None 이라
            # 일반 삽입엔 무영향, Docs/17 §15).
            cp = self._maybe_paste(Sh, Target, book)
            if cp is not None:
                self.sink.actions.append(cp)
                self.sink._seq += 1
                self._refresh_dims(Sh, book)  # 붙여넣기로 커진 UsedRange 기준선 갱신
                return
            # 행/열 삽입·삭제면 구조 액션으로 자동 캡처(➕/➖ 버튼 불필요). 전체 밴드
            # 이벤트일 때만 발화하고, 내부에서 UsedRange 기준선을 갱신한다.
            st = self._maybe_structure(Sh, Target, book)
            if st is not None:
                self.sink.actions.append(st)
                self.sink._seq += 1
                from ..runtime import log
                log.info(f"  + 자동 {st.kind} {Sh.Name}!{st.target.range} (x{st.payload.get('count', 1)})")
                return
            self.sink.emit(CELL_EDIT, book, Sh.Name, addr,
                           payload=_extract(Target), evidence={"event": "SheetChange"})
            self._refresh_dims(Sh, book)  # 일반 편집으로 변한 UsedRange 기준선 갱신
        except Exception:
            pass

    # --- 선택 (약한 신호: read 0) ---
    def OnSheetSelectionChange(self, Sh, Target):
        if self.replaying or not self.capturing:
            return
        try:
            book = self._book_key(Sh.Parent)
            self._mark_object_dirty(book, Sh.Name)
            addr = _norm(Target.Address)
            # 서식은 보통 '선택 후 적용'이라, 선택 영역도 증분 서식 캡처 대기로 표시한다
            # (값 입력이 없는 '서식만' 영역도 잡히게). bbox math 만 — 서식 read 0.
            self._mark_fmt_dirty(book, Sh.Name, addr)
            self.sink.emit(SELECTION, book, Sh.Name, addr,
                           evidence={"event": "SelectionChange"}, weak=True)
        except Exception:
            pass

    def OnSheetPivotTableUpdate(self, Sh, Target):
        if self.replaying or not self.capturing:
            return
        try:
            book = self._book_key(Sh.Parent)
            self._mark_object_dirty(book, Sh.Name)
            self.sink.emit(PIVOT, book, Sh.Name,
                           getattr(Target, "Name", "?"), evidence={"event": "PivotUpdate"})
        except Exception:
            pass

    def OnWorkbookNewSheet(self, Wb, Sh):
        if self.replaying or not self.capturing:
            return
        try:
            book = self._book_key(Wb)
            self._mark_object_dirty(book, Sh.Name)
            # 생성 순간엔 기본 이름. 라이브 시트 참조를 들고 있다가 정지 시
            # 최종(이름변경된) 이름으로 보정한다(reconcile).
            a = self.sink.emit(SHEET_ADD, book, Sh.Name,
                               evidence={"event": "NewSheet"})
            self._new_sheets.append((a, Sh))
        except Exception:
            pass

    def OnSheetBeforeDelete(self, Sh):
        # 시트 삭제 직전(Sh 아직 유효) — 일부 Excel 버전에서만 발화
        if self.replaying or not self.capturing:
            return
        try:
            self.sink.emit(SHEET_DELETE, self._book_key(Sh.Parent), Sh.Name,
                           evidence={"event": "BeforeDelete"})
        except Exception:
            pass


def pump_until_closed(app, *, on_tick=None) -> None:
    """이벤트 펌프 루프(저사양 슬립). Excel 이 닫히거나 Ctrl+C 까지."""
    import pythoncom  # 지연 import

    sleep_s = C.PUMP_SLEEP_MS / 1000.0
    try:
        while True:
            pythoncom.PumpWaitingMessages()
            if on_tick:
                on_tick()
            try:
                _ = app.Workbooks.Count
            except Exception:
                break  # Excel 종료
            time.sleep(sleep_s)
    except KeyboardInterrupt:
        pass
