# -*- coding: utf-8 -*-
"""보안문서(AIP/DRM) 자동 해제·재적용 — AX-Cell 백엔드 ↔ 수집/버전 서버(versionTest)의 DRM 릴레이.

왜 있나
  사용자 PC 는 MIP Gateway(문서보안 서버)를 직접 부를 수 없다(허용 IP 제한). 대신 항상 떠 있는
  versionTest 서버가 /v1/drm/* 로 릴레이해 준다. 이 모듈은 그 릴레이를 부르는 클라이언트다.

      업로드: 보안문서 감지 → 서버로 보내 해제 → 풀린 작업본으로 진행 ("문서를 보안해제 중입니다")
      다운로드: 보안문서가 하나라도 있었으면 → 내보내기 직전 서버로 보내 재적용 ("문서를 보안적용 중입니다")

원칙
  · 사용자의 '원본 파일'은 절대 건드리지 않는다 — 바꾸는 건 BACKEND_DIR 의 작업 복사본뿐.
  · 해제 실패는 업로드를 막지 않는다(Excel COM 이 라이선스로 열 수도 있다) — 경고만 싣는다.
  · 재적용 실패는 다운로드를 막는다 — 보안문서에서 나온 내용이 평문으로 새면 안 되기 때문.
  · 서버 주소/키는 로그 전송(log_sync)과 같은 것을 쓴다 — 사용자가 따로 설정할 게 없다.

끄기/바꾸기 (환경변수가 가장 우선)
  B2B_SECURE_DOC=0            기능 끄기
  B2B_SECURE_DOC_URL=...      릴레이 서버 주소(기본: log_sync 와 동일)
  B2B_SECURE_DOC_KEY=...      게이트웨이 Api-Key(기본: log_sync 와 동일)
  B2B_SECURE_DOC_ACCOUNT=...  MIP requestorAccount(기본: whoami 의 사용자 이름 — 아래 default_account)
  B2B_SECURE_DOC_TIMEOUT=120  릴레이 호출 제한시간(초)
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

DEFAULT_TIMEOUT_SECONDS = 120           # 파일 왕복 + Gateway 작업 시간(버전 확인보다 길게)
PROBE_CACHE_SECONDS = 30.0              # /v1/drm/health 결과 캐시(다운로드마다 찔러보지 않게)
MARKER_SUFFIX = ".secured"              # 해제한 작업본 옆에 남기는 표시 — 프로세스 재시작에도 살아남는다

_LOCK = threading.RLock()
_STATE = {
    "releasedIds": set(),      # 이번 실행에서 보안 해제한 workbookId
    "releasedCount": 0,
    "appliedCount": 0,         # 다운로드에 보안 재적용한 횟수
    "lastError": "",
    "probe": None,             # {"at": ts, "ok": bool, "configured": bool}
}


class SecureDocError(Exception):
    """릴레이/Gateway 실패 — result/result_msg 를 보존해 부르는 쪽이 안내문을 만들 수 있게."""

    def __init__(self, message, result="", result_msg=""):
        self.result = str(result or "")
        self.result_msg = str(result_msg or "")
        super().__init__(message)


# ── 설정 ──────────────────────────────────────────────────────────────────

def _env(name, default=""):
    return str(os.environ.get(name) or "").strip() or default


_ACCOUNT_CACHE = {"value": None}


def default_account():
    """MIP requestorAccount 기본값 — whoami 로 찍힌 이름의 '사용자' 부분.

    [사용자 지시 2026-08-24] 계정을 따로 설정하지 않으면 whoami 결과를 기본으로 보낸다.
    whoami 는 '도메인\\사용자' 꼴인데 앞부분은 도메인 미가입 PC 에선 그냥 PC 이름이라
    (예: desktop-ps07979\\admin) 계정 식별에 쓸 수 없다 → 뒷부분(사용자)만 쓴다.
    사내 도메인 PC 면 그 부분이 사번/계정 id 다. 전체나 다른 값이 필요하면
    B2B_SECURE_DOC_ACCOUNT 로 덮어쓴다. whoami 실패(unknown)면 빈 값을 보내
    서버 기본 계정(MIP_REQUESTOR_ACCOUNT)으로 넘어가게 한다.
    (whoami 는 프로세스 호출이라 한 번만 구해 캐시한다 — 요청마다 부르지 않는다)"""
    if _ACCOUNT_CACHE["value"] is not None:
        return _ACCOUNT_CACHE["value"]
    name = ""
    try:
        import log_sync
        name = str(log_sync.current_user() or "").strip()
    except Exception:
        name = str(os.environ.get("USERNAME") or os.environ.get("USER") or "").strip()
    if name and name.lower() != "unknown":
        name = name.replace("/", "\\").rsplit("\\", 1)[-1].strip()
    else:
        name = ""
    _ACCOUNT_CACHE["value"] = name
    return name


def config():
    """주소/키는 log_sync(로그 전송)와 같은 곳을 본다 — F9 에서 주소를 바꾸면 여기도 따라온다."""
    try:
        import log_sync
        base = log_sync.config()
        url, key = base["upstreamUrl"], base["apiKey"]
    except Exception:
        url, key = "", ""
    disabled = _env("B2B_SECURE_DOC", "1").lower() in {"0", "off", "false", "no"}
    url = _env("B2B_SECURE_DOC_URL") or url
    key = _env("B2B_SECURE_DOC_KEY") or key
    try:
        timeout = float(_env("B2B_SECURE_DOC_TIMEOUT") or DEFAULT_TIMEOUT_SECONDS)
    except Exception:
        timeout = DEFAULT_TIMEOUT_SECONDS
    return {
        "enabled": (not disabled) and bool(url),
        "upstreamUrl": url.rstrip("/"),
        "apiKey": key,
        "account": _env("B2B_SECURE_DOC_ACCOUNT") or default_account(),
        "timeout": max(10.0, min(600.0, timeout)),
    }


def probe(force=False):
    """릴레이 서버의 DRM 설정 상태(/v1/drm/health). 실패/미설정이면 기능이 조용히 꺼진 것처럼 동작."""
    cfg = config()
    if not cfg["enabled"]:
        return {"ok": False, "configured": False, "reason": "disabled"}
    with _LOCK:
        cached = _STATE.get("probe")
        if not force and cached and (time.time() - cached["at"]) < PROBE_CACHE_SECONDS:
            return cached
    out = {"at": time.time(), "ok": False, "configured": False, "reason": ""}
    try:
        req = urllib.request.Request(cfg["upstreamUrl"] + "/v1/drm/health",
                                     headers=_headers(cfg), method="GET")
        # [코드리뷰 2026-08-24] 이 프로브는 모든 업로드/다운로드 '앞'에서 동기로 돈다(30초 캐시).
        # 방화벽이 패킷을 버리는 환경에선 timeout 을 꽉 채우고서야 실패한다 — 10초면 동작마다
        # 10초 멈춤으로 보인다. 헬스체크에 3초면 충분하고, 실패는 어차피 30초 캐시된다.
        with urllib.request.urlopen(req, timeout=3) as resp:
            body = json.loads(resp.read().decode("utf-8", errors="replace"))
        out["ok"] = bool(body.get("ok"))
        out["configured"] = bool(body.get("configured"))
    except Exception as err:
        out["reason"] = "%s: %s" % (type(err).__name__, err)
    with _LOCK:
        _STATE["probe"] = out
    return out


def available():
    """지금 보안 해제/적용을 시도할 수 있는 상태인가(기능 켜짐 + 서버에 키 설정됨)."""
    cfg = config()
    if not cfg["enabled"]:
        return False
    p = probe()
    return bool(p.get("ok") and p.get("configured"))


def _headers(cfg):
    headers = {"accept": "application/json, application/octet-stream"}
    if cfg["apiKey"]:
        headers["Api-Key"] = cfg["apiKey"]
    return headers


# ── 릴레이 호출 (multipart) ───────────────────────────────────────────────

def _clean_name(name):
    text = str(name or "").replace("\r", "").replace("\n", "").replace('"', "'")
    text = text.replace("\\", "/").split("/")[-1].strip()
    return text or "upload.bin"


def _post_drm(op, data, filename, extra_form=None, timeout=None):
    """POST {서버}/v1/drm/<op> (multipart). 성공=바이트, Gateway JSON 오류=SecureDocError."""
    cfg = config()
    if not cfg["enabled"]:
        raise SecureDocError("보안문서 기능이 꺼져 있습니다(B2B_SECURE_DOC=0).")
    boundary = "----axcellsec%s" % uuid.uuid4().hex
    name = _clean_name(filename)
    parts = []
    for key, value in (extra_form or {}).items():
        if str(value or "").strip():
            parts.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n"
                          % (boundary, key, value)).encode("utf-8"))
    parts.append(("--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"%s\"\r\n"
                  "Content-Type: application/octet-stream\r\n\r\n" % (boundary, name)).encode("utf-8"))
    body = b"".join(parts) + bytes(data) + ("\r\n--%s--\r\n" % boundary).encode("utf-8")

    req = urllib.request.Request(
        cfg["upstreamUrl"] + "/v1/drm/" + op, data=body, method="POST",
        headers={**_headers(cfg), "content-type": "multipart/form-data; boundary=%s" % boundary})
    try:
        with urllib.request.urlopen(req, timeout=timeout or cfg["timeout"]) as resp:
            raw = resp.read()
            content_type = str(resp.headers.get("content-type") or "").lower()
    except urllib.error.HTTPError as err:
        raw = b""
        try:
            raw = err.read()
        except Exception:
            pass
        payload = _try_json(raw)
        if payload is not None:
            raise SecureDocError(str(payload.get("result_msg") or payload.get("error") or "HTTP %s" % err.code),
                                 result=str(payload.get("result") or ""),
                                 result_msg=str(payload.get("result_msg") or "")) from err
        raise SecureDocError("보안 서버 오류: HTTP %s" % err.code) from err
    except (TimeoutError, OSError, urllib.error.URLError) as err:
        raise SecureDocError("보안 서버에 연결하지 못했습니다: %s" % getattr(err, "reason", err)) from err

    if "json" in content_type:
        payload = _try_json(raw) or {}
        raise SecureDocError(str(payload.get("result_msg") or payload.get("error") or "알 수 없는 응답"),
                             result=str(payload.get("result") or ""),
                             result_msg=str(payload.get("result_msg") or ""))
    if not raw:
        raise SecureDocError("보안 서버가 빈 파일을 돌려주었습니다.")
    return raw


def _try_json(raw):
    try:
        value = json.loads(bytes(raw).decode("utf-8", errors="replace"))
        return value if isinstance(value, dict) else None
    except Exception:
        return None


def decrypt_bytes(data, filename):
    """보안 해제. 반환 (released, out_bytes).
    Gateway 가 '복호화 대상이 아니다'(-200)라고 하면 원본 그대로 (False, data)."""
    cfg = config()
    try:
        out = _post_drm("decrypt", data, filename,
                        extra_form={"requestorAccount": cfg["account"]})
        return True, out
    except SecureDocError as err:
        # [-200 분기] 규격상 '대상 아님'도 '등록 안 된 사용자'도 같은 -200 이라 메시지로 가른다.
        # TODO: 규격 확인 필요 — 세부 코드가 생기면 문자열 매칭을 걷어낸다.
        if err.result == "-200" and ("대상" in err.result_msg):
            return False, bytes(data)
        raise


def encrypt_bytes(data, filename):
    """보안 재적용. 실패는 예외 — 부르는 쪽(다운로드)이 반드시 중단해야 한다."""
    cfg = config()
    return _post_drm("encrypt", data, filename,
                     extra_form={"requestorAccount": cfg["account"]})


# ── 업로드 훅 ─────────────────────────────────────────────────────────────

def looks_secured(head, name="", encrypted_checker=None, path=None):
    """작업본이 보안문서로 '보이는가' — 최종 판정은 Gateway(-200)가 한다.
      · PK(zip)      → 평문 xlsx(라벨만 붙은 것 포함) → 아니다
      · OLE 복합문서 → EncryptedPackage 가 있으면 그렇다(구형 .xls 는 아니다)
      · 그 외        → 텍스트(csv 등)면 아니다, 알 수 없는 바이너리(pfile 등)면 그렇다고 보고 시도
    확장자 규칙은 쓰지 않는다(연동규격에 없음 — 내용으로만 본다)."""
    head = bytes(head or b"")
    if head[:4] == b"PK\x03\x04":
        return False
    if head[:4] == b"\xd0\xcf\x11\xe0":
        if encrypted_checker is not None and path is not None:
            try:
                return bool(encrypted_checker(path))
            except Exception:
                return False
        return True
    if not head:
        return False
    # 제어문자(탭/개행 이전 코드)가 있으면 텍스트가 아니다 — pfile 등 바이너리 컨테이너로 보고
    # 서버에 물어본다(최종 판정은 Gateway 의 -200). cp949 디코드는 판정에 못 쓴다 —
    # 거의 모든 바이트쌍이 유효해서 바이너리도 '한글 텍스트'로 통과해 버린다(테스트로 실측).
    # [코드리뷰 2026-08-24] UTF-16 BOM(FF FE / FE FF)은 텍스트다 — Excel 이 유니코드 CSV/TSV 를
    # 이 형식으로 내보내는데, 둘째 바이트부터 NUL 이 나와 아래 규칙이 '보안문서'로 오판했다.
    # 외부망 PC 에선 그 오판이 업로드마다 "보안 해제 실패" 오류 토스트가 된다.
    if head[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return False
    if any(b < 9 for b in head):
        return True
    # [코드리뷰 2026-08-24 덤] 8바이트 조각은 멀티바이트 글자 '중간'에서 잘릴 수 있다 —
    # 한글 UTF-8 CSV("이름,금액…")의 첫 8바이트가 정확히 그 모양이라 decode 가 실패해
    # 보안문서로 오판됐다(실측). 잘린 끝 최대 3바이트를 물려 가며 판정한다.
    for _trim in (0, 1, 2, 3):
        try:
            head[: len(head) - _trim].decode("utf-8")
            return False                 # 텍스트로 읽힌다(csv/txt) → 평문
        except Exception:
            pass
    for _trim in (0, 1):
        try:
            head[: len(head) - _trim].decode("cp949")
            return False
        except Exception:
            pass
    return True                          # 정체불명 바이너리 → 보안문서일 수 있다, 서버에 물어본다


def maybe_decrypt_upload(path, name, encrypted_checker=None):
    """업로드 직후 훅. 보안문서면 서버로 풀어 '작업본을 제자리에서' 교체한다.

    반환(dict)은 업로드 응답에 그대로 실린다:
      없음(None)                        검사 대상 아님(평문) 또는 기능 꺼짐
      {"checked":1,"released":1,...}    해제 성공 — 작업본이 평문으로 바뀜
      {"checked":1,"released":0,"error"} 해제 실패 — 작업본은 원본 그대로(업로드는 계속)
    """
    cfg = config()
    if not cfg["enabled"]:
        return None
    p = Path(path)
    try:
        with p.open("rb") as f:
            head = f.read(8)
    except Exception:
        return None
    if not looks_secured(head, name, encrypted_checker, p):
        return None
    if not available():
        reason = (_STATE.get("probe") or {}).get("reason") or "서버에 문서보안 키가 설정되지 않았습니다"
        return {"checked": True, "released": False,
                "error": "보안 해제 서버를 쓸 수 없습니다: %s" % reason}
    started = time.perf_counter()
    try:
        data = p.read_bytes()
        released, out = decrypt_bytes(data, name)
        if not released:                 # Gateway 가 '보안문서 아님' — 원본 그대로 진행
            return {"checked": True, "released": False, "notDrm": True}
        # [코드리뷰 2026-08-24] 마커를 '먼저' 쓴다. 예전엔 평문을 먼저 쓰고 마커를 나중에 썼는데,
        # 마커 쓰기가 실패하면(디스크 풀/ACL/AV 잠금 — 새 파일 생성은 제자리 덮어쓰기보다 잘 막힌다)
        # 평문 작업본만 남고 재적용 게이트(any_secured)가 영영 안 걸린다 — 이후 모든 다운로드가
        # 평문으로 나간다. 이 모듈의 존재 이유("평문으로 새면 안 된다")가 그 한 순서에 무너진다.
        # 마커가 실패하면 원본을 그대로 두고 released:False 로 물러난다(안전한 쪽 실패).
        Path(str(p) + MARKER_SUFFIX).write_text("secured-source", encoding="utf-8")
        p.write_bytes(out)
        with _LOCK:
            _STATE["releasedCount"] += 1
        return {"checked": True, "released": True,
                "elapsedMs": round((time.perf_counter() - started) * 1000),
                "originalBytes": len(data), "releasedBytes": len(out)}
    except SecureDocError as err:
        with _LOCK:
            _STATE["lastError"] = str(err)
        return {"checked": True, "released": False, "error": str(err)}
    except Exception as err:
        with _LOCK:
            _STATE["lastError"] = "%s: %s" % (type(err).__name__, err)
        return {"checked": True, "released": False, "error": str(err)}


def mark_released(workbook_id):
    with _LOCK:
        _STATE["releasedIds"].add(str(workbook_id or ""))


# ── 다운로드 훅 ───────────────────────────────────────────────────────────

def any_secured(backend_dir=None):
    """이번 실행에 보안 해제한 문서가 하나라도 있나 — 있으면 문서 다운로드에 보안을 다시 건다.
    메모리(set) + 작업 폴더의 마커 파일을 함께 본다(백엔드 재시작 후 복구 경로 대비)."""
    with _LOCK:
        if _STATE["releasedIds"] or _STATE["releasedCount"]:
            return True
    try:
        if backend_dir and Path(backend_dir).is_dir():
            return any(Path(backend_dir).glob("*" + MARKER_SUFFIX))
    except Exception:
        pass
    return False


def encrypt_for_download(data, filename):
    """다운로드 직전 보안 재적용. 실패는 SecureDocError — 부르는 쪽이 다운로드를 중단한다."""
    out = encrypt_bytes(data, filename)
    with _LOCK:
        _STATE["appliedCount"] += 1
    return out


def status(backend_dir=None):
    cfg = config()
    p = probe() if cfg["enabled"] else {"ok": False, "configured": False}
    with _LOCK:
        return {
            "ok": True,
            "enabled": cfg["enabled"],
            "serverOk": bool(p.get("ok")),
            "configured": bool(p.get("configured")),
            "active": cfg["enabled"] and bool(p.get("ok") and p.get("configured")),
            "anySecured": any_secured(backend_dir),
            "releasedCount": _STATE["releasedCount"],
            "appliedCount": _STATE["appliedCount"],
            "lastError": _STATE["lastError"],
            "upstreamUrl": cfg["upstreamUrl"],
            "account": cfg["account"],
        }
