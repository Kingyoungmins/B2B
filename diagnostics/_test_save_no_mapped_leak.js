// [치환본 저장 방지] 실행 중(state.pipeline = 매핑본)에 저장해도 '제네릭 원본'이 저장되는가,
// 그리고 실행이 끝나면 state.pipeline 에 치환 흔적이 남지 않는가.
//
// 실제 사고(한전): 매핑 실행 → 스텝 수정 → 저장 했더니 저장 스킬 25스텝 전부가
//   ctx.book("02...2026-07-14...")  + targetSheetName "<해시>_02..."  로 굳어,
//   다시 올리면 옛 이름·새 이름이 둘 다 요구로 잡혀 매핑이 폭증하고 다음 달 재사용 불가.
// 원인: 실행 중 renderPipeline→ensurePipelineStepIds 가 state.pipeline 을 '새 배열'로 교체 →
//   지역변수로 들고 있던 원본 참조가 끊겨 finally 복원이 무의미해짐.
// node diagnostics/_test_save_no_mapped_leak.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const ROOT = path.join(__dirname, "..");
const pipeSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
function extractFn(src, name) {
  const marker = "function " + name + "(";
  let start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  if (src.slice(start - 6, start) === "async ") start -= 6;
  let p = src.indexOf("(", start), pd = 0;
  for (; p < src.length; p++) { if (src[p] === "(") pd++; else if (src[p] === ")") { pd--; if (pd === 0) break; } }
  let i = src.indexOf("{", p), depth = 0, end = -1;
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } } }
  return src.slice(start, end);
}

const OLD_F = "02. 한전_AMI_유선간선망_청구세부내역_2026-07-07 09_23_01_DSMC_260707.xlsx";
const NEW_F = "02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 13_07_47_DSMC_260714.xlsx";
const OLD_S = "Sheet1";
const NEW_S = "5e4afeb9bb554d98a59d1f2deeeea69a_02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 13_07_47";

function origSteps() {
  return [
    { id: "s1", enabled: true, language: "python", targetFileId: "input:" + OLD_F, targetSheetName: OLD_S,
      code: `def transform(ctx):\n    ctx.book("${OLD_F}").delete_rows("${OLD_S}", "1:9")` },
    { id: "s2", enabled: true, language: "python", targetFileId: "input:" + OLD_F, targetSheetName: OLD_S,
      code: `def transform(ctx):\n    ctx.book("${OLD_F}").sort("${OLD_S}", "A1:C9", key_col="A")` },
  ];
}
function mappedOf(steps) {
  return steps.map(s => ({ ...s, runnerMapped: true,
    targetFileId: "input:" + NEW_F, targetSheetName: NEW_S,
    code: s.code.split(OLD_F).join(NEW_F).split(`"${OLD_S}"`).join(`"${NEW_S}"`) }));
}

function makeSandbox() {
  const sb = { console, Map, Array, JSON, state: { pipeline: origSteps(), runnerMappingRunActive: false, pipelineOriginalDuringRun: null }, window: {} };
  vm.createContext(sb);
  sb.window.buildRunnerMappedPipeline = steps => mappedOf(steps || sb.state.pipeline);
  vm.runInContext(extractFn(pipeSrc, "beginMappedPipelineRun"), sb);
  // 저장 관문(save-load.pipelineForSave) 과 동일 로직
  sb.pipelineForSave = () => (sb.state.runnerMappingRunActive && Array.isArray(sb.state.pipelineOriginalDuringRun))
    ? sb.state.pipelineOriginalDuringRun : sb.state.pipeline;
  // 실행 중 배지 갱신이 하는 짓: state.pipeline 을 '새 배열'로 교체(ensurePipelineStepIds 재현)
  sb.simulateRenderPipeline = () => { sb.state.pipeline = sb.state.pipeline.map(s => ({ ...s })); };
  return sb;
}
const dirty = s => /2026-07-14|5e4afeb9bb/.test(String(s.code || "") + String(s.targetFileId || "") + String(s.targetSheetName || ""));

// (1) 실행 중 저장 → 원본(제네릭)이 저장돼야
{
  const sb = makeSandbox();
  const run = vm.runInContext("beginMappedPipelineRun()", sb);
  ck("(1a) 실행 중 state.pipeline 은 매핑본", sb.state.pipeline.every(dirty));
  const forSave = sb.pipelineForSave();
  ck("(1b) 저장 대상은 제네릭 원본(치환 흔적 없음)", forSave.every(s => !dirty(s)), forSave.map(s => s.code.slice(0, 60)));
  run.restore();
}
// (2) [핵심 회귀] 실행 중 렌더가 배열을 갈아끼워도 복원이 원본 이름을 되살려야
{
  const sb = makeSandbox();
  const run = vm.runInContext("beginMappedPipelineRun()", sb);
  sb.simulateRenderPipeline();          // ← 실제 사고 재현: 배지 갱신 → 새 배열
  sb.simulateRenderPipeline();
  const forSave = sb.pipelineForSave();
  ck("(2a) 배열 교체 후에도 저장 대상은 원본", forSave.every(s => !dirty(s)), forSave.map(s => s.code.slice(0, 50)));
  run.restore();
  ck("(2b) 실행 후 state.pipeline 에 치환 흔적 없음", sb.state.pipeline.every(s => !dirty(s)), sb.state.pipeline.map(s => s.code.slice(0, 60)));
  ck("(2c) runnerMapped 플래그 제거", sb.state.pipeline.every(s => !s.runnerMapped));
  ck("(2d) 원본 보관 슬롯 비움", sb.state.pipelineOriginalDuringRun === null && sb.state.runnerMappingRunActive === false);
}
// (3) 실행 중 사용자가 스텝을 수정하면 그 수정은 살아남아야(치환은 제거)
{
  const sb = makeSandbox();
  const run = vm.runInContext("beginMappedPipelineRun()", sb);
  sb.simulateRenderPipeline();
  // 사용자가 s1 코드를 수정(매핑본 위에서) — 숫자만 바꾼 상황
  sb.state.pipeline = sb.state.pipeline.map(s => s.id === "s1" ? { ...s, code: s.code.replace("1:9", "1:10") } : s);
  run.restore();
  const s1 = sb.state.pipeline.find(s => s.id === "s1");
  const s2 = sb.state.pipeline.find(s => s.id === "s2");
  ck("(3a) 수정한 스텝의 편집분 보존", s1.code.includes("1:10"), s1.code.slice(0, 80));
  ck("(3b) 수정 안 한 스텝은 원본 이름 복원", !dirty(s2), s2.code.slice(0, 60));
}
// (4) 매핑 없으면 완전 no-op
{
  const sb = makeSandbox();
  sb.window.buildRunnerMappedPipeline = steps => steps;   // 치환 대상 없음
  const before = sb.state.pipeline;
  const run = vm.runInContext("beginMappedPipelineRun()", sb);
  ck("(4) 매핑 없으면 교체/플래그 없음", sb.state.pipeline === before && sb.state.runnerMappingRunActive === false);
  run.restore();
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
