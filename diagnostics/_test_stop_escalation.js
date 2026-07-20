// [작업 중단 멈춤] 2단 중단(협조 10초 유예 → 강제 재시작) 상태머신 검증.
// 시나리오: 복귀 재적용이 멈춘 COM 큐 뒤에 줄서 영영 안 끝나는 상황을 never-settle promise 로 재현.
// node diagnostics/_test_stop_escalation.js  (유예 10초 테스트 포함 — 약 12초 소요)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
function extractFn(name) {
  const marker = "function " + name + "(";
  let start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  if (src.slice(start - 6, start) === "async ") start -= 6;  // async function 접두 보존
  let p = src.indexOf("(", start), pd = 0;
  for (; p < src.length; p++) {
    if (src[p] === "(") pd++;
    else if (src[p] === ")") { pd--; if (pd === 0) break; }
  }
  let i = src.indexOf("{", p), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

function makeSandbox() {
  const calls = { escalate: 0, restore: 0, toasts: [], progressPolls: 0 };
  // 진행률 스텁: 케이스가 sb.progress 를 바꾸면 그 값이 폴링에 보인다(백엔드 스텝당 갱신 모사).
  const sb = {
    console, setTimeout, clearTimeout, Promise, Date, encodeURIComponent,
    window: {},
    state: { pipeline: [] },
    progress: { ok: true, phase: "running", current: 0, total: 0, syncCurrent: 0, syncTotal: 0 },
    toast: (m) => calls.toasts.push(m),
    renderPipeline: () => {}, refreshRunButton: () => {},
    setPipelineRuntimeStatus: () => {},
    vbaTargetExcelId: () => "ex1",
    forceRestartExcelMirrors: async () => { calls.escalate++; return true; },
    // 진행률 조회와 강제중단(force-restart)은 같은 fetch 를 쓰므로 URL 로 구분한다.
    fetch: async (url) => {
      if (String(url).indexOf("pipeline-progress") >= 0) {
        calls.progressPolls++;
        return { ok: true, json: async () => sb.progress };
      }
      calls.escalate++;
      return { ok: true };
    },
    reapplyVbaPipelineToLive: null, // 케이스별 주입
    calls,
  };
  vm.createContext(sb);
  vm.runInContext(extractFn("fetchExcelPipelineProgress"), sb);
  vm.runInContext(extractFn("excelPipelineProgressSignature"), sb);
  vm.runInContext(extractFn("waitRestoreOrStall"), sb);
  vm.runInContext(extractFn("escalateExcelStopToForceRestart"), sb);
  vm.runInContext(extractFn("requestExcelApplyCancel"), sb);
  return sb;
}
const run = sb => vm.runInContext("requestExcelApplyCancel()", sb);

(async () => {
  // S1: 복귀가 즉시 성공 → 승격 없음
  {
    const sb = makeSandbox();
    sb.reapplyVbaPipelineToLive = async () => { sb.calls.restore++; return { ok: true }; };
    sb.window.__activeVbaApply = { token: { cancelled: false }, excelId: "ex1" };
    const r = await run(sb);
    ck("(S1) 정상 복귀: true + 승격 0", r === true && sb.calls.escalate === 0 && sb.calls.restore === 1, sb.calls);
    ck("(S1) 진행 플래그 해제", sb.window.__excelStopInProgress === false);
  }
  // S2: 복귀가 영영 안 끝나고 '진행도 없음'(멈춘 큐: 복귀가 시작조차 못 함) → 강제 재시작으로 종료
  {
    const sb = makeSandbox();
    sb.reapplyVbaPipelineToLive = () => new Promise(() => {}); // never settles
    sb.progress = { ok: true, phase: "running", current: 0, total: 0, syncCurrent: 0, syncTotal: 0 }; // 요지부동
    sb.window.__activeVbaApply = { token: { cancelled: false }, excelId: "ex1" };
    const t0 = Date.now();
    const r = await run(sb);
    const dt = Date.now() - t0;
    ck("(S2) 무진행 복귀 → 강제 중단으로 종료", r === true && sb.calls.escalate === 1, { r, calls: sb.calls });
    ck("(S2) 정체 판정(~20초) 내외 종료", dt >= 19000 && dt < 30000, dt);
    ck("(S2) 강제 중단 안내 토스트", sb.calls.toasts.some(m => /강제 중단/.test(m)), sb.calls.toasts);
    ck("(S2) 진행률을 실제로 폴링", sb.calls.progressPolls >= 5, sb.calls.progressPolls);
  }
  // S2b: [회귀] '느리지만 진행 중'인 복귀는 승격하면 안 된다 —
  //      예전 10초 고정 유예에선 저사양의 정상 복귀(격리 spawn+리셋+재적용+동기화)가 전부 강제 kill 됐다.
  {
    const sb = makeSandbox();
    let done;
    sb.reapplyVbaPipelineToLive = () => new Promise(res => { done = res; });
    sb.window.__activeVbaApply = { token: { cancelled: false }, excelId: "ex1" };
    // 25초 동안 5초마다 스텝이 하나씩 진행(= 백엔드가 스텝당 진행률 갱신) 후 완료.
    let step = 0;
    const tick = setInterval(() => { sb.progress = { ok: true, phase: "running", current: ++step, total: 6, syncCurrent: 0, syncTotal: 0 }; }, 5000);
    setTimeout(() => { clearInterval(tick); done({ ok: true }); }, 25000);
    const t0 = Date.now();
    const r = await run(sb);
    const dt = Date.now() - t0;
    ck("(S2b) 느린 정상 복귀: 승격 안 함", r === true && sb.calls.escalate === 0, { r, calls: sb.calls });
    ck("(S2b) 복귀 완료까지 기다림(25초)", dt >= 24000 && dt < 32000, dt);
    ck("(S2b) 정상 복귀 토스트", sb.calls.toasts.some(m => /되돌렸습니다/.test(m)), sb.calls.toasts);
  }
  // S2c: 진행하다가 도중에 굳으면(스텝 진행 뒤 정체) 그때는 승격한다.
  {
    const sb = makeSandbox();
    sb.reapplyVbaPipelineToLive = () => new Promise(() => {});
    sb.window.__activeVbaApply = { token: { cancelled: false }, excelId: "ex1" };
    sb.progress = { ok: true, phase: "running", current: 1, total: 6, syncCurrent: 0, syncTotal: 0 };
    setTimeout(() => { sb.progress = { ok: true, phase: "running", current: 2, total: 6, syncCurrent: 0, syncTotal: 0 }; }, 4000);
    // 4초에 한 번 움직이고 그 뒤 영영 정지 → 정체 판정으로 승격
    const t0 = Date.now();
    const r = await run(sb);
    const dt = Date.now() - t0;
    ck("(S2c) 진행하다 굳으면 승격", r === true && sb.calls.escalate === 1, { r, calls: sb.calls });
    ck("(S2c) 마지막 진행 시점 기준으로 판정", dt >= 23000 && dt < 34000, dt);
  }
  // S3: 중단 진행 중 재요청 → 즉시 승격
  {
    const sb = makeSandbox();
    sb.window.__activeVbaApply = null;
    sb.window.__excelStopInProgress = true;
    const r = await run(sb);
    ck("(S3) 재클릭 즉시 강제 승격", r === true && sb.calls.escalate === 1, sb.calls);
  }
  // S4: 복귀가 빠르게 실패 → 기존대로 오류 보고(false)
  {
    const sb = makeSandbox();
    sb.reapplyVbaPipelineToLive = async () => { throw new Error("세션 오류"); };
    sb.window.__activeVbaApply = { token: { cancelled: false }, excelId: "ex1" };
    const r = await run(sb);
    ck("(S4) 빠른 실패는 오류 보고 유지", r === false && sb.calls.escalate === 0, { r, calls: sb.calls });
  }
  // S5: 활성 작업 없음 + 중단 진행 아님 → false (기존 동작)
  {
    const sb = makeSandbox();
    sb.window.__activeVbaApply = null;
    const r = await run(sb);
    ck("(S5) 활성 없음 → false", r === false && sb.calls.escalate === 0);
  }
  console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
  process.exit(fails ? 1 : 0);
})();
