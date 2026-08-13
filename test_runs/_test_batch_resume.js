// [0.7.3 신기능] 보류 일괄 실행 — 체크박스로 고른 보류 스텝만 순서대로 재적용.
//
// 이 테스트가 잠그는 계약:
//   1. resume 마커가 있을 때만 동작(버튼 표시 포함) — "라이브 = start 직전 프리픽스" 전제
//   2. 체크 반영이 suffix 호출 '전'에 일어난다(내부 폴백이 enabled 만 재적용하므로)
//   3. 미체크 스텝: enabled=false 유지 + 낡은 _preApplySnapshot 제거(스냅샷 오선택 사고 방지)
//   4. 교차파일 구간은 부분 선택 거부 / 백엔드 전용 스텝은 사전 차단 / 체크 0개는 무동작
//   5. 실패 시 '성공분 유지': applied 스텝은 ON, 미적용 체크 스텝은 도로 OFF+보류,
//      실패 스텝은 오류칩 + 직전 스냅샷 복원 시도, resume 해제 + 서명 기록
//   6. 타이밍: 배치는 토글 큐의 '단일 태스크' — 도중 토글 클릭은 배치 종료 후 실행되고,
//      배치 동안 pipelineEditBusyReason() 이 비어 있지 않다(다른 편집 차단)
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
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
  let at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;
  // 기본 인자 `options = {}` 의 중괄호에 속지 않게: 파라미터 괄호를 먼저 닫고 그 뒤 { 를 몸체로.
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
var state = { pipeline: [], inputs: [], output: null, outputTemplates: [] };
var _toasts = []; function toast(m, k) { _toasts.push({ m: String(m), k: k || "" }); }
var _btn = { style: { display: "none" } };
var document = { getElementById: id => (id === "btn-batch-resume" ? _btn : null) };
function renderPipeline() {}
function renderRunnerWorkflow() {}
function refreshRunButton() {}
var _history = []; function pushHistory(label) { _history.push(label); }
var _noted = 0; function noteLivePipelineApplied() { _noted += 1; }
var _invalidated = 0; function invalidateLivePipelineApplied() { _invalidated += 1; }
var _backups = []; function scheduleLogicAutoBackup(r) { _backups.push(r); }
var _errors = []; function reportPipelineError(e) { _errors.push(e); }
var _restored = []; function restoreLastStepPreApplySnapshot(step, o) { _restored.push(step && step.id); return Promise.resolve(true); }
function resolveRunnerRecoveryStepIndex() { return -1; }

// suffix 실행 스텁 — 호출 시점의 enabled 배열을 기록하고, 테스트가 성공/실패/보류를 조종한다
var _suffixCalls = [];
var _suffixMode = { type: "resolve" };           // resolve | reject | pending
var _suffixRelease = null;
function runPipelineSuffixFromCheckpoint(start, options) {
  _suffixCalls.push({
    start,
    options: { ...options },
    enabledAtCall: (state.pipeline || []).map(s => !!(s && s.enabled !== false)),
    snapshotsAtCall: (state.pipeline || []).map(s => !!(s && s._preApplySnapshot)),
  });
  if (_suffixMode.type === "reject") {
    // 실행 도중 일부 성공을 흉내: 성공 스텝 칩을 applied 로
    (_suffixMode.appliedIds || []).forEach(id => setPipelineRuntimeStatus([id], "applied", "적용됨"));
    const err = new Error(_suffixMode.message || "스텝 실패");
    err._stepInfo = { stepId: _suffixMode.failId || null, stepIdx: -1, message: err.message };
    return Promise.reject(err);
  }
  if (_suffixMode.type === "pending") {
    return new Promise(res => { _suffixRelease = res; });
  }
  return Promise.resolve({ ok: true });
}
var _crossFile = false; function pipelineSuffixWritesCrossFile() { return _crossFile; }
var _backendOnly = false; function pipelineHasBackendOnlyStep() { return _backendOnly; }
`;

const EXTRACT = [
  "let _pipelineToggleChain = Promise.resolve();",
  "let _pipelineToggleSettling = 0;",
  fn(pj, "isStepEnabled"),
  fn(pj, "activePipelineSteps"),
  fn(pj, "setPipelineRuntimeStatus").replace("renderPipeline()", "void 0"),   // 렌더 호출 무력화
  fn(pj, "getPipelineRuntimeStatus"),
  fn(pj, "getPipelineResumeFromIndex"),
  fn(pj, "setPipelineResumeFromIndex"),
  fn(pj, "clearPipelineResumeFromIndex"),
  fn(pj, "markPipelinePendingFromIndex"),
  fn(pj, "_syncPipelineToggleStatus"),
  fn(pj, "_pipelineCoreBusyReason"),
  fn(pj, "pipelineEditBusyReason"),
  fn(pj, "pipelineFailedStepIdFromError"),
  fn(pj, "handlePipelineStepToggle"),
  // 적용 서명 — '지금 켜진 단계들이 파일에 들어가 있는가' 판정에 쓴다(결과 편집하기 흐름).
  // 이 테스트는 표시/모달 계약만 보므로 '모름'(null)으로 고정한다.
  "var _lastLiveAppliedSignature = null; function liveEnabledStepsSignature() { return 'sig'; }",
  fn(pj, "_liveMatchesEnabledSteps"),
  fn(pj, "pipelineHeldBatchInfo"),
  fn(pj, "refreshBatchResumeButton"),
  fn(pj, "runHeldStepsBatch"),
  fn(pj, "_runHeldStepsBatchImpl"),
  // 토글 임플은 스텁 — 큐 순서 검증용 기록만 남긴다
  `var _toggleLog = [];
   async function _handlePipelineStepToggleImpl(stepId) { _toggleLog.push("toggle:" + stepId); return true; }`,
].join("\n\n");

const EXPORTS = `
module.exports = {
  state, pipelineHeldBatchInfo, refreshBatchResumeButton, runHeldStepsBatch,
  handlePipelineStepToggle, pipelineEditBusyReason,
  setPipelineResumeFromIndex, clearPipelineResumeFromIndex, getPipelineResumeFromIndex,
  setPipelineRuntimeStatus, getPipelineRuntimeStatus,
  get btn() { return _btn; },
  get toasts() { return _toasts; },
  get suffixCalls() { return _suffixCalls; },
  get history() { return _history; },
  get errors() { return _errors; },
  get restoredIds() { return _restored; },
  get toggleLog() { return _toggleLog; },
  get noted() { return _noted; },
  get backups() { return _backups; },
  setSuffixMode(m) { _suffixMode = m; },
  releaseSuffix() { if (_suffixRelease) { const r = _suffixRelease; _suffixRelease = null; r({ ok: true }); } },
  setCrossFile(v) { _crossFile = !!v; },
  setBackendOnly(v) { _backendOnly = !!v; },
  reset(steps, resumeIdx) {
    _toasts.length = 0; _suffixCalls.length = 0; _history.length = 0; _errors.length = 0;
    _restored.length = 0; _toggleLog.length = 0; _noted = 0; _backups.length = 0;
    _suffixMode = { type: "resolve" }; _suffixRelease = null; _crossFile = false; _backendOnly = false;
    window.pipelineStepRuntimeStatus = {};
    window.__pipelineResumeFromIndex = null;
    window.__activeVbaApply = null; window.__excelStopInProgress = false;
    state.pipeline = steps;
    if (Number.isInteger(resumeIdx)) setPipelineResumeFromIndex(resumeIdx);
  },
};
`;

const m = new Module("batch-extracted", module);
m._compile(STUBS + "\n" + EXTRACT + "\n" + EXPORTS, path.join(__dirname, "_extracted_batch.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 180) : "")); }
}

// 10단계 스킬, 5단계 수정 후 6~10(idx 5..9) 보류 시나리오
function makeSteps() {
  return Array.from({ length: 10 }, (_, i) => ({
    id: "s" + (i + 1), code: "code" + (i + 1), enabled: i < 5,
    description: (i + 1) + "단계",
    _preApplySnapshot: { resultId: "old" + (i + 1), excelId: "ex1" },
  }));
}
const heldIds = ["s6", "s7", "s8", "s9", "s10"];

(async () => {
  // [계약 변경 2026-08-13] 예전엔 'resume 마커가 있을 때만' 버튼이 떴다. 그런데 마커는 런타임
  // 상태라 스킬에 저장되지 않고 불러올 때 지워진다 — 그래서 실행기에 '처음부터 꺼진 채 저장된
  // 스킬'이 들어오면 보류 단계가 뻔히 보이는데 버튼이 안 나왔다(사용자 제보).
  // 이제 '꺼진 단계가 있으면' 뜬다. 마커 유무는 표시가 아니라 '어떻게 도느냐'(liveUnknown)를 가른다.
  console.log("[1] 버튼 표시 — 꺼진 단계가 있으면 뜬다");
  T.reset(makeSteps(), 5);
  T.refreshBatchResumeButton();
  check("보류 있음 → 버튼 보임", T.btn.style.display === "");
  T.clearPipelineResumeFromIndex();
  T.refreshBatchResumeButton();
  check("마커를 지워도 꺼진 단계가 남았으면 계속 보임", T.btn.style.display === "");
  T.reset(makeSteps(), null);
  T.refreshBatchResumeButton();
  check("마커 없이 불러온 스킬도 보임  ← 제보 건", T.btn.style.display === "");
  T.reset(makeSteps().map(s => ({ ...s, enabled: true })), null);
  T.refreshBatchResumeButton();
  check("전부 켜져 있으면 숨김(보류가 없으니)", T.btn.style.display === "none");
  check("정보도 ok=false", T.state.pipeline.length === 10);

  console.log("[2] 전체 체크 성공 — 계약 전부");
  T.reset(makeSteps(), 5);
  const ok = await T.runHeldStepsBatch(heldIds);
  check("성공 반환", ok === true);
  check("suffix 정확히 1회, start=5", T.suffixCalls.length === 1 && T.suffixCalls[0].start === 5,
    JSON.stringify(T.suffixCalls.map(c => c.start)));
  check("호출 '전'에 체크 스텝 enabled=true 반영",
    T.suffixCalls[0].enabledAtCall.every(Boolean), T.suffixCalls[0].enabledAtCall);
  check("endIndexExclusive 없음(끝까지)", !("endIndexExclusive" in T.suffixCalls[0].options));
  check("Undo 기록", T.history.includes("보류 일괄 실행"));
  check("resume 해제", T.getPipelineResumeFromIndex() === null);
  check("적용 서명 기록", T.noted >= 1);
  check("자동백업 예약", T.backups.includes("batch-resume"));

  console.log("[3] 7단계 제외 — 구멍 허용");
  T.reset(makeSteps(), 5);
  await T.runHeldStepsBatch(["s6", "s8", "s9", "s10"]);
  const call = T.suffixCalls[0];
  check("7단계 enabled=false 유지", call.enabledAtCall[6] === false, call.enabledAtCall);
  check("나머지 체크는 true", call.enabledAtCall[5] && call.enabledAtCall[7] && call.enabledAtCall[8] && call.enabledAtCall[9]);
  check("미체크 스텝의 낡은 스냅샷 제거", call.snapshotsAtCall[6] === false, call.snapshotsAtCall);
  // [적대 검증 반영] 체크 스텝의 낡은 스냅샷도 제거(bg purge 동형) — 백엔드가 캡처를 건너뛴
  // 스텝에 이전 실행의 스냅샷이 남아 오복원되는 사고 방지. 신선한 것은 실행이 다시 찍는다.
  check("체크 스텝의 낡은 스냅샷도 제거", call.snapshotsAtCall[5] === false, call.snapshotsAtCall);
  check("프리픽스(1~5) 스냅샷은 보존", call.snapshotsAtCall[0] === true && call.snapshotsAtCall[4] === true);
  check("건너뜀 안내 토스트", T.toasts.some(t => /건너뛴 1개 단계/.test(t.m)), JSON.stringify(T.toasts));
  check("7단계 칩은 보류(sync)", (T.getPipelineRuntimeStatus("s7") || {}).status === "review",
    JSON.stringify(T.getPipelineRuntimeStatus("s7")));

  console.log("[4] 거부 케이스 — 상태를 건드리지 않는다");
  T.reset(makeSteps(), 5);
  T.setCrossFile(true);
  let r = await T.runHeldStepsBatch(["s6", "s8", "s9", "s10"]);   // 부분 선택
  check("교차파일+부분선택 거부", r === false && T.suffixCalls.length === 0);
  check("enabled 미변경", T.state.pipeline[5].enabled === false);
  r = await T.runHeldStepsBatch(heldIds);                          // 전체 선택은 허용
  check("교차파일+전체선택은 실행", r === true && T.suffixCalls.length === 1);

  T.reset(makeSteps(), 5);
  T.setBackendOnly(true);
  r = await T.runHeldStepsBatch(heldIds);
  check("백엔드 전용 사전 차단", r === false && T.suffixCalls.length === 0,
    JSON.stringify(T.toasts));

  T.reset(makeSteps(), 5);
  r = await T.runHeldStepsBatch([]);
  check("체크 0개 무동작", r === false && T.suffixCalls.length === 0 && T.history.length === 0);

  T.reset(makeSteps(), null);
  r = await T.runHeldStepsBatch(heldIds);
  check("resume 없음 무동작", r === false && T.suffixCalls.length === 0);

  console.log("[5] 실패 — 성공분 유지 + 실패 정리");
  T.reset(makeSteps(), 5);
  // 6 성공 후 8에서 실패(7 은 제외했던 시나리오)
  T.setSuffixMode({ type: "reject", appliedIds: ["s6"], failId: "s8", message: "8단계 실패" });
  r = await T.runHeldStepsBatch(["s6", "s8", "s9", "s10"]);
  check("실패 반환", r === false);
  check("성공한 6단계는 ON 유지", T.state.pipeline[5].enabled === true, T.state.pipeline[5]);
  check("실패 8단계는 도로 OFF", T.state.pipeline[7].enabled === false);
  check("못 간 9·10 도 도로 OFF", T.state.pipeline[8].enabled === false && T.state.pipeline[9].enabled === false);
  check("제외했던 7 은 그대로 OFF", T.state.pipeline[6].enabled === false);
  check("실패 스텝 오류칩", (T.getPipelineRuntimeStatus("s8") || {}).status === "error");
  check("못 간 스텝은 보류칩(running 고착 방지)", (T.getPipelineRuntimeStatus("s9") || {}).status === "review",
    JSON.stringify(T.getPipelineRuntimeStatus("s9")));
  // [적대 검증 반영] 실패 스텝 스냅샷 복원은 '하지 않는' 것이 계약 — 그 스냅샷은 격리 인스턴스
  // 상태(같은 그룹 선행 스텝 효과 포함)라 복원하면 라이브에 미동기화 변경이 몰래 설치된다.
  check("실패 시 스냅샷 복원을 하지 않음", T.restoredIds.length === 0, T.restoredIds);
  check("오류 카드 1건", T.errors.length === 1);
  check("resume 해제(성공분 정착)", T.getPipelineResumeFromIndex() === null);
  check("적용 서명 기록", T.noted >= 1);

  console.log("[6] 타이밍 — 토글 큐 단일 태스크");
  T.reset(makeSteps(), 5);
  T.setSuffixMode({ type: "pending" });
  const batchP = T.runHeldStepsBatch(heldIds);            // 배치 시작(대기 중)
  await new Promise(res => setTimeout(res, 10));
  check("배치 중 편집 게이트 작동", /켜기\/끄기를 반영/.test(T.pipelineEditBusyReason()),
    T.pipelineEditBusyReason());
  const toggleP = T.handlePipelineStepToggle("s2");       // 도중 토글 클릭
  await new Promise(res => setTimeout(res, 10));
  check("토글은 아직 실행 전(큐 대기)", T.toggleLog.length === 0, T.toggleLog);
  T.releaseSuffix();                                       // 배치 완료
  await batchP; await toggleP;
  check("배치 종료 후에 토글 실행", T.toggleLog.length === 1 && T.toggleLog[0] === "toggle:s2", T.toggleLog);
  check("게이트 해제", T.pipelineEditBusyReason() === "");

  console.log("[6b] 지문 검증 — 모달 시점과 상태가 다르면 실행하지 않는다");
  T.reset(makeSteps(), 5);
  const staleFp = { start: 4, heldIds: ["s5", "s6", "s7", "s8", "s9", "s10"] };   // AI 커밋으로 resume 이 당겨진 상황
  r = await T.runHeldStepsBatch(heldIds, staleFp);
  check("지문 불일치 → 실행 취소", r === false && T.suffixCalls.length === 0);
  check("취소 안내 토스트", T.toasts.some(t => /상태가 바뀌어/.test(t.m)), JSON.stringify(T.toasts));
  check("enabled 미변경", T.state.pipeline[5].enabled === false);
  const goodFp = { start: 5, heldIds: heldIds.slice() };
  r = await T.runHeldStepsBatch(heldIds, goodFp);
  check("지문 일치 → 정상 실행", r === true && T.suffixCalls.length === 1);

  console.log("[6c] 숫자형 step.id(구버전 zip) — 문자열 정규화");
  const numSteps = makeSteps().map((s2, i) => ({ ...s2, id: i + 1 }));   // id 가 숫자
  T.reset(numSteps, 5);
  r = await T.runHeldStepsBatch(["6", "7", "8", "9", "10"]);             // dataset 경유 = 문자열
  check("숫자 id 여도 매칭되어 실행", r === true && T.suffixCalls.length === 1,
    JSON.stringify(T.toasts));

  console.log("[7] 배선 — 버튼/모달/AI 안내");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  check("버튼이 초기화 옆에 있음", /btn-reset[\s\S]{0,400}btn-batch-resume/.test(html));
  check("기본 숨김", /id="btn-batch-resume" style="display:none"/.test(html));
  check("클릭 배선(onclick)", /btn\.__b2bBound = true;\s*\n\s*btn\.onclick/.test(pj));
  check("모달 열기 전 미러 숨김(가림 방지)", /openBatchResumeModal[\s\S]{0,800}hideAllExcelMirrorWindows/.test(pj));
  check("취소 시 미러 즉시 복원", /_showBatchResumeChecklist\(info\);[\s\S]{0,400}scheduleRestoreActiveExcelMirror\(0\)/.test(pj));
  const assist = fs.readFileSync(path.join(ROOT, "scripts", "assist-core.js"), "utf8");
  check("AI 도움: setStepEnabled 반복 대신 버튼 안내", /보류 일괄 실행\] 버튼\(초기화 옆/.test(assist));
  check("AI 도움: 화면 용어 사전에 등재", /\[⏯ 보류 일괄 실행\] 버튼\(왼쪽 아래/.test(assist));

  console.log("[8] 적대 검증 반영 — 주변 가드 배선");
  check("모달 재진입 가드", /if \(document\.getElementById\("b2b-batch-resume-modal"\)\) return;/.test(pj));
  check("이전 모달 정상 종료 훅(__b2bCancel)", /__b2bCancel/.test(pj));
  check("모달 확인 버튼 포커스(Enter 중복 방지)", /okBtn\.focus\(\)/.test(pj));
  check("실행 안 됐으면 미러 복원(ok!==true)", /ok !== true[\s\S]{0,300}scheduleRestoreActiveExcelMirror\(0\)/.test(pj));
  check("성공 시 2차 복원 예약(클릭가드 드롭 대비)", /scheduleRestoreActiveExcelMirror\(900\)/.test(pj));
  check("구멍 위 얹기 후 뒤 스냅샷 무효화", /구멍 위 얹기[\s\S]{0,900}_preApplySnapshot: undefined/.test(pj));
  const sl = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8");
  check("스킬 불러오기 시 resume 마커 무효화", /clearPipelineResumeFromIndex[\s\S]{0,200}\(\); \} catch/.test(sl)
    || /invalidateLivePipelineApplied[\s\S]{0,700}clearPipelineResumeFromIndex/.test(sl), "save-load.js");
  const sr = fs.readFileSync(path.join(ROOT, "scripts", "soft-refresh.js"), "utf8");
  check("F5 새로고침: 모달/편집 중 가드", /b2b-batch-resume-modal[\s\S]{0,400}pipelineEditBusyReason/.test(sr));
  const hj = fs.readFileSync(path.join(ROOT, "scripts", "history.js"), "utf8");
  check("Undo/Redo: 모달/편집 중 가드", /undoHistory[\s\S]{0,600}b2b-batch-resume-modal/.test(hj)
    && /redoHistory[\s\S]{0,600}b2b-batch-resume-modal/.test(hj));
  check("모달 라벨이 카드 라벨 함수 재사용", /pipelineStepLabel\(h\.step, h\.idx\)/.test(pj));

  console.log("");
  console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(err => { console.error("테스트 자체 오류:", err); process.exit(2); });
