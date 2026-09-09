# -*- coding: utf-8 -*-
"""AX-Cell 버전 확인 서버 (FastAPI).

용도
  AX-Cell.exe 가 가진 파일 버전(예: 0.7.2.0)과, 이 서버가 알려주는 '최신 버전'을 비교해
  다르면 AX-Cell 쪽에서 "최신버전을 다운로드 해주세요" 안내를 띄우기 위한 서버.
  (안내창은 AX-Cell 쪽에서 나중에 붙임 — 이 서버는 '최신 버전이 뭔지'만 알려준다)

실행
  python main.py --version-file C:\\path\\to\\version.txt --host 0.0.0.0 --port 8100

  · --version-file : 허용 버전이 적힌 텍스트 파일 경로(필수 인자). 한 줄에 하나씩 여러 줄이면
                     전부 허용(예: 0.7.4 / 0.8.0 / 0.8.2). version 필드는 그중 최신을 준다.
  · --download-url : "다운로드 하러가기" 버튼이 열 주소(선택, env AXCELL_DOWNLOAD_URL).
  · 요청이 올 때마다 파일을 다시 읽는다 → version.txt 만 고치면 서버 재시작이 필요 없다.

엔드포인트
  GET  /health              살아있는지
  GET  /version             최신 버전 조회        → {"ok":true,"version":"0.7.2.0", ...}
  GET  /version/check?v=..  클라 버전과 비교까지   → {"ok":true,"match":true/false, ...}

보안 메모
  읽을 파일 경로는 '서버를 켤 때의 인자'로만 정한다. 요청으로 경로를 받지 않는다 —
  받으면 외부에서 서버의 아무 파일이나 읽어갈 수 있다(임의 파일 읽기 취약점).
"""
from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import re
import socket
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 로그 수집기는 '있으면 쓰는' 부가 기능이다. collector.py 를 빼고 main.py 만 복사한 서버에서도
# 버전 확인은 그대로 돌아야 한다 — 여기서 죽으면 버전 확인까지 같이 멈춘다.
try:
    import collector
    COLLECTOR_ERROR = ""
except Exception as err:                      # pragma: no cover - 배포 실수 대비
    collector = None
    COLLECTOR_ERROR = f"{type(err).__name__}: {err}"

DEFAULT_LOG_ROOT = getattr(collector, "DEFAULT_LOG_ROOT", "/data/public/versionTest/logs")

# 문서보안(DRM) 연동도 '있으면 쓰는' 부가 기능 — drm.py 가 없어도 버전 확인/수집은 그대로 돈다.
try:
    import drm
    DRM_IMPORT_ERROR = ""
except Exception as err:                      # pragma: no cover - 배포 실수 대비
    drm = None
    DRM_IMPORT_ERROR = f"{type(err).__name__}: {err}"

# 켤 때 인자로 받은 version.txt 경로가 여기 들어간다(uvicorn 리로드 대비 모듈 전역).
VERSION_FILE: Path | None = None
DOWNLOAD_URL = ""

# 4자리 숫자 버전(윈도우 파일 버전 규격). "0.7.2" 처럼 짧게 적어도 받아준다.
_VERSION_RE = re.compile(r"^\d{1,5}(\.\d{1,5}){0,3}$")

app = FastAPI(
    title="AX-Cell Version Service",
    description="AX-Cell 최신 버전 정보를 알려주는 서비스",
    version="1.0.0",
)

# AX-Cell 화면(WebView)에서 직접 부를 수도 있으므로 열어 둔다.
# 내부망 전용이고 응답이 '최신 버전 문자열' 하나뿐이라 공개해도 잃을 정보가 없다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ── 로그/스킬 수집기 붙이기 ────────────────────────────────────────────────
# 버전 확인과 같은 길(AX-Cell → 로컬 /v1 프록시 → 이 서버)로 들어오므로 /v1 별칭이 필요하다.
# 저장 위치는 켤 때 --log-root 로 정한다(기본 /data/public/versionTest/logs).
if collector is not None:
    app.include_router(collector.router)                # /logs/...
    app.include_router(collector.router, prefix="/v1")  # /v1/logs/...   ← AX-Cell 이 쓰는 길
    app.include_router(collector.admin_router)          # /admin, /admin/session.zip ...
    # [대시보드 2026-08-24] AX-Cell 로컬 프록시는 게이트웨이의 /v1 길로만 나온다(버전/수집과 동일).
    # /v1 별칭이 없으면 대시보드 API 가 게이트웨이를 못 지난다.
    app.include_router(collector.admin_router, prefix="/v1")   # /v1/admin/...

# 문서보안(DRM) — AX-Cell 이 보안문서를 보내면 MIP Gateway 로 풀거나 걸어 돌려준다.
# /v1 별칭이 필요한 이유는 버전/수집과 같다(AX-Cell 은 기존 /v1 길로 나온다).
if drm is not None:
    app.include_router(drm.router, prefix="/api/drm")   # 직접 호출/curl 용 (규격 13장 경로)
    app.include_router(drm.router, prefix="/v1/drm")    # AX-Cell 이 쓰는 길


class VersionOut(BaseModel):
    ok: bool
    version: str | None = None
    normalized: str | None = None      # 항상 4자리로 맞춘 값 (0.7.2 → 0.7.2.0)
    # [허용 목록 2026-09-02] version.txt 에 여러 줄을 적으면 '전부 허용'이다.
    # version/normalized 는 그중 최신(가장 큰 버전) — 예전 클라(단일 비교)와의 호환용.
    allowed: list[str] | None = None   # 허용 버전 전부(4자리 정규화)
    downloadUrl: str | None = None     # "다운로드 하러가기" 버튼이 열 주소(--download-url)
    source: str | None = None          # 읽은 파일 경로
    updatedAt: str | None = None       # 그 파일의 수정 시각(ISO)
    error: str | None = None


class CheckOut(VersionOut):
    client: str | None = None          # 물어본 쪽(AX-Cell)의 버전
    match: bool | None = None          # 같으면 True → 통과, 다르면 False → 업데이트 안내


def normalize_version(text: str) -> str:
    """'0.7.2' / '0.7.2.0' / 'v0.7.2' 를 모두 '0.7.2.0' 형태로 맞춘다.
    비교를 문자열로 하면 '0.7.2' 와 '0.7.2.0' 이 다르다고 나오므로, 양쪽 다 여기를 거친다."""
    s = str(text or "").strip().lstrip("vV").strip()
    if not s:
        return ""
    parts = [p for p in s.split(".") if p != ""]
    if not all(p.isdigit() for p in parts):
        return ""
    parts = (parts + ["0", "0", "0", "0"])[:4]
    return ".".join(str(int(p)) for p in parts)


def read_version_file() -> VersionOut:
    if VERSION_FILE is None:
        return VersionOut(ok=False, error="서버에 version.txt 경로가 지정되지 않았습니다(--version-file).")
    try:
        if not VERSION_FILE.exists():
            return VersionOut(ok=False, source=str(VERSION_FILE),
                              error=f"version.txt 를 찾을 수 없습니다: {VERSION_FILE}")
        # [허용 목록 2026-09-02] 주석/빈 줄을 뺀 '버전처럼 생긴 줄' 전부가 허용 목록이다.
        #   0.7.4
        #   0.8.0
        #   0.8.2
        # 처럼 여러 줄을 적으면 그 버전들은 전부 통과. 한 줄만 적으면 종전과 동일하다.
        # version/normalized 는 목록 중 최신(가장 큰 버전) — 예전 클라(단일 비교)와 호환.
        allowed_raw = []
        bad = ""
        for line in VERSION_FILE.read_text("utf-8-sig", errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if _VERSION_RE.match(line.lstrip("vV")):
                allowed_raw.append(line)
            elif not bad:
                bad = line
        if not allowed_raw:
            if bad:
                return VersionOut(ok=False, version=bad, source=str(VERSION_FILE),
                                  error=f"버전 형식이 아닙니다: {bad!r} (예: 0.7.2.0)")
            return VersionOut(ok=False, source=str(VERSION_FILE), error="version.txt 가 비어 있습니다.")
        allowed = []
        for v in allowed_raw:
            n = normalize_version(v)
            if n and n not in allowed:
                allowed.append(n)
        latest = max(allowed, key=lambda n: tuple(int(x) for x in n.split(".")))
        mtime = datetime.fromtimestamp(VERSION_FILE.stat().st_mtime, timezone.utc).isoformat()
        return VersionOut(ok=True, version=latest, normalized=latest, allowed=allowed,
                          downloadUrl=DOWNLOAD_URL or None,
                          source=str(VERSION_FILE), updatedAt=mtime)
    except Exception as err:
        return VersionOut(ok=False, source=str(VERSION_FILE), error=f"{type(err).__name__}: {err}")


logger = logging.getLogger("axcell.version")


def setup_terminal_logging():
    """[운영 가시성] 버전 확인·로그 수집·문서보안이 '지금 누가 뭘 하는지'를 터미널에 찍는다.

    axcell.* 로거(axcell.version / axcell.logs / axcell.drm)를 부모 하나로 묶어 stdout 에 붙인다.
    안 붙이면 INFO 는 아무 데도 안 나오고 WARNING 만 stderr 로 샌다 — 관리자는 이 터미널이
    유일한 창이므로 INFO 까지 보여야 한다. (keyCode·파일 내용은 어디에도 안 찍힌다)
    uvicorn 접근 로그는 경로만 보여 계정/파일/결과가 없다 — 그래서 따로 찍는다."""
    root = logging.getLogger("axcell")
    if root.handlers:                               # 재호출 대비(중복 방지)
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", datefmt="%H:%M:%S"))
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    root.propagate = False


@app.get("/health")
@app.get("/v1/health")
def health():
    return {"ok": True, "service": "axcell-version", "versionFile": str(VERSION_FILE or "")}


@app.get("/v1/models")
def list_models():
    """[전사 표준] GET /v1/models 는 200 OK 로 응답해야 한다.
    게이트웨이/모니터링이 이 경로로 '서비스가 살아있는지'를 확인하기 때문이다.
    이 서버는 AI 모델을 제공하지 않지만, 표준을 맞추기 위해 OpenAI 호환 형태의
    빈 목록을 200 으로 돌려준다(목록이 비어도 200 이어야 통과한다).
    version.txt 를 못 읽는 상태여도 200 을 유지한다 — 여기서 500 을 내면
    '서비스 자체가 죽은 것'으로 오인돼 상위 점검이 전부 실패로 잡힌다."""
    return {"object": "list", "data": []}


# /v1/... 별칭이 있는 이유:
#   AX-Cell 은 기존 AI 설정의 Base URL(로컬 /v1 프록시)을 그대로 재사용해 버전을 물어본다.
#   그 프록시는 요청 경로를 그대로 붙여 전달하므로(`/v1/version` → `<실제주소>/v1/version`),
#   여기서 같은 경로를 받아줘야 AX-Cell 쪽에 새 통신 경로를 만들지 않아도 된다.
#   (직접 호출용 `/version` 도 그대로 둔다 — 브라우저나 curl 로 확인할 때 편하다)
@app.get("/version", response_model=VersionOut)
@app.get("/v1/version", response_model=VersionOut)
def get_version(request: Request):
    """최신 버전만 알려준다. 비교는 부르는 쪽이 한다."""
    out = read_version_file()
    logger.info("[버전] 조회 from=%s → %s",
                getattr(request.client, "host", "?"), out.normalized or out.error or "?")
    return out


@app.get("/version/check", response_model=CheckOut)
@app.get("/v1/version/check", response_model=CheckOut)
def check_version(v: str = Query("", description="AX-Cell 이 가진 파일 버전 (예: 0.7.2.0)")):
    """클라 버전을 같이 받아 비교까지 해서 돌려준다.
    match=true  → 통과
    match=false → AX-Cell 이 "최신버전을 다운로드 해주세요" 안내를 띄우면 된다."""
    base = read_version_file()
    out = CheckOut(**base.model_dump())
    out.client = normalize_version(v) or (v or None)
    if base.ok and out.client:
        # [허용 목록] 목록 안에 있으면 통과 — 최신 하나만 적어 두면 종전의 '일치' 비교와 같다.
        out.match = (out.client in (base.allowed or [base.normalized]))
    logging.getLogger("axcell.version").info(
        "[버전] 비교 클라=%s 최신=%s → %s", out.client or "?", out.normalized or "?",
        "일치" if out.match else ("업데이트 필요" if out.match is False else "판단불가"))
    return out


def detect_container():
    """컨테이너 안에서 도는지 판별. 아니면 빈 문자열.

    컨테이너면 DNS 와 '나가는 IP' 의 의미가 호스트와 달라진다 — 그 차이를 모르면
    호스트에서 되는 것을 보고 "서버는 되는데 왜?" 로 헤매게 된다(실측 대응).
    """
    try:
        if os.environ.get("KUBERNETES_SERVICE_HOST"):
            return "kubernetes"
        if Path("/.dockerenv").exists():
            return "docker"
        if Path("/run/.containerenv").exists():
            return "podman"
        cg = Path("/proc/1/cgroup")
        if cg.exists():
            text = cg.read_text("utf-8", errors="replace")
            for key in ("kubepods", "docker", "containerd", "lxc"):
                if key in text:
                    return key
    except Exception:
        pass
    return ""


def read_nameservers():
    """/etc/resolv.conf 의 nameserver 목록(도구 없이 DNS 설정을 눈으로 확인하려고)."""
    try:
        out = []
        for line in Path("/etc/resolv.conf").read_text("utf-8", errors="replace").splitlines():
            line = line.strip()
            if line.startswith("nameserver"):
                parts = line.split()
                if len(parts) > 1:
                    out.append(parts[1])
        return out
    except Exception:
        return []


SA_DIR = "/var/run/secrets/kubernetes.io/serviceaccount"


def _k8s_namespace():
    """내 네임스페이스를 알아낸다 — 파일 → 토큰(JWT) 순서로.

    [실측 2026-08-26] 실제 파드에서 namespace 파일을 못 읽어 네임스페이스가 빈 값이 됐고,
    그래서 노드 조회를 **아예 시도조차 못 했다**(화면엔 '노드 모름' 만 남았다). 서비스어카운트
    토큰은 JWT 라 안에 네임스페이스가 들어 있다 — 서명 검증은 필요 없다(내 것을 읽을 뿐이다).
    """
    ns = os.environ.get("POD_NAMESPACE") or ""
    if ns:
        return ns, "환경변수"
    try:
        ns = io.open(SA_DIR + "/namespace", encoding="utf-8").read().strip()
        if ns:
            return ns, "서비스어카운트 파일"
    except Exception:
        pass
    try:
        payload = io.open(SA_DIR + "/token", encoding="utf-8").read().strip().split(".")[1]
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload).decode("utf-8", errors="replace"))
        ns = ((data.get("kubernetes.io") or {}).get("namespace")
              or data.get("kubernetes.io/serviceaccount/namespace") or "")
        if ns:
            return ns, "토큰(JWT)"
    except Exception:
        pass
    # [실측 2026-08-26] 서비스어카운트가 안 붙은 파드라 위 두 길이 다 막혔다. 그런데
    # /etc/resolv.conf 의 search 도메인 첫 항목이 `<네임스페이스>.svc.cluster.local` 이다 —
    # 쿠버네티스가 항상 넣어 주므로, 아무 권한 없이도 이것만은 알 수 있다.
    try:
        for line in io.open("/etc/resolv.conf", encoding="utf-8").read().split("\n"):
            if not line.strip().startswith("search"):
                continue
            for token in line.split()[1:]:
                if token.endswith(".svc.cluster.local") and token.count(".") == 4:
                    return token.split(".")[0], "resolv.conf 의 search 도메인"
    except Exception:
        pass
    return "", ""


def _k8s_api_self(namespace, pod, timeout=2.0):
    """서비스어카운트 토큰으로 '내 파드가 어느 노드에 떠 있는지' 를 API 서버에 물어본다.

    왜: 방화벽이 보는 출발지는 파드 IP 가 아니라 **노드 IP** 다(밖으로 나갈 때 SNAT). 그런데
    파드는 기본적으로 자기 노드를 모른다 — 원래는 파드 스펙에 downward API 를 넣어야 알 수
    있다. 운영이 배포 설정을 고쳐 줄 때까지 기다리지 않아도 되게, 권한이 있으면 API 로 바로
    알아낸다. 권한이 없으면(RBAC 403) 조용히 포기한다 — **추측한 IP 를 말하지 않는다**.
    틀린 IP 를 보안팀에 전달하면 방화벽을 또 엉뚱한 곳에 뚫게 된다.
    """
    api_host = os.environ.get("KUBERNETES_SERVICE_HOST") or ""
    api_port = (os.environ.get("KUBERNETES_SERVICE_PORT_HTTPS")
                or os.environ.get("KUBERNETES_SERVICE_PORT") or "443")
    root = SA_DIR
    if not api_host:
        return {}
    if not namespace or not pod:
        return {"error": "네임스페이스(%s)/파드이름(%s)을 몰라서 물어볼 수 없습니다"
                         % (namespace or "모름", pod or "모름")}
    try:
        token = io.open(root + "/token", encoding="utf-8").read().strip()
    except Exception:
        return {"error": "서비스어카운트 토큰이 파드에 안 붙어 있습니다"
                         " (automountServiceAccountToken: false) — API 로 물어볼 수 없습니다"}
    if not token:
        return {"error": "서비스어카운트 토큰이 비어 있습니다"}
    host = "[%s]" % api_host if ":" in api_host else api_host
    url = "https://%s:%s/api/v1/namespaces/%s/pods/%s" % (host, api_port, namespace, pod)
    try:
        ctx = ssl.create_default_context(cafile=root + "/ca.crt")
    except Exception:
        ctx = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token,
                                               "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            data = json.loads(resp.read(500000).decode("utf-8", errors="replace"))
    except Exception as err:
        return {"error": "%s: %s" % (type(err).__name__, err)}
    spec, status = (data.get("spec") or {}), (data.get("status") or {})
    return {"nodeName": spec.get("nodeName") or "", "nodeIp": status.get("hostIP") or "",
            "podIp": status.get("podIP") or ""}


def k8s_pod_info():
    """쿠버네티스 파드면 '어느 노드에 떠 있는지' 를 최대한 알아낸다.

    왜 중요한가: 파드가 클러스터 밖으로 나갈 때 대개 **노드 IP 로 SNAT** 된다. 그래서
    게이트웨이/방화벽이 보는 출발지는 파드 IP(10.x/172.17.x)가 아니라 **노드 IP** 다.
    방화벽을 특정 노드들에만 열어 뒀는데 파드가 다른 노드에 스케줄되면, 방화벽을 제대로
    뚫어 놓고도 -100 이 난다(GPU 노드만 열어 뒀는데 CPU 파드가 다른 노드로 가는 경우).

    노드 이름/IP 는 파드가 기본으로는 모른다 — 파드 스펙에 downward API 로 넣어 줘야 한다.
    없으면 '모름' 으로 두고 넣는 방법을 안내한다(추측해서 틀린 값을 말하지 않는다).
    """
    if not os.environ.get("KUBERNETES_SERVICE_HOST"):
        return None
    ns, ns_how = _k8s_namespace()
    info = {
        "namespaceSource": ns_how,
        "podName": os.environ.get("POD_NAME") or os.environ.get("HOSTNAME") or "",
        "podIp": os.environ.get("POD_IP") or "",
        "nodeName": os.environ.get("NODE_NAME") or os.environ.get("K8S_NODE_NAME") or "",
        "nodeIp": os.environ.get("NODE_IP") or os.environ.get("HOST_IP") or "",
        "namespace": ns,
        "nodeSource": "파드 스펙(downward API)" if (os.environ.get("NODE_NAME")
                                                or os.environ.get("NODE_IP")) else "",
    }
    if not info["podIp"]:
        try:    # 내 IP 는 API 없이도 안다(파드 IP = 이 컨테이너의 주소)
            probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            probe.connect(("10.255.255.255", 1))
            info["podIp"] = probe.getsockname()[0]
            probe.close()
        except Exception:
            pass
    if not info["nodeName"] and not info["nodeIp"]:
        got = _k8s_api_self(ns, info["podName"])
        if got.get("nodeName") or got.get("nodeIp"):
            info["nodeName"] = got.get("nodeName") or ""
            info["nodeIp"] = got.get("nodeIp") or ""
            info["podIp"] = info["podIp"] or got.get("podIp") or ""
            info["nodeSource"] = "쿠버네티스 API"
        elif got.get("error"):
            info["nodeError"] = got["error"]
    return info


def _configure_drm_from_args(args):
    """질문 모드와 서버 모드가 **같은 설정**을 보게 한다(달라지면 답이 갈린다)."""
    if drm is None:
        return
    try:
        drm.configure(base_url=(args.mip_base_url or None), api_key=(args.mip_api_key or None),
                      account=(args.mip_account or None), timeout=(args.mip_timeout or None),
                      client_ip=(args.mip_client_ip or None), gateway_ip=(args.mip_gateway_ip or None))
        drm.install_dns_fallback()
    except Exception as err:
        print(f"[경고] 문서보안 설정 중 오류: {type(err).__name__}: {err}")


def answer_and_print(question):
    """[사용자 지시 2026-08-26] 이 서버는 컨테이너 안에서 돌고 사용자에게는 터미널 하나뿐이다.
    브라우저로 주소를 열 수 없으니, 같은 답을 **명령 한 줄로** 볼 수 있어야 한다."""
    if drm is None:
        print("[문서보안] drm.py 를 불러오지 못해 답할 수 없습니다.")
        return
    try:
        for line in drm.answer(question):
            print(line)
    except Exception as err:
        print(f"[경고] 질문 처리 중 오류: {type(err).__name__}: {err}")


def watch_ask_file(folder, every=3.0):
    """서버가 도는 중에도 물어볼 수 있게, ask.txt 가 바뀌면 답을 콘솔에 찍는다.

    왜 파일인가: 서버를 띄운 터미널은 그 서버가 붙잡고 있어서 다른 명령을 칠 수 없다.
    그런데 이 폴더에는 파일을 넣을 수 있다(main.py 도 그렇게 올렸다). 그래서 **파일이 곧 질문**이다.
    답은 콘솔에도 찍고 ask_result.txt 로도 남긴다.
    """
    import threading

    ask, result = folder / "ask.txt", folder / "ask_result.txt"
    state = {"stamp": None}

    def loop():
        while True:
            try:
                stamp = ask.stat().st_mtime if ask.exists() else None
                if stamp is not None and stamp != state["stamp"]:
                    state["stamp"] = stamp
                    for q in [l.strip() for l in ask.read_text("utf-8").split("\n") if l.strip()]:
                        # flush 를 빼면 콘솔에 바로 안 뜬다(파이프/리다이렉트면 버퍼에 갇힌다).
                        # 사용자는 이 콘솔만 보고 있으므로, 늦게 뜨는 답은 없는 답이나 같다.
                        print("\n──── 질문: %s ────" % q, flush=True)
                        lines = drm.answer(q) if drm else ["drm.py 를 못 불러왔습니다."]
                        print("\n".join(lines), flush=True)
                        try:
                            result.write_text("\n".join(lines), encoding="utf-8")
                        except Exception:
                            pass
            except Exception:
                pass                              # 감시가 서버를 죽이면 안 된다
            time.sleep(every)

    state["stamp"] = ask.stat().st_mtime if ask.exists() else None
    threading.Thread(target=loop, name="ask-watch", daemon=True).start()
    return ask


def start_background_checks(args, delay=5.0):
    """서버가 응답을 시작한 뒤에 점검·진단을 돌린다.

    [실측 2026-08-27] 점검을 기동 경로에 두었더니, 게이트웨이가 막힌 상태에서 90초 넘게
    포트가 안 열렸다. 플랫폼은 GET /v1/models 로 살아있는지 보는데 그게 실패하니 파드를
    계속 재시작했다 — 진단 때문에 서비스가 죽었다. **서비스가 먼저다.**
    딜레이를 두는 이유도 같다: 첫 헬스체크가 지나간 뒤에 무거운 일을 시작한다.
    """
    import threading

    def later():
        time.sleep(delay)
        warn = 0
        try:
            warn = startup_selfcheck(args) or 0
        except Exception as err:
            print(f"[경고] 시작 점검 중 오류(서버는 계속 돕니다): {type(err).__name__}: {err}",
                  flush=True)
        try:
            if args.diagnose or (warn and not args.no_diagnose):
                run_deep_diagnosis("시작 점검에서 문제 %d건" % warn if warn else "")
        except Exception as err:
            print(f"[경고] 심층 진단 중 오류(서버는 계속 돕니다): {type(err).__name__}: {err}",
                  flush=True)

    threading.Thread(target=later, name="startup-checks", daemon=True).start()
    print("[AX-Cell] 서버를 먼저 띄웁니다 — 시작 점검/진단은 %d초 뒤 백그라운드에서 돕니다."
          % int(delay))
    print("          (헬스체크 GET /v1/models 가 먼저 200 을 받도록, 점검이 기동을 막지 않습니다)")


def run_deep_diagnosis(reason=""):
    """[사용자 지시 2026-08-26] 폐쇄망은 파일 한 번 올리는 것도 큰 일이다 — 문제가 보이면
    **묻지 않고 한 번에 다 찍는다**. 화면에도 남기고 파일로도 남긴다(관리자 화면에서 내려받게).

    되는 것까지 함께 찍는 게 핵심이다. '어디까지는 정상' 이 보여야 다음에 무엇을 볼지 정해진다.
    진단이 실패해도 서버 기동은 막지 않는다.
    """
    if drm is None:
        return ""
    try:
        lines = drm.deep_diagnose()
    except Exception as err:
        print(f"[경고] 심층 진단 중 오류(서버는 그대로 시작합니다): {type(err).__name__}: {err}")
        return ""
    if reason:
        lines.insert(1, "   (%s — 그래서 자동으로 돌렸습니다)" % reason)
    for line in lines:
        print(line)
    saved = ""
    try:
        root = getattr(collector, "LOG_ROOT", None)
        if root:
            folder = root / "_diagnostics"
            folder.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = folder / ("diagnose_%s.txt" % stamp)
            path.write_text("\n".join(lines), encoding="utf-8")
            saved = str(path)
            print(f"   [저장] 이 진단을 파일로도 남겼습니다: {saved}")
    except Exception as err:                     # 저장 실패가 진단을 못 보게 하면 안 된다
        print(f"   [저장 실패] {type(err).__name__}: {err}")
    return saved


def startup_selfcheck(args):
    """[시작 자가진단 2026-08-26] 켤 때 '지금 무엇이 되고 무엇이 안 되는지'를 한눈에 보여준다.

    왜: 예전 시작 로그는 설정값만 나열했다. 그래서 폐쇄망 서버에서 DNS 가 안 풀려 보안 해제가
    전부 실패하는데도 화면은 멀쩡해 보였고(실측), 원인을 찾는 데 한참 걸렸다.
    되는 것은 OK, 안 되는 것은 [경고] + **무엇을 하면 되는지**까지 적는다.
    어떤 점검도 서버 기동을 막지 않는다 — 점검이 실패해도 서버는 그대로 뜬다.
    """
    rows = []      # (상태, 항목, 설명)  상태: OK | 경고 | 꺼짐
    tips = []      # 문제일 때 붙일 해결 안내(줄 목록)

    container = detect_container()
    ns = read_nameservers()
    k8s = k8s_pod_info()
    if container:
        rows.append(("OK", "실행 환경", f"컨테이너({container})  — DNS·나가는 IP 가 호스트와 다릅니다"))
    if k8s:
        who = k8s["podName"] or "(파드명 미상)"
        node = k8s["nodeName"] or k8s["nodeIp"] or ""
        if node:
            src = f"  [{k8s.get('nodeSource')}]" if k8s.get("nodeSource") else ""
            rows.append(("OK", "파드/노드", f"{who}  @  {node}  ← 방화벽 출발지는 이 **노드** 입니다{src}"))
            if k8s.get("nodeIp"):
                tips.append(f"  · 방화벽 출발지: 보안팀에는 노드 IP **{k8s['nodeIp']}**"
                            f" ({k8s.get('nodeName') or '이름 미상'}) 로 요청하세요."
                            " 파드 IP 로 뚫으면 나가는 순간 노드 IP 로 바뀌어 소용이 없습니다.")
        elif k8s.get("nodeError"):
            rows.append(("경고", "파드/노드", f"{who}  @  (노드 모름 — API 조회 실패: {k8s['nodeError'][:70]})"))
        else:
            rows.append(("경고", "파드/노드", f"{who}  @  (노드 모름 — 파드가 어느 노드에 떴는지 알 수 없음)"))
            tips.append("  · 노드 확인: 방화벽 출발지는 파드 IP 가 아니라 **노드 IP** 입니다(클러스터 밖으로 나갈 때"
                        " 노드 IP 로 SNAT). 어느 노드인지 보려면 파드 스펙에 downward API 를 넣으세요:")
            tips.append("      env: [{name: NODE_NAME, valueFrom: {fieldRef: {fieldPath: spec.nodeName}}},")
            tips.append("            {name: NODE_IP,   valueFrom: {fieldRef: {fieldPath: status.hostIP}}}]")
            tips.append("      (밖에서 볼 때는  kubectl get pod <파드> -o wide  의 NODE 열)")
        tips.append("  · 방화벽을 특정 노드들에만 열어 뒀다면, 파드가 **그 노드에 뜨도록** 고정해야 합니다"
                    " (nodeSelector / nodeAffinity). 다른 노드에 스케줄되면 방화벽을 제대로 뚫어 놓고도"
                    " -100 '허용되지 않은 IP' 가 납니다.")
    if ns:
        rows.append(("OK", "DNS 서버", ", ".join(ns[:3])))
    elif os.name != "nt":
        rows.append(("경고", "DNS 서버", "/etc/resolv.conf 에 nameserver 가 없습니다"))
        tips.append("  · DNS 서버: /etc/resolv.conf 에 사내 DNS 를 넣거나, 게이트웨이를 /etc/hosts 에 직접 등록하세요.")

    # ── 버전 확인 ──
    try:
        v = read_version_file()
        if v.ok:
            rows.append(("OK", "버전 확인", f"{v.normalized}  ({VERSION_FILE})"))
        else:
            rows.append(("경고", "버전 확인", v.error or "알 수 없는 오류"))
            tips.append(f"  · 버전 확인: {VERSION_FILE} 의 첫 줄을 '0.8.0.0' 같은 숫자 버전으로 맞추세요.")
    except Exception as err:
        rows.append(("경고", "버전 확인", f"{type(err).__name__}: {err}"))

    # ── 로그 수집 ──
    if collector is None:
        rows.append(("꺼짐", "로그 수집", f"collector.py 를 읽지 못함: {COLLECTOR_ERROR}"))
        tips.append("  · 로그 수집: collector.py 를 main.py 와 같은 폴더에 두고 다시 켜세요.")
    elif args.no_collector:
        rows.append(("꺼짐", "로그 수집", "--no-collector 로 껐습니다"))
    elif collector.LOG_ROOT is None:
        rows.append(("경고", "로그 수집", "저장 폴더가 정해지지 않았습니다"))
    else:
        root = collector.LOG_ROOT
        probe = root / (".write_test_%d" % os.getpid())
        try:
            probe.write_text("ok", encoding="utf-8")
            probe.unlink()
            free = ""
            try:
                import shutil as _sh
                free = "  여유 %.1fGB" % (_sh.disk_usage(str(root)).free / (1024 ** 3))
            except Exception:
                pass
            rows.append(("OK", "로그 수집", f"{root}  (쓰기 가능){free}"))
        except Exception as err:
            rows.append(("경고", "로그 수집", f"{root} 에 쓸 수 없습니다: {type(err).__name__}: {err}"))
            tips.append(f"  · 로그 수집: 서버를 돌리는 계정에 {root} 쓰기 권한을 주거나 --log-root 로 바꾸세요.")

    # ── 파일 업로드 의존성(문서보안이 이것 없이는 아예 안 뜬다) ──
    try:
        import multipart  # noqa: F401
        rows.append(("OK", "파일 업로드", "python-multipart 설치됨"))
    except Exception:
        rows.append(("경고", "파일 업로드", "python-multipart 없음 — 문서보안 API 가 동작하지 않습니다"))
        tips.append("  · 파일 업로드: python3 -m pip install -r requirements.txt 로 설치하세요.")

    # ── 문서보안(키 · 이름풀이 · 연결) ──
    if drm is None:
        rows.append(("꺼짐", "문서보안", f"drm.py 를 읽지 못함: {DRM_IMPORT_ERROR}"))
        tips.append("  · 문서보안: drm.py 를 main.py 와 같은 폴더에 두고 다시 켜세요.")
    else:
        info = drm.configure(base_url=args.mip_base_url or None,
                             api_key=(args.mip_api_key or None),
                             account=(args.mip_account or None),
                             timeout=(args.mip_timeout or None),
                             client_ip=(args.mip_client_ip or None),
                             gateway_ip=(args.mip_gateway_ip or None))
        # 이름이 안 풀리는 폐쇄망 파드에서도 그대로 돌게 — URL 은 그대로 두고 이름만 대신 푼다.
        drm.install_dns_fallback()
        if not info["configured"]:
            rows.append(("경고", "문서보안 키", "MIP_API_KEY 없음 — 호출하면 503 이 납니다"))
            tips.append("  · 문서보안 키: .env 에 MIP_API_KEY=발급키 를 적고 서버를 다시 켜세요.")
        else:
            rows.append(("OK", "문서보안 키",
                         f"설정됨 / 기본계정 {'있음' if info['account'] else '없음'}"
                         f" / 제한시간 {info['timeout']:.0f}초"))
            if not info["account"]:
                tips.append("  · 기본계정: 클라이언트가 계정을 못 보내면 400 이 납니다."
                            " .env 의 MIP_REQUESTOR_ACCOUNT 에 예비 계정을 넣어 두세요.")
        # 게이트웨이까지 갈 수 있는지 — **실제로** 이름 풀이 → TCP → TLS → HTTP 를 밟아 본다.
        # [실측 2026-08-26] 예전엔 이름 풀이만 확인하고 "게이트웨이 OK" 를 찍었다. 연결 확인은
        # 3초 안에 안 끝나면 결과가 버려졌는데 OK 줄은 그대로 남아서, 모든 보안 해제가 실패하는
        # 서버가 시작 화면상으로는 멀쩡해 보였다. 확인하지 않은 것을 OK 라고 적지 않는다.
        probe = drm.probe_gateway_stages()
        # 사이드카가 있으면 'TCP 열림' 의 뜻이 달라진다 — 표에 먼저 밝혀 둔다.
        mesh = probe.get("mesh") or {}
        if mesh.get("present"):
            how = ("Envoy 관리포트 응답" + (" %s" % mesh["version"] if mesh.get("version") else "")
                   if mesh.get("adminOk") else "흔적으로 감지(관리포트는 막혀 있음)")
            rows.append(("OK", "서비스 메시",
                         f"사이드카 있음 — 나가는 연결을 사이드카가 가로챕니다  ({how})"))
        for st in probe.get("stages", []):
            mark = "OK" if st.get("ok") is True else ("경고" if st.get("ok") is False else "확인못함")
            took = f"  ({st['ms']}ms)" if st.get("ms") is not None else ""
            why = f"{st['why']} — " if st.get("why") else ""
            rows.append((mark, "게이트웨이 " + st["name"], (why + (st.get("detail") or "")).strip() + took))
        tips.extend("  " + l for l in probe.get("advice", []))
        if probe.get("viaFallback"):
            tips.append("  · 참고: 지금은 서버가 이름 풀이를 대신하고 있습니다(URL 은 그대로). 항구적으로는"
                        " 파드 hostAliases 나 사내 DNS 를 넣는 편이 좋습니다 — VIP 가 바뀌면 여기도 고쳐야 합니다.")
        stages = probe.get("stages", [])
        dns_ok = not any(st["name"] == "이름 풀이" and st.get("ok") is False for st in stages)
        # 뒤쪽 점검(URL 에 IP 박혔는지 / 나가는 IP)이 쓰는 모양으로 맞춰 준다
        dns = {"ok": dns_ok, "addresses": ([probe["ip"]] if probe.get("ip") else [])}
        check = {"host": probe.get("host"), "port": probe.get("port"), "dns": dns}
        if container and not dns_ok:
            tips.append("    ※ 컨테이너는 호스트의 DNS 를 물려받지 않습니다 — 호스트에서 이름이 풀려도"
                        " 여기선 안 될 수 있습니다. 컨테이너 안에서 고친 /etc/hosts·resolv.conf 는"
                        " 재시작하면 사라지니, 실행 옵션(--dns/--add-host, compose 의 dns/extra_hosts)에 넣으세요.")

        # ── URL 에 IP 를 직접 박았는지(TLS 함정) ──
        # DNS 가 막히면 "그냥 IP 로 부르자" 가 되기 쉬운데, 그러면 인증서가 호스트명과 안 맞아
        # TLS 검증이 깨진다(→ 검증을 끄게 되고 보안이 내려간다). VIP 앞단이면 Host 헤더 기반
        # 라우팅도 틀어질 수 있다. 해법은 URL 은 호스트명 그대로 두고 이름만 hosts/hostAliases 로 푸는 것.
        if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", check.get("host") or ""):
            rows.append(("경고", "게이트웨이 URL", f"주소에 IP({check['host']})가 직접 들어 있습니다 — TLS 인증서 불일치"))
            tips.append("  · 게이트웨이 URL: IP 대신 호스트명을 쓰고, 이름만 hosts/hostAliases 로 푸세요."
                        " (인증서는 호스트명 기준이라 IP 로 부르면 검증이 깨지고, VIP 앞단이면"
                        " Host 헤더 라우팅도 어긋납니다)")

        # ── 게이트웨이에 보낼 ip 파라미터(규격 필수) ──
        # 규격 v0.3: method/ip/keyCode/requestorAccount/policyGCode 가 필수다. ip 가 비면
        # -200 '필수 파라미터 항목이 누락되었습니다' 가 난다. 안 정해 뒀으면 감지값으로 채우되,
        # NAT/컨테이너면 그 값이 틀리므로 반드시 눈에 띄게 알린다.
        # ── 방화벽에 등록해야 할 '나가는 IP' ──
        # 게이트웨이 허용 목록(-100)은 서버의 출발지 IP 기준이다. 서버에 IP 가 여러 개거나
        # 컨테이너면 어느 것을 보안팀에 알려야 하는지 헷갈려 엉뚱한 IP 를 뚫는 일이 생긴다.
        dest = ((dns.get("addresses") or [None])[0]) if dns.get("ok") else None
        eg = drm.local_egress_info(dest, check.get("port") or 443)
        others = [ip for ip in (eg.get("allIps") or []) if ip != eg.get("routeIp")]
        if not drm.CLIENT_IP and eg.get("routeIp"):
            drm.configure(client_ip=eg["routeIp"])       # 비어 있으면 감지값으로라도 채운다
        if drm.CLIENT_IP:
            src = "설정값(.env/인자)" if not eg.get("routeIp") or drm.CLIENT_IP != eg.get("routeIp") else "자동 감지"
            state = "OK" if not container or src.startswith("설정값") else "경고"
            rows.append((state, "보낼 ip", f"{drm.CLIENT_IP}  ({src}) — 게이트웨이 필수 파라미터"))
            if container and not src.startswith("설정값"):
                tips.append("  · 보낼 ip: 컨테이너 내부 IP 를 보내면 게이트웨이 등록 IP 와 안 맞아 -100 이 납니다."
                            " .env 에 MIP_CLIENT_IP=<Outbound NAT IP> 를 넣으세요(규격: NAT 있으면 NAT IP).")
        else:
            rows.append(("경고", "보낼 ip", "정해지지 않음 — -200 '필수 파라미터 누락' 이 납니다"))
            tips.append("  · 보낼 ip: .env 에 MIP_CLIENT_IP=<업무시스템 IP(NAT 면 Outbound NAT IP)> 를 넣으세요.")
        tips.append("  · IP 를 모르겠으면: 한 번 호출해 보세요. 등록 IP 가 다르면 게이트웨이가"
                    " -100 '허용되지 않은 IP에서 호출하였습니다.<IP>' 로 **자기가 본 IP** 를 알려줍니다"
                    " (응답의 seenIp / 로그의 ★게이트웨이가 본 IP).")

        if eg.get("routeIp") and not eg.get("guessed"):
            rows.append(("OK", "나가는 IP", f"{eg['routeIp']}  ← 방화벽/게이트웨이 허용목록에 이 IP 가 등록돼야 합니다"))
        elif eg.get("routeIp"):
            # DNS 가 아직 안 풀려 게이트웨이 경로를 못 짚었다 — 기본 경로 기준이라도 보여준다.
            rows.append(("OK", "나가는 IP", f"{eg['routeIp']}  (기본 경로 기준 추정 — 게이트웨이 주소 확인 후 다시 보세요)"))
        else:
            rows.append(("경고", "나가는 IP", eg.get("error") or "확인 실패"))
        if others:
            rows.append(("OK", "  다른 IP", ", ".join(others[:4]) + "  (이 서버가 가진 다른 주소 — 헷갈리기 쉬움)"))
        if container:
            # 컨테이너는 브리지 NAT 이라 게이트웨이가 보는 건 대개 '호스트 IP' 다.
            # 이걸 모르고 컨테이너 IP(172.17.x.x 등)를 등록하면 방화벽을 뚫어도 계속 -100 이 난다.
            tips.append(f"  · 방화벽 확인(컨테이너): 위 '나가는 IP'({eg.get('routeIp') or '미상'}) 는"
                        f" **컨테이너 내부 주소**일 가능성이 큽니다. 게이트웨이가 보는 것은 보통"
                        f" **호스트 서버의 IP** 입니다 — 보안팀에는 그쪽을 등록해야 합니다.")
            tips.append("    호스트에서 확인:  ip -4 addr  또는  hostname -I   (호스트 셸에서)")
        else:
            tips.append(f"  · 방화벽 확인: 보안팀에 등록된 IP 가 위 '나가는 IP'({eg.get('routeIp') or '미상'})"
                        f" 와 같은지 대조하세요. 다르면 -100 '허용되지 않은 IP' 가 납니다.")
            tips.append("    ※ 중간에 NAT/프록시가 있으면 게이트웨이가 보는 IP 는 이것과 다를 수 있습니다"
                        " — 그때는 인프라팀에 '이 서버가 나갈 때 최종적으로 보이는 IP' 를 물어보세요.")

    # ── 출력 ──
    warn = sum(1 for st, _, _ in rows if st == "경고")
    print("")
    print("──────── 시작 점검 ────────")
    for st, name, detail in rows:
        mark = ("OK  " if st == "OK" else "경고" if st == "경고"
                else "모름" if st == "확인못함" else "꺼짐")
        print(f"  [{mark}] {name:10s} {detail}")
    print("───────────────────────────")
    if warn or tips:
        # 경고가 없어도 알려 줄 게 있으면 보여 준다(예: TLS 1.2 로 자동 전환했음).
        print(f"  문제 {warn}건 — 아래를 확인하세요:" if warn else "  참고:")
        for line in tips:
            print(line)
        print("───────────────────────────")
    print("")
    return warn


def main():
    global VERSION_FILE, DOWNLOAD_URL
    ap = argparse.ArgumentParser(description="AX-Cell 버전 확인 서버")
    ap.add_argument("--ask", default="",
                    help="서버를 띄우지 않고 질문 한 줄에 답한다 "
                         "(예: --ask \"probe 172.28.11.30:443\", --ask help)")
    ap.add_argument("--download-url", default=os.environ.get("AXCELL_DOWNLOAD_URL", ""),
                    help="'다운로드 하러가기' 버튼이 열 주소(비우면 버튼이 안내만 함)")
    ap.add_argument("--version-file", default="",
                    help="최신 버전이 적힌 version.txt 경로 (예: C:\\axcell\\version.txt)")
    ap.add_argument("--host", default="0.0.0.0", help="바인딩 주소 (기본 0.0.0.0)")
    ap.add_argument("--port", type=int, default=8100, help="포트 (기본 8100)")
    # ── 로그/스킬 수집 ──
    ap.add_argument("--log-root", default=DEFAULT_LOG_ROOT,
                    help=f"수집한 로그/스킬을 쌓을 폴더 (기본 {DEFAULT_LOG_ROOT})")
    ap.add_argument("--no-collector", action="store_true",
                    help="로그 수집 기능을 끈다(버전 확인만 한다)")
    ap.add_argument("--retention-days", type=int, default=0,
                    help="이 일수보다 오래된 날짜 폴더 삭제. 0(기본)이면 안 지우고 계속 쌓는다")
    ap.add_argument("--max-session-mb", type=int, default=300,
                    help="한 세션(실행 1회)당 받을 최대 용량 MB (기본 300)")
    ap.add_argument("--ingest-key", default=os.environ.get("AXCELL_LOG_INGEST_KEY", ""),
                    help="수집 인증 키. 정하면 클라가 X-B2B-Log-Key 헤더로 보내야 한다(기본: 인증 없음)")
    ap.add_argument("--admin-key", default=os.environ.get("AXCELL_LOG_ADMIN_KEY", ""),
                    help="관리자 조회/다운로드 키. 정하면 ?key=... 또는 X-Admin-Key 필요(기본: 인증 없음)")
    # ── 문서보안(DRM) ── 기본값은 환경변수/.env (drm.py 가 import 때 .env 를 올려 둔다)
    ap.add_argument("--mip-base-url", default="",
                    help="MIP Gateway 주소 (기본: MIP_GATEWAY_BASE_URL 또는 운영 mipgw)")
    ap.add_argument("--mip-api-key", default="",
                    help="MIP keyCode (기본: MIP_API_KEY / .env — 명령줄 노출을 피하려면 .env 권장)")
    ap.add_argument("--mip-account", default="",
                    help="기본 요청자 계정 (기본: MIP_REQUESTOR_ACCOUNT)")
    ap.add_argument("--mip-timeout", default="",
                    help="Gateway 제한시간 초 (기본: MIP_TIMEOUT 또는 60)")
    ap.add_argument("--mip-gateway-ip", default="",
                    help="게이트웨이 이름이 안 풀릴 때 대신 붙을 IP(방화벽 신청서의 '도착지' VIP). "
                         "기본: MIP_GATEWAY_IP 또는 등록된 운영 VIP")
    ap.add_argument("--diagnose", action="store_true",
                    help="문제가 없어도 심층 진단(A~G)을 찍는다")
    ap.add_argument("--diagnose-only", action="store_true",
                    help="심층 진단만 찍고 서버는 띄우지 않는다")
    ap.add_argument("--no-diagnose", action="store_true",
                    help="문제가 있어도 심층 진단을 자동으로 찍지 않는다")
    ap.add_argument("--mip-client-ip", default="",
                    help="게이트웨이에 보낼 업무시스템 IP(규격 필수). NAT 뒤면 Outbound NAT IP. "
                         "(기본: MIP_CLIENT_IP, 없으면 시작 시 자동 감지 — 컨테이너에선 틀릴 수 있음)")
    args = ap.parse_args()

    setup_terminal_logging()

    # ── 질문 한 줄만 받고 끝내는 길 ──
    # 이 서버는 컨테이너 안에서 돌고, 사용자에게는 터미널 하나뿐이다(브라우저로 주소를 열 수 없다).
    # 그래서 서버를 띄우지 않고도 같은 진단을 부를 수 있어야 한다.
    if args.ask:
        _configure_drm_from_args(args)
        answer_and_print(args.ask)
        return

    if not args.version_file:
        ap.error("--version-file 이 필요합니다 (질문만 할 때는 --ask 를 쓰세요)")
    VERSION_FILE = Path(args.version_file).expanduser().resolve()
    DOWNLOAD_URL = str(args.download_url or "").strip()
    if not VERSION_FILE.exists():
        # 죽이지는 않는다 — 서버를 먼저 띄우고 파일을 나중에 놓는 운영도 있다.
        print(f"[경고] 지금은 파일이 없습니다: {VERSION_FILE} (요청 시점에 다시 확인합니다)")
    print(f"[AX-Cell 버전 서버] version.txt = {VERSION_FILE}")
    print(f"[AX-Cell 버전 서버] http://{args.host}:{args.port}/version")

    # 로그/스킬 수집 폴더 준비. 만들지 못하면(권한 등) 이 파일 옆 logs 로 물러난다 —
    # 수집이 안 되는 것보다 임시 위치라도 쌓이는 편이 낫고, 어디에 쌓는지 아래에 찍어 준다.
    if collector is None:
        print(f"[경고] collector.py 를 읽지 못해 로그 수집은 꺼진 채로 시작합니다: {COLLECTOR_ERROR}")
        print("       (버전 확인은 정상 동작합니다. 수집이 필요하면 collector.py 를 main.py 옆에 두세요)")
    elif args.no_collector:
        collector.configure(None)
        print("[AX-Cell 수집] 꺼짐(--no-collector)")
    else:
        chosen = args.log_root
        try:
            root = collector.configure(chosen, args.retention_days, args.max_session_mb,
                                       args.ingest_key, args.admin_key)
        except Exception as err:
            fallback = Path(__file__).resolve().parent / "logs"
            print(f"[경고] 수집 폴더를 만들지 못했습니다({chosen}): {err} → {fallback} 로 대신 씁니다.")
            root = collector.configure(fallback, args.retention_days, args.max_session_mb,
                                       args.ingest_key, args.admin_key)
        print(f"[AX-Cell 수집] 저장 위치 = {root}")
        if drm is not None:
            # 실패 시 자동 진단(drm.autodiagnose_on_failure)이 파일로도 남을 곳 —
            # 시작 진단과 같은 폴더라 한 군데만 보면 된다.
            drm.AUTODIAG_SAVE_DIR = str(Path(root) / "_diagnostics")
        print(f"[AX-Cell 수집] 보관 = {'무제한' if not args.retention_days else str(args.retention_days) + '일'}"
              f" / 세션당 최대 {args.max_session_mb}MB"
              f" / 수집 인증 {'있음' if args.ingest_key else '없음'}")
        print(f"[AX-Cell 수집] 관리자 화면 http://{args.host}:{args.port}/admin")

    # 문서보안 설정값 표시(키 값은 절대 찍지 않는다) — 실제 되는지 여부는 아래 자가진단이 본다.
    if drm is not None:
        print(f"[문서보안] Gateway = {drm.GATEWAY_BASE_URL}")
        print(f"[문서보안] http://{args.host}:{args.port}/api/drm/health")

    # ── 점검은 서버가 뜬 **뒤에** 돌린다 ──
    # [실측 2026-08-27] 예전엔 여기서 바로 점검·진단을 했다. 그런데 게이트웨이가 막힌 상태에서는
    # TLS 시도마다 제한시간을 다 쓰느라 90초 넘게 걸렸고, 그동안 포트가 안 열려 **플랫폼의
    # 헬스체크(GET /v1/models)가 실패 → 파드가 계속 재시작**됐다. 진단하려다 서비스를 죽인 셈이다.
    # 점검은 아무리 유용해도 **서비스보다 뒤**다.
    if args.diagnose_only:
        try:
            warn = startup_selfcheck(args) or 0
        except Exception as err:
            print(f"[경고] 시작 점검 중 오류: {type(err).__name__}: {err}")
            warn = 0
        run_deep_diagnosis("시작 점검에서 문제 %d건" % warn if warn else "")
        print("[문서보안] --diagnose-only 라 서버는 띄우지 않고 끝냅니다.")
        return

    # 서버를 띄운 터미널은 그 서버가 붙잡고 있어 다른 명령을 칠 수 없다 — 그래서 파일로 묻는 길을 연다.
    try:
        root = getattr(collector, "LOG_ROOT", None) if collector else None
        if root and drm is not None:
            ask_path = watch_ask_file(root)
            print(f"[문서보안] 물어보기: {ask_path} 에 한 줄 적으면 여기(콘솔)에 답이 찍힙니다.")
            print("           예)  probe 172.28.11.30:443   /   envoy clusters 172.28.11.30   /   diagnose")
    except Exception as err:
        print(f"[경고] 물어보기 감시를 켜지 못했습니다: {type(err).__name__}: {err}")

    start_background_checks(args)

    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
