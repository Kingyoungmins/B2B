// [사용자 제보 2026-08-10] "undo redo 버튼 활성화 안되고 있음"
//
// 원인: shouldSkipHeavyHistory 가 file.size 합계 8MB 를 넘으면 히스토리를 통째로 꺼 버렸다.
//   그런데 size 는 '디스크 원본 크기'고 스냅샷은 그 바이트를 복제하지 않는다
//   (cloneFileForHistory 가 originalBuffer 를 참조 공유). 실제 복제되는 건 미리보기 격자뿐.
//   실무 파일 세트(33MB, 미리보기 셀 10만 개)를 올리면 항상 스킵 → 버튼 영원히 비활성.
//   실측: bytes 로 걸림 True / cells 로 걸림 False — 즉 낡은 척도 하나가 기능을 죽이고 있었다.
//
// 이 테스트가 잠그는 것
//   1. 실무 파일 상황(원본 30MB, 미리보기 셀 10만)에서 히스토리가 저장되고 버튼이 켜진다
//   2. 진짜 무거운 상황(셀 25만+)은 여전히 스킵된다(메모리 보호 유지) + 이유를 1회 안내
//   3. 스냅샷이 원본 바이트를 복제하지 않는다(참조 공유) — 이 사실이 1번의 전제다
//   4. undo 가 실제로 이전 상태로 되돌린다
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

const src = fs.readFileSync(path.join(ROOT, "scripts", "history.js"), "utf8").replace(/^﻿/, "");

const PRELUDE = `
var window = globalThis;
var state = {
  inputs: [], inputsOriginal: [], output: null, outputOriginal: null,
  outputTemplates: [], activeOutputIndex: -1, currentFileId: null, currentSheet: null,
  selectedSheets: [], selectedCell: null, selectedRange: null, selectedRanges: [],
  selectionAnchor: null, pipeline: [], fuzzyResolution: {}, editingStepId: null,
  history: null,
};
function deepClone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
var _toasts = [];
function toast(m, k) { _toasts.push(String(m)); }
var _buttons = { "btn-undo": { disabled: true, onclick: null }, "btn-redo": { disabled: true, onclick: null } };
function $(id) { return _buttons[id] || null; }
// restore 가 부르는 렌더러들 — 테스트 관심사 아님
function recomputeAllFormulas() {}
function renderInputList() {}
function renderOutputChip() {}
function renderPipeline() {}
function refreshTabs() {}
function renderExcelViewer() {}
function refreshChatState() {}
function refreshRunButton() {}
async function reconcilePipelineSimulationAfterEdit() { return {}; }
`;
const EXPORTS = `
module.exports = {
  state, pushHistory, undoHistory, redoHistory, refreshHistoryButtons,
  shouldSkipHeavyHistory, cloneFileForHistory,
  get toasts() { return _toasts; },
  get undoBtn() { return _buttons["btn-undo"]; },
  get redoBtn() { return _buttons["btn-redo"]; },
  reset() {
    _toasts.length = 0;
    window.__b2bHeavyHistoryNotified = false;
    state.history = null;
    state.inputs = []; state.inputsOriginal = [];
    state.output = null; state.outputOriginal = null; state.outputTemplates = [];
    state.pipeline = [];
    _buttons["btn-undo"].disabled = true;
    _buttons["btn-redo"].disabled = true;
  },
};
`;
const m = new Module("history-extracted", module);
m._compile(PRELUDE + "\n" + src + "\n" + EXPORTS, path.join(__dirname, "_extracted_history.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail ? "  → " + String(detail).slice(0, 160) : "")); }
}

// 실무 파일 흉내: 원본 30MB(버퍼는 참조만), 미리보기 500행 × 30열 = 15,000셀
function makeFile(name, sizeBytes, rows, cols) {
  const grid = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => r * cols + c));
  return {
    name, size: sizeBytes,
    originalBuffer: { byteLength: sizeBytes, __marker: name + "_buffer" },   // 참조 공유 확인용
    sheets: { "시트1": grid },
  };
}

console.log("[1] 실무 파일 상황 — 히스토리가 살아난다  ← 제보한 그 상황");
T.reset();
// 보안해제 세트 실측과 동일 규모: 합계 33MB, 미리보기 셀 ~10만(2벌 중복 포함)
T.state.inputs = [makeFile("input_202602.xlsx", 29.8 * 1024 * 1024, 500, 21),
                  makeFile("input_KGM월별정산.xlsx", 3.18 * 1024 * 1024, 500, 10)];
T.state.inputsOriginal = T.state.inputs.map(f => ({ ...f }));
check("무겁다고 판정하지 않음", T.shouldSkipHeavyHistory() === false);
T.state.pipeline = [{ id: "s1", code: "v1" }];
T.pushHistory("단계 추가");
check("히스토리가 저장됨", T.state.history && T.state.history.undo.length === 1,
  T.state.history && T.state.history.undo.length);
check("Undo 버튼 활성화", T.undoBtn.disabled === false);

console.log("[2] Undo 가 실제로 되돌린다");
T.state.pipeline = [{ id: "s1", code: "v1" }, { id: "s2", code: "v2" }];   // 단계가 하나 늘어난 '현재'
T.undoHistory();
check("파이프라인이 스냅샷 시점(1단계)으로 복원", T.state.pipeline.length === 1
  && T.state.pipeline[0].code === "v1", JSON.stringify(T.state.pipeline));
check("Redo 버튼 활성화", T.redoBtn.disabled === false);
T.redoHistory();
check("Redo 로 다시 2단계", T.state.pipeline.length === 2, T.state.pipeline.length);

console.log("[3] 스냅샷이 원본 바이트를 복제하지 않는다(참조 공유) — 판정 완화의 전제");
{
  const f = makeFile("big.xlsx", 50 * 1024 * 1024, 10, 5);
  const cloned = T.cloneFileForHistory(f);
  check("originalBuffer 가 같은 객체(복제 아님)", cloned.originalBuffer === f.originalBuffer);
  check("sheets 는 깊은 복제(스냅샷 독립성)", cloned.sheets !== f.sheets
    && cloned.sheets["시트1"][0][0] === f.sheets["시트1"][0][0]);
}

console.log("[4] 진짜 무거우면(셀 25만+) 여전히 스킵 — 메모리 보호 유지");
T.reset();
// 130,000셀 파일이 inputs+inputsOriginal 로 2벌 카운트 = 26만 셀
T.state.inputs = [makeFile("huge.xlsx", 1024, 1300, 100)];
T.state.inputsOriginal = T.state.inputs.map(f => ({ ...f }));
check("무겁다고 판정", T.shouldSkipHeavyHistory() === true);
T.pushHistory("단계 추가");
check("히스토리 저장 안 함", T.state.history.undo.length === 0);
check("이유를 토스트로 1회 안내", T.toasts.length === 1 && /되돌리기|Undo/.test(T.toasts[0]), T.toasts);
T.pushHistory("단계 추가");
check("반복 호출에도 안내는 1회뿐", T.toasts.length === 1, T.toasts.length);

console.log("[5] 파일이 없으면(시작 직후) 당연히 가볍다");
T.reset();
check("빈 상태는 무겁지 않음", T.shouldSkipHeavyHistory() === false);

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
