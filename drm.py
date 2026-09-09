# -*- coding: utf-8 -*-
"""LGU+ MIP Gateway(문서보안 DRM) 연동 — 버전/수집 서버에 얹혀 도는 부가 기능.

왜 여기 있나
  사용자 PC 는 MIP Gateway 를 직접 부를 수 없다(허용 IP 제한). 이 서버(versionTest)는
  사내망에서 항상 떠 있으므로, AX-Cell 이 보안문서를 이 서버로 보내면 서버가 Gateway 로
  풀어(또는 걸어) 되돌려 준다.

      AX-Cell(사용자 PC) → 이 서버 /v1/drm/* → MIP Gateway(noSessiondo) → 다시 사용자 PC

구성 (환경변수 또는 옆의 .env 파일 — 켤 때 인자로도 덮어쓸 수 있다)
  MIP_GATEWAY_BASE_URL   Gateway 주소 (기본: 운영 mipgw — 개발로 돌리려면 devmipgw 를 지정)
  MIP_API_KEY            keyCode 로 쓰는 인증 키 — 코드에 하드코딩 금지, 로그 출력 금지
  MIP_REQUESTOR_ACCOUNT  요청에 계정이 안 실려 왔을 때 쓸 기본 계정
  MIP_TIMEOUT            Gateway 호출 제한시간(초, 기본 60)
  MIP_TLS_MAX            '1.2' 로 두면 TLS 1.2 로 고정(구형 VIP 가 1.3 을 끊을 때).
                         비워 두면 켤 때 진단이 확인해 필요하면 자동으로 1.2 로 맞춘다.

엔드포인트 (main.py 가 /api/drm/* 와 /v1/drm/* 두 곳에 붙인다 — /v1 은 AX-Cell 이 쓰는 길)
  POST /encrypt   파일 암호화        → 파일 스트림
  POST /decrypt   파일 복호화        → 파일 스트림
  POST /secret    비밀문서 여부 확인 → JSON (S_DOC / N_DOC)
  POST /policy    정책 기반 암/복호화(decodeType=encrypt|decrypt) → 파일 스트림
  GET  /health    설정 여부 확인(키가 없으면 configured=false)

Gateway 오류 코드 → HTTP 매핑 (본문에는 Gateway JSON 을 그대로 실어 준다)
  -100 인증 오류   → 502   (서버 IP/keyCode 문제 — 사용자가 고칠 수 없다)
  -200 업무 오류   → 400   ("복호화 대상 파일이 아닙니다" 등 — 부르는 쪽이 분기한다)
  -999 서버 오류   → 502
  네트워크/타임아웃 → 504

재시도 정책: 하지 않는다. 암/복호화는 반복 호출의 안전성이 확인되지 않았다(연동규격에
재시도 규정 없음). 타임아웃/연결 실패도 그대로 오류로 돌려준다.

로그: method/계정/파일명/크기/소요시간/결과만 남긴다. keyCode·파일 내용은 절대 남기지 않는다.
"""
from __future__ import annotations

import json
import logging
import os
import re
import socket
import ssl
import struct
import sys
import time
import traceback
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, Form, Query, UploadFile
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

from collector import safe_filename

logger = logging.getLogger("axcell.drm")

# ── 상수 (연동규격 문서 기준 — 문서에 없는 값은 만들지 않는다) ─────────────
DEV_GATEWAY_URL = "https://devmipgw.lguplus.co.kr/webapi/api/lguplusstreams/noSessiondo"
PROD_GATEWAY_URL = "https://mipgw.lguplus.co.kr/webapi/api/lguplusstreams/noSessiondo"
POLICY_G_CODE = "PG01"          # 공통 정책 그룹 코드(규격 고정값)


def _load_dotenv(path):
    """옆의 .env 를 환경변수로 올린다(이미 있는 환경변수가 우선). python-dotenv 의존성을
    더하지 않으려고 KEY=VALUE 만 읽는 최소 구현 — 따옴표/주석/빈 줄을 처리한다."""
    try:
        p = Path(path)
        if not p.exists():
            return
        for line in p.read_text("utf-8-sig", errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip("'\"")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        pass


_load_dotenv(Path(__file__).resolve().parent / ".env")

# ── 설정 (import 시 환경변수에서 읽고, main.py 의 configure() 가 덮어쓴다) ──
# [사용자 지시 2026-08-24] 기본은 '운영'이다 — 개발 Gateway 는 명시적으로 지정할 때만 쓴다.
GATEWAY_BASE_URL = os.environ.get("MIP_GATEWAY_BASE_URL", "").strip() or PROD_GATEWAY_URL
API_KEY = os.environ.get("MIP_API_KEY", "").strip()
# [규격 v0.3 필수] 게이트웨이에 보낼 '업무시스템 IP'. NAT 뒤라면 **Outbound NAT IP** 를 넣어야
# 한다(컨테이너 내부 IP 를 보내면 등록 IP 와 안 맞아 -100). 비워 두면 켤 때 자동 감지한 값을
# 쓰지만, NAT/컨테이너 환경에서는 그 값이 틀리므로 .env 에 명시하는 것이 맞다.
CLIENT_IP = os.environ.get("MIP_CLIENT_IP", "").strip()
# [자동 해결] 게이트웨이 이름이 안 풀릴 때 대신 쓸 IP(= 방화벽 신청서의 '도착지' VIP).
# 폐쇄망 파드에는 사내 DNS 가 없어 이름 풀이가 실패한다 — 그때만 이 IP 로 붙는다.
# 운영 VIP(PWSMCOMMGW01V~04V 앞단, 2026-08-26 사용자 확인). .env 의 MIP_GATEWAY_IP 로 덮어쓴다.
GATEWAY_IP = os.environ.get("MIP_GATEWAY_IP", "").strip() or "172.28.11.30"
# [실측 2026-08-26] 구형 VIP/보안장비는 TLS 1.3 ClientHello 를 경고 없이 RST 로 끊기도 한다.
# 그때는 1.2 로만 붙는다 — 진단이 그 사실을 확인하면 이 값이 자동으로 "1.2" 가 된다.
TLS_MAX_VERSION = (os.environ.get("MIP_TLS_MAX", "") or "").strip()
_DNS_DEAD_UNTIL = 0.0            # 이름 풀이가 죽어 있다고 확인한 시각(단조시계) + 유예
_DNS_RECHECK_SECONDS = 300.0     # 그동안은 바로 등록된 IP 로 간다(사내 DNS 가 살아나면 다시 씀)
_DNS_FALLBACK_INSTALLED = False
_DNS_FALLBACK_LOGGED = False
# -100 이 알려준 IP 로 ip 파라미터를 스스로 고쳤는지(중복 재시도 방지 + 시작 로그 안내용)
CLIENT_IP_LEARNED = ""
DEFAULT_ACCOUNT = os.environ.get("MIP_REQUESTOR_ACCOUNT", "").strip()
TIMEOUT_SECONDS = float(os.environ.get("MIP_TIMEOUT", "") or 60)
MAX_FILE_MB = int(os.environ.get("MIP_MAX_FILE_MB", "") or 200)
# 사내 게이트웨이가 사설 인증서를 쓰는 경우를 위한 스위치(기본은 검증한다).
VERIFY_TLS = str(os.environ.get("MIP_VERIFY_TLS", "1")).strip().lower() not in {"0", "false", "no", "off"}


def configure(base_url=None, api_key=None, account=None, timeout=None, max_file_mb=None,
              verify_tls=None, client_ip=None, gateway_ip=None):
    """서버 시작 시 main.py 가 호출. None 인 값은 그대로 둔다(환경변수/기존값 유지)."""
    global GATEWAY_BASE_URL, API_KEY, DEFAULT_ACCOUNT, TIMEOUT_SECONDS, MAX_FILE_MB, VERIFY_TLS
    global CLIENT_IP, GATEWAY_IP
    if client_ip is not None:
        CLIENT_IP = str(client_ip).strip()
    if gateway_ip is not None and str(gateway_ip).strip():
        GATEWAY_IP = str(gateway_ip).strip()
    if base_url is not None and str(base_url).strip():
        GATEWAY_BASE_URL = str(base_url).strip()
    if api_key is not None:
        API_KEY = str(api_key).strip()
    if account is not None:
        DEFAULT_ACCOUNT = str(account).strip()
    if timeout is not None:
        try:
            TIMEOUT_SECONDS = max(1.0, float(timeout))
        except Exception:
            pass
    if max_file_mb is not None:
        try:
            MAX_FILE_MB = max(1, int(max_file_mb))
        except Exception:
            pass
    if verify_tls is not None:
        VERIFY_TLS = bool(verify_tls)
    return {"gateway": GATEWAY_BASE_URL, "configured": bool(API_KEY),
            "account": bool(DEFAULT_ACCOUNT), "timeout": TIMEOUT_SECONDS,
            "clientIp": CLIENT_IP}


def install_dns_fallback():
    """[자동 해결 2026-08-26] 게이트웨이 이름이 안 풀리면 **등록된 VIP 로 직접** 연결한다.

    폐쇄망 파드에는 사내 DNS 가 없어 mipgw.lguplus.co.kr 가 안 풀린다. 원래는 파드 스펙에
    hostAliases 를 넣어야 하지만, 그러려면 운영이 배포 설정을 고쳐야 한다. 여기서는
    **이름 풀이만 대신**해 준다 — 실패했을 때, 그 호스트에 한해, 설정된 IP 로 답한다.

    URL 은 호스트명 그대로 두므로 **TLS 인증서 검증과 Host 헤더가 정상 유지**된다
    (URL 에 IP 를 박으면 인증서가 안 맞아 검증을 꺼야 하고, VIP 앞단 라우팅도 어긋난다).
    성공하던 이름 풀이에는 개입하지 않는다 — DNS 가 살아나면 그쪽이 우선이다.
    """
    global _DNS_FALLBACK_INSTALLED
    if _DNS_FALLBACK_INSTALLED or not GATEWAY_IP:
        return False
    import socket
    from urllib.parse import urlsplit
    host = (urlsplit(GATEWAY_BASE_URL).hostname or "").lower()
    if not host:
        return False
    original = socket.getaddrinfo

    def _with_fallback(node, port, *args, **kwargs):
        # [실측 2026-08-26] 예전엔 호출마다 안 되는 이름 풀이를 먼저 시도했다. 쿠버네티스는
        # search 도메인 + ndots:5 때문에 한 번 물어보는 데 10초씩 걸린다 — 그래서 로그의
        # elapsed_ms=10012 가 "게이트웨이가 느리다" 로 보였다(실제로는 대부분 DNS 대기였다).
        # 한 번 죽은 걸 확인했으면 유예시간 동안은 곧장 등록된 IP 로 간다.
        global _DNS_DEAD_UNTIL
        mine = str(node or "").lower() == host and bool(GATEWAY_IP)
        if mine and time.monotonic() < _DNS_DEAD_UNTIL:
            return original(GATEWAY_IP, port, *args, **kwargs)
        try:
            return original(node, port, *args, **kwargs)
        except socket.gaierror:
            if mine:
                _DNS_DEAD_UNTIL = time.monotonic() + _DNS_RECHECK_SECONDS
                global _DNS_FALLBACK_LOGGED
                if not _DNS_FALLBACK_LOGGED:      # 호출마다 찍으면 로그가 도배된다 — 처음 한 번만
                    _DNS_FALLBACK_LOGGED = True
                    logger.warning("[문서보안] 이름 풀이 실패 → 등록된 게이트웨이 IP(%s) 로 직접 연결합니다"
                                   " (%s). 항구적으로는 파드 hostAliases/사내 DNS 설정을 권합니다."
                                   " (이 메시지는 한 번만 나옵니다)", GATEWAY_IP, host)
                return original(GATEWAY_IP, port, *args, **kwargs)
            raise

    socket.getaddrinfo = _with_fallback
    _DNS_FALLBACK_INSTALLED = True
    return True


def check_gateway_reachable(timeout=3.0):
    """[시작 진단 2026-08-26] 게이트웨이까지 '갈 수 있는 상태인가'를 켤 때 한 번 확인한다.

    왜: 예전엔 켤 때 'keyCode 설정됨' 만 찍어서, 폐쇄망 서버에서 **DNS 가 안 풀려** 모든
    보안 해제가 실패하는데도 시작 화면은 멀쩡해 보였다(실측 — 원인 찾는 데 한참 걸렸다).
    이름 풀이 → TCP 연결 순서로 확인해, 어느 관문에서 막혔는지 켜자마자 보이게 한다.

    getaddrinfo/connect 는 망 상태에 따라 오래 붙잡을 수 있어 별도 스레드에 두고 기다린다
    (서버 기동이 이 검사 때문에 늦어지면 안 된다). 확인 실패도 서버를 죽이지 않는다.
    """
    from urllib.parse import urlsplit
    import socket
    import threading

    parts = urlsplit(GATEWAY_BASE_URL)
    host = parts.hostname or ""
    port = parts.port or (443 if parts.scheme == "https" else 80)
    proxy = (os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
             or os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy") or "").strip()
    out = {"host": host, "port": port, "proxy": proxy, "dns": None, "tcp": None}
    if not host:
        return out

    def _run():
        try:
            infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
            addrs = sorted({i[4][0] for i in infos})
            out["dns"] = {"ok": True, "addresses": addrs[:4]}
        except Exception as err:
            out["dns"] = {"ok": False, "error": "%s: %s" % (type(err).__name__, err)}
            return
        # 프록시를 쓰는 환경이면 게이트웨이로 직접 나가지 않으므로 직결 확인은 의미가 없다.
        if proxy:
            out["tcp"] = {"skipped": "프록시 사용 설정됨"}
            return
        try:
            with socket.create_connection((host, port), timeout=timeout):
                out["tcp"] = {"ok": True}
        except Exception as err:
            out["tcp"] = {"ok": False, "error": "%s: %s" % (type(err).__name__, err)}

    worker = threading.Thread(target=_run, name="drm-startup-check", daemon=True)
    worker.start()
    worker.join(timeout + 1.5)
    if worker.is_alive():
        out["dns"] = out["dns"] or {"ok": None, "error": "확인이 %.0f초 안에 안 끝남" % timeout}
    return out


def local_egress_info(dest_ip=None, port=443):
    """[방화벽 확인 2026-08-26] '게이트웨이로 나갈 때 이 서버가 쓰는 IP' 를 알아낸다.

    왜: 게이트웨이 허용 목록(-100 '허용되지 않은 IP')은 **서버의 출발지 IP** 기준인데,
    서버에 IP 가 여러 개거나 컨테이너면 어느 것을 등록해야 하는지 헷갈린다. 실제로
    보안팀에 엉뚱한 IP 를 알려 주고 "뚫었는데 왜 안 되지" 가 되기 쉽다.

    방법: 목적지로 UDP 소켓을 connect 해 커널이 고른 경로의 로컬 주소를 읽는다.
    UDP connect 는 패킷을 보내지 않으므로 방화벽 로그도 남기지 않고 즉시 끝난다.

    주의: 이건 '이 서버가 쓰는 주소'다. 중간에 NAT/프록시가 있으면 게이트웨이가 보는 주소는
    다를 수 있다 — 그건 이쪽에서 알 방법이 없어 안내로만 남긴다.
    """
    import socket
    out = {"routeIp": None, "hostname": "", "allIps": [], "error": ""}
    try:
        out["hostname"] = socket.gethostname()
    except Exception:
        pass
    # 이 서버가 가진 IP 들(참고용)
    try:
        infos = socket.getaddrinfo(out["hostname"] or socket.gethostname(), None)
        out["allIps"] = sorted({i[4][0] for i in infos if ":" not in i[4][0]})   # IPv4 위주
    except Exception:
        pass
    # DNS 가 막혀 게이트웨이 주소를 모를 때도 '기본 경로로 나갈 때 쓰는 IP' 는 알 수 있다.
    # 방화벽 등록 IP 를 지금 당장 대조해 봐야 하는 상황이라, 추정값이라도 먼저 보여준다.
    target, guessed = (dest_ip, False) if dest_ip else ("8.8.8.8", True)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect((target, int(port)))        # 실제 전송 없음 — 커널이 경로만 고른다
            out["routeIp"] = s.getsockname()[0]
            out["guessed"] = guessed              # True = 게이트웨이가 아닌 기본 경로 기준
        finally:
            s.close()
    except Exception as err:
        out["error"] = "%s: %s" % (type(err).__name__, err)
    return out


def format_gateway_check(info):
    """check_gateway_reachable 결과를 시작 로그 몇 줄로. 문제일 때 '무엇을 하면 되는지'까지 적는다."""
    host = info.get("host") or "(주소 미상)"
    dns = info.get("dns") or {}
    tcp = info.get("tcp") or {}
    lines = []
    if dns.get("ok") is True:
        lines.append("[문서보안] 이름 확인 OK — %s → %s" % (host, ", ".join(dns.get("addresses") or [])))
        if tcp.get("ok") is True:
            lines.append("[문서보안] 연결 확인 OK — 게이트웨이까지 도달합니다")
        elif tcp.get("skipped"):
            lines.append("[문서보안] 연결 확인 건너뜀 — %s (%s)" % (tcp["skipped"], info.get("proxy")))
        elif tcp.get("ok") is False:
            lines.append("[경고] 이름은 풀리는데 연결이 안 됩니다: %s" % tcp.get("error"))
            lines.append("       → 방화벽에서 %s:%s 아웃바운드를 열거나, 프록시가 필요하면"
                         " HTTPS_PROXY 를 설정하세요." % (host, info.get("port")))
    elif dns.get("ok") is False:
        lines.append("[경고] 게이트웨이 주소를 찾지 못합니다(DNS): %s" % dns.get("error"))
        lines.append("       이 상태로는 **보안 해제/적용이 전부 실패**합니다(업로드는 되지만 해제만 안 됨).")
        lines.append("       → 셋 중 하나로 해결하세요:")
        lines.append("         1) /etc/hosts 에 등록   echo '<게이트웨이IP>  %s' >> /etc/hosts" % host)
        lines.append("         2) 사내 DNS 지정        /etc/resolv.conf 의 nameserver 확인")
        lines.append("         3) 프록시 경유          HTTPS_PROXY=http://프록시:포트 로 실행")
        lines.append("       (컨테이너면 --add-host / --dns 또는 compose 의 extra_hosts 로 넣어야 유지됩니다)")
    else:
        lines.append("[문서보안] 게이트웨이 확인을 마치지 못했습니다: %s"
                     % (dns.get("error") or "원인 미상") + " (서버는 그대로 시작합니다)")
    return lines


ENVOY_ADMIN = (os.environ.get("ENVOY_ADMIN", "").strip() or "127.0.0.1:15000")


ENVOY_READ_CAP = 6 * 1024 * 1024        # 사이드카 /stats 는 수백 KB~수 MB 다
_ENVOY_TRUNCATED = {}


def _envoy_get(path, timeout=1.5):
    """[실측 2026-08-27] 예전엔 300KB 에서 잘랐다. 그런데 사이드카의 /stats · /clusters 는
    그보다 훨씬 크다 — 뒷부분이 잘려 나가 놓고 '그런 항목은 없다' 로 읽었다. **조용한 잘림이
    사실처럼 보이는 것**이 이 진단에서 가장 위험하다. 넉넉히 읽고, 잘렸으면 잘렸다고 남긴다.
    """
    try:
        with urllib.request.urlopen("http://%s%s" % (ENVOY_ADMIN, path), timeout=timeout) as resp:
            raw = resp.read(ENVOY_READ_CAP + 1)
    except Exception:
        return ""
    _ENVOY_TRUNCATED[path] = len(raw) > ENVOY_READ_CAP
    return raw[:ENVOY_READ_CAP].decode("utf-8", errors="replace")


def envoy_read_note(path):
    """그 조회가 잘렸는지 한 줄로. 안 잘렸으면 빈 문자열."""
    return ("  ← **%d MB 에서 잘렸습니다**(뒷부분은 못 봤습니다)" % (ENVOY_READ_CAP // (1024 * 1024))
            if _ENVOY_TRUNCATED.get(path) else "")


def _stat_value(line):
    try:
        return int(line.rsplit(":", 1)[1].strip())
    except Exception:
        return None


def mesh_counters():
    """사이드카가 이 연결을 어떻게 처리했는지 셈을 읽는다.

    [실측 2026-08-26] '사이드카가 있다' 까지는 쉽게 알 수 있지만, 그것만으로는 **범인인지**
    알 수 없다. 붙어 보는 동안 아래 숫자가 어떻게 움직이는지로 세 갈래가 갈린다:
      BlackHole 증가            → 메시가 막았다. 방화벽을 뚫어도 소용없다.
      Passthrough 증가 + 실패   → 메시는 내보냈는데 **바깥에서** 막혔다. 방화벽/보안장비다.
      아무 숫자도 안 움직임      → 이 연결은 사이드카를 거치지 않는다. 메시는 무관하다.
    숫자를 안 보고 '사이드카가 있으니 메시 탓' 이라고 적으면, 애먼 곳을 고치게 만든다.
    """
    from urllib.parse import quote
    keys = {
        "cluster.BlackHoleCluster.upstream_cx_total": "blackhole",
        "cluster.PassthroughCluster.upstream_cx_total": "passthrough",
        "cluster.PassthroughCluster.upstream_cx_connect_fail": "passFail",
        "cluster.PassthroughCluster.upstream_cx_connect_timeout": "passTimeout",
        "listener.0.0.0.0_15001.downstream_cx_total": "outbound",
    }
    out = dict.fromkeys(keys.values(), None)
    # [실측 2026-08-26] 서버측 filter 를 썼다가 이 Envoy(1.24) 에서 **한 줄도 안 걸렸다**.
    # 그런데 비어 있는 걸 '변화 없음' 으로 읽어 사이드카를 무죄로 오판했다. 남의 필터를 믿지
    # 않는다 — 통째로 받아 여기서 고른다(양이 커도 진단은 한 번뿐이다).
    txt = _envoy_get("/stats", timeout=4.0) or _envoy_get("/stats?filter=" + quote("cx_total"))
    for line in txt.split("\n"):
        name = line.split(":", 1)[0].strip()
        if name in keys:
            out[keys[name]] = _stat_value(line)
    # [실측 2026-08-26] 실제 파드에서 이 filter 가 하나도 안 걸렸다(사이드카 버전 차이).
    # 그런데 값이 None 인 채로 '변화 없음' 이라고 적어 **사이드카를 무죄로 오판**했다.
    # /clusters 는 같은 내용을 다른 모양으로 준다 — 못 읽은 항목만 그쪽에서 채운다.
    if all(v is None for v in out.values()):
        out.update({k: v for k, v in cluster_counters().items() if v is not None})
    return out


def cluster_counters(ip="", port=0):
    """/clusters 를 읽는다. 줄 모양: `클러스터::호스트:포트::통계::값`.

    ip 를 주면 그 목적지에 대한 것만 — **Envoy 가 실제로 밖까지 TCP 를 성공시켰는지**가
    여기 있다(cx_connect_fail 이 0 이면 나가는 연결 자체는 성공한 것이다).
    """
    txt = _envoy_get("/clusters", timeout=3.0)
    agg, dest = {}, {}
    want = ("%s:%s" % (ip, port)) if ip else ""
    for line in txt.split("\n"):
        parts = line.strip().split("::")
        if len(parts) < 3:
            continue
        try:
            val = int(parts[-1])
        except Exception:
            continue
        cluster, stat = parts[0], parts[-2]
        agg[(cluster, stat)] = agg.get((cluster, stat), 0) + val
        if want and want in line:
            dest[stat] = dest.get(stat, 0) + val
    if ip:
        return dest
    return {"blackhole": agg.get(("BlackHoleCluster", "cx_total")),
            "passthrough": agg.get(("PassthroughCluster", "cx_total")),
            "passFail": agg.get(("PassthroughCluster", "cx_connect_fail")),
            "passTimeout": agg.get(("PassthroughCluster", "upstream_cx_connect_timeout")),
            "outbound": None}


def mesh_info():
    """[실측 2026-08-26] 파드에 사이드카(Istio/Envoy)가 있으면 **밖으로 나가는 연결을 가로챈다**.

    왜 이걸 먼저 봐야 하나: 사이드카가 있으면 TCP 는 언제나 곧바로 성공한다 — 실제로는 옆에
    붙어 있는 Envoy 에 붙은 것이기 때문이다. 그래서 방화벽이 다 막혀 있어도 "TCP 연결 OK
    (0ms)" 로 보인다. 그 뒤 Envoy 가 바깥으로 못 나가면 TLS 핸드셰이크가 멈추고, 기본
    연결제한 10초가 지나면 RST 로 끊긴다 — 우리가 본 그 모습 그대로다.
    이걸 모르면 방화벽 신청을 하고 기다리게 되는데, 정작 패킷은 노드 밖으로 나간 적도 없다.

    KServe 로 띄운 파드(…-predictor-…)는 Istio 사이드카가 기본으로 붙는다. 접속 로그의
    출발지가 127.0.0.6 으로 찍히는 것도 사이드카가 있다는 표시다.
    """
    info = {"present": False, "adminOk": False, "version": "", "blackhole": None, "passthrough": None}
    txt = _envoy_get("/server_info")
    if txt:
        info["present"] = info["adminOk"] = True
        try:
            info["version"] = str(json.loads(txt).get("version") or "")[:60]
        except Exception:
            pass
        info.update(mesh_counters())
        return info
    # admin 이 막혀 있어도 흔적으로 알 수 있다
    if os.environ.get("ISTIO_META_WORKLOAD_NAME") or os.environ.get("ISTIO_META_MESH_ID"):
        info["present"] = True
    else:
        try:
            info["present"] = Path("/etc/istio/proxy").exists()
        except Exception:
            pass
    return info


def dns_is_dead():
    """이름 풀이가 죽어 있어 등록 IP 로 우회하는 중인가."""
    return bool(GATEWAY_IP) and time.monotonic() < _DNS_DEAD_UNTIL


def ssl_context(verify=True):
    """호출과 진단이 같은 TLS 설정을 쓰도록 한 곳에서 만든다."""
    ctx = ssl.create_default_context() if verify else ssl._create_unverified_context()
    if TLS_MAX_VERSION == "1.2":
        try:
            ctx.maximum_version = ssl.TLSVersion.TLSv1_2
        except Exception:
            pass
    return ctx


def _net_reason(err):
    """예외를 (코드, 쉬운 말, 원문) 으로. 코드마다 고칠 곳이 다르다."""
    text = "%s: %s" % (type(err).__name__, err)
    low = text.lower()
    if isinstance(err, socket.gaierror) or "getaddrinfo" in low or "errno -2" in low or "11001" in low:
        return "dns", "이름을 못 찾음", text
    if isinstance(err, ConnectionRefusedError) or "refused" in low or "10061" in low:
        return "refused", "연결 거부됨", text
    if isinstance(err, ConnectionResetError) or "reset by peer" in low or "10054" in low:
        return "reset", "상대가 연결을 끊음(RST)", text
    if isinstance(err, ssl.SSLError) or "sslerror" in low or "handshake" in low:
        return "tls", "TLS 협상 실패", text
    if isinstance(err, (TimeoutError, socket.timeout)) or "timed out" in low:
        return "timeout", "응답 없음(조용히 막힘)", text
    if "unreach" in low or "10051" in low:
        return "unreach", "가는 길이 없음", text
    return "network", "연결 실패", text


def _ms(t0):
    return int((time.monotonic() - t0) * 1000)


def _tls_detail(sock):
    try:
        ver, cipher = sock.version() or "?", (sock.cipher() or ("?",))[0]
    except Exception:
        ver, cipher = "?", "?"
    cn = ""
    try:
        for rdn in (sock.getpeercert() or {}).get("subject", ()):
            for k, v in rdn:
                if k == "commonName":
                    cn = v
    except Exception:
        pass
    return "%s / %s%s" % (ver, cipher, ("  인증서 %s" % cn) if cn else "")


def probe_gateway_stages(timeout=4.0):
    """[시작 진단 2026-08-26] 이름 풀이 → TCP → TLS → HTTP 를 **실제로 한 단계씩 밟는다**.

    왜 이렇게까지: 예전 점검은 이름 풀이만 확인하고 "게이트웨이 OK" 를 찍었다. 연결 확인은
    3초 안에 안 끝나면 결과가 버려졌는데 OK 줄은 그대로 남았다. 그래서 실제로는 모든 호출이
    실패하는 서버가 시작 화면상으로는 멀쩡해 보였다(실측). **확인하지 않은 것을 OK 라고 적으면
    그 줄이 그때부터 사람을 엉뚱한 곳으로 보낸다** — 못 밟은 단계는 '확인못함' 으로 남긴다.

    어느 관문에서 끊기느냐로 고칠 곳이 갈린다:
      TCP 무응답      → 방화벽이 **버림(drop)**. 출발지 IP 가 허용 목록에 없을 때 전형적이다.
      TCP 거부/RST    → 방화벽이 **거부(reject)** 했거나 그 IP:포트에 서비스가 없다(VIP 변경).
      TLS 에서 RST    → 포트는 열렸고 그 뒤 장비가 끊는다. SSL 검사 장비이거나, 구형 VIP 가
                        TLS 1.3 을 못 받는 경우다 — 그래서 1.2 로 한 번 더 붙어 본다.
      HTTP 응답 옴    → 망은 뚫렸다. 남은 문제는 파라미터·권한이다.

    서버 기동을 막지 않는다 — 별도 스레드에서 돌리고 제한시간이 지나면 그대로 둔다.
    """
    from urllib.parse import urlsplit
    import threading

    parts = urlsplit(GATEWAY_BASE_URL)
    host = parts.hostname or ""
    port = parts.port or (443 if parts.scheme == "https" else 80)
    path = parts.path or "/"
    secure = (parts.scheme or "https").lower() != "http"
    proxy = (os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
             or os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy") or "").strip()
    out = {"host": host, "port": port, "path": path, "proxy": proxy, "ip": "",
           "viaFallback": False, "needsTls12": False, "stages": [], "advice": [],
           "mesh": mesh_info()}

    def add(name, ok, ms=None, detail="", why="", code=""):
        out["stages"].append({"name": name, "ok": ok, "ms": ms,
                              "detail": detail, "why": why, "code": code})

    if not host:
        add("설정", False, None, "게이트웨이 주소(MIP_GATEWAY_BASE_URL)가 비어 있습니다", "주소 없음", "config")
        return out

    def _tls_connect(force12=False):
        sock = socket.create_connection((out["ip"], port), timeout=timeout)
        ctx = ssl.create_default_context() if VERIFY_TLS else ssl._create_unverified_context()
        if force12 or TLS_MAX_VERSION == "1.2":
            try:
                ctx.maximum_version = ssl.TLSVersion.TLSv1_2
            except Exception:
                pass
        try:
            return ctx.wrap_socket(sock, server_hostname=host)   # SNI·인증서는 호스트명 기준 유지
        except Exception:
            try:
                sock.close()
            except Exception:
                pass
            raise

    def _run():
        global TLS_MAX_VERSION
        t = time.monotonic()
        try:
            infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
            out["ip"] = sorted({i[4][0] for i in infos})[0]
        except Exception as err:
            code, why, text = _net_reason(err)
            add("이름 풀이", False, _ms(t), text, why, code)
            return
        out["viaFallback"] = dns_is_dead() and out["ip"] == GATEWAY_IP
        add("이름 풀이", True, _ms(t), "%s -> %s%s" % (
            host, out["ip"], "  (사내 DNS 가 없어 등록된 VIP 로 직접 연결 중)" if out["viaFallback"] else ""))

        if proxy:
            add("TCP 연결", None, None, "프록시(%s) 경유 설정 — 직접 연결은 확인하지 않음" % proxy)
            return

        before = mesh_counters() if out["mesh"].get("adminOk") else {}
        t = time.monotonic()
        try:
            socket.create_connection((out["ip"], port), timeout=timeout).close()
        except Exception as err:
            code, why, text = _net_reason(err)
            add("TCP 연결", False, _ms(t), text, why, code)
            return
        # 사이드카가 있으면 이 성공은 '옆의 Envoy 에 붙었다' 는 뜻일 수 있다 — 단정하지 않는다.
        via = "  (사이드카를 거칩니다 — 바깥까지 갔다는 뜻은 아닙니다)" if out["mesh"].get("present") else ""
        add("TCP 연결", True, _ms(t), "%s:%s 까지 열려 있음%s" % (out["ip"], port, via))

        t, conn = time.monotonic(), None
        if not secure:                               # http:// 주소면 TLS 단계 자체가 없다
            add("TLS 연결", None, None, "http:// 주소라 TLS 단계가 없습니다")
            try:
                conn = socket.create_connection((out["ip"], port), timeout=timeout)
            except Exception as err:
                code, why, text = _net_reason(err)
                add("HTTP 응답", False, _ms(t), text, why, code)
                return
        else:
            try:
                conn = _tls_connect()
                add("TLS 연결", True, _ms(t), _tls_detail(conn))
            except Exception as err:
                code, why, text = _net_reason(err)
                t2 = time.monotonic()
                try:
                    conn = _tls_connect(force12=True)
                except Exception as err2:
                    add("TLS 연결", False, _ms(t), "%s  (TLS 1.2 재시도도 실패: %s)"
                        % (text, _net_reason(err2)[2]), why, code)
                    _mesh_verdict(out, before)
                    return
                TLS_MAX_VERSION = "1.2"              # 되는 쪽으로 이후 호출을 맞춘다
                out["needsTls12"] = True
                add("TLS 연결", True, _ms(t2), _tls_detail(conn)
                    + "  <- 기본(1.3)은 끊겼고 **TLS 1.2 로는 됩니다**. 이후 호출은 1.2 로 보냅니다")

        _mesh_verdict(out, before)

        t = time.monotonic()
        try:
            conn.sendall(("HEAD %s HTTP/1.1\r\nHost: %s\r\nUser-Agent: AX-Cell-probe\r\n"
                          "Accept: */*\r\nConnection: close\r\n\r\n" % (path, host)).encode("ascii"))
            conn.settimeout(timeout)
            head = conn.recv(256).decode("latin-1", "replace").split("\r\n")[0].strip()
            if head.startswith("HTTP/"):
                add("HTTP 응답", True, _ms(t), head + "  <- 여기까지 왔으면 망은 뚫린 것입니다")
            else:
                add("HTTP 응답", False, _ms(t), head or "(빈 응답)", "HTTP 응답이 아님", "http")
        except Exception as err:
            code, why, text = _net_reason(err)
            add("HTTP 응답", False, _ms(t), text, why, code)
        finally:
            try:
                conn.close()
            except Exception:
                pass

    worker = threading.Thread(target=_run, name="drm-gateway-probe", daemon=True)
    worker.start()
    worker.join(timeout * 4 + 2)
    if worker.is_alive():
        add("진단", None, None, "제한시간 안에 못 끝냈습니다 — 서버는 그대로 시작합니다", "확인 못함", "slow")
    out["advice"] = _probe_advice(out)
    return out


def _mesh_verdict(out, before):
    """붙어 보는 동안 움직인 숫자로 사이드카의 역할을 확정한다(추측하지 않는다)."""
    mesh = out.get("mesh") or {}
    if not before or not mesh.get("adminOk"):
        return
    after = mesh_counters()
    mesh["before"], mesh["after"] = before, after

    def moved(key):
        a, b = after.get(key), before.get(key)
        return (a - b) if isinstance(a, int) and isinstance(b, int) else 0

    blocked = moved("blackhole")
    passed = moved("passthrough")
    failed = moved("passFail") + moved("passTimeout")
    touched = passed or blocked or moved("outbound")

    if blocked > 0:
        mesh["verdict"] = "blocked"
        row = (False, "사이드카가 막음",
               "Envoy 가 이 연결을 BlackHole 로 보냈습니다 (막은 연결 %s → %s)"
               % (before.get("blackhole"), after.get("blackhole")))
    elif failed > 0:
        mesh["verdict"] = "outside"
        row = (False, "사이드카 밖에서 막힘",
               "Envoy 는 바깥으로 나가려다 실패했습니다 (연결 실패 +%d) — 막는 쪽은 메시가 아닙니다" % failed)
    elif passed > 0:
        mesh["verdict"] = "passed"
        row = (True, "", "사이드카는 그대로 통과시켰습니다 (통과 +%d, 실패 0) — 막는 쪽은 메시가 아닙니다" % passed)
    elif touched:
        mesh["verdict"] = "handled"
        row = (True, "", "사이드카가 이 연결을 자기 규칙으로 처리했습니다 — 막는 쪽은 그 너머입니다")
    else:
        mesh["verdict"] = "bypassed"
        row = (None, "확인 못함",
               "사이드카를 거치지 않는 연결입니다(숫자 변화 없음) — 파드에서 곧장 나갑니다")
    out["stages"].append({"name": "서비스 메시", "ok": row[0], "ms": None,
                          "code": "mesh" if row[0] is False else "", "why": row[1], "detail": row[2]})


def _firewall_lines(out):
    """방화벽/보안장비 쪽으로 넘길 때 그대로 복사해 보낼 수 있게 적어 준다.

    왜 문장까지 만들어 주나: 여기서 나오는 값(파드 IP vs 노드 IP)을 잘못 옮겨 적으면 보안팀이
    엉뚱한 주소를 뚫는다. 실제로 파드 IP 를 그대로 전달할 뻔했다 — 그 IP 는 클러스터 밖에서
    아무 의미가 없다.
    """
    ip, port = out.get("ip") or "(미상)", out.get("port")
    codes = out.get("tlsCodes") or {}
    how = "끊깁니다(RST)" if "reset" in codes.values() else "응답이 없습니다"
    sni_note = []
    if codes.get("SNI 없이") and codes.get("기본(최대 1.3)") and \
            codes["SNI 없이"] != codes["기본(최대 1.3)"]:
        sni_note = ["    · 참고: **SNI(호스트명)를 실을 때와 안 실을 때 반응이 다릅니다**"
                    " (%s ↔ %s) — 중간 장비가 SNI 를 보고 판단하는 것으로 보입니다."
                    % (codes["기본(최대 1.3)"], codes["SNI 없이"])]
    return [
        "  보안팀에 넘길 때는 이렇게 적으세요 — 그대로 복사하셔도 됩니다:",
        "    · 목적지 %s:%s (%s) 로 TLS 핸드셰이크가 %s."
        % (ip, port, out.get("host"), how),
        "    · (TCP 연결은 성공한 것처럼 보이지만, 이 파드는 서비스 메시(Istio) 안이라"
        " 그 성공은 옆의 프록시에 붙은 것일 뿐 도달 증거가 아닙니다)",
    ] + sni_note + [
        "    · 출발지는 쿠버네티스 파드라 나갈 때 노드 IP 로 바뀝니다(SNAT)."
        " 파드 IP(%s)가 아니라 **노드 IP**(시작 점검의 '파드/노드' 줄) 기준으로"
        " 허용돼 있는지 확인 부탁드립니다." % (CLIENT_IP or "10.x.x.x"),
        "    · 파드는 재시작마다 다른 노드로 옮겨갈 수 있으니 **노드 풀 전체**로 열어 주세요.",
        "    · 확인 요청: 위 로그 시각에 TLS ClientHello 가 도착했는지, 차단/reset 여부",
    ]


def _probe_advice(out):
    """막힌 단계에 맞는 조치만 적는다(전부 나열하면 아무도 안 읽는다)."""
    bad = next((s for s in out["stages"] if s.get("ok") is False), None)
    tips = []
    ip, port = out.get("ip") or "(미상)", out.get("port")
    verdict = (out.get("mesh") or {}).get("verdict")
    if out.get("needsTls12"):
        tips.append("· TLS: 이 게이트웨이는 TLS 1.3 을 끊습니다. 지금은 서버가 알아서 1.2 로 보내지만,"
                    " 고정하려면 .env 에 MIP_TLS_MAX=1.2 를 넣어 두세요.")
    if not bad:
        return tips
    name, code = bad.get("name"), bad.get("code")
    if name == "이름 풀이":
        tips.append("· 이름 풀이 실패: .env 의 MIP_GATEWAY_IP 에 게이트웨이 VIP 를 넣으면 서버가 대신 풉니다"
                    " (지금 값: %s). 항구적으로는 파드 hostAliases 나 사내 DNS 가 맞습니다." % (GATEWAY_IP or "없음"))
        # DNS 해결법(hosts/사내DNS/프록시 + 컨테이너 주의)은 한 곳에만 적어 둔다 — 두 군데에
        # 나눠 적으면 한쪽만 고쳐져서 안내가 갈린다.
        tips.extend(format_gateway_check({"host": out.get("host"), "port": out.get("port"),
                                          "dns": {"ok": False, "error": bad.get("detail")}, "tcp": None}))
    elif name == "TCP 연결" and code in ("timeout", "unreach"):
        tips.append("· TCP 가 **조용히 막혔습니다**(응답 자체가 없음) — 방화벽이 버리는 전형적인 모습입니다.")
        tips.append("  목적지 %s:%s 로 가는 길과, 무엇보다 **출발지 IP** 를 확인하세요." % (ip, port))
        tips.append("  파드는 밖으로 나갈 때 노드 IP 로 바뀝니다(SNAT) — 파드 IP 로 뚫어 두면 이 증상입니다.")
    elif name == "TCP 연결":
        tips.append("· TCP 가 즉시 거부/초기화됐습니다 — 방화벽이 **거부(reject)** 했거나 그 주소에 서비스가 없습니다.")
        tips.append("  목적지 %s:%s 가 지금도 맞는 VIP 인지, 출발지 IP 허용 여부와 함께 확인하세요." % (ip, port))
    elif name == "서비스 메시" and verdict == "blocked":
        tips.append("· **사이드카(Istio)가 이 연결을 막았습니다** — Envoy 의 '막은 연결' 수가 올랐습니다.")
        tips.append("  방화벽 신청을 해도 소용이 없습니다 — 패킷이 노드 밖으로 나간 적이 없습니다.")
        tips.append("  운영에 아래 둘 중 하나를 요청하세요(파드 설정 변경입니다):")
        tips.append("    1) 파드 어노테이션 한 줄 — 이 주소만 사이드카를 건너뜁니다")
        tips.append('         traffic.sidecar.istio.io/excludeOutboundIPRanges: "%s/32"' % ip)
        tips.append("    2) ServiceEntry 등록 — 메시가 이 바깥 주소를 알게 합니다")
        tips.append("         hosts: [%s] / addresses: [%s/32] / ports: 443 TLS / MESH_EXTERNAL"
                    % (out.get("host"), ip))
    elif name == "서비스 메시":
        tips.append("· 사이드카는 이 연결을 막지 않았습니다(막은 연결 수가 그대로) — 메시 설정을 고쳐도 안 풀립니다.")
        tips.extend(_firewall_lines(out))
    elif name == "TLS 연결":
        tips.append("· TCP 는 열렸는데 TLS 에서 끊겼습니다 — 포트는 뚫려 있고 **그 뒤에서 막히는** 상황입니다.")
        if verdict == "blocked":
            tips.append("  범인은 사이드카입니다(아래 '서비스 메시' 항목을 보세요).")
        elif verdict in ("passed", "outside", "handled", "bypassed"):
            tips.append("  사이드카는 아닙니다 — 숫자로 확인했습니다(%s)." % verdict)
        elif (out.get("mesh") or {}).get("present"):
            tips.append("  ※ 이 파드엔 사이드카가 붙어 있어 TCP 가 0ms 로 붙는 건 옆의 Envoy 에 붙은 것일 수"
                        " 있습니다 — 바깥까지 갔다는 증거가 아닙니다.")
        if code == "timeout":
            tips.append("  TLS 는 **응답 자체가 없습니다**(조용히 버려짐). 거부(RST)가 아니라 drop 이라,"
                        " 방화벽·보안장비가 막을 때의 전형적인 모습입니다.")
            tips.extend(_firewall_lines(out))
        if code == "reset":
            tips.append("  흔한 원인: (1) SSL 검사 장비/IPS 가 정책에 안 맞는 세션을 끊음,"
                        " (2) 앞단이 이 출발지를 세션 단계에서 차단.")
            tips.append("  보안팀에는 '%s:%s 로 TCP 는 붙는데 TLS 핸드셰이크에서 RST 가 온다' 로 문의하면 빠릅니다."
                        % (ip, port))
        else:
            tips.append("  인증서 문제라면 사내 루트 CA 를 컨테이너에 넣으세요(권장)."
                        " 확인만 급하면 MIP_VERIFY_TLS=false 로 잠깐 볼 수 있습니다.")
    elif name == "HTTP 응답":
        tips.append("· TLS 까지 됐는데 HTTP 응답이 없습니다 — 경로(%s) 나 앞단 WAF 정책을 확인하세요."
                    % out.get("path"))
    return tips


# ── 예외 (Gateway 오류를 내부 오류와 구분한다) ─────────────────────────────

class MIPGatewayError(Exception):
    """Gateway 가 돌려준 오류.

    [사용자 지시 2026-08-26] result/result_msg 두 필드만 뽑아 쓰면 Gateway 가 함께 보낸 다른
    정보가 버려진다 — 규격에 없는 필드가 실려 와도 그게 원인 파악의 단서다. 받은 JSON 을
    payload 에 통째로 들고 다니다가 응답·로그에 **그대로** 실어 준다."""
    http_status = 502

    def __init__(self, result="", result_msg="", detail="", payload=None):
        self.result = str(result or "")
        self.result_msg = str(result_msg or "")
        self.payload = payload if isinstance(payload, dict) else None   # Gateway 원문(있을 때만)
        self.raw = ""                                                   # JSON 이 아니면 본문 앞부분
        super().__init__(detail or f"{self.result} {self.result_msg}".strip())


class MIPAuthenticationError(MIPGatewayError):   # -100
    http_status = 502


class MIPBusinessError(MIPGatewayError):         # -200 (부르는 쪽이 분기할 수 있어야 한다)
    http_status = 400


class MIPServerError(MIPGatewayError):           # -999 / 해석 불가 응답
    http_status = 502


class MIPNetworkError(MIPGatewayError):          # DNS/연결/타임아웃 — Gateway 까지 못 갔다
    http_status = 504

    def __init__(self, result="", result_msg="", detail="", kind="network"):
        # [실측 2026-08-26] 예전엔 이 계열을 전부 로그에 'timeout' 으로 찍었다. 실제 원인은
        # DNS 이름 풀이 실패([Errno -2] Name or service not known)였는데 "느려서 끊긴 것"으로
        # 읽혀 원인 추적이 한참 돌아갔다. 무엇 때문에 못 갔는지를 구분해서 남긴다.
        self.kind = kind                         # dns | timeout | network
        super().__init__(result, result_msg, detail)


def _classify_error(payload):
    """Gateway JSON 의 result 값으로 예외를 고른다. 오류가 아니면 None."""
    result = str((payload or {}).get("result", "")).strip()
    msg = str((payload or {}).get("result_msg", "")).strip()
    if result == "-100":
        exc = MIPAuthenticationError(result, msg, payload=payload)
        # [규격 v0.3 Error Code] "허용되지 않은 IP에서 호출하였습니다.{IP}" — 게이트웨이가
        # **자기가 본 출발지 IP** 를 메시지 끝에 붙여 준다. NAT 뒤에서는 이게 유일하게
        # 확실한 단서다("방화벽에 어느 IP 를 등록해야 하나"의 답). 뽑아서 따로 실어 준다.
        m = re.search(r"(\d{1,3}(?:\.\d{1,3}){3})", msg)
        if m:
            exc.seen_ip = m.group(1)
        return exc
    if result == "-200":
        return MIPBusinessError(result, msg, payload=payload)
    if result == "-999":
        return MIPServerError(result, msg, payload=payload)
    # 규격에 없는 음수/오류 코드도 그냥 통과시키지 않는다 — 원문을 실어 서버 오류로 올린다.
    if result.startswith("-"):
        return MIPServerError(result, msg or "규격에 없는 오류 코드", payload=payload)
    return None


# ── Gateway 클라이언트 ─────────────────────────────────────────────────────

def _clean_upload_filename(name):
    """multipart 헤더에 들어갈 파일명 — CR/LF/따옴표를 죽여 헤더 주입을 막고 경로를 떼어낸다."""
    text = str(name or "").replace("\r", "").replace("\n", "").replace('"', "'")
    return safe_filename(text, "upload.bin")


class MIPGatewayClient:
    """MIP Gateway HTTP 호출만 담당한다(비즈니스 로직 없음).

    반환은 두 갈래다 — 규격의 응답이 두 종류이기 때문:
      ("stream", 응답객체, 첫청크, 헤더dict)  파일 스트림(성공)
      ("json", dict)                          JSON (S_DOC/N_DOC/오류 등)
    오류 JSON 은 여기서 예외(MIP*Error)로 바꾼다."""

    CHUNK = 64 * 1024

    def __init__(self, base_url=None, api_key=None, timeout=None, verify_tls=None):
        self.base_url = (base_url or GATEWAY_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else API_KEY
        self.timeout = float(timeout if timeout is not None else TIMEOUT_SECONDS)
        self.verify_tls = VERIFY_TLS if verify_tls is None else bool(verify_tls)

    # 공개 메서드 — Gateway method 1:1
    def encrypt(self, data, filename, account, labelid=""):
        extra = {"labelid": labelid} if str(labelid or "").strip() else {}
        return self._request("drmEncryptAPI", data, filename, account, extra)

    def decrypt(self, data, filename, account):
        return self._request("drmDecryptAPI", data, filename, account)

    def secret(self, data, filename, account):
        kind, value = self._request("drmSecretAPI", data, filename, account)
        if kind != "json":
            # 규격상 secret 은 JSON 이다. 스트림이 오면 해석 불가로 취급한다.
            try:
                value[0].close()
            except Exception:
                pass
            raise MIPServerError(detail="drmSecretAPI 가 JSON 이 아닌 응답을 보냈습니다.")
        return value

    def policy(self, data, filename, account, decode_type):
        decode_type = str(decode_type or "").strip().lower()
        if decode_type not in ("encrypt", "decrypt"):
            raise ValueError("decodeType 은 encrypt 또는 decrypt 여야 합니다.")
        return self._request("drmPolicyAPI", data, filename, account, {"decodeType": decode_type})

    # 내부 공통 호출
    def _query(self, method, account, extra=None):
        """공통 parameter 를 한 곳에서 만든다(API 마다 중복 구현 금지).

        [규격 v0.3 대조 2026-08-26] 연동규격서의 필수 파라미터는 다섯이다:
        method / **ip** / keyCode / requestorAccount / policyGCode.
        `ip` 가 빠져 있었다 — 규격에 "업무시스템의 IP(Outbound NAT IP 가 있으면 그 IP)" 로
        명시돼 있고, 게이트웨이는 이 값과 API KEY 발급 시 등록한 IP 를 대조한다.
        빠지면 -200 '필수 파라미터 항목이 누락되었습니다' 또는 -100 이 난다.
        """
        from urllib.parse import urlencode
        params = {
            "method": method,
            "ip": str(CLIENT_IP or "").strip(),
            "keyCode": self.api_key,
            "requestorAccount": str(account or "").strip(),
            "policyGCode": POLICY_G_CODE,
        }
        for key, value in (extra or {}).items():
            params[key] = str(value)
        return urlencode(params)

    def _multipart(self, data, filename):
        boundary = "----axcell%s" % uuid.uuid4().hex
        name = _clean_upload_filename(filename)
        head = (
            "--%s\r\n"
            'Content-Disposition: form-data; name="file"; filename="%s"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n" % (boundary, name)
        ).encode("utf-8")
        tail = ("\r\n--%s--\r\n" % boundary).encode("utf-8")
        # urllib 은 Content-Length 가 필요해 요청 본문은 메모리에 통째로 만든다(규격상 multipart 불가피).
        # 응답 쪽은 스트리밍으로 흘려 메모리를 아낀다. 요청 크기는 MAX_FILE_MB 로 이미 막았다.
        return boundary, head + bytes(data) + tail

    def _request(self, method, data, filename, account, extra=None):
        if not self.api_key:
            raise MIPServerError(detail="MIP_API_KEY 가 설정되지 않았습니다.")
        account = str(account or "").strip() or DEFAULT_ACCOUNT
        if not account:
            raise ValueError("requestorAccount 가 필요합니다(요청 값도, 서버 기본값도 없습니다).")

        url = "%s?%s" % (self.base_url, self._query(method, account, extra))
        boundary, body = self._multipart(data, filename)
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Content-Type": "multipart/form-data; boundary=%s" % boundary,
            "Accept": "*/*",
        })
        ctx = ssl_context(self.verify_tls)
        try:
            resp = urllib.request.urlopen(req, timeout=self.timeout, context=ctx)
        except urllib.error.HTTPError as err:
            # HTTP 4xx/5xx — 본문이 Gateway JSON 오류일 수 있으니 먼저 해석한다.
            raw = b""
            try:
                raw = err.read()
            except Exception:
                pass
            payload = self._try_json(raw)
            if payload is not None:
                exc = _classify_error(payload)
                if exc:
                    raise exc from err
                # 오류 코드로는 분류가 안 되지만 JSON 은 왔다 — 그 원문을 그대로 실어 올린다.
                raise MIPServerError(detail="Gateway HTTP %s" % err.code, payload=payload) from err
            exc = MIPServerError(detail="Gateway HTTP %s" % err.code)
            exc.raw = bytes(raw).decode("utf-8", errors="replace")   # 게이트웨이가 준 본문 보존
            raise exc from err
        except (TimeoutError, OSError, urllib.error.URLError) as err:
            reason = getattr(err, "reason", err)
            text = str(reason)
            from urllib.parse import urlsplit
            host = urlsplit(self.base_url).hostname or "(주소미상)"
            # [실측 2026-08-26] 폐쇄망 서버에서 'Name or service not known'(리눅스 Errno -2,
            # 윈도우 11001)이 났는데 로그가 timeout 으로 보여 "게이트웨이가 느린가" 로 헤맸다.
            # 이건 '느려서 끊긴 것'이 아니라 **이름을 못 찾은 것** — 고칠 곳이 완전히 다르다.
            if ("getaddrinfo" in text or "Name or service not known" in text
                    or "nodename nor servname" in text or "11001" in text or "Errno -2" in text):
                raise MIPNetworkError(kind="dns", detail=(
                    "Gateway 주소를 찾지 못했습니다(DNS 실패): %s → %s. "
                    "서버에서 `getent hosts %s` 로 이름이 풀리는지 확인하세요. "
                    "폐쇄망이면 /etc/hosts 등록이나 사내 DNS·프록시(HTTPS_PROXY) 설정이 필요합니다."
                    % (host, reason, host))) from err
            # [실측 2026-08-26] RST(Errno 104)를 'network' 로 뭉뚱그리면 방화벽이 **끊은** 것과
            # 아예 못 간 것이 구분되지 않는다. 끊긴 것은 대개 출발지 IP 미허용이라 고칠 곳이 다르다.
            kind = _net_reason(reason if isinstance(reason, BaseException) else err)[0]
            if kind in ("refused", "unreach"):
                kind = "network"
            extra = ""
            if kind == "reset":
                extra = (" — 상대가 연결을 끊었습니다. 포트까지는 갔다는 뜻이라 대개 **출발지 IP 미허용**"
                         " 이거나 보안장비의 세션 차단입니다. 시작 점검의 '나가는 IP' 를 보안팀에 확인하세요.")
            raise MIPNetworkError(kind=kind,
                                  detail="Gateway 에 연결하지 못했습니다(%s): %s%s"
                                         % (host, reason, extra)) from err

        content_type = str(resp.headers.get("content-type") or "").lower()
        first = resp.read(self.CHUNK)

        if "json" in content_type or (first[:1] == b"{" and len(first) < self.CHUNK):
            # JSON 응답(비밀문서 판별/오류). content-type 이 엉성한 게이트웨이도 있어 본문 모양도 본다.
            raw = first + resp.read()
            resp.close()
            payload = self._try_json(raw)
            if payload is None:
                # JSON 이 아니면(HTML 오류 페이지·게이트웨이 안내문 등) 본문 앞부분을 그대로 넘긴다.
                exc = MIPServerError(detail="Gateway 응답을 JSON 으로 읽지 못했습니다(본문은 rawBody 참고)")
                exc.raw = bytes(raw).decode("utf-8", errors="replace")
                raise exc
            exc = _classify_error(payload)
            if exc:
                raise exc
            return "json", payload

        if not first:
            # 빈 파일 스트림 — 그대로 저장하면 0바이트 문서가 되므로 오류로 끊는다(규격 18-9).
            resp.close()
            raise MIPServerError(detail="Gateway 가 빈 파일을 돌려주었습니다.")
        headers = {
            "content-disposition": str(resp.headers.get("content-disposition") or ""),
            "content-length": str(resp.headers.get("content-length") or ""),
        }
        return "stream", (resp, first, headers)

    @staticmethod
    def _try_json(raw):
        try:
            value = json.loads(bytes(raw).decode("utf-8", errors="replace"))
            return value if isinstance(value, dict) else None
        except Exception:
            return None


# ── FastAPI 라우터 ────────────────────────────────────────────────────────


# ── 심층 진단 ──────────────────────────────────────────────────────
# [사용자 지시 2026-08-26] 폐쇄망 서버라 파일 한 번 올리는 것 자체가 큰 일이다. "이것도 찍어
# 볼까요" 를 반복하면 그때마다 반나절이 간다. **한 번에 모든 갈래를 찍는다** — 안 막힌 것까지
# 함께 보여 줘야 어디까지 정상인지가 드러나고, 다음에 무엇을 물어볼지 정할 수 있다.
# 그리고 /api/drm/diagnose 로 **재시작 없이** 다시 볼 수 있게 한다.
#
# 원칙 두 가지:
#   · 확인 못 한 것은 '확인못함' 으로 적는다. 모르는 것을 안다고 적으면 사람을 엉뚱한 데로 보낸다.
#   · keyCode·파일 내용은 절대 찍지 않는다(길이·앞 4자리만).

def _safe(fn, default="(확인 못함)"):
    try:
        return fn()
    except Exception as err:
        return "%s: %s" % (type(err).__name__, err)


def _read_text(path, limit=1200):
    try:
        return Path(path).read_text("utf-8", errors="replace")[:limit].strip()
    except Exception as err:
        return "(못 읽음: %s)" % type(err).__name__


def _host_helpers():
    """main.py 의 환경 판별을 그대로 쓴다(두 벌로 나눠 적으면 결과가 갈린다)."""
    mod = sys.modules.get("main") or sys.modules.get("__main__")
    out = {}
    for fn in ("detect_container", "read_nameservers", "k8s_pod_info"):
        f = getattr(mod, fn, None)
        out[fn] = _safe(f, None) if callable(f) else None
    return out


def _clienthello(host):
    """손으로 만든 최소 TLS 1.2 ClientHello.

    왜 필요한가: 파이썬 ssl 은 실패를 'handshake timed out' 한 줄로만 알려준다. 그러면
    **한 바이트도 안 온 것(조용히 버려짐 = 방화벽 drop)** 과 **거절 신호가 온 것(Alert)** 을
    구분할 수 없다. 둘은 고칠 곳이 완전히 다르다. 직접 보내고 첫 바이트를 본다.
    """
    try:
        name = (host or "").encode("idna")
    except Exception:
        name = (host or "").encode("ascii", "ignore")
    sni_list = b"\x00" + struct.pack(">H", len(name)) + name
    ext_sni = b"\x00\x00" + struct.pack(">H", len(sni_list) + 2) + struct.pack(">H", len(sni_list)) + sni_list
    ext_groups = b"\x00\x0a" + struct.pack(">H", 6) + struct.pack(">H", 4) + b"\x00\x17\x00\x18"
    ext_points = b"\x00\x0b" + struct.pack(">H", 2) + b"\x01\x00"
    exts = ext_sni + ext_groups + ext_points
    ciphers = b"\xc0\x2f\xc0\x30\x00\x9c\x00\x2f"
    body = (b"\x03\x03" + (b"\x2a" * 32) + b"\x00"
            + struct.pack(">H", len(ciphers)) + ciphers + b"\x01\x00"
            + struct.pack(">H", len(exts)) + exts)
    hs = b"\x01" + struct.pack(">I", len(body))[1:] + body
    return b"\x16\x03\x01" + struct.pack(">H", len(hs)) + hs


def _first_bytes_probe(ip, port, host, timeout=5.0):
    """ClientHello 를 보내고 **무엇이 돌아오는지** 본다 — 침묵인지 거절인지."""
    try:
        sock = socket.create_connection((ip, port), timeout=timeout)
    except Exception as err:
        return "tcpfail", "TCP 부터 실패 — " + _net_reason(err)[2]
    try:
        sock.sendall(_clienthello(host))
        sock.settimeout(timeout)
        data = sock.recv(16)
        if not data:
            return "silent", ("0바이트 — 상대가 아무 말 없이 끊었습니다."
                              " 방화벽/보안장비가 **조용히 버릴 때(drop)** 의 모습입니다")
        meaning = {0x16: ("serverhello", "ServerHello 도착 — 게이트웨이의 TLS 는 살아 있습니다"),
                   0x15: ("alert", "TLS 거절(Alert) — 상대가 **명시적으로** 거절했습니다(정책/인증서 협상)"),
                   0x03: ("http", "HTTP 응답처럼 보입니다 — 이 포트가 TLS 가 아닐 수 있습니다")}
        code, why = meaning.get(data[0], ("other", "알 수 없는 응답"))
        # 판정이 틀려도 사람이 직접 읽을 수 있게 원문(16진수)을 남긴다.
        return code, "%d바이트 수신 [%s] — %s" % (
            len(data), " ".join("%02x" % b for b in data[:16]), why)
    except Exception as err:
        code = _net_reason(err)[0]
        if code == "timeout":
            return "silent", ("응답 없음(%.0f초) — ClientHello 를 보냈는데 한 바이트도 안 옵니다."
                              " 조용히 버려지는 중입니다" % timeout)
        if code == "reset":
            return "reset", "상대가 연결을 끊었습니다(RST) — 명시적 차단입니다"
        return code, "%s — %s" % (_net_reason(err)[1], _net_reason(err)[2])
    finally:
        try:
            sock.close()
        except Exception:
            pass


def _plain_http_probe(ip, port, host, timeout=4.0):
    """443 에 **평문** HTTP 를 던져 본다. 응답이 오면 그 포트는 TLS 가 아니다(프록시일 수 있다)."""
    try:
        sock = socket.create_connection((ip, port), timeout=timeout)
    except Exception as err:
        return "TCP 부터 실패 — " + _net_reason(err)[1]
    try:
        sock.sendall(("GET / HTTP/1.0\r\nHost: %s\r\n\r\n" % host).encode("ascii"))
        sock.settimeout(timeout)
        data = sock.recv(80)
        if not data:
            return "응답 없음 (TLS 전용 포트라면 정상입니다)"
        return "평문 응답이 왔습니다: %r  ← 이 포트는 TLS 가 아닐 수 있습니다" % data[:60]
    except Exception as err:
        return "응답 없음 — %s (TLS 전용 포트라면 정상입니다)" % _net_reason(err)[1]
    finally:
        try:
            sock.close()
        except Exception:
            pass


def _tcp_try(ip, port, timeout=4.0, label=""):
    t = time.monotonic()
    try:
        socket.create_connection((ip, port), timeout=timeout).close()
        return "OK  (%dms)" % _ms(t)
    except Exception as err:
        return "실패 (%dms) — %s" % (_ms(t), _net_reason(err)[1])


def _tls_try_variants(ip, port, host, timeout=5.0):
    """TLS 를 조건을 바꿔 가며 붙여 본다 — 무엇 때문에 안 되는지 좁히려고."""
    out = []
    # SNI 를 바꿔 가며 본다. 정상/없음/엉뚱한 이름의 반응이 갈리면 **중간 장비가 SNI 를 보고
    # 판단**하는 것이다(허용목록인지 차단목록인지까지 갈린다). 단순 방화벽은 이렇게 안 갈린다.
    for label, maxver, sni in (("기본(최대 1.3)", None, host),
                               ("TLS 1.2 고정", "1.2", host),
                               ("SNI 없이", None, None),
                               ("다른 SNI", None, "example.com")):
        t = time.monotonic()
        sock = None
        try:
            sock = socket.create_connection((ip, port), timeout=timeout)
            ctx = ssl._create_unverified_context()        # 진단은 검증 실패와 연결 실패를 나눠 본다
            if maxver == "1.2":
                ctx.maximum_version = ssl.TLSVersion.TLSv1_2
            wrapped = ctx.wrap_socket(sock, server_hostname=sni)
            out.append((label, "OK (%dms) — %s" % (_ms(t), _tls_detail(wrapped)), "ok"))
            try:
                wrapped.close()
            except Exception:
                pass
            sock = None
        except Exception as err:
            out.append((label, "실패 (%dms) — %s" % (_ms(t), _net_reason(err)[2][:120]),
                        _net_reason(err)[0]))
        finally:
            if sock is not None:
                try:
                    sock.close()
                except Exception:
                    pass
    return out


def _envoy_lines_about(needle, limit=12):
    """Envoy 가 이 목적지를 아는지 — 클러스터 목록에서 찾아본다."""
    txt = _envoy_get("/clusters", timeout=3.0)
    if not txt:
        return []
    hits = [l.strip() for l in txt.split("\n") if needle and needle in l]
    return hits[:limit]


def envoy_stat_lines(*needles, **kw):
    """Envoy stats 에서 관심 있는 줄만. 서버측 filter 를 안 쓰므로 버전을 안 탄다."""
    limit = kw.get("limit", 40)
    txt = _envoy_get("/stats", timeout=4.0)
    if not txt:
        return []
    hits = [l.strip() for l in txt.split("\n")
            if l.strip() and any(n in l for n in needles)]
    out = hits[:limit]
    if _ENVOY_TRUNCATED.get("/stats"):
        out.append("(주의: /stats 를 다 못 읽었습니다 — 없는 항목이 '없다' 는 뜻이 아닙니다)")
    return out


def proc_listeners():
    """/proc/net/tcp 로 이 컨테이너 안에서 **무엇이 듣고 있는지** 본다.

    사이드카 관리포트가 막혀 있어도, 15001(나가는 것 가로채기)/15006(들어오는 것)이 떠 있으면
    사이드카가 있는 것이다. 명령 하나 못 치는 환경이라 /proc 로 대신 본다.
    """
    ports = set()
    for name in ("/proc/net/tcp", "/proc/net/tcp6"):
        try:
            for line in Path(name).read_text("utf-8", errors="replace").split("\n")[1:]:
                cols = line.split()
                if len(cols) > 3 and cols[3] == "0A":          # 0A = LISTEN
                    ports.add(int(cols[1].split(":")[1], 16))
        except Exception:
            pass
    return sorted(ports)


def default_route():
    """파드의 기본 게이트웨이(= 노드 쪽 주소). 노드 IP 는 아니지만 어느 대역인지는 알려 준다."""
    try:
        for line in Path("/proc/net/route").read_text("utf-8", errors="replace").split("\n")[1:]:
            cols = line.split()
            if len(cols) > 2 and cols[1] == "00000000":
                raw = int(cols[2], 16)
                return "%d.%d.%d.%d" % (raw & 0xFF, (raw >> 8) & 0xFF,
                                        (raw >> 16) & 0xFF, (raw >> 24) & 0xFF)
    except Exception:
        pass
    return ""


def interesting_env():
    """진단에 쓸 환경변수만. 비밀은 이름만 남기고 값은 가린다."""
    out = []
    for k in sorted(os.environ):
        up = k.upper()
        if not (up.startswith(("ISTIO", "KUBERNETES", "MIP_", "ENVOY", "POD_", "NODE_", "HOST"))
                or "PROXY" in up):
            continue
        val = os.environ[k]
        if any(w in up for w in ("KEY", "TOKEN", "SECRET", "PASSWORD", "PASS")):
            val = "(가림, %d자)" % len(val)
        out.append("%s=%s" % (k, val[:120]))
    return out


def deep_diagnose(timeout=5.0, do_call=True):
    """막힌 곳을 찾기 위해 **볼 수 있는 것을 한 번에 다 본다**. 줄 목록으로 돌려준다.

    [사용자 지시 2026-08-27] 폐쇄망이라 한 번 올리는 비용이 크다. 진단이 중간에 예외로 죽으면
    그 회차가 통째로 날아가고 또 올려야 한다 — 그래서 **모아 둔 데까지는 무조건 돌려준다**.
    """
    L = []
    try:
        _deep_body(L, timeout, do_call)
    except Exception as err:
        L.append("")
        L.append("   [진단이 중간에 멈췄습니다 — 위 내용까지는 유효합니다] %s: %s"
                 % (type(err).__name__, err))
        for line in traceback.format_exc().split("\n")[-12:]:
            if line.strip():
                L.append("   " + line[:150])
    return L


def _deep_body(L, timeout=5.0, do_call=True):
    from urllib.parse import urlsplit

    def head(title):
        L.append("")
        L.append("── %s " % title + "─" * max(0, 58 - len(title)))

    def row(label, value):
        L.append("   %-22s %s" % (label, value))

    parts = urlsplit(GATEWAY_BASE_URL)
    host = parts.hostname or ""
    port = parts.port or (443 if parts.scheme == "https" else 80)
    # [실측 2026-08-26] 결론을 '위에 찍힌 글자 찾기' 로 내면 안 된다. 다른 항목의 문구가 걸려
    # DNS 부터 실패한 상황에 "TLS 응답이 없다" 는 엉뚱한 결론이 나왔다(진단이 거짓말을 한 셈).
    # 확인한 것만 여기에 담고, 결론은 이 표만 보고 낸다.
    facts = {"dns": None, "tcp": None, "tlsOk": None, "first": "", "call": "skip",
             "meshBlocked": False, "meshPresent": False, "tcpMeaningless": False,
             "envoyTried": None, "envoyFailed": None}
    env = _host_helpers()
    k8s = env.get("k8s_pod_info") or {}

    L.append("")
    L.append("════════ 심층 진단 ════════")
    L.append("   막힌 곳을 한 번에 찾기 위해, 되는 것까지 전부 확인합니다.")
    L.append("   (재시작 없이 다시 보기:  http://<서버>:8080/api/drm/diagnose )")
    L.append("   더 궁금한 게 생기면 파일을 다시 올리지 말고 아래 주소를 여세요:")
    L.append("     · 다른 주소도 찔러보기  /api/drm/probe?target=172.28.11.30:443")
    L.append("     · 사이드카에게 직접 묻기 /api/drm/envoy?what=clusters&find=172.28.11.30")

    head("A. 실행 환경")
    row("파이썬", "%s / %s" % (sys.version.split()[0], sys.platform))
    row("컨테이너", env.get("detect_container") or "아님(또는 확인 못함)")
    if k8s:
        row("파드", "%s  (네임스페이스 %s%s)"
            % (k8s.get("podName") or "?", k8s.get("namespace") or "모름",
               " ← %s" % k8s["namespaceSource"] if k8s.get("namespaceSource") else ""))
        row("파드 IP", k8s.get("podIp") or "(모름)")
        row("노드", "%s / %s  [%s]" % (k8s.get("nodeName") or "모름", k8s.get("nodeIp") or "모름",
                                       k8s.get("nodeSource") or "확인 못함"))
        if k8s.get("nodeError"):
            row("노드를 모르는 이유", str(k8s["nodeError"])[:120])
            row("→ 그럼 어떻게 아나", "운영에  kubectl get pod %s -o wide  를 부탁하세요"
                % (k8s.get("podName") or "<파드>"))
        row("→ 방화벽 출발지", (k8s.get("nodeIp") or "**노드 IP 를 아직 모릅니다**")
            + "   (파드 IP 가 아닙니다)")

    head("B. 네트워크 기본")
    eg = _safe(lambda: local_egress_info(GATEWAY_IP or None, port), {})
    if isinstance(eg, dict):
        row("게이트웨이로 나갈 때", eg.get("routeIp") or "(모름)")
        row("이 서버의 모든 IP", ", ".join(eg.get("allIps") or []) or "(모름)")
    row("보낼 ip 파라미터", CLIENT_IP or "(비어 있음 — 자동 감지값을 씁니다)")
    row("DNS 서버", ", ".join(env.get("read_nameservers") or []) or "(없음)")
    hosts = [l for l in _read_text("/etc/hosts").split("\n") if host and host in l]
    row("/etc/hosts 등록", hosts[0] if hosts else "(없음 — 서버가 이름을 대신 풉니다)")
    row("이름 풀이 상태", "죽어 있어 등록 IP 로 우회 중" if dns_is_dead() else "정상 또는 미확인")
    for name in ("HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "no_proxy"):
        if os.environ.get(name):
            row(name, os.environ[name])
    row("기본 게이트웨이", default_route() or "(못 읽음)")
    row("TLS 상한 설정", TLS_MAX_VERSION or "자동")
    for i, line in enumerate(_read_text("/etc/resolv.conf", 400).split("\n")[:6]):
        if line.strip():
            row("resolv.conf" if i == 0 else "", line.strip()[:100])
    for line in interesting_env()[:24]:
        row("env" if line.startswith("ISTIO") or True else "", line)
    # 키 자체는 어떤 형태로도 찍지 않는다 — '같은 키인지' 만 알면 되므로 지문으로 대신한다.
    import hashlib
    row("문서보안 키", ("설정됨 (%d자, 지문 %s)"
                        % (len(API_KEY), hashlib.sha256(API_KEY.encode()).hexdigest()[:8]))
        if API_KEY else "**없음**")

    head("C. 사이드카(Envoy)")
    mesh = mesh_info()
    facts["meshPresent"] = bool(mesh.get("present"))
    if not mesh.get("present"):
        row("사이드카", "없음 — 이 파드에서 바로 나갑니다")
    else:
        row("사이드카", "있음 %s" % (mesh.get("version") or ""))
        row("관리포트", ENVOY_ADMIN + (" 응답 OK" if mesh.get("adminOk") else " **응답 없음**(막혀 있음)"))
        if mesh.get("adminOk"):
            c = mesh_counters()
            row("막은 연결(BlackHole)", c.get("blackhole"))
            row("통과(Passthrough)", "%s (실패 %s / 시간초과 %s)"
                % (c.get("passthrough"), c.get("passFail"), c.get("passTimeout")))
            row("나가는 리스너 15001", c.get("outbound"))
            L.append("   ※ 값이 None 이면 그 항목을 못 읽은 것입니다(사이드카 종류/버전 차이).")
            dest = cluster_counters(GATEWAY_IP, port) if GATEWAY_IP else {}
            if dest:
                facts["envoyTried"] = dest.get("cx_total")
                facts["envoyFailed"] = dest.get("cx_connect_fail")
                row("Envoy 가 본 이 목적지",
                    "TCP 시도 %s회 / 연결실패 %s회 / 지금 열림 %s개"
                    % (dest.get("cx_total"), dest.get("cx_connect_fail"), dest.get("cx_active")))
                if dest.get("cx_total") and not dest.get("cx_connect_fail"):
                    L.append("   → Envoy 는 게이트웨이까지 **TCP 연결에 성공**했습니다(실패 0회)."
                             " 사이드카 밖으로는 나갔다는 뜻입니다.")
            else:
                row("Envoy 가 본 이 목적지", "아직 비어 있습니다 — Envoy 는 처음 붙을 때 만듭니다."
                                             " **아래 D-7 을 보세요**(붙어본 뒤에 다시 읽습니다)")
            # 판정이 틀려도 사람이 직접 읽을 수 있게 **원문**을 남긴다(되물을 수 없는 환경이다).
            for hit in envoy_stat_lines("BlackHoleCluster", "PassthroughCluster",
                                        "listener.0.0.0.0_1500", limit=14):
                row("  stats", hit[:110])
    listening = proc_listeners()
    if listening:
        marks = [p for p in (15001, 15006, 15000, 15021) if p in listening]
        row("이 컨테이너가 듣는 포트", ", ".join(str(p) for p in listening[:14])
            + ("   ← 사이드카 포트 %s 확인" % marks if marks else ""))

    head("D. 게이트웨이까지 단계별")
    row("주소", "%s  →  %s:%s" % (GATEWAY_BASE_URL, GATEWAY_IP or "(이름 풀이)", port))
    before = mesh_counters() if mesh.get("adminOk") else {}
    t = time.monotonic()
    ip = ""
    try:
        ip = sorted({i[4][0] for i in socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)})[0]
        facts["dns"] = True
        row("1) 이름 풀이", "%s → %s  (%dms)" % (host, ip, _ms(t)))
    except Exception as err:
        facts["dns"] = False
        row("1) 이름 풀이", "실패 — %s" % _net_reason(err)[2])
    if ip:
        tcp_res = _tcp_try(ip, port, timeout)
        facts["tcp"] = tcp_res.startswith("OK")
        row("2) TCP %s:%s" % (ip, port), tcp_res)
        variants = _tls_try_variants(ip, port, host, timeout)
        facts["tlsOk"] = any(c == "ok" for _, _, c in variants)
        # SNI 를 줬을 때와 안 줬을 때 반응이 갈리면, 중간 장비가 **SNI 를 보고 판단**하는 것이다.
        facts["tlsCodes"] = {label: c for label, _, c in variants}
        for label, res, _ in variants:
            row("3) TLS %s" % label, res)
        facts["first"], first_text = _first_bytes_probe(ip, port, host, timeout)
        row("4) 첫 응답 바이트", first_text)
        row("5) 평문 HTTP 반응", _plain_http_probe(ip, port, host, min(timeout, 4.0)))
        # 한 번은 우연일 수 있다 — 같은 시험을 한 번 더 해서 재현되는지 본다.
        second = _tls_try_variants(ip, port, host, timeout)
        same = all(a[2] == b[2] for a, b in zip(variants, second))
        row("5-2) 한 번 더 해보면",
            ("같은 결과가 재현됩니다 (%s)" if same else "**결과가 달라집니다** (%s)")
            % ", ".join("%s=%s" % (l, c) for l, _, c in second))
        facts["reproducible"] = same
    if before:
        after = mesh_counters()
        moved = {k: (after.get(k), before.get(k)) for k in before
                 if isinstance(after.get(k), int) and isinstance(before.get(k), int)
                 and after[k] != before[k]}
        facts["meshBlocked"] = "blackhole" in moved
        readable = [k for k in before if isinstance(before.get(k), int)]
        if not readable:
            # 못 읽은 것을 '변화 없음' 이라고 쓰면 사이드카가 무죄로 읽힌다 — 실제로 그렇게 오판했다.
            row("6) 사이드카 셈 변화", "**읽지 못했습니다** — 아래 'Envoy 가 본 이 목적지' 로 판단하세요")
        else:
            row("6) 사이드카 셈 변화", ", ".join("%s %s→%s" % (k, v[1], v[0]) for k, v in moved.items())
                or "변화 없음(읽은 항목: %s)" % ", ".join(readable))
    # [실측 2026-08-26] C 에서 읽었더니 늘 비어 있었다 — Envoy 는 **처음 붙을 때** 그 목적지의
    # 클러스터를 만든다. 붙어보기 전에 물으면 당연히 '없습니다' 다. 그래서 여기서 다시 읽는다.
    # 이 값이 이 진단에서 제일 중요하다: 사이드카가 밖으로 나가는 데 성공했는지가 여기 있다.
    if mesh.get("adminOk") and ip:
        after_dest = cluster_counters(ip, port)
        if after_dest:
            facts["envoyTried"] = after_dest.get("cx_total")
            facts["envoyFailed"] = after_dest.get("cx_connect_fail")
            row("7) 사이드카가 실제로 한 일",
                "이 목적지로 TCP 시도 %s회 / 연결실패 %s회 / 지금 열림 %s개"
                % (after_dest.get("cx_total"), after_dest.get("cx_connect_fail"),
                   after_dest.get("cx_active")))
            if after_dest.get("cx_total") and not after_dest.get("cx_connect_fail"):
                L.append("   → 사이드카는 게이트웨이까지 **TCP 연결에 성공**했습니다"
                         " — 패킷은 노드 밖으로 나갔습니다.")
            elif after_dest.get("cx_connect_fail"):
                L.append("   → 사이드카가 **밖으로 못 나갔습니다**(연결 실패 %s회)"
                         " — 막는 쪽은 메시가 아니라 그 너머입니다." % after_dest.get("cx_connect_fail"))
        else:
            row("7) 사이드카가 실제로 한 일", "붙어본 뒤에도 클러스터 목록에 없습니다"
                                              " — 사이드카가 이 연결을 다른 방식으로 처리했습니다")
        # 'cx_connect_fail' 이라는 신호를 믿어도 되는지부터 확인한다: 절대 못 붙는 주소(대조군)에
        # 대해서는 실패가 잡혀야 정상이다. 거기서도 0 이면 이 숫자는 근거로 쓸 수 없다.
        control = cluster_counters("192.0.2.1", 443)
        if control:
            row("   (대조군) Envoy 셈", "시도 %s회 / 연결실패 %s회  ← 여기에 실패가 잡혀야"
                                        " 이 숫자를 근거로 쓸 수 있습니다"
                % (control.get("cx_total"), control.get("cx_connect_fail")))
            facts["controlFail"] = control.get("cx_connect_fail")
        for hit in envoy_stat_lines("cluster.PassthroughCluster.upstream_cx",
                                    "cluster.BlackHoleCluster.upstream_cx",
                                    "listener.0.0.0.0_15001.", limit=12):
            row("   stats(붙어본 뒤)", hit[:110])

    head("E. 다른 곳은 되는지 (어디까지 정상인지 가른다)")
    others = []
    kube = os.environ.get("KUBERNETES_SERVICE_HOST")
    if kube:
        others.append(("쿠버네티스 API", kube,
                       int(os.environ.get("KUBERNETES_SERVICE_PORT_HTTPS")
                           or os.environ.get("KUBERNETES_SERVICE_PORT") or 443)))
    for nsv in (env.get("read_nameservers") or [])[:1]:
        others.append(("DNS 서버(TCP 53)", nsv, 53))
    if GATEWAY_IP:
        others.append(("게이트웨이", GATEWAY_IP, port))
        others.append(("게이트웨이(80)", GATEWAY_IP, 80))
    # [실측 2026-08-26] 사이드카가 있는 파드에서는 **어디로 붙어도 TCP 가 0ms 로 성공**한다
    # (iptables 가 죄다 옆의 Envoy 로 돌리기 때문). 그걸 모르고 'TCP OK' 를 도달 증거로 읽으면
    # 통째로 잘못된 결론이 나온다. 그래서 '절대 붙으면 안 되는 곳' 을 같이 찍어 기준을 준다.
    # 개발 게이트웨이가 되면 '망은 뚫렸고 운영만 막힌 것' 이라 원인이 확 좁혀진다.
    try:
        from urllib.parse import urlsplit as _us
        dev_host = _us(DEV_GATEWAY_URL).hostname or ""
        dev_ip = sorted({i[4][0] for i in socket.getaddrinfo(dev_host, 443,
                                                             proto=socket.IPPROTO_TCP)})[0]
        others.append(("개발 게이트웨이", dev_ip, 443))
    except Exception:
        L.append("   (개발 게이트웨이 devmipgw 는 이름이 안 풀려 확인하지 못했습니다)")
    others.append(("(대조군) 없는 주소", "192.0.2.1", 443))          # TEST-NET-1, 라우팅되지 않는다
    if GATEWAY_IP:
        others.append(("(대조군) 게이트웨이 엉뚱한 포트", GATEWAY_IP, 9))
    control_ok = []
    for label, tip, tport in others:
        res = _tcp_try(tip, tport, min(timeout, 3.0))
        row(label, "%s:%s  %s" % (tip, tport, res))
        if label.startswith("(대조군)") and res.startswith("OK"):
            control_ok.append(label)
    facts["tcpMeaningless"] = bool(control_ok)
    if control_ok:
        L.append("   ※ **대조군까지 붙었습니다** — 이 파드에서는 어디로 붙어도 TCP 가 성공합니다")
        L.append("     (사이드카가 다 가로채기 때문). 그러니 위 'TCP OK' 는 도달 증거가 못 됩니다.")
    else:
        L.append("   ※ 대조군은 제대로 실패했습니다 — 위 TCP 결과는 믿을 수 있습니다.")
    L.append("   ※ 클러스터 안(API·DNS)은 되는데 게이트웨이만 안 되면 = 밖으로 나가는 길 문제입니다.")

    head("F. 실제 게이트웨이 호출 (가장 확실한 증거)")
    if not do_call:
        row("건너뜀", "call=false 로 요청하셨습니다")
    elif not API_KEY:
        row("건너뜀", "MIP_API_KEY 가 없어 부를 수 없습니다")
    else:
        acct = DEFAULT_ACCOUNT or "diagnose"
        row("방법", "drmSecretAPI(비밀문서 여부 확인) / 계정 %s / 64바이트 더미 파일" % acct)
        t = time.monotonic()
        try:
            value = MIPGatewayClient(timeout=min(timeout * 2, 15)).secret(
                b"AXCELL-DIAGNOSE" * 4, "diagnose.txt", acct)      # secret 은 JSON 하나만 돌려준다
            facts["call"] = "ok"
            row("결과", "응답 옴 (%dms) — %s" % (_ms(t), str(value)[:200]))
            L.append("   → **망은 뚫려 있습니다.** 남은 문제는 파라미터/권한입니다.")
        except MIPNetworkError as err:
            # [실측 2026-08-26] MIPNetworkError 는 MIPGatewayError 의 자식이라, 아래 except 를
            # 먼저 두면 **연결조차 못 한 것을 '응답이 왔다' 로 읽는다**(실제로 그렇게 오판했다).
            # 게이트웨이까지 갔는지 아닌지가 이 진단의 전부라, 이 순서가 곧 결론의 정확도다.
            facts["call"] = "fail"
            row("결과", "게이트웨이까지 못 갔습니다 (%dms, %s) — %s"
                % (_ms(t), getattr(err, "kind", "network"), str(getattr(err, "detail", "") or err)[:180]))
        except MIPGatewayError as err:
            facts["call"] = "gatewayError"
            row("결과", "게이트웨이 오류 (%dms) result=%s %s" % (_ms(t), err.result, str(err.result_msg)[:120]))
            if getattr(err, "seen_ip", ""):
                row("★게이트웨이가 본 IP", "%s  ← 방화벽·허용목록에는 이 IP 를 등록해야 합니다" % err.seen_ip)
            L.append("   → **망은 뚫려 있습니다**(오류지만 응답이 왔습니다). 남은 문제는 설정입니다.")
        except Exception as err:
            facts["call"] = "fail"
            row("결과", "실패 (%dms) — %s" % (_ms(t), str(err)[:200]))

    try:
        head("H. 원시 증거 (제 판정이 틀려도 여기 답이 있습니다)")
        L.append("   아래는 해석하지 않은 원문입니다. 판정이 어긋나면 이 부분을 보내 주세요.")
        ev = out_mesh = (mesh or {})
        if ev.get("adminOk"):
            for title, path, needles, cap in (
                    ("listeners", "/listeners", (), 20),
                    ("clusters(게이트웨이)", "/clusters", (GATEWAY_IP, host), 30),
                    ("clusters(대조군)", "/clusters", ("192.0.2.1",), 8),
                    ("config_dump(게이트웨이 검색)", "/config_dump", (host, GATEWAY_IP), 12)):
                try:
                    txt = _envoy_get(path, timeout=5.0)
                    rows_ = [l.strip() for l in txt.split("\n")
                             if l.strip() and (not needles or any(n and n in l for n in needles))]
                    if not rows_:
                        row("[%s]" % title, "(해당 내용 없음)")
                    for one in rows_[:cap]:
                        row("[%s]" % title if one is rows_[0] else "", one[:118])
                    if len(rows_) > cap:
                        row("", "... %d줄 더 있음" % (len(rows_) - cap))
                    note = envoy_read_note(path)
                    if note:
                        row("", note.strip())
                except Exception as err:
                    row("[%s]" % title, "읽기 실패: %s" % type(err).__name__)
            for one in envoy_stat_lines("upstream_cx_total", "upstream_cx_connect_fail",
                                        "downstream_cx_total", "upstream_rq_", limit=25):
                row("[stats]", one[:118])
        else:
            row("[Envoy]", "관리포트에서 못 읽었습니다 — 듣는 포트: %s"
                % (", ".join(str(p) for p in proc_listeners()[:12]) or "확인 못함"))
        row("[/etc/hosts]", _read_text("/etc/hosts", 300).replace("\n", " | ")[:110] or "(비어 있음)")
        row("[기본 경로]", default_route() or "(못 읽음)")
        row("[듣는 포트]", ", ".join(str(p) for p in proc_listeners()[:16]) or "(못 읽음)")
        for one in interesting_env():
            row("[env]", one[:118])
    except Exception as err:
        # 원시 증거 수집이 실패해도 결론(G)은 반드시 찍혀야 한다.
        row("[원시 증거]", "수집 중 오류: %s: %s" % (type(err).__name__, err))

    head("G. 정리")
    for line in _diagnose_verdict(facts, mesh, ip, host, port):
        L.append("   " + line)
    L.append("")
    return


def _diagnose_verdict(facts, mesh, ip, host, port):
    """확인한 사실만 보고 '어디를 고쳐야 하나' 로 좁힌다.

    [실측 2026-08-26] 처음엔 위에 찍힌 글자를 찾아 결론을 냈다가, 다른 항목의 문구가 걸려
    **이름 풀이부터 실패한 상황에 "TLS 응답이 없다" 는 결론**이 나왔다. 진단이 거짓말을 하면
    없느니만 못하다 — 판단 근거는 이 표 하나로 못 박는다.
    """
    where = {"ip": ip, "port": port, "host": host, "tlsCodes": facts.get("tlsCodes") or {}}
    if facts.get("call") in ("ok", "gatewayError"):
        return ["게이트웨이까지 **도달합니다** — 네트워크는 문제가 아닙니다.",
                "위 F 의 응답 내용(오류 코드/메시지)에 맞춰 설정만 고치면 됩니다."]
    if facts.get("dns") is False:
        return ["이름 풀이부터 실패했습니다 — 그 아래 단계는 시도조차 못 했습니다.",
                ".env 의 MIP_GATEWAY_IP 에 게이트웨이 VIP 를 넣으면 서버가 대신 풉니다"
                " (지금 값: %s)." % (GATEWAY_IP or "없음")]
    if facts.get("tcp") is False:
        return ["TCP 부터 안 붙습니다 — 포트가 아예 안 열려 있거나 길이 없습니다.",
                "목적지 %s:%s 가 맞는지, 그리고 출발지가 허용돼 있는지 확인하세요." % (ip, port)]
    if facts.get("tlsOk"):
        return ["TLS 는 붙습니다 — 막힌 곳은 그 위(HTTP/파라미터)입니다. 위 F 를 보세요."]
    first = facts.get("first")
    if first == "serverhello":
        return ["ServerHello 는 옵니다 = 게이트웨이의 TLS 는 살아 있습니다.",
                "우리 쪽 협상만 실패했습니다 — 인증서(사내 루트 CA)나 프로토콜 버전을 보세요."]
    if first == "alert":
        return ["상대가 **명시적으로 거절**했습니다(TLS Alert) — 조용히 버려지는 것과 다릅니다.",
                "방화벽 drop 이 아니라 게이트웨이/앞단 장비의 정책입니다. 그쪽에 문의하세요."]
    if first == "http":
        return ["이 포트가 TLS 가 아닙니다(평문 HTTP 응답) — 중간에 프록시를 타고 있을 수 있습니다.",
                "게이트웨이 주소·포트가 맞는지 다시 확인하세요."]
    if first == "reset":
        if (mesh or {}).get("present") and facts.get("meshBlocked"):
            return ["사이드카(Istio)가 막고 있습니다 — 방화벽 신청은 소용없습니다. 파드 설정을 고치세요."]
        return ["연결이 끊깁니다(RST) — 포트까지는 갔다는 뜻이라 대개 **출발지 IP 미허용**입니다."] \
               + _firewall_lines(where)
    codes = list((facts.get("tlsCodes") or {}).values())
    if "reset" in codes:
        # [실측 2026-08-26] 실제 TLS 시도 3종 중 2종이 RST 였는데, 결론은 손으로 만든
        # ClientHello 결과(무응답)만 보고 '조용히 버려짐' 이라고 했다. 사용자가 실제로 겪는
        # 것은 앞쪽이다 — 진짜 클라이언트의 결과를 우선한다.
        out = ["TLS 핸드셰이크에서 **연결이 끊깁니다(RST)** — 누군가 능동적으로 끊고 있습니다.",
               "TCP 는 열어 주면서 TLS 만 끊는 것은 **SNI/정책을 보고 판단하는 장비**의 모습입니다."]
        if facts.get("first") == "silent":
            out.append("(같은 자리에서 최소 ClientHello 는 무응답이었습니다 — 보내는 내용에 따라"
                       " 반응이 갈립니다. 내용을 들여다보고 있다는 뜻입니다)")
        tried, failed = facts.get("envoyTried"), facts.get("envoyFailed")
        if isinstance(tried, int) and tried > 0 and failed == 0:
            out.insert(0, "사이드카(Envoy)는 게이트웨이까지 **TCP 연결에 성공**했습니다"
                          "(시도 %d회, 실패 0회) — 패킷은 노드 밖으로 나갔습니다." % tried)
        elif facts.get("tcpMeaningless"):
            out.insert(0, "※ 이 파드에서는 어디로 붙어도 TCP 가 성공합니다(대조군 참고)"
                          " — 'TCP OK' 는 도달 증거가 아닙니다.")
        return out + _firewall_lines(where)
    if first == "silent":
        if (mesh or {}).get("present") and facts.get("meshBlocked"):
            return ["사이드카(Istio)가 이 연결을 막았습니다 — 방화벽 신청은 소용없습니다.",
                    "파드 어노테이션(excludeOutboundIPRanges) 또는 ServiceEntry 등록이 필요합니다."]
        head = ["ClientHello 를 보냈는데 **한 바이트도 안 옵니다** = 조용히 버려지는 중(drop)입니다.",
                "방화벽/보안장비의 전형적인 모습입니다. 아래를 그대로 보안팀에 보내세요:"]
        tried, failed = facts.get("envoyTried"), facts.get("envoyFailed")
        if isinstance(tried, int) and tried > 0 and failed == 0:
            # 이게 제일 중요한 사실이다: 나가는 TCP 자체는 성공했다는 Envoy 의 실측이다.
            head.insert(0, "사이드카(Envoy)는 게이트웨이까지 **TCP 연결에 성공**했습니다"
                           "(시도 %d회, 실패 0회) — 패킷은 밖으로 나갔습니다." % tried)
            head.insert(1, "즉 막히는 지점은 사이드카가 아니라 **TLS 단계**입니다"
                           " — TCP 는 받아 주고 ClientHello 만 버리는 장비가 앞에 있습니다.")
        elif facts.get("tcpMeaningless"):
            head.insert(0, "※ 이 파드에서는 어디로 붙어도 TCP 가 성공합니다(대조군 참고)"
                           " — 'TCP OK' 는 도달 증거가 아닙니다.")
        return head + _firewall_lines(where)
    return ["한 곳으로 좁혀지지 않았습니다 — 위 A~F 를 그대로 전달해 주세요."]



router = APIRouter()


@router.get("/diagnose")
def drm_diagnose(call: bool = Query(True, description="실제 게이트웨이 호출까지 해 볼지")):
    """[사용자 지시 2026-08-26] 폐쇄망은 파일 한 번 올리는 것도 큰 일이다 — 재시작 없이
    브라우저에서 같은 진단을 다시 볼 수 있게 한다."""
    return PlainTextResponse("\n".join(deep_diagnose(do_call=call)))

def answer(question):
    """질문 한 줄을 받아 답을 줄 목록으로 돌려준다.

    [사용자 지시 2026-08-26] 이 서버는 컨테이너 안에서 돌고, 사용자에게는 **터미널 하나**뿐이다
    (브라우저로 주소를 열 수 없다). 그래서 같은 진단을 글자 한 줄로도 부를 수 있게 한다.
    엔드포인트와 이 함수는 **같은 코드를 부른다** — 길이 갈리면 결과가 달라져 사람을 헷갈리게 한다.

    쓰는 법:
      diagnose                      전체 심층 진단(A~G)
      probe 172.28.11.30:443        그 주소를 단계별로 찔러보기
      probe 10.0.0.5:443 mipgw.a.b  SNI 를 따로 줄 때
      envoy clusters 172.28.11.30   사이드카에게 직접 묻기(찾을 글자는 생략 가능)
      help                          이 안내
    """
    text = " ".join(str(question or "").split())
    if not text or text in ("help", "?", "도움말"):
        return [l.rstrip() for l in (answer.__doc__ or "").split("쓰는 법:")[-1].split("\n") if l.strip()]
    word = text.split()
    head, rest = word[0].lower(), word[1:]
    if head in ("diagnose", "진단"):
        return deep_diagnose()
    if head in ("probe", "찔러", "확인"):
        if not rest:
            return ["probe 뒤에 주소를 주세요 (예: probe 172.28.11.30:443)"]
        return probe_target(rest[0], rest[1] if len(rest) > 1 else "")
    if head in ("envoy", "사이드카"):
        what = rest[0] if rest else "clusters"
        path = ENVOY_PATHS.get(what)
        if not path:
            return ["envoy 뒤에는 " + ", ".join(sorted(ENVOY_PATHS)) + " 중 하나를 주세요"]
        txt = _envoy_get(path, timeout=4.0)
        if not txt:
            return ["사이드카 관리포트(%s)에서 응답이 없습니다 — 사이드카가 없거나 막혀 있습니다."
                    % ENVOY_ADMIN]
        find = rest[1] if len(rest) > 1 else ""
        rows = [l for l in txt.split("\n") if not find or find in l]
        return ["── Envoy %s%s (%d줄) ──" % (path, (" / '%s'" % find) if find else "", len(rows))] \
               + rows[:400]
    if ":" in text and " " not in text:                 # 주소만 준 경우
        return probe_target(text)
    return ["무슨 뜻인지 모르겠습니다. 'help' 를 넣어 보세요. 받은 값: %r" % text]

# ── 되묻기용 조회 엔드포인트 ────────────────────────────────────────
# [사용자 지시 2026-08-26] "왜 계속 마지막이냐" — 맞는 지적이다. 원인은 **새로 묻고 싶은 게
# 생길 때마다 코드를 고쳐 올려야 하는 구조**였다. 폐쇄망에서 그 비용은 매번 반나절이다.
# 그래서 자주 묻게 되는 것들을 미리 열어 둔다: 다른 주소로도 찔러 보기 / Envoy 에게 직접 묻기.
# 이제 추가 질문은 **브라우저 주소창**으로 끝난다.
#
# 안전선(진단용이라도 서버에 구멍을 내면 안 된다):
#   · 읽기만 한다 — 연결해 보고 첫 응답만 본다. 임의의 내용을 보내지 않는다.
#   · Envoy 조회는 **로컬 관리포트의 정해진 경로만** 본다(임의 URL 전달 금지).
#   · 제한시간·응답 길이를 묶어 둔다.

_SAFE_HOST = re.compile(r"^[A-Za-z0-9._:\-\[\]]{1,255}$")
ENVOY_PATHS = {
    "server_info": "/server_info",
    "clusters": "/clusters",
    "listeners": "/listeners",
    "stats": "/stats",
    "runtime": "/runtime",
    "certs": "/certs",
    "ready": "/ready",
}


def probe_target(target, sni="", timeout=5.0):
    """아무 주소나 같은 방식으로 찔러 본다 — '거긴 되나?' 를 코드 수정 없이 확인하려고."""
    text = str(target or "").strip()
    if text.startswith("["):                     # [::1]:443 같은 IPv6 표기
        host, _, rest = text.partition("]")
        host, port_s = host[1:], rest.lstrip(":")
    else:
        host, _, port_s = text.rpartition(":")
        if not host:
            host, port_s = text, "443"
    host = host.strip()
    try:
        port = int(port_s or 443)
    except ValueError:
        port = 0
    if not host or not _SAFE_HOST.match(host) or not (0 < port < 65536):
        return ["주소를 '호스트:포트' 로 주세요 (예: 172.28.11.30:443)"]
    timeout = max(0.5, min(float(timeout or 5.0), 15.0))
    name = (sni or host).strip()

    L = ["── %s:%s 찔러보기 (SNI %s, 제한 %.1f초) ──" % (host, port, name, timeout)]
    t = time.monotonic()
    ip = host
    try:
        ip = sorted({i[4][0] for i in socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)})[0]
        L.append("  이름 풀이     %s → %s  (%dms)" % (host, ip, _ms(t)))
    except Exception as err:
        L.append("  이름 풀이     실패 — %s" % _net_reason(err)[2])
        return L
    L.append("  TCP          %s" % _tcp_try(ip, port, timeout))
    for label, res, _ in _tls_try_variants(ip, port, name, timeout):
        L.append("  TLS %-9s %s" % (label, res))
    L.append("  첫 응답 바이트   %s" % _first_bytes_probe(ip, port, name, timeout)[1])
    L.append("  평문 HTTP     %s" % _plain_http_probe(ip, port, name, min(timeout, 4.0)))
    return L


@router.get("/probe")
def drm_probe(target: str = Query(..., description="찔러 볼 주소 (예: 172.28.11.30:443)"),
              sni: str = Query("", description="TLS 에 쓸 호스트명(기본: 주소 그대로)"),
              timeout: float = Query(5.0, description="단계별 제한시간(초, 0.5~15)")):
    """다른 주소도 같은 방식으로 확인한다 — 파일을 다시 올리지 않고 비교해 보려고."""
    return PlainTextResponse("\n".join(probe_target(target, sni, timeout)))


@router.get("/ask")
def drm_ask(q: str = Query("help", description="예: diagnose / probe 172.28.11.30:443 / envoy clusters")):
    """터미널의  --ask  와 **같은 함수**를 부른다(길이 갈리면 답이 달라진다)."""
    return PlainTextResponse("\n".join(answer(q)))


@router.get("/envoy")
def drm_envoy(what: str = Query("clusters", description="server_info|clusters|listeners|stats|runtime|certs|ready"),
              find: str = Query("", description="이 글자가 든 줄만"),
              lines: int = Query(200, description="최대 줄 수(1~2000)")):
    """옆에 붙은 사이드카(Envoy)에게 직접 묻는다. 로컬 관리포트의 정해진 경로만 본다."""
    path = ENVOY_PATHS.get(str(what or "").strip())
    if not path:
        return PlainTextResponse("what= 은 다음 중 하나여야 합니다: " + ", ".join(sorted(ENVOY_PATHS)),
                                 status_code=400)
    txt = _envoy_get(path, timeout=4.0)
    if not txt:
        return PlainTextResponse("사이드카 관리포트(%s)에서 응답이 없습니다 — 사이드카가 없거나"
                                 " 관리포트가 막혀 있습니다." % ENVOY_ADMIN)
    rows = [l for l in txt.split("\n") if not find or find in l]
    cap = max(1, min(int(lines or 200), 2000))
    head = "── Envoy %s%s — %d줄 중 %d줄 ──" % (path, (" / '%s' 포함" % find) if find else "",
                                                 len(rows), min(len(rows), cap))
    return PlainTextResponse("\n".join([head] + rows[:cap]))


_GATEWAY_FILENAME_RE = re.compile(r'filename\*?=(?:UTF-8\'\')?"?([^";\r\n]+)"?', re.I)


def _disposition_from_gateway(headers, fallback_name):
    """Gateway 의 Content-Disposition 에서 파일명을 꺼내되, 신뢰하지 않고 세탁해 다시 만든다
    (헤더 주입 방지 — 규격 9.1). 없으면 업로드 때 이름을 그대로 쓴다."""
    name = ""
    try:
        m = _GATEWAY_FILENAME_RE.search(str(headers.get("content-disposition") or ""))
        if m:
            from urllib.parse import unquote
            name = unquote(m.group(1))
    except Exception:
        name = ""
    safe = safe_filename(name or fallback_name, "download.bin")
    from urllib.parse import quote
    ascii_name = re.sub(r"[^0-9A-Za-z._\-]", "_", safe) or "download.bin"
    return 'attachment; filename="%s"; filename*=UTF-8\'\'%s' % (ascii_name, quote(safe))


def _read_upload(file: UploadFile):
    """업로드 파일을 상한까지 읽는다. urllib multipart 가 전체 바이트를 요구해 버퍼링은 불가피
    — 대신 상한(MAX_FILE_MB)으로 폭주만 막는다."""
    limit = MAX_FILE_MB * 1024 * 1024
    chunks, total = [], 0
    while True:
        chunk = file.file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            return None, total
        chunks.append(chunk)
    return b"".join(chunks), total


def _err_json(status, result="", result_msg="", error="", payload=None, raw="", seen_ip=""):
    """오류 응답. Gateway 가 보낸 JSON 이 있으면 `gateway` 에 **원문 그대로** 실어 준다
    (규격 밖 필드까지 보존 — 그게 원인 단서가 된다). JSON 이 아니면 본문 앞부분을 rawBody 로."""
    body = {"ok": False, "result": result, "result_msg": result_msg, "error": error or result_msg}
    if isinstance(payload, dict):
        body["gateway"] = payload
    elif raw:
        body["rawBody"] = str(raw)[:500]
    if seen_ip:
        # 게이트웨이가 실제로 본 출발지 IP + 우리가 보낸 값. 둘이 다르면 그게 -100 의 원인이다.
        body["seenIp"] = seen_ip
        body["sentIp"] = CLIENT_IP
        body["hint"] = ("게이트웨이는 이 호출을 %s 에서 온 것으로 봤습니다. API KEY 발급 시 등록한 IP "
                        "(그리고 .env 의 MIP_CLIENT_IP)가 이 값과 같아야 합니다." % seen_ip)
    return JSONResponse(status_code=status, content=body)


def _stream_response(stream_tuple, fallback_name):
    resp, first, headers = stream_tuple

    def _iter():
        try:
            yield first
            while True:
                chunk = resp.read(MIPGatewayClient.CHUNK)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                resp.close()
            except Exception:
                pass

    out_headers = {"content-disposition": _disposition_from_gateway(headers, fallback_name)}
    return StreamingResponse(_iter(), media_type="application/octet-stream", headers=out_headers)


_AUTODIAG = {"at": 0.0, "every": 600.0}
AUTODIAG_SAVE_DIR = ""     # main.py 가 켤 때 logs/_diagnostics 로 채워 준다(비면 저장 생략)


def autodiagnose_on_failure(kind, trace_id):
    """[사용자 지시 2026-08-26] 사용자는 '그냥 돌리기' 만 할 수 있다 — 실패한 뒤에 무엇을 더
    쳐 보라고 할 수 없다. 그러니 **실패한 그 순간의 상태**를 서버가 알아서 남겨야 한다.

    망 문제일 때만, 10분에 한 번만 찍는다(파일을 올릴 때마다 찍으면 콘솔이 진단으로 도배된다).
    응답을 붙잡지 않도록 별도 스레드에서 돌린다 — 진단 때문에 사용자가 기다리면 안 된다.
    """
    import threading

    if kind not in ("dns", "timeout", "network", "reset"):
        return                                    # 게이트웨이가 답을 준 실패는 망 문제가 아니다
    now = time.monotonic()
    if now - _AUTODIAG["at"] < _AUTODIAG["every"]:
        return
    _AUTODIAG["at"] = now

    def run():
        try:
            lines = deep_diagnose()
            print("", flush=True)
            print("──── 방금 실패(trace=%s)가 나서 그 자리에서 진단했습니다 ────" % trace_id, flush=True)
            print("\n".join(lines), flush=True)
            print("   (다음 자동 진단은 %d분 뒤부터 가능합니다)" % int(_AUTODIAG["every"] / 60), flush=True)
            # [실측 2026-09-02] 콘솔에만 찍었더니, 정작 필요할 때 "진단 파일이 없다"가 됐다.
            # 시작 진단은 파일로 남는데 실패 진단만 안 남는 비대칭 — 파일로도 남긴다.
            if AUTODIAG_SAVE_DIR:
                try:
                    folder = Path(AUTODIAG_SAVE_DIR)
                    folder.mkdir(parents=True, exist_ok=True)
                    path = folder / ("diagnose_fail_%s_%s.txt"
                                     % (time.strftime("%Y%m%d_%H%M%S"), trace_id))
                    path.write_text("\n".join(lines), encoding="utf-8")
                    print("   [저장] %s" % path, flush=True)
                except Exception as save_err:
                    print("   [저장 실패] %s: %s" % (type(save_err).__name__, save_err), flush=True)
        except Exception as err:                  # 진단이 서버를 흔들면 안 된다
            print("[경고] 자동 진단 중 오류: %s: %s" % (type(err).__name__, err), flush=True)

    threading.Thread(target=run, name="drm-autodiagnose", daemon=True).start()


def _report_failure(err, trace_id, op_name, started):
    """실패 한 건을 로그에 남기고 오류 응답을 만든다(자동 재시도 경로와 공용)."""
    elapsed = round((time.perf_counter() - started) * 1000)
    # 네트워크 계열은 무엇 때문에 못 갔는지(dns/timeout/network)를 그대로 남긴다 —
    # 전부 'timeout' 으로 뭉뚱그리면 DNS 문제를 게이트웨이 지연으로 오독하게 된다(실측).
    kind = getattr(err, "kind", None) or ("network" if isinstance(err, MIPNetworkError) else "gateway_error")
    payload = getattr(err, "payload", None)
    # Gateway 원문 JSON 이 있으면 로그에도 그대로 남긴다 — 규격 밖 필드가 원인 단서일 수 있다.
    gw = ("" if not isinstance(payload, dict)
          else " gateway=" + json.dumps(payload, ensure_ascii=False)[:400])
    seen_ip = getattr(err, "seen_ip", "")
    if seen_ip:
        gw += (" ★게이트웨이가 본 IP=%s / 우리가 보낸 ip=%s — 이 둘과 API KEY 등록 IP 가 같아야 합니다"
               % (seen_ip, CLIENT_IP or "(미설정)"))
    logger.warning("[문서보안] 실패(%s) trace=%s method=%s elapsed_ms=%d result=%s msg=%s%s",
                   kind, trace_id, op_name, elapsed, err.result or "-",
                   err.result_msg or str(err), gw)
    autodiagnose_on_failure(kind, trace_id)
    return _err_json(err.http_status, err.result, err.result_msg, str(err),
                     payload=payload, raw=getattr(err, "raw", ""), seen_ip=seen_ip)


def _call(op_name, invoke, filename, account, trace_id, size):
    """공통 호출 래퍼 — 로그와 오류→HTTP 매핑을 한 곳에서.
    로그에는 method/계정/파일명/크기/시간/결과만 남긴다(keyCode·내용 금지 — 규격 28)."""
    global CLIENT_IP_LEARNED
    started = time.perf_counter()
    logger.info("[문서보안] 시작 trace=%s method=%s account=%s file=%s size=%.1fKB",
                trace_id, op_name, account or "(기본계정)", safe_filename(filename, "-"), size / 1024)
    try:
        result = invoke()
    except MIPAuthenticationError as err:
        # [자동 해결 2026-08-26] -100 은 게이트웨이가 **자기가 본 출발지 IP** 를 메시지에 실어 준다
        # (규격 Error Code). 우리가 보낸 ip 가 그것과 다르면, 그 값으로 고쳐 **딱 한 번** 다시 부른다.
        # 재시도 금지 원칙(규격에 재시도 규정 없음)의 예외로 두는 근거: -100 은 인증 단계에서
        # 막힌 것이라 게이트웨이가 파일을 건드리지 않았다 — 상태가 바뀌지 않아 다시 불러도 안전하다.
        # (그래도 무한 반복을 막기 위해 학습한 IP 로는 한 번만 시도한다)
        seen = getattr(err, "seen_ip", "")
        if seen and seen != CLIENT_IP and seen != CLIENT_IP_LEARNED:
            logger.warning("[문서보안] -100: 게이트웨이가 본 IP=%s (우리가 보낸 ip=%s) → 그 값으로 한 번 재시도",
                           seen, CLIENT_IP or "(미설정)")
            configure(client_ip=seen)
            CLIENT_IP_LEARNED = seen
            try:
                result = invoke()
                logger.warning("[문서보안] ip 를 %s 로 자동 교정해 성공했습니다. .env 의 MIP_CLIENT_IP 에"
                               " 같은 값을 넣어 두세요(다음 실행부터 첫 호출이 바로 성공합니다).", seen)
                elapsed = round((time.perf_counter() - started) * 1000)
                logger.info("[문서보안] 성공 trace=%s method=%s elapsed_ms=%d", trace_id, op_name, elapsed)
                return result
            except MIPGatewayError as err2:
                err = err2                      # 재시도도 실패 — 아래 공통 처리로
        return _report_failure(err, trace_id, op_name, started)
    except MIPGatewayError as err:
        return _report_failure(err, trace_id, op_name, started)
    except ValueError as err:
        return _err_json(400, error=str(err))
    elapsed = round((time.perf_counter() - started) * 1000)
    logger.info("[문서보안] 성공 trace=%s method=%s elapsed_ms=%d", trace_id, op_name, elapsed)
    return result


@router.get("/health")
def drm_health(probe: str = Query("", description="1 이면 Gateway 이름 풀이(DNS)까지 확인")):
    """설정 상태 확인 — AX-Cell 이 기능을 켤지 판단할 때 부른다. 키 값 자체는 절대 내보내지 않는다.

    [실측 2026-08-26] 키만 보고 'ok' 라고 답하다 보니, 폐쇄망 서버에서 **DNS 가 안 풀려**
    실제 호출은 전부 실패하는데 health 는 정상으로 보이는 구멍이 있었다(원인 추적이 한참 돌아감).
    ?probe=1 이면 게이트웨이 호스트 이름이 풀리는지까지 확인해 준다(느릴 수 있어 기본은 끔)."""
    from urllib.parse import urlsplit
    host = urlsplit(GATEWAY_BASE_URL).hostname or ""
    out = {
        "ok": True,
        "service": "axcell-drm",
        "configured": bool(API_KEY),
        "gatewayHost": host,
        "defaultAccount": bool(DEFAULT_ACCOUNT),
        "timeoutSeconds": TIMEOUT_SECONDS,
        "maxFileMb": MAX_FILE_MB,
    }
    if str(probe or "").strip() in ("1", "true", "yes") and host:
        import socket
        try:
            infos = socket.getaddrinfo(host, None)
            out["dns"] = {"ok": True, "addresses": sorted({i[4][0] for i in infos})[:4]}
        except Exception as err:
            out["dns"] = {
                "ok": False,
                "error": "%s: %s" % (type(err).__name__, err),
                "hint": "서버에서 이 호스트 이름이 안 풀립니다. /etc/hosts 등록 또는 사내 DNS·프록시 설정이 필요합니다.",
            }
    return out


def _prepare(file, requestorAccount):
    """공통 전처리: 설정 확인 → 파일 읽기(상한) → 계정 결정. 오류면 JSONResponse 를 돌려준다."""
    if not API_KEY:
        return None, _err_json(503, error="MIP_API_KEY 가 설정되지 않았습니다(.env 또는 환경변수).")
    data, total = _read_upload(file)
    if data is None:
        return None, _err_json(413, error="파일이 너무 큽니다(최대 %dMB)." % MAX_FILE_MB)
    if not data:
        return None, _err_json(400, error="빈 파일입니다.")
    account = str(requestorAccount or "").strip() or DEFAULT_ACCOUNT
    if not account:
        return None, _err_json(400, error="requestorAccount 가 필요합니다(서버 기본 계정도 없습니다).")
    return (data, account), None


@router.post("/encrypt", summary="파일 암호화(drmEncryptAPI)",
             description="multipart 로 받은 파일을 MIP Gateway 로 암호화해 파일 스트림으로 돌려준다. "
                         "labelid 를 주면 그대로 전달한다(의미는 연동규격 참조).")
def drm_encrypt(file: UploadFile = File(...),
                requestorAccount: str = Form("", description="요청자 계정(비우면 서버 기본 계정)"),
                labelid: str = Form("", description="선택 — 라벨 id")):
    prep, err = _prepare(file, requestorAccount)
    if err:
        return err
    data, account = prep
    trace_id = uuid.uuid4().hex[:8]
    client = MIPGatewayClient()

    def _invoke():
        kind, value = client.encrypt(data, file.filename, account, labelid)
        if kind == "json":
            return JSONResponse(value)      # 규격 외 JSON 성공 응답이면 그대로 전달
        return _stream_response(value, file.filename)

    return _call("drmEncryptAPI", _invoke, file.filename, account, trace_id, len(data))


@router.post("/decrypt", summary="파일 복호화(drmDecryptAPI)",
             description="DRM 파일을 복호화해 파일 스트림으로 돌려준다. 복호화 대상이 아니면 "
                         "Gateway 의 -200 JSON 을 400 으로 돌려준다(부르는 쪽이 분기).")
def drm_decrypt(file: UploadFile = File(...),
                requestorAccount: str = Form("", description="요청자 계정(비우면 서버 기본 계정)")):
    prep, err = _prepare(file, requestorAccount)
    if err:
        return err
    data, account = prep
    trace_id = uuid.uuid4().hex[:8]
    client = MIPGatewayClient()

    def _invoke():
        kind, value = client.decrypt(data, file.filename, account)
        if kind == "json":
            return JSONResponse(value)
        return _stream_response(value, file.filename)

    return _call("drmDecryptAPI", _invoke, file.filename, account, trace_id, len(data))


@router.post("/secret", summary="비밀문서 여부 확인(drmSecretAPI)",
             description="파일이 비밀문서인지 JSON 으로 알려준다: {result: S_DOC|N_DOC, ...}")
def drm_secret(file: UploadFile = File(...),
               requestorAccount: str = Form("", description="요청자 계정(비우면 서버 기본 계정)")):
    prep, err = _prepare(file, requestorAccount)
    if err:
        return err
    data, account = prep
    trace_id = uuid.uuid4().hex[:8]
    client = MIPGatewayClient()

    def _invoke():
        return JSONResponse(client.secret(data, file.filename, account))

    return _call("drmSecretAPI", _invoke, file.filename, account, trace_id, len(data))


@router.post("/policy", summary="정책 기반 암/복호화(drmPolicyAPI)",
             description="decodeType=encrypt|decrypt 로 정책 기반 암/복호화를 수행해 파일 스트림으로 돌려준다.")
def drm_policy(file: UploadFile = File(...),
               decodeType: Literal["encrypt", "decrypt"] = Form(..., description="encrypt 또는 decrypt"),
               requestorAccount: str = Form("", description="요청자 계정(비우면 서버 기본 계정)")):
    prep, err = _prepare(file, requestorAccount)
    if err:
        return err
    data, account = prep
    trace_id = uuid.uuid4().hex[:8]
    client = MIPGatewayClient()

    def _invoke():
        kind, value = client.policy(data, file.filename, account, decodeType)
        if kind == "json":
            return JSONResponse(value)
        return _stream_response(value, file.filename)

    return _call("drmPolicyAPI", _invoke, file.filename, account, trace_id, len(data))
