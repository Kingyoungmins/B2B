const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const start = src.indexOf("async function runIsolatedLivePipelineSteps");
const end = src.indexOf("function pipelineStepReadsOtherFile");
if (start < 0 || end < 0 || end <= start) throw new Error("runIsolatedLivePipelineSteps slice not found");

const calls = [];
const statuses = [];
const snapshots = [];
let muted = 0;
let unmuted = 0;
let loadingStarted = 0;
let loadingEnded = 0;

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
  if (payload.steps[0] && payload.steps[0].stepId === "s3") {
    const err = new Error("step 3 failed");
    err.errorInfo = { stepIdx: 2, stepId: "s3" };
    throw err;
  }
  return { ok: true, liveSchema: { sheets: [] } };
}
async function captureStepPreApplySnapshot(step) { snapshots.push(step.id); return { resultId: "snap:" + step.id }; }
function setPipelineRuntimeStatus(ids, status, label) { statuses.push({ ids, status, label }); }
function applyLiveSchemaToFileCache() {}
function endExcelMirrorApplyLoading() { loadingEnded += 1; }
function releaseExcelMirrorPipelineMute() { unmuted += 1; }
function scheduleRestoreActiveExcelMirror() {}
function noteLivePipelineApplied() {}
function restoreVbaExcelAfterError() {}
`;

eval(prelude + "\n" + src.slice(start, end) + "\nglobalThis.runIsolatedLivePipelineSteps = runIsolatedLivePipelineSteps;");

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
  console.log("isolated pipeline sequential apply OK");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
