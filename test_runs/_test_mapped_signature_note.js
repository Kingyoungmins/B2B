// [실행기 매핑 서명 어긋남 — 2026-08-11 실사용 로그로 확정] 파일확인(매핑)을 켠 뒤로는 단계를 켤 때마다
// 리셋+1단계부터 전체 재적용으로 떨어졌다. 새 계측이 남긴 근거:
//   cause=signature_mismatch
//   diff="duc4s5om:파일 input:output_02월 검증파일.xlsx→output:0,코드 6d412eee→92c4cf75 | …"
// = 적용 기록은 '매핑본'(치환된 파일/코드) 기준인데, 실행이 끝나면 파이프라인은 '원본'으로 되돌아간다.
//
// 이 테스트가 잠그는 것
//   1. 매핑 실행 중 남긴 기록이 '되돌린 뒤의 파이프라인'과 일치한다 → 다음 단계 켜기가 단일 적용
//   2. 되돌리기 규칙(restore)과 대칭: 실행 중 코드가 바뀐 스텝은 환산하지 않는다(자동복구 보존)
//   3. 매핑이 없을 때는 동작이 예전 그대로
//   4. 켜짐/꺼짐은 실행 시점 값을 쓴다
//   5. 'AI 도움 미검증 수정' 낙인 해제가 여전히 실물 객체에 적용된다(환산본에 지워지면 안 됨)
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
var state = { pipeline: [], pipelineOriginalDuringRun: null, pipelineMappedDuringRun: null, runnerMappingRunActive: false };
function isStepEnabled(s) { return !!(s && s.enabled !== false); }
function pipelineStepLiveLanguage(s) {
  var l = String((s && s.language) || "").toLowerCase();
  return (l === "python" || l === "vba") ? l : "";
}
var _runtimeStatus = {};
function getPipelineRuntimeStatus(id) { return _runtimeStatus[id] || null; }
var _lastLiveAppliedSignature = null;
var _lastLiveAppliedParts = null;
`;
const EXTRACT = [
  fn(pj, "_pipelineSigHash"),
  fn(pj, "liveEnabledStepsSignature"),
  fn(pj, "liveEnabledStepsSignatureParts"),
  fn(pj, "_signatureStepsAsRestored"),
  fn(pj, "noteLivePipelineApplied"),
].join("\n\n");
const EXPORTS = `
module.exports = {
  state, noteLivePipelineApplied, liveEnabledStepsSignature,
  sig() { return _lastLiveAppliedSignature; },
  parts() { return _lastLiveAppliedParts; },
  setStatus(m) { _runtimeStatus = m || {}; },
  reset() { _lastLiveAppliedSignature = null; _lastLiveAppliedParts = null; _runtimeStatus = {};
            state.pipeline = []; state.pipelineOriginalDuringRun = null; state.runnerMappingRunActive = false; },
};
`;
const m = new Module("mapped-sig-extracted", module);
m._compile(STUBS + "\n" + EXTRACT + "\n" + EXPORTS, path.join(__dirname, "_extracted_mapped_sig.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}

// 실사용과 같은 모양: 원본은 output:0 + 원본 코드, 매핑본은 input:… + 치환된 코드
function original() {
  return [
    { id: "duc4s5om", language: "python", enabled: true, code: "ctx.copy('output_02월 검증파일.xlsx')", targetFileId: "output:0", targetSheetName: "Sheet1" },
    { id: "n5odrn6a", language: "python", enabled: true, code: "ctx.shift_months('output_02월 검증파일.xlsx')", targetFileId: "output:0", targetSheetName: "Sheet1" },
    { id: "4elnl1ca", language: "python", enabled: true, code: "ctx.clear('output_02월 검증파일.xlsx')", targetFileId: "output:0", targetSheetName: "Sheet1" },
  ];
}
function mappedFrom(orig) {
  return orig.map(s => ({
    ...s,
    code: s.code.replace("output_02월 검증파일.xlsx", "실제_02월.xlsx"),
    targetFileId: "input:output_02월 검증파일.xlsx",
    runnerMapped: true,
  }));
}
// beginMappedPipelineRun 진입/복귀를 그대로 흉내낸다(원문 restore 규칙과 같은 병합).
function beginRun(orig) {
  const mapped = mappedFrom(orig);
  T.state.pipelineOriginalDuringRun = orig;
  T.state.pipelineMappedDuringRun = mapped;   // 실행 시작 시점의 매핑본(restore 의 클로저와 같은 기준)
  T.state.pipeline = mapped;
  T.state.runnerMappingRunActive = true;
  return mapped;
}
function restoreRun(orig, mapped) {
  const cur = T.state.pipeline;
  const mappedById = new Map(mapped.map(s => [s.id, s]));
  T.state.pipeline = cur.map(c => {
    const o = orig.find(x => x.id === c.id);
    const mp = mappedById.get(c.id);
    if (!o) return c;
    if (mp && c.code === mp.code) {
      return { ...c, code: o.code, targetFileId: o.targetFileId, targetSheetName: o.targetSheetName, runnerMapped: undefined };
    }
    return { ...c, runnerMapped: undefined };
  });
  T.state.pipelineOriginalDuringRun = null;
  T.state.pipelineMappedDuringRun = null;
  T.state.runnerMappingRunActive = false;
}

console.log("[1] 매핑 실행 후 — 다음 '단계 켜기'가 전체 재적용으로 안 떨어진다  ← 이번 수정의 목적");
T.reset();
{
  const orig = original();
  const mapped = beginRun(orig);
  T.noteLivePipelineApplied(mapped);        // 전체실행/재적용이 실행 중에 기록하는 지점
  restoreRun(orig, mapped);
  const now = T.liveEnabledStepsSignature(T.state.pipeline);
  check("되돌린 파이프라인과 기록이 일치", now === T.sig(), "기록≠현재");
  check("기록이 매핑본 파일명을 안 들고 있음", !String(JSON.stringify(T.parts())).includes("input:output_02월"), JSON.stringify(T.parts()));
  check("기록이 원본 대상파일(output:0)", (T.parts() || []).every(p => p.fid === "output:0"), JSON.stringify(T.parts()));
}

console.log("[2] 되돌리기 규칙과 대칭 — 실행 중 바뀐 코드(자동복구)는 그대로 둔다");
T.reset();
{
  const orig = original();
  const mapped = beginRun(orig);
  // 실행 중 2번 스텝이 자동복구로 코드가 바뀌었다 = restore 가 그 변경을 유지하는 케이스
  T.state.pipeline = mapped.map(s => (s.id === "n5odrn6a" ? { ...s, code: "ctx.shift_months('고쳐진코드')" } : s));
  T.noteLivePipelineApplied(T.state.pipeline);
  restoreRun(orig, mapped);
  const now = T.liveEnabledStepsSignature(T.state.pipeline);
  check("되돌린 파이프라인과 기록이 일치(자동복구 포함)", now === T.sig(), "기록≠현재");
  const p = (T.parts() || []).find(x => x.id === "n5odrn6a");
  check("바뀐 스텝은 환산하지 않음(매핑 대상파일 유지)", p && p.fid === "input:output_02월 검증파일.xlsx", JSON.stringify(p));
}

console.log("[3] 매핑이 없을 때는 예전 그대로");
T.reset();
{
  const orig = original();
  T.state.pipeline = orig;
  T.noteLivePipelineApplied(orig);
  check("기록 = 그 파이프라인 서명", T.sig() === T.liveEnabledStepsSignature(orig));
  check("환산이 끼어들지 않음", (T.parts() || []).every(p => p.fid === "output:0"));
}

console.log("[4] 켜짐/꺼짐은 실행 시점 값을 쓴다");
T.reset();
{
  const orig = original();
  const mapped = beginRun(orig);
  // 실행 시점엔 3번이 꺼져 있었다(원본 배열에는 켜짐으로 남아 있어도 실행 시점이 진실)
  const runSteps = mapped.map(s => (s.id === "4elnl1ca" ? { ...s, enabled: false } : s));
  T.state.pipeline = runSteps;
  T.noteLivePipelineApplied(runSteps);
  check("꺼진 스텝은 기록에서 빠짐", !(T.parts() || []).some(p => p.id === "4elnl1ca"), JSON.stringify(T.parts()));
  check("켜진 2개만 기록", (T.parts() || []).length === 2, (T.parts() || []).length);
}

console.log("[5] 낙인 해제는 실물 객체에 — 환산본에 지워지면 안 된다");
T.reset();
{
  const orig = original();
  const mapped = beginRun(orig);
  mapped[0]._unappliedEdit = true;
  T.setStatus({ duc4s5om: { status: "applied" } });
  T.noteLivePipelineApplied(mapped);
  check("적용된 스텝의 미검증 낙인이 실제로 지워짐", mapped[0]._unappliedEdit === undefined, mapped[0]._unappliedEdit);
}
T.reset();
{
  const orig = original();
  const mapped = beginRun(orig);
  mapped[1]._unappliedEdit = true;
  T.setStatus({ n5odrn6a: { status: "review" } });     // 아직 미적용 → 낙인 유지
  T.noteLivePipelineApplied(mapped);
  check("미적용 스텝의 낙인은 보존", mapped[1]._unappliedEdit === true);
}

console.log("[6] 배선 — 되돌리기와 같은 규칙을 쓰는가(코드 확인)");
check("환산 함수 존재", /function _signatureStepsAsRestored\(/.test(pj));
check("매핑 실행 중일 때만 환산", /if \(!state\.runnerMappingRunActive \|\| !Array\.isArray\(orig\) \|\| !orig\.length\) return steps;/.test(pj));
check("코드가 바뀐 스텝은 그대로(restore 대칭)", /if \(m && s\.code !== m\.code\) return s;/.test(pj));
check("매핑 기준본은 '실행 시작 시점'을 쓴다(실행 중 변형에 안 흔들림)",
  /state\.pipelineMappedDuringRun/.test(pj) && /state\.pipelineMappedDuringRun = mapped;/.test(pj));
check("복귀 시 기준본도 함께 비운다", /state\.pipelineMappedDuringRun = null;/.test(pj));
check("noteLivePipelineApplied 가 환산본으로 기록", /const sigSteps = _signatureStepsAsRestored\(steps\);[\s\S]{0,200}liveEnabledStepsSignature\(sigSteps\)/.test(pj));
check("낙인 해제 루프는 원본 steps 로 유지", /\(steps \|\| \[\]\)\.forEach\(s => \{[\s\S]{0,240}_unappliedEdit/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
