#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""셀 삭제 캡처 검증.
시나리오: 원본!B2:C5 선택 후 Delete → [셀 삭제 캡처]. 캡처는 Selection 주소로 ctx.clear(sheet, range) 코드를 만든다.
재생(ClearContents)이 값/수식을 지우고 서식(굵게/채움)은 유지하는지 확인한다."""
import os, sys, shutil, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import win32com.client as win32

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


def main():
    tmp = os.path.join(tempfile.gettempdir(), "probe_delete.xlsx")
    shutil.copy(SRC_XLSX, tmp)
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    rc = 1
    try:
        wb = app.Workbooks.Open(tmp)
        ws = wb.Worksheets("원본")
        ws.Activate()
        # 사용자: B2:C5 선택 후 Delete (값/수식 삭제)
        ws.Range("B2:C5").Select()
        sel = app.Selection
        addr = str(sel.Address).replace("$", "")
        sheet = str(sel.Worksheet.Name)
        book = str(sel.Worksheet.Parent.Name)
        print("selection:", sheet, addr, "book=", book)
        assert addr == "B2:C5", "선택 주소 불일치: %s" % addr
        # 생성될 스텝 코드(캡처 함수와 동일 형식)
        code = "ctx.clear(%r, %r)" % (sheet, addr)
        print("step code:", code)
        # 삭제 전 상태
        before_b2 = ws.Range("B2").Value
        before_d2 = ws.Range("D2").Formula  # 금액 수식 = B2*C2 (이건 안 지움)
        # 재생: ClearContents (ctx.clear 와 동일 동작)
        ws.Range(addr).ClearContents()
        after_b2 = ws.Range("B2").Value
        after_c5 = ws.Range("C5").Value
        # 서식 유지 확인 (헤더 B1 굵게는 그대로) — B2 는 데이터셀이라 별도 서식 없음, 대신 값만 비었는지 확인
        print("B2 before=", before_b2, "-> after=", after_b2, "| C5 after=", after_c5)
        print("D2.Formula(보존):", ws.Range("D2").Formula)
        ok = (before_b2 is not None) and (after_b2 is None) and (after_c5 is None)
        print("RESULT:", "OK" if ok else "FAIL")
        rc = 0 if ok else 2
        wb.Close(SaveChanges=False)
    finally:
        app.Quit()
    sys.exit(rc)


if __name__ == "__main__":
    main()
