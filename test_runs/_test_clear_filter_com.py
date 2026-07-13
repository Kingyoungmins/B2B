# [실측] ctx.clear_filter: 시트 자동필터(AutoFilter) 해제 — 필터 조건으로 숨은 행 복원 + 드롭다운 제거.
# ("필터 풀어줘" 요청에 헬퍼가 없어 LLM 이 거부·실패하던 것 대응.)
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.5.19")
import win32com.client as w
import serve_b2b as S

C = S.PythonComSkillContext
app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
fails = 0
def ck(name, cond, got=None):
    global fails
    print((" OK  " if cond else "FAIL ") + name + ("" if cond else f"  got={got!r}"))
    if not cond: fails += 1

class Ctx(C):
    def __init__(s, wb, app): s._wb = wb; s._app = app; s._shared = {"structural": [], "deadline": float("inf")}
    def _tick(s, n=1): pass

try:
    wb = app.Workbooks.Add(); ws = wb.Worksheets(1); ws.Name = "상품번호별"
    ws.Range("A1").Value = "상품"; ws.Range("B1").Value = "값"
    for i, (p, v) in enumerate([("A", 1), ("B", 2), ("A", 3), ("C", 4)], 2):
        ws.Cells(i, 1).Value = p; ws.Cells(i, 2).Value = v
    ws.Range("A1:B5").AutoFilter(Field=1, Criteria1="A")   # 상품=A 만 표시(B,C 행 숨김)
    ck("(1) 필터 적용됨(FilterMode)", bool(ws.FilterMode) is True, ws.FilterMode)
    ck("(2) 숨은 행 있음", sum(1 for r in range(2, 6) if ws.Rows(r).Hidden) > 0)
    f = Ctx(wb, app)
    name = f.clear_filter("상품번호별")
    ck("(3) clear_filter 반환 시트명", name == "상품번호별", name)
    ck("(4) AutoFilter 제거됨(AutoFilterMode False)", bool(ws.AutoFilterMode) is False, ws.AutoFilterMode)
    ck("(5) 모든 데이터 행 복원(숨은 행 0)", sum(1 for r in range(2, 6) if ws.Rows(r).Hidden) == 0)
    ws2 = wb.Worksheets.Add(); ws2.Name = "nofilter"; ws2.Range("A1").Value = "x"
    ck("(6) 필터 없는 시트도 오류 없이 통과", f.clear_filter("nofilter") == "nofilter")
finally:
    try: app.Quit()
    except Exception: pass

print(f"\n=== RESULT: {'ALL PASS' if fails==0 else str(fails)+' FAIL'} ===")
sys.exit(1 if fails else 0)
