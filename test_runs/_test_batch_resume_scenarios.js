// [보류 일괄 실행 × 토글] 배치가 끝난 '뒤'에 켜고 끄는 것이 여전히 빠른 길로 가는가.
//
// 왜 따로 두나: _test_batch_resume.js 는 배치 자체의 계약(체크 반영·거부·실패 정리)을 본다.
// 그런데 사용자가 실제로 겪는 흐름은 '배치로 몇 개 되살린 다음 또 켜고 끄는' 것이고,
// 그때 라이브 적용 기록(_lastLiveAppliedSignature)이 어긋나면 그 뒤 모든 토글이
// 리셋+전체 재적용으로 떨어진다(VM 실측 4분 35초의 원인과 같은 계열).
// 2026-08-12 에 서명 기록을 '되돌린 뒤의 모습'으로 환산하도록 고쳤으므로, 배치 뒤에도
// 그 정합이 유지되는지 여기서 잠근다.
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
var log = [];
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
function pipelineHasBackendOnlyStep() { return false; }
function pipelineStepLabel(s, i) { return (i + 1) + "단계"; }
function getPipelineResumeFromIndex() { return window.__resume; }
function setPipelineRuntimeStatus(ids, st) { rec("status", { ids: (ids || []).slice(), status: st }); }
function getPipelineRuntimeStatus(id) { return window.__statusOf ? window.__statusOf(id) : null; }
function markPipelinePendingFromIndex(i) { rec("held_from", { idx: i }); window.__resume = i; }
function clearPipelineResumeFromIndex() { rec("resume_cleared", {}); window.__resume = null; }
function pushHistory(l) { rec("history", { label: l }); }
function renderPipeline() {}
function refreshRunButton() {}
function refreshBatchResumeButton() {}
function scheduleLogicAutoBackup() {}
function toast(m) { rec("toast", { msg: String(m) }); }
function reportPipelineError(e) { rec("error", { msg: String((e && e.message) || e) }); }
function _syncPipelineToggleStatus() {}
function _pipelineCoreBusyReason() { return window.__busy || ""; }
function canFastEditLastPipelineStep() { return !!window.__fastLast; }
function traceClientUiEvent(ev, f) { rec("trace", { ev: ev, fields: f }); }
function pipelineFailedStepIdFromError(e) { return (e && e.failedId) || null; }
async function restoreLastStepPreApplySnapshot(step) { rec("restore_last", { id: step && step.id }); return window.__restoreLastOk !== false; }
async function restorePipelineToCheckpointAndHold(i) { rec("restore_checkpoint", { idx: i }); return window.__restoreCkptOk !== false; }
async function reconcilePipelineSimulationAfterEdit(o) { rec("full_reapply", { affected: o && o.affectedStep && o.affectedStep.id }); return true; }
async function applyMappedSingleStep(id) { rec("single_apply", { id: id }); return window.__singleResult !== undefined ? window.__singleResult : true; }
// 배치가 부르는 실행기 — 시나리오가 성공/실패를 정한다
async function runPipelineSuffixFromCheckpoint(start, opt) {
  rec("suffix_run", { start: start, enabled: state.pipeline.map(function (s) { return s.enabled !== false ? 1 : 0; }).join("") });
  if (window.__suffixThrow) { var e = new Error("실행 실패"); e.failedId = window.__failedId || null; throw e; }
  return { ok: true };
}
// liveUnknown(방금 불러온 스킬) 일 때 배치가 타는 '원본부터 전체 재적용' 경로
function vbaTargetExcelId() { return window.__excelId || "ex1"; }
function currentExcelId() { return window.__excelId || "ex1"; }
async function reapplyVbaPipelineToLive(excelId) {
  rec("reapply_all", { excelId: excelId,
    enabled: state.pipeline.map(function (s) { return s.enabled !== false ? 1 : 0; }).join("") });
  return { ok: true };
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
  fn(pj, "pipelineHeldBatchInfo"),
  fn(pj, "_runHeldStepsBatchImpl"),
  fn(pj, "_handlePipelineStepToggleImpl"),
].join("\n\n");

const EXPORTS = `
module.exports = {
  state,
  batch: _runHeldStepsBatchImpl,
  info: pipelineHeldBatchInfo,
  toggle: _handlePipelineStepToggleImpl,
  note: noteLivePipelineApplied,
  get log() { return log; },
  routes() { return log.filter(function (e) { return e.kind === "trace" && /toggle_on\\.route/.test(e.ev); })
    .map(function (e) { return e.fields.route + (e.fields.cause ? ":" + e.fields.cause : ""); }); },
  kinds() { return log.map(function (e) { return e.kind; }); },
  enabledMap() { return state.pipeline.map(function (s) { return s.enabled !== false ? 1 : 0; }).join(""); },
  snapMap() { return state.pipeline.map(function (s) { return s._preApplySnapshot ? 1 : 0; }).join(""); },
  reset(steps, resume, opt) {
    log.length = 0; state.pipeline = steps; window.__resume = resume;
    window.__busy = ""; window.__fastLast = false; window.__suffixThrow = false;
    window.__restoreLastOk = true; window.__restoreCkptOk = true; window.__singleResult = true;
    window.__statusOf = function () { return { status: "applied" }; };
    Object.assign(window, opt || {});
    _lastLiveAppliedSignature = null; _lastLiveAppliedParts = null;
  },
};
`;

const m = new Module("batch-scen", module);
m._compile(STUBS + "\n" + EXTRACT + "\n" + EXPORTS, path.join(__dirname, "_extracted_batch_scen.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}

function mk(n, opt) {
  opt = opt || {};
  return Array.from({ length: n }, (_, i) => ({
    id: "s" + (i + 1), language: "python", code: "code" + (i + 1), targetFileId: "f1",
    enabled: !(opt.off || []).includes(i),
    _preApplySnapshot: { resultId: "r" + (i + 1), excelId: "x1" },
    ...((opt.cross || []).includes(i) ? { crossFile: true } : {}),
  }));
}
const heldIds = (info) => info.held.map(h => h.step.id);

async function main() {
console.log("[1] 보류 구간을 골라 되살린다");
{
  T.reset(mk(5, { off: [2, 3, 4] }), 2);
  const info = T.info();
  check("보류 3개를 잡는다", heldIds(info).join(",") === "s3,s4,s5", heldIds(info));
  await T.batch(["s3", "s4", "s5"], { start: 2, heldIds: heldIds(info) });
  check("전부 켜짐", T.enabledMap() === "11111", T.enabledMap());
  check("한 번에 실행", T.kinds().filter(k => k === "suffix_run").length === 1, T.kinds().join(","));
  check("이어실행 지점 해제", T.kinds().includes("resume_cleared"));
}

console.log("");
console.log("[2] 일부만 골라 되살린다 — 구멍을 남긴다");
{
  T.reset(mk(5, { off: [2, 3, 4] }), 2);
  const info = T.info();
  await T.batch(["s3", "s5"], { start: 2, heldIds: heldIds(info) });
  check("고른 것만 켜짐", T.enabledMap() === "11101", T.enabledMap());
  check("건너뛴 단계의 낡은 사본은 제거", T.snapMap()[3] === "0", T.snapMap());
}

console.log("");
console.log("[3] 배치 뒤에 또 켜고 끌 때 — 여기가 이번 검증의 목적");
{
  // 배치로 3·4단계를 되살린 뒤, 남겨둔 5단계를 켜면 '그 단계만' 적용돼야 한다.
  T.reset(mk(5, { off: [2, 3, 4] }), 2);
  const info = T.info();
  await T.batch(["s3", "s4"], { start: 2, heldIds: heldIds(info) });
  check("배치 후 상태", T.enabledMap() === "11110", T.enabledMap());
  const before = T.kinds().filter(k => k === "full_reapply").length;
  await T.toggle("s5");
  check("남은 보류를 켜면 단일 적용", T.routes()[0] === "single_step", T.routes());
  check("전체 재적용으로 새지 않는다  ← 서명 정합", T.kinds().filter(k => k === "full_reapply").length === before,
    T.kinds().join(","));
}
{
  // 배치 직후 '끄기'도 빠른 길로 가야 한다(적용 기록이 살아 있어야 가능).
  T.reset(mk(4, { off: [2, 3] }), 2, { __fastLast: false });
  const info = T.info();
  await T.batch(["s3", "s4"], { start: 2, heldIds: heldIds(info) });
  await T.toggle("s3");
  const offRoutes = T.log.filter(e => e.kind === "trace" && /run\.toggle_off/.test(e.ev))
    .map(e => e.fields.route + ":" + e.fields.ok);
  check("배치 직후 끄기가 사본 롤백으로", offRoutes[0] === "checkpoint_rollback:true", offRoutes);
  check("적용 상태를 모른다고 하지 않는다", !offRoutes.some(r => r.startsWith("reconcile_no_signature")), offRoutes);
}

console.log("");
console.log("[4] 일부만 되살린 뒤 — 남은 보류는 하나씩 켠다(설계된 동작)");
{
  T.reset(mk(6, { off: [2, 3, 4, 5] }), 2);
  const info = T.info();
  await T.batch(["s3", "s4"], { start: 2, heldIds: heldIds(info) });
  check("고른 것만 켜짐", T.enabledMap() === "111100", T.enabledMap());
  // [계약 변경 2026-08-13] 예전엔 여기서 이어실행 지점이 사라져 배치 버튼도 같이 숨었다.
  // 실행기에 '처음부터 꺼진 채 저장된 스킬'이 들어오면 버튼이 아예 안 보이는 문제가 같은 뿌리라
  // 버튼은 '꺼진 단계가 있으면' 항상 보이게 바꿨다. 대신 어떻게 도느냐를 나눈다.
  //   구멍이 생긴 순간 '라이브 = 앞에서부터 연속 적용'이라는 전제가 깨지므로 이어실행 지점은
  //   여전히 안 세운다 → liveUnknown=true → 다음 배치는 원본부터 전부(느리지만 항상 옳다).
  {
    const after = T.info();
    check("버튼은 계속 보인다(남은 보류가 있으니)", after.ok === true, JSON.stringify(after).slice(0, 160));
    check("구멍이 있으면 '앞단계 적용됨'을 주장하지 않는다", after.liveUnknown === true, JSON.stringify(after).slice(0, 160));
    check("시작 지점은 남은 첫 보류 단계", after.start === 4, after.start);
  }
  await T.toggle("s5");
  check("남은 보류는 단일 적용으로 얹힌다", T.routes()[0] === "single_step", T.routes());
  check("전체 재적용으로 새지 않는다", !T.kinds().includes("full_reapply"), T.kinds().join(","));
  check("결과", T.enabledMap() === "111110", T.enabledMap());
}
{
  // 전부 고른 배치는 라이브가 여전히 연속이므로 문제 없이 끝난다.
  T.reset(mk(5, { off: [2, 3, 4] }), 2);
  const info = T.info();
  await T.batch(heldIds(info), { start: 2, heldIds: heldIds(info) });
  check("전부 고르면 전부 켜짐", T.enabledMap() === "11111", T.enabledMap());
  check("한 번만 실행", T.kinds().filter(k => k === "suffix_run").length === 1);
}

console.log("");
console.log("[5] 교차파일이 섞이면 부분 선택 금지");
{
  T.reset(mk(5, { off: [2, 3, 4], cross: [3] }), 2);
  const info = T.info();
  check("교차파일 구간으로 인식", info.crossFile === true, JSON.stringify({ crossFile: info.crossFile }));
  const before = T.enabledMap();
  await T.batch(["s3"], { start: 2, heldIds: heldIds(info) });
  check("일부만 고르면 거부", T.enabledMap() === before, T.enabledMap());
  check("이유를 알려준다", T.log.some(e => e.kind === "toast"), JSON.stringify(T.log.filter(e => e.kind === "toast")));
  await T.batch(["s3", "s4", "s5"], { start: 2, heldIds: heldIds(info) });
  check("전부 고르면 실행", T.enabledMap() === "11111", T.enabledMap());
}

console.log("");
console.log("[6] 실행이 실패하면 — 성공분만 남기고 정직하게");
{
  T.reset(mk(5, { off: [2, 3, 4] }), 2, {
    __suffixThrow: true, __failedId: "s4",
    __statusOf: (id) => ({ status: id === "s3" ? "applied" : "review" }),
  });
  const info = T.info();
  await T.batch(["s3", "s4", "s5"], { start: 2, heldIds: heldIds(info) });
  check("적용된 것만 켜진 채로", T.enabledMap() === "11100", T.enabledMap());
  check("실패 단계는 오류로 표시", T.log.some(e => e.kind === "status" && e.status === "error"), JSON.stringify(T.log.filter(e => e.kind === "status")));
  check("나머지는 보류로", T.log.some(e => e.kind === "status" && e.status === "review"));
  check("사용자에게 알림", T.kinds().includes("error"));
}

console.log("");
console.log("[7] 상태가 바뀐 채 실행하면 취소한다(모달 떠 있는 사이 변경)");
{
  T.reset(mk(5, { off: [2, 3, 4] }), 2);
  const before = T.enabledMap();
  await T.batch(["s3", "s4", "s5"], { start: 2, heldIds: ["s3", "s4"] });   // 지문 불일치
  check("실행하지 않는다", T.enabledMap() === before, T.enabledMap());
  check("바뀌었다고 알려준다", T.log.some(e => e.kind === "toast" && /바뀌/.test(e.msg)),
    JSON.stringify(T.log.filter(e => e.kind === "toast")));
}

console.log("");
console.log("[8] 실행 중에는 배치도 막힌다");
{
  T.reset(mk(4, { off: [2, 3] }), 2, { __busy: "적용 중입니다" });
  const before = T.enabledMap();
  await T.batch(["s3", "s4"], { start: 2, heldIds: ["s3", "s4"] });
  check("아무것도 안 바꾼다", T.enabledMap() === before, T.enabledMap());
}

console.log("");
console.log("[9] 실행기에 '처음부터 꺼진 채 저장된 스킬'이 들어왔을 때  ← 제보 건");
{
  // 저장 스킬은 스위치(enabled)만 갖고 들어온다. 이어실행 지점은 런타임 상태라 저장되지 않고,
  // 불러올 때 일부러 지운다(옛 스킬의 지점이 새 스킬에 살아남는 사고 방지). 그래서 예전엔
  // 보류 단계가 뻔히 보이는데 버튼이 안 떴다.
  T.reset(mk(5, { off: [3, 4] }), null);      // resume 없음 = 방금 불러온 상태
  const info = T.info();
  check("버튼이 뜬다(꺼진 단계가 있으니)", info.ok === true, JSON.stringify(info).slice(0, 120));
  check("시작 지점을 꺼진 첫 단계로 잡는다", info.start === 3, info.start);
  check("앞단계가 적용됐다고 주장하지 않는다", info.liveUnknown === true, info.liveUnknown);

  T.reset(mk(5, { off: [3, 4] }), null);
  const i2 = T.info();
  await T.batch(["s4", "s5"], { start: i2.start, heldIds: heldIds(i2) });
  check("고른 단계가 켜진다", T.enabledMap() === "11111", T.enabledMap());
  // liveUnknown 이면 구간 이어실행이 아니라 '원본부터 전체 재적용'으로 가야 한다 —
  // 앞단계가 파일에 없는데 뒷단계만 얹으면 결과가 조용히 틀린다.
  check("구간 이어실행이 아니라 처음부터 다시 적용한다",
    T.kinds().includes("reapply_all") && !T.kinds().includes("suffix_run"), T.kinds().join(","));
  check("다 켜졌으면 버튼이 사라진다", T.info().ok === false, JSON.stringify(T.info()).slice(0, 120));
}

console.log("");
console.log("[10] 전부 켜진 스킬은 버튼이 안 뜬다(오작동 방지)");
{
  T.reset(mk(4), null);
  check("보류가 없으면 안 뜬다", T.info().ok === false, JSON.stringify(T.info()).slice(0, 120));
}
}

main().then(() => {
  console.log("");
  console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}).catch(err => { console.error(err); process.exit(1); });
