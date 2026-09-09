# -*- coding: utf-8 -*-
"""[0.8.4 대시보드 2026-09-09] 조직 단계별 보기 · 조직 조각/버전 클릭 필터 · 오류→세션 이동 — 실제 브라우저 검증.

dashboard.html 을 정적 서버로 띄우고 /api/* 는 Playwright route 로 모의 응답(조직 경로가 있는 세션 5건, 오류 2건).
수집 서버·앱 백엔드 없이 DOM 동작(탭 전환·필터·칩·URL #·스크롤·상세 펼침)을 그대로 확인한다.
실행: python test_runs/_test_dashboard_org_ver_session_e2e.py
"""
import http.server, json, os, socket, sys, threading, urllib.parse
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = 0
def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:300]) if (not cond and detail) else ""))
    if not cond: fails += 1

# ── 정적 서버(dashboard.html) ──────────────────────────────────────────────
class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
sock = socket.socket(); sock.bind(("127.0.0.1", 0)); PORT = sock.getsockname()[1]; sock.close()
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Quiet)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d/dashboard.html" % PORT

# ── 모의 데이터 ────────────────────────────────────────────────────────────
def sess(sid, user, name, mid, org, ver, date, start, end, active=3.0):
    segs = [x for x in org.split(" > ") if x]
    return {"date": date, "user": user, "sessionId": sid, "startedAt": date + "T" + start, "endedAt": date + "T" + end,
            "lastSeenAt": date + "T" + end, "closed": True, "stale": False, "appVersion": ver, "host": "PC-" + user,
            "logFiles": ["vba_pipeline_trace.jsonl"], "skillFiles": [], "sizeBytes": 2048,
            "tokens": {"total": 1200, "prompt": 1000, "completion": 200, "calls": 2}, "activeMinutes": active,
            "displayName": name, "madangId": mid, "team": segs[-1] if segs else "", "orgPath": org}
ORG_A = "LG유플러스 > CTO > AI R_D센터 > AI R_D Lab > Foundation리서치팀"
ORG_B = "LG유플러스 > CTO > AI R_D센터 > 빌링Lab > 빌링플랫폼팀"
ORG_C = "LG유플러스 > 기업부문 > 기업영업그룹 > 서부영업팀"
SESSIONS = [
    sess("s1-aaaa", "u1", "홍길동", "hong", ORG_A, "0.8.4.0", "2026-09-09", "09:00:00", "09:30:00"),
    sess("s2-bbbb", "u2", "김철수", "kim",  ORG_B, "0.8.3.0", "2026-09-09", "10:00:00", "10:20:00"),
    sess("s3-cccc", "u3", "이영희", "lee",  ORG_C, "0.8.4.0", "2026-09-08", "11:00:00", "11:10:00"),
    sess("s4-dddd", "u4", "",      "",     "",    "0.8.2.0", "2026-09-08", "12:00:00", "12:05:00"),
    sess("s5-eeee", "u1", "홍길동", "hong", ORG_A, "0.8.4.0", "2026-09-07", "13:00:00", "13:40:00"),
]
ERRORS = [
    {"date": "2026-09-09", "user": "u2", "sessionId": "s2-bbbb", "file": "vba_pipeline_trace.jsonl", "ts": "2026-09-09T10:05:00",
     "event": "python_com.run.fail", "summary": "KeyError: 금액", "stepIdx": 1, "stepId": "st2"},
    {"date": "2026-09-08", "user": "u3", "sessionId": "s3-cccc", "file": "vba_pipeline_trace.jsonl", "ts": "2026-09-08T11:03:00",
     "event": "client.pipeline.apply_live.error", "summary": "시트 없음", "stepIdx": 0, "stepId": "st1"},
]
STATS = {"total": {"sessions": 5, "userCount": 4, "dwellMinutes": 105, "skills": 0}, "root": "mock",
         "byDate": [{"date": "2026-09-09", "sessions": 2, "userCount": 2, "dwellMinutes": 50, "skills": 0, "bytes": 4096},
                    {"date": "2026-09-08", "sessions": 2, "userCount": 2, "dwellMinutes": 15, "skills": 0, "bytes": 4096},
                    {"date": "2026-09-07", "sessions": 1, "userCount": 1, "dwellMinutes": 40, "skills": 0, "bytes": 2048}],
         "byUsers": [{"user": u, "sessions": n, "dwellMinutes": 10, "skills": 0, "logs": 1, "bytes": 2048, "lastSeenAt": "2026-09-09T10:00:00"}
                     for u, n in (("u1", 2), ("u2", 1), ("u3", 1), ("u4", 1))]}
calls = []
def route(r):
    url = urllib.parse.urlparse(r.request.url); path = url.path; qs = urllib.parse.parse_qs(url.query)
    calls.append(path)
    def js(obj, status=200): r.fulfill(status=status, content_type="application/json", body=json.dumps(obj, ensure_ascii=False))
    if path.endswith("/api/logdash/stats"): return js(STATS)
    if path.endswith("/api/logdash/errors"):
        u = (qs.get("user") or [""])[0]
        errs = [e for e in ERRORS if not u or e["user"] == u]
        return js({"count": len(errs), "errors": errs, "fullScan": False})
    if path.endswith("/api/logdash/sessions"):
        u = (qs.get("user") or [""])[0]
        return js({"sessions": [s for s in SESSIONS if not u or s["user"] == u]})
    if path.endswith("/api/logdash/session/detail"):
        return js({"logs": [{"name": "vba_pipeline_trace.jsonl", "sizeKb": 12}], "skills": []})
    if path.endswith("/api/logdash/events"): return js({"ok": False, "error": "old server"}, 404)
    if path.endswith("/api/app/version/gate"): return js({"allowed": ["0.8.4.0", "0.8.3.0"]})
    return js({"ok": False, "error": "no mock " + path}, 404)

RANGE = "from=2026-09-01&to=2026-09-09"
JS_ROWS = """() => [...document.querySelectorAll('#tbl-sessions tbody tr')].filter(r => !r.classList.contains('sess-detail') && r.cells.length > 1)
                 .map(r => r.querySelector('td.sess-expand').dataset.session)"""
JS_CHIPS = "() => [...document.querySelectorAll('#chips .chip')].map(c => c.textContent.trim())"
JS_ORGROWS = "() => [...document.querySelectorAll('#org-levels .hbar')].map(h => h.getAttribute('data-filter-org') + '=' + h.querySelector('.val').textContent)"

def hash_of(page): return urllib.parse.parse_qs(urllib.parse.urlparse(page.url).fragment)
def settle(page):
    page.wait_for_function("() => document.getElementById('status-line').textContent.startsWith('갱신')", timeout=15000)

with sync_playwright() as p:
    br = p.chromium.launch(headless=True)
    page = br.new_page(viewport={"width": 1400, "height": 1000})
    page.route("**/api/**", route)
    errors_js = []; page.on("pageerror", lambda e: errors_js.append(str(e)))
    page.goto(BASE + "#" + RANGE, wait_until="domcontentloaded"); settle(page)

    print("[1] 조직 단계별 사용 — 탭(1~4단계·팀)과 단계별 집계")
    tabs = page.evaluate("() => [...document.querySelectorAll('#org-levels .lvl-tabs button')].map(b => b.dataset.orgLevel + ':' + b.textContent + (b.classList.contains('on') ? '*' : ''))")
    check("탭 = 1단계·2단계·3단계·4단계·팀(기본 선택)", tabs == ["1:1단계", "2:2단계", "3:3단계", "4:4단계", "team:팀*"], tabs)
    rows = page.evaluate(JS_ORGROWS)
    check("팀 탭: Foundation리서치팀 2회 · 빌링플랫폼팀 1 · 서부영업팀 1", rows == ["Foundation리서치팀=2회 · 1명", "빌링플랫폼팀=1회 · 1명", "서부영업팀=1회 · 1명"], rows)
    n_before = len(calls)
    page.click('#org-levels button[data-org-level="1"]')
    rows = page.evaluate(JS_ORGROWS)
    check("1단계 탭: CTO 3회(2명) · 기업부문 1회", rows == ["CTO=3회 · 2명", "기업부문=1회 · 1명"], rows)
    check("탭 전환은 재조회 없이(API 호출 수 그대로)", len(calls) == n_before, (n_before, len(calls)))
    check("URL # 에 lvl=1 기록", hash_of(page).get("lvl") == ["1"], page.url)
    page.click('#org-levels button[data-org-level="3"]')
    rows = page.evaluate(JS_ORGROWS)
    check("3단계 탭: AI R_D Lab 2 · 빌링Lab 1 · 서부영업팀 1(3단계짜리 경로는 팀이 3단계)", rows == ["AI R_D Lab=2회 · 1명", "빌링Lab=1회 · 1명", "서부영업팀=1회 · 1명"], rows)
    check("조직 정보 없는 세션(s4)은 어느 단계에도 안 잡힘", all("=" in r and not r.startswith("=") for r in rows))

    print("[2] 실행 목록 조직 셀 — 조각 클릭 = 그 단위 필터")
    crumbs = page.evaluate("""() => { const td = document.querySelector('#tbl-sessions td.sess-expand[data-session="s1-aaaa"]').closest('tr').querySelector('td.org-cell');
        return [...td.querySelectorAll('.org-seg')].map(x => x.dataset.filterOrg); }""")
    check("s1 행 조각 = CTO › AI R_D센터 › AI R_D Lab + Foundation리서치팀(회사 제외)", crumbs == ["CTO", "AI R_D센터", "AI R_D Lab", "Foundation리서치팀"], crumbs)
    page.click('#tbl-sessions .org-seg[data-filter-org="AI R_D센터"]'); settle(page)
    check("f-org = AI R_D센터", page.evaluate("() => document.getElementById('f-org').value") == "AI R_D센터")
    rows = page.evaluate(JS_ROWS)
    check("실행 목록 = 센터 소속 3건(s1·s2·s5)", sorted(rows) == ["s1-aaaa", "s2-bbbb", "s5-eeee"], rows)
    check("칩: 조직: AI R_D센터", any(c.startswith("조직: AI R_D센터") for c in page.evaluate(JS_CHIPS)), page.evaluate(JS_CHIPS))
    check("URL # org=AI R_D센터", hash_of(page).get("org") == ["AI R_D센터"], page.url)
    on = page.evaluate("() => [...document.querySelectorAll('#tbl-sessions .org-seg.on')].map(x => x.textContent)")
    check("행마다 현재 필터 단위 조각 강조(.on) 3개", on == ["AI R_D센터"] * 3, on)
    page.click('#org-levels button[data-org-level="2"]')
    check("조직 단계별 차트 2단계 탭에서 그 단위가 active(막대 강조)", page.evaluate("() => !!document.querySelector('#org-levels .hbar.active[data-filter-org=\"AI R_D센터\"]')"),
          page.evaluate(JS_ORGROWS))
    page.click('#tbl-sessions .org-seg[data-filter-org="AI R_D센터"]'); settle(page)
    check("같은 조각 다시 클릭 = 해제(5건)", len(page.evaluate(JS_ROWS)) == 5, page.evaluate(JS_ROWS))
    page.click('#tbl-sessions .org-seg[data-filter-org="Foundation리서치팀"]'); settle(page)
    rows = page.evaluate(JS_ROWS)
    check("팀 조각 클릭 = 그 팀 2건(s1·s5)", sorted(rows) == ["s1-aaaa", "s5-eeee"], rows)
    page.click('#chips .chip'); settle(page)
    check("칩 ✕ 로 해제", page.evaluate("() => document.getElementById('f-org').value") == "" and len(page.evaluate(JS_ROWS)) == 5)

    print("[3] 버전 클릭 = 버전 필터")
    vers = page.evaluate("() => [...document.getElementById('f-ver').options].map(o => o.value)")
    check("필터 바 버전 셀렉트 = 전체·0.8.4.0·0.8.3.0·0.8.2.0(최신순)", vers == ["", "0.8.4.0", "0.8.3.0", "0.8.2.0"], vers)
    page.click('#tbl-sessions td[data-filter-ver="0.8.3.0"]'); settle(page)
    rows = page.evaluate(JS_ROWS)
    check("실행 목록 버전 셀 클릭 → 0.8.3.0 만 1건(s2)", rows == ["s2-bbbb"], rows)
    check("f-ver·칩·URL #", page.evaluate("() => document.getElementById('f-ver').value") == "0.8.3.0"
          and any(c.startswith("버전: 0.8.3.0") for c in page.evaluate(JS_CHIPS)) and hash_of(page).get("ver") == ["0.8.3.0"], page.url)
    check("버전 도입률 범례에 그 버전 강조(.on)", page.evaluate("() => document.querySelector('.legend span.on') && document.querySelector('.legend span.on').textContent.trim()") == "0.8.3.0")
    page.click('.legend span[data-filter-ver="0.8.3.0"]'); settle(page)
    check("범례 다시 클릭 = 해제(5건)", len(page.evaluate(JS_ROWS)) == 5 and page.evaluate("() => document.getElementById('f-ver').value") == "")
    page.click('.legend span[data-filter-ver="0.8.4.0"]'); settle(page)
    rows = page.evaluate(JS_ROWS)
    check("범례 클릭 0.8.4.0 → 3건(s1·s3·s5)", sorted(rows) == ["s1-aaaa", "s3-cccc", "s5-eeee"], rows)
    page.select_option("#f-ver", ""); settle(page)
    check("셀렉트로 전체 복귀", len(page.evaluate(JS_ROWS)) == 5)
    check("구버전(0.8.2.0) 셀은 빨간 강조 유지 + 클릭 가능", page.evaluate("""() => { const td = document.querySelector('#tbl-sessions td[data-filter-ver="0.8.2.0"]');
        return !!td && td.classList.contains('cell-link') && /var\\(--bad\\)/.test(td.getAttribute('style') || ''); }"""))

    print("[4] 오류 목록 이벤트 클릭 → 그 세션만 실행 목록에 + 스크롤 + 상세 펼침")
    page.evaluate("() => window.scrollTo(0, 0)")
    page.click('#tbl-errors td.ev[data-filter-session="s2-bbbb"]')
    page.wait_for_selector('#tbl-sessions tr.row-pinned', timeout=10000)
    page.wait_for_selector('#tbl-sessions tr.sess-detail', timeout=10000)
    rows = page.evaluate(JS_ROWS)
    check("실행 목록 = s2 한 줄", rows == ["s2-bbbb"], rows)
    check("그 행 강조(row-pinned) + zip 링크 보임", page.evaluate("() => { const r = document.querySelector('#tbl-sessions tr.row-pinned'); return !!r && /session=s2-bbbb/.test(r.querySelector('a.zip').href); }"))
    det = page.evaluate("() => (document.querySelector('#tbl-sessions tr.sess-detail') || {}).textContent || ''")
    check("상세 자동 펼침(로그 파일 목록)", "vba_pipeline_trace.jsonl" in det, det[:120])
    try:   # 오류 목록(맨 아래)을 눌렀는데 고정된 세션 행이 화면 안에 들어와야 한다(부드러운 스크롤이라 잠시 기다림)
        page.wait_for_function("""() => { const r = document.querySelector('#tbl-sessions tr.row-pinned').getBoundingClientRect();
            return r.top >= 0 && r.bottom <= window.innerHeight; }""", timeout=5000)
        scrolled = True
    except Exception:
        scrolled = False
    check("고정된 세션 행이 화면 안으로 스크롤됨", scrolled,
          page.evaluate("() => JSON.stringify(document.querySelector('#tbl-sessions tr.row-pinned').getBoundingClientRect()) + ' vh=' + window.innerHeight"))
    check("칩: 세션: s2-bbbb (오류에서 이동)", any(c.startswith("세션: s2-bbbb") for c in page.evaluate(JS_CHIPS)), page.evaluate(JS_CHIPS))
    check("URL # session=s2-bbbb", hash_of(page).get("session") == ["s2-bbbb"], page.url)
    page.click('#tbl-errors td[data-filter-session="s2-bbbb"]:last-child'); settle(page)
    check("같은 세션 다시 클릭 = 고정 해제(5건)", len(page.evaluate(JS_ROWS)) == 5 and "session" not in hash_of(page))
    page.click('#tbl-errors td.ev[data-filter-session="s3-cccc"]'); page.wait_for_selector('#tbl-sessions tr.row-pinned', timeout=10000)
    page.click('#chips .chip'); settle(page)
    check("칩 ✕ 로 해제", len(page.evaluate(JS_ROWS)) == 5)
    page.click('#tbl-errors td.ev[data-filter-session="s3-cccc"]'); page.wait_for_selector('#tbl-sessions tr.row-pinned', timeout=10000)
    page.click('#tbl-sessions tr.row-pinned td[data-filter-user="u3"]'); settle(page)
    check("세션 고정 중 사용자 클릭 → 고정 풀리고 사용자 필터로(혼란 방지)", "session" not in hash_of(page)
          and page.evaluate("() => document.getElementById('f-user').value") == "u3", page.url)
    page.click('#chips .chip'); settle(page)

    print("[5] URL # 복원 — ver·lvl·session")
    # 같은 URL 에 # 만 바꾸면 페이지가 다시 안 뜬다(같은 문서 이동) — 쿼리를 달리해 진짜 새로 연다
    page.goto(BASE + "?r=1#" + RANGE + "&ver=0.8.4.0&lvl=2", wait_until="domcontentloaded"); settle(page)
    rows = page.evaluate(JS_ROWS)
    check("ver=0.8.4.0 복원 → 3건", sorted(rows) == ["s1-aaaa", "s3-cccc", "s5-eeee"] and page.evaluate("() => document.getElementById('f-ver').value") == "0.8.4.0", rows)
    check("lvl=2 복원 → 2단계 탭 선택(버전 필터 적용된 세션 기준: AI R_D센터 2회·1명 · 기업영업그룹 1)",
          page.evaluate("() => document.querySelector('#org-levels .lvl-tabs button.on').dataset.orgLevel") == "2"
          and page.evaluate(JS_ORGROWS) == ["AI R_D센터=2회 · 1명", "기업영업그룹=1회 · 1명"], page.evaluate(JS_ORGROWS))
    page.goto(BASE + "?r=2#" + RANGE + "&session=s3-cccc", wait_until="domcontentloaded"); settle(page)
    check("session=s3 복원 → 1건 + 칩", page.evaluate(JS_ROWS) == ["s3-cccc"] and any(c.startswith("세션: s3-cccc") for c in page.evaluate(JS_CHIPS)))
    page.goto(BASE + "?r=3#" + RANGE + "&session=없는세션", wait_until="domcontentloaded"); settle(page)
    empty = page.evaluate("() => document.querySelector('#tbl-sessions tbody td.empty') && document.querySelector('#tbl-sessions tbody td.empty').textContent")
    check("없는 세션이면 안내(찾지 못했습니다 + 해제 방법)", empty and "찾지 못했습니다" in empty and "✕" in empty, empty)

    print("[6] 기타")
    page.goto(BASE + "?r=4#" + RANGE, wait_until="domcontentloaded"); settle(page)
    txt = page.evaluate("""() => { const td = document.querySelector('#tbl-sessions td.sess-expand[data-session="s1-aaaa"]').closest('tr').querySelector('td.org-cell');
        return td.textContent.replace(/\\s+/g, ' ').trim(); }""")
    check("CSV(textContent)엔 'CTO › AI R_D센터 › AI R_D Lab › Foundation리서치팀' 으로 온전히", txt == "CTO › AI R_D센터 › AI R_D Lab › Foundation리서치팀", txt)
    txt4 = page.evaluate("""() => document.querySelector('#tbl-sessions td.sess-expand[data-session="s4-dddd"]').closest('tr').querySelector('td.org-cell').textContent.trim()""")
    check("조직 정보 없는 세션은 '-'", txt4 == "-", txt4)
    check("페이지 JS 오류 없음", not errors_js, errors_js[:3])
    br.close()
httpd.shutdown()
print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
sys.exit(0 if not fails else 1)
