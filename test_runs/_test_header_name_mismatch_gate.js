// [SBAGENT-293 30단계 실측 2026-08-25] 사용자가 요청문에 "기본요금"이라 썼고 코드도 그대로
// find_header(…, "기본요금") 으로 저장됐는데, 그 파일의 실제 헤더는 "기본료"였다. 만들 때
// 실제 헤더와 대조하는 검사가 없어 통과했고, 전체실행에서 30단계가 죽었다(같은 스킬 27단계는
// "기본료"를 쓰고 있어 스킬 안에서도 이름이 갈렸다).
// → 적용 전에 실제 헤더와 대조해 잡고, 실제 이름 후보를 알려 재생성으로 보낸다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const cu = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}
// 컬럼 0 'function ' 경계 추출(중괄호 카운팅은 함수 안 정규식의 '}' 에 속는다)
const at = cu.indexOf("function headerNameMismatchFailures");
const nx = cu.indexOf("\nfunction ", at + 1);
let body = cu.slice(at, nx < 0 ? cu.length : nx);
body = body.slice(0, body.lastIndexOf("\n}") + 2);
const mk = state => new Function("state", body + "\nreturn headerNameMismatchFailures;")(state);

// 실측 파일 구조: 도서 DAS 파일 Sheet1 의 헤더(1행)
const REAL_HEADERS = ["청구수령인명", "청구계정번호", "가입번호", "가입상태", "가입상태변경사유",
  "요금상품", "개통희망일자", "최초개통일자", "해지일자", "상위국 상호명", "하위국 상호명",
  "상위국주소", "하위국주소", "효력발생일자", "코아규격", "특기사항", "청구년월(상세)", "기본료", "부가가치세"];
const stateWith = rows => ({
  inputs: [{ name: "01. 한전_DAS도서_배전자동화_청구세부내역.xlsx", sheets: { Sheet1: rows } }],
  outputTemplates: [],
});
const ST = stateWith([REAL_HEADERS, ["한국전력 인천본부", "250000001530", "530041482225"]]);

console.log("[1] 실측 케이스 — 없는 헤더 이름을 잡고 실제 이름을 알려준다");
{
  const fn = mk(ST);
  const bad = [
    'def transform(ctx):',
    '    b = ctx.book("01. 한전_DAS도서_배전자동화_청구세부내역.xlsx")',
    '    sheet = "Sheet1"',
    '    col_idx = b.find_header(sheet, "기본요금", header_row=1)',
  ].join("\n");
  const f = fn(bad, "…의 기본요금 열 맨 마지막에 합계를…");
  check("'기본요금' 없음을 잡는다  ← 실측 실패 케이스", f.length === 1, JSON.stringify(f));
  check("실제 이름 '기본료' 를 알려준다", f[0] && f[0].includes("기본료"), f[0]);
  check("기능을 빼지 말라고 안내한다", f[0] && f[0].includes("하려던 일은 그대로"), f[0]);
}
console.log("[2] 정상 코드는 통과");
{
  const fn = mk(ST);
  const good = 'def transform(ctx):\n    sheet = "Sheet1"\n    c = ctx.find_header(sheet, "기본료", header_row=1)';
  check("실제 헤더면 통과", fn(good, "").length === 0, JSON.stringify(fn(good, "")));
  const direct = 'def transform(ctx):\n    c = ctx.find_header("Sheet1", "효력발생일자")';
  check("시트를 리터럴로 줘도 통과", fn(direct, "").length === 0);
  check("find_header 가 없으면 검사 안 함", fn('def transform(ctx):\n    ctx.write("Sheet1","A1",[[1]])', "").length === 0);
}
console.log("[3] 오탐 가드");
{
  const fn = mk(ST);
  const unknownSheet = 'def transform(ctx):\n    c = ctx.find_header("무선간선망", "기본요금")';
  check("앞 단계가 만드는 시트(업로드본에 없음)는 통과", fn(unknownSheet, "").length === 0, JSON.stringify(fn(unknownSheet, "")));
  const noSimilar = 'def transform(ctx):\n    c = ctx.find_header("Sheet1", "전혀다른열이름")';
  check("비슷한 후보가 없으면 통과(헤더를 새로 쓰는 스킬 보호)", fn(noSimilar, "").length === 0, JSON.stringify(fn(noSimilar, "")));
  const emptyState = mk({ inputs: [], outputTemplates: [] });
  check("업로드 파일이 없으면 통과", emptyState('c = ctx.find_header("Sheet1", "기본요금")', "").length === 0);
  const noRows = mk(stateWith([]));
  check("시트를 못 읽으면 통과", noRows('c = ctx.find_header("Sheet1", "기본요금")', "").length === 0);
}
console.log("[4] 게이트 배선");
check("commonFailures 에 연결", /headerNameMismatchFailures\(code, sourceUserMessage\)/.test(cu));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
