#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""교차파일 복붙 재현: 파일A(원본) -> 파일B(대상), 둘 다 한 Excel 인스턴스(_get_live_excel_app 모사).
캡처(클립보드 소스 + app.Selection 대상)와 재생(ctx.paste_copied src_book/dst_book)이
어디서 깨지는지 단계별로 출력."""
import sys, os, shutil, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def main():
    fileA = os.path.join(tempfile.gettempdir(), "xfile_A_source.xlsx")
    fileB = os.path.join(tempfile.gettempdir(), "xfile_B_dest.xlsx")
    shutil.copy(SRC_XLSX, fileA)
    shutil.copy(SRC_XLSX, fileB)
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    rc = 1
    try:
        wbA = app.Workbooks.Open(fileA)
        wbB = app.Workbooks.Open(fileB)
        print("열린 워크북:", [str(w.Name) for w in app.Workbooks])

        wsA = wbA.Worksheets("원본")
        # 1) 파일A 에서 복사
        wsA.Range("A1:E6").Copy()
        time.sleep(0.1)

        # 2) 파일B 활성화 + 대상 시트 A1 선택 (사용자가 B에 붙여넣기 직전 상태 모사)
        wbB.Activate()
        wsB = wbB.Worksheets("대상")
        wsB.Activate()
        wsB.Range("A1").Select()
        time.sleep(0.1)

        # 3) 캡처가 읽는 값들
        src = s._read_excel_clipboard_source()
        print("clipboard source:", src)
        sel = app.Selection
        dst_ws = sel.Worksheet
        print("Selection.Worksheet:", str(dst_ws.Name), "| Parent(book):", str(dst_ws.Parent.Name),
              "| addr:", str(sel.Address))
        print("CutCopyMode:", app.CutCopyMode)

        # 클립보드가 살아있는지 + 대상이 정말 파일B 인지
        cap_src_ok = bool(src) and ("xfile_A_source" in src["book"])
        cap_dst_ok = ("xfile_B_dest" in str(dst_ws.Parent.Name)) and (str(dst_ws.Name) == "대상")
        print("capture source ok:", cap_src_ok, "| capture dest ok:", cap_dst_ok)

        # 4) 재생: ctx 는 파일B(대상) 기준
        ctx = s.PythonComSkillContext(app, wbB, {})
        try:
            ctx.paste_copied(src["sheet"], src["range"], str(dst_ws.Name), "A1",
                             src_book=src["book"], dst_book=str(dst_ws.Parent.Name))
            a1 = wsB.Range("A1").Value
            d2 = str(wsB.Range("D2").Formula)
            replay_ok = (str(a1) == "품목") and d2.startswith("=")
            print("replay paste_copied: A1=%r D2.Formula=%r -> %s" % (a1, d2, "OK" if replay_ok else "FAIL"))
        except Exception as e:
            replay_ok = False
            print("replay FAILED:", type(e).__name__, e)

        # 5) 재생 시 소스 파일이 닫혀 있으면? (전체실행 때 파일A 미오픈 상황 모사)
        print("\n--- 소스 파일 닫고 재생 시도 (전체실행 시 파일A 미오픈 모사) ---")
        wbA.Close(SaveChanges=False)
        print("열린 워크북:", [str(w.Name) for w in app.Workbooks])
        ctx2 = s.PythonComSkillContext(app, wbB, {})
        try:
            ctx2.paste_copied(src["sheet"], src["range"], "대상", "H1",
                              src_book=src["book"], dst_book=str(wbB.Name))
            print("소스 닫힘 재생: 예상외 성공")
            closed_behaves = False
        except Exception as e:
            print("소스 닫힘 재생 실패(예상):", type(e).__name__, str(e)[:120])
            closed_behaves = True

        ok = cap_src_ok and cap_dst_ok and replay_ok
        print("\nRESULT:", "OK" if ok else "FAIL", "| 소스닫힘=명시적오류:", closed_behaves)
        rc = 0 if ok else 2
        try:
            wbB.Close(SaveChanges=False)
        except Exception:
            pass
    finally:
        app.Quit()
    sys.exit(rc)


if __name__ == "__main__":
    main()
