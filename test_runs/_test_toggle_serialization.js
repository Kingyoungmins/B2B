// [실측 재현] 스텝 ON/OFF 마구잡이 연타 시 'OFF 인데 값이 남는' 유령 상태.
//   원인: 토글 정착(서버 복원/적용)이 비동기인데 직렬화가 없어, 이전 토글이 끝나기 전
//         다음 토글이 통과 → 두 서버 작업이 경합 → 늦게 끝난 쪽이 이김(사용자 실측 2026-08-04).
//   수정: handlePipelineStepToggle 를 큐로 직렬화 + 정착 중 다른 편집은 pipelineEditBusyReason 로 차단.
// 소스(pipeline.js)의 '실제 래퍼/사유 함수'를 추출해 가짜 구현부(impl)로 경합 시나리오를 재현한다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function sliceBalanced(src, startIdx, open, close) {
  let depth = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}
function fn(src, name) {
  const at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const b = src.indexOf("{", at);
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

const bundle = [
  "var window = globalThis;",
  "var _toastLog = []; function toast(m, t) { _toastLog.push(String(m)); }",
  "let _pipelineToggleChain = Promise.resolve();",
  "let _pipelineToggleSettling = 0;",
  fn(pj, "_pipelineCoreBusyReason"),
  fn(pj, "pipelineEditBusyReason"),
  fn(pj, "handlePipelineStepToggle"),
  // 가짜 구현부: 완료 시점을 테스트가 조종한다(실제 impl 대신).
  `var _implLog = [];
   var _implResolvers = {};
   function _handlePipelineStepToggleImpl(stepId) {
     _implLog.push("start:" + stepId);
     return new Promise((resolve, reject) => {
       _implResolvers[stepId] = { resolve: () => { _implLog.push("end:" + stepId); resolve(); },
                                  reject: (e) => { _implLog.push("fail:" + stepId); reject(e); } };
     });
   }`,
  "module.exports = { handlePipelineStepToggle, pipelineEditBusyReason, get log() { return _implLog; }, resolvers: _implResolvers, get toasts() { return _toastLog; }, get settling() { return _pipelineToggleSettling; } };",
].join("\n\n");

const Module = require("module");
const m = new Module("extracted", module);
m._compile(bundle, path.join(__dirname, "_extracted_toggle_queue.js"));
const T = m.exports;

let fails = 0;
function ck(name, cond, got) {
  console.log((cond ? " OK  " : "FAIL ") + name + (cond ? "" : "  got=" + JSON.stringify(got)));
  if (!cond) fails++;
}
const tick = () => new Promise(r => setTimeout(r, 0));

(async () => {
  // ── (1) 직렬화: 연타 3번 → 이전이 끝나기 전엔 다음이 시작되지 않는다 ──
  const p1 = T.handlePipelineStepToggle("s1");
  const p2 = T.handlePipelineStepToggle("s2");
  const p3 = T.handlePipelineStepToggle("s3");
  await tick();
  ck("(1a) 첫 토글만 시작됨(나머지는 큐 대기)",
    T.log.join(",") === "start:s1", T.log);
  ck("(1b) 정착 중 다른 편집은 차단(busyReason)",
    /켜기\/끄기를 반영하는 중/.test(T.pipelineEditBusyReason()), T.pipelineEditBusyReason());

  T.resolvers["s1"].resolve(); await p1; await tick();
  ck("(1c) s1 완료 후에야 s2 시작",
    T.log.join(",") === "start:s1,end:s1,start:s2", T.log);

  T.resolvers["s2"].resolve(); await p2; await tick();
  T.resolvers["s3"].resolve(); await p3; await tick();
  ck("(1d) 전체 순서 보존(경합 없음)",
    T.log.join(",") === "start:s1,end:s1,start:s2,end:s2,start:s3,end:s3", T.log);
  ck("(1e) 모두 정착 후 편집 차단 해제", T.pipelineEditBusyReason() === "", T.pipelineEditBusyReason());

  // ── (2) 실패해도 큐는 계속 흐른다 ──
  const q1 = T.handlePipelineStepToggle("f1");
  const q2 = T.handlePipelineStepToggle("f2");
  await tick();
  T.resolvers["f1"].reject(new Error("서버 복원 실패"));
  await q1.catch(() => {});   // 실패 전파는 호출자 몫
  await tick();
  ck("(2) 실패 뒤에도 다음 토글 실행",
    T.log.slice(-2).join(",") === "fail:f1,start:f2", T.log.slice(-4));
  T.resolvers["f2"].resolve(); await q2; await tick();
  ck("(2b) 실패 큐 정착 후에도 편집 차단 해제",
    T.pipelineEditBusyReason() === "", T.pipelineEditBusyReason());
  // (참고) 'VBA 적용 중 토스트 거절'은 실제 구현부(_handlePipelineStepToggleImpl) 내부 동작이라
  // 가짜 impl 로는 검증 불가 — 여기서는 래퍼(큐·busyReason)만 계약으로 잠근다.

  console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error("HARNESS ERROR:", e); process.exit(1); });

// [행업 감지] 위 시나리오가 어딘가서 영원히 대기하면 노드는 이벤트 루프가 비며 0으로 조용히
// 죽는다(실측: 케이스 하나가 미해결 프로미스로 남아 RESULT 없이 exit 0). RESULT 출력 전
// 종료는 실패로 처리한다.
process.on("exit", (code) => {
  if (code === 0 && !_resultPrinted) {
    console.error("FAIL: RESULT 출력 전에 프로세스가 끝남(미해결 프로미스 행업 의심)");
    process.exitCode = 1;
  }
});
var _resultPrinted = false;
{ const _log = console.log; console.log = (...a) => { if (String(a[0]).includes("=== RESULT")) _resultPrinted = true; return _log(...a); }; }
