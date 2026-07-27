// [회귀] 보류 구간 토글(STEP ON) 시 이어실행 동작 — 실제 runFromCheckpointAfterEdit 추출 검증.
//  - [현 계약 — '수정 미반영 수정'(판교테크윈) 이후] 복원 실패(mustRestore && !restored)는 더 이상
//    false 를 반환하지 않는다: 조용한 false 는 호출 UI 가 '✓ 적용됨'으로 오표시하는 원인이었다.
//    → 라이브 세션이 있으면 pristine 전체 재적용(reapplyVbaPipelineToLive) 폴백으로 반드시 실행하고,
//      세션도 없으면 명시적 오류를 던진다(조용한 무실행 금지).
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
let suffixRan = false, pendingMarks = [], reapplyRan = false;
let liveExcelId = "excel1";

globalThis.state = { pipeline: [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }, { id: "s5" }] };

const harness = `
  function getPipelineResumeFromIndex() { return resumeIdx; }
  async function restorePipelineCheckpointForSuffix(start, before, opts) { return restoreResult; }
  function markPipelinePendingFromIndex(i, o) { pendingMarks.push(i); }
  async function runPipelineSuffixFromCheckpoint(start, opts) { suffixRan = true; return { ok: true, applied: 1, start }; }
  function vbaTargetExcelId() { return liveExcelId; }
  async function reapplyVbaPipelineToLive(excelId) { reapplyRan = true; return { ok: true }; }
  function toast() {}
`;
eval(harness + "\n" + extractAsyncFunction("runFromCheckpointAfterEdit") + "\nglobalThis.RUN = runFromCheckpointAfterEdit;");

let pass = 0, fail = 0;
const ck = (n, c) => { if (c) { pass++; console.log(" OK  " + n); } else { fail++; console.log("FAIL " + n); } };

(async () => {
  // 케이스 A — STEP4 ON: 복원 필요(requestedStart=3 < resume=5) 인데 스냅샷 없어 복원 실패
  // → pristine 전체 재적용 폴백이 '반드시' 실행된다(조용한 무실행/false 금지 — 현 계약).
  resumeIdx = 5; restoreResult = false; suffixRan = false; pendingMarks = []; reapplyRan = false; liveExcelId = "excel1";
  const a = await RUN(3, state.pipeline, {});
  ck("[STEP4 ON] 복원 실패 → pristine 전체 재적용 폴백 실행", reapplyRan === true);
  ck("[STEP4 ON] 폴백 결과 truthy(수정본 실행 보장)", a === true);
  ck("[STEP4 ON] suffix 는 실행되지 않음(복원 실패라)", suffixRan === false);

  // 케이스 A2 — 복원 실패 + 라이브 세션도 없음 → 명시적 오류(조용한 무실행 금지)
  resumeIdx = 5; restoreResult = false; suffixRan = false; reapplyRan = false; liveExcelId = null;
  let threw = false;
  try { await RUN(3, state.pipeline, {}); } catch (_) { threw = true; }
  ck("[STEP4 ON/세션없음] 명시적 오류 throw", threw === true && reapplyRan === false);

  // 케이스 B — STEP5 ON: 복원 불필요(requestedStart=4 >= resume=4) → 곧장 suffix 실행(정상 반영)
  resumeIdx = 4; restoreResult = false; suffixRan = false; pendingMarks = []; liveExcelId = "excel1";
  const b = await RUN(4, state.pipeline, {});
  ck("[STEP5 ON] 복원 불필요 → suffix 실행됨", suffixRan === true);
  ck("[STEP5 ON] 결과 truthy(이어실행 성공)", !!b && b.ok === true);

  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
