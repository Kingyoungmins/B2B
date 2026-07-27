const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("missing function " + name);
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

let calls = [];
globalThis.window = {};
globalThis.state = { pipeline: [] };

const harness = `
  var restorePipelineCheckpointForSuffix = async (start, beforeSteps, options) => {
    calls.push({ type: "restore", start, message: options && options.message });
    return true;
  };
  var markPipelinePendingFromIndex = (start, options) => {
    calls.push({ type: "pending", start, label: options && options.label });
  };
  var runPipelineSuffixFromCheckpoint = async (start, options) => {
    calls.push({ type: "suffix", start });
    return { ok: true, start };
  };
  var pipelineUsesLiveSkill = () => true;
  var pipelineHasBackendOnlyStep = () => false;
  // [lesson 45] canUsePipelineCheckpointFromIndex 에 교차파일 가드가 추가됨 — 이 테스트는
  // resume/인덱스 산수만 검증하므로 교차 없음으로 고정한다.
  var pipelineSuffixWritesCrossFile = () => false;
  var isStepEnabled = (s) => !!s && s.enabled !== false;
`;

eval([
  harness,
  extractFunction("getPipelineResumeFromIndex"),
  extractFunction("setPipelineResumeFromIndex"),
  extractFunction("clearPipelineResumeFromIndex"),
  extractAsyncFunction("runFromCheckpointAfterEdit"),
  extractFunction("canUsePipelineCheckpointFromIndex"),
  "globalThis.H = { setPipelineResumeFromIndex, clearPipelineResumeFromIndex, runFromCheckpointAfterEdit, canUsePipelineCheckpointFromIndex };",
].join("\n"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  state.pipeline = [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }, { id: "s5" }];

  calls = [];
  H.setPipelineResumeFromIndex(3);
  await H.runFromCheckpointAfterEdit(1, state.pipeline, { restoreMessage: "edit-before-resume" });
  assert(JSON.stringify(calls.map(c => [c.type, c.start])) === JSON.stringify([
    ["restore", 1],
    ["pending", 1],
    ["suffix", 1],
  ]), "editing before resume must restore to edited step checkpoint: " + JSON.stringify(calls));

  calls = [];
  H.setPipelineResumeFromIndex(3);
  await H.runFromCheckpointAfterEdit(4, state.pipeline, { restoreMessage: "edit-after-resume" });
  assert(JSON.stringify(calls.map(c => [c.type, c.start])) === JSON.stringify([
    ["pending", 3],
    ["suffix", 3],
  ]), "editing inside pending suffix must not restore and must keep existing resume: " + JSON.stringify(calls));

  calls = [];
  H.clearPipelineResumeFromIndex();
  await H.runFromCheckpointAfterEdit(2, state.pipeline, { restoreMessage: "no-resume" });
  assert(JSON.stringify(calls.map(c => [c.type, c.start])) === JSON.stringify([
    ["restore", 2],
    ["pending", 2],
    ["suffix", 2],
  ]), "without resume must restore requested checkpoint: " + JSON.stringify(calls));

  H.setPipelineResumeFromIndex(3);
  assert(H.canUsePipelineCheckpointFromIndex(4, [], state.pipeline) === true, "edit after resume can reuse existing resume checkpoint");
  assert(H.canUsePipelineCheckpointFromIndex(1, [], state.pipeline) === false, "edit before resume requires an actual earlier snapshot");
  // [수정 미반영 수정 반영] 이어실행 대상(활성+코드) '전부'가 자기 직전 스냅샷을 가질 때만 true —
  // 스냅샷만 있고 code 가 없는 옛 픽스처는 suffix 집계에서 빠져 false 가 된다(현 계약).
  assert(H.canUsePipelineCheckpointFromIndex(1, [{}, { code: "s2", _preApplySnapshot: { resultId: "r" } }], state.pipeline) === true,
    "edit before resume can use earlier pre-apply snapshot when present");
  assert(H.canUsePipelineCheckpointFromIndex(1, [{}, { code: "s2" }], state.pipeline) === false,
    "suffix step without its own snapshot must reject the fast path");

  console.log("pipeline checkpoint edit-before-resume OK");
})().catch(err => {
  console.error(err);
  process.exit(1);
});
