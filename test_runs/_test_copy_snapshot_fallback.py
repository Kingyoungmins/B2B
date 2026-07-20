#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""교차파일 실패 재현+수정 검증: 복사 후 클립보드 Link 가 사라져도(no-clipboard-source)
복사 중 폴이 잡아둔 전역 스냅샷으로 캡처가 복구되는지(E2E)."""
import sys, os, shutil, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as win32
import win32clipboard as cb
import serve_b2b as s

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def empty_clipboard():
    for _ in range(8):
        try:
            cb.OpenClipboard()
        except Exception:
            time.sleep(0.05); continue
        try:
            cb.EmptyClipboard()
        finally:
            cb.CloseClipboard()
        return


def main():
    fileA = os.path.join(tempfile.gettempdir(), "snap_A_source.xlsx")
    fileB = os.path.join(tempfile.gettempdir(), "snap_B_dest.xlsx")
    shutil.copy(SRC_XLSX, fileA); shutil.copy(SRC_XLSX, fileB)
    s.LAST_COPY_SOURCE.clear()
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False; app.DisplayAlerts = False
    rc = 1
    try:
        wbA = app.Workbooks.Open(fileA)
        wbB = app.Workbooks.Open(fileB)
        s.EXCEL_SESSIONS["B"] = {"path": fileB, "app": app, "workbook": wbB, "liveEditable": True}
        s.EXCEL_SESSIONS["A"] = {"path": fileA, "app": app, "workbook": wbA, "liveEditable": True}
        s.WORKBOOKS["A"] = {"id": "A", "name": "snap_A_source.xlsx", "path": fileA}
        s.WORKBOOKS["B"] = {"id": "B", "name": "snap_B_dest.xlsx", "path": fileB}

        # B 붙여넣을 위치 선택
        wsB = wbB.Worksheets("대상"); wbB.Activate(); wsB.Activate(); wsB.Range("A1").Select()
        # A 에서 복사 → CutCopyMode 활성
        wbA.Worksheets("원본").Range("A1:E6").Copy()
        time.sleep(0.1)
        print("CutCopyMode after copy:", app.CutCopyMode)

        # === 폴이 복사 중 스냅샷 (수정의 핵심) ===
        s._maybe_snapshot_copy_source(app)
        print("snapshot:", s.LAST_COPY_SOURCE.get("source"))

        # === 클립보드 Link 소실 시뮬레이션(붙여넣기/탭전환 후 상태) ===
        app.CutCopyMode = False
        empty_clipboard()
        print("live clipboard now:", s._read_excel_clipboard_source(), "(None 이어야 재현)")

        # === 캡처: 라이브 클립보드 None → 스냅샷 폴백 ===
        res = s._capture_copypaste_on_session_impl("B")
        print("desc:", res["description"])
        src_is_A = "snap_A_source" in res["source"]["book"]
        dest_is_B = "snap_B_dest" in res["dest"]["book"]
        crossfile = "교차파일" in res["description"]
        cap_ok = res["ok"] and src_is_A and dest_is_B and crossfile

        # 재생
        ctx = s.PythonComSkillContext(app, wbB, s.EXCEL_SESSIONS["B"])
        g = {}; exec(res["code"], g); g["transform"](ctx)
        a1 = wbB.Worksheets("대상").Range("A1").Value
        d2 = str(wbB.Worksheets("대상").Range("D2").Formula)
        replay_ok = (str(a1) == "품목") and d2.startswith("=")
        print("capture_ok=%s replay_ok=%s 대상!A1=%r D2=%r" % (cap_ok, replay_ok, a1, d2))
        ok = cap_ok and replay_ok
        print("RESULT:", "OK" if ok else "FAIL")
        rc = 0 if ok else 2
    finally:
        try: wbA.Close(SaveChanges=False); wbB.Close(SaveChanges=False)
        except Exception: pass
        app.Quit()
        for k in ("A", "B"):
            s.EXCEL_SESSIONS.pop(k, None); s.WORKBOOKS.pop(k, None)
        s.LAST_COPY_SOURCE.clear()
    sys.exit(rc)


if __name__ == "__main__":
    main()
