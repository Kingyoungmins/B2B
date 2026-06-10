#!/usr/bin/env python3
import http.server
import ast
import atexit
import csv
import ctypes
import datetime
import hashlib
import io
import json
import math
import os
import copy
from pathlib import Path
import queue
import re
import shutil
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import zipfile
from urllib.parse import parse_qs, quote, unquote, urlparse
import urllib.error
import urllib.request
import uuid
from functools import total_ordering

try:
    import openpyxl
except Exception:
    openpyxl = None

try:
    import pythoncom
    import win32com.client
    import win32con
    import win32gui
    import win32process
except Exception:
    pythoncom = None
    win32com = None
    win32con = None
    win32gui = None
    win32process = None


HOST = os.environ.get("B2B_HOST", "127.0.0.1")
PORT = int(os.environ.get("B2B_PORT", "8090"))
VLLM_BASE = os.environ.get(
    "B2B_VLLM_BASE",
    "http://canvas-ns-1727666527880704.mng.ip.violet.uplus.co.kr",
).rstrip("/")
PROXY_RETRY_ATTEMPTS = int(os.environ.get("B2B_PROXY_RETRY_ATTEMPTS", "3"))
PROXY_RETRY_BASE_DELAY = float(os.environ.get("B2B_PROXY_RETRY_BASE_DELAY", "0.6"))
BACKEND_DIR = Path(tempfile.gettempdir()) / "b2b_backend_v044"
WORKBOOKS = {}
RESULTS = {}
DIFFS = {}
PIPELINE_STEP_SNAPSHOTS = {}
PIPELINE_JOBS = {}
EXCEL_SESSIONS = {}
EXCEL_LOCK = threading.RLock()
EXCEL_QUEUE = None
EXCEL_THREAD = None
LIVE_EXCEL_APP = None  # 라이브 편집 세션들이 공유하는 앱 전용 Excel.Application
# 단일 Excel 인스턴스(SDI)에서 워크북마다 생기는 최상위 프레임을 "세션별 hwnd"로 직접 제어하는 모드.
# app.Hwnd(=그 순간 활성 프레임 1개) 기반의 기존 동작으로 되돌리려면 B2B_WINMODE=legacy 로 실행.
LIVE_FRAME_MODE = (os.environ.get("B2B_WINMODE") or "frame").strip().lower() != "legacy"
PYTHON_SKILL_APP = None  # 라이브 미러가 없을 때 Python 스킬 실행용으로 재사용하는 숨김 Excel 인스턴스
PYTHON_SKILL_APP_PID = None  # 위 인스턴스의 pid — 강제 정리(force-restart/초기화) 때 COM 없이 종료하기 위해 기록
PIPELINE_JOBS_LOCK = threading.Lock()
WORKBOOK_CACHE_LOCK = threading.Lock()
NODE_WORKER_LOCK = threading.Lock()
NODE_WORKER = None
NODE_WORKER_SCRIPT_MTIME = None
NODE_WORKER_READY = set()
PREVIEW_ROWS = 500
PREVIEW_COLS = None
MAX_DIFF_CELLS_PER_SHEET = 5000
MAX_PIPELINE_STEP_SNAPSHOTS = 80
MAX_PIPELINE_JOBS = 40
# 큰 출력 워크북은 단계마다 전체를 디스크에 저장(SaveCopyAs)하면 매우 느리다.
# 이 크기를 넘으면 중간 단계 스냅샷을 건너뛰고 "마지막 단계"만 저장한다(동일 파이프라인 재적용은 여전히 즉시).
SNAPSHOT_INTERMEDIATE_MAX_BYTES = 8 * 1024 * 1024
PIPELINE_JOB_TTL_SECONDS = 60 * 60
APP_BUILD_STAMP = "b2b-overlay-shell-20260605-047-02"
EXCEL_MIRROR_PROTECT_PASSWORD = "b2b_mirror_readonly"


def app_base_dir():
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def writable_app_dir():
    env_dir = os.environ.get("B2B_WRITABLE_APP_DIR")
    if env_dir:
        return Path(env_dir).expanduser().resolve()
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def logic_backup_dir():
    return writable_app_dir() / "auto_backups"


def node_executable():
    bundled = app_base_dir() / ("node.exe" if os.name == "nt" else "node")
    if bundled.exists():
        return str(bundled)
    found = shutil.which("node")
    return found or None


def hidden_subprocess_kwargs():
    if os.name != "nt":
        return {}
    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startupinfo.wShowWindow = 0
    return {
        "startupinfo": startupinfo,
        "creationflags": subprocess.CREATE_NO_WINDOW,
    }


def cleanup_node_worker():
    global NODE_WORKER
    worker = NODE_WORKER
    NODE_WORKER = None
    NODE_WORKER_READY.clear()
    if not worker or worker.poll() is not None:
        return
    try:
        worker.kill()
        worker.wait(timeout=3)
    except Exception:
        try:
            worker.terminate()
        except Exception:
            pass


def excel_available():
    return os.name == "nt" and pythoncom is not None and win32com is not None


def cleanup_excel_sessions():
    if not excel_available():
        return
    pids = []
    try:
        pids = [session.get("pid") for session in list(EXCEL_SESSIONS.values()) if session.get("pid")]
    except Exception:
        pids = []
    try:
        excel_call(_cleanup_excel_sessions_impl, timeout=20)
    except Exception:
        # Shutdown must not leave Excel behind.  If COM is busy or the STA worker
        # times out, kill only the Excel processes that this app created.
        try:
            EXCEL_SESSIONS.clear()
        except Exception:
            pass
        for pid in pids:
            _hide_excel_windows_for_pid(pid)
            _force_kill_pid(pid)


def ensure_excel_worker():
    global EXCEL_QUEUE, EXCEL_THREAD
    if EXCEL_THREAD and EXCEL_THREAD.is_alive() and EXCEL_QUEUE is not None:
        return
    EXCEL_QUEUE = queue.Queue()

    def worker():
        pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
        try:
            while True:
                try:
                    item = EXCEL_QUEUE.get(timeout=0.05)
                except queue.Empty:
                    pythoncom.PumpWaitingMessages()
                    continue
                if item is None:
                    break
                fn, args, kwargs, done = item
                try:
                    result = fn(*args, **kwargs)
                    pythoncom.PumpWaitingMessages()
                    done.put((True, result))
                except Exception as err:
                    done.put((False, err))
        finally:
            try:
                _cleanup_excel_sessions_impl()
            finally:
                pythoncom.CoUninitialize()

    EXCEL_THREAD = threading.Thread(target=worker, name="b2b-excel-com", daemon=True)
    EXCEL_THREAD.start()


def excel_call(fn, *args, timeout=60, **kwargs):
    if not excel_available():
        raise RuntimeError("Microsoft Excel COM automation is not available. Excel and pywin32 are required.")
    ensure_excel_worker()
    done = queue.Queue(maxsize=1)
    EXCEL_QUEUE.put((fn, args, kwargs, done))
    try:
        ok, result = done.get(timeout=timeout)
    except queue.Empty:
        raise TimeoutError(
            f"Excel COM 작업이 {timeout}초 안에 끝나지 않았습니다. "
            "컴퓨터 성능에 따라 Excel 작업이 지연될 수 있습니다. 잠시 후 다시 시도해 주세요."
        )
    if ok:
        return result
    raise result


def _cleanup_excel_sessions_impl():
    _quit_python_skill_app()
    sessions = list(EXCEL_SESSIONS.values())
    EXCEL_SESSIONS.clear()
    pids = set()
    apps = []
    app_keys = set()
    for session in sessions:
        pid = session.get("pid")
        if pid:
            pids.add(pid)
        try:
            app, wb = session_workbook(session)
            try:
                key = int(app.Hwnd)
            except Exception:
                key = id(app)
            if key not in app_keys:
                app_keys.add(key)
                apps.append(app)
            _close_companion_workbooks(session, app)
            wb.Close(SaveChanges=False)
        except Exception:
            pass
        for key in ("openTempPath", "workingCopyPath"):
            temp_path = session.get(key)
            if temp_path:
                try:
                    Path(temp_path).unlink(missing_ok=True)
                except Exception:
                    pass
        for cdir in session.get("companionTemps") or []:
            try:
                shutil.rmtree(cdir, ignore_errors=True)
            except Exception:
                pass
    for app in apps:
        try:
            app.DisplayAlerts = False
        except Exception:
            pass
        try:
            app.Quit()
        except Exception:
            pass
    global LIVE_EXCEL_APP
    LIVE_EXCEL_APP = None
    for pid in pids:
        deadline = time.time() + 1.5
        while time.time() < deadline and _is_pid_alive(pid):
            time.sleep(0.1)
        if _is_pid_alive(pid):
            _force_kill_pid(pid)


def _force_restart_excel_sessions_direct():
    """COM 큐를 '우회'하는 응급 복구. 공유 EXCEL.EXE 가 모달/행으로 굳으면 모든 excel_call 이
    타임아웃되고 일반 close-all 조차 같은 큐에 줄을 서서 들어가지 못한다(단일 인스턴스의 단일 장애점).
    여기서는 COM 호출 없이 세션에 저장해 둔 pid 만으로 프로세스를 강제 종료하고 상태를 비운다.
    워커 스레드가 EXCEL_LOCK 을 쥔 채 멈춰 있을 수 있으므로 락은 짧게만 시도하고 실패해도 진행한다
    (프로세스가 죽으면 굳어 있던 COM 호출도 오류로 풀려난다)."""
    acquired = False
    try:
        acquired = EXCEL_LOCK.acquire(timeout=2)
    except Exception:
        acquired = False
    try:
        sessions = list(EXCEL_SESSIONS.values())
        EXCEL_SESSIONS.clear()
    finally:
        if acquired:
            try:
                EXCEL_LOCK.release()
            except Exception:
                pass
    global LIVE_EXCEL_APP, PYTHON_SKILL_APP, PYTHON_SKILL_APP_PID
    LIVE_EXCEL_APP = None
    PYTHON_SKILL_APP = None
    pids = set()
    if PYTHON_SKILL_APP_PID:
        # 숨김 Python 스킬 인스턴스도 같이 정리(놔두면 보이지 않는 EXCEL.EXE 고아로 남는다).
        try:
            pids.add(int(PYTHON_SKILL_APP_PID))
        except Exception:
            pass
    PYTHON_SKILL_APP_PID = None
    for session in sessions:
        pid = session.get("pid")
        if pid:
            try:
                pids.add(int(pid))
            except Exception:
                pass
    killed = 0
    for pid in pids:
        if _is_pid_alive(pid):
            _force_kill_pid(pid)
            killed += 1
    deadline = time.time() + 2.0
    while time.time() < deadline and any(_is_pid_alive(p) for p in pids):
        time.sleep(0.1)
    # 프로세스 종료 후에야 파일 잠금이 풀리므로 임시 파일 정리는 마지막에.
    for session in sessions:
        for key in ("openTempPath", "workingCopyPath"):
            temp_path = session.get(key)
            if temp_path:
                try:
                    Path(temp_path).unlink(missing_ok=True)
                except Exception:
                    pass
        for cdir in session.get("companionTemps") or []:
            try:
                shutil.rmtree(cdir, ignore_errors=True)
            except Exception:
                pass
    return {"ok": True, "killed": killed, "sessions": len(sessions)}


atexit.register(cleanup_node_worker)
atexit.register(cleanup_excel_sessions)


class PipelineExecutionError(RuntimeError):
    def __init__(self, message, info=None):
        if info is None and isinstance(message, dict):
            info = message
            message = info.get("message") or info.get("error") or "pipeline step failed"
        super().__init__(message)
        self.info = info or {}


def _pipeline_error_guide(message, code=""):
    """난해한 엔진 예외를 (원인, 프롬프트 작성 가이드) 한국어 쌍으로 변환한다.
    사용자가 '왜 났는지' 이해하고 '다음엔 어떻게 요청해야 하는지' 케이스별로 알 수 있게 한다."""
    m = str(message or "")
    ml = m.lower()
    def has(*subs):
        return any(s in ml for s in subs)
    if has("cannot convert") and has("excel", "cell"):
        return ("행(여러 값)을 한 칸(셀)에 통째로 쓰려다 실패했습니다.",
                "한 셀이 아니라 '표/범위'로 써달라고 명확히 하세요. 예: \"안전제일 행들을 새 시트 A1부터 표로 넣어줘\" 또는 \"한 행씩 차례로 추가해줘\".")
    if ("sheet" in ml and "not" in ml and "found" in ml) or ("시트" in m and ("없" in m or "찾지" in m)):
        return ("지정한 시트를 찾지 못했습니다(앞 단계에서 만든 중간 시트를 엉뚱한 곳에서 찾는 경우가 흔합니다).",
                "이전 단계가 만든 시트를 쓸 땐 그 이름을 정확히 적고 \"앞 단계에서 만든 ○○ 시트에서\"라고 하세요. 원본 입력 시트는 @시트[파일/시트]로 콕 집어 지정하세요.")
    if ("column not found" in ml) or ("col" in ml and "not found" in ml) or ("열" in m and ("없" in m or "찾지" in m)) or ("헤더" in m and "찾" in m):
        return ("표의 헤더(열 이름)를 찾지 못했습니다.",
                "열을 정확한 헤더명이나 열 문자로 지정하세요. 예: \"수납금액 열\" 또는 \"C열\". 가장 확실한 방법은 @컬럼[...] / @범위[...] 로 지정하는 것입니다.")
    if has("has no attribute"):
        return ("데이터 값을 객체처럼 잘못 다뤄 생긴 코드 오류입니다(생성된 코드 문제).",
                "한 번 더 생성하거나 작업을 더 작게 쪼개 요청하세요. 예: \"합계만 B30 셀에 직접 써줘\"처럼 단순하게.")
    if has("is not defined") or "name '" in ml:
        return ("코드가 정의되지 않은 것을 사용했습니다(생성된 코드 문제).",
                "재생성하거나 한 번에 한 작업씩 나눠 요청하세요. 여러 작업을 한 문장에 몰아넣지 마세요.")
    if has("index out of range", "list index") or ("out of range" in ml and "subscript" not in ml):
        return ("행/열 범위를 벗어났습니다.",
                "대상 범위를 명시하세요. 예: \"A4:D24 범위만\", \"헤더는 3행\"처럼 위치를 알려주면 안전합니다.")
    if has("division by zero", "zerodivision"):
        return ("0으로 나누는 계산이 있었습니다.",
                "0일 때 처리를 알려주세요. 예: \"분모가 0이면 결과는 0으로\".")
    if has("merged") or "병합" in m:
        return ("병합된 셀에 직접 쓰려다 실패했습니다.",
                "병합 영역은 \"왼쪽 위 셀에만 써줘\"라고 하거나, 병합/서식 변경이 필요하면 코드 첫 줄에 # B2B_ENGINE_FALLBACK: excel-com 을 넣어 Excel 처리를 요청하세요.")
    if has("read-only", "read only", "permission denied") or ("저장" in m and ("실패" in m or "권한" in m)):
        return ("입력 파일은 읽기 전용이라, 입력에 쓰거나 저장하려다 실패했을 수 있습니다.",
                "결과는 출력 파일에 쓰도록 하세요. 입력 파일을 꼭 바꿔야 하면 코드 첫 줄에 # B2B_ENGINE_FALLBACK: excel-com 을 넣어 Excel 처리를 요청하세요.")
    # ── VBA(Excel COM 매크로) 특유 오류 ── (subscript/accessvbom/문법 등은 위 일반 케이스보다 먼저 잡히도록 케이스 조건을 한정)
    if has("accessvbom") or ("프로젝트에 접근" in m) or ("매크로 설정" in m):
        return ("Excel이 VBA(매크로) 접근을 차단했습니다.",
                "이건 프롬프트로는 해결되지 않습니다 — Excel 옵션 > 보안 센터 > 매크로 설정에서 'VBA 프로젝트 개체 모델에 대한 액세스 신뢰'를 켠 뒤 파일을 다시 여세요.")
    if has("subscript out of range") or ("첨자" in m) or ("적용 범위를 벗어" in m):
        return ("지정한 시트·파일·범위가 없거나 이름이 틀렸습니다(subscript out of range).",
                "@파일[...] / @시트[파일/시트]로 정확한 이름을 지정하세요. 앞 단계에서 만든 시트면 그 이름을 그대로, 새로 만들 거면 \"새 시트 ○○에\"라고 명시하세요.")
    if has("type mismatch") or ("형식이 일치" in m) or ("형식이 맞지" in m):
        return ("값의 형식이 맞지 않습니다(숫자 자리에 글자가 있는 등).",
                "어느 열이 숫자/날짜인지 알려주거나 \"빈칸·문자는 0으로 처리\"처럼 예외 규칙을 함께 적어주세요.")
    if ("변경된 셀이 없" in m) or ("매칭" in m and "없" in m) or ("바뀐" in m and "없" in m):
        return ("코드는 실행됐지만 조건에 맞는 대상이 없어 아무것도 바뀌지 않았습니다.",
                "대상 시트/열/조건이 실제 데이터와 맞는지 확인하세요. 특히 이름 표기(회사명/항목명 등)가 입력·출력에서 다르면 @컬럼/@범위로 정확히 지정하거나 \"비슷한 이름도 매칭해줘\"라고 요청하세요.")
    if ("문법 오류" in m) or has("compile error", "syntax error") or ("컴파일" in m and "오류" in m):
        return ("생성된 VBA 코드에 문법 오류가 있습니다(생성 문제).",
                "한 번 더 생성하거나 작업을 더 단순하게 나눠 요청하세요.")
    if has("1004", "application-defined", "object-defined") or ("개체에서 정의" in m):
        return ("Excel이 그 작업을 거부했습니다(잘못된 범위·시트, 보호, 병합 등 1004 오류).",
                "대상 범위/시트를 @범위·@시트로 명확히 지정하세요. 열/행 삽입·삭제는 \"J열 앞에 한 열\", \"5행 위에 한 행\"처럼 전체 열/행 기준으로 요청하면 안전합니다.")
    return ("작업 중 예기치 못한 오류가 났습니다.",
            "요청을 더 구체적으로 적어주세요 — 대상 파일/시트/열/범위를 @파일·@시트·@컬럼·@범위로 지정하고, 한 번에 한 작업씩 나누면 정확도가 올라갑니다.")


class B2BHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        if os.environ.get("B2B_LOG_REQUESTS") == "1":
            super().log_message(format, *args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "authorization, content-type, api-key, x-api-key, x-b2b-vllm-base")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/api/backend/health":
            app_dir = app_base_dir()
            def file_info(relative_path):
                path = app_dir / relative_path
                if not path.exists():
                    return None
                return {
                    "path": str(path),
                    "mtime": path.stat().st_mtime,
                }
            self.send_json({
                "ok": True,
                "mode": "python-backend-workbooks",
                "buildStamp": APP_BUILD_STAMP,
                "pid": os.getpid(),
                "cwd": os.getcwd(),
                "serverFile": str(Path(__file__).resolve()),
                "appDir": str(app_dir),
                "openpyxl": bool(openpyxl),
                "excelCom": bool(excel_available()),
                "node": bool(node_executable()),
                "nodePath": node_executable(),
                "files": {
                    "index.html": file_info("index.html"),
                    "scripts/config.js": file_info("scripts/config.js"),
                    "scripts/excel-viewer.js": file_info("scripts/excel-viewer.js"),
                    "scripts/excel-mirror.js": file_info("scripts/excel-mirror.js"),
                    "scripts/mentions.js": file_info("scripts/mentions.js"),
                    "scripts/backend-workbooks.js": file_info("scripts/backend-workbooks.js"),
                    "scripts/backend-pipeline-worker.js": file_info("scripts/backend-pipeline-worker.js"),
                },
            })
            return
        if self.path.startswith("/api/workbooks/download/"):
            self.handle_backend_download()
            return
        if self.path.startswith("/api/workbooks/source/"):
            self.handle_workbook_source_download()
            return
        if self.path.startswith("/api/pipeline/status/"):
            self.handle_pipeline_status()
            return
        if self.path.startswith("/api/diff/"):
            self.handle_cached_diff()
            return
        if self.path.startswith("/v1/"):
            self.proxy()
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/workbooks/upload"):
            self.handle_workbook_upload()
            return
        if self.path == "/api/workbooks/archive":
            self.handle_workbook_archive()
            return
        if self.path == "/api/logic/backup":
            self.handle_logic_backup()
            return
        if self.path == "/api/pipeline/run":
            self.handle_backend_pipeline_run()
            return
        if self.path == "/api/pipeline/start":
            self.handle_backend_pipeline_start()
            return
        if self.path == "/api/excel/open":
            self.handle_excel_open()
            return
        if self.path == "/api/excel/open-result":
            self.handle_excel_open_result()
            return
        if self.path == "/api/excel/replace":
            self.handle_excel_replace()
            return
        if self.path == "/api/excel/activate":
            self.handle_excel_activate()
            return
        if self.path == "/api/excel/position":
            self.handle_excel_position()
            return
        if self.path == "/api/excel/show-only":
            self.handle_excel_show_only()
            return
        if self.path == "/api/excel/recover":
            self.handle_excel_recover()
            return
        if self.path == "/api/excel/raise":
            self.handle_excel_raise()
            return
        if self.path == "/api/excel/hide":
            self.handle_excel_hide()
            return
        if self.path == "/api/excel/hide-all":
            self.send_json(hide_all_excel_sessions())
            return
        if self.path == "/api/excel/hide-inactive":
            self.send_json(hide_inactive_excel_sessions())
            return
        if self.path == "/api/excel/save":
            self.handle_excel_save()
            return
        if self.path == "/api/excel/changes":
            self.handle_excel_changes()
            return
        if self.path == "/api/excel/run-vba":
            self.handle_excel_run_vba()
            return
        if self.path == "/api/excel/run-vba-pipeline":
            self.handle_excel_run_vba_pipeline()
            return
        if self.path == "/api/excel/hover-info":
            self.handle_excel_hover_info()
            return
        if self.path == "/api/excel/close":
            self.handle_excel_close()
            return
        if self.path == "/api/excel/close-all-async":
            self.send_json({"ok": True})
            threading.Thread(target=cleanup_excel_sessions, name="b2b-excel-close-all", daemon=True).start()
            return
        if self.path == "/api/excel/force-restart":
            # COM 큐 '우회' 응급 복구(공유 Excel 행/모달 고착 시). excel_call 을 쓰지 않는다.
            try:
                self.send_json(_force_restart_excel_sessions_direct())
            except Exception as err:
                self.send_json({"ok": False, "error": str(err)}, status=500)
            return
        if self.path == "/api/excel/close-all":
            cleanup_excel_sessions()
            self.send_json({"ok": True})
            return
        if self.path == "/api/diff/current-view":
            self.handle_current_view_diff()
            return
        if self.path.startswith("/v1/"):
            self.proxy()
            return
        self.send_error(404)

    def read_json_body(self):
        length = int(self.headers.get("content-length") or 0)
        if not length:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            # NativeHost/WebView can close before cleanup responses are flushed.
            # Treat this as a normal shutdown/reset race instead of printing errors.
            return

    def handle_current_view_diff(self):
        try:
            payload = self.read_json_body()
            before = payload.get("before") or {}
            after = payload.get("after") or {}
            before_cells = {
                f"{cell.get('r')}:{cell.get('c')}": cell.get("value")
                for cell in before.get("cells", [])
            }
            changes = []
            for cell in after.get("cells", []):
                key = f"{cell.get('r')}:{cell.get('c')}"
                value = cell.get("value")
                if before_cells.get(key) != value:
                    changes.append({
                        "r": cell.get("r"),
                        "c": cell.get("c"),
                        "value": value,
                    })
            self.send_json({
                "ok": True,
                "fileId": after.get("fileId"),
                "sheet": after.get("sheet"),
                "changes": changes,
            })
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_cached_diff(self):
        diff_id = self.path.rsplit("/", 1)[-1]
        diff = DIFFS.get(diff_id)
        if not diff:
            self.send_json({"ok": False, "error": "diff not found"}, status=404)
            return
        self.send_json({"ok": True, **diff})

    def handle_workbook_upload(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        raw_name = qs.get("name", ["workbook.xlsx"])[0]
        name = Path(unquote(raw_name)).name or "workbook.xlsx"
        if openpyxl is None and not is_csv_path(name) and not excel_available():
            self.send_json({"ok": False, "error": "openpyxl or Microsoft Excel COM is required"}, status=500)
            return
        length = int(self.headers.get("content-length") or 0)
        if length <= 0:
            self.send_json({"ok": False, "error": "empty upload"}, status=400)
            return
        BACKEND_DIR.mkdir(parents=True, exist_ok=True)
        workbook_id = uuid.uuid4().hex
        path = BACKEND_DIR / f"{workbook_id}_{name}"
        with path.open("wb") as f:
            remaining = length
            while remaining > 0:
                chunk = self.rfile.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)
        meta = inspect_workbook(path)
        WORKBOOKS[workbook_id] = {
            "id": workbook_id,
            "name": name,
            "path": str(path),
            "created": time.time(),
            "aoa_cache": None,
            "current_aoa_cache": None,
            "aoa_cache_created": None,
            "aoa_cache_hits": 0,
        }
        self.send_json({"ok": True, "workbookId": workbook_id, "name": name, "meta": meta})

    def handle_backend_pipeline_run(self):
        if openpyxl is None:
            self.send_json({"ok": False, "error": "openpyxl is not available"}, status=500)
            return
        if not node_executable():
            self.send_json({"ok": False, "error": "node runtime is not available"}, status=500)
            return
        payload = self.read_json_body()
        try:
            self.send_json(run_backend_pipeline_payload(payload))
        except PipelineExecutionError as err:
            self.send_json({"ok": False, "error": str(err), "errorInfo": err.info}, status=400)
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_backend_pipeline_start(self):
        payload = self.read_json_body()
        job_id = uuid.uuid4().hex
        total_steps = len([s for s in payload.get("pipeline", []) if not (s and s.get("enabled") is False)])
        update_pipeline_job(job_id, {
            "ok": True,
            "jobId": job_id,
            "status": "running",
            "stage": "준비 중",
            "currentStep": 0,
            "totalSteps": total_steps,
            "created": time.time(),
        })

        def worker():
            try:
                result = run_backend_pipeline_payload(payload, job_id=job_id)
                result.update({"ok": True, "jobId": job_id, "status": "done", "stage": "완료"})
                update_pipeline_job(job_id, result)
            except PipelineExecutionError as err:
                update_pipeline_job(job_id, {
                    "ok": False,
                    "jobId": job_id,
                    "status": "error",
                    "stage": "오류",
                    "error": str(err),
                    "errorInfo": err.info,
                })
            except Exception as err:
                update_pipeline_job(job_id, {
                    "ok": False,
                    "jobId": job_id,
                    "status": "error",
                    "stage": "오류",
                    "error": str(err),
                })

        threading.Thread(target=worker, name=f"b2b-pipeline-{job_id[:8]}", daemon=True).start()
        self.send_json({"ok": True, "jobId": job_id, "status": "running"})

    def handle_pipeline_status(self):
        job_id = self.path.rsplit("/", 1)[-1]
        with PIPELINE_JOBS_LOCK:
            prune_pipeline_jobs_locked()
            job = dict(PIPELINE_JOBS.get(job_id) or {})
        if not job:
            self.send_json({"ok": False, "error": "pipeline job not found"}, status=404)
            return
        self.send_json(job)

    def handle_backend_download(self):
        result_id = self.path.rsplit("/", 1)[-1]
        path = ensure_result_file(result_id)
        if not path:
            self.send_error(404)
            return
        data = path.read_bytes()
        self.send_response(200)
        if path.suffix.lower() == ".csv":
            self.send_header("content-type", "text/csv; charset=utf-8")
        else:
            self.send_header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.send_header("content-disposition", content_disposition_attachment(path.name))
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_workbook_source_download(self):
        workbook_id = self.path.rsplit("/", 1)[-1]
        wb = recover_workbook_record(workbook_id)
        if not wb:
            self.send_error(404)
            return
        path = Path(wb["path"])
        if not path.exists():
            self.send_error(404)
            return
        data = path.read_bytes()
        self.send_response(200)
        if path.suffix.lower() == ".csv":
            self.send_header("content-type", "text/csv; charset=utf-8")
        else:
            self.send_header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.send_header("content-disposition", content_disposition_attachment(wb.get("name") or path.name))
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_workbook_archive(self):
        archive_path = None
        try:
            payload = self.read_json_body()
            archive_path, filename = build_workbook_archive(payload)
            self.send_response(200)
            self.send_header("content-type", "application/zip")
            self.send_header("content-disposition", content_disposition_attachment(filename))
            self.send_header("content-length", str(archive_path.stat().st_size))
            self.end_headers()
            with archive_path.open("rb") as f:
                shutil.copyfileobj(f, self.wfile)
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)
        finally:
            if archive_path:
                try:
                    archive_path.unlink()
                except Exception:
                    pass

    def handle_logic_backup(self):
        try:
            length = int(self.headers.get("content-length") or 0)
            if length <= 0:
                raise ValueError("backup payload is empty")
            raw = self.rfile.read(length)
            filename = safe_archive_filename(
                self.headers.get("x-filename"),
                f"logic_auto_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
            )
            if not filename.lower().endswith(".zip"):
                filename += ".zip"
            target_dir = logic_backup_dir()
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / filename
            if target_path.exists():
                stem = target_path.stem
                suffix = target_path.suffix
                target_path = target_dir / f"{stem}_{uuid.uuid4().hex[:8]}{suffix}"
            target_path.write_bytes(raw)
            cleanup_logic_backups(target_dir)
            self.send_json({
                "ok": True,
                "name": target_path.name,
                "path": str(target_path),
                "reason": self.headers.get("x-backup-reason") or "",
            })
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_open(self):
        payload = self.read_json_body()
        workbook_id = payload.get("workbookId")
        wb_record = recover_workbook_record(workbook_id)
        if not wb_record:
            self.send_json({"ok": False, "error": "workbook not found"}, status=404)
            return
        try:
            self.send_json(open_excel_session(
                Path(wb_record["path"]),
                name=wb_record.get("name"),
                workbook_id=workbook_id,
                read_only_mirror=bool(payload.get("readOnlyMirror")),
                live_editable=bool(payload.get("liveEditable")),
                left=payload.get("left"),
                top=payload.get("top"),
                width=payload.get("width"),
                height=payload.get("height"),
                client_left=payload.get("clientLeft"),
                client_top=payload.get("clientTop"),
                client_width=payload.get("clientWidth"),
                client_height=payload.get("clientHeight"),
                viewport_width=payload.get("viewportWidth"),
                viewport_height=payload.get("viewportHeight"),
                browser_title=payload.get("browserTitle"),
                native_parent_hwnd=payload.get("nativeParentHwnd"),
                native_host_hwnd=payload.get("nativeHostHwnd"),
                native_overlay=bool(payload.get("nativeOverlay")),
                defer_visible=bool(payload.get("deferVisible")),
            ))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=500)

    def handle_excel_open_result(self):
        payload = self.read_json_body()
        result_id = payload.get("resultId") or str(payload.get("downloadUrl") or "").rstrip("/").rsplit("/", 1)[-1]
        path = ensure_result_file(result_id)
        if not path:
            self.send_json({"ok": False, "error": "result not found"}, status=404)
            return
        try:
            self.send_json(open_excel_session(
                path,
                name=path.name,
                result_id=result_id,
                read_only_mirror=bool(payload.get("readOnlyMirror")),
                live_editable=bool(payload.get("liveEditable")),
                left=payload.get("left"),
                top=payload.get("top"),
                width=payload.get("width"),
                height=payload.get("height"),
                client_left=payload.get("clientLeft"),
                client_top=payload.get("clientTop"),
                client_width=payload.get("clientWidth"),
                client_height=payload.get("clientHeight"),
                viewport_width=payload.get("viewportWidth"),
                viewport_height=payload.get("viewportHeight"),
                browser_title=payload.get("browserTitle"),
                native_parent_hwnd=payload.get("nativeParentHwnd"),
                native_host_hwnd=payload.get("nativeHostHwnd"),
                native_overlay=bool(payload.get("nativeOverlay")),
                defer_visible=bool(payload.get("deferVisible")),
            ))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=500)

    def handle_excel_replace(self):
        payload = self.read_json_body()
        result_id = payload.get("resultId") or str(payload.get("downloadUrl") or "").rstrip("/").rsplit("/", 1)[-1]
        path = ensure_result_file(result_id)
        if not path:
            self.send_json({"ok": False, "error": "result not found"}, status=404)
            return
        try:
            read_only_mirror = payload.get("readOnlyMirror") if "readOnlyMirror" in payload else None
            self.send_json(replace_excel_session_workbook(
                payload.get("excelId"),
                path,
                name=path.name,
                result_id=result_id,
                read_only_mirror=read_only_mirror,
            ))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=500)

    def handle_excel_run_vba(self):
        payload = self.read_json_body()
        try:
            self.send_json(run_vba_on_session(
                payload.get("excelId"),
                payload.get("code") or payload.get("vba") or "",
                entry=payload.get("entry"),
            ))
        except PipelineExecutionError as err:
            self.send_json({"ok": False, "error": str(err), "errorInfo": err.info}, status=400)
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=500)

    def handle_excel_run_vba_pipeline(self):
        payload = self.read_json_body()
        reset = payload.get("reset")
        try:
            self.send_json(run_vba_pipeline_on_session(
                payload.get("excelId"),
                payload.get("steps") or [],
                reset=True if reset is None else bool(reset),
                entry=payload.get("entry"),
            ))
        except PipelineExecutionError as err:
            self.send_json({"ok": False, "error": str(err), "errorInfo": err.info}, status=400)
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=500)

    def handle_excel_activate(self):
        payload = self.read_json_body()
        try:
            self.send_json(activate_excel_session(
                payload.get("excelId"),
                payload.get("sheet"),
                payload.get("range") or payload.get("address"),
            ))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_position(self):
        payload = self.read_json_body()
        try:
            self.send_json(position_excel_session(
                payload.get("excelId"),
                payload.get("left"),
                payload.get("top"),
                payload.get("width"),
                payload.get("height"),
                client_left=payload.get("clientLeft"),
                client_top=payload.get("clientTop"),
                client_width=payload.get("clientWidth"),
                client_height=payload.get("clientHeight"),
                viewport_width=payload.get("viewportWidth"),
                viewport_height=payload.get("viewportHeight"),
                browser_title=payload.get("browserTitle"),
                native_parent_hwnd=payload.get("nativeParentHwnd"),
                native_host_hwnd=payload.get("nativeHostHwnd"),
                native_overlay=bool(payload.get("nativeOverlay")),
                keep_zorder=bool(payload.get("keepZorder")),
            ))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_show_only(self):
        payload = self.read_json_body()
        try:
            self.send_json(show_only_excel_session(
                payload.get("excelId"),
                payload.get("left"),
                payload.get("top"),
                payload.get("width"),
                payload.get("height"),
                client_left=payload.get("clientLeft"),
                client_top=payload.get("clientTop"),
                client_width=payload.get("clientWidth"),
                client_height=payload.get("clientHeight"),
                viewport_width=payload.get("viewportWidth"),
                viewport_height=payload.get("viewportHeight"),
                browser_title=payload.get("browserTitle"),
                native_parent_hwnd=payload.get("nativeParentHwnd"),
                native_host_hwnd=payload.get("nativeHostHwnd"),
                native_overlay=bool(payload.get("nativeOverlay")),
                skip_position=bool(payload.get("skipPosition")),
            ))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_recover(self):
        payload = self.read_json_body()
        try:
            self.send_json(recover_excel_session(
                payload.get("excelId"),
                payload.get("left"),
                payload.get("top"),
                payload.get("width"),
                payload.get("height"),
                client_left=payload.get("clientLeft"),
                client_top=payload.get("clientTop"),
                client_width=payload.get("clientWidth"),
                client_height=payload.get("clientHeight"),
                viewport_width=payload.get("viewportWidth"),
                viewport_height=payload.get("viewportHeight"),
                browser_title=payload.get("browserTitle"),
                native_parent_hwnd=payload.get("nativeParentHwnd"),
                native_host_hwnd=payload.get("nativeHostHwnd"),
                native_overlay=bool(payload.get("nativeOverlay")),
            ))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_raise(self):
        payload = self.read_json_body()
        try:
            self.send_json(raise_excel_session(payload.get("excelId")))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_hide(self):
        payload = self.read_json_body()
        try:
            self.send_json(hide_excel_session(payload.get("excelId"), light=bool(payload.get("light"))))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_save(self):
        payload = self.read_json_body()
        try:
            self.send_json(save_excel_session(payload.get("excelId"), payload.get("name")))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_changes(self):
        payload = self.read_json_body()
        try:
            self.send_json(poll_excel_session_changes(payload.get("excelId")))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_hover_info(self):
        payload = self.read_json_body()
        try:
            self.send_json(get_excel_hover_info(payload.get("excelId")))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def handle_excel_close(self):
        payload = self.read_json_body()
        try:
            self.send_json(close_excel_session(payload.get("excelId")))
        except Exception as err:
            self.send_json({"ok": False, "error": str(err)}, status=400)

    def proxy(self):
        body = None
        if self.command in {"POST", "PUT", "PATCH"}:
            length = int(self.headers.get("content-length") or 0)
            body = self.rfile.read(length) if length else None

        # 프런트 설정에서 지정한 실제 Violet/vLLM 주소가 있으면 그쪽으로 전달.
        base = VLLM_BASE
        upstream = (self.headers.get("x-b2b-vllm-base") or "").strip()
        if upstream.startswith("http://") or upstream.startswith("https://"):
            base = upstream.rstrip("/")
        target = base + self.path
        headers = {}
        for key in ("authorization", "api-key", "content-type", "accept"):
            value = self.headers.get(key)
            if value:
                headers[key] = value
        if body is not None and "content-type" not in headers:
            headers["content-type"] = "application/json"

        attempts = max(1, PROXY_RETRY_ATTEMPTS)
        last_error = None
        for attempt in range(1, attempts + 1):
            response_started = False
            req = urllib.request.Request(
                target,
                data=body,
                headers=headers,
                method=self.command,
            )
            try:
                with urllib.request.urlopen(req, timeout=300) as resp:
                    self.send_response(resp.status)
                    for key, value in resp.headers.items():
                        if key.lower() in {"connection", "transfer-encoding", "content-encoding", "content-length"}:
                            continue
                        self.send_header(key, value)
                    self.end_headers()
                    response_started = True
                    while True:
                        chunk = resp.read(8192)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        self.wfile.flush()
                    return
            except urllib.error.HTTPError as err:
                payload = err.read()
                if err.code in {408, 429, 500, 502, 503, 504} and attempt < attempts:
                    last_error = f"HTTP {err.code}: {payload[:200]!r}"
                    time.sleep(PROXY_RETRY_BASE_DELAY * attempt)
                    continue
                self.send_response(err.code)
                self.send_header("content-type", err.headers.get("content-type", "text/plain"))
                self.end_headers()
                self.wfile.write(payload)
                return
            except (BrokenPipeError, ConnectionResetError):
                return
            except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as err:
                if response_started:
                    return
                last_error = err
                if attempt < attempts:
                    time.sleep(PROXY_RETRY_BASE_DELAY * attempt)
                    continue
                payload = f"Proxy error after {attempts} attempts: {last_error}".encode("utf-8")
                self.send_response(502)
                self.send_header("content-type", "text/plain; charset=utf-8")
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            except Exception as err:
                if response_started:
                    return
                last_error = err
                if attempt < attempts:
                    time.sleep(PROXY_RETRY_BASE_DELAY * attempt)
                    continue
                payload = f"Proxy error after {attempts} attempts: {last_error}".encode("utf-8")
                self.send_response(502)
                self.send_header("content-type", "text/plain; charset=utf-8")
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return


class B2BThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def update_pipeline_job(job_id, patch):
    if not job_id:
        return
    with PIPELINE_JOBS_LOCK:
        prune_pipeline_jobs_locked()
        current = PIPELINE_JOBS.get(job_id, {})
        current.update(patch)
        current["updated"] = time.time()
        PIPELINE_JOBS[job_id] = current


def prune_pipeline_jobs_locked():
    if not PIPELINE_JOBS:
        return
    now = time.time()
    stale = [
        job_id
        for job_id, job in PIPELINE_JOBS.items()
        if now - float(job.get("updated") or job.get("created") or now) > PIPELINE_JOB_TTL_SECONDS
    ]
    for job_id in stale:
        PIPELINE_JOBS.pop(job_id, None)
    if len(PIPELINE_JOBS) <= MAX_PIPELINE_JOBS:
        return
    ordered = sorted(
        PIPELINE_JOBS.items(),
        key=lambda item: float(item[1].get("updated") or item[1].get("created") or 0),
    )
    for job_id, _job in ordered[: max(0, len(PIPELINE_JOBS) - MAX_PIPELINE_JOBS)]:
        PIPELINE_JOBS.pop(job_id, None)


def content_disposition_attachment(filename):
    safe_ascii = "".join(ch if 32 <= ord(ch) < 127 and ch not in '"\\' else "_" for ch in str(filename))
    encoded = quote(str(filename), safe="")
    return f'attachment; filename="{safe_ascii}"; filename*=UTF-8\'\'{encoded}'


def archive_download_id(url):
    parsed = urlparse(str(url or ""))
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) >= 4 and parts[-4:-1] == ["api", "workbooks", "download"]:
        return unquote(parts[-1])
    return None


def archive_source_workbook_id(url):
    parsed = urlparse(str(url or ""))
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) >= 4 and parts[-4:-1] == ["api", "workbooks", "source"]:
        return unquote(parts[-1])
    return None


def safe_archive_filename(name, default_name):
    filename = Path(str(name or default_name)).name.strip() or default_name
    return filename.replace("\\", "_").replace("/", "_").replace("\x00", "_")


def cleanup_logic_backups(target_dir, keep=80):
    try:
        backups = sorted(
            [p for p in Path(target_dir).glob("*.zip") if p.is_file()],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for path in backups[keep:]:
            try:
                path.unlink()
            except Exception:
                pass
    except Exception:
        pass


def office_file_signature(path):
    try:
        with Path(path).open("rb") as f:
            return f.read(8)
    except OSError:
        return b""


def is_ooxml_zip_file(path):
    sig = office_file_signature(path)
    return sig.startswith(b"PK\x03\x04") or sig.startswith(b"PK\x05\x06") or sig.startswith(b"PK\x07\x08")


def is_ole_excel_file(path):
    return office_file_signature(path).startswith(b"\xD0\xCF\x11\xE0")


def sniff_text_excel_suffix(path):
    try:
        raw = Path(path).read_bytes()[:8192]
    except OSError:
        return None
    if not raw or b"\x00" in raw[:512]:
        return None
    lower = raw.lstrip().lower()
    if lower.startswith(b"<!doctype html") or lower.startswith(b"<html") or b"<table" in lower[:4096]:
        return ".html"
    for enc in ("utf-8-sig", "cp949", "euc-kr", "utf-8"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            text = ""
    if not text.strip():
        return None
    first_line = text.splitlines()[0] if text.splitlines() else text
    if "\t" in first_line:
        return ".tsv"
    if any(ch in first_line for ch in (",", ";", "|")):
        return ".csv"
    return None


def excel_compatible_open_path(path):
    path = Path(path)
    suffix = path.suffix.lower()
    wanted_suffix = None
    if is_ooxml_zip_file(path) and suffix not in {".xlsx", ".xlsm", ".xltx", ".xltm"}:
        wanted_suffix = ".xlsx"
    elif is_ole_excel_file(path) and suffix != ".xls":
        wanted_suffix = ".xls"
    elif suffix in {".xls", ".xlsx", ".xlsm", ".xltx", ".xltm"}:
        wanted_suffix = sniff_text_excel_suffix(path)
    if not wanted_suffix:
        return path, None
    BACKEND_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = BACKEND_DIR / f"excel_open_{uuid.uuid4().hex}{wanted_suffix}"
    shutil.copy2(path, temp_path)
    return temp_path, temp_path


def openpyxl_load_workbook_compatible(path, **kwargs):
    if openpyxl is None:
        raise RuntimeError("openpyxl is not available")
    path = Path(path)
    try:
        return openpyxl.load_workbook(path, **kwargs)
    except Exception as first_err:
        if not is_ooxml_zip_file(path):
            raise
        try:
            buffer = io.BytesIO(path.read_bytes())
            wb = openpyxl.load_workbook(buffer, **kwargs)
            wb._b2b_source_buffer = buffer
            return wb
        except Exception:
            raise first_err


def excel_workbooks_open(app, path, read_only=False):
    open_path, temp_path = excel_compatible_open_path(path)
    try:
        app.DisplayAlerts = False
    except Exception:
        pass
    try:
        app.EnableEvents = False
    except Exception:
        pass
    try:
        app.AskToUpdateLinks = False
    except Exception:
        pass
    try:
        app.AutomationSecurity = 3  # msoAutomationSecurityForceDisable
    except Exception:
        pass

    attempts = [
        {"UpdateLinks": 0, "ReadOnly": bool(read_only), "IgnoreReadOnlyRecommended": True, "Notify": False, "AddToMru": False, "Local": True, "CorruptLoad": 0},
        {"UpdateLinks": 0, "ReadOnly": bool(read_only), "IgnoreReadOnlyRecommended": True, "Notify": False, "AddToMru": False, "Local": True, "CorruptLoad": 1},
        {"UpdateLinks": 0, "ReadOnly": bool(read_only), "IgnoreReadOnlyRecommended": True, "Notify": False, "AddToMru": False, "Local": True, "CorruptLoad": 2},
        {"UpdateLinks": 0, "ReadOnly": bool(read_only), "IgnoreReadOnlyRecommended": True},
    ]
    errors = []
    for kwargs in attempts:
        try:
            wb = app.Workbooks.Open(str(open_path), **kwargs)
            try:
                # 초기화/응급복구가 EXCEL.EXE 를 강제 종료(taskkill)하는 방식이므로,
                # 다음 Excel 실행에서 '문서 복구' 창이 뜨지 않도록 우리가 여는 모든 워크북을
                # AutoRecover 대상에서 제외한다. 워크북 한정 속성이라 사용자 Excel 설정(레지스트리)은
                # 건드리지 않으며, 작업복사본(폐기 대상)이라 복구 정보 자체가 무의미하다.
                wb.EnableAutoRecover = False
            except Exception:
                pass
            return wb, temp_path
        except Exception as err:
            errors.append(err)
    if temp_path:
        try:
            Path(temp_path).unlink(missing_ok=True)
        except Exception:
            pass
    raise errors[-1] if errors else RuntimeError(f"failed to open workbook: {path}")


def unique_archive_name(used, folder, filename):
    filename = safe_archive_filename(filename, "workbook.xlsx")
    base = f"{folder}/{filename}" if folder else filename
    if base not in used:
        used.add(base)
        return base
    path = Path(filename)
    stem = path.stem or "workbook"
    suffix = path.suffix
    index = 2
    while True:
        candidate = f"{folder}/{stem}_{index}{suffix}" if folder else f"{stem}_{index}{suffix}"
        if candidate not in used:
            used.add(candidate)
            return candidate
        index += 1


def resolve_archive_item(item):
    item = item or {}
    name = safe_archive_filename(item.get("name"), "workbook.xlsx")
    path = None

    excel_id = item.get("excelId")
    if excel_id:
        try:
            saved = save_excel_session(excel_id)
            path = ensure_result_file(saved.get("downloadId"))
        except Exception:
            path = None

    if path is None:
        download_id = item.get("downloadId") or archive_download_id(item.get("downloadUrl"))
        if download_id:
            path = ensure_result_file(download_id)

    if path is None:
        source_id = item.get("workbookId") or archive_source_workbook_id(item.get("downloadUrl"))
        if source_id:
            wb = WORKBOOKS.get(source_id)
            if wb:
                path = Path(wb["path"])
                name = safe_archive_filename(item.get("name") or wb.get("name"), path.name)

    if not path or not Path(path).exists():
        raise ValueError(f"download source not found: {name}")
    return Path(path), name


def build_workbook_archive(payload):
    files = payload.get("files") if isinstance(payload, dict) else None
    if not isinstance(files, list) or not files:
        raise ValueError("archive files are empty")

    raw_filename = payload.get("filename") if isinstance(payload, dict) else None
    filename = safe_archive_filename(raw_filename, f"all_files_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip")
    if not filename.lower().endswith(".zip"):
        filename += ".zip"

    BACKEND_DIR.mkdir(parents=True, exist_ok=True)
    archive_path = BACKEND_DIR / f"{uuid.uuid4().hex}_{filename}"
    used_names = set()
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
        for item in files:
            src_path, display_name = resolve_archive_item(item)
            role = str((item or {}).get("role") or "").lower()
            folder = "inputs" if role == "input" else "outputs" if role == "output" else "files"
            arcname = unique_archive_name(used_names, folder, display_name)
            zf.write(src_path, arcname)
    return archive_path, filename


def normalize_text(value):
    return "".join(str(value or "").lower().split())


def normalize_sheet_lookup(value):
    # Sheet names often differ only by spaces/underscores generated by the LLM
    # ("인포콘_올인원_정렬" vs "인포콘올인원_정렬"). Keep this looser
    # matching scoped to sheet lookup only; data value matching remains stricter.
    return re.sub(r"[\s_\-]+", "", str(value or "").lower())


@total_ordering
class ExcelColumnNumber:
    """1-based Excel column number that is also safe as a Python row-list index."""
    def __init__(self, value):
        self.value = int(value)

    def __int__(self):
        return self.value

    def __index__(self):
        return max(0, self.value - 1)

    def __repr__(self):
        return str(self.value)

    def __str__(self):
        return str(self.value)

    def _coerce(self, other):
        try:
            return int(other)
        except Exception:
            return NotImplemented

    def __eq__(self, other):
        other_value = self._coerce(other)
        if other_value is NotImplemented:
            return False
        return self.value == other_value

    def __lt__(self, other):
        other_value = self._coerce(other)
        if other_value is NotImplemented:
            return NotImplemented
        return self.value < other_value

    def __hash__(self):
        return hash(self.value)

    def __add__(self, other):
        other_value = self._coerce(other)
        if other_value is NotImplemented:
            return NotImplemented
        return self.value + other_value

    def __radd__(self, other):
        return self.__add__(other)

    def __sub__(self, other):
        other_value = self._coerce(other)
        if other_value is NotImplemented:
            return NotImplemented
        return self.value - other_value

    def __rsub__(self, other):
        other_value = self._coerce(other)
        if other_value is NotImplemented:
            return NotImplemented
        return other_value - self.value


def _excel_collection_names(collection):
    names = []
    try:
        count = int(collection.Count)
    except Exception:
        return names
    for idx in range(1, count + 1):
        try:
            item = collection.Item(idx)
            name = getattr(item, "Name", None)
            if name:
                names.append(str(name))
        except Exception:
            continue
    return names


def ensure_result_file(result_id):
    if not result_id:
        return None
    result = RESULTS.get(result_id)
    if not result:
        return None
    if "workerWorkbookId" in result and "sheets" not in result:
        result["sheets"] = export_node_worker_workbook(result["workerWorkbookId"])
    if "path" not in result:
        result_path = BACKEND_DIR / f"{result_id}_{result.get('name') or 'result.xlsx'}"
        write_result_workbook(
            Path(result["template_path"]),
            result_path,
            result.get("sheets") or {},
            result.get("forced_value_cells") or [],
        )
        result["path"] = str(result_path)
    path = Path(result["path"])
    return path if path.exists() else None


def _protect_workbook_for_read_only_mirror(wb, enabled=True):
    for idx in range(1, wb.Worksheets.Count + 1):
        ws = wb.Worksheets(idx)
        try:
            if not enabled:
                ws.Unprotect(Password=EXCEL_MIRROR_PROTECT_PASSWORD)
                continue
        except Exception:
            pass
        if enabled:
            try:
                ws.Cells.Locked = True
            except Exception:
                pass
            try:
                ws.Protect(
                    EXCEL_MIRROR_PROTECT_PASSWORD,  # Password
                    True,   # DrawingObjects
                    True,   # Contents
                    True,   # Scenarios
                    True,   # UserInterfaceOnly
                    False,  # AllowFormattingCells
                    True,   # AllowFormattingColumns: column width drag/double-click autofit
                    True,   # AllowFormattingRows: row height drag/double-click autofit
                    False,  # AllowInsertingColumns
                    False,  # AllowInsertingRows
                    False,  # AllowInsertingHyperlinks
                    False,  # AllowDeletingColumns
                    False,  # AllowDeletingRows
                    True,   # AllowSorting
                    True,   # AllowFiltering
                    False,  # AllowUsingPivotTables
                )
            except TypeError:
                ws.Protect(Password=EXCEL_MIRROR_PROTECT_PASSWORD)
            except Exception:
                pass
            try:
                _allow_read_only_mirror_selection(ws)
            except Exception:
                pass


def _allow_read_only_mirror_selection(ws):
    try:
        ws.EnableSelection = 0  # xlNoRestrictions: allow cell/range selection on protected sheets.
    except Exception:
        pass
    try:
        ws.ScrollArea = ""
    except Exception:
        pass


def _configure_read_only_mirror_input_block(app):
    try:
        app.EditDirectlyInCell = False
    except Exception:
        pass
    try:
        app.CellDragAndDrop = True
    except Exception:
        pass
    try:
        app.CutCopyMode = False
    except Exception:
        pass
    for key in ("{F2}", "{DELETE}", "{BACKSPACE}", "^v", "^x", "+{INSERT}", "+{DELETE}"):
        try:
            app.OnKey(key, "")
        except Exception:
            pass


def _disable_excel_context_menus(app):
    """오버레이 엑셀에서 마우스 우클릭(컨텍스트) 메뉴를 막는다.
    msoBarTypePopup(2) CommandBar = 우클릭/컨텍스트 메뉴이므로 모두 비활성화한다.
    DispatchEx로 만든 전용 인스턴스라 사용자의 일반 엑셀에는 영향이 없다."""
    try:
        bars = app.CommandBars
        count = bars.Count
    except Exception:
        return
    for idx in range(1, count + 1):
        try:
            bar = bars.Item(idx)
            if bar.Type == 2:  # msoBarTypePopup
                bar.Enabled = False
        except Exception:
            continue


def _configure_excel_grid_window(app, wb=None):
    try:
        app.DisplayAlerts = False
        app.DisplayFormulaBar = False
        app.DisplayStatusBar = True
        app.Interactive = True
        app.UserControl = True
        app.EnableEvents = True
        _configure_read_only_mirror_input_block(app)
        app.ExecuteExcel4Macro('SHOW.TOOLBAR("Ribbon",False)')
    except Exception:
        pass
    try:
        app.CommandBars("Ribbon").Visible = False
    except Exception:
        pass
    _disable_excel_context_menus(app)
    try:
        win = app.ActiveWindow
        win.DisplayHeadings = True
        win.DisplayGridlines = True
        win.DisplayWorkbookTabs = True
        win.DisplayHorizontalScrollBar = True
        win.DisplayVerticalScrollBar = True
    except Exception:
        pass
    if wb is not None:
        try:
            for idx in range(1, wb.Worksheets.Count + 1):
                _allow_read_only_mirror_selection(wb.Worksheets(idx))
        except Exception:
            pass
def _ensure_excel_workbook_view(app, wb=None, make_visible=True, activate=True, maximize_workbook=True, defer_show=False, app_level=True):
    try:
        if make_visible and not defer_show:
            app.Visible = True
    except Exception:
        pass
    try:
        app.Interactive = True
    except Exception:
        pass
    try:
        app.UserControl = True
    except Exception:
        pass
    try:
        app.EnableEvents = True
    except Exception:
        pass
    try:
        if not defer_show:
            app.ScreenUpdating = True
    except Exception:
        pass
    try:
        app.DisplayFormulaBar = False
        app.DisplayStatusBar = True
    except Exception:
        pass
    try:
        if activate and wb is not None:
            wb.Activate()
    except Exception:
        pass
    try:
        if app_level:
            # SDI 공유 인스턴스에서 app.WindowState 는 활성 프레임에만 적용된다.
            # frame 모드 호출자는 app_level=False 로 끄고 wb.Windows(1).WindowState 를 직접 쓴다.
            app.WindowState = -4143  # xlNormal: keep the outer Excel window at the mirror panel size.
    except Exception:
        pass
    try:
        win = wb.Windows(1) if wb is not None else app.ActiveWindow
        if win is not None:
            if not defer_show:
                win.Visible = True
            if maximize_workbook:
                win.WindowState = -4137  # xlMaximized: fill only the workbook area inside Excel.
            win.DisplayHeadings = True
            win.DisplayGridlines = True
            win.DisplayWorkbookTabs = True
            win.DisplayHorizontalScrollBar = True
            win.DisplayVerticalScrollBar = True
    except Exception:
        pass


def _capture_browser_hwnd(title_hint=None):
    if win32gui is None:
        return None
    title_hint = normalize_text(title_hint or "B2B 빌링 Agent")

    def usable(hwnd):
        try:
            if not win32gui.IsWindow(hwnd) or not win32gui.IsWindowVisible(hwnd):
                return False
            title = win32gui.GetWindowText(hwnd) or ""
            if not title:
                return False
            normalized = normalize_text(title)
            if "excel" in normalized:
                return False
            return title_hint in normalized or "b2b" in normalized and "agent" in normalized
        except Exception:
            return False

    try:
        hwnd = win32gui.GetForegroundWindow()
        if usable(hwnd):
            return int(hwnd)
    except Exception:
        pass

    found = []

    def enum_proc(hwnd, _):
        if usable(hwnd):
            found.append(int(hwnd))
        return True

    try:
        win32gui.EnumWindows(enum_proc, None)
    except Exception:
        return None
    return found[0] if found else None


def _browser_content_target(browser_hwnd):
    if win32gui is None or not browser_hwnd:
        return None
    try:
        if not win32gui.IsWindow(browser_hwnd):
            return None
    except Exception:
        return None
    candidates = []

    def enum_child(hwnd, _):
        try:
            if not win32gui.IsWindowVisible(hwnd):
                return True
            cls = win32gui.GetClassName(hwnd) or ""
            rect = win32gui.GetWindowRect(hwnd)
            width = max(0, rect[2] - rect[0])
            height = max(0, rect[3] - rect[1])
            if width < 300 or height < 200:
                return True
            score = width * height
            if "Chrome_RenderWidgetHostHWND" in cls:
                score *= 4
            candidates.append((score, int(hwnd), rect))
        except Exception:
            pass
        return True

    try:
        win32gui.EnumChildWindows(int(browser_hwnd), enum_child, None)
    except Exception:
        pass
    if candidates:
        candidates.sort(key=lambda item: item[0], reverse=True)
        return candidates[0][1], candidates[0][2]
    try:
        left, top = win32gui.ClientToScreen(int(browser_hwnd), (0, 0))
        client = win32gui.GetClientRect(int(browser_hwnd))
        return int(browser_hwnd), (left, top, left + client[2], top + client[3])
    except Exception:
        return None


def _browser_content_rect(browser_hwnd):
    target = _browser_content_target(browser_hwnd)
    return target[1] if target else None


def _resolve_excel_mirror_rect(left, top, width, height, browser_hwnd=None, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None):
    screen_left = float(left or 0)
    screen_top = float(top or 0)
    screen_width = float(width or 320)
    screen_height = float(height or 240)
    content_rect = _browser_content_rect(browser_hwnd)
    if content_rect and client_left is not None and client_top is not None:
        content_left, content_top, content_right, content_bottom = content_rect
        content_width = max(1, content_right - content_left)
        content_height = max(1, content_bottom - content_top)
        vw = max(1.0, float(viewport_width or content_width))
        vh = max(1.0, float(viewport_height or content_height))
        scale_x = content_width / vw
        scale_y = content_height / vh
        screen_left = content_left + float(client_left or 0) * scale_x
        screen_top = content_top + float(client_top or 0) * scale_y
        screen_width = float(client_width or width or 320) * scale_x
        screen_height = float(client_height or height or 240) * scale_y
    return (
        int(max(-32000, screen_left)),
        int(max(-32000, screen_top)),
        int(max(320, screen_width)),
        int(max(240, screen_height)),
    )


def _position_excel_window(
    app,
    left,
    top,
    width,
    height,
    browser_hwnd=None,
    native_parent_hwnd=None,
    native_host_hwnd=None,
    native_overlay=False,
    client_left=None,
    client_top=None,
    client_width=None,
    client_height=None,
    viewport_width=None,
    viewport_height=None,
    show=True,
    keep_zorder=False,
    hwnd=None,
    no_activate=False,
):
    left, top, width, height = _resolve_excel_mirror_rect(
        left,
        top,
        width,
        height,
        browser_hwnd=browser_hwnd,
        client_left=client_left,
        client_top=client_top,
        client_width=client_width,
        client_height=client_height,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
    )
    if win32gui is not None and win32con is not None:
        # SDI 공유 인스턴스: app.Hwnd 는 '활성 프레임 1개'라 다중 워크북에서 엉뚱한 창을 만진다.
        # 호출자가 세션 프레임 hwnd 를 넘기면 그 창만 제어한다.
        try:
            hwnd = int(hwnd) if hwnd else int(app.Hwnd)
        except Exception:
            hwnd = int(app.Hwnd)
        style_changed = False  # SetWindowLong 으로 실제 스타일이 바뀐 경우에만 SWP_FRAMECHANGED(전체 리드로우)
        if native_overlay:
            try:
                style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
                desired_style = style
                desired_style &= ~(
                    win32con.WS_CAPTION |
                    win32con.WS_THICKFRAME |
                    win32con.WS_MINIMIZEBOX |
                    win32con.WS_MAXIMIZEBOX |
                    win32con.WS_SYSMENU |
                    win32con.WS_CHILD |
                    win32con.WS_DISABLED
                )
                desired_style |= win32con.WS_POPUP | win32con.WS_CLIPSIBLINGS | win32con.WS_CLIPCHILDREN
                if show:
                    desired_style |= win32con.WS_VISIBLE
                else:
                    desired_style &= ~win32con.WS_VISIBLE
                if desired_style != style:
                    win32gui.SetWindowLong(hwnd, win32con.GWL_STYLE, desired_style)
                    style_changed = True
                try:
                    ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
                    desired_ex_style = (ex_style | getattr(win32con, "WS_EX_TOOLWINDOW", 0)) & ~getattr(win32con, "WS_EX_APPWINDOW", 0)
                    if desired_ex_style != ex_style:
                        win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, desired_ex_style)
                        style_changed = True
                except Exception:
                    pass
                try:
                    # Keep Excel as a real top-level window.  Owning it to the host
                    # makes the grid render in place, but it intermittently breaks
                    # Excel's own mouse activation/selection loop after host resize
                    # or position updates.
                    win32gui.SetWindowLong(hwnd, getattr(win32con, "GWL_HWNDPARENT", -8), 0)
                except Exception:
                    pass
            except Exception:
                pass
        elif native_parent_hwnd:
            try:
                parent_hwnd = int(native_parent_hwnd)
                if win32gui.IsWindow(parent_hwnd):
                    current_parent = win32gui.GetParent(hwnd)
                    style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
                    desired_style = style
                    desired_style &= ~(
                        win32con.WS_CAPTION |
                        win32con.WS_THICKFRAME |
                        win32con.WS_MINIMIZEBOX |
                        win32con.WS_MAXIMIZEBOX |
                        win32con.WS_SYSMENU |
                        win32con.WS_POPUP |
                        win32con.WS_VISIBLE |
                        win32con.WS_DISABLED
                    )
                    desired_style |= win32con.WS_CHILD | win32con.WS_CLIPSIBLINGS | win32con.WS_CLIPCHILDREN
                    if show:
                        desired_style |= win32con.WS_VISIBLE
                    if desired_style != style:
                        win32gui.SetWindowLong(hwnd, win32con.GWL_STYLE, desired_style)
                        style_changed = True
                    if current_parent != parent_hwnd:
                        win32gui.SetParent(hwnd, parent_hwnd)
                    # SetParent changes Excel into a child window. Coordinates must
                    # be relative to the native panel, not desktop screen coordinates.
                    left = 0
                    top = 0
            except Exception:
                pass
        elif browser_hwnd:
            try:
                parent_hwnd = int(browser_hwnd)
                if win32gui.IsWindow(parent_hwnd):
                    style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
                    style &= ~(
                        win32con.WS_CAPTION |
                        win32con.WS_THICKFRAME |
                        win32con.WS_MINIMIZEBOX |
                        win32con.WS_MAXIMIZEBOX |
                        win32con.WS_SYSMENU |
                        win32con.WS_POPUP
                    )
                    style |= win32con.WS_CHILD | win32con.WS_VISIBLE
                    win32gui.SetWindowLong(hwnd, win32con.GWL_STYLE, style)
                    style_changed = True
                    win32gui.SetParent(hwnd, parent_hwnd)
                    left, top = win32gui.ScreenToClient(parent_hwnd, (left, top))
            except Exception:
                pass
        # NOACTIVATE 를 항상 적용: 재배치/표시가 배경 미러 창을 활성화해 위로 튀어나오며
        # 회색 플래시를 만들고 활성 창의 포커스를 빼앗는 문제 방지(이 함수는 미러 창 전용).
        flags = win32con.SWP_NOOWNERZORDER | win32con.SWP_NOACTIVATE
        if style_changed:
            flags |= win32con.SWP_FRAMECHANGED  # 스타일이 실제로 바뀐 호출에서만 전체 프레임 리드로우
        if keep_zorder:
            # z-order 를 바꾸지 않고 위치/크기만 변경(비활성 창이 위로 튀어나오는 순회 방지).
            flags |= win32con.SWP_NOZORDER
        if show:
            flags |= win32con.SWP_SHOWWINDOW
        else:
            flags |= win32con.SWP_HIDEWINDOW
        win32gui.SetWindowPos(
            hwnd,
            win32con.HWND_TOP,
            left,
            top,
            width,
            height,
            flags,
        )
        if show:
            try:
                if win32gui.IsIconic(hwnd):
                    win32gui.ShowWindow(hwnd, getattr(win32con, "SW_RESTORE", 9))
                if native_parent_hwnd or native_overlay:
                    win32gui.ShowWindow(hwnd, getattr(win32con, "SW_SHOWNA", 8))
                    _focus_excel_grid_child(hwnd)
                elif no_activate:
                    # SW_SHOWNORMAL 은 활성화를 동반해 호스트 포커스를 뺏는다(다음 UI 클릭이
                    # 창 활성화에 소비되는 '클릭 씹힘'의 원인). 라이브 프레임은 비활성 표시로 충분.
                    win32gui.ShowWindow(hwnd, getattr(win32con, "SW_SHOWNA", 8))
                else:
                    # SW_SHOWNORMAL 은 창을 활성화해 배경 미러가 포커스를 빼앗음 → 비활성 표시(SW_SHOWNA).
                    win32gui.ShowWindow(hwnd, getattr(win32con, "SW_SHOWNA", 8))
            except Exception:
                pass
        return
    # Excel COM uses points, not pixels. This fallback is approximate.
    app.WindowState = -4143
    app.Left = left * 72 / 96
    app.Top = top * 72 / 96
    app.Width = width * 72 / 96
    app.Height = height * 72 / 96


def _focus_excel_grid_child(hwnd):
    if win32gui is None:
        return
    try:
        hwnd = int(hwnd)
    except Exception:
        return
    if not hwnd:
        return
    best = hwnd
    best_score = -1

    def enum_child(child, _param):
        nonlocal best, best_score
        try:
            if not win32gui.IsWindowVisible(child):
                return True
            cls = str(win32gui.GetClassName(child) or "")
            rect = win32gui.GetWindowRect(child)
            width = max(0, int(rect[2]) - int(rect[0]))
            height = max(0, int(rect[3]) - int(rect[1]))
            area = width * height
            if area <= 0:
                return True
            score = area
            if "EXCEL7" in cls.upper():
                score += 10**12
            elif "XLDESK" in cls.upper():
                score += 10**11
            elif "XLMAIN" in cls.upper():
                score += 10**10
            if score > best_score:
                best_score = score
                best = child
        except Exception:
            pass
        return True

    try:
        win32gui.EnumChildWindows(hwnd, enum_child, None)
    except Exception:
        pass
    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        target_thread = user32.GetWindowThreadProcessId(int(best), None)
        current_thread = kernel32.GetCurrentThreadId()
        attached = False
        if target_thread and target_thread != current_thread:
            attached = bool(user32.AttachThreadInput(current_thread, target_thread, True))
        try:
            user32.SetFocus(int(best))
        finally:
            if attached:
                user32.AttachThreadInput(current_thread, target_thread, False)
    except Exception:
        try:
            win32gui.SetFocus(best)
        except Exception:
            pass


def _set_window_owner_hwnd(hwnd, owner_hwnd):
    """지정한 최상위 창의 소유자(owner)를 지정/해제한다.
    owner_hwnd가 유효하면 그 창 위에 항상 표시되고(가려지지 않음), None/0이면 소유자 해제.
    SetParent(자식화, WS_CHILD)와 달리 owner 관계는 top-level 창을 유지하므로 셀 입력/선택이 정상 동작."""
    if win32gui is None or win32con is None:
        return False
    try:
        hwnd = int(hwnd)
    except Exception:
        return False
    try:
        if not hwnd or not win32gui.IsWindow(hwnd):
            return False
    except Exception:
        return False
    try:
        owner = int(owner_hwnd) if owner_hwnd else 0
    except Exception:
        owner = 0
    if owner:
        try:
            if not win32gui.IsWindow(owner):
                owner = 0
        except Exception:
            owner = 0
    try:
        win32gui.SetWindowLong(hwnd, getattr(win32con, "GWL_HWNDPARENT", -8), owner)
        return True
    except Exception:
        return False


def _set_excel_window_owner(app, owner_hwnd):
    """(legacy) app.Hwnd 프레임의 owner 지정. frame 모드에서는 세션 프레임 hwnd 에
    _set_window_owner_hwnd 를 직접 쓴다(공유 인스턴스에서 app.Hwnd 는 활성 프레임 1개뿐)."""
    try:
        hwnd = int(app.Hwnd)
    except Exception:
        return False
    return _set_window_owner_hwnd(hwnd, owner_hwnd)


def _style_live_frame(hwnd):
    """라이브 프레임을 작업표시줄/Alt+Tab 목록에서 제외(WS_EX_TOOLWINDOW, WS_EX_APPWINDOW 제거).
    소유(owned) 프레임이 활성일 때 호스트 작업표시줄 버튼이 '활성 그룹'으로 표시되어
    클릭 시 호스트가 최소화되는 혼동과, 화면 밖에 파킹된 프레임으로 Alt+Tab 진입하는
    문제를 함께 막는다. 캡션/프레임 자체는 유지(frameless 는 선택/사이즈를 깨서 폐기됨)."""
    if win32gui is None or win32con is None:
        return
    try:
        hwnd = int(hwnd)
        if not hwnd or not win32gui.IsWindow(hwnd):
            return
        ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
        desired = (ex_style | getattr(win32con, "WS_EX_TOOLWINDOW", 0x80)) & ~getattr(win32con, "WS_EX_APPWINDOW", 0x40000)
        if desired != ex_style:
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, desired)
            flags = (
                win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_NOZORDER |
                win32con.SWP_NOACTIVATE | win32con.SWP_NOOWNERZORDER | win32con.SWP_FRAMECHANGED
            )
            win32gui.SetWindowPos(hwnd, 0, 0, 0, 0, 0, flags)
    except Exception:
        pass


def _show_window_na(hwnd):
    """창을 활성화 없이 표시(SW_SHOWNA). 포커스는 현재 창(호스트)에 그대로 남는다."""
    if win32gui is None or win32con is None:
        return
    try:
        hwnd = int(hwnd)
        if not hwnd or not win32gui.IsWindow(hwnd):
            return
        win32gui.ShowWindow(hwnd, getattr(win32con, "SW_SHOWNA", 8))
    except Exception:
        pass


def _move_hwnd_offscreen(hwnd):
    """프레임을 숨기지 않고 화면 밖(-32000)으로만 이동(WS_VISIBLE 유지).
    SW_HIDE 와 달리 '활성 창 소멸'이 일어나지 않아 OS 가 z-order 의 임의 다음 창
    (무관한 다른 앱일 수 있음)을 끌어올리는 일이 없고, 다시 보일 때 회색 빈 프레임도 안 생긴다."""
    if win32gui is None or win32con is None:
        return
    try:
        hwnd = int(hwnd)
        if not hwnd or not win32gui.IsWindow(hwnd):
            return
        flags = (
            getattr(win32con, "SWP_NOACTIVATE", 0x0010) |
            getattr(win32con, "SWP_NOOWNERZORDER", 0x0200) |
            getattr(win32con, "SWP_NOSIZE", 0x0001)
        )
        win32gui.SetWindowPos(hwnd, getattr(win32con, "HWND_BOTTOM", 1), -32000, -32000, 0, 0, flags)
    except Exception:
        pass


def _handoff_foreground_to_host(host_hwnd, hwnds):
    """숨기거나 파킹하려는 프레임이 현재 포그라운드면, OS 가 다음 활성 창을 임의로 고르기 전에
    호스트로 포커스를 명시적으로 넘긴다(AttachThreadInput 으로 합법 전환).
    '탭 전환/워크북 열기 때 무관한 다른 앱 창이 최상단으로 튀어나오는' 증상의 직접 방어선."""
    if win32gui is None:
        return False
    try:
        fg = int(win32gui.GetForegroundWindow() or 0)
    except Exception:
        return False
    try:
        targets = {int(h) for h in (hwnds or []) if h}
    except Exception:
        targets = set()
    if not fg or fg not in targets:
        return False
    try:
        host = int(host_hwnd or 0)
        if not host or not win32gui.IsWindow(host):
            return False
    except Exception:
        return False
    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        fg_thread = user32.GetWindowThreadProcessId(fg, None)
        cur_thread = kernel32.GetCurrentThreadId()
        attached = False
        if fg_thread and fg_thread != cur_thread:
            attached = bool(user32.AttachThreadInput(cur_thread, fg_thread, True))
        try:
            user32.SetForegroundWindow(host)
        finally:
            if attached:
                user32.AttachThreadInput(cur_thread, fg_thread, False)
        return True
    except Exception:
        return False


def _style_live_overlay_window(app):
    """라이브 창을 프레임리스(제목줄/테두리/최소·최대화 버튼 제거)로 만든다.
    미러 overlay 스타일과 동일하되 owner(GWL_HWNDPARENT)는 건드리지 않는다 — owner 는 따로 지정해 무깜빡임 유지."""
    if win32gui is None or win32con is None:
        return
    try:
        hwnd = int(app.Hwnd)
        style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
        desired = style & ~(
            win32con.WS_CAPTION |
            win32con.WS_THICKFRAME |
            win32con.WS_MINIMIZEBOX |
            win32con.WS_MAXIMIZEBOX |
            win32con.WS_SYSMENU |
            win32con.WS_CHILD |
            win32con.WS_DISABLED
        )
        desired |= win32con.WS_POPUP | win32con.WS_CLIPSIBLINGS | win32con.WS_CLIPCHILDREN | win32con.WS_VISIBLE
        if desired != style:
            win32gui.SetWindowLong(hwnd, win32con.GWL_STYLE, desired)
        try:
            ex = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            desired_ex = (ex | getattr(win32con, "WS_EX_TOOLWINDOW", 0)) & ~getattr(win32con, "WS_EX_APPWINDOW", 0)
            if desired_ex != ex:
                win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, desired_ex)
        except Exception:
            pass
    except Exception:
        pass


def _raise_excel_hwnd(hwnd):
    if win32gui is None or win32con is None:
        return
    try:
        hwnd = int(hwnd)
        if not hwnd or not win32gui.IsWindow(hwnd):
            return
        if win32gui.IsIconic(hwnd):
            win32gui.ShowWindow(hwnd, getattr(win32con, "SW_RESTORE", 9))
        flags = (
            win32con.SWP_NOMOVE |
            win32con.SWP_NOSIZE |
            win32con.SWP_SHOWWINDOW |
            win32con.SWP_NOACTIVATE |
            win32con.SWP_NOOWNERZORDER
        )
        win32gui.SetWindowPos(hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0, flags)
        win32gui.SetWindowPos(hwnd, win32con.HWND_NOTOPMOST, 0, 0, 0, 0, flags)
    except Exception:
        pass


def _raise_excel_window(app):
    try:
        _raise_excel_hwnd(int(app.Hwnd))
    except Exception:
        pass


def _excel_process_id(app):
    if win32process is None:
        return None
    try:
        hwnd = int(app.Hwnd)
        if not hwnd:
            return None
        _thread_id, pid = win32process.GetWindowThreadProcessId(hwnd)
        return int(pid) if pid else None
    except Exception:
        return None


def _force_kill_pid(pid):
    if not pid or os.name != "nt":
        return
    try:
        subprocess.run(
            ["taskkill", "/PID", str(int(pid)), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=3,
            **hidden_subprocess_kwargs(),
        )
    except Exception:
        pass


def _is_pid_alive(pid):
    if not pid or os.name != "nt":
        return False
    try:
        completed = subprocess.run(
            ["tasklist", "/FI", f"PID eq {int(pid)}", "/NH"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=3,
            **hidden_subprocess_kwargs(),
        )
        return str(int(pid)) in (completed.stdout or "")
    except Exception:
        return False


def _ensure_vbom_access():
    """'VBA 프로젝트 개체 모델에 대한 액세스 신뢰'(AccessVBOM) 레지스트리 플래그를 켠다(HKCU).
    이게 꺼져 있으면 wb.VBProject 접근이 막혀 VBA 주입이 불가능하다.
    설치된 Office 버전 폴더 모두에 1을 써 둔다. 이 플래그는 '이후 새로 띄우는' Excel 인스턴스에 적용되므로
    라이브 Excel을 DispatchEx 하기 직전에 호출해야 그 인스턴스가 VBProject 접근을 허용한다."""
    try:
        import winreg
    except Exception:
        return False
    enabled = False
    for ver in ("16.0", "15.0", "14.0", "12.0"):
        try:
            key = winreg.CreateKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Office\%s\Excel\Security" % ver,
            )
            try:
                winreg.SetValueEx(key, "AccessVBOM", 0, winreg.REG_DWORD, 1)
                enabled = True
            finally:
                winreg.CloseKey(key)
        except Exception:
            pass
    return enabled


def _disable_vba_break_on_all_errors():
    """VBE Error Trapping 이 Break on All Errors 면 처리된 오류도 디버거로 진입한다.
    Excel 은 이 값을 시작 시점에 읽으므로 새 Excel 인스턴스 생성 전에 HKCU 값을 Break on Unhandled Errors(0)로 둔다."""
    try:
        import winreg
    except Exception:
        return False
    changed = False
    views = [0]
    for view_name in ("KEY_WOW64_64KEY", "KEY_WOW64_32KEY"):
        view = getattr(winreg, view_name, 0)
        if view and view not in views:
            views.append(view)
    for ver in ("7.1", "7.0"):
        for view in views:
            try:
                key = winreg.CreateKeyEx(
                    winreg.HKEY_CURRENT_USER,
                    r"Software\Microsoft\VBA\%s\Common" % ver,
                    0,
                    winreg.KEY_SET_VALUE | view,
                )
                try:
                    winreg.SetValueEx(key, "BreakOnAllErrors", 0, winreg.REG_DWORD, 0)
                    changed = True
                finally:
                    winreg.CloseKey(key)
            except Exception:
                pass
    return changed
def _is_live_shared_app(app):
    global LIVE_EXCEL_APP
    if app is None or LIVE_EXCEL_APP is None:
        return False
    try:
        return int(app.Hwnd) == int(LIVE_EXCEL_APP.Hwnd)
    except Exception:
        return app is LIVE_EXCEL_APP


def _get_live_excel_app():
    """라이브 편집 워크북을 한 Excel 프로세스 안에 모으기 위한 앱 전용 Excel.Application.

    기존 구조는 파일마다 DispatchEx("Excel.Application")를 호출해 EXCEL.EXE가 여러 개
    생길 수 있었다. 저사양/VDI PC에서는 프로세스 다중화와 창 전환 비용이 커지므로,
    라이브 편집 세션은 이 인스턴스 하나에 여러 Workbook을 여는 방식으로 실험한다.
    사용자가 직접 띄운 Excel을 잡지 않기 위해 GetActiveObject는 쓰지 않고, 앱 전용
    DispatchEx 인스턴스를 최초 1회만 만든다.
    """
    global LIVE_EXCEL_APP
    app = LIVE_EXCEL_APP
    if app is not None:
        try:
            _ = app.Workbooks.Count
            return app
        except Exception:
            LIVE_EXCEL_APP = None
    _ensure_vbom_access()
    app = win32com.client.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    app.EnableEvents = False
    for attr, value in (("AskToUpdateLinks", False), ("UserControl", True)):
        try:
            setattr(app, attr, value)
        except Exception:
            pass
    LIVE_EXCEL_APP = app
    return app


def _quit_live_excel_app():
    global LIVE_EXCEL_APP
    app = LIVE_EXCEL_APP
    LIVE_EXCEL_APP = None
    if app is None:
        return
    try:
        app.Quit()
    except Exception:
        pass


def _remaining_sessions_for_pid(pid):
    if not pid:
        return []
    try:
        return [
            s for s in EXCEL_SESSIONS.values()
            if s.get("pid") and int(s.get("pid")) == int(pid)
        ]
    except Exception:
        return []


def _open_excel_session_impl(
    path,
    name=None,
    workbook_id=None,
    result_id=None,
    read_only_mirror=False,
    left=None,
    top=None,
    width=None,
    height=None,
    client_left=None,
    client_top=None,
    client_width=None,
    client_height=None,
    viewport_width=None,
    viewport_height=None,
    browser_title=None,
    native_parent_hwnd=None,
    native_host_hwnd=None,
    native_overlay=False,
    live_editable=False,
    defer_visible=False,
):
    if not excel_available():
        raise RuntimeError("Microsoft Excel COM automation is not available. Excel and pywin32 are required.")
    path = Path(path)
    if not path.exists():
        raise RuntimeError(f"file not found: {path}")
    source_path = path
    working_copy_path = None
    if live_editable:
        # 리모콘 모델: 원본은 절대 건드리지 않는다 — 항상 작업용 복사본을 만들어
        # 그 위에서 라이브 실행/스킬(VBA) 적용을 한다. 다운로드는 이 복사본을 저장.
        # 워크북 이름이 원본과 동일해야 VBA 의 Workbooks("원본명")/ActiveWorkbook 와 @파일 참조가 일치하고
        # 제목줄도 깔끔하다 → 고유 하위폴더 안에 '원본 이름 그대로' 복사한다.
        BACKEND_DIR.mkdir(parents=True, exist_ok=True)
        clean_name = Path(name).name if name else source_path.name
        live_dir = BACKEND_DIR / f"live_{uuid.uuid4().hex}"
        live_dir.mkdir(parents=True, exist_ok=True)
        working_copy_path = live_dir / clean_name
        shutil.copy2(source_path, working_copy_path)
        path = working_copy_path
        # VBA 주입(스킬 적용)이 가능하도록, 이 라이브 인스턴스를 띄우기 전에 AccessVBOM 을 켠다.
        _ensure_vbom_access()
        _disable_vba_break_on_all_errors()
    # read_only_mirror(읽기전용 보호 미러)와 live_editable(라이브) 모두 검증된 미러 표시 경로를 그대로 쓴다
    # (owner/프레임리스 커스텀은 선택/사이즈를 깨서 폐기). 라이브 차이는 작업복사본·VBA·저장뿐.
    # 작업복사본을 read-only 로 열어도 VBA/COM 은 메모리에서 수정 가능하고, 다운로드는 SaveCopyAs 로 저장.
    manage_overlay = bool(read_only_mirror) or bool(live_editable)
    # 라이브는 작업복사본을 편집가능(read_only=False)으로 연다(VBA 삽입/리셋 등 인메모리 변경 보장).
    # 사용자 직접 편집은 시트 보호(UserInterfaceOnly)로 막으므로 화면 동작은 미러와 동일.
    open_read_only = bool(read_only_mirror)
    with EXCEL_LOCK:
        browser_hwnd = None if (native_parent_hwnd or native_overlay) else (_capture_browser_hwnd(browser_title) if read_only_mirror else None)
        app = _get_live_excel_app() if live_editable else win32com.client.DispatchEx("Excel.Application")
        live_frame_mode = bool(live_editable and LIVE_FRAME_MODE)
        if live_frame_mode:
            # frame 모드: 공유 인스턴스의 글로벌 Visible 토글 금지.
            # app.Visible=False 는 모든 프레임을 동시에 숨겨, 그중 포그라운드였던 창이 '소멸'하며
            # OS 가 z-order 의 무관한 다른 앱 창을 활성화(최상단 점프)하는 원인이 된다.
            # 새 프레임은 아래에서 개별적으로 파킹한다.
            pass
        else:
            app.Visible = False if manage_overlay else True
        app.DisplayAlerts = False
        app.EnableEvents = False
        if manage_overlay:
            try:
                app.ScreenUpdating = False
            except Exception:
                pass
        try:
            app.UserControl = True
        except Exception:
            pass
        try:
            app.AskToUpdateLinks = False
        except Exception:
            pass
        if defer_visible and not live_frame_mode:
            try:
                app.WindowState = -4143  # xlNormal
            except Exception:
                pass
            for attr, value in (("Left", -32000), ("Top", -32000), ("Width", 10), ("Height", 10)):
                try:
                    setattr(app, attr, value)
                except Exception:
                    pass
        wb = None
        open_temp_path = None
        frame_hwnd = None
        try:
            wb, open_temp_path = excel_workbooks_open(app, path, read_only=open_read_only)
            app_pid = _excel_process_id(app)
            excel_id = uuid.uuid4().hex
            sheets = _excel_collection_names(wb.Worksheets)
            if live_editable:
                # owner 모드: 호스트를 owner 로 둔 일반(프레임 유지) Excel 창.
                # 프레임리스(WS_POPUP)는 owner 와 함께 쓰면 선택/사이즈를 깨므로 쓰지 않는다(검증됨).
                # 리본/수식줄/우클릭/입력키 차단은 앱 레벨이라 선택에 영향 없음.
                if live_frame_mode:
                    # SDI: 이 워크북의 프레임 핸들을 잡아 즉시 화면 밖으로 파킹.
                    # (보이는 공유 인스턴스에 새 프레임이 기본 캐스케이드 위치로 번쩍 뜨는 것과
                    #  그 표시/활성화가 호스트 포커스를 흔드는 것을 모두 차단)
                    frame_hwnd = _workbook_window_hwnd(wb)
                    if frame_hwnd:
                        _move_hwnd_offscreen(frame_hwnd)
                try:
                    wb.Activate()
                except Exception:
                    pass
                _protect_workbook_for_read_only_mirror(wb, True)   # 편집 차단 + 선택 허용
                _configure_excel_grid_window(app, wb)              # 리본/수식줄/우클릭/입력키 차단(앱 레벨)
                if frame_hwnd:
                    try:
                        wb.Windows(1).WindowState = -4143  # xlNormal (이 프레임만)
                    except Exception:
                        pass
                    _set_window_owner_hwnd(frame_hwnd, native_host_hwnd)  # owner (프레임 그대로 유지)
                    _style_live_frame(frame_hwnd)                         # 작업표시줄/Alt+Tab 제외
                else:
                    try:
                        app.WindowState = -4143  # xlNormal
                    except Exception:
                        pass
                    _set_excel_window_owner(app, native_host_hwnd)     # owner (프레임 그대로 유지)
                if defer_visible:
                    if frame_hwnd:
                        # 프레임은 파킹 상태 그대로 두고, 인스턴스 Visible 만 1회 켠다.
                        # (모든 라이브 프레임이 화면 밖이라 시각적 변화 없음. 이후 표시는 전부 프레임 단위.)
                        try:
                            if not bool(app.Visible):
                                app.Visible = True
                        except Exception:
                            pass
                    else:
                        try:
                            app.Visible = False
                        except Exception:
                            pass
                elif frame_hwnd:
                    try:
                        if not bool(app.Visible):
                            app.Visible = True
                    except Exception:
                        pass
                    if width and height:
                        _position_excel_window(
                            app, left, top, width, height,
                            hwnd=frame_hwnd, no_activate=True,
                            client_left=client_left, client_top=client_top,
                            client_width=client_width, client_height=client_height,
                            viewport_width=viewport_width, viewport_height=viewport_height,
                            show=True,
                        )
                    else:
                        _show_window_na(frame_hwnd)
                    try:
                        app.ScreenUpdating = True
                    except Exception:
                        pass
                    _ensure_excel_workbook_view(app, wb, make_visible=False, activate=False, maximize_workbook=False, app_level=False)
                    _set_window_owner_hwnd(frame_hwnd, native_host_hwnd)
                else:
                    if width and height:
                        _position_excel_window(
                            app, left, top, width, height,
                            client_left=client_left, client_top=client_top,
                            client_width=client_width, client_height=client_height,
                            viewport_width=viewport_width, viewport_height=viewport_height,
                            show=False,
                        )
                    try:
                        app.Visible = True
                    except Exception:
                        pass
                    try:
                        app.ScreenUpdating = True
                    except Exception:
                        pass
                    _ensure_excel_workbook_view(app, wb, make_visible=True, activate=False, maximize_workbook=False)
                    if width and height:
                        _position_excel_window(
                            app, left, top, width, height,
                            viewport_width=viewport_width, viewport_height=viewport_height,
                            show=True,
                        )
                    _set_excel_window_owner(app, native_host_hwnd)
            elif read_only_mirror:
                try:
                    wb.Activate()
                except Exception:
                    pass
                _protect_workbook_for_read_only_mirror(wb, True)
                _configure_excel_grid_window(app, wb)
                if width and height:
                    _position_excel_window(
                        app,
                        left,
                        top,
                        width,
                        height,
                        browser_hwnd=browser_hwnd,
                        native_parent_hwnd=None if native_overlay else native_parent_hwnd,
                        native_host_hwnd=native_host_hwnd,
                        native_overlay=bool(native_overlay),
                        client_left=client_left,
                        client_top=client_top,
                        client_width=client_width,
                        client_height=client_height,
                        viewport_width=viewport_width,
                        viewport_height=viewport_height,
                        show=False if (native_parent_hwnd or native_overlay) else True,
                    )
                try:
                    app.Visible = True
                except Exception:
                    pass
                try:
                    app.ScreenUpdating = True
                except Exception:
                    pass
                _ensure_excel_workbook_view(
                    app,
                    wb,
                    make_visible=True,
                    activate=False if (native_parent_hwnd or native_overlay) else True,
                    maximize_workbook=False if (native_overlay or native_parent_hwnd) else True,
                )
                if width and height and (native_parent_hwnd or native_overlay):
                    _position_excel_window(
                        app,
                        left,
                        top,
                        width,
                        height,
                        native_parent_hwnd=None if native_overlay else native_parent_hwnd,
                        native_host_hwnd=native_host_hwnd,
                        native_overlay=bool(native_overlay),
                        viewport_width=viewport_width,
                        viewport_height=viewport_height,
                        show=True,
                    )
                    _ensure_excel_workbook_view(
                        app,
                        wb,
                        make_visible=True,
                        activate=False if (native_parent_hwnd or native_overlay) else True,
                        maximize_workbook=False if (native_overlay or native_parent_hwnd) else True,
                    )
                    _position_excel_window(
                        app,
                        left,
                        top,
                        width,
                        height,
                        native_parent_hwnd=None if native_overlay else native_parent_hwnd,
                        native_host_hwnd=native_host_hwnd,
                        native_overlay=bool(native_overlay),
                        viewport_width=viewport_width,
                        viewport_height=viewport_height,
                        show=True,
                    )
            EXCEL_SESSIONS[excel_id] = {
                "id": excel_id,
                "app": app,
                "workbook": wb,
                "frameHwnd": frame_hwnd,
                "pid": app_pid,
                "path": str(path),
                "openPath": str(wb.FullName),
                "openTempPath": str(open_temp_path) if open_temp_path else "",
                "name": name or path.name,
                "workbookId": workbook_id,
                "resultId": result_id,
                # 라이브(owner 모드)는 readOnlyMirror=False 로 두어 reposition 이 plain 경로(프레임리스 안 함)를 타게 한다.
                # 표시/저장/리셋 분기는 liveEditable 플래그로 구분.
                "readOnlyMirror": bool(read_only_mirror),
                "liveEditable": bool(live_editable),
                "deferredVisible": bool(defer_visible),
                "sourcePath": str(source_path),
                "workingCopyPath": str(working_copy_path) if working_copy_path else "",
                "liveRect": (
                    {"left": int(float(left or 0)), "top": int(float(top or 0)),
                     "width": int(float(width or 0)), "height": int(float(height or 0))}
                    if (live_editable or read_only_mirror) and width and height else None
                ),
                "browserHwnd": browser_hwnd,
                "nativeParentHwnd": None if (native_overlay or live_editable) else native_parent_hwnd,
                "nativeHostHwnd": native_host_hwnd,
                "nativeOverlay": False if live_editable else bool(native_overlay),
                "hidden": bool(defer_visible),
                "lastNativePositionKey": (
                    f"{'overlay' if native_overlay else native_parent_hwnd}:{int(float(left or 0))}:{int(float(top or 0))}:{int(float(width or 0))}:{int(float(height or 0))}"
                    if read_only_mirror and (native_parent_hwnd or native_overlay) and width and height
                    else ""
                ),
                "created": time.time(),
            }
            if not manage_overlay:
                try:
                    app.WindowState = -4143  # xlNormal
                    _safe_activate_excel_app(app)
                except Exception:
                    pass
            return {
                "ok": True,
                "excelId": excel_id,
                "name": name or path.name,
                "path": str(path),
                "sheetNames": sheets,
                "readOnlyMirror": bool(read_only_mirror),
                "liveEditable": bool(live_editable),
            }
        except Exception:
            try:
                if wb is not None:
                    wb.Close(SaveChanges=False)
            except Exception:
                pass
            if not _is_live_shared_app(app):
                try:
                    app.Quit()
                except Exception:
                    pass
            if open_temp_path:
                try:
                    Path(open_temp_path).unlink(missing_ok=True)
                except Exception:
                    pass
            if working_copy_path:
                try:
                    Path(working_copy_path).unlink(missing_ok=True)
                except Exception:
                    pass
            raise


def get_excel_session(excel_id):
    with EXCEL_LOCK:
        session = EXCEL_SESSIONS.get(excel_id)
    if not session:
        raise RuntimeError("Excel session not found")
    return session


def session_workbook(session):
    path = str(Path(session["path"]).resolve()).lower()
    open_path = str(Path(session.get("openPath") or session["path"]).resolve()).lower()
    try:
        app = session.get("app")
        wb = session.get("workbook")
        if wb is not None and str(Path(wb.FullName).resolve()).lower() in {path, open_path}:
            return app or wb.Application, wb
    except Exception:
        pass
    try:
        app = win32com.client.GetActiveObject("Excel.Application")
        for wb in app.Workbooks:
            if str(Path(wb.FullName).resolve()).lower() in {path, open_path}:
                return app, wb
    except Exception:
        pass
    try:
        wb = win32com.client.GetObject(str(session["path"]))
        app = wb.Application
        return app, wb
    except Exception:
        pass
    raise RuntimeError("Excel session is no longer open")


def _activate_excel_session_impl(excel_id, sheet=None, address=None):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        if sheet:
            try:
                ws = wb.Worksheets(str(sheet))
            except Exception:
                names = _excel_collection_names(wb.Worksheets)
                normalized = normalize_text(str(sheet))
                match = next((name for name in names if normalize_text(name) == normalized or normalized in normalize_text(name)), None)
                if not match and len(names) == 1:
                    match = names[0]
                if not match:
                    raise RuntimeError(f"sheet not found: {sheet}")
                ws = wb.Worksheets(match)
            ws.Activate()
        else:
            ws = app.ActiveSheet
        if ws is None:
            names = _excel_collection_names(wb.Worksheets)
            if not names:
                raise RuntimeError("no visible worksheet")
            ws = wb.Worksheets(names[0])
            ws.Activate()
        selected_address = ""
        if address:
            try:
                _ensure_excel_workbook_view(
                    app,
                    wb,
                    make_visible=True,
                    activate=True,
                    maximize_workbook=False if (session.get("nativeOverlay") or session.get("nativeParentHwnd")) else True,
                )
                if session.get("nativeParentHwnd"):
                    _focus_excel_grid_child(app.Hwnd)
                ws.Activate()
                try:
                    wb.Windows(1).Activate()
                except Exception:
                    pass
                target = ws.Range(str(address))
                try:
                    app.Goto(target, True)
                except Exception:
                    target.Select()
                selected_address = str(address or "")
            except Exception as err:
                return {
                    "ok": True,
                    "excelId": excel_id,
                    "sheet": ws.Name,
                    "address": "",
                    "selectSkipped": True,
                    "warning": str(err),
                }
        if not session.get("readOnlyMirror"):
            if session.get("liveEditable") and LIVE_FRAME_MODE:
                # 범위 보기: 포커스는 채팅에 남기고 이 세션 프레임만 보이게/맨 위로.
                # (여기서 활성화하면 사용자의 다음 클릭/타이핑이 창 전환에 씹힌다)
                hwnd = _session_frame_hwnd(session, wb)
                if hwnd:
                    _show_window_na(hwnd)
                    _raise_excel_hwnd(hwnd)
                else:
                    try:
                        _safe_activate_excel_app(app)
                    except Exception:
                        pass
            else:
                try:
                    _safe_activate_excel_app(app)
                except Exception:
                    pass
        return {"ok": True, "excelId": excel_id, "sheet": ws.Name, "address": selected_address}


def _save_excel_session_impl(excel_id, name=None):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        read_only_mirror = bool(session.get("readOnlyMirror"))
        live_protected = bool(session.get("liveEditable"))
        if read_only_mirror or live_protected:
            # 저장(다운로드)본은 보호 없는 깨끗한 파일이 되도록 먼저 보호 해제.
            try:
                _protect_workbook_for_read_only_mirror(wb, False)
            except Exception:
                pass
        if name:
            BACKEND_DIR.mkdir(parents=True, exist_ok=True)
            safe_name = Path(str(name)).name
            if not Path(safe_name).suffix:
                safe_name += Path(session["path"]).suffix or ".xlsx"
            result_path = BACKEND_DIR / f"{uuid.uuid4().hex}_{safe_name}"
            wb.SaveAs(str(result_path))
            session["path"] = str(result_path)
            session["name"] = safe_name
        else:
            BACKEND_DIR.mkdir(parents=True, exist_ok=True)
            result_path = Path(session["path"])
            safe_name = Path(session.get("name") or result_path.name).name
            if not Path(safe_name).suffix:
                safe_name += result_path.suffix or ".xlsx"
            result_path = BACKEND_DIR / f"{uuid.uuid4().hex}_{safe_name}"
            wb.SaveCopyAs(str(result_path))
        if read_only_mirror:
            try:
                _protect_workbook_for_read_only_mirror(wb, True)
                _configure_excel_grid_window(app, wb)
            except Exception:
                pass
        elif live_protected:
            # 라이브: 저장 후 화면 보호 복구(편집 차단 + 선택 허용). 단 리본/프레임은 평범하게 유지.
            try:
                _protect_workbook_for_read_only_mirror(wb, True)
                _configure_read_only_mirror_input_block(app)
                _disable_excel_context_menus(app)
            except Exception:
                pass
        result_id = uuid.uuid4().hex
        RESULTS[result_id] = {
            "path": str(result_path),
            "name": Path(result_path).name,
            "created": time.time(),
        }
        return {
            "ok": True,
            "excelId": excel_id,
            "downloadId": result_id,
            "downloadUrl": f"/api/workbooks/download/{result_id}",
            "name": Path(result_path).name,
        }


def _replace_excel_session_workbook_impl(excel_id, path, name=None, result_id=None, read_only_mirror=None):
    path = Path(path)
    if not path.exists():
        raise RuntimeError(f"result file not found: {path}")
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        read_only_mirror = session.get("readOnlyMirror") if read_only_mirror is None else bool(read_only_mirror)
        try:
            active = wb.Application.ActiveSheet
            active_sheet = active.Name if active is not None else None
        except Exception:
            active_sheet = None
        old_temp_path = session.get("openTempPath")
        live_editable = bool(session.get("liveEditable"))
        if read_only_mirror or live_editable:
            try:
                app.ScreenUpdating = False
            except Exception:
                pass
        if read_only_mirror:
            _hide_excel_app_window(app)
        try:
            wb.Close(SaveChanges=False)
        except Exception:
            pass
        if old_temp_path:
            try:
                Path(old_temp_path).unlink(missing_ok=True)
            except Exception:
                pass
        if not read_only_mirror:
            app.Visible = True
        else:
            _park_excel_app_offscreen(app)
        app.DisplayAlerts = False
        app.EnableEvents = False
        _park_excel_app_offscreen(app) if read_only_mirror else None
        new_wb, new_temp_path = excel_workbooks_open(app, path, read_only=bool(read_only_mirror))
        if session.get("liveEditable") and LIVE_FRAME_MODE:
            # 새 SDI 프레임이 기본 위치로 번쩍 뜨지 않게 즉시 파킹(끝의 presenter 가 제자리 표시).
            _new_frame_hwnd = _workbook_window_hwnd(new_wb)
            if _new_frame_hwnd:
                _move_hwnd_offscreen(_new_frame_hwnd)
        if read_only_mirror:
            _park_excel_app_offscreen(app)
            try:
                new_wb.Activate()
            except Exception:
                pass
            _protect_workbook_for_read_only_mirror(new_wb, True)
            _configure_excel_grid_window(app, new_wb)
            _ensure_excel_workbook_view(
                app,
                new_wb,
                activate=False if (session.get("nativeParentHwnd") or session.get("nativeOverlay")) else True,
                maximize_workbook=False if (session.get("nativeOverlay") or session.get("nativeParentHwnd")) else True,
            )
        session["workbook"] = new_wb
        session["path"] = str(path)
        session["openPath"] = str(new_wb.FullName)
        session["openTempPath"] = str(new_temp_path) if new_temp_path else ""
        session["name"] = name or path.name
        session["resultId"] = result_id
        session["readOnlyMirror"] = bool(read_only_mirror)
        session["hidden"] = False
        session["snapshots"] = {}
        session["appliedStepSigs"] = None  # 워크북이 외부 결과로 교체됨 → 적용 단계 추적 무효화
        sheets = _excel_collection_names(new_wb.Worksheets)
        if active_sheet and active_sheet in sheets:
            try:
                new_wb.Worksheets(active_sheet).Activate()
            except Exception:
                pass
        if read_only_mirror:
            _ensure_excel_workbook_view(
                app,
                new_wb,
                activate=False if (session.get("nativeParentHwnd") or session.get("nativeOverlay")) else True,
                maximize_workbook=False if (session.get("nativeOverlay") or session.get("nativeParentHwnd")) else True,
            )
            if session.get("nativeParentHwnd") or session.get("nativeOverlay"):
                try:
                    left, top, width, height = [int(v) for v in str(session.get("lastNativePositionKey") or "").split(":")[-4:]]
                    _position_excel_window(
                        app,
                        left,
                        top,
                        width,
                        height,
                        native_parent_hwnd=session.get("nativeParentHwnd") if not session.get("nativeOverlay") else None,
                        native_host_hwnd=session.get("nativeHostHwnd"),
                        native_overlay=bool(session.get("nativeOverlay")),
                        show=True,
                    )
                except Exception:
                    pass
            try:
                app.ScreenUpdating = True
            except Exception:
                pass
        elif live_editable:
            # Python(openpyxl) 결과 교체의 라이브 반영 경로. 공유 인스턴스(frame 모드)에서는
            # app 전역(owner/hide/Visible) 조작 금지 — 이 세션의 새 프레임만 제어한다.
            try:
                new_wb.Activate()
            except Exception:
                pass
            try:
                _protect_workbook_for_read_only_mirror(new_wb, True)
                _configure_excel_grid_window(app, new_wb)
            except Exception:
                pass
            presented = None
            if LIVE_FRAME_MODE:
                # 워크북이 교체됐으므로 이전 프레임 핸들을 버리고 새 프레임 기준으로 표시.
                session.pop("frameHwnd", None)
                rect = session.get("liveRect") or {}
                presented = _present_live_session_frame(
                    session, app, new_wb,
                    rect.get("left"), rect.get("top"), rect.get("width"), rect.get("height"),
                    skip_position=not (rect.get("width") and rect.get("height")),
                )
            if presented is None:
                # legacy(비frame) 폴백: 페인트 준비 후 show — 결과 교체 시 회색 프레임 플래시 방지.
                _set_excel_window_owner(app, session.get("nativeHostHwnd"))
                try:
                    _ensure_excel_workbook_view(app, new_wb, make_visible=True, activate=False, maximize_workbook=False, defer_show=True)
                except Exception:
                    pass
                try:
                    _hide_excel_hwnd(app.Hwnd)
                except Exception:
                    pass
                try:
                    app.ScreenUpdating = True
                except Exception:
                    pass
                try:
                    new_wb.Windows(1).Visible = True
                except Exception:
                    pass
                live_rect = session.get("liveRect") or {}
                if live_rect.get("width") and live_rect.get("height"):
                    try:
                        _position_excel_window(
                            app,
                            live_rect.get("left"),
                            live_rect.get("top"),
                            live_rect.get("width"),
                            live_rect.get("height"),
                            native_host_hwnd=session.get("nativeHostHwnd"),
                            show=True,
                        )
                    except Exception:
                        pass
                try:
                    _ensure_excel_workbook_view(app, new_wb, make_visible=True, activate=False, maximize_workbook=False)
                except Exception:
                    pass
                _set_excel_window_owner(app, session.get("nativeHostHwnd"))
            try:
                app.ScreenUpdating = True
            except Exception:
                pass
        else:
            presented = None
            if session.get("liveEditable") and LIVE_FRAME_MODE:
                # 워크북이 교체됐으므로 이전 프레임 핸들을 버리고 새 프레임 기준으로 표시.
                session.pop("frameHwnd", None)
                rect = session.get("liveRect") or {}
                presented = _present_live_session_frame(
                    session, app, new_wb,
                    rect.get("left"), rect.get("top"), rect.get("width"), rect.get("height"),
                    skip_position=not (rect.get("width") and rect.get("height")),
                )
            if presented is None:
                try:
                    _safe_activate_excel_app(app)
                except Exception:
                    pass
        return {
            "ok": True,
            "excelId": excel_id,
            "name": name or path.name,
            "path": str(path),
            "sheetNames": sheets,
            "readOnlyMirror": bool(read_only_mirror),
            "replaced": True,
        }


def _position_excel_session_impl(
    excel_id,
    left,
    top,
    width,
    height,
    client_left=None,
    client_top=None,
    client_width=None,
    client_height=None,
    viewport_width=None,
    viewport_height=None,
    browser_title=None,
    native_parent_hwnd=None,
    native_host_hwnd=None,
    native_overlay=False,
    keep_zorder=False,
):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        next_native_parent_hwnd = native_parent_hwnd or session.get("nativeParentHwnd")
        next_native_host_hwnd = native_host_hwnd or session.get("nativeHostHwnd")
        next_native_overlay = bool(native_overlay or session.get("nativeOverlay"))
        native_position_key = None
        if session.get("readOnlyMirror") and (next_native_parent_hwnd or next_native_overlay):
            native_position_key = f"{'overlay' if next_native_overlay else next_native_parent_hwnd}:{int(float(left or 0))}:{int(float(top or 0))}:{int(float(width or 0))}:{int(float(height or 0))}"
            if session.get("lastNativePositionKey") == native_position_key and not session.get("hidden"):
                return {
                    "ok": True,
                    "excelId": excel_id,
                    "left": int(float(left or 0)),
                    "top": int(float(top or 0)),
                    "width": int(float(width or 0)),
                    "height": int(float(height or 0)),
                    "skipped": True,
                }
        if session.get("readOnlyMirror"):
            if native_parent_hwnd:
                session["nativeParentHwnd"] = native_parent_hwnd
            if native_host_hwnd:
                session["nativeHostHwnd"] = native_host_hwnd
            if native_overlay:
                session["nativeOverlay"] = True
                session["nativeParentHwnd"] = None
            browser_hwnd = session.get("browserHwnd")
            try:
                browser_valid = bool(browser_hwnd and win32gui is not None and win32gui.IsWindow(int(browser_hwnd)))
            except Exception:
                browser_valid = False
            if not browser_valid:
                session["browserHwnd"] = _capture_browser_hwnd(browser_title)
        # frame 모드: 공유 인스턴스의 app.Hwnd(활성 프레임)가 아니라 이 세션의 프레임을 직접 이동.
        live_frame_hwnd = _session_frame_hwnd(session, wb) if (session.get("liveEditable") and LIVE_FRAME_MODE) else None
        _position_excel_window(
            app,
            left,
            top,
            width,
            height,
            browser_hwnd=None if (session.get("nativeParentHwnd") or session.get("nativeOverlay")) else (session.get("browserHwnd") if session.get("readOnlyMirror") else None),
            native_parent_hwnd=session.get("nativeParentHwnd") if session.get("readOnlyMirror") and not session.get("nativeOverlay") else None,
            native_host_hwnd=session.get("nativeHostHwnd") if session.get("readOnlyMirror") else None,
            native_overlay=bool(session.get("nativeOverlay")) if session.get("readOnlyMirror") else False,
            client_left=client_left,
            client_top=client_top,
            client_width=client_width,
            client_height=client_height,
            viewport_width=viewport_width,
            viewport_height=viewport_height,
            keep_zorder=keep_zorder,
            hwnd=live_frame_hwnd,
            no_activate=bool(live_frame_hwnd),
        )
        if native_position_key:
            session["lastNativePositionKey"] = native_position_key
        if session.get("liveEditable") and width and height:
            # 리셋(시트 교체) 후 창 복원에 쓰도록 최신 rect 보관.
            session["liveRect"] = {
                "left": int(float(left or 0)), "top": int(float(top or 0)),
                "width": int(float(width or 0)), "height": int(float(height or 0)),
            }
        session["hidden"] = False
        if session.get("readOnlyMirror"):
            _ensure_excel_workbook_view(
                app,
                wb,
                make_visible=True,
                activate=False if (session.get("nativeParentHwnd") or session.get("nativeOverlay")) else True,
                maximize_workbook=False if (session.get("nativeOverlay") or session.get("nativeParentHwnd")) else True,
            )
        elif session.get("liveEditable"):
            # owner 재확인(리사이즈 후 풀릴 수 있음) + 그리드 채움.
            if live_frame_hwnd:
                _set_window_owner_hwnd(live_frame_hwnd, session.get("nativeHostHwnd"))
                try:
                    _ensure_excel_workbook_view(app, wb, make_visible=False, activate=False, maximize_workbook=False, app_level=False)
                except Exception:
                    pass
            else:
                _set_excel_window_owner(app, session.get("nativeHostHwnd"))
                try:
                    _ensure_excel_workbook_view(app, wb, make_visible=True, activate=False, maximize_workbook=False)
                except Exception:
                    pass
        return {
            "ok": True,
            "excelId": excel_id,
            "left": int(float(left or 0)),
            "top": int(float(top or 0)),
            "width": int(float(width or 0)),
            "height": int(float(height or 0)),
        }


def _raise_excel_session_impl(excel_id):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        if session.get("liveEditable") and LIVE_FRAME_MODE:
            hwnd = _session_frame_hwnd(session, wb)
            if hwnd:
                _set_window_owner_hwnd(hwnd, session.get("nativeHostHwnd"))
                _raise_excel_hwnd(hwnd)
                return {"ok": True, "excelId": excel_id}
        if session.get("readOnlyMirror") or session.get("liveEditable"):
            _raise_excel_window(app)
            if session.get("liveEditable"):
                _set_excel_window_owner(app, session.get("nativeHostHwnd"))
            session["hidden"] = False
        return {"ok": True, "excelId": excel_id}


def _workbook_fullname(wb):
    try:
        return str(Path(wb.FullName).resolve()).lower()
    except Exception:
        try:
            return str(wb.FullName).lower()
        except Exception:
            return ""


def _excel_app_hwnd(app):
    try:
        return int(app.Hwnd)
    except Exception:
        return None


def _same_excel_app(app_a, app_b):
    hwnd_a = _excel_app_hwnd(app_a)
    hwnd_b = _excel_app_hwnd(app_b)
    return bool(hwnd_a and hwnd_b and hwnd_a == hwnd_b)


def _session_for_workbook(wb, app=None):
    target = _workbook_fullname(wb)
    if not target:
        return None, None, None
    for sid, session in list(EXCEL_SESSIONS.items()):
        try:
            session_app = session.get("app")
            if app is not None and session_app is not None and not _same_excel_app(app, session_app):
                continue
            session_wb = session.get("workbook")
            if session_wb is not None and _workbook_fullname(session_wb) == target:
                return sid, session, session_wb
        except Exception:
            continue
    return None, None, None


def _active_session_for_app(app, fallback_session=None, fallback_wb=None):
    try:
        active_wb = app.ActiveWorkbook
    except Exception:
        active_wb = None
    sid, session, wb = _session_for_workbook(active_wb, app=app) if active_wb is not None else (None, None, None)
    if sid and session and wb is not None:
        return sid, session, wb
    if fallback_session is not None:
        return fallback_session.get("id"), fallback_session, fallback_wb
    return None, None, None


def _hide_workbook_window(wb):
    try:
        if wb is None or wb.Windows.Count < 1:
            return False
        win = wb.Windows(1)
        try:
            win.Visible = False
            return True
        except Exception:
            pass
        try:
            hwnd = getattr(win, "Hwnd", None)
            if hwnd:
                _hide_excel_hwnd(hwnd)
                return True
        except Exception:
            pass
    except Exception:
        pass
    return False


def _hide_peer_workbook_windows(app, active_excel_id):
    hidden_ids = []
    for sid, other_session in list(EXCEL_SESSIONS.items()):
        if sid == active_excel_id:
            continue
        try:
            other_app = other_session.get("app")
            if other_app is None or not _same_excel_app(app, other_app):
                continue
            other_wb = other_session.get("workbook")
            if other_wb is None:
                continue
            if _hide_workbook_window(other_wb):
                other_session["hidden"] = True
                hidden_ids.append(sid)
        except Exception:
            continue
    return hidden_ids


def _show_workbook_window(app, wb, activate=True):
    try:
        app.Visible = True
    except Exception:
        pass
    try:
        if wb is not None and wb.Windows.Count > 0:
            wb.Windows(1).Visible = True
    except Exception:
        pass
    try:
        if activate and wb is not None:
            wb.Activate()
            wb.Windows(1).Activate()
    except Exception:
        pass
    try:
        _ensure_excel_workbook_view(app, wb, make_visible=True, activate=activate, maximize_workbook=False)
    except Exception:
        pass


def _workbook_window_hwnd(wb):
    """SDI 프레임(이 워크북의 최상위 창) 핸들. 공유 인스턴스에서 app.Hwnd 는
    '그 순간 활성 프레임 1개'라 다중 워크북 제어에 쓰면 엉뚱한 창을 만진다."""
    try:
        if wb is None or wb.Windows.Count < 1:
            return None
        hwnd = int(wb.Windows(1).Hwnd)
        return hwnd or None
    except Exception:
        return None


def _session_frame_hwnd(session, wb=None):
    """세션 워크북의 프레임 핸들(캐시). recover/replace 로 워크북이 바뀌면 자동 재조회."""
    hwnd = session.get("frameHwnd")
    try:
        if hwnd and win32gui is not None and win32gui.IsWindow(int(hwnd)):
            return int(hwnd)
    except Exception:
        pass
    if wb is None:
        wb = session.get("workbook")
    hwnd = _workbook_window_hwnd(wb)
    if hwnd:
        session["frameHwnd"] = hwnd
    return hwnd


def _foreground_session_by_frame():
    """포그라운드 창이 우리 라이브 세션 프레임이면 그 세션을 반환.
    active-sync(엑셀→UI 탭 동기화)는 '사용자가 실제로 클릭해 포그라운드인 미러'만 따라가야
    프로그램적 전환(show-only)과 경합해 탭이 되돌아가는 바운스가 생기지 않는다."""
    if win32gui is None:
        return None, None, None
    try:
        fg = int(win32gui.GetForegroundWindow() or 0)
    except Exception:
        return None, None, None
    if not fg:
        return None, None, None
    for sid, session in list(EXCEL_SESSIONS.items()):
        if not session.get("liveEditable"):
            continue
        try:
            if int(session.get("frameHwnd") or 0) == fg:
                wb = session.get("workbook")
                if wb is not None:
                    return sid, session, wb
        except Exception:
            continue
    return None, None, None


def _hide_peer_session_frames(active_excel_id, host_hwnd=None):
    """frame 모드: 활성 세션 외 라이브 프레임을 전부 화면 밖으로 파킹.
    파킹 대상이 포그라운드면 먼저 호스트로 포커스를 넘긴다(무관 창 점프 방지)."""
    peers = []
    for sid, other in list(EXCEL_SESSIONS.items()):
        if sid == active_excel_id or not other.get("liveEditable"):
            continue
        try:
            hwnd = _session_frame_hwnd(other)
        except Exception:
            hwnd = None
        if hwnd:
            peers.append((sid, other, hwnd))
    if not peers:
        return []
    _handoff_foreground_to_host(host_hwnd, [hwnd for _sid, _other, hwnd in peers])
    hidden_ids = []
    for sid, other, hwnd in peers:
        _move_hwnd_offscreen(hwnd)
        other["hidden"] = True
        hidden_ids.append(sid)
    return hidden_ids


def _present_live_session_frame(
    session, app, wb,
    left, top, width, height,
    client_left=None, client_top=None, client_width=None, client_height=None,
    viewport_width=None, viewport_height=None,
    skip_position=False,
):
    """frame 모드 표시 경로: 대상 프레임만 배치/표시하고 나머지 라이브 프레임은 파킹.
    포커스/활성화는 일절 주지 않는다(SW_SHOWNA/SWP_NOACTIVATE) — 전환 직후 호스트의
    첫 클릭이 '창 활성화'에 소비되어 씹히는 문제를 막는다.
    반환: 파킹한 peer id 리스트. 프레임 핸들을 못 구하면 None(호출자가 legacy 경로 사용)."""
    target_hwnd = _session_frame_hwnd(session, wb)
    if not target_hwnd:
        return None
    try:
        if not bool(app.Visible):
            # 모든 프레임이 파킹된 초기 상태에서만 도달 → 시각적 변화 없이 인스턴스만 켠다.
            app.Visible = True
    except Exception:
        pass
    _set_window_owner_hwnd(target_hwnd, session.get("nativeHostHwnd"))
    _style_live_frame(target_hwnd)
    try:
        win = wb.Windows(1)
        if not bool(win.Visible):
            win.Visible = True  # 과거 경로가 COM 숨김을 남겼어도 회색 빈 프레임이 되지 않게 복구
    except Exception:
        pass
    try:
        wb.Windows(1).WindowState = -4143  # xlNormal
    except Exception:
        pass
    do_position = bool(width and height) and not skip_position
    if not do_position and width and height:
        # skipPosition 요청이어도 실제 창이 파킹(-32000)돼 있으면 재배치한다.
        # (클라 위치캐시는 서버측 파킹/숨김을 모를 수 있음 → '영역 밖에 뜨는 창' 방지)
        try:
            rect_now = win32gui.GetWindowRect(target_hwnd) if win32gui is not None else None
            if rect_now and (rect_now[0] <= -30000 or rect_now[1] <= -30000):
                do_position = True
        except Exception:
            pass
    if do_position:
        _position_excel_window(
            app, left, top, width, height,
            hwnd=target_hwnd, no_activate=True,
            client_left=client_left, client_top=client_top,
            client_width=client_width, client_height=client_height,
            viewport_width=viewport_width, viewport_height=viewport_height,
            show=True,
        )
    else:
        _show_window_na(target_hwnd)
        _raise_excel_hwnd(target_hwnd)
    hidden_ids = _hide_peer_session_frames(session.get("id"), host_hwnd=session.get("nativeHostHwnd"))
    try:
        _ensure_excel_workbook_view(app, wb, make_visible=False, activate=False, maximize_workbook=False, app_level=False)
    except Exception:
        pass
    session["hidden"] = False
    return hidden_ids


def _show_only_excel_session_impl(
    excel_id,
    left,
    top,
    width,
    height,
    client_left=None,
    client_top=None,
    client_width=None,
    client_height=None,
    viewport_width=None,
    viewport_height=None,
    browser_title=None,
    native_parent_hwnd=None,
    native_host_hwnd=None,
    native_overlay=False,
    skip_position=False,
):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        if native_parent_hwnd:
            session["nativeParentHwnd"] = native_parent_hwnd
        if native_host_hwnd:
            session["nativeHostHwnd"] = native_host_hwnd
        if native_overlay:
            session["nativeOverlay"] = True
            session["nativeParentHwnd"] = None
        browser_hwnd = session.get("browserHwnd")
        try:
            browser_valid = bool(browser_hwnd and win32gui is not None and win32gui.IsWindow(int(browser_hwnd)))
        except Exception:
            browser_valid = False
        if session.get("readOnlyMirror") and not browser_valid:
            session["browserHwnd"] = _capture_browser_hwnd(browser_title)

        hidden_ids = None
        if session.get("liveEditable") and LIVE_FRAME_MODE:
            # frame 모드: 활성화/포커스 없이 대상 프레임만 제자리 표시, 나머지는 파킹.
            hidden_ids = _present_live_session_frame(
                session, app, wb,
                left, top, width, height,
                client_left=client_left, client_top=client_top,
                client_width=client_width, client_height=client_height,
                viewport_width=viewport_width, viewport_height=viewport_height,
                skip_position=bool(skip_position),
            )
        if hidden_ids is None:
            if session.get("liveEditable"):
                _set_excel_window_owner(app, session.get("nativeHostHwnd"))
            _show_workbook_window(app, wb, activate=True)
            hidden_ids = _hide_peer_workbook_windows(app, excel_id)
            _show_workbook_window(app, wb, activate=True)
            if not skip_position:
                _position_excel_window(
                    app,
                    left,
                    top,
                    width,
                    height,
                    browser_hwnd=None if (session.get("nativeParentHwnd") or session.get("nativeOverlay")) else (session.get("browserHwnd") if session.get("readOnlyMirror") else None),
                    native_parent_hwnd=session.get("nativeParentHwnd") if session.get("readOnlyMirror") and not session.get("nativeOverlay") else None,
                    native_host_hwnd=session.get("nativeHostHwnd") if session.get("readOnlyMirror") else None,
                    native_overlay=bool(session.get("nativeOverlay")) if session.get("readOnlyMirror") else False,
                    client_left=client_left,
                    client_top=client_top,
                    client_width=client_width,
                    client_height=client_height,
                    viewport_width=viewport_width,
                    viewport_height=viewport_height,
                    show=True,
                )
            try:
                _safe_activate_excel_app(app)
            except Exception:
                pass
        if width and height:
            session["liveRect"] = {
                "left": int(float(left or 0)), "top": int(float(top or 0)),
                "width": int(float(width or 0)), "height": int(float(height or 0)),
            }
        session["hidden"] = False
        session["lastNativePositionKey"] = ""
        return {
            "ok": True,
            "excelId": excel_id,
            "hidden": len(hidden_ids),
            "hiddenIds": hidden_ids,
            "skipPosition": bool(skip_position),
            "left": int(float(left or 0)),
            "top": int(float(top or 0)),
            "width": int(float(width or 0)),
            "height": int(float(height or 0)),
        }


def _reopen_excel_session_workbook(session):
    if not excel_available():
        raise RuntimeError("Microsoft Excel COM automation is not available. Excel and pywin32 are required.")
    candidates = [
        session.get("workingCopyPath"),
        session.get("openPath"),
        session.get("path"),
        session.get("sourcePath"),
    ]
    path = next((Path(p) for p in candidates if p and Path(p).exists()), None)
    if path is None:
        raise RuntimeError("Excel workbook file for recovery was not found.")
    live_editable = bool(session.get("liveEditable"))
    read_only_mirror = bool(session.get("readOnlyMirror")) and not live_editable
    app = _get_live_excel_app() if live_editable else win32com.client.DispatchEx("Excel.Application")
    if not (live_editable and LIVE_FRAME_MODE):
        # frame 모드에서는 글로벌 Visible 토글 금지(다른 라이브 프레임까지 동시에 사라져
        # 포그라운드 소멸 → 무관한 앱 창 활성화). 새 프레임은 아래에서 개별 파킹한다.
        app.Visible = False
    app.DisplayAlerts = False
    try:
        app.EnableEvents = False
    except Exception:
        pass
    try:
        app.AskToUpdateLinks = False
    except Exception:
        pass
    wb, open_temp_path = excel_workbooks_open(app, path, read_only=read_only_mirror)
    session.pop("frameHwnd", None)  # 이전 워크북의 죽은 프레임 핸들 무효화
    if live_editable and LIVE_FRAME_MODE:
        new_frame_hwnd = _workbook_window_hwnd(wb)
        if new_frame_hwnd:
            _move_hwnd_offscreen(new_frame_hwnd)
            session["frameHwnd"] = new_frame_hwnd
    session["app"] = app
    session["workbook"] = wb
    session["pid"] = _excel_process_id(app)
    session["path"] = str(path)
    session["openPath"] = str(wb.FullName)
    session["openTempPath"] = str(open_temp_path) if open_temp_path else session.get("openTempPath", "")
    session["snapshots"] = {}
    try:
        _protect_workbook_for_read_only_mirror(wb, True)
    except Exception:
        pass
    try:
        _configure_excel_grid_window(app, wb)
    except Exception:
        pass
    return app, wb, True


def _recover_excel_session_impl(
    excel_id,
    left,
    top,
    width,
    height,
    client_left=None,
    client_top=None,
    client_width=None,
    client_height=None,
    viewport_width=None,
    viewport_height=None,
    browser_title=None,
    native_parent_hwnd=None,
    native_host_hwnd=None,
    native_overlay=False,
):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        if native_parent_hwnd:
            session["nativeParentHwnd"] = native_parent_hwnd
        if native_host_hwnd:
            session["nativeHostHwnd"] = native_host_hwnd
        if native_overlay:
            session["nativeOverlay"] = True
            session["nativeParentHwnd"] = None
        reopened = False
        try:
            app, wb = session_workbook(session)
        except Exception:
            app, wb, reopened = _reopen_excel_session_workbook(session)
        _restore_app_state(app)
        try:
            _restore_live_protected_view(app, wb)
        except Exception:
            pass
        if width and height:
            session["liveRect"] = {
                "left": int(float(left or 0)),
                "top": int(float(top or 0)),
                "width": int(float(width or 0)),
                "height": int(float(height or 0)),
            }
        frame_mode = bool(session.get("liveEditable")) and LIVE_FRAME_MODE
        hidden_ids = None
        if frame_mode:
            hidden_ids = _present_live_session_frame(
                session, app, wb,
                left, top, width, height,
                client_left=client_left, client_top=client_top,
                client_width=client_width, client_height=client_height,
                viewport_width=viewport_width, viewport_height=viewport_height,
                skip_position=not (width and height),
            )
        if hidden_ids is None:
            try:
                _restore_live_window(session, app, wb)
            except Exception:
                _show_workbook_window(app, wb, activate=True)
            hidden_ids = _hide_peer_workbook_windows(app, excel_id)
            try:
                _show_workbook_window(app, wb, activate=True)
            except Exception:
                pass
            try:
                _safe_activate_excel_app(app)
            except Exception:
                pass
        session["hidden"] = False
        session["lastNativePositionKey"] = ""
        try:
            sheet = wb.ActiveSheet.Name if frame_mode else app.ActiveSheet.Name
        except Exception:
            sheet = ""
        try:
            if frame_mode:
                # 활성화 없이도 이 세션 창의 선택 범위를 읽는다(Window.RangeSelection).
                address = _excel_address(wb.Windows(1).RangeSelection).replace("$", "")
            else:
                address = _excel_address(app.Selection).replace("$", "")
        except Exception:
            address = ""
        return {
            "ok": True,
            "excelId": excel_id,
            "activeExcelId": excel_id,
            "reopened": bool(reopened),
            "hidden": len(hidden_ids),
            "hiddenIds": hidden_ids,
            "sheet": sheet,
            "address": address,
        }


def _hide_excel_session_impl(excel_id):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        if session.get("liveEditable") and LIVE_FRAME_MODE:
            hwnd = _session_frame_hwnd(session, wb)
            if hwnd:
                # 포그라운드 프레임을 그냥 치우면 OS 가 무관한 다음 창을 활성화한다 → 호스트로 먼저 핸드오프.
                _handoff_foreground_to_host(session.get("nativeHostHwnd"), [hwnd])
                _move_hwnd_offscreen(hwnd)
            else:
                _hide_excel_app_window(app)
        else:
            _hide_excel_app_window(app)
        session["hidden"] = True
        session["lastNativePositionKey"] = ""
        return {"ok": True, "excelId": excel_id, "hidden": True}


def _hide_all_excel_sessions_impl():
    hidden = 0
    with EXCEL_LOCK:
        sessions = list(EXCEL_SESSIONS.values())
    if LIVE_FRAME_MODE:
        # 라이브 프레임 중 하나가 포그라운드면 먼저 호스트로 포커스를 넘긴다(무관 창 점프 방지).
        frame_hwnds = []
        host_hwnd = None
        for session in sessions:
            if not session.get("liveEditable"):
                continue
            hwnd = session.get("frameHwnd")
            if hwnd:
                frame_hwnds.append(hwnd)
            if not host_hwnd:
                host_hwnd = session.get("nativeHostHwnd")
        if frame_hwnds:
            _handoff_foreground_to_host(host_hwnd, frame_hwnds)
    for session in sessions:
        try:
            app, wb = session_workbook(session)
            if session.get("liveEditable") and LIVE_FRAME_MODE:
                hwnd = _session_frame_hwnd(session, wb)
                if hwnd:
                    _move_hwnd_offscreen(hwnd)
                else:
                    _hide_excel_app_window(app)
            else:
                _hide_excel_app_window(app)
            session["hidden"] = True
            session["lastNativePositionKey"] = ""
            hidden += 1
        except Exception:
            pass
    return {"ok": True, "hidden": hidden}


def _foreground_is_excel_window():
    if win32gui is None:
        return False
    try:
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return False
        cls = (win32gui.GetClassName(hwnd) or "").upper()
        return "XLMAIN" in cls or "XLDESK" in cls or "EXCEL7" in cls
    except Exception:
        return False


def _hide_inactive_excel_sessions_impl():
    # 앱이 포커스를 잃었을 때 호출. 포그라운드가 Excel(사용자가 미러를 클릭)이면 그대로 두고,
    # 그 외(파일 대화상자/다른 앱/최소화)면 미러를 숨겨 Excel 이 위로 튀어나오지 않게 한다.
    if _foreground_is_excel_window():
        return {"ok": True, "hidden": 0, "foregroundExcel": True}
    return _hide_all_excel_sessions_impl()


def _close_excel_session_impl(excel_id):
    with EXCEL_LOCK:
        session = EXCEL_SESSIONS.pop(excel_id, None)
    if not session:
        return {"ok": True, "closed": False}
    pid = session.get("pid")
    if LIVE_FRAME_MODE and session.get("liveEditable"):
        # 닫히는 프레임이 포그라운드면 파괴 직전에 호스트로 포커스를 넘긴다(무관 창 점프 방지).
        try:
            hwnd = session.get("frameHwnd")
            if hwnd:
                _handoff_foreground_to_host(session.get("nativeHostHwnd"), [hwnd])
        except Exception:
            pass
    try:
        app, wb = session_workbook(session)
        _close_companion_workbooks(session, app)
        wb.Close(SaveChanges=False)
        if app.Workbooks.Count == 0:
            _hide_excel_app_window(app)
            app.Quit()
            if _is_live_shared_app(app):
                global LIVE_EXCEL_APP
                LIVE_EXCEL_APP = None
    except Exception:
        pass
    # 공유 Excel 인스턴스에 같은 pid를 쓰는 다른 세션이 남아 있으면 프로세스를 죽이면 안 된다.
    if pid and not _remaining_sessions_for_pid(pid):
        deadline = time.time() + 1.5
        while time.time() < deadline and _is_pid_alive(pid):
            _hide_excel_windows_for_pid(pid)
            time.sleep(0.1)
        if _is_pid_alive(pid):
            _hide_excel_windows_for_pid(pid)
            _force_kill_pid(pid)
    if hide_guard:
        hide_guard.set()
    for key in ("openTempPath", "workingCopyPath"):
        temp_path = session.get(key)
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass
    for cdir in session.get("companionTemps") or []:
        try:
            shutil.rmtree(cdir, ignore_errors=True)
        except Exception:
            pass
    return {"ok": True, "closed": True}


VBA_SKILL_ENTRY = "B2BSkill"


def _strip_vba_comment(line):
    in_string = False
    out = []
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == '"':
            out.append(ch)
            if in_string and i + 1 < len(line) and line[i + 1] == '"':
                out.append(line[i + 1])
                i += 2
                continue
            in_string = not in_string
            i += 1
            continue
        if ch == "'" and not in_string:
            break
        out.append(ch)
        i += 1
    return "".join(out)


def _validate_vba_source_before_inject(code):
    """VBE 디버거를 띄우는 명백한 컴파일 오류는 Excel에 주입하기 전에 차단한다."""
    lines = str(code or "").splitlines()
    block_stack = []

    def push(kind, line_no, expected):
        block_stack.append((kind, line_no, expected))

    def pop(expected_kind, end_text, line_no):
        if not block_stack or block_stack[-1][0] != expected_kind:
            raise RuntimeError("VBA 문법 오류(%d행): 대응되는 %s 블록이 없습니다." % (line_no, end_text))
        block_stack.pop()

    for idx, raw in enumerate(lines, 1):
        line = _strip_vba_comment(raw).strip()
        if not line or line.endswith("_"):
            continue
        if re.search(r"\bAs(?:\s+New)?\s*$", line, re.IGNORECASE):
            raise RuntimeError("VBA 문법 오류(%d행): As 뒤의 자료형이 비어 있습니다." % idx)
        # 기호 연산자로 끝나면 미완성 식. 단어 연산자(And/Or/Xor/Mod)는 반드시 \b 단어경계로
        # 검사해야 "Exit For"(끝이 'or'), 변수명 color/vendor/cursor 등을 오탐하지 않는다.
        if re.search(r"(?:,|\+|-|\*|/|&|=|<>|<=|>=|<|>)\s*$", line) \
                or re.search(r"\b(?:And|Or|Xor|Mod)\s*$", line, re.IGNORECASE):
            raise RuntimeError("VBA 문법 오류(%d행): 줄 끝의 식이 완성되지 않았습니다." % idx)
        if re.match(r"^End\s+Sub\b", line, re.IGNORECASE):
            pop("Sub", "Sub", idx)
            continue
        if re.match(r"^End\s+Function\b", line, re.IGNORECASE):
            pop("Function", "Function", idx)
            continue
        if re.match(r"^End\s+If\b", line, re.IGNORECASE):
            pop("If", "If", idx)
            continue
        if re.match(r"^End\s+With\b", line, re.IGNORECASE):
            pop("With", "With", idx)
            continue
        if re.match(r"^End\s+Select\b", line, re.IGNORECASE):
            pop("Select", "Select", idx)
            continue
        if re.match(r"^Next\b", line, re.IGNORECASE):
            pop("For", "For", idx)
            continue
        if re.match(r"^Loop\b", line, re.IGNORECASE):
            pop("Do", "Do", idx)
            continue
        if re.match(r"^(?:(?:Public|Private|Friend|Static)\s+)?Sub\b", line, re.IGNORECASE):
            push("Sub", idx, "End Sub")
            continue
        if re.match(r"^(?:(?:Public|Private|Friend|Static)\s+)?Function\b", line, re.IGNORECASE):
            push("Function", idx, "End Function")
            continue
        if re.match(r"^If\b", line, re.IGNORECASE) and re.search(r"\bThen\s*$", line, re.IGNORECASE):
            push("If", idx, "End If")
            continue
        if re.match(r"^For\b", line, re.IGNORECASE):
            push("For", idx, "Next")
            continue
        if re.match(r"^Do\b", line, re.IGNORECASE):
            push("Do", idx, "Loop")
            continue
        if re.match(r"^With\b", line, re.IGNORECASE):
            push("With", idx, "End With")
            continue
        if re.match(r"^Select\s+Case\b", line, re.IGNORECASE):
            push("Select", idx, "End Select")
            continue
    if block_stack:
        kind, line_no, expected = block_stack[-1]
        raise RuntimeError("VBA 문법 오류(%d행): %s가 없습니다." % (line_no, expected))


def _vba_pipeline_step_info(step, fallback_idx, err):
    _code = (step.get("code") if isinstance(step, dict) else str(step or "")) or ""
    _cause, _guide = _pipeline_error_guide(str(err), _code)
    _msg = f"{_cause}\n💡 이렇게 요청해 보세요: {_guide}\n(자세히: {err})"
    if isinstance(step, dict):
        raw_idx = step.get("stepIdx")
        try:
            step_idx = int(raw_idx)
        except Exception:
            step_idx = int(fallback_idx)
        return {
            "stepIdx": step_idx,
            "stepId": step.get("stepId") or None,
            "description": step.get("description") or "",
            "code": step.get("code") or "",
            "language": step.get("language") or "vba",
            "message": _msg,
            "cause": _cause,
            "promptGuide": _guide,
            "rawError": str(err),
            "stack": "",
        }
    return {
        "stepIdx": int(fallback_idx),
        "stepId": None,
        "description": "",
        "code": str(step or ""),
        "language": "vba",
        "message": _msg,
        "cause": _cause,
        "promptGuide": _guide,
        "rawError": str(err),
        "stack": "",
    }


def _wrap_vba_skill_code(code, entry):
    """사용자 VBA를 내부 Sub로 바꾸고, 런타임 오류를 팝업 대신 상태값으로 전달하는 래퍼를 붙인다."""
    entry = (entry or VBA_SKILL_ENTRY).strip() or VBA_SKILL_ENTRY
    impl_name = "B2B_UserSkill_Impl"
    runner_name = "B2B_RunSkill"
    err_num_name = "B2B_GetLastErrNumber"
    err_desc_name = "B2B_GetLastErrDescription"
    pattern = re.compile(
        r"^(\s*)(?:(Public|Private)\s+)?Sub\s+%s\s*\([^)]*\)"
        % re.escape(entry),
        re.IGNORECASE | re.MULTILINE,
    )
    wrapped_user_code, count = pattern.subn(
        r"\1Private Sub %s()" % impl_name,
        code,
        count=1,
    )
    if count == 0:
        wrapped_user_code = code
        call_line = "%s" % entry
    else:
        call_line = "%s" % impl_name
    declarations = """
Private B2B_LastErrNumber As Long
Private B2B_LastErrDescription As String
"""
    option_match = re.match(r"(?is)^((?:\s*Option\s+[^\r\n]+\r?\n)+)", wrapped_user_code)
    if option_match:
        pos = option_match.end(1)
        wrapped_user_code = wrapped_user_code[:pos] + declarations + wrapped_user_code[pos:]
    else:
        wrapped_user_code = declarations + wrapped_user_code
    wrapper = f"""

Public Sub {runner_name}()
    On Error GoTo B2B_Err
    B2B_LastErrNumber = 0
    B2B_LastErrDescription = vbNullString
    {call_line}
    Exit Sub
B2B_Err:
    B2B_LastErrNumber = Err.Number
    B2B_LastErrDescription = Err.Description
End Sub

Public Function {err_num_name}() As Long
    {err_num_name} = B2B_LastErrNumber
End Function

Public Function {err_desc_name}() As String
    {err_desc_name} = B2B_LastErrDescription
End Function
"""
    return wrapped_user_code + "\n" + wrapper, runner_name, err_num_name, err_desc_name


def _suppress_vba_debug_windows(pid=None):
    """VBE/디버그 다이얼로그가 떠도 사용자에게 보이지 않도록 즉시 닫거나 숨긴다."""
    wg = globals().get("win32gui")
    wp = globals().get("win32process")
    if wg is None or wp is None:
        return
    target_pid = int(pid or 0)
    wm_close = getattr(globals().get("win32con"), "WM_CLOSE", 0x0010)
    sw_hide = getattr(globals().get("win32con"), "SW_HIDE", 0)

    def visit(hwnd, _):
        try:
            _tid, window_pid = wp.GetWindowThreadProcessId(hwnd)
        except Exception:
            return True
        if target_pid and int(window_pid or 0) != target_pid:
            return True
        try:
            title = wg.GetWindowText(hwnd) or ""
            cls = wg.GetClassName(hwnd) or ""
        except Exception:
            return True
        text = (title + " " + cls).lower()
        if "visual basic" not in text and "wndclass_desked" not in text:
            return True
        try:
            if cls == "#32770":
                wg.PostMessage(hwnd, wm_close, 0, 0)
            else:
                wg.ShowWindow(hwnd, sw_hide)
        except Exception:
            pass
        return True

    try:
        wg.EnumWindows(visit, None)
    except Exception:
        pass


def _start_vba_debug_suppressor(pid=None):
    stop = threading.Event()

    def worker():
        while not stop.is_set():
            _suppress_vba_debug_windows(pid)
            stop.wait(0.05)

    thread = threading.Thread(target=worker, name="b2b-vba-debug-suppressor", daemon=True)
    thread.start()
    return stop


def _hide_vba_editor(app):
    """VBE/디버거 창이 사용자 화면으로 올라오지 않게 숨긴다."""
    try:
        vbe = app.VBE
    except Exception:
        return
    try:
        vbe.MainWindow.Visible = False
    except Exception:
        pass
    try:
        count = int(vbe.Windows.Count)
    except Exception:
        count = 0
    for idx in range(1, count + 1):
        try:
            vbe.Windows(idx).Visible = False
        except Exception:
            pass


def _inject_and_run_vba(app, wb, code, entry):
    """워크북에 VBA 모듈을 임시로 추가해 entry Sub를 실행하고, 끝나면 모듈을 제거한다.
    AccessVBOM 이 꺼져 있으면 wb.VBProject 접근에서 예외 → 명확한 안내로 변환."""
    code = code or ""
    if not code.strip():
        return
    _validate_vba_source_before_inject(code)
    excel_pid = _excel_process_id(app)
    suppressor = _start_vba_debug_suppressor(excel_pid)
    module = None
    prev_display_alerts = None
    prev_enable_events = None
    prev_enable_cancel_key = None
    try:
        _disable_vba_break_on_all_errors()
        _hide_vba_editor(app)
        try:
            vbproj = wb.VBProject
        except Exception as err:
            raise RuntimeError(
                "VBA 프로젝트에 접근할 수 없습니다. Excel 옵션 > 보안 센터 > 매크로 설정에서 "
                "'VBA 프로젝트 개체 모델에 대한 액세스 신뢰'를 켠 뒤 파일을 다시 여세요. (" + str(err) + ")"
            )
        module = vbproj.VBComponents.Add(1)  # 1 = vbext_ct_StdModule
        module_name = module.Name
        safe_code, runner_name, err_num_name, err_desc_name = _wrap_vba_skill_code(code, entry)
        module.CodeModule.AddFromString(safe_code)
        try:
            prev_display_alerts = app.DisplayAlerts
            app.DisplayAlerts = False
        except Exception:
            pass
        try:
            prev_enable_events = app.EnableEvents
            app.EnableEvents = False
        except Exception:
            pass
        try:
            prev_enable_cancel_key = app.EnableCancelKey
            app.EnableCancelKey = 0  # xlDisabled
        except Exception:
            pass
        try:
            app.Run("%s.%s" % (module_name, runner_name))
            err_number = 0
            err_description = ""
            try:
                err_number = int(app.Run("%s.%s" % (module_name, err_num_name)) or 0)
            except Exception:
                err_number = 0
            try:
                err_description = str(app.Run("%s.%s" % (module_name, err_desc_name)) or "")
            except Exception:
                err_description = ""
            if err_number:
                raise RuntimeError("VBA 실행 실패: %s" % (err_description or ("오류 번호 %s" % err_number)))
        except Exception as err:
            if str(err).startswith("VBA 실행 실패:"):
                raise
            raise RuntimeError("VBA 실행 실패: %s" % err)
    finally:
        try:
            if prev_enable_cancel_key is not None:
                app.EnableCancelKey = prev_enable_cancel_key
        except Exception:
            pass
        try:
            if prev_enable_events is not None:
                app.EnableEvents = prev_enable_events
        except Exception:
            pass
        try:
            if prev_display_alerts is not None:
                app.DisplayAlerts = prev_display_alerts
        except Exception:
            pass
        if module is not None:
            try:
                vbproj.VBComponents.Remove(module)
            except Exception:
                pass
        try:
            _hide_vba_editor(app)
            _suppress_vba_debug_windows(excel_pid)
        finally:
            suppressor.set()


def _restore_app_state(app):
    """VBA 실행(성공/실패 무관) 후 Application 전역 상태를 결정적으로 정상화한다.

    생성된 VBA 가 Application.Calculation = xlCalculationManual / ScreenUpdating = False 로
    바꿔놓고 (특히 Err.Raise 로) 중단되면, 그 상태가 워크북 인스턴스에 남아 **이후 모든
    수식 재계산이 멈춘다**(품질평가에서 가장 빈번했던 위험). 그래서 호출자의 복원에만
    의존하지 않고 여기서 항상 Automatic/True 로 강제하고 한 번 재계산한다.
    부수효과가 없는 안전한 정상화이므로 모든 실행 경로의 finally 에서 호출한다."""
    try:
        app.Calculation = -4105  # xlCalculationAutomatic (상수 이름이 환경따라 없을 수 있어 값 사용)
    except Exception:
        pass
    try:
        app.ScreenUpdating = True
    except Exception:
        pass
    try:
        app.EnableEvents = True
    except Exception:
        pass
    try:
        app.CutCopyMode = False
    except Exception:
        pass
    # Manual 로 멈춰 있던 동안 갱신 안 된 수식을 한 번 강제 계산(고착 해소).
    try:
        app.Calculate()
    except Exception:
        pass


def _restore_live_protected_view(app, wb):
    """VBA 실행 후 라이브 보기 상태(편집 차단+선택 허용, 리본/우클릭 숨김, 화면갱신)를 복구."""
    try:
        _hide_vba_editor(app)
    except Exception:
        pass
    try:
        _protect_workbook_for_read_only_mirror(wb, True)
    except Exception:
        pass
    try:
        _configure_excel_grid_window(app, wb)  # 리본 숨김 + 입력키 차단 + 우클릭 차단
    except Exception:
        pass
    try:
        app.ScreenUpdating = True
    except Exception:
        pass
    try:
        app.Calculation = -4105  # xlCalculationAutomatic
    except Exception:
        pass


def _same_excel_workbook(a, b):
    if a is None or b is None:
        return False
    for attr in ("FullName", "Name"):
        try:
            av = str(getattr(a, attr) or "").lower()
            bv = str(getattr(b, attr) or "").lower()
            if av and bv and av == bv:
                return True
        except Exception:
            pass
    return False


def _capture_live_view_state(app, wb, session=None):
    """현재 워크북의 활성 시트/선택 주소를 보존한다.
    동반 워크북 오픈, reset, 창 복구가 ActiveSheet 를 마지막 시트로 바꾸는 경우를 막기 위한 상태다."""
    state = {"sheet": "", "address": ""}
    ws = None
    try:
        ws = wb.Windows(1).ActiveSheet
    except Exception:
        ws = None
    if ws is None:
        try:
            active_ws = app.ActiveSheet
            parent = getattr(active_ws, "Parent", None)
            if _same_excel_workbook(parent, wb):
                ws = active_ws
        except Exception:
            ws = None
    if ws is not None:
        try:
            state["sheet"] = str(ws.Name or "")
        except Exception:
            state["sheet"] = ""
    if not state["sheet"] and session:
        remembered = str(session.get("lastSelectionSheet") or "")
        if remembered:
            try:
                names = _excel_collection_names(wb.Worksheets)
                if remembered in names:
                    state["sheet"] = remembered
            except Exception:
                pass
    if not state["sheet"]:
        try:
            names = _excel_collection_names(wb.Worksheets)
            if names:
                state["sheet"] = names[0]
        except Exception:
            pass
    try:
        sel = app.Selection
        sel_ws = getattr(sel, "Worksheet", None)
        if sel_ws is not None and str(getattr(sel_ws, "Name", "") or "") == state["sheet"]:
            state["address"] = _excel_address(sel).replace("$", "")
    except Exception:
        pass
    if not state["address"]:
        try:
            active_cell = app.ActiveCell
            cell_ws = getattr(active_cell, "Worksheet", None)
            if cell_ws is not None and str(getattr(cell_ws, "Name", "") or "") == state["sheet"]:
                state["address"] = _excel_address(active_cell).replace("$", "")
        except Exception:
            pass
    if not state["address"] and session and str(session.get("lastSelectionSheet") or "") == state["sheet"]:
        state["address"] = str(session.get("lastSelectionAddress") or "")
    return state if state.get("sheet") else None


def _restore_live_view_state(app, wb, state, session=None):
    if not state or not state.get("sheet"):
        return
    sheet = str(state.get("sheet") or "")
    try:
        names = _excel_collection_names(wb.Worksheets)
    except Exception:
        names = []
    match = sheet if sheet in names else None
    if not match:
        normalized = normalize_text(sheet)
        match = next((name for name in names if normalize_text(name) == normalized), None)
    if not match:
        return
    try:
        wb.Activate()
    except Exception:
        pass
    try:
        ws = wb.Worksheets(match)
        ws.Activate()
    except Exception:
        return
    address = str(state.get("address") or "")
    if address:
        try:
            ws.Range(address).Select()
        except Exception:
            pass
    if session is not None:
        session["lastSelectionSheet"] = match
        if address:
            session["lastSelectionAddress"] = address


def _restore_live_window(session, app, wb):
    """리셋(_copy_source_workbook_into_target)으로 offscreen park 된 라이브 창을 owner 모드 방식으로
    다시 보이게+제자리로 되돌린다(plain 위치맞춤 + owner + 워크북 뷰 채움)."""
    if session.get("liveEditable") and LIVE_FRAME_MODE:
        rect = session.get("liveRect") or {}
        presented = _present_live_session_frame(
            session, app, wb,
            rect.get("left"), rect.get("top"), rect.get("width"), rect.get("height"),
            skip_position=not (rect.get("width") and rect.get("height")),
        )
        if presented is not None:
            return
    try:
        app.Visible = True
    except Exception:
        pass
    try:
        wb.Activate()
    except Exception:
        pass
    try:
        app.WindowState = -4143  # xlNormal
    except Exception:
        pass
    _set_excel_window_owner(app, session.get("nativeHostHwnd"))
    # show 전에 워크북 뷰/그리기를 먼저 준비(파킹 상태라 화면엔 안 보임) → 회색 프레임 플래시 방지.
    try:
        _ensure_excel_workbook_view(app, wb, make_visible=True, activate=False, maximize_workbook=False)
    except Exception:
        pass
    rect = session.get("liveRect") or {}
    left, top, width, height = rect.get("left"), rect.get("top"), rect.get("width"), rect.get("height")
    if width and height:
        try:
            _position_excel_window(app, left, top, width, height, show=True)  # plain(프레임 유지)
        except Exception:
            pass
    try:
        _ensure_excel_workbook_view(app, wb, make_visible=True, activate=False, maximize_workbook=False)
    except Exception:
        pass
    _hide_non_target_workbook_windows(app, wb)
    _set_excel_window_owner(app, session.get("nativeHostHwnd"))


def _close_companion_workbooks(session, app):
    """이전에 동반 오픈한 워크북을 닫고 임시본 폴더를 정리한다(다음 스냅샷 전에 호출)."""
    for nm in list(session.get("companionNames") or []):
        try:
            for w in list(app.Workbooks):
                if str(w.Name).lower() == str(nm).lower():
                    try:
                        w.Close(SaveChanges=False)
                    except Exception:
                        pass
                    break
        except Exception:
            pass
    session["companionNames"] = []
    for cdir in session.get("companionTemps") or []:
        try:
            shutil.rmtree(cdir, ignore_errors=True)
        except Exception:
            pass
    session["companionTemps"] = []


def _ensure_companion_workbooks(session, excel_id, app, current_wb):
    """다른 라이브 세션들의 '현재(편집 반영된) 상태'를 스냅샷해서 이 인스턴스에 읽기전용으로 동반 오픈한다.
    원본 업로드 파일이 아니라 라이브 임시 워크북의 최신 상태(SaveCopyAs)를 읽으므로,
    사용자가 입력 파일을 먼저 스킬로 수정한 뒤 그 값을 출력 스킬에서 활용할 수 있다.
    매 실행마다 이전 동반본을 닫고 새로 스냅샷한다(항상 최신). VBA 는 Workbooks("파일명") 으로 교차 접근."""
    _close_companion_workbooks(session, app)
    try:
        current_name = str(current_wb.Name).lower()
    except Exception:
        current_name = ""
    opened = {current_name} if current_name else set()
    try:
        for existing_wb in app.Workbooks:
            try:
                nm = str(existing_wb.Name).lower()
                if nm:
                    opened.add(nm)
            except Exception:
                pass
    except Exception:
        pass
    names, temps = [], []
    try:
        app.ScreenUpdating = False
    except Exception:
        pass
    for other_id, other in list(EXCEL_SESSIONS.items()):
        if other_id == excel_id or not other.get("liveEditable"):
            continue
        try:
            _o_app, o_wb = session_workbook(other)
        except Exception:
            continue
        clean = Path(str(other.get("name") or "")).name
        if not clean:
            try:
                clean = Path(str(o_wb.Name)).name
            except Exception:
                clean = ""
        if not clean or clean.lower() in opened:
            continue
        if _is_live_shared_app(app) and _is_live_shared_app(_o_app):
            # 같은 Excel.Application 안에 이미 열린 라이브 워크북이다.
            # 스냅샷 복제본을 또 열면 프로세스 절감 효과가 사라지고 Workbooks("파일명")도 모호해진다.
            try:
                opened.add(str(o_wb.Name).lower())
            except Exception:
                opened.add(clean.lower())
            continue
        cdir = BACKEND_DIR / f"companion_{uuid.uuid4().hex}"
        try:
            cdir.mkdir(parents=True, exist_ok=True)
            cpath = cdir / clean
            o_wb.SaveCopyAs(str(cpath))   # 라이브 최신 상태(편집 반영)를 스냅샷
            wb2, _t = excel_workbooks_open(app, cpath, read_only=True)
            # 동반 워크북 창은 화면에 안 나오게 확실히 숨긴다(Visible=False + 오프스크린 park).
            _hide_workbook_windows(wb2)
            opened.add(clean.lower())
            names.append(clean)
            temps.append(str(cdir))
        except Exception:
            try:
                shutil.rmtree(cdir, ignore_errors=True)
            except Exception:
                pass
    session["companionNames"] = names
    session["companionTemps"] = temps
    # 동반 워크북을 열면 ActiveWorkbook 이 바뀔 수 있으니 현재 세션 워크북을 다시 활성화.
    try:
        current_wb.Activate()
    except Exception:
        pass
    _hide_non_target_workbook_windows(app, current_wb)
    try:
        app.ScreenUpdating = True
    except Exception:
        pass


def _run_vba_on_session_impl(excel_id, code, entry=None):
    """라이브 세션에 떠 있는 실제 워크북에 VBA 매크로를 주입해 즉시 실행한다(저지연 리모콘, 단일 단계 append).
    시트는 UserInterfaceOnly=True 보호라 사용자는 직접 편집 못 해도 VBA/COM 은 수정 가능."""
    entry = (str(entry).strip() if entry else "") or VBA_SKILL_ENTRY
    if not (code or "").strip():
        raise RuntimeError("VBA 코드가 비어 있습니다.")
    _t0 = time.perf_counter()
    timings = {"mode": "vba-single", "steps": 1}
    with EXCEL_LOCK:
        _t = time.perf_counter()
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        initial_view = _capture_live_view_state(app, wb, session)
        final_view = initial_view
        timings["sessionMs"] = round((time.perf_counter() - _t) * 1000, 2)
        # 교차 파일 접근: 다른 업로드 파일들을 같은 인스턴스에 동반 오픈(읽기전용, 숨김).
        _t = time.perf_counter()
        _ensure_companion_workbooks(session, excel_id, app, wb)
        # VBA 실행 동안에는 시트 보호를 풀어 둔다(보호로 인한 1004 류 실패 방지). 끝나면 다시 보호.
        _t = time.perf_counter()
        try:
            _protect_workbook_for_read_only_mirror(wb, False)
        except Exception:
            pass
        before_fp = _workbook_change_fingerprint(wb)  # 실행 전 지문(변경 0건 검출용)
        try:
            _t = time.perf_counter()
            _inject_and_run_vba(app, wb, code, entry)
            captured = _capture_live_view_state(app, wb, session)
            if captured:
                final_view = captured
            timings["injectRunMs"] = round((time.perf_counter() - _t) * 1000, 2)
        except PipelineExecutionError:
            raise
        except Exception as err:
            # 단일 VBA 적용 실패도 파이프라인과 같은 포맷(원인+프롬프트 가이드+세부)으로 통일.
            _cause, _guide = _pipeline_error_guide(str(err), code)
            raise PipelineExecutionError({
                "stepIdx": 0,
                "stepId": None,
                "description": "",
                "code": code,
                "language": "vba",
                "message": _cause + '\n' + "💡 이렇게 요청해 보세요: " + _guide + '\n' + "(자세히: " + str(err) + ")",
                "cause": _cause,
                "promptGuide": _guide,
                "rawError": str(err),
                "stack": "",
            }) from err
        finally:
            # 성공/실패 무관: Application 전역 상태(Calculation/ScreenUpdating 등)를 먼저 정상화.
            # 생성 VBA 가 Manual 로 두고 죽어도 재계산 고착이 남지 않게 한다.
            _restore_app_state(app)
            try:
                _restore_live_protected_view(app, wb)
            except Exception:
                pass
            # 동반 워크북을 열며 흐트러진 대상 창을 다시 보이게+제자리로(회색 빈 오버레이 방지).
            try:
                _restore_live_window(session, app, wb)
            except Exception:
                pass
        # 여기 도달 = 실행 자체는 예외 없이 끝남. 그런데 워크북이 전혀 안 바뀌었다면
        # '적용됨'으로 잘못 보고되는 no-op 이므로 실패로 드러낸다(품질평가 issue 45/57/58).
        after_fp = _workbook_change_fingerprint(wb)
        if before_fp and after_fp and before_fp == after_fp:
            _noop_msg = (
                "VBA 가 실행됐지만 워크북에 아무 변경도 없습니다(대상 시트/범위/조건을 확인하세요). "
                "'적용됨'으로 잘못 보고되지 않도록 실패로 처리했습니다."
            )
            _cause, _guide = _pipeline_error_guide("변경된 셀이 없습니다", code)
            raise PipelineExecutionError({
                "stepIdx": 0,
                "stepId": None,
                "description": "",
                "code": code,
                "language": "vba",
                "message": _cause + '\n' + "💡 이렇게 요청해 보세요: " + _guide + '\n' + "(자세히: " + _noop_msg + ")",
                "cause": _cause,
                "promptGuide": _guide,
                "rawError": _noop_msg,
                "stack": "",
            })
        return {"ok": True, "excelId": excel_id, "entry": entry}


def _run_vba_pipeline_on_session_impl(excel_id, steps, reset=True, entry=None):
    """VBA 스킬 파이프라인을 라이브 워크북에 적용한다.
    reset=True: 원본으로 되돌린 뒤(_copy_source_workbook_into_target) enabled 스텝을 순서대로 재적용
    (토글/삭제/순서변경/편집 후 재동기화에 사용). reset=False: 주어진 스텝만 현재 상태에 이어서 실행."""
    entry = (str(entry).strip() if entry else "") or VBA_SKILL_ENTRY
    steps = steps or []
    _t0 = time.perf_counter()
    timings = {"mode": "vba-pipeline", "steps": len(steps), "reset": bool(reset)}
    with EXCEL_LOCK:
        _t = time.perf_counter()
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        initial_view = _capture_live_view_state(app, wb, session)
        final_view = initial_view
        timings["sessionMs"] = round((time.perf_counter() - _t) * 1000, 2)
        # 교차 파일 접근: 다른 업로드 파일들을 같은 인스턴스에 동반 오픈(읽기전용, 숨김).
        _t = time.perf_counter()
        _ensure_companion_workbooks(session, excel_id, app, wb)
        try:
            if reset:
                source = session.get("sourcePath") or session.get("path")
                try:
                    _protect_workbook_for_read_only_mirror(wb, False)  # 시트 교체 전 보호 해제
                except Exception:
                    pass
                try:
                    app.ScreenUpdating = False
                except Exception:
                    pass
                _copy_source_workbook_into_target(app, wb, source)
            else:
                # 비리셋(append): 현재 보호 상태를 풀고 실행(보호로 인한 1004 류 방지).
                try:
                    _protect_workbook_for_read_only_mirror(wb, False)
                except Exception:
                    pass
            for st in steps:
                code = (st.get("code") if isinstance(st, dict) else str(st)) or ""
                if code.strip():
                    _inject_and_run_vba(app, wb, code, entry)
        finally:
            # 한 스텝이 던져도 Application 상태(ScreenUpdating=False 등)가 남지 않게 항상 정상화.
            _restore_app_state(app)
            try:
                _restore_live_protected_view(app, wb)
            except Exception:
                pass
            # 동반 워크북/리셋으로 흐트러진 대상 창을 항상 복원(회색 빈 오버레이 방지).
            try:
                _restore_live_window(session, app, wb)
            except Exception:
                pass
        return {"ok": True, "excelId": excel_id, "applied": len(steps)}


def run_vba_on_session(excel_id, code, entry=None):
    return excel_call(_run_vba_on_session_impl, excel_id, code, entry=entry, timeout=180)


def run_vba_pipeline_on_session(excel_id, steps, reset=True, entry=None):
    return excel_call(_run_vba_pipeline_on_session_impl, excel_id, steps, reset=reset, entry=entry, timeout=600)


def _com_scalar(value):
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _range_matrix(value):
    if value is None:
        return []
    if not isinstance(value, tuple):
        return [[value]]
    if value and not isinstance(value[0], tuple):
        return [list(value)]
    return [list(row) for row in value]


def _excel_address(obj):
    address = getattr(obj, "Address", "")
    if callable(address):
        try:
            return address(False, False)
        except TypeError:
            return address
    return str(address or "")


def _col_letter(n):
    # 1-based 열 번호 → 엑셀 열 문자(A, B, ..., AA ...). COM 호출 없이 Python 으로 계산.
    s = ""
    n = int(n)
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s or "A"


# 스냅샷이 읽을 최대 범위(거대/부풀린 UsedRange 방어). 변경 감지용이라 이 정도면 충분.
_SNAPSHOT_MAX_ROWS = 20000
_SNAPSHOT_MAX_COLS = 256


def _sheet_snapshot(ws):
    used = ws.UsedRange
    start_row = int(used.Row)
    start_col = int(used.Column)
    # 범위를 한정해 읽는다(전체 UsedRange 가 시트 끝까지 부풀어 있어도 안전).
    n_rows = min(int(used.Rows.Count), _SNAPSHOT_MAX_ROWS)
    n_cols = min(int(used.Columns.Count), _SNAPSHOT_MAX_COLS)
    if n_rows <= 0 or n_cols <= 0:
        return {}
    rng = ws.Range(ws.Cells(start_row, start_col), ws.Cells(start_row + n_rows - 1, start_col + n_cols - 1))
    values = _range_matrix(rng.Value)       # 1회 COM 호출
    formulas = _range_matrix(rng.Formula)   # 1회 COM 호출
    cells = {}
    for r_offset, row in enumerate(values):
        formula_row = formulas[r_offset] if r_offset < len(formulas) else []
        row_num = start_row + r_offset
        for c_offset, value in enumerate(row):
            formula = formula_row[c_offset] if c_offset < len(formula_row) else value
            col_num = start_col + c_offset
            address = f"{_col_letter(col_num)}{row_num}"  # ← Python 계산(셀당 COM 호출 제거)
            formula_text = _com_scalar(formula)
            value_text = _com_scalar(value)
            is_formula = isinstance(formula_text, str) and formula_text.startswith("=")
            cells[address] = {
                "address": address,
                "row": row_num,
                "col": col_num,
                "value": value_text,
                "formula": formula_text if is_formula else "",
                "key": formula_text if is_formula else value_text,
            }
    return cells


def _active_sheet_snapshot(wb, prefer_workbook=False):
    ws = None
    if prefer_workbook:
        # frame 모드: 전환 시 COM Activate 를 하지 않으므로 Application.ActiveSheet 는
        # 다른 워크북을 가리킬 수 있다. 이 워크북 자체의 활성 시트를 우선 사용.
        try:
            ws = wb.ActiveSheet
        except Exception:
            ws = None
    if ws is None:
        ws = wb.Application.ActiveSheet
    try:
        if ws is not None and _workbook_fullname(ws.Parent) != _workbook_fullname(wb):
            ws = None
    except Exception:
        pass
    if ws is None:
        names = _excel_collection_names(wb.Worksheets)
        if not names:
            raise RuntimeError("no visible worksheet")
        ws = wb.Worksheets(names[0])
        ws.Activate()
    return ws.Name, _sheet_snapshot(ws)


def _workbook_change_fingerprint(wb):
    """VBA 실행 전후 비교용 워크북 지문. 모든 시트의 used-range 를 셀별 (value-or-formula)
    로 직렬화한 dict. 실행 후 이 지문이 그대로면 '변경 0건'(아무 일도 안 한 것).
    VBA 가 어느 시트를 건드릴지 모르므로 활성 시트만 보지 않고 전 시트를 본다.
    실패는 조용히 무시(변경검출은 보조 안전망이지 핵심 실행 경로가 아님)."""
    fp = {}
    try:
        names = _excel_collection_names(wb.Worksheets)
    except Exception:
        return fp
    for name in names:
        try:
            ws = wb.Worksheets(name)
            snap = _sheet_snapshot(ws)
            # 셀별 key(value 또는 formula)만 추려 가볍게.
            fp[name] = {addr: cell.get("key", "") for addr, cell in snap.items()}
        except Exception:
            continue
    return fp


def _left_mouse_button_down():
    if os.name != "nt":
        return False
    try:
        return bool(ctypes.windll.user32.GetAsyncKeyState(0x01) & 0x8000)
    except Exception:
        return False


def _active_sheet_name(wb, prefer_workbook=False):
    """활성 시트 '이름만' — 풀스냅샷 없이. 라이브 폴링 경량 경로용."""
    ws = None
    if prefer_workbook:
        try:
            ws = wb.ActiveSheet
        except Exception:
            ws = None
    if ws is None:
        try:
            ws = wb.Application.ActiveSheet
            if ws is not None and _workbook_fullname(ws.Parent) != _workbook_fullname(wb):
                ws = None
        except Exception:
            ws = None
    if ws is None:
        names = _excel_collection_names(wb.Worksheets)
        return names[0] if names else ""
    try:
        return str(ws.Name)
    except Exception:
        return ""


def refresh_excel_session_snapshots(session, wb):
    snapshots = session.setdefault("snapshots", {})
    for name in _excel_collection_names(wb.Worksheets):
        try:
            ws = wb.Worksheets(name)
            snapshots[ws.Name] = _sheet_snapshot(ws)
        except Exception:
            continue


def _poll_excel_session_changes_impl(excel_id):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        if session.get("liveEditable") and LIVE_FRAME_MODE:
            # active-sync: 사용자가 실제로 클릭해 '포그라운드'인 미러 프레임만 따라간다.
            # ActiveWorkbook 기반 판정은 프로그램적 전환(show-only)과 경합해
            # 방금 누른 탭이 이전 탭으로 되돌아가는 바운스를 만들었다.
            fg_sid, fg_session, fg_wb = _foreground_session_by_frame()
            if fg_sid and fg_sid != excel_id and fg_wb is not None:
                session = fg_session
                wb = fg_wb
                excel_id = fg_sid
        else:
            active_excel_id, active_session, active_wb = _active_session_for_app(app, fallback_session=session, fallback_wb=wb)
            if active_session is not None and active_wb is not None:
                session = active_session
                wb = active_wb
                excel_id = active_excel_id or excel_id
        if session.get("readOnlyMirror"):
            if _left_mouse_button_down():
                return {
                    "ok": True,
                    "excelId": excel_id,
                    "activeExcelId": excel_id,
                    "sheet": session.get("lastSelectionSheet") or "",
                    "address": session.get("lastSelectionAddress") or "",
                    "changes": [],
                    "readOnlyMirror": True,
                    "mouseActive": True,
                }
            ws = wb.Application.ActiveSheet
            if ws is None:
                names = _excel_collection_names(wb.Worksheets)
                if not names:
                    raise RuntimeError("no visible worksheet")
                ws = wb.Worksheets(names[0])
                ws.Activate()
            active_address = ""
            try:
                active_address = _excel_address(app.Selection).replace("$", "")
            except Exception:
                try:
                    active_address = _excel_address(app.ActiveCell).replace("$", "")
                except Exception:
                    pass
            session["lastSelectionSheet"] = ws.Name
            session["lastSelectionAddress"] = active_address
            return {
                "ok": True,
                "excelId": excel_id,
                "activeExcelId": excel_id,
                "sheet": ws.Name,
                "address": active_address,
                "changes": [],
                "readOnlyMirror": True,
            }
        frame_mode = bool(session.get("liveEditable")) and LIVE_FRAME_MODE
        if session.get("liveEditable"):
            # 라이브 미러: 실제 Excel 창이 곧 화면이므로 셀 단위 변경 감지(풀스냅샷 diff)가 필요 없다.
            # 시트가 UserInterfaceOnly 보호라 직접 편집도 불가하고, changes 의 유일한 소비처는
            # 읽기전용 미러 경고 문구였다. 특히 거대 파일(수십만 행)에서는 이 스냅샷이 폴마다
            # 수 초씩 걸려 COM 큐를 도배 → 탭 전환 지연과 stale 응답에 의한 '탭 회귀'의 주범.
            sheet_name = _active_sheet_name(wb, prefer_workbook=frame_mode)
            active_address = ""
            try:
                if frame_mode:
                    # 활성화 없이도 이 세션 창의 선택 범위를 읽는다(app.Selection 은 다른 워크북일 수 있음).
                    active_address = _excel_address(wb.Windows(1).RangeSelection).replace("$", "")
                else:
                    active_address = _excel_address(app.Selection).replace("$", "")
            except Exception:
                try:
                    active_address = _excel_address(app.Selection).replace("$", "")
                except Exception:
                    pass
            session["lastSelectionSheet"] = sheet_name
            session["lastSelectionAddress"] = active_address
            return {
                "ok": True,
                "excelId": excel_id,
                "activeExcelId": excel_id,
                "sheet": sheet_name,
                "address": active_address,
                "changes": [],
                "liveSelectionOnly": True,
            }
        sheet_name, snapshot = _active_sheet_snapshot(wb)
        snapshots = session.setdefault("snapshots", {})
        previous = snapshots.get(sheet_name)
        snapshots[sheet_name] = snapshot
        active_address = ""
        try:
            active_address = _excel_address(app.Selection).replace("$", "")
        except Exception:
            pass
        if previous is None:
            return {
                "ok": True,
                "excelId": excel_id,
                "activeExcelId": excel_id,
                "sheet": sheet_name,
                "address": active_address,
                "changes": [],
                "baseline": True,
            }
        changes = []
        addresses = set(previous.keys()) | set(snapshot.keys())
        for address in sorted(addresses, key=lambda a: (snapshot.get(a) or previous.get(a) or {}).get("row", 0)):
            before = previous.get(address)
            after = snapshot.get(address)
            before_key = before.get("key") if before else ""
            after_key = after.get("key") if after else ""
            if before_key == after_key:
                continue
            current = after or {"address": address, "row": before.get("row"), "col": before.get("col"), "value": "", "formula": ""}
            changes.append({
                "sheet": sheet_name,
                "address": address,
                "r": int(current.get("row") or 1) - 1,
                "c": int(current.get("col") or 1) - 1,
                "value": current.get("value", ""),
                "formula": current.get("formula", ""),
            })
            if len(changes) >= 200:
                break
        return {
            "ok": True,
            "excelId": excel_id,
            "activeExcelId": excel_id,
            "sheet": sheet_name,
            "address": active_address,
            "changes": changes,
            "truncated": len(changes) >= 200,
        }


def _range_formula_info(rng):
    if rng is None:
        return None
    try:
        cell = rng.Cells(1, 1)
    except Exception:
        cell = rng
    try:
        formula = _com_scalar(cell.Formula)
    except Exception:
        formula = ""
    try:
        value = _com_scalar(cell.Value)
    except Exception:
        value = ""
    try:
        address = _excel_address(cell).replace("$", "")
    except Exception:
        address = ""
    try:
        sheet = cell.Worksheet.Name
    except Exception:
        sheet = ""
    has_formula = isinstance(formula, str) and formula.startswith("=")
    return {
        "sheet": sheet,
        "address": address,
        "formula": formula if has_formula else "",
        "value": value,
        "hasFormula": has_formula,
    }


def _excel_range_from_cursor(app):
    if win32gui is None:
        return None
    try:
        x, y = win32gui.GetCursorPos()
    except Exception:
        return None
    try:
        return app.ActiveWindow.RangeFromPoint(int(x), int(y))
    except Exception:
        return None


def _get_excel_hover_info_impl(excel_id):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        info = _range_formula_info(_excel_range_from_cursor(app))
        if info is None:
            try:
                info = _range_formula_info(app.Selection)
            except Exception:
                info = None
        info = info or {"sheet": "", "address": "", "formula": "", "value": "", "hasFormula": False}
        try:
            app.StatusBar = (
                f"{info.get('sheet')}!{info.get('address')}  {info.get('formula')}"
                if info.get("hasFormula") else False
            )
        except Exception:
            pass
        return {"ok": True, "excelId": excel_id, **info}


def poll_excel_session_changes(excel_id):
    return excel_call(_poll_excel_session_changes_impl, excel_id, timeout=60)


def get_excel_hover_info(excel_id):
    return excel_call(_get_excel_hover_info_impl, excel_id, timeout=60)


def open_excel_session(
    path,
    name=None,
    workbook_id=None,
    result_id=None,
    read_only_mirror=False,
    left=None,
    top=None,
    width=None,
    height=None,
    client_left=None,
    client_top=None,
    client_width=None,
    client_height=None,
    viewport_width=None,
    viewport_height=None,
    browser_title=None,
    native_parent_hwnd=None,
    native_host_hwnd=None,
    native_overlay=False,
    live_editable=False,
    defer_visible=False,
):
    return excel_call(
        _open_excel_session_impl,
        path,
        name=name,
        workbook_id=workbook_id,
        result_id=result_id,
        read_only_mirror=read_only_mirror,
        left=left,
        top=top,
        width=width,
        height=height,
        client_left=client_left,
        client_top=client_top,
        client_width=client_width,
        client_height=client_height,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
        browser_title=browser_title,
        native_parent_hwnd=native_parent_hwnd,
        native_host_hwnd=native_host_hwnd,
        native_overlay=native_overlay,
        live_editable=live_editable,
        defer_visible=defer_visible,
        timeout=180,  # 느린 PC/대용량 파일에서 Excel 열기가 길어질 수 있음
    )


def activate_excel_session(excel_id, sheet=None, address=None):
    return excel_call(_activate_excel_session_impl, excel_id, sheet=sheet, address=address)


def save_excel_session(excel_id, name=None):
    return excel_call(_save_excel_session_impl, excel_id, name=name)


def close_excel_session(excel_id):
    return excel_call(_close_excel_session_impl, excel_id)


def replace_excel_session_workbook(excel_id, path, name=None, result_id=None, read_only_mirror=None):
    return excel_call(_replace_excel_session_workbook_impl, excel_id, path, name=name, result_id=result_id, read_only_mirror=read_only_mirror)


def position_excel_session(
    excel_id,
    left,
    top,
    width,
    height,
    client_left=None,
    client_top=None,
    client_width=None,
    client_height=None,
    viewport_width=None,
    viewport_height=None,
    browser_title=None,
    native_parent_hwnd=None,
    native_host_hwnd=None,
    native_overlay=False,
    keep_zorder=False,
):
    return excel_call(
        _position_excel_session_impl,
        excel_id,
        left,
        top,
        width,
        height,
        client_left=client_left,
        client_top=client_top,
        client_width=client_width,
        client_height=client_height,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
        browser_title=browser_title,
        native_parent_hwnd=native_parent_hwnd,
        native_host_hwnd=native_host_hwnd,
        native_overlay=native_overlay,
        keep_zorder=keep_zorder,
        timeout=60,
    )


def raise_excel_session(excel_id):
    return excel_call(_raise_excel_session_impl, excel_id, timeout=60)


def show_only_excel_session(
    excel_id,
    left,
    top,
    width,
    height,
    client_left=None,
    client_top=None,
    client_width=None,
    client_height=None,
    viewport_width=None,
    viewport_height=None,
    browser_title=None,
    native_parent_hwnd=None,
    native_host_hwnd=None,
    native_overlay=False,
    skip_position=False,
):
    return excel_call(
        _show_only_excel_session_impl,
        excel_id,
        left,
        top,
        width,
        height,
        client_left=client_left,
        client_top=client_top,
        client_width=client_width,
        client_height=client_height,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
        browser_title=browser_title,
        native_parent_hwnd=native_parent_hwnd,
        native_host_hwnd=native_host_hwnd,
        native_overlay=native_overlay,
        skip_position=skip_position,
        timeout=60,
    )


def recover_excel_session(
    excel_id,
    left,
    top,
    width,
    height,
    client_left=None,
    client_top=None,
    client_width=None,
    client_height=None,
    viewport_width=None,
    viewport_height=None,
    browser_title=None,
    native_parent_hwnd=None,
    native_host_hwnd=None,
    native_overlay=False,
):
    return excel_call(
        _recover_excel_session_impl,
        excel_id,
        left,
        top,
        width,
        height,
        client_left=client_left,
        client_top=client_top,
        client_width=client_width,
        client_height=client_height,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
        browser_title=browser_title,
        native_parent_hwnd=native_parent_hwnd,
        native_host_hwnd=native_host_hwnd,
        native_overlay=native_overlay,
        timeout=90,
    )


def hide_excel_session(excel_id):
    return excel_call(_hide_excel_session_impl, excel_id, timeout=60)


def hide_all_excel_sessions():
    return excel_call(_hide_all_excel_sessions_impl, timeout=60)


def hide_inactive_excel_sessions():
    return excel_call(_hide_inactive_excel_sessions_impl, timeout=60)


def is_python_pipeline_step(step):
    if not step or step.get("enabled") is False:
        return False
    code = normalize_python_pipeline_code(str(step.get("code") or ""))
    language = str(step.get("language") or "").lower()
    return (
        language in ("python", "py")
        or re.search(r"^\s*def\s+transform\s*\(\s*ctx\s*\)\s*:", code, re.M) is not None
    )


def normalize_python_pipeline_code(code):
    text = str(code or "").replace("\ufeff", "")
    fence = re.search(r"```(?:python|py)?\s*\n([\s\S]*?)```", text, re.I)
    if fence:
        text = fence.group(1)
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    normalized = []
    seen_python = False
    for line in lines:
        stripped = line.strip()
        if not seen_python:
            if not stripped:
                continue
            if stripped.startswith("```"):
                continue
            if stripped.startswith("//"):
                continue
            if re.match(r"^(제목|설명|설명문|title|description)\s*[:：]", stripped, re.I):
                continue
        if re.match(r"^(def|import|from|class|@)\b", stripped):
            seen_python = True
        if stripped.startswith("//"):
            line = line[:len(line) - len(line.lstrip())] + "#" + stripped[2:]
        normalized.append(line)
    text = "\n".join(normalized).strip()
    # LLMs often write workbook.sheets["SheetName"] by analogy with dict-like
    # workbook objects. Our proxies expose .sheet(name) / .sheets(name). Normalize
    # the subscript form so otherwise valid generated skills do not fail at runtime.
    text = re.sub(r"(\b[\w\.]+\s*)\.sheets\s*\[\s*([^\]\n]+?)\s*\]", r"\1.sheet(\2)", text)
    return text + "\n"


def pipeline_has_python(payload):
    active_steps = [step for step in (payload.get("pipeline") or []) if not (step and step.get("enabled") is False)]
    if any(is_python_pipeline_step(step) for step in active_steps):
        return True
    current = payload.get("current") or {}
    return bool(current.get("outputExcelId")) and not active_steps


def _excel_names(collection):
    return _excel_collection_names(collection)


_EXCEL_NO_CELL_VALUE = object()


class ExcelCellProxy:
    def __init__(self, cell):
        object.__setattr__(self, "_cell", cell)

    def __getattr__(self, name):
        return getattr(object.__getattribute__(self, "_cell"), name)

    @property
    def value(self):
        return self._cell.Value

    @value.setter
    def value(self, v):
        self._cell.Value = v


class ExcelWorksheetProxy:
    """COM Worksheet wrapper with small openpyxl-style aliases for fallback runs."""
    def __init__(self, worksheet):
        object.__setattr__(self, "_worksheet", worksheet)

    def __getattr__(self, name):
        return getattr(object.__getattribute__(self, "_worksheet"), name)

    def __setattr__(self, key, value):
        if key == "_worksheet":
            object.__setattr__(self, key, value)
        elif key == "Name":
            self._worksheet.Name = value
        else:
            setattr(self._worksheet, key, value)

    @property
    def raw(self):
        return self._worksheet

    @property
    def Name(self):
        return self._worksheet.Name

    @property
    def Parent(self):
        return self._worksheet.Parent

    @property
    def max_row(self):
        try:
            return int(self._worksheet.UsedRange.Row) + int(self._worksheet.UsedRange.Rows.Count) - 1
        except Exception:
            return 1

    @property
    def max_column(self):
        try:
            return int(self._worksheet.UsedRange.Column) + int(self._worksheet.UsedRange.Columns.Count) - 1
        except Exception:
            return 1

    def cell(self, row=None, column=None, value=_EXCEL_NO_CELL_VALUE):
        c = self._worksheet.Cells(int(row), int(column))
        if value is not _EXCEL_NO_CELL_VALUE:
            c.Value = value
        return ExcelCellProxy(c)

    def insert_cols(self, idx, amount=1):
        idx = int(idx)
        amount = max(1, int(amount or 1))
        rng = self._worksheet.Range(self._worksheet.Columns(idx), self._worksheet.Columns(idx + amount - 1))
        rng.Insert(Shift=-4161)  # xlShiftToRight

    def insert_rows(self, idx, amount=1):
        idx = int(idx)
        amount = max(1, int(amount or 1))
        rng = self._worksheet.Range(self._worksheet.Rows(idx), self._worksheet.Rows(idx + amount - 1))
        rng.Insert(Shift=-4121)  # xlShiftDown

    def delete_cols(self, idx, amount=1):
        idx = int(idx)
        amount = max(1, int(amount or 1))
        rng = self._worksheet.Range(self._worksheet.Columns(idx), self._worksheet.Columns(idx + amount - 1))
        rng.Delete()

    def delete_rows(self, idx, amount=1):
        idx = int(idx)
        amount = max(1, int(amount or 1))
        rng = self._worksheet.Range(self._worksheet.Rows(idx), self._worksheet.Rows(idx + amount - 1))
        rng.Delete()

    def append(self, values):
        row = self.max_row + 1
        values = list(values or [])
        if not values:
            return
        rng = self._worksheet.Range(
            self._worksheet.Cells(row, 1),
            self._worksheet.Cells(row, len(values)),
        )
        rng.Value = [values]

    def clear(self):
        self._worksheet.Cells.Clear()
        return self


class ExcelWorksheetsProxy:
    def __init__(self, ctx, workbook, collection):
        self._ctx = ctx
        self._workbook = workbook
        self._collection = collection

    def __call__(self, key):
        if isinstance(key, str):
            sheet_name = self._ctx._find_sheet_name(self._workbook, key, allow_single=False)
            if sheet_name:
                return self._ctx.sheet(sheet_name, workbook=self._workbook)
        return self._collection(key)

    def Item(self, key):
        return self.__call__(key)

    def __getitem__(self, key):
        return self.__call__(key)

    def __iter__(self):
        for idx in range(1, self._collection.Count + 1):
            yield self._collection.Item(idx)

    def __len__(self):
        return int(self._collection.Count)

    @property
    def names(self):
        return _excel_collection_names(self._collection)

    def add(self, name=None):
        ws = self._collection.Add()
        if name:
            ws.Name = str(name)
        return ExcelWorksheetProxy(ws)

    def __getattr__(self, name):
        return getattr(self._collection, name)


class ExcelWorkbookProxy:
    def __init__(self, ctx, workbook, name=None):
        self._ctx = ctx
        self._workbook = workbook
        self.name = name or ""

    @property
    def raw(self):
        return self._workbook

    @property
    def Worksheets(self):
        return ExcelWorksheetsProxy(self._ctx, self._workbook, self._workbook.Worksheets)

    def __getattr__(self, name):
        return getattr(self._workbook, name)

    def sheet(self, name=None):
        return self._ctx.sheet(name, workbook=self)

    @property
    def sheets(self):
        return self.Worksheets

    def sheet_like(self, name=None):
        return self._ctx.sheet_like(name, workbook=self)

    def range(self, sheet_or_name, address):
        return self._ctx.range(sheet_or_name, address, workbook=self)

    def rows(self, sheet_or_name=None):
        return self._ctx.rows(sheet_or_name, workbook=self)

    def iter_rows(self, sheet_or_name=None, start_row=1):
        return self._ctx.iter_rows(sheet_or_name, workbook=self, start_row=start_row)

    def rows_with_index(self, sheet_or_name=None, start_row=1):
        return self._ctx.iter_rows(sheet_or_name, workbook=self, start_row=start_row)

    def display_rows(self, sheet_or_name=None):
        return self._ctx.display_rows(sheet_or_name, workbook=self)

    def value(self, sheet_or_name, row, col):
        return self._ctx.value(sheet_or_name, row, col, workbook=self)

    def display_value(self, sheet_or_name, row, col):
        return self._ctx.display_value(sheet_or_name, row, col, workbook=self)

    def col(self, sheet_or_name, header, header_rows=20):
        return self._ctx.col(sheet_or_name, header, workbook=self, header_rows=header_rows)

    def header_row(self, sheet_or_name=None, header_rows=20):
        return self._ctx.header_row(sheet_or_name, workbook=self, header_rows=header_rows)


class ExcelSkillContext:
    def __init__(self, app, output_wb, input_wbs, output_name=None, active_file_id=None, active_sheet=None):
        self.excel = app
        self._workbook = output_wb
        self.output_name = output_name or "output"
        self.workbook = ExcelWorkbookProxy(self, output_wb, self.output_name)
        self.output = self.workbook
        self.last_output_sheet = None
        self.last_output_address = None
        self.inputs = {
            name: ExcelWorkbookProxy(self, wb, name)
            for name, wb in (input_wbs or {}).items()
        }
        self.active_file_id = str(active_file_id or "")
        self.active_sheet_name = str(active_sheet or "")
        self.active_workbook = self._workbook_for_file_id(self.active_file_id) or self.workbook

    def _unwrap_workbook(self, wb):
        return wb.raw if isinstance(wb, ExcelWorkbookProxy) else wb

    def _workbook_for_file_id(self, file_id):
        file_id = str(file_id or "")
        if not file_id:
            return None
        if file_id == "output" or file_id.startswith("output:"):
            return self.workbook
        if file_id.startswith("input:"):
            hint = file_id[6:]
            try:
                return self.workbook_like(hint)
            except Exception:
                return self.inputs.get(hint)
        return None

    def _default_workbook(self):
        return self.active_workbook or self.workbook

    def _is_output_workbook(self, wb):
        wb = self._unwrap_workbook(wb)
        try:
            return str(Path(wb.FullName).resolve()).lower() == str(Path(self._workbook.FullName).resolve()).lower()
        except Exception:
            return wb is self._workbook

    def normalize(self, value):
        return normalize_text(value)

    def workbook_like(self, hint=None):
        if not hint:
            return self.workbook
        norm = self.normalize(hint)
        candidates = [(name, wb) for name, wb in self.inputs.items()]
        candidates.append((self.output_name, self.workbook))
        candidates.append(("output", self.workbook))
        for name, wb in candidates:
            if self.normalize(name) == norm:
                return wb
        for name, wb in candidates:
            if norm in self.normalize(name) or self.normalize(name) in norm:
                return wb
        for _, wb in candidates:
            if self._find_sheet_name(wb, hint, allow_single=False):
                return wb
        if len(self.inputs) == 1:
            return next(iter(self.inputs.values()))
        raise RuntimeError(f"workbook not found: {hint}")

    def input(self, hint=None):
        if hint is None:
            if len(self.inputs) == 1:
                return next(iter(self.inputs.values()))
            raise RuntimeError("input workbook hint is required when multiple input files exist")
        return self.workbook_like(hint)

    def _find_sheet_name(self, wb, name=None, allow_single=True):
        wb = self._unwrap_workbook(wb)
        names = _excel_names(wb.Worksheets)
        if not names:
            return None
        if not name:
            try:
                return wb.ActiveSheet.Name
            except Exception:
                return names[0]
        norm = self.normalize(name)
        sheet_norm_loose = normalize_sheet_lookup(name)
        for sheet_name in names:
            if self.normalize(sheet_name) == norm:
                return sheet_name
        for sheet_name in names:
            sheet_norm = self.normalize(sheet_name)
            if norm in sheet_norm or sheet_norm in norm:
                return sheet_name
        for sheet_name in names:
            candidate = normalize_sheet_lookup(sheet_name)
            if sheet_norm_loose and (candidate == sheet_norm_loose or sheet_norm_loose in candidate or candidate in sheet_norm_loose):
                return sheet_name
        if allow_single and len(names) == 1:
            return names[0]
        return None

    def sheet(self, name=None, workbook=None):
        default_wb = workbook or self._default_workbook()
        wb = self._unwrap_workbook(default_wb)
        lookup_name = self.active_sheet_name if (name is None and workbook is None and self.active_sheet_name) else name
        sheet_name = self._find_sheet_name(wb, lookup_name)
        if not sheet_name and workbook is None:
            matches = []
            candidates = [self.workbook] + list(self.inputs.values())
            seen = set()
            for candidate in candidates:
                raw_candidate = self._unwrap_workbook(candidate)
                try:
                    key = str(Path(raw_candidate.FullName).resolve()).lower()
                except Exception:
                    key = str(id(raw_candidate))
                if key in seen:
                    continue
                seen.add(key)
                input_sheet = self._find_sheet_name(raw_candidate, lookup_name, allow_single=False)
                if input_sheet:
                    matches.append((raw_candidate, input_sheet))
            if len(matches) == 1:
                wb, sheet_name = matches[0]
        if not sheet_name and workbook is None and lookup_name != name:
            sheet_name = self._find_sheet_name(wb, name)
        if not sheet_name and workbook is None:
            matches = []
            for input_wb in self.inputs.values():
                raw_input = self._unwrap_workbook(input_wb)
                input_sheet = self._find_sheet_name(raw_input, name, allow_single=False)
                if input_sheet:
                    matches.append((raw_input, input_sheet))
            if len(matches) == 1:
                wb, sheet_name = matches[0]
        if not sheet_name:
            raise RuntimeError(f"sheet not found: {name}")
        ws = ExcelWorksheetProxy(wb.Worksheets(sheet_name))
        if self._is_output_workbook(wb):
            self.last_output_sheet = ws.Name
        return ws

    def sheet_like(self, name=None, workbook=None):
        return self.sheet(name, workbook)

    def input_sheet(self, sheet_hint=None, file_hint=None):
        workbooks = []
        if file_hint:
            workbooks.append(self.workbook_like(file_hint))
        else:
            workbooks.extend(self.inputs.values())
        for wb in workbooks:
            sheet_name = self._find_sheet_name(wb, sheet_hint, allow_single=True)
            if sheet_name:
                return wb.Worksheets(sheet_name)
        raise RuntimeError(f"input sheet not found: {sheet_hint}")

    def range(self, sheet_or_name, address, workbook=None):
        ws = sheet_or_name if hasattr(sheet_or_name, "Range") else self.sheet(sheet_or_name, workbook)
        try:
            if self._is_output_workbook(ws.Parent):
                self.last_output_sheet = ws.Name
                self.last_output_address = str(address)
        except Exception:
            pass
        return ws.Range(str(address))

    def rows(self, sheet_or_name, workbook=None):
        ws = sheet_or_name if hasattr(sheet_or_name, "UsedRange") else self.sheet(sheet_or_name, workbook)
        values = ws.UsedRange.Value
        if values is None:
            return []
        if not isinstance(values, tuple):
            return [[values]]
        if values and not isinstance(values[0], tuple):
            return [list(values)]
        return [list(row) for row in values]

    def iter_rows(self, sheet_or_name, workbook=None, start_row=1):
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        try:
            base_row = int(ws.UsedRange.Row)
        except Exception:
            base_row = 1
        min_row = max(int(start_row or base_row), base_row)
        for offset, row in enumerate(rows):
            excel_row = base_row + offset
            if excel_row >= min_row:
                yield excel_row, row

    def rows_with_index(self, sheet_or_name, workbook=None, start_row=1):
        return self.iter_rows(sheet_or_name, workbook=workbook, start_row=start_row)

    def value(self, sheet_or_name, row, col, workbook=None):
        ws = self._ws_of(sheet_or_name, workbook)
        return ws.Cells(int(row), int(col)).Value

    def display_value(self, sheet_or_name, row, col, workbook=None):
        return self.value(sheet_or_name, row, col, workbook=workbook)

    def display_rows(self, sheet_or_name, workbook=None):
        return self.rows(sheet_or_name, workbook=workbook)

    def col(self, sheet_or_name, header, workbook=None, header_rows=20):
        rows = self.rows(sheet_or_name, workbook)
        target = self.normalize(header)
        for r_idx, row in enumerate(rows[:header_rows], start=1):
            for c_idx, value in enumerate(row, start=1):
                if self.normalize(value) == target:
                    return ExcelColumnNumber(c_idx)
        for r_idx, row in enumerate(rows[:header_rows], start=1):
            for c_idx, value in enumerate(row, start=1):
                if target and target in self.normalize(value):
                    return ExcelColumnNumber(c_idx)
        raise RuntimeError(f"column not found: {header}")

    def header_row(self, sheet_or_name, workbook=None, header_rows=20):
        rows = self.rows(sheet_or_name, workbook)
        best_idx = 1
        best_score = -1
        for idx, row in enumerate(rows[:header_rows], start=1):
            score = sum(1 for value in row if value not in (None, ""))
            if score > best_score:
                best_idx, best_score = idx, score
        return best_idx

    def data_start_row(self, sheet_or_name, workbook=None, header_rows=20):
        return self.header_row(sheet_or_name, workbook, header_rows) + 1

    # ---- 정렬 / 필터 / 피벗 헬퍼 (자주 쓰는 작업을 안정적으로) ----
    def _ws_of(self, sheet_or_name, workbook=None):
        return sheet_or_name if hasattr(sheet_or_name, "UsedRange") else self.sheet(sheet_or_name, workbook)

    def _col0(self, rows, name_or_idx, header_rows=20):
        # 행 리스트 기준 0-based 열 인덱스. 정수는 1-based 로 간주.
        if isinstance(name_or_idx, (int, ExcelColumnNumber)):
            return max(0, int(name_or_idx) - 1)
        target = self.normalize(name_or_idx)
        scan = rows[:header_rows] if header_rows else rows
        for row in scan:
            for i, v in enumerate(row or []):
                if self.normalize(v) == target:
                    return i
        for row in scan:
            for i, v in enumerate(row or []):
                if target and target in self.normalize(v):
                    return i
        return None

    def add_sheet(self, name, workbook=None):
        wb = self._unwrap_workbook(workbook or self._default_workbook())
        base = re.sub(r"[\[\]:*?/\\]", "_", str(name) or "Sheet")[:31] or "Sheet"
        existing = {self.normalize(n) for n in _excel_names(wb.Worksheets)}
        final = base
        idx = 1
        while self.normalize(final) in existing:
            idx += 1
            suffix = "_" + str(idx)
            final = (base[: max(1, 31 - len(suffix))] + suffix)
        ws = wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count))
        ws.Name = final
        if self._is_output_workbook(wb):
            self.last_output_sheet = ws.Name
        return ws

    def _write_grid(self, ws, grid, start_row=1, start_col=1):
        if not grid:
            return ws
        ncol = max((len(r or []) for r in grid), default=0)
        if ncol <= 0:
            return ws
        norm = [list(r or []) + [None] * (ncol - len(r or [])) for r in grid]
        rng = ws.Range(ws.Cells(start_row, start_col), ws.Cells(start_row + len(norm) - 1, start_col + ncol - 1))
        rng.Value = norm
        return ws

    # ---- 벌크 입출력(성능): 범위 전체를 한 번에 읽고/쓴다(COM 호출 최소화). ----
    def write_grid(self, ws, grid, start_row=1, start_col=1):
        """2D 리스트(grid)를 start_row/start_col 부터 한 번의 COM 호출로 쓴다."""
        ws = self._ws_of(ws)
        self._write_grid(ws, grid, start_row, start_col)
        if self._is_output_workbook(ws.Parent):
            self.last_output_sheet = ws.Name
        return ws

    def set_range(self, sheet_or_name, address, grid, workbook=None):
        """주소(예 'A2' 또는 'A2:F100')의 좌상단부터 2D 리스트를 한 번에 쓴다(1회 COM 호출)."""
        ws = self._ws_of(sheet_or_name, workbook)
        if not grid:
            return ws
        ncol = max((len(r or []) for r in grid), default=0)
        if ncol <= 0:
            return ws
        norm = [list(r or []) + [None] * (ncol - len(r or [])) for r in grid]
        anchor = ws.Range(str(address)).Cells(1, 1)
        r0, c0 = int(anchor.Row), int(anchor.Column)
        rng = ws.Range(ws.Cells(r0, c0), ws.Cells(r0 + len(norm) - 1, c0 + ncol - 1))
        rng.Value = norm
        if self._is_output_workbook(ws.Parent):
            self.last_output_sheet = ws.Name
            self.last_output_address = str(address)
        return ws

    @staticmethod
    def _num(v):
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            s = v.strip().replace(",", "")
            try:
                return float(s)
            except ValueError:
                return None
        return None

    def sort(self, sheet_or_name, by, ascending=True, header=True, workbook=None):
        # COM Range.Sort 가 일부 중간시트에서 헤더를 데이터처럼 섞는 경우가 있어,
        # openpyxl 경로와 동일하게 값 행을 Python 에서 정렬한 뒤 한 번에 다시 쓴다.
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        keys = list(by) if isinstance(by, (list, tuple)) else [by]
        rels = []
        for k in keys:
            rel = self._col0(rows, k)
            if rel is None:
                raise RuntimeError("sort: column not found: %r" % (k,))
            rels.append(rel)
        asc_list = list(ascending) if isinstance(ascending, (list, tuple)) else [ascending] * len(keys)
        while len(asc_list) < len(keys):
            asc_list.append(asc_list[-1] if asc_list else True)
        hdr_count = 1 if header else 0
        head = rows[:hdr_count]
        body = rows[hdr_count:]

        def _cellkey(r, rel):
            v = r[rel] if rel < len(r) else None
            num = self._num(v)
            return (0, num) if num is not None else (1, self.normalize(v))

        if len(set(bool(a) for a in asc_list)) <= 1:
            rev = not bool(asc_list[0]) if asc_list else False
            body.sort(key=lambda r: tuple(_cellkey(r, rel) for rel in rels), reverse=rev)
        else:
            for i in range(len(rels) - 1, -1, -1):
                body.sort(key=lambda r, rel=rels[i]: _cellkey(r, rel), reverse=not bool(asc_list[i]))

        max_col = max((len(r) for r in rows), default=0)
        grid = list(head) + body
        padded = [list(r) + [None] * (max_col - len(r)) for r in grid]
        try:
            used = ws.UsedRange
            start_row = int(used.Row)
            start_col = int(used.Column)
        except Exception:
            start_row, start_col = 1, 1
        self._write_grid(ws, padded, start_row=start_row, start_col=start_col)
        if self._is_output_workbook(ws.Parent):
            self.last_output_sheet = ws.Name
        return ws

    def filter_to_sheet(self, sheet_or_name, predicate, dest_name, header_rows=1, workbook=None):
        # AutoFilter 대신 헤더 + 조건에 맞는 행을 새 시트로 복사(읽기전용 미러에서 안정적).
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        hr = max(0, int(header_rows or 0))
        header = rows[:hr]
        matched = []
        body = rows[hr:]
        total = len(body)
        report = getattr(self, "_progress", None)
        report = report if (total > 20000 and callable(report)) else None
        for k, r in enumerate(body):
            try:
                if predicate(r):
                    matched.append(r)
            except Exception:
                continue
            if report is not None and (k % 20000 == 0):
                try: report("거르는 중", k, total)
                except Exception: pass
        dest_wb = workbook
        if dest_wb is None:
            try:
                dest_wb = ws.Parent
            except Exception:
                dest_wb = self._default_workbook()
        dest = self.add_sheet(dest_name, workbook=dest_wb)
        self._write_grid(dest, list(header) + matched)
        return dest

    def _merge_pivot_grid_into_base(self, workbook, dest_name, grid):
        name = str(dest_name or "")
        if not name or name.endswith("_피벗") or "_" not in name or not grid or len(grid[0]) < 2:
            return
        prefix = name.rsplit("_", 1)[0]
        base_names = [prefix + "_피벗", prefix + "_pivot"]
        base_ws = None
        for base_name in base_names:
            try:
                base_ws = self.sheet(base_name, workbook=workbook)
                break
            except Exception:
                base_ws = None
        if base_ws is None:
            return
        try:
            base_sheet_name = base_ws.Name
        except Exception:
            base_sheet_name = ""
        if self.normalize(base_sheet_name) == self.normalize(name):
            return
        base_rows = self.rows(base_ws)
        if not base_rows:
            return
        base_header = list(base_rows[0] or [])
        src_header = list(grid[0] or [])
        add_cols = []
        for src_idx, label in enumerate(src_header[1:], start=1):
            if not any(self.normalize(label) == self.normalize(h) for h in base_header):
                add_cols.append((src_idx, label))
        if not add_cols:
            return
        out = [base_header + [label for _, label in add_cols]]
        key_to_values = {}
        for row in grid[1:]:
            if not row:
                continue
            key_to_values[self.normalize(row[0])] = row
        for row in base_rows[1:]:
            cur = list(row or [])
            key = self.normalize(cur[0] if cur else "")
            src = key_to_values.get(key)
            cur += [(src[i] if src is not None and i < len(src) else None) for i, _ in add_cols]
            out.append(cur)
        existing_keys = {self.normalize((row or [""])[0]) for row in base_rows[1:]}
        for row in grid[1:]:
            if not row or self.normalize(row[0]) in existing_keys:
                continue
            cur = [row[0]] + [None] * (len(base_header) - 1)
            cur += [(row[i] if i < len(row) else None) for i, _ in add_cols]
            out.append(cur)
        self._write_grid(base_ws, out)

    def pivot(self, sheet_or_name, group_by=None, value=None, agg="sum", dest_name=None, header_rows=1, workbook=None, **kwargs):
        # Python 집계로 그룹별 요약 표를 새 시트에 만든다(COM PivotTable 보다 안정적).
        if group_by is None:
            group_by = kwargs.get("rows")
        if value is None and "values" in kwargs:
            value = kwargs.get("values")
        if dest_name is None:
            dest_name = kwargs.get("name") or kwargs.get("dest")
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        hr = max(1, int(header_rows or 1))
        header_row = rows[hr - 1] if len(rows) >= hr else []
        data = rows[hr:]
        group_cols = list(group_by) if isinstance(group_by, (list, tuple)) else [group_by]
        gidx = [self._col0(rows, g, hr) for g in group_cols]
        values = list(value) if isinstance(value, (list, tuple)) else [value]
        aggs = list(agg) if isinstance(agg, (list, tuple)) else [agg] * len(values)
        while len(aggs) < len(values):
            aggs.append(aggs[-1] if aggs else "sum")
        aggs = [str(a or "sum").lower() for a in aggs]
        vidxs = [self._col0(rows, v, hr) if v is not None else None for v in values]

        groups = {}
        order = []
        for r in data:
            key = tuple((r[i] if (i is not None and i < len(r)) else "") for i in gidx)
            if key not in groups:
                groups[key] = [[] for _ in values]
                order.append(key)
            for pos, vidx in enumerate(vidxs):
                if vidx is None:
                    groups[key][pos].append(1)
                elif vidx < len(r):
                    groups[key][pos].append(r[vidx])

        def _aggregate(vals, agg_name):
            nums = [n for n in (self._num(v) for v in vals) if n is not None]
            if agg_name == "count":
                return len(vals)
            if agg_name in ("avg", "average", "mean"):
                return (sum(nums) / len(nums)) if nums else 0
            if agg_name == "max":
                return max(nums) if nums else ""
            if agg_name == "min":
                return min(nums) if nums else ""
            return sum(nums)

        out_header = []
        for n, i in enumerate(gidx):
            label = header_row[i] if (i is not None and i < len(header_row)) else ("그룹%d" % (n + 1))
            out_header.append(label)
        for v, agg_name in zip(values, aggs):
            label = str(v) if v is not None else "값"
            out_header.append(label + "_" + (agg_name if agg_name != "average" else "avg"))
        grid = [out_header]
        for key in order:
            grid.append(list(key) + [_aggregate(groups[key][i], aggs[i]) for i in range(len(values))])
        dest_wb = workbook
        if dest_wb is None:
            try:
                dest_wb = ws.Parent
            except Exception:
                dest_wb = self._default_workbook()
        dest = self.add_sheet(dest_name or "피벗요약", workbook=dest_wb)
        self._write_grid(dest, grid)
        self._merge_pivot_grid_into_base(dest_wb, dest.Name, grid)
        return dest


# 스킬에서 import 가능한 안전한 표준 라이브러리만 허용(os/sys/subprocess 등 위험 모듈은 차단).
_SKILL_ALLOWED_IMPORTS = {
    "re", "datetime", "math", "json", "collections", "itertools",
    "functools", "string", "decimal", "statistics", "calendar",
    "textwrap", "unicodedata", "fractions", "random", "operator", "copy",
    "difflib",
}


def _safe_skill_import(name, globals=None, locals=None, fromlist=(), level=0):
    import importlib
    if level and level != 0:
        raise ImportError("relative imports are not allowed in skills")
    root = str(name or "").split(".")[0]
    if root not in _SKILL_ALLOWED_IMPORTS:
        raise ImportError(
            "import of '%s' is not allowed in skills (allowed: %s)"
            % (name, ", ".join(sorted(_SKILL_ALLOWED_IMPORTS)))
        )
    return importlib.import_module(name)


def _safe_python_globals():
    allowed_builtins = {
        "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict, "enumerate": enumerate,
        "float": float, "int": int, "isinstance": isinstance, "len": len, "list": list,
        "max": max, "min": min, "print": print, "range": range, "round": round,
        "set": set, "sorted": sorted, "str": str, "sum": sum, "tuple": tuple,
        "type": type, "zip": zip, "getattr": getattr, "hasattr": hasattr, "iter": iter,
        "next": next, "repr": repr, "abs": abs, "divmod": divmod, "ord": ord, "chr": chr,
        "filter": filter, "map": map, "reversed": reversed, "format": format, "frozenset": frozenset,
        "__import__": _safe_skill_import,
        "Exception": Exception, "RuntimeError": RuntimeError, "ValueError": ValueError,
        "TypeError": TypeError, "KeyError": KeyError, "IndexError": IndexError,
        "AttributeError": AttributeError, "ZeroDivisionError": ZeroDivisionError,
        "StopIteration": StopIteration,
    }
    return {
        "__builtins__": allowed_builtins,
        "datetime": datetime,
        "math": math,
        "re": re,
    }


# =====================================================================
#  순수 Python(openpyxl) 스킬 엔진 — COM/Excel 없이 인프로세스로 실행(빠름).
#  COM 스킬과 동일한 ctx API + ws.Range/Cells/UsedRange/.Value 호환 shim을 제공해
#  기존 스킬 코드/프롬프트가 대부분 그대로 동작하게 한다.
#  주의: 수식 셀을 다시 읽으면 계산값이 아니라 수식 문자열이 나온다(openpyxl 한계).
#       값은 Python에서 계산해 셀에 직접 쓰는 것을 권장.
# =====================================================================
def _opxl_coord(token):
    from openpyxl.utils.cell import coordinate_to_tuple
    row, col = coordinate_to_tuple(str(token).replace("$", "").strip())
    return int(row), int(col)


_OPXL_NO_VALUE = object()


def _opxl_merged_anchor(ws, row, col):
    try:
        for merged in ws.merged_cells.ranges:
            if merged.min_row <= row <= merged.max_row and merged.min_col <= col <= merged.max_col:
                return int(merged.min_row), int(merged.min_col)
    except Exception:
        pass
    return int(row), int(col)


def _opxl_write_cell(ws, row, col, value, redirect_merged=False):
    ar, ac = _opxl_merged_anchor(ws, row, col)
    if (ar, ac) != (int(row), int(col)) and not redirect_merged:
        return False
    ws.cell(row=ar, column=ac, value=value)
    return True


_OPXL_CELL_REF_RE = re.compile(r"(?<![A-Za-z0-9_])(?:'([^']+)'!)?([A-Z]{1,3})([1-9][0-9]*)(?![A-Za-z0-9_])")


def _opxl_col_to_index(col):
    out = 0
    for ch in str(col or "").upper():
        if "A" <= ch <= "Z":
            out = out * 26 + (ord(ch) - 64)
    return out


def _opxl_get_cached_cell_value(cached_ws, row, col):
    if cached_ws is None:
        return None
    try:
        value = cached_ws.cell(row=int(row), column=int(col)).value
        if isinstance(value, str) and value.startswith("="):
            return None
        return value
    except Exception:
        return None


def _opxl_safe_eval_arithmetic(expr):
    allowed_binops = {
        ast.Add: lambda a, b: a + b,
        ast.Sub: lambda a, b: a - b,
        ast.Mult: lambda a, b: a * b,
        ast.Div: lambda a, b: a / b,
        ast.Pow: lambda a, b: a ** b,
        ast.Mod: lambda a, b: a % b,
    }
    allowed_unary = {
        ast.UAdd: lambda a: +a,
        ast.USub: lambda a: -a,
    }

    def _eval(node):
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float, str, bool)) or node.value is None:
                return node.value
            raise ValueError("unsupported constant")
        if isinstance(node, ast.BinOp) and type(node.op) in allowed_binops:
            return allowed_binops[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in allowed_unary:
            return allowed_unary[type(node.op)](_eval(node.operand))
        if isinstance(node, ast.Compare):
            left = _eval(node.left)
            for op, comparator in zip(node.ops, node.comparators):
                right = _eval(comparator)
                if isinstance(op, ast.Eq):
                    ok = left == right
                elif isinstance(op, ast.NotEq):
                    ok = left != right
                elif isinstance(op, ast.Lt):
                    ok = left < right
                elif isinstance(op, ast.LtE):
                    ok = left <= right
                elif isinstance(op, ast.Gt):
                    ok = left > right
                elif isinstance(op, ast.GtE):
                    ok = left >= right
                else:
                    raise ValueError("unsupported comparison")
                if not ok:
                    return False
                left = right
            return True
        raise ValueError("unsupported expression")

    return _eval(ast.parse(expr, mode="eval"))


def _opxl_split_top_level_args(text):
    args = []
    cur = []
    depth = 0
    in_quote = False
    quote_ch = ""
    for ch in str(text or ""):
        if in_quote:
            cur.append(ch)
            if ch == quote_ch:
                in_quote = False
            continue
        if ch in ("'", '"'):
            in_quote = True
            quote_ch = ch
            cur.append(ch)
            continue
        if ch == "(":
            depth += 1
            cur.append(ch)
            continue
        if ch == ")":
            depth = max(0, depth - 1)
            cur.append(ch)
            continue
        if ch == "," and depth == 0:
            args.append("".join(cur).strip())
            cur = []
            continue
        cur.append(ch)
    args.append("".join(cur).strip())
    return args


def _opxl_range_values(ws, token, cached_ws=None, seen=None):
    token = str(token or "").replace("$", "").strip()
    sheet_name = None
    if "!" in token:
        sheet_part, token = token.split("!", 1)
        sheet_name = sheet_part.strip("'")
    if ":" not in token:
        match = re.fullmatch(r"([A-Z]{1,3})([1-9][0-9]*)", token, re.I)
        if not match:
            return []
        col = _opxl_col_to_index(match.group(1))
        row = int(match.group(2))
        target_ws = ws.parent[sheet_name] if sheet_name else ws
        target_cached = cached_ws.parent[sheet_name] if (sheet_name and cached_ws is not None and sheet_name in cached_ws.parent.sheetnames) else cached_ws
        return [_opxl_display_cell_value(target_ws, row, col, target_cached, seen)]
    left, right = token.split(":", 1)
    m1 = re.fullmatch(r"([A-Z]{1,3})([1-9][0-9]*)", left, re.I)
    m2 = re.fullmatch(r"([A-Z]{1,3})([1-9][0-9]*)", right, re.I)
    if not m1 or not m2:
        return []
    r1, c1 = int(m1.group(2)), _opxl_col_to_index(m1.group(1))
    r2, c2 = int(m2.group(2)), _opxl_col_to_index(m2.group(1))
    target_ws = ws.parent[sheet_name] if sheet_name else ws
    target_cached = cached_ws.parent[sheet_name] if (sheet_name and cached_ws is not None and sheet_name in cached_ws.parent.sheetnames) else cached_ws
    values = []
    for row in range(min(r1, r2), max(r1, r2) + 1):
        for col in range(min(c1, c2), max(c1, c2) + 1):
            values.append(_opxl_display_cell_value(target_ws, row, col, target_cached, seen))
    return values


def _opxl_numeric_values(values):
    nums = []
    for value in values:
        if isinstance(value, bool) or value in (None, ""):
            continue
        if isinstance(value, (int, float)):
            nums.append(float(value))
            continue
        try:
            nums.append(float(str(value).replace(",", "")))
        except Exception:
            continue
    return nums


def _opxl_eval_formula(ws, formula, cached_ws=None, seen=None):
    expr = str(formula or "")
    if expr.startswith("="):
        expr = expr[1:]
    expr = expr.strip()
    if not expr:
        return None
    upper = expr.upper()
    for fn in ("SUM", "AVERAGE", "COUNTIF", "IFERROR"):
        prefix = fn + "("
        if upper.startswith(prefix) and expr.endswith(")"):
            args = _opxl_split_top_level_args(expr[len(prefix):-1])
            if fn == "SUM":
                values = []
                for arg in args:
                    values.extend(_opxl_range_values(ws, arg, cached_ws, seen) if ":" in arg or re.fullmatch(r"(?:'[^']+'!)?[A-Z]{1,3}[1-9][0-9]*", arg.replace("$", ""), re.I) else [_opxl_eval_formula(ws, "=" + arg, cached_ws, seen)])
                nums = _opxl_numeric_values(values)
                return sum(nums)
            if fn == "AVERAGE":
                values = []
                for arg in args:
                    values.extend(_opxl_range_values(ws, arg, cached_ws, seen) if ":" in arg or re.fullmatch(r"(?:'[^']+'!)?[A-Z]{1,3}[1-9][0-9]*", arg.replace("$", ""), re.I) else [_opxl_eval_formula(ws, "=" + arg, cached_ws, seen)])
                nums = _opxl_numeric_values(values)
                return (sum(nums) / len(nums)) if nums else 0
            if fn == "COUNTIF":
                if len(args) < 2:
                    raise ValueError("COUNTIF requires range and criterion")
                values = _opxl_range_values(ws, args[0], cached_ws, seen)
                criterion = _opxl_eval_formula(ws, "=" + args[1], cached_ws, seen)
                return sum(1 for value in values if value == criterion)
            if fn == "IFERROR":
                if len(args) < 2:
                    raise ValueError("IFERROR requires value and fallback")
                try:
                    return _opxl_eval_formula(ws, "=" + args[0], cached_ws, seen)
                except Exception:
                    return _opxl_eval_formula(ws, "=" + args[1], cached_ws, seen)

    def _replace_cell(match):
        sheet_name, col_text, row_text = match.groups()
        row = int(row_text)
        col = _opxl_col_to_index(col_text)
        target_ws = ws.parent[sheet_name] if sheet_name else ws
        target_cached = cached_ws.parent[sheet_name] if (sheet_name and cached_ws is not None and sheet_name in cached_ws.parent.sheetnames) else cached_ws
        value = _opxl_display_cell_value(target_ws, row, col, target_cached, seen)
        if value in (None, ""):
            value = 0
        return repr(value) if isinstance(value, str) else str(value)

    py_expr = _OPXL_CELL_REF_RE.sub(_replace_cell, expr.replace("$", ""))
    py_expr = py_expr.replace("^", "**")
    return _opxl_safe_eval_arithmetic(py_expr)


def _opxl_display_cell_value(ws, row, col, cached_ws=None, seen=None):
    row, col = int(row), int(col)
    seen = seen or set()
    key = (id(ws), row, col)
    if key in seen:
        raise RuntimeError(f"circular formula reference at {ws.title}!{row},{col}")
    value = ws.cell(row=row, column=col).value
    if not (isinstance(value, str) and value.startswith("=")):
        return value
    cached = _opxl_get_cached_cell_value(cached_ws, row, col)
    if cached is not None:
        return cached
    seen.add(key)
    try:
        return _opxl_eval_formula(ws, value, cached_ws, seen)
    except Exception as err:
        coord = f"{ws.title}!{ws.cell(row=row, column=col).coordinate}"
        raise RuntimeError(f"formula value unavailable for {coord}: {value} ({err})")
    finally:
        seen.discard(key)


class _OpxlCount:
    def __init__(self, count):
        self.Count = int(count)


class _OpxlRange:
    """openpyxl 워크시트 위의 직사각 범위(또는 단일 셀). COM Range.Value 시맨틱을 흉내낸다."""
    def __init__(self, ws, r1, c1, r2, c2):
        self._ws = ws
        self._r1, self._c1 = int(r1), int(c1)
        self._r2, self._c2 = int(r2), int(c2)

    @property
    def _single(self):
        return self._r1 == self._r2 and self._c1 == self._c2

    def _get_value(self):
        if self._single:
            return self._ws.cell(row=self._r1, column=self._c1).value
        out = []
        for r in range(self._r1, self._r2 + 1):
            out.append(tuple(self._ws.cell(row=r, column=c).value for c in range(self._c1, self._c2 + 1)))
        return tuple(out)

    def _set_value(self, value):
        if self._single and not isinstance(value, (list, tuple)):
            _opxl_write_cell(self._ws, self._r1, self._c1, value, redirect_merged=True)
            return
        if isinstance(value, (list, tuple)) and value and not isinstance(value[0], (list, tuple)):
            value = [value]  # 1행 그리드로 취급
        rows = list(value) if isinstance(value, (list, tuple)) else [[value]]
        for i, r in enumerate(range(self._r1, self._r2 + 1)):
            row = rows[i] if i < len(rows) else None
            if row is None:
                if self._single or not isinstance(value, (list, tuple)):
                    self._ws.cell(row=r, column=self._c1, value=value)
                continue
            if not isinstance(row, (list, tuple)):
                row = [row]
            for j, c in enumerate(range(self._c1, self._c2 + 1)):
                if j < len(row):
                    _opxl_write_cell(self._ws, r, c, row[j], redirect_merged=False)

    Value = property(_get_value, _set_value)
    Value2 = property(_get_value, _set_value)

    @property
    def Row(self):
        return self._r1

    @property
    def Column(self):
        return self._c1

    @property
    def Rows(self):
        return _OpxlCount(self._r2 - self._r1 + 1)

    @property
    def Columns(self):
        return _OpxlCount(self._c2 - self._c1 + 1)

    def Select(self):
        return self


class _OpxlRowProxy:
    def __init__(self, sheet_proxy, row_idx):
        self._sheet_proxy = sheet_proxy
        self._ws = sheet_proxy._ws
        self._row_idx = int(row_idx)

    @property
    def values(self):
        self._sheet_proxy.flush_pending_rows()
        max_col = int(self._ws.max_column or 1)
        return [self._ws.cell(row=self._row_idx, column=c).value for c in range(1, max_col + 1)]

    @values.setter
    def values(self, row_values):
        self._sheet_proxy._set_pending_row_values(self._row_idx, list(row_values or []))

    def clear(self):
        self._sheet_proxy._set_pending_row_clear(self._row_idx)
        return self


class _OpxlFormulaString(str):
    def __new__(cls, value, row, col, ws=None):
        obj = str.__new__(cls, value)
        obj._b2b_origin_row = int(row)
        obj._b2b_origin_col = int(col)
        obj._b2b_origin_ws = ws
        return obj

    def replace(self, old, new, count=-1):
        if count == -1:
            value = super().replace(old, new)
        else:
            value = super().replace(old, new, count)
        return _OpxlFormulaString(
            value,
            self._b2b_origin_row,
            self._b2b_origin_col,
            getattr(self, "_b2b_origin_ws", None),
        )


class _OpxlCopiedInt(int):
    def __new__(cls, value, row, col, ws=None):
        obj = int.__new__(cls, value)
        obj._b2b_origin_row = int(row)
        obj._b2b_origin_col = int(col)
        obj._b2b_origin_ws = ws
        return obj


class _OpxlCopiedFloat(float):
    def __new__(cls, value, row, col, ws=None):
        obj = float.__new__(cls, value)
        obj._b2b_origin_row = int(row)
        obj._b2b_origin_col = int(col)
        obj._b2b_origin_ws = ws
        return obj


def _opxl_coord_from_row_col(row, col):
    from openpyxl.utils import get_column_letter
    return f"{get_column_letter(int(col))}{int(row)}"


def _opxl_translate_formula(value, dest_row, dest_col):
    if not (isinstance(value, _OpxlFormulaString) and str(value).startswith("=")):
        return value
    try:
        origin = _opxl_coord_from_row_col(value._b2b_origin_row, value._b2b_origin_col)
        dest = _opxl_coord_from_row_col(dest_row, dest_col)
        if origin == dest:
            return str(value)
        from openpyxl.formula.translate import Translator
        return Translator(str(value), origin=origin).translate_formula(dest)
    except Exception:
        return str(value)


def _opxl_unwrap_copied_value(value):
    if isinstance(value, _OpxlFormulaString):
        return str(value)
    if isinstance(value, _OpxlCopiedInt):
        return int(value)
    if isinstance(value, _OpxlCopiedFloat):
        return float(value)
    return value


def _opxl_copied_source(value):
    ws = getattr(value, "_b2b_origin_ws", None)
    if ws is None:
        return None
    try:
        return ws, int(value._b2b_origin_row), int(value._b2b_origin_col)
    except Exception:
        return None


def _opxl_ranges_overlap(a, b):
    return not (a.max_row < b.min_row or a.min_row > b.max_row or a.max_col < b.min_col or a.min_col > b.max_col)


def _opxl_unmerge_overlapping(ws, target_range):
    try:
        for existing in list(ws.merged_cells.ranges):
            if _opxl_ranges_overlap(existing, target_range):
                ws.unmerge_cells(str(existing))
    except Exception:
        pass


def _opxl_copy_cell_presentation(src_ws, src_row, src_col, dst_ws, dst_row, dst_col):
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.cell_range import CellRange

    src = src_ws.cell(row=int(src_row), column=int(src_col))
    dst = dst_ws.cell(row=int(dst_row), column=int(dst_col))
    if getattr(src, "has_style", False):
        dst._style = copy.copy(src._style)
    if src.number_format:
        dst.number_format = src.number_format
    if src.hyperlink:
        dst._hyperlink = copy.copy(src.hyperlink)
    if src.comment:
        dst.comment = copy.copy(src.comment)

    try:
        src_dim = src_ws.column_dimensions.get(get_column_letter(int(src_col)))
        if src_dim and src_dim.width:
            dst_ws.column_dimensions[get_column_letter(int(dst_col))].width = src_dim.width
    except Exception:
        pass
    try:
        src_height = src_ws.row_dimensions[int(src_row)].height
        if src_height:
            dst_ws.row_dimensions[int(dst_row)].height = src_height
    except Exception:
        pass

    try:
        for merged in list(src_ws.merged_cells.ranges):
            if not (merged.min_row <= int(src_row) <= merged.max_row and merged.min_col <= int(src_col) <= merged.max_col):
                continue
            if int(src_row) != merged.min_row or int(src_col) != merged.min_col:
                return
            row_delta = int(dst_row) - int(src_row)
            col_delta = int(dst_col) - int(src_col)
            target = CellRange(
                min_col=merged.min_col + col_delta,
                min_row=merged.min_row + row_delta,
                max_col=merged.max_col + col_delta,
                max_row=merged.max_row + row_delta,
            )
            if target.min_row < 1 or target.min_col < 1:
                continue
            _opxl_unmerge_overlapping(dst_ws, target)
            dst_ws.merge_cells(str(target))
            break
    except Exception:
        pass


class _OpxlCellProxy:
    def __init__(self, ws, row, col):
        object.__setattr__(self, "_ws", ws)
        object.__setattr__(self, "_row", int(row))
        object.__setattr__(self, "_col", int(col))

    @property
    def _cell(self):
        return self._ws.cell(row=self._row, column=self._col)

    def __getattr__(self, name):
        return getattr(self._cell, name)

    def __setattr__(self, key, value):
        if key in ("_ws", "_row", "_col"):
            object.__setattr__(self, key, value)
        elif key == "value":
            type(self).value.fset(self, value)
        else:
            setattr(self._cell, key, value)

    @property
    def value(self):
        value = self._cell.value
        if isinstance(value, str):
            return _OpxlFormulaString(value, self._row, self._col, self._ws)
        if isinstance(value, bool):
            return value
        if isinstance(value, int):
            return _OpxlCopiedInt(value, self._row, self._col, self._ws)
        if isinstance(value, float):
            return _OpxlCopiedFloat(value, self._row, self._col, self._ws)
        return value

    @value.setter
    def value(self, value):
        ar, ac = _opxl_merged_anchor(self._ws, self._row, self._col)
        if (ar, ac) != (self._row, self._col) and value in (None, ""):
            return
        src = _opxl_copied_source(value)
        if src:
            _opxl_copy_cell_presentation(src[0], src[1], src[2], self._ws, ar, ac)
        translated = _opxl_translate_formula(value, ar, ac)
        self._ws.cell(row=ar, column=ac).value = _opxl_unwrap_copied_value(translated)


class OpenpyxlWorksheetProxy:
    """openpyxl Worksheet 래퍼. COM 풍의 Range/Cells/UsedRange/.Name 을 제공하고
    그 외 속성/메서드(cell, insert_cols, append, max_row 등)는 openpyxl 로 위임한다."""
    def __init__(self, ws):
        object.__setattr__(self, "_ws", ws)

    def __getattr__(self, name):
        return getattr(object.__getattribute__(self, "_ws"), name)

    def __setattr__(self, key, value):
        if key == "_ws":
            object.__setattr__(self, key, value)
        elif key == "Name":
            self._ws.title = value
        else:
            setattr(self._ws, key, value)

    @property
    def Name(self):
        return self._ws.title

    @property
    def Parent(self):
        return self._ws.parent

    def _pending_rows(self):
        pending = getattr(self._ws, "_b2b_pending_rows", None)
        if pending is None:
            pending = {}
            setattr(self._ws, "_b2b_pending_rows", pending)
        return pending

    def _set_pending_row_values(self, row_idx, values):
        self._pending_rows()[int(row_idx)] = list(values or [])

    def _set_pending_row_clear(self, row_idx):
        self._pending_rows()[int(row_idx)] = None

    def flush_pending_rows(self):
        pending = getattr(self._ws, "_b2b_pending_rows", None)
        if not pending:
            return self
        items = sorted(pending.items())
        setattr(self._ws, "_b2b_pending_rows", {})
        has_merges = bool(getattr(getattr(self._ws, "merged_cells", None), "ranges", None))
        cell = self._ws.cell

        def is_blank_initial_row():
            try:
                return (
                    int(self._ws.max_row or 1) == 1
                    and int(self._ws.max_column or 1) == 1
                    and self._ws.cell(row=1, column=1).value in (None, "")
                )
            except Exception:
                return False

        current_max_col = int(self._ws.max_column or 1)

        def write_direct(row_idx, values):
            nonlocal current_max_col
            max_col = max(current_max_col, len(values or []))
            for c in range(1, max_col + 1):
                value = values[c - 1] if values is not None and c <= len(values) else None
                if has_merges:
                    _opxl_write_cell(self._ws, row_idx, c, value, redirect_merged=True)
                else:
                    cell(row=row_idx, column=c).value = value
            current_max_col = max_col

        current_max_row = int(self._ws.max_row or 0)
        for row_idx, values in items:
            row_idx = int(row_idx)
            if values is None:
                write_direct(row_idx, None)
                current_max_row = max(current_max_row, row_idx)
                continue
            if row_idx == 1 and is_blank_initial_row():
                write_direct(row_idx, values)
                current_max_row = max(current_max_row, row_idx)
                try:
                    self._ws._current_row = max(int(getattr(self._ws, "_current_row", 0) or 0), 1)
                except Exception:
                    pass
                continue
            if (not has_merges) and row_idx == current_max_row + 1:
                self._ws.append(values)
                current_max_row = row_idx
            else:
                write_direct(row_idx, values)
                current_max_row = max(current_max_row, row_idx)
        return self

    def Cells(self, r, c):
        self.flush_pending_rows()
        return _OpxlRange(self._ws, r, c, r, c)

    def row(self, row_idx):
        return _OpxlRowProxy(self, row_idx)

    def clear(self):
        self.flush_pending_rows()
        max_row = int(self._ws.max_row or 0)
        if max_row > 0:
            self._ws.delete_rows(1, max_row)
        try:
            self._ws._current_row = 0
        except Exception:
            pass
        return self

    def append(self, values):
        self.flush_pending_rows()
        values = list(values or [])
        current_row = int(getattr(self._ws, "_current_row", 0) or 0)
        is_blank_initial_row = False
        if current_row <= 1:
            try:
                is_blank_initial_row = (
                    int(self._ws.max_row or 1) == 1
                    and int(self._ws.max_column or 1) == 1
                    and self._ws.cell(row=1, column=1).value in (None, "")
                )
            except Exception:
                is_blank_initial_row = False
        if is_blank_initial_row:
            cell = self._ws.cell
            for c, value in enumerate(values, start=1):
                cell(row=1, column=c).value = value
            try:
                self._ws._current_row = 1
            except Exception:
                pass
        else:
            self._ws.append(values)
        return self

    def _formula_cells(self):
        self.flush_pending_rows()
        formulas = []
        for row in self._ws.iter_rows():
            for cell in row:
                value = cell.value
                if isinstance(value, str) and value.startswith("="):
                    formulas.append((int(cell.row), int(cell.column), value))
        return formulas

    def _write_translated_formula(self, old_row, old_col, new_row, new_col, formula):
        try:
            wrapped = _OpxlFormulaString(formula, old_row, old_col)
            self._ws.cell(row=int(new_row), column=int(new_col)).value = _opxl_translate_formula(wrapped, new_row, new_col)
        except Exception:
            self._ws.cell(row=int(new_row), column=int(new_col)).value = formula

    def insert_cols(self, idx, amount=1):
        self.flush_pending_rows()
        idx = int(idx)
        amount = max(1, int(amount or 1))
        formulas = self._formula_cells()
        self._ws.insert_cols(idx, amount)
        for row, col, formula in formulas:
            if col >= idx:
                self._write_translated_formula(row, col, row, col + amount, formula)
        return self

    def insert_rows(self, idx, amount=1):
        self.flush_pending_rows()
        idx = int(idx)
        amount = max(1, int(amount or 1))
        formulas = self._formula_cells()
        self._ws.insert_rows(idx, amount)
        for row, col, formula in formulas:
            if row >= idx:
                self._write_translated_formula(row, col, row + amount, col, formula)
        return self

    def delete_cols(self, idx, amount=1):
        self.flush_pending_rows()
        idx = int(idx)
        amount = max(1, int(amount or 1))
        last_deleted = idx + amount - 1
        formulas = self._formula_cells()
        self._ws.delete_cols(idx, amount)
        for row, col, formula in formulas:
            if col > last_deleted:
                self._write_translated_formula(row, col, row, col - amount, formula)
        return self

    def delete_rows(self, idx, amount=1):
        self.flush_pending_rows()
        idx = int(idx)
        amount = max(1, int(amount or 1))
        last_deleted = idx + amount - 1
        formulas = self._formula_cells()
        self._ws.delete_rows(idx, amount)
        for row, col, formula in formulas:
            if row > last_deleted:
                self._write_translated_formula(row, col, row - amount, col, formula)
        return self

    @property
    def UsedRange(self):
        self.flush_pending_rows()
        mr = self._ws.max_row or 1
        mc = self._ws.max_column or 1
        return _OpxlRange(self._ws, 1, 1, mr, mc)

    def cell(self, row=None, column=None, value=_OPXL_NO_VALUE):
        self.flush_pending_rows()
        ar, ac = _opxl_merged_anchor(self._ws, int(row), int(column))
        proxy = _OpxlCellProxy(self._ws, ar, ac)
        if value is not _OPXL_NO_VALUE:
            proxy.value = value
        return proxy

    def Range(self, a1, a2=None):
        self.flush_pending_rows()
        if a2 is not None:
            r1, c1 = a1._r1, a1._c1
            r2, c2 = a2._r1, a2._c1
            return _OpxlRange(self._ws, min(r1, r2), min(c1, c2), max(r1, r2), max(c1, c2))
        s = str(a1).replace("$", "").strip()
        if ":" in s:
            left, right = s.split(":", 1)
            r1, c1 = _opxl_coord(left)
            r2, c2 = _opxl_coord(right)
            return _OpxlRange(self._ws, min(r1, r2), min(c1, c2), max(r1, r2), max(c1, c2))
        r, c = _opxl_coord(s)
        return _OpxlRange(self._ws, r, c, r, c)


class _OpenpyxlSheetsProxy:
    def __init__(self, workbook_proxy):
        self._workbook_proxy = workbook_proxy

    def __call__(self, name=None):
        return self._workbook_proxy.sheet(name)

    def __getitem__(self, name):
        return self._workbook_proxy.sheet(name)

    def __contains__(self, name):
        raw = self._workbook_proxy.raw
        return str(name) in raw.sheetnames

    def __iter__(self):
        raw = self._workbook_proxy.raw
        for name in raw.sheetnames:
            yield OpenpyxlWorksheetProxy(raw[name])

    def __len__(self):
        return len(self._workbook_proxy.raw.sheetnames)

    def add(self, name=None):
        return self._workbook_proxy._ctx.add_sheet(
            name or "Sheet",
            workbook=self._workbook_proxy._ctx._sheet_add_target(self._workbook_proxy),
        )

    @property
    def names(self):
        return list(self._workbook_proxy.raw.sheetnames)


class OpenpyxlWorkbookProxy:
    def __init__(self, ctx, workbook, name=None):
        self._ctx = ctx
        self._workbook = workbook
        self.name = name or ""
        self._sheets_proxy = _OpenpyxlSheetsProxy(self)

    @property
    def raw(self):
        return self._workbook

    def __getattr__(self, name):
        return getattr(self._workbook, name)

    def __getitem__(self, name):
        return self.sheet(name)

    def __contains__(self, name):
        return str(name) in self._workbook.sheetnames

    def sheet(self, name=None):
        return self._ctx.sheet(name, workbook=self)

    @property
    def sheets(self, name=None):
        return self._sheets_proxy

    def add_sheet(self, name):
        return self._ctx.add_sheet(name, workbook=self)

    def sheet_like(self, name=None):
        return self._ctx.sheet_like(name, workbook=self)

    def range(self, sheet_or_name, address):
        return self._ctx.range(sheet_or_name, address, workbook=self)

    def rows(self, sheet_or_name=None):
        return self._ctx.rows(sheet_or_name, workbook=self)

    def iter_rows(self, sheet_or_name=None, start_row=1):
        return self._ctx.iter_rows(sheet_or_name, workbook=self, start_row=start_row)

    def rows_with_index(self, sheet_or_name=None, start_row=1):
        return self._ctx.iter_rows(sheet_or_name, workbook=self, start_row=start_row)

    def display_rows(self, sheet_or_name=None):
        return self._ctx.display_rows(sheet_or_name, workbook=self)

    def value(self, sheet_or_name, row, col):
        return self._ctx.value(sheet_or_name, row, col, workbook=self)

    def display_value(self, sheet_or_name, row, col):
        return self._ctx.display_value(sheet_or_name, row, col, workbook=self)

    def col(self, sheet_or_name, header, header_rows=20):
        return self._ctx.col(sheet_or_name, header, workbook=self, header_rows=header_rows)

    def header_row(self, sheet_or_name=None, header_rows=20):
        return self._ctx.header_row(sheet_or_name, workbook=self, header_rows=header_rows)


class OpenpyxlSkillContext:
    """COM ExcelSkillContext 와 동일한 API를 openpyxl 위에서 제공한다."""
    def __init__(self, output_wb, input_wbs, output_cached_wb=None, output_name=None, active_file_id=None, active_sheet=None):
        self.excel = None
        self._workbook = output_wb
        self._output_cached_wb = output_cached_wb
        self.output_name = output_name or "output"
        self.workbook = OpenpyxlWorkbookProxy(self, output_wb, self.output_name)
        self.output = self.workbook
        self.last_output_sheet = None
        self.last_output_address = None
        self._progress = None  # 느린 루프 진행률 콜백(stage, done, total). 실행기가 주입.
        self.inputs = {
            name: OpenpyxlWorkbookProxy(self, wb, name)
            for name, wb in (input_wbs or {}).items()
        }
        self.active_file_id = str(active_file_id or "")
        self.active_sheet_name = str(active_sheet or "")
        self.active_workbook = self._workbook_for_file_id(self.active_file_id) or self.workbook
        self._last_sheet_workbook_raw = self._unwrap_workbook(self.active_workbook)

    def _unwrap_workbook(self, wb):
        return wb.raw if isinstance(wb, OpenpyxlWorkbookProxy) else wb

    def _sheet_add_target(self, owner):
        owner_raw = self._unwrap_workbook(owner)
        recent_raw = getattr(self, "_last_sheet_workbook_raw", None)
        if owner_raw is self._workbook and recent_raw is not None and recent_raw is not self._workbook:
            return recent_raw
        return owner

    def _workbook_for_file_id(self, file_id):
        file_id = str(file_id or "")
        if not file_id:
            return None
        if file_id == "output" or file_id.startswith("output:"):
            return self.workbook
        if file_id.startswith("input:"):
            hint = file_id[6:]
            try:
                return self.workbook_like(hint)
            except Exception:
                return self.inputs.get(hint)
        return None

    def _default_workbook(self):
        return self.active_workbook or self.workbook

    def _is_output_workbook(self, wb):
        return self._unwrap_workbook(wb) is self._workbook

    def _cached_ws_for(self, ws):
        raw = getattr(ws, "_ws", ws)
        try:
            if raw.parent is self._workbook and self._output_cached_wb is not None and raw.title in self._output_cached_wb.sheetnames:
                return self._output_cached_wb[raw.title]
        except Exception:
            pass
        return None

    def normalize(self, value):
        return normalize_text(value)

    def _sheet_names(self, wb):
        return list(self._unwrap_workbook(wb).sheetnames)

    def workbook_like(self, hint=None):
        if not hint:
            return self.workbook
        norm = self.normalize(hint)
        candidates = [(name, wb) for name, wb in self.inputs.items()]
        candidates.append((self.output_name, self.workbook))
        candidates.append(("output", self.workbook))
        for name, wb in candidates:
            if self.normalize(name) == norm:
                return wb
        for name, wb in candidates:
            if norm in self.normalize(name) or self.normalize(name) in norm:
                return wb
        for _, wb in candidates:
            if self._find_sheet_name(wb, hint, allow_single=False):
                return wb
        if len(self.inputs) == 1:
            return next(iter(self.inputs.values()))
        raise RuntimeError(f"workbook not found: {hint}")

    def input(self, hint=None):
        if hint is None:
            if len(self.inputs) == 1:
                return next(iter(self.inputs.values()))
            raise RuntimeError("input workbook hint is required when multiple input files exist")
        return self.workbook_like(hint)

    def _find_sheet_name(self, wb, name=None, allow_single=True):
        raw = self._unwrap_workbook(wb)
        names = list(raw.sheetnames)
        if not names:
            return None
        if not name:
            try:
                return raw.active.title
            except Exception:
                return names[0]
        norm = self.normalize(name)
        sheet_norm_loose = normalize_sheet_lookup(name)
        for sheet_name in names:
            if self.normalize(sheet_name) == norm:
                return sheet_name
        for sheet_name in names:
            sheet_norm = self.normalize(sheet_name)
            if norm in sheet_norm or sheet_norm in norm:
                return sheet_name
        for sheet_name in names:
            candidate = normalize_sheet_lookup(sheet_name)
            if sheet_norm_loose and (candidate == sheet_norm_loose or sheet_norm_loose in candidate or candidate in sheet_norm_loose):
                return sheet_name
        if allow_single and len(names) == 1:
            return names[0]
        return None

    def sheet(self, name=None, workbook=None):
        default_wb = workbook or self._default_workbook()
        raw = self._unwrap_workbook(default_wb)
        lookup_name = self.active_sheet_name if (name is None and workbook is None and self.active_sheet_name) else name
        allow_single = (not bool(lookup_name)) or (workbook is not None and not self._is_output_workbook(raw))
        sheet_name = self._find_sheet_name(default_wb, lookup_name, allow_single=allow_single)
        if not sheet_name and workbook is None:
            matches = []
            candidates = [self.workbook] + list(self.inputs.values())
            seen = set()
            for candidate in candidates:
                raw_candidate = self._unwrap_workbook(candidate)
                key = str(id(raw_candidate))
                if key in seen:
                    continue
                seen.add(key)
                candidate_sheet = self._find_sheet_name(raw_candidate, lookup_name, allow_single=False)
                if candidate_sheet:
                    matches.append((raw_candidate, candidate_sheet))
            if len(matches) == 1:
                raw, sheet_name = matches[0]
        if not sheet_name and workbook is not None and self._is_output_workbook(raw) and lookup_name:
            matches = []
            for candidate in self.inputs.values():
                raw_candidate = self._unwrap_workbook(candidate)
                candidate_sheet = self._find_sheet_name(candidate, lookup_name, allow_single=False)
                if candidate_sheet:
                    matches.append((raw_candidate, candidate_sheet))
            if len(matches) == 1:
                raw, sheet_name = matches[0]
        if not sheet_name and workbook is None and lookup_name != name:
            sheet_name = self._find_sheet_name(default_wb, name, allow_single=not bool(name))
        if not sheet_name:
            raise RuntimeError(f"sheet not found: {name}")
        ws = OpenpyxlWorksheetProxy(raw[sheet_name])
        self._last_sheet_workbook_raw = raw
        if self._is_output_workbook(raw):
            self.last_output_sheet = ws.Name
        return ws

    def sheet_like(self, name=None, workbook=None):
        return self.sheet(name, workbook)

    def input_sheet(self, sheet_hint=None, file_hint=None):
        workbooks = []
        if file_hint:
            workbooks.append(self.workbook_like(file_hint))
        else:
            workbooks.extend(self.inputs.values())
        for wb in workbooks:
            sheet_name = self._find_sheet_name(wb, sheet_hint, allow_single=True)
            if sheet_name:
                return OpenpyxlWorksheetProxy(self._unwrap_workbook(wb)[sheet_name])
        raise RuntimeError(f"input sheet not found: {sheet_hint}")

    def range(self, sheet_or_name, address, workbook=None):
        ws = sheet_or_name if hasattr(sheet_or_name, "Range") else self.sheet(sheet_or_name, workbook)
        try:
            if self._is_output_workbook(ws.Parent):
                self.last_output_sheet = ws.Name
                self.last_output_address = str(address)
        except Exception:
            pass
        return ws.Range(str(address))

    def _ws_of(self, sheet_or_name, workbook=None):
        return sheet_or_name if hasattr(sheet_or_name, "UsedRange") else self.sheet(sheet_or_name, workbook)

    def flush_pending_rows(self):
        workbooks = [self._workbook]
        for wb in self.inputs.values():
            raw = self._unwrap_workbook(wb)
            if raw not in workbooks:
                workbooks.append(raw)
        for wb in workbooks:
            for ws in list(getattr(wb, "worksheets", []) or []):
                OpenpyxlWorksheetProxy(ws).flush_pending_rows()

    def rows(self, sheet_or_name, workbook=None):
        ws = self._ws_of(sheet_or_name, workbook)
        if hasattr(ws, "flush_pending_rows"):
            ws.flush_pending_rows()
        raw = getattr(ws, "_ws", ws)
        out = []
        for row in raw.iter_rows(values_only=True):
            out.append(list(row))
        # 끝쪽 완전 빈 행 제거(openpyxl max_row 가 과대평가될 수 있음)
        while out and all(v is None or v == "" for v in out[-1]):
            out.pop()
        return out

    def iter_rows(self, sheet_or_name, workbook=None, start_row=1):
        rows = self.rows(sheet_or_name, workbook=workbook)
        min_row = max(1, int(start_row or 1))
        for excel_row, row in enumerate(rows, start=1):
            if excel_row >= min_row:
                yield excel_row, row

    def rows_with_index(self, sheet_or_name, workbook=None, start_row=1):
        return self.iter_rows(sheet_or_name, workbook=workbook, start_row=start_row)

    def value(self, sheet_or_name, row, col, workbook=None):
        """Return the displayed/calculated value for one cell.

        Use this for "값만 복사" from formula cells. Plain ws.cell(...).value keeps
        the formula string so formula-preserving copy still works.
        """
        ws = self._ws_of(sheet_or_name, workbook)
        if hasattr(ws, "flush_pending_rows"):
            ws.flush_pending_rows()
        raw = getattr(ws, "_ws", ws)
        return _opxl_display_cell_value(raw, int(row), int(col), self._cached_ws_for(raw))

    def display_value(self, sheet_or_name, row, col, workbook=None):
        return self.value(sheet_or_name, row, col, workbook=workbook)

    def display_rows(self, sheet_or_name, workbook=None):
        ws = self._ws_of(sheet_or_name, workbook)
        if hasattr(ws, "flush_pending_rows"):
            ws.flush_pending_rows()
        raw = getattr(ws, "_ws", ws)
        cached_ws = self._cached_ws_for(raw)
        out = []
        for r_idx in range(1, (raw.max_row or 0) + 1):
            row = []
            for c_idx in range(1, (raw.max_column or 0) + 1):
                row.append(_opxl_display_cell_value(raw, r_idx, c_idx, cached_ws))
            out.append(row)
        while out and all(v is None or v == "" for v in out[-1]):
            out.pop()
        return out

    def col(self, sheet_or_name, header, workbook=None, header_rows=20):
        rows = self.rows(sheet_or_name, workbook)
        target = self.normalize(header)
        for row in rows[:header_rows]:
            for c_idx, value in enumerate(row, start=1):
                if self.normalize(value) == target:
                    return ExcelColumnNumber(c_idx)
        for row in rows[:header_rows]:
            for c_idx, value in enumerate(row, start=1):
                if target and target in self.normalize(value):
                    return ExcelColumnNumber(c_idx)
        raise RuntimeError(f"column not found: {header}")

    def header_row(self, sheet_or_name=None, workbook=None, header_rows=20):
        rows = self.rows(sheet_or_name, workbook)
        best_idx = 1
        best_score = -1
        for idx, row in enumerate(rows[:header_rows], start=1):
            score = sum(1 for value in row if value not in (None, ""))
            if score > best_score:
                best_idx, best_score = idx, score
        return best_idx

    def data_start_row(self, sheet_or_name=None, workbook=None, header_rows=20):
        return self.header_row(sheet_or_name, workbook, header_rows) + 1

    def _col0(self, rows, name_or_idx, header_rows=20):
        if isinstance(name_or_idx, (int, ExcelColumnNumber)):
            return max(0, int(name_or_idx) - 1)
        target = self.normalize(name_or_idx)
        scan = rows[:header_rows] if header_rows else rows
        for row in scan:
            for i, v in enumerate(row or []):
                if self.normalize(v) == target:
                    return i
        for row in scan:
            for i, v in enumerate(row or []):
                if target and target in self.normalize(v):
                    return i
        return None

    def add_sheet(self, name, workbook=None):
        wb = self._unwrap_workbook(workbook or self._default_workbook())
        base = re.sub(r"[\[\]:*?/\\]", "_", str(name) or "Sheet")[:31] or "Sheet"
        existing = {self.normalize(n) for n in wb.sheetnames}
        final = base
        idx = 1
        while self.normalize(final) in existing:
            idx += 1
            suffix = "_" + str(idx)
            final = (base[: max(1, 31 - len(suffix))] + suffix)
        raw_ws = wb.create_sheet(title=final)
        ws = OpenpyxlWorksheetProxy(raw_ws)
        if self._is_output_workbook(wb):
            self.last_output_sheet = ws.Name
        return ws

    def _write_grid(self, ws, grid, start_row=1, start_col=1):
        if not grid:
            return ws
        raw = getattr(ws, "_ws", ws)
        # 병합 셀 유무를 한 번만 확인. 병합 없는 시트(작업/스크래치 시트 대부분)는 셀마다
        # merged-anchor 스캔(_opxl_write_cell)을 건너뛰고 직접 써서 대용량에서 크게 빨라진다.
        try:
            has_merges = bool(raw.merged_cells.ranges)
        except Exception:
            has_merges = True  # 알 수 없으면 안전(기존) 경로
        total = len(grid)
        cell = raw.cell
        report = self._progress if (total > 20000 and callable(self._progress)) else None
        for i, row in enumerate(grid):
            R = start_row + i
            if has_merges:
                for j, value in enumerate(row or []):
                    _opxl_write_cell(raw, R, start_col + j, value, redirect_merged=False)
            else:
                for j, value in enumerate(row or []):
                    cell(row=R, column=start_col + j, value=value)
            if report is not None and (i % 20000 == 0):
                try: report("쓰는 중", i, total)
                except Exception: pass
        if report is not None:
            try: report("쓰는 중", total, total)
            except Exception: pass
        return ws

    def write_grid(self, ws, grid, start_row=1, start_col=1):
        ws = self._ws_of(ws)
        self._write_grid(ws, grid, start_row, start_col)
        if self._is_output_workbook(ws.Parent):
            self.last_output_sheet = ws.Name
        return ws

    def set_range(self, sheet_or_name, address, grid, workbook=None):
        ws = self._ws_of(sheet_or_name, workbook)
        if not grid:
            return ws
        r0, c0 = _opxl_coord(str(address).split(":")[0])
        self._write_grid(ws, grid, start_row=r0, start_col=c0)
        if self._is_output_workbook(ws.Parent):
            self.last_output_sheet = ws.Name
            self.last_output_address = str(address)
        return ws

    def sort(self, sheet_or_name, by, ascending=True, header=True, workbook=None):
        # 다중키 지원: by 는 단일 컬럼명/인덱스 또는 컬럼 리스트. ascending 도 bool 또는 리스트.
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        keys = list(by) if isinstance(by, (list, tuple)) else [by]
        rels = []
        for k in keys:
            rel = self._col0(rows, k)
            if rel is None:
                raise RuntimeError("sort: column not found: %r" % (k,))
            rels.append(rel)
        asc_list = list(ascending) if isinstance(ascending, (list, tuple)) else [ascending] * len(rels)
        while len(asc_list) < len(rels):
            asc_list.append(asc_list[-1] if asc_list else True)
        hdr_count = 1 if header else 0
        head = rows[:hdr_count]
        body = rows[hdr_count:]

        def _cellkey(r, rel):
            v = r[rel] if rel < len(r) else None
            num = self._num(v)
            return (0, num) if num is not None else (1, self.normalize(v))

        if len(set(bool(a) for a in asc_list)) <= 1:
            rev = not bool(asc_list[0]) if asc_list else False
            body.sort(key=lambda r: tuple(_cellkey(r, rel) for rel in rels), reverse=rev)
        else:
            # 키별 정렬 방향이 섞이면 안정정렬을 마지막 키부터 적용
            for i in range(len(rels) - 1, -1, -1):
                body.sort(key=lambda r, rel=rels[i]: _cellkey(r, rel), reverse=not bool(asc_list[i]))

        # 정렬은 행 수를 보존하므로, 셀 단위 전체 clear 루프(느림) 대신 직사각형 그리드로 한 번에 재기록.
        max_col = max((len(r) for r in rows), default=0)
        grid = list(head) + body
        padded = [list(r) + [None] * (max_col - len(r)) for r in grid]
        raw = getattr(ws, "_ws", ws)
        self._write_grid(ws, padded)
        # 혹시 기존 시트가 새 그리드보다 길면 그 잔여행만 비운다(보통 없음).
        old_max = raw.max_row or 0
        if old_max > len(padded):
            for r_idx in range(len(padded) + 1, old_max + 1):
                for c_idx in range(1, max_col + 1):
                    raw.cell(row=r_idx, column=c_idx, value=None)
        if self._is_output_workbook(ws.Parent):
            self.last_output_sheet = ws.Name
        return ws

    def filter_to_sheet(self, sheet_or_name, predicate, dest_name, header_rows=1, workbook=None):
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        hr = max(0, int(header_rows or 0))
        header = rows[:hr]
        matched = []
        body = rows[hr:]
        total = len(body)
        report = getattr(self, "_progress", None)
        report = report if (total > 20000 and callable(report)) else None
        for k, r in enumerate(body):
            try:
                if predicate(r):
                    matched.append(r)
            except Exception:
                continue
            if report is not None and (k % 20000 == 0):
                try: report("거르는 중", k, total)
                except Exception: pass
        dest_wb = workbook
        if dest_wb is None:
            try:
                dest_wb = ws.Parent
            except Exception:
                dest_wb = self._default_workbook()
        dest = self.add_sheet(dest_name, workbook=dest_wb)
        self._write_grid(dest, list(header) + matched)
        return dest

    def _merge_pivot_grid_into_base(self, workbook, dest_name, grid):
        name = str(dest_name or "")
        if not name or name.endswith("_피벗") or "_" not in name or not grid or len(grid[0]) < 2:
            return
        prefix = name.rsplit("_", 1)[0]
        base_names = [prefix + "_피벗", prefix + "_pivot"]
        base_ws = None
        for base_name in base_names:
            try:
                base_ws = self.sheet(base_name, workbook=workbook)
                break
            except Exception:
                base_ws = None
        if base_ws is None:
            return
        if self.normalize(base_ws.Name) == self.normalize(name):
            return
        base_rows = self.rows(base_ws)
        if not base_rows:
            return
        base_header = list(base_rows[0] or [])
        src_header = list(grid[0] or [])
        add_cols = []
        for src_idx, label in enumerate(src_header[1:], start=1):
            if not any(self.normalize(label) == self.normalize(h) for h in base_header):
                add_cols.append((src_idx, label))
        if not add_cols:
            return
        out = [base_header + [label for _, label in add_cols]]
        key_to_values = {}
        for row in grid[1:]:
            if not row:
                continue
            key_to_values[self.normalize(row[0])] = row
        for row in base_rows[1:]:
            cur = list(row or [])
            key = self.normalize(cur[0] if cur else "")
            src = key_to_values.get(key)
            cur += [(src[i] if src is not None and i < len(src) else None) for i, _ in add_cols]
            out.append(cur)
        existing_keys = {self.normalize((row or [""])[0]) for row in base_rows[1:]}
        for row in grid[1:]:
            if not row or self.normalize(row[0]) in existing_keys:
                continue
            cur = [row[0]] + [None] * (len(base_header) - 1)
            cur += [(row[i] if i < len(row) else None) for i, _ in add_cols]
            out.append(cur)
        self._write_grid(base_ws, out)

    @staticmethod
    def _num(v):
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            s = v.strip().replace(",", "")
            try:
                return float(s)
            except ValueError:
                return None
        return None

    def pivot(self, sheet_or_name, group_by=None, value=None, agg="sum", dest_name=None, header_rows=1, workbook=None, **kwargs):
        if group_by is None:
            group_by = kwargs.get("rows")
        if value is None and "values" in kwargs:
            value = kwargs.get("values")
        if dest_name is None:
            dest_name = kwargs.get("name") or kwargs.get("dest")
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        hr = max(1, int(header_rows or 1))
        header_row = rows[hr - 1] if len(rows) >= hr else []
        data = rows[hr:]
        group_cols = list(group_by) if isinstance(group_by, (list, tuple)) else [group_by]
        gidx = [self._col0(rows, g, hr) for g in group_cols]
        values = list(value) if isinstance(value, (list, tuple)) else [value]
        aggs = list(agg) if isinstance(agg, (list, tuple)) else [agg] * len(values)
        while len(aggs) < len(values):
            aggs.append(aggs[-1] if aggs else "sum")
        aggs = [str(a or "sum").lower() for a in aggs]
        vidxs = [self._col0(rows, v, hr) if v is not None else None for v in values]

        groups = {}
        order = []
        for r in data:
            key = tuple((r[i] if (i is not None and i < len(r)) else "") for i in gidx)
            if key not in groups:
                groups[key] = [[] for _ in values]
                order.append(key)
            for pos, vidx in enumerate(vidxs):
                if vidx is None:
                    groups[key][pos].append(1)
                elif vidx < len(r):
                    groups[key][pos].append(r[vidx])

        def _aggregate(vals, agg_name):
            nums = [n for n in (self._num(v) for v in vals) if n is not None]
            if agg_name == "count":
                return len(vals)
            if agg_name in ("avg", "average", "mean"):
                return (sum(nums) / len(nums)) if nums else 0
            if agg_name == "max":
                return max(nums) if nums else ""
            if agg_name == "min":
                return min(nums) if nums else ""
            return sum(nums)

        out_header = []
        for n, i in enumerate(gidx):
            label = header_row[i] if (i is not None and i < len(header_row)) else ("그룹%d" % (n + 1))
            out_header.append(label)
        for v, agg_name in zip(values, aggs):
            label = str(v) if v is not None else "값"
            out_header.append(label + "_" + (agg_name if agg_name != "average" else "avg"))
        grid = [out_header]
        for key in order:
            grid.append(list(key) + [_aggregate(groups[key][i], aggs[i]) for i in range(len(values))])
        dest_wb = workbook
        if dest_wb is None:
            try:
                dest_wb = ws.Parent
            except Exception:
                dest_wb = self._default_workbook()
        dest = self.add_sheet(dest_name or "피벗요약", workbook=dest_wb)
        self._write_grid(dest, grid)
        self._merge_pivot_grid_into_base(dest_wb, dest.Name, grid)
        return dest


def _run_openpyxl_python_pipeline_impl(payload, job_id=None):
    if openpyxl is None:
        raise RuntimeError("openpyxl 이 설치되어 있지 않습니다(순수 Python 엔진 사용 불가).")
    output_item = payload.get("output") or {}
    if not output_item.get("backendWorkbookId"):
        raise RuntimeError("Python Excel skills require an output workbook.")
    input_items = payload.get("inputs", [])
    output_wb_record = get_workbook_or_raise(output_item.get("backendWorkbookId"))
    input_wb_records = [get_workbook_or_raise(item.get("backendWorkbookId")) for item in input_items]
    active_steps = [s for s in (payload.get("pipeline") or []) if not (s and s.get("enabled") is False)]
    python_steps = [s for s in active_steps if is_python_pipeline_step(s)]
    if len(python_steps) != len(active_steps):
        raise RuntimeError("순수 Python 엔진은 한 실행에서 JavaScript 단계와 섞을 수 없습니다.")

    update_pipeline_job(job_id, {
        "stage": "openpyxl 엔진 준비 중",
        "currentStep": 0,
        "completedSteps": 0,
        "totalSteps": len(python_steps),
        "stepRunning": True,
    })

    output_path = output_wb_record["path"]
    output_path_norm = str(Path(output_path).resolve()).lower()
    # 출력: data_only=False 로 열어 수식을 보존하고 값을 쓴다. 읽기는 쓴 값이 그대로 반영된다(read-after-write).
    output_wb = openpyxl_load_workbook_compatible(Path(output_path), data_only=False)
    # 값만 복사에서 기존 수식 셀의 표시값을 읽기 위한 짝 워크북.
    # 캐시가 없으면 ctx.value/display_value 가 단순 수식을 Python 에서 평가한다.
    output_cached_wb = openpyxl_load_workbook_compatible(Path(output_path), data_only=True)

    # 입력: data_only=True 로 열어 수식의 "계산된 값"을 읽는다(Excel 이 저장해둔 캐시값).
    # openpyxl 엔진에서 입력은 읽기 전용으로 취급한다(저장하면 수식이 사라지므로). 입력 편집은 Excel 엔진 사용.
    input_wbs = {}
    for item, rec in zip(input_items, input_wb_records):
        name = item.get("name") or rec["name"]
        path_norm = str(Path(rec["path"]).resolve()).lower()
        if path_norm == output_path_norm:
            input_wbs[name] = output_wb
            continue
        wb = openpyxl_load_workbook_compatible(Path(rec["path"]), data_only=True)
        input_wbs[name] = wb

    output_name = output_item.get("name") or output_wb_record["name"]
    current = payload.get("current") or {}
    ctx = OpenpyxlSkillContext(
        output_wb,
        input_wbs,
        output_cached_wb=output_cached_wb,
        output_name=output_name,
        active_file_id=current.get("fileId"),
        active_sheet=current.get("sheet"),
    )
    for idx, step in enumerate(python_steps, start=1):
        update_pipeline_job(job_id, {
            "stage": f"Python(openpyxl) Step {idx}/{len(python_steps)} 실행 중",
            "currentStep": idx,
            "completedSteps": idx - 1,
            "stepRunning": True,
            "errorInfo": None,
        })
        # 느린 루프(대용량 정렬/필터/쓰기)에서 행 진행률을 stage 로 노출(프론트가 폴링해 표시).
        ctx._progress = lambda stage, done, total, _i=idx, _n=len(python_steps): update_pipeline_job(job_id, {
            "stage": f"Python(openpyxl) Step {_i}/{_n} — {stage} {done:,}/{total:,}행",
            "currentStep": _i,
            "completedSteps": _i - 1,
            "stepRunning": True,
        })
        original_code = str(step.get("code") or "")
        code = normalize_python_pipeline_code(original_code)
        namespace = _safe_python_globals()
        try:
            stage_label = "compile"
            exec(compile(code, f"<pipeline_step_{idx}>", "exec"), namespace, namespace)
            stage_label = "lookup transform"
            transform = namespace.get("transform")
            if not callable(transform):
                raise RuntimeError("Python step must define def transform(ctx):")
            stage_label = "transform"
            transform(ctx)
            ctx.flush_pending_rows()
        except Exception as err:
            _cause, _guide = _pipeline_error_guide(str(err), original_code)
            raise PipelineExecutionError({
                "stepIdx": idx - 1,
                "stepId": step.get("id"),
                "description": step.get("description"),
                "code": original_code,
                "normalizedCode": code,
                "language": step.get("language") or "python",
                "message": f"{_cause}\n💡 이렇게 요청해 보세요: {_guide}\n(자세히: {stage_label} 단계 — {err})",
                "cause": _cause,
                "promptGuide": _guide,
                "rawError": f"{stage_label}: {err}",
                "stack": repr(err),
            })

    update_pipeline_job(job_id, {
        "stage": "결과 저장 중",
        "currentStep": len(python_steps),
        "completedSteps": len(python_steps),
        "stepRunning": False,
    })
    BACKEND_DIR.mkdir(parents=True, exist_ok=True)
    ctx.flush_pending_rows()

    # 출력 저장. openpyxl 은 수식을 계산하지 않으므로(셀에 캐시값 없음), Excel 이 열 때 전체 재계산하도록
    # fullCalcOnLoad 를 켠다. → 미러(실제 Excel)와 다운로드 파일에서 수식이 새 값으로 보인다.
    try:
        output_wb.calculation.fullCalcOnLoad = True
    except Exception:
        pass
    original_name = output_item.get("name") or output_wb_record["name"]
    safe_name = Path(str(original_name)).name
    if not Path(safe_name).suffix:
        safe_name += ".xlsx"
    result_path = BACKEND_DIR / f"{uuid.uuid4().hex}_result_{safe_name}"
    output_wb.save(str(result_path))

    # 입력 워크북도 파이프라인 안에서 새 시트/정렬/필터 결과가 만들어질 수 있다.
    # 3.7 JS 실행기와 같은 동작을 위해 수정된 입력 결과도 저장/다운로드 대상으로 노출한다.
    input_previews = {}
    input_download_urls = {}
    for item, rec in zip(input_items, input_wb_records):
        name = item.get("name") or rec["name"]
        wb = input_wbs.get(name)
        if wb is None or wb is output_wb:
            continue
        safe_input_name = Path(str(name)).name
        if not Path(safe_input_name).suffix:
            safe_input_name += ".xlsx"
        input_result_path = BACKEND_DIR / f"{uuid.uuid4().hex}_result_{safe_input_name}"
        try:
            wb.save(str(input_result_path))
        except Exception as err:
            raise RuntimeError(f"입력 결과 저장 실패({name}): {err}") from err
        input_result_id = uuid.uuid4().hex
        RESULTS[input_result_id] = {
            "path": str(input_result_path),
            "name": input_result_path.name,
            "created": time.time(),
        }
        inspected_input = inspect_workbook(input_result_path)
        input_previews[name] = inspected_input.get("sheets") or {}
        try:
            update_workbook_current_cache(rec, rows_only_sheets(input_previews[name]))
        except Exception:
            pass
        input_download_urls[f"input:{name}"] = f"/api/workbooks/download/{input_result_id}"

    output_file_id = current.get("outputFileId") or "output:0"
    result_id = uuid.uuid4().hex
    RESULTS[result_id] = {"path": str(result_path), "name": result_path.name, "created": time.time()}
    inspected = inspect_workbook(result_path)
    result_output = inspected.get("sheets") or {}
    update_workbook_current_cache(output_wb_record, rows_only_sheets(result_output))
    previews = build_result_previews(input_previews, result_output, current, {}, [])
    download_urls = dict(input_download_urls)
    download_urls[output_file_id] = f"/api/workbooks/download/{result_id}"
    # 결과 응답으로 마지막 작업 시트를 넘기면 프런트/미러가 사용자의 현재 탭을 바꾸기 쉽다.
    active_output_sheet = None
    active_output_address = None
    return {
        "ok": True,
        "pythonExcel": True,
        "engine": "openpyxl",
        "snapshotHit": False,
        "snapshotStep": 0,
        "diffId": None,
        "diffs": {},
        "forcedValueCells": [],
        "downloadId": result_id,
        "downloadUrl": f"/api/workbooks/download/{result_id}",
        "downloadUrls": download_urls,
        "files": previews,
        "activeSheet": active_output_sheet,
        "activeAddress": active_output_address,
    }


def run_openpyxl_python_pipeline_payload(payload, job_id=None):
    # COM/STA 가 필요 없으므로 잡 스레드에서 바로 실행한다.
    return _run_openpyxl_python_pipeline_impl(payload, job_id=job_id)


def _open_excel_workbook_for_skill(app, path, read_only=False):
    _park_excel_app_offscreen(app)
    wb, temp_path = excel_workbooks_open(app, path, read_only=read_only)
    _park_excel_app_offscreen(app)
    _hide_excel_app_window(app)
    return wb, temp_path


def _get_python_skill_app():
    # 매 적용마다 Excel 을 새로 띄우고 Quit 하던 비용(콜드스타트 1~3초)을 없애기 위해
    # 숨김 Excel 인스턴스를 한 번만 만들어 재사용한다. 죽었으면 다시 만든다.
    # 반드시 EXCEL_QUEUE STA 워커 스레드에서만 호출된다(excel_call 경유).
    global PYTHON_SKILL_APP, PYTHON_SKILL_APP_PID
    app = PYTHON_SKILL_APP
    if app is not None:
        try:
            _ = app.Workbooks.Count  # 살아있는지 확인
            return app
        except Exception:
            PYTHON_SKILL_APP = None
            PYTHON_SKILL_APP_PID = None
    app = win32com.client.DispatchEx("Excel.Application")
    app.Visible = False
    for attr, value in (("DisplayAlerts", False), ("EnableEvents", False), ("AskToUpdateLinks", False)):
        try:
            setattr(app, attr, value)
        except Exception:
            pass
    _hide_excel_app_window(app)
    PYTHON_SKILL_APP = app
    try:
        PYTHON_SKILL_APP_PID = _excel_process_id(app)
    except Exception:
        PYTHON_SKILL_APP_PID = None
    return app


def _quit_python_skill_app():
    global PYTHON_SKILL_APP, PYTHON_SKILL_APP_PID
    app = PYTHON_SKILL_APP
    PYTHON_SKILL_APP = None
    PYTHON_SKILL_APP_PID = None
    if app is None:
        return
    try:
        app.Quit()
    except Exception:
        pass


def _workbook_fingerprint(wb_record):
    path = Path(wb_record["path"])
    try:
        stat = path.stat()
        stamp = [str(path.resolve()).lower(), stat.st_size, int(stat.st_mtime_ns)]
    except OSError:
        stamp = [str(path).lower(), 0, 0]
    return {
        "id": wb_record.get("id"),
        "name": wb_record.get("name"),
        "stamp": stamp,
    }


def _step_signature(step):
    language = step.get("language") or ("python" if is_python_pipeline_step(step) else "javascript")
    code = step.get("code") or ""
    if str(language).lower() in ("python", "py") or is_python_pipeline_step(step):
        code = normalize_python_pipeline_code(code)
    return {
        "id": step.get("id"),
        "language": language,
        "enabled": step.get("enabled") is not False,
        "code": code,
        "description": step.get("description") or "",
    }


def _pipeline_snapshot_key(input_items, input_wbs, output_item, output_wb_record, steps_prefix):
    payload = {
        "version": 2,
        "inputs": [
            {
                "name": item.get("name") or wb["name"],
                "workbook": _workbook_fingerprint(wb),
            }
            for item, wb in zip(input_items, input_wbs)
        ],
        "output": {
            "name": output_item.get("name") or output_wb_record["name"],
            "workbook": _workbook_fingerprint(output_wb_record),
        },
        "steps": [_step_signature(step) for step in steps_prefix],
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _snapshot_path(snapshot, role, name):
    if not snapshot:
        return None
    return snapshot.get("files", {}).get(f"{role}:{name}")


def _snapshot_files_exist(snapshot):
    if not snapshot:
        return False
    return all(Path(path).exists() for path in (snapshot.get("files") or {}).values())


def _find_best_pipeline_snapshot(input_items, input_wbs, output_item, output_wb_record, active_steps):
    best = None
    for prefix_len in range(len(active_steps), 0, -1):
        key = _pipeline_snapshot_key(input_items, input_wbs, output_item, output_wb_record, active_steps[:prefix_len])
        snapshot = PIPELINE_STEP_SNAPSHOTS.get(key)
        if snapshot and _snapshot_files_exist(snapshot):
            best = (prefix_len, key, snapshot)
            break
    return best


def _cleanup_pipeline_step_snapshots():
    if len(PIPELINE_STEP_SNAPSHOTS) <= MAX_PIPELINE_STEP_SNAPSHOTS:
        return
    snapshots_root = (BACKEND_DIR / "pipeline_step_snapshots").resolve()
    ordered = sorted(PIPELINE_STEP_SNAPSHOTS.items(), key=lambda item: item[1].get("created", 0))
    while len(ordered) > MAX_PIPELINE_STEP_SNAPSHOTS:
        key, snapshot = ordered.pop(0)
        PIPELINE_STEP_SNAPSHOTS.pop(key, None)
        for path in (snapshot.get("files") or {}).values():
            try:
                # 스냅샷 디렉터리 내부 파일만 삭제. (미수정 입력은 원본을 참조하므로 절대 삭제 금지)
                if snapshots_root in Path(path).resolve().parents:
                    Path(path).unlink(missing_ok=True)
            except Exception:
                pass


def _save_pipeline_step_snapshot(key, step_idx, app, output_wb, input_wb_by_name, input_stable_src=None):
    snapshot_dir = BACKEND_DIR / "pipeline_step_snapshots" / key
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    files = {}
    output_path = snapshot_dir / "output.xlsx"
    output_wb.SaveCopyAs(str(output_path))
    files["output:output"] = str(output_path)
    input_stable_src = input_stable_src or {}
    for name, wb in input_wb_by_name.items():
        # 스킬이 수정하지 않은 입력(wb.Saved == True)은 안정적인 원본 경로를 그대로 참조해
        # 전체 복사를 건너뛴다(여러 입력 파일일 때 큰 속도 차이).
        stable = input_stable_src.get(name)
        try:
            unmodified = bool(stable) and bool(wb.Saved) and Path(stable).exists()
        except Exception:
            unmodified = False
        if unmodified:
            files[f"input:{name}"] = str(stable)
            continue
        safe_name = re.sub(r"[^0-9A-Za-z_.-]+", "_", str(name))[:80] or "input"
        input_path = snapshot_dir / f"input_{safe_name}.xlsx"
        wb.SaveCopyAs(str(input_path))
        files[f"input:{name}"] = str(input_path)
    PIPELINE_STEP_SNAPSHOTS[key] = {
        "key": key,
        "stepIdx": step_idx,
        "created": time.time(),
        "files": files,
    }
    _cleanup_pipeline_step_snapshots()
    return PIPELINE_STEP_SNAPSHOTS[key]


def _warn_excel_nonfatal(stage, err):
    print(f"[excel pipeline] non-fatal {stage} failed: {err!r}", file=sys.stderr)


def _safe_activate_excel_app(app):
    try:
        app.Visible = True
    except Exception:
        pass
    for attr in ("ActiveWindow", "Windows"):
        try:
            target = getattr(app, attr)
            if attr == "Windows":
                target = target(1)
            target.Activate()
            return True
        except Exception:
            pass
    try:
        app.Activate()
        return True
    except Exception:
        return False


def _hide_excel_hwnd(hwnd):
    if win32gui is None or win32con is None:
        return
    try:
        hwnd = int(hwnd)
    except Exception:
        return
    try:
        if not hwnd or not win32gui.IsWindow(hwnd):
            return
        flags = (
            getattr(win32con, "SWP_NOACTIVATE", 0x0010) |
            getattr(win32con, "SWP_NOOWNERZORDER", 0x0200) |
            getattr(win32con, "SWP_HIDEWINDOW", 0x0080)
        )
        win32gui.SetWindowPos(
            hwnd,
            getattr(win32con, "HWND_BOTTOM", 1),
            -32000,
            -32000,
            1,
            1,
            flags,
        )
        win32gui.ShowWindow(hwnd, getattr(win32con, "SW_HIDE", 0))
    except Exception:
        pass


def _hide_excel_windows_for_pid(pid):
    if win32gui is None or win32process is None:
        return
    try:
        target_pid = int(pid or 0)
    except Exception:
        return
    if not target_pid:
        return

    def visit(hwnd, _):
        try:
            _tid, window_pid = win32process.GetWindowThreadProcessId(hwnd)
            if int(window_pid or 0) == target_pid:
                _hide_excel_hwnd(hwnd)
        except Exception:
            pass
        return True

    try:
        win32gui.EnumWindows(visit, None)
    except Exception:
        pass


def _workbook_identity(wb):
    try:
        return str(Path(wb.FullName).resolve()).lower()
    except Exception:
        try:
            return str(wb.FullName).lower()
        except Exception:
            try:
                return str(wb.Name).lower()
            except Exception:
                return ""


def _hide_workbook_windows(wb):
    try:
        count = int(wb.Windows.Count)
    except Exception:
        count = 0
    for idx in range(1, count + 1):
        try:
            win = wb.Windows(idx)
        except Exception:
            continue
        try:
            win.Visible = False
        except Exception:
            pass
        try:
            _hide_excel_hwnd(int(win.Hwnd))
        except Exception:
            pass


def _hide_non_target_workbook_windows(app, target_wb):
    target_id = _workbook_identity(target_wb)
    try:
        workbooks = list(app.Workbooks)
    except Exception:
        workbooks = []
    for wb in workbooks:
        if target_id and _workbook_identity(wb) == target_id:
            continue
        _hide_workbook_windows(wb)


def _park_excel_app_offscreen(app):
    try:
        app.Visible = False
    except Exception:
        pass
    for _ in range(2):
        for attr, value in (
            ("Left", -32000),
            ("Top", -32000),
            ("Width", 10),
            ("Height", 10),
        ):
            try:
                setattr(app, attr, value)
            except Exception:
                pass
    try:
        _hide_excel_hwnd(app.Hwnd)
    except Exception:
        pass


def _hide_excel_app_window(app):
    _park_excel_app_offscreen(app)
    try:
        app.Visible = False
    except Exception:
        pass
    try:
        _hide_excel_hwnd(app.Hwnd)
    except Exception:
        pass


def _prepare_excel_session_for_close(app, wb=None):
    """Close/Quit 직전에 Excel 이 빈 회색 top-level 창을 복원하지 못하게 먼저 숨긴다."""
    try:
        app.DisplayAlerts = False
    except Exception:
        pass
    try:
        app.ScreenUpdating = False
    except Exception:
        pass
    try:
        app.Interactive = False
    except Exception:
        pass
    if wb is not None:
        try:
            _hide_workbook_windows(wb)
        except Exception:
            pass
    try:
        _hide_excel_app_window(app)
    except Exception:
        pass


def _start_excel_hide_guard(app, enabled=True):
    if not enabled or win32gui is None or win32con is None:
        return None
    try:
        hwnd = int(app.Hwnd)
    except Exception:
        return None
    if not hwnd:
        return None
    stop_event = threading.Event()

    def guard():
        while not stop_event.wait(0.02):
            _hide_excel_hwnd(hwnd)

    thread = threading.Thread(target=guard, name="b2b-excel-hide-guard", daemon=True)
    thread.start()
    return stop_event


def _safe_excel_calculate(app):
    for method_name in ("CalculateFull", "Calculate"):
        try:
            method = getattr(app, method_name)
            method()
            return True
        except Exception as err:
            last_err = err
    _warn_excel_nonfatal("calculate", last_err)
    return False


def _copy_source_workbook_into_target(app, target_wb, source_path):
    source_path = Path(source_path)
    if not source_path.exists():
        raise RuntimeError(f"snapshot source not found: {source_path}")
    open_path = source_path
    temp_copy = None
    source_temp_path = None
    try:
        try:
            target_fullname = str(Path(target_wb.FullName).resolve()).lower()
        except Exception:
            target_fullname = ""
        if target_fullname and target_fullname == str(source_path.resolve()).lower():
            temp_copy = BACKEND_DIR / f"live_reset_{uuid.uuid4().hex}{source_path.suffix or '.xlsx'}"
            shutil.copy2(source_path, temp_copy)
            open_path = temp_copy

        _park_excel_app_offscreen(app)
        source_wb, source_temp_path = excel_workbooks_open(app, open_path, read_only=True)
        _park_excel_app_offscreen(app)
        _hide_excel_app_window(app)
        try:
            source_wb.Windows(1).Visible = False
        except Exception:
            pass
        try:
            app.DisplayAlerts = False
            placeholder = target_wb.Worksheets.Add(Before=target_wb.Worksheets(1))
            placeholder_name = "__B2B_PIPELINE_SWAP__"
            suffix = 1
            existing = set(_excel_names(target_wb.Worksheets))
            while placeholder_name in existing:
                suffix += 1
                placeholder_name = f"__B2B_PIPELINE_SWAP_{suffix}__"
            placeholder.Name = placeholder_name

            for ws in list(target_wb.Worksheets):
                if ws.Name != placeholder_name:
                    ws.Delete()

            for idx in range(1, source_wb.Worksheets.Count + 1):
                source_wb.Worksheets(idx).Copy(Before=placeholder)
            placeholder.Delete()
        finally:
            source_wb.Close(SaveChanges=False)
    finally:
        if temp_copy:
            try:
                Path(temp_copy).unlink(missing_ok=True)
            except Exception:
                pass
        if source_temp_path and str(source_temp_path) != str(temp_copy):
            try:
                Path(source_temp_path).unlink(missing_ok=True)
            except Exception:
                pass


def _python_step_sig(step):
    # 라이브 미러에 이미 적용된 단계와 새 요청을 비교하기 위한 안정적 시그니처.
    # id + 정규화된 코드가 같으면 같은 단계로 본다(코드 편집 시 시그니처가 달라짐).
    code = normalize_python_pipeline_code(str((step or {}).get("code") or ""))
    raw = (str((step or {}).get("id") or "") + "\x00" + code).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()


def _excel_output_preview_sheets(wb):
    # 라이브 미러 워크북에서 미리보기+수식 메타데이터를 COM 으로 직접 읽는다(결과 파일 저장 없이).
    data = {}
    for name in _excel_collection_names(wb.Worksheets):
        try:
            ws = wb.Worksheets(name)
            used = ws.UsedRange
            max_row = max(0, int(used.Rows.Count))
            max_col = max(0, int(used.Columns.Count))
            rows = min(max_row, PREVIEW_ROWS)
            cols = min(max_col, PREVIEW_COLS or 256)
        except Exception:
            data[name] = {
                "rows": [],
                "formulas": {},
                "originalFormulaValues": {},
                "formats": [],
                "maxRow": 0,
                "maxCol": 0,
            }
            continue
        if rows <= 0 or cols <= 0:
            data[name] = {
                "rows": [],
                "formulas": {},
                "originalFormulaValues": {},
                "formats": [],
                "maxRow": max_row,
                "maxCol": max_col,
            }
            continue
        try:
            rng = ws.Range(ws.Cells(1, 1), ws.Cells(rows, cols))
            values = _range_matrix(rng.Value)
            formulas_matrix = _range_matrix(rng.Formula)
            formats_matrix = _range_matrix(rng.NumberFormat)
            out_rows = []
            formulas = {}
            original_formula_values = {}
            formats = []
            for r_idx in range(rows):
                value_row = values[r_idx] if r_idx < len(values) else []
                formula_row = formulas_matrix[r_idx] if r_idx < len(formulas_matrix) else []
                format_row = formats_matrix[r_idx] if r_idx < len(formats_matrix) else []
                out_row = []
                out_format_row = []
                for c_idx in range(cols):
                    value = value_row[c_idx] if c_idx < len(value_row) else ""
                    formula_value = formula_row[c_idx] if c_idx < len(formula_row) else value
                    formula_text = _com_scalar(formula_value)
                    json_value = cell_to_json(value)
                    out_row.append(json_value)
                    fmt = format_row[c_idx] if c_idx < len(format_row) else ""
                    out_format_row.append(str(fmt or ""))
                    if isinstance(formula_text, str) and formula_text.startswith("="):
                        address = f"{_col_letter(c_idx + 1)}{r_idx + 1}"
                        formulas[address] = formula_text
                        original_formula_values[address] = json_value
                out_rows.append(out_row)
                formats.append(out_format_row)
            data[name] = {
                "rows": out_rows,
                "formulas": formulas,
                "originalFormulaValues": original_formula_values,
                "formats": formats,
                "maxRow": max_row,
                "maxCol": max_col,
            }
        except Exception:
            data[name] = {
                "rows": [],
                "formulas": {},
                "originalFormulaValues": {},
                "formats": [],
                "maxRow": max_row,
                "maxCol": max_col,
            }
    return data


def _result_from_workbook_files(output_path, input_paths_by_name, output_item, output_wb_record, input_wb_records, payload, resume_from):
    # Excel 실행 없이 저장된 파일(스냅샷/원본)에서 미리보기 + 다운로드를 구성한다.
    # liveApplied=False 로 반환 → 프런트가 활성 미러를 이 파일로 교체(replace)해 빠르게 반영.
    current = payload.get("current") or {}
    output_file_id = current.get("outputFileId") or "output:0"
    download_urls = {}
    download_id = None

    out_path = Path(output_path)
    result_output = {}
    if out_path.exists():
        inspected = inspect_workbook(out_path)
        result_output = inspected.get("sheets") or {}
        download_id = uuid.uuid4().hex
        RESULTS[download_id] = {"path": str(out_path), "name": out_path.name, "created": time.time()}
        download_urls[output_file_id] = f"/api/workbooks/download/{download_id}"
        update_workbook_current_cache(output_wb_record, rows_only_sheets(result_output))

    rec_by_name = {}
    for item, rec in zip(payload.get("inputs", []), input_wb_records):
        rec_by_name[item.get("name") or rec["name"]] = rec
    input_previews = {}
    for name, path in (input_paths_by_name or {}).items():
        ip = Path(path)
        if not ip.exists():
            continue
        inspected_in = inspect_workbook(ip)
        input_previews[name] = inspected_in.get("sheets") or {}
        rid = uuid.uuid4().hex
        RESULTS[rid] = {"path": str(ip), "name": ip.name, "created": time.time()}
        download_urls["input:" + name] = f"/api/workbooks/download/{rid}"
        rec = rec_by_name.get(name)
        if rec is not None:
            update_workbook_current_cache(rec, rows_only_sheets(input_previews[name]))

    previews = build_result_previews(input_previews, result_output, current, {}, [])
    return {
        "ok": True,
        "pythonExcel": True,
        "liveApplied": False,
        "snapshotHit": True,
        "snapshotStep": resume_from,
        "diffId": None,
        "diffs": {},
        "forcedValueCells": [],
        "downloadId": download_id,
        "downloadUrl": download_urls.get(output_file_id),
        "downloadUrls": download_urls,
        "files": previews,
        "activeSheet": None,
        "activeAddress": None,
    }


def _run_excel_python_pipeline_impl(payload, job_id=None):
    if not excel_available():
        raise RuntimeError("Microsoft Excel COM automation is not available. Excel and pywin32 are required.")
    output_item = payload.get("output") or {}
    if not output_item.get("backendWorkbookId"):
        raise RuntimeError("Python Excel skills require an output workbook.")

    input_items = payload.get("inputs", [])
    output_wb_record = get_workbook_or_raise(output_item.get("backendWorkbookId"))
    input_wb_records = [get_workbook_or_raise(item.get("backendWorkbookId")) for item in input_items]
    active_steps = [s for s in (payload.get("pipeline") or []) if not (s and s.get("enabled") is False)]
    python_steps = [s for s in active_steps if is_python_pipeline_step(s)]
    if len(python_steps) != len(active_steps):
        raise RuntimeError("Python Excel execution cannot mix JavaScript and Python steps in one run.")
    cached_prefix = _find_best_pipeline_snapshot(input_items, input_wb_records, output_item, output_wb_record, python_steps)
    resume_from = cached_prefix[0] if cached_prefix else 0
    resume_snapshot = cached_prefix[2] if cached_prefix else None

    # 빠른 경로: 실행할 단계가 없으면(전부 캐시됨 또는 전부 OFF) Excel을 돌리지 않고
    # 저장된 스냅샷(없으면 원본) 파일로 결과를 즉시 만들어 반환한다(토글 ON/OFF 속도 개선).
    if resume_from >= len(python_steps):
        try:
            out_path = _snapshot_path(resume_snapshot, "output", "output") or output_wb_record["path"]
            in_paths = {}
            for item, rec in zip(input_items, input_wb_records):
                nm = item.get("name") or rec["name"]
                in_paths[nm] = _snapshot_path(resume_snapshot, "input", nm) or rec["path"]
            return _result_from_workbook_files(out_path, in_paths, output_item, output_wb_record, input_wb_records, payload, resume_from)
        except Exception as err:
            _warn_excel_nonfatal("snapshot fast result", err)

    # 단계별 서버 타이밍(F8 디버그 표시용)
    _t0 = time.perf_counter()
    _perf = {"resetMs": 0.0, "openMs": 0.0, "stepsMs": 0.0}

    live_excel_id = (payload.get("current") or {}).get("outputExcelId")
    live_session = None
    if live_excel_id:
        try:
            live_session = get_excel_session(live_excel_id)
        except Exception:
            live_session = None

    update_pipeline_job(job_id, {
        "stage": "Excel Python 실행 준비 중",
        "currentStep": 0,
        "completedSteps": 0,
        "totalSteps": len(python_steps),
        "stepRunning": True,
    })

    if live_session:
        try:
            app, output_wb = session_workbook(live_session)
            # 적용 중에는 미러 창을 보이게 하지 않는다(프런트가 미러를 숨기고 로딩을 표시).
            # 보이게/활성화하면 여러 Excel 창이 적용 중에 앞으로 튀어나온다. 완료 후 프런트가 재배치/표시.
        except Exception:
            live_session = None
    if not live_session:
        app = _get_python_skill_app()  # 재사용 (매번 새로 띄우지 않음)
        output_wb = None

    is_live = bool(live_session)
    # 라이브 미러가 이미 prefix 상태(=resume 지점까지 적용됨)이면 출력 리셋을 생략하고
    # 새 단계만 그 위에 바로 실행한다(빠른 추가). 편집/삽입/삭제로 prefix 가 어긋나면 리셋+재실행.
    desired_sigs = [_python_step_sig(s) for s in python_steps]
    applied_sigs = live_session.get("appliedStepSigs") if is_live else None
    fast_prefix = (
        is_live
        and applied_sigs is not None
        and len(applied_sigs) == resume_from
        and list(applied_sigs) == desired_sigs[:resume_from]
    )
    hide_guard = _start_excel_hide_guard(app, enabled=not live_session)
    live_read_only_mirror = bool(live_session and live_session.get("readOnlyMirror"))
    app.DisplayAlerts = False
    app.EnableEvents = False
    restore_screen_updating = None
    restore_calculation = None
    if live_session:
        try:
            restore_screen_updating = bool(app.ScreenUpdating)
            app.ScreenUpdating = False
        except Exception:
            restore_screen_updating = None
    else:
        # 워커(숨김) 경로 속도 개선: 화면 갱신을 끈다. (계산 모드는 워크북 오픈 후 설정)
        try:
            restore_screen_updating = bool(app.ScreenUpdating)
            app.ScreenUpdating = False
        except Exception:
            restore_screen_updating = None
    try:
        app.AskToUpdateLinks = False
    except Exception:
        pass

    opened = []
    ctx = None
    active_output_sheet = None
    active_output_address = None
    input_previews = {}        # 다중 입력 지원: 수정된 입력 파일 미리보기 {name: sheets}
    input_download_urls = {}   # {"input:<name>": downloadUrl}
    try:
        output_base_path = _snapshot_path(resume_snapshot, "output", "output") or output_wb_record["path"]
        if live_session:
            if live_read_only_mirror:
                try:
                    _protect_workbook_for_read_only_mirror(output_wb, False)
                except Exception as err:
                    _warn_excel_nonfatal("unprotect read-only mirror before reset", err)
            if not fast_prefix:
                # 미러 상태가 요청 prefix 와 다르면 기준 상태로 리셋 후 전체 재실행.
                _t_reset = time.perf_counter()
                _copy_source_workbook_into_target(app, output_wb, output_base_path)
                _perf["resetMs"] = (time.perf_counter() - _t_reset) * 1000
            if live_read_only_mirror:
                try:
                    _protect_workbook_for_read_only_mirror(output_wb, False)
                except Exception as err:
                    _warn_excel_nonfatal("unprotect read-only mirror after reset", err)
        else:
            output_wb, output_temp_path = _open_excel_workbook_for_skill(app, Path(output_base_path), read_only=False)
            opened.append((output_wb, output_temp_path))

        input_wbs = {}
        input_wb_by_name = {}
        # 스냅샷 저장 시, 스킬이 수정하지 않은 입력은 안정적인 원본 경로를 그대로 참조해
        # 전체 복사(SaveCopyAs)를 건너뛴다(여러 입력 파일일 때 큰 속도 차이). {name: 원본경로}
        input_stable_src = {}
        output_path_norm = str(Path(output_wb_record["path"]).resolve()).lower()
        for item, wb_record in zip(input_items, input_wb_records):
            name = item.get("name") or wb_record["name"]
            path_norm = str(Path(wb_record["path"]).resolve()).lower()
            snapshot_input_path = _snapshot_path(resume_snapshot, "input", name)
            if snapshot_input_path:
                wb, temp_path = _open_excel_workbook_for_skill(app, Path(snapshot_input_path), read_only=False)
                opened.append((wb, temp_path))
                input_wbs[name] = wb
                input_wb_by_name[name] = wb
                continue
            if path_norm == output_path_norm and not resume_snapshot:
                input_wbs[name] = output_wb
                input_wb_by_name[name] = output_wb
                continue
            wb, temp_path = _open_excel_workbook_for_skill(app, Path(wb_record["path"]), read_only=False)
            opened.append((wb, temp_path))
            input_wbs[name] = wb
            input_wb_by_name[name] = wb
            input_stable_src[name] = wb_record["path"]  # 원본(업로드 파일) = 안정적, 미수정 시 참조 가능

        # 큰 출력은 중간 단계 스냅샷을 건너뛰고 마지막 단계만 저장한다(속도).
        try:
            _out_size = Path(output_wb_record["path"]).stat().st_size
        except OSError:
            _out_size = 0
        snapshot_intermediate = _out_size < SNAPSHOT_INTERMEDIATE_MAX_BYTES

        # 워크북이 모두 열린 뒤 자동 재계산을 끈다(워커 경로). 단계마다 명시적으로 계산. (finally 복구)
        if not live_session:
            try:
                restore_calculation = app.Calculation
                app.Calculation = -4135  # xlCalculationManual
            except Exception:
                restore_calculation = None

        # 워크북 열기/리셋까지 걸린 시간(리셋 제외분 = 순수 open).
        _perf["openMs"] = max(0.0, (time.perf_counter() - _t0) * 1000 - _perf["resetMs"])
        _t_steps = time.perf_counter()

        output_name = output_item.get("name") or output_wb_record["name"]
        current = payload.get("current") or {}
        ctx = ExcelSkillContext(
            app,
            output_wb,
            input_wbs,
            output_name=output_name,
            active_file_id=current.get("fileId"),
            active_sheet=current.get("sheet"),
        )
        for idx, step in enumerate(python_steps[resume_from:], start=resume_from + 1):
            update_pipeline_job(job_id, {
                "stage": f"Excel Python Step {idx}/{len(python_steps)} 실행 중",
                "currentStep": idx,
                "completedSteps": idx - 1,
                "stepRunning": True,
                "errorInfo": None,
            })
            original_code = str(step.get("code") or "")
            code = normalize_python_pipeline_code(original_code)
            namespace = _safe_python_globals()
            try:
                stage_label = "compile"
                exec(compile(code, f"<pipeline_step_{idx}>", "exec"), namespace, namespace)
                stage_label = "lookup transform"
                transform = namespace.get("transform")
                if not callable(transform):
                    raise RuntimeError("Python step must define def transform(ctx):")
                stage_label = "transform"
                transform(ctx)
            except Exception as err:
                _cause, _guide = _pipeline_error_guide(str(err), original_code)
                raise PipelineExecutionError({
                    "stepIdx": idx - 1,
                    "stepId": step.get("id"),
                    "description": step.get("description"),
                    "code": original_code,
                    "normalizedCode": code,
                    "language": step.get("language") or "python",
                    "message": f"{_cause}\n💡 이렇게 요청해 보세요: {_guide}\n(자세히: {stage_label} 단계 — {err})",
                    "cause": _cause,
                    "promptGuide": _guide,
                    "rawError": f"{stage_label}: {err}",
                    "stack": repr(err),
                })
            _safe_excel_calculate(app)
            if not live_session:
                _hide_excel_app_window(app)
            is_last_step = (idx == len(python_steps))
            if is_last_step or snapshot_intermediate:
                try:
                    snapshot_key = _pipeline_snapshot_key(
                        input_items,
                        input_wb_records,
                        output_item,
                        output_wb_record,
                        python_steps[:idx],
                    )
                    _save_pipeline_step_snapshot(snapshot_key, idx, app, output_wb, input_wb_by_name, input_stable_src)
                except Exception as err:
                    _warn_excel_nonfatal("pipeline snapshot", err)

        _perf["stepsMs"] = (time.perf_counter() - _t_steps) * 1000
        # 적용 완료 후 마지막으로 쓴 시트/셀을 강제로 Activate/Select 하지 않는다.
        # 사용자가 입력 시트나 채팅창을 보고 있던 상태를 깨면 셀 선택/포커스가 튀는 문제가 생긴다.
        # (frame 모드 철학과 동일 — 적용이 사용자의 보기 상태를 바꾸지 않는다)
        active_output_sheet = None
        active_output_address = None
        if live_session and not live_session.get("liveEditable"):
            # 라이브 세션 폴은 스냅샷 diff 를 쓰지 않으므로(liveSelectionOnly)
            # 전 시트 재스냅샷(거대 파일에서 수 초)은 비라이브 세션에만 의미가 있다.
            try:
                refresh_excel_session_snapshots(live_session, output_wb)
            except Exception as err:
                _warn_excel_nonfatal("refresh live snapshots", err)

        # 다중 입력 지원: 스킬이 읽거나 수정한 입력 파일도 미리보기/다운로드에 반영한다.
        # 다운로드 소스는 가능하면 단계 스냅샷(이미 저장됨) 사본을 재사용해 추가 COM 저장을 피한다.
        input_record_by_name = {}
        for item, wb_record in zip(input_items, input_wb_records):
            input_record_by_name[item.get("name") or wb_record["name"]] = wb_record
        final_snapshot = PIPELINE_STEP_SNAPSHOTS.get(
            _pipeline_snapshot_key(input_items, input_wb_records, output_item, output_wb_record, python_steps)
        )
        for name, wb in input_wb_by_name.items():
            try:
                input_previews[name] = _excel_output_preview_sheets(wb)
            except Exception as err:
                _warn_excel_nonfatal(f"input preview {name}", err)
                continue
            try:
                rec = input_record_by_name.get(name)
                if rec is not None:
                    update_workbook_current_cache(rec, rows_only_sheets(input_previews[name]))
                snap_in = _snapshot_path(final_snapshot, "input", name)
                if snap_in and Path(snap_in).exists():
                    src_path = snap_in  # 단계 스냅샷(이미 저장됨) 재사용 → 복사/추가 저장 없음
                else:
                    BACKEND_DIR.mkdir(parents=True, exist_ok=True)
                    safe_in = Path(str(name)).name or "input.xlsx"
                    if not Path(safe_in).suffix:
                        safe_in += ".xlsx"
                    dest = BACKEND_DIR / f"{uuid.uuid4().hex}_result_{safe_in}"
                    wb.SaveCopyAs(str(dest))
                    src_path = str(dest)
                input_result_id = uuid.uuid4().hex
                RESULTS[input_result_id] = {"path": str(src_path), "name": Path(src_path).name, "created": time.time()}
                input_download_urls["input:" + name] = f"/api/workbooks/download/{input_result_id}"
            except Exception as err:
                _warn_excel_nonfatal(f"input result save {name}", err)

        if is_live:
            # 라이브 미러 = 적용된 워크북. 적용 단계 시그니처를 기록해 다음 추가가 빠른 경로를 타게 한다.
            live_session["appliedStepSigs"] = desired_sigs
        result_path = None
        if not is_live:
            update_pipeline_job(job_id, {
                "stage": "Excel 결과 저장 중",
                "currentStep": len(python_steps),
                "completedSteps": len(python_steps),
                "stepRunning": False,
            })
            BACKEND_DIR.mkdir(parents=True, exist_ok=True)
            original_name = output_item.get("name") or output_wb_record["name"]
            safe_name = Path(str(original_name)).name
            if not Path(safe_name).suffix:
                safe_name += ".xlsx"
            result_path = BACKEND_DIR / f"{uuid.uuid4().hex}_result_{safe_name}"
            _t_save = time.perf_counter()
            output_wb.SaveCopyAs(str(result_path))
            _perf["saveResultMs"] = (time.perf_counter() - _t_save) * 1000
    finally:
        if live_session and live_read_only_mirror:
            try:
                _protect_workbook_for_read_only_mirror(output_wb, True)
                _configure_excel_grid_window(app, output_wb)
            except Exception as err:
                _warn_excel_nonfatal("restore read-only mirror", err)
        for wb, temp_path in reversed(opened):
            try:
                wb.Close(SaveChanges=False)
            except Exception:
                pass
            if temp_path:
                try:
                    Path(temp_path).unlink(missing_ok=True)
                except Exception:
                    pass
        if not live_session:
            # 워커 설정 복구(다음 재사용 대비) 후 숨긴 채로 유지. (열린 워크북은 위 opened 루프에서 모두 닫힘)
            if restore_calculation is not None:
                try:
                    app.Calculation = restore_calculation
                except Exception:
                    pass
            if restore_screen_updating is not None:
                try:
                    app.ScreenUpdating = restore_screen_updating
                except Exception:
                    pass
            try:
                _hide_excel_app_window(app)
            except Exception:
                pass
        elif restore_screen_updating is not None:
            try:
                app.ScreenUpdating = restore_screen_updating
            except Exception:
                pass
        if hide_guard:
            hide_guard.set()

    output_file_id = (payload.get("current") or {}).get("outputFileId") or "output:0"
    current = payload.get("current") or {}
    if is_live:
        # 결과 파일을 저장하지 않는다(다운로드 시점에 라이브 미러를 저장). 미리보기는 COM 으로 읽음.
        try:
            result_output = _excel_output_preview_sheets(output_wb)
        except Exception as err:
            _warn_excel_nonfatal("live output preview", err)
            result_output = {}
        update_workbook_current_cache(output_wb_record, rows_only_sheets(result_output))
        previews = build_result_previews(input_previews, result_output, current, {}, [])
        _perf["totalServerMs"] = (time.perf_counter() - _t0) * 1000
        _perf["finalizeMs"] = max(0.0, _perf["totalServerMs"] - _perf["openMs"] - _perf["resetMs"] - _perf["stepsMs"])
        _perf["mode"] = "live"
        return {
            "ok": True,
            "pythonExcel": True,
            "liveApplied": True,
            "snapshotHit": bool(resume_from),
            "snapshotStep": resume_from,
            "diffId": None,
            "diffs": {},
            "forcedValueCells": [],
            "downloadId": None,
            "downloadUrl": None,
            "downloadUrls": dict(input_download_urls),
            "files": previews,
            "activeSheet": active_output_sheet,
            "activeAddress": active_output_address,
            "debugTimings": _perf,
        }
    result_id = uuid.uuid4().hex
    RESULTS[result_id] = {
        "path": str(result_path),
        "name": result_path.name,
        "created": time.time(),
    }
    _t_inspect = time.perf_counter()
    inspected = inspect_workbook(result_path)
    _perf["inspectMs"] = (time.perf_counter() - _t_inspect) * 1000
    result_output = inspected.get("sheets") or {}
    update_workbook_current_cache(output_wb_record, rows_only_sheets(result_output))
    previews = build_result_previews(input_previews, result_output, current, {}, [])
    download_urls = dict(input_download_urls)
    download_urls[output_file_id] = f"/api/workbooks/download/{result_id}"
    _perf["totalServerMs"] = (time.perf_counter() - _t0) * 1000
    _perf["finalizeMs"] = max(0.0, _perf["totalServerMs"] - _perf["openMs"] - _perf["resetMs"] - _perf["stepsMs"])
    _perf["mode"] = "worker-hidden"
    return {
        "ok": True,
        "pythonExcel": True,
        "snapshotHit": bool(resume_from),
        "snapshotStep": resume_from,
        "debugTimings": _perf,
        "diffId": None,
        "diffs": {},
        "forcedValueCells": [],
        "downloadId": result_id,
        "downloadUrl": f"/api/workbooks/download/{result_id}",
        "downloadUrls": download_urls,
        "files": previews,
        "activeSheet": active_output_sheet,
        "activeAddress": active_output_address,
    }


def run_excel_python_pipeline_payload(payload, job_id=None):
    return excel_call(_run_excel_python_pipeline_impl, payload, job_id, timeout=600)


def run_backend_pipeline_payload(payload, job_id=None):
    update_pipeline_job(job_id, {"stage": "입력 파일 읽는 중", "currentStep": 0})
    inputs = {}
    for idx, item in enumerate(payload.get("inputs", []), start=1):
        wb = get_workbook_or_raise(item.get("backendWorkbookId"))
        update_pipeline_job(job_id, {"stage": f"입력 파일 읽는 중 ({idx}/{len(payload.get('inputs', []))})"})
        inputs[item.get("name") or wb["name"]] = get_workbook_aoa_for_run(wb)

    update_pipeline_job(job_id, {"stage": "출력 템플릿 읽는 중"})
    output_item = payload.get("output") or {}
    output_wb = get_workbook_or_raise(output_item.get("backendWorkbookId")) if output_item.get("backendWorkbookId") else None
    output = get_workbook_aoa_for_run(output_wb) if output_wb else {}

    total_steps = len([s for s in payload.get("pipeline", []) if not (s and s.get("enabled") is False)])
    update_pipeline_job(job_id, {"stage": "스킬 실행 중", "currentStep": 0, "totalSteps": total_steps})
    result = run_js_pipeline_with_node({
        "inputs": inputs,
        "output": output,
        "pipeline": payload.get("pipeline", []),
    }, job_id=job_id)
    result_inputs = result.get("inputs") or inputs
    result_output = result.get("output") or output
    forced_value_cells = result.get("forcedValueCells") or []
    current = payload.get("current") or {}

    update_pipeline_job(job_id, {
        "stage": "diff 계산 중",
        "currentStep": total_steps,
        "completedSteps": total_steps,
        "totalSteps": total_steps,
        "stepRunning": False,
    })
    diffs = build_pipeline_diffs(inputs, output, result_inputs, result_output, current)
    diff_id = uuid.uuid4().hex
    DIFFS[diff_id] = {
        "id": diff_id,
        "created": time.time(),
        "diffs": diffs,
        "current": current,
    }

    update_pipeline_job(job_id, {"stage": "다운로드 준비 중", "currentStep": total_steps})
    download_urls = {}
    input_items = payload.get("inputs", [])
    for item in input_items:
        wb = get_workbook_or_raise(item.get("backendWorkbookId"))
        input_name = item.get("name") or wb["name"]
        if input_name not in result_inputs:
            continue
        input_download_id = uuid.uuid4().hex
        RESULTS[input_download_id] = {
            "template_path": str(wb["path"]),
            "sheets": result_inputs[input_name],
            "forced_value_cells": [cell for cell in forced_value_cells if cell.get("fileId") == "input:" + input_name],
            "name": f"result_{wb['name']}",
            "created": time.time(),
        }
        download_urls["input:" + input_name] = f"/api/workbooks/download/{input_download_id}"

    download_id = None
    if output_wb:
        output_file_id = (payload.get("current") or {}).get("outputFileId") or "output:0"
        download_id = uuid.uuid4().hex
        RESULTS[download_id] = {
            "template_path": str(output_wb["path"]),
            "sheets": result_output,
            "forced_value_cells": [cell for cell in forced_value_cells if cell.get("fileId") == output_file_id],
            "name": f"result_{output_wb['name']}",
            "created": time.time(),
        }
        download_urls[output_file_id] = f"/api/workbooks/download/{download_id}"

    update_pipeline_job(job_id, {"stage": "미리보기 생성 중"})
    previews = build_result_previews(result_inputs, result_output, current, diffs, forced_value_cells)
    return {
        "ok": True,
        "diffId": diff_id,
        "diffs": diffs,
        "forcedValueCells": forced_value_cells,
        "downloadId": download_id,
        "downloadUrl": f"/api/workbooks/download/{download_id}" if download_id else None,
        "downloadUrls": download_urls,
        "files": previews,
    }


def inspect_workbook(path):
    if is_csv_path(path):
        return inspect_csv_workbook(path)
    try:
        wb = openpyxl_load_workbook_compatible(path, read_only=True, data_only=False)
        cached_wb = openpyxl_load_workbook_compatible(path, read_only=True, data_only=True)
    except Exception as err:
        if excel_available():
            try:
                return inspect_workbook_with_excel(path, source_error=err)
            except Exception as excel_err:
                return inspect_workbook_fallback(path, f"{err}; excel: {excel_err}")
        return inspect_workbook_fallback(path, err)
    try:
        sheets = {}
        for ws in wb.worksheets:
            cached_ws = cached_wb[ws.title] if ws.title in cached_wb.sheetnames else None
            cached_rows = cached_ws.iter_rows(max_row=PREVIEW_ROWS, max_col=PREVIEW_COLS) if cached_ws else None
            rows = []
            formulas = {}
            original_formula_values = {}
            formats = []
            for row_idx, row in enumerate(ws.iter_rows(max_row=PREVIEW_ROWS, max_col=PREVIEW_COLS), start=1):
                try:
                    cached_row = next(cached_rows) if cached_rows else []
                except StopIteration:
                    cached_row = []
                values = []
                format_row = []
                for cell_idx, cell in enumerate(row):
                    if cell.data_type == "f":
                        cached_value = cached_row[cell_idx].value if cell_idx < len(cached_row) else None
                        json_cached = cell_to_json(cached_value)
                        values.append(json_cached if json_cached is not None else "")
                        formulas[cell.coordinate] = cell.value if str(cell.value).startswith("=") else "=" + str(cell.value)
                        if json_cached is not None:
                            original_formula_values[cell.coordinate] = json_cached
                    else:
                        values.append(cell_to_json(cell.value))
                    format_row.append(cell.number_format if cell.number_format else "")
                rows.append(values)
                formats.append(format_row)
            sheets[ws.title] = {
                "rows": rows,
                "formulas": formulas,
                "originalFormulaValues": original_formula_values,
                "formats": formats,
                "maxRow": ws.max_row or len(rows),
                "maxCol": ws.max_column or (max((len(r) for r in rows), default=0)),
            }
        return {"sheetNames": wb.sheetnames, "sheets": sheets}
    finally:
        wb.close()
        cached_wb.close()


def inspect_workbook_fallback(path, err=None):
    sheet_name = Path(path).stem or "Sheet1"
    return {
        "sheetNames": [sheet_name],
        "sheets": {
            sheet_name: {
                "rows": [],
                "formulas": {},
                "originalFormulaValues": {},
                "formats": [],
                "maxRow": 0,
                "maxCol": 0,
                "inspectError": str(err) if err else "",
            }
        },
        "inspectError": str(err) if err else "",
        "requiresExcel": True,
    }


def inspect_workbook_with_excel(path, source_error=None):
    if not excel_available():
        return inspect_workbook_fallback(path, source_error)
    app = win32com.client.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    app.EnableEvents = False
    try:
        app.AskToUpdateLinks = False
    except Exception:
        pass
    wb = None
    temp_path = None
    try:
        wb, temp_path = excel_workbooks_open(app, path, read_only=True)
        sheets = {}
        sheet_names = _excel_collection_names(wb.Worksheets)
        for sheet_idx in range(1, int(wb.Worksheets.Count) + 1):
            ws = wb.Worksheets(sheet_idx)
            sheet_name = str(ws.Name)
            try:
                used = ws.UsedRange
                used_rows = int(used.Rows.Count)
                used_cols = int(used.Columns.Count)
            except Exception:
                used_rows = 0
                used_cols = 0
            max_row = max(0, used_rows)
            max_col = max(0, used_cols)
            preview_rows = min(max_row, PREVIEW_ROWS)
            preview_cols = min(max_col, PREVIEW_COLS or 256)
            rows = []
            formulas = {}
            original_formula_values = {}
            formats = []
            if preview_rows and preview_cols:
                rng = ws.Range(ws.Cells(1, 1), ws.Cells(preview_rows, preview_cols))
                values = _range_matrix(rng.Value)
                for r_idx in range(preview_rows):
                    row_values = values[r_idx] if r_idx < len(values) else []
                    out_row = []
                    format_row = []
                    for c_idx in range(preview_cols):
                        value = row_values[c_idx] if c_idx < len(row_values) else ""
                        out_row.append(cell_to_json(value))
                        try:
                            cell = ws.Cells(r_idx + 1, c_idx + 1)
                            format_row.append(str(cell.NumberFormat or ""))
                            if bool(cell.HasFormula):
                                address = str(cell.Address(False, False))
                                formula = str(cell.Formula)
                                formulas[address] = formula if formula.startswith("=") else "=" + formula
                                original_formula_values[address] = cell_to_json(value)
                        except Exception:
                            format_row.append("")
                    rows.append(out_row)
                    formats.append(format_row)
            sheets[sheet_name] = {
                "rows": rows,
                "formulas": formulas,
                "originalFormulaValues": original_formula_values,
                "formats": formats,
                "maxRow": max_row,
                "maxCol": max_col,
            }
        return {
            "sheetNames": sheet_names,
            "sheets": sheets,
            "excelInspected": True,
            "sourceInspectError": str(source_error) if source_error else "",
        }
    finally:
        try:
            if wb is not None:
                wb.Close(SaveChanges=False)
        except Exception:
            pass
        try:
            app.Quit()
        except Exception:
            pass
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass


def load_workbook_aoa(path):
    if is_csv_path(path):
        return load_csv_aoa(path)
    try:
        wb = openpyxl_load_workbook_compatible(path, read_only=True, data_only=False)
    except Exception:
        if excel_available():
            return load_workbook_aoa_with_excel(path)
        raise
    try:
        data = {}
        for ws in wb.worksheets:
            rows = []
            for row in ws.iter_rows():
                values = ["" if cell.data_type == "f" else cell_to_json(cell.value) for cell in row]
                while values and values[-1] in ("", None):
                    values.pop()
                rows.append(values)
            data[ws.title] = rows
        return data
    finally:
        wb.close()


def load_workbook_aoa_with_excel(path):
    app = win32com.client.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    app.EnableEvents = False
    wb = None
    temp_path = None
    try:
        wb, temp_path = excel_workbooks_open(app, path, read_only=True)
        data = {}
        for sheet_idx in range(1, int(wb.Worksheets.Count) + 1):
            ws = wb.Worksheets(sheet_idx)
            try:
                used = ws.UsedRange
                rows = int(used.Rows.Count)
                cols = int(used.Columns.Count)
            except Exception:
                rows = 0
                cols = 0
            if rows <= 0 or cols <= 0:
                data[str(ws.Name)] = []
                continue
            values = _range_matrix(ws.Range(ws.Cells(1, 1), ws.Cells(rows, cols)).Value)
            out = []
            for row in values:
                row_values = [cell_to_json(value) for value in (row or [])]
                while row_values and row_values[-1] in ("", None):
                    row_values.pop()
                out.append(row_values)
            data[str(ws.Name)] = out
        return data
    finally:
        try:
            if wb is not None:
                wb.Close(SaveChanges=False)
        except Exception:
            pass
        try:
            app.Quit()
        except Exception:
            pass
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass


def is_csv_path(path):
    return Path(path).suffix.lower() in (".csv", ".tsv")


def csv_sheet_name(path):
    stem = Path(path).stem or "Sheet1"
    if len(stem) > 33 and stem[32] == "_":
        prefix = stem[:32]
        if all(ch in "0123456789abcdefABCDEF" for ch in prefix):
            stem = stem[33:] or stem
    return stem


def read_csv_text(path):
    raw = Path(path).read_bytes()
    for enc in ("utf-8-sig", "cp949", "euc-kr", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def read_csv_rows(path, max_rows=None):
    text = read_csv_text(path)
    sample = text[:4096]
    delimiter = "\t" if Path(path).suffix.lower() == ".tsv" else ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
    except csv.Error:
        dialect = csv.excel_tab if delimiter == "\t" else csv.excel
    rows = []
    for idx, row in enumerate(csv.reader(text.splitlines(), dialect)):
        if max_rows is not None and idx >= max_rows:
            break
        rows.append(["" if value is None else value for value in row])
    return rows


def inspect_csv_workbook(path):
    rows = read_csv_rows(path, PREVIEW_ROWS)
    sheet = csv_sheet_name(path)
    max_col = max((len(row or []) for row in rows), default=0)
    total_rows = 0
    try:
        with Path(path).open("rb") as f:
            for _ in f:
                total_rows += 1
    except OSError:
        total_rows = len(rows)
    return {
        "sheetNames": [sheet],
        "sheets": {
            sheet: {
                "rows": rows,
                "formulas": {},
                "originalFormulaValues": {},
                "formats": [],
                "maxRow": total_rows or len(rows),
                "maxCol": max_col,
            }
        },
    }


def load_csv_aoa(path):
    return {csv_sheet_name(path): read_csv_rows(path)}


def write_result_csv(result_path, sheets):
    sheet_name = next(iter((sheets or {}).keys()), csv_sheet_name(result_path))
    rows = (sheets or {}).get(sheet_name) or []
    with Path(result_path).open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        for row in rows:
            writer.writerow(["" if value is None else value for value in (row or [])])


def get_workbook_aoa_for_run(wb_record, base_mode="original"):
    with WORKBOOK_CACHE_LOCK:
        if base_mode == "current" and wb_record.get("current_aoa_cache") is not None:
            wb_record["aoa_cache_hits"] = int(wb_record.get("aoa_cache_hits") or 0) + 1
            return wb_record["current_aoa_cache"]
        cached = wb_record.get("aoa_cache")
        if cached is not None:
            wb_record["aoa_cache_hits"] = int(wb_record.get("aoa_cache_hits") or 0) + 1
            return cached

    if base_mode == "current" and wb_record.get("node_current"):
        sheets = export_node_worker_workbook(wb_record["id"])
        with WORKBOOK_CACHE_LOCK:
            wb_record["current_aoa_cache"] = sheets
            wb_record["aoa_cache_hits"] = int(wb_record.get("aoa_cache_hits") or 0) + 1
        return sheets

    loaded = load_workbook_aoa(Path(wb_record["path"]))
    with WORKBOOK_CACHE_LOCK:
        if wb_record.get("aoa_cache") is None:
            wb_record["aoa_cache"] = loaded
            wb_record["aoa_cache_created"] = time.time()
        else:
            loaded = wb_record["aoa_cache"]
        wb_record["aoa_cache_hits"] = int(wb_record.get("aoa_cache_hits") or 0) + 1
        return loaded


def update_workbook_current_cache(wb_record, sheets):
    if not wb_record or sheets is None:
        return
    with WORKBOOK_CACHE_LOCK:
        wb_record["current_aoa_cache"] = sheets
        wb_record["current_aoa_cache_created"] = time.time()


def _sheet_payload_rows(sheet_payload):
    if isinstance(sheet_payload, dict) and "rows" in sheet_payload:
        return sheet_payload.get("rows") or []
    return sheet_payload or []


def rows_only_sheets(sheets):
    return {
        name: _sheet_payload_rows(sheet_payload)
        for name, sheet_payload in (sheets or {}).items()
    }


def sheet_formula_maps(sheets, key):
    out = {}
    for name, sheet_payload in (sheets or {}).items():
        if isinstance(sheet_payload, dict) and key in sheet_payload:
            out[name] = sheet_payload.get(key) or {}
        else:
            out[name] = {}
    return out


def sheet_format_maps(sheets):
    out = {}
    for name, sheet_payload in (sheets or {}).items():
        if isinstance(sheet_payload, dict) and "formats" in sheet_payload:
            out[name] = sheet_payload.get("formats") or []
        else:
            out[name] = []
    return out


def write_result_workbook(template_path, result_path, sheets, forced_value_cells=None):
    if is_csv_path(template_path):
        write_result_csv(result_path, sheets)
        return
    forced_cells = {
        (str(cell.get("sheetName") or ""), int(cell.get("r") or 0) + 1, int(cell.get("c") or 0) + 1)
        for cell in (forced_value_cells or [])
        if isinstance(cell, dict) and cell.get("sheetName")
    }
    wb = openpyxl_load_workbook_compatible(template_path)
    try:
        for sheet_name, rows in (sheets or {}).items():
            ws = wb[sheet_name] if sheet_name in wb.sheetnames else wb.create_sheet(sheet_name)
            for r_idx, row in enumerate(rows or [], start=1):
                for c_idx, value in enumerate(row or [], start=1):
                    cell = ws.cell(row=r_idx, column=c_idx)
                    force_value = (sheet_name, r_idx, c_idx) in forced_cells
                    if cell.data_type == "f" and (value == "" or value is None) and not force_value:
                        continue
                    cell.value = value
        wb.save(result_path)
    finally:
        wb.close()


def cell_to_json(value):
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def recover_workbook_record(workbook_id):
    # 서버가 재시작되면 메모리 WORKBOOKS 가 비지만 업로드 파일(BACKEND_DIR/{id}_{name})은 디스크에 남는다.
    # 프런트의 기존 workbookId 로 요청이 오면 디스크에서 찾아 재등록해 "workbook not found" 를 막는다.
    if not workbook_id:
        return None
    rec = WORKBOOKS.get(workbook_id)
    if rec:
        return rec
    try:
        matches = sorted(BACKEND_DIR.glob(f"{workbook_id}_*"))
    except Exception:
        matches = []
    for path in matches:
        try:
            if not path.is_file():
                continue
        except Exception:
            continue
        name = path.name[len(workbook_id) + 1:] or path.name
        rec = {
            "id": workbook_id,
            "name": name,
            "path": str(path),
            "created": time.time(),
            "aoa_cache": None,
            "current_aoa_cache": None,
            "aoa_cache_created": None,
            "aoa_cache_hits": 0,
        }
        WORKBOOKS[workbook_id] = rec
        return rec
    return None


def get_workbook_or_raise(workbook_id):
    wb = recover_workbook_record(workbook_id)
    if not wb:
        raise ValueError(f"backend workbook not found: {workbook_id}")
    return wb


def run_js_pipeline_with_node(payload, job_id=None):
    progress_path = None
    if job_id:
        progress_file = tempfile.NamedTemporaryFile(prefix=f"b2b_pipeline_{job_id}_", suffix=".json", delete=False)
        progress_path = progress_file.name
        progress_file.close()
        payload = dict(payload)
        payload["progressPath"] = progress_path
    runner = r"""
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
const progressPath = payload.progressPath || "";
function writeProgress(info) {
  if (!progressPath) return;
  try {
    fs.writeFileSync(progressPath, JSON.stringify(info), "utf8");
  } catch (err) {}
}
const inputs = payload.inputs || {};
const output = payload.output || {};
function normalizeText(v) { return String(v ?? "").trim().toLowerCase().replace(/\s+/g, ""); }
function includesNormalizedText(v, s) { return normalizeText(v).includes(normalizeText(s)); }
function equalsNormalizedText(v, s) { return normalizeText(v) === normalizeText(s); }
function replaceNormalizedText(v) { return String(v ?? ""); }
function similarity(a, b) { a = normalizeText(a); b = normalizeText(b); if (!a || !b) return 0; return a === b ? 1 : (a.includes(b) || b.includes(a) ? 0.8 : 0); }
function headerRowIndex(sheetAoA) {
  let best = 0, bestScore = -1;
  for (let r = 0; r < Math.min((sheetAoA || []).length, 30); r++) {
    const row = sheetAoA[r] || [];
    const score = row.filter(v => String(v ?? "").trim()).length;
    if (score > bestScore) { best = r; bestScore = score; }
  }
  return best;
}
function dataStartRowIndex(sheetAoA) { return headerRowIndex(sheetAoA) + 1; }
function excelRowToIndex(n) { return Math.max(0, Number(n) - 1); }
function col(sheetAoA, name) {
  const h = headerRowIndex(sheetAoA);
  const row = sheetAoA[h] || [];
  const target = normalizeText(name);
  let fallback = -1;
  for (let i = 0; i < row.length; i++) {
    const cur = normalizeText(row[i]);
    if (cur === target) return i;
    if (fallback < 0 && cur && (cur.includes(target) || target.includes(cur))) fallback = i;
  }
  return fallback;
}
function findColumnGlobal(inputsMap, name) {
  const hits = [];
  Object.entries(inputsMap || {}).forEach(([file, sheets]) => {
    Object.entries(sheets || {}).forEach(([sheet, aoa]) => {
      const colIdx = col(aoa, name);
      if (colIdx >= 0) hits.push({ file, sheet, colIdx });
    });
  });
  return hits;
}
function fuzzyGetKey(target, prop) {
  if (!target || typeof target !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(target, prop)) return prop;
  const keys = Object.keys(target);
  if (keys.length === 1) return keys[0];
  const wanted = normalizeText(prop);
  let best = null;
  for (const key of keys) {
    const cur = normalizeText(key);
    if (cur === wanted || (cur && wanted && (cur.includes(wanted) || wanted.includes(cur)))) {
      best = key;
      break;
    }
  }
  return best;
}
function fuzzyProxy(target) {
  if (!target || typeof target !== "object") return target;
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === "symbol" || prop in t) return t[prop];
      const key = fuzzyGetKey(t, String(prop));
      return key ? t[key] : undefined;
    },
    set(t, prop, value) {
      if (typeof prop === "symbol" || Object.prototype.hasOwnProperty.call(t, prop)) {
        t[prop] = value;
        return true;
      }
      const key = fuzzyGetKey(t, String(prop));
      if (key && normalizeText(key) === normalizeText(prop)) t[key] = value;
      else t[prop] = value;
      return true;
    },
  });
}
let activeForcedValueCells = {};
let activeClearedValueCells = {};
let activeSheetProxyCache = new WeakMap();
let activeRowProxyCache = new WeakMap();
const activeOutputFileId = (payload.current && payload.current.outputFileId) || "output:0";
function forcedCellKey(fileId, sheetName, r, c) { return `${fileId}\u0000${sheetName}\u0000${r}\u0000${c}`; }
function addForcedValueCell(fileId, sheetName, r, c, value) {
  if (!fileId || !sheetName) return;
  activeForcedValueCells[forcedCellKey(fileId, sheetName, r, c)] = { fileId, sheetName, r, c, value };
}
function trackClearThenSet(fileId, sheetName, r, c, value) {
  if (!fileId || !sheetName) return;
  const key = forcedCellKey(fileId, sheetName, r, c);
  if (value === "") {
    activeClearedValueCells[key] = true;
    return;
  }
  if (activeClearedValueCells[key]) {
    delete activeClearedValueCells[key];
    addForcedValueCell(fileId, sheetName, r, c, value);
  }
}
function trackedRowProxy(row, fileId, sheetName, r) {
  if (!row || typeof row !== "object") return row;
  const key = `${fileId}\u0000${sheetName}\u0000${r}`;
  let cached = activeRowProxyCache.get(row);
  if (cached && cached[key]) return cached[key];
  if (!cached) { cached = {}; activeRowProxyCache.set(row, cached); }
  cached[key] = new Proxy(row, {
    set(target, prop, value) {
      target[prop] = value;
      const c = Number(prop);
      if (Number.isInteger(c) && c >= 0) trackClearThenSet(fileId, sheetName, r, c, value);
      return true;
    },
  });
  return cached[key];
}
function trackedSheetProxy(sheet, fileId, sheetName) {
  if (!sheet || typeof sheet !== "object") return sheet;
  const key = `${fileId}\u0000${sheetName}`;
  let cached = activeSheetProxyCache.get(sheet);
  if (cached && cached[key]) return cached[key];
  if (!cached) { cached = {}; activeSheetProxyCache.set(sheet, cached); }
  cached[key] = new Proxy(sheet, {
    get(target, prop) {
      const value = target[prop];
      const r = Number(prop);
      if (Number.isInteger(r) && r >= 0 && Array.isArray(value)) return trackedRowProxy(value, fileId, sheetName, r);
      return value;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  return cached[key];
}
function trackedSheetsProxy(sheets, fileId) {
  if (!sheets || typeof sheets !== "object") return sheets;
  return new Proxy(sheets, {
    get(target, prop) {
      if (typeof prop === "symbol") return target[prop];
      const key = Object.prototype.hasOwnProperty.call(target, prop) ? prop : fuzzyGetKey(target, String(prop));
      return key ? trackedSheetProxy(target[key], fileId, String(key)) : undefined;
    },
    set(target, prop, value) {
      if (typeof prop === "symbol" || Object.prototype.hasOwnProperty.call(target, prop)) target[prop] = value;
      else {
        const key = fuzzyGetKey(target, String(prop));
        if (key && normalizeText(key) === normalizeText(prop)) target[key] = value;
        else target[prop] = value;
      }
      return true;
    },
  });
}
const wrappedInputs = {};
Object.entries(inputs).forEach(([fileName, sheets]) => { wrappedInputs[fileName] = trackedSheetsProxy(sheets, `input:${fileName}`); });
const proxiedInputs = fuzzyProxy(wrappedInputs);
const proxiedOutput = trackedSheetsProxy(output, activeOutputFileId);
function findInputBySheet(inputsMap, sheetName, options) {
  options = options || {};
  const target = normalizeText(sheetName);
  const preferredFile = options.preferredFile ? normalizeText(options.preferredFile) : "";
  const matches = [];
  Object.entries(inputsMap || {}).forEach(([fileName, sheets]) => {
    Object.entries(sheets || {}).forEach(([sn, sheet]) => {
      if (normalizeText(sn) === target) matches.push({ fileName, file: sheets, sheetName: sn, sheet });
    });
  });
  if (!matches.length) return null;
  if (preferredFile) {
    const preferred = matches.find(item => normalizeText(item.fileName).includes(preferredFile) || preferredFile.includes(normalizeText(item.fileName)));
    if (preferred) return preferred;
  }
  return matches[0];
}
function resolveTargetSheets(fileRef) {
  if (fileRef === "output") return output;
  let key = String(fileRef || "");
  if (key.startsWith("input:")) key = key.slice(6);
  if (Object.prototype.hasOwnProperty.call(inputs, key)) return inputs[key];
  const fuzzyKey = fuzzyGetKey(inputs, key);
  return fuzzyKey ? inputs[fuzzyKey] : null;
}
function insertColumns(fileRef, sheetName, atColIdx, count) {
  const file = resolveTargetSheets(fileRef);
  if (!file) throw new Error(`insertColumns: file not found: ${fileRef}`);
  const sheet = file[sheetName];
  if (!sheet) throw new Error(`insertColumns: sheet not found: ${sheetName}`);
  const at = Math.max(0, Number(atColIdx) || 0);
  const n = Math.max(0, Number(count) || 0);
  if (!n) return;
  for (let r = 0; r < sheet.length; r++) {
    if (!sheet[r]) sheet[r] = [];
    while (sheet[r].length < at) sheet[r].push("");
    sheet[r].splice(at, 0, ...new Array(n).fill(""));
  }
}
function copyColumns(fileRef, sheetName, srcStart, srcCount, destStart) {
  const file = resolveTargetSheets(fileRef);
  if (!file) throw new Error(`copyColumns: file not found: ${fileRef}`);
  const sheet = file[sheetName];
  if (!sheet) throw new Error(`copyColumns: sheet not found: ${sheetName}`);
  const src = Math.max(0, Number(srcStart) || 0);
  const n = Math.max(0, Number(srcCount) || 0);
  const dest = Math.max(0, Number(destStart) || 0);
  if (!n) return;
  for (let r = 0; r < sheet.length; r++) {
    if (!sheet[r]) sheet[r] = [];
    const values = [];
    for (let c = 0; c < n; c++) values.push(sheet[r][src + c] !== undefined ? sheet[r][src + c] : "");
    while (sheet[r].length < dest) sheet[r].push("");
    for (let c = 0; c < n; c++) sheet[r][dest + c] = values[c];
  }
}
function deleteColumns(fileRef, sheetName, atColIdx, count) {
  const file = resolveTargetSheets(fileRef);
  if (!file) throw new Error(`deleteColumns: file not found: ${fileRef}`);
  const sheet = file[sheetName];
  if (!sheet) throw new Error(`deleteColumns: sheet not found: ${sheetName}`);
  const at = Math.max(0, Number(atColIdx) || 0);
  const n = Math.max(0, Number(count) || 0);
  if (!n) return;
  for (let r = 0; r < sheet.length; r++) {
    if (sheet[r]) sheet[r].splice(at, n);
  }
}
function shiftFormulaText(v) { return v; }
function fileIdForSetCellTarget(fileRef) {
  if (fileRef === "output") return activeOutputFileId;
  let key = String(fileRef || "");
  if (key.startsWith("input:")) return key;
  if (Object.prototype.hasOwnProperty.call(inputs, key)) return `input:${key}`;
  return "";
}
function setCellValue(fileRef, sheetName, r, c, value) {
  const file = resolveTargetSheets(fileRef);
  if (!file) throw new Error(`setCellValue: file not found: ${fileRef}`);
  if (!file[sheetName]) file[sheetName] = [];
  const rowIdx = Math.max(0, Number(r) || 0);
  const colIdx = Math.max(0, Number(c) || 0);
  if (!file[sheetName][rowIdx]) file[sheetName][rowIdx] = [];
  file[sheetName][rowIdx][colIdx] = value;
  addForcedValueCell(fileIdForSetCellTarget(fileRef), sheetName, rowIdx, colIdx, value);
  return value;
}
let activeStepIndex = 0;
const totalSteps = (payload.pipeline || []).filter(step => !(step && step.enabled === false)).length;
for (const step of payload.pipeline || []) {
  if (step && step.enabled === false) continue;
  writeProgress({
    stage: "스킬 실행 중",
    currentStep: activeStepIndex,
    completedSteps: activeStepIndex,
    totalSteps,
    stepRunning: true,
    stepDescription: (step && step.description) || `Step ${activeStepIndex + 1}`
  });
  try {
    const code = String((step && step.code) || "");
    const fn = new Function("inputs", "output", "col", "findColumnGlobal", "findInputBySheet", "similarity", "normalizeText", "replaceNormalizedText", "includesNormalizedText", "equalsNormalizedText", "headerRowIndex", "dataStartRowIndex", "excelRowToIndex", "insertColumns", "copyColumns", "deleteColumns", "shiftFormulaText", "setCellValue",
      code + "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };");
    const result = fn(proxiedInputs, proxiedOutput, col, findColumnGlobal, findInputBySheet, similarity, normalizeText, replaceNormalizedText, includesNormalizedText, equalsNormalizedText, headerRowIndex, dataStartRowIndex, excelRowToIndex, insertColumns, copyColumns, deleteColumns, shiftFormulaText, setCellValue);
    if (result && typeof result === "object" && !Array.isArray(result)) {
      if (result.inputs && result.inputs !== proxiedInputs && typeof result.inputs === "object") Object.assign(inputs, result.inputs);
      if (result.output && result.output !== proxiedOutput && typeof result.output === "object") Object.assign(output, result.output);
    }
  } catch (err) {
    const info = {
      stepIdx: activeStepIndex,
      stepId: step && step.id || null,
      description: step && step.description || "",
      code: step && step.code || "",
      message: err && err.message || String(err),
      stack: err && err.stack || "",
    };
    writeProgress({
      stage: "오류",
      currentStep: activeStepIndex,
      completedSteps: activeStepIndex,
      totalSteps,
      stepRunning: false,
      stepDescription: info.description || `Step ${activeStepIndex + 1}`,
      errorInfo: info,
      error: info.message,
    });
    process.stderr.write(JSON.stringify({ errorInfo: info, error: info.message }));
    process.exit(1);
  }
  activeStepIndex += 1;
  writeProgress({
    stage: "스킬 실행 중",
    currentStep: activeStepIndex,
    completedSteps: activeStepIndex,
    totalSteps,
    stepRunning: false,
    stepDescription: (step && step.description) || `Step ${activeStepIndex}`
  });
}
process.stdout.write(JSON.stringify({ inputs, output, forcedValueCells: Object.values(activeForcedValueCells) }));
"""
    stdout_file = tempfile.NamedTemporaryFile(prefix="b2b_pipeline_stdout_", suffix=".json", delete=False)
    stderr_file = tempfile.NamedTemporaryFile(prefix="b2b_pipeline_stderr_", suffix=".txt", delete=False)
    stdout_path = stdout_file.name
    stderr_path = stderr_file.name
    stdout_file.close()
    stderr_file.close()
    stdout_handle = open(stdout_path, "w+", encoding="utf-8")
    stderr_handle = open(stderr_path, "w+", encoding="utf-8")
    node_path = node_executable()
    if not node_path:
        raise RuntimeError("node runtime is not available")
    proc = subprocess.Popen(
        [node_path, "-e", runner],
        stdin=subprocess.PIPE,
        stdout=stdout_handle,
        stderr=stderr_handle,
        text=True,
        encoding="utf-8",
        **hidden_subprocess_kwargs(),
    )
    stdout = ""
    stderr = ""
    try:
        try:
            proc.stdin.write(json.dumps(payload, ensure_ascii=False))
            proc.stdin.close()
        except Exception:
            pass
        last_progress = None
        started = time.time()
        while proc.poll() is None:
            if time.time() - started > 300:
                proc.kill()
                raise TimeoutError("node pipeline timed out")
            if progress_path and os.path.exists(progress_path):
                try:
                    progress_mtime = os.path.getmtime(progress_path)
                    if progress_mtime != last_progress:
                        last_progress = progress_mtime
                        with open(progress_path, "r", encoding="utf-8") as f:
                            progress = json.load(f)
                        update_pipeline_job(job_id, progress)
                except Exception:
                    pass
            time.sleep(0.2)
        stdout_handle.seek(0)
        stderr_handle.seek(0)
        stdout = stdout_handle.read()
        stderr = stderr_handle.read()
    finally:
        try:
            stdout_handle.close()
            stderr_handle.close()
        except Exception:
            pass
        for temp_path in (stdout_path, stderr_path):
            try:
                os.unlink(temp_path)
            except OSError:
                pass
        if progress_path:
            try:
                os.unlink(progress_path)
            except OSError:
                pass
    if proc.returncode != 0:
        message = (stderr or "").strip() or "node pipeline failed"
        try:
            parsed_error = json.loads(message)
            info = parsed_error.get("errorInfo") or {}
            raise PipelineExecutionError(parsed_error.get("error") or info.get("message") or "node pipeline failed", info)
        except PipelineExecutionError:
            raise
        except Exception:
            pass
        raise RuntimeError(message)
    return json.loads(stdout)


def sheet_dimensions(sheets):
    dimensions = {}
    for name, sheet_payload in (sheets or {}).items():
        rows = _sheet_payload_rows(sheet_payload)
        if isinstance(sheet_payload, dict) and "rows" in sheet_payload:
            max_row = int(sheet_payload.get("maxRow") or len(rows or []))
            max_col = int(sheet_payload.get("maxCol") or max((len(row or []) for row in (rows or [])), default=0))
            preview_rows = min(len(rows or []), PREVIEW_ROWS)
            preview_cols = max((len(row or []) for row in (rows or [])[:PREVIEW_ROWS]), default=0)
            dimensions[name] = {
                "maxRow": max_row,
                "maxCol": max_col,
                "previewRows": preview_rows,
                "previewCols": preview_cols,
            }
            continue
        dimensions[name] = {
            "maxRow": len(rows or []),
            "maxCol": max((len(row or []) for row in (rows or [])), default=0),
            "previewRows": min(len(rows or []), PREVIEW_ROWS),
            "previewCols": max((len(row or []) for row in (rows or [])[:PREVIEW_ROWS]), default=0),
        }
    return dimensions


def build_result_previews(inputs, output, current, diffs=None, forced_value_cells=None):
    diffs = diffs or {}
    forced_value_cells = forced_value_cells or []
    files = []
    for name, sheets in (inputs or {}).items():
        file_id = "input:" + name
        files.append({
            "fileId": file_id,
            "name": name,
            "sheetNames": list((sheets or {}).keys()),
            "sheets": preview_sheets(sheets),
            "forcedValueCells": [cell for cell in forced_value_cells if cell.get("fileId") == file_id],
            "formulas": sheet_formula_maps(sheets, "formulas"),
            "originalFormulaValues": sheet_formula_maps(sheets, "originalFormulaValues"),
            "formats": sheet_format_maps(sheets),
            "dimensions": sheet_dimensions(sheets),
            "diff": diffs.get(file_id),
        })
    if output:
        output_file_id = current.get("outputFileId") or "output:0"
        files.append({
            "fileId": output_file_id,
            "name": "output",
            "sheetNames": list((output or {}).keys()),
            "sheets": preview_sheets(output),
            "forcedValueCells": [cell for cell in forced_value_cells if cell.get("fileId") == output_file_id],
            "formulas": sheet_formula_maps(output, "formulas"),
            "originalFormulaValues": sheet_formula_maps(output, "originalFormulaValues"),
            "formats": sheet_format_maps(output),
            "dimensions": sheet_dimensions(output),
            "diff": diffs.get(output_file_id),
        })
    return files


def preview_sheets(sheets):
    def preview_row(row):
        values = list(row or [])
        return values if PREVIEW_COLS is None else values[:PREVIEW_COLS]
    return {
        name: [preview_row(row) for row in _sheet_payload_rows(sheet_payload)[:PREVIEW_ROWS]]
        for name, sheet_payload in (sheets or {}).items()
    }


def diff_value(value):
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def compute_sheet_diff(before_rows, after_rows, max_cells=MAX_DIFF_CELLS_PER_SHEET):
    before_rows = before_rows or []
    after_rows = after_rows or []
    max_rows = max(len(before_rows), len(after_rows))
    cells = []
    changed_count = 0
    truncated = False
    for r_idx in range(max_rows):
        before_row = before_rows[r_idx] if r_idx < len(before_rows) and before_rows[r_idx] else []
        after_row = after_rows[r_idx] if r_idx < len(after_rows) and after_rows[r_idx] else []
        if before_row == after_row:
            continue
        max_cols = max(len(before_row), len(after_row))
        for c_idx in range(max_cols):
            before_value = diff_value(before_row[c_idx] if c_idx < len(before_row) else "")
            after_value = diff_value(after_row[c_idx] if c_idx < len(after_row) else "")
            if before_value == after_value:
                continue
            changed_count += 1
            if len(cells) < max_cells:
                cells.append({"r": r_idx, "c": c_idx, "value": after_value})
            else:
                truncated = True
                return {"cells": cells, "changedCount": changed_count, "truncated": truncated}
    return {"cells": cells, "changedCount": changed_count, "truncated": truncated}


def compute_workbook_diff(before_sheets, after_sheets):
    before_sheets = before_sheets or {}
    after_sheets = after_sheets or {}
    sheet_diffs = {}
    total_changed = 0
    truncated = False
    for sheet_name in sorted(set(before_sheets.keys()) | set(after_sheets.keys())):
        diff = compute_sheet_diff(before_sheets.get(sheet_name), after_sheets.get(sheet_name))
        if diff["changedCount"] or sheet_name not in before_sheets or sheet_name not in after_sheets:
            sheet_diffs[sheet_name] = diff
            total_changed += diff["changedCount"]
            truncated = truncated or diff["truncated"]
    return {"sheets": sheet_diffs, "changedCount": total_changed, "truncated": truncated}


def build_pipeline_diffs(before_inputs, before_output, after_inputs, after_output, current):
    diffs = {}
    for name in sorted(set((before_inputs or {}).keys()) | set((after_inputs or {}).keys())):
        file_id = "input:" + name
        diffs[file_id] = compute_workbook_diff((before_inputs or {}).get(name), (after_inputs or {}).get(name))
    output_file_id = (current or {}).get("outputFileId") or "output:0"
    if before_output or after_output:
        diffs[output_file_id] = compute_workbook_diff(before_output, after_output)
    return diffs


def ensure_node_worker():
    global NODE_WORKER, NODE_WORKER_SCRIPT_MTIME
    worker_path = app_base_dir() / "scripts" / "backend-pipeline-worker.js"
    worker_mtime = worker_path.stat().st_mtime if worker_path.exists() else None
    if NODE_WORKER and NODE_WORKER.poll() is None:
        if NODE_WORKER_SCRIPT_MTIME == worker_mtime:
            return NODE_WORKER
        try:
            NODE_WORKER.kill()
        except Exception:
            pass
        NODE_WORKER = None
        NODE_WORKER_READY.clear()
    worker_path = app_base_dir() / "scripts" / "backend-pipeline-worker.js"
    if not worker_path.exists():
        raise RuntimeError(f"backend worker not found: {worker_path}")
    node_path = node_executable()
    if not node_path:
        raise RuntimeError("node runtime is not available")
    NODE_WORKER = subprocess.Popen(
        [node_path, str(worker_path)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        bufsize=1,
        **hidden_subprocess_kwargs(),
    )
    NODE_WORKER_SCRIPT_MTIME = worker_mtime
    NODE_WORKER_READY.clear()
    return NODE_WORKER


def node_worker_command(command):
    command = dict(command)
    command["id"] = command.get("id") or uuid.uuid4().hex
    with NODE_WORKER_LOCK:
        worker = ensure_node_worker()
        line = json.dumps(command, ensure_ascii=False, separators=(",", ":")) + "\n"
        try:
            worker.stdin.write(line)
            worker.stdin.flush()
            response_line = worker.stdout.readline()
        except Exception:
            try:
                worker.kill()
            except Exception:
                pass
            raise
        if not response_line:
            raise RuntimeError("backend worker stopped")
        response = json.loads(response_line)
        if not response.get("ok"):
            info = response.get("errorInfo") or {}
            if info:
                raise PipelineExecutionError(response.get("error") or info.get("message") or "backend worker failed", info)
            raise RuntimeError(response.get("error") or "backend worker failed")
        return response


def ensure_worker_workbook(wb_record):
    if not wb_record:
        return
    workbook_id = wb_record["id"]
    if workbook_id in NODE_WORKER_READY:
        return
    sheets = get_workbook_aoa_for_run(wb_record, "original")
    current_sheets = wb_record.get("current_aoa_cache")
    node_worker_command({
        "type": "initWorkbook",
        "workbookId": workbook_id,
        "sheets": sheets,
        "currentSheets": current_sheets,
    })
    NODE_WORKER_READY.add(workbook_id)


def export_node_worker_workbook(workbook_id):
    response = node_worker_command({
        "type": "exportWorkbook",
        "payload": {"workbookId": workbook_id},
    })
    return response.get("sheets") or {}


def run_backend_pipeline_payload_with_worker(payload, job_id=None):
    debug_started = time.perf_counter()
    timings = {}
    if os.environ.get("B2B_DISABLE_NODE_WORKER") == "1":
        raise RuntimeError("node worker disabled")
    input_items = payload.get("inputs", [])
    output_item = payload.get("output") or {}
    input_wbs = []
    stage_started = time.perf_counter()
    for idx, item in enumerate(input_items, start=1):
        wb = get_workbook_or_raise(item.get("backendWorkbookId"))
        update_pipeline_job(job_id, {"stage": f"Node 캐시 준비 중 ({idx}/{len(input_items)})"})
        ensure_worker_workbook(wb)
        input_wbs.append((item, wb))
    timings["prepareInputsMs"] = round((time.perf_counter() - stage_started) * 1000, 2)

    output_wb = None
    stage_started = time.perf_counter()
    if output_item.get("backendWorkbookId"):
        update_pipeline_job(job_id, {"stage": "Node 출력 캐시 준비 중"})
        output_wb = get_workbook_or_raise(output_item.get("backendWorkbookId"))
        ensure_worker_workbook(output_wb)
    timings["prepareOutputMs"] = round((time.perf_counter() - stage_started) * 1000, 2)

    active_steps = [s for s in payload.get("pipeline", []) if not (s and s.get("enabled") is False)]
    total_steps = len(active_steps)
    update_pipeline_job(job_id, {
        "stage": "Node 캐시에서 스킬 실행 중",
        "currentStep": 0,
        "completedSteps": 0,
        "totalSteps": total_steps,
        "stepRunning": True,
    })

    worker_payload = {
        "inputs": [
            {
                "name": item.get("name") or wb["name"],
                "backendWorkbookId": wb["id"],
            }
            for item, wb in input_wbs
        ],
        "output": {
            "name": output_item.get("name") or output_wb["name"],
            "backendWorkbookId": output_wb["id"],
        } if output_wb else None,
        "pipeline": payload.get("pipeline", []),
        "baseMode": payload.get("baseMode") or "original",
        "current": payload.get("current") or {},
    }
    stage_started = time.perf_counter()
    response = node_worker_command({
        "type": "runPipeline",
        "payload": worker_payload,
    })
    timings["workerRunAndPreviewMs"] = round((time.perf_counter() - stage_started) * 1000, 2)
    timings["workerCacheHit"] = bool(response.get("cacheHit"))

    update_pipeline_job(job_id, {
        "stage": "미리보기 반영 중",
        "currentStep": total_steps,
        "completedSteps": total_steps,
        "totalSteps": total_steps,
        "stepRunning": False,
    })

    files = response.get("files") or []
    diffs = response.get("diffs") or {}
    forced_value_cells = response.get("forcedValueCells") or []
    if not forced_value_cells:
        for file_result in files:
            forced_value_cells.extend(file_result.get("forcedValueCells") or [])
    stage_started = time.perf_counter()
    diff_id = uuid.uuid4().hex
    DIFFS[diff_id] = {
        "id": diff_id,
        "created": time.time(),
        "diffs": diffs,
        "current": payload.get("current") or {},
    }
    timings["storeDiffMs"] = round((time.perf_counter() - stage_started) * 1000, 2)

    stage_started = time.perf_counter()
    download_urls = {}
    input_wb_by_name = {item.get("name") or wb["name"]: wb for item, wb in input_wbs}
    for file_result in files:
        file_id = file_result.get("fileId")
        worker_workbook_id = file_result.get("workerWorkbookId")
        if not file_id or not worker_workbook_id:
            continue
        if file_id.startswith("input:"):
            input_name = file_id[6:]
            wb = input_wb_by_name.get(input_name) or get_workbook_or_raise(worker_workbook_id)
            wb["node_current"] = True
            result_id = uuid.uuid4().hex
            RESULTS[result_id] = {
                "template_path": str(wb["path"]),
                "workerWorkbookId": worker_workbook_id,
                "forced_value_cells": file_result.get("forcedValueCells") or [],
                "name": f"result_{wb['name']}",
                "created": time.time(),
            }
            download_urls[file_id] = f"/api/workbooks/download/{result_id}"
        elif output_wb:
            output_wb["node_current"] = True
            result_id = uuid.uuid4().hex
            RESULTS[result_id] = {
                "template_path": str(output_wb["path"]),
                "workerWorkbookId": worker_workbook_id,
                "forced_value_cells": file_result.get("forcedValueCells") or [],
                "name": f"result_{output_wb['name']}",
                "created": time.time(),
            }
            download_urls[file_id] = f"/api/workbooks/download/{result_id}"
    timings["downloadRegistrationMs"] = round((time.perf_counter() - stage_started) * 1000, 2)
    timings["totalServerMs"] = round((time.perf_counter() - debug_started) * 1000, 2)

    return {
        "ok": True,
        "worker": True,
        "cacheHit": bool(response.get("cacheHit")),
        "debugTimings": timings,
        "diffId": diff_id,
        "diffs": diffs,
        "downloadId": None,
        "downloadUrl": None,
        "downloadUrls": download_urls,
        "forcedValueCells": forced_value_cells,
        "files": files,
    }


# openpyxl 저장/읽기로 손상·오작동할 수 있는 요소의 zip 내부 경로.
_OPXL_UNSAFE_OBJECT_LABELS = {
    "xl/charts/": "차트",
    "xl/drawings/": "도형/이미지",
    "xl/media/": "이미지",
    "xl/pivotTables/": "피벗테이블",
    "xl/slicers/": "슬라이서",
    "xl/timelines/": "타임라인",
}


def _xlsx_object_reason(path):
    """openpyxl 로 다시 저장하면 유실되는 '객체'가 있으면 사유, 없으면 빈 문자열.
    (차트/이미지/피벗/슬라이서/타임라인/매크로) — 출력 저장 시에만 문제가 된다.
    수식은 트리거가 아니다: 입력은 계산값으로 읽고, 출력은 수식을 보존(Excel 이 재계산)하기 때문."""
    p = Path(path)
    try:
        if not zipfile.is_zipfile(p):
            return ""
        with zipfile.ZipFile(p) as z:
            for n in z.namelist():
                if n == "xl/vbaProject.bin":
                    return "매크로(VBA)"
                for prefix, label in _OPXL_UNSAFE_OBJECT_LABELS.items():
                    if n.startswith(prefix):
                        return label
    except Exception:
        return ""
    return ""


def _xlsx_has_merged_cells(path):
    p = Path(path)
    try:
        if not zipfile.is_zipfile(p):
            return False
        with zipfile.ZipFile(p) as z:
            for n in z.namelist():
                if not (n.startswith("xl/worksheets/") and n.endswith(".xml")):
                    continue
                try:
                    data = z.read(n, 2000000)
                except TypeError:
                    data = z.read(n)
                if b"<mergeCell" in data or b"<mergeCells" in data:
                    return True
    except Exception:
            return False
    return False


def _xlsx_has_formulas(path):
    p = Path(path)
    try:
        if not zipfile.is_zipfile(p):
            return False
        with zipfile.ZipFile(p) as z:
            for n in z.namelist():
                if not (n.startswith("xl/worksheets/") and n.endswith(".xml")):
                    continue
                try:
                    data = z.read(n, 2000000)
                except TypeError:
                    data = z.read(n)
                if b"<f" in data:
                    return True
    except Exception:
        return False
    return False


def _python_step_requests_excel_com(step):
    code = normalize_python_pipeline_code(str((step or {}).get("code") or ""))
    if re.search(r"B2B_(?:ENGINE_FALLBACK|FORCE_ENGINE)\s*:\s*excel[-_ ]?com", code, re.I):
        return "명시적 Excel COM 요청"
    return ""


def _python_step_has_structural_or_format_operation(step):
    code = normalize_python_pipeline_code(str((step or {}).get("code") or ""))
    patterns_ci = [
        r"\binsert_cols\s*\(",
        r"\binsert_rows\s*\(",
        r"\bdelete_cols\s*\(",
        r"\bdelete_rows\s*\(",
        r"\bmove_range\s*\(",
        r"\bmerge_cells\s*\(",
        r"\bunmerge_cells\s*\(",
        r"\bcopy_worksheet\s*\(",
        r"\.Copy\s*\(",
        r"\.PasteSpecial\s*\(",
        r"\.EntireColumn\b",
        r"\.EntireRow\b",
        r"\.Insert\b",
        r"\.Delete\b",
    ]
    if any(re.search(pat, code, re.I) for pat in patterns_ci):
        return True
    # COM-only properties must stay case-sensitive so ctx.rows(...) is not mistaken for ws.Rows(...).
    patterns_case_sensitive = [
        r"\.Columns\s*\(",
        r"\.Rows\s*\(",
    ]
    return any(re.search(pat, code) for pat in patterns_case_sensitive)


def _python_step_has_values_only_formula_copy_risk(step):
    code = normalize_python_pipeline_code(str((step or {}).get("code") or ""))
    text = "\n".join([
        str((step or {}).get("description") or ""),
        str((step or {}).get("prompt") or ""),
        code,
    ])
    if not re.search(r"(값만|보이는\s*값|계산(?:된)?\s*값|수식\s*(?:말고|빼고|제외|없이)|values?\s*only|paste\s*values?)", text, re.I):
        return False
    # ctx.value/display_value/display_rows 는 openpyxl 에서도 수식 표시값을 계산/조회하는 안전 경로.
    if re.search(r"\bctx\.(?:value|display_value|display_rows)\s*\(", code):
        return False
    if re.search(r"\.value\b", code, re.I) and (re.search(r"\.value\s*=", code, re.I) or re.search(r"\bctx\.(?:write_grid|set_range)\s*\(", code)):
        return True
    if re.search(r"\bctx\.rows\s*\(", code) and re.search(r"\bctx\.(?:write_grid|set_range)\s*\(", code):
        return True
    return False


def _pipeline_payload_needs_com(payload):
    """openpyxl 엔진이 안전하지 않으면 사유 문자열을 반환(없으면 "").
    - 출력에 객체(차트/이미지/피벗/매크로)가 있으면 저장 시 유실 → COM.
    - 출력/입력 중 CSV 가 있으면 openpyxl 로 못 여므로 → COM.
    - 병합셀이 있는 출력에서 구조 변경/서식 복붙은 Excel 방식 보정이 필요 → COM.
    - 수식은 트리거 아님(입력=계산값 읽기, 출력=수식 보존+Excel 재계산)."""
    active_steps = [s for s in (payload.get("pipeline") or []) if not (s and s.get("enabled") is False)]
    python_steps = [s for s in active_steps if is_python_pipeline_step(s)]
    for step in python_steps:
        reason = _python_step_requests_excel_com(step)
        if reason:
            return reason
    out = payload.get("output") or {}
    out_wid = out.get("backendWorkbookId")
    output_has_merged_cells = False
    output_has_formulas = False
    if out_wid:
        try:
            rec = get_workbook_or_raise(out_wid)
            if is_csv_path(rec["path"]):
                return f"{out.get('name') or rec.get('name') or '출력'}: CSV"
            reason = _xlsx_object_reason(rec["path"])
            if reason:
                return f"{out.get('name') or rec.get('name') or '출력'}: {reason}"
            output_has_merged_cells = _xlsx_has_merged_cells(rec["path"])
            output_has_formulas = _xlsx_has_formulas(rec["path"])
        except Exception:
            pass
    if output_has_formulas and any(_python_step_has_values_only_formula_copy_risk(s) for s in python_steps):
        return "수식 셀 값만 복사: Excel 계산값 필요"
    if output_has_merged_cells and any(_python_step_has_structural_or_format_operation(s) for s in python_steps):
        return "병합셀 포함 파일의 구조 변경/서식 복사"
    for it in (payload.get("inputs") or []):
        wid = it.get("backendWorkbookId")
        if not wid:
            continue
        try:
            rec = get_workbook_or_raise(wid)
            if is_csv_path(rec["path"]):
                return f"{it.get('name') or rec.get('name') or '입력'}: CSV"
        except Exception:
            continue
    return ""


def run_backend_pipeline_payload(payload, job_id=None):
    if pipeline_has_python(payload):
        # 엔진 선택: 기본 "python"(openpyxl, COM 없이 인프로세스 — 빠름) / 보조 "excel"(COM Python).
        engine = str(payload.get("engine") or "python").lower()
        if engine in ("python", "openpyxl") and openpyxl is not None:
            # 안전장치: 차트/이미지/피벗/매크로/CSV/병합셀 구조변경 등이 있으면 객체 유실·계산오류를 막기 위해
            # 이 실행만 자동으로 Excel(COM) 엔진으로 전환한다.
            com_reason = _pipeline_payload_needs_com(payload)
            if com_reason:
                update_pipeline_job(job_id, {"stage": f"호환성 보호: Excel 엔진으로 전환 ({com_reason})"})
                res = run_excel_python_pipeline_payload(payload, job_id=job_id)
                if isinstance(res, dict):
                    res["engineFallback"] = "excel"
                    res["engineFallbackReason"] = com_reason
                return res
            return run_openpyxl_python_pipeline_payload(payload, job_id=job_id)
        return run_excel_python_pipeline_payload(payload, job_id=job_id)
    try:
        return run_backend_pipeline_payload_with_worker(payload, job_id=job_id)
    except PipelineExecutionError:
        raise
    except Exception as worker_err:
        NODE_WORKER_READY.clear()
        update_pipeline_job(job_id, {"stage": f"Node worker fallback: {worker_err}"})

    input_items = payload.get("inputs", [])
    base_mode = payload.get("baseMode") or "original"
    update_pipeline_job(job_id, {
        "stage": "입력 파일 읽는 중",
        "currentStep": 0,
        "completedSteps": 0,
        "stepRunning": False,
    })
    inputs = {}
    for idx, item in enumerate(input_items, start=1):
        wb = get_workbook_or_raise(item.get("backendWorkbookId"))
        update_pipeline_job(job_id, {"stage": f"입력 파일 읽는 중 ({idx}/{len(input_items)})"})
        inputs[item.get("name") or wb["name"]] = get_workbook_aoa_for_run(wb, base_mode)

    update_pipeline_job(job_id, {"stage": "출력 템플릿 읽는 중"})
    output_item = payload.get("output") or {}
    output_wb = get_workbook_or_raise(output_item.get("backendWorkbookId")) if output_item.get("backendWorkbookId") else None
    output = get_workbook_aoa_for_run(output_wb, base_mode) if output_wb else {}

    active_steps = [s for s in payload.get("pipeline", []) if not (s and s.get("enabled") is False)]
    total_steps = len(active_steps)
    update_pipeline_job(job_id, {
        "stage": "스킬 실행 중",
        "currentStep": 0,
        "completedSteps": 0,
        "totalSteps": total_steps,
        "stepRunning": False,
    })
    result = run_js_pipeline_with_node({
        "inputs": inputs,
        "output": output,
        "pipeline": payload.get("pipeline", []),
    }, job_id=job_id)
    result_inputs = result.get("inputs") or inputs
    result_output = result.get("output") or output
    forced_value_cells = result.get("forcedValueCells") or []
    current = payload.get("current") or {}

    update_pipeline_job(job_id, {
        "stage": "diff 계산 중",
        "currentStep": total_steps,
        "completedSteps": total_steps,
        "totalSteps": total_steps,
        "stepRunning": False,
    })
    diffs = build_pipeline_diffs(inputs, output, result_inputs, result_output, current)
    diff_id = uuid.uuid4().hex
    DIFFS[diff_id] = {
        "id": diff_id,
        "created": time.time(),
        "diffs": diffs,
        "current": current,
    }

    update_pipeline_job(job_id, {
        "stage": "다운로드 준비 중",
        "currentStep": total_steps,
        "completedSteps": total_steps,
        "totalSteps": total_steps,
        "stepRunning": False,
    })
    download_urls = {}
    for item in input_items:
        wb = get_workbook_or_raise(item.get("backendWorkbookId"))
        input_name = item.get("name") or wb["name"]
        if input_name not in result_inputs:
            continue
        update_workbook_current_cache(wb, result_inputs[input_name])
        input_download_id = uuid.uuid4().hex
        RESULTS[input_download_id] = {
            "template_path": str(wb["path"]),
            "sheets": result_inputs[input_name],
            "forced_value_cells": [cell for cell in forced_value_cells if cell.get("fileId") == "input:" + input_name],
            "name": f"result_{wb['name']}",
            "created": time.time(),
        }
        download_urls["input:" + input_name] = f"/api/workbooks/download/{input_download_id}"

    download_id = None
    if output_wb:
        output_file_id = (payload.get("current") or {}).get("outputFileId") or "output:0"
        update_workbook_current_cache(output_wb, result_output)
        download_id = uuid.uuid4().hex
        RESULTS[download_id] = {
            "template_path": str(output_wb["path"]),
            "sheets": result_output,
            "forced_value_cells": [cell for cell in forced_value_cells if cell.get("fileId") == output_file_id],
            "name": f"result_{output_wb['name']}",
            "created": time.time(),
        }
        download_urls[output_file_id] = f"/api/workbooks/download/{download_id}"

    update_pipeline_job(job_id, {
        "stage": "미리보기 생성 중",
        "currentStep": total_steps,
        "completedSteps": total_steps,
        "totalSteps": total_steps,
        "stepRunning": False,
    })
    previews = build_result_previews(result_inputs, result_output, current, diffs, forced_value_cells)
    return {
        "ok": True,
        "diffId": diff_id,
        "diffs": diffs,
        "forcedValueCells": forced_value_cells,
        "downloadId": download_id,
        "downloadUrl": f"/api/workbooks/download/{download_id}" if download_id else None,
        "downloadUrls": download_urls,
        "files": previews,
    }


if __name__ == "__main__":
    with B2BThreadingTCPServer((HOST, PORT), B2BHandler) as httpd:
        print(f"B2B serving on http://{HOST}:{PORT}")
        print(f"Proxying /v1/* to {VLLM_BASE}/v1/*")
        httpd.serve_forever()
