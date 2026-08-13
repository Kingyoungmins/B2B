// [제보 2026-08-13] "A 파일에서 B 파일에 피벗을 만들거나 붙여넣는 스텝이, 생성기에선 B 로 잘 들어가는데
// 실행기로 돌리면 B 로 못 가고 A 안에 만들어진다."
//
// 원인 두 갈래 (둘 다 '어느 파일에 쓸지'를 정하는 쪽이고, 백엔드는 결백하다 —
// 새 시트는 언제나 그 스텝에 물린 워크북에 생긴다)
//
//   (1) 실행기 매핑이 '읽기 소스'로 쓰기 대상을 덮어썼다
//       조건이 '스텝 텍스트 어딘가에 이 파일 이름이 있다'뿐이라 읽기/쓰기 구분이 없었고,
//       여러 행이 걸리면 마지막 행이 이겼다. 3단계가 A 를 읽어 B 에 쓰면 텍스트에 A·B 가 둘 다
//       있으므로, A 행이 뒤에 오면 대상이 A 로 바뀐다.
//
//   (2) 대상을 못 찾으면 조용히 남의 파일로 흘려보냈다
//       출력 템플릿 대상("output:N")은 이름이 없어 재바인딩이 안 되는데, 못 풀면 아무 말 없이
//       fallbackFileId(= 보통 먼저 풀린 다른 스텝의 파일)로 갔다.
//
// 왜 '피벗만' 티가 나는가: 기존 시트에 값을 쓰는 스텝은 백엔드가 시트 이름으로 다른 워크북을
// 찾아가 주기 때문에 대상이 틀려도 결과가 맞는다. 새로 만드는 동작(피벗 dest, 시트 추가,
// 목적지 없는 붙여넣기)만 엉뚱한 파일에 남는다 → "어떤 단계만 A 로 간다".
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

function sliceBalanced(src, startIdx, open, close) {
  let d = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === open) d++;
    else if (ch === close) { d--; if (d === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}
function fn(src, name) {
  let at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;
  const paren = src.indexOf("(", at);
  let d = 0, paramEnd = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") d++;
    else if (src[i] === ")") { d--; if (d === 0) { paramEnd = i; break; } }
  }
  const b = src.indexOf("{", paramEnd);
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}
function assignedFn(src, name) {
  // window.buildRunnerMappedPipeline = function(steps) { ... };
  const at = src.indexOf("window." + name + " = function");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const b = src.indexOf("{", at);
  return "function " + name + src.slice(src.indexOf("(", at), b) + sliceBalanced(src, b, "{", "}");
}

const dh = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8").replace(/^﻿/, "");
const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 240) : "")); }
}

// ── (1) 실행기 매핑 ──────────────────────────────────────────────
const MAP_STUBS = `
var window = globalThis;
var state = { pipeline: [], runnerMappingChecked: true };
function traceClientUiEvent() {}
function runnerExtractMappingRequirements() { return []; }
var ROWS = [];
function runnerCurrentMappingRows() { return ROWS; }
`;
const mapMod = new Module("runner-map-extracted", module);
mapMod._compile(
  MAP_STUBS + "\n"
  + fn(dh, "runnerReplaceLiteral") + "\n"
  + fn(dh, "runnerDeclaredTargetBookName") + "\n"
  + fn(dh, "runnerSameBookName") + "\n"
  + `
module.exports = {
  declared: runnerDeclaredTargetBookName,
  same: runnerSameBookName,
};
`, path.join(__dirname, "_extracted_runner_map.js"));
const M = mapMod.exports;

console.log("[1] 스텝이 밝힌 '쓰기 대상' 읽어내기");
check("input: 접두는 파일명을 준다", M.declared({ targetFileId: "input:B.xlsx" }) === "B.xlsx");
check("output: 접두는 이름이 없다(선언 없음으로)", M.declared({ targetFileId: "output:0" }) === "");
check("대상이 없으면 빈 문자열", M.declared({}) === "" && M.declared({ targetFileId: "" }) === "");

console.log("[2] 같은 워크북 판정 — 느슨하면 남의 파일을 대상으로 삼는다");
check("정확 일치", M.same("B.xlsx", "B.xlsx"));
check("대소문자 무시", M.same("B.XLSX", "b.xlsx"));
check("확장자만 다르면 같다고 본다", M.same("B.xlsx", "B.xlsm"));
check("다른 파일은 아니다", M.same("A.xlsx", "B.xlsx") === false);
check("부분 포함은 같다고 보지 않는다", M.same("정산.xlsx", "정산_2월.xlsx") === false);
check("빈 값은 항상 거짓", M.same("", "B.xlsx") === false && M.same("B.xlsx", "") === false);

console.log("[3] 매핑이 '읽기 소스'로 대상을 덮지 않는가  ← 제보의 핵심");
check("선언된 대상 행으로만 다시 묶는다",
  /let pick = declaredRows\.length \? declaredRows : \(isOutputSlot \? \[\] : matchedRows\);/.test(dh));
check("출력 슬롯(output:N)은 이름으로 다시 묶지 않는다 — 소스 파일로 끌려가는 걸 막는다",
  /const isOutputSlot = \/\^output:\/\.test\(/.test(dh));
check("여러 행이 걸리면 '마지막 승' 대신 손대지 않는다",
  /if \(pick\.length === 1\) \{[\s\S]{0,200}\} else if \(pick\.length > 1\) \{/.test(dh));
check("모호하면 로그를 남긴다(조용히 넘어가지 않는다)",
  /_traceMap\("target\.ambiguous"/.test(dh));
check("옛 '즉시 덮어쓰기'가 사라졌다",
  !/if \(touchesBook \|\| \(!row\.req\.book && touchesSheet\)\) \{\s*\n\s*targetFileId = row\.fileItem\.id;/.test(dh));
check("코드 리터럴 치환은 모든 행에 대해 그대로 돈다(대상 판정과 별개)",
  /bookNames\.forEach\(bn => \{ code = runnerReplaceLiteral\(code, bn, actualName\); \}\);/.test(dh));

// ── (2) 대상 못 찾았을 때 ────────────────────────────────────────
const PJ_STUBS = `
var window = globalThis;
var FILES = [];
var state = { pipeline: [] };
function getFile(id) { return FILES.find(f => f.id === id) || null; }
function pipelineKnownFiles() { return FILES; }
function pipelineFileIdByWorkbookName(name) {
  const hit = FILES.filter(f => f.name === String(name || "").trim());
  return hit.length === 1 ? hit[0].id : null;
}
function inferPipelineStepTargetFileId(step) {
  return pipelineResolveSavedTargetFileId(step && step.targetFileId);
}
`;
const pjMod = new Module("target-resolve-extracted", module);
pjMod._compile(
  PJ_STUBS + "\n"
  + fn(pj, "pipelineResolveSavedTargetFileId") + "\n"
  + fn(pj, "pipelineStepDeclaredTargetUnresolved") + "\n"
  + fn(pj, "pipelineStepsWithUnresolvedTarget") + "\n"
  + `
module.exports = {
  unresolvedOne: pipelineStepDeclaredTargetUnresolved,
  unresolvedAll: pipelineStepsWithUnresolvedTarget,
  setFiles(f) { FILES = f; },
};
`, path.join(__dirname, "_extracted_target_resolve.js"));
const T = pjMod.exports;

console.log("[4] 대상을 못 찾은 스텝을 골라내는가");
T.setFiles([{ id: "input:A.xlsx", name: "A.xlsx" }, { id: "input:B.xlsx", name: "B.xlsx" }]);
check("풀리는 대상은 미해결이 아니다", T.unresolvedOne({ targetFileId: "input:B.xlsx" }) === "");
check("이름으로 다시 묶이면 미해결이 아니다", T.unresolvedOne({ targetFileId: "input:A.xlsx" }) === "");
check("없는 파일을 가리키면 그 이름을 돌려준다",
  T.unresolvedOne({ targetFileId: "input:없는파일.xlsx" }) === "없는파일.xlsx");
check("대상을 밝힌 적 없으면 미해결이 아니다(폴백이 정상)", T.unresolvedOne({ code: "x" }) === "");
check("output:N 은 이름이 없어 재바인딩 불가 → 미해결로 잡힌다",
  T.unresolvedOne({ targetFileId: "output:0" }) === "output:0");

console.log("[5] 파일이 하나뿐이면 멈추지 않는다 — 고를 여지가 없다");
const STEPS = [{ code: "c1", targetFileId: "input:없는파일.xlsx" }];
T.setFiles([{ id: "input:A.xlsx", name: "A.xlsx" }]);
check("파일 1개 → 통과", T.unresolvedAll(STEPS).length === 0);
T.setFiles([{ id: "input:A.xlsx", name: "A.xlsx" }, { id: "input:B.xlsx", name: "B.xlsx" }]);
check("파일 2개 → 잡아낸다", T.unresolvedAll(STEPS).length === 1, JSON.stringify(T.unresolvedAll(STEPS)));
check("잡은 결과에 몇 번째 스텝인지와 못 찾은 이름이 들어 있다",
  (() => { const r = T.unresolvedAll(STEPS)[0]; return r.idx === 0 && r.missing === "없는파일.xlsx"; })());
check("코드 없는 스텝은 대상으로 안 본다", T.unresolvedAll([{ targetFileId: "input:없는파일.xlsx" }]).length === 0);

console.log("[6] 배선 — 실행 직전에 멈추는가");
check("전체실행이 실행 전에 검사한다", /pipelineStepsWithUnresolvedTarget\(activeSteps\)/.test(pj));
check("조용히 넘어가지 않고 스텝 오류로 멈춘다",
  /throw createPipelineStepError\([\s\S]{0,320}찾지 못했습니다/.test(pj));
check("사용자가 할 일을 알려 준다(파일 확인에서 지정)", /'파일 확인'에서 이 파일을 지정한 뒤/.test(pj));
check("검사 자체가 터지면 실행을 막지 않는다", /console\.warn\("\[pipeline\] 대상 미해결 검사 실패"/.test(pj));
check("output:N 은 사용자에게 '출력 파일 N'으로 보인다(내부 식별자 노출 금지)",
  /출력 파일 \$\{Number\(RegExp\.\$1\) \+ 1\}/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
