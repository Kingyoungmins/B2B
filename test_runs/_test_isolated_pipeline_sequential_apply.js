const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const start = src.indexOf("async function runIsolatedLivePipelineSteps");
const end = src.indexOf("function pipelineStepReadsOtherFile");
const syncStart = src.indexOf("function syncStepPreApplySnapshot");
const syncEnd = src.indexOf("function lastLiveStepIndex", syncStart);
if (start < 0 || end < 0 || end <= start) throw new Error("runIsolatedLivePipelineSteps slice not found");
if (syncStart < 0 || syncEnd < 0 || syncEnd <= syncStart) throw new Error("syncStepPreApplySnapshot slice not found");

const calls = [];
const statuses = [];
const snapshots = [];
let muted = 0;
let unmuted = 0;
let loadingStarted = 0;
let loadingEnded = 0;
let failS3 = true;
let captureEnabled = true;

globalThis.state = { currentFileId: "fileA" };

const prelude = `
function activePipelineSteps(steps) { return (steps || []).filter(s => s && s.enabled !== false); }
function pipelineStepLiveLanguage(step) { return step.language || "python"; }
function pipelinePinnedTargetFileId() { return null; }
function fileIdForExcelMirrorId() { return "fileA"; }
function pipelineStepMutationFileId() { return "fileA"; }
function isolatedPipelineStepPayload(step, stepIdx) {
  return { code: step.code, language: step.language, stepId: step.id, stepIdx, description: step.description || "" };
}
async function requirePipelineSessionExcelId(fileId) { return "excel:" + fileId; }
function muteExcelMirrorForPipeline() { muted += 1; }
function beginExcelMirrorApplyLoading() { loadingStarted += 1; }
async function postExcelMirror(url, payload) {
  calls.push({ url, reset: payload.reset, steps: payload.steps.map(s => s.stepId) });
  if (failS3 && payload.steps[0] && payload.steps[0].stepId === "s3") {
    const err = new Error("step 3 failed");
    err.errorInfo = { stepIdx: 2, stepId: "s3" };
    throw err;
  }
  return { ok: true, liveSchema: { sheets: [] } };
}
async function captureStepPreApplySnapshot(step) {
  snapshots.push(step.id);
  return captureEnabled ? { resultId: "snap:" + step.id } : null;
}
function createPipelineStepError(stepIdx, step, message, details) {
  const err = new Error(message);
  err._stepInfo = { stepIdx, stepId: step && step.id, details };
  return err;
}
function setPipelineRuntimeStatus(ids, status, label) { statuses.push({ ids, status, label }); }
function applyLiveSchemaToFileCache() {}
function endExcelMirrorApplyLoading() { loadingEnded += 1; }
function releaseExcelMirrorPipelineMute() { unmuted += 1; }
function scheduleRestoreActiveExcelMirror() {}
function noteLivePipelineApplied() {}
function restoreVbaExcelAfterError() {}
async function ensurePipelineReferencedSessionsOpen() {}
// 실행 전 하드블록 게이트 — 이 시나리오는 차단 대상이 없으므로 null(블록 없음).
function findPipelineRuntimeExecutionBlocker() { return null; }
`;

eval(prelude + "\n" + src.slice(syncStart, syncEnd) + "\n" + src.slice(start, end) + "\nglobalThis.runIsolatedLivePipelineSteps = runIsolatedLivePipelineSteps;");

async function main() {
  const steps = [
    { id: "s1", language: "vba", code: "Sub B2BSkill(): End Sub" },
    { id: "s2", language: "vba", code: "Sub B2BSkill(): End Sub" },
    { id: "s3", language: "vba", code: "Sub B2BSkill(): End Sub" },
  ];
  try {
    await runIsolatedLivePipelineSteps(steps, "excel:fileA");
  } catch (err) {
    if (!/step 3 failed/.test(String(err && err.message))) throw err;
  }
  if (calls.length !== 4) throw new Error("expected one reset call plus one backend call per step, got " + calls.length);
  if (calls[0].steps.length !== 0) throw new Error("first backend call must be reset-only");
  if (calls.slice(1).some(c => c.steps.length !== 1)) throw new Error("step backend calls must contain exactly one step");
  const resets = calls.map(c => c.reset);
  if (JSON.stringify(resets) !== JSON.stringify([true, false, false, false])) {
    throw new Error("reset should happen before step calls only: " + JSON.stringify(resets));
  }
  if (JSON.stringify(snapshots) !== JSON.stringify(["s1", "s2", "s3"])) {
    throw new Error("each step must capture a pre-apply snapshot after reset: " + JSON.stringify(snapshots));
  }
  const applied = statuses.filter(s => s.status === "applied").flatMap(s => s.ids);
  if (JSON.stringify(applied) !== JSON.stringify(["s1", "s2"])) {
    throw new Error("only successful prefix steps should be marked applied: " + JSON.stringify(applied));
  }
  if (loadingStarted !== 1 || loadingEnded < 1 || muted !== 1 || unmuted !== 1) {
    throw new Error("pipeline cleanup hooks were not balanced");
  }

  calls.length = 0;
  statuses.length = 0;
  snapshots.length = 0;
  muted = 0;
  unmuted = 0;
  loadingStarted = 0;
  loadingEnded = 0;
  failS3 = false;
  await runIsolatedLivePipelineSteps(steps, "excel:fileA", { startIndex: 1, skipReset: true });
  if (calls.length !== 2) throw new Error("skipReset suffix should call only s2/s3, got " + calls.length);
  if (calls.some(c => c.reset !== false)) throw new Error("skipReset suffix must not reset: " + JSON.stringify(calls));
  if (JSON.stringify(calls.map(c => c.steps[0])) !== JSON.stringify(["s2", "s3"])) {
    throw new Error("suffix should execute from s2: " + JSON.stringify(calls));
  }
  if (JSON.stringify(snapshots) !== JSON.stringify(["s2", "s3"])) {
    throw new Error("suffix should capture only s2/s3: " + JSON.stringify(snapshots));
  }

  calls.length = 0;
  statuses.length = 0;
  snapshots.length = 0;
  captureEnabled = true;
  failS3 = false;
  const canonical = steps.map(s => ({ ...s }));
  const clones = canonical.map(s => ({ ...s }));
  state.pipeline = canonical;
  await runIsolatedLivePipelineSteps(clones, "excel:fileA", { skipReset: true });
  const missingCanonical = canonical.filter(s => !s._preApplySnapshot || !s._preApplySnapshot.resultId).map(s => s.id);
  if (missingCanonical.length) {
    throw new Error("capturing cloned sourceSteps must sync snapshots onto state.pipeline: " + missingCanonical.join(","));
  }

  calls.length = 0;
  snapshots.length = 0;
  captureEnabled = false;
  let blocked = false;
  try {
    await runIsolatedLivePipelineSteps(steps, "excel:fileA");
  } catch (err) {
    blocked = /복구 스냅샷|pre-apply snapshot/.test(String(err && (err.message || err)));
  }
  if (!blocked) throw new Error("pipeline must stop when pre-apply snapshot capture fails");
  if (calls.length !== 1 || calls[0].reset !== true) {
    throw new Error("snapshot failure must stop before step execution: " + JSON.stringify(calls));
  }
  if (JSON.stringify(snapshots) !== JSON.stringify(["s1"])) {
    throw new Error("snapshot failure should only attempt the first pending step: " + JSON.stringify(snapshots));
  }

  console.log("isolated pipeline sequential apply OK");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
