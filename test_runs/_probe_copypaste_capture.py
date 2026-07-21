#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""복붙 캡처 원시동작 검증(실제 Excel). 기능 구현 전 '소스 역추적 + 붙여넣기 감지'가 되는지 확인.
검증 항목:
 1) range.Copy 후 Application.CutCopyMode / Selection 으로 '소스 범위'를 잡을 수 있나
 2) Windows 클립보드의 Excel "Link" 포맷으로 소스([Book]Sheet!R..C..)를 역추적할 수 있나
 3) win32com WithEvents 로 SheetChange(붙여넣기 대상) 이벤트를 받을 수 있나(메시지 펌프 필요)
끝에 spawn 한 Excel pid 만 종료."""
import os, sys, time, traceback

def main():
    import pythoncom, win32com.client, win32clipboard, win32api
    pythoncom.CoInitialize()
    app = win32com.client.DispatchEx("Excel.Application")
    pid = None
    try:
        try:
            import win32process
            _, pid = win32process.GetWindowThreadProcessId(app.Hwnd)
        except Exception:
            pid = None
        app.Visible = False
        app.DisplayAlerts = False
        wb = app.Workbooks.Add()
        ws = wb.Worksheets(1)
        # 테스트 데이터 + 수식
        ws.Range("A1").Value = 10
        ws.Range("A2").Value = 20
        ws.Range("B1").Formula = "=A1*2"
        ws.Range("B2").Formula = "=A2*2"
        print("=== 1) Copy 후 CutCopyMode / Selection ===")
        src = ws.Range("A1:B2")
        src.Select()
        src.Copy()
        try:
            print("  CutCopyMode =", app.CutCopyMode, "(xlCopy=1, xlCut=2)")
        except Exception as e:
            print("  CutCopyMode err:", e)
        try:
            sel = app.Selection
            print("  Selection.Address =", sel.Address, "| Worksheet =", sel.Worksheet.Name, "| Book =", sel.Worksheet.Parent.Name)
        except Exception as e:
            print("  Selection err:", e)

        print("=== 2) 클립보드 Excel 'Link' 포맷(소스 역추적) ===")
        try:
            win32clipboard.OpenClipboard()
            try:
                fmts = []
                f = 0
                while True:
                    f = win32clipboard.EnumClipboardFormats(f)
                    if f == 0:
                        break
                    try:
                        nm = win32clipboard.GetClipboardFormatName(f)
                    except Exception:
                        nm = "(std %d)" % f
                    fmts.append((f, nm))
                print("  clipboard formats:", [n for _, n in fmts][:20])
                # "Link" 포맷 찾아 읽기
                for fid, nm in fmts:
                    if nm == "Link":
                        try:
                            data = win32clipboard.GetClipboardData(fid)
                            print("  Link raw:", repr(data)[:200])
                        except Exception as e:
                            print("  Link read err:", e)
            finally:
                win32clipboard.CloseClipboard()
        except Exception as e:
            print("  clipboard err:", e)

        print("=== 3) SheetChange 이벤트 싱크(붙여넣기 대상 감지) ===")
        captured = {"addr": None}
        class WbEvents:
            def OnSheetChange(self, sh, target):
                try:
                    captured["addr"] = (sh.Name, target.Address)
                except Exception:
                    captured["addr"] = ("?", "?")
        try:
            wb_evt = win32com.client.WithEvents(wb, WbEvents)
        except Exception as e:
            wb_evt = None
            print("  WithEvents err:", e)
        # 붙여넣기 모방: D1 에 PasteSpecial(또는 값 쓰기)
        ws.Range("D1").Select()
        try:
            ws.Paste(Destination=ws.Range("D1"))
        except Exception as e:
            print("  Paste err:", e, "→ 값 쓰기로 대체")
            ws.Range("D1").Value = 99
        # COM 이벤트가 들어오도록 메시지 펌프
        for _ in range(40):
            pythoncom.PumpWaitingMessages()
            if captured["addr"]:
                break
            time.sleep(0.05)
        print("  SheetChange captured =", captured["addr"])
        # 붙여넣은 결과 확인(수식 보존?)
        try:
            print("  D1.Formula =", ws.Range("D1").Formula, "| E1.Formula =", ws.Range("E1").Formula)
        except Exception as e:
            print("  read err:", e)
    except Exception:
        traceback.print_exc()
    finally:
        try: wb.Close(SaveChanges=False)
        except Exception: pass
        try: app.Quit()
        except Exception: pass
        if pid:
            os.system("taskkill /F /PID %s >NUL 2>&1" % pid)
        try: pythoncom.CoUninitialize()
        except Exception: pass


if __name__ == "__main__":
    main()
