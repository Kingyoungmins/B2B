# [실측] 다른 달 파일 재바인딩 — ctx.book("...2606...") 이 2607 워크북에 안정키 폴백으로 잡히는지.
# 임무 3: 백엔드 실제 COM 실측 (DispatchEx, Visible=False, 종료 시 Quit).
#  A) 2607 만 열림 → ctx.book(2606명) : 안정키(_match_workbook_by_stable_key) 폴백 성공 여부
#  B) 2606+2607 둘 다 열림 → ctx.book(2606명) : 동작(정확명 매칭 vs 모호성 실패)
#  C) 둘 다 열림 → ctx.book(2605명, 미존재) : 안정키 2건 → 모호성으로 매칭 포기 → 예외 문구
#  D) A 의 ctx 재사용(공유 books 캐시) 상태에서 2606 이 '진짜로' 열린 뒤 같은 호출 → 캐시가 2607 을 계속 주는지
import sys, os, tempfile, traceback
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.0")
import win32com.client as w
import serve_b2b as S

NAME_2606 = "한국전력공사_202606_v1.1_DSMC_260710.xlsx"
NAME_2607 = "한국전력공사_202607_v1.1_DSMC_260810.xlsx"
NAME_2605 = "한국전력공사_202605_v1.1_DSMC_260510.xlsx"

print("[key] stable_key(2606) =", repr(S._stable_workbook_key(NAME_2606)))
print("[key] stable_key(2607) =", repr(S._stable_workbook_key(NAME_2607)))
print("[key] stable_key equal =", S._stable_workbook_key(NAME_2606) == S._stable_workbook_key(NAME_2607))
print("[key] lookup_keys intersect (2606 vs 2607) =",
      bool(S._workbook_name_lookup_keys(NAME_2606) & S._workbook_name_lookup_keys(NAME_2607)))

class Ctx(S.PythonComSkillContext):
    """최소 하위클래스: _wb/_app/_shared(+_session=None) 만 세팅. _tick/book 은 원본 그대로."""
    def __init__(self, wb, app):
        self._wb = wb
        self._app = app
        self._session = None
        self._shared = {"com_calls": 0, "deadline": float("inf"),
                        "journal": [], "structural": [], "books": {}}

def try_book(ctx, name, label):
    try:
        sub = ctx.book(name)
        print(f"[{label}] SUCCESS -> bound wb.Name = {sub._wb.Name!r}")
        return sub
    except Exception as e:
        print(f"[{label}] EXCEPTION {type(e).__name__}: {e}")
        return None

tmp = tempfile.mkdtemp(prefix="b2b_month_rebind_")
p2607 = os.path.join(tmp, NAME_2607)
p2606 = os.path.join(tmp, NAME_2606)

app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
try:
    # 1) 임시 워크북을 2607 이름으로 저장해 연 상태로 둔다.
    wb7 = app.Workbooks.Add()
    wb7.Worksheets(1).Range("A1").Value = "dummy"
    wb7.SaveAs(p2607, FileFormat=51)  # xlOpenXMLWorkbook
    print("[setup] open workbooks =", [str(b.Name) for b in app.Workbooks])

    # A) 2607 만 열림 — 2606 요청
    ctxA = Ctx(wb7, app)
    try_book(ctxA, NAME_2606, "A: only-2607, ask 2606")

    # 2) 2606 워크북도 추가로 저장·열림
    wb6 = app.Workbooks.Add()
    wb6.Worksheets(1).Range("A1").Value = "dummy6"
    wb6.SaveAs(p2606, FileFormat=51)
    print("[setup] open workbooks =", [str(b.Name) for b in app.Workbooks])

    # B) 둘 다 열림 — 같은 호출(새 ctx, 캐시 배제)
    ctxB = Ctx(wb7, app)
    try_book(ctxB, NAME_2606, "B: both-open, ask 2606")

    # C) 둘 다 열림 — 열려 있지 않은 2605 요청(안정키 후보 2개 → 모호성)
    ctxC = Ctx(wb7, app)
    try_book(ctxC, NAME_2605, "C: both-open, ask 2605(absent)")

    # D) A 의 ctx(공유 books 캐시) 재사용 — 2606 이 실제로 열렸는데도 캐시 바인딩이 유지되는지
    subD = try_book(ctxA, NAME_2606, "D: reuse ctxA cache, ask 2606")

    wb6.Close(False)
    wb7.Close(False)
finally:
    try:
        app.Quit()
    except Exception:
        pass
print("=== DONE ===")
