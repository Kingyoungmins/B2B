# [실측] ctx.pivot 계약: '항상 진짜 피벗테이블'. 값-표로 조용히 폴백하지 않는다(실제 Excel COM).
# 배경: 예전엔 native 실패 시 값-표로 폴백해, 같은 명령인데 1회차는 진짜 피벗·2회차부터 값-표가
#       나왔다(dest 시트 잔존 → native 가 "이미 있습니다"로 실패 → 폴백). 사용자 제보로 폴백 제거.
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
    def __init__(s, wb, app): s._wb = wb; s._app = app; s._session = None; s._shared = {"structural": [], "deadline": float("inf"), "books": {}, "journal": []}
    def _tick(s, n=1): pass

class CtxFail(Ctx):
    def native_pivot(s, *a, **k): raise RuntimeError("forced native fail")

def setup():
    wb = app.Workbooks.Add(); ws = wb.Worksheets(1); ws.Name = "매출"
    ws.Range("A1").Value = "회사"; ws.Range("B1").Value = "금액"
    for i, (co, amt) in enumerate([("A", 100), ("A", 200), ("B", 50), ("A", 300)], 2):
        ws.Cells(i, 1).Value = co; ws.Cells(i, 2).Value = amt
    return wb, ws

def is_native(wb, name):
    return int(wb.Worksheets(name).PivotTables().Count) >= 1

try:
    # (1) 기본: ctx.pivot -> 진짜 PivotTable
    wb, ws = setup(); f = Ctx(wb, app)
    ck("(1) 기본 pivot 시트 생성", f.pivot("매출", group_by="회사", value="금액", agg="sum", dest_name="P") == "P")
    ck("(2) 기본 pivot = 진짜 PivotTable 개체", is_native(wb, "P"), wb.Worksheets("P").PivotTables().Count)
    ck("(3) 값 정확(GetPivotData 회사A=600)", wb.Worksheets("P").PivotTables(1).GetPivotData("금액", "회사", "A").Value == 600)

    # (4~6) [회귀 방지 핵심] 같은 명령 재실행 — 매번 '진짜 피벗'이어야 한다(예전엔 2회차부터 값-표)
    for n in (2, 3):
        f.pivot("매출", group_by="회사", value="금액", agg="sum", dest_name="P")
        ck("(%d) 재실행 %d회차도 진짜 피벗" % (2 + n, n), is_native(wb, "P"), "값-표로 강등됨")
    ck("(6) 재실행해도 피벗 시트 1개(중복 생성 없음)", sum(1 for x in wb.Worksheets if x.Name == "P") == 1)
    wb.Close(False)

    # (7~8) native 가 진짜로 실패하면: 값-표로 조용히 폴백하지 말고 원인을 말하는 오류
    wb2, ws2 = setup(); ff = CtxFail(wb2, app)
    try:
        ff.pivot("매출", group_by="회사", value="금액", agg="sum", dest_name="PV")
        ck("(7) native 실패 시 오류로 끝남(값-표 폴백 금지)", False, "폴백해서 성공 반환함")
    except S.PythonComSkillError as e:
        ck("(7) native 실패 시 오류로 끝남(값-표 폴백 금지)", "피벗테이블 생성 실패" in str(e), str(e)[:80])
    ck("(8) 실패 시 가짜 값-표 시트를 남기지 않음",
       not any(x.Name == "PV" for x in wb2.Worksheets), "PV 시트가 남음")

    # (9) 데이터 0행(헤더만) → 원인 안내가 붙은 오류
    wb3 = app.Workbooks.Add(); ws3 = wb3.Worksheets(1); ws3.Name = "빈표"
    ws3.Range("A1").Value = "회사"; ws3.Range("B1").Value = "금액"
    f3 = Ctx(wb3, app)
    try:
        f3.pivot("빈표", group_by="회사", value="금액", agg="sum", dest_name="Z")
        ck("(9) 0행이면 원인 안내 오류", False, "오류 없이 통과함")
    except S.PythonComSkillError as e:
        ck("(9) 0행이면 원인 안내 오류", "데이터 행이 없습니다" in str(e), str(e)[:110])
    wb3.Close(False)
    wb2.Close(False)
finally:
    try: app.Quit()
    except Exception: pass

print("\n=== RESULT: " + ("ALL PASS" if fails == 0 else str(fails) + " FAIL") + " ===")
sys.exit(1 if fails else 0)
