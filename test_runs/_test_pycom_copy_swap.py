# [0.5.18] ctx.copy_values / copy_col / swap_cols 라이브 COM 스모크테스트 (eval 3/4/5 구조 재현).
# 제목 가로병합(A2:F2) + 헤더 세로병합(D4:D5..) + F=SUM 수식. 실제 eval 파일에서도 검증했고, 여기선 자립 재현.
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

def build(app):
    path = str(Path(tempfile.gettempdir()) / "b2b_copy_swap.xlsx")
    try: os.remove(path)
    except FileNotFoundError: pass
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "요약"
    ws.Range("A2:F2").Merge(); ws.Range("A2").Value = "정산내역"
    ws.Range("A4:F4").Value = [["SO", "계정", "상품", "소계", "요금조정", "합계"]]
    for col in ("A", "B", "C", "D", "E", "F"):
        ws.Range(f"{col}4:{col}5").Merge()
    for i in range(2):
        top = 6 + i * 2
        ws.Range(f"A{top}:A{top+1}").Merge(); ws.Cells(top, 1).Value = ["서초", "강남"][i]
        ws.Cells(top, 4).Value = (i + 1) * 1000
        ws.Cells(top, 5).Value = (i + 1) * 100
        ws.Cells(top, 6).Formula = f"=SUM(D{top}:D{top+1})+SUM(E{top}:E{top+1})"
    ws.Cells(6, 11).Formula = "=D6"   # K6: 상대참조 수식(값복사 테스트용)
    wb.SaveAs(path, FileFormat=51)
    return wb, ws, path, s.PythonComSkillContext(app, wb, {"path": path, "workbook": wb, "app": app})

def main():
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    try:
        # 1) copy_values: K6(=D6) → M6 는 '값'이어야(수식 시프트 없음)
        wb, ws, path, ctx = build(app)
        try:
            d6 = ws.Cells(6, 4).Value
            ctx.copy_values("요약", "K6", "요약", "M6")
            m6f = str(ws.Cells(6, 13).Formula); m6v = ws.Cells(6, 13).Value
            check("copy_values: M6 값==D6 값", m6v == d6, f"{m6v} vs {d6}")
            check("copy_values: M6 는 수식 아님(시프트 제거)", not m6f.startswith("="), m6f)
        finally:
            wb.Close(SaveChanges=False); os.remove(path)

        # 2) copy_col: D→G 병합안전 복사(원본 유지)
        wb, ws, path, ctx = build(app)
        try:
            ctx.copy_col("요약", "D", "G")
            check("copy_col: 1004 없이 복사 + G4='소계'", ws.Cells(4, 7).Value == "소계", repr(ws.Cells(4,7).Value))
            check("copy_col: G6 데이터 이동", ws.Cells(6, 7).Value == 1000, repr(ws.Cells(6,7).Value))
            check("copy_col: 원본 D4 유지(비우지 않음)", ws.Cells(4, 4).Value == "소계", repr(ws.Cells(4,4).Value))
        finally:
            wb.Close(SaveChanges=False); os.remove(path)

        # 3) swap_cols: D↔E, 수식 참조 자동보정(#REF! 없음), 제목 병합 유지
        wb, ws, path, ctx = build(app)
        try:
            f6b = str(ws.Cells(6, 6).Formula)
            ctx.swap_cols("요약", "D", "E", header_row=4)
            check("swap_cols: D4='요금조정' E4='소계'", ws.Cells(4,4).Value == "요금조정" and ws.Cells(4,5).Value == "소계",
                  f"D4={ws.Cells(4,4).Value} E4={ws.Cells(4,5).Value}")
            f6a = str(ws.Cells(6, 6).Formula)
            check("swap_cols: F6 수식 #REF! 아님(참조 보정)", "#REF!" not in f6a, f"{f6b} -> {f6a}")
            check("swap_cols: 제목 A2 병합 유지", bool(ws.Range("A2").MergeCells))
        finally:
            wb.Close(SaveChanges=False); os.remove(path)

        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        try: app.Quit()
        except Exception: pass

if __name__ == "__main__":
    main()
