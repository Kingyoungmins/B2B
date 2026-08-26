# -*- coding: utf-8 -*-
"""[실행기 이어실행] run_full_pipeline_single_instance 의 경계 스냅샷 이어실행 — 실제 Excel 검증.

왜 이 테스트가 있나(2026-08-26 실측):
  사용자가 36스텝 스킬을 돌리다 30단계에서 실패 → AI 도움으로 30·34단계만 고치고 다시 [전체실행].
  그런데 로그(10:23·10:29) 두 실행 모두 stepIdx 0 부터 시작해 16분을 통째로 다시 돌았다.
  원인: 실행기 경로(_run_full_pipeline_single_instance_impl)에는 이어실행이 아예 없었다.
  (백그라운드 경로에만 있었고, 나는 그걸 보고 '있다'고 오진했다 — _test_pipeline_resume_snapshot.py [6] 참고)

여기서 잠그는 계약:
  1) 실패 후 뒷 단계만 고쳐 다시 돌리면 앞 단계를 건너뛴다.
  2) 건너뛴 구간에서 바뀐 파일도 최종 결과에 그대로 남는다(이번 실행에서 한 번도 안 건드려도).
     ← Saved 플래그를 표식으로 쓰기 때문에 여기가 제일 깨지기 쉽다.
  3) 앞 단계를 고치면 이어실행하지 않는다(정합성).
  4) 최종 결과가 '처음부터 다 돈 것'과 같다.
"""
import sys, io, tempfile, shutil
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = str(Path(__file__).resolve().parent.parent)
sys.path.insert(0, ROOT)
import openpyxl
import pythoncom; pythoncom.CoInitialize()
import win32com.client as win32
import serve_b2b as S

fails = []
def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:300]) if (not cond and detail != "") else ""))
    if not cond:
        fails.append(name)

TRACE = []
_orig_trace = S._vba_trace
def _tap(event, **kw):
    TRACE.append(dict(kw, event=event))
    return _orig_trace(event, **kw)
S._vba_trace = _tap

def py(sheet, cell, val):
    return "def transform(ctx):\n    ctx.write(%r, %r, [[%r]])\n" % (sheet, cell, val)

# 없는 시트에 write 하면 ctx 가 알아서 찾아/만들어 예외가 안 난다(실측) → 명시적으로 터뜨린다.
BAD = "def transform(ctx):\n    ctx.write('데이터', 'B1', [['버려질값']])\n    raise RuntimeError('의도된 실패')\n"

work = Path(tempfile.mkdtemp(prefix="b2b_resume_"))
def build(path, sheet):
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = sheet
    ws["A1"] = "원본"; wb.save(str(path))

NAMES = ["rA.xlsx", "rB.xlsx", "rC.xlsx"]
IDS = ["rexA", "rexB", "rexC"]
SHEET = "데이터"
srcs, lives = [], []
for n in NAMES:
    sp = work / n; build(sp, SHEET); srcs.append(sp)
    lp = work / ("live_" + n); shutil.copy2(sp, lp); lives.append(lp)

def make_groups(step5_code):
    """6스텝 평면열: A1 A2 | B1 B2 | C1 C2. 5번째(=C1)만 갈아끼운다."""
    codes = [
        ("rexA", "s1", py(SHEET, "B1", "A1값")),
        ("rexA", "s2", py(SHEET, "B2", "A2값")),
        ("rexB", "s3", py(SHEET, "B1", "B1값")),
        ("rexB", "s4", py(SHEET, "B2", "B2값")),
        ("rexC", "s5", step5_code),
        ("rexC", "s6", py(SHEET, "B2", "C2값")),
    ]
    groups, cur = [], None
    for i, (eid, sid, code) in enumerate(codes):
        if cur is None or cur["excelId"] != eid:
            cur = {"excelId": eid, "steps": []}; groups.append(cur)
        cur["steps"].append({"code": code, "language": "python", "stepIdx": i, "stepId": sid})
    return groups

app = None
try:
    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    for eid, n, sp, lp in zip(IDS, NAMES, srcs, lives):
        w = app.Workbooks.Open(str(lp))
        S.EXCEL_SESSIONS[eid] = {"app": app, "workbook": w, "path": str(lp), "openPath": str(w.FullName),
                                 "name": n, "sourcePath": str(sp), "liveEditable": True}

    print("[1] 1차 실행 — 5번째 스텝에서 실패시킨다(경계 스냅샷이 쌓여야 한다)")
    TRACE.clear()
    err = None
    try:
        S.run_full_pipeline_single_instance(make_groups(BAD), reset_excel_ids=list(IDS))
    except Exception as e:
        err = e
    check("1차는 실패한다(의도)", err is not None, err)
    d1 = [t for t in TRACE if t.get("event") == "fullrun.resume.decision"]
    check("1차 이어실행 판정 = 0단계(스냅샷 없음)", bool(d1) and d1[0].get("resumeFrom") == 0, d1[:1])
    bnds = [t for t in TRACE if t.get("event") == "fullrun.boundary.saved"]
    check("경계 스냅샷이 쌓였다", len(bnds) >= 3, [b.get("completed") for b in bnds])
    check("경계 4(=5번째 스텝 직전)가 있다", 4 in [b.get("completed") for b in bnds],
          [b.get("completed") for b in bnds])
    _extra = sum(int(b.get("saved") or 0) for b in bnds)
    print("      경계 %d개 / 추가 저장 %d회 / 총 %.0fms"
          % (len(bnds), _extra, sum(float(b.get("ms") or 0) for b in bnds)))
    check("추가 저장이 스텝 수보다 적다(대상 파일은 공짜)", _extra < 6, _extra)

    print("[2] 5번째 스텝만 고쳐 재실행 — 앞 4단계를 건너뛰어야 한다")
    TRACE.clear()
    out = S.run_full_pipeline_single_instance(make_groups(py(SHEET, "B1", "C1값")), reset_excel_ids=list(IDS))
    d2 = [t for t in TRACE if t.get("event") == "fullrun.resume.decision"]
    check("이어실행 판정 = 4단계", bool(d2) and d2[0].get("resumeFrom") == 4, d2[:1])
    ran = [t.get("ordinal") for t in TRACE if t.get("event") == "fullrun.step.start"]
    check("5·6번째만 실행", ran == [5, 6], ran)
    check("applied 는 전체 6", out.get("applied") == 6, out.get("applied"))
    check("되돌리기 목록이 건너뛴 구간까지 이어진다", len(out.get("stepSnapshots") or []) >= 6,
          len(out.get("stepSnapshots") or []))

    print("[3] 최종 결과 — 건너뛴 구간의 파일 변경도 살아있어야 한다")
    want = {"rexA": [("B1", "A1값"), ("B2", "A2값")],
            "rexB": [("B1", "B1값"), ("B2", "B2값")],
            "rexC": [("B1", "C1값"), ("B2", "C2값")]}
    for eid, cells in want.items():
        lw = S.EXCEL_SESSIONS[eid]["workbook"]
        got = [(c, lw.Worksheets(SHEET).Range(c).Value) for c, _ in cells]
        check("%s 라이브 반영" % eid, got == cells, got)
        check("%s 원본 보존" % eid, lw.Worksheets(SHEET).Range("A1").Value == "원본")

    print("[4] 앞 단계를 고치면 이어실행하지 않는다(정합성)")
    TRACE.clear()
    g = make_groups(py(SHEET, "B1", "C1값"))
    g[0]["steps"][1]["code"] = py(SHEET, "B3", "A2바뀜")   # 2번째 스텝(앞쪽) 변경
    try:
        S.run_full_pipeline_single_instance(g, reset_excel_ids=list(IDS))
    except Exception as e:
        check("4번 실행이 예외 없이 끝난다", False, e)
    d4 = [t for t in TRACE if t.get("event") == "fullrun.resume.decision"]
    check("앞 단계를 고치면 1단계부터", bool(d4) and d4[0].get("resumeFrom") <= 1, d4[:1])
    lwA = S.EXCEL_SESSIONS["rexA"]["workbook"]
    check("바꾼 스텝의 결과가 반영", lwA.Worksheets(SHEET).Range("B3").Value == "A2바뀜",
          lwA.Worksheets(SHEET).Range("B3").Value)

    print("[5] 주석만 바꾸면 이어실행이 유지된다")
    TRACE.clear()
    g5 = make_groups(py(SHEET, "B1", "C1값"))
    g5[0]["steps"][1]["code"] = py(SHEET, "B3", "A2바뀜") + "# 설명만 덧붙임\n"
    S.run_full_pipeline_single_instance(g5, reset_excel_ids=list(IDS))
    d5 = [t for t in TRACE if t.get("event") == "fullrun.resume.decision"]
    check("주석만 바뀌면 이어실행 유지", bool(d5) and d5[0].get("resumeFrom") >= 4, d5[:1])
    print("[6] 교차파일 쓰기 — 다른 파일에 쓴 결과도 경계에 담겨야 한다")
    # 여기가 '대상 파일만 저장' 설계가 조용히 틀리는 지점이다. A그룹 스텝이 B파일에 쓰고,
    # 그 뒤 경계에서 B가 안 담기면 이어실행 때 B만 원본에서 열려 그 쓰기가 사라진다.
    TRACE.clear()
    # 라이브를 원본으로 되돌린다 — 열린 채로는 덮어쓸 수 없으니 '전부 닫고 → 복사 → 전부 열기' 순서로.
    for eid in IDS:
        S.EXCEL_SESSIONS[eid]["workbook"].Close(SaveChanges=False)
    for sp, lp in zip(srcs, lives):
        shutil.copy2(sp, lp)
    for eid, lp in zip(IDS, lives):
        S.EXCEL_SESSIONS[eid]["workbook"] = app.Workbooks.Open(str(lp))
    CROSS = ("def transform(ctx):" + chr(10)
             + "    ctx.write('데이터', 'B1', [['A1값']])" + chr(10)
             + "    ctx.book('rB.xlsx').write('데이터', 'D1', [['교차쓰기']])" + chr(10))
    def cross_groups(last_code):
        codes = [("rexA", "s1", CROSS), ("rexA", "s2", py(SHEET, "B2", "A2값")),
                 ("rexC", "s3", py(SHEET, "B1", "C1값")), ("rexC", "s4", last_code)]
        gs, cur = [], None
        for i, (eid, sid, code) in enumerate(codes):
            if cur is None or cur["excelId"] != eid:
                cur = {"excelId": eid, "steps": []}; gs.append(cur)
            cur["steps"].append({"code": code, "language": "python", "stepIdx": i, "stepId": sid})
        return gs
    try:
        S.run_full_pipeline_single_instance(cross_groups(BAD), reset_excel_ids=list(IDS))
    except Exception:
        pass
    TRACE.clear()
    S.run_full_pipeline_single_instance(cross_groups(py(SHEET, "B2", "C2값")), reset_excel_ids=list(IDS))
    d6 = [t for t in TRACE if t.get("event") == "fullrun.resume.decision"]
    # 몇 단계까지 건너뛰는지는 비용 게이트가 정한다. 이 테스트의 스텝은 수십 ms 라 경계 저장(≈30ms)이
    # 곧 오버헤드 10% 를 넘어 게이트가 자주 막는다 — 실사용(스텝 수 초)에선 거의 안 막힌다.
    # 여기서 잠글 것은 '몇 단계'가 아니라 '건너뛴 구간의 교차파일 쓰기가 살아있는가'다.
    check("교차파일 케이스도 이어실행한다", bool(d6) and d6[0].get("resumeFrom") >= 1, d6[:1])
    _opened = {t.get("excelId"): t.get("fromSnapshot")
               for t in TRACE if t.get("event") == "fullrun.file.opened"}
    check("교차로 쓰인 rexB 도 경계 스냅샷에서 연다(원본 아님)", _opened.get("rexB") is True, _opened)
    lwB = S.EXCEL_SESSIONS["rexB"]["workbook"]
    check("건너뛴 구간의 '교차파일 쓰기'가 살아있다",
          lwB.Worksheets(SHEET).Range("D1").Value == "교차쓰기",
          lwB.Worksheets(SHEET).Range("D1").Value)
    lwC = S.EXCEL_SESSIONS["rexC"]["workbook"]
    check("마지막 스텝 결과도 반영", lwC.Worksheets(SHEET).Range("B2").Value == "C2값",
          lwC.Worksheets(SHEET).Range("B2").Value)

    print("[7] 동반 워크북이 끼면 이어실행하지 않는다(지문으로 확인 불가 → 안전한 쪽)")
    TRACE.clear()
    S.EXCEL_SESSIONS["rexD_companion"] = dict(S.EXCEL_SESSIONS["rexB"], name="companionOnly.xlsx")
    try:
        S.run_full_pipeline_single_instance(cross_groups(py(SHEET, "B2", "C2값")),
                                            reset_excel_ids=["rexA", "rexC"])
    except Exception as e:
        print("      (동반 실행 예외:", str(e)[:120], ")")
    finally:
        S.EXCEL_SESSIONS.pop("rexD_companion", None)
    d7 = [t for t in TRACE if t.get("event") == "fullrun.resume.decision"]
    check("동반본 있으면 이어실행 끔", bool(d7) and d7[0].get("resumeFrom") == 0
          and d7[0].get("reason") == "companion-open", d7[:1])

finally:
    S._vba_trace = _orig_trace
    for eid in IDS:
        S.EXCEL_SESSIONS.pop(eid, None)
    try:
        if app is not None:
            for w in list(app.Workbooks):
                try: w.Close(SaveChanges=False)
                except Exception: pass
            app.Quit()
    except Exception:
        pass
    shutil.rmtree(work, ignore_errors=True)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)
