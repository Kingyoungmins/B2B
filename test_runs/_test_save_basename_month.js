// [실측 재현] 스킬 저장 창 기본 이름이 '지난달 파일 이름'으로 뜨던 문제.
//   시나리오: 4월 스킬 zip 을 실행기에 올려 5월 파일로 전체실행 → 결과 편집 → 스킬 저장
//             → 저장 창 기본값이 input_원가_2026_4월 로 떴다(사용자 실측 2026-08-04).
//   수정: 기억된 이름과 '월·날짜만 다른 같은 계열' 입력이 지금 딱 하나 있으면 그 이름으로 갱신.
// 소스(save-load.js / pipeline.js)에서 실제 함수를 추출해 실행한다(복사본 아님).
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
function fn(src, name) {
  const at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const b = src.indexOf("{", at);
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}
function constArr(src, name) {
  const at = src.indexOf("const " + name + " = [");
  if (at < 0) throw new Error("상수 못 찾음: " + name);
  const b = src.indexOf("[", at);
  return "const " + name + " = " + sliceBalanced(src, b, "[", "]") + ";";
}

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
const sj = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8");

const bundle = [
  "var state = { inputs: [] };",
  fn(pj, "pipelineLooksLikeHms"),
  fn(pj, "pipelineLooksLikeYmd"),
  fn(pj, "pipelineLooksLikeDateNumber"),
  constArr(pj, "PIPELINE_VOLATILE_NAME_TOKENS"),
  constArr(pj, "PIPELINE_VOLATILE_SUFFIX_TOKENS"),
  fn(pj, "pipelineDecodeWorkbookName"),
  fn(pj, "pipelineStableWorkbookKey"),
  fn(sj, "refreshSaveBaseNameToCurrentInputs"),
  "module.exports = { refreshSaveBaseNameToCurrentInputs, setInputs: (n) => { state.inputs = n.map(x => ({ name: x })); } };",
].join("\n\n");

const Module = require("module");
const m = new Module("extracted", module);
m._compile(bundle, path.join(__dirname, "_extracted_save_basename.js"));
const { refreshSaveBaseNameToCurrentInputs: refresh, setInputs } = m.exports;

let fails = 0;
function ck(name, cond, got) {
  console.log((cond ? " OK  " : "FAIL ") + name + (cond ? "" : "  got=" + JSON.stringify(got)));
  if (!cond) fails++;
}

// ── (1) 실측 시나리오: 4월 이름 + 지금 올라온 5월 파일 → 5월 이름으로 ──
setInputs(["input_원가_2026_5월.xlsx"]);
ck("(1) 4월 → 5월 갱신",
  refresh("input_원가_2026_4월") === "input_원가_2026_5월",
  refresh("input_원가_2026_4월"));

// ── (2) 6월 파일로 돌렸으면 6월 이름 ──
setInputs(["input_원가_2026_6월.xlsx"]);
ck("(2) 4월 → 6월 갱신",
  refresh("input_원가_2026_4월") === "input_원가_2026_6월",
  refresh("input_원가_2026_4월"));

// ── (3) 사용자가 직접 지은 이름(계열 불일치) → 그대로 보존 ──
setInputs(["input_원가_2026_5월.xlsx"]);
ck("(3) 커스텀 이름은 보존",
  refresh("월마감정산_최종") === "월마감정산_최종",
  refresh("월마감정산_최종"));

// ── (4) 같은 계열이 둘(4월·5월 동시 업로드) → 모호하므로 손대지 않음 ──
setInputs(["input_원가_2026_4월.xlsx", "input_원가_2026_5월.xlsx"]);
ck("(4) 같은 계열 2개 → 무변경",
  refresh("input_원가_2026_3월") === "input_원가_2026_3월",
  refresh("input_원가_2026_3월"));

// ── (5) 이미 현재 파일과 같은 이름 → 그대로 ──
setInputs(["input_원가_2026_5월.xlsx"]);
ck("(5) 이미 일치하면 무변경",
  refresh("input_원가_2026_5월") === "input_원가_2026_5월",
  refresh("input_원가_2026_5월"));

// ── (6) 입력이 없으면(스킬만 불러온 상태) 무변경 ──
setInputs([]);
ck("(6) 입력 없음 → 무변경",
  refresh("input_원가_2026_4월") === "input_원가_2026_4월",
  refresh("input_원가_2026_4월"));

// ── (7) 교차파일: 원가/검증 각자 제 계열로만 ──
setInputs(["input_원가_2026_5월.xlsx", "input_검증_2026_5월.xlsx"]);
ck("(7a) 원가 계열",
  refresh("input_원가_2026_4월") === "input_원가_2026_5월",
  refresh("input_원가_2026_4월"));
ck("(7b) 검증 계열",
  refresh("input_검증_2026_4월") === "input_검증_2026_5월",
  refresh("input_검증_2026_4월"));

// ── (8) 짧은 키/빈 값은 매칭 금지 ──
setInputs(["ab_2026_5월.xlsx"]);
ck("(8) 짧은 키 → 무변경",
  refresh("5월") === "5월" && refresh("") === "" && refresh(null) === null,
  [refresh("5월"), refresh(""), refresh(null)]);

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
