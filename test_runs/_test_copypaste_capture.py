#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""복붙 캡처+재생 백엔드 체인 검증(실제 Excel).
1) 복사(A1:B2) → 붙여넣기(D1) → _capture_copypaste_on_session_impl 로 소스/대상 역추적
2) 생성된 ctx.paste_copied 스텝을 _exec_python_com_skill 로 실행 → 수식 보존 재생 확인"""
import os, sys, shutil, tempfile, traceback
from pathlib import Path
ROOT = Path(r"C:/Users/Admin/Desktop/KGM_git/B2B_ver0.6.1"); sys.path.insert(0, str(ROOT))


def main():
    import pythoncom; pythoncom.CoInitialize()
    import serve_b2b as S
    work = Path(tempfile.mkdtemp(prefix="capture_test_"))
    app = S._get_live_excel_app(); pid = None
    try:
        pid = S._excel_process_id(app)
        path = work / "cap_test.xlsx"
        wb = app.Workbooks.Add()
        ws = wb.Worksheets(1)
        ws.Range("A1").Value = 10
        ws.Range("A2").Value = 20
        ws.Range("B1").Formula = "=A1*2"
        ws.Range("B2").Formula = "=A2*2"
        wb.SaveAs(str(path), FileFormat=51)
        full = str(Path(wb.FullName).resolve()).lower()
        S.EXCEL_SESSIONS["cap0"] = {"app": app, "workbook": wb, "path": full, "openPath": full,
                                    "sourcePath": str(path), "name": path.name,
                                    "liveEditable": True, "rev": 0, "pid": pid}

        print("=== 복사(A1:B2) → 붙여넣기(D1) [인터랙티브 Ctrl+V 모방] ===")
        # 인터랙티브 Ctrl+C: 클립보드 Link 설정 + CutCopyMode=xlCopy.
        ws.Range("A1:B2").Copy()
        # 인터랙티브 Ctrl+V(복사): 클립보드는 유지되고, 붙여넣은 범위가 선택된다 → Selection=D1:E2 모방.
        # (ws.Paste 는 COM 특성상 클립보드를 비우므로 캡처 테스트엔 부적합 → Select 로 상태만 모방)
        ws.Range("D1:E2").Select()
        try:
            print("  CutCopyMode =", app.CutCopyMode, "| Selection =", app.Selection.Address)
        except Exception as e:
            print("  selection err:", e)

        print("=== 캡처 직전 클립보드 덤프 ===")
        import win32clipboard
        try:
            win32clipboard.OpenClipboard()
            names = []
            f = 0
            while True:
                f = win32clipboard.EnumClipboardFormats(f)
                if f == 0: break
                try: nm = win32clipboard.GetClipboardFormatName(f)
                except Exception: nm = "(std %d)" % f
                names.append(nm)
            print("  formats:", names[:25])
            win32clipboard.CloseClipboard()
        except Exception as e:
            print("  clipboard dump err:", e)
        # "Link" 직접 읽기 진단
        try:
            win32clipboard.OpenClipboard()
            fid = None; f = 0
            while True:
                f = win32clipboard.EnumClipboardFormats(f)
                if f == 0: break
                try: nm = win32clipboard.GetClipboardFormatName(f)
                except Exception: nm = ""
                if nm == "Link": fid = f; break
            print("  Link fid =", fid)
            if fid:
                try:
                    d = win32clipboard.GetClipboardData(fid)
                    print("  GetClipboardData(Link) type =", type(d), "repr =", repr(d)[:160])
                except Exception as ge:
                    print("  GetClipboardData(Link) EXC:", repr(ge))
            win32clipboard.CloseClipboard()
        except Exception as e:
            print("  Link read diag err:", e)
        print("  _read_excel_clipboard_source ->", S._read_excel_clipboard_source())

        print("=== 캡처 ===")
        cap = S._capture_copypaste_on_session_impl("cap0")
        print("  source:", cap["source"])
        print("  dest  :", cap["dest"])
        print("  dimsMatch:", cap["dimsMatch"], "| desc:", cap["description"])
        print("  step code:\n" + cap["code"])

        print("=== 재생 검증: D1:E2 지우고 스텝 실행 ===")
        ws.Range("D1:E2").ClearContents()
        S._exec_python_com_skill(app, wb, S.EXCEL_SESSIONS["cap0"], cap["code"])
        print("  D1 =", ws.Range("D1").Value, "| E1.Formula =", ws.Range("E1").Formula,
              "| E2.Formula =", ws.Range("E2").Formula)
        ok = (ws.Range("D1").Value == 10 and str(ws.Range("E1").Formula).replace(" ", "") == "=D1*2")
        print("  >>> 재생 + 수식보존 =", "OK" if ok else "FAIL")
    except Exception:
        traceback.print_exc()
    finally:
        S.EXCEL_SESSIONS.pop("cap0", None)
        try:
            for w in list(app.Workbooks):
                try: w.Close(SaveChanges=False)
                except Exception: pass
        except Exception: pass
        try: app.Quit()
        except Exception: pass
        if pid: os.system("taskkill /F /PID %s >NUL 2>&1" % pid)
        shutil.rmtree(work, ignore_errors=True)
        try: pythoncom.CoUninitialize()
        except Exception: pass


if __name__ == "__main__":
    main()
