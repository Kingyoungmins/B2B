# [실측] 긴 파일명 CSV → Excel 시트명 31자 절단. ctx._ws 가 모델이 쓴 풀 stem(>31자)을 실제 시트로
# 자가치유하는지 실제 Excel COM 으로 검증. (1) CSV 단일시트, (2) 다중시트 절단매칭, (3) 모호하면 에러.
import sys, os, tempfile
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1")
import win32com.client as w
import serve_b2b as S

app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
fails = 0
def ck(name, cond, got=None):
    global fails
    print((" OK  " if cond else "FAIL ") + name + ("" if cond else f"  got={got!r}"))
    if not cond: fails += 1

class Fake:
    def __init__(self, wb): self._wb = wb; self._app = app
    def _tick(self, n=1): pass

def ws_lookup(wb, sheet):
    return S.PythonComSkillContext._ws(Fake(wb), sheet)

tmp = tempfile.mkdtemp(prefix="b2b_ws_")
try:
    long_stem = "input_통화내역_2026_06_qwerqwerqwerqwerqwer"   # 39자
    ck("전제: 풀 stem 39자, [:31] 절단 확인", len(long_stem) == 39 and len(long_stem[:31]) == 31, (len(long_stem), long_stem[:31]))

    # ── (1) 단일시트 CSV ──
    csv_path = os.path.join(tmp, long_stem + ".csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as fp:
        fp.write("통화ID,고객,구분,수량,요금\n")
        fp.write("A1,홍길동,국내,3,1000\n")
        fp.write("A2,김철수,국제,2,5000\n")
    wb = app.Workbooks.Open(csv_path)
    actual = str(wb.Worksheets(1).Name)
    ck("(1a) Excel CSV 시트명은 31자로 잘림", len(actual) == 31 and actual == long_stem[:31], actual)
    # 모델이 쓴 풀 stem(39자)로 조회 → 실제 잘린 시트로 해석
    ws = ws_lookup(wb, long_stem)
    ck("(1b) 풀 stem(39자)으로 _ws → 실제 시트 해석", str(ws.Name) == actual, str(ws.Name))
    # .csv 확장자까지 붙여 조회해도(모델이 파일명 그대로) 단일시트 안전망으로 해석
    ws2 = ws_lookup(wb, long_stem + ".csv")
    ck("(1c) '풀stem.csv' 로 조회해도 해석", str(ws2.Name) == actual, str(ws2.Name))
    wb.Close(False)

    # ── (2) 다중시트: 절단 매칭이 단일시트 안전망 없이도 정확히 동작하는지 ──
    xls_path = os.path.join(tmp, "multi.xlsx")
    wbm = app.Workbooks.Add()
    wbm.Worksheets(1).Name = long_stem[:31]     # 31자 절단 이름
    extra = wbm.Worksheets.Add(After=wbm.Worksheets(wbm.Worksheets.Count))
    extra.Name = "기타"
    wbm.SaveAs(xls_path, FileFormat=51)
    ck("(2a) 다중시트(2개) 준비", int(wbm.Worksheets.Count) == 2, int(wbm.Worksheets.Count))
    ws3 = ws_lookup(wbm, long_stem)             # 풀 stem → 절단 매칭으로 유일 해석
    ck("(2b) 다중시트에서 풀 stem → 31자 절단 시트로 해석", str(ws3.Name) == long_stem[:31], str(ws3.Name))

    # ── (3) 모호/무관: 매칭 없고 다중시트면 에러 유지 ──
    raised = False
    try:
        ws_lookup(wbm, "완전다른이름ABC")
    except S.PythonComSkillError:
        raised = True
    ck("(3) 다중시트+무관 시트명은 에러 유지(엉뚱한 시트 방지)", raised, raised)
    wbm.Close(False)
finally:
    try: app.Quit()
    except Exception: pass
    import shutil; shutil.rmtree(tmp, ignore_errors=True)

print(f"\n=== RESULT: {'ALL PASS' if fails==0 else str(fails)+' FAIL'} ===")
sys.exit(1 if fails else 0)
