# [실측] ctx.pivot 기본 동작: 진짜 피벗테이블 우선, native 실패 시 값-표 폴백 (실제 Excel COM).
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.5.19")
import win32com.client as w
import serve_b2b as S

C = S.PythonComSkillContext
app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
fails = 0
def ck(n, c, g=None):
    global fails
    print((" OK  " if c else "FAIL ") + n + ("" if c else " got=" + repr(g)))
    if not c: fails += 1

class Ctx(C):
    def __init__(s, wb, app): s._wb = wb; s._app = app; s._shared = {"structural": [], "deadline": float("inf")}
    def _tick(s, n=1): pass

class CtxFail(Ctx):
    def native_pivot(s, *a, **k): raise RuntimeError("forced native fail")

def setup():
    wb = app.Workbooks.Add(); ws = wb.Worksheets(1); ws.Name = "매출"
    ws.Range("A1").Value = "회사"; ws.Range("B1").Value = "금액"
    for i, (co, amt) in enumerate([("A", 100), ("A", 200), ("B", 50), ("A", 300)], 2):
        ws.Cells(i, 1).Value = co; ws.Cells(i, 2).Value = amt
    return wb, ws

try:
    # (1) 기본: ctx.pivot -> 진짜 PivotTable
    wb, ws = setup(); f = Ctx(wb, app)
    ck("(1) 기본 pivot 시트 생성", f.pivot("매출", group_by="회사", value="금액", agg="sum", dest_name="P") == "P")
    ck("(2) 기본 pivot = 진짜 PivotTable 개체", int(wb.Worksheets("P").PivotTables().Count) >= 1, wb.Worksheets("P").PivotTables().Count)
    ck("(3) 값 정확(GetPivotData 회사A=600)", wb.Worksheets("P").PivotTables(1).GetPivotData("금액", "회사", "A").Value == 600)
    wb.Close(False)
    # (2) native 실패 -> 값-표 폴백
    wb2, ws2 = setup(); ff = CtxFail(wb2, app)
    ck("(4) 폴백 시트 생성", ff.pivot("매출", group_by="회사", value="금액", agg="sum", dest_name="PV") == "PV")
    pv = wb2.Worksheets("PV")
    ck("(5) 폴백은 PivotTable 개체 아님(값 표)", int(pv.PivotTables().Count) == 0, pv.PivotTables().Count)
    d = {str(pv.Cells(r, 1).Value): pv.Cells(r, 2).Value for r in (2, 3)}
    ck("(6) 폴백 값-표 값 정확(A=600,B=50)", d.get("A") == 600 and d.get("B") == 50, d)
    ck("(7) 폴백 시트 정확히 1개(부분시트 정리로 중복 없음)", sum(1 for x in wb2.Worksheets if x.Name == "PV") == 1)
    wb2.Close(False)
finally:
    try: app.Quit()
    except Exception: pass

print("\n=== RESULT: " + ("ALL PASS" if fails == 0 else str(fails) + " FAIL") + " ===")
sys.exit(1 if fails else 0)
