# -*- coding: utf-8 -*-
"""[F9 관리 대시보드 2026-08-24] 프록시(log_dash)와 배선 검증.

구조 — VM(사내망)과 수집 서버(보안망 /data/public…)는 분리돼 있고 게이트웨이는
Api-Key 헤더 없이는 통과시키지 않는다. 브라우저 페이지 로드는 커스텀 헤더를 못 붙이므로
대시보드 URL 을 직접 열면 막힌다. 그래서:
  dashboard.html(로컬 서빙) → same-origin /api/logdash/* → serve_b2b 가 헤더 부착
  → <업스트림>/v1/admin/* (수집 서버가 폴더를 읽어 응답)

종단(실서버 기동) 검증은 수동으로 1회 완료: 페이지 200 · stats/errors 프록시 200 ·
session.zip 스트리밍 200(application/zip) · 화이트리스트 밖 404.
여기서는 프로세스 없이 검증 가능한 계약을 잠근다.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import log_dash  # noqa: E402

fails = 0


def check(name, cond, detail=None):
    global fails
    if cond:
        print("  PASS  " + name)
    else:
        fails += 1
        print("  FAIL  " + name + (("  -> " + str(detail)[:160]) if detail is not None else ""))


print("[1] 화이트리스트 — 이 프록시가 '아무 데나 대신 불러 주는 문'이 되면 안 된다")
for p in ("stats", "errors", "sessions", "dates", "session.zip", "day.zip"):
    check(f"허용: {p}", log_dash.allowed(p))
check("쿼리가 붙어도 경로로 판정", log_dash.allowed("stats?from=2026-08-01&user=kim"))
for p in ("", "../secret", "stats/../../etc", "shutdown", "session.zip.bak", "unknown"):
    check(f"차단: {p or '(빈 값)'}", not log_dash.allowed(p))

print("[2] 요청 구성 — 게이트웨이/관리자 인증이 서버측에서 붙는다")
os.environ["B2B_LOG_SYNC_URL"] = "http://collector.example:8100"
os.environ["B2B_LOG_SYNC_KEY"] = "gwkey123"
os.environ["B2B_LOG_ADMIN_KEY"] = "adminsecret"
try:
    req, err = log_dash.build_request("stats?from=2026-08-01")
    check("요청이 만들어진다", req is not None, err)
    check("수집 서버의 /v1/admin 으로 간다",
          req.full_url.startswith("http://collector.example:8100/v1/admin/stats?from=2026-08-01"), req.full_url)
    check("게이트웨이 Api-Key 부착", req.get_header("Api-key") == "gwkey123")
    check("관리자 키 헤더 부착", req.get_header("X-admin-key") == "adminsecret")
    check("관리자 키는 쿼리로도(zip 후속 이동 대비)", "key=adminsecret" in req.full_url)
    check("GET 전용", req.get_method() == "GET")

    req2, _ = log_dash.build_request("session.zip?date=2026-08-24&user=a&session=s")
    check("zip 도 같은 규칙", req2 is not None and "/v1/admin/session.zip" in req2.full_url)

    bad, err2 = log_dash.build_request("../../etc/passwd")
    check("화이트리스트 밖은 요청 자체를 안 만든다", bad is None and bool(err2))
finally:
    os.environ.pop("B2B_LOG_SYNC_URL", None)
    os.environ.pop("B2B_LOG_SYNC_KEY", None)
    os.environ.pop("B2B_LOG_ADMIN_KEY", None)

print("[3] 배선 — 훅·페이지·포장이 전부 이어져 있다")
sv = (ROOT / "serve_b2b.py").read_text(encoding="utf-8", errors="replace")
check("serve_b2b 라우팅 훅", '/api/logdash/' in sv and "import log_dash" in sv)
check("교차 출처 가드(수집 로그 전체가 나가는 문)", "cross-origin request rejected" in
      sv[sv.find('/api/logdash/'):sv.find('/api/logdash/') + 1600])
html = (ROOT / "dashboard.html").read_text(encoding="utf-8", errors="replace")
check("페이지가 same-origin 프록시를 부른다", '"/api/logdash/" + path' in html)
check("기간·사용자 필터 UI", 'id="f-from"' in html and 'id="f-user"' in html)
check("세션 zip 받기 링크", "/api/logdash/session.zip?date=" in html)
check("체류 폴백이 서버 규칙과 같다(endedAt→lastSeenAt)", "s.endedAt || s.lastSeenAt" in html)
mm = (ROOT / "scripts" / "model-modal.js").read_text(encoding="utf-8", errors="replace")
check("F9 모달에 버튼", 'id="btn-log-dashboard"' in mm and 'window.open("dashboard.html"' in mm)
spec = (ROOT / "launch_b2b.spec").read_text(encoding="utf-8", errors="replace")
check("frozen 포장: dashboard.html", "('dashboard.html', '.')" in spec)
check("frozen 포장: log_dash(datas+hiddenimports 둘 다)",
      "('log_dash.py', '.')" in spec and "'log_dash'" in spec)

print("")
print("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL")
sys.exit(0 if fails == 0 else 1)
