# [실측][진단] native_pivot 이 '어떤 데이터 모양'에서 실패해 값-표로 조용히 폴백하는지 재현.
# 같은 ctx.pivot 명령인데 어떨 땐 진짜 피벗, 어떨 땐 값-표가 나오는 원인 규명용.
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

def build(rows, headers):
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "d"
    for j, h in enumerate(headers, 1):
        ws.Cells(1, j).Value = h
    for i, r in enumerate(rows, 2):
        for j, v in enumerate(r, 1):
            ws.Cells(i, j).Value = v
    return wb, ws

CASES = []
def case(name, headers, rows, kw=None, prep=None):
    CASES.append((name, headers, rows, kw or {}, prep))

BASE_ROWS = [("서울", "가전", 100), ("부산", "의류", 50), ("서울", "가전", 300)]
case("① 정상(대조군)", ["지점", "분류", "금액"], BASE_ROWS)
case("② 빈 헤더 열이 섞임", ["지점", "", "금액"], BASE_ROWS)
case("③ 헤더에 공백만", ["지점", "   ", "금액"], BASE_ROWS)
case("④ 데이터 1행뿐", ["지점", "분류", "금액"], [("서울", "가전", 100)])
case("⑤ 데이터 0행(헤더만)", ["지점", "분류", "금액"], [])
case("⑥ 중간 빈 행", ["지점", "분류", "금액"], [("서울", "가전", 100), (None, None, None), ("부산", "의류", 50)])
case("⑦ 병합 셀(헤더)", ["지점", "분류", "금액"], BASE_ROWS,
     prep=lambda ws: ws.Range("A1:B1").Merge())
case("⑧ 시트명 31자 초과 dest", ["지점", "분류", "금액"], BASE_ROWS,
     kw={"dest_name": "아주아주아주아주아주아주아주긴피벗시트이름입니다정말로"})
case("⑨ 자동필터 켜진 원본", ["지점", "분류", "금액"], BASE_ROWS,
     prep=lambda ws: ws.Range("A1:C4").AutoFilter(1))
case("⑩ 금액이 텍스트 서식", ["지점", "분류", "금액"], BASE_ROWS,
     prep=lambda ws: ws.Range("C2:C4").NumberFormat.__setattr__ if False else None)
case("⑪ 헤더 중복(분류 2개)", ["지점", "분류", "분류"], [("서울", "가전", "TV"), ("부산", "의류", "셔츠")],
     kw={"group_by": ["분류", "분류2"], "value": None})

print("native_pivot 실패 = ctx.pivot 이 조용히 '값-표'로 폴백하는 케이스\n" + "=" * 78)
fails = []
for name, headers, rows, kw, prep in CASES:
    wb, ws = build(rows, headers)
    if prep:
        try: prep(ws)
        except Exception: pass
    f = Ctx(wb, app)
    gb = kw.get("group_by", "지점")
    val = kw.get("value", "금액") if "value" in kw else "금액"
    dest = kw.get("dest_name", "P")
    try:
        f.native_pivot("d", gb, value=val, agg="sum", dest_name=dest)
        print("  OK   %s" % name)
    except Exception as e:
        msg = str(e)[:150].replace("\n", " ")
        print("  ✗    %-24s → %s" % (name, msg))
        fails.append(name)
    try: wb.Close(False)
    except Exception: pass

try: app.Quit()
except Exception: pass
print("=" * 78)
print("실패(=값-표로 폴백) %d / %d" % (len(fails), len(CASES)))
