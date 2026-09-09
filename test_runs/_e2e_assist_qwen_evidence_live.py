# -*- coding: utf-8 -*-
"""실제 앱(18091) + 실제 Qwen(.108)으로 '근거 없는 수치 가드' 를 검증한다.
   사용자 실측 질문 두 개(검산 / 마진율 최저 3곳)를 던지고: 도구 호출 수, 답의 회사명이 실제 데이터에 있는지,
   숫자가 실제 합계와 맞는지 확인. (질문마다 새 대화로 3회 반복 — Qwen 비결정성 대비)"""
import json, os, sys, time, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright
import openpyxl

E = os.path.dirname(os.path.abspath(__file__))
BASE = "http://127.0.0.1:18091/"
# 정답: 원본 금액 총합, 회사명 집합
wb = openpyxl.load_workbook(os.path.join(E, "input_매출_2026_4월.xlsx"), read_only=True, data_only=True)
ws = wb["매출"]; rows = [r for r in ws.iter_rows(values_only=True) if any(v is not None for v in r)]
hdr = rows[0]; ci = hdr.index("금액"); cn = hdr.index("회사명")
TOTAL = int(sum(float(r[ci]) for r in rows[1:] if isinstance(r[ci], (int, float))))
COMPANIES = set(str(r[cn]).strip() for r in rows[1:] if r[cn])
print("정답 — 원본 금액 총합:", f"{TOTAL:,}", "| 회사 수:", len(COMPANIES))

QS = [
  "회사별요약의 매출 합계가 매출 원본의 총합과 같은지 검산해줘",
  "회사별요약에서 마진율이 가장 낮은 회사 3곳이 어디야?",
]
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
    page.set_input_files("#logic-files", [os.path.join(E, "skill5.zip")])
    page.wait_for_function("(state.pipeline||[]).length >= 5", timeout=60000)
    log("apply:", page.evaluate("""async () => { try { await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true }); return "ok"; } catch (e) { return "ERR " + String(e && e.message || e).slice(0,160); } }"""))

    ASK = """async (q) => {
        state.assist = { history: [] };   // 질문마다 새 대화
        const out = { texts: [], tools: [], nudges: 0 };
        const _t = (typeof traceClientUiEvent === 'function') ? traceClientUiEvent : null;
        window.traceClientUiEvent = (ev, d) => { if (ev === 'assist.nudge') out.nudges++; if (_t) try { _t(ev, d); } catch (_) {} };
        await assistHandleUserMessage(q, {
          onStatus: () => {}, onAssistantText: t => out.texts.push(String(t||"")),
          onToolTrace: (n, r) => out.tools.push(n + (r && r.ok === false ? "✕" : "")),
          onProposal: () => {}, onReport: () => {}, onHandoff: h => out.texts.push("[HANDOFF] " + JSON.stringify(h).slice(0,200)),
        }, null);
        if (_t) window.traceClientUiEvent = _t;
        return out;
    }"""
    summary = []
    for q in QS:
        for k in range(3):
            t0 = time.time()
            out = page.evaluate(ASK, q)
            ans = "\n".join(out["texts"])
            nums = [int(x.replace(",", "")) for x in re.findall(r"\d[\d,]{4,}", ans)]
            names_in_ans = [c for c in COMPANIES if c in ans]
            fake = re.findall(r"\(주\)[가-힣A-Za-z]+", ans)
            fake = [f for f in fake if f not in COMPANIES]
            ok_total = (TOTAL in nums) if q.startswith("회사별요약의 매출") else None
            log(f"[{q[:14]}… #{k+1}] {time.time()-t0:.0f}s tools={len(out['tools'])} nudges={out['nudges']} "
                f"total_ok={ok_total} realNames={len(names_in_ans)} fakeNames={fake[:3]}")
            print("     ", ans[:260].replace("\n", " ⏎ "))
            summary.append((q[:14], k+1, len(out["tools"]), out["nudges"], ok_total, len(names_in_ans), len(fake)))
    br.close()

print("\n=== 요약 (질문, 회차, 도구수, 재촉, 합계일치, 실제회사명수, 가짜회사명수) ===")
for s in summary: print("  ", s)
bad = [s for s in summary if s[2] == 0 or s[6] > 0 or s[4] is False]
print("RESULT:", "ALL PASS" if not bad else f"{len(bad)} 회차 문제")
