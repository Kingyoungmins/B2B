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


def make_source(app, path, rows):
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1)
    ws.Name = "sheet"
    ws.Range("A1").Value = "가입자별청구내역"
    ws.Range("A3:C3").Value = [["가입번호", "청구금액", "EID"]]
    ws.Columns(3).NumberFormat = "@"
    ws.Range(ws.Cells(4, 1), ws.Cells(3 + len(rows), 3)).Value = rows
    wb.SaveAs(path, FileFormat=51)
    return wb


def main():
    tmp = Path(tempfile.gettempdir())
    src1_path = str(tmp / "b2b_append_src1.xlsx")
    src2_path = str(tmp / "b2b_append_src2.xlsx")
    dst_path = str(tmp / "b2b_append_dst.xlsx")
    for p in (src1_path, src2_path, dst_path):
        try:
            os.remove(p)
        except FileNotFoundError:
            pass

    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    src1 = src2 = dst = None
    keys = ("append-src1", "append-src2", "append-dst")
    try:
        src1 = make_source(app, src1_path, [
            ["A001", 1000, "89033023311240000000012140033938"],
            ["A002", 2000, "89033023311240000000012140033939"],
        ])
        src2 = make_source(app, src2_path, [
            ["B001", 3000, "89033023311240000000012140033940"],
            ["B002", 4000, "89033023311240000000012140033941"],
        ])
        dst = app.Workbooks.Add()
        dst.Worksheets(1).Name = "output"
        dst.SaveAs(dst_path, FileFormat=51)

        books = [
            ("append-src1", src1_path, src1),
            ("append-src2", src2_path, src2),
            ("append-dst", dst_path, dst),
        ]
        for sid, path, wb in books:
            s.EXCEL_SESSIONS[sid] = {"path": path, "app": app, "workbook": wb, "liveEditable": True}
            s.WORKBOOKS[sid] = {"id": sid, "name": Path(path).name, "path": path}

        ctx = s.PythonComSkillContext(app, dst, s.EXCEL_SESSIONS["append-dst"])
        new_name = ctx.append_same_format_sheets(
            [Path(src1_path).name, Path(src2_path).name],
            dest_sheet="가입자별청구내역_통합",
            src_sheet=None,
        )
        ws = dst.Worksheets(new_name)

        check("new sheet created", new_name.startswith("가입자별청구내역_통합"), new_name)
        check("header copied once from detected row 3", ws.Range("A1").Value == "가입번호", ws.Range("A1").Value)
        check("first source data begins at row 2", ws.Range("A2").Value == "A001", ws.Range("A2").Value)
        check("second source data appended without header", ws.Range("A4").Value == "B001", ws.Range("A4").Value)
        check("no blank A1-only result", int(ws.UsedRange.Rows.Count) == 5, ws.UsedRange.Rows.Count)
        check("long EID preserved after native copy", str(ws.Range("C5").Value) == "89033023311240000000012140033941", ws.Range("C5").Value)
        check("long EID text format preserved", str(ws.Range("C5").NumberFormat) == "@", ws.Range("C5").NumberFormat)
    finally:
        for wb in (src1, src2, dst):
            try:
                if wb is not None:
                    wb.Close(SaveChanges=False)
            except Exception:
                pass
        try:
            app.Quit()
        except Exception:
            pass
        for key in keys:
            s.EXCEL_SESSIONS.pop(key, None)
            s.WORKBOOKS.pop(key, None)


if __name__ == "__main__":
    main()
