# [0.5.17] 병합 헤더/제목이 있는 시트에서 ctx.move_cols 가 1004 없이 열을 옮기고 데이터를 보존하는지
# 라이브 COM 스모크테스트. (VBA 가 병합 위 Cut/Insert 로 1004 나던 것을 Python 헬퍼로 대체하기 위함.)
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
    path = str(Path(tempfile.gettempdir()) / "b2b_pycom_merge_move.xlsx")
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    wb = None
    try:
        wb = app.Workbooks.Add()
        ws = wb.Worksheets(1); ws.Name = "콜센터"
        # 제목 병합(A1:F1) — 옮길 열들에 걸친 가로 병합(VBA Cut/Insert 가 1004 나던 주범)
        ws.Range("A1:F1").Merge()
        ws.Range("A1").Value = "2026년 청구내역"
        # 헤더는 2~3행 세로 병합(각 열 A2:A3 … F2:F3) — 리포트의 D4:D5 병합 헤더 패턴 재현
        headers = ["가입번호", "상품", "고객", "금액", "할인", "합계"]
        for i, h in enumerate(headers):
            col = s._col_letter(i + 1)
            ws.Range(f"{col}2:{col}3").Merge()
            ws.Range(f"{col}2").Value = h
        # 데이터(4~6행)
        ws.Range("A4:F4").Value = [[1001, "안전제일", "홍길동", 100, 10, 90]]
        ws.Range("A5:F5").Value = [[1002, "보통", "김철수", 200, 20, 180]]
        ws.Range("A6:F6").Value = [[1003, "특별", "이영", 300, 30, 270]]
        wb.SaveAs(path, FileFormat=51)

        ctx = s.PythonComSkillContext(app, wb, {"path": path, "workbook": wb, "app": app})

        before_amount = [ws.Cells(r, 4).Value for r in (4, 5, 6)]
        check("사전: 금액(D) 데이터 [100,200,300]", before_amount == [100, 200, 300], str(before_amount))

        # 핵심: 금액(D)을 합계(F) 앞으로 이동 — 제목/헤더 병합이 있어도 1004 없이 되는가
        try:
            ctx.move_cols("콜센터", ["금액"], "합계", header_row=2)
            check("move_cols 병합헤더/제목 위에서 1004 없이 실행", True)
        except Exception as e:
            check("move_cols 병합헤더/제목 위에서 1004 없이 실행", False, repr(e))
            raise

        amt_col = ctx.find_header("콜센터", "금액", header_row=2)
        after_amount = [ws.Cells(r, amt_col).Value for r in (4, 5, 6)]
        check("이동 후 금액 데이터 보존", after_amount == [100, 200, 300],
              f"col={s._col_letter(amt_col)} vals={after_amount}")

        sub_col = ctx.find_header("콜센터", "가입번호", header_row=2)
        subs = [ws.Cells(r, sub_col).Value for r in (4, 5, 6)]
        check("이동 후 가입번호 데이터 보존", subs == [1001, 1002, 1003], str(subs))

        tot_col = ctx.find_header("콜센터", "합계", header_row=2)
        check("금액이 합계 바로 앞으로 이동", amt_col == tot_col - 1, f"amt={amt_col} tot={tot_col}")

        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        try:
            if wb is not None:
                wb.Close(SaveChanges=False)
        except Exception:
            pass
        try:
            app.Quit()
        except Exception:
            pass

if __name__ == "__main__":
    main()
