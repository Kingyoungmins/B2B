# -*- coding: utf-8 -*-
# [SBAGENT-293 후속 실측] 시스템 추출 보고서의 '안내 줄 수'는 달마다 변한다(도서 파일 9줄→10줄).
# 고정 delete_rows("1:9") 가 헤더를 어긋나게 만들던 것을, find_header_row(헤더 행 탐지) 후
# 그 위 삭제 패턴으로 대체 — 안내가 몇 줄이든 같은 결과가 나오는지 실제 Excel 로 검증.
import sys, os, traceback
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as w
import serve_b2b as S

class Ctx(S.PythonComSkillContext):
    def __init__(self, wb, app):
        self._wb = wb; self._app = app; self._session = None
        self._shared = {"com_calls": 0, "deadline": float("inf"),
                        "journal": [], "structural": [], "books": {}}

fails = 0
def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:160]) if (not cond and detail) else ""))
    if not cond:
        fails += 1

app = w.DispatchEx("Excel.Application")
app.Visible = False; app.DisplayAlerts = False
try:
    wb = app.Workbooks.Add()
    while wb.Worksheets.Count > 1:
        wb.Worksheets(wb.Worksheets.Count).Delete()

    def build(notice_rows):
        ws = wb.Worksheets(1)
        ws.Cells.Clear()
        for r in range(1, notice_rows + 1):
            ws.Cells(r, 1).Value = f"■ 안내 {r}"
        h = notice_rows + 1
        for c, name in enumerate(["청구수령인명", "청구계정번호", "효력발생일자"], 1):
            ws.Cells(h, c).Value = name
        ws.Cells(h + 1, 1).Value = "데이터1"; ws.Cells(h + 1, 3).Value = "20260601"
        ws.Cells(h + 2, 1).Value = "데이터2"; ws.Cells(h + 2, 3).Value = "20260223"
        return ws

    for notice in (9, 10):
        build(notice)
        ctx = Ctx(wb, app)
        sheet = wb.Worksheets(1).Name
        hdr = ctx.find_header_row(sheet, "효력발생일자")
        check(f"안내 {notice}줄 → 헤더 행 {notice+1} 탐지", hdr == notice + 1, hdr)
        if hdr > 1:
            ctx.delete_rows(sheet, f"1:{hdr-1}")
        first = [wb.Worksheets(1).Cells(1, c).Value for c in range(1, 4)]
        check(f"안내 {notice}줄 → 삭제 후 1행이 헤더", first == ["청구수령인명", "청구계정번호", "효력발생일자"], first)
        col = ctx.find_header(sheet, "효력발생일자", header_row=1)
        check(f"안내 {notice}줄 → 이후 find_header 정상", col == 3, col)

    build(9)
    ctx = Ctx(wb, app)
    try:
        ctx.find_header_row(wb.Worksheets(1).Name, "없는헤더")
        check("없는 헤더는 친절한 오류", False)
    except Exception as e:
        check("없는 헤더는 친절한 오류", "찾지 못했습니다" in str(e), e)
except Exception:
    traceback.print_exc(); fails += 1
finally:
    try:
        for _wb in list(app.Workbooks): _wb.Close(SaveChanges=False)
    except Exception: pass
    try: app.Quit()
    except Exception: pass

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)
