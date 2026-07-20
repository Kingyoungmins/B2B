import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import win32com.client as win32

import serve_b2b as s


SRC_DIR = Path(r"C:\Users\Admin\Downloads\5개합치기\SBAGENT-150_attachments")
OUTPUT_NAME = "output)_26년3월_LGCNS_메시징_청구자료_260313_DSMC_260527.xlsx"
INPUT_NAMES = [
    "가입자별청구내역_20260624_3월청구_339003635231_DSMC_260624.xlsx",
    "가입자별청구내역_20260624_3월청구_502208666271_DSMC_260624.xlsx",
    "가입자별청구내역_20260624_3월청구_562106289788_DSMC_260624.xlsx",
    "가입자별청구내역_20260624_3월청구_572201819546_DSMC_260624.xlsx",
    "가입자별청구내역_20260624_3월청구_581702980619_DSMC_260624.xlsx",
]


def check(name, cond, detail=""):
    if not cond:
        raise AssertionError(f"{name}: {detail}")
    print(" OK ", name)


def ws_bounds(ws):
    last_row_cell = ws.Cells.Find(What="*", LookIn=-4123, SearchOrder=1, SearchDirection=2)
    last_col_cell = ws.Cells.Find(What="*", LookIn=-4123, SearchOrder=2, SearchDirection=2)
    if last_row_cell is None or last_col_cell is None:
        return 1, 1
    return int(last_row_cell.Row), int(last_col_cell.Column)


def detect_header_and_rows(ws, scan_rows=30):
    last_row, last_col = ws_bounds(ws)
    scan_end = min(last_row, scan_rows)
    sample = ws.Range(ws.Cells(1, 1), ws.Cells(scan_end, last_col)).Value2
    if scan_end == 1:
        rows = [sample if isinstance(sample, tuple) else (sample,)]
    else:
        rows = list(sample)
    best_count = -1
    hdr = 1
    header_vals = ()
    for idx, row in enumerate(rows, start=1):
        vals = row if isinstance(row, tuple) else (row,)
        count = sum(1 for v in vals if v is not None and str(v).strip())
        if count > best_count:
            best_count = count
            hdr = idx
            header_vals = vals
    header_cols = [i + 1 for i, v in enumerate(header_vals) if v is not None and str(v).strip()]
    if not header_cols:
        return hdr, hdr, 1
    true_last_row = hdr
    for c in header_cols:
        r = int(ws.Cells(ws.Rows.Count, c).End(-4162).Row)  # xlUp
        true_last_row = max(true_last_row, r)
    return hdr, true_last_row, max(header_cols)


def main():
    tmp_root = Path(tempfile.mkdtemp(prefix="b2b_actual_sbagent150_"))
    copied = {}
    for name in [OUTPUT_NAME] + INPUT_NAMES:
        src = SRC_DIR / name
        if not src.exists():
            raise FileNotFoundError(src)
        dst = tmp_root / name
        shutil.copy2(src, dst)
        copied[name] = dst

    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    workbooks = []
    session_keys = []
    try:
        for name in INPUT_NAMES + [OUTPUT_NAME]:
            wb = app.Workbooks.Open(str(copied[name]))
            workbooks.append(wb)
            sid = "actual-sbagent150-" + str(len(session_keys))
            session_keys.append(sid)
            s.EXCEL_SESSIONS[sid] = {
                "path": str(copied[name]),
                "openPath": str(copied[name]),
                "app": app,
                "workbook": wb,
                "liveEditable": True,
            }
            s.WORKBOOKS[sid] = {"id": sid, "name": name, "path": str(copied[name])}

        expected_data_rows = 0
        first_header = None
        for name in INPUT_NAMES:
            wb = next(w for w in workbooks if Path(str(w.FullName)).name == name)
            ws = wb.Worksheets(1)
            hdr, last_row, last_col = detect_header_and_rows(ws)
            if first_header is None:
                first_header = [ws.Cells(hdr, c).Text for c in range(1, min(last_col, 8) + 1)]
            expected_data_rows += max(0, last_row - hdr)
            print(f" SRC {name}: sheet={ws.Name}, headerRow={hdr}, lastRow={last_row}, lastCol={last_col}")

        output_wb = next(w for w in workbooks if Path(str(w.FullName)).name == OUTPUT_NAME)
        use_output_book_receiver = "--book-receiver" in sys.argv
        if use_output_book_receiver:
            call = f'ctx.book({OUTPUT_NAME!r}).append_same_format_sheets({INPUT_NAMES!r}, dest_sheet="가입자별청구내역_통합", src_sheet=None)'
        else:
            call = f'ctx.append_same_format_sheets({INPUT_NAMES!r}, dest_sheet="가입자별청구내역_통합", src_sheet=None)'
        code = f'''
def transform(ctx):
    {call}
'''
        result = s._exec_python_com_skill(
            app,
            output_wb,
            s.EXCEL_SESSIONS[session_keys[-1]],
            code,
        )
        print(" SUMMARY", result)

        sheet_names = [output_wb.Worksheets(i).Name for i in range(1, output_wb.Worksheets.Count + 1)]
        new_name = next((name for name in sheet_names if name.startswith("가입자별청구내역_통합")), None)
        check("new integration sheet exists", new_name is not None, sheet_names)
        ws = output_wb.Worksheets(new_name)
        out_last_row, out_last_col = ws_bounds(ws)
        check("result has header + all data rows", out_last_row == expected_data_rows + 1,
              f"expected {expected_data_rows + 1}, got {out_last_row}")
        header = [ws.Cells(1, c).Text for c in range(1, min(out_last_col, 8) + 1)]
        check("header copied from detected first source header", header == first_header,
              f"expected {first_header}, got {header}")

        header_repeats = 0
        for r in range(1, out_last_row + 1):
            row_head = [ws.Cells(r, c).Text for c in range(1, min(out_last_col, 8) + 1)]
            if row_head == header:
                header_repeats += 1
        check("header appears once", header_repeats == 1, f"header repeats={header_repeats}")
        row2 = [ws.Cells(2, c).Text for c in range(1, min(out_last_col, 8) + 1)]
        check("data starts at row 2", row2 != header and any(str(v).strip() for v in row2),
              f"row2={row2}")
        check("copied more than one source", out_last_row > 3, out_last_row)

        output_wb.Save()
        print(" RESULT_FILE", copied[OUTPUT_NAME])
    finally:
        for wb in workbooks:
            try:
                wb.Close(SaveChanges=False)
            except Exception:
                pass
        try:
            app.Quit()
        except Exception:
            pass
        for sid in session_keys:
            s.EXCEL_SESSIONS.pop(sid, None)
            s.WORKBOOKS.pop(sid, None)


if __name__ == "__main__":
    main()
