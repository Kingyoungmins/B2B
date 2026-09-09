// [0.8.4 — 2026-09-09 실측 2건] 네이티브 팝업 모드에서 AI 도움이 '창만 열리고 아무것도 안 뜸' / '확인 중' 고착.
//
// 원인(CDP 로 네이티브 셸을 직접 구동해 재현):
//  ① 팝업 페이지는 닫아도 살아 있어(숨김/표시) 재오픈 땐 'ready' 가 다시 오지 않는다. 진단 버튼이 보관한
//     질문(_assistPendingAsk)은 ready 에서만 보냈고 popup-opened 에서 폴백 타이머까지 지워 질문이 증발했다.
//  ② 팝업 busy 가 남아 있으면 'ask' 를 조용히 버렸다(if (!busy) submit).
//  ③ 개발망 vLLM 이 .111→.108 로 이전됐는데 기본값이 .111 이라 모든 LLM 호출이 연결 타임아웃 → 3회 재시도로
//     라운드마다 1~2분 매달림. 게다가 dev-vllm /models 탐색 fetch 엔 타임아웃이 없어 그 앞단에서 또 기다렸다.
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "");
const UI = read("scripts/assist-ui.js");
const POPUP = read("scripts/assist-popup.js");
const LLM = read("scripts/llm-api.js");
const CFG = read("scripts/config.js");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
function sliceBalanced(s, i, open, close) {
  let d = 0;
  for (; i < s.length; i++) { if (s[i] === open) d++; else if (s[i] === close) { d--; if (d === 0) return i + 1; } }
  throw new Error("unbalanced");
}

console.log("[1] 브리지 — 재오픈(popup-opened) 때 보관 질문을 보낸다 (실제 핸들러 실행)");
{
  const at = UI.indexOf("function assistHandleBridgeMessage");
  const body = UI.slice(at, sliceBalanced(UI, UI.indexOf("{", at), "{", "}"));
  let seq = 0;
  const make = (readyOnce, pending) => {
    const src = "const sent = []; const timers = [];\n"
      + "let _assistNativeMode = false, _assistNativeAckTimer = null, _assistPopupReadyOnce = " + JSON.stringify(readyOnce)
      + ", _assistPendingAsk = " + JSON.stringify(pending) + ";\n"
      + "const assistSendToPopup = (o) => sent.push(o); const assistSetButtonOn = () => {}; const clearTimeout = () => {};\n"
      + "const setTimeout = (fn, ms) => { timers.push({ fn, ms }); return 1; };\n"
      + "const assistToggleDrawer = () => {}; const assistIsBusy = () => false; const assistAbortCurrent = () => {};\n"
      + "const state = { assist: { history: [] } };\n"
      + body + "\n"
      + "module.exports = { handle: assistHandleBridgeMessage, sent, timers, get pending() { return _assistPendingAsk; }, get readyOnce() { return _assistPopupReadyOnce; } };";
    const m = new Module("bridge-x" + (seq++), module);
    m._compile(src, path.join(__dirname, "_x_bridge" + seq + ".js"));
    return m.exports;
  };
  // A: 이미 ready 였던 팝업 재오픈 → 즉시 ask
  { const r = make(true, "왜 실패했어?"); r.handle({ t: "popup-opened" });
    check("ready 를 한 번 겪은 팝업 재오픈 → ask 즉시 전송", r.sent.some(o => o.t === "ask" && o.text === "왜 실패했어?"), JSON.stringify(r.sent));
    check("보관 질문 비움", r.pending === null); }
  // B: 첫 오픈(ready 전) → 즉시 안 보내고 1.5초 폴백 예약, ready 오면 전송, 폴백은 중복 없음
  { const r = make(false, "왜 실패했어?"); r.handle({ t: "popup-opened" });
    check("첫 오픈은 즉시 보내지 않는다(페이지 로드 전일 수 있음)", !r.sent.some(o => o.t === "ask"));
    check("1.5초 폴백 타이머 예약", r.timers.some(t => t.ms === 1500), JSON.stringify(r.timers.map(t => t.ms)));
    r.handle({ t: "ready" });
    check("ready 도착 → ask 전송 + readyOnce 기록", r.sent.some(o => o.t === "ask") && r.readyOnce === true);
    const before = r.sent.filter(o => o.t === "ask").length; r.timers.forEach(t => t.fn());
    check("폴백 타이머가 나중에 돌아도 중복 전송 없음", r.sent.filter(o => o.t === "ask").length === before); }
  // C: 메인만 새로고침돼 readyOnce 가 지워졌는데 팝업 페이지는 살아 있음(ready 안 옴) → 폴백이 보낸다
  { const r = make(false, "왜 실패했어?"); r.handle({ t: "popup-opened" });
    r.timers.forEach(t => t.fn());
    check("ready 가 안 와도 1.5초 뒤 폴백 전송(팝업 페이지가 이미 로드된 경우)", r.sent.some(o => o.t === "ask"), JSON.stringify(r.sent)); }
  // D: 보관 질문이 없으면 아무것도 안 보낸다
  { const r = make(true, null); r.handle({ t: "popup-opened" }); check("보관 질문 없음 → 전송 없음", r.sent.length === 0); }
}

console.log("[2] 팝업 — busy 여도 진단 'ask' 를 버리지 않는다");
check("busy 면 풀고 안내 후 submit", POPUP.includes('if (busy) { setBusy(false); setStatus(""); addMsg("system", "이전 요청을 중단하고 새 진단을 시작합니다."); }')
  && /case "ask":[\s\S]{0,700}submit\(String\(m\.text \|\| ""\)\);/.test(POPUP));
check("예전 조용한 폐기(if (!busy) submit) 제거", !POPUP.includes('if (!busy) submit(String(m.text || ""));'));

console.log("[3] 죽은 LLM 주소에서 몇 분씩 매달리지 않게");
check("dev-vllm /models 탐색에 4초 타임아웃(AbortController)", /effectiveDevVllmModel[\s\S]{0,1200}setTimeout\(\(\) => \{ try \{ _ac\.abort\(\); \} catch \(_\) \{\} \}, 4000\)/.test(LLM));
check("기본 dev-vllm 주소 .108 로 이전", CFG.includes('baseUrl: "http://192.168.219.108:8000/v1"'));
check("저장 설정의 옛 .111 은 새 기본값으로 승격(레거시 목록)", /DEV_VLLM_LEGACY_BASE_URLS = \[[\s\S]{0,300}"http:\/\/192\.168\.219\.111:8000\/v1"/.test(CFG));
{
  const at = CFG.indexOf("function normalizeDevVllmBaseUrl");
  const body = CFG.slice(at, sliceBalanced(CFG, CFG.indexOf("{", at), "{", "}"));
  const legacyAt = CFG.indexOf("const DEV_VLLM_LEGACY_BASE_URLS");
  const legacy = CFG.slice(legacyAt, CFG.indexOf("];", legacyAt) + 2);
  const fn = new Function("DEFAULTS", legacy + "\n" + body + "\nreturn normalizeDevVllmBaseUrl;")({ devVllm: { baseUrl: "http://192.168.219.108:8000/v1" } });
  check("normalizeDevVllmBaseUrl('.111') → '.108'", fn("http://192.168.219.111:8000/v1") === "http://192.168.219.108:8000/v1", fn("http://192.168.219.111:8000/v1"));
  check("다른 주소는 그대로", fn("http://10.0.0.5:8000/v1") === "http://10.0.0.5:8000/v1");
}

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
