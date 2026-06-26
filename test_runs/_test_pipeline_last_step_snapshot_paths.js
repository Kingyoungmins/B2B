// SBAGENT-138: 마지막 단계 OFF/삭제 fast-path 비대칭 수정 회귀 테스트.
//
// 버그: 마지막 단계 OFF/삭제는 step._preApplySnapshot(적용 직전 상태)이 있어야 빠르게 되돌리는데,
//   - 순수 Python 전체실행(runVbaPipelinePreferLive for-loop)은 스냅샷을 안 찍었고,
//   - ON 빠른적용(applyLastEnabledStepFast)도 스냅샷을 안 남겼다.
//   ON 은 시그니처만 보고 fast 라서, OFF/삭제만 매번 full reconcile 로 떨어지는 비대칭이 생겼다.
//
// 수정 검증:
//   (A) for-loop 경로: '마지막 live 스텝'을 '적용 직전'에 1회 캡처한다(앞 스텝들은 캡처 안 함).
//   (B) applyLastEnabledStepFast: 반드시 '적용 전'에 캡처한다(적용 후면 N 까지 반영돼 OFF 가 무의미 — 핵심).
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");

function slice(a, b) {
  const s = src.indexOf(a);
  const e = src.indexOf(b, s + 1);
  if (s < 0 || e < 0 || e <= s) throw new Error("slice fail: " + a);
  return src.slice(s, e);
}
const runVbaSrc = slice("async function runVbaPipelinePreferLive", "function recordVbaDebugTiming");
const fastSrc = slice("async function applyLastEnabledStepFast", "function pipelineEditBusyReason");
const syncSrc = slice("function syncStepPreApplySnapshot", "function lastLiveStepIndex");

const stubs = `
  const LOG = arguments[0];
  var state = { pipeline: [], currentFileId: null };
  var activePipelineSteps = (s) => (s || state.pipeline).slice();
  var inferPipelineStepLanguage = (s) => s.language;
  var pipelineStepLiveLanguage = (s) => s && (s.language === "python" || s.language === "vba");
  var vbaTargetExcelId = () => null;
  var currentExcelId = () => "X";
  var ensurePinnedVbaTargetExcelId = async () => null;
  var pipelineHasUnresolvedTarget = () => false;
  var warnUnresolvedPipelineTarget = () => {};
  var pipelinePinnedTargetFileId = () => null;
  var preferredVbaRunFileId = () => "F";
  var excelIdForPipelineFileId = async () => "X";
  var ensureVbaRunExcelId = async () => "X";
  var pipelineStepReadsOtherFile = () => false;
  var pipelinePythonMutatedBookNames = () => [];
  var runIsolatedLivePipelineSteps = async () => ({ ok: true });
  var inferPipelineStepTargetFileId = () => null;
  var requirePipelineSessionExcelId = async () => "X";
  var applyVbaStepToLiveExcel = (step) => { LOG.push({ type: "apply", id: step.id }); return { ok: true }; };
  var captureStepPreApplySnapshot = async (step) => { LOG.push({ type: "capture", id: step.id }); return { resultId: "r_" + step.id }; };
  var runLivePipelineStepSequentially = async (step) => { LOG.push({ type: "apply", id: step.id }); return { ok: true }; };
  var noteLivePipelineApplied = () => {};
  var findPipelineRuntimeExecutionBlocker = () => null;
  var createPipelineRuntimeExecutionBlockError = () => new Error("blocked");
`;
const factory = new Function(
  stubs + "\n" + syncSrc + "\n" + runVbaSrc + "\n" + fastSrc +
  "\n return { runVbaPipelinePreferLive, applyLastEnabledStepFast, setPipeline: (p) => { state.pipeline = p; } };"
);

let pass = 0, fail = 0;
const ck = (n, c) => { (c ? pass++ : fail++); console.log((c ? " OK  " : "FAIL ") + n); };

(async () => {
  const LOG = [];
  const api = factory(LOG);

  // (A) for-loop(순수 Python 전체실행): 모든 스텝을 각자 적용 직전 캡처(연속 OFF/삭제 대비)
  LOG.length = 0;
  const steps = [
    { id: "s1", language: "python", code: "a" },
    { id: "s2", language: "python", code: "b" },
    { id: "s3", language: "python", code: "c" },
  ];
  api.setPipeline(steps);
  await api.runVbaPipelinePreferLive({ pipeline: steps });
  const captures = LOG.filter(e => e.type === "capture").map(e => e.id);
  ck("[for-loop] 모든 스텝(s1,s2,s3) 캡처됨", captures.length === 3 && captures.join(",") === "s1,s2,s3");
  // 각 스텝의 capture 가 그 스텝의 apply '직전'에 온다(직전 상태 1..i-1 보존)
  ck("[for-loop] 각 capture 가 같은 스텝 apply 직전", ["s1", "s2", "s3"].every(id => {
    const c = LOG.findIndex(e => e.type === "capture" && e.id === id);
    const a = LOG.findIndex(e => e.type === "apply" && e.id === id);
    return c >= 0 && a === c + 1;
  }));
  // 전체 순서: capture s1, apply s1, capture s2, apply s2, capture s3, apply s3
  ck("[for-loop] 캡처→적용 교대 순서", LOG.map(e => e.type + ":" + e.id).join(",") ===
    "capture:s1,apply:s1,capture:s2,apply:s2,capture:s3,apply:s3");

  // (B) ON 빠른적용: 반드시 적용 '전'에 캡처 (핵심 correctness)
  LOG.length = 0;
  const last = { id: "s3", language: "python", code: "c" };
  api.setPipeline([last]);
  await api.applyLastEnabledStepFast(last, { steps: [last] });
  ck("[ON] applyLastEnabledStepFast 는 적용 '전'에 캡처",
    LOG.length === 2 && LOG[0].type === "capture" && LOG[0].id === "s3" && LOG[1].type === "apply" && LOG[1].id === "s3");

  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 2 : 0);
})().catch(e => { console.error(e); process.exit(3); });
