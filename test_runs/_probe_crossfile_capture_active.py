#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""교차파일 캡처 신뢰성: 소스 파일 A 가 COM-active 인 상태(app.Selection 이 A를 가리킴)에서도
세션 워크북 B 의 창 RangeSelection 으로 '붙여넣은 위치(B)'를 정확히 읽는지 검증.
이것이 실패하면 캡처가 'A→A'(within-file)로 잘못 잡혀 파일간 복붙이 안 되는 증상이 된다."""
import sys, os, shutil, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def main():
    fileA = os.path.join(tempfile.gettempdir(), "xcap_A_source.xlsx")
    fileB = os.path.join(tempfile.gettempdir(), "xcap_B_dest.xlsx")
    shutil.copy(SRC_XLSX, fileA)
    shutil.copy(SRC_XLSX, fileB)
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    rc = 1
    try:
        wbA = app.Workbooks.Open(fileA)
        wbB = app.Workbooks.Open(fileB)

        # 1) 먼저 B 의 붙여넣을 위치(대상!A1)를 선택해 둠 (B 활성 상태에서)
        wsB = wbB.Worksheets("대상")
        wbB.Activate(); wsB.Activate(); wsB.Range("A1").Select()

        # 2) A 에서 복사하고 A 를 활성화 → A 가 COM-active(app.Selection 이 A 를 가리키는 증상 상황)
        wsA = wbA.Worksheets("원본")
        wsA.Range("A1:E6").Copy()
        wbA.Activate()
        time.sleep(0.1)

        # 전역 Selection (구버전 방식) — A 를 가리킴(틀린 대상)
        gsel = app.Selection
        g_book = str(gsel.Worksheet.Parent.Name)
        print("[구방식] app.Selection book =", g_book, "addr =", str(gsel.Address))

        # 신방식 — 세션 워크북 B 의 창 선택
        bsel = wbB.Windows(1).RangeSelection
        b_book = str(bsel.Worksheet.Parent.Name)
        b_sheet = str(bsel.Worksheet.Name)
        b_cell = str(bsel.Cells(1, 1).Address).replace("$", "")
        print("[신방식] wbB.Windows(1).RangeSelection book =", b_book, "sheet =", b_sheet, "cell =", b_cell)

        src = s._read_excel_clipboard_source()
        print("clipboard source:", src)

        # 캡처가 만들 step (신방식 대상 사용)
        dst_book = b_book
        same = s._workbook_name_lookup_key(src["book"]) == s._workbook_name_lookup_key(dst_book)
        print("same(=within-file)?", same, "→ 교차파일이면 False 여야 정상")

        # 검증: 신방식이 B 를 가리키고, 구방식은 A 를 가리켜(증상 재현), 교차파일 판정 정상
        new_ok = ("xcap_B_dest" in b_book) and (b_sheet == "대상") and (b_cell == "A1")
        old_was_wrong = ("xcap_A_source" in g_book)   # 구방식 결함 재현
        crossfile_ok = (same is False) and ("xcap_A_source" in src["book"])
        print("new_dest_ok=%s | old_was_wrong=%s | crossfile_ok=%s" % (new_ok, old_was_wrong, crossfile_ok))

        ok = new_ok and crossfile_ok
        print("RESULT:", "OK" if ok else "FAIL", "(구방식 결함 재현:", old_was_wrong, ")")
        rc = 0 if ok else 2
        wbA.Close(SaveChanges=False); wbB.Close(SaveChanges=False)
    finally:
        app.Quit()
    sys.exit(rc)


if __name__ == "__main__":
    main()
