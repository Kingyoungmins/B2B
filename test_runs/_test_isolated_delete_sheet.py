#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""백엔드 E2E: ctx.book("X").delete_sheet 를 'X 세션'에서 격리 실행하면 라이브 X 에 실제 반영되는가.
(프론트 라우팅 패치가 이 스텝을 X 세션으로 보내준다는 전제. 여기선 백엔드가 X로 실행됐을 때
시트 삭제가 reflect 까지 되는지 = '적용됨인데 안 지워짐'의 백엔드 절반을 검증.)
보호 상태(읽기전용 미러)도 재현. 비파괴: 임시 파일만."""
import os, sys, tempfile, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

def make_file(path):
    app = win32.DispatchEx("Excel.Application"); app.Visible=False; app.DisplayAlerts=False
    try:
        wb = app.Workbooks.Add()
        # 기본 1시트 + 2개 추가 → keep / target_del / extra
        wb.Worksheets(1).Name = "keep"
        wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count)).Name = "target_del"
        wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count)).Name = "extra"
        wb.Worksheets("keep").Range("A1").Value = "alive"
        wb.SaveAs(path, FileFormat=51); wb.Close(False)
    finally:
        app.Quit()

def main():
    f = os.path.join(tempfile.gettempdir(), "del_B.xlsx")
    make_file(f)
    live = win32.DispatchEx("Excel.Application"); live.Visible=False; live.DisplayAlerts=False
    rc = 1
    try:
        wb = live.Workbooks.Open(f)
        s.EXCEL_SESSIONS["B"] = {"path": f, "sourcePath": f, "name": "del_B.xlsx",
                                 "app": live, "workbook": wb, "liveEditable": True}
        s.WORKBOOKS["B"] = {"id": "B", "name": "del_B.xlsx", "path": f}
        s._protect_workbook_for_read_only_mirror(wb, True)  # 읽기전용 미러 보호 재현
        before = [str(x.Name) for x in wb.Worksheets]
        print("before sheets:", before)

        step = {"stepIdx": 0, "stepId": "d1", "language": "python",
                "description": "다른 파일 시트 삭제",
                "code": 'def transform(ctx):\n    ctx.book("del_B.xlsx").delete_sheet("target_del")\n'}
        res = s._run_vba_pipeline_on_session_impl("B", [step], reset=True)
        after = [str(x.Name) for x in wb.Worksheets]
        print("result:", res)
        print("after sheets :", after)
        ok = res.get("ok") and ("target_del" not in after) and ("keep" in after) and ("extra" in after)
        print("RESULT:", "OK (시트 삭제가 라이브에 반영됨)" if ok else "FAIL (반영 안 됨 — reflect 가 시트 제거 못함)")
        rc = 0 if ok else 2
        wb.Close(False)
    except Exception as e:
        import traceback; traceback.print_exc(); print("EXC:", e)
    finally:
        live.Quit()
        for k in ("B",): s.EXCEL_SESSIONS.pop(k, None); s.WORKBOOKS.pop(k, None)
    sys.exit(rc)

if __name__ == "__main__":
    main()
