# [0.5.17] 경량 선택 폴 백엔드(_read_excel_session_selection_impl) 라이브 COM 스모크테스트.
# 행/열/범위 선택이 즉시 읽히는지 확인(선택→채팅 반영 지연 개선의 백엔드 검증).
import os, sys, io, tempfile, uuid
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import win32com.client as win32
import serve_b2b as s

def main():
    path = str(Path(tempfile.gettempdir()) / "b2b_sel_poll.xlsx")
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    wb = None
    sid = None
    passed = 0
    try:
        wb = app.Workbooks.Add()
        ws = wb.Worksheets(1); ws.Name = "데이터"
        ws.Range("A1:E5").Value = [[c + r * 10 for c in range(1, 6)] for r in range(5)]
        wb.SaveAs(path, FileFormat=51)

        sid = uuid.uuid4().hex
        s.EXCEL_SESSIONS[sid] = {"id": sid, "app": app, "workbook": wb,
                                 "path": path, "openPath": path, "liveEditable": False}

        # 범위 선택 — 정확 주소
        ws.Activate(); ws.Range("B2:D4").Select()
        r = s._read_excel_session_selection_impl(sid)
        assert r["ok"] and r["address"] == "B2:D4", r
        assert r["sheet"] == "데이터", r
        print(" OK  범위 B2:D4 즉시 읽힘:", r["address"]); passed += 1

        # 행 전체 선택 — 3행 포함
        ws.Rows("3:3").Select()
        r = s._read_excel_session_selection_impl(sid)
        assert r["ok"] and ("3:3" in r["address"] or "3" in r["address"]) and r["address"], r
        print(" OK  행 선택 읽힘:", r["address"]); passed += 1

        # 열 전체 선택 — C열 포함
        ws.Columns("C:C").Select()
        r = s._read_excel_session_selection_impl(sid)
        assert r["ok"] and ("C:C" in r["address"] or "C" in r["address"]) and r["address"], r
        print(" OK  열 선택 읽힘:", r["address"]); passed += 1

        # 단일 셀
        ws.Range("E5").Select()
        r = s._read_excel_session_selection_impl(sid)
        assert r["ok"] and r["address"] == "E5", r
        print(" OK  단일 셀 E5 읽힘:", r["address"]); passed += 1

        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        if sid:
            s.EXCEL_SESSIONS.pop(sid, None)
        try:
            if wb is not None:
                wb.Close(SaveChanges=False)
        except Exception:
            pass
        try:
            app.Quit()
        except Exception:
            pass

if __name__ == "__main__":
    main()
