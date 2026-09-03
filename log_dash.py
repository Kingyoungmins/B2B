# -*- coding: utf-8 -*-
"""F9 관리 대시보드 — 수집 서버(보안망) 데이터를 로컬로 중계하는 프록시.

왜 프록시인가 (네트워크 구조)
  VM(사내망)과 수집 서버(보안망 /data/public/versionTest/logs)는 분리돼 있고, 사이에
  게이트웨이가 있다. 게이트웨이는 Api-Key 헤더 없이는 통과시키지 않는데(curl 실측),
  브라우저의 '주소창 페이지 로드'는 커스텀 헤더를 붙일 수 없다 — 즉 대시보드 URL 을
  브라우저로 직접 열면 게이트웨이에서 막힌다.
  그래서 대시보드 화면(dashboard.html)은 로컬 백엔드가 서빙하고, 데이터 호출은
  same-origin 으로 /api/logdash/* 에 보내면 여기서 게이트웨이 인증을 붙여 수집 서버의
  /v1/admin/* 로 중계한다.

주소/키는 log_sync 의 설정을 그대로 쓴다 — 로그가 올라가는 그 서버가 곧 대시보드의
데이터 원천이므로, 두 곳에 따로 적게 하면 반드시 한쪽이 어긋난다.
관리자 키(수집 서버 --admin-key)는 기본 비어 있고(내부망 전용), 걸려 있으면
B2B_LOG_ADMIN_KEY 환경변수로 준다.

보안
  · 허용 경로 화이트리스트 — 이 프록시가 '아무 데나 대신 불러 주는 문'이 되면 안 된다.
  · GET 전용, 응답은 스트리밍(세션 zip 이 수백 MB 일 수 있어 메모리에 다 올리지 않는다).
"""
from __future__ import annotations

import os
import urllib.parse
import urllib.request

# 수집 서버의 admin API 중 대시보드가 쓰는 것만 연다.
ALLOWED_PATHS = ("stats", "errors", "sessions", "dates", "events", "session.zip", "day.zip",
                 # [0.8.4] 세션 상세(로그 파일·스킬 단계)와 개별 파일 다운로드
                 "session/detail", "session/file")
# events: [2026-08-31] 수집 서버의 이벤트 전량 집계(/v1/admin/events) — 차트용.
#         구버전 수집 서버에는 없으므로 404 가 올 수 있고, 대시보드가 알아서 접는다.

CHUNK = 256 * 1024


def _upstream_config():
    """log_sync 와 같은 원천(환경변수 > F9 설정 > 기본값). import 실패 시에도 죽지 않는다."""
    try:
        import log_sync
        cfg = log_sync.config()
        return cfg.get("upstreamUrl") or "", cfg.get("apiKey") or ""
    except Exception:
        return "", ""


def allowed(sub_path):
    """'stats?from=...' → 허용 여부. 경로 부분만 보고 쿼리는 그대로 통과시킨다."""
    name = str(sub_path or "").split("?", 1)[0].strip("/")
    return name in ALLOWED_PATHS


def build_request(sub_path):
    """프록시할 urllib Request 를 만든다. (요청 객체, 오류메시지) 중 하나만 채워 돌려준다."""
    if not allowed(sub_path):
        return None, "허용되지 않은 대시보드 경로입니다."
    base, api_key = _upstream_config()
    if not base:
        return None, "수집 서버 주소가 설정되지 않았습니다(F9 버전 서버 주소)."
    url = base.rstrip("/") + "/v1/admin/" + str(sub_path).lstrip("/")
    admin_key = str(os.environ.get("B2B_LOG_ADMIN_KEY") or "").strip()
    if admin_key:
        # 쿼리로도 넣는다 — zip 링크처럼 헤더를 못 붙이는 후속 이동이 있어도 살아남게.
        sep = "&" if "?" in url else "?"
        url += sep + "key=" + urllib.parse.quote(admin_key)
    headers = {"accept": "*/*"}
    if api_key:
        headers["Api-Key"] = api_key
    if admin_key:
        headers["X-Admin-Key"] = admin_key
    return urllib.request.Request(url, headers=headers, method="GET"), ""


def stream(sub_path, write, send_headers, timeout=60.0):
    """수집 서버 응답을 그대로 흘려보낸다.

    write(bytes)          — 응답 본문 쓰기 콜백
    send_headers(status, content_type, content_length_or_None, filename_or_None)
    반환: (성공 여부, 오류 메시지)"""
    req, err = build_request(sub_path)
    if req is None:
        return False, err
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            ctype = resp.headers.get("content-type") or "application/octet-stream"
            clen = resp.headers.get("content-length")
            # zip 다운로드면 파일명을 그대로 전달(브라우저 저장 대화상자용)
            fname = None
            disp = resp.headers.get("content-disposition") or ""
            if "filename" in disp:
                fname = disp
            send_headers(int(resp.status or 200), ctype, int(clen) if clen else None, fname)
            while True:
                chunk = resp.read(CHUNK)
                if not chunk:
                    break
                write(chunk)
        return True, ""
    except urllib.error.HTTPError as e:
        try:
            body = e.read()[:4096]
        except Exception:
            body = b""
        send_headers(int(e.code), "application/json", len(body) or None, None)
        if body:
            write(body)
        return True, ""            # 상태코드째 전달했으므로 프록시로서는 성공
    except Exception as e:
        return False, f"수집 서버에 연결하지 못했습니다: {e}"
