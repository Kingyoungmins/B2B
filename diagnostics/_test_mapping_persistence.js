// [매핑 보존] 실행기에서 확정한 매핑이 (1) 결과편집/스텝수정으로 지워지지 않고 (2) 생성기 재실행에
// 적용되는지 검증. 실제 한전 케이스(도서/시내 — 기계가 못 고르는 사용자 확정 매핑) 기반.
// node diagnostics/_test_mapping_persistence.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const ROOT = path.join(__dirname, "..");
const dropSrc = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8");
const pipeSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
function extractFrom(src, name) {
  const marker = "function " + name + "(";
  let start = src.indexOf(marker);
  if (start < 0) return null;
  if (src.slice(start - 6, start) === "async ") start -= 6;
  let p = src.indexOf("(", start), pd = 0;
  for (; p < src.length; p++) { if (src[p] === "(") pd++; else if (src[p] === ")") { pd--; if (pd === 0) break; } }
  let i = src.indexOf("{", p), depth = 0, end = -1;
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } } }
  return src.slice(start, end);
}

const F_OLD = "01. 한전_DAS_배전자동화_청구세부내역_2026-07-12 19_00_54_DSMC_260712.xlsx";  // 스킬이 찾는 것
const F_NEW = "01. 한전_DAS_배전자동화_청구세부내역_시내_2026-07-14 13_25_33_DSMC_260714 - 복사본.xlsx"; // 사용자가 고른 것
const F_OTHER = "01. 한전_DAS_배전자동화_청구세부내역_도서_2026-07-14 13_25_33_DSMC_260714 - 복사본 (2).xlsx";

function makeSandbox() {
  const sb = {
    console, window: {}, JSON, Set, Array, String, Number, Math, RegExp, Object,
    state: {
      inputs: [{ name: F_NEW, sheetNames: ["Sheet1"] }, { name: F_OTHER, sheetNames: ["Sheet1"] }],
      outputTemplates: [], output: null, currentFileId: null,
      pipeline: [{ id: "s15", code: `def transform(ctx):\n    ctx.book("${F_OLD}").delete_rows("Sheet1", "1:9")`,
                  enabled: true, targetFileId: "input:" + F_OLD, targetSheetName: "Sheet1" }],
      runnerMappings: {}, runnerMappingChecked: false, runnerMappingSignature: "", runnerMappingRunActive: false,
    },
    workbookDisplayName: (f, fb) => (f && f.name) || fb,
    outputTemplateFileId: i => "output:" + i,
    getFile: id => {
      const nm = String(id || "").startsWith("input:") ? String(id).slice(6) : null;
      return nm && sb.state.inputs.some(f => f.name === nm) ? { name: nm } : null;
    },
    normalizeText: s => String(s || "").trim().toLowerCase().replace(/\s+/g, ""),
    escapeHtml: s => String(s),
    isStepEnabled: s => s && s.enabled !== false,
  };
  vm.createContext(sb);
  for (const m of pipeSrc.matchAll(/^const (PIPELINE_VOLATILE_\w+)\s*=\s*\[/gm)) {
    vm.runInContext(pipeSrc.slice(m.index, pipeSrc.indexOf("\n];", m.index) + 3), sb);
  }
  [...pipeSrc.matchAll(/^function (pipeline\w*|inferPipelineStep\w*|crossOutputFileIdsReferencedInCode|crossWriteDestinationFileIds|activePipelineSteps)\s*\(/gm)]
    .map(m => m[1]).forEach(f => { const s = extractFrom(pipeSrc, f); if (s) { try { vm.runInContext(s, sb); } catch (_) {} } });
  vm.runInContext(extractFrom(pipeSrc, "beginMappedPipelineRun"), sb);
  // drop-handling 의 최상위 const 상수(RUNNER_SHEET_SKILL_DEFAULT 등)도 로드
  for (const m of dropSrc.matchAll(/^const (RUNNER_\w+)\s*=\s*.+;$/gm)) vm.runInContext(m[0], sb);
  [...dropSrc.matchAll(/^function (runner\w*)\s*\(/gm)].map(m => m[1])
    .forEach(f => { const s = extractFrom(dropSrc, f); if (s) { try { vm.runInContext(s, sb); } catch (_) {} } });
  // buildRunnerMappedPipeline 은 window.* 대입 형태
  const bs = dropSrc.indexOf("window.buildRunnerMappedPipeline = function");
  vm.runInContext(dropSrc.slice(bs, dropSrc.indexOf("\n};", bs) + 3), sb);
  return sb;
}

// ── 사용자가 실행기에서 '시내' 파일을 직접 확정했다고 가정 ──
function withUserMapping(sb) {
  const reqKey = vm.runInContext(`runnerMappingKey(${JSON.stringify(F_OLD)}, "Sheet1")`, sb);
  const fileId = vm.runInContext(`runnerMappingKnownFiles().find(f => f.name === ${JSON.stringify(F_NEW)}).id`, sb);
  sb.state.runnerMappings[reqKey] = { fileId, sheet: "Sheet1", userSet: true };
  sb.state.runnerMappingChecked = true;
  vm.runInContext("state.runnerMappingSignature = runnerCurrentMappingSignature()", sb);
  return { reqKey, fileId };
}
const sigOf = sb => vm.runInContext("runnerCurrentMappingSignature()", sb);
const mappingCount = sb => Object.keys(sb.state.runnerMappings).length;
const resetIfChanged = sb => vm.runInContext("runnerResetMappingIfSourceChanged()", sb);

// (1) 결과 편집하기: 스킬이 만든 새 시트로 파일의 시트 목록이 바뀜 → 매핑 유지돼야
{
  const sb = makeSandbox(); withUserMapping(sb);
  sb.state.inputs[0].sheetNames = ["Sheet1", "배전자동화", "피벗요약"];   // 실행 결과 반영
  resetIfChanged(sb);
  ck("(1) 결과편집(시트목록 변화) 후에도 매핑 유지", mappingCount(sb) === 1, mappingCount(sb));
}
// (2) 스텝 코드 수정(청구계정번호 등) → 매핑 유지돼야
{
  const sb = makeSandbox(); withUserMapping(sb);
  sb.state.pipeline[0].code = sb.state.pipeline[0].code.replace("1:9", "1:10");
  resetIfChanged(sb);
  ck("(2) 스텝 코드 수정 후에도 매핑 유지", mappingCount(sb) === 1, mappingCount(sb));
}
// (3) 다른 스킬 로드(스텝 id 교체) → 매핑 초기화돼야(안전)
{
  const sb = makeSandbox(); withUserMapping(sb);
  sb.state.pipeline = [{ id: "other1", code: "x", enabled: true }];
  resetIfChanged(sb);
  ck("(3) 다른 스킬 로드 시 매핑 초기화", mappingCount(sb) === 0, mappingCount(sb));
}
// (4) 다른 파일 업로드 → 매핑 초기화돼야(안전)
{
  const sb = makeSandbox(); withUserMapping(sb);
  sb.state.inputs.push({ name: "완전다른파일.xlsx", sheetNames: ["S"] });
  resetIfChanged(sb);
  ck("(4) 파일 세트 변경 시 매핑 초기화", mappingCount(sb) === 0, mappingCount(sb));
}
// (5) 생성기 재실행이 매핑을 적용해 코드 리터럴을 치환하는가
{
  const sb = makeSandbox(); withUserMapping(sb);
  const run = vm.runInContext("beginMappedPipelineRun()", sb);
  const mappedCode = sb.state.pipeline[0].code;
  ck("(5) 재실행 시 옛 파일명이 사용자가 고른 파일로 치환", mappedCode.includes(F_NEW) && !mappedCode.includes(F_OLD), mappedCode.slice(0, 120));
  ck("(5b) 도서(안 고른 파일)로는 안 감", !mappedCode.includes("도서"));
  run.restore();
  ck("(5c) 실행 후 저장 스킬 코드는 원본 복원", sb.state.pipeline[0].code.includes(F_OLD), sb.state.pipeline[0].code.slice(0, 90));
}
// (6) 매핑이 없으면 기존 동작 그대로(교체 없음)
{
  const sb = makeSandbox();
  const before = sb.state.pipeline;
  const run = vm.runInContext("beginMappedPipelineRun()", sb);
  ck("(6) 매핑 미확인이면 교체 안 함", sb.state.pipeline === before && sb.state.runnerMappingRunActive === false);
  run.restore();
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
