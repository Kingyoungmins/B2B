# -*- coding: utf-8 -*-
"""[0.8.3 신기능] 시작 시 버전 게이트 — 허용 버전 목록 대조 + 팝업 판정.

요구(2026-09-02):
  · 프로그램 최초 실행 시 1회 버전 체크
  · version.txt(보안망)에 허용 버전을 줄바꿈으로 여러 개 — 그 외 버전이면 팝업
  · 팝업: "오래된 버전을 사용하고 있습니다..." + [다운로드 하러가기][무시하고 사용하기]
  · 다운로드 기본 주소 = 슬기 스마트빌링, F9 에서 변경 가능(클라 테스트에서 확인)

여기서 잠그는 계약(백엔드):
  1) 허용 목록에 있으면 match=True·팝업 없음 / 없으면 match=False·첫 호출만 show=True
  2) 같은 실행에서 두 번째 호출부터 show=False (새로고침/다중 탭에 반복 팝업 금지)
  3) 서버가 죽어 있으면 조용히 통과(match=None, show=False) — 시작을 막지 않는다
  4) 옛 서버(allowed 없이 version 만)와도 호환 — 단일 비교로 동작
  5) downloadUrl: 서버 값 > 기본값(슬기), open-download 는 http(s)만 연다
"""
import io
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:250]) if not cond else ""))
    if not cond:
        fails.append(name)


RESPONSE = {"body": {}}


class FakeVersionServer(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.endswith("/v1/version"):
            body = json.dumps(RESPONSE["body"]).encode("utf-8")
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeVersionServer)
threading.Thread(target=srv.serve_forever, daemon=True).start()
PORT = srv.server_address[1]
os.environ["B2B_LOG_SYNC_URL"] = "http://127.0.0.1:%d" % PORT

import serve_b2b as S


def fresh():
    S._VERSION_GATE["done"] = False
    S._VERSION_GATE["result"] = None


cur = S._current_app_version()
CUR = cur["normalized"]                      # 소스 실행 = launch_b2b CURRENT_VERSION (0.8.3.0)
print("현재 버전(테스트 기준):", CUR, cur["source"])

print("[1] 허용 목록에 '있는' 버전 → 통과(팝업 없음)")
fresh()
RESPONSE["body"] = {"ok": True, "allowed": ["0.7.4.0", "0.8.2.0", CUR],
                    "version": CUR, "normalized": CUR}
out = S.version_gate_status()
check("match=True", out.get("match") is True, out)
check("팝업 안 띄움(show=False)", out.get("show") is False, out)
check("검사는 실제로 했다(checked)", out.get("checked") is True, out)

print("[2] 허용 목록에 '없는' 버전 → 첫 호출만 팝업")
fresh()
RESPONSE["body"] = {"ok": True, "allowed": ["0.7.4.0", "0.8.0.0", "0.8.1.0", "0.8.2.0"],
                    "version": "0.8.2.0", "normalized": "0.8.2.0"}
out = S.version_gate_status()
check("match=False", out.get("match") is False, out)
check("첫 호출은 show=True", out.get("show") is True, out)
check("허용 목록이 그대로 실린다", out.get("allowed") == ["0.7.4.0", "0.8.0.0", "0.8.1.0", "0.8.2.0"],
      out.get("allowed"))
check("최신 버전 안내(latest)", out.get("latest") == "0.8.2.0", out.get("latest"))
out2 = S.version_gate_status()
check("두 번째 호출부터 show=False(실행당 1회)", out2.get("show") is False, out2)
check("판정 자체는 유지(match=False)", out2.get("match") is False, out2)

print("[3] 주소는 있는데 서버가 죽어 있으면 → '점검중' 팝업(확인 버튼) — 요청 2026-09-02")
fresh()
srv.shutdown()                                # 서버 내림
t0 = time.perf_counter()
out = S.version_gate_status()
el = time.perf_counter() - t0
check("match=None(판단 불가)", out.get("match") is None, out)
check("점검중 팝업(kind=maintenance, show=True)",
      out.get("kind") == "maintenance" and out.get("show") is True, out)
check("빨리 포기(<5초)", el < 5, "%.1fs" % el)
check("사유는 남긴다", "연결하지 못했습니다" in str(out.get("error") or ""), out.get("error"))
out3b = S.version_gate_status()
check("점검중 팝업도 실행당 1회", out3b.get("show") is False, out3b)

print("[3b] 주소 자체가 없는 환경(개발 등)은 조용히 통과 — 점검중 아님")
fresh()
_saved_url = os.environ.pop("B2B_LOG_SYNC_URL", None)
import log_sync as _ls
_prev_default = _ls.DEFAULT_UPSTREAM_URL
_ls.DEFAULT_UPSTREAM_URL = ""
try:
    out = S.version_gate_status()
    check("미구성 → 팝업 없음", out.get("kind") == "" and out.get("show") is False, out)
finally:
    _ls.DEFAULT_UPSTREAM_URL = _prev_default
    if _saved_url:
        os.environ["B2B_LOG_SYNC_URL"] = _saved_url

# 서버 재기동(이후 시나리오)
srv2 = ThreadingHTTPServer(("127.0.0.1", 0), FakeVersionServer)
threading.Thread(target=srv2.serve_forever, daemon=True).start()
os.environ["B2B_LOG_SYNC_URL"] = "http://127.0.0.1:%d" % srv2.server_address[1]

print("[4] 옛 서버(allowed 없음, version 만) 호환 — 단일 비교")
fresh()
RESPONSE["body"] = {"ok": True, "version": CUR, "normalized": CUR}
out = S.version_gate_status()
check("단일 버전과 일치 → 통과", out.get("match") is True, out)
fresh()
RESPONSE["body"] = {"ok": True, "version": "0.9.9.0", "normalized": "0.9.9.0"}
out = S.version_gate_status()
check("단일 버전과 불일치 → 팝업", out.get("match") is False and out.get("show") is True
      and out.get("kind") == "outdated", out)

print("[5] 다운로드 주소 — 서버 값 > 기본값(슬기 스마트빌링)")
fresh()
RESPONSE["body"] = {"ok": True, "allowed": ["9.9.9.9"], "version": "9.9.9.9",
                    "downloadUrl": "https://example.com/dl"}
out = S.version_gate_status()
check("서버가 주면 그 주소", out.get("downloadUrl") == "https://example.com/dl", out.get("downloadUrl"))
fresh()
RESPONSE["body"] = {"ok": True, "allowed": ["9.9.9.9"], "version": "9.9.9.9"}
out = S.version_gate_status()
check("없으면 기본 주소(슬기)", out.get("downloadUrl") == S.VERSION_GATE_DEFAULT_DOWNLOAD_URL,
      out.get("downloadUrl"))
check("기본 주소가 요구값 그대로",
      S.VERSION_GATE_DEFAULT_DOWNLOAD_URL == "https://seulgi.lguplus.co.kr/desk/smart-billing")

print("[6] 다운로드 열기 — http(s)만, 기본 브라우저 호출")
opened = []
import webbrowser
orig_open = webbrowser.open
webbrowser.open = lambda u: (opened.append(u), True)[1]
try:
    r = S.version_gate_open_download("https://example.com/go")
    check("https 허용 + 브라우저 호출", r.get("ok") and opened == ["https://example.com/go"], (r, opened))
    r = S.version_gate_open_download("")
    check("빈 값이면 기본 주소로", r.get("ok") and opened[-1] == S.VERSION_GATE_DEFAULT_DOWNLOAD_URL, r)
    r = S.version_gate_open_download("file:///C:/windows/system32/calc.exe")
    check("http(s) 아닌 주소는 거부", r.get("ok") is False and len(opened) == 2, (r, opened))
finally:
    webbrowser.open = orig_open

srv2.shutdown()
os.environ.pop("B2B_LOG_SYNC_URL", None)
print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)
