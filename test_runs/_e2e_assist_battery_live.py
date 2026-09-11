# -*- coding: utf-8 -*-
"""[0.8.4 AI 도움 — 2026-09-10 실기, 개발망 Qwen(.108) + 백엔드 18091 필요] AI 도움 광역 실기: 실제 앱(18091) + 개발망 Qwen. 스킬 적용 → 마지막 단계에 실패 코드 주입해 실제 오류 발생 →
오류 진단/수정 제안, 스킬 생성 방법, 실데이터 확인, 상태/되돌리기, 다른 달 파일 질문을 대화 단위로 던진다.
도구 호출(이름·인자·결과), 답, 제안 카드(proposal), 설계 채팅 넘김(handoff), 재촉(nudge)을 기록한다."""
import json, os, sys, time, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

# 실기 데이터 폴더: input_매출/원가_2026_4월.xlsx, output_청구서.xlsx, 스킬 zip(skill5.zip 또는 skill5_회사별요약_5단계.zip).
# 기본은 같은 remote 의 교육교안 브랜치 폴더(../교육교안). 환경변수 B2B_ASSIST_E2E_DIR 로 바꿀 수 있다.
E = os.environ.get("B2B_ASSIST_E2E_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "교육교안"))
SKILL_ZIP = next((os.path.join(E, n) for n in ("skill5.zip", "skill5_회사별요약_5단계.zip") if os.path.exists(os.path.join(E, n))), os.path.join(E, "skill5.zip"))
BASE = "http://127.0.0.1:18091/"
def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)

ASK = """async (q) => {
    const out = { texts: [], tools: [], nudges: [], proposals: [], handoffs: [], reports: [] };
    const _t = (typeof traceClientUiEvent === 'function') ? traceClientUiEvent : null;
    window.traceClientUiEvent = (ev, d) => { if (ev === 'assist.nudge') out.nudges.push(d && d.kind); if (_t) try { _t(ev, d); } catch (_) {} };
    const _run = assistRunTool;
    window.assistRunTool = async function (name, args, ...rest) {
      const r = await _run(name, args, ...rest);
      let brief = "";
      try { brief = r && r.ok === false ? ("ERR " + r.error + (r.given ? " given=" + JSON.stringify(r.given) : "") + (r.hint ? " hint=" + String(r.hint).slice(0,80) : ""))
                                        : ("ok " + JSON.stringify(r).slice(0, 150)); } catch (_) { brief = String(r).slice(0,100); }
      out.tools.push({ name, args: JSON.stringify(args || {}).slice(0, 140), r: brief });
      return r;
    };
    try {
      await assistHandleUserMessage(q, {
        onStatus: () => {}, onAssistantText: t => out.texts.push(String(t||"")), onToolTrace: () => {},
        onProposal: p => { try { out.proposals.push({ title: p && (p.title || p.summary || ""), step: p && (p.stepIdx != null ? p.stepIdx + 1 : (p.stepId || null)),
                                                     verify: p && p.verify ? JSON.stringify(p.verify).slice(0, 160) : null, codeLen: p && p.code ? String(p.code).length : 0,
                                                     keys: Object.keys(p || {}).slice(0, 12).join(",") }); } catch (_) { out.proposals.push({ title: "?" }); } },
        onReport: r => out.reports.push(JSON.stringify(r).slice(0, 160)),
        onHandoff: h => out.handoffs.push(JSON.stringify(h).slice(0, 300)),
      }, null);
    } finally { window.assistRunTool = _run; if (_t) window.traceClientUiEvent = _t; }
    return out;
}"""

ONLY = set(a.upper() for a in sys.argv[1:])   # 예: A C → 그 절만
def conv(page, title, questions, fresh=True):
    if ONLY and title[0].upper() not in ONLY: return
    print("\n=== " + title + " ===")
    if fresh: page.evaluate("() => { state.assist = { history: [] }; }")
    for q in questions:
        t0 = time.time()
        out = page.evaluate(ASK, q)
        ans = "\n".join(out["texts"])
        log(f"Q: {q[:90]}{'…' if len(q) > 90 else ''}")
        log(f"   {time.time()-t0:.0f}s tools={len(out['tools'])} nudges={out['nudges']} proposals={len(out['proposals'])} handoffs={len(out['handoffs'])}")
        for t in out["tools"]: print("     tool", t["name"], t["args"], "->", t["r"][:170])
        for p in out["proposals"]: print("     PROPOSAL", p)
        for h in out["handoffs"]: print("     HANDOFF", h)
        print("     A:", ans[:700].replace("\n", " ⏎ "))

with sync_playwright() as p:
    br = p.chromium.launch(headless=True)
    page = br.new_page(viewport={"width": 1400, "height": 900})
    page.on("dialog", lambda d: d.accept())
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_function("typeof state !== 'undefined' && typeof runPipelineWithAutoRepair === 'function'", timeout=60000)
    page.evaluate("""() => { settings.provider = "openai-compat"; settings.network = "dev-vllm";
        settings.baseUrl = "http://192.168.219.108:8000/v1"; settings.apiKey = "khkim";
        settings.model = "Qwen/Qwen3.8-27B-FP8"; settings.devModeSet = true; }""")
    page.set_input_files("#input-files", [os.path.join(E, "input_매출_2026_4월.xlsx"), os.path.join(E, "input_원가_2026_4월.xlsx")])
    page.set_input_files("#output-file", [os.path.join(E, "output_청구서.xlsx")])
    page.wait_for_function("""() => (state.inputs||[]).length >= 2 && ((state.outputTemplates||[]).some(t => t && t.file) || state.output)
        && Object.keys((typeof excelMirror !== 'undefined' && excelMirror.sessionsByFileId) || {}).length >= 3""", timeout=180000)
    page.set_input_files("#logic-files", [SKILL_ZIP])
    page.wait_for_function("(state.pipeline||[]).length >= 5", timeout=60000)
    log("apply(정상):", page.evaluate("""async () => { try { await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true }); return "ok"; } catch (e) { return "ERR " + String(e && e.message || e).slice(0,160); } }"""))
    log("steps:", page.evaluate("() => (state.pipeline||[]).map((s,i) => (i+1) + ':' + String(s.title || s.description || '').slice(0, 40))"))

    # ── 실패 주입: 마지막 단계 코드를 '없는 시트' 참조로 바꾸고 다시 적용 → 실제 오류 발생 + 오류 카드 경로(reportPipelineError)
    inj = page.evaluate("""async () => {
        const steps = state.pipeline || []; const s = steps[steps.length - 1];
        s.__origCode = s.code;
        s.code = 'def transform(ctx):\\n    ws = ctx.sheet("마진요약")   # 존재하지 않는 시트\\n    ctx.write(ws, "A1", [["x"]])\\n';
        try {
          await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true });
          return { ran: "no-error" };
        } catch (e) {
          try { if (typeof reportPipelineError === "function") reportPipelineError(e, {}); } catch (_) {}
          const info = window.__lastPipelineErrorInfo || null;
          return { ran: "error", msg: String(e && e.message || e).slice(0, 200), info: info && { step: info.stepIdx, msg: String(info.message||"").slice(0,160), hasCode: !!info.code } };
        }
    }""")
    log("실패 주입 결과:", json.dumps(inj, ensure_ascii=False)[:400])
    preset = page.evaluate("() => (typeof _assistErrorDiagnoseQuestion === 'function' && window.__lastPipelineErrorInfo) ? _assistErrorDiagnoseQuestion(window.__lastPipelineErrorInfo) : '방금 왜 실패했어?'")

    conv(page, "A. 오류 진단(오류 카드의 [AI 도움에게 진단 요청] 문구 그대로) → 고쳐 달라기", [preset, "그럼 네가 고쳐줘. 원래 이 단계는 회사별요약의 마진율을 채우는 단계였어."])
    conv(page, "B. 스킬 생성 방법(초보 질문) → 새 단계 요청문 만들기", [
        "스킬은 어떻게 만들어? 처음이라 순서를 모르겠어.",
        "원가 파일의 회사별원가합계 시트 값을 요약표 원가 열에 회사명 기준으로 채우는 단계를 추가하고 싶어. 어떻게 요청하면 돼?"])
    conv(page, "C. 실데이터 확인", [
        "회사별요약에 값이 비어 있는 회사 있어?",
        "회사별요약의 원가 열이 원가 파일 회사별원가합계와 같은지 회사 몇 개만 골라서 검산해줘",
        "매출 시트에 상품 종류가 몇 가지야? 제일 많이 팔린 상품은?"])
    conv(page, "D. 상태/되돌리기", ["지금 스킬 단계가 다 적용된 상태야? 안 된 게 있으면 뭐야?", "3단계만 되돌릴 수 있어?"])
    conv(page, "E. 다른 달 파일", ["5월 파일에도 이 스킬 그대로 쓸 수 있어? 뭘 고쳐야 해?"])
    br.close()
print("\nDONE")
