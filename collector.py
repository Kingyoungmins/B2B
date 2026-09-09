# -*- coding: utf-8 -*-
"""AX-Cell 로그/스킬 수집기 (버전 서버에 얹혀 도는 부가 기능).

왜 만들었나
  로그는 사용자 PC의 %LOCALAPPDATA%\\B2B_logs 에, 자동백업 스킬은 실행파일 옆 auto_backup 에
  쌓인다. 사용자 PC 부하를 줄이려고 로그는 '프로그램을 켤 때 비우는' 구조라, 관리자가
  "그때 그 로그 좀 보내주세요" 를 부탁하는 절차 자체가 번거롭고 이미 지워진 뒤인 경우도 많다.
  그래서 클라이언트가 실행 중에 알아서 서버로 보내고, 서버는 지우지 않고 계속 쌓아 둔다.

쌓이는 모양 (요청사항 1·4번)
  <log-root>/2026-08-24/kgm_hong/20260824-091530-13244-a1b2/
      session.json     ← 누가/어느 PC/어느 버전/언제 켜고 껐는지
      logs/            ← vba_pipeline_trace.jsonl, runtime_load_trace.jsonl, vba_runner_fail.log ...
      skills/          ← 그 실행 중에 만들어진 자동백업 스킬 zip
  '한 번 켠 것 = 폴더 하나' 라서 로그와 스킬셋이 항상 짝으로 남는다.

엔드포인트 (모두 /v1/... 별칭도 함께 — AX-Cell 은 기존 /v1 프록시로 나온다)
  POST /v1/logs/session/start   세션 폴더 만들기
  POST /v1/logs/append          로그 파일 이어붙이기(바이트 오프셋 기준, 재전송 안전)
  POST /v1/logs/file            스킬 zip 등 파일 통째로 올리기
  POST /v1/logs/session/end     세션 종료 표시
  GET  /v1/logs/health          수집기 살아있는지 + 저장 위치

관리자용
  GET  /admin                      날짜→사용자→세션 목록(브라우저에서 zip 클릭)
  GET  /admin/sessions             같은 내용 JSON
  GET  /admin/session.zip?...      세션 폴더 통째 zip
  GET  /admin/day.zip?date=...     하루치 통째 zip

보안 메모
  경로에 쓰이는 값(사용자·세션·파일명)은 전부 화이트리스트로 세탁한다. 이걸 빼먹으면
  ../.. 로 서버 아무 곳에나 파일을 쓸 수 있다(경로 탈출). 테스트로 고정해 둔다.
"""
from __future__ import annotations

import base64
import datetime
import gzip
import io
import json
import logging
import os
import re
import shutil
import threading
import time
import zipfile
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

# 운영 서버의 기본 저장 위치. 이 아래에 날짜/사용자/세션 폴더가 만들어진다.
DEFAULT_LOG_ROOT = "/data/public/versionTest/logs"

# ── 설정(서버 켤 때 main.py 가 채운다) ────────────────────────────────────
LOG_ROOT: Path | None = None      # 수집 자료를 쌓을 뿌리 폴더
RETENTION_DAYS: int = 0           # 0 이면 안 지운다(요청사항 2번: 서버는 계속 쌓인다)
MAX_SESSION_MB: int = 300         # 한 세션이 이보다 커지면 더 받지 않는다(디스크 보호)
INGEST_KEY: str = ""              # 비어 있으면 인증 없음(내부망 전용 기본값)
ADMIN_KEY: str = ""               # 비어 있으면 인증 없음

# 업로드 1건의 상한. 클라는 256KB 단위로 잘라 보내므로 넉넉하다.
MAX_CHUNK_B64 = 12 * 1024 * 1024
MAX_DECODED_BYTES = 32 * 1024 * 1024
MAX_ZIP_BYTES = 512 * 1024 * 1024

_LOCK = threading.RLock()
_LAST_RETENTION_AT = 0.0

# [운영 가시성] 수집 활동을 터미널에 찍는다(핸들러는 main.setup_terminal_logging 이 붙인다).
# append 는 10~30초마다 오므로 그대로 찍으면 도배가 된다 — '파일 수신 시작'과 상한 초과만 찍고,
# 세션 시작/종료·스킬 수신은 건마다 찍는다.
logger = logging.getLogger("axcell.logs")

router = APIRouter()
admin_router = APIRouter()

# 폴더/파일 이름에 허용할 글자. 한글을 살려 두는 이유는 스킬 zip 이름이 한글이기 때문.
_UNSAFE = re.compile(r"[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ._\- ]+")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def configure(root, retention_days=0, max_session_mb=300, ingest_key="", admin_key=""):
    """서버 시작 시 한 번 호출. root 가 None 이면 수집기는 '꺼진' 상태로 503 을 돌려준다."""
    global LOG_ROOT, RETENTION_DAYS, MAX_SESSION_MB, INGEST_KEY, ADMIN_KEY
    LOG_ROOT = Path(root).expanduser().resolve() if root else None
    RETENTION_DAYS = max(0, int(retention_days or 0))
    MAX_SESSION_MB = max(1, int(max_session_mb or 300))
    INGEST_KEY = str(ingest_key or "").strip()
    ADMIN_KEY = str(admin_key or "").strip()
    if LOG_ROOT is not None:
        LOG_ROOT.mkdir(parents=True, exist_ok=True)
    return LOG_ROOT


def _now_iso():
    return datetime.datetime.now().isoformat(timespec="seconds")


def _today():
    return datetime.date.today().isoformat()


def safe_part(value, fallback="unknown", limit=80):
    """폴더 한 칸에 쓸 수 있게 세탁한다. 경로 구분자·상위이동(..)은 전부 죽인다."""
    text = str(value or "").strip()
    text = text.replace("\\", "_").replace("/", "_")
    text = _UNSAFE.sub("_", text).strip(" ._")
    text = re.sub(r"_{2,}", "_", text)
    if not text or text in {".", ".."}:
        return fallback
    return text[:limit]


def safe_filename(value, fallback="unnamed.bin", limit=120):
    """파일 이름 세탁 — 폴더 경로가 섞여 와도 마지막 이름만 남긴다."""
    text = str(value or "").strip().replace("\\", "/")
    text = text.split("/")[-1]
    text = _UNSAFE.sub("_", text).strip(" .")
    text = re.sub(r"_{2,}", "_", text)
    if not text or text in {".", ".."}:
        return fallback
    if len(text) > limit:                      # 확장자는 살려서 자른다
        stem, dot, ext = text.rpartition(".")
        text = (stem[: max(1, limit - len(ext) - 1)] + dot + ext) if dot else text[:limit]
    return text


def _require_root():
    if LOG_ROOT is None:
        raise HTTPException(status_code=503, detail="수집 저장 폴더가 지정되지 않았습니다(--log-root).")
    return LOG_ROOT


def _check_ingest_key(key):
    if INGEST_KEY and str(key or "").strip() != INGEST_KEY:
        raise HTTPException(status_code=401, detail="수집 인증 키가 필요합니다(X-B2B-Log-Key).")


def _check_admin_key(key):
    if ADMIN_KEY and str(key or "").strip() != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="관리자 키가 필요합니다.")


# ── 세션 폴더 ─────────────────────────────────────────────────────────────

def _find_session_dir(user, session, date=""):
    """날짜를 안 알려줘도 찾아준다(자정을 넘겨 실행한 세션 대비)."""
    root = _require_root()
    if date and _DATE_RE.match(str(date)):
        cand = root / date / user / session
        return cand if cand.is_dir() else None
    days = sorted((p for p in root.iterdir() if p.is_dir() and _DATE_RE.match(p.name)), reverse=True)
    for day in days[:60]:
        cand = day / user / session
        if cand.is_dir():
            return cand
    return None


def _create_session_dir(date, user, session, meta):
    root = _require_root()
    day = date if _DATE_RE.match(str(date or "")) else _today()
    path = root / day / user / session
    (path / "logs").mkdir(parents=True, exist_ok=True)
    (path / "skills").mkdir(parents=True, exist_ok=True)
    _write_meta(path, meta)
    return path


def _read_meta(session_dir):
    try:
        return json.loads((session_dir / "session.json").read_text("utf-8"))
    except Exception:
        return {}


def _write_meta(session_dir, meta):
    tmp = session_dir / "session.json.tmp"
    tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, session_dir / "session.json")


def _resolve_or_recover(user, session, date, hint=None):
    """세션 폴더를 찾고, 없으면 만든다.

    start 요청이 유실됐거나 서버가 중간에 재시작해도 로그를 버리지 않기 위해서다 —
    '받은 건 일단 남긴다' 가 수집기의 유일한 원칙."""
    found = _find_session_dir(user, session, date)
    if found:
        return found, False
    meta = {
        "sessionId": session,
        "user": user,
        "date": date if _DATE_RE.match(str(date or "")) else _today(),
        "serverStartedAt": _now_iso(),
        "recovered": True,
        "note": "세션 시작 요청 없이 자료가 먼저 도착해 서버가 폴더를 만들었습니다.",
        "totalBytes": 0,
        "files": {},
    }
    if isinstance(hint, dict):
        meta.update({k: v for k, v in hint.items() if v})
    # 시작 요청 없이 자료가 먼저 온 것 — 자료는 살리지만, 시작 유실이 반복되면 조사 대상이므로 찍어 둔다.
    logger.warning("[수집] 세션 시작 없이 수신 → 폴더 복구 생성 user=%s session=%s", user, session)
    return _create_session_dir(meta["date"], user, session, meta), True


def _session_bytes(meta):
    try:
        return int(meta.get("totalBytes") or 0)
    except Exception:
        return 0


def _decode_payload(encoding, data):
    raw = str(data or "")
    if len(raw) > MAX_CHUNK_B64:
        raise HTTPException(status_code=413, detail="업로드 조각이 너무 큽니다.")
    enc = str(encoding or "gzip+base64").lower()
    try:
        if enc == "text":
            blob = raw.encode("utf-8")
        else:
            blob = base64.b64decode(raw, validate=False)
            if enc.startswith("gzip"):
                blob = gzip.decompress(blob)
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"본문을 풀지 못했습니다: {type(err).__name__}: {err}")
    if len(blob) > MAX_DECODED_BYTES:
        raise HTTPException(status_code=413, detail="압축을 푼 크기가 너무 큽니다.")
    return blob


def _maybe_retention():
    """오래된 날짜 폴더 정리. RETENTION_DAYS=0 이면 아무것도 지우지 않는다(기본)."""
    global _LAST_RETENTION_AT
    if not RETENTION_DAYS or LOG_ROOT is None:
        return
    now = time.time()
    if now - _LAST_RETENTION_AT < 3600:
        return
    _LAST_RETENTION_AT = now
    cutoff = (datetime.date.today() - datetime.timedelta(days=RETENTION_DAYS)).isoformat()
    for day in list(LOG_ROOT.iterdir()):
        if day.is_dir() and _DATE_RE.match(day.name) and day.name < cutoff:
            shutil.rmtree(day, ignore_errors=True)


# ── 요청 형식 ─────────────────────────────────────────────────────────────

class SessionStart(BaseModel):
    sessionId: str = Field(..., description="한 번 실행 = 한 세션. 예 20260824-091530-13244-a1b2")
    user: str = ""             # whoami 결과 (예: kgm\\hong)
    host: str = ""
    appVersion: str = ""
    startedAt: str = ""
    osInfo: str = ""
    pid: int | None = None
    appDir: str = ""
    logDir: str = ""
    skillDir: str = ""
    extra: dict = {}


class LogAppend(BaseModel):
    sessionId: str
    user: str = ""
    date: str = ""
    name: str                                  # 원본 파일 이름 (예 vba_pipeline_trace.jsonl)
    offset: int = 0                            # 이 조각이 원본 파일의 몇 번째 바이트부터인지
    encoding: str = "gzip+base64"
    data: str = ""


class FileUpload(BaseModel):
    sessionId: str
    user: str = ""
    date: str = ""
    kind: str = "skill"                        # skill | log | meta
    name: str
    encoding: str = "gzip+base64"
    data: str = ""
    createdAt: str = ""


class SessionEnd(BaseModel):
    sessionId: str
    user: str = ""
    date: str = ""
    endedAt: str = ""
    reason: str = ""


# ── 수집 엔드포인트 ───────────────────────────────────────────────────────

@router.get("/logs/health")
def logs_health():
    days = []
    if LOG_ROOT is not None and LOG_ROOT.is_dir():
        days = sorted([p.name for p in LOG_ROOT.iterdir()
                       if p.is_dir() and _DATE_RE.match(p.name)], reverse=True)[:7]
    return {
        "ok": LOG_ROOT is not None,
        "service": "axcell-log-collector",
        "root": str(LOG_ROOT or ""),
        "retentionDays": RETENTION_DAYS,
        "maxSessionMb": MAX_SESSION_MB,
        "authRequired": bool(INGEST_KEY),
        "recentDays": days,
    }


def _session_out(path, meta, created):
    return {
        "ok": True,
        "created": created,
        "path": str(path),
        "date": meta.get("date") or path.parent.parent.name,
        "user": meta.get("user") or path.parent.name,
        "sessionId": meta.get("sessionId") or path.name,
        "totalBytes": _session_bytes(meta),
        "capped": bool(meta.get("capped")),
    }


@router.post("/logs/session/start")
def session_start(body: SessionStart, x_b2b_log_key: str = Header("")):
    _check_ingest_key(x_b2b_log_key)
    _require_root()
    _maybe_retention()
    user = safe_part(body.user, "unknown_user")
    session = safe_part(body.sessionId, "unknown_session")
    with _LOCK:
        found = _find_session_dir(user, session, "")
        if found:                                  # 재시도/재접속 — 같은 폴더를 계속 쓴다
            meta = _read_meta(found)
            meta["lastSeenAt"] = _now_iso()
            meta["reconnects"] = int(meta.get("reconnects") or 0) + 1
            _write_meta(found, meta)
            return _session_out(found, meta, created=False)
        logger.info("[수집] 세션 시작 user=%s host=%s ver=%s session=%s",
                    user, str(body.host or "?"), str(body.appVersion or "?"), session)
        meta = {
            "sessionId": session,
            "user": user,
            "userRaw": str(body.user or ""),
            "host": str(body.host or ""),
            "appVersion": str(body.appVersion or ""),
            "pid": body.pid,
            "os": str(body.osInfo or ""),
            "appDir": str(body.appDir or ""),
            "logDir": str(body.logDir or ""),
            "skillDir": str(body.skillDir or ""),
            "startedAt": str(body.startedAt or ""),
            "serverStartedAt": _now_iso(),
            "date": _today(),
            "closed": False,
            "endedAt": "",
            "endReason": "",
            "totalBytes": 0,
            "files": {},
            "extra": body.extra or {},
            "lastSeenAt": _now_iso(),
        }
        path = _create_session_dir(meta["date"], user, session, meta)
        return _session_out(path, meta, created=True)


@router.post("/logs/append")
def logs_append(body: LogAppend, x_b2b_log_key: str = Header("")):
    """로그 파일의 '새로 늘어난 부분'만 이어붙인다.

    offset 은 원본 파일에서 이 조각이 시작하는 바이트 위치다. 이미 받은 만큼은 잘라내고
    붙이므로, 클라가 응답을 못 받아 같은 조각을 다시 보내도 로그가 두 번 들어가지 않는다."""
    _check_ingest_key(x_b2b_log_key)
    _require_root()
    user = safe_part(body.user, "unknown_user")
    session = safe_part(body.sessionId, "unknown_session")
    name = safe_filename(body.name, "unnamed.log")
    blob = _decode_payload(body.encoding, body.data)

    with _LOCK:
        path, recovered = _resolve_or_recover(user, session, body.date)
        meta = _read_meta(path)
        if _session_bytes(meta) + len(blob) > MAX_SESSION_MB * 1024 * 1024:
            meta["capped"] = True
            meta["lastSeenAt"] = _now_iso()
            _write_meta(path, meta)
            logger.warning("[수집] 세션 상한 초과 user=%s session=%s (%dMB) — 더 받지 않음",
                           user, session, MAX_SESSION_MB)
            return {"ok": True, "capped": True, "accepted": 0, "size": 0, "gap": 0,
                    "error": f"세션 상한({MAX_SESSION_MB}MB)을 넘어 더 받지 않습니다."}

        target = path / "logs" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        have = target.stat().st_size if target.exists() else 0
        if have == 0 and blob:
            logger.info("[수집] 로그 수신 시작 user=%s session=%s file=%s", user, session, name)
        offset = max(0, int(body.offset or 0))
        gap = 0
        chunk = blob
        if offset < have:                       # 겹치는 부분(재전송) 은 잘라낸다
            skip = min(len(chunk), have - offset)
            chunk = chunk[skip:]
        elif offset > have:                     # 중간이 빈다 — 기록만 남기고 이어붙인다
            gap = offset - have
        if chunk:
            with open(target, "ab") as f:
                f.write(chunk)
        size = target.stat().st_size if target.exists() else 0

        entry = (meta.setdefault("files", {})).setdefault("logs/" + name, {})
        entry["bytes"] = size
        entry["lastAt"] = _now_iso()
        if gap:
            entry.setdefault("gaps", []).append({"at": _now_iso(), "missingBytes": gap})
        meta["totalBytes"] = _session_bytes(meta) + len(chunk)
        meta["lastSeenAt"] = _now_iso()
        if recovered:
            meta["recovered"] = True
        _write_meta(path, meta)
        return {"ok": True, "accepted": len(chunk), "size": size, "gap": gap,
                "path": str(target), "capped": False}


@router.post("/logs/file")
def logs_file(body: FileUpload, x_b2b_log_key: str = Header("")):
    """스킬 zip 처럼 '통째로 하나인 파일' 을 올린다. 같은 이름·같은 크기면 다시 쓰지 않는다."""
    _check_ingest_key(x_b2b_log_key)
    _require_root()
    user = safe_part(body.user, "unknown_user")
    session = safe_part(body.sessionId, "unknown_session")
    kind = str(body.kind or "skill").lower()
    folder = {"skill": "skills", "log": "logs", "meta": "."}.get(kind, "skills")
    name = safe_filename(body.name, "unnamed.bin")
    blob = _decode_payload(body.encoding, body.data)

    with _LOCK:
        path, recovered = _resolve_or_recover(user, session, body.date)
        meta = _read_meta(path)
        if _session_bytes(meta) + len(blob) > MAX_SESSION_MB * 1024 * 1024:
            meta["capped"] = True
            meta["lastSeenAt"] = _now_iso()
            _write_meta(path, meta)
            return {"ok": True, "capped": True, "duplicate": False, "size": 0,
                    "error": f"세션 상한({MAX_SESSION_MB}MB)을 넘어 더 받지 않습니다."}
        target = (path / folder / name) if folder != "." else (path / name)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and target.stat().st_size == len(blob):
            return {"ok": True, "duplicate": True, "path": str(target), "size": len(blob), "capped": False}
        target.write_bytes(blob)
        logger.info("[수집] %s 수신 user=%s session=%s file=%s (%.1fKB)",
                    "스킬" if kind == "skill" else "파일", user, session, name, len(blob) / 1024)
        rel = (folder + "/" + name) if folder != "." else name
        entry = (meta.setdefault("files", {})).setdefault(rel, {})
        entry["bytes"] = len(blob)
        entry["lastAt"] = _now_iso()
        if body.createdAt:
            entry["createdAt"] = str(body.createdAt)
        meta["totalBytes"] = _session_bytes(meta) + len(blob)
        meta["lastSeenAt"] = _now_iso()
        if recovered:
            meta["recovered"] = True
        _write_meta(path, meta)
        return {"ok": True, "duplicate": False, "path": str(target), "size": len(blob), "capped": False}


@router.post("/logs/session/end")
def session_end(body: SessionEnd, x_b2b_log_key: str = Header("")):
    _check_ingest_key(x_b2b_log_key)
    _require_root()
    user = safe_part(body.user, "unknown_user")
    session = safe_part(body.sessionId, "unknown_session")
    with _LOCK:
        path, _ = _resolve_or_recover(user, session, body.date)
        meta = _read_meta(path)
        logger.info("[수집] 세션 종료 user=%s session=%s reason=%s 총 %.1fKB",
                    user, session, str(body.reason or "?"), _session_bytes(_read_meta(path)) / 1024)
        meta["closed"] = True
        meta["endedAt"] = str(body.endedAt or "") or _now_iso()
        meta["serverEndedAt"] = _now_iso()
        meta["endReason"] = str(body.reason or "")
        meta["lastSeenAt"] = _now_iso()
        _write_meta(path, meta)
        return {"ok": True, "path": str(path), "totalBytes": _session_bytes(meta)}


# ── 관리자 조회 ───────────────────────────────────────────────────────────

def _iter_sessions(date="", user=""):
    root = _require_root()
    if date:
        if not _DATE_RE.match(date):
            raise HTTPException(status_code=400, detail="날짜는 YYYY-MM-DD 형식입니다.")
        day_dir = root / date
        days = [day_dir] if day_dir.is_dir() else []
    else:
        days = sorted((p for p in root.iterdir() if p.is_dir() and _DATE_RE.match(p.name)), reverse=True)
    want_user = safe_part(user, "") if user else ""
    for day in days:
        for udir in sorted(p for p in day.iterdir() if p.is_dir()):
            if want_user and udir.name != want_user:
                continue
            for sdir in sorted((p for p in udir.iterdir() if p.is_dir()), reverse=True):
                yield day.name, udir.name, sdir


_STALE_AFTER_SECONDS = 600      # 마지막 수신 후 10분 — 클라 전송 주기(10~30초)의 넉넉한 배수


def _session_is_stale(meta):
    """종료 신호 없이 오래 무소식인 세션인가(끊김 = 종료로 추정)."""
    if meta.get("closed"):
        return False
    ts = str(meta.get("lastSeenAt") or meta.get("serverStartedAt") or meta.get("startedAt") or "")
    if not ts:
        return True                 # 아무 기록도 없으면 살아있다고 볼 근거가 없다
    try:
        seen = datetime.datetime.fromisoformat(ts.replace("Z", ""))
        return (datetime.datetime.now() - seen).total_seconds() > _STALE_AFTER_SECONDS
    except Exception:
        return False                # 시각을 못 읽으면 함부로 끊김 처리하지 않는다


def _session_summary(date, user, sdir):
    meta = _read_meta(sdir)
    logs = sorted(p.name for p in (sdir / "logs").glob("*")) if (sdir / "logs").is_dir() else []
    skills = sorted(p.name for p in (sdir / "skills").glob("*")) if (sdir / "skills").is_dir() else []
    total = sum(p.stat().st_size for p in sdir.rglob("*") if p.is_file())
    # [조직 정보 2026-09-02] 0.8.3+ 앱이 whoami /fqdn 파싱 결과를 extra.org 로 보낸다.
    # 구버전 앱 세션은 extra 가 비어 있을 뿐 — 빈 문자열로 나가 대시보드가 그대로 그린다.
    org = (meta.get("extra") or {}).get("org") or {}
    return {
        "date": date, "user": user, "sessionId": sdir.name,
        "displayName": str(org.get("displayName") or ""),
        "madangId": str(org.get("madangId") or ""),         # 마당 아이디 (예: s0min)
        "team": str(org.get("team") or ""),
        "orgPath": str(org.get("orgPath") or ""),
        "appVersion": meta.get("appVersion", ""), "host": meta.get("host", ""),
        "startedAt": meta.get("startedAt") or meta.get("serverStartedAt", ""),
        "endedAt": meta.get("endedAt", ""), "closed": bool(meta.get("closed")),
        # [끊김 추정 2026-09-02] 종료 신호 없이 죽은 세션(강제 종료·크래시·전원 꺼짐)은
        # closed 가 영영 False 다. 클라 전송 주기가 10~30초이므로, 마지막 수신(lastSeenAt)이
        # 10분 넘게 없으면 '끊김(종료 추정)'으로 표시할 수 있게 stale 을 준다.
        "stale": _session_is_stale(meta),
        "endReason": meta.get("endReason", ""), "recovered": bool(meta.get("recovered")),
        "capped": bool(meta.get("capped")), "lastSeenAt": meta.get("lastSeenAt", ""),
        "logFiles": logs, "skillFiles": skills,
        "sizeBytes": total, "sizeKb": round(total / 1024, 1),
        "path": str(sdir),
        "zipUrl": f"/admin/session.zip?date={date}&user={quote(user)}&session={quote(sdir.name)}",
    }


@admin_router.get("/admin/sessions")
def admin_sessions(date: str = Query("", description="YYYY-MM-DD (비우면 전체)"),
                   user: str = Query("", description="사용자 폴더명 (비우면 전체)"),
                   org: str = Query("", description="조직/팀 이름 부분일치 (예: Foundation, CTO)"),
                   limit: int = Query(200, ge=1, le=2000),
                   key: str = Query(""), x_admin_key: str = Header("")):
    _check_admin_key(key or x_admin_key)
    _require_root()
    out = []
    org_q = str(org or "").strip().lower()
    for d, u, sdir in _iter_sessions(date, user):
        row = _session_summary(d, u, sdir)
        # [조직 필터 2026-09-02] 팀명이든 상위 조직명이든(orgPath 전체) 부분일치로 거른다.
        if org_q and org_q not in (row.get("orgPath") or "").lower() \
                and org_q not in (row.get("team") or "").lower():
            continue
        # [세션당 토큰 2026-09-03] 이 실행이 쓴 LLM 토큰 합계 — 이벤트 집계 캐시(_session_events)를
        # 그대로 재사용하므로 목록 조회가 무거워지지 않는다(첫 스캔 후엔 캐시 파일 1개 읽기).
        try:
            agg, _hit = _session_events(d, u, sdir)
            tk = agg.get("tokens") or {}
            row["tokens"] = {"total": int(tk.get("total") or 0), "prompt": int(tk.get("prompt") or 0),
                             "completion": int(tk.get("completion") or 0), "calls": int(tk.get("calls") or 0)}
            # [활성시간 2026-09-08] 같은 캐시에서 활성분도 함께 — 추가 스캔 없음
            row["activeMinutes"] = agg.get("activeMinutes")
        except Exception:
            row["tokens"] = None      # 집계 실패해도 목록은 그대로 — 대시보드는 '-' 표시
            row["activeMinutes"] = None
        out.append(row)
        if len(out) >= limit:
            break
    return {"ok": True, "root": str(LOG_ROOT), "count": len(out), "sessions": out}


@admin_router.get("/admin/dates")
def admin_dates(key: str = Query(""), x_admin_key: str = Header("")):
    _check_admin_key(key or x_admin_key)
    root = _require_root()
    days = []
    for day in sorted((p for p in root.iterdir() if p.is_dir() and _DATE_RE.match(p.name)), reverse=True):
        users = sorted(p.name for p in day.iterdir() if p.is_dir())
        days.append({
            "date": day.name,
            "users": users,
            "sessions": sum(len([x for x in (day / u).iterdir() if x.is_dir()]) for u in users),
        })
    return {"ok": True, "root": str(root), "dates": days}


def _zip_response(paths_and_names, filename):
    total = sum(p.stat().st_size for p, _ in paths_and_names)
    if total > MAX_ZIP_BYTES:
        raise HTTPException(status_code=413, detail="한 번에 내려받기엔 너무 큽니다. 날짜/사용자를 좁혀 주세요.")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, arcname in paths_and_names:
            zf.write(path, arcname)
    data = buf.getvalue()
    ascii_name = re.sub(r"[^0-9A-Za-z._\-]", "_", filename) or "download.zip"
    return Response(
        content=data,
        media_type="application/zip",
        headers={
            "content-disposition": (
                'attachment; filename="%s"; filename*=UTF-8\'\'%s' % (ascii_name, quote(filename))
            ),
            "content-length": str(len(data)),
        },
    )


@admin_router.get("/admin/session.zip")
def admin_session_zip(date: str = Query(...), user: str = Query(...), session: str = Query(...),
                      key: str = Query(""), x_admin_key: str = Header("")):
    """세션 폴더(로그+스킬+session.json)를 통째로 zip 으로 내려준다."""
    _check_admin_key(key or x_admin_key)
    _require_root()
    sdir = _find_session_dir(safe_part(user, "unknown_user"), safe_part(session, "unknown_session"), date)
    if sdir is None:
        raise HTTPException(status_code=404, detail="그런 세션 폴더가 없습니다.")
    items = [(p, str(Path(sdir.name) / p.relative_to(sdir))) for p in sorted(sdir.rglob("*")) if p.is_file()]
    return _zip_response(items, f"{sdir.parent.parent.name}_{sdir.parent.name}_{sdir.name}.zip")


@admin_router.get("/admin/session/detail")
def admin_session_detail(date: str = Query(""), user: str = Query(...), session: str = Query(...),
                         key: str = Query(""), x_admin_key: str = Header("")):
    """[0.8.4] 세션 하나의 속살 — 로그 파일(크기), 스킬 zip(크기 + 단계 수 + 단계 목록).

    대시보드 실행 목록에서 행을 펼칠 때 부른다. 스킬 zip 안의 *.logic.json 을 열어
    단계 수/켜짐 수/단계 제목을 뽑는다(요청: '로그/스킬/스킬 단계로 실행 목록 보기')."""
    _check_admin_key(key or x_admin_key)
    _require_root()
    sdir = _find_session_dir(safe_part(user, "unknown_user"), safe_part(session, "unknown_session"), date)
    if sdir is None:
        raise HTTPException(status_code=404, detail="그런 세션 폴더가 없습니다.")
    logs = []
    if (sdir / "logs").is_dir():
        for p in sorted((sdir / "logs").glob("*")):
            if p.is_file():
                logs.append({"name": p.name, "sizeKb": round(p.stat().st_size / 1024, 1)})
    skills = []
    if (sdir / "skills").is_dir():
        for p in sorted((sdir / "skills").glob("*")):
            if not p.is_file():
                continue
            row = {"name": p.name, "sizeKb": round(p.stat().st_size / 1024, 1),
                   "steps": None, "enabledSteps": None, "stepTitles": []}
            try:
                with zipfile.ZipFile(p) as z:
                    mf = next((n for n in z.namelist() if n.endswith(".logic.json")), None)
                    if mf:
                        data = json.loads(z.read(mf).decode("utf-8-sig"))
                        pipe = data.get("pipeline") or []
                        row["steps"] = len(pipe)
                        row["enabledSteps"] = sum(1 for st in pipe if st.get("enabled") is not False)
                        for i, st in enumerate(pipe[:40], 1):    # 단계 제목 — 40개 상한(화면 보호)
                            title = str(st.get("title") or st.get("description")
                                        or st.get("prompt") or "").strip().splitlines()[0][:60] if (
                                st.get("title") or st.get("description") or st.get("prompt")) else ""
                            off = "" if st.get("enabled") is not False else " (꺼짐)"
                            row["stepTitles"].append("%d. %s%s" % (i, title or "(설명 없음)", off))
            except Exception as err:
                row["error"] = "스킬 파일을 읽지 못했습니다: %s" % err
            skills.append(row)
    return {"ok": True, "date": sdir.parent.parent.name, "user": sdir.parent.name,
            "sessionId": sdir.name, "logs": logs, "skills": skills}


@admin_router.get("/admin/session/file")
def admin_session_file(date: str = Query(""), user: str = Query(...), session: str = Query(...),
                       kind: str = Query(...), name: str = Query(...),
                       key: str = Query(""), x_admin_key: str = Header("")):
    """[0.8.4] 세션 폴더 안 파일 하나 내려받기(스킬 zip 하나만 받고 싶을 때).
    kind 는 logs/skills 만, 이름은 세탁 후 그 폴더 '안'에서만 찾는다 — 경로 탈출 차단."""
    _check_admin_key(key or x_admin_key)
    _require_root()
    if kind not in ("logs", "skills"):
        raise HTTPException(status_code=400, detail="kind 는 logs 또는 skills 입니다.")
    sdir = _find_session_dir(safe_part(user, "unknown_user"), safe_part(session, "unknown_session"), date)
    if sdir is None:
        raise HTTPException(status_code=404, detail="그런 세션 폴더가 없습니다.")
    fname = safe_filename(name, "")
    path = (sdir / kind / fname) if fname else None
    if not fname or not path.is_file() or path.parent != (sdir / kind):
        raise HTTPException(status_code=404, detail="그런 파일이 없습니다.")
    return Response(path.read_bytes(), media_type="application/octet-stream",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote(fname)})


@admin_router.get("/admin/day.zip")
def admin_day_zip(date: str = Query(...), user: str = Query(""),
                  key: str = Query(""), x_admin_key: str = Header("")):
    """하루치(또는 그날 한 사용자분) 전체 zip."""
    _check_admin_key(key or x_admin_key)
    root = _require_root()
    if not _DATE_RE.match(date):
        raise HTTPException(status_code=400, detail="날짜는 YYYY-MM-DD 형식입니다.")
    base = root / date
    if user:
        base = base / safe_part(user, "unknown_user")
    if not base.is_dir():
        raise HTTPException(status_code=404, detail="그런 폴더가 없습니다.")
    items = [(p, str(Path(base.name) / p.relative_to(base))) for p in sorted(base.rglob("*")) if p.is_file()]
    return _zip_response(items, f"{date}{('_' + safe_part(user)) if user else ''}.zip")


@admin_router.get("/admin", response_class=HTMLResponse)
def admin_index(date: str = Query(""), user: str = Query(""),
                key: str = Query(""), x_admin_key: str = Header("")):
    """zip 을 클릭으로 받기 위한 최소 목록 화면."""
    _check_admin_key(key or x_admin_key)
    _require_root()
    q = ("&key=" + quote(key)) if key else ""
    rows = []
    for d, u, sdir in _iter_sessions(date, user):
        s = _session_summary(d, u, sdir)
        state = "종료" if s["closed"] else ("수집중" if s["lastSeenAt"] else "-")
        rows.append(
            "<tr><td>{d}</td><td>{u}</td><td>{sid}</td><td>{ver}</td><td>{st}</td>"
            "<td style='text-align:right'>{kb} KB</td><td>{lg}개 / {sk}개</td>"
            "<td><a href='{zip}{q}'>zip 받기</a></td></tr>".format(
                d=d, u=u, sid=s["sessionId"], ver=s["appVersion"] or "-", st=state,
                kb=s["sizeKb"], lg=len(s["logFiles"]), sk=len(s["skillFiles"]),
                zip=s["zipUrl"], q=q)
        )
        if len(rows) >= 500:
            break
    body = "".join(rows) or "<tr><td colspan='8'>아직 받은 자료가 없습니다.</td></tr>"
    return HTMLResponse(
        "<!doctype html><meta charset='utf-8'><title>AX-Cell 수집 로그</title>"
        "<style>body{font-family:Malgun Gothic,sans-serif;margin:24px}"
        "table{border-collapse:collapse;width:100%;font-size:13px}"
        "th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f6f6f6}"
        "a{color:#c0007a}</style>"
        f"<h2>AX-Cell 수집 로그</h2><p>저장 위치: {LOG_ROOT}</p>"
        "<table><tr><th>날짜</th><th>사용자</th><th>세션(실행 1회)</th><th>버전</th><th>상태</th>"
        f"<th>크기</th><th>로그/스킬</th><th>내려받기</th></tr>{body}</table>"
    )


# ── [대시보드 2026-08-24] 집계/오류 API ─────────────────────────────────────
# AX-Cell 의 F9 관리 대시보드가 쓴다. VM(사내망)과 이 서버(보안망 /data/public…)는 분리돼
# 있어 화면이 폴더를 직접 못 본다 — AX-Cell 로컬 백엔드가 게이트웨이 인증을 붙여 이 API 로
# 프록시한다. 그래서 응답은 '화면이 바로 그릴 수 있는 모양'으로 계산해서 준다.

def _parse_iso(text):
    try:
        return datetime.datetime.fromisoformat(str(text or "").strip())
    except Exception:
        return None


def _dwell_minutes(meta):
    """체류 시간(분). 종료를 못 남기고 죽는 세션이 많아 endedAt 만 믿으면 대부분 0 이 된다
    — lastSeenAt(마지막 업로드 시각)이 실사용의 하한이므로 그걸로 물러난다."""
    start = _parse_iso(meta.get("startedAt") or meta.get("serverStartedAt"))
    end = _parse_iso(meta.get("endedAt")) or _parse_iso(meta.get("lastSeenAt"))
    if not start or not end or end < start:
        return 0.0
    return round((end - start).total_seconds() / 60.0, 1)


@admin_router.get("/admin/stats")
def admin_stats(date_from: str = Query("", alias="from"), date_to: str = Query("", alias="to"),
                user: str = Query(""), key: str = Query(""), x_admin_key: str = Header("")):
    """기간·사용자별 집계 — 누가/언제/얼마나 썼는지 한 번에.

    반환: 일별(byDate)·사용자별(byUsers) 집계 + 전체 합계. 세션 목록은 /admin/sessions 가
    이미 있으므로 여기서는 숫자만 만든다(폴더 순회 1회, 파일 내용은 읽지 않아 가볍다)."""
    _check_admin_key(key or x_admin_key)
    _require_root()
    for d in (date_from, date_to):
        if d and not _DATE_RE.match(d):
            raise HTTPException(status_code=400, detail="날짜는 YYYY-MM-DD 형식입니다.")
    by_date = {}
    by_user = {}
    total = {"sessions": 0, "bytes": 0, "skills": 0, "logs": 0, "dwellMinutes": 0.0, "openSessions": 0}
    for d, u, sdir in _iter_sessions("", user):
        if date_from and d < date_from:
            continue
        if date_to and d > date_to:
            continue
        meta = _read_meta(sdir)
        size = _session_bytes(meta)
        if not size:
            size = sum(p.stat().st_size for p in sdir.rglob("*") if p.is_file())
        n_skills = len(list((sdir / "skills").glob("*"))) if (sdir / "skills").is_dir() else 0
        n_logs = len(list((sdir / "logs").glob("*"))) if (sdir / "logs").is_dir() else 0
        dwell = _dwell_minutes(meta)
        closed = bool(meta.get("closed"))
        for bucket, keyname in ((by_date, d), (by_user, u)):
            row = bucket.setdefault(keyname, {"sessions": 0, "bytes": 0, "skills": 0, "logs": 0,
                                              "dwellMinutes": 0.0, "users": set(), "lastSeenAt": ""})
            row["sessions"] += 1
            row["bytes"] += size
            row["skills"] += n_skills
            row["logs"] += n_logs
            row["dwellMinutes"] = round(row["dwellMinutes"] + dwell, 1)
            row["users"].add(u)
            last = str(meta.get("lastSeenAt") or "")
            if last > row["lastSeenAt"]:
                row["lastSeenAt"] = last
        total["sessions"] += 1
        total["bytes"] += size
        total["skills"] += n_skills
        total["logs"] += n_logs
        total["dwellMinutes"] = round(total["dwellMinutes"] + dwell, 1)
        if not closed and not _session_is_stale(meta):
            # [끊김 추정 2026-09-02] 종료 신호 없이 죽은 세션을 '수집 중'으로 세지 않는다
            total["openSessions"] += 1

    def _rows(bucket, label):
        out = []
        for k in sorted(bucket.keys(), reverse=True):
            r = bucket[k]
            out.append({label: k, "sessions": r["sessions"], "bytes": r["bytes"],
                        "skills": r["skills"], "logs": r["logs"],
                        "dwellMinutes": r["dwellMinutes"], "userCount": len(r["users"]),
                        "lastSeenAt": r["lastSeenAt"]})
        return out

    total["userCount"] = len(by_user)
    return {"ok": True, "root": str(LOG_ROOT), "total": total,
            "byDate": _rows(by_date, "date"), "byUsers": _rows(by_user, "user")}


# 오류로 칠 이벤트 — 트레이스의 event 이름 기준. 넓게 잡으면 소음(…error 를 '수정한' 이벤트 등)이
# 섞이므로 실제 실패를 뜻하는 것만 명시한다.
_ERROR_EVENT_MARKERS = (".error", ".fail", ".failed", "runtime_error", "save_error", "recover")
_ERROR_EVENT_EXCLUDE = ("recovered", "recover.ok")
_ERROR_SCAN_TAIL_BYTES = 256 * 1024     # 파일 끝 256KB 만 본다 — 오류는 최근 것이 중요하고 폴더가 크다



# ── 이벤트 전량 집계 (대시보드 확장 2026-08-31) ──────────────────────────────
# 단계별 소요(ms)·언어·stepIdx 는 트레이스에 이미 있는데 어떤 API 도 읽어 주지 않았다.
# 전량 파싱은 폴더가 커질수록 무거우므로 **세션당 1회만 읽고 결과를 캐시**한다 —
# 닫힌 세션의 로그는 다시 바뀌지 않으므로 캐시가 영원히 유효하다(서명으로 검증).
_EVENTS_CACHE_DIR = ".agg_cache"          # 날짜 폴더(_DATE_RE)와 안 겹치는 이름 — 세션 순회에 안 잡힘
_EVENTS_SCAN_MAX_BYTES = 50 * 1024 * 1024  # 파일당 상한(클라 업로드 상한 20MB 의 여유분)
_EVENTS_ERROR_ROWS_CAP = 500               # 세션당 오류 행 캐시 상한(캐시 파일 비대 방지)
_STEP_EVENT_RE = re.compile(r"^(?:fullrun|pipeline)\.step\.(ok|error)$")


def _logs_signature(logs_dir):
    """logs/*.jsonl 의 (이름:크기:mtime) 목록 — 하나라도 바뀌면 캐시 무효."""
    parts = []
    try:
        for p in sorted(logs_dir.glob("*.jsonl")):
            st = p.stat()
            parts.append("%s:%d:%d" % (p.name, st.st_size, int(st.st_mtime)))
    except Exception:
        pass
    return "|".join(parts)


_CUMULATIVE_LOG_FILES = {"telemetry_preview.jsonl"}   # 앱이 세션마다 리셋하지 않고 누적하는 파일(세션 창 필터 대상)
_ACTIVE_GAP_SECONDS = 600      # 이벤트 간격이 이 이하면 '계속 쓰는 중'(자리비움 기준 10분 — 2026-09-08 지시)


def _parse_ts_seconds(ts):
    """트레이스 ts(ISO) → epoch 초. 못 읽으면 None.
    [2026-09-09] 'Z'/오프셋이 붙은 값은 UTC 로 해석해 변환한다(telemetry_preview 의 timestamp 가 UTC).
    예전엔 Z 를 떼고 로컬로 읽어 9시간이 어긋났다. 오프셋 없는 값은 로컬 시각으로 본다."""
    try:
        t = str(ts).strip()
        if t.endswith("Z") or t.endswith("z"):
            return datetime.datetime.fromisoformat(t[:-1]).replace(tzinfo=datetime.timezone.utc).timestamp()
        d = datetime.datetime.fromisoformat(t)
        return d.timestamp()          # naive 면 로컬, tz 있으면 그 tz 기준
    except Exception:
        return None


def _session_window_seconds(sdir, slack_sec=300):
    """세션 폴더의 session.json 에서 (시작-slack, 끝+slack) epoch 창을 만든다. 못 읽으면 None.
    끝은 endedAt → lastSeenAt → serverStartedAt 순. 열린 세션(끝 없음)은 상한을 두지 않는다."""
    try:
        meta = _read_meta(sdir)
        st = _parse_ts_seconds(meta.get("startedAt") or meta.get("serverStartedAt") or "")
        if st is None:
            return None
        en = _parse_ts_seconds(meta.get("endedAt") or meta.get("lastSeenAt") or "")
        closed = bool(meta.get("endedAt"))
        return (st - slack_sec, (en + slack_sec) if en is not None else None, closed)
    except Exception:
        return None


def _scan_session_events(sdir):
    """한 세션의 logs/*.jsonl 을 **전량** 파싱해 집계한다(캐시는 부르는 쪽이 관리)."""
    agg = {"events": {}, "durations": {}, "byLanguage": {}, "byStepIdx": {},
           "errors": [], "files": 0, "bytes": 0, "skippedBytes": 0,
           # [토큰 2026-09-02] llm.usage 트레이스(0.8.3+ 앱 프록시가 남김) 집계
           "tokens": {"prompt": 0, "completion": 0, "total": 0, "calls": 0, "byModel": {}},
           # [전체실행 2026-09-03] telemetry_preview.jsonl 의 agent.run 레코드(0.8.4+ 앱이 동기화)
           "fullRuns": {"count": 0, "ok": 0, "error": 0, "totalMs": 0},
           # [활성시간 2026-09-08] 트레이스 타임스탬프 간격 근사 — 10분 이하 간격만 사용 시간으로 합산
           "activeMinutes": 0.0}
    stamps = []
    logs_dir = sdir / "logs"
    if not logs_dir.is_dir():
        return agg
    # [세션 창 2026-09-09] telemetry_preview.jsonl 은 앱 누적 파일이라 매 세션 통째로 올라온다 —
    # 남의 세션(며칠 전) 기록이 이 세션의 활성시간·전체실행 횟수에 섞였다(실측: 세션 7건 중 6건이 과거분,
    # 활성 +0.8분 고정 초과). 세션 시간창(시작-5분 ~ 끝+5분) 밖 타임스탬프의 기록은 집계에서 뺀다.
    # 타임스탬프가 없는 옛 기록은 예전대로 센다.
    window = _session_window_seconds(sdir)
    agg["skippedOutOfWindow"] = 0
    for lf in sorted(logs_dir.glob("*.jsonl")):
        # 창 필터는 '앱 누적 파일'에만 건다. vba/runtime 트레이스는 앱 시작 때 리셋되므로 세션 소속이 분명하고,
        # 거기까지 걸면 시작 직전 정상 로그(또는 시계가 어긋난 PC)의 기록까지 버린다.
        file_window = window if lf.name in _CUMULATIVE_LOG_FILES else None
        try:
            size = lf.stat().st_size
        except Exception:
            continue
        agg["files"] += 1
        agg["bytes"] += min(size, _EVENTS_SCAN_MAX_BYTES)
        if size > _EVENTS_SCAN_MAX_BYTES:
            agg["skippedBytes"] += size - _EVENTS_SCAN_MAX_BYTES
        read = 0
        try:
            with lf.open("rb") as f:
                for raw in f:
                    read += len(raw)
                    if read > _EVENTS_SCAN_MAX_BYTES:
                        break
                    line = raw.decode("utf-8", errors="replace").strip()
                    if not line:
                        continue
                    try:
                        rec = json.loads(line)
                    except Exception:
                        continue        # 강제 종료로 깨진 줄 — 무시
                    ts_raw = rec.get("ts") or rec.get("timestamp") or ""
                    if ts_raw:
                        sec = _parse_ts_seconds(str(ts_raw))
                        if sec is not None:
                            if file_window and (sec < file_window[0] or (file_window[1] is not None and sec > file_window[1])):
                                agg["skippedOutOfWindow"] += 1
                                continue          # 다른 세션의 기록 — 이 세션 집계에서 제외
                            stamps.append(sec)
                    ev = str(rec.get("event") or "")
                    if not ev:
                        # [전체실행 2026-09-03] 텔레메트리 레코드는 event 대신 event_type 을 쓴다
                        if str(rec.get("event_type") or "") == "agent.run":
                            fr = agg["fullRuns"]
                            fr["count"] += 1
                            if str(rec.get("status") or "") == "success":
                                fr["ok"] += 1
                            else:
                                fr["error"] += 1
                            try:
                                fr["totalMs"] += int(rec.get("latency_ms") or 0)
                            except Exception:
                                pass
                        continue
                    agg["events"][ev] = agg["events"].get(ev, 0) + 1
                    if ev == "llm.usage":
                        t = agg["tokens"]
                        pt = int(rec.get("promptTokens") or 0)
                        ct = int(rec.get("completionTokens") or 0)
                        tt = int(rec.get("totalTokens") or 0) or (pt + ct)
                        t["prompt"] += pt; t["completion"] += ct; t["total"] += tt; t["calls"] += 1
                        mk = str(rec.get("model") or "?")
                        bm = t["byModel"].setdefault(mk, {"prompt": 0, "completion": 0, "total": 0, "calls": 0})
                        bm["prompt"] += pt; bm["completion"] += ct; bm["total"] += tt; bm["calls"] += 1
                    ms = rec.get("ms")
                    if ms is None:
                        ms = rec.get("totalMs")
                    if isinstance(ms, (int, float)) and ms >= 0:
                        d = agg["durations"].setdefault(ev, {"count": 0, "totalMs": 0.0, "maxMs": 0.0})
                        d["count"] += 1
                        d["totalMs"] = round(d["totalMs"] + float(ms), 1)
                        if ms > d["maxMs"]:
                            d["maxMs"] = round(float(ms), 1)
                    m = _STEP_EVENT_RE.match(ev)
                    if m:
                        outcome = m.group(1)
                        lang = (str(rec.get("language") or "").strip().lower() or "(미기록)")
                        row = agg["byLanguage"].setdefault(lang, {"runs": 0, "ok": 0, "error": 0, "totalMs": 0.0})
                        row["runs"] += 1
                        row[outcome] += 1
                        if isinstance(ms, (int, float)) and ms >= 0:
                            row["totalMs"] = round(row["totalMs"] + float(ms), 1)
                        idx = rec.get("stepIdx")
                        if isinstance(idx, int) and 0 <= idx < 500:
                            srow = agg["byStepIdx"].setdefault(str(idx), {"runs": 0, "error": 0})
                            srow["runs"] += 1
                            if outcome == "error":
                                srow["error"] += 1
                    low = ev.lower()
                    if (any(mk in low for mk in _ERROR_EVENT_MARKERS)
                            and not any(x in low for x in _ERROR_EVENT_EXCLUDE)
                            and len(agg["errors"]) < _EVENTS_ERROR_ROWS_CAP):
                        summary = str(rec.get("error") or rec.get("message") or rec.get("cause") or "")[:200]
                        agg["errors"].append({"file": lf.name, "ts": str(rec.get("ts") or ""),
                                              "event": ev, "summary": summary,
                                              "stepIdx": rec.get("stepIdx"), "stepId": rec.get("stepId")})
        except Exception:
            continue
    # [활성시간 2026-09-08] 간격 합산: 정렬 후 인접 간격이 ACTIVE_GAP 이하일 때만 사용 중으로 센다.
    # 이벤트가 안 찍히는 '읽기만 하는' 시간은 자리비움으로 잡힌다(근사의 한계 — 과대집계보다 낫다).
    if len(stamps) >= 2:
        stamps.sort()
        active = 0.0
        for a, b in zip(stamps, stamps[1:]):
            gap = b - a
            if 0 <= gap <= _ACTIVE_GAP_SECONDS:
                active += gap
        agg["activeMinutes"] = round(active / 60.0, 1)
        # 논리 상한: 활성은 체류(시작~끝)를 넘을 수 없다 — 창 필터가 놓친 잔여 오차를 여기서 자른다.
        # 종료된 세션에만 건다. 열린 세션은 '끝'이 마지막 수신 시각이라 로그보다 뒤처질 수 있어 0 으로 잘린다(실측).
        if window and window[1] is not None and window[2]:
            dwell_min = max(0.0, ((window[1] - 300) - (window[0] + 300)) / 60.0)
            if agg["activeMinutes"] > dwell_min:
                agg["activeMinutes"] = round(dwell_min, 1)
    return agg


def _session_events(date, user, sdir):
    """세션 집계(캐시 우선). 반환 (agg, cache_hit)."""
    root = _require_root()
    cache = root / _EVENTS_CACHE_DIR / date / user / (sdir.name + ".json")
    sig = _logs_signature(sdir / "logs")
    try:
        cached = json.loads(cache.read_text("utf-8"))
        # v2: tokens / v3: fullRuns / v4: activeMinutes / v5: 자리비움 10분 / v6 (2026-09-09): 세션 창 필터+UTC
        if cached.get("sig") == sig and cached.get("v") == 6:
            return cached["agg"], True
    except Exception:
        pass
    agg = _scan_session_events(sdir)
    try:
        cache.parent.mkdir(parents=True, exist_ok=True)
        tmp = cache.with_suffix(".tmp")
        tmp.write_text(json.dumps({"sig": sig, "v": 6, "agg": agg}, ensure_ascii=False), "utf-8")
        tmp.replace(cache)          # 원자적 교체 — 동시 요청이 반쪽 캐시를 읽지 않게
    except Exception:
        pass                        # 캐시 실패는 성능 문제일 뿐 — 결과는 그대로 준다
    return agg, False


@admin_router.get("/admin/events")
def admin_events(date_from: str = Query("", alias="from"), date_to: str = Query("", alias="to"),
                 user: str = Query(""), key: str = Query(""), x_admin_key: str = Header("")):
    """트레이스 이벤트 전량 집계 — 대시보드의 '분석' 축.

    반환: 이벤트별 건수(byEvent), 소요시간 통계(durations), 단계 실행(steps: 언어별/위치별),
    일별 오류 수(errorsByDate), 스캔 현황(scanned). 세션 캐시 덕에 두 번째 호출부터 빠르다."""
    _check_admin_key(key or x_admin_key)
    _require_root()
    for d in (date_from, date_to):
        if d and not _DATE_RE.match(d):
            raise HTTPException(status_code=400, detail="날짜는 YYYY-MM-DD 형식입니다.")
    events = {}
    durations = {}
    by_lang = {}
    by_idx = {}
    err_by_date = {}
    tokens = {"prompt": 0, "completion": 0, "total": 0, "calls": 0}
    full_runs = {"count": 0, "ok": 0, "error": 0, "totalMs": 0}
    fr_by_user = {}
    tok_by_model = {}
    tok_by_user = {}
    tok_by_date = {}   # [토큰 추이 2026-09-03] 일별 사용량 — 세션이 속한 날짜로 합산
    act_total = 0.0    # [활성시간 2026-09-08] 트레이스 간격 근사 합
    act_by_user = {}
    act_by_date = {}
    scanned = {"sessions": 0, "cached": 0, "files": 0, "bytes": 0, "skippedBytes": 0}
    for d, u, sdir in _iter_sessions("", user):
        if (date_from and d < date_from) or (date_to and d > date_to):
            continue
        agg, hit = _session_events(d, u, sdir)
        scanned["sessions"] += 1
        scanned["cached"] += 1 if hit else 0
        scanned["files"] += agg.get("files", 0)
        scanned["bytes"] += agg.get("bytes", 0)
        scanned["skippedBytes"] += agg.get("skippedBytes", 0)
        for ev, n in (agg.get("events") or {}).items():
            events[ev] = events.get(ev, 0) + n
        for ev, row in (agg.get("durations") or {}).items():
            t = durations.setdefault(ev, {"count": 0, "totalMs": 0.0, "maxMs": 0.0})
            t["count"] += row.get("count", 0)
            t["totalMs"] = round(t["totalMs"] + row.get("totalMs", 0.0), 1)
            t["maxMs"] = max(t["maxMs"], row.get("maxMs", 0.0))
        for lang, row in (agg.get("byLanguage") or {}).items():
            t = by_lang.setdefault(lang, {"runs": 0, "ok": 0, "error": 0, "totalMs": 0.0})
            for k2 in ("runs", "ok", "error"):
                t[k2] += row.get(k2, 0)
            t["totalMs"] = round(t["totalMs"] + row.get("totalMs", 0.0), 1)
        for idx, row in (agg.get("byStepIdx") or {}).items():
            t = by_idx.setdefault(idx, {"runs": 0, "error": 0})
            t["runs"] += row.get("runs", 0)
            t["error"] += row.get("error", 0)
        n_err = len(agg.get("errors") or [])
        if n_err:
            err_by_date[d] = err_by_date.get(d, 0) + n_err
        fr = agg.get("fullRuns") or {}
        if fr.get("count"):
            for k2 in ("count", "ok", "error", "totalMs"):
                full_runs[k2] += int(fr.get(k2) or 0)
            f3 = fr_by_user.setdefault(u, {"count": 0, "ok": 0, "error": 0})
            for k2 in ("count", "ok", "error"):
                f3[k2] += int(fr.get(k2) or 0)
        am = agg.get("activeMinutes")
        if isinstance(am, (int, float)) and am > 0:
            act_total += am
            act_by_user[u] = round(act_by_user.get(u, 0.0) + am, 1)
            act_by_date[d] = round(act_by_date.get(d, 0.0) + am, 1)
        tk = agg.get("tokens") or {}
        if tk.get("calls"):
            for k2 in ("prompt", "completion", "total", "calls"):
                tokens[k2] += int(tk.get(k2) or 0)
            for mk, bm in (tk.get("byModel") or {}).items():
                t2 = tok_by_model.setdefault(mk, {"prompt": 0, "completion": 0, "total": 0, "calls": 0})
                for k2 in ("prompt", "completion", "total", "calls"):
                    t2[k2] += int(bm.get(k2) or 0)
            t3 = tok_by_user.setdefault(u, {"prompt": 0, "completion": 0, "total": 0, "calls": 0})
            for k2 in ("prompt", "completion", "total", "calls"):
                t3[k2] += int(tk.get(k2) or 0)
            t4 = tok_by_date.setdefault(d, {"prompt": 0, "completion": 0, "total": 0, "calls": 0})
            for k2 in ("prompt", "completion", "total", "calls"):
                t4[k2] += int(tk.get(k2) or 0)
    by_event = sorted(({"event": k, "count": v} for k, v in events.items()),
                      key=lambda r: -r["count"])[:100]
    dur_rows = sorted(({"event": k, "count": v["count"],
                        "avgMs": round(v["totalMs"] / v["count"], 1) if v["count"] else 0.0,
                        "maxMs": v["maxMs"], "totalMs": v["totalMs"]}
                       for k, v in durations.items()), key=lambda r: -r["totalMs"])[:50]
    lang_rows = sorted(({"language": k, "runs": v["runs"], "ok": v["ok"], "error": v["error"],
                         "avgMs": round(v["totalMs"] / v["runs"], 1) if v["runs"] else 0.0}
                        for k, v in by_lang.items()), key=lambda r: -r["runs"])
    idx_rows = sorted(({"stepIdx": int(k), "runs": v["runs"], "error": v["error"]}
                       for k, v in by_idx.items()), key=lambda r: r["stepIdx"])[:100]
    tok_model_rows = sorted(({"model": k, **v} for k, v in tok_by_model.items()),
                            key=lambda r: -r["total"])[:20]
    tok_user_rows = sorted(({"user": k, **v} for k, v in tok_by_user.items()),
                           key=lambda r: -r["total"])[:100]
    return {"ok": True, "scanned": scanned, "byEvent": by_event, "durations": dur_rows,
            "active": {"minutes": round(act_total, 1),
                       "byUser": sorted(({"user": k, "minutes": v} for k, v in act_by_user.items()),
                                        key=lambda r: -r["minutes"])[:100],
                       "byDate": sorted(({"date": k, "minutes": v} for k, v in act_by_date.items()),
                                        key=lambda r: r["date"])},
            "tokens": {**tokens, "byModel": tok_model_rows, "byUser": tok_user_rows,
                       "byDate": sorted(({"date": k, **v} for k, v in tok_by_date.items()),
                                        key=lambda r: r["date"])},
            "fullRuns": {**full_runs,
                         "avgMs": round(full_runs["totalMs"] / full_runs["count"], 1) if full_runs["count"] else 0,
                         "byUser": sorted(({"user": k, **v} for k, v in fr_by_user.items()),
                                          key=lambda r: -r["count"])[:100]},
            "steps": {"byLanguage": lang_rows, "byStepIdx": idx_rows},
            "errorsByDate": sorted(({"date": k, "count": v} for k, v in err_by_date.items()),
                                   key=lambda r: r["date"])}


@admin_router.get("/admin/errors")
def admin_errors(date_from: str = Query("", alias="from"), date_to: str = Query("", alias="to"),
                 user: str = Query(""), limit: int = Query(200, ge=1, le=1000),
                 key: str = Query(""), x_admin_key: str = Header("")):
    """수집된 트레이스에서 오류 이벤트만 추린다(세션·시각·이벤트·요약) — **전량 스캔**.

    세션당 1회 전량 파싱 + .agg_cache 캐시(_session_events)를 쓰므로 폴더가 커져도
    두 번째 호출부터는 캐시만 읽는다. 강제 종료로 깨진 줄은 json 실패 무시로 건너뛴다."""
    _check_admin_key(key or x_admin_key)
    _require_root()
    for d in (date_from, date_to):
        if d and not _DATE_RE.match(d):
            raise HTTPException(status_code=400, detail="날짜는 YYYY-MM-DD 형식입니다.")
    # [2026-08-31] 예전엔 파일 끝 256KB 만 스캔했다 — 큰 세션의 앞부분 오류가 통째로 빠져
    # 이 숫자로 '오류율' 을 그리면 구조적으로 과소집계됐다. 이제 세션 캐시(전량 스캔)를 쓴다.
    # limit 은 정렬 **후** 자른다 — 예전엔 먼저 찾은 것부터 잘라서 최신 오류가 빠질 수 있었다.
    out = []
    for d, u, sdir in _iter_sessions("", user):
        if (date_from and d < date_from) or (date_to and d > date_to):
            continue
        agg, _hit = _session_events(d, u, sdir)
        for row in (agg.get("errors") or []):
            out.append({"date": d, "user": u, "sessionId": sdir.name, **row})
    out.sort(key=lambda r: r.get("ts") or "", reverse=True)
    out = out[:limit]
    return {"ok": True, "count": len(out), "errors": out, "fullScan": True}
