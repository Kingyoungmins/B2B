// [미탐 닫기 2026-08-12] 교차파일 되돌리기의 안전 판정은 코드 문자열에서 파일명을 찾는 정적 탐지였다.
// 그래서 이런 스킬은 아예 안 보였다:
//   - 파일명이 셀 데이터에서 오는 스킬(목록 시트를 읽어 그 이름의 파일에 쓴다)
//   - ctx.book 없이 시트명만 써서 _ws() 폴백으로 남의 워크북에 쓰는 스킬
// 안 보이면 '교차 아님'이 되고, 빠른 되돌리기가 목적지를 안 되돌린 채 끝난다(UI=보류, 실제=적용됨).
//
// 백엔드가 실행 중 '실제로 쓴 세션'을 스텝별로 돌려주므로 그걸 정적 탐지와 OR 로 합친다.
// 대체가 아니라 OR 인 이유: VBA 스텝은 런타임 증거를 만들 수단이 없어(tracked=false),
// '증거 없음 = 교차'로 몰면 VBA 섞인 스킬의 되돌리기가 전부 느려진다.
//
// 이 테스트가 잠그는 것
//   1. 증거가 있으면 정적으로 안 보여도 교차로 본다(미탐 닫힘)
//   2. VBA(tracked=false)는 증거를 안 남긴다 = 정적 탐지 그대로(현상 유지)
//   3. 증거는 스텝별이다 — 한 스텝의 교차가 다른 스텝으로 번지지 않는다
//   4. 사본이 '알려진 목적지를 전부 덮는지'까지 본다(스텝을 고쳐 목적지가 바뀐 경우)
//   5. 첫 판은 증거가 없어 전체 재적용, 두 번째 판부터 빠른 롤백(안전→빠름 순서)
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
const sb = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8").replace(/^﻿/, "");

const STUBS = `
var window = globalThis;
var state = { pipeline: [] };
var SAVED = [];            // /api/excel/save 를 부른 excelId 순서
var SAVE_FAILS = new Set();
function pipelineFileIdByWorkbookName() { return null; }   // 정적으로는 아무것도 못 찾는 상황
function inferPipelineStepTargetFileId() { return null; }
async function excelIdForPipelineFileId(fid) { return "x_" + fid; }
async function postExcelMirror(url, body) {
  SAVED.push(body.excelId);
  if (SAVE_FAILS.has(body.excelId)) return null;
  return { downloadId: "snap_" + body.excelId, name: body.excelId + ".xlsx" };
}
function pipelineStripCodeComments(c) { return String(c || ""); }
function pipelineConstStringVars() { return {}; }
function pipelineResolvePyArg() { return null; }
function pipelinePythonMutatedBookNames() { return []; }
function pipelineVbaTargetWorkbookNames() { return []; }
`;
const EXTRACT = [
  fn(pj, "crossWriteDestinationScan"),
  fn(pj, "crossWriteDestinationFileIds"),
  fn(pj, "wirePipelineStepCrossEvidence"),
  fn(pj, "stepRuntimeCrossExcelIds"),
  fn(pj, "pipelineStepWritesCrossFile"),
  fn(pj, "pipelineSuffixWritesCrossFile"),
  fn(pj, "stepHasFullRollbackSnapshots"),
  fn(pj, "captureCrossFileDestinationSnapshots"),
].join("\n\n");
const EXPORTS = `
module.exports = {
  wire: wirePipelineStepCrossEvidence,
  runtimeIds: stepRuntimeCrossExcelIds,
  writesCross: pipelineStepWritesCrossFile,
  hasFullSnapshots: stepHasFullRollbackSnapshots,
  capture: captureCrossFileDestinationSnapshots,
  saved() { return SAVED; },
  resetSaved() { SAVED.length = 0; SAVE_FAILS.clear(); },
  failSave(id) { SAVE_FAILS.add(id); },
  setLive(p) { state.pipeline = p; },
};
`;
const m = new Module("crossfile-runtime-extracted", module);
m._compile(STUBS + "\n" + EXTRACT + "\n" + EXPORTS, path.join(__dirname, "_extracted_crossfile_runtime.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}

// 정적으로는 절대 안 보이는 스킬: 쓸 파일 이름을 시트에서 읽어 온다
const CODE_HIDDEN = [
  'names = [r[0] for r in ctx.read("대상목록", 2, 1, 10, 1)]',
  'for n in names:',
  '    ctx.book(n).write("Sheet1", 1, 1, [["x"]])',
].join("\n");

async function main() {
  console.log("[1] 정적으로 안 보이는 교차 쓰기");
  {
    const step = { id: "s1", code: CODE_HIDDEN };
    check("증거 없으면 교차로 안 보인다(예전 상태)", T.writesCross(step) === false);
    T.setLive([step]);
    T.wire([{ stepIdx: 0, stepId: "s1", tracked: true, excelIds: ["x_out"] }], [step]);
    check("증거가 붙으면 교차로 본다  ← 미탐 닫힘", T.writesCross(step) === true);
    check("증거는 세션 id 로 남는다", JSON.stringify(T.runtimeIds(step)) === '["x_out"]', T.runtimeIds(step));
  }

  console.log("[2] VBA 는 현상 유지 — 증거를 안 만든다");
  {
    const step = { id: "v1", code: 'Sub B2BSkill()\n Range("A1")=1\nEnd Sub' };
    T.setLive([step]);
    T.wire([{ stepIdx: 0, stepId: "v1", tracked: false, excelIds: [] }], [step]);
    check("tracked=false 면 증거를 안 붙인다", T.runtimeIds(step).length === 0);
    check("판정은 정적 탐지 그대로", T.writesCross(step) === false,
      "여기서 true 가 되면 VBA 섞인 스킬의 되돌리기가 전부 느려진다");
  }

  console.log("[3] 증거는 스텝별 — 번지지 않는다");
  {
    const a = { id: "a", code: CODE_HIDDEN };
    const b = { id: "b", code: 'ctx.write("S", 1, 1, [[1]])' };
    T.setLive([a, b]);
    T.wire([
      { stepIdx: 0, stepId: "a", tracked: true, excelIds: ["x_out"] },
      { stepIdx: 1, stepId: "b", tracked: true, excelIds: [] },
    ], [a, b]);
    check("쓴 스텝만 교차", T.writesCross(a) === true && T.writesCross(b) === false);
  }

  console.log("[4] 매핑 실행 — 원본 파이프라인에도 증거를 남긴다");
  {
    const live = { id: "s9", code: CODE_HIDDEN };
    const mapped = { id: "s9", code: CODE_HIDDEN.replace("대상목록", "대상목록2") };
    T.setLive([live]);
    T.wire([{ stepIdx: 0, stepId: "s9", tracked: true, excelIds: ["x_out"] }], [mapped]);
    check("사본에 붙는다", T.runtimeIds(mapped).length === 1);
    check("원본에도 같이 붙는다(사본이 버려져도 증거가 안 사라진다)", T.runtimeIds(live).length === 1);
  }

  console.log("[5] 사본 뜨기 — 증거가 가리키는 세션까지 뜬다");
  {
    T.resetSaved();
    const step = { id: "s2", code: CODE_HIDDEN, _runtimeCrossExcelIds: ["x_out"], _runtimeCrossTracked: true };
    const out = await T.capture(step, "x_self");
    check("증거 세션의 사본을 뜬다", out.length === 1 && out[0].excelId === "x_out", JSON.stringify(out));
    check("save 를 한 번만 부른다", JSON.stringify(T.saved()) === '["x_out"]', T.saved());
  }
  {
    T.resetSaved();
    const step = { id: "s3", code: CODE_HIDDEN, _runtimeCrossExcelIds: ["x_self"], _runtimeCrossTracked: true };
    const out = await T.capture(step, "x_self");
    check("자기 세션은 사본을 안 뜬다", out.length === 0 && T.saved().length === 0);
  }
  {
    T.resetSaved();
    T.failSave("x_out");
    const step = { id: "s4", code: CODE_HIDDEN, _runtimeCrossExcelIds: ["x_out"], _runtimeCrossTracked: true };
    const out = await T.capture(step, "x_self");
    check("하나라도 실패하면 통째로 버린다(반쪽 복원 금지)",
      out.length === 0 && Array.isArray(step._crossPreApplySnapshots) && step._crossPreApplySnapshots.length === 0);
  }

  console.log("[6] '사본이 있다'가 아니라 '알려진 목적지를 전부 덮는가'");
  {
    const step = {
      id: "s5", code: CODE_HIDDEN,
      _preApplySnapshot: { resultId: "r1" },
      _runtimeCrossExcelIds: ["x_out"], _runtimeCrossTracked: true,
      _crossPreApplySnapshots: [{ resultId: "rA", excelId: "x_out" }],
    };
    check("아는 목적지가 사본에 있으면 완전", T.hasFullSnapshots(step) === true);
    // 스텝을 고쳐 목적지가 바뀐 모양 — 사본은 예전 목적지 것만 남아 있다
    step._runtimeCrossExcelIds = ["x_other"];
    check("목적지가 바뀌었는데 사본이 예전 것뿐이면 불완전  ← 개수만 세면 놓친다",
      T.hasFullSnapshots(step) === false);
    step._crossPreApplySnapshots = [{ resultId: "rA", excelId: "x_out" }, { resultId: "rB", excelId: "x_other" }];
    check("둘 다 덮으면 완전", T.hasFullSnapshots(step) === true);
  }

  console.log("[7] 첫 판은 안전(전체 재적용) → 두 번째 판부터 빠름");
  {
    // 첫 판: 증거 없음 → 정적으로도 안 보임 → 교차 아님 → 사본 없이도 '완전'
    const first = { id: "s6", code: CODE_HIDDEN, _preApplySnapshot: { resultId: "r1" } };
    check("첫 판은 교차로 안 보인다(어쩔 수 없음 — 아직 안 돌려봤다)", T.writesCross(first) === false);
    // 실행 후 증거가 붙는다 → 이제 교차 → 사본이 없으니 불완전 → 전체 재적용
    T.setLive([first]);
    T.wire([{ stepIdx: 0, stepId: "s6", tracked: true, excelIds: ["x_out"] }], [first]);
    check("실행이 끝나면 교차로 바뀐다", T.writesCross(first) === true);
    check("그 판의 되돌리기는 전체 재적용(사본이 없으니)", T.hasFullSnapshots(first) === false);
    // 다음 적용: 증거를 보고 목적지 사본까지 뜬다 → 빠른 롤백 가능
    T.resetSaved();
    await T.capture(first, "x_self");
    first._preApplySnapshot = { resultId: "r2" };
    check("다음 적용부터는 목적지 사본이 갖춰진다", T.hasFullSnapshots(first) === true, JSON.stringify(first._crossPreApplySnapshots));
  }

  console.log("[8] 배선");
  check("성공/실패/전체실행 세 경로 모두에서 증거를 붙인다",
    (pj.match(/wirePipelineStepCrossEvidence\(/g) || []).length >= 4);
  check("코드를 고치면 그 스텝 증거를 버린다", /delete next\[idx\]\._runtimeCrossExcelIds;/.test(pj));
  check("버리기 전에 교차 판정을 먼저 끝낸다(폐기 범위 보존)",
    pj.indexOf("if (writesCross) dropFrom = idx;") < pj.indexOf("delete next[idx]._runtimeCrossExcelIds;"));
  check("백엔드가 스텝별로 증거를 모은다", /_step_cross\.append\(\{/.test(sb));
  check("백엔드가 이름이 아니라 세션 id 로 돌려준다", /def _companion_excel_ids_for_books\(/.test(sb)
    && /result\["stepCross"\] = _step_cross_payload\(/.test(sb));
  check("VBA 스텝은 tracked=false 로 남는다", /_step_tracked = False/.test(sb));
  check("실패 응답에도 증거를 싣는다", (sb.match(/\["stepCross"\] = _step_cross_payload\(/g) || []).length >= 3);
  check("동반본 여는 비용을 사본/열기로 나눠 찍는다",
    /copySec=round\(_t_copy, 2\), openSec=round\(_t_open, 2\)/.test(sb));

  console.log("");
  console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}
main();
