#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""백엔드 E2E 회귀(SBAGENT-138): 교차파일 쓰기 결과 유실 수정 검증.

증상: 'A의 시트를 B에 복사' 같은 교차파일 스텝이 (라우팅에 따라) B 가 아닌
다른 세션에서 ftarget 으로 돌면, B 는 읽기/버려지는 '동반본(companion)'이라
복사 결과가 라이브 B 에 반영되지 않는다 → 다음 스텝이 'B에 그 시트 없음'으로 실패.
(8번 통과/22번 실패가 판마다 뒤바뀌던 비결정 버그의 백엔드 근본원인.)

수정: 격리 실행 후 변경된(Saved=False) 동반본을 그 라이브 세션으로 되돌려쓴다
(_sync_modified_companions_into_live).

이 테스트는 일부러 '잘못된' 세션 A 로 교차복사 스텝을 실행해, B(동반본) 쓰기가
라이브 B 에 반영되는지 확인한다. 비파괴: 임시 파일만 사용. VBA 주입(VBOM) 필요.
"""
import os, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s


def make_src(path):
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    try:
        wb = app.Workbooks.Add()
        while wb.Worksheets.Count > 1:
            wb.Worksheets(wb.Worksheets.Count).Delete()
        wb.Worksheets(1).Name = "Sheet1"
        wb.Worksheets("Sheet1").Range("A1").Value = "from_A_marker"
        wb.SaveAs(path, FileFormat=51); wb.Close(False)
    finally:
        app.Quit()


def make_dst(path):
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    try:
        wb = app.Workbooks.Add()
        wb.Worksheets(1).Name = "keep"
        wb.Worksheets("keep").Range("A1").Value = "dst_alive"
        wb.SaveAs(path, FileFormat=51); wb.Close(False)
    finally:
        app.Quit()


def main():
    fa = os.path.join(tempfile.gettempdir(), "cwb_src_A.xlsx")
    fb = os.path.join(tempfile.gettempdir(), "cwb_dst_B.xlsx")
    make_src(fa); make_dst(fb)
    appA = win32.DispatchEx("Excel.Application"); appA.Visible = False; appA.DisplayAlerts = False
    appB = win32.DispatchEx("Excel.Application"); appB.Visible = False; appB.DisplayAlerts = False
    rc = 1
    try:
        wbA = appA.Workbooks.Open(fa)
        wbB = appB.Workbooks.Open(fb)
        s.EXCEL_SESSIONS["A"] = {"path": fa, "sourcePath": fa, "name": "cwb_src_A.xlsx",
                                 "app": appA, "workbook": wbA, "liveEditable": True}
        s.EXCEL_SESSIONS["B"] = {"path": fb, "sourcePath": fb, "name": "cwb_dst_B.xlsx",
                                 "app": appB, "workbook": wbB, "liveEditable": True}
        s.WORKBOOKS["A"] = {"id": "A", "name": "cwb_src_A.xlsx", "path": fa}
        s.WORKBOOKS["B"] = {"id": "B", "name": "cwb_dst_B.xlsx", "path": fb}

        before = [str(x.Name) for x in wbB.Worksheets]
        print("B before:", before)

        # 교차복사 스텝: A 의 Sheet1 을 B 맨 뒤에 복사. (step22 와 동형)
        code = (
            "Sub B2BSkill()\n"
            "    Dim wbSrc As Workbook, wbDst As Workbook, wb As Workbook\n"
            "    For Each wb In Application.Workbooks\n"
            "        If wb.Name = \"cwb_src_A.xlsx\" Then Set wbSrc = wb\n"
            "        If wb.Name = \"cwb_dst_B.xlsx\" Then Set wbDst = wb\n"
            "    Next wb\n"
            "    If wbSrc Is Nothing Then Err.Raise 513, , \"src not open\"\n"
            "    If wbDst Is Nothing Then Err.Raise 513, , \"dst not open\"\n"
            "    wbSrc.Worksheets(\"Sheet1\").Copy After:=wbDst.Worksheets(wbDst.Worksheets.Count)\n"
            "End Sub\n"
        )
        step = {"stepIdx": 0, "stepId": "c1", "language": "vba",
                "description": "A의 Sheet1을 B에 복사(일부러 A 세션=ftarget, B=동반본 라우팅)",
                "code": code}

        # 일부러 '잘못된' 세션 A 로 실행 → B 는 companion. 수정 전이면 B 라이브에 반영 안 됨.
        res = s._run_vba_pipeline_on_session_impl("A", [step], reset=False)

        after = [str(x.Name) for x in wbB.Worksheets]
        print("res:", res)
        print("B after :", after)
        new_sheets = [n for n in after if n not in before]
        ok = bool(res.get("ok")) and "keep" in after and len(after) == len(before) + 1 and len(new_sheets) == 1
        if ok:
            print("RESULT: OK (companion B writeback reflected to live B - cross-file persist fixed)")
            rc = 0
        else:
            print("RESULT: FAIL (B did not receive copy - companion change discarded)")
            rc = 2
        wbA.Close(False); wbB.Close(False)
    except Exception as e:
        import traceback; traceback.print_exc()
        msg = str(e)
        if "VBProject" in msg or "programmatic access" in msg.lower() or "vbom" in msg.lower():
            print("RESULT: SKIP (VBA 프로젝트 접근(VBOM) 비활성 — 이 환경에선 VBA 주입 불가)")
            rc = 0
        else:
            print("RESULT: FAIL(EXC):", msg)
            rc = 2
    finally:
        try: appA.Quit()
        except Exception: pass
        try: appB.Quit()
        except Exception: pass
        for k in ("A", "B"):
            s.EXCEL_SESSIONS.pop(k, None); s.WORKBOOKS.pop(k, None)
        for f in (fa, fb):
            try: os.unlink(f)
            except Exception: pass
    sys.exit(rc)


if __name__ == "__main__":
    main()
