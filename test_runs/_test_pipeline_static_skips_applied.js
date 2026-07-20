const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const start = src.indexOf("const PIPELINE_AUTO_REPAIR_MAX_REPAIRS");
const end = src.indexOf("function createPipelineStepError");
if (start < 0 || end < 0 || end <= start) throw new Error("pipeline static preflight slice not found");

globalThis.state = {
  pipeline: [
    { id: "done", enabled: true, language: "python", code: "def transform(ctx):\n    BAD_DONE" },
    { id: "todo", enabled: true, language: "python", code: "def transform(ctx):\n    BAD_TODO" },
    { id: "off", enabled: false, language: "python", code: "def transform(ctx):\n    BAD_OFF" },
    { id: "loaded", enabled: true, language: "python", code: "def transform(ctx):\n    BAD_LOADED", trustedStatic: true },
  ],
};

const runtime = new Map([
  ["done", { status: "applied" }],
  ["todo", { status: "review" }],
]);

globalThis.window = {};
globalThis.isStepEnabled = step => !step || step.enabled !== false;
globalThis.getPipelineRuntimeStatus = id => runtime.get(id) || null;
globalThis.inferPipelineStepLanguage = step => step && step.language || "python";
globalThis.pythonComStaticSafetyFailures = code => /BAD_/.test(String(code || "")) ? ["synthetic static failure"] : [];
globalThis.vbaStaticSafetyFailures = () => [];

eval(src.slice(start, end) + "\nglobalThis.H = { findPipelineStaticPreflightFailure };");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const first = H.findPipelineStaticPreflightFailure(state.pipeline);
assert(first && first.idx === 1 && first.step.id === "todo", "applied prefix must be skipped by static preflight");

const strict = H.findPipelineStaticPreflightFailure(state.pipeline, { skipApplied: false });
assert(strict && strict.idx === 0 && strict.step.id === "done", "skipApplied=false must preserve old full-scan behavior");

runtime.set("todo", { status: "applied" });
const none = H.findPipelineStaticPreflightFailure(state.pipeline);
assert(none === null, "all applied/trusted enabled steps must not be rechecked");

console.log("pipeline static skips applied OK");
