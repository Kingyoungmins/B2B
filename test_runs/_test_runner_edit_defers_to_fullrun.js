// [제보 2026-08-26] 실행기에서 30단계 실패 → '✓ 수정 적용'을 눌렀더니 "갑자기 알아서" 실행이 시작되고
// 화면엔 '스킬 재적용 중 / 실행 중'만 떴다(몇 단계인지 안 보임). 실측 로그(12:57:22~):
//   run-vba-pipeline reset=True × 6개 파일  →  steps=4 / 6 / 7 … 순차 재적용 = 1단계부터 전부 다시.
// 원인: replaceLogicAt 이 화면과 무관하게 라이브 재적용 경로로 갔다. 실행기의 결과물은 라이브가 아니라
// 출력 파일이고 반영 수단은 [전체실행]이다 — 게다가 그 경로엔 이제 경계 스냅샷 이어실행이 있어
// 저장된 지점(그날 27단계)부터 이어 돈다. 라이브 재적용은 그 이어실행을 통째로 버린다.
//
// 여기서 잠그는 것
//   1) 실행기에서 수정하면 라이브를 건드리지 않고 코드만 갈아 끼운다([전체실행]이 반영).
//   2) 생성기는 종전대로 즉시 적용(회귀 금지).
//   3) 재적용 경로가 돌 때는 '몇/몇 단계'가 보인다.
//   4) 그 경로에 '누가 불렀나'가 로그에 남는다(이번에 그게 없어서 호출자를 눈으로 찾았다).
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 300) : "")); }
}

/* 소스에서 함수 한 개를 잘라낸다(다음 최상위 function 직전까지). */
function fnOf(src, name) {
  const i = src.indexOf("\nfunction " + name + "(");
  if (i < 0) throw new Error("함수 못 찾음: " + name);
  const nx = src.indexOf("\nfunction ", i + 1);
  return src.slice(i, nx < 0 ? src.length : nx);
}

/* replaceLogicAt 을 스텁 환경에서 진짜로 실행한다 — 소스 문자열 매칭이 아니라 '동작'을 본다. */
function runReplace({ page, opts }) {
  const calls = { reapply: 0, applySingle: 0, reconcile: 0, toasts: [], pending: [] };
  const state = {
    currentPage: page,
    pipeline: [
      { id: "s1", code: "a", enabled: true, language: "python" },
      { id: "s2", code: "b", enabled: true, language: "python" },
      { id: "s3", code: "c", enabled: true, language: "python" },
    ],
  };
  const env = {
    state,
    toast: (m) => calls.toasts.push(String(m)),
    normalizeStep: (s) => ({ ...s }),
    pushHistory: () => {},
    renderPipeline: () => {},
    refreshRunButton: () => {},
    scheduleLogicAutoBackup: () => {},
    pipelineEditBusyReason: () => "",
    pipelineHasBackendOnlyStep: () => false,
    pipelineStepWritesCrossFile: () => false,
    pipelineSuffixWritesCrossFile: () => false,
    dropStepCrossEvidence: () => {},
    getPipelineResumeFromIndex: () => null,
    markPipelinePendingFromIndex: (i, o) => calls.pending.push([i, o && o.label]),
    noteLivePipelineApplied: () => {},
    getFile: () => ({}),
    pipelineResolveSavedTargetFileId: (x) => x,
    // 라이브를 건드리는 경로들 — 실행기에서는 한 번도 불리면 안 된다
    reapplyVbaPipelineToLive: async () => { calls.reapply += 1; return true; },
    applyMappedSingleStep: async () => { calls.applySingle += 1; return true; },
    reconcilePipelineSimulationAfterEdit: async () => { calls.reconcile += 1; return true; },
    getPipelineRuntimeStatus: () => ({ status: "applied" }),
    setPipelineRuntimeStatus: () => {},
    canUsePipelineCheckpointFromIndex: () => false,
    restorePipelineToCheckpointAndHold: async () => false,
    runFromCheckpointAfterEdit: async () => true,
    getSkillEngine: () => "python",
    pipelineUsesVba: () => false,
    vbaTargetExcelId: () => "ex1",
    isStepEnabled: (s) => s && s.enabled !== false,
    _lastLiveAppliedSignature: null,
    restorePipelineStep: () => {},
    reportPipelineError: () => {},
    requestExcelApplyCancel: () => false,
    traceClientUiEvent: () => {},
    pipelineStepLiveLanguage: (s) => (s && s.language) || "python",
    pipelineUsesLiveSkill: () => true,
    liveEnabledStepsSignature: () => "sig",
    clearPipelineResumeFromIndex: () => {},
    setPipelineResumeFromIndex: () => {},
    invalidateLivePipelineApplied: () => {},
    currentExcelId: () => "ex1",
    window: { __activeVbaApply: null },
    console,
  };
  const names = Object.keys(env);
  const body = fnOf(SRC, "replaceLogicAt") + "\nreturn replaceLogicAt;";
  const fn = new Function(...names, body)(...names.map(k => env[k]));
  const result = fn("s2", "새코드", null, "python", opts || {});
  return { result, calls, state };
}

console.log("[1] 실행기 — 수정은 코드만 갈아 끼우고 라이브는 안 건드린다");
{
  const { result, calls, state } = runReplace({ page: "runner" });
  check("라이브 재적용을 부르지 않는다", calls.reapply === 0, calls);
  check("단일 적용도 부르지 않는다", calls.applySingle === 0, calls);
  check("reconcile(리셋 후 전부 재적용)도 부르지 않는다", calls.reconcile === 0, calls);
  check("코드는 실제로 바뀐다", state.pipeline[1].code === "새코드", state.pipeline[1]);
  check("미적용으로 표시된다", !!result && result.applied === false && result.unapplied === true, result);
  check("실행기라는 표식을 돌려준다", !!result && result.runnerDeferred === true, result);
  check("안내는 [전체실행]", calls.toasts.some(t => /\[전체실행\]을 누르면 반영됩니다/.test(t)), calls.toasts);
  check("'라이브 미적용' 같은 개발자 말은 안 쓴다",
    !calls.toasts.some(t => /라이브 미적용/.test(t)), calls.toasts);
}

console.log("[1-b] VBA 실패→Python 에러복구본은 실행기 이관에도 '우회 플래그'를 잃지 않는다");
{
  // 복구 코드는 크고 read 가 많아 정적 게이트에 걸린다 → trustedStatic/extendedTimeout 이 있어야 완주한다.
  // 실행기 수정을 '미적용' 경로로 보내면서 이 둘을 무조건 끄면 [전체실행]에서 에러복구가 통째로 죽는다.
  const { state, result } = runReplace({ page: "runner", opts: { recoveredFromVba: true } });
  const st = state.pipeline[1];
  check("정적검사 우회 유지", st.trustedStatic === true, st);
  check("데드라인 확장 유지", st.extendedTimeout === true, st);
  check("그래도 라이브에는 적용하지 않는다", !!result && result.runnerDeferred === true, result);
  check("저장 시 승격 차단 표식은 남는다(미검증본이 zip 에 굳지 않게)", st._unappliedEdit === true, st);
}

console.log("[1-c] 보통 수정은 종전대로 우회 플래그를 끈다");
{
  const { state } = runReplace({ page: "runner" });
  const st = state.pipeline[1];
  check("정적검사 우회 꺼짐", st.trustedStatic !== true, st);
  check("데드라인 확장 꺼짐", st.extendedTimeout !== true, st);
}

console.log("[2] 생성기 — 종전대로 즉시 적용(회귀 금지)");
{
  const { result, calls } = runReplace({ page: "generator" });
  const applied = calls.applySingle + calls.reconcile + calls.reapply;
  check("적용 경로를 탄다", applied > 0 || (result && result.pending === true), { calls, result });
  check("실행기 표식이 붙지 않는다", !(result && result.runnerDeferred), result);
}

console.log("[3] 재적용이 돌 때는 '몇/몇 단계'가 보인다");
check("진행률 계산이 있다", /_progTotal = enabledSteps\.length/.test(SRC) && /_progDone \+= group\.steps\.length/.test(SRC));
check("실행기 상태줄에 보낸다", /runnerSetProgress\(text \+ " 실행 중\.\.\."\)/.test(SRC));
check("적용 오버레이·화면잠금에도 같은 문구", /setExcelMirrorApplyLoadingProgress\(text\)/.test(SRC) && /setUiBusySuffix\(text\)/.test(SRC));
check("묶음이 끝날 때마다 갱신", (SRC.match(/_reportProgress\(\)/g) || []).length >= 2);

console.log("[4] 재적용 경로에 '누가 불렀나'가 남는다");
check("진입 로그", /traceClientUiEvent\("pipeline\.reapply\.enter"/.test(SRC));
check("호출자·화면·단계수를 담는다", /reason: String\(options\.reason/.test(SRC) && /inRunner: String\(/.test(SRC) && /via: \(String\(\(new Error\(\)\)\.stack/.test(SRC));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
