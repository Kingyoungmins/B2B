# -*- coding: utf-8 -*-
# [SBAGENT-293 24단계 실측] ctx.book("한국전력공사_yyyymmdd.xlsx") — 날짜 플레이스홀더 리터럴.
# 실행기 매핑 없이(생성기 전체실행) 돌면 안정키 매칭이 원천 불가라 "워크북이 열려 있지
# 않습니다"로 죽었다. 플레이스홀더 와일드카드 폴백(유일 매칭만)을 실제 Excel 로 검증한다.
import sys, os, tempfile, traceback
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
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:200]) if (not cond and detail) else ""))
    if not cond:
        fails += 1

tmp = tempfile.mkdtemp(prefix="b2b_ph_")
REAL = "한국전력공사_202608_v1.1_DSMC_260824.xlsx"
OTHER = "02. 한전_AMI_유선간선망_청구세부내역.xlsx"
REAL2 = "한국전력공사_202607_v1.0_DSMC_260710.xlsx"

app = w.DispatchEx("Excel.Application")
app.Visible = False; app.DisplayAlerts = False
try:
    def mk(name):
        wb = app.Workbooks.Add()
        p = os.path.join(tmp, name)
        wb.SaveAs(p)
        return wb
    wb_main = mk(OTHER)
    wb_real = mk(REAL)
    ctx = Ctx(wb_main, app)

    b = ctx.book("한국전력공사_yyyymmdd.xlsx")
    check("플레이스홀더 → 유일 매칭 바인딩", b is not None and b._wb.Name == REAL, getattr(getattr(b, "_wb", None), "Name", None))

    # 같은 패턴 파일이 둘이면 모호 → 바인딩 금지(기존 오류 유지)
    ctx2 = Ctx(wb_main, app)  # books 캐시 공유 없이 새로
    mk(REAL2)
    try:
        ctx2.book("한국전력공사_yyyymmdd.xlsx")
        check("두 개면 모호 → 오류", False)
    except Exception as e:
        check("두 개면 모호 → 오류", "열려 있지 않습니다" in str(e), e)

    # 플레이스홀더 없는 이름은 폴백 미개입(기존 동작)
    try:
        ctx2.book("없는파일_2026.xlsx")
        check("일반 미존재 이름은 기존 오류", False)
    except Exception as e:
        check("일반 미존재 이름은 기존 오류", "열려 있지 않습니다" in str(e), e)
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
