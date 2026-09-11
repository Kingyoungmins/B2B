# -*- coding: utf-8 -*-
"""[0.8.4 AI 도움 — 2026-09-10 실기, 개발망 Qwen(.108) + 백엔드 18091 필요] 사용자 제보 재현: '마진율 제일 적은거 3개 뽑아줘' (시트명 없이, 구어체) 를 실제 앱(18091) + 개발망 Qwen 에 던진다.
   도구 호출(이름·인자·결과 ok/error)을 전부 기록해 '파일 없다' 가 어디서 나오는지 본다. 질문마다 새 대화, N회 반복."""
import json, os, sys, time, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

# 실기 데이터 폴더: input_매출/원가_2026_4월.xlsx, output_청구서.xlsx, 스킬 zip(skill5.zip 또는 skill5_회사별요약_5단계.zip).
# 기본은 같은 remote 의 교육교안 브랜치 폴더(../교육교안). 환경변수 B2B_ASSIST_E2E_DIR 로 바꿀 수 있다.
E = os.environ.get("B2B_ASSIST_E2E_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "교육교안"))
SKILL_ZIP = next((os.path.join(E, n) for n in ("skill5.zip", "skill5_회사별요약_5단계.zip") if os.path.exists(os.path.join(E, n))), os.path.join(E, "skill5.zip"))
BASE = "http://127.0.0.1:18091/"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 3
QS = [q for q in sys.argv[2:]] or ["마진율 제일 적은거 3개 뽑아줘"]
def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)

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
    log("apply:", page.evaluate("""async () => { try { await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true }); return "ok"; } catch (e) { return "ERR " + String(e && e.message || e).slice(0,160); } }"""))
    log("files:", page.evaluate("() => _assistFileList().map(f => f.name + ' [' + (f.sheets||[]).join('|') + ']')"))

    ASK = """async (q) => {
        state.assist = { history: [] };
        const out = { texts: [], tools: [], nudges: 0 };
        const _t = (typeof traceClientUiEvent === 'function') ? traceClientUiEvent : null;
        window.traceClientUiEvent = (ev, d) => { if (ev === 'assist.nudge') out.nudges++; if (_t) try { _t(ev, d); } catch (_) {} };
        out.raw = []; out.strip = [];
        const _parse = assistParseAction;
        window.assistParseAction = function (reply) { out.raw.push(String(reply == null ? "" : reply).slice(0, 1600)); return _parse(reply); };
        const _strip = assistStripPromptEcho;
        window.assistStripPromptEcho = function (v, s, soft) { const r = _strip(v, s, soft); out.strip.push({ inp: String(v == null ? "" : v).slice(0, 800), outp: String(r == null ? "" : r).slice(0, 300) }); return r; };
        const _run = assistRunTool;
        window.assistRunTool = async function (name, args, ...rest) {
          const r = await _run(name, args, ...rest);
          let brief = "";
          try { brief = r && r.ok === false ? ("ERR " + r.error + (r.given ? " given=" + JSON.stringify(r.given) : "") + (r.available ? " avail=" + JSON.stringify(r.available).slice(0,120) : "") + (r.hint ? " hint=" + String(r.hint).slice(0,100) : ""))
                                            : ("ok " + JSON.stringify(r).slice(0, 140)); } catch (_) { brief = String(r).slice(0,100); }
          out.tools.push({ name, args: JSON.stringify(args || {}).slice(0, 160), r: brief });
          return r;
        };
        try {
          await assistHandleUserMessage(q, {
            onStatus: () => {}, onAssistantText: t => out.texts.push(String(t||"")),
            onToolTrace: () => {}, onProposal: () => {}, onReport: () => {},
            onHandoff: h => out.texts.push("[HANDOFF] " + JSON.stringify(h).slice(0,200)),
          }, null);
        } finally { window.assistRunTool = _run; window.assistParseAction = _parse; window.assistStripPromptEcho = _strip; if (_t) window.traceClientUiEvent = _t; }
        return out;
    }"""
    verdicts = []
    for q in QS:
        for k in range(N):
            t0 = time.time()
            out = page.evaluate(ASK, q)
            ans = "\n".join(out["texts"])
            log(f"[{q} #{k+1}] {time.time()-t0:.0f}s tools={len(out['tools'])} nudges={out['nudges']}")
            for t in out["tools"]: print("      tool", t["name"], t["args"], "->", t["r"][:220])
            print("      answer:", ans[:420].replace("\n", " ⏎ "))
            # 답에 등장하는 회사명을 등장 순서대로 — 앞의 셋이 정답 순서와 같아야 한다
            COMPANIES = ["오리진네트", "네오링크", "메이저텔레콤", "미래통신", "테크커넥트", "위즈컴", "퀀텀모바일", "ABC통신", "글로벌네트워크", "아크네트", "라이브셀", "벤티지통신"]
            found = sorted(((ans.find(c), c) for c in COMPANIES if c in ans))
            names = [c for _, c in found][:3]
            ok = names == ["오리진네트", "네오링크", "메이저텔레콤"]
            verdicts.append(ok)
            print("      verdict:", "CORRECT" if ok else "WRONG", names)
            if not ok:
                for i, r in enumerate(out.get("raw", [])): print("      RAW[%d]:" % i, r.replace("\n", " ⏎ ")[:1500])
                for i, s_ in enumerate(out.get("strip", [])): print("      STRIP[%d] in:" % i, s_["inp"].replace("\n", " ⏎ ")[:700], "\n               out:", s_["outp"].replace("\n", " ⏎ ")[:300])
    br.close()
print("RESULT: %d/%d CORRECT" % (sum(verdicts), len(verdicts)))
