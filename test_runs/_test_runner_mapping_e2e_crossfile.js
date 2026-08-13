// [스모크 / 제보 재현 2026-08-13] 실행기 매핑을 '함수 통째로' 돌려 제보된 스킬 모양이 어느 파일로
// 묶이는지 본다. 앞선 _test_runner_write_target_routing.js 는 조각 함수와 소스 모양을 잠그는데,
// 이 테스트는 buildRunnerMappedPipeline 을 그대로 실행해 결과 targetFileId 를 확인한다.
//
// 재현하는 스킬 (VM 로그에서 실제로 나온 3단계)
//   1단계  target=B   ctx.insert_cols("요약", "A", count=6)
//   2단계  target=A   ctx.pivot("원본", ..., dest_name="집계")
//   3단계  target=B   ctx.copy("A.xlsx!집계", "A3:B3", "요약", "A1")     ← A 를 읽어 B 에 쓴다
//
// 예전 동작: 3단계 텍스트에 A(코드 리터럴)와 B(targetFileId) 가 둘 다 있어 두 행이 다 걸리고,
//           rows 를 끝까지 돌아 '마지막에 걸린 행'이 이겼다 → A 행이 뒤면 3단계 대상이 A 가 된다.
//           그러면 붙여넣기가 B 가 아니라 A 에 들어간다(제보 증상).
// 지금 동작: 스텝이 선언한 대상(input:B.xlsx) 에 해당하는 행으로만 묶는다 → 3단계는 B 유지.
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
  const b = src.indexOf("{", src.indexOf(")", at));
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}
function winFn(src, name) {
  const at = src.indexOf("window." + name + " = function");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const paren = src.indexOf("(", src.indexOf("= function", at));
  const b = src.indexOf("{", paren);
  return "function " + name + src.slice(paren, b) + sliceBalanced(src, b, "{", "}");
}

const dh = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8").replace(/^﻿/, "");

// 실행기가 올린 실제 파일 두 개. 이름은 저장 스킬과 같다(월 변경 없는 단순 재실행).
const FILE_A = { id: "f_A", name: "A.xlsx" };
const FILE_B = { id: "f_B", name: "B.xlsx" };

const STUBS = `
var window = globalThis;
var state = { pipeline: [], runnerMappingChecked: true, runnerMappings: {}, runnerMappingRunActive: false };
function traceClientUiEvent(ev, f) { (globalThis.TRACES = globalThis.TRACES || []).push({ ev: ev, f: f }); }
function runnerMappingKnownFiles() { return [${JSON.stringify(FILE_A)}, ${JSON.stringify(FILE_B)}]; }
// 매핑 행 순서가 이 버그의 방아쇠였다 — '먼저 등장한 파일' 순서로 만들어진다.
// 여기서는 B 행이 앞, A 행이 뒤(= 예전 코드에서 A 가 이기던 배치)로 둔다.
var ROWS = [
  { req: { book: "B.xlsx", sheet: "요약" }, fileItem: ${JSON.stringify(FILE_B)}, sheet: "요약" },
  { req: { book: "A.xlsx", sheet: "원본" }, fileItem: ${JSON.stringify(FILE_A)}, sheet: "원본" },
];
function runnerBuildMappingRows() { return ROWS; }
`;

const mod = new Module("runner-map-e2e", module);
mod._compile(
  STUBS + "\n"
  + fn(dh, "runnerReplaceLiteral") + "\n"
  + fn(dh, "runnerDeclaredTargetBookName") + "\n"
  + fn(dh, "runnerSameBookName") + "\n"
  + winFn(dh, "buildRunnerMappedPipeline") + "\n"
  + `module.exports = { build: buildRunnerMappedPipeline, setRows(r) { ROWS = r; },
       traces() { return globalThis.TRACES || []; }, clearTraces() { globalThis.TRACES = []; },
       state: state };`,
  path.join(__dirname, "_extracted_runner_map_e2e.js"));
const T = mod.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 240) : "")); }
}

function skill() {
  return [
    { id: "s1", targetFileId: "input:B.xlsx", targetSheetName: "요약",
      description: "요약 시트 앞에 열 6개 삽입",
      code: 'def transform(ctx):\n    ctx.insert_cols("요약", "A", count=6)\n' },
    { id: "s2", targetFileId: "input:A.xlsx", targetSheetName: "원본",
      description: "원본으로 집계 피벗 만들기",
      code: 'def transform(ctx):\n    ctx.pivot("원본", group_by=["구분"], value="금액", agg="sum", dest_name="집계")\n' },
    { id: "s3", targetFileId: "input:B.xlsx", targetSheetName: "요약",
      description: "A.xlsx 의 집계를 요약에 붙여넣기",
      code: 'def transform(ctx):\n    ctx.copy("A.xlsx!집계", "A3:B3", "요약", "A1")\n' },
  ];
}

console.log("[1] 제보 스킬을 매핑에 그대로 통과시킨다");
{
  const out = T.build(skill());
  check("1단계는 B 유지", out[0].targetFileId === "f_B", out[0].targetFileId);
  check("2단계는 A 유지", out[1].targetFileId === "f_A", out[1].targetFileId);
  check("3단계가 B 를 지킨다  ← 예전엔 여기가 A 로 넘어갔다",
    out[2].targetFileId === "f_B", out[2].targetFileId);
  check("3단계 코드의 읽기 소스는 A 그대로", /A\.xlsx!집계/.test(out[2].code), out[2].code);
}

console.log("[2] 행 순서를 뒤집어도 결과가 같아야 한다 — '마지막 승'이 없어졌는가");
{
  T.setRows([
    { req: { book: "A.xlsx", sheet: "원본" }, fileItem: FILE_A, sheet: "원본" },
    { req: { book: "B.xlsx", sheet: "요약" }, fileItem: FILE_B, sheet: "요약" },
  ]);
  const out = T.build(skill());
  check("3단계는 여전히 B", out[2].targetFileId === "f_B", out[2].targetFileId);
  check("2단계는 여전히 A", out[1].targetFileId === "f_A", out[1].targetFileId);
}

console.log("[3] 다른 이름 파일로 재바인딩되는 경우(월 변경) — 선언 대상이 새 파일로 옮겨간다");
{
  const NEW_B = { id: "f_B2", name: "B_5월.xlsx" };
  T.setRows([
    { req: { book: "B.xlsx", sheet: "요약", aliases: ["B.xlsx"] }, fileItem: NEW_B, sheet: "요약" },
    { req: { book: "A.xlsx", sheet: "원본" }, fileItem: FILE_A, sheet: "원본" },
  ]);
  const out = T.build(skill());
  check("3단계 대상이 새 B 파일로 옮겨간다", out[2].targetFileId === "f_B2", out[2].targetFileId);
  check("1단계도 새 B 파일로", out[0].targetFileId === "f_B2", out[0].targetFileId);
  check("2단계는 A 그대로", out[1].targetFileId === "f_A", out[1].targetFileId);
}

console.log("[4] 대상을 안 밝힌 옛 스킬 — 텍스트로 찾되 모호하면 손대지 않는다");
{
  T.setRows([
    { req: { book: "B.xlsx", sheet: "요약" }, fileItem: FILE_B, sheet: "요약" },
    { req: { book: "A.xlsx", sheet: "원본" }, fileItem: FILE_A, sheet: "원본" },
  ]);
  T.clearTraces();
  const legacy = [{ id: "old1", code: 'def transform(ctx):\n    ctx.copy("A.xlsx!집계", "A1", "요약", "A1")\n' }];
  const out = T.build(legacy);
  check("한 파일만 걸리면 그 파일로 묶는다", out[0].targetFileId === "f_A", out[0].targetFileId);

  const ambiguous = [{ id: "old2",
    code: 'def transform(ctx):\n    ctx.copy("A.xlsx!집계", "A1", "요약", "A1")\n    ctx.book("B.xlsx").write("요약", 1, 1, [[1]])\n' }];
  T.clearTraces();
  const out2 = T.build(ambiguous);
  check("둘 다 걸리면 대상을 안 정한다(마지막 승 금지)", !out2[0].targetFileId, out2[0].targetFileId);
  check("모호했다는 사실이 로그에 남는다",
    T.traces().some(t => t.f && t.f.reason === "target.ambiguous"),
    JSON.stringify(T.traces().map(t => t.f && t.f.reason)));
}

console.log("[4c] 출력 템플릿 대상(output:N) — 슬롯이므로 이름으로 다시 묶지 않는다  ← VM 실측 건");
{
  // 실제 스킬 모양: target=output:0(이름 없음), 시트=Sheet1, 코드가 다른 파일을 '읽기'만 한다.
  // 예전엔 텍스트에 두 파일이 다 나와 모호 → 재바인딩 포기(target.ambiguous)였다.
  T.setRows([
    { req: { book: "B.xlsx", sheet: "Sheet1" }, fileItem: FILE_B, sheet: "Sheet1" },
    { req: { book: "A.xlsx", sheet: "원본" }, fileItem: FILE_A, sheet: "원본" },
  ]);
  T.clearTraces();
  const outStep = [{
    id: "o1", targetFileId: "output:0", targetSheetName: "Sheet1",
    description: "A.xlsx 의 원본 값을 대상 시트에 이름 매칭으로 채운다",
    code: ['def transform(ctx):', '    ctx.match_fill("A.xlsx!원본", "Sheet1", "구분")'].join("\n"),
  }];
  const out = T.build(outStep);
  // 코드가 언급하는 건 '읽기 소스'인 A 뿐이다. 예전 규칙(텍스트 매칭)이면 대상이 A 로 끌려가
  // 결과가 A 에 쓰인다 — 제보된 증상과 같은 부류. 슬롯은 그대로 둬야 맞는다.
  check("출력 슬롯을 소스 파일로 바꾸지 않는다", out[0].targetFileId === "output:0", out[0].targetFileId);
  check("시트도 건드리지 않는다", out[0].targetSheetName === "Sheet1", out[0].targetSheetName);
  check("모호 로그도 안 남긴다(판단할 게 없으니)",
    !T.traces().some(t => t.f && t.f.reason === "target.ambiguous"),
    JSON.stringify(T.traces().map(t => t.f && t.f.reason)));
  check("코드의 파일명 치환은 그대로 돈다", /A\.xlsx!원본/.test(out[0].code), out[0].code);
}
{
  // 시트로도 안 갈리면 예전처럼 손대지 않는다(엉뚱한 파일로 보내느니 그대로 두는 게 낫다).
  T.setRows([
    { req: { book: "B.xlsx", sheet: "공통" }, fileItem: FILE_B, sheet: "공통" },
    { req: { book: "A.xlsx", sheet: "공통" }, fileItem: FILE_A, sheet: "공통" },
  ]);
  T.clearTraces();
  const amb = [{ id: "o2", targetFileId: "output:0", targetSheetName: "공통",
    code: ['def transform(ctx):',
      '    ctx.copy("A.xlsx!공통", "A1", "공통", "A1")',
      '    ctx.book("B.xlsx").write("공통", 1, 1, [[1]])'].join("\n") }];
  const out2 = T.build(amb);
  check("두 파일을 다 언급해도 슬롯은 그대로", out2[0].targetFileId === "output:0", out2[0].targetFileId);
}

console.log("[5] 매핑이 꺼져 있으면 아무것도 안 건드린다(생성기 기본 상태)");
{
  T.state.runnerMappingChecked = false;
  const src = skill();
  const out = T.build(src);
  check("원본 그대로 돌려준다", out === src);
  T.state.runnerMappingChecked = true;
}

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
