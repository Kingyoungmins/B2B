// [0.5.15 Bug2 본수정] "수정 적용"(에러복구) = replaceLogicAt. 마지막 스텝을 수정/복구해도 '그 스텝 직전
// 스냅샷'에서 이어실행해야 한다(전체 1단계부터 재실행 금지). 예전엔 idx<lastBeforeIdx 일 때만 이어실행 →
// 마지막 스텝(예: 6단계)이 전체 재실행으로 떨어졌다. 스냅샷 있으면 마지막 스텝도 suffix 이어실행, 없으면 폴백.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const start = src.indexOf("function replaceLogicAt");
const end = src.indexOf("function computeStateBeforeStep");
if (start < 0 || end < 0 || end <= start) throw new Error("replaceLogicAt slice not found");

globalThis.window = {};  // 폴백(reapply) 분기가 window.__activeVbaApply 를 설정
let suffixCalls = [];   // runFromCheckpointAfterEdit(idx) 호출 인덱스
let reapplyCalls = 0;   // reapplyVbaPipelineToLive(전체 재실행) 호출 수

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
`;

eval(prelude + "\n" + src.slice(start, end) + "\nglobalThis.replaceLogicAt = replaceLogicAt;");

let pass = 0, fail = 0;
function ck(n, c) { if (c) { pass++; console.log(" OK  " + n); } else { fail++; console.log("FAIL " + n); } }

async function run(stepId, withSnap) {
  suffixCalls = []; reapplyCalls = 0;
  globalThis.state = { pipeline: makePipeline(withSnap) };
  const r = replaceLogicAt(stepId, "Sub B2BSkill(): End Sub 'fixed", "fix", "vba");
  if (r && r.promise) await r.promise.catch(() => {});
}

async function main() {
  // 1) 마지막 스텝(s6, idx5) 수정 + 스냅샷 → 이어실행(suffix), 전체 재실행 X  ← 본수정 핵심
  await run("s6", true);
  ck("[본수정] 마지막 스텝 수정 → 이어실행(runFromCheckpointAfterEdit idx=5)", suffixCalls.length === 1 && suffixCalls[0] === 5);
  ck("[본수정] 마지막 스텝 수정 → 전체 재실행(reapply) 안 함", reapplyCalls === 0);

  // 2) 중간 스텝(s3, idx2) 수정 + 스냅샷 → 이어실행(회귀)
  await run("s3", true);
  ck("[회귀] 중간 스텝 수정 → 이어실행(idx=2), reapply 없음", suffixCalls.length === 1 && suffixCalls[0] === 2 && reapplyCalls === 0);

  // 3) 마지막 스텝 수정인데 스냅샷 없음 → 폴백(전체 재실행) 유지
  await run("s6", false);
  ck("[폴백] 스냅샷 없으면 전체 재실행(reapply)로 폴백", suffixCalls.length === 0 && reapplyCalls === 1);

  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
