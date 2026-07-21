// [실측][판교테크윈] 완료된 스킬 수정 후 재실행이 산출물에 반영 안 되던 버그 — 두 결함 검증.
//  (1) canUsePipelineCheckpointFromIndex 가 .some(뒤쪽 아무 스텝 스냅샷)으로 통과 → 시작 스텝
//      스냅샷 없이 복원이 '뒤 스텝 직전'으로 가서 조건부 스킬('W가 빈 행만')이 무효 실행.
//  (2) runFromCheckpointAfterEdit 가 복원 실패 시 조용히 false → 수정 코드 무실행인데
//      UI 는 '✓ 수정 적용됨' 표시.
// node diagnostics/_test_edit_checkpoint_guard.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
function extract(name) {
  const marker = "function " + name + "(";
  let start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  if (src.slice(start - 6, start) === "async ") start -= 6;
  let p = src.indexOf("(", start), pd = 0;
  for (; p < src.length; p++) { if (src[p] === "(") pd++; else if (src[p] === ")") { pd--; if (pd === 0) break; } }
  let i = src.indexOf("{", p), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

const sandbox = {
  console, Number, Math, Array, Set, Promise, Error, JSON,
  // canUse 의존 스텁
  state: { pipeline: [] },
  pipelineUsesLiveSkill: () => true,
  pipelineHasBackendOnlyStep: () => false,
  pipelineSuffixWritesCrossFile: () => sandbox.__crossFile === true,
  isStepEnabled: s => s && s.enabled !== false,
  getPipelineResumeFromIndex: () => sandbox.__resume,
  // runFromCheckpointAfterEdit 의존 스텁
  restorePipelineCheckpointForSuffix: async () => sandbox.__restoreOk ? new Set(["ex1"]) : false,
  markPipelinePendingFromIndex: () => { sandbox.__marked = true; },
  runPipelineSuffixFromCheckpoint: async () => { sandbox.__suffixRan = true; return { ok: true }; },
  vbaTargetExcelId: () => sandbox.__excelId,
  currentExcelId: () => null,
  reapplyVbaPipelineToLive: async () => { sandbox.__reapplied = true; return true; },
  toast: () => {},
  __crossFile: false, __resume: null, __restoreOk: true, __excelId: "ex1",
  __suffixRan: false, __reapplied: false, __marked: false,
};
vm.createContext(sandbox);
vm.runInContext(extract("canUsePipelineCheckpointFromIndex"), sandbox);
vm.runInContext(extract("runFromCheckpointAfterEdit"), sandbox);

const snap = id => ({ resultId: "r_" + id, excelId: "ex1" });
const mk = (id, hasSnap, enabled = true) =>
  ({ id, code: "x", enabled, _preApplySnapshot: hasSnap ? snap(id) : null });

// ── canUsePipelineCheckpointFromIndex ──
const canUse = (start, before) => vm.runInContext(
  `canUsePipelineCheckpointFromIndex(${start}, ${JSON.stringify(before)}, ${JSON.stringify(before)})`, sandbox);

ck("(1) 이어실행 대상 전부 스냅샷 보유 → 허용",
   canUse(1, [mk("a", true), mk("b", true), mk("c", true)]) === true);
ck("(2) [핵심] 시작 스텝 스냅샷 없음(뒤만 있음) → 금지(예전 .some 은 true)",
   canUse(1, [mk("a", true), mk("b", false), mk("c", true)]) === false);
ck("(3) 중간 스텝 스냅샷 없음 → 금지",
   canUse(0, [mk("a", true), mk("b", false), mk("c", true)]) === false);
ck("(4) 비활성 스텝은 스냅샷 없어도 무관",
   canUse(0, [mk("a", true), mk("b", false, false), mk("c", true)]) === true);
sandbox.__resume = 1;
ck("(5) resume ≤ start 면 스냅샷 없이도 허용(기존 동작)",
   canUse(2, [mk("a", false), mk("b", false), mk("c", false)]) === true);
sandbox.__resume = null;
sandbox.__crossFile = true;
ck("(6) 교차파일 suffix 금지 유지",
   canUse(0, [mk("a", true), mk("b", true)]) === false);
sandbox.__crossFile = false;
ck("(7) 빈 suffix 금지", canUse(5, [mk("a", true)]) === false);

// ── runFromCheckpointAfterEdit ──
(async () => {
  // 정상: 복원 성공 → suffix 실행
  sandbox.__restoreOk = true; sandbox.__suffixRan = false; sandbox.__reapplied = false;
  let r = await vm.runInContext(`runFromCheckpointAfterEdit(1, [])`, sandbox);
  ck("(8) 복원 성공 → suffix 실행", sandbox.__suffixRan === true && r && r.ok === true, r);

  // [핵심] 복원 실패 → 조용한 false 대신 전체 재적용 폴백
  sandbox.__restoreOk = false; sandbox.__suffixRan = false; sandbox.__reapplied = false;
  r = await vm.runInContext(`runFromCheckpointAfterEdit(1, [])`, sandbox);
  ck("(9) [핵심] 복원 실패 → 전체 재적용 폴백(true, false 아님)",
     r === true && sandbox.__reapplied === true && sandbox.__suffixRan === false, { r, reapplied: sandbox.__reapplied });

  // 복원 실패 + 폴백 불가(excelId 없음) → 조용히 false 금지, 명시적 오류
  sandbox.__restoreOk = false; sandbox.__excelId = null; sandbox.__reapplied = false;
  let threw = false;
  try { await vm.runInContext(`runFromCheckpointAfterEdit(1, [])`, sandbox); }
  catch (e) { threw = /복원하지 못해/.test(String(e && e.message)); }
  ck("(10) 폴백 불가 시 명시적 오류(조용한 false 금지)", threw === true);

  console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
  process.exit(fails ? 1 : 0);
})();
