// [사용자 지시 2026-08-27] "스킬을 만들어 달라"가 아니라 "파일을 봐 달라"는 질문은 AI 도움으로 연결.
//
// 계기: "C열과 V열에 같은 번호가 있는지 확인해주세요" 라고 물었는데 생성기 채팅이 그걸 스킬(파일을
// 고치는 작업)로 만들려 했다. 사용자가 원한 건 답이지 작업이 아니다. AI 도움은 파일을 직접 열어
// 확인하고 답할 수 있으므로 그쪽으로 넘긴다.
//
// 이 테스트가 지키는 것 — 실수의 방향이 중요하다.
//   · 작업 요청을 질문으로 잘못 봐서 막으면 → 사용자가 일을 못 한다(가장 나쁨). 절대 없어야 한다.
//   · 질문을 작업으로 잘못 봐도 → 지금까지의 동작 그대로(견딜 만함).
//   그래서 값싼 사전검사는 '작업으로 보이면 무조건 통과'가 기본이고, 최종 판단만 LLM 이 한다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8").replace(/^﻿/, "");
const NL = String.fromCharCode(10);

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
function fnOf(src, name) {
  const i = src.indexOf("function " + name);
  if (i < 0) throw new Error("함수 못 찾음: " + name);
  // 다음 최상위 선언은 function 일 수도 async function 일 수도 있다 —
  // 한쪽만 보면 슬라이스가 뒤엉켜 엉뚱한 코드까지 딸려 온다(실제로 겪음).
  const ends = [NL + "function ", NL + "async function ", NL + "/* ", NL + "// ──"]
    .map(m => src.indexOf(m, i + 1)).filter(x => x > 0);
  const nx = ends.length ? Math.min.apply(null, ends) : -1;
  const body = src.slice(i, nx < 0 ? src.length : nx);
  return body.slice(0, body.lastIndexOf(NL + "}") + 2);
}

const maybeQ = new Function(fnOf(SRC, "chatMaybeQuestionNotSkill") + NL + "return chatMaybeQuestionNotSkill;")();

console.log("[1] 작업 요청은 절대 붙잡지 않는다 (사전검사에서 통과)");
[
  "중복 지워줘",
  "C열 합계 넣어줘",
  "가입번호 기준으로 정렬해줘",
  "정지회선만 새 시트로 뽑아줘",
  "V열을 C열 옆으로 옮겨줘",
  "12자리 번호만 남기고 나머지 삭제해줘",
  "합계 행 추가해주세요",
  "@범위[회선 현황!C1:C100] 에서 중복 있는지 확인해주세요",   // 대상을 콕 집었으면 작업으로 본다
].forEach(t => check("작업으로 통과: " + t, maybeQ(t) === false, maybeQ(t)));

console.log("[2] 확인만 하면 되는 질문은 LLM 판단으로 넘긴다");
[
  "C열과 V열에 같은 번호가 있는지 확인해주세요",
  "중복 있나요?",
  "정지회선이 몇 건이에요?",
  "이 시트에 뭐가 들어있어?",
  "두 파일 차이 알려줘",
].forEach(t => check("판단 대상: " + t, maybeQ(t) === true, maybeQ(t)));

console.log("[3] 사전검사는 '결정자'가 아니다 — 길거나 대상이 명시되면 손대지 않는다");
check("긴 사양서는 작업", maybeQ("가".repeat(401) + " 있는지 확인해주세요") === false);
check("빈 입력은 대상 아님", maybeQ("") === false);

console.log("[5] 넘길 때의 동작 — AI 도움을 열고, 되돌릴 길을 남긴다");
const send = SRC.slice(SRC.indexOf("async function sendChat"));
check("AI 도움을 연다", /assistOpenAndAsk\(rawMsg\)/.test(send));
check("무슨 일이 일어났는지 화면에 말해 준다", /AI 도움<\/b>으로 넘겼습니다/.test(send));
check("'그래도 스킬로 만들기' 버튼을 준다", /그래도 스킬로 만들기/.test(send));
check("그 버튼은 판정을 한 번만 건너뛴다", /__b2bForceSkillOnce = true/.test(send));
check("건너뛰기 표식을 반드시 되돌린다(다음 질문은 다시 판정)",
  /window\.__b2bForceSkillOnce = false;/.test(send));
check("전송 락을 풀고 끝낸다(입력이 막히지 않게)",
  /assistOpenAndAsk\(rawMsg\)[\s\S]{0,200}__b2bChatInFlight = false;[\s\S]{0,40}return;/.test(send));

console.log("[6] 기존 흐름을 끊지 않는다");
check("수정 모드에서는 넘기지 않는다", /!editTargetId && !clarifyPending && !window\.__b2bForceSkillOnce/.test(send));
check("되묻기(clarify) 답변 중에도 넘기지 않는다", /!clarifyPending/.test(send));
check("판정은 되묻기보다 먼저 한다(스킬이 아닌 걸 되묻지 않게)",
  send.indexOf("chatMaybeQuestionNotSkill(rawMsg)") < send.indexOf("clarifyVerifierAskIfNeeded"));

console.log("[4] 최종 판단기 — 실제로 돌려서 확인(문자열 매칭 아님)");
const clsSrc = SRC.slice(SRC.indexOf("async function chatClassifyQuestionVsSkill"),
                         SRC.indexOf("async function sendChat"));
const TAIL = NL + "return chatClassifyQuestionVsSkill;";
function make(llm) {
  return new Function("callLLMOneShot", "OUTPUT_LANGUAGE_RULE", "buildSheetStructureDigest",
    "_clarifyResolveSheet", "_clarifyGetAoa", clsSrc + TAIL)(
      llm, "", () => ({ text: "A열 가입번호 / C열 금액" }), () => "회선 현황", () => [[1]]);
}
const seen = {};
async function run(reply, msg) {
  const fn = make(async (sys, user) => { seen.sys = sys; seen.user = user; return reply; });
  return await fn(msg || "중복 있나요?");
}

(async () => {
  check("LLM 이 QUESTION 이면 질문", (await run("QUESTION")) === "question");
  check("앞뒤 공백/줄바꿈이 있어도 인식", (await run("  QUESTION" + NL)) === "question");
  check("SKILL 이면 작업", (await run("SKILL")) === "skill");
  check("엉뚱한 답이면 작업(안전한 쪽)", (await run("글쎄요 아마도 질문 같습니다")) === "skill");
  check("빈 답이면 작업", (await run("")) === "skill");
  check("'QUESTION' 이 문장 속에만 있으면 작업(딱 그 단어로 시작할 때만)",
    (await run("이건 QUESTION 으로 보입니다")) === "skill");

  // LLM 이 죽어도 사용자를 막지 않는다
  const boom = make(async () => { throw new Error("네트워크 끊김"); });
  check("LLM 호출이 실패해도 작업으로 진행", (await boom("중복 있나요?")) === "skill");
  const none = new Function("callLLMOneShot", clsSrc + TAIL)(undefined);
  check("LLM 자체가 없으면 작업", (await none("중복 있나요?")) === "skill");

  // 판단 근거로 시트 구조를 넘긴다(요청 단어만 보고 판단하지 않게)
  await run("QUESTION");
  check("프롬프트에 시트 구조가 실린다", /대상 시트 구조/.test(seen.sys || ""), seen.sys);
  check("프롬프트가 '애매하면 SKILL' 을 못박는다", /애매하면 SKILL 을 고르세요/.test(seen.sys || ""));
  check("토큰을 아낀다(한 단어만 받으면 된다)", /maxTokens: 8/.test(clsSrc));

  console.log("");
  console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
  process.exit(fails === 0 ? 0 : 1);
})();
