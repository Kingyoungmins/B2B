# -*- coding: utf-8 -*-
# [라이브/회귀] 백그라운드 전체실행에서 VBA 가 '그룹 대상이 아닌 다른 파일'을 Workbooks("…")로 참조할 때,
# 그 파일이 동반 워크북으로 격리 인스턴스에 열려 해석되는지. (구 per-group 은 다른 라이브 세션을 전부 동반본으로
# 열었는데, 백그라운드 함수가 open_ids 만 열어 누락 → "워크북이 열려 있지 않습니다" 크래시났던 버그 재현/검증.)
#  - 세션 A="main.xlsx", B="other.xlsx"
#  - groups=[{excelId:B, steps:[VBA: Workbooks("main.xlsx") 에 값 쓰기]}], resetExcelIds=[B]  (A 는 미포함!)
#  - 기대: A 가 동반본으로 열려 VBA 가 성공, 변경된 A 가 라이브로 동기화, B(대상)는 그대로.
import sys, io, tempfile, shutil
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1")
import openpyxl
import pythoncom; pythoncom.CoInitialize()
import win32com.client as win32
import serve_b2b as S

NA, NB = "main.xlsx", "other.xlsx"
VBA = ('Sub B2BSkill()\n'
       '  Workbooks("' + NA + '").Worksheets("원본").Range("B1").Value = "cross"\n'
       'End Sub')

work = Path(tempfile.mkdtemp(prefix="b2b_companion_"))
def build(path, sheet, a1):
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = sheet; ws["A1"] = a1; wb.save(str(path))
srcA, srcB = work / NA, work / NB
build(srcA, "원본", "A데이터"); build(srcB, "데이터", "B데이터")
liveA, liveB = work / ("live_" + NA), work / ("live_" + NB)
shutil.copy2(srcA, liveA); shutil.copy2(srcB, liveB)

app = None
res = {}
try:
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    wA = app.Workbooks.Open(str(liveA)); wB = app.Workbooks.Open(str(liveB))
    S.EXCEL_SESSIONS["exA"] = {"app": app, "workbook": wA, "path": str(liveA), "openPath": str(wA.FullName),
                              "name": NA, "sourcePath": str(srcA), "liveEditable": True}
    S.EXCEL_SESSIONS["exB"] = {"app": app, "workbook": wB, "path": str(liveB), "openPath": str(wB.FullName),
                              "name": NB, "sourcePath": str(srcB), "liveEditable": True}
    # 그룹 대상 = B 뿐. VBA 는 A(main.xlsx)를 참조 → A 가 동반본으로 안 열리면 실패.
    groups = [{"excelId": "exB", "steps": [{"code": VBA, "language": "vba", "stepIdx": 0, "stepId": "s1"}]}]
    err = None
    try:
        out = S.run_full_pipeline_single_instance(groups, reset_excel_ids=["exB"])  # A 미포함!
        print("결과:", {k: out.get(k) for k in ("ok", "applied")})
    except Exception as e:
        err = repr(e)[:200]
        print("!! 예외:", err)
    res["성공(예외없음)"] = (err is None)
    lA = S.EXCEL_SESSIONS["exA"]["workbook"]; lB = S.EXCEL_SESSIONS["exB"]["workbook"]
    res["A에 교차쓰기 반영(B1=cross)"] = (lA.Worksheets("원본").Range("B1").Value == "cross")
    res["A 원본데이터 보존"] = (lA.Worksheets("원본").Range("A1").Value == "A데이터")
    res["B 보존(대상이지만 미변경)"] = (lB.Worksheets("데이터").Range("A1").Value == "B데이터")
    for sid in ("exA", "exB"):
        try: del S.EXCEL_SESSIONS[sid]
        except Exception: pass
finally:
    try:
        if app is not None: app.Quit()
    except Exception: pass
    shutil.rmtree(work, ignore_errors=True)

checks = [
    ("VBA 가 비대상 파일 참조해도 성공(동반본 오픈)", res.get("성공(예외없음)")),
    ("교차쓰기 결과 A 라이브 반영", res.get("A에 교차쓰기 반영(B1=cross)")),
    ("A 원본 데이터 보존", res.get("A 원본데이터 보존")),
    ("B 보존", res.get("B 보존(대상이지만 미변경)")),
]
fails = 0
print("\n=== 판정 ===")
for n, ok in checks:
    print((" OK  " if ok else "FAIL ") + n)
    if not ok: fails += 1
print(f"\n=== RESULT: {len(checks)-fails}/{len(checks)} PASS ===")
sys.exit(1 if fails else 0)
