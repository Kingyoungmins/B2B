// [안전 판정 2026-08-12] 교차파일 되돌리기의 안전은 "이 스텝이 다른 파일에 쓰는가" 판정에 걸려 있다.
// 그런데 그 판정은 코드 문자열에서 파일명을 찾는 '정적 탐지'다. 탐지기가 못 찾으면 어느 쪽으로
// 떨어지느냐가 전부다.
//
//   예전: 이름은 나왔는데 어느 파일인지 확정 못 하면 그 이름을 버렸다 → '교차 아님'
//         → 빠른 롤백 허용 → 목적지 파일이 안 되돌아간 채 남는다(UI=보류, 실제=적용됨)
//         즉 '이름이 모호할수록 안전장치가 풀리는' 거꾸로 된 구조였다.
//   지금: 확정 못 한 이름이 하나라도 있으면 교차로 본다 → 목적지를 모르니 사본도 못 뜬다
//         → stepHasFullRollbackSnapshots 가 false → 전체 재적용. 느릴 뿐 전부 되돌아간다.
//
// _test_toggle_scenarios.js 는 탐지 '결과'를 스텁으로 주고 OFF 경로만 잠근다.
// 이 테스트는 그 스텁의 자리에 들어가는 탐지기 자체가 안전한 쪽으로 떨어지는지를 잠근다.
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

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

// 실제 문자열 추출기들은 그대로 쓰고, '이름 → 파일' 해석만 테스트가 지배한다
// (모호/미지 상황을 마음대로 만들 수 있어야 하므로).
const STUBS = `
var window = globalThis;
var state = { pipeline: [] };
var NAME_TO_FILE = {};
function pipelineFileIdByWorkbookName(name) { return NAME_TO_FILE[String(name || "").trim()] || null; }
function inferPipelineStepTargetFileId() { return null; }
`;
const EXTRACT = [
  fn(pj, "pipelineStripCodeComments"),
  fn(pj, "pipelineConstStringVars"),
  fn(pj, "pipelineResolvePyArg"),
  fn(pj, "pipelinePythonBookVarNames"),
  fn(pj, "pipelinePythonMutatedBookNames"),
  fn(pj, "pipelineVbaStringVars"),
  fn(pj, "pipelineVbaTargetWorkbookNames"),
  fn(pj, "crossWriteDestinationScan"),
  fn(pj, "crossWriteDestinationFileIds"),
  fn(pj, "pipelineSuffixCrossUnresolvedNames"),
  fn(pj, "pipelineStepWritesCrossFile"),
  fn(pj, "pipelineSuffixWritesCrossFile"),
  fn(pj, "stepHasFullRollbackSnapshots"),
].join("\n\n");
const READER_SET = /const PIPELINE_CTX_READER_METHODS = new Set\(\[[\s\S]*?\]\);/.exec(pj);
const EXPORTS = `
module.exports = {
  scan: crossWriteDestinationScan,
  ids: crossWriteDestinationFileIds,
  writesCross: pipelineStepWritesCrossFile,
  suffixWritesCross: pipelineSuffixWritesCrossFile,
  unresolvedNames: pipelineSuffixCrossUnresolvedNames,
  hasFullSnapshots: stepHasFullRollbackSnapshots,
  setFiles(map) { NAME_TO_FILE = map || {}; },
};
`;
const m = new Module("crossfile-detect-extracted", module);
m._compile(STUBS + "\n" + (READER_SET ? READER_SET[0] : "const PIPELINE_CTX_READER_METHODS = new Set();")
  + "\n" + EXTRACT + "\n" + EXPORTS, path.join(__dirname, "_extracted_crossfile_detect.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}

const CODE_CROSS = 'out = ctx.book("정산서.xlsx")\nout.write("Sheet1", 1, 1, [[1]])';

console.log("[1] 확정되는 경우 — 예전과 동일하게 목적지를 집는다");
T.setFiles({ "정산서.xlsx": "f_out" });
{
  const s = T.scan(CODE_CROSS, {});
  check("목적지 파일을 집는다", s.ids.length === 1 && s.ids[0] === "f_out", JSON.stringify(s));
  check("모르는 이름은 없다", s.unresolved.length === 0, JSON.stringify(s.unresolved));
  check("교차로 판정", T.writesCross({ code: CODE_CROSS }) === true);
}
{
  // 자기 파일에 쓰는 건 교차가 아니다(복붙 캡처 스텝이 전부 교차로 오판되던 회귀 방지)
  const s = T.scan(CODE_CROSS, { selfFileId: "f_out" });
  check("자기 대상 파일이면 교차가 아니다", s.ids.length === 0 && s.unresolved.length === 0, JSON.stringify(s));
  check("교차 아님으로 판정", T.writesCross({ code: CODE_CROSS, targetFileId: "f_out" }) === false);
}

console.log("[2] 모호할 때 — 안전한 쪽(교차)으로 떨어지는가  ← 이번 수정의 핵심");
T.setFiles({});   // 후보가 둘 이상이면 pipelineFileIdByWorkbookName 이 null 을 준다(모호)
{
  const s = T.scan(CODE_CROSS, {});
  check("확정은 못 하지만 이름은 남긴다", s.ids.length === 0 && s.unresolved.includes("정산서.xlsx"),
    JSON.stringify(s));
  check("모호하면 '교차 아님'이 아니라 '교차'로 본다",
    T.writesCross({ code: CODE_CROSS }) === true, "false 면 빠른 롤백이 열려 목적지가 안 되돌아간다");
}
{
  // dst_book 방언도 동일
  const code = 'ctx.copy(src_sheet="A", dst_book="알수없는파일.xlsx", dst_sheet="B")';
  check("dst_book 이 모호해도 교차로 본다", T.writesCross({ code }) === true);
}
{
  // VBA 목적지도 동일
  const code = 'Sub B2BSkill()\n  Workbooks("모르는거.xlsx").Activate\nEnd Sub';
  check("VBA Activate 목적지가 모호해도 교차로 본다", T.writesCross({ code }) === true);
}

console.log("[3] 모호하면 되돌리기 사본이 '완전'하다고 말하지 않는다");
{
  // 대상 파일 사본은 있는데 목적지가 모호한 스텝 — 빠른 롤백을 허용하면 반쪽 복원이 된다
  const step = { code: CODE_CROSS, _preApplySnapshot: { resultId: "r1" } };
  check("대상 사본만 있으면 불완전", T.hasFullSnapshots(step) === false);
  step._crossPreApplySnapshots = [{ resultId: "rdst" }];
  check("목적지 사본까지 있으면 완전", T.hasFullSnapshots(step) === true);
  step._crossPreApplySnapshots = [];
  check("빈 배열은 불완전(반쪽 복원 금지)", T.hasFullSnapshots(step) === false);
}
{
  // 교차가 아닌 평범한 스텝은 대상 사본만으로 완전 — 과잉 보수로 전부 느려지지 않게
  T.setFiles({ "정산서.xlsx": "f_out" });
  const plain = { code: 'ctx.write("Sheet1", 1, 1, [[1]])', _preApplySnapshot: { resultId: "r1" } };
  check("평범한 스텝은 대상 사본만으로 완전", T.hasFullSnapshots(plain) === true);
}

console.log("[4] 구간 판정과 로그");
T.setFiles({});
{
  const steps = [
    { code: 'ctx.write("S", 1, 1, [[1]])' },
    { code: CODE_CROSS },
    { code: 'ctx.write("S", 2, 1, [[2]])' },
  ];
  check("구간에 모호한 교차가 있으면 구간도 교차", T.suffixWritesCross(steps, 0) === true);
  check("모호한 스텝 뒤부터 보면 교차 아님", T.suffixWritesCross(steps, 2) === false);
  check("느려진 이유가 이름으로 남는다", T.unresolvedNames(steps, 0) === "정산서.xlsx",
    T.unresolvedNames(steps, 0));
  check("확정되면 로그도 비어 있다", (T.setFiles({ "정산서.xlsx": "f_out" }), T.unresolvedNames(steps, 0)) === "");
}

console.log("[5] 배선 — 되돌리기 경로가 이 판정을 쓰는가");
check("모르는 목적지가 있으면 사본을 아예 안 남긴다",
  /if \(unresolved\.length\) \{[\s\S]{0,320}return \[\];/.test(pj));
check("OFF 트레이스에 사유를 싣는다", /crossUnresolved: _crossUnresolved,/.test(pj));
check("판정이 unresolved 를 본다",
  /return scan\.ids\.length > 0 \|\| scan\.unresolved\.length > 0;/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
