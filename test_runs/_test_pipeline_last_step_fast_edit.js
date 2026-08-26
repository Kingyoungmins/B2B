const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const langStart = src.indexOf("function inferPipelineStepLanguage");
const langEnd = src.indexOf("function pipelineHasBackendOnlyStep");
const helperStart = src.indexOf("async function captureStepPreApplySnapshot");
const helperEnd = src.indexOf("function pipelineEditBusyReason");
if (langStart < 0 || langEnd < 0 || langEnd <= langStart) throw new Error("language helper slice not found");
if (helperStart < 0 || helperEnd < 0 || helperEnd <= helperStart) throw new Error("last-step helper slice not found");

globalThis.state = {
  pipeline: [
    { id: "s1", language: "python", code: "def transform(ctx): pass" },
    { id: "s2", language: "vba", code: "Sub B2BSkill(): End Sub" },
    { id: "s3", language: "python", code: "def transform(ctx): pass" },
  ],
};

const runtime = new Map([
  ["s1", { status: "applied" }],
  ["s2", { status: "applied" }],
  ["s3", { status: "applied" }],
]);

globalThis.getPipelineRuntimeStatus = id => runtime.get(id);
// [하네스 복구 2026-08-26] 소스가 옮겨 가며 아래 헬퍼들이 슬라이스 밖으로 나가
// ReferenceError 로 이 테스트가 통째로 죽어 있었다(실패인지도 모른 채 몇 달).
// 이 테스트의 관심사가 아니므로 보수적인 스텁을 준다.
globalThis.pipelineStepWritesCrossFile = () => false;
globalThis.pipelineSuffixWritesCrossFile = () => false;
globalThis.pipelineStepLiveLanguage = s => (s && s.language) || "python";

eval(
  src.slice(langStart, langEnd) +
  "\n" +
  src.slice(helperStart, helperEnd) +
  "\nglobalThis.H = { lastLiveStepIndex, canFastEditLastPipelineStep, isLastLivePipelineStep };"
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const steps = state.pipeline;
assert(H.lastLiveStepIndex(steps) === 2, "last live step must be the final live step");
assert(!H.canFastEditLastPipelineStep(steps[0], 0, steps), "first step must not use fast edit");
assert(!H.canFastEditLastPipelineStep(steps[1], 1, steps), "middle step must not use fast edit");
assert(H.canFastEditLastPipelineStep(steps[2], 2, steps), "last applied live step must use fast edit");

runtime.set("s3", { status: "error" });
assert(!H.canFastEditLastPipelineStep(steps[2], 2, steps), "errored last step must not use fast edit");
assert(H.isLastLivePipelineStep(steps[2], 2, steps), "errored last step is still the last live step for delete handling");
assert(!H.isLastLivePipelineStep(steps[1], 1, steps), "middle step is not last live step for delete handling");

console.log("pipeline last-step fast edit OK");
