import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import win32com.client as win32

import serve_b2b as s


def check(name, cond, detail=""):
    if not cond:
        raise AssertionError(f"{name}: {detail}")
    print(" OK ", name)


def main():
    path = str(Path(tempfile.gettempdir()) / "b2b_pycom_sort_4keys.xlsx")
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
        ws = wb.Worksheets(1)
        ws.Name = "안전제일_추출"
        headers = ["ID", "B", "EID", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"]
        rows = [
            # T, D, M, N sort order should make this row second.
            ["r2", "", "89033023311240000000012140033938", "A", "", "", "", "", "", "", "", "", "B", "B", "", "", "", "", "", "A"],
            # This row should come first because M=A under same T/D.
            ["r1", "", "89033023311240000000012140033937", "A", "", "", "", "", "", "", "", "", "A", "Z", "", "", "", "", "", "A"],
            # This row should come third because T=B.
            ["r3", "", "89033023311240000000012140033939", "A", "", "", "", "", "", "", "", "", "A", "A", "", "", "", "", "", "B"],
        ]
        ws.Range("A1:T1").Value = [headers]
        ws.Range("A2:T4").NumberFormat = "@"
        ws.Range("A2:T4").Value = rows
        wb.SaveAs(path, FileFormat=51)

        ctx = s.PythonComSkillContext(app, wb, {"path": path, "workbook": wb, "app": app})
        ctx.sort("안전제일_추출", "A1:T4", key_col=["T", "D", "M", "N"], ascending=[True, True, True, True], has_header=True)

        sorted_ids = [ws.Range(f"A{i}").Value for i in range(2, 5)]
        eid_values = [str(ws.Range(f"C{i}").Value) for i in range(2, 5)]
        check("four-key sort order", sorted_ids == ["r1", "r2", "r3"], sorted_ids)
        check("long numeric text preserved", eid_values == [
            "89033023311240000000012140033937",
            "89033023311240000000012140033938",
            "89033023311240000000012140033939",
        ], eid_values)
        check("long numeric cells remain text formatted", str(ws.Range("C2").NumberFormat) == "@", ws.Range("C2").NumberFormat)

        long_id = "89033023311240000000012140034999"
        ctx.write("안전제일_추출", "C7", [[long_id]], overwrite_formulas=True)
        check("ctx.write preformats long numeric text", str(ws.Range("C7").NumberFormat) == "@", ws.Range("C7").NumberFormat)
        check("ctx.write preserves long numeric text", str(ws.Range("C7").Value) == long_id, ws.Range("C7").Value)
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
