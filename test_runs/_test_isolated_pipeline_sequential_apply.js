// [0.5.14 batch] runIsolatedLivePipelineSteps 는 '연속 같은-파일 스텝'을 한 콜로 묶어 백엔드 한 격리
// 인스턴스에서 순서대로(혼합엔진 포함) 실행한다. 스텝당 콜/스텝당 스냅샷/별도 reset-only 콜은 없다.
// 첫 그룹은 reset:true(백엔드가 pristine sourcePath 에서 시작), 같은 파일 후속 그룹은 reset:false.
// 그룹 실행이 실패하면 백엔드가 동기화 전에 중단 → 라이브 미반영(원자적), 실패는 errorInfo 로 전파.
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const start = src.indexOf("function wirePipelineStepSnapshots");
const end = src.indexOf("function pipelineStepReadsOtherFile");
if (start < 0 || end < 0 || end <= start) throw new Error("runIsolatedLivePipelineSteps slice not found");

let calls = [];
let statuses = [];
let muted = 0, unmuted = 0, loadingStarted = 0, loadingEnded = 0;
let failS3 = true;

globalThis.state = { currentFileId: "fileA" };

const prelude = `
function activePipelineSteps(steps) { return (steps || []).filter(s => s && s.enabled !== false); }
function pipelineStepLiveLanguage(step) { return step.language || "python"; }
function pipelinePinnedTargetFileId() { return null; }
function preferredVbaRunFileId() { return "fileA"; }
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
  // batch: 한 콜에 그룹의 모든 스텝이 담긴다. s3 가 그룹에 있으면 그 콜이 실패(백엔드 step 에러 모사).
  if (failS3 && payload.steps.some(s => s && s.stepId === "s3")) {
    const err = new Error("step 3 failed");
    // 실패해도 백엔드는 '실패 step 직전까지' 스텝-전 스냅샷을 errorInfo.stepSnapshots 로 실어 보낸다.
    err.errorInfo = {
      stepIdx: 2, stepId: "s3",
      stepSnapshots: payload.steps.map(s => ({
        stepIdx: s.stepIdx, stepId: s.stepId,
        downloadId: "dl_" + s.stepId, downloadUrl: "/api/workbooks/download/dl_" + s.stepId, name: s.stepId + ".xlsx",
      })),
    };
    throw err;
  }
  return {
    ok: true,
    liveSchema: { sheets: [] },
    // [0.5.14 빠른복구] 백엔드가 스텝 실행 '전' 스냅샷을 downloadId 로 반환.
    stepSnapshots: payload.steps.map(s => ({
      stepIdx: s.stepIdx,
      stepId: s.stepId,
      downloadId: "dl_" + s.stepId,
      downloadUrl: "/api/workbooks/download/dl_" + s.stepId,
      name: s.stepId + ".xlsx",
    })),
  };
}
function syncStepPreApplySnapshot(step, snap) { if (step && snap) step._preApplySnapshot = { ...snap }; }
function setPipelineRuntimeStatus(ids, status, label) { statuses.push({ ids: ids.slice(), status, label }); }
function applyLiveSchemaToFileCache() {}
function endExcelMirrorApplyLoading() { loadingEnded += 1; }
function releaseExcelMirrorPipelineMute() { unmuted += 1; }
function scheduleRestoreActiveExcelMirror() {}
function noteLivePipelineApplied() {}
function restoreVbaExcelAfterError() {}
function createPipelineRuntimeExecutionBlockError(b) { const e = new Error("hard block"); e._stepInfo = b; return e; }
async function ensurePipelineReferencedSessionsOpen() {}
function findPipelineRuntimeExecutionBlocker() { return null; }
`;

eval(prelude + "\n" + src.slice(start, end) + "\nglobalThis.runIsolatedLivePipelineSteps = runIsolatedLivePipelineSteps;");

let pass = 0, fail = 0;
function ck(name, cond) { if (cond) { pass++; console.log(" OK  " + name); } else { fail++; console.log("FAIL " + name); } }

async function main() {
  const steps = [
    { id: "s1", language: "vba", code: "Sub B2BSkill(): End Sub" },
    { id: "s2", language: "python", code: "def transform(ctx): pass" },  // 혼합엔진(vba+python) 한 그룹
    { id: "s3", language: "vba", code: "Sub B2BSkill(): End Sub" },
  ];

  // ── 1) 실패 시나리오: 한 그룹(연속 fileA) → 한 콜(reset:true, steps=[s1,s2,s3]), s3 포함이라 실패 ──
  let threw = null;
  try { await runIsolatedLivePipelineSteps(steps, "excel:fileA"); }
  catch (err) { threw = String(err && err.message); }
  ck("[batch] 그룹당 백엔드 콜 1회(스텝당 X)", calls.length === 1);
  ck("[batch] 첫 그룹 reset:true", calls[0] && calls[0].reset === true);
  ck("[batch] 한 콜에 그룹의 모든 스텝(혼합엔진)", JSON.stringify(calls[0] && calls[0].steps) === JSON.stringify(["s1","s2","s3"]));
  ck("[batch] s3 실패가 전파됨", /step 3 failed/.test(threw || ""));
  ck("[batch] 실패 그룹은 applied 안 됨(원자적 미반영)",
     statuses.filter(s => s.status === "applied").flatMap(s => s.ids).length === 0);
  ck("[batch] 정리 훅 균형(mute/unmute/loading)", muted === 1 && unmuted === 1 && loadingStarted === 1 && loadingEnded >= 1);
  // 실패해도 errorInfo.stepSnapshots 가 step._preApplySnapshot 로 wiring → 자동복구 이어실행 가능
  ck("[batch 실패] 실패 step(s3) 직전 스냅샷 wiring",
     steps[2]._preApplySnapshot && steps[2]._preApplySnapshot.resultId === "dl_s3" &&
     steps[2]._preApplySnapshot.excelId === "excel:fileA");
  ck("[batch 실패] 직전 성공 스텝(s1)도 스냅샷 보유",
     steps[0]._preApplySnapshot && steps[0]._preApplySnapshot.resultId === "dl_s1");

  // ── 2) skipReset suffix(startIndex:1): 연속 [s2,s3] → 한 콜(reset:false), 성공 ──
  calls = []; statuses = []; muted = 0; unmuted = 0; loadingStarted = 0; loadingEnded = 0; failS3 = false;
  await runIsolatedLivePipelineSteps(steps, "excel:fileA", { startIndex: 1, skipReset: true });
  ck("[suffix] 한 콜만", calls.length === 1);
  ck("[suffix] reset:false(이어실행)", calls[0] && calls[0].reset === false);
  ck("[suffix] s2 부터 한 콜에", JSON.stringify(calls[0] && calls[0].steps) === JSON.stringify(["s2","s3"]));
  ck("[suffix] 성공 시 applied 표시", JSON.stringify(statuses.filter(s => s.status === "applied").flatMap(s => s.ids)) === JSON.stringify(["s2","s3"]));

  // ── 3) 빠른복구: 백엔드 stepSnapshots 가 각 step._preApplySnapshot 로 실리는지 (VBA/격리 경로 OFF/삭제 복구) ──
  ck("[snapshot] stepSnapshots 가 step._preApplySnapshot.resultId 로 실림",
     steps[1]._preApplySnapshot && steps[1]._preApplySnapshot.resultId === "dl_s2" &&
     steps[2]._preApplySnapshot && steps[2]._preApplySnapshot.resultId === "dl_s3");
  ck("[snapshot] 스냅샷에 라이브 세션 excelId 동봉(replace 대상)",
     steps[2]._preApplySnapshot && steps[2]._preApplySnapshot.excelId === "excel:fileA");

  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
