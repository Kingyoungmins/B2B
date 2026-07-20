# [0.5.18] ctx.clear(keep_formulas) + ctx.fill_sum_col 라이브 COM 스모크테스트 (eval replace_deleted_logic /
# feedback_refines_prior / formula_result_check_not_overwrite 구조 재현).
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
    path = str(Path(tempfile.gettempdir()) / "b2b_clear_sumcol.xlsx")
    try: os.remove(path)
    except FileNotFoundError: pass
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    wb = None
    try:
        wb = app.Workbooks.Add()
        # 시트1: clear keep_formulas
        c = wb.Worksheets(1); c.Name = "clr"
        c.Cells(1, 2).Value = 100          # B1 값
        c.Cells(2, 2).Formula = "=B1*2"    # B2 수식(보존 대상)
        c.Cells(3, 2).Value = 300          # B3 값
        # 시트2: fill_sum_col (요약 구조: 제목 가로병합 + 헤더 세로병합 + F 2행 병합 블록)
        f = wb.Worksheets.Add(); f.Name = "요약"
        f.Range("A2:F2").Merge(); f.Range("A2").Value = "정산"
        f.Range("A4:F4").Value = [["SO", "계정", "상품", "소계", "요금조정", "합계"]]
        for col in ("A", "B", "C", "D", "E", "F"):
            f.Range(f"{col}4:{col}5").Merge()
        for i in range(2):  # 엔티티 2개(6~7, 8~9), F 는 2행 병합
            top = 6 + i * 2
            f.Range(f"A{top}:A{top+1}").Merge(); f.Cells(top, 1).Value = ["서초", "강남"][i]
            f.Range(f"F{top}:F{top+1}").Merge()
            f.Cells(top, 4).Value = (i + 1) * 1000; f.Cells(top + 1, 4).Value = (i + 1) * 500
            f.Cells(top, 5).Value = (i + 1) * 100;  f.Cells(top + 1, 5).Value = (i + 1) * 50
        # 라벨 블록(10~11): D/E 비숫자 → fill_sum_col 이 건너뛰어야
        f.Range("A10:A11").Merge(); f.Cells(10, 1).Value = "소계"
        f.Range("F10:F11").Merge(); f.Cells(10, 6).Value = "단위:원"
        wb.SaveAs(path, FileFormat=51)
        ctx = s.PythonComSkillContext(app, wb, {"path": path, "workbook": wb, "app": app})

        # 1) clear keep_formulas: B1/B3 값만 비우고 B2 수식 보존
        ctx.clear("clr", "B1:B3", keep_formulas=True)
        check("clear: B1 값 비워짐", c.Cells(1, 2).Value in (None, ""), repr(c.Cells(1,2).Value))
        check("clear: B3 값 비워짐", c.Cells(3, 2).Value in (None, ""), repr(c.Cells(3,2).Value))
        check("clear: B2 수식 보존", str(c.Cells(2, 2).Formula).startswith("="), repr(c.Cells(2,2).Formula))

        # 2) fill_sum_col: F 병합 블록에 그룹 SUM, 라벨행 스킵, 헤더/라벨 보존
        n = ctx.fill_sum_col("요약", "F", ["D", "E"], header_row=4)
        check("fill_sum_col: F6=그룹SUM", str(f.Cells(6, 6).Formula) == "=SUM(D6:D7)+SUM(E6:E7)", repr(f.Cells(6,6).Formula))
        check("fill_sum_col: F8=그룹SUM", str(f.Cells(8, 6).Formula) == "=SUM(D8:D9)+SUM(E8:E9)", repr(f.Cells(8,6).Formula))
        check("fill_sum_col: 라벨행 F10 안 덮음(단위:원 유지)", str(f.Cells(10, 6).Value) == "단위:원", repr(f.Cells(10,6).Value))
        check("fill_sum_col: 헤더 F4('합계') 보존", str(f.Cells(4, 6).Value) == "합계", repr(f.Cells(4,6).Value))
        check("fill_sum_col: 채운 블록 2개", n == 2, str(n))

        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        try:
            if wb is not None: wb.Close(SaveChanges=False)
        except Exception: pass
        try: app.Quit()
        except Exception: pass

if __name__ == "__main__":
    main()
