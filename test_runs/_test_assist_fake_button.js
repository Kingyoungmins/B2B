// [지라 SBAGENT-248 / 2026-08-10] AI 도움이 "아래 버튼을 누르면…" 이라 안내하고
//   [새 단계 만들기 요청하기] 라는 대괄호 글자까지 썼는데, 정작 action="handoff" 블록을
//   안 내서 버튼이 화면에 안 생겼다 — 사업팀이 없는 버튼을 찾아 헤맴.
//
// 방향 ②(사용자 선택): 그런 안내를 할 상황이면 실제 버튼(카드)이 확실히 뜨게 한다.
//   ① 프롬프트 — "절차를 설명하지 말고 그냥 넘겨라, 대괄호 글자는 버튼이 되지 않는다"
//   ② 루프 가드 — 가짜 버튼 서술을 감지하면 종료하지 않고 handoff 블록 출력을 강제
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

const src = fs.readFileSync(path.join(ROOT, "scripts", "assist-core.js"), "utf8").replace(/^﻿/, "");
const at = src.indexOf("function assistLooksLikeFakeButtonNarration");
const fn = src.slice(at, sliceBalanced(src, src.indexOf("{", at), "{", "}"));
const m = new Module("fakebtn-extracted", module);
m._compile(fn + "\nmodule.exports = assistLooksLikeFakeButtonNarration;", path.join(__dirname, "_extracted_fakebtn.js"));
const isFake = m.exports;

console.log("[1] 가짜 버튼 서술을 잡는다  ← 지라 스크린샷 그 문장");
const SHOT = "이 작업은 새로운 단계를 만들어야 해요.\n\n"
  + "이렇게 해 주세요:\n"
  + "1. 아래 버튼을 누르면, 스킬 설계 채팅으로 넘어가서 새 단계를 만들 수 있어요.\n"
  + "2. 저는 자동으로 요청할게요.\n\n"
  + "[새 단계 만들기 요청하기]";
check("지라 스크린샷 문장", isFake(SHOT) === true);
check("'아래 버튼을 누르면'만 있어도", isFake("아래 버튼을 누르면 설계 채팅으로 넘어갑니다.") === true);
check("대괄호 라벨이 한 줄을 차지하면", isFake("새 단계가 필요합니다.\n[설계 채팅으로 넘기기]") === true);
check("'다음 버튼을 클릭'도", isFake("다음 버튼을 클릭해 주세요.") === true);

console.log("[2] 실제 앱 버튼 안내는 건드리지 않는다  ← 결론 의무와 충돌 금지");
check("오류 카드 [에러 복구 시도] 인라인 안내는 통과",
  isFake('오류 창 메모칸에 이 문장을 넣고 [에러 복구 시도]를 누르세요: "머리글이 2번째 줄에 있어요."') === false);
check("스위치 켜기 안내는 통과", isFake("3단계 스위치를 켜(ON) 주시면 새 코드로 적용됩니다.") === false);
check("[🔄 새로고침] 버튼 위치 안내는 통과",
  isFake("화면 맨 위 [🔄 새로고침] 버튼을 누르면 파일과 스킬을 유지한 채 다시 시작합니다.") === false);
check("평범한 답변은 통과", isFake("원인은 시트 이름이 바뀌었기 때문입니다.") === false);
check("빈 문자열", isFake("") === false);

console.log("[3] 루프 배선 — 감지되면 handoff 를 강제");
check("final 경로에 가드", /assistLooksLikeFakeButtonNarration\(finalText\)/.test(src));
check("재촉 문구가 handoff 블록을 지목", /지금 즉시 action=\\"handoff\\" 블록을 출력하세요/.test(src));
check("대괄호 글자는 버튼이 아니라고 알림", /대괄호 글자는 버튼이 되지 않습니다/.test(src));
check("상한 공유(무한루프 방지)", /danglingNudges < 2 && assistLooksLikeFakeButtonNarration/.test(src));

console.log("[4] 프롬프트 — 절차 설명 대신 즉시 handoff");
check("'절차를 설명하지 말고 그냥 넘겨라'", /절차를 설명하지 말고 그냥 넘겨라/.test(src));
check("대괄호 글자 금지 + 이유(지라 실측)", /대괄호 글자는 버튼이 되지 않는다\(지라 실측/.test(src));
check("블록을 출력해야만 버튼이 생김을 명시", /action="handoff" 블록을 출력해야만 생기/.test(src));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
