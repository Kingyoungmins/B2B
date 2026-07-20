# [0.5.18] 저장 스킬 월/날짜 재바인딩: 4월용 파일명을 5월 파일에 돌릴 때 유사도(안정키)로 매칭.
# ctx.book("...03월...") 와 VBA Workbooks("...03월...") 리터럴이 열린 "...05월..." 로 풀리는지 + 모호하면 거부.
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

def mk(app, name):
    p = os.path.join(tempfile.gettempdir(), name)
    try: os.remove(p)
    except FileNotFoundError: pass
    wb = app.Workbooks.Add()
    wb.Worksheets(1).Name = "Sheet1"; wb.Worksheets(1).Cells(1, 1).Value = "x"
    wb.SaveAs(p, FileFormat=51)
    return wb, p

APR = "input_작업파일_03. 관악_03월.xlsx"   # 저장 스킬이 참조하는 이름(4월/3월용)
MAY = "input_작업파일_05. 관악_05월.xlsx"   # 실제 업로드된 파일
JUN = "input_작업파일_06. 관악_06월.xlsx"   # 모호성 유발용

def main():
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    wbs = []
    try:
        mayWb, _ = mk(app, MAY); wbs.append(mayWb)
        ctx = s.PythonComSkillContext(app, mayWb, {"path": MAY, "workbook": mayWb, "app": app})

        # 1) ctx.book("...03월...") → 열린 "...05월..." 로 (유일 안정키 매칭)
        sub = ctx.book(APR)
        check("ctx.book(4월 이름) → 5월 파일로 매칭", str(sub._wb.Name) == MAY, str(sub._wb.Name))
        # 2) 정확 이름도 여전히 동작
        sub2 = ctx.book(MAY)
        check("ctx.book(정확 이름) 정상", str(sub2._wb.Name) == MAY, str(sub2._wb.Name))
        # 3) VBA 워크북 리터럴 재작성: "...03월..." → "...05월..."
        code = 'Sub B2BSkill()\n  Set wb = Workbooks("%s")\nEnd Sub' % APR
        newcode = s._normalize_vba_workbook_literals(app, code)
        check("VBA Workbooks(4월) 리터럴 → 5월로 재작성", MAY in newcode and APR not in newcode, newcode)
        # 4) _resolve_open_workbook_name 직접
        check("_resolve_open_workbook_name(4월)=5월", s._resolve_open_workbook_name(app, APR) == MAY)

        # 5) 모호(05월·06월 둘 다 열림) → 자동 매칭 거부(엉뚱한 파일 방지)
        junWb, _ = mk(app, JUN); wbs.append(junWb)
        ctx3 = s.PythonComSkillContext(app, mayWb, {"path": MAY, "workbook": mayWb, "app": app})
        raised = False
        try:
            ctx3.book(APR)
        except s.PythonComSkillError:
            raised = True
        check("모호하면 자동 매칭 안 함(book raise)", raised)
        check("모호하면 _resolve 도 요청명 그대로(미매칭)", s._resolve_open_workbook_name(app, APR) == APR)
        # 6) 강남(다른 사업장)만 열려 있으면 매칭 안 함
        for wb in list(wbs):
            try: wb.Close(SaveChanges=False)
            except Exception: pass
        wbs = []
        gnWb, _ = mk(app, "input_작업파일_05. 강남_05월.xlsx"); wbs.append(gnWb)
        check("관악 요청, 강남만 열림 → 매칭 안 함", s._resolve_open_workbook_name(app, APR) == APR)

        # 7) 시트명에 월/날짜: ctx._ws("SO정산_2026년04월") → 실제 "SO정산_2026년05월"
        shWb, _ = mk(app, "sheetmonth_test.xlsx"); wbs.append(shWb)
        shWb.Worksheets(1).Name = "SO정산_2026년05월"
        ctxSh = s.PythonComSkillContext(app, shWb, {"path": "sheetmonth_test.xlsx", "workbook": shWb, "app": app})
        ws = ctxSh._ws("SO정산_2026년04월")
        check("_ws(월 다른 시트명) → 실제 시트 매칭", str(ws.Name) == "SO정산_2026년05월", str(ws.Name))
        shWb.Worksheets.Add().Name = "SO정산_2026년06월"   # 같은 안정키 2개 → 모호
        raised = False
        try:
            s.PythonComSkillContext(app, shWb, {"path": "x", "workbook": shWb, "app": app})._ws("SO정산_2026년04월")
        except s.PythonComSkillError:
            raised = True
        check("월 다른 시트가 2개면 모호 → 매칭 안 함", raised)

        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        for wb in wbs:
            try: wb.Close(SaveChanges=False)
            except Exception: pass
        try: app.Quit()
        except Exception: pass

if __name__ == "__main__":
    main()
