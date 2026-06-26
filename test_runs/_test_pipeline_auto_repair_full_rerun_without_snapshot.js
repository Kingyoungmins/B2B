// [동작 변경 2026-06-25] 자동복구 후 '실패 step 직전 스냅샷'이 없을 때:
//   예전: "checkpoint snapshot missing" 으로 즉시 중단(데드엔드) — 사용자가 수동으로 단계 토글해야 풀렸음.
//   지금: 보류 체크포인트를 비우고 pristine 부터 전체 재실행으로 폴백(전체실행은 reset:true + 관련 파일 전부
//         리셋이라 중복 적용 없이 안전). → 자동복구로 재생성된 코드가 그대로 전체 재실행에 반영된다.
// 실제 케이스: 한화 step5 가 ActiveSheet.UsedRange 셀단위 For-Each(하드블록) VBA → 백엔드 호출 전 클라단
// 차단 → 스냅샷 없음. 자동복구가 python(set_number_format)으로 재생성 → 전체 재실행 → 성공.
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");

function extractAsyncFunction(name) {
  const marker = `async function ${name}`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("missing async function " + name);
  const paramsEnd = src.indexOf(")", start);
  let i = src.indexOf("{", paramsEnd);
  if (i < 0) throw new Error("missing body " + name);
  let depth = 0;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unterminated " + name);
}

let runCalls = 0;
const calls = [];
let resumeCleared = 0;
console.warn = () => {};

globalThis.state = {
  pipeline: [{ id: "s1", code: "def transform(ctx): pass", language: "python" }],
};

const harness = `
  const PIPELINE_AUTO_REPAIR_MAX_REPAIRS = 2;
  const PIPELINE_AUTO_REPAIR_MAX_PER_STEP = 2;
  function getPipelineResumeFromIndex() { return null; }
  function clearPipelineResumeFromIndex() { resumeCleared += 1; }
  function findPipelineStaticPreflightFailure() { return null; }
  function pipelineStepLiveLanguage() { return true; }
  async function runPipelinePreferBackend() {
    runCalls += 1;
    // 1회차: 하드블록/런타임 실패. 2회차(자동복구 후 전체 재실행): 성공.
    if (runCalls >= 2) return { ok: true, applied: 1 };
    const err = new Error("runtime failed");
    err._stepInfo = { stepIdx: 0, stepId: "s1" };
    err.errorInfo = err._stepInfo;
    throw err;
  }
  function resolveRunnerRecoveryStepIndex(info) { return info && info.stepIdx; }
  async function restorePipelineToCheckpointAndHold() { calls.push("restoreHold"); return false; }
  function findMissingDependencySkillSuggestion() { return false; }
  function shouldSkipRuntimeAutoRepairForStep() { return false; }
  async function autoRepairPipelineStep() { calls.push("repair"); return state.pipeline[0]; }
  async function restorePipelineCheckpointForSuffix() { calls.push("restoreSuffix"); return false; }
  function markPipelinePendingFromIndex() { calls.push("pending"); }
  async function runPipelineSuffixFromCheckpoint() { calls.push("suffix"); return { ok: true }; }
  function createPipelineStepError(stepIdx, step, message, details) {
    const err = new Error(message);
    err._stepInfo = { stepIdx, stepId: step && step.id, details };
    return err;
  }
`;

eval([
  harness,
  extractAsyncFunction("runPipelineWithAutoRepair"),
  "globalThis.H = { runPipelineWithAutoRepair };",
].join("\n"));

(async () => {
  let result = null, threw = null;
  try {
    result = await H.runPipelineWithAutoRepair({ source: "runner" });
  } catch (err) {
    threw = String(err && (err.message || err));
  }
  // (a) "스냅샷 없음" 데드엔드로 죽지 않는다
  if (threw && /스냅샷|snapshot/.test(threw)) {
    throw new Error("must NOT dead-end with snapshot-missing message; got: " + threw);
  }
  // (b) 스냅샷 없으면 전체 재실행으로 폴백 → 두 번째 run 시도
  if (runCalls < 2) throw new Error("must fall back to full re-run when snapshot missing, runCalls=" + runCalls);
  // (c) 보류 체크포인트를 비웠다(skipReset 경로 안 타게)
  if (resumeCleared < 1) throw new Error("must clear resume checkpoint before full re-run");
  // (d) 재생성 후 전체 재실행이 성공하면 그 결과를 반환(데드엔드 X)
  if (!result || result.ok !== true) throw new Error("expected success after repair+full re-run, got: " + JSON.stringify(result) + " threw=" + threw);
  // (e) 복구 시퀀스: 보류복원→재생성→suffix시도(스냅샷 없음)→전체 재실행
  if (calls.join(",") !== "restoreHold,repair,restoreSuffix") {
    throw new Error("unexpected recovery calls: " + calls.join(","));
  }
  console.log("pipeline auto-repair full re-run without snapshot OK (runCalls=" + runCalls + ", resumeCleared=" + resumeCleared + ")");
})().catch(err => {
  console.error(err);
  process.exit(1);
});
