# [0.5.16] 새 ctx 헬퍼 라이브 COM 테스트: lookup / add_total_row / dedupe / split_column / replace
import os, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import win32com.client as win32
import serve_b2b as s


def check(name, cond, detail=""):
    if not cond:
        raise AssertionError(f"FAIL {name}: {detail}")
    print(" OK ", name)


def main():
    path = str(Path(tempfile.gettempdir()) / "b2b_pycom_new_helpers.xlsx")
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
        t = wb.Worksheets(1); t.Name = "단가표"
        t.Range("A1:B1").Value = [["상품", "단가"]]
        t.Range("A2:B3").Value = [["안전제일", 5000], ["보통", 3000]]

        lk = wb.Worksheets.Add(); lk.Name = "청구내역"
        lk.Range("A1:C1").Value = [["회사", "상품", "금액"]]
        lk.Range("A2:C4").Value = [["A통신", "안전제일", 100], ["B텔레콤", "보통", 200], ["A통신", "안전제일", 100]]

        tot = wb.Worksheets.Add(); tot.Name = "합계테스트"
        tot.Range("A1:B1").Value = [["회사", "금액"]]
        tot.Range("A2:B4").Value = [["A", 100], ["B", 200], ["C", 300]]

        du = wb.Worksheets.Add(); du.Name = "중복테스트"
        du.Range("A1:B1").Value = [["가입번호", "값"]]
        du.Range("A2:B5").Value = [["1001", "x"], ["1002", "y"], ["1001", "z"], ["1003", "w"]]

        sp = wb.Worksheets.Add(); sp.Name = "분리테스트"
        sp.Range("A1").Value = "가입자"
        sp.Range("A2:A4").Value = [["1001/홍길동"], ["1002/김철수"], ["1003/이영"]]

        rp = wb.Worksheets.Add(); rp.Name = "치환테스트"
        rp.Range("A1:B1").Value = [["상태", "금액"]]
        rp.Range("A2:B4").Value = [["안전제일", "100"], ["보통", "200"], ["안전제일", "300"]]

        wb.SaveAs(path, FileFormat=51)
        ctx = s.PythonComSkillContext(app, wb, {"path": path, "workbook": wb, "app": app})

        # 1) lookup — 상품 키로 단가표 단가를 D열에 채움
        n = ctx.lookup("청구내역", key_col="상품", into_col="D",
                       table_sheet="단가표", table_key_col="상품", table_val_col="단가")
        dvals = [int(lk.Range(f"D{i}").Value) for i in range(2, 5)]
        check("lookup matched 3", n == 3, n)
        check("lookup values", dvals == [5000, 3000, 5000], dvals)

        # 2) add_total_row — 금액 합계 행
        tr = ctx.add_total_row("합계테스트", sum_cols=["금액"], label_col="회사", label="합계")
        app.Calculate()
        check("total row index", tr == 5, tr)
        check("total label", str(tot.Range("A5").Value) == "합계", tot.Range("A5").Value)
        check("total sum=600", int(tot.Range("B5").Value) == 600, tot.Range("B5").Value)

        # 3) dedupe — 가입번호 기준, keep=last(첫 1001 제거)
        rm = ctx.dedupe("중복테스트", key_cols=["가입번호"], keep="last")
        bvals = [str(du.Range(f"B{i}").Value) for i in range(2, 5)]
        check("dedupe removed 1", rm == 1, rm)
        check("dedupe kept last(z), removed first(x)", ("x" not in bvals) and ("z" in bvals), bvals)

        # 4) split_column — "1001/홍길동" → 가입번호/고객명 (원본 오른쪽 새 열)
        cnt = ctx.split_column("분리테스트", col="가입자", delimiter="/", into=["가입번호", "고객명"])
        check("split count 3", cnt == 3, cnt)
        check("split headers", str(sp.Range("B1").Value) == "가입번호" and str(sp.Range("C1").Value) == "고객명",
              (sp.Range("B1").Value, sp.Range("C1").Value))
        check("split 고객명", str(sp.Range("C2").Value) == "홍길동", sp.Range("C2").Value)
        check("split 가입번호", str(sp.Range("B2").Value).split(".")[0] == "1001", sp.Range("B2").Value)
        check("split 원본 보존", str(sp.Range("A2").Value) == "1001/홍길동", sp.Range("A2").Value)

        # 5) replace — "안전제일" → "프리미엄"
        ch = ctx.replace("치환테스트", "A2:A4", "안전제일", "프리미엄")
        avals = [str(rp.Range(f"A{i}").Value) for i in range(2, 5)]
        check("replace count 2", ch == 2, ch)
        check("replace applied", avals == ["프리미엄", "보통", "프리미엄"], avals)

        print("\n=== ALL NEW HELPER TESTS PASSED (5/5) ===")
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
