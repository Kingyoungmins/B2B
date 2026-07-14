# [실측][SBAGENT-198] rename_sheet 31자 초과 이름 — 예전엔 0x800A03EC 로 실패, 이제 31자로 잘라 성공.
# 이후 '긴 이름' 조회는 _ws 의 31자-절단 폴백이 같은 시트를 찾는지까지 검증.
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1")
import win32com.client as w
import serve_b2b as S

C = S.PythonComSkillContext
LONG = "a986acce2deb45089943f4fbac0ba555_서비스통합통계월별목록_20260709172636"  # 59자
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

try:
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "orig"
    f = Ctx(wb, app)

    r = f.rename_sheet("orig", LONG)
    ck("(1) 59자 rename 성공(예전엔 0x800A03EC)", r is True, r)
    actual = wb.Worksheets(1).Name
    ck("(2) 실제 이름 = 앞 31자", actual == LONG[:31], actual)
    ck("(3) 긴 이름 조회 → _ws 절단 폴백으로 동일 시트", f._ws(LONG).Name == actual)

    # 중복 검사 유지: 잘린 이름과 같은 시트가 이미 있으면 거부
    wb.Worksheets.Add(After=wb.Worksheets(1)).Name = "dup"
    try:
        f.rename_sheet("dup", LONG)  # 잘리면 (2)와 동일 이름 → 중복
        ck("(4) 중복(절단 후 동일명) 거부", False, "no raise")
    except S.PythonComSkillError as e:
        ck("(4) 중복(절단 후 동일명) 거부", "이미 있습니다" in str(e), str(e))

    # 31자 이하 일반 rename 비회귀
    f.rename_sheet("dup", "정상이름")
    ck("(5) 일반 rename 비회귀", wb.Worksheets(2).Name == "정상이름")
    wb.Close(False)
finally:
    try: app.Quit()
    except Exception: pass

print("\n=== RESULT: " + ("ALL PASS" if fails == 0 else str(fails) + " FAIL") + " ===")
sys.exit(1 if fails else 0)
