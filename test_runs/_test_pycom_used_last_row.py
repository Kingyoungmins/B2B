# [0.5.18] ctx.used_last_row / used_last_col 라이브 COM 스모크테스트 (eval new_sheet_preserve_formulas 의
# last_row 과소산정 수정). A열이 희소해 last_row(col=1) 은 작게 나오지만 표는 더 아래까지 있음.
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

def main():
    path = str(Path(tempfile.gettempdir()) / "b2b_used_last_row.xlsx")
    try: os.remove(path)
    except FileNotFoundError: pass
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    wb = None
    try:
        wb = app.Workbooks.Add()
        ws = wb.Worksheets(1); ws.Name = "t"
        # A열은 5행까지만(희소), C열은 10행, F열은 12행(표 실제 하단) — 열별 last 가 제각각
        for r in range(1, 6):
            ws.Cells(r, 1).Value = f"A{r}"
        for r in range(1, 11):
            ws.Cells(r, 3).Value = r
        ws.Cells(12, 6).Value = "bottom"
        wb.SaveAs(path, FileFormat=51)
        ctx = s.PythonComSkillContext(app, wb, {"path": path, "workbook": wb, "app": app})

        lr_a = ctx.last_row("t", col=1)
        ulr = ctx.used_last_row("t")
        ulc = ctx.used_last_col("t")
        check("last_row(col=1)=5 (A열 희소, 과소산정)", lr_a == 5, str(lr_a))
        check("used_last_row=12 (표 실제 하단 포함)", ulr == 12, str(ulr))
        check("used_last_row > last_row(col=1) (과소산정 해소)", ulr > lr_a, f"{ulr} vs {lr_a}")
        check("used_last_col=6 (F열까지)", ulc == 6, str(ulc))
        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        try:
            if wb is not None: wb.Close(SaveChanges=False)
        except Exception: pass
        try: app.Quit()
        except Exception: pass

if __name__ == "__main__":
    main()
