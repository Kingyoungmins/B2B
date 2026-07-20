#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""단일 셀 앵커 복붙 캡처 검증.
사용자 시나리오: 원본!A1:E6 복사(Ctrl+C) → G1 한 셀만 클릭(Selection=1x1) → Ctrl+V → 복붙 캡처.
이전엔 dimsMatch=False 로 거부됐음. 수정 후:
  - 단일 셀 선택이면 dimsMatch=True 로 통과해야 한다.
  - src.Copy(단일셀 dst) 는 소스 크기만큼 자동 확장 → G1:K6 채워지고 금액 수식(=Hx*Ix) 보존돼야 한다.
서버 세션 없이 캡처 핵심 로직을 그대로 재현해 확인한다."""
import os, sys, shutil, tempfile, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import win32com.client as win32

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def _r1c1_to_a1(r1c1):
    def cv(part):
        m = re.match(r"R(\d+)C(\d+)", part)
        r, c = int(m.group(1)), int(m.group(2))
        s = ""
        while c > 0:
            c, rem = divmod(c - 1, 26)
            s = chr(65 + rem) + s
        return "%s%d" % (s, r)
    a, _, b = r1c1.partition(":")
    return cv(a) + (":" + cv(b) if b else "")


def read_clip_source():
    import win32clipboard as cb
    cb.OpenClipboard()
    try:
        fmt = 0
        target = None
        while True:
            fmt = cb.EnumClipboardFormats(fmt)
            if fmt == 0:
                break
            try:
                name = cb.GetClipboardFormatName(fmt)
            except Exception:
                name = ""
            if name == "Link":
                target = fmt
                break
        if target is None:
            return None
        raw = cb.GetClipboardData(target)
    finally:
        cb.CloseClipboard()
    if isinstance(raw, bytes):
        for enc in ("cp949", "mbcs", "utf-8", "latin-1"):
            try:
                raw = raw.decode(enc); break
            except Exception:
                continue
    parts = raw.split("\x00")
    if len(parts) < 3:
        return None
    m = re.search(r"\[(.*?)\]([^\x00]*)$", parts[1])
    book, sheet = m.group(1), m.group(2)
    return {"book": book, "sheet": sheet, "range": _r1c1_to_a1(parts[2])}


def main():
    tmp = os.path.join(tempfile.gettempdir(), "probe_singlecell.xlsx")
    shutil.copy(SRC_XLSX, tmp)
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    rc = 1
    try:
        wb = app.Workbooks.Open(tmp)
        ws = wb.Worksheets("원본")
        # 1) 복사
        ws.Range("A1:E6").Copy()
        # 2) 단일 셀 G1 선택 (사용자가 클릭만 한 상태 = 1x1)
        ws.Activate()
        ws.Range("G1").Select()
        sel = app.Selection
        sel_rows, sel_cols = int(sel.Rows.Count), int(sel.Columns.Count)
        top = sel.Cells(1, 1)
        dst_cell = str(top.Address).replace("$", "")
        print("Selection:", dst_cell, "size=%dx%d" % (sel_rows, sel_cols))
        # 3) 클립보드 소스 역추적
        src = read_clip_source()
        print("clipboard source:", src)
        assert src and src["range"] == "A1:E6", "소스 역추적 실패"
        # 4) dims_match (수정된 로직)
        srng = ws.Range(src["range"])
        src_rows, src_cols = int(srng.Rows.Count), int(srng.Columns.Count)
        if sel_rows == 1 and sel_cols == 1:
            dims_match = True
        else:
            dims_match = (src_rows == sel_rows and src_cols == sel_cols)
        print("dims_match:", dims_match, "(src %dx%d)" % (src_rows, src_cols))
        assert dims_match is True, "단일 셀인데 dims_match 가 True 가 아님!"
        # 5) 재생: 단일 앵커로 복사 → 자동 확장
        ws.Range(src["range"]).Copy(ws.Range(dst_cell))
        app.CutCopyMode = False
        # 6) 검증: G1:K6 채워졌고 금액 수식 보존
        g1 = ws.Range("G1").Value      # '품목'
        j2 = ws.Range("J2").Formula    # 금액 수식 자리 (D->J)
        k6 = ws.Range("G6").Value      # '합계'
        print("G1=", g1, "| J2.Formula=", j2, "| G6=", k6)
        ok = (str(g1) == "품목") and j2.startswith("=") and ("H2" in j2 and "I2" in j2)
        print("RESULT:", "OK" if ok else "FAIL")
        rc = 0 if ok else 2
        wb.Close(SaveChanges=False)
    finally:
        app.Quit()
    sys.exit(rc)


if __name__ == "__main__":
    main()
