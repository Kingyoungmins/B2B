# [0.5.18] ctx.sum_column 라이브 COM 스모크 — '합계 열'을 합계 행 제외하고 정확히 합산.
# 실제 HCN 요약 시트: F열 항목(F6..F18) 합 = 18,664,526.2 = F22(합계). 코드가 A22 라벨을 못 걸러
# F열 전체(+F25 부가세)를 더하던 버그의 회귀 방지. + 합성 파일로 이식성 검증.
import os, sys, io, tempfile
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import win32com.client as win32
import serve_b2b as s

passed = 0
def check(name, cond, detail=""):
    global passed
    if not cond:
        raise AssertionError(f"FAIL {name}: {detail}")
    passed += 1
    print(" OK ", name)

REAL = r"C:\Users\Admin\Downloads\KT\output_HCN대사용_영총.사지.LG유플러스 정산내역_2026년03월_LG작성.xlsx"

def test_synthetic(app):
    path = str(Path(tempfile.gettempdir()) / "b2b_sum_column.xlsx")
    try: os.remove(path)
    except FileNotFoundError: pass
    wb = app.Workbooks.Add()
    try:
        ws = wb.Worksheets(1); ws.Name = "요약"
        ws.Cells(4, 1).Value = "SO"; ws.Cells(4, 6).Value = "합계"   # 헤더 4행, F열 '합계'
        data = {6: 100.0, 8: 200.0, 10: 50.5, 12: 0.0, 14: 149.5}    # 항목(사이 인터넷행은 빈칸)
        for r, v in data.items():
            ws.Cells(r, 1).Value = f"지점{r}"; ws.Cells(r, 6).Value = v
        ws.Cells(11, 6).Value = None
        ws.Cells(21, 6).Value = "단위 : 원(VAT별도)"
        ws.Cells(22, 1).Value = "합계"; ws.Cells(22, 6).Value = 500.0   # 총계 행(=항목합)
        ws.Cells(25, 6).Value = 550.0                                  # 꼬리(부가세 등, 라벨 없음)
        wb.SaveAs(path, FileFormat=51)
        ctx = s.PythonComSkillContext(app, wb, {"path": path, "workbook": wb, "app": app})
        fcol = ctx.find_header("요약", "합계", header_row=4)
        check("find_header('합계')=6(F열)", fcol == 6, str(fcol))
        t_excl = ctx.sum_column("요약", "합계", header_row=4, exclude_total_rows=True)
        check("합성: 합계행 제외 = 항목합 500 (꼬리550·총계500 미포함)", abs(t_excl - 500.0) < 1e-6, str(t_excl))
        t_all = ctx.sum_column("요약", "합계", header_row=4, exclude_total_rows=False)
        check("합성: 전체합산 = 500+500+550 = 1550", abs(t_all - 1550.0) < 1e-6, str(t_all))
    finally:
        try: wb.Close(SaveChanges=False)
        except Exception: pass

def test_real(app):
    if not os.path.exists(REAL):
        print(" -- 실파일 없음, 실파일 검증 건너뜀:", REAL); return
    wb = app.Workbooks.Open(REAL, ReadOnly=True)
    try:
        ctx = s.PythonComSkillContext(app, wb, {"path": REAL, "workbook": wb, "app": app})
        fcol = ctx.find_header("요약", "합계", header_row=4)
        check("실파일: find_header('합계')=6(F열)", fcol == 6, str(fcol))
        t = ctx.sum_column("요약", "합계", header_row=4, exclude_total_rows=True)
        check("실파일: 합계행 제외 F열 항목합 = 18,664,526.2", abs(t - 18664526.2) < 1.0, str(t))
        t_all = ctx.sum_column("요약", "합계", header_row=4, exclude_total_rows=False)
        check("실파일: 전체합산은 항목합보다 큼(F22·F25 포함)", t_all > 18664526.2 + 1.0, str(t_all))
    finally:
        try: wb.Close(SaveChanges=False)
        except Exception: pass

def main():
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    try:
        test_synthetic(app)
        test_real(app)
        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        try: app.Quit()
        except Exception: pass

if __name__ == "__main__":
    main()
