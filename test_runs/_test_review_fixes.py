#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""리뷰에서 확인된 3건 수정 검증:
(1) 전체열/행 paste_copied(whole) 가 대상 데이터 ∩ UsedRange 만 저널 백업 → 롤백으로 복원.
(2) 비연속 다중영역은 Areas.Count>1 로 감지(캡처에서 거부 근거).
(3) 변환기의 다중영역 A1 출력('A:E,H:J')이 Excel 이 파싱 가능한 2영역 Range 인지.
모두 실제 Excel."""
import sys, os, shutil, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def main():
    tmp = os.path.join(tempfile.gettempdir(), "review_fixes.xlsx")
    shutil.copy(SRC_XLSX, tmp)
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    rc = 1
    try:
        wb = app.Workbooks.Open(tmp)
        ws = wb.Worksheets("원본")

        # ---- (1) 전체 열 paste 의 bounded 저널 + 롤백 ----
        # 대상 G1:K1 에 기존 데이터 채워 UsedRange 가 K열까지 확장되게 함
        for col, val in zip(["G", "H", "I", "J", "K"], ["a", "b", "c", "d", "e"]):
            ws.Range(col + "1").Value = val
        ctx = s.PythonComSkillContext(app, wb, {})
        t0 = time.monotonic()
        ctx.paste_copied("원본", "A:E", "원본", "G1")
        dt = time.monotonic() - t0
        g1_after = ws.Range("G1").Value          # 덮어써져 '품목'
        jn = len(ctx._shared["journal"])          # 백업 1건 이상
        restored, had_struct = ctx._rollback()
        g1_rb = ws.Range("G1").Value              # 복원 'a'
        k1_rb = ws.Range("K1").Value              # 복원 'e'
        whole_ok = (str(g1_after) == "품목") and jn >= 1 and str(g1_rb) == "a" and str(k1_rb) == "e" and dt < 2.0
        print("[whole bounded journal] %.2fs G1_after=%r journal=%d restored=%d -> G1_rb=%r K1_rb=%r -> %s"
              % (dt, g1_after, jn, restored, g1_rb, k1_rb, "OK" if whole_ok else "FAIL"))

        # ---- (2) 다중영역 감지 ----
        multi = ws.Range("A1:B2,D1:E2")
        single = ws.Range("A:E")
        areas_ok = (int(multi.Areas.Count) == 2) and (int(single.Areas.Count) == 1)
        print("[multi-area detect] multi.Areas=%d single.Areas=%d -> %s"
              % (multi.Areas.Count, single.Areas.Count, "OK" if areas_ok else "FAIL"))

        # ---- (3) 변환기 다중영역 A1 출력이 Excel 파싱 가능 + 2영역인지 ----
        a1 = s._r1c1_to_a1("C1:C5,C8:C10")   # -> 'A:E,H:J'
        rng = ws.Range(a1)
        parse_ok = (a1 == "A:E,H:J") and int(rng.Areas.Count) == 2
        print("[multi-area A1 parse] '%s' Areas=%d -> %s" % (a1, rng.Areas.Count, "OK" if parse_ok else "FAIL"))

        ok = whole_ok and areas_ok and parse_ok
        print("RESULT:", "OK" if ok else "FAIL")
        rc = 0 if ok else 2
        wb.Close(SaveChanges=False)
    finally:
        app.Quit()
    sys.exit(rc)


if __name__ == "__main__":
    main()
