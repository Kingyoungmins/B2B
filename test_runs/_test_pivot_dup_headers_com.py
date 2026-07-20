# [실측] 중복 헤더 다중키 피벗 — '상품명'이 두 열(B,C)일 때 엑셀처럼 2번째를 '상품명2'로 보고 다중 피벗.
# ctx.pivot(native) + _pivot_value_table(값-표 폴백) 둘 다, '상품명2'/열문자 지목 모두 검증.
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.2")
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

def setup():
    wb = app.Workbooks.Add(); ws = wb.Worksheets(1); ws.Name = "d"
    for j, h in enumerate(["지점", "상품명", "상품명", "금액"], 1):
        ws.Cells(1, j).Value = h   # B,C 가 같은 '상품명'
    for i, r in enumerate([("서울", "가전", "TV", 100), ("서울", "가전", "냉장고", 200), ("부산", "의류", "셔츠", 50), ("서울", "가전", "TV", 300)], 2):
        for j, v in enumerate(r, 1):
            ws.Cells(i, j).Value = v
    return wb, ws

try:
    # native(기본 ctx.pivot)
    wb, ws = setup(); f = Ctx(wb, app)
    f.pivot("d", group_by=["상품명", "상품명2"], value="금액", agg="sum", dest_name="P1")
    pt = wb.Worksheets("P1").PivotTables(1)
    ck("(1) native: 중복헤더 다중키 → 행 필드 2개", int(pt.RowFields.Count) == 2, pt.RowFields.Count)
    ck("(2) native: 가전/TV 금액합=400", pt.GetPivotData("금액", "상품명", "가전", "상품명2", "TV").Value == 400, pt.GetPivotData("금액", "상품명", "가전", "상품명2", "TV").Value)
    f.pivot("d", group_by=["B", "C"], value="금액", agg="sum", dest_name="P2")
    ck("(3) native: 열문자 B,C 다중키 → 행 필드 2개", int(wb.Worksheets("P2").PivotTables(1).RowFields.Count) == 2)
    wb.Close(False)

    # 값-표 폴백
    wb2, ws2 = setup(); f2 = Ctx(wb2, app)
    f2._pivot_value_table("d", group_by=["상품명", "상품명2"], value="금액", agg="sum", dest_name="V")
    v = wb2.Worksheets("V")
    hdr = [v.Cells(1, c).Value for c in (1, 2, 3)]
    ck("(4) 값-표: 헤더 [상품명, 상품명2, 금액_sum]", hdr[0] == "상품명" and hdr[1] == "상품명2" and str(hdr[2]).startswith("금액_sum"), hdr)
    rowmap = {}
    r = 2
    while v.Cells(r, 1).Value not in (None, ""):
        rowmap[(v.Cells(r, 1).Value, v.Cells(r, 2).Value)] = v.Cells(r, 3).Value
        r += 1
    ck("(5) 값-표: (가전,TV)=400", rowmap.get(("가전", "TV")) == 400, rowmap)
    ck("(6) 값-표: (가전,냉장고)=200", rowmap.get(("가전", "냉장고")) == 200, rowmap)
    wb2.Close(False)
finally:
    try: app.Quit()
    except Exception: pass

print("\n=== RESULT: " + ("ALL PASS" if fails == 0 else str(fails) + " FAIL") + " ===")
sys.exit(1 if fails else 0)
