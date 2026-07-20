#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SBAGENT-138: ctx API 관대화 검증(자주 뜨던 에러 2종).
- read_cell: write_cell 은 있는데 read_cell 이 없어서 'object has no attribute read_cell' 실패하던 것 -> 추가.
- delete_cols/delete_rows 의 범위 문자열('Q:AU','5:9') -> '잘못된 열 문자' 실패하던 것 -> Excel 에 위임.
비파괴: 임시 파일만. VBA 불필요(순수 ctx).
"""
import os, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

SH = "619299519426_조회"


def make_file(path):
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    try:
        wb = app.Workbooks.Add()
        ws = wb.Worksheets(1); ws.Name = SH
        for r in range(1, 21):          # 20행
            for c in range(1, 53):      # 52열 (A..AZ)
                ws.Cells(r, c).Value = r * 100 + c
        ws.Cells(2, 1).Value = 5        # A2 = 5 (read_cell 테스트용)
        wb.SaveAs(path, FileFormat=51); wb.Close(False)
    finally:
        app.Quit()


def main():
    f = os.path.join(tempfile.gettempdir(), "ctx_range_test.xlsx")
    make_file(f)
    live = win32.DispatchEx("Excel.Application"); live.Visible = False; live.DisplayAlerts = False
    rc = 1
    try:
        wb = live.Workbooks.Open(f)
        s.EXCEL_SESSIONS["T"] = {"path": f, "sourcePath": f, "name": "ctx_range_test.xlsx",
                                 "app": live, "workbook": wb, "liveEditable": True}
        s.WORKBOOKS["T"] = {"id": "T", "name": "ctx_range_test.xlsx", "path": f}
        ws = wb.Worksheets(SH)
        cols0 = int(ws.UsedRange.Columns.Count); rows0 = int(ws.UsedRange.Rows.Count)

        steps = [
            {"stepIdx": 0, "stepId": "c1", "language": "python", "description": "열범위 삭제",
             "code": f'def transform(ctx):\n    ctx.delete_cols("{SH}", "Q:AU")\n'},
            {"stepIdx": 1, "stepId": "c2", "language": "python", "description": "read_cell->write_cell",
             "code": f'def transform(ctx):\n    v = ctx.read_cell("{SH}", "A2")\n    ctx.write_cell("{SH}", "B2", float(v) * 10)\n'},
            {"stepIdx": 2, "stepId": "c3", "language": "python", "description": "행범위 삭제",
             "code": f'def transform(ctx):\n    ctx.delete_rows("{SH}", "5:9")\n'},
        ]
        res = s._run_vba_pipeline_on_session_impl("T", steps, reset=True)

        ws = wb.Worksheets(SH)  # 시트 교체 반영 후 재취득
        cols1 = int(ws.UsedRange.Columns.Count); rows1 = int(ws.UsedRange.Rows.Count)
        b2 = ws.Cells(2, 2).Value
        print("res ok:", res.get("ok"))
        print(f"cols {cols0}->{cols1} (delete Q:AU = 31 cols)")
        print(f"rows {rows0}->{rows1} (delete 5:9 = 5 rows)")
        print("B2 (read_cell A2 * 10):", b2)

        ok = (bool(res.get("ok"))
              and (cols0 - cols1 == 31)
              and (rows0 - rows1 == 5)
              and b2 is not None and abs(float(b2) - 50.0) < 1e-6)
        print("RESULT:", "OK (read_cell + col/row range 정상)" if ok else "FAIL")
        rc = 0 if ok else 2
        wb.Close(False)
    except Exception as e:
        import traceback; traceback.print_exc()
        print("RESULT: FAIL(EXC):", str(e)[:200])
        rc = 2
    finally:
        try: live.Quit()
        except Exception: pass
        for k in ("T",):
            s.EXCEL_SESSIONS.pop(k, None); s.WORKBOOKS.pop(k, None)
        try: os.unlink(f)
        except Exception: pass
    sys.exit(rc)


if __name__ == "__main__":
    main()
