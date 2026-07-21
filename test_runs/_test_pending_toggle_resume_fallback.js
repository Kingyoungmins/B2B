// [회귀] 보류 구간 토글(STEP ON) 시 이어실행 동작 — 실제 runFromCheckpointAfterEdit 추출 검증.
//  - 직전 스냅샷이 없어 복원이 안 되면(mustRestore && !restored) runFromCheckpointAfterEdit 는 false 를 반환한다.
//    → 토글 핸들러는 이 false 를 받아 '보류 방치' 대신 전체 재실행으로 폴백해야 한다(STEP4 ON 이 계속 보류로
//    남던 버그의 원인/조건). false 를 안 받으면 #5 처럼 토글만 켜지고 영영 보류.
//  - 복원이 필요없으면(requestedStart >= existingResume) 곧장 suffix 를 실행한다(STEP5 ON 이 4+5 둘 다 반영되던 정상 동작).
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");

function extractAsyncFunction(name) {
  const marker = `async function ${name}`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("missing async function " + name);
  const paramsEnd = src.indexOf(")", start);
  let i = src.indexOf("{", paramsEnd), depth = 0;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unterminated " + name);
}

let resumeIdx = 5;
let restoreResult = false;
let suffixRan = false, pendingMarks = [];

globalThis.state = { pipeline: [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }, { id: "s5" }] };

const harness = `
  function getPipelineResumeFromIndex() { return resumeIdx; }
  async function restorePipelineCheckpointForSuffix(start, before, opts) { return restoreResult; }
  function markPipelinePendingFromIndex(i, o) { pendingMarks.push(i); }
  async function runPipelineSuffixFromCheckpoint(start, opts) { suffixRan = true; return { ok: true, applied: 1, start }; }
`;
eval(harness + "\n" + extractAsyncFunction("runFromCheckpointAfterEdit") + "\nglobalThis.RUN = runFromCheckpointAfterEdit;");

let pass = 0, fail = 0;
const ck = (n, c) => { if (c) { pass++; console.log(" OK  " + n); } else { fail++; console.log("FAIL " + n); } };

(async () => {
  // 케이스 A — STEP4 ON: 복원 필요(requestedStart=3 < resume=5) 인데 스냅샷 없어 복원 실패 → false 반환
  resumeIdx = 5; restoreResult = false; suffixRan = false; pendingMarks = [];
  const a = await RUN(3, state.pipeline, {});
  ck("[STEP4 ON] 이어실행 불가 시 runFromCheckpointAfterEdit 가 false 반환(폴백 트리거)", a === false);
  ck("[STEP4 ON] suffix 는 실행되지 않음(복원 실패라)", suffixRan === false);

  // 케이스 B — STEP5 ON: 복원 불필요(requestedStart=4 >= resume=4) → 곧장 suffix 실행(정상 반영)
  resumeIdx = 4; restoreResult = false; suffixRan = false; pendingMarks = [];
  const b = await RUN(4, state.pipeline, {});
  ck("[STEP5 ON] 복원 불필요 → suffix 실행됨", suffixRan === true);
  ck("[STEP5 ON] 결과 truthy(이어실행 성공)", !!b && b.ok === true);

  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
