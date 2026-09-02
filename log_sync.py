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
import re
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
    "configGen": 0,        # 수집 서버가 바뀔 때마다 +1 — 전송 결과를 커밋할지 가르는 기준
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

    사용자가 주소를 바꾸면 로그도 그 서버로 간다 — 두 곳에 따로 적게 하지 않기 위해서다.

    [코드리뷰 2026-08-24] 주소가 '실제로' 바뀌면 세션을 새로 열어야 한다. 예전엔 sessionAcked 와
    바이트 오프셋을 그대로 들고 가서, 새 서버에 session/start 없이 offset=800 부터 붙었다 —
    메타데이터 없는 세션 + 앞부분이 통째로 빠진 로그가 남는다.
    판정은 반드시 '실효 주소'(환경변수 > 화면설정 > 기본값)의 적용 전후를 비교해야 한다.
      · _CONFIG 만 보면 부팅 직후엔 비어 있어, 같은 주소를 처음 밀어넣는 순간 오프셋을 날린다.
      · 환경변수로 주소가 고정된 환경에서는 화면 설정을 바꿔도 실효 주소가 그대로다 —
        그때 초기화하면 멀쩡한 세션의 앞부분을 스스로 버린다."""
    with _LOCK:
        before_url = config().get("upstreamUrl") or ""
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
        after_url = config().get("upstreamUrl") or ""
        if after_url and after_url != before_url:
            # [코드리뷰 2026-08-24] 세대 번호를 올린다. 초기화와 전송이 겹치면, 이미 날아간
            # 요청이 돌아와 옛 오프셋을 되살려 새 서버 로그의 앞부분이 빈다 — 이 초기화가
            # 막으려던 유실과 똑같은 모양이다. 전송 쪽은 커밋 직전에 세대를 확인해,
            # 그 사이 주소가 바뀌었으면 결과를 버린다.
            _STATE["configGen"] = int(_STATE.get("configGen") or 0) + 1
            _STATE["sessionAcked"] = False
            _STATE["offsets"] = {}
            _STATE["sentSkills"] = {}
            _STATE["capped"] = False
            _STATE["sentBytes"] = 0
            # 새 서버에서는 회전 이력과 날짜도 처음부터다. 안 지우면 첫 업로드가 .r1 이름으로
            # 들어가거나 이전 서버의 날짜 폴더에 쌓인다.
            _STATE["rotations"] = {}
            _STATE["date"] = ""
            _STATE["serverPath"] = ""
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


_ORG_CACHE = {"done": False, "value": {}}


def org_info():
    """`whoami /fqdn` 의 조직 계층을 파싱한다(도메인 VM 전용 — 실측 2026-09-02).

      CN=서영민(s0min),OU=[VDIGRP_00058572]4^Foundation리서치팀,
      OU=[VDIGRP_00058571]3^AI R_D Lab,OU=[VDIGRP_00058245]2^AI R_D센터,
      OU=[VDIGRP_00055758]1^CTO,OU=[VDIGRP_00010000]0^LG유플러스,...

    → {displayName:"서영민", empId:"s0min", team:"Foundation리서치팀",
       orgPath:"LG유플러스 > CTO > AI R_D센터 > AI R_D Lab > Foundation리서치팀",
       orgLevels:[레벨 오름차순 이름들]}

    도메인에 안 물린 PC(개발 등)는 /fqdn 이 실패한다 → 빈 dict (로그 형식만 그대로,
    값이 없을 뿐 — 구버전 서버와의 호환도 이걸로 지킨다). 세션당 한 번만 실행한다.
    반드시 워커 스레드에서 부른다(whoami 는 최대 5초 — 시작 경로를 막으면 안 된다)."""
    if _ORG_CACHE["done"]:
        return dict(_ORG_CACHE["value"])
    out = {}
    try:
        flags = 0
        startupinfo = None
        if os.name == "nt":
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        run = subprocess.run(["whoami", "/fqdn"], capture_output=True, timeout=5,
                             creationflags=flags, startupinfo=startupinfo)
        text = (run.stdout or b"").decode("utf-8", errors="replace").strip()
        if "OU=" not in text and "CN=" not in text:
            text = (run.stdout or b"").decode("cp949", errors="replace").strip()
        out = parse_fqdn_org(text)
    except Exception:
        out = {}
    _ORG_CACHE["value"] = out
    _ORG_CACHE["done"] = True
    return dict(out)


def parse_fqdn_org(dn):
    """DN 문자열 → 조직 dict. 파싱만 하는 순수 함수(테스트용 분리)."""
    dn = str(dn or "").strip()
    if not dn or "=" not in dn:
        return {}
    # 콤마로 자르되 'CN=/OU=/DC=' 가 이어지는 경계에서만 — 이름 안의 콤마에 안전.
    parts = re.split(r",(?=(?:CN|OU|DC)=)", dn)
    out = {}
    levels = {}
    for p in parts:
        p = p.strip()
        if p.startswith("CN="):
            cn = p[3:].strip()
            m = re.match(r"^(.*?)\(([^()]+)\)\s*$", cn)   # "서영민(s0min)" → 이름 + 사번
            if m:
                out["displayName"] = m.group(1).strip()
                out["empId"] = m.group(2).strip()
            else:
                out["displayName"] = cn
        elif p.startswith("OU="):
            ou = p[3:].strip()
            m = re.match(r"^\[[^\]]*\]\s*(\d+)\^(.+)$", ou)  # "[VDIGRP_x]4^팀명" → 레벨 + 이름
            if m:
                levels[int(m.group(1))] = m.group(2).strip()
    if levels:
        ordered = [levels[k] for k in sorted(levels)]
        out["orgLevels"] = ordered
        out["orgPath"] = " > ".join(ordered)
        out["team"] = ordered[-1]                     # 가장 깊은 레벨 = 소속 팀
    return out if out else {}


def _new_session_id():
    return "%s-%s-%s" % (time.strftime("%Y%m%d-%H%M%S"), os.getpid(), uuid.uuid4().hex[:4])


def _now_iso():
    return datetime.datetime.now().isoformat(timespec="seconds")


# ── 통신 ──────────────────────────────────────────────────────────────────

def _endpoint(path):
    cfg = config()
    return cfg["upstreamUrl"] + "/v1/logs/" + path.lstrip("/")


def _as_result(value):
    """[코드리뷰 2026-08-24] 서버가 dict 가 아닌 JSON(스칼라/배열)을 돌려주면 result.get 에서
    AttributeError 가 나 tick() 전체가 죽었다 — 그 상태가 매 주기 반복된다(전송이 영영 멈춤).
    dict 가 아니면 '실패한 응답'으로 정규화해 그 파일만 건너뛰고 다음 주기에 다시 시도한다."""
    if isinstance(value, dict):
        return value
    return {"ok": False, "error": "unexpected response: " + str(value)[:120]}


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
        # [조직 정보 2026-09-02] whoami /fqdn 의 팀/조직 계층 — 대시보드 조직별 조회용.
        # 서버 SessionStart.extra 는 예전부터 있던 자리라 구버전 서버에도 그대로 저장된다.
        "extra": {"org": org_info()},
    }
    try:
        result = _as_result(_post("session/start", payload, timeout=timeout))
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


def _over_total_budget():
    """[코드리뷰 2026-08-24] MAX_TOTAL_BYTES 가 로그에만 걸려 있었다. auto_backup 은 편집할 때마다
    zip 을 새로 만들어서, 스킬만으로 세션 상한을 훌쩍 넘겨 계속 올라간다(서버 300MB 에서야 막힌다)."""
    return int(_STATE.get("sentBytes") or 0) >= MAX_TOTAL_BYTES


def _send_log_file(path, timeout=15.0, deadline=None, gen=0):
    key = str(path)
    sent = 0
    for _ in range(MAX_CHUNKS_PER_FILE_PER_TICK):
        # [코드리뷰 2026-08-24] 예산을 파일 사이에서만 봤더니, 파일당 4조각을 다 돌아
        # 4초 예산이 15초까지 늘어났다(부모가 사라졌을 때 os._exit 가 그만큼 늦는다).
        # 조각 사이에서도 확인한다 — 남은 분량은 다음 실행에서 이어 보내진다.
        if deadline is not None and time.time() >= deadline:
            return sent
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
        result = _as_result(result)
        if not result.get("ok"):
            _note_fail(RuntimeError(str(result.get("error") or result)[:200]))
            return sent
        _note_ok(result)
        if result.get("capped"):
            return sent
        with _LOCK:
            if int(_STATE.get("configGen") or 0) != gen:
                return sent          # 보내는 사이 수집 서버가 바뀌었다 — 옛 오프셋을 되살리지 않는다
            _STATE["offsets"][key] = offset + len(blob)
            _STATE["sentBytes"] += len(blob)
        sent += len(blob)
    return sent


def _send_skill(path, timeout=20.0, deadline=None):
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
    result = _as_result(result)
    if not result.get("ok"):
        _note_fail(RuntimeError(str(result.get("error") or result)[:200]))
        return 0
    _note_ok(result)
    with _LOCK:
        _STATE["sentSkills"][str(path)] = st.st_size
        _STATE["sentBytes"] += len(blob)
    return len(blob)


def tick(timeout=15.0, wait_running=0.0, deadline=None):
    """한 번 전송. 스레드에서도, 종료 직전에도 같은 함수를 쓴다.

    [코드리뷰 2026-08-24] wait_running — 주기 스레드가 마침 tick() 안에 있으면 예전엔
    그냥 0 을 돌려주고 끝났다. 종료 직전 플러시가 그 길로 조용히 건너뛰어져 '마지막 구간'이
    통째로 유실됐다(정작 사고 직전이라 제일 중요한 구간이다). 종료 경로는 잠깐 기다린다."""
    if not config()["enabled"] or _STATE["capped"]:
        return 0
    _deadline = time.time() + max(0.0, float(wait_running or 0.0))
    while True:
        with _LOCK:
            if not _STATE["running"]:
                _STATE["running"] = True
                break
        if time.time() >= _deadline:
            return 0
        time.sleep(0.05)
    try:
        _gen = int(_STATE.get("configGen") or 0)
        if not _ensure_user():
            return 0                       # 사용자명을 아직 못 구했다 — 다음 주기에 다시
        _ensure_session(timeout=timeout)   # 실패해도 계속 — 서버가 폴더를 알아서 만든다
        moved = 0
        if deadline is not None and time.time() >= deadline:
            return 0                       # 세션 여는 데 예산을 다 썼다 — 종료를 더 붙잡지 않는다
        # deadline 이 있으면(종료 경로) 파일 사이마다 확인하고 넘기면 즉시 손을 뗀다.
        # 남은 분량은 다음 실행에서 이어 보내진다 — 종료를 붙잡는 것보다 그게 낫다.
        for path in _session_files():
            if deadline is not None and time.time() >= deadline:
                return moved
            moved += _send_log_file(path, timeout=timeout, deadline=deadline, gen=_gen)
        for path in _session_skills():
            if deadline is not None and time.time() >= deadline:
                return moved
            if _over_total_budget():
                break                     # 세션 총량 상한 — 스킬도 로그와 같은 예산 안에서 보낸다
            moved += _send_skill(path, timeout=timeout, deadline=deadline)
        return moved
    except Exception as err:
        _note_fail(err)
        return 0
    finally:
        with _LOCK:
            _STATE["running"] = False


def _ensure_user():
    """사용자명을 워커 스레드에서 뒤늦게 구한다(시작 경로를 막지 않으려고).
    아직 못 구했으면 세션 시작을 미룬다 — 사용자 없는 폴더가 서버에 생기지 않게."""
    if _STATE.get("user"):
        return _STATE["user"]
    try:
        name = current_user()
    except Exception:
        name = ""
    with _LOCK:
        if name and not _STATE.get("user"):
            _STATE["user"] = name
    return _STATE.get("user") or ""


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
            # [코드리뷰 2026-08-24] 예전엔 여기서 current_user() 를 동기로 불렀다. 그건 whoami 를
            # 띄우는데(최대 5초), 이 자리는 서버가 포트를 열기 전의 시작 경로다 — 보통 수십 ms 라도
            # 굳이 앱 기동을 막을 이유가 없다. 비워 두고 워커가 첫 tick 전에 채운다.
            "user": _STATE["user"] or "",
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
    # [코드리뷰 2026-08-24] timeout 은 'HTTP 요청 하나'의 상한이지 총량이 아니었다. 로그 파일 N개 ×
    # 조각 4개 + 스킬 zip 을 도는 동안 매 요청이 그 상한을 다 쓸 수 있어, 종료가 70~100초씩 걸렸다.
    # 그 사이 os._exit 가 막혀 앱이 안 죽고 Excel 도 살아남는다(부모 사망 감시 경로에서 특히 나쁘다).
    # 로그를 남기려다 앱 종료를 붙잡는 건 본말전도라 총 예산을 걸고 넘기면 그냥 포기한다.
    _budget = max(1.0, float(timeout or 0.0))
    _t0 = time.time()
    try:
        tick(timeout=min(timeout, 3.0),
             wait_running=min(1.0, max(0.3, float(timeout) / 4.0)),
             deadline=_t0 + _budget)
    except Exception:
        pass
    if time.time() - _t0 >= _budget:
        return status()          # 예산 소진 — session/end 도 생략하고 즉시 종료를 내준다
    try:
        _post("session/end", {"sessionId": _STATE["sessionId"], "user": _STATE["user"],
                              "date": _STATE["date"], "endedAt": _now_iso(),
                              "reason": str(reason or "")},
              timeout=max(0.5, min(3.0, _budget - (time.time() - _t0))))
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
