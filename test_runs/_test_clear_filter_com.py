# [실측] 필터 헬퍼 3종 (실제 Excel COM)
#  - ctx.enable_filter : 필터 드롭다운만 켜기(숨김 없음)
#  - ctx.apply_filter  : '눈으로만' 특정 값만 보이기(엑셀 필터 체크박스처럼 — 행 삭제 아님, 데이터 보존)
#  - ctx.clear_filter  : 필터 해제(숨은 행 전부 복원 + 드롭다운 제거)
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
    print((" OK  " if cond else "FAIL ") + name + ("" if cond else " got=" + repr(got)))
    if not cond: fails += 1

class Ctx(C):
    def __init__(s, wb, app): s._wb = wb; s._app = app; s._shared = {"structural": [], "deadline": float("inf")}
    def _tick(s, n=1): pass

def hidden(ws): return [r for r in range(2, 7) if ws.Rows(r).Hidden]

try:
    wb = app.Workbooks.Add(); ws = wb.Worksheets(1); ws.Name = "상품번호별"
    ws.Range("A1").Value = "상품"; ws.Range("B1").Value = "상태"
    # 2완료 3진행 4취소 5완료 6보류
    for i, (p, st) in enumerate([("P1", "완료"), ("P2", "진행"), ("P3", "취소"), ("P4", "완료"), ("P5", "보류")], 2):
        ws.Cells(i, 1).Value = p; ws.Cells(i, 2).Value = st
    f = Ctx(wb, app)

    # enable_filter: 드롭다운만 켜기(숨김 없음)
    f.enable_filter("상품번호별")
    ck("(1) enable_filter: AutoFilter 켜짐, 숨은 행 없음", bool(ws.AutoFilterMode) is True and hidden(ws) == [], (ws.AutoFilterMode, hidden(ws)))

    # apply_filter 단일값: 완료만 보이기
    f.apply_filter("상품번호별", "상태", "완료")
    h = hidden(ws)
    ck("(2) apply_filter 단일: 완료(2,5) 보임", 2 not in h and 5 not in h, h)
    ck("(3) apply_filter 단일: 비완료(3,4,6) 숨김", all(r in h for r in (3, 4, 6)), h)
    ck("(4) 데이터 보존(취소 값 그대로)", ws.Cells(4, 2).Value == "취소", ws.Cells(4, 2).Value)

    # apply_filter 다중값: 완료+진행
    f.apply_filter("상품번호별", "상태", ["완료", "진행"])
    h = hidden(ws)
    ck("(5) apply_filter 다중: 완료·진행(2,3,5) 보임", all(r not in h for r in (2, 3, 5)), h)
    ck("(6) apply_filter 다중: 취소·보류(4,6) 숨김", 4 in h and 6 in h, h)

    # clear_filter: 전부 복원
    f.clear_filter("상품번호별")
    ck("(7) clear_filter: 숨은 행 0으로 복원", hidden(ws) == [], hidden(ws))
    ck("(8) clear_filter: AutoFilter 제거", bool(ws.AutoFilterMode) is False, ws.AutoFilterMode)
finally:
    try: app.Quit()
    except Exception: pass

print("\n=== RESULT: " + ("ALL PASS" if fails == 0 else str(fails) + " FAIL") + " ===")
sys.exit(1 if fails else 0)
