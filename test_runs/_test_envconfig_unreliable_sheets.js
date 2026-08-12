// [보안 라벨(MIP) 파일 저장 오염 2026-08-12] 사내 VM(MIP Gateway)에서 라벨이 붙은 파일은 앱이 못 읽는다.
// 그러면 백엔드가 '파일명'을 시트명인 척 지어내고(inspect_workbook_fallback), 앱은 그걸
// sheetNamesUnreliable 로 표시해 실행기에서는 무시한다. 그런데 **스킬 저장은 그 가짜 이름을 그대로
// envConfig 에 담고 있었다** — 표시는 파일 객체에만 있고 저장 JSON 에는 안 남으므로, 나중에 그 스킬을
// 열면 가짜 이름이 '정본'으로 둔갑해 스킬의 진짜 시트 요구를 강등시키고 실행이 깨졌다(사용자 제보).
//
// 이 테스트가 잠그는 것
//   1. 시트명을 못 믿는 파일은 저장할 때 시트 목록을 비운다
//   2. 정상 파일은 예전 그대로 담는다(회귀 금지)
//   3. 출력 파일에도 같은 규칙이 적용된다
//   4. 비워서 저장하면 실행기 검증이 그 파일을 '검증 대상 아님'으로 넘긴다(강등이 안 일어난다)
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
  const at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const b = src.indexOf("{", src.indexOf("(", at));
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}

const sl = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8").replace(/^﻿/, "");
const dh = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8").replace(/^﻿/, "");

const m = new Module("envcfg-extracted", module);
m._compile(fn(sl, "envConfigSheetNames") + "\nmodule.exports = { envConfigSheetNames };\n",
  path.join(__dirname, "_extracted_envcfg.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 못 믿는 시트명은 저장하지 않는다  ← 이번 수정");
{
  // 라벨 걸린 파일의 실제 모습: 시트명이 '파일명'으로 지어져 있고 표시가 달려 있다
  const bad = { name: "input_v056_정산서.xlsx", sheetNames: ["input_v056_정산서.xlsx"], sheetNamesUnreliable: true };
  check("빈 목록으로 저장", T.envConfigSheetNames(bad).length === 0, JSON.stringify(T.envConfigSheetNames(bad)));
  const bad2 = { name: "a.xlsx", sheetNames: ["Sheet1", "정산"], sheetNamesUnreliable: true };
  check("이름이 그럴듯해도 표시가 있으면 안 담는다", T.envConfigSheetNames(bad2).length === 0);
}

console.log("[2] 정상 파일은 예전 그대로(회귀 금지)");
{
  const ok = { name: "a.xlsx", sheetNames: ["Sheet1", "정산"] };
  check("그대로 담김", JSON.stringify(T.envConfigSheetNames(ok)) === JSON.stringify(["Sheet1", "정산"]));
  check("원본 배열을 복사한다(참조 공유 금지)", T.envConfigSheetNames(ok) !== ok.sheetNames);
  check("표시가 false 면 담는다", T.envConfigSheetNames({ sheetNames: ["S"], sheetNamesUnreliable: false })[0] === "S");
  check("파일이 없으면 빈 목록", T.envConfigSheetNames(null).length === 0);
  check("시트 목록이 없으면 빈 목록", T.envConfigSheetNames({ name: "a" }).length === 0);
}

console.log("[3] 입력·출력 양쪽에 적용됐나(배선)");
check("입력 파일", /inputs: \(state\.inputs \|\| \[\]\)[\s\S]{0,300}sheetNames: envConfigSheetNames\(f\)/.test(sl));
check("출력 파일", /outputs: \(state\.outputTemplates[\s\S]{0,300}sheetNames: envConfigSheetNames\(f\)/.test(sl));
check("가짜 이름을 그대로 담던 예전 코드 없음", !/sheetNames: \(f && Array\.isArray\(f\.sheetNames\)\) \? \[\.\.\.f\.sheetNames\] : \[\]/.test(sl));

console.log("[4] 비어 있으면 실행기 검증이 건너뛴다(강등이 안 일어난다)");
// runnerApplyEnvConfigFilter 의 시트 강등 조건은 정본 시트 목록 길이로 게이트된다.
check("길이 0 이면 강등 조건 자체가 성립 안 함",
  /if \(req\.sheet && Array\.isArray\(hit\.sheetNames\) && hit\.sheetNames\.length/.test(dh));
check("파일 요구는 살아남는다(name 은 그대로 저장하므로)", /const _cfgNames = \(f\) => \[f\.name, f\.displayName\]/.test(dh));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
