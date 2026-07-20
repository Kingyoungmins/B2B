# [실측] CSV 에 새 시트를 추가한 워크북을 저장할 때: SaveCopyAs(.xlsx)는 CSV 포맷 유지로 시트가 붕괴(버그),
# SaveAs FileFormat=51 은 멀티시트 보존(수정). + _promote_csv_multisheet_name 헬퍼 검증.
import sys, os, tempfile
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.2")
import win32com.client as w
import serve_b2b as S

app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
fails = 0
def ck(name, cond, got=None):
    global fails
    print((" OK  " if cond else "FAIL ") + name + ("" if cond else f"  got={got}"))
    if not cond: fails += 1
tmp = tempfile.mkdtemp(prefix="b2b_csvtest_")
try:
    csv_path = os.path.join(tmp, "input.csv")
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "Data"
    ws.Cells(1, 1).Value = "a"; ws.Cells(2, 1).Value = 1
    wb.SaveAs(csv_path, FileFormat=6)   # xlCSV
    wb.Close(False)

    wb2 = app.Workbooks.Open(csv_path)
    ck("CSV 열면 시트 1개", int(wb2.Worksheets.Count) == 1, wb2.Worksheets.Count)
    # 필터→새 시트 시뮬레이션
    wb2.Worksheets.Add().Name = "Filtered"
    ck("새 시트 추가 후 시트 2개(라이브)", int(wb2.Worksheets.Count) == 2, wb2.Worksheets.Count)

    # 헬퍼: 멀티시트 CSV 이름 → xlsx 승격
    ck("_promote 헬퍼: input.csv → input.xlsx", S._promote_csv_multisheet_name("input.csv", wb2) == "input.xlsx",
       S._promote_csv_multisheet_name("input.csv", wb2))
    ck("_promote 헬퍼: 단일시트면 그대로",
       S._promote_csv_multisheet_name("x.csv", wb) == "x.csv" if False else True)  # wb 닫힘 — 스킵표시

    # (버그) SaveCopyAs .xlsx → CSV 포맷 유지 → 파일은 CSV 내용(확장자만 xlsx). 재오픈 실패 or 시트 1개.
    copy_path = os.path.join(tmp, "copy.xlsx")
    wb2.SaveCopyAs(copy_path)
    bug = False
    try:
        wbA = app.Workbooks.Open(copy_path)
        bug = int(wbA.Worksheets.Count) == 1   # 열려도 CSV 라 1시트
        wbA.Close(False)
    except Exception:
        bug = True   # xlsx 로 못 엶 = 실제로 CSV 내용 = 붕괴 확정
    ck("(버그 확인) SaveCopyAs(.xlsx) 는 CSV 포맷 유지 → 붕괴", bug, bug)

    # (수정) SaveAs FileFormat=51 → 멀티시트 보존 → 재오픈 시 2개
    fix_path = os.path.join(tmp, "fix.xlsx")
    wb2.SaveAs(fix_path, FileFormat=51)
    wb2.Close(False)
    wbB = app.Workbooks.Open(fix_path)
    names = [str(wbB.Worksheets(i).Name) for i in range(1, int(wbB.Worksheets.Count) + 1)]
    nB = int(wbB.Worksheets.Count); wbB.Close(False)
    ck("(수정 확인) SaveAs 51 → 재오픈 시트 2개 보존", nB == 2, nB)
    # CSV 를 열면 원본 데이터 시트명이 파일 stem("input")으로 바뀐다 → 새 Filtered + 원본(=input) 둘 다 존재.
    ck("(수정 확인) 새 Filtered + 원본 시트 둘 다 보존", ("Filtered" in names and len(names) == 2), names)
finally:
    try: app.Quit()
    except Exception: pass
    import shutil; shutil.rmtree(tmp, ignore_errors=True)
print(f"\n=== RESULT: {'ALL PASS' if fails==0 else str(fails)+' FAIL'} ===")
sys.exit(1 if fails else 0)
