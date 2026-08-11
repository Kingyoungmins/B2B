// [진단 계측 2026-08-11] 단계 ON 이 '그 단계만 적용'으로 갔는지, '리셋+1단계부터 전체 재적용'으로
// 떨어졌는지, 후자면 왜인지를 로그로 남긴다.
//
// 배경(실사용 로그 B2B_SmartBilling_logs, 8/11 09:24): 단계 하나를 켰는데 리셋 2회 + 1~3단계
// 재실행 + 대상 단계 실행으로 3분 59초가 걸렸다. 원인 후보가 4개(비라이브/서명없음/서명불일치/
// 교차파일)인데 판정부에 기록이 하나도 없어 사후 판별이 불가능했다.
//
// 이 테스트가 잠그는 것
//   1. 판정 로직은 그대로다(계측이 분기를 바꾸지 않는다)
//   2. 네 갈래 각각이 정확한 cause 로 기록된다
//   3. 정상(단일 적용) 경로도 기록된다 — 없으면 '몇 번 중 몇 번'을 알 수 없다
//   4. 불일치일 때 '무엇이 달라졌는지'까지 남는다(파일/코드/켜짐/순서)
//   5. 코드 전문은 로그에 남기지 않는다(해시만)
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

function sliceBalanced(src, startIdx, open, close) {
  let d = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === open) d++;
    else if (ch === close) { d--; if (d === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}
function fn(src, name) {
  let at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;
  const paren = src.indexOf("(", at);
  let d = 0, paramEnd = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") d++;
    else if (src[i] === ")") { d--; if (d === 0) { paramEnd = i; break; } }
  }
  const b = src.indexOf("{", paramEnd);
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

const STUBS = `
var window = globalThis;
var state = { pipeline: [], runnerMappingChecked: false, runnerMappingRunActive: false };
var _traces = [];
function traceClientUiEvent(event, fields) { _traces.push({ event: event, fields: fields }); }
function isStepEnabled(s) { return !!(s && s.enabled !== false); }
function pipelineStepLiveLanguage(s) {
  var l = String((s && s.language) || "").toLowerCase();
  return (l === "python" || l === "vba") ? l : "";
}
var _lastLiveAppliedSignature = null;
var _lastLiveAppliedParts = null;
`;

const EXTRACT = [
  fn(pj, "_pipelineSigHash"),
  fn(pj, "liveEnabledStepsSignature"),
  fn(pj, "liveEnabledStepsSignatureParts"),
  fn(pj, "_diffLiveSignatureParts"),
  fn(pj, "traceToggleOnRoute"),
].join("\n\n");

// 판정 분기 자체(3735~)는 async 토글 함수 안에 인라인이라, 그 조건식을 원문에서 그대로 떼어
// 재현한다 — 조건식이 바뀌면 아래 정규식 검증에서 깨진다.
const DECIDE = `
function decideToggleOnRoute(currentIdx, stepId, toggledStep, beforeToggleSnapshot, crossFileFn) {
  if (!pipelineStepLiveLanguage(toggledStep)) {
    traceToggleOnRoute("full_reapply", {
      cause: "non_live_step", stepIdx: currentIdx, stepId: stepId,
      lang: (toggledStep && toggledStep.language) || "",
    });
    return "full_reapply";
  }
  var _sigNull = _lastLiveAppliedSignature === null;
  var _sigMismatch = !_sigNull && liveEnabledStepsSignature(beforeToggleSnapshot) !== _lastLiveAppliedSignature;
  var _crossFile = !!(crossFileFn && crossFileFn(toggledStep));
  if (_sigNull || _sigMismatch || _crossFile) {
    traceToggleOnRoute("full_reapply", {
      cause: _sigNull ? "signature_missing" : (_sigMismatch ? "signature_mismatch" : "cross_file_write"),
      stepIdx: currentIdx, stepId: stepId,
      sigNull: _sigNull, sigMismatch: _sigMismatch, crossFile: _crossFile,
      runnerMappingChecked: !!state.runnerMappingChecked,
      runnerMappingRunActive: !!state.runnerMappingRunActive,
      enabledBefore: (beforeToggleSnapshot || []).filter(function (s) { return s && s.code && isStepEnabled(s); }).length,
      totalSteps: (state.pipeline || []).length,
      diff: _sigMismatch ? _diffLiveSignatureParts(_lastLiveAppliedParts, liveEnabledStepsSignatureParts(beforeToggleSnapshot)) : "",
    });
    return "full_reapply";
  }
  traceToggleOnRoute("single_step", { stepIdx: currentIdx, stepId: stepId });
  return "single_step";
}
`;

const EXPORTS = `
module.exports = {
  decideToggleOnRoute, liveEnabledStepsSignature, liveEnabledStepsSignatureParts, _diffLiveSignatureParts,
  state,
  get traces() { return _traces; },
  last() { return _traces[_traces.length - 1]; },
  note(steps) {
    _lastLiveAppliedSignature = liveEnabledStepsSignature(steps);
    _lastLiveAppliedParts = liveEnabledStepsSignatureParts(steps);
  },
  invalidate() { _lastLiveAppliedSignature = null; _lastLiveAppliedParts = null; },
  reset(steps) { _traces.length = 0; state.pipeline = steps; state.runnerMappingChecked = false; },
};
`;

const m = new Module("toggle-route-extracted", module);
m._compile(STUBS + "\n" + EXTRACT + "\n" + DECIDE + "\n" + EXPORTS, path.join(__dirname, "_extracted_toggle_route.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

const noCross = () => false;
const yesCross = () => true;
function steps() {
  return [
    { id: "a1", language: "python", code: "ctx.write(1)", targetFileId: "output:0", enabled: true },
    { id: "a2", language: "python", code: "ctx.write(2)", targetFileId: "output:0", enabled: true },
    { id: "a3", language: "python", code: "ctx.write(3)", targetFileId: "input:x.xlsx", enabled: false },
  ];
}

console.log("[1] 정상 경로 — 그 단계만 적용");
T.reset(steps());
{
  const before = T.state.pipeline.slice(0, 2);
  T.note(before);
  const r = T.decideToggleOnRoute(2, "a3", T.state.pipeline[2], before, noCross);
  check("route=single_step", r === "single_step", r);
  check("로그 남음", T.last() && T.last().event === "pipeline.toggle_on.route");
  check("route 필드", T.last().fields.route === "single_step", JSON.stringify(T.last().fields));
}

console.log("[2] 서명 없음(signature_missing)");
T.reset(steps());
T.invalidate();
{
  const r = T.decideToggleOnRoute(2, "a3", T.state.pipeline[2], T.state.pipeline.slice(0, 2), noCross);
  check("route=full_reapply", r === "full_reapply", r);
  check("cause=signature_missing", T.last().fields.cause === "signature_missing", T.last().fields.cause);
  check("불일치 진단은 비어 있음", T.last().fields.diff === "", T.last().fields.diff);
}

console.log("[3] 교차파일(cross_file_write) — 서명이 맞아도 걸린다");
T.reset(steps());
{
  const before = T.state.pipeline.slice(0, 2);
  T.note(before);
  const r = T.decideToggleOnRoute(2, "a3", T.state.pipeline[2], before, yesCross);
  check("route=full_reapply", r === "full_reapply", r);
  check("cause=cross_file_write", T.last().fields.cause === "cross_file_write", T.last().fields.cause);
  check("서명은 정상이었음이 기록됨", T.last().fields.sigNull === "false" && T.last().fields.sigMismatch === "false",
    JSON.stringify(T.last().fields));
}

console.log("[4] 서명 불일치 — '무엇이 달라졌는지'까지 남는다  ← 이번 조사의 목적");
// 4-1 대상 파일이 바뀐 경우(실행기 매핑 의심 케이스)
T.reset(steps());
{
  const applied = T.state.pipeline.slice(0, 2);
  T.note(applied);
  const before = applied.map(s => ({ ...s, targetFileId: s.id === "a2" ? "input:다른파일.xlsx" : s.targetFileId }));
  const r = T.decideToggleOnRoute(2, "a3", T.state.pipeline[2], before, noCross);
  check("route=full_reapply", r === "full_reapply", r);
  check("cause=signature_mismatch", T.last().fields.cause === "signature_mismatch", T.last().fields.cause);
  check("바뀐 스텝 id 지목", /a2/.test(T.last().fields.diff), T.last().fields.diff);
  check("파일이 원인이라고 지목", /파일 output:0→input:다른파일/.test(T.last().fields.diff), T.last().fields.diff);
}
// 4-2 켜짐/꺼짐 집합이 달라진 경우
T.reset(steps());
{
  const applied = T.state.pipeline.slice(0, 2);
  T.note(applied);
  const before = [applied[0]];                       // a2 가 꺼진 상태
  T.decideToggleOnRoute(2, "a3", T.state.pipeline[2], before, noCross);
  check("꺼진 스텝 지목", /a2:꺼짐/.test(T.last().fields.diff), T.last().fields.diff);
}
// 4-3 코드가 바뀐 경우 — 전문이 아니라 해시만
T.reset(steps());
{
  const applied = T.state.pipeline.slice(0, 2);
  T.note(applied);
  const before = applied.map(s => (s.id === "a1" ? { ...s, code: "ctx.write(999)  # 비밀 데이터" } : s));
  T.decideToggleOnRoute(2, "a3", T.state.pipeline[2], before, noCross);
  check("코드 변경 지목", /a1:코드 /.test(T.last().fields.diff), T.last().fields.diff);
  check("코드 전문은 안 남김", !/비밀 데이터|ctx\.write\(999\)/.test(JSON.stringify(T.last().fields)), T.last().fields.diff);
}
// 4-4 순서만 바뀐 경우
T.reset(steps());
{
  const applied = T.state.pipeline.slice(0, 2);
  T.note(applied);
  const before = [applied[1], applied[0]];
  T.decideToggleOnRoute(2, "a3", T.state.pipeline[2], before, noCross);
  check("순서 변경 지목", /순서변경/.test(T.last().fields.diff), T.last().fields.diff);
}

console.log("[5] 비라이브 스텝");
T.reset(steps());
{
  const r = T.decideToggleOnRoute(0, "j1", { id: "j1", language: "javascript", code: "x" }, [], noCross);
  check("route=full_reapply", r === "full_reapply", r);
  check("cause=non_live_step", T.last().fields.cause === "non_live_step", T.last().fields.cause);
}

console.log("[6] 판정 로직 무변경 — 원문 조건식이 그대로인가");
check("조건 3개를 그대로 OR 로 판정", /if \(_sigNull \|\| _sigMismatch \|\| _crossFile\) \{/.test(pj));
check("_sigNull 정의 동일", /const _sigNull = _lastLiveAppliedSignature === null;/.test(pj));
check("_sigMismatch 는 sigNull 이 아닐 때만 계산(단축평가 보존)",
  /const _sigMismatch = !_sigNull && liveEnabledStepsSignature\(beforeToggleSnapshot\) !== _lastLiveAppliedSignature;/.test(pj));
check("비라이브 분기 유지", /if \(!pipelineStepLiveLanguage\(toggledStep\)\) \{/.test(pj));
check("정상 경로에도 계측", /traceToggleOnRoute\("single_step"/.test(pj));
check("계측은 실패해도 조용히 무시(try/catch)", /function traceToggleOnRoute[\s\S]{0,120}try \{/.test(pj));
check("무효화 시 진단 데이터도 함께 비움", /_lastLiveAppliedSignature = null;\s*\n\s*_lastLiveAppliedParts = null;/.test(pj));
// 서명과 진단 데이터는 반드시 '같은 입력'으로 만들어져야 한다(하나만 매핑 환산되면 진단이 거짓말을 한다).
check("적용 기록 시 진단 데이터도 같은 입력으로 함께 기록",
  /_lastLiveAppliedSignature = liveEnabledStepsSignature\((\w+)\);[\s\S]{0,160}_lastLiveAppliedParts = liveEnabledStepsSignatureParts\(\1\)/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
