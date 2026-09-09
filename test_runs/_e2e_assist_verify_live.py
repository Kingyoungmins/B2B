# -*- coding: utf-8 -*-
"""[실측 e2e — 수동] 실제 앱 + 실제 LLM 으로 AI 도움 검산 흐름을 끝까지 돌린다(추론 금지 검증용).
   2026-09-09 실측: 원본 1,200행 전체 합산(잘림 없음) + 요약표 합계행 제외 → 두 값 3,797,128,000 일치,
   핸드오프 없이 17초 직답(교안 ② 기대값과 동일).

준비:
  1) 별도 포트로 백엔드 기동(사용자 앱과 분리):
       set B2B_PORT=18091 && set B2B_WRITABLE_APP_DIR=%TEMP%2b_e2e && python serve_b2b.py
  2) 교안 실습 파일 3개(input_매출_2026_4월/input_원가_2026_4월/output_청구서.xlsx)와 4단계 이상 스킬 zip(skill5.zip)을
     한 폴더에 두고 아래 E 를 그 폴더로 지정(기본: 이 파일과 같은 폴더).
  3) keys.local.json 의 anthropicApiKey 사용(Claude). 끝나면 /api/excel/close-all 호출 후 백엔드 종료.
실행: python test_runs/_e2e_assist_verify_live.py ["질문"]
"""
import json, sys, time, os
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

E = os.path.dirname(os.path.abspath(__file__))
ROOT = r"c:\Users\Admin\Desktop\KGM_git\B2B_ver0.8.4"
KEY = json.load(open(os.path.join(ROOT, "keys.local.json"), encoding="utf-8"))["anthropicApiKey"]
BASE = "http://127.0.0.1:18091/"
Q = sys.argv[1] if len(sys.argv) > 1 else "회사별요약의 매출 합계가 매출 원본의 총합과 같은지 검산해줘"

def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)

with sync_playwright() as p:
    br = p.chromium.launch(headless=True)
    page = br.new_page(viewport={"width": 1500, "height": 950})
    page.on("dialog", lambda d: d.accept())
    page.on("console", lambda m: log("[console]", m.type, m.text[:160]) if m.type in ("error",) else None)
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_function("typeof state !== 'undefined' && typeof runPipelineWithAutoRepair === 'function'", timeout=60000)
    log("app loaded")

    # LLM 설정: Claude (런타임 settings 객체 — 이 앱은 anthropic 설정을 localStorage 에서 복원하지 않는다)
    page.evaluate("""(k) => { settings.provider = "anthropic"; settings.apiKey = k;
        settings.model = "claude-opus-4-8"; settings.baseUrl = "https://api.anthropic.com/v1"; }""", KEY)
    log("settings:", page.evaluate("({p: settings.provider, m: settings.model})"))

    # 파일 업로드
    page.set_input_files("#input-files", [os.path.join(E, "input_매출_2026_4월.xlsx"), os.path.join(E, "input_원가_2026_4월.xlsx")])
    page.set_input_files("#output-file", [os.path.join(E, "output_청구서.xlsx")])
    page.wait_for_function("""() => (state.inputs||[]).length >= 2
        && ((state.outputTemplates||[]).some(t => t && t.file) || state.output)
        && Object.keys((typeof excelMirror !== 'undefined' && excelMirror.sessionsByFileId) || {}).length >= 3""", timeout=180000)
    log("files+live sessions ready:", page.evaluate("Object.keys(excelMirror.sessionsByFileId)"))

    # 스킬 로드
    page.set_input_files("#logic-files", [os.path.join(E, "skill5.zip")])
    page.wait_for_function("(state.pipeline||[]).length >= 5", timeout=60000)
    log("pipeline steps:", page.evaluate("state.pipeline.map((s,i)=> (i+1)+':'+String(s.description||s.title||'').slice(0,40))"))

    # 전체 적용(생성기 동기 경로)
    t0 = time.time()
    res = page.evaluate("""async () => {
        try { const r = await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true }); return { ok: true, r: String(r).slice(0,80) }; }
        catch (e) { return { ok: false, err: String(e && e.message || e).slice(0, 300) }; }
    }""")
    log("apply:", res, "in %.0fs" % (time.time() - t0))
    log("statuses:", page.evaluate("state.pipeline.map(s => (getPipelineRuntimeStatus(s.id)||{}).status)"))
    page.screenshot(path=os.path.join(E, "after_apply.png"))

    # AI 도움 질문 — 실제 루프를 await 하고 콜백으로 전부 수집
    t0 = time.time()
    out = page.evaluate("""async (q) => {
        const out = { texts: [], tools: [], status: [], handoff: null, report: null, proposal: null };
        await assistHandleUserMessage(q, {
          onStatus: s => out.status.push(String(s||"")),
          onAssistantText: t => out.texts.push(String(t||"")),
          onToolTrace: (n, r) => out.tools.push({ n, ok: !(r && r.ok === false), err: r && r.error,
              sum: r && r.sum, scanned: r && r.scannedRows, truncated: r && r.truncated, note: r && String(r.note||"").slice(0,160) }),
          onProposal: p => { out.proposal = p; },
          onReport: r => { out.report = r; },
          onHandoff: h => { out.handoff = h; },
        }, null);
        return out;
    }""", Q)
    log("assist done in %.0fs" % (time.time() - t0))
    print("\n=== TOOLS ===")
    for t in out["tools"]: print("  ", json.dumps(t, ensure_ascii=False)[:300])
    print("\n=== ASSISTANT TEXTS ===")
    for t in out["texts"]: print("---\n" + t)
    print("\n=== HANDOFF ===", json.dumps(out["handoff"], ensure_ascii=False)[:600] if out["handoff"] else None)
    print("=== REPORT ===", json.dumps(out["report"], ensure_ascii=False)[:300] if out["report"] else None)
    json.dump(out, open(os.path.join(E, "assist_out.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    page.screenshot(path=os.path.join(E, "after_assist.png"))
    br.close()
