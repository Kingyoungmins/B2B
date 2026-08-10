// [지라 제보 2026-08-10] AI 도움 답변에 **별표**가 글자 그대로 보임(사업팀 스크린샷).
//   모델이 마크다운 굵게(**...**)를 섞어 보내는데 화면은 마크다운을 렌더링하지 않는다.
// 수정: ① 프롬프트(PLAIN_LANGUAGE_RULE)에 마크다운 금지 ② 렌더러가 새는 **…** 만 굵게 변환
//   (이스케이프 먼저 — 셀 값에 든 HTML 이 실행되지 않게).
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail ? "  → " + String(detail).slice(0, 160) : "")); }
}

function sliceBalanced(s, i, open, close) {
  let d = 0;
  for (; i < s.length; i++) {
    if (s[i] === open) d++;
    else if (s[i] === close) { d--; if (d === 0) return i + 1; }
  }
  throw new Error("unbalanced");
}

const uiSrc = fs.readFileSync(path.join(ROOT, "scripts", "assist-ui.js"), "utf8").replace(/^﻿/, "");
const popupSrc = fs.readFileSync(path.join(ROOT, "scripts", "assist-popup.js"), "utf8").replace(/^﻿/, "");
const schemaSrc = fs.readFileSync(path.join(ROOT, "scripts", "file-schema.js"), "utf8").replace(/^﻿/, "");

// 렌더러 추출 실행
const at = uiSrc.indexOf("function assistRenderPlainText");
const fn = uiSrc.slice(at, sliceBalanced(uiSrc, uiSrc.indexOf("{", at), "{", "}"));
const m = new Module("mdplain-extracted", module);
m._compile(fn + "\nmodule.exports = assistRenderPlainText;", path.join(__dirname, "_extracted_mdplain.js"));
const render = m.exports;

console.log("[1] 별표 굵게가 진짜 굵게로 보인다  ← 제보한 그 화면");
check("**단어** → <b>단어</b>",
  render("2. 저는 **새 단계를 만드는 요청문**을 만들어 드릴게요.")
  === "2. 저는 <b>새 단계를 만드는 요청문</b>을 만들어 드릴게요.");
check("한 줄에 여러 개도 전부", render("**참고:** 그리고 **이렇게 해 주세요:**")
  === "<b>참고:</b> 그리고 <b>이렇게 해 주세요:</b>");
check("줄바꿈을 건너 짝지어지진 않음", render("별표 두 개 ** 여기\n저기 ** 끝").includes("**"));
check("굵게가 없으면 그대로", render("평범한 문장입니다.") === "평범한 문장입니다.");

console.log("[2] 보안 — 셀 값/코드의 HTML 이 실행되지 않는다");
check("< > 이스케이프", render("<script>alert(1)</script>") === "&lt;script&gt;alert(1)&lt;/script&gt;");
check("굵게 안 내용도 이스케이프", render("**<b>주입</b>**") === "<b>&lt;b&gt;주입&lt;/b&gt;</b>");
check("따옴표 이스케이프", render('a"b\'c') === "a&quot;b&#39;c");

console.log("[3] 두 화면 모두에 적용(메인 팝업 + 네이티브 창)");
check("assist-ui: 렌더러를 실제로 사용", /div\.innerHTML = assistRenderPlainText\(text\)/.test(uiSrc));
check("assist-ui: textContent 직접 대입은 제거", !/else div\.textContent = text;/.test(uiSrc));
check("assist-popup: 같은 변환 적용", /esc\(text\)\.replace\(\/\\\*\\\*/.test(popupSrc));
check("assist-popup: textContent 직접 대입은 제거", !/else div\.textContent = text;/.test(popupSrc));

console.log("[4] 프롬프트 — 애초에 마크다운을 쓰지 말라고 지시");
check("PLAIN_LANGUAGE_RULE 에 마크다운 금지", /마크다운 문법을 쓰지 마세요/.test(schemaSrc));
check("이유(별표가 그대로 보임)를 설명", /별표가 글자 그대로 보입니다/.test(schemaSrc));
check("대안 제시(따옴표/줄나눔)", /따옴표\('이렇게'\)나 줄을 나눠서/.test(schemaSrc));
check("번호 목록은 허용(과잉 금지 방지)", /번호 목록\(1\. 2\. 3\.\)은 괜찮습니다/.test(schemaSrc));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
