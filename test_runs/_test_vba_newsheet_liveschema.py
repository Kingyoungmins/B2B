#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SBAGENT-138: 단일 VBA 적용으로 새 시트를 만들면 @멘션에 안 뜨던 버그 검증.
원인: _run_vba_on_session_impl(단일 VBA, /api/excel/run-vba)이 liveSchema 를 안 실어 보내
클라 시트 캐시(file.sheetNames)가 갱신 안 됨 -> @멘션 검색 누락.
(단일 Python/격리 파이프라인은 이미 liveSchema 반환.) 수정: 단일 VBA 도 liveSchema 반환.
비파괴: 임시 파일. VBA 주입(VBOM) 필요.
"""
import os, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

WBNAME = "vba_newsheet_test.xlsx"
NEW = "새시트_VBA"


def make_file(path):
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    try:
        wb = app.Workbooks.Add()
        wb.Worksheets(1).Name = "Sheet1"
        wb.Worksheets("Sheet1").Range("A1").Value = "x"
        wb.SaveAs(path, FileFormat=51); wb.Close(False)
    finally:
        app.Quit()


def main():
    f = os.path.join(tempfile.gettempdir(), WBNAME)
    make_file(f)
    live = win32.DispatchEx("Excel.Application"); live.Visible = False; live.DisplayAlerts = False
    rc = 1
    try:
        wb = live.Workbooks.Open(f)
        s.EXCEL_SESSIONS["T"] = {"path": f, "sourcePath": f, "name": WBNAME,
                                 "app": live, "workbook": wb, "liveEditable": True}
        s.WORKBOOKS["T"] = {"id": "T", "name": WBNAME, "path": f}

        code = (
            "Sub B2BSkill()\n"
            f"    Dim wb As Workbook: Set wb = Application.Workbooks(\"{WBNAME}\")\n"
            "    Dim ws As Worksheet\n"
            "    Set ws = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))\n"
            f"    ws.Name = \"{NEW}\"\n"
            "End Sub\n"
        )
        res = s._run_vba_on_session_impl("T", code)

        ls = res.get("liveSchema") or {}
        names = ls.get("sheetNames") or []
        sheets = ls.get("sheets") or {}
        live_names = [str(x.Name) for x in wb.Worksheets]
        print("result keys:", list(res.keys()))
        print("liveSchema sheetNames:", names)
        print("live wb sheets:", live_names)

        ok = (bool(res.get("ok"))
              and "liveSchema" in res
              and (NEW in names)
              and (NEW in sheets)
              and (NEW in live_names))
        print("RESULT:", "OK (single VBA liveSchema includes new sheet)" if ok else "FAIL")
        rc = 0 if ok else 2
        wb.Close(False)
    except Exception as e:
        import traceback; traceback.print_exc()
        msg = str(e)
        if "VBProject" in msg or "programmatic access" in msg.lower() or "vbom" in msg.lower():
            print("RESULT: SKIP (VBA project access(VBOM) disabled)")
            rc = 0
        else:
            print("RESULT: FAIL(EXC):", msg[:200])
            rc = 2
    finally:
        try: live.Quit()
        except Exception: pass
        for k in ("T",):
            s.EXCEL_SESSIONS.pop(k, None); s.WORKBOOKS.pop(k, None)
        try: os.unlink(f)
        except Exception: pass
    sys.exit(rc)


if __name__ == "__main__":
    main()
