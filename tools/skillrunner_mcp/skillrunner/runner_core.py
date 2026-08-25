# -*- coding: utf-8 -*-
"""SkillRunner 핵심 — b2b 서버/exe 없이 저장된 스킬 zip 을 직접 실행한다.

세 기능(각각 MCP 도구로 노출됨):
  1. check_inputs   : 스킬의 requiredFiles ↔ 디렉토리 내 파일 자동 매핑 검증
                      (serve_b2b 의 '기 개발된' 매핑 로직 재사용 — 월/날짜/순번/복사본 접미사 무시)
  2. run            : Excel COM 으로 스텝 순차 실행 (진행 이벤트 콜백 + 취소 지원)
  3. package_outputs: 출력 파일 정상 확인 후 zip 생성

엔진(PythonComSkillContext / _inject_and_run_vba / 매핑 키)은 serve_b2b.py 를 import 해
그대로 재사용한다. serve_b2b 는 __main__ 가드가 있어 import 해도 HTTP 서버가 뜨지 않고,
win32com/openpyxl import 는 try/except 가드라 검사(check)만은 Excel 없는 환경에서도 돈다.

주의: 이 모듈은 MCP 서버에서 쓰이므로 stdout 에 아무것도 찍지 않는다(로그는 stderr).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import threading
import zipfile
from pathlib import Path

_HERE = Path(__file__).resolve().parent

_ENGINE = None


def _log(*a):
    print("[skillrunner]", *a, file=sys.stderr, flush=True)


def _engine():
    """serve_b2b 엔진 지연 로드. 탐색 순서: $SKILLRUNNER_ENGINE_DIR → 패키지 옆 engine/ → 저장소 루트."""
    global _ENGINE
    if _ENGINE is not None:
        return _ENGINE
    candidates = []
    env_dir = os.environ.get("SKILLRUNNER_ENGINE_DIR")
    if env_dir:
        candidates.append(Path(env_dir))
    candidates.append(_HERE / "engine")            # 배포 번들: skillrunner/engine/serve_b2b.py
    candidates.append(_HERE.parent.parent.parent)  # 소스 트리: tools/skillrunner_mcp/skillrunner → repo root
    for c in candidates:
        if (c / "serve_b2b.py").exists():
            sys.path.insert(0, str(c))
            break
    else:
        raise RuntimeError("serve_b2b.py 를 찾지 못했습니다 (SKILLRUNNER_ENGINE_DIR 확인). 탐색: "
                           + ", ".join(str(c) for c in candidates))
    import serve_b2b as eng
    _ENGINE = eng
    return eng


# ---------------------------------------------------------------------------
# 스킬 zip 로드 + @@FILE_n@@ 핸들 복원 (save-load.js loadLogic 재현)
# ---------------------------------------------------------------------------
def load_skill(zip_path):
    zip_path = Path(zip_path)
    if not zip_path.exists():
        raise RuntimeError(f"스킬 zip 이 없습니다: {zip_path}")
    with zipfile.ZipFile(zip_path) as z:
        manifest_name = next((n for n in z.namelist() if n.endswith(".logic.json")), None)
        if not manifest_name:
            raise RuntimeError(f"{zip_path.name}: .logic.json 매니페스트가 없습니다(올바른 스킬 zip 인지 확인).")
        data = json.loads(z.read(manifest_name).decode("utf-8-sig"))
        for step in data.get("pipeline", []):        # 외부 stepFile 이 있으면 그 내용 우선(save-load.js 규약)
            sf = step.get("stepFile")
            if sf and sf in z.namelist():
                step["code"] = z.read(sf).decode("utf-8")
    rfs = [rf for rf in (data.get("requiredFiles") or []) if rf.get("handle") and rf.get("name")]
    if rfs:
        for step in data.get("pipeline", []):
            c = step.get("code")
            if not c:
                continue
            for rf in rfs:
                c = c.replace(rf["handle"], rf["name"])
            step["code"] = c
    return data


# ---------------------------------------------------------------------------
# 1) check_inputs — 자동 매핑 (serve_b2b 매핑 로직 재사용)
# ---------------------------------------------------------------------------
_XL_EXTS = (".xlsx", ".xls", ".xlsm", ".csv")


def _list_input_files(input_dir):
    d = Path(input_dir)
    if not d.is_dir():
        raise RuntimeError(f"입력 디렉토리가 없습니다: {d}")
    return sorted(f for f in d.iterdir()
                  if f.is_file() and f.suffix.lower() in _XL_EXTS and not f.name.startswith("~$"))


def _auto_map(required_names, files):
    """requiredFiles[].name ↔ 실제 파일 매핑.
    1) 정확명 → 2) serve_b2b._workbook_name_lookup_keys 교집합(공백/괄호 등 표기차)
    → 3) serve_b2b._match_workbook_by_stable_key(월/날짜/순번/복사본 무시 안정키, 유일할 때만)."""
    eng = _engine()
    by_name = {f.name: f for f in files}
    lower = {f.name.lower(): f for f in files}
    names = [f.name for f in files]
    mapping, unmatched = {}, []
    used = set()
    for want in required_names:
        hit = by_name.get(want) or lower.get(str(want).lower())
        if hit is None:
            try:
                want_keys = eng._workbook_name_lookup_keys(want)
                for f in files:
                    if f.name in used:
                        continue
                    if eng._workbook_name_lookup_keys(f.name) & want_keys:
                        hit = f
                        break
            except Exception:
                pass
        if hit is None:
            try:
                pool = [n for n in names if n not in used]
                m = eng._match_workbook_by_stable_key(pool, want)
                if m:
                    hit = by_name.get(m)
            except Exception:
                pass
        if hit is not None:
            mapping[want] = hit
            used.add(hit.name)
        else:
            unmatched.append(want)
    extra = [f.name for f in files if f.name not in used]
    return mapping, unmatched, extra


def check_inputs(skill_zip, input_dir):
    """스킬이 요구하는 입력이 input_dir 에 다 있는지 검사. 실행하지 않는다."""
    data = load_skill(skill_zip)
    pipeline = [s for s in data.get("pipeline", []) if s.get("enabled") is not False]
    required = [rf for rf in (data.get("requiredFiles") or []) if rf.get("name")]
    files = _list_input_files(input_dir)
    req_names = [rf["name"] for rf in required]
    mapping, unmatched, extra = _auto_map(req_names, files)
    langs = sorted({str(s.get("language") or "python").lower() for s in pipeline})
    return {
        "ok": not unmatched,
        "skill": data.get("name") or Path(skill_zip).stem,
        "total_steps": len(pipeline),
        "languages": langs,
        "required": req_names,
        "mapping": {k: str(v) for k, v in mapping.items()},
        "unmatched": unmatched,
        "extra_files": extra,          # 스킬이 안 쓰는 여분 — 무시되므로 있어도 됨
        "input_dir": str(Path(input_dir).resolve()),
    }


# ---------------------------------------------------------------------------
# 2) run — Excel COM 실행 (이벤트 콜백/취소 지원)
# ---------------------------------------------------------------------------
def _stable_key_fallback(name):
    eng = _engine()
    try:
        return eng._stable_workbook_key(name)
    except Exception:
        s = re.sub(r"\d{6,}", "", Path(str(name)).stem.lower())
        return re.sub(r"[ _\-\.]+", "", s)


def _pick_target_wb(target_file_id, opened, primary_wb):
    tid = str(target_file_id or "")
    if tid.startswith("input:"):
        want = tid[len("input:"):]
        if want in opened:
            return opened[want]
        wk = _stable_key_fallback(want)
        for name, wb in opened.items():
            if _stable_key_fallback(name) == wk:
                return wb
    return primary_wb


class RunCancelled(Exception):
    pass


def run(skill_zip, input_dir, out_dir, on_event=None, cancel: threading.Event | None = None,
        excel_pid_holder: dict | None = None):
    """스킬 실행. 반환 {ok, out_dir, files, skill}. 진행은 on_event(dict) 콜백으로 통지.
    cancel 이 set 되면 다음 스텝 경계에서 RunCancelled. 원본은 절대 수정하지 않는다(작업 사본)."""
    emit = on_event or (lambda e: None)
    eng = _engine()
    try:
        import win32com.client
        import pythoncom
    except Exception as e:
        raise RuntimeError("pywin32(win32com)가 필요합니다 — Windows + Excel 환경에서 실행하세요. " + repr(e))

    data = load_skill(skill_zip)
    pipeline = [s for s in data.get("pipeline", []) if s.get("enabled") is not False]
    required = [rf for rf in (data.get("requiredFiles") or []) if rf.get("name")]
    files = _list_input_files(input_dir)
    req_names = [rf["name"] for rf in required]
    mapping, unmatched, _extra = _auto_map(req_names, files)
    if required and unmatched:
        raise RuntimeError("입력 파일을 찾지 못했습니다: " + ", ".join(unmatched)
                           + " | 제공: " + ", ".join(f.name for f in files))
    if not required:
        if not files:
            raise RuntimeError("입력 파일이 없습니다: " + str(input_dir))
        mapping = {f.name: f for f in files}

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    work_copies = {}
    for name, src in mapping.items():
        dst = out_dir / Path(name).name        # ctx.book("이름")/VBA Workbooks("이름") 이 이 파일명으로 찾음
        shutil.copy2(src, dst)
        work_copies[name] = dst
    primary_name = req_names[0] if required else next(iter(work_copies))

    total = len(pipeline)
    pythoncom.CoInitialize()
    app, opened = None, {}
    try:
        app = win32com.client.DispatchEx("Excel.Application")
        if excel_pid_holder is not None:
            try:
                excel_pid_holder["pid"] = eng._excel_process_id(app)
            except Exception:
                pass
        app.Visible = False
        app.DisplayAlerts = False
        try:
            app.AutomationSecurity = 3  # 열 때 매크로 자동실행 차단
        except Exception:
            pass

        for name, path in work_copies.items():
            if cancel is not None and cancel.is_set():
                raise RunCancelled()
            opened[name] = app.Workbooks.Open(str(path.resolve()))
            emit({"type": "open", "file": name})
        primary_wb = opened[primary_name]

        for i, step in enumerate(pipeline, 1):
            if cancel is not None and cancel.is_set():
                raise RunCancelled()
            code = step.get("code") or ""
            label = (step.get("title") or step.get("description") or "").strip()[:60]
            target_wb = _pick_target_wb(step.get("targetFileId"), opened, primary_wb)
            session = {"path": str(Path(target_wb.FullName)), "app": app, "workbook": target_wb}
            lang = "vba" if eng.is_vba_pipeline_step(step) else (
                "python" if eng.is_python_pipeline_step(step) else "skip")
            emit({"type": "step", "step": i, "total_steps": total, "language": lang, "step_label": label})
            if lang == "vba":
                eng._inject_and_run_vba(app, target_wb, code, eng.VBA_SKILL_ENTRY)
            elif lang == "python":
                summary = eng._exec_python_com_skill(app, target_wb, session, code, skip_static=True)
                if summary.get("warning"):
                    emit({"type": "warning", "step": i, "message": summary["warning"]})

        saved = []
        for name, wb in opened.items():
            wb.Save()
            saved.append(work_copies[name])
        emit({"type": "saved", "files": [p.name for p in saved]})
        return {"ok": True, "out_dir": str(out_dir.resolve()),
                "files": [p.name for p in saved], "skill": data.get("name") or Path(skill_zip).stem}
    finally:
        for wb in opened.values():
            try:
                wb.Close(SaveChanges=False)
            except Exception:
                pass
        if app is not None:
            try:
                app.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()


# ---------------------------------------------------------------------------
# 3) package_outputs — 출력 정상 확인 후 zip
# ---------------------------------------------------------------------------
def package_outputs(out_dir, zip_path, expect_files=None):
    """out_dir 의 출력 파일들을 검증(존재·0바이트 아님·expect_files 포함)하고 zip 으로 묶는다."""
    out_dir = Path(out_dir)
    if not out_dir.is_dir():
        raise RuntimeError(f"출력 디렉토리가 없습니다: {out_dir}")
    files = sorted(f for f in out_dir.iterdir()
                   if f.is_file() and f.suffix.lower() in _XL_EXTS and not f.name.startswith("~$"))
    problems = []
    if expect_files:
        have = {f.name for f in files}
        for want in expect_files:
            if want not in have:
                problems.append(f"기대 출력 없음: {want}")
    for f in files:
        if f.stat().st_size == 0:
            problems.append(f"0바이트 파일: {f.name}")
    if not files:
        problems.append("출력 파일이 하나도 없습니다")
    if problems:
        return {"ok": False, "problems": problems, "files": [f.name for f in files]}
    zip_path = Path(zip_path)
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(f, f.name)
    return {"ok": True, "zip_path": str(zip_path.resolve()),
            "files": [f.name for f in files],
            "total_bytes": zip_path.stat().st_size}
