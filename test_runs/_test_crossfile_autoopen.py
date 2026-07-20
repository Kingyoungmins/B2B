#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""교차파일 재생 자립성 검증: 소스 파일이 인스턴스에 안 열려 있어도
paste_copied 가 업로드 레지스트리(WORKBOOKS) 경로에서 읽기전용으로 자동 열어 복사하고 다시 닫는지."""
import sys, os, shutil, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def main():
    fileA = os.path.join(tempfile.gettempdir(), "xauto_A_source.xlsx")
    fileB = os.path.join(tempfile.gettempdir(), "xauto_B_dest.xlsx")
    shutil.copy(SRC_XLSX, fileA)
    shutil.copy(SRC_XLSX, fileB)
    # 업로드 레지스트리 모사 (paste_copied 자동 열기가 참조)
    s.WORKBOOKS["A"] = {"id": "A", "name": "xauto_A_source.xlsx", "path": fileA}
    s.WORKBOOKS["B"] = {"id": "B", "name": "xauto_B_dest.xlsx", "path": fileB}

    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    rc = 1
    try:
        wbA = app.Workbooks.Open(fileA)
        wbB = app.Workbooks.Open(fileB)
        # 소스 좌표 확보(클립보드 불필요 — 캡처는 이미 검증됨, 여기선 재생 자립성만)
        srcA_name = str(wbA.Name)
        # 소스 파일을 닫아 '재생 시 미오픈' 상황 재현
        wbA.Close(SaveChanges=False)
        open_before = [str(w.Name) for w in app.Workbooks]
        print("재생 전 열린 워크북:", open_before, "(소스 닫힘)")

        ctx = s.PythonComSkillContext(app, wbB, {})
        t0 = time.monotonic()
        ctx.paste_copied("원본", "A1:E6", "대상", "H1",
                         src_book=srcA_name, dst_book=str(wbB.Name))
        dt = time.monotonic() - t0

        wsB = wbB.Worksheets("대상")
        h1 = wsB.Range("H1").Value      # '품목'
        k2 = str(wsB.Range("K2").Formula)  # 금액수식 자리(D->K): =I2*J2
        open_after = [str(w.Name) for w in app.Workbooks]
        # 자동 열린 소스는 작업 후 닫혀야 함 → 열린 목록에 다시 없어야 함
        src_reclosed = not any("xauto_A_source" in n for n in open_after)
        ok = (str(h1) == "품목") and k2.startswith("=") and src_reclosed and dt < 5.0
        print("재생 후 H1=%r K2.Formula=%r %.2fs" % (h1, k2, dt))
        print("재생 후 열린 워크북:", open_after, "| 소스 재폐쇄:", src_reclosed)
        print("RESULT:", "OK" if ok else "FAIL")
        rc = 0 if ok else 2
        wbB.Close(SaveChanges=False)
    finally:
        app.Quit()
        s.WORKBOOKS.pop("A", None)
        s.WORKBOOKS.pop("B", None)
    sys.exit(rc)


if __name__ == "__main__":
    main()
