// [0.5.15 백그라운드 전체실행 - 클라] runIsolatedLivePipelineSteps 가 backgroundMode:true 면 그룹별 N콜이
// 아니라 /api/excel/run-full-pipeline 1콜로 보내고(전 그룹+resetExcelIds), 끝에 공용 정리로 fall-through 하는지.
// (백엔드 단일-인스턴스는 _test_fullrun_single_instance_live.py 로 라이브 검증됨 — 여기선 클라 라우팅/정리만.)
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const start = src.indexOf("function wirePipelineStepSnapshots");
const end = src.indexOf("function pipelineStepReadsOtherFile");
if (start < 0 || end < 0 || end <= start) throw new Error("slice not found");

let calls = [];
let statuses = [];
let muted = 0, unmuted = 0, loadingStarted = 0, loadingEnded = 0, schemaApplied = [];

globalThis.state = { currentFileId: "fileA" };
globalThis.fetch = undefined;            // 진행률 폴링 비활성(결정적) — 분기 가드 검증
globalThis.window = undefined;

const prelude = `
function activePipelineSteps(steps) { return (steps || []).filter(s => s && s.enabled !== false); }
function pipelineStepLiveLanguage(step) { return step.language || "python"; }
function pipelinePinnedTargetFileId() { return null; }
function preferredVbaRunFileId() { return "fileA"; }
function fileIdForExcelMirrorId() { return "fileA"; }
function pipelineStepMutationFileId(step) { return step.fileId; }   // 스텝별 대상 파일(다파일 그룹화)
function isolatedPipelineStepPayload(step, stepIdx) {
  return { code: step.code, language: step.language, stepId: step.id, stepIdx, description: step.description || "" };
}
async function requirePipelineSessionExcelId(fileId) { return "excel:" + fileId; }
function muteExcelMirrorForPipeline() { muted += 1; }
function beginExcelMirrorApplyLoading() { loadingStarted += 1; }
async function postExcelMirror(url, payload) {
  calls.push({ url, payload });
  // 단일-인스턴스 응답: 전역 applied + 스텝별 excelId 동봉 스냅샷 + 파일별 스키마
  const allSteps = (payload.groups || []).flatMap(g => g.steps.map(s => ({ g, s })));
  return {
    ok: true,
    applied: allSteps.length,
    stepSnapshots: allSteps.map(({ g, s }) => ({
      excelId: g.excelId, stepIdx: s.stepIdx, stepId: s.stepId,
      downloadId: "dl_" + s.stepId, downloadUrl: "/api/workbooks/download/dl_" + s.stepId, name: s.stepId + ".xlsx",
    })),
    perFileLiveSchema: payload.outputMode === "file" ? {} : { "excel:fileA": { sheets: [] }, "excel:fileB": { sheets: [] } },
    // 실행기 파일출력 모드: 결과 파일 목록 반환(라이브 미반영)
    outputFiles: payload.outputMode === "file"
      ? [{ excelId: "excel:fileA", name: "결과_A.xlsx", path: "out/결과_A.xlsx", downloadId: "o_A", downloadUrl: "/api/workbooks/download/o_A" },
         { excelId: "excel:fileB", name: "결과_B.xlsx", path: "out/결과_B.xlsx", downloadId: "o_B", downloadUrl: "/api/workbooks/download/o_B" }]
      : [],
  };
}
function syncStepPreApplySnapshot(step, snap) { if (step && snap) step._preApplySnapshot = { ...snap }; }
function setPipelineRuntimeStatus(ids, status, label) { statuses.push({ ids: ids.slice(), status, label }); }
function applyLiveSchemaToFileCache(exId) { schemaApplied.push(exId); }
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
  // s1,s2 → fileA, s3 → fileB (2파일). + 참조 전용 fileC 를 resetFileIds 로.
  const steps = [
    { id: "s1", language: "vba",    code: "Sub B2BSkill(): End Sub", fileId: "fileA" },
    { id: "s2", language: "python", code: "def transform(ctx): pass", fileId: "fileA" },
    { id: "s3", language: "vba",    code: "Sub B2BSkill(): End Sub", fileId: "fileB" },
  ];

  const result = await runIsolatedLivePipelineSteps(steps, "excel:fileA", {
    backgroundMode: true,
    resetFileIds: ["fileA", "fileB", "fileC"],
  });

  ck("[bg] 백엔드 콜 1회만(그룹별 N콜 아님)", calls.length === 1);
  ck("[bg] 엔드포인트 = run-full-pipeline", calls[0] && calls[0].url === "/api/excel/run-full-pipeline");
  const p = (calls[0] && calls[0].payload) || {};
  ck("[bg] 그룹 2개(fileA, fileB)", Array.isArray(p.groups) && p.groups.length === 2);
  ck("[bg] 그룹1 = excel:fileA [s1,s2]",
     p.groups && p.groups[0].excelId === "excel:fileA" &&
     JSON.stringify(p.groups[0].steps.map(s => s.stepId)) === JSON.stringify(["s1", "s2"]));
  ck("[bg] 그룹2 = excel:fileB [s3]",
     p.groups && p.groups[1].excelId === "excel:fileB" &&
     JSON.stringify(p.groups[1].steps.map(s => s.stepId)) === JSON.stringify(["s3"]));
  ck("[bg] resetExcelIds = targets ∪ 참조(fileC 포함)",
     Array.isArray(p.resetExcelIds) &&
     ["excel:fileA", "excel:fileB", "excel:fileC"].every(x => p.resetExcelIds.includes(x)));
  ck("[bg] applied = 3", result && result.applied === 3);
  ck("[bg] running 표시(전 스텝)",
     statuses.some(s => s.status === "running" && ["s1", "s2", "s3"].every(id => s.ids.includes(id))));
  ck("[bg] applied 표시(전 스텝)",
     statuses.some(s => s.status === "applied" && ["s1", "s2", "s3"].every(id => s.ids.includes(id))));
  ck("[bg] 스냅샷 per-step excelId 매핑(s2→fileA, s3→fileB)",
     steps[1]._preApplySnapshot && steps[1]._preApplySnapshot.excelId === "excel:fileA" &&
     steps[2]._preApplySnapshot && steps[2]._preApplySnapshot.excelId === "excel:fileB" &&
     steps[2]._preApplySnapshot.resultId === "dl_s3");
  ck("[bg] 파일별 스키마 캐시 갱신(2파일)",
     schemaApplied.includes("excel:fileA") && schemaApplied.includes("excel:fileB"));
  ck("[bg] 공용 정리 fall-through(loading종료/mute해제 균형)",
     loadingStarted === 1 && loadingEnded >= 1 && muted >= 1 && unmuted >= 1);
  ck("[bg] outputMode 기본=sync(생성기)", p.outputMode === "sync");

  // ── 실행기 파일출력 모드(outputMode:"file") ──
  calls = []; statuses = []; muted = 0; unmuted = 0; loadingStarted = 0; loadingEnded = 0; schemaApplied = [];
  globalThis.window = {};  // lastRunnerOutputs 저장 확인용
  const r2 = await runIsolatedLivePipelineSteps(steps, "excel:fileA", {
    backgroundMode: true, outputMode: "file", resetFileIds: ["fileA", "fileB"],
  });
  const p2 = (calls[0] && calls[0].payload) || {};
  ck("[file] payload outputMode=file", p2.outputMode === "file");
  ck("[file] 결과 outputFiles 2개", r2 && Array.isArray(r2.outputFiles) && r2.outputFiles.length === 2);
  ck("[file] window.lastRunnerOutputs 저장(다운로드 연결)",
     Array.isArray(window.lastRunnerOutputs) && window.lastRunnerOutputs.length === 2);

  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}
main().catch(err => { console.error(err); process.exit(1); });
