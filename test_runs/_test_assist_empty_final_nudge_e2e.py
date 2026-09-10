# -*- coding: utf-8 -*-
"""[0.8.4 AI 도움 — 2026-09-10 실측] 도구 결과를 받은 직후 모델이 {"action":"final","args":{}} (본문 없음)만 보내
"응답을 정리하지 못했습니다" 로 끝나던 문제 — 실제 앱 루프에서 LLM 만 각본대로 모의해 결정적으로 검증한다.

각본: 1라운드 tool(data.query rank) → 2라운드 빈 final → (재촉) → 3라운드 정상 final.
기대: 사용자에게 보이는 답은 3라운드 본문, 재촉 프롬프트에 '본문이 비어' 가 있고 상한은 1회(두 번 연속 비면 종전 안내).
준비: python serve_b2b.py 가 18091 에 떠 있어야 한다(B2B_PORT=18091). Excel 필요 없음 — 파일 업로드만 한다.
실행: python test_runs/_test_assist_empty_final_nudge_e2e.py
"""
import json, os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "test_data", "시연테스트")
BASE = os.environ.get("B2B_TEST_BASE", "http://127.0.0.1:18091/")

# 백엔드가 안 떠 있으면 직접 띄운다(끝나면 내린다) — registry 일괄 재점검에서도 혼자 돌게
import socket, subprocess, urllib.parse
_port = urllib.parse.urlparse(BASE).port or 80
_spawned = None
def _listening():
    s = socket.socket(); s.settimeout(0.5)
    try: return s.connect_ex(("127.0.0.1", _port)) == 0
    finally: s.close()
if not _listening():
    _spawned = subprocess.Popen([sys.executable, os.path.join(ROOT, "serve_b2b.py")], cwd=ROOT,
                                env=dict(os.environ, B2B_PORT=str(_port)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        if _listening(): break
        time.sleep(1)
    else:
        print("백엔드가 60초 안에 안 떴습니다 (port %d)" % _port); sys.exit(1)
import atexit
atexit.register(lambda: _spawned and (_spawned.kill(), subprocess.call(["taskkill", "/F", "/T", "/PID", str(_spawned.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)))
fails = 0
def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:300]) if (not cond and detail) else ""))
    if not cond: fails += 1

def fence(obj): return "```b2b-action\n" + json.dumps(obj, ensure_ascii=False) + "\n```"
TOOL = fence({"action": "tool", "args": {"tool": "columns.find", "column": "마진율"}})
EMPTY = fence({"action": "final", "args": {}})
GOOD = "마진율이 가장 낮은 3곳은 오리진네트, 네오링크, 메이저텔레콤입니다.\n\n" + fence({"action": "final", "args": {}})

class Script:
    def __init__(self, replies): self.replies = list(replies); self.seen = []   # seen = 각 라운드의 마지막 user 메시지
    def handle(self, route):
        req = route.request
        if req.url.endswith("/models"):
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"data": [{"id": "mock-model"}]}))
        try: body = json.loads(req.post_data or "{}")
        except Exception: body = {}
        msgs = body.get("messages") or []
        self.seen.append(str((msgs[-1] or {}).get("content", ""))[:400] if msgs else "")
        text = self.replies.pop(0) if self.replies else GOOD
        if body.get("stream"):
            chunk = {"choices": [{"delta": {"content": text}, "index": 0}]}
            sse = "data: " + json.dumps(chunk, ensure_ascii=False) + "\n\ndata: [DONE]\n\n"
            return route.fulfill(status=200, content_type="text/event-stream", body=sse)
        return route.fulfill(status=200, content_type="application/json",
                             body=json.dumps({"choices": [{"message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
                                              "usage": {"prompt_tokens": 10, "completion_tokens": 10}}, ensure_ascii=False))

ASK = """async (q) => {
    state.assist = { history: [] };
    const out = { texts: [], nudges: [] };
    const _t = (typeof traceClientUiEvent === 'function') ? traceClientUiEvent : null;
    window.traceClientUiEvent = (ev, d) => { if (ev === 'assist.nudge') out.nudges.push(d && d.kind); if (_t) try { _t(ev, d); } catch (_) {} };
    try {
      await assistHandleUserMessage(q, { onStatus: () => {}, onAssistantText: t => out.texts.push(String(t||"")), onToolTrace: () => {},
                                         onProposal: () => {}, onReport: () => {}, onHandoff: () => {} }, null);
    } finally { if (_t) window.traceClientUiEvent = _t; }
    return out;
}"""

with sync_playwright() as p:
    br = p.chromium.launch(headless=True)
    page = br.new_page(viewport={"width": 1300, "height": 900})
    page.on("dialog", lambda d: d.accept())
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_function("typeof state !== 'undefined' && typeof assistHandleUserMessage === 'function'", timeout=60000)
    page.evaluate("""() => { settings.provider = "openai-compat"; settings.network = "dev-vllm";
        settings.baseUrl = "http://127.0.0.1:19999/v1"; settings.apiKey = "mock"; settings.model = "mock-model"; settings.devModeSet = true; }""")
    xl = os.path.join(E, "input_매출_2026_4월.xlsx")
    if os.path.exists(xl):
        page.set_input_files("#input-files", [xl])
        page.wait_for_function("(state.inputs||[]).length >= 1", timeout=120000)

    print("[1] tool → 빈 final → 재촉 → 정상 final")
    sc = Script([TOOL, EMPTY, GOOD])
    page.route("**/v1/**", sc.handle)
    out = page.evaluate(ASK, "마진율 제일 적은거 3개 뽑아줘")
    ans = "\n".join(out["texts"])
    check("사용자에게 보이는 답 = 3라운드 본문(빈 답/안내 문구 아님)", "오리진네트" in ans and "정리하지 못했습니다" not in ans, ans[:200])
    check("재촉 트레이스 kind=empty-final 1회", out["nudges"].count("empty-final") == 1, out["nudges"])
    check("재촉 프롬프트에 '본문이 비어' + '도구 결과' 안내", any("본문이 비어" in s and "도구 결과" in s for s in sc.seen), sc.seen[-2:])
    check("LLM 호출 3회(tool·빈final·정상final)", len(sc.seen) == 3, len(sc.seen))
    page.unroute("**/v1/**")

    print("[2] 두 번 연속 비면 상한(1회) — 종전 안내로 끝나고 무한 재촉 없음")
    sc2 = Script([EMPTY, EMPTY])
    page.route("**/v1/**", sc2.handle)
    out2 = page.evaluate(ASK, "합계 얼마야")
    ans2 = "\n".join(out2["texts"])
    check("재촉은 1회뿐", out2["nudges"].count("empty-final") == 1, out2["nudges"])
    check("그래도 비면 종전 안내('응답을 정리하지 못했습니다')", "정리하지 못했습니다" in ans2, ans2[:200])
    check("LLM 호출 2회로 끝(무한 루프 아님)", len(sc2.seen) == 2, len(sc2.seen))
    page.unroute("**/v1/**")

    print("[3] 본문 있는 final 은 재촉 없이 그대로")
    sc3 = Script([GOOD])
    page.route("**/v1/**", sc3.handle)
    out3 = page.evaluate(ASK, "마진율 제일 적은거 3개")
    check("재촉 없음 + 본문 그대로", not out3["nudges"] and "오리진네트" in "\n".join(out3["texts"]), (out3["nudges"], out3["texts"][:1]))
    br.close()

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
sys.exit(0 if not fails else 1)
