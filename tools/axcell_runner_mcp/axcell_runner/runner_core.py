# -*- coding: utf-8 -*-
"""AXCell Runner 핵심 — b2b 서버/exe 없이 저장된 스킬 zip 을 직접 실행한다.

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
    print("[axcell_runner]", *a, file=sys.stderr, flush=True)


def _engine():
    """serve_b2b 엔진 지연 로드. 탐색 순서: $AXCELL_RUNNER_ENGINE_DIR → 패키지 옆 engine/ → 저장소 루트."""
    global _ENGINE
    if _ENGINE is not None:
        return _ENGINE
    candidates = []
    env_dir = os.environ.get("AXCELL_RUNNER_ENGINE_DIR")
    if env_dir:
        candidates.append(Path(env_dir))
    candidates.append(_HERE / "engine")            # 배포 번들: axcell_runner/engine/serve_b2b.py
    candidates.append(_HERE.parent.parent.parent)  # 소스 트리: tools/axcell_runner_mcp/axcell_runner → repo root
    for c in candidates:
        if (c / "serve_b2b.py").exists():
            sys.path.insert(0, str(c))
            break
    else:
        raise RuntimeError("serve_b2b.py 를 찾지 못했습니다 (AXCELL_RUNNER_ENGINE_DIR 확인). 탐색: "
                           + ", ".join(str(c) for c in candidates))
    import serve_b2b as eng
    # [리뷰 2026-09-01] serve_b2b 는 import 만으로 atexit 정리 핸들러를 건다. 그중
    # cleanup_backend_runtime_files 는 '고정 공유 경로'(%TEMP%\b2b_backend_v044)의 스텝
    # 스냅샷을 지우고, cleanup_excel_sessions 는 종료 시점에 COM 워커 스레드를 새로 띄워
    # 최대 20초를 기다린다. 이 프로세스(MCP 러너)가 끝날 때 그 핸들러가 돌면
    # **같은 PC 에서 돌고 있는 진짜 B2B 앱의 스냅샷을 지워 버리고**, 러너 종료가 20초씩
    # 걸린다. 러너는 자기 Excel 을 finally 에서 직접 정리하므로 엔진 핸들러는 전부 해제.
    import atexit
    for _fn_name in ("cleanup_node_worker", "cleanup_backend_runtime_files", "cleanup_excel_sessions"):
        _fn = getattr(eng, _fn_name, None)
        if _fn is not None:
            try:
                atexit.unregister(_fn)
            except Exception:
                pass
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
                # [리뷰 2026-09-01] utf-8-sig — BOM 이 붙은 stepFile 을 utf-8 로 읽으면 ﻿ 가
                # 코드 첫 글자로 남아 compile() 이 SyntaxError 를 낸다(앱은 로드 시 정규화해서 됨).
                step["code"] = z.read(sf).decode("utf-8-sig")
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
                # [리뷰 2026-09-01] 첫 히트로 끊지 않고 전부 모아 '유일할 때만' 채택 —
                # 엔진(_normalized lookup)과 같은 규칙. 둘 이상 걸리면 잘못 짝지어 남의
                # 파일을 덮는 것보다 unmatched 로 알리는 게 낫다.
                cands = [f for f in files
                         if f.name not in used and eng._workbook_name_lookup_keys(f.name) & want_keys]
                if len(cands) == 1:
                    hit = cands[0]
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


def _pick_target_wb(target_file_id, opened, primary_wb, output_names=()):
    tid = str(target_file_id or "")
    if tid.startswith("input:"):
        want = tid[len("input:"):]
        if want in opened:
            return opened[want]
        wk = _stable_key_fallback(want)
        for name, wb in opened.items():
            if _stable_key_fallback(name) == wk:
                return wb
    # [리뷰 2026-09-01] 출력 템플릿 대상은 "output:N" 이라 이름이 없다(drop-handling.js).
    # 예전엔 무조건 primary(첫 입력)로 떨어져 VBA 가 엉뚱한 워크북 컨텍스트로 돌 수 있었다.
    # requiredFiles 의 role=="output" 파일이 정확히 하나면 그 파일이 대상이다.
    if tid.startswith("output:") and len(output_names) == 1 and output_names[0] in opened:
        return opened[output_names[0]]
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
        # [리뷰 2026-09-01] 지난 실행이 남긴(혹은 읽기전용 속성이 복사된) 기존 사본이 있으면
        # copy2 가 PermissionError 로 죽는다 — 지우고 새로 만든다.
        if dst.exists():
            try:
                os.chmod(dst, 0o666)
            except Exception:
                pass
            dst.unlink()
        shutil.copy2(src, dst)
        # copy2 는 읽기전용 속성까지 복사한다 — 그대로 열면 전부 실행하고도 Save 가 조용히
        # 실패해 '작업 전 파일'이 결과로 나간다(공유폴더 원본이 읽기전용인 경우 실측 위험).
        try:
            os.chmod(dst, 0o666)
        except Exception:
            pass
        work_copies[name] = dst
    primary_name = req_names[0] if required else next(iter(work_copies))
    output_names = tuple(rf["name"] for rf in required if str(rf.get("role") or "") == "output")

    total = len(pipeline)
    pythoncom.CoInitialize()
    app, opened = None, {}
    open_temps = []
    try:
        app = win32com.client.DispatchEx("Excel.Application")
        if excel_pid_holder is not None:
            try:
                excel_pid_holder["pid"] = eng._excel_process_id(app)
            except Exception as e:
                # pid 를 못 얻으면 run_stop 의 강제 종료가 무력화된다 — 조용히 삼키지 않는다.
                _log("excel pid capture failed (run_stop kill unavailable):", repr(e))
        app.Visible = False
        app.DisplayAlerts = False
        # [리뷰 2026-09-01] AutomationSecurity 는 엔진과 같은 Low(1)로 연다.
        # ForceDisable(3)로 '열면' 일부 Office 빌드에서 그 인스턴스의 모든 매크로가 영구
        # 비활성화되어, 뒤에 주입하는 VBA 스텝의 Application.Run 이 전부 "매크로를 실행할
        # 수 없습니다"로 죽는다(엔진 주석: 전체실행 100% 실패의 근본원인 — 나중에 낮춰도
        # 이미 차단된 상태는 안 풀린다). 파일 자체의 Auto_Open 류는 EnableEvents=False 로 막는다.
        try:
            app.EnableEvents = False
        except Exception:
            pass
        try:
            app.AutomationSecurity = 1  # msoAutomationSecurityLow — 엔진(excel_workbooks_open 경로)과 동일
        except Exception:
            pass

        for name, path in work_copies.items():
            if cancel is not None and cancel.is_set():
                raise RunCancelled()
            # [리뷰 2026-09-01] 맨 Workbooks.Open 대신 엔진의 excel_workbooks_open —
            # 형식 위장 파일(.xls 인데 HTML/CSV) 변환, UpdateLinks=0/CorruptLoad 재시도 사다리,
            # 그리고 변환된 파일도 ctx.book("원본명")/VBA Workbooks("원본명") 으로 찾게 하는
            # 이름 별칭 등록까지 전부 이 함수에 있다(ERP 내보내기 파일 대비).
            wb, _tmp = eng.excel_workbooks_open(app, str(path.resolve()),
                                                read_only=False, intended_name=Path(name).name)
            if _tmp:
                open_temps.append(_tmp)
            opened[name] = wb
            emit({"type": "open", "file": name})
        primary_wb = opened[primary_name]
        try:
            app.Calculation = -4105     # xlCalculationAutomatic — 수동 저장된 워크북이 인스턴스
        except Exception:               # 계산 모드를 수동으로 끌고 가는 것 방지(엔진과 동일 규칙)
            pass

        for i, step in enumerate(pipeline, 1):
            if cancel is not None and cancel.is_set():
                raise RunCancelled()
            code = step.get("code") or ""
            label = (step.get("title") or step.get("description") or "").strip()[:60]
            target_wb = _pick_target_wb(step.get("targetFileId"), opened, primary_wb, output_names)
            session = {"path": str(Path(target_wb.FullName)), "app": app, "workbook": target_wb}
            lang = "vba" if eng.is_vba_pipeline_step(step) else (
                "python" if eng.is_python_pipeline_step(step) else "skip")
            emit({"type": "step", "step": i, "total_steps": total, "language": lang, "step_label": label})
            if lang == "vba":
                eng._inject_and_run_vba(app, target_wb, code, eng.VBA_SKILL_ENTRY)
            elif lang == "python":
                # [리뷰 2026-09-01] 실행 전 정규화 — BOM/``` 펜스/주석 머리말을 벗긴다.
                # 판별(is_python_pipeline_step)은 정규화해서 보면서 실행은 원문 그대로 컴파일하면,
                # 앱에서는 돌던 zip 이 러너에서만 SyntaxError 로 죽는다(앱은 로드 때 정규화).
                try:
                    code = eng.normalize_python_pipeline_code(code)
                except Exception:
                    pass
                summary = eng._exec_python_com_skill(app, target_wb, session, code, skip_static=True)
                if summary.get("warning"):
                    emit({"type": "warning", "step": i, "message": summary["warning"]})
            # [리뷰 2026-09-01] 스텝 사이 강제 재계산 — 인스턴스 계산 모드가 수동으로 남는
            # 드문 경우에도 앞 스텝이 쓴 수식이 미계산인 채 다음 스텝 read 에 읽히지 않게
            # (엔진 격리 전체실행과 동일 규칙: 무성 오답 방지).
            eng._safe_excel_calculate(app)

        saved = []
        for name, wb in opened.items():
            wb.Save()
            saved.append((name, work_copies[name]))
        # 성공 경로는 여기서 먼저 닫는다 — 파일 잠금이 풀려야 아래에서 이름을 되돌릴 수 있다.
        for wb in list(opened.values()):
            try:
                wb.Close(SaveChanges=False)
            except Exception:
                pass
        opened.clear()
        # [0.8.2 호환 2026-09-01] 출력 파일명을 '사용자가 준 입력 이름'으로 되돌린다.
        # 실행 중에는 스킬이 기억하는 이름(예: …4월)으로 열어야 코드/VBA 의 파일명 리터럴이
        # 해석되지만(위 작업 사본 주석), 결과물까지 그 옛 이름으로 나가면 5월 데이터를 돌린
        # 사용자가 헷갈린다. 실행기 앱은 입력 이름 그대로 저장한다 — 제품 동작과 맞춘다.
        final_files = []
        for name, path in saved:
            src_match = mapping.get(name)
            want = Path(src_match).name if src_match is not None else path.name
            if want != path.name:
                target = path.with_name(want)
                try:
                    if target.exists():
                        target.unlink()
                    path.rename(target)
                    path = target
                except Exception as e:
                    _log("output rename failed (keep as-is):", path.name, "->", want, repr(e))
            final_files.append(path)
        emit({"type": "saved", "files": [p.name for p in final_files]})
        return {"ok": True, "out_dir": str(out_dir.resolve()),
                "files": [p.name for p in final_files], "skill": data.get("name") or Path(skill_zip).stem}
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
        for _tmp in open_temps:            # excel_workbooks_open 이 만든 형식변환 임시본 정리
            try:
                Path(_tmp).unlink()
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
