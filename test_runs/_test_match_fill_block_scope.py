# -*- coding: utf-8 -*-
"""[match_fill 블록 경계 실측 COM] 같은 표가 아래로 반복되는 시트(월별 요약)에서 기본은 '이 표까지만'.

실측(2026-09-08, cloudpc_spark32 15:46 세션 + 보안해제 검증파일): 대상 Sheet1 에 '구분' 헤더 블록이
8번 반복(행 4,28,44,...) — match_fill 이 끝행까지 스캔해 58행을 채웠고(의도 ~7행), 다른 달 블록의
같은 상품명 값이 전부 덮였다. rows=7 재시도도 '7행부터 끝까지'로 해석돼 소용없었다.
수정: 기본 scope="block" — 키열에 대상 헤더 라벨('구분')이 다시 나오면 그 앞에서 멈춤.
      scope="all" = 예전 전체 스캔. 끝을 명시한 rows=(s,e) 는 그대로 존중.

진짜 Excel 로 실제 PythonComSkillContext.match_fill 을 돌려 되읽어 검증(추측 금지).
실행: python test_runs/_test_match_fill_block_scope.py   (B2B_ver 루트에서, Excel 필요)"""
import os, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import pythoncom, win32com.client as w
pythoncom.CoInitialize()
import serve_b2b as S

TMP = tempfile.mkdtemp(prefix="mf_block_")
TGT_PATH = os.path.join(TMP, "검증파일.xlsx")
xlOpenXMLWorkbook = 51
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


app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
try:
    wb = app.Workbooks.Add()
    src = wb.Worksheets(1); src.Name = "MVNO상품명별집계"
    setgrid(src, [
        ["행 레이블", "MVNO상품명_count", "수납금액_sum"],
        ["안전제일", 20, 2000],
        ["올인원", 30, 3000],
        ["FOTA", 40, 4000],
    ])
    tgt = wb.Worksheets.Add(); tgt.Name = "Sheet1"
    # 실측 파일과 같은 구조: 4행 헤더 블록(이번 달) + 10행에 같은 헤더 블록(지난달, 옛 값 보존돼야 함)
    setgrid(tgt, [
        ["3월"],                                             # 1
        [], [],
        ["구분", "건수", "고객납부금액(수남급액)"],            # 4  ← 이번 달 블록 헤더
        ["안전제일", None, None],                             # 5
        ["올인원", None, None],                               # 6
        ["FOTA", None, None],                                 # 7
        ["계", None, None],                                   # 8
        [],
        ["구분", "건수", "고객납부금액(수남급액)"],            # 10 ← 지난달 블록(같은 이름)
        ["안전제일", 11, 1100],                               # 11
        ["올인원", 12, 1200],                                 # 12
        ["FOTA", 13, 1300],                                   # 13
    ])
    wb.SaveAs(TGT_PATH, FileFormat=xlOpenXMLWorkbook)

    ctx = S.PythonComSkillContext(app, wb, {})

    print("[1] 기본(scope='block') — 이번 달 블록만 채우고, 지난달 블록은 안 건드린다")
    r = ctx.match_fill("MVNO상품명별집계", "Sheet1",
                       {"MVNO상품명_count": "건수", "수납금액_sum": "고객납부금액(수남급액)"},
                       key=("A", "A"), source_header_row=1, header_row=4, allow_partial=True)
    check("매칭 3행(안전제일/올인원/FOTA)과 범위가 블록 안", r["matched"] == 3 and r["rows"][1] <= 9, r)
    check("이번 달 블록 채워짐(B5=20, C7=4000)",
          tgt.Cells(5, 2).Value == 20 and tgt.Cells(7, 3).Value == 4000,
          (tgt.Cells(5, 2).Value, tgt.Cells(7, 3).Value))
    check("지난달 블록 보존(B11=11, C13=1300 그대로)",
          tgt.Cells(11, 2).Value == 11 and tgt.Cells(13, 3).Value == 1300,
          (tgt.Cells(11, 2).Value, tgt.Cells(13, 3).Value))
    check("합계 행('계')은 안 건드림", tgt.Cells(8, 2).Value is None, tgt.Cells(8, 2).Value)

    print("[2] scope='all' — 예전 동작(모든 블록의 같은 이름 전부)")
    r = ctx.match_fill("MVNO상품명별집계", "Sheet1",
                       {"MVNO상품명_count": "건수"}, key=("A", "A"),
                       source_header_row=1, header_row=4, allow_partial=True, scope="all")
    check("매칭 6행(두 블록 다)", r["matched"] == 6, r)
    check("지난달 블록도 덮임(B11=20)", tgt.Cells(11, 2).Value == 20, tgt.Cells(11, 2).Value)

    print("[3] 끝을 명시한 rows 는 scope 와 무관하게 그대로")
    tgt.Cells(12, 3).Value = 9999   # 지난달 올인원 금액
    r = ctx.match_fill("MVNO상품명별집계", "Sheet1",
                       {"수납금액_sum": "고객납부금액(수남급액)"}, key=("A", "A"),
                       source_header_row=1, header_row=4, rows=(11, 13), allow_partial=True)
    check("명시 범위(11~13)만 채움 — C12=3000 로 갱신", r["matched"] == 3 and tgt.Cells(12, 3).Value == 3000,
          (r, tgt.Cells(12, 3).Value))
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
