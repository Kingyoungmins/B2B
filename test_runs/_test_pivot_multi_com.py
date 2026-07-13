# [실측] 값-표 피벗(_pivot_value_table, = ctx.pivot 의 native 실패 시 폴백)의 다중키·다중값 표를 검증.
# (ctx.pivot 은 이제 기본이 진짜 피벗테이블이라, 값-표 레이아웃은 폴백 메서드로 직접 테스트.)
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.0")
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
try:
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "매출"
    rows = [
        ["회사", "지점", "매출", "건수"],
        ["A", "서울", 100, 3],
        ["A", "서울", 50, 2],
        ["A", "부산", 30, 1],
        ["B", "서울", 200, 5],
        ["B", "부산", 70, 4],
    ]
    for r, row in enumerate(rows, 1):
        for c, v in enumerate(row, 1):
            ws.Cells(r, c).Value = v
    ctx = S.PythonComSkillContext(app, wb, {})

    # 다중키(회사,지점) × 다중값(매출 sum, 건수 count)
    name = ctx._pivot_value_table("매출", group_by=["회사", "지점"], value=["매출", "건수"], agg=["sum", "count"], dest_name="요약")
    ck("pivot 반환 시트명", name == "요약", name)
    out = ctx.read("요약")
    hdr = [str(x) for x in out[0]]
    ck("헤더 = [회사, 지점, 매출_sum, 건수_count]", hdr == ["회사", "지점", "매출_sum", "건수_count"], hdr)
    # 본문을 dict 로
    body = {(str(r[0]), str(r[1])): (r[2], r[3]) for r in out[1:]}
    ck("A/서울 = 매출 150, 건수 2행", body.get(("A", "서울")) == (150, 2), body.get(("A", "서울")))
    ck("A/부산 = 매출 30, 건수 1행", body.get(("A", "부산")) == (30, 1), body.get(("A", "부산")))
    ck("B/서울 = 매출 200, 건수 1행", body.get(("B", "서울")) == (200, 1), body.get(("B", "서울")))
    ck("B/부산 = 매출 70, 건수 1행", body.get(("B", "부산")) == (70, 1), body.get(("B", "부산")))
    ck("그룹 4개(회사×지점 조합)", len(out) - 1 == 4, len(out) - 1)

    # 단일키 다중값도 확인
    name2 = ctx._pivot_value_table("매출", group_by="회사", value=["매출", "건수"], agg=["sum", "sum"], dest_name="요약2")
    out2 = ctx.read("요약2")
    b2 = {str(r[0]): (r[1], r[2]) for r in out2[1:]}
    ck("단일키: A = 매출 180, 건수 6", b2.get("A") == (180, 6), b2.get("A"))
    ck("단일키: B = 매출 270, 건수 9", b2.get("B") == (270, 9), b2.get("B"))

    wb.Close(False)
finally:
    app.Quit()
print(f"\n=== RESULT: {'ALL PASS' if fails==0 else str(fails)+' FAIL'} ===")
sys.exit(1 if fails else 0)
