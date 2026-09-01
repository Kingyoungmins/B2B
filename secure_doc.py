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
import re
import threading
import time
import zipfile
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

    def __init__(self, message, result="", result_msg="", kind=""):
        self.result = str(result or "")
        self.result_msg = str(result_msg or "")
        # [빠른 포기 2026-09-01] "network" = 상대가 응답 자체를 못/안 준 실패(연결 불가·무응답·
        # 릴레이 504=게이트웨이 무응답). 게이트웨이가 명시적으로 거절한 실패(-100/-200/-999)와
        # 갈라, 무응답 계열은 재시도 없이 빨리 포기하고 다음 대체 경로로 넘어가는 데 쓴다.
        self.kind = str(kind or "")
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
        # [실측 2026-08-27] 한때 기본값을 '어떤 문서든 게이트웨이에 물어보기' 로 뒀다가,
        # **이미 보안 해제된 평문 파일까지 drmSecretAPI/drmDecryptAPI 를 찔렀다**(사용자 확인).
        # 평문에 대고 해제를 부르는 건 확인이 아니라 그냥 시도다 — 게이트웨이도, 사용자도
        # 헷갈린다. 로컬 판정의 구멍(앞 4바이트만 보던 것)은 별도로 막았으므로, 기본은 끈다.
        # 켜야 할 상황(로컬 판정을 못 믿는 환경)에서는 환경변수로 올린다.
        "alwaysAsk": _env("B2B_SECURE_DOC_ALWAYS_ASK", "0").lower() in {"1", "on", "true", "yes"},
        # 비밀등급은 해제 응답의 -200 메시지로도 알 수 있다(규격 3장) — 왕복을 두 번 하지 않는다.
        # 파일을 두 번 올리는 비용이 크고, 얻는 정보는 같다.
        "secretPrecheck": _env("B2B_SECURE_DOC_SECRET_CHECK", "0").lower()
                          in {"1", "on", "true", "yes"},
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


def _note_network_failure(what):
    """네트워크 무응답 실패 직후 30초(프로브 캐시)간 보안 호출을 쉬게 한다.

    [제보 2026-09-01 "실패 시 대기가 길다"] 게이트웨이가 패킷을 버리는 유형의 실패는
    릴레이의 제한시간(기본 60초)을 꽉 채우고서야 504 로 온다. 파일을 여러 개 올리면
    **파일마다** 그 60초를 반복했다(해제 시도는 파일 단위라). 한 번 무응답을 확인했으면
    프로브 캐시를 '죽음'으로 채워, 이후 파일들은 available() 게이트에서 즉시 건너뛰고
    다음 대체 경로(원본 그대로 업로드 진행)로 넘어간다. 30초 뒤 프로브가 다시 살아나면
    자동 복귀한다. 다운로드 보안 재적용은 available() 을 보지 않으므로(항상 실제 호출,
    실패 시 다운로드 중단) 이 캐시로 평문이 새는 경로는 없다.
    """
    with _LOCK:
        _STATE["probe"] = {"at": time.time(), "ok": False, "configured": False,
                           "reason": "직전 호출이 무응답이라 %.0f초간 건너뜀 (%s)"
                                     % (PROBE_CACHE_SECONDS, what)}


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


def _post_drm(op, data, filename, extra_form=None, timeout=None, expect="stream"):
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
        # 504 = 릴레이는 살아 있는데 게이트웨이가 무응답(연결 불가/타임아웃) — 명시 거절과 다르다.
        _kind = "network" if err.code == 504 else ""
        if _kind == "network":
            _note_network_failure("게이트웨이 무응답(릴레이 504)")
        payload = _try_json(raw)
        if payload is not None:
            raise SecureDocError(str(payload.get("result_msg") or payload.get("error") or "HTTP %s" % err.code),
                                 result=str(payload.get("result") or ""),
                                 result_msg=str(payload.get("result_msg") or ""),
                                 kind=_kind) from err
        raise SecureDocError("보안 서버 오류: HTTP %s" % err.code, kind=_kind) from err
    except (TimeoutError, OSError, urllib.error.URLError) as err:
        _note_network_failure("릴레이 연결 실패/무응답")
        raise SecureDocError("보안 서버에 연결하지 못했습니다: %s" % getattr(err, "reason", err),
                             kind="network") from err

    if "json" in content_type:
        payload = _try_json(raw) or {}
        # [실측 2026-08-27] 예전엔 JSON 을 무조건 오류로 봤다. 파일을 돌려주는 encrypt/decrypt
        # 기준으로 짠 코드인데, 규격 2.5 비밀문서 확인은 **성공해도 JSON** 이다. 그대로 두면
        # 선행 확인이 늘 예외로 빠져 조용히 죽는다(동작하는 것처럼 보이면서 아무것도 안 함).
        if expect == "json":
            return payload
        raise SecureDocError(str(payload.get("result_msg") or payload.get("error") or "알 수 없는 응답"),
                             result=str(payload.get("result") or ""),
                             result_msg=str(payload.get("result_msg") or ""))
    if expect == "json":
        payload = _try_json(raw)
        if payload is not None:
            return payload
        raise SecureDocError("JSON 응답을 기대했는데 아니었습니다(%s)" % (content_type or "형식 미상"))
    if not raw:
        raise SecureDocError("보안 서버가 빈 파일을 돌려주었습니다.")
    return raw


def _try_json(raw):
    try:
        value = json.loads(bytes(raw).decode("utf-8", errors="replace"))
        return value if isinstance(value, dict) else None
    except Exception:
        return None


def secret_check(data, filename):
    """비밀문서인가 — drmSecretAPI. 반환 "S_DOC" / "N_DOC" / "" (판단 못 함).

    [연동규격 v0.3 2.5] 응답 result 가 S_DOC(비밀문서) / N_DOC(일반문서) 다.
    비밀등급 문서는 규격상 **복호화 자체가 거부**된다(-200 "비밀문서로 추가적인 작업을 진행할
    수 없습니다"). 미리 물어보면 어차피 실패할 요청을 아끼고, 사용자에게 정확한 이유를 준다.
    이 확인이 실패해도 흐름을 막지 않는다 — 최종 판정은 어차피 해제 호출이 한다.

    [빠른 포기 2026-09-01] 예외 하나: **네트워크 무응답**(kind="network")은 삼키지 않고
    올린다. 선행확인이 무응답이면 곧바로 이어질 해제 호출도 같은 길(릴레이→게이트웨이)이라
    똑같이 제한시간을 꽉 채우고 실패한다 — 예전엔 그래서 무응답 상황에서 대기가 두 배였다
    (선행확인 60초 삼킴 + 해제 60초). 올리면 maybe_decrypt_upload 의 except 가 즉시 실패로
    돌리고 업로드는 원본 그대로 계속된다(다음 대체 경로). 판정용 작은 왕복이라 제한시간도
    짧게 따로 건다(기본 20초, B2B_SECURE_DOC_PRECHECK_TIMEOUT 로 조절).
    """
    try:
        cfg = config()
        try:
            _pre_to = float(_env("B2B_SECURE_DOC_PRECHECK_TIMEOUT") or 20)
        except Exception:
            _pre_to = 20.0
        out = _post_drm("secret", data, filename, expect="json",
                        timeout=max(3.0, min(cfg["timeout"], _pre_to)),
                        extra_form={"requestorAccount": cfg["account"]})
    except SecureDocError as err:
        if err.kind == "network":
            raise                      # 무응답 — 해제 호출도 똑같이 실패한다, 여기서 빨리 접는다
        return ""                      # 확인을 못 했을 뿐 — 흐름은 막지 않는다
    except Exception:
        return ""                      # 확인을 못 했을 뿐 — 흐름은 막지 않는다
    try:
        if isinstance(out, (bytes, bytearray)):
            out = json.loads(bytes(out).decode("utf-8", errors="replace"))
        if isinstance(out, dict):
            return str(out.get("result") or "")
    except Exception:
        pass
    return ""


def decrypt_bytes(data, filename):
    """보안 해제. 반환 (released, out_bytes).
    Gateway 가 '복호화 대상이 아니다'(-200)라고 하면 원본 그대로 (False, data)."""
    cfg = config()
    try:
        out = _post_drm("decrypt", data, filename,
                        extra_form={"requestorAccount": cfg["account"]})
        return True, out
    except SecureDocError as err:
        # [-200 분기] 규격상 '대상 아님'도 '비밀문서'도 '등록 안 된 사용자'도 같은 -200 이라
        # 메시지로 가른다. TODO: 세부 코드가 생기면 문자열 매칭을 걷어낸다.
        if err.result == "-200" and ("대상" in err.result_msg):
            return False, bytes(data)
        if err.result == "-200" and ("비밀문서" in err.result_msg):
            # [규격 3장] 비밀등급은 해제가 거부된다. 이 한 줄이면 알 수 있으므로 선행 확인을
            # 위해 파일을 한 번 더 올리지 않는다(왕복 1회로 같은 정보).
            err.secret = True
        raise


def encrypt_bytes(data, filename, label_id=""):
    """보안 재적용. 실패는 예외 — 부르는 쪽(다운로드)이 반드시 중단해야 한다.

    label_id 를 주면 그 라벨로 복원한다(원본과 같은 보호). 비우면 게이트웨이 기본 라벨.
    """
    cfg = config()
    form = {"requestorAccount": cfg["account"]}
    if label_id:
        form["labelid"] = label_id
    return _post_drm("encrypt", data, filename, extra_form=form)


# ── 업로드 훅 ─────────────────────────────────────────────────────────────

VENDOR_DRM_MAGIC = b"SCDSA"          # 사내 DRM 컨테이너 서명(실측: "SCDSA004")


def _is_readable_office_zip(path):
    """정말 열리는 Office 문서(zip)인가 — 헤더만 PK 인 것과 가른다.

    못 열리면 False 를 준다(→ 부르는 쪽이 '보안문서일 수 있다'로 보고 서버에 물어본다).
    경로를 모르면 판단하지 않고 True(=평문으로 인정) — 예전 동작 유지. 경로 없는 호출은
    헤더만 넘겨 받는 자리라, 여기서 막으면 평범한 파일까지 서버로 보내게 된다.
    """
    if not path:
        return True
    try:
        with zipfile.ZipFile(str(path)) as z:
            names = z.namelist()
    except Exception:
        return False                       # PK 인 척했지만 열리지 않는다 — 의심스럽다
    if not names:
        return False
    low = [n.lower() for n in names]
    # OOXML 이면 [Content_Types].xml 이 있다. 없더라도 일반 zip 일 수 있으니 그것까지는 인정.
    return True


def looks_secured(head, name="", encrypted_checker=None, path=None):
    """작업본이 보안문서로 '보이는가' — 최종 판정은 Gateway(-200)가 한다.
      · PK(zip)      → 평문 xlsx(라벨만 붙은 것 포함) → 아니다
      · OLE 복합문서 → checker 가 스트림 내용으로 3상 판정: 암호화(encrypted)면 그렇다,
                       구형 Office 본문 스트림 확인(plain)이면 아니다, 정체불명(unknown —
                       사내 DRM 래퍼의 자체 스트림)이면 그렇다고 보고 서버에 물어본다
      · 그 외        → 텍스트(csv 등)면 아니다, 알 수 없는 바이너리(pfile 등)면 그렇다고 보고 시도
    확장자 규칙은 쓰지 않는다(연동규격에 없음 — 내용으로만 본다)."""
    head = bytes(head or b"")
    if head[:5] == VENDOR_DRM_MAGIC:
        # [실측 2026-08-27] 사내 DRM 컨테이너("SCDSA004"). 전부 인쇄 가능한 ASCII 라 아래
        # '제어문자가 있으면 바이너리' 규칙에 안 걸려 **텍스트로 오인돼 그냥 통과**했다.
        # 이게 보안 문서가 평문으로 샌 원래 원인이다 — 서명으로 못 박는다.
        return True
    if head[:4] == b"PK\x03\x04":
        # [실측 2026-08-27] 예전엔 앞 4바이트가 PK 면 **무조건** 평문으로 통과시켰다.
        # 그런데 사고 로그의 그 파일은 PK 로 시작하면서 zip 으로는 안 열렸다(판정이 "" 로 빠짐).
        # 헤더만 흉내낸 컨테이너나 쓰다 만 파일이 그대로 평문 취급돼 보안 루트를 건너뛴다 —
        # 4바이트는 위조하기 가장 쉬운 값이다. **정말 열리는 Office zip 일 때만** 평문으로 본다.
        return not _is_readable_office_zip(path)
    if head[:4] == b"\xd0\xcf\x11\xe0":
        # [제보 2026-08-24 사내 DRM 미인식] 예전 bool checker(EncryptedPackage 유무)는 '표준'
        # OOXML 암호화(AIP)만 잡았다 — 사내 DRM 이 OLE 래퍼에 자체 스트림을 쓰면 '구형 .xls
        # 평문' 취급으로 로그 한 줄 없이 통과했고, 마커/재암호화 게이트가 안 걸려 산출물이
        # 평문으로 나갔다(실측: AIP 는 인식, 사내 DRM 미인식). 확장자 보정은 안 된다 — DRM 이
        # 원본 이름(.xls)을 보존하면 도로 뚫린다(코드리뷰 지적). 그래서 checker 를 3상으로:
        # 구형 Office 본문 스트림(Workbook 등)이 '실제로 있는' 파일만 평문으로 인정하고,
        # 정체불명 스트림 구성(=래퍼 의심)·판독 실패는 서버에 물어본다(-200이 최종 판정,
        # 오판 비용 = 왕복 1회). bool checker(True/False)도 같은 규칙으로 해석된다.
        verdict = None
        if encrypted_checker is not None and path is not None:
            try:
                verdict = encrypted_checker(path)
            except Exception:
                verdict = None               # 못 읽었다 — 서버에 물어본다
        if verdict in (True, "encrypted"):
            return True
        if verdict in (False, "plain"):
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
    _local_says_plain = not looks_secured(head, name, encrypted_checker, p)
    if _local_says_plain and cfg.get("alwaysAsk") and not available():
        # [사용자 지적 2026-08-27] 평문이 완전히 무소식이면 여러 개를 올렸을 때
        # "하나는 어떻게 된 거지" 가 된다. 확인을 못 했으면 못 했다고 말해 준다.
        return {"checked": False, "plain": True, "unverified": True}
    if _local_says_plain and not (cfg.get("alwaysAsk") and available()):
        # 확실히 평문이거나, 지금은 게이트웨이에 물어볼 수 없다(방화벽/설정) — 예전 판단을 따른다.
        # 여기서 막아 버리면 게이트웨이가 닫혀 있는 동안 업무가 통째로 멈춘다.
        return None
    if not available():
        reason = (_STATE.get("probe") or {}).get("reason") or "서버에 문서보안 키가 설정되지 않았습니다"
        return {"checked": True, "released": False,
                "error": "보안 해제 서버를 쓸 수 없습니다: %s" % reason}
    started = time.perf_counter()
    try:
        data = p.read_bytes()
        # [규격 2.5 / 사용자 제안 2026-08-27] 비밀등급 문서는 해제가 거부된다 — 미리 가른다.
        # (S_DOC 는 '암호화된 문서'가 아니라 '비밀등급 문서' 다 — 해제 대상이 아니라 **거절 대상**)
        # 여기서 걸리면 '왜 안 되는지'를 사용자에게 정확히 말해 줄 수 있다(예전엔 -200 만 떴다).
        if cfg.get("secretPrecheck", True):
            _kind = secret_check(data, name)
            if _kind == "S_DOC":
                return {"checked": True, "released": False, "secret": True,
                        "error": "비밀등급 문서라 보안 해제를 할 수 없습니다"
                                 " (규격상 비밀문서는 처리 미지원)"}
        released, out = decrypt_bytes(data, name)
        if not released:                 # Gateway 가 '보안문서 아님' — 원본 그대로 진행
            # 로컬은 평문이라 했고 게이트웨이도 같은 답 → 판정이 맞았다는 확인이기도 하다.
            # 게이트웨이가 '보안 문서 아님' 이라고 **확인해 준** 상태 — 조용히 넘기지 않는다.
            return {"checked": True, "released": False, "notDrm": True, "plain": True,
                    "askedAnyway": bool(_local_says_plain)}
        # [코드리뷰 2026-08-24] 마커를 '먼저' 쓴다. 예전엔 평문을 먼저 쓰고 마커를 나중에 썼는데,
        # 마커 쓰기가 실패하면(디스크 풀/ACL/AV 잠금 — 새 파일 생성은 제자리 덮어쓰기보다 잘 막힌다)
        # 평문 작업본만 남고 재적용 게이트(any_secured)가 영영 안 걸린다 — 이후 모든 다운로드가
        # 평문으로 나간다. 이 모듈의 존재 이유("평문으로 새면 안 된다")가 그 한 순서에 무너진다.
        # 마커가 실패하면 원본을 그대로 두고 released:False 로 물러난다(안전한 쪽 실패).
        Path(str(p) + MARKER_SUFFIX).write_text("secured-source", encoding="utf-8")
        _label = source_label_for_restore(data)   # 평문으로 바꾸기 **전에** 읽어야 한다
        p.write_bytes(out)
        with _LOCK:
            _STATE["releasedCount"] += 1
        return {"checked": True, "released": True, "labelId": _label,
                "elapsedMs": round((time.perf_counter() - started) * 1000),
                "originalBytes": len(data), "releasedBytes": len(out)}
    except SecureDocError as err:
        with _LOCK:
            _STATE["lastError"] = str(err)
        if getattr(err, "secret", False):
            return {"checked": True, "released": False, "secret": True,
                    "error": "비밀등급 문서라 보안 해제를 할 수 없습니다"
                             " (규격상 비밀문서는 처리 미지원)"}
        return {"checked": True, "released": False, "error": str(err)}
    except Exception as err:
        with _LOCK:
            _STATE["lastError"] = "%s: %s" % (type(err).__name__, err)
        return {"checked": True, "released": False, "error": str(err)}


_LABEL_RE = re.compile(rb'<AUTHENTICATEDDATA\s+name="ID"\s+id="LABEL">([0-9a-fA-F-]{32,40})</AUTHENTICATEDDATA>')


def read_label_id(path_or_bytes):
    """보호 문서 안에 적힌 **원본 라벨 GUID** 를 읽는다. 못 찾으면 "".

    [실측 2026-08-27] 되돌릴 때 기본 라벨로 재암호화하면 원본과 다른 보호가 걸린다.
    다행히 라벨 GUID 는 문서 안 XrML 에 그대로 적혀 있다
    (<AUTHENTICATEDDATA name="ID" id="LABEL">…</>). 이 값을 기억해 두었다가 재암호화 때
    labelid 로 돌려주면 **원본과 같은 라벨** 로 복원된다.

    참고: 이 값으로 'DRM 이냐 AIP 냐' 를 가릴 수는 없다 — 실측한 두 표본(사내 DRM/AIP)이
    같은 라벨 GUID 를 갖고 있었다. 그래서 labelid=DRM 강제 같은 건 하지 않는다(근거 없음).
    """
    try:
        raw = (path_or_bytes if isinstance(path_or_bytes, (bytes, bytearray))
               else Path(path_or_bytes).read_bytes())
    except Exception:
        return ""
    raw = bytes(raw)
    m = _LABEL_RE.search(raw)
    if not m:
        try:                                  # UTF-16LE 로 박힌 경우
            wide = raw.decode("utf-16-le", errors="ignore").encode("ascii", "ignore")
            m = _LABEL_RE.search(wide)
        except Exception:
            m = None
    return m.group(1).decode("ascii", "ignore").lower() if m else ""


def source_label_for_restore(data):
    """이 원본을 되돌릴 때 쓸 라벨 값. 못 정하면 "" (게이트웨이 기본값).

    [실측 2026-08-27] 사내 DRM 컨테이너(SCDSA…)는 MS RMS 가 아니라 자체 포맷이라
    XrML 라벨 GUID 가 없다. 그대로 두면 되돌릴 때 게이트웨이 기본 라벨(AIP)이 붙어
    **사내 DRM 이던 문서가 AIP 로 바뀐다** — 보호 방식이 조용히 달라지는 셈이다.
    규격 2.3 의 labelid=DRM(강제 DRM 암호화)이 정확히 이 경우를 위한 값이다.
    서명으로 원본이 사내 DRM 이었음을 확실히 아는 경우에만 쓴다(추측하지 않는다).
    """
    raw = bytes(data or b"")
    if raw[:5] == VENDOR_DRM_MAGIC:
        return "DRM"                       # 규격 2.3: labelid=DRM → 강제 DRM 암호화
    return read_label_id(raw)              # AIP/RMS 는 문서 안의 라벨 GUID 그대로


def remember_label(workbook_id, label_id):
    if label_id:
        with _LOCK:
            _STATE.setdefault("labelIds", {})[str(workbook_id or "")] = str(label_id)


def recall_label(workbook_id):
    with _LOCK:
        return (_STATE.get("labelIds") or {}).get(str(workbook_id or ""), "")


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


def encrypt_for_download(data, filename, workbook_id=""):
    """다운로드 직전 보안 재적용. 실패는 SecureDocError — 부르는 쪽이 다운로드를 중단한다.

    업로드 때 기억해 둔 원본 라벨이 있으면 **그 라벨로** 복원한다(기본 라벨로 덮어쓰지 않는다).
    """
    out = encrypt_bytes(data, filename, label_id=recall_label(workbook_id))
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
