# -*- coding: utf-8 -*-
"""[match_fill 실측 COM] 진짜 Excel 로 실제 PythonComSkillContext.match_fill 을 LLM 의 실패 호출 그대로
실행하고 채워진 셀을 되읽어 검증(추측 금지). 실측: output_02월 검증파일 (2026-07-31).
소스 피벗(input!MVNO상품명별요약) → 대상 멀티블록 시트(헤더 4행, 결합행 '올인원+올인원2.0', 총계 '계') 에
rows='A5:E11'(문자열)·key=('A','A')·느슨한 소스열('수납금액 합계'≈수납금액_sum) 로 채운다.
실행: python test_runs/_test_match_fill_com.py   (B2B_ver 루트에서, Excel 필요)"""
import os, sys, tempfile, shutil
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import pythoncom, win32com.client as w
pythoncom.CoInitialize()
import serve_b2b as S

TMP = tempfile.mkdtemp(prefix="mf_com_")
SRC_PATH = os.path.join(TMP, "input_202602_SS001643_ENTR_BY_STACC_001.xlsx")
TGT_PATH = os.path.join(TMP, "output_02월 검증파일.xlsx")
xlOpenXMLWorkbook = 51
fails = []

def setgrid(ws, grid, r0=1, c0=1):
    for dr, row in enumerate(grid):
        for dc, v in enumerate(row):
            if v is not None and v != "":
                ws.Cells(r0 + dr, c0 + dc).Value = v

app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
try:
    swb = app.Workbooks.Add()
    sws = swb.Worksheets(1); sws.Name = "MVNO상품명별요약"
    # 실제 피벗 모양: A1 은 group_by 이름이 아니라 '행 레이블'(Row Labels) — key=("MVNO상품명",..) 가
    # B열 'MVNO상품명_count'(숫자 집계열)에 부분매칭해 전부 미매칭되던 실측 버그를 재현한다.
    setgrid(sws, [
        ["행 레이블", "MVNO상품명_count", "수납금액_sum", "가입자당단가_도매대가_sum"],
        ["안전제일(망개통용)", 10, 1000, 100],
        ["안전제일", 20, 2000, 200],
        ["인포콘 올인원", 30, 3000, 300],
        ["인포콘 올인원 2.0", 40, 4000, 400],
        ["KGM FOTA", 50, 5000, 500],
        ["인포콘 프리미엄", 60, 6000, 600],
        ["우리로", 70, 7000, 700],
    ])
    swb.SaveAs(SRC_PATH, FileFormat=xlOpenXMLWorkbook)

    twb = app.Workbooks.Add()
    tws = twb.Worksheets(1); tws.Name = "올인원_중고차_CCU중복건 제거_토레스무상제공 등 요약"
    tws.Cells(1, 1).Value = "■ 2026년 02월 KG모빌리티 MVNO 정산금액"
    H4 = ["구분", "건수", "고객납부금액(수남급액)", "청구금액(세금계산서)", "실제정산금액", "",
          "구분", "건수", "고객납부금액(수남급액)", "청구금액(세금계산서)", "실제정산금액"]
    setgrid(tws, [H4], r0=4)
    setgrid(tws, [["안전제일_망개통용"], ["안전제일"], ["올인원+올인원2.0"], ["FOTA"], ["프리미엄"], ["우리로"], ["계"]], r0=5)
    twb.SaveAs(TGT_PATH, FileFormat=xlOpenXMLWorkbook)

    ctx = S.PythonComSkillContext(app, twb, {})
    res = ctx.match_fill(
        "input_202602_SS001643_ENTR_BY_STACC_001.xlsx!MVNO상품명별요약",
        "올인원_중고차_CCU중복건 제거_토레스무상제공 등 요약",
        {"count": "건수", "수납금액 합계": "고객납부금액", "가입자당단가_도매대가 합계": "청구금액"},
        key=("A", "A"), source_header_row=1, header_row=4, rows="A5:E11",
    )
    print("match_fill 반환:", res)

    def cell(r, c):
        v = tws.Cells(r, c).Value
        return None if v is None else (int(v) if isinstance(v, float) and v == int(v) else v)

    print("행  구분            B(건수) C(고객납부) D(청구)")
    for r in range(5, 12):
        print(" %2d %-14s %-7s %-9s %-7s" % (r, tws.Cells(r, 1).Value, cell(r, 2), cell(r, 3), cell(r, 4)))

    EXPECT = {5: (10, 1000, 100), 6: (20, 2000, 200), 7: (70, 7000, 700),
              8: (50, 5000, 500), 9: (60, 6000, 600), 10: (70, 7000, 700)}
    for r, (b, c, d) in EXPECT.items():
        got = (cell(r, 2), cell(r, 3), cell(r, 4))
        if got != (b, c, d):
            fails.append("row %d: got %r expect %r" % (r, got, (b, c, d)))
    if cell(11, 2) is not None:
        fails.append("계(11행) 스킵 실패: %r" % (cell(11, 2),))
    if cell(5, 5) is not None:
        fails.append("E열(미매핑) 건드림: %r" % (cell(5, 5),))
    if res.get("matched") != 6 or res.get("unmatched"):
        fails.append("반환 이상: %r" % (res,))

    # ── 두 번째 호출 형태(실측 마지막 라운드): rows='5:11' + key=("MVNO상품명","구분") + 정확 대상헤더 ──
    tws.Range("B5:D11").ClearContents()
    res2 = ctx.match_fill(
        "input_202602_SS001643_ENTR_BY_STACC_001.xlsx!MVNO상품명별요약",
        "올인원_중고차_CCU중복건 제거_토레스무상제공 등 요약",
        {"MVNO상품명_count": "건수", "수납금액_sum": "고객납부금액(수남급액)", "가입자당단가_도매대가_sum": "청구금액(세금계산서)"},
        key=("MVNO상품명", "구분"), source_header_row=1, header_row=4, rows="5:11",
    )
    for r, (b, c, d) in EXPECT.items():
        got = (cell(r, 2), cell(r, 3), cell(r, 4))
        if got != (b, c, d):
            fails.append("[호출2] row %d: got %r expect %r" % (r, got, (b, c, d)))
    if res2.get("matched") != 6 or res2.get("unmatched"):
        fails.append("[호출2] 반환 이상: %r" % (res2,))
finally:
    try:
        twb.Close(SaveChanges=False)
    except Exception:
        pass
    try:
        swb.Close(SaveChanges=False)
    except Exception:
        pass
    try:
        app.Quit()
    except Exception:
        pass
    pythoncom.CoUninitialize()
    shutil.rmtree(TMP, ignore_errors=True)

print(("\nPASS 실측 COM: match_fill 8행 표 정확 채움(결합행 합산·계 스킵·느슨한 인자)"
       if not fails else "\nFAIL 실측 COM: " + "; ".join(fails)))
sys.exit(0 if not fails else 1)
