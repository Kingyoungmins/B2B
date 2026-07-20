# [0.5.18] ctx.copy_key_blocks 라이브 COM 검증 — 가입번호(세로병합 블록) 전체를 서식 그대로 복사.
# 원본 대상파일은 건드리지 않음(임시 복사본에 적용). 소스는 ReadOnly 로 연다.
# 회귀 방지: Find 로 첫 행 1줄만 오던 버그(소계행 유실) → 블록 전체(데이터행+소계행) 복사 확인.
import sys, io, os, glob, tempfile, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import win32com.client as win32
import serve_b2b as s

DOWN = r"C:\Users\Admin\Downloads"
def find(pat):
    return [h for h in glob.glob(os.path.join(DOWN, pat)) if not os.path.basename(h).startswith("~$")]
SRC = (find("531611708899*로우데이터*260616.xlsx") or [None])[0]
DST = (find("LGU*농협생명*콜센터*260617.xlsx") or [None])[0]

passed = 0
def check(name, cond, detail=""):
    global passed
    if not cond:
        raise AssertionError(f"FAIL {name}: {detail}")
    passed += 1
    print(" OK ", name)

def main():
    if not SRC or not DST:
        print("실파일 없음 — 건너뜀:", SRC, DST); return
    # 대상 임시 복사본(원본 보존)
    tmp = os.path.join(tempfile.gettempdir(), "b2b_ckb_dst.xlsx")
    shutil.copyfile(DST, tmp)
    src_name = os.path.basename(SRC)   # book() 매칭용 실제 파일명

    app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
    wbSrc = wbDst = None
    try:
        wbSrc = app.Workbooks.Open(SRC, ReadOnly=True)
        wbDst = app.Workbooks.Open(tmp)   # 임시본은 편집 가능
        ctx = s.PythonComSkillContext(app, wbDst, {"path": tmp, "workbook": wbDst, "app": app})

        rep = ctx.copy_key_blocks(f"{src_name}!sheet", "콜센터", "B", "B", "N", "B3:B345", "B4:B89")
        print("보고:", {"copied": rep["copied"], "missing": rep["missing"], "height_mismatch": rep["height_mismatch"]})

        wsD = wbDst.Worksheets("콜센터")
        wsS = wbSrc.Worksheets("sheet")
        # 첫 가입번호 500106220276: 소스 B43:B44 → 대상 B4:B5. '첫 행만'이 아니라 두 행 다 와야 함.
        check("복사 건수 >= 30", rep["copied"] >= 30, str(rep["copied"]))
        check("B4 가입번호 = 500106220276", str(wsD.Cells(4, 2).Value).strip() == "500106220276", str(wsD.Cells(4,2).Value))
        # 데이터행(4행)
        check("H4 = 요금제 기본료(데이터행 복사)", "기본료" in str(wsD.Cells(4, 8).Value or ""), str(wsD.Cells(4,8).Value))
        # 소계행(5행) — 예전엔 유실되던 두번째 행
        check("H5 = 소계(둘째 행도 복사됨=버그해결)", str(wsD.Cells(5, 8).Value or "").strip() == "소계", str(wsD.Cells(5,8).Value))
        check("I5 = 92400(소계 금액)", abs(float(wsD.Cells(5, 9).Value or 0) - 92400.0) < 1e-6, str(wsD.Cells(5,9).Value))
        # 소스와 실제 값 일치(행43/44 == 대상 4/5) 전열 비교
        ok_all = True
        for (sr, dr) in ((43, 4), (44, 5)):
            for c in range(2, 15):
                sv = wsS.Cells(sr, c).Value; dv = wsD.Cells(dr, c).Value
                if (sv is None and dv is None):
                    continue
                if str(sv) != str(dv):
                    ok_all = False; print(f"   불일치 열{c}: 소스{sr}={sv!r} vs 대상{dr}={dv!r}")
        check("소스 B43:N44 == 대상 B4:N5 전열 일치", ok_all)
        # 병합 서식 보존: 소스 C43:C44 병합 → 대상 C4:C5 병합
        check("C4 병합 2행 보존(서식 그대로)", int(wsD.Cells(4, 3).MergeArea.Rows.Count) == 2, str(wsD.Cells(4,3).MergeArea.Rows.Count))

        print(f"\n=== RESULT: {passed} PASS / 0 FAIL ===")
    finally:
        try:
            if wbDst is not None: wbDst.Close(SaveChanges=False)
        except Exception: pass
        try:
            if wbSrc is not None: wbSrc.Close(SaveChanges=False)
        except Exception: pass
        try: app.Quit()
        except Exception: pass

if __name__ == "__main__":
    main()
