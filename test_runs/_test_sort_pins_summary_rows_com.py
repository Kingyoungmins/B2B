# -*- coding: utf-8 -*-
"""[ctx.sort 요약행 고정 실측 COM] 범위 맨 아래의 합계/평균 행은 정렬에서 빠져 그 자리에 남는다.

실측(2026-09-09): "마진 열 기준 내림차순" 을 A3:E24 로 정렬했더니 24행 '합계 / 평균' 이 값이 제일 커서
헤더 바로 밑(맨 위)으로 올라왔다. 수정: 범위 끝의 합계/평균/소계/빈 행은 자동 제외(exclude_summary_rows=True),
섞어 정렬하려면 False.

진짜 Excel 로 실제 PythonComSkillContext.sort 를 돌려 되읽어 검증.
실행: python test_runs/_test_sort_pins_summary_rows_com.py   (B2B_ver 루트에서, Excel 필요)"""
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


def setgrid(ws, grid, r0=1, c0=1):
    for dr, row in enumerate(grid):
        for dc, v in enumerate(row):
            if v is not None and v != "":
                ws.Cells(r0 + dr, c0 + dc).Value = v


def col(ws, c, r0, r1):
    return [ws.Cells(r, c).Value for r in range(r0, r1 + 1)]


app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
try:
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "회사별요약"
    # 교안과 같은 구조: 3행 헤더, 4~6행 데이터, 7행 합계(마진이 가장 큼)
    setgrid(ws, [
        ["회사명", "매출", "원가", "마진"],      # 3
        ["ABC통신", 100, 60, 40],               # 4
        ["글로벌", 300, 100, 200],              # 5
        ["스마트", 200, 150, 50],               # 6
        ["합계 / 평균", 600, 310, 290],          # 7  ← 정렬에 섞이면 맨 위로 올라간다
    ], r0=3)
    ctx = S.PythonComSkillContext(app, wb, {})

    print("[1] 기본 — 합계 행을 범위에 포함해도 그 자리에 남고 데이터만 내림차순")
    ctx.sort("회사별요약", "A3:D7", key_col="마진", ascending=False, has_header=True)
    names = col(ws, 1, 4, 7)
    check("데이터 3행이 마진 내림차순(글로벌 200 → 스마트 50 → ABC 40)",
          names[:3] == ["글로벌", "스마트", "ABC통신"], names)
    check("합계 행은 7행 그대로", names[3] == "합계 / 평균" and ws.Cells(7, 4).Value == 290, (names[3], ws.Cells(7, 4).Value))
    check("헤더는 3행 그대로", ws.Cells(3, 1).Value == "회사명")
    check("구조 기록(summary_rows_pinned:1)", any("summary_rows_pinned:1" in x for x in ctx._shared.get("structural", [])),
          ctx._shared.get("structural"))

    print("[2] 합계 행 위에 빈 행이 있어도(빈 행 + 합계) 둘 다 고정")
    ws.Cells(8, 1).Value = "합계"
    ws.Cells(8, 4).Value = 999
    ws.Rows(7).Insert()           # 7행을 빈 행으로 만들어 [6]데이터 / [7]빈 / [8]합계/평균 / [9]합계
    ctx.sort("회사별요약", "A3:D9", key_col="D", ascending=True, has_header=True)
    check("오름차순 데이터: ABC 40 → 스마트 50 → 글로벌 200", col(ws, 1, 4, 6) == ["ABC통신", "스마트", "글로벌"], col(ws, 1, 4, 6))
    check("빈 행·합계 행 2개 모두 아래에 그대로",
          ws.Cells(7, 1).Value is None and ws.Cells(8, 1).Value == "합계 / 평균" and ws.Cells(9, 1).Value == "합계",
          col(ws, 1, 7, 9))

    print("[3] exclude_summary_rows=False — 예전처럼 전체 범위 정렬(합계가 위로 감)")
    ctx.sort("회사별요약", "A3:D6", key_col="D", ascending=False, has_header=True)   # 먼저 데이터만 원복
    wb2 = app.Workbooks.Add(); w2 = wb2.Worksheets(1); w2.Name = "S"
    setgrid(w2, [["이름", "값"], ["a", 1], ["b", 2], ["합계", 3]])
    ctx2 = S.PythonComSkillContext(app, wb2, {})
    ctx2.sort("S", "A1:B4", key_col="B", ascending=False, has_header=True, exclude_summary_rows=False)
    check("False 면 합계가 맨 위로(옛 동작 재현)", w2.Cells(2, 1).Value == "합계", col(w2, 1, 2, 4))

    print("[4] 요약 행이 없는 일반 표는 동작 동일")
    wb3 = app.Workbooks.Add(); w3 = wb3.Worksheets(1); w3.Name = "T"
    setgrid(w3, [["이름", "값"], ["a", 1], ["b", 3], ["c", 2]])
    ctx3 = S.PythonComSkillContext(app, wb3, {})
    ctx3.sort("T", "A1:B4", key_col="B", ascending=False, has_header=True)
    check("b 3 → c 2 → a 1", col(w3, 1, 2, 4) == ["b", "c", "a"], col(w3, 1, 2, 4))
    check("구조 기록 없음(고정할 요약 행 없음)", not any("summary_rows_pinned" in x for x in ctx3._shared.get("structural", [])))
finally:
    for b in list(app.Workbooks):
        try: b.Close(False)
        except Exception: pass
    app.Quit()
    pythoncom.CoUninitialize()

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL - %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)
