// [0.5.15 Bug2] 원래 계약: 마지막 스텝을 수정/복구해도 1단계부터 전체 재실행하면 안 된다.
//
// [계약 갱신 2026-07-29 · 사용자 확정] '수정 적용' = 그 스텝을 즉시 켜서 '그 스텝만' 적용하고 뒤 스텝은
//   보류(OFF). 그래서 지금은 runFromCheckpointAfterEdit(구간 이어실행)이 아니라 단일 적용을 탄다.
//   변하지 않은 핵심은 그대로다 — 전체 재실행(reapply)은 하지 않는다.
// [계약 추가 2026-08-26 · 제보] 실행기에서는 라이브 적용 자체를 하지 않는다. 코드만 갈아 끼우고
//   반영은 [전체실행]에 맡긴다(그 경로엔 경계 스냅샷 이어실행이 있다).
//
// ※ 이 하네스는 소스가 옮겨 가며 ReferenceError 로 죽어 있었다(2026-08-26 발견) — 그동안 계약이 두 번
//   바뀌었는데 아무도 몰랐다. 살리면서 지금 계약으로 맞춘다.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const start = src.indexOf("function replaceLogicAt");
const end = src.indexOf("function computeStateBeforeStep");
if (start < 0 || end < 0 || end <= start) throw new Error("replaceLogicAt slice not found");

globalThis.window = {};  // 폴백(reapply) 분기가 window.__activeVbaApply 를 설정
let suffixCalls = [];   // runFromCheckpointAfterEdit(idx) 호출 인덱스
let reapplyCalls = 0;   // reapplyVbaPipelineToLive(전체 재실행) 호출 수
let singleApplyCalls = 0;   // applyMappedSingleStep(그 스텝만 적용) 호출 수

function makePipeline(withSnap) {
  const steps = [];
  for (let i = 1; i <= 6; i++) steps.push({ id: "s" + i, language: "vba", code: "Sub B2BSkill(): End Sub", enabled: true });
  if (withSnap) {  // 1..5 적용 + s6/s3 직전 스냅샷(에러난 마지막 스텝도 직전 스냅샷 보유)
    steps[5]._preApplySnapshot = { resultId: "dl_s6", excelId: "ex", downloadUrl: "/x", name: "s6.xlsx" };
    steps[2]._preApplySnapshot = { resultId: "dl_s3", excelId: "ex", downloadUrl: "/x", name: "s3.xlsx" };
  }
  return steps;
}

const prelude = `
function normalizeStep(s){ return s; }
function lastLiveStepIndex(steps){ let last=-1; (steps||[]).forEach((s,i)=>{ if(s&&s.language) last=i; }); return last; }
function getPipelineResumeFromIndex(){ return null; }
function canUsePipelineCheckpointFromIndex(idx, beforeSteps){
  return (beforeSteps||[]).slice(idx).some(s => s && s._preApplySnapshot && s._preApplySnapshot.resultId);
}
async function runFromCheckpointAfterEdit(idx){ suffixCalls.push(idx); return { ok:true }; }
function setPipelineRuntimeStatus(){}
function isStepEnabled(s){ return s && s.enabled !== false; }
function renderPipeline(){}
function refreshRunButton(){}
function scheduleLogicAutoBackup(){}
function pushHistory(){}
function restorePipelineStep(){}
function reportPipelineError(){}
function getSkillEngine(){ return "vba"; }
function pipelineUsesVba(){ return true; }
function vbaTargetExcelId(){ return "ex"; }
async function reapplyVbaPipelineToLive(){ reapplyCalls += 1; return true; }
function toast(){}
function requestExcelApplyCancel(){ return false; }
function pipelineUsesPython(){ return false; }
function shouldDeferImmediatePipelineRun(){ return false; }
async function reconcilePipelineSimulationAfterEdit(){ return true; }
// [하네스 복구 2026-08-26] 소스가 옮겨 가며 아래가 슬라이스 밖으로 나가 ReferenceError 로
// 이 테스트가 통째로 죽어 있었다. 이 테스트의 관심사가 아니므로 보수적인 스텁을 준다.
function pipelineStepLiveLanguage(s){ return (s && s.language) || "vba"; }
function pipelineStepWritesCrossFile(){ return false; }
function pipelineSuffixWritesCrossFile(){ return false; }
// 이 하네스는 "런타임 상태 표시가 없는" 상태를 가정한다(원래 검증 대상 분기).
// "applied" 를 돌려주면 _anyApplied 분기로 새서 검증하려던 이어실행 경로에 도달하지 못한다
// — 스텁이 테스트를 조용히 무력화하는 전형적인 함정이라 명시해 둔다.
function getPipelineRuntimeStatus(){ return null; }
function markPipelinePendingFromIndex(){}
function noteLivePipelineApplied(){}
function dropStepCrossEvidence(){}
function pipelineEditBusyReason(){ return ""; }
function pipelineHasBackendOnlyStep(){ return false; }
function getFile(){ return {}; }
function pipelineResolveSavedTargetFileId(x){ return x; }
async function restorePipelineToCheckpointAndHold(){ return false; }
async function applyMappedSingleStep(){ singleApplyCalls += 1; return true; }
`;

eval(prelude + "\n" + src.slice(start, end) + "\nglobalThis.replaceLogicAt = replaceLogicAt;");

let pass = 0, fail = 0;
function ck(n, c) { if (c) { pass++; console.log(" OK  " + n); } else { fail++; console.log("FAIL " + n); } }

async function run(stepId, withSnap, page) {
  suffixCalls = []; reapplyCalls = 0; singleApplyCalls = 0;
  globalThis.state = { pipeline: makePipeline(withSnap), currentPage: page || "generator" };
  const r = replaceLogicAt(stepId, "Sub B2BSkill(): End Sub 'fixed", "fix", "vba");
  if (process.env.DBG) console.log("   [DBG]", stepId, withSnap, page || "generator", "single=", singleApplyCalls, "reapply=", reapplyCalls);
  if (r && r.promise) await r.promise.catch(() => {});
}

async function main() {
  // 1) 마지막 스텝(s6) 수정 → 그 스텝만 적용. 1단계부터 전체 재실행은 금지(원래 계약의 핵심).
  await run("s6", true);
  ck("[핵심] 마지막 스텝 수정 → 전체 재실행(reapply) 안 함", reapplyCalls === 0);
  ck("[현행] 마지막 스텝 수정 → 그 스텝만 단일 적용", singleApplyCalls === 1);

  // 2) 중간 스텝(s3) 수정도 같다(회귀)
  await run("s3", true);
  ck("[회귀] 중간 스텝 수정 → 단일 적용, 전체 재실행 없음", singleApplyCalls === 1 && reapplyCalls === 0);

  // 3) 직전 스냅샷이 없어도 전체 재실행으로 떨어지지 않는다(단일 적용이 스냅샷을 그때 캡처한다)
  await run("s6", false);
  ck("[폴백] 스냅샷 없어도 전체 재실행 안 함", reapplyCalls === 0 && singleApplyCalls === 1);

  // 4) 실행기에서는 라이브를 아예 안 건드린다 — 코드만 교체(2026-08-26 제보 수정)
  await run("s6", true, "runner");
  ck("[실행기] 단일 적용도 전체 재실행도 안 함", singleApplyCalls === 0 && reapplyCalls === 0);
  ck("[실행기] 코드는 바뀐다", (globalThis.state.pipeline[5].code || "").includes("fixed"));

  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
