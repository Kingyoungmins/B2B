"""리플레이 세션 — 교차 워크북 해석 (Docs/07 §7.7~7.8). 실제 Excel 필요.

여러 워크북을 같은 Excel 인스턴스에서 해석하고, 교차파일 복붙을 수행한다.
소스 워크북이 안 열려 있으면 경로에서 읽기전용으로 잠깐 열고, 끝나면 닫는다.
"""
from __future__ import annotations

import os

from ..workbooks.registry import basename_of, normalize_book_name


class WorkbookNotResolved(Exception):
    """재현 대상 워크북을 열린 워크북에서 못 찾았고, 여러 워크북이 열려 있어 활성
    워크북으로 추정하면 엉뚱한 파일을 건드릴 수 있어 거부했다(Docs/17 버그2).

    엔진이 스텝 단위로 잡으므로 전체 재현은 멈추지 않고, 해당 스텝만 실패로 남는다.
    """

    def __init__(self, book_key, count):
        self.book_key = book_key
        self.count = count
        super().__init__(
            f"워크북 해석 실패: '{basename_of(book_key)}' 에 해당하는 열린 워크북 없음 "
            f"(열린 워크북 {count}개). 활성 워크북에 조용히 쓰면 다른 파일을 오염시킬 수 "
            f"있어 거부 — 대상 파일을 열거나 파일명을 맞춰 주세요.")


class ReplaySession:
    def __init__(self, app, registry=None, sheet_map=None):
        self.app = app
        self.registry = registry
        self._ctx = {}
        self._opened = []  # 읽기전용으로 우리가 연 워크북(끝나면 닫음)
        # 캡처 시트명 → 실제 시트명. UI 가 사용자 매핑을 주입(임시 Sheet1 회복 등).
        self.sheet_map = dict(sheet_map) if sheet_map else {}

    # --- 워크북 해석 ---
    def _find_open(self, book_key):
        want = basename_of(book_key)
        for wb in self.app.Workbooks:
            try:
                if basename_of(normalize_book_name(wb.FullName)) == want \
                        or normalize_book_name(wb.Name) == want:
                    return wb
            except Exception:
                pass
        return None

    def _open_readonly(self, book_key):
        if (os.sep in book_key or "/" in book_key) and os.path.exists(book_key):
            try:
                wb = self.app.Workbooks.Open(book_key, ReadOnly=True)
                self._opened.append(wb)
                return wb
            except Exception:
                return None
        return None

    def resolve_wb(self, book_key):
        wb = self._find_open(book_key) or self._open_readonly(book_key)
        if wb is not None:
            return wb
        # 폴백: 열린 워크북이 하나뿐이면 그게 의도된 대상(단일 파일 재현 — 키가 달라도 OK).
        # 여러 개면 활성 워크북에 조용히 쓰면 엉뚱한 파일을 오염시킨다(버그2: 입력 파일에
        # 유령 시트). 모호하므로 명시적으로 거부한다.
        try:
            count = int(self.app.Workbooks.Count)
        except Exception:
            count = 0
        if count == 1:
            return self.app.ActiveWorkbook
        from ..runtime import log
        log.warn(f"resolve_wb: '{basename_of(book_key)}' 매칭 실패 (열린 워크북 {count}개) "
                 f"— 활성 워크북 폴백 거부(버그2 방지)")
        raise WorkbookNotResolved(book_key, count)

    def ctx_for(self, book_key):
        if book_key not in self._ctx:
            from .ctx import ExcelComContext
            self._ctx[book_key] = ExcelComContext(
                self.app, self.resolve_wb(book_key), sheet_map=self.sheet_map)
        return self._ctx[book_key]

    # --- 교차파일 복붙 ---
    def paste_cross(self, source: dict, target, mode: str = "all"):
        from .ctx import PASTE_MODES, _is_full_column_ref
        sws = self.resolve_wb(source["book"]).Worksheets(source["sheet"])
        dws = self.resolve_wb(target.book).Worksheets(target.sheet)
        sws.Range(source["range"]).Copy()
        dws.Range(target.range).PasteSpecial(Paste=PASTE_MODES.get(mode, PASTE_MODES["all"]))
        # 전체 열 복사는 열 너비도 옮긴다(xlPasteAll 미포함 보완, Docs/17 버그1).
        if mode == "all" and _is_full_column_ref(source["range"]):
            try:
                dws.Range(target.range).PasteSpecial(Paste=PASTE_MODES["col_widths"])
            except Exception:
                pass
        self.app.CutCopyMode = False

    def close_opened(self):
        for wb in self._opened:
            try:
                wb.Close(SaveChanges=False)
            except Exception:
                pass
        self._opened = []
