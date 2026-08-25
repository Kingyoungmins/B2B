// [제보 2026-08-25] "j1 셀은 전산화번호, k1셀은 전주번호 입력" → 모델이 자꾸 '전자화번호'로
// 코딩(한 글자 오타 복사). 사용자 문장 토큰과 한 글자(한글) 차이 리터럴을 적용 전에 잡는다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const cu = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
// 컬럼 0 'function ' 경계 추출(중괄호 카운팅은 정규식 '}' 에 속는다 — 기존 테스트와 동일 방식)
const at = cu.indexOf("function hangulLiteralTypoFailures");
const nx = cu.indexOf("\nfunction ", at + 1);
let body = cu.slice(at, nx < 0 ? cu.length : nx);
body = body.slice(0, body.lastIndexOf("\n}") + 2);
const fn = new Function(body + "\nreturn hangulLiteralTypoFailures;")();

const src = "j1 셀은 전산화번호, k1셀은 전주번호 입력";
console.log("[1] 실측 케이스");
{
  const f = fn('def transform(ctx):\n    ctx.write_cell("VIEW", "J1", "전자화번호")\n    ctx.write_cell("VIEW", "K1", "전주번호")', src);
  check("전자화번호(한 글자 오타) 잡힘", f.length === 1 && f[0].includes("전산화번호") && f[0].includes("전자화번호"), JSON.stringify(f));
  const ok = fn('def transform(ctx):\n    ctx.write_cell("VIEW", "J1", "전산화번호")\n    ctx.write_cell("VIEW", "K1", "전주번호")', src);
  check("올바른 표기는 통과", ok.length === 0, JSON.stringify(ok));
}
console.log("[2] 오탐 가드");
{
  check("숫자 차이(연도/월)는 통과 — 26년7월 vs 26년8월",
    fn('ctx.copy("26년8월_raw", "A1:B2", "요약", "A1")', "26년7월_raw 시트처럼 새 달 시트를 만들어줘").length === 0);
  check("사용자가 두 표기 모두 쓴 경우 통과",
    fn('x = "전자화번호"', "전산화번호와 전자화번호 열이 둘 다 있어").length === 0);
  check("올바른 표기가 코드에 함께 있으면 통과(실재 유사 열 가능)",
    fn('a = "전산화번호"\nb = "전자화번호"', src).length === 0);
  check("관련 없는 리터럴은 통과",
    fn('ctx.write_cell("VIEW", "A1", "합계금액")', src).length === 0);
  check("길이 2 차이는 통과",
    fn('x = "전산화"', src).length === 0);
}
console.log("[3] 게이트 배선");
check("commonFailures 에 연결", /hangulLiteralTypoFailures\(code, sourceUserMessage\)/.test(cu));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
