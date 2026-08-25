// [SBAGENT-293 실측 2026-08-25] 전체실행을 눌러 8분을 기다린 끝에 "그 열이 없다"로 실패했고,
// 같은 실수가 30·34단계 두 곳에 있어 하나를 고쳐도 또 8분을 버렸다(실물 실험으로 확인:
// 매핑을 바로잡으면 33/36까지 가고 34단계에서 '기본요금'으로 실패).
// → 전체실행 '전에' 모든 단계를 실제 헤더와 대조해 한 번에 알려준다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const pjs = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const cu = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8").replace(/^﻿/, "");
const at = fs.readFileSync(path.join(ROOT, "scripts", "assist-tools.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}
function fnOf(src, name) {
  const i = src.indexOf("function " + name);
  if (i < 0) throw new Error("함수 못 찾음: " + name);
  const nx = src.indexOf("\nfunction ", i + 1);
  const body = src.slice(i, nx < 0 ? src.length : nx);
  return body.slice(0, body.lastIndexOf("\n}") + 2);
}

// 실측 파일의 실제 헤더(도서 DAS Sheet1) — '기본료'는 있고 '기본요금'은 없다.
const REAL = ["청구수령인명", "청구계정번호", "가입번호", "효력발생일자", "기본료", "부가가치세"];
const mkState = () => ({
  inputs: [{ name: "도서.xlsx", sheets: { Sheet1: [REAL, ["a", "b", "c", "20260601", 1000, 100]] } }],
  outputTemplates: [],
});
const api = state => new Function("state",
  fnOf(cu, "headerNameMismatchFailures") + "\n" + fnOf(pjs, "pipelineHeaderMismatchReport")
  + "\nreturn pipelineHeaderMismatchReport;")(state);

console.log("[1] 실측 구도 — 30·34단계를 한 번에 보고한다");
{
  const report = api(mkState())([
    { id: "s29", code: 'def transform(ctx):\n    ctx.sort("Sheet1", "A1:S10", key_col="효력발생일자")' },
    { id: "s30", code: 'def transform(ctx):\n    sheet = "Sheet1"\n    c = ctx.find_header(sheet, "기본요금", header_row=1)' },
    { id: "s31", code: 'def transform(ctx):\n    c = ctx.find_header("Sheet1", "기본료")' },
    { id: "s34", code: 'def transform(ctx):\n    c = ctx.find_header("Sheet1", "기본요금", header_row=1)' },
  ]);
  check("두 단계 모두 보고(하나씩 8분 반복 방지)", report.length === 2, JSON.stringify(report.map(r => r.stepNo)));
  check("단계 번호가 정확", report[0].stepNo === 2 && report[1].stepNo === 4, JSON.stringify(report.map(r => r.stepNo)));
  check("실제 이름을 알려준다", report.every(r => r.message.includes("기본료")), JSON.stringify(report[0]));
  check("정상 단계는 보고 안 함", !report.some(r => r.stepNo === 3));
}
console.log("[2] 오탐 가드");
{
  const st = mkState();
  check("앞 단계가 만드는 시트는 통과",
    api(st)([{ id: "a", code: 'def transform(ctx):\n    c = ctx.find_header("무선간선망", "기본요금")' }]).length === 0);
  check("비활성(OFF) 단계는 검사 안 함",
    api(st)([{ id: "a", enabled: false, code: 'def transform(ctx):\n    c = ctx.find_header("Sheet1", "기본요금")' }]).length === 0);
  check("코드 없는 단계 무시", api(st)([{ id: "a", code: "" }]).length === 0);
  check("업로드 파일 없으면 통과",
    api({ inputs: [], outputTemplates: [] })([{ id: "a", code: 'def transform(ctx):\n    c = ctx.find_header("Sheet1", "기본요금")' }]).length === 0);
}
console.log("[3] 배선 — 실행 전 게이트와 AI 도구 양쪽에 연결");
check("전체실행 버튼이 실행 전 검사를 돈다", /pipelineHeaderMismatchReport\(_mapped\)/.test(pjs));
check("매핑본(실제 파일명 치환본)으로 검사", /buildRunnerMappedPipeline\(state\.pipeline\)[\s\S]{0,120}pipelineHeaderMismatchReport/.test(pjs));
check("문제가 있으면 실행하지 않는다", /showRunnerPreflightNotice\(_report\);[\s\S]{0,200}return;/.test(pjs));
check("실행 전 안내는 실패 패널과 구분된다", /function showRunnerPreflightNotice/.test(pjs)
  && /실행 전 확인 — 지금 실행하면 그 단계에서 실패합니다/.test(pjs));
check("계측을 남긴다", /runner\.preflight\.header_mismatch/.test(pjs));
check("AI 의 preflight.check 도 같은 판정을 본다", /header_not_found/.test(at)
  && /pipelineHeaderMismatchReport\(steps\)/.test(at));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
