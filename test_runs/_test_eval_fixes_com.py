# [실측] 평가지 실패 3건에 대한 수정 검증 (실제 Excel COM)
#  ② ctx.first_empty_col: '빈 보조열'을 찾을 때 데이터 옆 합계(=SUM) 열을 건너뛰고 진짜 빈 열을 고르는가 (E-01)
#  ③ ctx.pivot: 슬래시-별칭 group_by 매칭 + 전화번호 앞자리0(텍스트 키) 보존 (B-05)
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1")
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
    # ── ② first_empty_col : E-01 (H~L 데이터, M=SUM 수식, N 빈열) ──
    wb1 = app.Workbooks.Add(); ws1 = wb1.Worksheets(1); ws1.Name = "SO"
    for c in range(1, 8): ws1.Cells(8, c).Value = "col%d" % c
    for c in range(8, 13): ws1.Cells(8, c).Value = chr(64 + c)      # H..L 헤더
    ws1.Cells(8, 13).Value = "합계"                                  # M 헤더
    for r in range(9, 21):
        for c in range(1, 8): ws1.Cells(r, c).Value = "v"
        for c in range(8, 13): ws1.Cells(r, c).Value = (r - 8) * c
        ws1.Cells(r, 13).Formula = "=SUM(H%d:L%d)" % (r, r)          # M = SUM
    f1 = Ctx(wb1, app)
    ck("(E-01/1) after='L' → 'N' (M=합계수식 건너뜀)", f1.first_empty_col("SO", after="L") == "N", f1.first_empty_col("SO", after="L"))
    ck("(E-01/2) after 없음 → 데이터 뒤 첫 빈 열 'N'", f1.first_empty_col("SO") == "N", f1.first_empty_col("SO"))
    for r in range(8, 21): ws1.Cells(r, 13).ClearContents()          # M 비우면
    ck("(E-01/3) M 비우면 after='L' → 'M'", f1.first_empty_col("SO", after="L") == "M", f1.first_empty_col("SO", after="L"))
    wb1.Close(False)

    # ── ③ pivot : B-05 (슬래시-별칭 group_by + 전화번호 앞자리0 보존) ──
    wb2 = app.Workbooks.Add(); ws2 = wb2.Worksheets(1); ws2.Name = "매출"
    ws2.Range("A1").Value = "이름"; ws2.Range("B1").Value = "전화번호"; ws2.Range("C1").Value = "기본료"
    ws2.Range("B2:B4").NumberFormat = "@"                            # 전화번호 텍스트열(앞자리0 보존)
    for i, (nm, ph, fee) in enumerate([("홍", "0101111", 1000), ("홍", "0101111", 2000), ("김", "0102222", 500)], 2):
        ws2.Cells(i, 1).Value = nm; ws2.Cells(i, 2).Value = ph; ws2.Cells(i, 3).Value = fee
    f2 = Ctx(wb2, app)
    ck("(B-05/0) 원본 전화번호 텍스트로 읽힘", f2.read("매출")[1][1] == "0101111", f2.read("매출")[1][1])
    name = f2.pivot("매출", group_by="전화번호/회선번호/ID", value="기본료", agg="sum", dest_name="전화_피벗")
    ck("(B-05/1) 슬래시-별칭 group_by 로 피벗 시트 생성", name == "전화_피벗" and "전화_피벗" in [x.Name for x in wb2.Worksheets])
    dws = wb2.Worksheets("전화_피벗")
    d = {str(dws.Cells(r, 1).Value): dws.Cells(r, 2).Value for r in (2, 3)}
    ck("(B-05/2) 0101111 합계 3000", d.get("0101111") == 3000, d)
    ck("(B-05/3) 0102222 합계 500", d.get("0102222") == 500, d)
    ck("(B-05/4) 피벗 키 앞자리0 보존(텍스트)", dws.Cells(2, 1).Value == "0101111", dws.Cells(2, 1).Value)
    name2 = f2.pivot("매출", group_by="전화번호", value="기본료", agg="sum", dest_name="p2")
    ck("(B-05/5) 정확 헤더명 group_by 도 동작", wb2.Worksheets("p2").Cells(2, 2).Value in (3000, 500))
    wb2.Close(False)
finally:
    try: app.Quit()
    except Exception: pass

print(f"\n=== RESULT: {'ALL PASS' if fails==0 else str(fails)+' FAIL'} ===")
sys.exit(1 if fails else 0)
