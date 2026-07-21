#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""회귀: 같은 파일 내 시트간 복붙 캡처가 세션-창 대상 읽기로도 그대로 동작하는지(E2E)."""
import sys, os, shutil, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def main():
    f = os.path.join(tempfile.gettempdir(), "within_e2e.xlsx")
    shutil.copy(SRC_XLSX, f)
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    rc = 1
    try:
        wb = app.Workbooks.Open(f)
        s.EXCEL_SESSIONS["X"] = {"path": f, "app": app, "workbook": wb, "liveEditable": True}
        # 대상!A1 선택 후, 원본에서 복사
        wsD = wb.Worksheets("대상"); wb.Activate(); wsD.Activate(); wsD.Range("A1").Select()
        wb.Worksheets("원본").Range("A1:E6").Copy()
        time.sleep(0.1)
        res = s._capture_copypaste_on_session_impl("X")
        print("desc:", res["description"])
        print("dest:", res["dest"], "| dimsMatch:", res["dimsMatch"])
        within_ok = res["ok"] and ("교차파일" not in res["description"]) and (res["dest"]["sheet"] == "대상")
        # 재생
        ctx = s.PythonComSkillContext(app, wb, s.EXCEL_SESSIONS["X"])
        g = {}; exec(res["code"], g); g["transform"](ctx)
        a1 = wb.Worksheets("대상").Range("A1").Value
        d2 = str(wb.Worksheets("대상").Range("D2").Formula)
        replay_ok = (str(a1) == "품목") and d2.startswith("=")
        print("replay 대상!A1=%r D2=%r" % (a1, d2))
        ok = within_ok and replay_ok
        print("RESULT:", "OK" if ok else "FAIL")
        rc = 0 if ok else 2
    finally:
        try: wb.Close(SaveChanges=False)
        except Exception: pass
        app.Quit()
        s.EXCEL_SESSIONS.pop("X", None)
    sys.exit(rc)


if __name__ == "__main__":
    main()
