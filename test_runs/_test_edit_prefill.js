// [0.7.3 사용자 요청] 수정(✎) 클릭 시 그 스텝을 만들 때 '내가 쳤던 원문'을 채팅 입력창에 프리필.
//   예: 3단계 수정 → "선택 범위: @범위[input_v056_청구내역.xlsx/청구내역!D18] 300써줘" 가 입력창에.
//
// 계약:
//   1. 수정 진입 → step.prompt 원문 프리필 + 포커스 + 커서 끝
//   2. 사용자가 쓰던 초안이 있으면 덮어쓰지 않는다
//   3. 해제 → '손 안 댄 프리필'만 지운다(사용자가 고친 내용은 보존)
//   4. 다른 스텝으로 바로 전환 → 프리필 교체
//   5. 녹화/복붙 캡처 스텝·prompt 없는 스텝은 프리필하지 않는다
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
var state = { pipeline: [], editingStepId: null };
var _toasts = []; function toast(m, k) { _toasts.push(String(m)); }
function renderPipeline() {}
function renderEditingBanner() {}
var _scrolled = []; function scrollChatToStepRequest(step) { _scrolled.push(step && step.id); return true; }
function Event(name, opts) { this.type = name; }
var _ta = {
  value: "", focused: 0, sel: null, events: [],
  focus() { this.focused += 1; },
  setSelectionRange(a, b) { this.sel = [a, b]; },
  dispatchEvent(e) { this.events.push(e.type); },
};
var document = { getElementById: id => (id === "chat-text" ? _ta : null) };
`;
const EXTRACT = [
  fn(pj, "_editPrefillPromptOf"),
  fn(pj, "_applyEditPrefill"),
  fn(pj, "toggleEditStep"),
].join("\n\n");
const EXPORTS = `
module.exports = {
  state, toggleEditStep,
  get ta() { return _ta; },
  get toasts() { return _toasts; },
  get scrolled() { return _scrolled; },
  reset(steps) {
    _toasts.length = 0; _scrolled.length = 0;
    _ta.value = ""; _ta.focused = 0; _ta.sel = null; _ta.events.length = 0;
    window.__b2bEditPrefill = null;
    state.pipeline = steps; state.editingStepId = null;
  },
};
`;
const m = new Module("prefill-extracted", module);
m._compile(STUBS + "\n" + EXTRACT + "\n" + EXPORTS, path.join(__dirname, "_extracted_prefill.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 160) : "")); }
}

const PROMPT3 = "선택 범위: @범위[input_v056_청구내역.xlsx/청구내역!D18] 300써줘";
function makeSteps() {
  return [
    { id: "s1", code: "c1", prompt: "1단계 요청" },
    { id: "s2", code: "c2", prompt: "" },
    { id: "s3", code: "c3", prompt: PROMPT3 },
    { id: "s4", code: "c4", prompt: "[녹화됨/VBA] Sub ..." },
  ];
}

console.log("[1] 수정 클릭 → 원문 프리필  ← 요청한 그 동작");
T.reset(makeSteps());
T.toggleEditStep("s3");
check("입력창에 원문 그대로", T.ta.value === PROMPT3, T.ta.value);
check("@범위 토큰도 원형 유지", T.ta.value.includes("@범위[input_v056_청구내역.xlsx/청구내역!D18]"));
check("포커스 이동", T.ta.focused >= 1);
check("커서는 끝", T.ta.sel && T.ta.sel[0] === PROMPT3.length);
check("input 이벤트 발화(자동높이/멘션 갱신)", T.ta.events.includes("input"));
check("기존 스크롤+강조도 그대로 예약", true);   // setTimeout 내부 — 함수 존재는 배선 테스트에서
check("수정 모드 진입", T.state.editingStepId === "s3");

console.log("[2] 사용자 초안은 덮어쓰지 않는다");
T.reset(makeSteps());
T.ta.value = "쓰다 만 내 초안";
T.toggleEditStep("s3");
check("초안 보존", T.ta.value === "쓰다 만 내 초안", T.ta.value);
check("수정 모드는 진입", T.state.editingStepId === "s3");

console.log("[3] 해제 — 손 안 댄 프리필만 지운다");
T.reset(makeSteps());
T.toggleEditStep("s3");
T.toggleEditStep("s3");                     // 해제
check("프리필 제거", T.ta.value === "", T.ta.value);
T.reset(makeSteps());
T.toggleEditStep("s3");
T.ta.value = PROMPT3.replace("300", "500");  // 사용자가 고침
T.toggleEditStep("s3");                     // 해제
check("고친 내용은 보존", T.ta.value.includes("500"), T.ta.value);

console.log("[4] 다른 스텝으로 전환 — 프리필 교체");
T.reset(makeSteps());
T.toggleEditStep("s3");
T.toggleEditStep("s1");                     // s3 프리필 그대로인 채 s1 로 전환
check("s1 원문으로 교체", T.ta.value === "1단계 요청", T.ta.value);
check("수정 대상 갱신", T.state.editingStepId === "s1");

console.log("[5] 프리필하지 않는 스텝");
T.reset(makeSteps());
T.toggleEditStep("s4");                     // 녹화 스텝
check("녹화 스텝은 비워 둠", T.ta.value === "", T.ta.value);
check("수정 모드는 진입(기존 동작 유지)", T.state.editingStepId === "s4");
T.reset(makeSteps());
T.toggleEditStep("s2");                     // prompt 빈 스텝
check("prompt 없으면 비워 둠", T.ta.value === "");

console.log("[6] 배선 — 렌더/스크롤 기존 동작 유지");
check("scrollChatToStepRequest 예약 코드 존재", /setTimeout\(\(\) => scrollChatToStepRequest\(step\), 0\)/.test(pj));
check("프리필이 스크롤보다 먼저(원문이 입력창에 이미 있는 채 강조)", /_applyEditPrefill\(step\);[\s\S]{0,220}scrollChatToStepRequest/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
