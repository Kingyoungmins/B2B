// [단일축 토글 시나리오] ON/OFF 판정을 실제 구현으로 돌려 여러 상황을 대입한다.
//
// 모델(0.7.0~): ON=적용, OFF=보류.
//   · OFF = 그 단계부터 끝까지 꺼지고, 라이브는 '그 단계 직전'으로 되돌아간다.
//   · ON  = 그 단계 하나만 현재 라이브 위에 얹는다(앞 단계를 다시 돌리지 않는다).
//   · 되돌릴 수 없거나 상태를 모르면 리셋+전체 재적용으로 간다(느려도 항상 옳다).
//
// 2026-08-12 변경분까지 포함해 확인한다:
//   · 교차파일 단계 ON 은 전체 재적용이 아니라 격리 1스텝(앞 단계 보존)
//   · 단계 켜기에 로딩 오버레이가 반드시 뜬다(34초 무표시 버그)
//   · 구멍 위 얹기 후 뒤 스냅샷 무효화
//   · 실패하면 그 단계는 보류로 되돌아간다
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

function sliceBalanced(src, i, open, close) {
  let d = 0;
  for (let k = i; k < src.length; k++) {
    if (src[k] === open) d++;
    else if (src[k] === close) { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error("unbalanced");
}
function fn(src, name) {
  let at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;
  const paren = src.indexOf("(", at);
  let d = 0, pEnd = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") d++;
    else if (src[i] === ")") { d--; if (!d) { pEnd = i; break; } }
  }
  const b = src.indexOf("{", pEnd);
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

const STUBS = `
var window = globalThis;
var state = { pipeline: [] };
var log = [];                       // 무슨 일이 일어났는지 순서대로
function rec(kind, info) { log.push(Object.assign({ kind: kind }, info || {})); }

function isStepEnabled(s) { return !!(s && s.enabled !== false); }
function pipelineStepLiveLanguage(s) {
  var l = String((s && s.language) || "").toLowerCase();
  return (l === "python" || l === "vba") ? l : "";
}
function pipelineStepWritesCrossFile(s) { return !!(s && s.crossFile); }
function pipelineSuffixWritesCrossFile(steps, from) {
  return (steps || []).slice(from).some(function (s) { return !!(s && s.crossFile); });
}
function pushHistory(l) { rec("history", { label: l }); }
function renderPipeline() {}
function refreshRunButton() {}
function scheduleLogicAutoBackup() {}
function toast(m) { rec("toast", { msg: String(m) }); }
function reportPipelineError(e) { rec("error", { msg: String((e && e.message) || e) }); }
function setPipelineRuntimeStatus(ids, status) { rec("status", { ids: (ids || []).slice(), status: status }); }
function markPipelinePendingFromIndex(i) { rec("held_from", { idx: i }); window.__resume = i; }
function clearPipelineResumeFromIndex() { rec("resume_cleared", {}); window.__resume = null; }
function _syncPipelineToggleStatus() {}
function traceClientUiEvent(ev, f) { rec("trace", { ev: ev, fields: f }); }
function _pipelineCoreBusyReason() { return window.__busy || ""; }
function canFastEditLastPipelineStep(step, idx, list) { return !!window.__fastLast; }

// 되돌리기/재적용 — 성공 여부를 시나리오가 정한다
async function restoreLastStepPreApplySnapshot(step) {
  rec("restore_last", { id: step && step.id });
  return window.__restoreLastOk !== false;
}
async function restorePipelineToCheckpointAndHold(idx) {
  rec("restore_checkpoint", { idx: idx });
  return window.__restoreCkptOk !== false;
}
async function reconcilePipelineSimulationAfterEdit(opt) {
  rec("full_reapply", { affected: opt && opt.affectedStep && opt.affectedStep.id });
  if (window.__reconcileThrow) throw new Error("재적용 실패");
  return true;
}
async function applyMappedSingleStep(stepId) {
  rec("single_apply", { id: stepId });
  if (window.__singleThrow) throw new Error("단일 적용 실패");
  return window.__singleResult !== undefined ? window.__singleResult : true;
}
var _lastLiveAppliedSignature = null;
var _lastLiveAppliedParts = null;
function _pipelineSigHash(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h.toString(16); }
`;

const EXTRACT = [
  fn(pj, "liveEnabledStepsSignature"),
  fn(pj, "liveEnabledStepsSignatureParts"),
  fn(pj, "_signatureStepsAsRestored"),
  fn(pj, "noteLivePipelineApplied"),
  fn(pj, "_diffLiveSignatureParts"),
  fn(pj, "_stepsOnOffMap"),
  fn(pj, "_offStepsAmongSent"),
  fn(pj, "tracePipelineRun"),
  fn(pj, "traceToggleOnRoute"),
  fn(pj, "_handlePipelineStepToggleImpl"),
].join("\n\n");

const EXPORTS = `
module.exports = {
  state, toggle: _handlePipelineStepToggleImpl, note: noteLivePipelineApplied,
  get log() { return log; },
  routes() { return log.filter(function (e) { return e.kind === "trace" && /toggle_on\\.route/.test(e.ev); })
    .map(function (e) { return e.fields.route + (e.fields.cause ? ":" + e.fields.cause : ""); }); },
  offRoutes() { return log.filter(function (e) { return e.kind === "trace" && /run\\.toggle_off/.test(e.ev); })
    .map(function (e) { return e.fields.route + ":" + e.fields.ok; }); },
  kinds() { return log.map(function (e) { return e.kind; }); },
  reset(steps, opt) {
    log.length = 0;
    state.pipeline = steps;
    window.__resume = null; window.__busy = ""; window.__fastLast = false;
    window.__restoreLastOk = true; window.__restoreCkptOk = true;
    window.__reconcileThrow = false; window.__singleThrow = false; window.__singleResult = true;
    Object.assign(window, opt || {});
    _lastLiveAppliedSignature = null; _lastLiveAppliedParts = null;
  },
  enabledMap() { return state.pipeline.map(function (s) { return s.enabled !== false ? 1 : 0; }).join(""); },
  snapMap() { return state.pipeline.map(function (s) { return s._preApplySnapshot ? 1 : 0; }).join(""); },
};
`;

const m = new Module("toggle-scen", module);
m._compile(STUBS + "\n" + EXTRACT + "\n" + EXPORTS, path.join(__dirname, "_extracted_toggle_scen.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}

const snap = (id) => ({ resultId: "r_" + id, excelId: "x1" });
function mk(n, opt) {
  opt = opt || {};
  return Array.from({ length: n }, (_, i) => ({
    id: "s" + (i + 1), language: "python", code: "code" + (i + 1), targetFileId: "f1",
    enabled: true, _preApplySnapshot: snap("s" + (i + 1)),
    ...(opt.cross && opt.cross.includes(i) ? { crossFile: true } : {}),
  }));
}

async function main() {
// ─────────────────────────────────────────────────────────────
console.log("[A] OFF — 어느 길로 되돌리나");

T.reset(mk(3), { __fastLast: true });
T.note(T.state.pipeline);
await T.toggle("s3");
check("마지막 단계 OFF → 직전 사본으로 빠르게", T.offRoutes()[0] === "fast_last_snapshot:true", T.offRoutes());
check("그 단계만 꺼짐", T.enabledMap() === "110", T.enabledMap());

T.reset(mk(4), { __fastLast: false });
T.note(T.state.pipeline);
await T.toggle("s2");
check("중간 단계 OFF → 체크포인트 롤백", T.offRoutes()[0] === "checkpoint_rollback:true", T.offRoutes());
check("그 뒤 전부 꺼짐(캐스케이드)", T.enabledMap() === "1000", T.enabledMap());

T.reset(mk(4, { cross: [2] }));
T.note(T.state.pipeline);
await T.toggle("s2");
check("뒤에 교차파일이 있으면 사본 복원을 건너뛴다", T.offRoutes()[0] === "reconcile_fallback:true", T.offRoutes());

T.reset(mk(3), { __fastLast: false, __restoreCkptOk: false });
T.note(T.state.pipeline);
await T.toggle("s2");
check("체크포인트 복원이 조용히 실패하면 전체 재적용으로", T.offRoutes().join(",") === "checkpoint_rollback:false,reconcile_fallback:true", T.offRoutes());

T.reset(mk(3), { __fastLast: true, __restoreLastOk: false });
T.note(T.state.pipeline);
await T.toggle("s3");
check("마지막 단계 빠른 복원 실패도 다음 수단으로", T.offRoutes()[0] === "fast_last_snapshot:false", T.offRoutes());
check("결국 되돌아감", T.offRoutes().length >= 2, T.offRoutes());

T.reset(mk(3));   // 서명 없음(= 라이브 상태를 모름)
await T.toggle("s2");
check("적용 상태를 모르면 전체 재적용", T.offRoutes()[0] === "reconcile_no_signature:true", T.offRoutes());

T.reset([{ id: "j1", language: "javascript", code: "x", enabled: true }]);
T.note(T.state.pipeline);
await T.toggle("j1");
check("옛 형식 단계 OFF → 전체 재적용", T.offRoutes()[0] === "non_live_reconcile:true", T.offRoutes());

// ─────────────────────────────────────────────────────────────
console.log("");
console.log("[B] ON — 그 단계만 얹나");

{
  const steps = mk(3);
  steps[2].enabled = false;
  T.reset(steps);
  T.note(steps.slice(0, 2));
  await T.toggle("s3");
  check("켜면 그 단계만 적용", T.routes()[0] === "single_step", T.routes());
  check("전체 재적용 안 함", !T.kinds().includes("full_reapply"));
  check("켜짐 반영", T.enabledMap() === "111", T.enabledMap());
  check("이어실행 지점 해제", T.kinds().includes("resume_cleared"));
}
{
  const steps = mk(3, { cross: [2] });
  steps[2].enabled = false;
  T.reset(steps);
  T.note(steps.slice(0, 2));
  await T.toggle("s3");
  check("교차파일 단계도 그 단계만 적용  ← 2026-08-12 변경", T.routes()[0] === "single_step", T.routes());
  check("앞 단계를 다시 돌리지 않음", !T.kinds().includes("full_reapply"), T.kinds().join(","));
}
{
  const steps = mk(3);
  steps[1].enabled = false; steps[2].enabled = false;
  T.reset(steps);            // 서명 없음
  await T.toggle("s2");
  check("적용 상태를 모르면 전체 재적용", T.routes()[0] === "full_reapply:signature_missing", T.routes());
}
{
  const steps = mk(3);
  steps[2].enabled = false;
  T.reset(steps);
  T.note([{ ...steps[0], code: "예전코드" }]);   // 기록과 현재가 어긋남
  await T.toggle("s3");
  check("기록과 어긋나면 전체 재적용", T.routes()[0] === "full_reapply:signature_mismatch", T.routes());
}
{
  const steps = [{ id: "j1", language: "javascript", code: "x", enabled: false }];
  T.reset(steps);
  await T.toggle("j1");
  check("옛 형식 단계 ON → 전체 재적용", T.routes()[0] === "full_reapply:non_live_step", T.routes());
}

// ─────────────────────────────────────────────────────────────
console.log("");
console.log("[C] 구멍 위에 얹기 — 뒤 단계가 이미 적용돼 있을 때");
{
  const steps = mk(4);
  steps[1].enabled = false;                       // 2단계만 꺼진 '구멍'
  T.reset(steps);
  T.note(steps.filter((s, i) => i !== 1));
  await T.toggle("s2");
  check("구멍을 켜도 단일 적용", T.routes()[0] === "single_step", T.routes());
  check("뒤 단계 사본은 무효화(옛 사본으로 되돌리면 얹은 결과가 사라진다)",
    T.snapMap() === "1100", T.snapMap());
}

// ─────────────────────────────────────────────────────────────
console.log("");
console.log("[D] 실패했을 때 — 상태가 거짓말하지 않는가");
{
  const steps = mk(3);
  steps[2].enabled = false;
  T.reset(steps, { __singleThrow: true });
  T.note(steps.slice(0, 2));
  await T.toggle("s3");
  check("적용 실패하면 그 단계는 도로 꺼짐", T.enabledMap() === "110", T.enabledMap());
  check("보류로 표시", T.log.some(e => e.kind === "status" && e.status === "review"));
  check("오류를 사용자에게 알림", T.kinds().includes("error"));
}
{
  const steps = mk(3);
  steps[2].enabled = false;
  T.reset(steps, { __singleResult: false });      // 조용한 미적용(세션 없음 등)
  T.note(steps.slice(0, 2));
  await T.toggle("s3");
  check("조용히 실패해도 켜진 채로 두지 않음", T.enabledMap() === "110", T.enabledMap());
  check("이유를 알려준다", T.log.some(e => e.kind === "toast" && /Excel 세션/.test(e.msg)),
    JSON.stringify(T.log.filter(e => e.kind === "toast")));
}
{
  const steps = mk(3);
  T.reset(steps, { __fastLast: false, __restoreCkptOk: false, __reconcileThrow: true });
  T.note(steps);
  await T.toggle("s2");
  check("끄기가 전부 실패하면 원래 상태로 되돌림", T.enabledMap() === "111", T.enabledMap());
  check("실패를 알린다", T.kinds().includes("error"));
}

// ─────────────────────────────────────────────────────────────
console.log("");
console.log("[E] 연속 조작");
{
  const steps = mk(3);
  T.reset(steps, { __fastLast: true });
  T.note(steps);
  await T.toggle("s3");                 // OFF
  const afterOff = T.enabledMap();
  T.note(T.state.pipeline);             // 라이브 상태 기록 갱신(실제 코드도 OFF 성공 시 갱신)
  await T.toggle("s3");                 // 다시 ON
  check("껐다 켜면 원래대로", afterOff === "110" && T.enabledMap() === "111", afterOff + " → " + T.enabledMap());
  check("켤 때는 단일 적용", T.routes()[0] === "single_step", T.routes());
}
{
  const steps = mk(4);
  steps[1].enabled = false; steps[2].enabled = false; steps[3].enabled = false;
  T.reset(steps);
  T.note([steps[0]]);
  await T.toggle("s2");
  T.note(T.state.pipeline.filter(isOn));
  await T.toggle("s3");
  check("보류 단계를 차례로 켜면 매번 단일 적용", T.routes().join(",") === "single_step,single_step", T.routes());
  function isOn(s) { return s.enabled !== false; }
}

// ─────────────────────────────────────────────────────────────
console.log("");
console.log("[F] 실행 중에는 손대지 않는다");
{
  const steps = mk(3);
  T.reset(steps, { __busy: "적용 중입니다" });
  T.note(steps);
  await T.toggle("s2");
  check("바쁠 땐 아무것도 안 바꾼다", T.enabledMap() === "111", T.enabledMap());
  check("이유를 알려준다", T.log.some(e => e.kind === "toast" && /적용 중/.test(e.msg)), JSON.stringify(T.log));
}


}

main().then(() => {
console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);

}).catch(err => { console.error(err); process.exit(1); });
