# [0.5.18] ctx.move_col_clear 라이브 COM 스모크테스트 — eval(reorder_billing_columns) 구조 재현:
# 제목 가로병합(A2:F2) + 헤더 4행 세로병합(D4:D5 등) + F=SUM 수식. 원래 생성코드(D1:D{last} 통 복사)는
# A2:F2 부분병합에 걸려 1004 로 실패했다. move_col_clear 는 상단 가로병합을 자동 회피해 성공해야 한다.
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
    path = str(Path(tempfile.gettempdir()) / "b2b_move_col_clear.xlsx")
    try: os.remove(path)
    except FileNotFoundError: pass
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    wb = None
    try:
        wb = app.Workbooks.Add()
        ws = wb.Worksheets(1); ws.Name = "요약"
        ws.Range("A2:F2").Merge(); ws.Range("A2").Value = "정산내역"   # 제목 가로병합(범인)
        ws.Range("F3").Value = "단위: 원"
        ws.Range("A4:F4").Value = [["SO", "청구계정", "상품유형", "소계", "요금조정", "합계"]]
        for col in ("A", "B", "C", "D", "E", "F"):
            ws.Range(f"{col}4:{col}5").Merge()                        # 헤더 2행 세로병합
        for i in range(2):  # 두 엔티티, 각 2행(6~7, 8~9)
            top = 6 + i * 2
            ws.Range(f"A{top}:A{top+1}").Merge(); ws.Cells(top, 1).Value = ["서초", "강남"][i]
            ws.Cells(top, 4).Value = (i + 1) * 1000       # D 소계
            ws.Cells(top, 5).Value = (i + 1) * 100        # E 요금조정
            ws.Cells(top, 6).Formula = f"=SUM(D{top}:D{top+1})+SUM(E{top}:E{top+1})"  # F 합계
        wb.SaveAs(path, FileFormat=51)
        ctx = s.PythonComSkillContext(app, wb, {"path": path, "workbook": wb, "app": app})

        # 핵심: D→G 이동+원본 비우기 (헤더 자동감지, 제목 A2:F2 회피)
        try:
            ctx.move_col_clear("요약", "D", "G")
            check("move_col_clear 성공(제목 가로병합에도 1004 없음)", True)
        except Exception as e:
            check("move_col_clear 성공(제목 가로병합에도 1004 없음)", False, repr(e))
            raise

        check("G4='소계' (D 헤더 이동)", ws.Cells(4, 7).Value == "소계", repr(ws.Cells(4,7).Value))
        check("G6=1000 (D 데이터 이동)", ws.Cells(6, 7).Value == 1000, repr(ws.Cells(6,7).Value))
        check("D4 비워짐", (ws.Cells(4, 4).Value in (None, "")), repr(ws.Cells(4,4).Value))
        check("D6 비워짐", (ws.Cells(6, 4).Value in (None, "")), repr(ws.Cells(6,4).Value))
        check("E4='요금조정' 제자리(시프트 없음)", ws.Cells(4, 5).Value == "요금조정", repr(ws.Cells(4,5).Value))
        check("F4='합계' 제자리", ws.Cells(4, 6).Value == "합계", repr(ws.Cells(4,6).Value))
        f6 = str(ws.Cells(6, 6).Formula)
        check("F6 수식 #REF! 아님", "#REF!" not in f6 and "E6" in f6, f6)
        # 제목 병합이 살아있는가(원본 파괴 없음)
        check("제목 A2:F2 병합 유지", bool(ws.Range("A2").MergeCells), "제목 병합 깨짐")

        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        try:
            if wb is not None: wb.Close(SaveChanges=False)
        except Exception: pass
        try: app.Quit()
        except Exception: pass

if __name__ == "__main__":
    main()
