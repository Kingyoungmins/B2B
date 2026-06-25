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


def make_book(app, path, sheet_name, values):
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1)
    ws.Name = sheet_name
    rows = len(values)
    cols = len(values[0])
    ws.Range(ws.Cells(1, 1), ws.Cells(rows, cols)).Value = values
    ws.Range("B2").Formula = "=A2*2"
    wb.SaveAs(path, FileFormat=51)
    return wb


def main():
    tmp = Path(tempfile.gettempdir())
    src_path = str(tmp / "b2b_pycom_copy_src.xlsx")
    dst_path = str(tmp / "b2b_pycom_copy_dst.xlsx")
    for p in (src_path, dst_path):
        try:
            os.remove(p)
        except FileNotFoundError:
            pass

    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    try:
        src_wb = make_book(app, src_path, "sheet", (("id", "formula"), (7, 14), (8, 16)))
        dst_wb = make_book(app, dst_path, "out", (("x", "y"), (1, 2), (3, 4)))
        src_name = Path(src_path).name
        dst_name = Path(dst_path).name
        s.EXCEL_SESSIONS["copy-src"] = {"path": src_path, "app": app, "workbook": src_wb, "liveEditable": True}
        s.EXCEL_SESSIONS["copy-dst"] = {"path": dst_path, "app": app, "workbook": dst_wb, "liveEditable": True}
        s.WORKBOOKS["copy-src"] = {"id": "copy-src", "name": src_name, "path": src_path}
        s.WORKBOOKS["copy-dst"] = {"id": "copy-dst", "name": dst_name, "path": dst_path}

        ctx = s.PythonComSkillContext(app, dst_wb, s.EXCEL_SESSIONS["copy-dst"])
        ctx.copy(f"{src_name}!sheet", "A1:B3", "out", "D1")
        ctx.copy(f"[{src_name}]sheet", "A1:B3", "out", "G1")

        out = dst_wb.Worksheets("out")
        check("cross-file value copied", out.Range("D2").Value == 7, out.Range("D2").Value)
        check("cross-file formula copied", str(out.Range("E2").Formula) == "=D2*2", out.Range("E2").Formula)
        check("bracket sheet spec value copied", out.Range("G2").Value == 7, out.Range("G2").Value)
        check("bracket sheet spec formula copied", str(out.Range("H2").Formula) == "=G2*2", out.Range("H2").Formula)
    finally:
        try:
            src_wb.Close(SaveChanges=False)
        except Exception:
            pass
        try:
            dst_wb.Close(SaveChanges=False)
        except Exception:
            pass
        try:
            app.Quit()
        except Exception:
            pass
        for k in ("copy-src", "copy-dst"):
            s.EXCEL_SESSIONS.pop(k, None)
            s.WORKBOOKS.pop(k, None)


if __name__ == "__main__":
    main()
