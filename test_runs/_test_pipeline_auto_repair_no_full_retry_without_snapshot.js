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
console.warn = () => {};

globalThis.state = {
  pipeline: [{ id: "s1", code: "def transform(ctx): pass", language: "python" }],
};

const harness = `
  const PIPELINE_AUTO_REPAIR_MAX_REPAIRS = 2;
  const PIPELINE_AUTO_REPAIR_MAX_PER_STEP = 2;
  function getPipelineResumeFromIndex() { return null; }
  function findPipelineStaticPreflightFailure() { return null; }
  function pipelineStepLiveLanguage() { return true; }
  async function runPipelinePreferBackend() {
    runCalls += 1;
    const err = new Error("runtime failed");
    err._stepInfo = { stepIdx: 0, stepId: "s1" };
    err.errorInfo = err._stepInfo;
    throw err;
  }
  function resolveRunnerRecoveryStepIndex(info) { return info && info.stepIdx; }
  async function restorePipelineToCheckpointAndHold() {
    calls.push("restoreHold");
    return false;
  }
  function findMissingDependencySkillSuggestion() { return false; }
  function shouldSkipRuntimeAutoRepairForStep() { return false; }
  async function autoRepairPipelineStep() {
    calls.push("repair");
    return state.pipeline[0];
  }
  async function restorePipelineCheckpointForSuffix() {
    calls.push("restoreSuffix");
    return false;
  }
  function markPipelinePendingFromIndex() { calls.push("pending"); }
  async function runPipelineSuffixFromCheckpoint() {
    calls.push("suffix");
    return { ok: true };
  }
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
  let threw = false;
  try {
    await H.runPipelineWithAutoRepair({ source: "runner" });
  } catch (err) {
    threw = /스냅샷|snapshot/.test(String(err && (err.message || err)));
  }
  if (!threw) throw new Error("auto repair must stop when checkpoint snapshot is missing");
  if (runCalls !== 1) throw new Error("must not retry full pipeline after missing snapshot, runCalls=" + runCalls);
  if (calls.join(",") !== "restoreHold,repair,restoreSuffix") {
    throw new Error("unexpected recovery calls: " + calls.join(","));
  }
  console.log("pipeline auto-repair no full retry without snapshot OK");
})().catch(err => {
  console.error(err);
  process.exit(1);
});
