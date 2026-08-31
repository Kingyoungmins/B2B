// [0.8.2 녹화 검증 — 화면 쪽] 복붙 캡처로 만든 단계가 '보통 단계처럼' 다뤄지는가.
//
// 검증 요청(2026-08-31) 중 화면에서 일어나는 것들
//   · 기존 파이프라인 수정처럼 동작 가능한가        → replaceLogicAt
//   · on/off 가 유효한가                            → 토글 경로 + 되돌리기 스냅샷
//   · 녹화 스텝 특유의 취급이 그 둘을 깨뜨리지 않는가
//
// 녹화 스텝은 보통 단계와 다른 점이 세 가지 있다. 그 세 가지가 '예외'로 새지 않는지를 본다.
//   (1) 연결된 대화가 없다(코드가 곧 명세) — chat-ui 가 매칭을 시도하면 남의 대화에 붙는다
//   (2) 좌표가 코드에 박혀 있다 — LLM 자동복구가 손대면 '사용자가 한 그 동작'이 아니게 된다
//   (3) 교차파일이면 dst_book 이 대상, src_book 은 읽기 소스 — 뒤집히면 엉뚱한 파일을 고친다
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const NL = String.fromCharCode(10);
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "");
const PIPE = read("scripts/pipeline.js");
const CHAT = read("scripts/chat-ui.js");
const SCHEMA = read("scripts/file-schema.js");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 240) : "")); }
}
function fnOf(src, name) {
  const i = src.indexOf("function " + name);
  if (i < 0) throw new Error("함수 못 찾음: " + name);
  const ends = [NL + "function ", NL + "async function ", NL + "/* ", NL + "// ──"]
    .map(m => src.indexOf(m, i + 1)).filter(x => x > 0);
  const nx = ends.length ? Math.min.apply(null, ends) : -1;
  const body = src.slice(i, nx < 0 ? src.length : nx);
  return body.slice(0, body.lastIndexOf(NL + "}") + 2);
}

// 실제 캡처가 뱉는 코드(백엔드 _capture_copypaste_on_session_impl 출력 형태 그대로)
const REC_CODE =
  "def transform(ctx):" + NL +
  "    # [복붙 캡처] 사용자가 라이브 Excel에서 직접 복사/붙여넣기한 동작 재현(값+수식+서식 보존)" + NL +
  "    ctx.paste_copied('회선 현황', 'A1:C6', '집계', 'A3', src_book='원본자료.xlsx', dst_book='보고서양식.xlsx')" + NL;

console.log("[1] 수정 — 보통 단계와 같은 경로를 탄다");
{
  const calls = { single: 0, reapply: 0, reconcile: 0, toasts: [] };
  const state = {
    currentPage: "generator",
    pipeline: [
      { id: "s1", code: "def transform(ctx):\n    pass", enabled: true, language: "python" },
      { id: "rec", code: REC_CODE, enabled: true, language: "python",
        targetFileId: "input:보고서양식.xlsx", prompt: "복붙 캡처: 회선 현황!A1:C6 → 집계!A3" },
    ],
  };
  const env = {
    state,
    toast: m => calls.toasts.push(String(m)),
    normalizeStep: s => ({ ...s }),
    pushHistory: () => {}, renderPipeline: () => {}, refreshRunButton: () => {},
    scheduleLogicAutoBackup: () => {},
    pipelineEditBusyReason: () => "", pipelineHasBackendOnlyStep: () => false,
    pipelineStepWritesCrossFile: () => true,          // 녹화 교차파일 스텝
    pipelineSuffixWritesCrossFile: () => true,
    dropStepCrossEvidence: () => {},
    getPipelineResumeFromIndex: () => null,
    markPipelinePendingFromIndex: () => {},
    noteLivePipelineApplied: () => {},
    getFile: () => ({}), pipelineResolveSavedTargetFileId: x => x,
    reapplyVbaPipelineToLive: async () => { calls.reapply += 1; return true; },
    applyMappedSingleStep: async () => { calls.single += 1; return true; },
    reconcilePipelineSimulationAfterEdit: async () => { calls.reconcile += 1; return true; },
    getPipelineRuntimeStatus: () => null,
    setPipelineRuntimeStatus: () => {},
    canUsePipelineCheckpointFromIndex: () => false,
    restorePipelineToCheckpointAndHold: async () => false,
    runFromCheckpointAfterEdit: async () => true,
    getSkillEngine: () => "python", pipelineUsesVba: () => false,
    vbaTargetExcelId: () => "ex1", currentExcelId: () => "ex1",
    isStepEnabled: s => s && s.enabled !== false,
    pipelineStepLiveLanguage: s => (s && s.language) || "python",
    pipelineUsesLiveSkill: () => true, liveEnabledStepsSignature: () => "sig",
    clearPipelineResumeFromIndex: () => {}, setPipelineResumeFromIndex: () => {},
    invalidateLivePipelineApplied: () => {},
    restorePipelineStep: () => {}, reportPipelineError: () => {},
    requestExcelApplyCancel: () => false, traceClientUiEvent: () => {},
    _lastLiveAppliedSignature: null, window: { __activeVbaApply: null }, console,
  };
  const names = Object.keys(env);
  const fn = new Function(...names, fnOf(PIPE, "replaceLogicAt") + NL + "return replaceLogicAt;")(
    ...names.map(k => env[k]));
  const newCode = REC_CODE.replace("'A3'", "'A10'");
  const r = fn("rec", newCode, null, "python", {});
  check("녹화 단계도 수정이 받아들여진다", r !== false, r);
  check("코드가 실제로 바뀐다", state.pipeline[1].code.includes("'A10'"), state.pipeline[1].code);
  check("보통 단계와 같은 적용 경로(단일 적용)", calls.single === 1, calls);
  check("전체 재적용으로 떨어지지 않는다", calls.reapply === 0, calls);
}

console.log("[2] 실행기에서 수정하면 라이브를 안 건드리고 [전체실행]에 맡긴다(0.8.0 계약)");
{
  const calls = { single: 0, reapply: 0 };
  const state = { currentPage: "runner",
    pipeline: [{ id: "rec", code: REC_CODE, enabled: true, language: "python" }] };
  const env = {
    state, toast: () => {}, normalizeStep: s => ({ ...s }), pushHistory: () => {},
    renderPipeline: () => {}, refreshRunButton: () => {}, scheduleLogicAutoBackup: () => {},
    pipelineEditBusyReason: () => "", pipelineHasBackendOnlyStep: () => false,
    pipelineStepWritesCrossFile: () => true, pipelineSuffixWritesCrossFile: () => true,
    dropStepCrossEvidence: () => {}, getPipelineResumeFromIndex: () => null,
    markPipelinePendingFromIndex: () => {}, noteLivePipelineApplied: () => {},
    getFile: () => ({}), pipelineResolveSavedTargetFileId: x => x,
    reapplyVbaPipelineToLive: async () => { calls.reapply += 1; return true; },
    applyMappedSingleStep: async () => { calls.single += 1; return true; },
    reconcilePipelineSimulationAfterEdit: async () => true,
    getPipelineRuntimeStatus: () => null, setPipelineRuntimeStatus: () => {},
    canUsePipelineCheckpointFromIndex: () => false,
    restorePipelineToCheckpointAndHold: async () => false,
    runFromCheckpointAfterEdit: async () => true, getSkillEngine: () => "python",
    pipelineUsesVba: () => false, vbaTargetExcelId: () => "ex1", currentExcelId: () => "ex1",
    isStepEnabled: s => s && s.enabled !== false,
    pipelineStepLiveLanguage: s => (s && s.language) || "python",
    pipelineUsesLiveSkill: () => true, liveEnabledStepsSignature: () => "sig",
    clearPipelineResumeFromIndex: () => {}, setPipelineResumeFromIndex: () => {},
    invalidateLivePipelineApplied: () => {}, restorePipelineStep: () => {},
    reportPipelineError: () => {}, requestExcelApplyCancel: () => false,
    traceClientUiEvent: () => {}, _lastLiveAppliedSignature: null,
    window: { __activeVbaApply: null }, console,
  };
  const names = Object.keys(env);
  const fn = new Function(...names, fnOf(PIPE, "replaceLogicAt") + NL + "return replaceLogicAt;")(
    ...names.map(k => env[k]));
  const r = fn("rec", REC_CODE.replace("'A3'", "'A20'"), null, "python", {});
  check("라이브 적용을 안 한다", calls.single === 0 && calls.reapply === 0, calls);
  check("코드만 갈아 끼운다", state.pipeline[0].code.includes("'A20'"));
  check("실행기 표식", !!r && r.runnerDeferred === true, r);
}

console.log("[3] on/off — 녹화 단계가 토글 대상에서 빠지지 않는다");
{
  const isEnabled = new Function(fnOf(PIPE, "isStepEnabled") + NL + "return isStepEnabled;")();
  const rec = { id: "rec", code: REC_CODE, enabled: true, language: "python" };
  check("켜짐으로 읽힌다", isEnabled(rec) === true);
  check("끄면 꺼짐으로 읽힌다", isEnabled({ ...rec, enabled: false }) === false);
  // 실행에 보낼 스텝을 고르는 규칙이 언어/코드만 보는지(녹화라고 제외하지 않는지)
  check("실행 대상 판정이 '녹화'를 특별 취급하지 않는다",
    !/복붙\s*캡처[\s\S]{0,80}(?:continue|return false|skip)/.test(PIPE));
}

console.log("[4] 녹화 단계 특유의 취급 — 그래도 되는 것/되면 안 되는 것");
{
  // 문자열을 뒤지지 말고 판정 함수를 직접 돌린다(따옴표·가운뎃점 표기에 안 흔들리게).
  const originless = new Function(fnOf(CHAT, "stepChatOriginless") + NL + "return stepChatOriginless;")();
  check("녹화 단계 = '연결된 대화 없음' 으로 판정(남의 대화에 붙는 것 방지)",
    originless({ id: "rec", code: REC_CODE, prompt: "복붙 캡처: 회선 현황!A1:C6 → 집계!A3" }) === true);
  check("보통 단계는 그대로 대화와 연결된다",
    originless({ id: "s1", code: "def transform(ctx):" + NL + "    pass", prompt: "합계를 넣어줘" }) === false);
  check("프롬프트가 비어도 출처 없음으로 본다", originless({ id: "x", code: "x", prompt: "" }) === true);
}
check("수정 안내가 '코드가 곧 명세'라고 알려 준다",
  /복붙 캡처\/수동 편집\)\. 원래 요청문이 없으므로 아래 코드가 곧 명세입니다/.test(SCHEMA));
check("LLM 자동복구가 녹화 좌표를 임의로 고치지 않는다",
  /캡처한 복붙은 '사용자가 실제로 한 동작의 정확 좌표 재생'이 목적/.test(PIPE));

console.log("[5] 교차파일 — 어느 파일이 '대상'인지 뒤집히지 않는다");
check("src_book 은 '읽기 소스'로 취급한다(대상 아님)",
  /src_book='소스', dst_book='대상'\) 의 src_book 은 '읽기 소스'다/.test(PIPE));
check("같은 파일 복붙에 dst_book 이 있어도 '교차'로 오해하지 않는다",
  /같은 파일 복사에 dst_book 을 명시하는 복붙 캡처 스텝이/.test(PIPE));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
