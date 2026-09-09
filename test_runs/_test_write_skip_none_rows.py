# -*- coding: utf-8 -*-
"""[ctx.write 제외 행 실측 COM] 행 전체가 None 인 행은 '건드리지 않는다'.

실측(2026-09-09, 10:18 세션): '합계 행(24행)은 제외합니다' 라던 생성 코드가
out.append([None]) + 통짜 ctx.write 로 짜여 C24 의 기존 수식(=SUM...)이 지워졌다
(Value2=None = 셀 비우기). 매출 열은 match_fill(매칭 행만 기록)이라 무사했던 것과 대비.
수정: 행 전체 None = 그 행 스킵(연속 구간별 기록). 셀 삭제는 ctx.clear 가 담당(생성 코드 실측).

진짜 Excel 로 실제 ctx.write 를 돌려 되읽어 검증.
실행: python test_runs/_test_write_skip_none_rows.py   (B2B_ver 루트에서, Excel 필요)"""
import os, sys, tempfile
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


app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
try:
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "회사별요약"
    # 실측 재현: C열에 값들 + 24행 자리에 기존 수식
    ws.Cells(4, 3).Value = 111
    ws.Cells(5, 3).Value = 222
    ws.Cells(6, 3).Formula = "=SUM(C4:C5)"     # '합계' 수식 — 제외 행이 보존해야 할 대상
    ws.Cells(7, 3).Value = 333

    ctx = S.PythonComSkillContext(app, wb, {})

    print("[1] 행 전체 None = 그 행은 건드리지 않는다(수식 보존)")
    ctx.write("회사별요약", "C4", [[10], [20], [None], [40]], overwrite_formulas=True)
    check("값 행은 기록(C4=10, C5=20, C7=40)",
          ws.Cells(4, 3).Value == 10 and ws.Cells(5, 3).Value == 20 and ws.Cells(7, 3).Value == 40,
          (ws.Cells(4, 3).Value, ws.Cells(5, 3).Value, ws.Cells(7, 3).Value))
    check("제외 행(C6)의 기존 수식 보존", str(ws.Cells(6, 3).Formula) == "=SUM(C4:C5)", ws.Cells(6, 3).Formula)
    check("수식 값도 새 값 기준으로 계산(30)", ws.Cells(6, 3).Value == 30, ws.Cells(6, 3).Value)

    print("[2] 전부 None 이면 아무 것도 안 건드림")
    n = ctx.write("회사별요약", "C4", [[None], [None]], overwrite_formulas=True)
    check("반환 0 + 값 그대로", n == 0 and ws.Cells(4, 3).Value == 10 and ws.Cells(5, 3).Value == 20,
          (n, ws.Cells(4, 3).Value))

    print("[3] 행 '일부' None 은 기존대로 그 셀만 비운다(다열 기록 호환)")
    ws.Cells(10, 1).Value = "지움대상"
    ctx.write("회사별요약", "A10", [["새값", None]], overwrite_formulas=True)
    check("A10=새값, B10 비움", ws.Cells(10, 1).Value == "새값" and ws.Cells(10, 2).Value is None,
          (ws.Cells(10, 1).Value, ws.Cells(10, 2).Value))

    print("[4] 여러 구간으로 갈라져도 순서대로 기록")
    ctx.write("회사별요약", "E1", [[1], [None], [3], [None], [5]], overwrite_formulas=True)
    check("E1=1, E3=3, E5=5, E2/E4 비어있음",
          ws.Cells(1, 5).Value == 1 and ws.Cells(3, 5).Value == 3 and ws.Cells(5, 5).Value == 5
          and ws.Cells(2, 5).Value is None and ws.Cells(4, 5).Value is None)
    print("[5] 내부 헬퍼·단일 셀은 예전 의미 유지(빈 값=비움)")
    ws.Cells(12, 3).Formula = "=1+1"
    ctx.write_cell("회사별요약", "C12", None)
    check("write_cell(None) 은 여전히 셀을 비운다(명시 단일 셀)", ws.Cells(12, 3).Value is None, ws.Cells(12, 3).Value)
    ws.Cells(13, 3).Value = 77
    ctx.write("회사별요약", "C13", [[None]], skip_none_rows=False)
    check("skip_none_rows=False 면 None 행도 비운다", ws.Cells(13, 3).Value is None, ws.Cells(13, 3).Value)
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
