#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""실제 ctx(PythonComSkillContext).paste_copied 로 전체열/행 복붙 재생 검증.
- 전체 열 'A:E' -> G1, 전체 행 '1:6' -> A8 이 멈춤 없이 수식 보존하며 재생되는지.
- 저널 폭주(수백만 셀 읽기) 없이 'whole' 로 우회되는지.
- 일반 범위는 여전히 저널에 백업되는지(회귀)."""
import sys, os, shutil, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def main():
    tmp = os.path.join(tempfile.gettempdir(), "engine_fcr.xlsx")
    shutil.copy(SRC_XLSX, tmp)
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    rc = 1
    try:
        wb = app.Workbooks.Open(tmp)
        ws = wb.Worksheets("원본")
        ctx = s.PythonComSkillContext(app, wb, {})

        # 1) 전체 열 A:E -> G1
        t0 = time.monotonic()
        ctx.paste_copied("원본", "A:E", "원본", "G1")
        dt_col = time.monotonic() - t0
        g1 = ws.Range("G1").Value
        j2 = str(ws.Range("J2").Formula)
        col_ok = (str(g1) == "품목") and j2.startswith("=") and "H2" in j2
        whole_marked = any("whole" in x for x in ctx._shared["structural"])
        print("[full-col] %.2fs G1=%r J2=%r whole_marked=%s -> %s"
              % (dt_col, g1, j2, whole_marked, "OK" if col_ok else "FAIL"))

        # 2) 전체 행 1:6 -> A8
        t0 = time.monotonic()
        ctx.paste_copied("원본", "1:6", "원본", "A8")
        dt_row = time.monotonic() - t0
        a8 = ws.Range("A8").Value
        d9 = str(ws.Range("D9").Formula)
        row_ok = (str(a8) == "품목") and d9.startswith("=") and "B9" in d9
        print("[full-row] %.2fs A8=%r D9=%r -> %s"
              % (dt_row, a8, d9, "OK" if row_ok else "FAIL"))

        # 3) 일반 범위 회귀: 대상 시트로 A1:E6 -> A1, 저널에 기록되어야 함
        jbefore = len(ctx._shared["journal"])
        ctx.paste_copied("원본", "A1:E6", "대상", "A1")
        jafter = len(ctx._shared["journal"])
        d2 = str(wb.Worksheets("대상").Range("D2").Formula)
        norm_ok = (jafter > jbefore) and d2.startswith("=")
        print("[normal] journal %d->%d 대상!D2=%r -> %s"
              % (jbefore, jafter, d2, "OK" if norm_ok else "FAIL"))

        # 시간 가드: 전체열/행이 1초 넘게 걸리면 저널 폭주 의심
        time_ok = (dt_col < 2.0) and (dt_row < 2.0)
        print("time_ok(<2s each)=%s" % time_ok)

        ok = col_ok and row_ok and norm_ok and whole_marked and time_ok
        print("RESULT:", "OK" if ok else "FAIL")
        rc = 0 if ok else 2
        wb.Close(SaveChanges=False)
    finally:
        app.Quit()
    sys.exit(rc)


if __name__ == "__main__":
    main()
