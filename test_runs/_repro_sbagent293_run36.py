# -*- coding: utf-8 -*-
"""[SBAGENT-293 실측 실험] 사용자가 확정한 매핑으로 36단계 스킬을 실제 Excel 에서 순서대로 돌린다.

목적: '매핑만 올바르면 이 스킬이 끝까지 도는가'를 로그 추정이 아니라 실물로 확인한다.
원본은 건드리지 않는다(임시 폴더에 복사본을 만들어 그 위에서 실행).
"""
import json
import os
import shutil
import sys
import tempfile
import time
import traceback
import zipfile

sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.8.0")
import win32com.client as w
import serve_b2b as S

SRC = r"C:\Users\Admin\Downloads\SBAGENT-293_attachments"

# 사용자 확정 매핑: 스킬 코드의 리터럴 → 실제 업로드 파일명
MAP = {
    "01. 한전_DAS_배전자동화_청구세부내역.xlsx":
        "시내 01. 한전_DAS_배전자동화_청구세부내역_2026-08-24 17_17_59_DSMC_260824.xlsx",
    "01. 한전_DAS도서_배전자동화_청구세부내역.xlsx":
        "도서 01. 한전_DAS_배전자동화_청구세부내역_2026-08-24 17_16_30_DSMC_260824.xlsx",
    "01. 한전_전력전용회선_배전자동화_청구세부내역.xlsx":
        "전력회선 01. 한전_DAS_배전자동화_청구세부내역_2026-08-24 17_12_08_DSMC_260824.xlsx",
    "02. 한전_AMI_유선간선망_청구세부내역.xlsx":
        "02. 한전_AMI_유선간선망_청구세부내역_2026-08-24 17_20_46_DSMC_260824.xlsx",
    "03. 한전_AMI_무선인입망합산_청구세부내역.xlsx":
        "03. 한전_AMI_무선인입망합산_청구세부내역_2026-08-24 17_24_56_DSMC_260824.xlsx",
    "한국전력공사_yyyymmdd.xlsx":
        "한국전력공사_202608_v1.1_DSMC_260824.xlsx",
}

FIX_STEP30 = os.environ.get("FIX30", "0") == "1"   # 30단계 '기본요금'→'기본료' 수정 반영 여부


class Ctx(S.PythonComSkillContext):
    def __init__(self, wb, app, shared):
        self._wb = wb
        self._app = app
        self._session = None
        self._shared = shared


def load_steps():
    zp = [f for f in os.listdir(SRC) if f.endswith(".zip")][0]
    zf = zipfile.ZipFile(os.path.join(SRC, zp))
    name = [n for n in zf.namelist() if n.endswith(".json")][0]
    d = json.loads(zf.read(name).decode("utf-8"))
    return d.get("pipeline") or d.get("steps") or []


def main():
    steps = load_steps()
    print("단계 수:", len(steps), flush=True)

    tmp = tempfile.mkdtemp(prefix="b2b_sb293_run36_")
    print("작업 폴더:", tmp, flush=True)
    paths = {}
    for real in set(MAP.values()):
        src = os.path.join(SRC, real)
        dst = os.path.join(tmp, real)
        shutil.copy2(src, dst)
        paths[real] = dst
    print("복사 완료:", len(paths), "개", flush=True)

    app = w.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    app.AskToUpdateLinks = False
    wbs = {}
    results = []
    try:
        for real, p in paths.items():
            t0 = time.time()
            wbs[real] = app.Workbooks.Open(p, UpdateLinks=0)
            print(f"열기 {real[:38]}… {time.time()-t0:.1f}s", flush=True)

        for i, st in enumerate(steps, 1):
            code = st.get("code") or ""
            if not code.strip() or st.get("enabled") is False:
                results.append((i, "SKIP", "코드없음/비활성"))
                continue
            # 실행기 매핑과 동일하게 파일명 리터럴 치환
            for lit, real in MAP.items():
                code = code.replace(lit, real)
            if FIX_STEP30 and i in (30, 34):
                code = code.replace("기본요금", "기본료")
            # 이 스텝의 ctx = 대상 파일
            tgt = str(st.get("targetFileId") or "").replace("input:", "").replace("output:", "")
            real_tgt = MAP.get(tgt, tgt)
            wb = wbs.get(real_tgt)
            if wb is None:
                # 대상이 안 잡히면 코드가 book() 으로 직접 지목하는 파일을 쓴다
                wb = next(iter(wbs.values()))
            # 백엔드는 스텝마다 ctx 를 새로 만든다(_exec_python_com_skill) — COM 예산도 스텝 단위.
            shared = {"com_calls": 0, "deadline": float("inf"),
                      "journal": [], "structural": [], "books": {}}
            ctx = Ctx(wb, app, shared)
            t0 = time.time()
            try:
                g = {"__builtins__": dict(S._PY_SAFE_BUILTINS),
                     "re": S.re, "datetime": S.datetime, "math": S.math}
                exec(compile(code, f"<step{i}>", "exec"), g)
                fn = g.get("transform")
                if fn is None:
                    results.append((i, "NOFN", "transform 없음"))
                    continue
                fn(ctx)
                dt = time.time() - t0
                results.append((i, "OK", f"{dt:.1f}s"))
                print(f"  [{i:2}] OK   {dt:5.1f}s  {str(st.get('description') or '')[:44]}", flush=True)
            except Exception as e:
                dt = time.time() - t0
                msg = f"{type(e).__name__}: {e}"
                results.append((i, "FAIL", msg))
                print(f"  [{i:2}] FAIL {dt:5.1f}s  {msg[:220]}", flush=True)
                print("       (여기서 중단)", flush=True)
                break
    except Exception:
        traceback.print_exc()
    finally:
        try:
            for wb in wbs.values():
                wb.Close(SaveChanges=False)
        except Exception:
            pass
        try:
            app.Quit()
        except Exception:
            pass

    ok = sum(1 for _, s, _ in results if s == "OK")
    fail = [r for r in results if r[1] == "FAIL"]
    print("", flush=True)
    print(f"=== 결과: 성공 {ok} / 전체 {len(steps)} · 실패 {len(fail)}", flush=True)
    for i, s, m in fail:
        print(f"    실패 {i}단계: {m[:300]}", flush=True)


if __name__ == "__main__":
    main()
