# -*- coding: utf-8 -*-
"""로그/스킬 자동 전송 (AX-Cell → 수집 서버).

왜 있나
  로그는 사용자 PC의 %LOCALAPPDATA%\\B2B_logs 에 쌓이고, 프로그램을 다시 켜면 비워진다
  (사용자 PC 부하를 줄이려는 의도된 동작). 자동백업 스킬은 실행파일 옆 auto_backup 에 쌓인다.
  그래서 관리자가 "그때 그 로그 좀…" 하고 부탁하는 절차가 번거롭고, 이미 지워진 뒤인 경우도 많다.
  이 모듈은 프로그램이 켜져 있는 동안 알아서 조금씩 서버로 보낸다. 서버는 지우지 않고 계속 쌓는다.

어떤 길로 나가나
  버전 확인과 같은 서버(versionTest)로, 같은 인증(Api-Key)으로 나간다. 다만 버전 확인은
  화면(WebView)이 로컬 /v1 프록시를 통해 부르는 반면, 이쪽은 백엔드가 직접 부른다
  — 화면이 떠 있든 아니든, 사용자가 아무것도 안 눌러도 저절로 올라가야 하기 때문.

무엇을 보내나 (한 번 실행 = 한 세션 = 서버의 폴더 하나)
  · 로그  : B2B_logs 의 *.jsonl / *.log 중 이번 실행에서 새로 쓰인 것 — 늘어난 부분만 이어서
  · 스킬  : auto_backup 의 zip 중 이번 실행에서 만들어진 것 — 통째로 한 번씩
  그래서 서버에는 '그 실행의 로그와 그 실행에서 만든 스킬' 이 항상 짝으로 남는다.

끄는 법 / 바꾸는 법 (환경변수가 가장 우선)
  B2B_LOG_SYNC=0            전송 끄기
  B2B_LOG_SYNC_URL=...      수집 서버 주소(기본: 버전 서버와 같은 주소)
  B2B_LOG_SYNC_KEY=...      게이트웨이 Api-Key
  B2B_LOG_SYNC_INGEST_KEY=. 수집 서버가 --ingest-key 로 키를 요구할 때
  B2B_LOG_SYNC_INTERVAL=30  전송 주기(초)

실패해도 절대 앱을 방해하지 않는다 — 모든 예외를 삼키고 다음 주기에 다시 시도한다.
"""
from __future__ import annotations

import atexit
import base64
import datetime
import gzip
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

# 버전 확인이 쓰는 주소/키와 같은 기본값 (scripts/config.js 의 VERSION_CHECK_* 와 짝).
# 한쪽만 바꾸면 버전 확인은 되는데 로그만 안 올라가는 상태가 되므로 같이 본다.
DEFAULT_UPSTREAM_URL = "https://version-ns-17786299267796664.mng-1.ip.violet.uplus.co.kr"
DEFAULT_API_KEY = "76657273"
DEFAULT_INTERVAL_SECONDS = 30

CHUNK_BYTES = 256 * 1024          # 한 번에 보낼 로그 조각 크기
MAX_CHUNKS_PER_FILE_PER_TICK = 4  # 한 주기에 파일당 최대 1MB — 앱을 방해하지 않는 선
MAX_FILE_BYTES = 20 * 1024 * 1024     # 한 파일이 이보다 커지면 그 뒤는 보내지 않는다
MAX_SKILL_BYTES = 20 * 1024 * 1024    # 스킬 zip 1개 상한
MAX_TOTAL_BYTES = 100 * 1024 * 1024   # 한 세션에 보낼 총량 상한
LOG_PATTERNS = ("*.jsonl", "*.log")
MTIME_SLACK_SECONDS = 5.0         # '이번 실행에서 쓰인 파일' 판정 여유
SKILL_SETTLE_SECONDS = 3.0        # 아직 쓰는 중인 zip 을 보내지 않기 위한 대기

_LOCK = threading.RLock()
_STATE = {
    "enabled": False,
    "running": False,
    "sessionId": "",
    "user": "",
    "date": "",
    "startedAt": "",
    "startTime": 0.0,
    "sessionAcked": False,
    "stopped": False,
    "offsets": {},         # 파일경로 -> 서버가 받은 바이트 수
    "rotations": {},       # 파일경로 -> 중간에 비워진 횟수(서버에 다른 이름으로 이어 쓴다)
    "sentSkills": {},      # 스킬 파일경로 -> 보낸 크기
    "sentBytes": 0,
    "posts": 0,
    "failures": 0,
    "consecutiveFailures": 0,
    "lastError": "",
    "lastOkAt": "",
    "serverPath": "",
    "capped": False,
}
_CONFIG = {"upstreamUrl": "", "apiKey": "", "ingestKey": "", "interval": 0}
_CONTEXT = {"appVersion": "", "appDir": "", "logDirs": [], "skillDirs": [], "extraFiles": []}
_THREAD = None
_WAKE = threading.Event()


# ── 설정 ──────────────────────────────────────────────────────────────────

def _env(name, default=""):
    return str(os.environ.get(name) or "").strip() or default


def _normalize_base(raw):
    """주소 뒤에 /v1 이나 /version 이 붙어 있어도 받아준다(설정 칸에 그대로 붙여넣는 경우)."""
    text = str(raw or "").strip().replace(" ", "")
    text = text.rstrip("/")
    for tail in ("/v1/version", "/version", "/v1"):
        if text.lower().endswith(tail):
            text = text[: -len(tail)]
            break
    return text.rstrip("/")


def config():
    """환경변수 > 화면에서 넘겨준 설정 > 기본값 순으로 결정한다."""
    disabled = _env("B2B_LOG_SYNC", "1").lower() in {"0", "off", "false", "no"}
    url = _normalize_base(_env("B2B_LOG_SYNC_URL") or _CONFIG.get("upstreamUrl") or DEFAULT_UPSTREAM_URL)
    key = _env("B2B_LOG_SYNC_KEY") or _CONFIG.get("apiKey") or DEFAULT_API_KEY
    ingest = _env("B2B_LOG_SYNC_INGEST_KEY") or _CONFIG.get("ingestKey") or ""
    try:
        interval = int(_env("B2B_LOG_SYNC_INTERVAL") or _CONFIG.get("interval") or DEFAULT_INTERVAL_SECONDS)
    except Exception:
        interval = DEFAULT_INTERVAL_SECONDS
    return {"enabled": (not disabled) and bool(url), "upstreamUrl": url, "apiKey": key,
            "ingestKey": ingest, "interval": max(5, min(600, interval))}


def update_config(values):
    """화면(F9 개발자 설정)의 버전 서버 주소/키를 그대로 물려받는다.

    사용자가 주소를 바꾸면 로그도 그 서버로 간다 — 두 곳에 따로 적게 하지 않기 위해서다."""
    with _LOCK:
        if isinstance(values, dict):
            if values.get("upstreamUrl"):
                _CONFIG["upstreamUrl"] = _normalize_base(values.get("upstreamUrl"))
            if values.get("apiKey"):
                _CONFIG["apiKey"] = str(values.get("apiKey")).strip()
            if values.get("ingestKey"):
                _CONFIG["ingestKey"] = str(values.get("ingestKey")).strip()
            if values.get("interval"):
                try:
                    _CONFIG["interval"] = int(values.get("interval"))
                except Exception:
                    pass
    _WAKE.set()
    return status()


# ── 사용자/세션 ───────────────────────────────────────────────────────────

def current_user():
    """사용자 구분은 whoami 결과(도메인\\사용자)를 쓴다 — 사내에서 이 값이 사람과 1:1 이다.

    whoami 가 안 되는 환경(비윈도우/제한)에서는 환경변수 → getpass 순으로 물러난다."""
    try:
        flags = 0
        startupinfo = None
        if os.name == "nt":
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)      # 콘솔 창 깜빡임 방지
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        out = subprocess.run(["whoami"], capture_output=True, timeout=5,
                             creationflags=flags, startupinfo=startupinfo)
        text = (out.stdout or b"").decode("utf-8", errors="replace").strip()
        if not text:
            text = (out.stdout or b"").decode("cp949", errors="replace").strip()
        if text:
            return text
    except Exception:
        pass
    domain = str(os.environ.get("USERDOMAIN") or "").strip()
    name = str(os.environ.get("USERNAME") or os.environ.get("USER") or "").strip()
    if name:
        return (domain + "\\" + name) if domain else name
    try:
        import getpass
        return getpass.getuser()
    except Exception:
        return "unknown"


def _new_session_id():
    return "%s-%s-%s" % (time.strftime("%Y%m%d-%H%M%S"), os.getpid(), uuid.uuid4().hex[:4])


def _now_iso():
    return datetime.datetime.now().isoformat(timespec="seconds")


# ── 통신 ──────────────────────────────────────────────────────────────────

def _endpoint(path):
    cfg = config()
    return cfg["upstreamUrl"] + "/v1/logs/" + path.lstrip("/")


def _post(path, payload, timeout=15.0):
    cfg = config()
    data = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    headers = {"content-type": "application/json", "accept": "application/json"}
    if cfg["apiKey"]:
        headers["Api-Key"] = cfg["apiKey"]
    if cfg["ingestKey"]:
        headers["X-B2B-Log-Key"] = cfg["ingestKey"]
    req = urllib.request.Request(_endpoint(path), data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    try:
        return json.loads(body)
    except Exception:
        return {"ok": resp.status < 400 if hasattr(resp, "status") else True, "raw": body[:200]}


def _encode(blob):
    return base64.b64encode(gzip.compress(blob)).decode("ascii")


def _note_ok(result=None):
    with _LOCK:
        _STATE["posts"] += 1
        _STATE["consecutiveFailures"] = 0
        _STATE["lastOkAt"] = _now_iso()
        if isinstance(result, dict):
            if result.get("capped"):
                _STATE["capped"] = True


def _note_fail(err):
    with _LOCK:
        _STATE["failures"] += 1
        _STATE["consecutiveFailures"] += 1
        _STATE["lastError"] = "%s: %s" % (type(err).__name__, err)


# ── 보낼 것 고르기 ────────────────────────────────────────────────────────

def _session_files():
    """이번 실행에서 새로 쓰인 로그 파일만 고른다(예전 실행의 잔재는 보내지 않는다)."""
    start = _STATE["startTime"] - MTIME_SLACK_SECONDS
    found = []
    for folder in _CONTEXT["logDirs"]:
        try:
            base = Path(folder)
            if not base.is_dir():
                continue
            for pattern in LOG_PATTERNS:
                for path in base.glob(pattern):
                    try:
                        if path.is_file() and path.stat().st_mtime >= start:
                            found.append(path)
                    except Exception:
                        continue
        except Exception:
            continue
    for extra in _CONTEXT["extraFiles"]:
        try:
            path = Path(extra)
            if path.is_file() and path.stat().st_mtime >= start:
                found.append(path)
        except Exception:
            continue
    seen, out = set(), []
    for path in found:
        key = str(path).lower()
        if key not in seen:
            seen.add(key)
            out.append(path)
    return out


def _session_skills():
    """이번 실행 중에 만들어진 자동백업 스킬 zip (아직 쓰는 중인 파일은 다음 주기로 미룬다)."""
    start = _STATE["startTime"] - MTIME_SLACK_SECONDS
    now = time.time()
    out = []
    for folder in _CONTEXT["skillDirs"]:
        try:
            base = Path(folder)
            if not base.is_dir():
                continue
            for path in base.glob("*.zip"):
                try:
                    st = path.stat()
                except Exception:
                    continue
                if st.st_mtime < start or (now - st.st_mtime) < SKILL_SETTLE_SECONDS:
                    continue
                if _STATE["sentSkills"].get(str(path)) == st.st_size:
                    continue
                if st.st_size > MAX_SKILL_BYTES:
                    continue
                out.append(path)
        except Exception:
            continue
    return out


# ── 한 주기 ───────────────────────────────────────────────────────────────

def _ensure_session(timeout=15.0):
    if _STATE["sessionAcked"]:
        return True
    payload = {
        "sessionId": _STATE["sessionId"],
        "user": _STATE["user"],
        "host": socket.gethostname(),
        "appVersion": _CONTEXT.get("appVersion", ""),
        "startedAt": _STATE["startedAt"],
        "osInfo": "%s %s" % (os.name, sys.platform),
        "pid": os.getpid(),
        "appDir": _CONTEXT.get("appDir", ""),
        "logDir": ";".join(str(p) for p in _CONTEXT["logDirs"]),
        "skillDir": ";".join(str(p) for p in _CONTEXT["skillDirs"]),
    }
    try:
        result = _post("session/start", payload, timeout=timeout)
        with _LOCK:
            _STATE["sessionAcked"] = bool(result.get("ok"))
            if result.get("date"):
                _STATE["date"] = str(result.get("date"))
            # 서버에 실제로 쌓이는 '이 실행의 폴더' — 진단 화면에서 그대로 찾아갈 수 있게 남긴다.
            if result.get("path"):
                _STATE["serverPath"] = str(result.get("path"))
        _note_ok(result)
        return _STATE["sessionAcked"]
    except Exception as err:
        _note_fail(err)
        return False


def _remote_name(path):
    """서버에 쌓을 이름. 실행 중에 파일이 비워졌으면 .r1, .r2 … 로 갈아 쓴다.

    서버는 '이미 받은 만큼은 버리는' 규칙으로 재전송을 걸러내므로, 비워진 파일을 같은 이름으로
    다시 0번지부터 보내면 새 내용이 통째로 걸러져 사라진다. 이름을 바꿔 두 벌 다 남긴다."""
    n = int(_STATE["rotations"].get(str(path), 0))
    if not n:
        return path.name
    return "%s.r%d%s" % (path.stem, n, path.suffix)


def _send_log_file(path, timeout=15.0):
    key = str(path)
    sent = 0
    for _ in range(MAX_CHUNKS_PER_FILE_PER_TICK):
        try:
            size = path.stat().st_size
        except Exception:
            return sent
        offset = int(_STATE["offsets"].get(key, 0))
        if size < offset:                 # 파일이 비워졌다 — 서버에는 다른 이름으로 이어 쓴다
            offset = 0
            with _LOCK:
                _STATE["offsets"][key] = 0
                _STATE["rotations"][key] = int(_STATE["rotations"].get(key, 0)) + 1
        if offset >= size or offset >= MAX_FILE_BYTES:
            return sent
        if _STATE["sentBytes"] >= MAX_TOTAL_BYTES:
            return sent
        try:
            with open(key, "rb") as f:
                f.seek(offset)
                blob = f.read(CHUNK_BYTES)
        except Exception as err:
            _note_fail(err)
            return sent
        if not blob:
            return sent
        try:
            result = _post("append", {
                "sessionId": _STATE["sessionId"], "user": _STATE["user"], "date": _STATE["date"],
                "name": _remote_name(path), "offset": offset, "encoding": "gzip+base64",
                "data": _encode(blob)}, timeout=timeout)
        except Exception as err:
            _note_fail(err)               # 오프셋을 안 옮긴다 → 다음 주기에 같은 곳부터 재시도
            return sent
        if not result.get("ok"):
            _note_fail(RuntimeError(str(result.get("error") or result)[:200]))
            return sent
        _note_ok(result)
        if result.get("capped"):
            return sent
        with _LOCK:
            _STATE["offsets"][key] = offset + len(blob)
            _STATE["sentBytes"] += len(blob)
        sent += len(blob)
    return sent


def _send_skill(path, timeout=20.0):
    try:
        blob = path.read_bytes()
        st = path.stat()
    except Exception as err:
        _note_fail(err)
        return 0
    try:
        result = _post("file", {
            "sessionId": _STATE["sessionId"], "user": _STATE["user"], "date": _STATE["date"],
            "kind": "skill", "name": path.name, "encoding": "gzip+base64",
            "data": _encode(blob),
            "createdAt": datetime.datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds"),
        }, timeout=timeout)
    except Exception as err:
        _note_fail(err)
        return 0
    if not result.get("ok"):
        _note_fail(RuntimeError(str(result.get("error") or result)[:200]))
        return 0
    _note_ok(result)
    with _LOCK:
        _STATE["sentSkills"][str(path)] = st.st_size
        _STATE["sentBytes"] += len(blob)
    return len(blob)


def tick(timeout=15.0):
    """한 번 전송. 스레드에서도, 종료 직전에도 같은 함수를 쓴다."""
    if not config()["enabled"] or _STATE["capped"]:
        return 0
    with _LOCK:
        if _STATE["running"]:
            return 0
        _STATE["running"] = True
    try:
        _ensure_session(timeout=timeout)   # 실패해도 계속 — 서버가 폴더를 알아서 만든다
        moved = 0
        for path in _session_files():
            moved += _send_log_file(path, timeout=timeout)
        for path in _session_skills():
            moved += _send_skill(path, timeout=timeout)
        return moved
    except Exception as err:
        _note_fail(err)
        return 0
    finally:
        with _LOCK:
            _STATE["running"] = False


def _loop():
    while not _STATE["stopped"]:
        cfg = config()
        delay = cfg["interval"]
        fails = _STATE["consecutiveFailures"]
        if fails:                                   # 서버가 죽어 있으면 천천히 — 최대 5분
            delay = min(300, cfg["interval"] * min(8, 2 ** min(fails, 3)))
        _WAKE.wait(delay)
        _WAKE.clear()
        if _STATE["stopped"]:
            return
        try:
            tick()
        except Exception:
            pass


def start(app_version="", log_dirs=(), skill_dirs=(), extra_files=(), app_dir="", config_values=None):
    """프로그램 시작 시 한 번 호출(멱등). 로그 초기화가 끝난 뒤에 불러야 한다.

    로그 파일을 비우는 _reset_trace_logs() 보다 먼저 시작하면, 지워질 예전 내용을
    이번 세션 것으로 올려 버린다. serve_b2b 는 리셋 다음 줄에서 이걸 부른다."""
    global _THREAD
    with _LOCK:
        if _THREAD is not None and _THREAD.is_alive():
            return status()
        if config_values:
            update_config(config_values)
        _CONTEXT["appVersion"] = str(app_version or "")
        _CONTEXT["appDir"] = str(app_dir or "")
        _CONTEXT["logDirs"] = [str(p) for p in (log_dirs or ())]
        _CONTEXT["skillDirs"] = [str(p) for p in (skill_dirs or ())]
        _CONTEXT["extraFiles"] = [str(p) for p in (extra_files or ())]
        _STATE.update({
            "enabled": config()["enabled"],
            "sessionId": _STATE["sessionId"] or _new_session_id(),
            "user": _STATE["user"] or current_user(),
            "startedAt": _now_iso(),
            "startTime": time.time(),
            "stopped": False,
            "sessionAcked": False,
        })
        if not _STATE["enabled"]:
            return status()
        _THREAD = threading.Thread(target=_loop, name="b2b-log-sync", daemon=True)
        _THREAD.start()
    atexit.register(_atexit_stop)
    return status()


def stop(reason="normal", timeout=6.0):
    """종료 직전 마지막 한 번 더 보내고 '이 세션 끝' 을 알린다(멱등).

    강제 종료로 여기까지 못 와도 주기 전송분까지는 서버에 남는다 — 그게 이 구조의 요점."""
    if _STATE["stopped"] or not _STATE["sessionId"]:
        return status()
    with _LOCK:
        _STATE["stopped"] = True
    _WAKE.set()
    if not config()["enabled"]:
        return status()
    try:
        tick(timeout=timeout)
    except Exception:
        pass
    try:
        _post("session/end", {"sessionId": _STATE["sessionId"], "user": _STATE["user"],
                              "date": _STATE["date"], "endedAt": _now_iso(),
                              "reason": str(reason or "")}, timeout=timeout)
        _note_ok()
    except Exception as err:
        _note_fail(err)
    return status()


def _atexit_stop():
    try:
        stop("atexit", timeout=4.0)
    except Exception:
        pass


def status():
    cfg = config()
    with _LOCK:
        return {
            "ok": True,
            "enabled": cfg["enabled"],
            "upstreamUrl": cfg["upstreamUrl"],
            "intervalSeconds": cfg["interval"],
            "authKeySet": bool(cfg["apiKey"]),
            "ingestKeySet": bool(cfg["ingestKey"]),
            "sessionId": _STATE["sessionId"],
            "user": _STATE["user"],
            "date": _STATE["date"],
            "startedAt": _STATE["startedAt"],
            "sessionAcked": _STATE["sessionAcked"],
            "serverPath": _STATE["serverPath"],
            "sentBytes": _STATE["sentBytes"],
            "posts": _STATE["posts"],
            "failures": _STATE["failures"],
            "lastError": _STATE["lastError"],
            "lastOkAt": _STATE["lastOkAt"],
            "capped": _STATE["capped"],
            "files": {Path(k).name: v for k, v in _STATE["offsets"].items()},
            "skills": [Path(k).name for k in _STATE["sentSkills"]],
            "stopped": _STATE["stopped"],
        }
