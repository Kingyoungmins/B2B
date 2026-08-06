// [실측 재현] "새로고침으로 스킬 전체실행 다시시키는거 뭔가 잘 안되는 경우" (사용자 2026-08-04)
//   원인 4가지 — 이 테스트가 각각을 잠근다.
//     1) 실행기 파일 짝(state.runnerMappings)이 스냅샷에 없어 새로고침 후 소실
//        → 자동 재적용이 스킬에 적힌 '옛 달 파일명' 그대로 돌아 실패
//     2) 자동 재적용이 beginMappedPipelineRun 을 안 거쳐 매핑본이 아닌 원본으로 실행
//     3) 실패가 토스트 한 줄로만 떠서 '조용히 안 됨' → 표준 오류 카드로 승격
//     4) 'b2bJustReset' 표식이 소비되지 않아 나중에 자동복구가 실행 도중 겹쳐 발화
// 소스(soft-refresh.js)를 그대로 로드하고 주변만 가짜로 채워, 실제 코드 경로를 실행한다.
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

const src = fs.readFileSync(path.join(ROOT, "scripts", "soft-refresh.js"), "utf8").replace(/^﻿/, "");

// ---- 가짜 환경 -------------------------------------------------------------
const PRELUDE = `
var window = globalThis;
var _store = {};
var sessionStorage = {
  getItem: k => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
};
var _toasts = [];
function toast(msg, kind) { _toasts.push({ msg: String(msg), kind: kind || "" }); }

var state = {
  inputs: [], inputsOriginal: [], outputTemplates: [], activeOutputIndex: 0,
  currentFileId: null, pipeline: [], fuzzyResolution: {},
  runnerMappings: {}, runnerMappingChecked: false, runnerMappingSignature: "",
  runnerMappingRunActive: false,
};

// 실제 drop-handling.js 와 동일한 시그니처 계산식(파일 id·이름 + 스텝 id).
function runnerMappingKnownFiles() {
  return (state.inputs || []).map(f => ({ id: "input:" + f.name, name: f.name }));
}
function runnerCurrentMappingSignature() {
  const files = runnerMappingKnownFiles().map(item => [item.id, item.name].join("|"));
  const steps = (state.pipeline || []).map(s => (s && s.id) || "");
  return JSON.stringify({ files, steps });
}
function runnerResetMappingIfSourceChanged() {
  if (state.runnerMappingRunActive) return;
  const sig = runnerCurrentMappingSignature();
  if (state.runnerMappingSignature !== sig) {
    state.runnerMappingSignature = sig;
    state.runnerMappingChecked = false;
    state.runnerMappings = {};
  }
}

var _calls = [];
function renderRunnerWorkflow() { _calls.push("renderRunnerWorkflow"); }
function renderInputList() {}
function renderOutputChip() {}
function refreshTabs() {}
function refreshChatState() {}
function activateOutputTemplate(i) { state.activeOutputIndex = i; }
function makeOutputTemplate(rec) { return { original: rec }; }
function cloneFileRecord(rec) { return JSON.parse(JSON.stringify(rec)); }
function ensureWorkbookDisplayName(rec) { /* 표시명 계산은 테스트 관심사가 아님 */ }
function getFile(id) { return (state.inputs || []).find(f => ("input:" + f.name) === id) || null; }

// 파일 복원(실제 _softRefreshRebuildFile 경로를 그대로 태우고 서버 왕복만 가짜로).
// _renameOnRestore 로 '복원했더니 다른 파일이더라' 상황을 만들 수 있다.
var _renameOnRestore = {};
async function fetch(url, opts) {
  const body = JSON.parse(opts.body);
  const saved = body.workbookId;
  return { ok: true, json: async () => ({ ok: true, workbookId: saved, name: saved, meta: { sheets: [] } }) };
}
function createBackendPreviewRecord(fileLike, opt) {
  const base = String(opt.name || fileLike.name).replace(/^wb_/, "");
  const name = _renameOnRestore[base] || base;
  return { name, backendWorkbookId: opt.workbookId, sheets: [] };
}

// 스킬 저장/복원: 실제 계약과 동일하게 스텝 id 를 보존해 왕복한다
// (save-load.js 는 저장 때 id: s.id, 불러올 때 id: s.id || uid() — 즉 id 가 유지된다).
function buildLogicZipEntries(name) {
  return [{ name: name + ".logic.json", text: JSON.stringify({ version: 3, pipeline: state.pipeline }) }];
}
function loadLogic(logic) { state.pipeline = JSON.parse(JSON.stringify(logic.pipeline || [])); }

var _mirrorOpened = 0;
async function preopenAllExcelMirrors() { _mirrorOpened++; }

// beginMappedPipelineRun: 실제 구현과 동일한 계약(매핑본으로 교체 → restore 로 원복).
var _mapRunBegun = 0;
function beginMappedPipelineRun() {
  const original = state.pipeline;
  const noop = { steps: original, restore: () => {} };
  if (state.runnerMappingRunActive) return noop;
  if (!state.runnerMappingChecked || !Object.keys(state.runnerMappings || {}).length) return noop;
  _mapRunBegun++;
  const mapped = original.map(s => ({ ...s, mapped: true }));
  state.runnerMappingRunActive = true;
  state.pipelineOriginalDuringRun = original;
  state.pipeline = mapped;
  return { steps: mapped, restore: () => { state.pipeline = original; state.runnerMappingRunActive = false; } };
}

var _lockLog = [];
function setGeneratorRunLoading(running, text) { _lockLog.push(!!running); }

var _errorCards = [];
function reportPipelineError(err) { _errorCards.push(String((err && err.message) || err)); }

// 파일 끝 버튼 바인딩용(테스트는 DOM 을 쓰지 않는다).
var document = { readyState: "complete", getElementById: () => null, addEventListener() {}, querySelector: () => null };

// 자동 재적용: 테스트가 결과와 '실행 당시 관측값'을 조종한다.
var _runObserved = null;
var _runShouldThrow = false;
async function runPipelineWithAutoRepair(options) {
  _runObserved = {
    options,
    mappingRunActive: state.runnerMappingRunActive,
    pipelineMapped: (state.pipeline || []).every(s => s && s.mapped === true),
    lockedAtRunTime: _lockLog.length > 0 && _lockLog[_lockLog.length - 1] === true,
    justResetFlag: sessionStorage.getItem("b2bJustReset"),
  };
  if (_runShouldThrow) throw new Error("적용 실패(테스트)");
  return { ok: true };
}
`;

const EXPORTS = `
module.exports = {
  collectSoftRefreshSnapshot, restoreSoftRefreshSnapshot, SOFT_REFRESH_KEY,
  state, sessionStorage, runnerResetMappingIfSourceChanged, runnerCurrentMappingSignature,
  setRenameOnRestore(map) { _renameOnRestore = map || {}; },
  get toasts() { return _toasts; },
  get calls() { return _calls; },
  get errorCards() { return _errorCards; },
  get lockLog() { return _lockLog; },
  get mapRunBegun() { return _mapRunBegun; },
  get runObserved() { return _runObserved; },
  setRunShouldThrow(v) { _runShouldThrow = !!v; },
  reset(files, pipeline, mappings, checked) {
    _toasts.length = 0; _calls.length = 0; _errorCards.length = 0; _lockLog.length = 0;
    _mapRunBegun = 0; _runObserved = null; _runShouldThrow = false; _renameOnRestore = {};
    for (const k of Object.keys(_store)) delete _store[k];
    state.inputs = (files || []).map(n => ({ name: n, backendWorkbookId: "wb_" + n }));
    state.inputsOriginal = []; state.outputTemplates = []; state.activeOutputIndex = 0;
    state.currentFileId = null; state.fuzzyResolution = {};
    state.pipeline = JSON.parse(JSON.stringify(pipeline || []));
    state.runnerMappings = JSON.parse(JSON.stringify(mappings || {}));
    state.runnerMappingChecked = !!checked;
    state.runnerMappingRunActive = false;
    state.runnerMappingSignature = runnerCurrentMappingSignature();
  },
};
`;

const m = new Module("soft-refresh-extracted", module);
m._compile(PRELUDE + "\n" + src + "\n" + EXPORTS, path.join(__dirname, "_extracted_soft_refresh.js"));
const T = m.exports;

// ---- 픽스처 ---------------------------------------------------------------
const APRIL = "input_원가_2026_4월.xlsx";
const MAY = "input_원가_2026_5월.xlsx";
const PIPE = [
  { id: "st1", code: "ctx.write()", enabled: true, description: "1단계", targetFileId: "input:" + APRIL },
  { id: "st2", code: "ctx.write()", enabled: true, description: "2단계", targetFileId: "input:" + APRIL },
];
const MAPPINGS = { [APRIL + " Sheet1"]: { fileId: "input:" + MAY, sheet: "Sheet1" } };

let fails = 0;
function check(name, cond, detail) {
  if (cond) { console.log("  PASS  " + name); }
  else { fails++; console.log("  FAIL  " + name + (detail ? "  → " + detail : "")); }
}

// 스냅샷을 만들고, '리로드된 새 세션'처럼 state 를 비운 뒤 복원한다.
//   renameOnRestore: 복원해 보니 다른 파일이더라(=파일이 바뀐 상황) 재현.
async function snapshotThenRestore({ renameOnRestore, runShouldThrow } = {}) {
  const snap = JSON.stringify(T.collectSoftRefreshSnapshot());
  // 리로드: 전역 상태가 부팅 직후로 초기화된다(스냅샷·표식만 sessionStorage 로 살아남음).
  T.reset([], [], {}, false);
  T.sessionStorage.setItem(T.SOFT_REFRESH_KEY, snap);
  T.sessionStorage.setItem("b2bJustReset", "1");        // softRefreshApp 이 리로드 직전에 심는 표식
  if (renameOnRestore) T.setRenameOnRestore(renameOnRestore);
  if (runShouldThrow) T.setRunShouldThrow(true);
  const ok = await T.restoreSoftRefreshSnapshot();
  return { snap: JSON.parse(snap), ok };
}

(async () => {
  console.log("[1] 스냅샷이 실행기 파일 짝을 담는다");
  T.reset([MAY], PIPE, MAPPINGS, true);
  {
    const snap = T.collectSoftRefreshSnapshot();
    check("runnerMappings 포함", JSON.stringify(snap.runnerMappings) === JSON.stringify(MAPPINGS),
      JSON.stringify(snap.runnerMappings));
    check("runnerMappingChecked 포함", snap.runnerMappingChecked === true);
    check("시그니처는 '지금 계산한' 값", snap.runnerMappingSignature === JSON.stringify({
      files: ["input:" + MAY + "|" + MAY], steps: ["st1", "st2"],
    }), snap.runnerMappingSignature);
    // state 쪽 값이 낡아도 스냅샷은 최신을 담아야 한다(지연 갱신 대비).
    T.state.runnerMappingSignature = "STALE";
    check("state 가 낡아도 최신 시그니처 저장", T.collectSoftRefreshSnapshot().runnerMappingSignature !== "STALE");
  }

  console.log("[2] 같은 파일·스킬이면 복원된다");
  T.reset([MAY], PIPE, MAPPINGS, true);
  {
    await snapshotThenRestore();
    check("매핑 복원됨", JSON.stringify(T.state.runnerMappings) === JSON.stringify(MAPPINGS),
      JSON.stringify(T.state.runnerMappings));
    check("파일확인 완료 표시 복원", T.state.runnerMappingChecked === true);
    check("실행기 화면 갱신 호출", T.calls.includes("renderRunnerWorkflow"));
    // 재-앵커가 안 되면 다음 소스변경 검사(실행기 진입 등)가 방금 복원한 매핑을 즉시 지운다.
    const before = JSON.stringify(T.state.runnerMappings);
    T.runnerResetMappingIfSourceChanged();
    check("재-앵커: 소스변경 검사가 지우지 않음",
      JSON.stringify(T.state.runnerMappings) === before && T.state.runnerMappingChecked === true,
      JSON.stringify(T.state.runnerMappings));
  }

  console.log("[3] 파일이 달라졌으면 억지로 씌우지 않는다");
  T.reset([MAY], PIPE, MAPPINGS, true);
  {
    // 복원해 보니 실제 파일이 6월분이더라 → 시그니처 불일치 → 옛 짝을 씌우지 않는다.
    await snapshotThenRestore({ renameOnRestore: { [MAY]: "input_원가_2026_6월.xlsx" } });
    check("파일이 달라지면 매핑 복원 안 함", Object.keys(T.state.runnerMappings || {}).length === 0,
      JSON.stringify(T.state.runnerMappings));
    check("파일확인 완료 표시도 안 씌움", T.state.runnerMappingChecked === false);
    check("그래도 자동 재적용은 시도(예전 동작 유지)", !!T.runObserved);
  }

  console.log("[4] 자동 재적용이 매핑본으로 돈다 + 화면 잠금 + 표식 소비");
  T.reset([MAY], PIPE, MAPPINGS, true);
  {
    await snapshotThenRestore();
    check("beginMappedPipelineRun 통과", T.mapRunBegun === 1, "begun=" + T.mapRunBegun);
    check("실행 당시 파이프라인이 매핑본", !!(T.runObserved && T.runObserved.pipelineMapped));
    check("실행 당시 화면 잠김", !!(T.runObserved && T.runObserved.lockedAtRunTime));
    check("실행 전 b2bJustReset 이미 소비됨", !!T.runObserved && T.runObserved.justResetFlag === null,
      String(T.runObserved && T.runObserved.justResetFlag));
    check("실행 후 잠금 해제", T.lockLog.length >= 2 && T.lockLog[T.lockLog.length - 1] === false,
      JSON.stringify(T.lockLog));
    check("실행 후 원본 파이프라인 복원", (T.state.pipeline || []).every(s => !s.mapped) && T.state.runnerMappingRunActive === false);
    check("b2bJustReset 최종 제거", T.sessionStorage.getItem("b2bJustReset") === null);
    check("성공 안내 표시", T.toasts.some(t => t.msg.includes("스킬 적용까지 마쳤습니다")));
  }

  console.log("[5] 실패하면 오류 카드로 올린다");
  T.reset([MAY], PIPE, MAPPINGS, true);
  {
    await snapshotThenRestore({ runShouldThrow: true });
    check("표준 오류 카드 1건", T.errorCards.length === 1, JSON.stringify(T.errorCards));
    check("실패해도 잠금 해제", T.lockLog.length >= 2 && T.lockLog[T.lockLog.length - 1] === false,
      JSON.stringify(T.lockLog));
    check("실패해도 매핑 원복", T.state.runnerMappingRunActive === false);
  }

  console.log("[6] 파일 짝이 없던 세션은 예전과 똑같이 동작한다(회귀)");
  T.reset([MAY], PIPE, {}, false);
  {
    const snap = T.collectSoftRefreshSnapshot();
    check("매핑 없으면 null 로 담김", snap.runnerMappings === null || Object.keys(snap.runnerMappings).length === 0);
    await snapshotThenRestore();
    check("매핑 미확인이면 매핑본 실행 안 함", T.mapRunBegun === 0, "begun=" + T.mapRunBegun);
    check("자동 재적용은 그대로 수행", !!T.runObserved);
    check("옵션 계약 유지(source/ignoreCheckpoint/backgroundMode)",
      !!T.runObserved && T.runObserved.options.source === "generator"
      && T.runObserved.options.ignoreCheckpoint === true && T.runObserved.options.backgroundMode === true,
      JSON.stringify(T.runObserved && T.runObserved.options));
  }

  console.log("");
  console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(err => { console.error("테스트 자체 오류:", err); process.exit(2); });
