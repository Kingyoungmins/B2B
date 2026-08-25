# -*- coding: utf-8 -*-
# [SBAGENT-295 실측] ctx.move_sheet — 같은 파일 안 시트 위치 변경.
# 헬퍼가 없어서 모델이 원시 COM(ctx.Sheets AttributeError)이나 복사+삭제+rename '교체'로
# 흉내내다 죽던 것의 본수정. COM 동작은 실제 Excel 로만 검증한다(메모리 원칙).
import sys, os, tempfile, traceback
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import win32com.client as w
import serve_b2b as S

class Ctx(S.PythonComSkillContext):
    def __init__(self, wb, app):
        self._wb = wb
        self._app = app
        self._session = None
        self._shared = {"com_calls": 0, "deadline": float("inf"),
                        "journal": [], "structural": [], "books": {}}

fails = 0
def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:160]) if (not cond and detail) else ""))
    if not cond:
        fails += 1

def names(wb):
    return [wb.Worksheets(i).Name for i in range(1, wb.Worksheets.Count + 1)]

app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
try:
    wb = app.Workbooks.Add()
    while wb.Worksheets.Count > 1:
        wb.Worksheets(wb.Worksheets.Count).Delete()
    wb.Worksheets(1).Name = "요약"
    for nm in ("7월raw", "6월raw", "5월raw"):
        wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count)).Name = nm
    ctx = Ctx(wb, app)
    check("초기 순서", names(wb) == ["요약", "7월raw", "6월raw", "5월raw"], names(wb))

    ctx.move_sheet("5월raw", after="요약")
    check("after 이동(실사용 시나리오: 새 달을 요약 뒤로)", names(wb) == ["요약", "5월raw", "7월raw", "6월raw"], names(wb))

    ctx.move_sheet("6월raw", before="7월raw")
    check("before 이동", names(wb) == ["요약", "5월raw", "6월raw", "7월raw"], names(wb))

    ctx.move_sheet("요약")
    check("기준 없으면 맨 뒤", names(wb) == ["5월raw", "6월raw", "7월raw", "요약"], names(wb))

    ctx.move_sheet("요약", before="5월raw")
    check("맨 앞으로 복귀", names(wb)[0] == "요약", names(wb))

    try:
        ctx.move_sheet("없는시트", after="요약")
        check("없는 시트는 예외", False)
    except Exception as e:
        check("없는 시트는 예외(친절 문구)", "시트" in str(e), e)

    try:
        ctx.move_sheet("요약", before="5월raw", after="6월raw")
        check("before+after 동시 지정 거부", False)
    except Exception as e:
        check("before+after 동시 지정 거부", "하나만" in str(e), e)

    check("structural 기록", any(s.startswith("move_sheet:") for s in ctx._shared["structural"]), ctx._shared["structural"])

    # [SBAGENT-294] add_sheet before/after 대칭 — Add(Before=)/Add(After=) 키워드 실측.
    ctx.add_sheet("맨앞시트", before="요약")
    check("add_sheet before", names(wb)[0] == "맨앞시트", names(wb))
    ctx.add_sheet("중간시트", after="5월raw")
    check("add_sheet after", names(wb)[names(wb).index("5월raw") + 1] == "중간시트", names(wb))
    try:
        ctx.add_sheet("동시지정", before="요약", after="요약")
        check("add_sheet before+after 거부", False)
    except Exception as e:
        check("add_sheet before+after 거부", "하나만" in str(e), e)
except Exception:
    traceback.print_exc()
    fails += 1
finally:
    try:
        for _wb in list(app.Workbooks):
            _wb.Close(SaveChanges=False)
    except Exception:
        pass
    try:
        app.Quit()
    except Exception:
        pass

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)
