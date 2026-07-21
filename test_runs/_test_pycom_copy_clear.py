# [0.5.18] "X열을 Y로 이동 + 원본은 비우기" = copy + ctx.clear 가 eval 실패(delete_cols 로 열 시프트 →
# 라벨 어긋남 E→D, F→E + F 수식 #REF! 파손)를 실제로 고치는지 라이브 COM 스모크테스트.
import os, sys, io, tempfile, uuid
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
    path = str(Path(tempfile.gettempdir()) / "b2b_copy_clear.xlsx")
    try: os.remove(path)
    except FileNotFoundError: pass
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    wb = None
    try:
        wb = app.Workbooks.Add()
        ws = wb.Worksheets(1); ws.Name = "요약"
        # 헤더 3행: D=소계, E=요금조정, F=합계(수식 =D+E)
        ws.Range("A3:F3").Value = [["회사", "", "", "소계", "요금조정", "합계"]]
        for i, comp in enumerate(["갑", "을", "병"]):
            r = 4 + i
            ws.Cells(r, 1).Value = comp
            ws.Cells(r, 4).Value = (i + 1) * 100      # D 소계
            ws.Cells(r, 5).Value = (i + 1) * 10       # E 요금조정
            ws.Cells(r, 6).Formula = f"=D{r}+E{r}"    # F 합계(수식)
        ws.Range("D4:D5").Merge()  # 병합 헤더/셀 존재해도 안전한지
        wb.SaveAs(path, FileFormat=51)
        ctx = s.PythonComSkillContext(app, wb, {"path": path, "workbook": wb, "app": app})

        # 수정 힌트대로: last → insert G → copy D→G → clear D (delete_cols/move 아님)
        last = ctx.last_row("요약", col=4)
        ctx.insert_cols("요약", "G")
        ctx.copy("요약", f"D1:D{last}", "요약", "G1")
        ctx.clear("요약", f"D1:D{last}")

        # 1) 라벨이 시프트되지 않았는가 (delete 버그면 E→D, F→E 로 어긋남)
        check("E3 헤더 '요금조정' 제자리(시프트 없음)", ws.Cells(3, 5).Value == "요금조정", str(ws.Cells(3,5).Value))
        check("F3 헤더 '합계' 제자리(시프트 없음)", ws.Cells(3, 6).Value == "합계", str(ws.Cells(3,6).Value))
        # 2) D 소계가 G로 이동했는가
        check("G3='소계' (D→G 이동)", ws.Cells(3, 7).Value == "소계", str(ws.Cells(3,7).Value))
        check("G4=100 (D 데이터 이동)", ws.Cells(4, 7).Value == 100, str(ws.Cells(4,7).Value))
        # 3) 원래 D는 비워졌는가(열은 유지)
        check("D4 비워짐", (ws.Cells(4, 4).Value in (None, "")), repr(ws.Cells(4,4).Value))
        check("D3 헤더 비워짐", (ws.Cells(3, 4).Value in (None, "")), repr(ws.Cells(3,4).Value))
        # 4) F 합계 수식이 #REF! 로 파손되지 않았는가 (핵심)
        f4 = str(ws.Cells(4, 6).Formula)
        check("F4 수식 #REF! 아님", "#REF!" not in f4 and "REF" not in f4.upper().replace("PREF",""), f4)
        check("F4 수식 여전히 유효(=..E4..)", "E4" in f4, f4)
        # 5) E 값 보존
        check("E4=10 보존", ws.Cells(4, 5).Value == 10, str(ws.Cells(4,5).Value))

        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        try:
            if wb is not None: wb.Close(SaveChanges=False)
        except Exception: pass
        try: app.Quit()
        except Exception: pass

if __name__ == "__main__":
    main()
