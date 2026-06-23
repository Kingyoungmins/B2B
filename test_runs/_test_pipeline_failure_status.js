const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const statusStart = src.indexOf("function getPipelineRuntimeStatus");
const statusEnd = src.indexOf("function canUseBackendCurrentCacheForAppend");
const activeStart = src.indexOf("function getActivePipelineStepIds");
const activeEnd = src.indexOf("function setGeneratorRunLoading");
if (statusStart < 0 || statusEnd < 0 || statusEnd <= statusStart) throw new Error("pipeline status helper slice not found");
if (activeStart < 0 || activeEnd < 0 || activeEnd <= activeStart) throw new Error("pipeline active helper slice not found");

let renderCount = 0;
globalThis.window = {};
globalThis.renderPipeline = () => { renderCount += 1; };
globalThis.isStepEnabled = step => !step || step.enabled !== false;
globalThis.state = {
  pipeline: [
    { id: "s1", enabled: true },
    { id: "s2", enabled: true },
    { id: "s3", enabled: true },
  ],
};

eval(
  src.slice(statusStart, statusEnd) +
  "\n" +
  src.slice(activeStart, activeEnd) +
  "\nglobalThis.H = { getActivePipelineStepIds, getPipelineRuntimeStatus, setPipelineRuntimeStatus, markPipelineRunFailureStatus };"
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function resetStatuses() {
  window.pipelineStepRuntimeStatus = {};
}

resetStatuses();
const ids = H.getActivePipelineStepIds();
H.setPipelineRuntimeStatus(ids, "running", "실행 중");
H.setPipelineRuntimeStatus(["s1"], "applied", "적용됨");
H.markPipelineRunFailureStatus({ errorInfo: { stepIdx: 1, stepId: "s2" } }, ids);
assert(H.getPipelineRuntimeStatus("s1").status === "applied", "successful prior step must stay applied");
assert(H.getPipelineRuntimeStatus("s2").status === "error", "failed step must become error");
assert(!H.getPipelineRuntimeStatus("s3"), "not-yet-run later step must be cleared, not error");

resetStatuses();
H.setPipelineRuntimeStatus(ids, "running", "실행 중");
H.setPipelineRuntimeStatus(["s1"], "applied", "적용됨");
H.markPipelineRunFailureStatus(new Error("unknown backend failure"), ids);
assert(H.getPipelineRuntimeStatus("s1").status === "applied", "applied step must not be overwritten on unknown failure");
assert(H.getPipelineRuntimeStatus("s2").status === "error", "unknown failure marks remaining running step error");
assert(H.getPipelineRuntimeStatus("s3").status === "error", "unknown failure marks remaining running step error");

console.log("pipeline failure status OK", { renderCount });
