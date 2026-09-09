# -*- coding: utf-8 -*-
"""[AI 도움 전체 집계 실측 COM] _live_preview_schema 가 max_rows 로 시트 전체를 읽는지.

실측(2026-09-09 10:47): 매출 시트 ~1,200행인데 AI 도움 미리보기는 60행뿐이라 검산(합계 비교)을
답하지 못하고 설계 채팅으로 넘겼다. 수정: preview-schema 가 단일 시트 요청에 한해 maxRows(≤20000)를
받는다. 여기서는 그 밑바닥 함수를 진짜 Excel 로 돌려 행수와 합계를 되읽어 확인한다.
실행: python test_runs/_test_live_preview_maxrows_com.py   (B2B_ver 루트에서, Excel 필요)"""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import pythoncom, win32com.client as w
pythoncom.CoInitialize()
import serve_b2b as S

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)) if (not cond and detail) else ""))
    if not cond:
        fails.append(name)


N = 1200
app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
try:
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "매출"
    ws.Cells(1, 1).Value = "회사명"; ws.Cells(1, 2).Value = "금액"
    data = [["회사%d" % (i % 20), 1000 + i] for i in range(N)]
    ws.Range(ws.Cells(2, 1), ws.Cells(N + 1, 2)).Value = data
    expected = sum(1000 + i for i in range(N))
    other = wb.Worksheets.Add(); other.Name = "기타"
    other.Cells(1, 1).Value = "x"

    print("[1] 기본(60행) — 예전 그대로(가벼운 미리보기)")
    s60 = S._live_preview_schema(wb, only_sheet="매출")
    rows60 = s60["sheets"]["매출"]
    check("60행만 온다", len(rows60) == 60, len(rows60))
    check("dims 는 실제 행수(1201)를 알려준다", s60["dims"]["매출"]["maxRow"] == N + 1, s60["dims"]["매출"])
    check("partial 표시 + 전체 시트명 유지", s60.get("partial") is True and "기타" in s60.get("allSheetNames", []))

    print("[2] max_rows=실제 행수 — 전체가 오고 합계가 정확하다")
    sfull = S._live_preview_schema(wb, max_rows=N + 1, only_sheet="매출")
    rows = sfull["sheets"]["매출"]
    check("1201행(헤더+1200) 전부", len(rows) == N + 1, len(rows))
    total = sum(float(r[1]) for r in rows[1:] if r and r[1] is not None)
    check("금액 합계 = 기대값(%d)" % expected, int(total) == expected, total)

    print("[3] 상한 — max_rows 가 실제보다 커도 실제 행수까지만")
    sbig = S._live_preview_schema(wb, max_rows=20000, only_sheet="매출")
    check("실제 행수(1201)에서 멈춤", len(sbig["sheets"]["매출"]) == N + 1, len(sbig["sheets"]["매출"]))
finally:
    try:
        wb.Close(False)
    except Exception:
        pass
    app.Quit()
    pythoncom.CoUninitialize()

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL - %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)
