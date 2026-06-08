#!/usr/bin/env python3
import http.server
import atexit
import csv
import ctypes
import datetime
import hashlib
import io
import json
import math
import os
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
PYTHON_SKILL_APP = None  # 라이브 미러가 없을 때 Python 스킬 실행용으로 재사용하는 숨김 Excel 인스턴스
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
    for session in sessions:
        pid = session.get("pid")
        try:
            app, wb = session_workbook(session)
            wb.Close(SaveChanges=False)
            if app.Workbooks.Count == 0:
                app.Quit()
        except Exception:
            pass
        if pid:
            deadline = time.time() + 1.5
            while time.time() < deadline and _is_pid_alive(pid):
                time.sleep(0.1)
            if _is_pid_alive(pid):
                _force_kill_pid(pid)
        temp_path = session.get("openTempPath")
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass


atexit.register(cleanup_node_worker)
atexit.register(cleanup_excel_sessions)


class PipelineExecutionError(RuntimeError):
    def __init__(self, message, info=None):
        if info is None and isinstance(message, dict):
            info = message
            message = info.get("message") or info.get("error") or "pipeline step failed"
        super().__init__(message)
        self.info = info or {}


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
        if self.path == "/api/excel/hover-info":
            self.handle_excel_hover_info()
            return
        if self.path == "/api/excel/close":
            self.handle_excel_close()
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
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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
            self.send_json(replace_excel_session_workbook(
                payload.get("excelId"),
                path,
                name=path.name,
                result_id=result_id,
                read_only_mirror=bool(payload.get("readOnlyMirror")),
            ))
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
            self.send_json(hide_excel_session(payload.get("excelId")))
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
            return app.Workbooks.Open(str(open_path), **kwargs), temp_path
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
def _ensure_excel_workbook_view(app, wb=None, make_visible=True, activate=True, maximize_workbook=True):
    try:
        if make_visible:
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
        app.WindowState = -4143  # xlNormal: keep the outer Excel window at the mirror panel size.
    except Exception:
        pass
    try:
        win = wb.Windows(1) if wb is not None else app.ActiveWindow
        if win is not None:
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
        hwnd = int(app.Hwnd)
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
                try:
                    ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
                    desired_ex_style = (ex_style | getattr(win32con, "WS_EX_TOOLWINDOW", 0)) & ~getattr(win32con, "WS_EX_APPWINDOW", 0)
                    if desired_ex_style != ex_style:
                        win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, desired_ex_style)
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
                    win32gui.SetParent(hwnd, parent_hwnd)
                    left, top = win32gui.ScreenToClient(parent_hwnd, (left, top))
            except Exception:
                pass
        flags = win32con.SWP_NOOWNERZORDER | win32con.SWP_FRAMECHANGED
        if native_parent_hwnd or not (show and native_overlay):
            flags |= win32con.SWP_NOACTIVATE
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
                if native_parent_hwnd:
                    win32gui.ShowWindow(hwnd, getattr(win32con, "SW_SHOWNA", 8))
                    _focus_excel_grid_child(hwnd)
                else:
                    win32gui.ShowWindow(hwnd, win32con.SW_SHOWNORMAL)
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


def _raise_excel_window(app):
    if win32gui is None or win32con is None:
        return
    try:
        hwnd = int(app.Hwnd)
        if not win32gui.IsWindow(hwnd):
            return
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
):
    if not excel_available():
        raise RuntimeError("Microsoft Excel COM automation is not available. Excel and pywin32 are required.")
    path = Path(path)
    if not path.exists():
        raise RuntimeError(f"file not found: {path}")
    with EXCEL_LOCK:
        browser_hwnd = None if (native_parent_hwnd or native_overlay) else (_capture_browser_hwnd(browser_title) if read_only_mirror else None)
        app = win32com.client.DispatchEx("Excel.Application")
        app.Visible = False if read_only_mirror else True
        app.DisplayAlerts = False
        app.EnableEvents = False
        if read_only_mirror:
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
        wb = None
        open_temp_path = None
        try:
            wb, open_temp_path = excel_workbooks_open(app, path, read_only=bool(read_only_mirror))
            app_pid = _excel_process_id(app)
            excel_id = uuid.uuid4().hex
            sheets = _excel_collection_names(wb.Worksheets)
            if read_only_mirror:
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
                "pid": app_pid,
                "path": str(path),
                "openPath": str(wb.FullName),
                "openTempPath": str(open_temp_path) if open_temp_path else "",
                "name": name or path.name,
                "workbookId": workbook_id,
                "resultId": result_id,
                "readOnlyMirror": bool(read_only_mirror),
                "browserHwnd": browser_hwnd,
                "nativeParentHwnd": None if native_overlay else native_parent_hwnd,
                "nativeHostHwnd": native_host_hwnd,
                "nativeOverlay": bool(native_overlay),
                "hidden": False,
                "lastNativePositionKey": (
                    f"{'overlay' if native_overlay else native_parent_hwnd}:{int(float(left or 0))}:{int(float(top or 0))}:{int(float(width or 0))}:{int(float(height or 0))}"
                    if read_only_mirror and (native_parent_hwnd or native_overlay) and width and height
                    else ""
                ),
                "created": time.time(),
            }
            if not read_only_mirror:
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
            }
        except Exception:
            try:
                if wb is not None:
                    wb.Close(SaveChanges=False)
            except Exception:
                pass
            try:
                app.Quit()
            except Exception:
                pass
            if open_temp_path:
                try:
                    Path(open_temp_path).unlink(missing_ok=True)
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
        if read_only_mirror:
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
        if read_only_mirror:
            try:
                app.ScreenUpdating = False
            except Exception:
                pass
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
        else:
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
                if next_native_overlay:
                    _ensure_excel_workbook_view(app, wb, make_visible=True, activate=False, maximize_workbook=False)
                    _position_excel_window(
                        app,
                        left,
                        top,
                        width,
                        height,
                        native_parent_hwnd=None,
                        native_host_hwnd=next_native_host_hwnd,
                        native_overlay=True,
                        viewport_width=viewport_width,
                        viewport_height=viewport_height,
                        show=True,
                    )
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
        )
        if native_position_key:
            session["lastNativePositionKey"] = native_position_key
        session["hidden"] = False
        if session.get("readOnlyMirror"):
            _ensure_excel_workbook_view(
                app,
                wb,
                make_visible=True,
                activate=False if (session.get("nativeParentHwnd") or session.get("nativeOverlay")) else True,
                maximize_workbook=False if (session.get("nativeOverlay") or session.get("nativeParentHwnd")) else True,
            )
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
        if session.get("readOnlyMirror"):
            _raise_excel_window(app)
        return {"ok": True, "excelId": excel_id}


def _hide_excel_session_impl(excel_id):
    with EXCEL_LOCK:
        session = get_excel_session(excel_id)
        app, wb = session_workbook(session)
        _hide_excel_app_window(app)
        session["hidden"] = True
        session["lastNativePositionKey"] = ""
        return {"ok": True, "excelId": excel_id, "hidden": True}


def _hide_all_excel_sessions_impl():
    hidden = 0
    with EXCEL_LOCK:
        sessions = list(EXCEL_SESSIONS.values())
    for session in sessions:
        try:
            app, wb = session_workbook(session)
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
    try:
        app, wb = session_workbook(session)
        wb.Close(SaveChanges=False)
        if app.Workbooks.Count == 0:
            app.Quit()
    except Exception:
        pass
    if pid:
        deadline = time.time() + 1.5
        while time.time() < deadline and _is_pid_alive(pid):
            time.sleep(0.1)
        if _is_pid_alive(pid):
            _force_kill_pid(pid)
    temp_path = session.get("openTempPath")
    if temp_path:
        try:
            Path(temp_path).unlink(missing_ok=True)
        except Exception:
            pass
    return {"ok": True, "closed": True}


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


def _active_sheet_snapshot(wb):
    ws = wb.Application.ActiveSheet
    if ws is None:
        names = _excel_collection_names(wb.Worksheets)
        if not names:
            raise RuntimeError("no visible worksheet")
        ws = wb.Worksheets(names[0])
        ws.Activate()
    return ws.Name, _sheet_snapshot(ws)


def _left_mouse_button_down():
    if os.name != "nt":
        return False
    try:
        return bool(ctypes.windll.user32.GetAsyncKeyState(0x01) & 0x8000)
    except Exception:
        return False


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
        if session.get("readOnlyMirror"):
            if _left_mouse_button_down():
                return {
                    "ok": True,
                    "excelId": excel_id,
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
                "sheet": ws.Name,
                "address": active_address,
                "changes": [],
                "readOnlyMirror": True,
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
        timeout=60,
    )


def raise_excel_session(excel_id):
    return excel_call(_raise_excel_session_impl, excel_id, timeout=60)


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
    return "\n".join(normalized).strip() + "\n"


def pipeline_has_python(payload):
    active_steps = [step for step in (payload.get("pipeline") or []) if not (step and step.get("enabled") is False)]
    if any(is_python_pipeline_step(step) for step in active_steps):
        return True
    current = payload.get("current") or {}
    return bool(current.get("outputExcelId")) and not active_steps


def _excel_names(collection):
    return _excel_collection_names(collection)


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

    def sheet_like(self, name=None):
        return self._ctx.sheet_like(name, workbook=self)

    def range(self, sheet_or_name, address):
        return self._ctx.range(sheet_or_name, address, workbook=self)

    def rows(self, sheet_or_name=None):
        return self._ctx.rows(sheet_or_name, workbook=self)

    def col(self, sheet_or_name, header, header_rows=20):
        return self._ctx.col(sheet_or_name, header, workbook=self, header_rows=header_rows)

    def header_row(self, sheet_or_name=None, header_rows=20):
        return self._ctx.header_row(sheet_or_name, workbook=self, header_rows=header_rows)


class ExcelSkillContext:
    def __init__(self, app, output_wb, input_wbs):
        self.excel = app
        self._workbook = output_wb
        self.workbook = ExcelWorkbookProxy(self, output_wb, "output")
        self.output = self.workbook
        self.last_output_sheet = None
        self.last_output_address = None
        self.inputs = {
            name: ExcelWorkbookProxy(self, wb, name)
            for name, wb in (input_wbs or {}).items()
        }

    def _unwrap_workbook(self, wb):
        return wb.raw if isinstance(wb, ExcelWorkbookProxy) else wb

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
        for sheet_name in names:
            if self.normalize(sheet_name) == norm:
                return sheet_name
        for sheet_name in names:
            sheet_norm = self.normalize(sheet_name)
            if norm in sheet_norm or sheet_norm in norm:
                return sheet_name
        if allow_single and len(names) == 1:
            return names[0]
        return None

    def sheet(self, name=None, workbook=None):
        wb = self._unwrap_workbook(workbook or self.workbook)
        sheet_name = self._find_sheet_name(wb, name)
        if not sheet_name:
            raise RuntimeError(f"sheet not found: {name}")
        ws = wb.Worksheets(sheet_name)
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

    def col(self, sheet_or_name, header, workbook=None, header_rows=20):
        rows = self.rows(sheet_or_name, workbook)
        target = self.normalize(header)
        for r_idx, row in enumerate(rows[:header_rows], start=1):
            for c_idx, value in enumerate(row, start=1):
                if self.normalize(value) == target:
                    return c_idx
        for r_idx, row in enumerate(rows[:header_rows], start=1):
            for c_idx, value in enumerate(row, start=1):
                if target and target in self.normalize(value):
                    return c_idx
        return -1

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
        if isinstance(name_or_idx, int):
            return max(0, name_or_idx - 1)
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
        wb = self._unwrap_workbook(workbook or self.workbook)
        base = (str(name) or "Sheet")[:31]
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

    def sort(self, sheet_or_name, by, ascending=True, header=True, workbook=None):
        # Range.Sort 를 올바른 숫자 상수로 호출(win32com 상수 import 불필요).
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        rel = self._col0(rows, by)
        if rel is None:
            raise RuntimeError("sort: column not found: %r" % (by,))
        used = ws.UsedRange
        abs_col = int(used.Column) + rel  # rel 은 0-based, used.Column 은 1-based
        key = ws.Cells(int(used.Row), abs_col)
        used.Sort(
            Key1=key,
            Order1=1 if ascending else 2,  # xlAscending=1 / xlDescending=2
            Header=1 if header else 2,      # xlYes=1 / xlNo=2
            Orientation=1,                  # xlTopToBottom=1
        )
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
        for r in rows[hr:]:
            try:
                if predicate(r):
                    matched.append(r)
            except Exception:
                continue
        dest = self.add_sheet(dest_name, workbook=workbook or self.workbook)
        self._write_grid(dest, list(header) + matched)
        return dest

    def pivot(self, sheet_or_name, group_by, value=None, agg="sum", dest_name=None, header_rows=1, workbook=None):
        # Python 집계로 그룹별 요약 표를 새 시트에 만든다(COM PivotTable 보다 안정적).
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        hr = max(1, int(header_rows or 1))
        header_row = rows[hr - 1] if len(rows) >= hr else []
        data = rows[hr:]
        group_cols = list(group_by) if isinstance(group_by, (list, tuple)) else [group_by]
        gidx = [self._col0(rows, g, hr) for g in group_cols]
        vidx = self._col0(rows, value, hr) if value is not None else None
        agg = str(agg or "sum").lower()

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

        groups = {}
        order = []
        for r in data:
            key = tuple((r[i] if (i is not None and i < len(r)) else "") for i in gidx)
            if key not in groups:
                groups[key] = []
                order.append(key)
            if vidx is not None and vidx < len(r):
                groups[key].append(r[vidx])

        def _aggregate(vals):
            nums = [n for n in (_num(v) for v in vals) if n is not None]
            if agg == "count":
                return len(vals)
            if agg in ("avg", "average", "mean"):
                return (sum(nums) / len(nums)) if nums else 0
            if agg == "max":
                return max(nums) if nums else ""
            if agg == "min":
                return min(nums) if nums else ""
            return sum(nums)

        out_header = []
        for n, i in enumerate(gidx):
            label = header_row[i] if (i is not None and i < len(header_row)) else ("그룹%d" % (n + 1))
            out_header.append(label)
        value_label = (str(value) if value is not None else "값") + "_" + (agg if agg != "average" else "avg")
        out_header.append(value_label)
        grid = [out_header]
        for key in order:
            grid.append(list(key) + [_aggregate(groups[key])])
        dest = self.add_sheet(dest_name or "피벗요약", workbook=workbook or self.workbook)
        self._write_grid(dest, grid)
        return dest


# 스킬에서 import 가능한 안전한 표준 라이브러리만 허용(os/sys/subprocess 등 위험 모듈은 차단).
_SKILL_ALLOWED_IMPORTS = {
    "re", "datetime", "math", "json", "collections", "itertools",
    "functools", "string", "decimal", "statistics", "calendar",
    "textwrap", "unicodedata", "fractions", "random", "operator", "copy",
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
            self._ws.cell(row=self._r1, column=self._c1, value=value)
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
                    self._ws.cell(row=r, column=c, value=row[j])

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

    def Cells(self, r, c):
        return _OpxlRange(self._ws, r, c, r, c)

    @property
    def UsedRange(self):
        mr = self._ws.max_row or 1
        mc = self._ws.max_column or 1
        return _OpxlRange(self._ws, 1, 1, mr, mc)

    def Range(self, a1, a2=None):
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


class OpenpyxlWorkbookProxy:
    def __init__(self, ctx, workbook, name=None):
        self._ctx = ctx
        self._workbook = workbook
        self.name = name or ""

    @property
    def raw(self):
        return self._workbook

    def __getattr__(self, name):
        return getattr(self._workbook, name)

    def sheet(self, name=None):
        return self._ctx.sheet(name, workbook=self)

    def sheet_like(self, name=None):
        return self._ctx.sheet_like(name, workbook=self)

    def range(self, sheet_or_name, address):
        return self._ctx.range(sheet_or_name, address, workbook=self)

    def rows(self, sheet_or_name=None):
        return self._ctx.rows(sheet_or_name, workbook=self)

    def col(self, sheet_or_name, header, header_rows=20):
        return self._ctx.col(sheet_or_name, header, workbook=self, header_rows=header_rows)

    def header_row(self, sheet_or_name=None, header_rows=20):
        return self._ctx.header_row(sheet_or_name, workbook=self, header_rows=header_rows)


class OpenpyxlSkillContext:
    """COM ExcelSkillContext 와 동일한 API를 openpyxl 위에서 제공한다."""
    def __init__(self, output_wb, input_wbs):
        self.excel = None
        self._workbook = output_wb
        self.workbook = OpenpyxlWorkbookProxy(self, output_wb, "output")
        self.output = self.workbook
        self.last_output_sheet = None
        self.last_output_address = None
        self.inputs = {
            name: OpenpyxlWorkbookProxy(self, wb, name)
            for name, wb in (input_wbs or {}).items()
        }

    def _unwrap_workbook(self, wb):
        return wb.raw if isinstance(wb, OpenpyxlWorkbookProxy) else wb

    def _is_output_workbook(self, wb):
        return self._unwrap_workbook(wb) is self._workbook

    def normalize(self, value):
        return normalize_text(value)

    def _sheet_names(self, wb):
        return list(self._unwrap_workbook(wb).sheetnames)

    def workbook_like(self, hint=None):
        if not hint:
            return self.workbook
        norm = self.normalize(hint)
        candidates = [(name, wb) for name, wb in self.inputs.items()]
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
        for sheet_name in names:
            if self.normalize(sheet_name) == norm:
                return sheet_name
        for sheet_name in names:
            sheet_norm = self.normalize(sheet_name)
            if norm in sheet_norm or sheet_norm in norm:
                return sheet_name
        if allow_single and len(names) == 1:
            return names[0]
        return None

    def sheet(self, name=None, workbook=None):
        raw = self._unwrap_workbook(workbook or self.workbook)
        sheet_name = self._find_sheet_name(workbook or self.workbook, name)
        if not sheet_name:
            raise RuntimeError(f"sheet not found: {name}")
        ws = OpenpyxlWorksheetProxy(raw[sheet_name])
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

    def rows(self, sheet_or_name, workbook=None):
        ws = self._ws_of(sheet_or_name, workbook)
        raw = getattr(ws, "_ws", ws)
        out = []
        for row in raw.iter_rows(values_only=True):
            out.append(list(row))
        # 끝쪽 완전 빈 행 제거(openpyxl max_row 가 과대평가될 수 있음)
        while out and all(v is None or v == "" for v in out[-1]):
            out.pop()
        return out

    def col(self, sheet_or_name, header, workbook=None, header_rows=20):
        rows = self.rows(sheet_or_name, workbook)
        target = self.normalize(header)
        for row in rows[:header_rows]:
            for c_idx, value in enumerate(row, start=1):
                if self.normalize(value) == target:
                    return c_idx
        for row in rows[:header_rows]:
            for c_idx, value in enumerate(row, start=1):
                if target and target in self.normalize(value):
                    return c_idx
        return -1

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
        if isinstance(name_or_idx, int):
            return max(0, name_or_idx - 1)
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
        wb = self._unwrap_workbook(workbook or self.workbook)
        base = (str(name) or "Sheet")[:31]
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
        for i, row in enumerate(grid):
            for j, value in enumerate(row or []):
                raw.cell(row=start_row + i, column=start_col + j, value=value)
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
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        rel = self._col0(rows, by)
        if rel is None:
            raise RuntimeError("sort: column not found: %r" % (by,))
        hdr_count = 1 if header else 0
        head = rows[:hdr_count]
        body = rows[hdr_count:]

        def _key(r):
            v = r[rel] if rel < len(r) else None
            num = self._num(v)
            return (0, num) if num is not None else (1, self.normalize(v))

        body.sort(key=_key, reverse=not ascending)
        # 기존 영역을 지우고 다시 쓴다.
        raw = getattr(ws, "_ws", ws)
        max_col = max((len(r) for r in rows), default=0)
        for r_idx in range(1, (raw.max_row or 0) + 1):
            for c_idx in range(1, max_col + 1):
                raw.cell(row=r_idx, column=c_idx, value=None)
        self._write_grid(ws, list(head) + body)
        if self._is_output_workbook(ws.Parent):
            self.last_output_sheet = ws.Name
        return ws

    def filter_to_sheet(self, sheet_or_name, predicate, dest_name, header_rows=1, workbook=None):
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        hr = max(0, int(header_rows or 0))
        header = rows[:hr]
        matched = []
        for r in rows[hr:]:
            try:
                if predicate(r):
                    matched.append(r)
            except Exception:
                continue
        dest = self.add_sheet(dest_name, workbook=workbook or self.workbook)
        self._write_grid(dest, list(header) + matched)
        return dest

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

    def pivot(self, sheet_or_name, group_by, value=None, agg="sum", dest_name=None, header_rows=1, workbook=None):
        ws = self._ws_of(sheet_or_name, workbook)
        rows = self.rows(ws)
        hr = max(1, int(header_rows or 1))
        header_row = rows[hr - 1] if len(rows) >= hr else []
        data = rows[hr:]
        group_cols = list(group_by) if isinstance(group_by, (list, tuple)) else [group_by]
        gidx = [self._col0(rows, g, hr) for g in group_cols]
        vidx = self._col0(rows, value, hr) if value is not None else None
        agg = str(agg or "sum").lower()

        groups = {}
        order = []
        for r in data:
            key = tuple((r[i] if (i is not None and i < len(r)) else "") for i in gidx)
            if key not in groups:
                groups[key] = []
                order.append(key)
            if vidx is not None and vidx < len(r):
                groups[key].append(r[vidx])

        def _aggregate(vals):
            nums = [n for n in (self._num(v) for v in vals) if n is not None]
            if agg == "count":
                return len(vals)
            if agg in ("avg", "average", "mean"):
                return (sum(nums) / len(nums)) if nums else 0
            if agg == "max":
                return max(nums) if nums else ""
            if agg == "min":
                return min(nums) if nums else ""
            return sum(nums)

        out_header = []
        for n, i in enumerate(gidx):
            label = header_row[i] if (i is not None and i < len(header_row)) else ("그룹%d" % (n + 1))
            out_header.append(label)
        value_label = (str(value) if value is not None else "값") + "_" + (agg if agg != "average" else "avg")
        out_header.append(value_label)
        grid = [out_header]
        for key in order:
            grid.append(list(key) + [_aggregate(groups[key])])
        dest = self.add_sheet(dest_name or "피벗요약", workbook=workbook or self.workbook)
        self._write_grid(dest, grid)
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

    ctx = OpenpyxlSkillContext(output_wb, input_wbs)
    for idx, step in enumerate(python_steps, start=1):
        update_pipeline_job(job_id, {
            "stage": f"Python(openpyxl) Step {idx}/{len(python_steps)} 실행 중",
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
            raise PipelineExecutionError({
                "stepIdx": idx - 1,
                "stepId": step.get("id"),
                "description": step.get("description"),
                "code": original_code,
                "normalizedCode": code,
                "language": step.get("language") or "python",
                "message": f"{stage_label}: {err}",
                "stack": repr(err),
            })

    update_pipeline_job(job_id, {
        "stage": "결과 저장 중",
        "currentStep": len(python_steps),
        "completedSteps": len(python_steps),
        "stepRunning": False,
    })
    BACKEND_DIR.mkdir(parents=True, exist_ok=True)

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

    # 입력은 읽기 전용(편집/저장하지 않음) → 미리보기/다운로드 없음(변경 없음).
    input_previews = {}
    input_download_urls = {}

    current = payload.get("current") or {}
    output_file_id = current.get("outputFileId") or "output:0"
    result_id = uuid.uuid4().hex
    RESULTS[result_id] = {"path": str(result_path), "name": result_path.name, "created": time.time()}
    inspected = inspect_workbook(result_path)
    result_output = {
        sheet_name: (sheet.get("rows") or [])
        for sheet_name, sheet in (inspected.get("sheets") or {}).items()
    }
    update_workbook_current_cache(output_wb_record, result_output)
    previews = build_result_previews(input_previews, result_output, current, {}, [])
    download_urls = dict(input_download_urls)
    download_urls[output_file_id] = f"/api/workbooks/download/{result_id}"
    active_output_sheet = ctx.last_output_sheet
    active_output_address = ctx.last_output_address
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
    global PYTHON_SKILL_APP
    app = PYTHON_SKILL_APP
    if app is not None:
        try:
            _ = app.Workbooks.Count  # 살아있는지 확인
            return app
        except Exception:
            PYTHON_SKILL_APP = None
    app = win32com.client.DispatchEx("Excel.Application")
    app.Visible = False
    for attr, value in (("DisplayAlerts", False), ("EnableEvents", False), ("AskToUpdateLinks", False)):
        try:
            setattr(app, attr, value)
        except Exception:
            pass
    _hide_excel_app_window(app)
    PYTHON_SKILL_APP = app
    return app


def _quit_python_skill_app():
    global PYTHON_SKILL_APP
    app = PYTHON_SKILL_APP
    PYTHON_SKILL_APP = None
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
    # 라이브 미러 워크북에서 미리보기용 AoA 를 COM 으로 직접 읽는다(결과 파일 저장 없이).
    data = {}
    for name in _excel_collection_names(wb.Worksheets):
        try:
            ws = wb.Worksheets(name)
            used = ws.UsedRange
            rows = min(int(used.Rows.Count), PREVIEW_ROWS)
            cols = min(int(used.Columns.Count), PREVIEW_COLS or 256)
        except Exception:
            data[name] = []
            continue
        if rows <= 0 or cols <= 0:
            data[name] = []
            continue
        try:
            values = _range_matrix(ws.Range(ws.Cells(1, 1), ws.Cells(rows, cols)).Value)
            data[name] = [[cell_to_json(v) for v in (row or [])] for row in values]
        except Exception:
            data[name] = []
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
        result_output = {
            sheet_name: (sheet.get("rows") or [])
            for sheet_name, sheet in (inspected.get("sheets") or {}).items()
        }
        download_id = uuid.uuid4().hex
        RESULTS[download_id] = {"path": str(out_path), "name": out_path.name, "created": time.time()}
        download_urls[output_file_id] = f"/api/workbooks/download/{download_id}"
        update_workbook_current_cache(output_wb_record, result_output)

    rec_by_name = {}
    for item, rec in zip(payload.get("inputs", []), input_wb_records):
        rec_by_name[item.get("name") or rec["name"]] = rec
    input_previews = {}
    for name, path in (input_paths_by_name or {}).items():
        ip = Path(path)
        if not ip.exists():
            continue
        inspected_in = inspect_workbook(ip)
        input_previews[name] = {
            sheet_name: (sheet.get("rows") or [])
            for sheet_name, sheet in (inspected_in.get("sheets") or {}).items()
        }
        rid = uuid.uuid4().hex
        RESULTS[rid] = {"path": str(ip), "name": ip.name, "created": time.time()}
        download_urls["input:" + name] = f"/api/workbooks/download/{rid}"
        rec = rec_by_name.get(name)
        if rec is not None:
            update_workbook_current_cache(rec, input_previews[name])

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

        ctx = ExcelSkillContext(app, output_wb, input_wbs)
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
                raise PipelineExecutionError({
                    "stepIdx": idx - 1,
                    "stepId": step.get("id"),
                    "description": step.get("description"),
                    "code": original_code,
                    "normalizedCode": code,
                    "language": step.get("language") or "python",
                    "message": f"{stage_label}: {err}",
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
        active_output_sheet = ctx.last_output_sheet if ctx else None
        active_output_address = ctx.last_output_address if ctx else None
        if active_output_sheet:
            try:
                output_wb.Activate()
                ws = output_wb.Worksheets(active_output_sheet)
                ws.Activate()
                if active_output_address:
                    ws.Range(str(active_output_address)).Select()
                # 미러 앱을 보이게/활성화하지 않는다(적용 중 창 튀어나옴 방지). 완료 후 프런트가 표시.
            except Exception as err:
                _warn_excel_nonfatal("activate output sheet", err)
        if live_session:
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
                    update_workbook_current_cache(rec, input_previews[name])
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
        if live_session and active_output_sheet:
            try:
                output_wb.Activate()
                ws = output_wb.Worksheets(active_output_sheet)
                ws.Activate()
                if active_output_address:
                    ws.Range(str(active_output_address)).Select()
                # 미러 앱을 보이게/활성화하지 않는다(적용 중 창 튀어나옴 방지). 완료 후 프런트가 표시.
            except Exception as err:
                _warn_excel_nonfatal("restore active output sheet", err)
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
        update_workbook_current_cache(output_wb_record, result_output)
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
    result_output = {
        sheet_name: (sheet.get("rows") or [])
        for sheet_name, sheet in (inspected.get("sheets") or {}).items()
    }
    update_workbook_current_cache(output_wb_record, result_output)
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
    for name, rows in (sheets or {}).items():
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
            "formulas": {},
            "formats": {},
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
            "formulas": {},
            "formats": {},
            "dimensions": sheet_dimensions(output),
            "diff": diffs.get(output_file_id),
        })
    return files


def preview_sheets(sheets):
    def preview_row(row):
        values = list(row or [])
        return values if PREVIEW_COLS is None else values[:PREVIEW_COLS]
    return {
        name: [preview_row(row) for row in (rows or [])[:PREVIEW_ROWS]]
        for name, rows in (sheets or {}).items()
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


def _pipeline_payload_needs_com(payload):
    """openpyxl 엔진이 안전하지 않으면 사유 문자열을 반환(없으면 "").
    - 출력에 객체(차트/이미지/피벗/매크로)가 있으면 저장 시 유실 → COM.
    - 출력/입력 중 CSV 가 있으면 openpyxl 로 못 여므로 → COM.
    - 수식은 트리거 아님(입력=계산값 읽기, 출력=수식 보존+Excel 재계산)."""
    out = payload.get("output") or {}
    out_wid = out.get("backendWorkbookId")
    if out_wid:
        try:
            rec = get_workbook_or_raise(out_wid)
            if is_csv_path(rec["path"]):
                return f"{out.get('name') or rec.get('name') or '출력'}: CSV"
            reason = _xlsx_object_reason(rec["path"])
            if reason:
                return f"{out.get('name') or rec.get('name') or '출력'}: {reason}"
        except Exception:
            pass
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
        # 엔진 선택: "python"(openpyxl, COM 없이 인프로세스 — 빠름) vs 기본 "excel"(COM, 라이브 미러).
        engine = str(payload.get("engine") or "excel").lower()
        if engine in ("python", "openpyxl") and openpyxl is not None:
            # 안전장치: 차트/이미지/피벗/매크로/수식/CSV 가 있으면 객체 유실·계산오류를 막기 위해
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
