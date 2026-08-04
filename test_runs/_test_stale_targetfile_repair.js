// [실측 재현] 다른 달 targetFileId 혼재 수리 — 사용자 zip 기반.
//   증상: 4월에 만든 스킬을 5월 파일로 전체실행→결과편집→수정→저장하면 zip 에
//         step1=4월, step2=5월 꼬리표가 섞여, 6월 파일확인 때 "4월도 필요, 5월도 필요"가 뜸.
//   수정: (a) 로드 시 repairStaleTargetFileIds — envConfig 정본 기준 유일 매칭만 교정
//         (b) 저장 시 normalizeStaleTargetFileIdForSave — stale 꼬리표를 현재 업로드로 재해석
// 소스(save-load.js/pipeline.js)에서 함수를 '추출'해 실행한다(복사본 아님 — 소스가 바뀌면 그 코드 검증).
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function sliceBalanced(src, startIdx, open, close) {
  let depth = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced " + open + close);
}
function extractFunction(src, name) {
  const at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const braceAt = src.indexOf("{", at);
  return src.slice(at, braceAt) + sliceBalanced(src, braceAt, "{", "}");
}
function extractConstArray(src, name) {
  const at = src.indexOf("const " + name + " = [");
  if (at < 0) throw new Error("상수 못 찾음: " + name);
  const brAt = src.indexOf("[", at);
  return "const " + name + " = " + sliceBalanced(src, brAt, "[", "]") + ";";
}

const pipelineSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
const saveLoadSrc = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8");

// 의존 순서: LooksLike* → 토큰표(요소가 LooksLike 참조) → decode → stableKey → 대상 함수들
const bundle = [
  extractFunction(pipelineSrc, "pipelineLooksLikeHms"),
  extractFunction(pipelineSrc, "pipelineLooksLikeYmd"),
  extractFunction(pipelineSrc, "pipelineLooksLikeDateNumber"),
  extractConstArray(pipelineSrc, "PIPELINE_VOLATILE_NAME_TOKENS"),
  extractConstArray(pipelineSrc, "PIPELINE_VOLATILE_SUFFIX_TOKENS"),
  extractFunction(pipelineSrc, "pipelineDecodeWorkbookName"),
  extractFunction(pipelineSrc, "pipelineStableWorkbookKey"),
  extractFunction(pipelineSrc, "pipelineCollectWorkbookNames"),
  extractFunction(saveLoadSrc, "repairStaleTargetFileIds"),
  extractFunction(saveLoadSrc, "normalizeStaleTargetFileIdForSave"),
  extractFunction(saveLoadSrc, "_replaceStaleBookNamesInText"),
  extractFunction(saveLoadSrc, "repairStalePromptBookNames"),
  extractFunction(saveLoadSrc, "normalizeStaleBooksInSavedText"),
  "module.exports = { repairStaleTargetFileIds, normalizeStaleTargetFileIdForSave, pipelineStableWorkbookKey,"
  + " repairStalePromptBookNames, normalizeStaleBooksInSavedText };",
].join("\n\n");

const Module = require("module");
const m = new Module("extracted", module);
m._compile(bundle, path.join(__dirname, "_extracted_stale_repair.js"));
const { repairStaleTargetFileIds, normalizeStaleTargetFileIdForSave, pipelineStableWorkbookKey,
        repairStalePromptBookNames, normalizeStaleBooksInSavedText } = m.exports;

let fails = 0;
function ck(name, cond, got) {
  console.log((cond ? " OK  " : "FAIL ") + name + (cond ? "" : "  got=" + JSON.stringify(got)));
  if (!cond) fails++;
}

// ── 안정키 자체 확인(월 무시가 실제로 같은 키를 내는지) ──
ck("(0) 안정키: 4월≡5월≡6월",
  pipelineStableWorkbookKey("input_원가_2026_4월.xlsx") === pipelineStableWorkbookKey("input_원가_2026_5월.xlsx")
  && pipelineStableWorkbookKey("input_원가_2026_5월.xlsx") === pipelineStableWorkbookKey("input_원가_2026_6월.xlsx"),
  pipelineStableWorkbookKey("input_원가_2026_4월.xlsx"));

// ── T1: 실측 zip 그대로 — step1=4월(stale) → 5월로 교정, step2=5월(정본 실존) 무수정 ──
{
  const steps = [
    { targetFileId: "input:input_원가_2026_4월.xlsx" },
    { targetFileId: "input:input_원가_2026_5월.xlsx" },
  ];
  const env = { inputs: [{ name: "input_원가_2026_5월.xlsx", displayName: "input_원가_2026_5월.xlsx", sheetNames: ["원가"] }] };
  const n = repairStaleTargetFileIds(steps, env);
  ck("(1) 실측 zip: 4월→5월 교정 1건", n === 1
    && steps[0].targetFileId === "input:input_원가_2026_5월.xlsx"
    && steps[1].targetFileId === "input:input_원가_2026_5월.xlsx", steps);
}

// ── T2: 모호(정본에 4월+5월 둘 다) → 절대 무수정 ──
{
  const steps = [{ targetFileId: "input:input_원가_2026_3월.xlsx" }];
  const env = { inputs: [{ name: "input_원가_2026_4월.xlsx" }, { name: "input_원가_2026_5월.xlsx" }] };
  const n = repairStaleTargetFileIds(steps, env);
  ck("(2) 모호(같은 계열 2개) → 무수정", n === 0
    && steps[0].targetFileId === "input:input_원가_2026_3월.xlsx", steps);
}

// ── T3: envConfig 없음(구버전 zip) → 무수정 ──
{
  const steps = [{ targetFileId: "input:input_원가_2026_4월.xlsx" }];
  ck("(3) envConfig 없음 → 무수정",
    repairStaleTargetFileIds(steps, null) === 0
    && repairStaleTargetFileIds(steps, {}) === 0
    && steps[0].targetFileId === "input:input_원가_2026_4월.xlsx", steps);
}

// ── T4: 교차파일 스킬 — 원가/검증 각자 제 파일로만 ──
{
  const steps = [
    { targetFileId: "input:input_원가_2026_4월.xlsx" },
    { targetFileId: "input:input_검증_2026_4월.xlsx" },
  ];
  const env = { inputs: [{ name: "input_원가_2026_5월.xlsx" }, { name: "input_검증_2026_5월.xlsx" }] };
  const n = repairStaleTargetFileIds(steps, env);
  ck("(4) 교차파일: 각자 제 계열로", n === 2
    && steps[0].targetFileId === "input:input_원가_2026_5월.xlsx"
    && steps[1].targetFileId === "input:input_검증_2026_5월.xlsx", steps);
}

// ── T5: 짧은 안정키(<4)·output 접두·빈 값 — 전부 무수정 ──
{
  const steps = [
    { targetFileId: "input:5월.xlsx" },              // 안정키가 사실상 소멸 → 매칭 금지
    { targetFileId: "output:0" },                    // input: 아님
    { targetFileId: null },
    null,
  ];
  const env = { inputs: [{ name: "ab_2026_5월.xlsx" }] };
  const n = repairStaleTargetFileIds(steps, env);
  ck("(5) 짧은 키/비input/빈 값 → 무수정", n === 0
    && steps[0].targetFileId === "input:5월.xlsx" && steps[1].targetFileId === "output:0", steps);
}

// ── T6: 정본에 정확히 있는 이름(대소문자 차이 포함) → 무수정 ──
{
  const steps = [{ targetFileId: "input:INPUT_원가_2026_5월.XLSX" }];
  const env = { inputs: [{ name: "input_원가_2026_5월.xlsx" }] };
  ck("(6) 정본 실존(대소문자 무시) → 무수정",
    repairStaleTargetFileIds(steps, env) === 0, steps);
}

// ── T7: 저장 시 정규화 — stale 만 재해석, 실존/실패는 원본 유지 ──
{
  globalThis.getFile = (id) => (id === "input:현재.xlsx" ? { name: "현재.xlsx" } : null);
  globalThis.pipelineResolveSavedTargetFileId = (tid) =>
    (tid === "input:옛달.xlsx" ? "input:현재.xlsx" : null);
  ck("(7a) stale → 현재 업로드로 재해석",
    normalizeStaleTargetFileIdForSave("input:옛달.xlsx") === "input:현재.xlsx");
  ck("(7b) 현재 실존 → 그대로",
    normalizeStaleTargetFileIdForSave("input:현재.xlsx") === "input:현재.xlsx");
  ck("(7c) 재해석 실패 → 원본 유지",
    normalizeStaleTargetFileIdForSave("input:모름.xlsx") === "input:모름.xlsx");
  ck("(7d) 비 input/빈 값 → 통과",
    normalizeStaleTargetFileIdForSave("output:0") === "output:0"
    && normalizeStaleTargetFileIdForSave(null) === null);
  delete globalThis.getFile;
  delete globalThis.pipelineResolveSavedTargetFileId;
}

// ── T8: 실측 2번째 zip — 꼬리표는 5월인데 prompt 의 @범위 에코가 4월 → prompt 만 교정 ──
{
  const steps = [
    { targetFileId: "input:input_원가_2026_5월.xlsx",
      prompt: "선택 범위: @범위[input_원가_2026_4월.xlsx/원가!F3] 숫자 100적어",
      description: "input_원가_2026_4월.xlsx 원가 시트 F3 에 100 기입" },
    { targetFileId: "input:input_원가_2026_5월.xlsx",
      prompt: "선택 범위: @범위[input_원가_2026_5월.xlsx/원가!G8]숫자 200적어",
      description: "G8 에 200 기입" },
  ];
  const env = { inputs: [{ name: "input_원가_2026_5월.xlsx", displayName: "input_원가_2026_5월.xlsx" }] };
  const n = repairStalePromptBookNames(steps, env);
  ck("(8) 실측 에코: prompt+설명의 4월→5월, 교정 1단계", n === 1
    && steps[0].prompt === "선택 범위: @범위[input_원가_2026_5월.xlsx/원가!F3] 숫자 100적어"
    && steps[0].description === "input_원가_2026_5월.xlsx 원가 시트 F3 에 100 기입"
    && steps[1].prompt.indexOf("5월") >= 0 && steps[1].prompt.indexOf("4월") < 0, steps);
}

// ── T9: 모호(정본에 두 달) → prompt 무수정 ──
{
  const steps = [{ prompt: "@범위[input_원가_2026_3월.xlsx/원가!A1] 지워줘" }];
  const env = { inputs: [{ name: "input_원가_2026_4월.xlsx" }, { name: "input_원가_2026_5월.xlsx" }] };
  ck("(9) 모호 → prompt 무수정", repairStalePromptBookNames(steps, env) === 0
    && steps[0].prompt.indexOf("3월") >= 0, steps);
}

// ── T10: 파일명 없는 prompt / envConfig 없음 → 무수정(참조 동일) ──
{
  const steps = [{ prompt: "E열에 단가-원가 채워줘", description: null }];
  const env = { inputs: [{ name: "input_원가_2026_5월.xlsx" }] };
  ck("(10) 파일명 없음/env 없음 → 무수정",
    repairStalePromptBookNames(steps, env) === 0
    && repairStalePromptBookNames([{ prompt: "@범위[a_2026_4월.xlsx/s!A1]" }], null) === 0, steps);
}

// ── T11: 저장 시 텍스트 정규화 — stale 만 재해석 ──
{
  globalThis.getFile = (id) => (id === "input:input_원가_2026_5월.xlsx" ? { name: "x" } : null);
  globalThis.pipelineResolveSavedTargetFileId = (tid) =>
    (tid === "input:input_원가_2026_4월.xlsx" ? "input:input_원가_2026_5월.xlsx" : null);
  ck("(11a) 저장 시: 에코 4월→5월",
    normalizeStaleBooksInSavedText("선택 범위: @범위[input_원가_2026_4월.xlsx/원가!F3] 100")
      === "선택 범위: @범위[input_원가_2026_5월.xlsx/원가!F3] 100");
  ck("(11b) 저장 시: 현재 실존 이름은 그대로",
    normalizeStaleBooksInSavedText("@범위[input_원가_2026_5월.xlsx/원가!G8] 200")
      === "@범위[input_원가_2026_5월.xlsx/원가!G8] 200");
  ck("(11c) 저장 시: null/무파일명 통과",
    normalizeStaleBooksInSavedText(null) === null
    && normalizeStaleBooksInSavedText("그냥 텍스트") === "그냥 텍스트");
  delete globalThis.getFile;
  delete globalThis.pipelineResolveSavedTargetFileId;
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
