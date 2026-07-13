# [실측] ctx.native_pivot: 엑셀 '진짜 피벗테이블(PivotTable 개체)' 생성 — 원본 연결·새로고침 되는 살아있는 피벗.
# 다중 키(행 필드 여러 개) + 다중 값(데이터 필드 여러 개) + 개수/크로스탭/새로고침 검증. 값은 GetPivotData 로 확인
# (DataBodyRange 는 소계·총합을 포함하므로 단순 합산으로 검증하면 안 됨).
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.0")
import win32com.client as w
import serve_b2b as S

C = S.PythonComSkillContext
app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
fails = 0
def ck(name, cond, got=None):
    global fails
    print((" OK  " if cond else "FAIL ") + name + ("" if cond else " got=" + repr(got)))
    if not cond: fails += 1

class Ctx(C):
    def __init__(s, wb, app): s._wb = wb; s._app = app; s._shared = {"structural": [], "deadline": float("inf")}
    def _tick(s, n=1): pass

try:
    wb = app.Workbooks.Add(); ws = wb.Worksheets(1); ws.Name = "매출"
    ws.Range("A1").Value = "회사"; ws.Range("B1").Value = "지점"; ws.Range("C1").Value = "금액"; ws.Range("D1").Value = "건수"
    for i, (co, br, amt, cnt) in enumerate([("A", "서울", 100, 1), ("A", "부산", 200, 1), ("B", "서울", 50, 1), ("A", "서울", 300, 1)], 2):
        ws.Cells(i, 1).Value = co; ws.Cells(i, 2).Value = br; ws.Cells(i, 3).Value = amt; ws.Cells(i, 4).Value = cnt
    f = Ctx(wb, app)

    # ── 단일 키/값 + 새로고침 ──
    f.native_pivot("매출", group_by="회사", value="금액", agg="sum", dest_name="P1")
    pt1 = wb.Worksheets("P1").PivotTables(1)
    ck("(1) 진짜 PivotTable 개체 생성", int(wb.Worksheets("P1").PivotTables().Count) >= 1)
    ck("(2) 회사 A 금액합=600", pt1.GetPivotData("금액", "회사", "A").Value == 600, pt1.GetPivotData("금액", "회사", "A").Value)
    ws.Cells(2, 3).Value = 500  # A 한 값 100->500 (A합 600->1000)
    pt1.RefreshTable()
    ck("(3) 새로고침 반영 A합=1000", pt1.GetPivotData("금액", "회사", "A").Value == 1000, pt1.GetPivotData("금액", "회사", "A").Value)
    ws.Cells(2, 3).Value = 100  # 원복

    # ── 다중 키(회사·지점) + 다중 값(금액 sum, 건수 count) ──
    f.native_pivot("매출", group_by=["회사", "지점"], value=["금액", "건수"], agg=["sum", "count"], dest_name="P2")
    pt2 = wb.Worksheets("P2").PivotTables(1)
    ck("(4) 다중 키: 행 필드 2개", int(pt2.RowFields.Count) == 2, pt2.RowFields.Count)
    ck("(5) 다중 값: 데이터 필드 2개", int(pt2.DataFields.Count) == 2, pt2.DataFields.Count)
    ck("(6) A/서울 금액 sum=400", pt2.GetPivotData("금액", "회사", "A", "지점", "서울").Value == 400, pt2.GetPivotData("금액", "회사", "A", "지점", "서울").Value)
    ck("(7) A/서울 건수 count=2", pt2.GetPivotData("건수", "회사", "A", "지점", "서울").Value == 2, pt2.GetPivotData("건수", "회사", "A", "지점", "서울").Value)
    ck("(8) B/서울 금액 sum=50", pt2.GetPivotData("금액", "회사", "B", "지점", "서울").Value == 50)

    # ── agg 하나만 줘도 모든 값에 적용 ──
    f.native_pivot("매출", group_by="회사", value=["금액", "건수"], agg="sum", dest_name="P3")
    pt3 = wb.Worksheets("P3").PivotTables(1)
    ck("(9) agg 하나→모든 값 적용, 데이터필드 2개", int(pt3.DataFields.Count) == 2, pt3.DataFields.Count)
    ck("(10) 회사 A 건수 sum=3", pt3.GetPivotData("건수", "회사", "A").Value == 3, pt3.GetPivotData("건수", "회사", "A").Value)

    # ── 개수(value=None) + 크로스탭(column) ──
    f.native_pivot("매출", group_by="회사", value=None, agg="count", dest_name="P4")
    ck("(11) 개수 피벗 생성(데이터필드 1)", int(wb.Worksheets("P4").PivotTables(1).DataFields.Count) == 1)
    f.native_pivot("매출", group_by="회사", column="지점", value="금액", agg="sum", dest_name="P5")
    ck("(12) 크로스탭: 열 필드 1개", int(wb.Worksheets("P5").PivotTables(1).ColumnFields.Count) == 1, wb.Worksheets("P5").PivotTables(1).ColumnFields.Count)
finally:
    try: app.Quit()
    except Exception: pass

print("\n=== RESULT: " + ("ALL PASS" if fails == 0 else str(fails) + " FAIL") + " ===")
sys.exit(1 if fails else 0)
