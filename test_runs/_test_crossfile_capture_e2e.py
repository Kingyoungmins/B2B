#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""실제 _capture_copypaste_on_session_impl 를 교차파일 시나리오로 호출(E2E).
A에서 복사 → A를 COM-active로 둔 채 → 세션 B로 캡처. 대상이 B로 잡히고 (교차파일)로 표시되며,
생성 코드로 재생까지 되는지 확인."""
import sys, os, shutil, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def main():
    fileA = os.path.join(tempfile.gettempdir(), "e2e_A_source.xlsx")
    fileB = os.path.join(tempfile.gettempdir(), "e2e_B_dest.xlsx")
    shutil.copy(SRC_XLSX, fileA)
    shutil.copy(SRC_XLSX, fileB)
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    rc = 1
    try:
        wbA = app.Workbooks.Open(fileA)
        wbB = app.Workbooks.Open(fileB)
        # 세션/업로드 레지스트리 등록(실제 서버 상태 모사)
        s.EXCEL_SESSIONS["B"] = {"path": fileB, "app": app, "workbook": wbB, "liveEditable": True}
        s.EXCEL_SESSIONS["A"] = {"path": fileA, "app": app, "workbook": wbA, "liveEditable": True}
        s.WORKBOOKS["A"] = {"id": "A", "name": "e2e_A_source.xlsx", "path": fileA}
        s.WORKBOOKS["B"] = {"id": "B", "name": "e2e_B_dest.xlsx", "path": fileB}

        # B 의 붙여넣을 위치 선택
        wsB = wbB.Worksheets("대상")
        wbB.Activate(); wsB.Activate(); wsB.Range("A1").Select()
        # A 에서 복사 후 A 활성화 (COM-active = A)
        wbA.Worksheets("원본").Range("A1:E6").Copy()
        wbA.Activate()
        time.sleep(0.1)

        # === 실제 캡처 함수 호출 ===
        res = s._capture_copypaste_on_session_impl("B")
        print("capture result:")
        for k in ("ok", "description", "dimsMatch"):
            print("  %s = %r" % (k, res.get(k)))
        print("  source =", res.get("source"))
        print("  dest   =", res.get("dest"))
        print("  code   =", res.get("code").strip().splitlines()[-1].strip())

        dest_is_B = "e2e_B_dest" in res["dest"]["book"]
        src_is_A = "e2e_A_source" in res["source"]["book"]
        crossfile = "교차파일" in res["description"]
        cap_ok = res.get("ok") and dest_is_B and src_is_A and crossfile

        # === 재생: 생성 코드 실행 (ctx on B) ===
        ctx = s.PythonComSkillContext(app, wbB, s.EXCEL_SESSIONS["B"])
        g = {"ctx": ctx}
        exec(res["code"], g)
        g["transform"](ctx)
        a1 = wbB.Worksheets("대상").Range("A1").Value
        d2 = str(wbB.Worksheets("대상").Range("D2").Formula)
        replay_ok = (str(a1) == "품목") and d2.startswith("=")

        print("\ncapture_ok=%s (dest=B:%s src=A:%s 교차파일:%s)" % (cap_ok, dest_is_B, src_is_A, crossfile))
        print("replay_ok=%s  대상!A1=%r D2.Formula=%r" % (replay_ok, a1, d2))
        ok = cap_ok and replay_ok
        print("RESULT:", "OK" if ok else "FAIL")
        rc = 0 if ok else 2
    finally:
        try:
            wbA.Close(SaveChanges=False); wbB.Close(SaveChanges=False)
        except Exception:
            pass
        app.Quit()
        for k in ("A", "B"):
            s.EXCEL_SESSIONS.pop(k, None); s.WORKBOOKS.pop(k, None)
    sys.exit(rc)


if __name__ == "__main__":
    main()
