# -*- coding: utf-8 -*-
"""[실측 e2e — 수동] 네이티브 팝업 모드 AI 도움. 사전: $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9333" 로 B2B_NativeHost.exe 기동, 교안 xlsx 3개 + skill5.zip 을 이 파일 옆(E)에. 실행: python test_runs/_e2e_native_popup_assist_live.py
   수정본(assist-ui/assist-popup/llm-api)을 페이지 새로고침으로 싣고, 올바른 vLLM(.108)으로
   사용자 시나리오 두 개를 네이티브 팝업 모드에서 끝까지 돌린다.
   A) 진단 프리셋(assistOpenAndAsk) — 팝업이 '이미 열렸다 닫힌' 상태에서 눌러도 질문이 뜨고 답이 오는가
   B) 팝업에 직접 검산 질문 입력 — Qwen 으로 답이 오는가(멈춤 없이)"""
import json, os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

E = os.path.dirname(os.path.abspath(__file__))
Q_DIAG = ("방금 새 단계를 만들다가 오류로 실패했어(실패해서 스킬 목록에는 안 들어갔어). step.error 로 실제 오류를 읽고, "
          "chat.history 에서 내가 뭘 요청했는지 확인해서 왜 실패했는지 쉽게 설명해줘.")
Q_VERIFY = "회사별요약의 매출 합계가 매출 원본의 총합과 같은지 검산해줘"
SET = """() => { settings.provider = "openai-compat"; settings.network = "dev-vllm";
    settings.baseUrl = "http://192.168.219.108:8000/v1"; settings.apiKey = "khkim";
    settings.model = "Qwen/Qwen3.8-27B-FP8"; settings.devModeSet = true;
    try { _devVllmModelCache = { base: "", model: "", at: 0 }; } catch (_) {}
    return effectiveOpenAICompatBaseUrl(); }"""

def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)

with sync_playwright() as p:
    br = p.chromium.connect_over_cdp("http://127.0.0.1:9333")
    ctx = br.contexts[0]
    main = next(pg for pg in ctx.pages if "index.html" in pg.url)
    net = []
    def hook(pg, tag):
        pg.on("pageerror", lambda e: net.append((time.strftime("%H:%M:%S"), tag, "pageerror", str(e)[:200])))
        pg.on("requestfailed", lambda r: net.append((time.strftime("%H:%M:%S"), tag, "reqfail", r.url[:110] + " :: " + str(r.failure)[:60])) if "__b2b_ping" not in r.url else None)
    # 팝업 닫기(토글) → 팝업 페이지 새로고침(assist-popup.js 수정본) → 메인 새로고침(assist-ui.js 수정본)
    if main.evaluate("_assistNativeMode"):
        main.evaluate('assistPostToHost("B2B_ASSIST_POPUP\\ttoggle")'); time.sleep(1.5)
    for pg in ctx.pages:
        if "assist.html" in pg.url:
            try: pg.reload(wait_until="domcontentloaded", timeout=15000); log("popup page reloaded")
            except Exception as e: log("popup reload err", str(e)[:80])
    main.reload(wait_until="domcontentloaded", timeout=60000)
    main.wait_for_function("typeof state !== 'undefined' && typeof runPipelineWithAutoRepair === 'function' && typeof assistOpenAndAsk === 'function'", timeout=60000)
    hook(main, "main")
    log("main reloaded; effective base =", main.evaluate(SET))
    main.set_input_files("#input-files", [os.path.join(E, "input_매출_2026_4월.xlsx"), os.path.join(E, "input_원가_2026_4월.xlsx")])
    main.set_input_files("#output-file", [os.path.join(E, "output_청구서.xlsx")])
    main.wait_for_function("""() => (state.inputs||[]).length >= 2 && ((state.outputTemplates||[]).some(t => t && t.file) || state.output)
        && Object.keys((typeof excelMirror !== 'undefined' && excelMirror.sessionsByFileId) || {}).length >= 3""", timeout=180000)
    main.set_input_files("#logic-files", [os.path.join(E, "skill5.zip")])
    main.wait_for_function("(state.pipeline||[]).length >= 5", timeout=60000)
    log("apply:", main.evaluate("""async () => { try { await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true }); return "ok"; } catch (e) { return "ERR " + String(e && e.message || e).slice(0,160); } }"""))
    log("settings after apply:", main.evaluate("({b: settings.baseUrl, eff: effectiveOpenAICompatBaseUrl(), m: settings.model})"))

    def find_popup(timeout=40):
        t0 = time.time()
        while time.time() - t0 < timeout:
            c = [pg for pg in ctx.pages if "assist.html" in pg.url]
            if c: return c[0]
            time.sleep(0.5)
        return None

    def snap(popup):
        return popup.evaluate("""() => ({
            status: (document.getElementById('assist-status')||{}).textContent || '',
            send: (document.getElementById('assist-send')||{}).textContent || '',
            n: document.querySelectorAll('#assist-messages .assist-msg').length,
            msgs: Array.from(document.querySelectorAll('#assist-messages .assist-msg')).map(e => e.className.replace('assist-msg','').trim() + ': ' + e.textContent.slice(0,200)),
        })""")

    def observe(popup, tag, seconds, min_msgs):
        last = None; t0 = time.time()
        while time.time() - t0 < seconds:
            time.sleep(2)
            try: st = snap(popup)
            except Exception as e: log(tag, "eval err", str(e)[:80]); continue
            busy = main.evaluate("assistIsBusy()")
            key = (st["status"], st["send"], st["n"], busy)
            if key != last:
                log(tag, f"status={st['status']!r} send={st['send']!r} msgs={st['n']} mainBusy={busy} last={(st['msgs'][-1][:110] if st['msgs'] else '')!r}")
                last = key
            if st["n"] >= min_msgs and not busy and st["send"] == "전송" and not st["status"].strip():
                log(tag, "== 종료 == (%.0fs)" % (time.time() - t0)); return st
        log(tag, "== 시간 만료(진행 없음) =="); return snap(popup)

    # 팝업을 '한 번 열었다 닫은' 상태 만들기(사용자 상황) — 토글 두 번
    main.evaluate('assistPostToHost("B2B_ASSIST_POPUP\\ttoggle")'); time.sleep(4)
    log("popup opened once; nativeMode=", main.evaluate("_assistNativeMode"))
    main.evaluate('assistPostToHost("B2B_ASSIST_POPUP\\ttoggle")'); time.sleep(2)
    log("popup closed; nativeMode=", main.evaluate("_assistNativeMode"), "readyOnce=", main.evaluate("typeof _assistPopupReadyOnce !== 'undefined' ? _assistPopupReadyOnce : 'n/a'"))

    log("A) 진단 프리셋 → assistOpenAndAsk")
    main.evaluate("(q) => assistOpenAndAsk(q)", Q_DIAG)
    popup = find_popup(30)
    if popup:
        hook(popup, "popup")
        time.sleep(3); st = snap(popup); log("A) 3초 후 msgs:", st["n"], [m[:60] for m in st["msgs"][-2:]])
        stA = observe(popup, "[A]", 300, 2)
        print("\n".join("   " + m for m in stA["msgs"][-4:]))
    else:
        log("A) 팝업 못 찾음")

    if popup:
        log("B) 팝업에 직접 검산 질문")
        n0 = snap(popup)["n"]
        popup.fill("#assist-text", Q_VERIFY); popup.click("#assist-send")
        stB = observe(popup, "[B]", 360, n0 + 2)
        print("\n".join("   " + m for m in stB["msgs"][-5:]))

    print("\n=== 네트워크 실패/페이지 오류 ===")
    for r in net[-25:]: print("  ", r)
    log("final inflight=", main.evaluate("assistIsBusy()"))
