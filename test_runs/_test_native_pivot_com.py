# [실측] ctx.native_pivot: 엑셀 '진짜 피벗테이블(PivotTable 개체)' 생성 — 원본 연결·새로고침 되는 살아있는 피벗.
# 다중 키(행 필드 여러 개) + 다중 값(데이터 필드 여러 개) + 개수/크로스탭/새로고침 검증. 값은 GetPivotData 로 확인
# (DataBodyRange 는 소계·총합을 포함하므로 단순 합산으로 검증하면 안 됨).
import sys, os
# [수정] 예전엔 0.6.1 경로가 하드코딩돼 정작 이 버전 serve_b2b 를 테스트하지 않았음.
# 이 파일이 사는 리포(= test_runs 의 부모)의 serve_b2b 를 import 한다.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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
    pt4 = wb.Worksheets("P4").PivotTables(1)
    ck("(11) 개수 피벗 생성(데이터필드 1)", int(pt4.DataFields.Count) == 1)
    # [이슈 47] value=None 개수도 group_by 필드를 count 로 옮겨 행이 붕괴하면 안 됨(행 필드 유지)
    ck("(11b) 개수 피벗도 행 필드 유지(회사 행 1개)", int(pt4.RowFields.Count) == 1, pt4.RowFields.Count)
    f.native_pivot("매출", group_by="회사", column="지점", value="금액", agg="sum", dest_name="P5")
    ck("(12) 크로스탭: 열 필드 1개", int(wb.Worksheets("P5").PivotTables(1).ColumnFields.Count) == 1, wb.Worksheets("P5").PivotTables(1).ColumnFields.Count)

    # ── [이슈 47] 행 필드를 값(개수)에도 넣어도 행 그룹이 유지된다 (붕괴 회귀 방지) ──
    # 수정 전: AddDataField(회사, count) 가 회사를 행→값으로 옮겨 RowFields.Count==0 → 총합 1줄로 붕괴.
    f.native_pivot("매출", group_by="회사", value=["회사", "금액"], agg=["count", "sum"], dest_name="P6")
    pt6 = wb.Worksheets("P6").PivotTables(1)
    ck("(13) 행 필드 유지(회사 행 1개, 붕괴 아님)", int(pt6.RowFields.Count) == 1, pt6.RowFields.Count)
    ck("(14) 데이터 필드 2개(개수+합계)", int(pt6.DataFields.Count) == 2, pt6.DataFields.Count)
    ck("(15) 회사 A 금액 sum=600(상품별 집계 유지)", pt6.GetPivotData("금액", "회사", "A").Value == 600, pt6.GetPivotData("금액", "회사", "A").Value)
finally:
    try: app.Quit()
    except Exception: pass

print("\n=== RESULT: " + ("ALL PASS" if fails == 0 else str(fails) + " FAIL") + " ===")
sys.exit(1 if fails else 0)
