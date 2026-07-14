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
  const calls = { escalate: 0, restore: 0, toasts: [] };
  const sb = {
    console, setTimeout, clearTimeout, Promise,
    window: {},
    state: { pipeline: [] },
    toast: (m) => calls.toasts.push(m),
    renderPipeline: () => {}, refreshRunButton: () => {},
    setPipelineRuntimeStatus: () => {},
    vbaTargetExcelId: () => "ex1",
    forceRestartExcelMirrors: async () => { calls.escalate++; return true; },
    fetch: async () => { calls.escalate++; return { ok: true }; },
    reapplyVbaPipelineToLive: null, // 케이스별 주입
    calls,
  };
  vm.createContext(sb);
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
  // S2: 복귀가 영영 안 끝남(멈춘 큐) → 10초 뒤 강제 재시작으로 종료
  {
    const sb = makeSandbox();
    sb.reapplyVbaPipelineToLive = () => new Promise(() => {}); // never settles
    sb.window.__activeVbaApply = { token: { cancelled: false }, excelId: "ex1" };
    const t0 = Date.now();
    const r = await run(sb);
    const dt = Date.now() - t0;
    ck("(S2) 무기한 복귀 → 강제 중단으로 종료", r === true && sb.calls.escalate === 1, { r, calls: sb.calls });
    ck("(S2) 유예(~10초) 내외 종료", dt >= 9500 && dt < 20000, dt);
    ck("(S2) 강제 중단 안내 토스트", sb.calls.toasts.some(m => /강제 중단/.test(m)), sb.calls.toasts);
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
