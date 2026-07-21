// [적용됨-미반영] bg 전체실행 실패 후 복원·마킹 진실성 검증.
// 신고: 6스텝 스킬 실행, Step5 실패 → Step1~4 '적용됨' 표시인데 라이브 미반영(다파일/교차파일).
// node diagnostics/_test_applied_label_truth.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
function extractFn(name) {
  const marker = "function " + name + "(";
  let start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  if (src.slice(start - 6, start) === "async ") start -= 6;
  let p = src.indexOf("(", start), pd = 0;
  for (; p < src.length; p++) {
    if (src[p] === "(") pd++;
    else if (src[p] === ")") { pd--; if (pd === 0) break; }
  }
  let i = src.indexOf("{", p), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

// steps: [{id, code, fileId, snapExcelId?}] — fileId 는 스텁 추론용, snapExcelId 있으면 _preApplySnapshot 부여
function makeSandbox(steps, plan) {
  const calls = { restored: [], marked: null, noted: false, invalidated: 0, toasts: [] };
  const sb = {
    console, Promise, Set, Array, Number, Math, setTimeout,
    state: {
      pipeline: steps.map(s => ({
        id: s.id, code: s.code || "def transform(ctx): pass", enabled: true,
        targetFileId: s.fileId || null,
        _preApplySnapshot: s.snapExcelId ? { resultId: "rid_" + s.id, excelId: s.snapExcelId } : undefined,
      })),
    },
    isStepEnabled: st => st && st.enabled !== false,
    inferPipelineStepTargetFileId: st => (st && st.targetFileId) || null,
    crossWriteDestinationFileIds: () => [],
    crossOutputFileIdsReferencedInCode: () => [],
    excelIdForPipelineFileId: async fid => (plan.sessions && plan.sessions[fid]) || null,
    restoreLastStepPreApplySnapshot: async (step) => {
      const sid = step && step._preApplySnapshot && step._preApplySnapshot.excelId;
      calls.restored.push(sid);
      return plan.restoreFail && plan.restoreFail.includes(sid) ? false : true;
    },
    markPipelinePendingFromIndex: (start) => { calls.marked = start; },
    noteLivePipelineApplied: () => { calls.noted = true; },
    invalidateLivePipelineApplied: () => { calls.invalidated++; },
    toast: m => calls.toasts.push(m),
    calls,
  };
  vm.createContext(sb);
  ["restorePipelineCheckpointForSuffix", "verifyPrefixRestoreCoverage", "restorePipelineToCheckpointAndHold"]
    .forEach(f => vm.runInContext(extractFn(f), sb));
  return sb;
}
const run = (sb, start, failState) =>
  vm.runInContext(`restorePipelineToCheckpointAndHold(${start}, state.pipeline, { failState: ${JSON.stringify(failState) || "null"} })`, sb);

(async () => {
  // 공통 시나리오: Step1~4 = 파일 A 변형, Step5(실패) = 파일 B, Step6 = 파일 B. 세션 A=exA, B=exB.
  const STEPS = [
    { id: "s1", fileId: "input:A.xlsx" }, { id: "s2", fileId: "input:A.xlsx" },
    { id: "s3", fileId: "input:A.xlsx" }, { id: "s4", fileId: "input:A.xlsx" },
    { id: "s5", fileId: "input:B.xlsx", snapExcelId: "exB" },   // 실패 스텝 — pre-스냅샷은 B만
    { id: "s6", fileId: "input:B.xlsx" },
  ];
  const SESS = { "input:A.xlsx": "exA", "input:B.xlsx": "exB" };

  // (1) [신고 증상 차단] bg 실패 + failStateSnapshots 없음(구버전) → B만 복원 가능 → 커버리지 실패
  //     → '적용됨' 마킹 금지 + 시그니처 무효화 + false
  {
    const sb = makeSandbox(STEPS, { sessions: SESS });
    const r = await run(sb, 4, { liveUntouched: true });
    ck("(1) 커버리지 미달 → 마킹 금지(false)", r === false && sb.calls.marked === null && !sb.calls.noted, sb.calls);
    ck("(1) 거짓 시그니처 무효화", sb.calls.invalidated >= 1, sb.calls.invalidated);
  }
  // (2) [수정 본선] bg 실패 + failStateSnapshots(A,B 전 파일) → 전 세션 복원 → 적용됨 마킹 허용
  {
    const sb = makeSandbox(STEPS, { sessions: SESS });
    const r = await run(sb, 4, {
      liveUntouched: true,
      failStateSnapshots: [{ excelId: "exA", downloadId: "dA" }, { excelId: "exB", downloadId: "dB" }],
    });
    ck("(2) 전 파일 복원 → true + 마킹", r === true && sb.calls.marked === 4 && sb.calls.noted, sb.calls);
    ck("(2) A·B 둘 다 replace", sb.calls.restored.includes("exA") && sb.calls.restored.includes("exB"), sb.calls.restored);
  }
  // (3) [기존 동작 보존] 편집 컨텍스트(failState 없음): B 스냅샷 복원만으로 true + 마킹(커버리지 미적용)
  {
    const sb = makeSandbox(STEPS, { sessions: SESS });
    const r = await run(sb, 4, null);
    ck("(3) 편집 컨텍스트 기존 동작 유지", r === true && sb.calls.marked === 4, sb.calls);
  }
  // (4) bg 실패 + 전 파일 스냅샷 중 일부 복원 실패 → false + 무효화
  {
    const sb = makeSandbox(STEPS, { sessions: SESS, restoreFail: ["exA"] });
    const r = await run(sb, 4, {
      liveUntouched: true,
      failStateSnapshots: [{ excelId: "exA", downloadId: "dA" }, { excelId: "exB", downloadId: "dB" }],
    });
    ck("(4) 일부 복원 실패 → false + 무효화", r === false && sb.calls.invalidated >= 1 && sb.calls.marked === null, sb.calls);
  }
  // (5) [단일 파일 정상 케이스] 전 스텝이 A, 실패 스텝 스냅샷도 A → 스냅샷 없이도 커버리지 통과
  {
    const one = [
      { id: "s1", fileId: "input:A.xlsx" }, { id: "s2", fileId: "input:A.xlsx" },
      { id: "s3", fileId: "input:A.xlsx" }, { id: "s4", fileId: "input:A.xlsx" },
      { id: "s5", fileId: "input:A.xlsx", snapExcelId: "exA" },
      { id: "s6", fileId: "input:A.xlsx" },
    ];
    const sb = makeSandbox(one, { sessions: { "input:A.xlsx": "exA" } });
    const r = await run(sb, 4, { liveUntouched: true });
    ck("(5) 단일 파일: pre-Step5 스냅샷 복원 = 1~4 상태 → true + 마킹", r === true && sb.calls.marked === 4, sb.calls);
  }
  console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
  process.exit(fails ? 1 : 0);
})();
