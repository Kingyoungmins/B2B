# [실측][진단] 같은 ctx.pivot 명령이 '재실행'되면 진짜 피벗 → 값-표로 바뀌는가?
# 가설: dest 시트가 이미 있으면 native_pivot 이 "이미 있습니다"로 raise → pivot() 이 그 시트를 지우고
#       _pivot_value_table 로 폴백 → 두 번째부터는 조용히 값-표.
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1")
import win32com.client as w
import serve_b2b as S

C = S.PythonComSkillContext
app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False

class Ctx(C):
    def __init__(s, wb, app): s._wb = wb; s._app = app; s._session = None; s._shared = {"structural": [], "deadline": float("inf"), "books": {}, "journal": []}
    def _tick(s, n=1): pass

def is_native(wb, name):
    try:
        return int(wb.Worksheets(name).PivotTables().Count) > 0
    except Exception:
        return False

wb = app.Workbooks.Add()
ws = wb.Worksheets(1); ws.Name = "d"
for j, h in enumerate(["지점", "분류", "금액"], 1):
    ws.Cells(1, j).Value = h
for i, r in enumerate([("서울", "가전", 100), ("부산", "의류", 50), ("서울", "가전", 300)], 2):
    for j, v in enumerate(r, 1):
        ws.Cells(i, j).Value = v

f = Ctx(wb, app)
print("같은 ctx.pivot 명령을 반복 호출 (라이브 적용/재적용 시나리오)")
print("=" * 70)
for n in (1, 2, 3):
    try:
        f.pivot("d", group_by="지점", value="금액", agg="sum", dest_name="피벗요약")
        kind = "진짜 피벗(PivotTable)" if is_native(wb, "피벗요약") else "✗ 값-표(가짜)"
        print("  %d회차: %s" % (n, kind))
    except Exception as e:
        print("  %d회차: 오류 %s" % (n, str(e)[:90]))
print("=" * 70)
print("→ 1회차만 진짜면: dest 시트 잔존이 원인(재실행마다 값-표로 강등)")

try: wb.Close(False)
except Exception: pass
try: app.Quit()
except Exception: pass
