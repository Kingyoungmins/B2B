// [사용자 제보 2026-08-10] AI 도움이 "A를 ~하기 위해 ~를 찾아보겠습니다" 라고 예고만 하고 멈춤.
//   "??" 라고 재촉해야 이어서 답함.
//
// 원인: 루프는 응답에 액션 블록이 없으면 final 로 강등해 그대로 종료한다(assist-core.js).
//   모델이 도구 블록 없이 예고문만 내면 그 예고문이 '마지막 답'이 되어 대화가 멈춘다.
// 수정: ① 프롬프트에 예고 금지 규칙 ② 루프가 '하다 만 예고'를 감지하면 종료하지 않고
//   같은 턴에서 즉시 실행을 요구(상한 2회).
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

const src = fs.readFileSync(path.join(ROOT, "scripts", "assist-core.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail ? "  → " + String(detail).slice(0, 160) : "")); }
}

// ── 감지 함수만 추출해 단위 테스트 ──────────────────────────────────────────
function sliceBalanced(s, i, open, close) {
  let d = 0;
  for (; i < s.length; i++) {
    if (s[i] === open) d++;
    else if (s[i] === close) { d--; if (d === 0) return i + 1; }
  }
  throw new Error("unbalanced");
}
const at = src.indexOf("function assistLooksLikeDanglingAnnouncement");
const fnSrc = src.slice(at, sliceBalanced(src, src.indexOf("{", at), "{", "}"));
const m = new Module("dangling-extracted", module);
m._compile(fnSrc + "\nmodule.exports = assistLooksLikeDanglingAnnouncement;", path.join(__dirname, "_extracted_dangling.js"));
const isDangling = m.exports;

console.log("[1] '하다 만 예고'를 잡는다  ← 제보한 그 패턴");
const DANGLING = [
  "실패 원인을 확인하기 위해 실행 기록을 찾아보겠습니다.",
  "왜 실패했는지 step.error 로 확인해 보겠습니다.",
  "3단계 코드를 먼저 살펴보겠습니다!",
  "해당 시트의 머리글을 조회해 보겠습니다…",
  "원인을 파악한 뒤 말씀드리겠습니다.",
  "지금부터 데이터를 분석해 볼게요.",
  "수정안을 만들어 드릴게요.",
];
for (const t of DANGLING) check(`예고 감지: "${t.slice(0, 30)}..."`, isDangling(t) === true, t);

console.log("[1b] 긴 분석 뒤의 예고도 잡는다  ← 2026-08-18 재발 제보('oo'/'?'로 재촉해야 이어짐)");
// 처음 수정(2026-08-10)은 전체 240자 이하만 잡았다. 실제 재발은 거의 다 '긴 설명 + 마지막 한 문장이
// 예고'라 감지망 밖이었다 — 이제 마지막 문장으로 판정하므로 길이와 무관하게 잡혀야 한다.
const LONG_HEAD = "3단계가 실패한 원인을 확인했습니다. 코드가 VIEW 시트의 H열을 참조하는데 실제 파일에는 "
  + "데이터가 4행부터 시작합니다. 이 때문에 머리글 행을 데이터로 읽으면서 숫자 변환 오류가 났습니다. "
  + "앞 단계가 열을 삽입하면서 위치가 한 칸 밀린 것도 영향을 줬습니다. ";
check("긴 분석 + '구조를 확인해 보겠습니다' 끝", isDangling(LONG_HEAD + "이제 실제 시트 구조를 확인해 보겠습니다.") === true);
check("긴 분석 + '고쳐 두겠습니다' 끝", isDangling(LONG_HEAD + "코드를 4행 시작으로 고쳐 두겠습니다.") === true);
check("긴 분석 + '필요하면 말씀드리겠습니다'는 맺음 인사 — 통과",
  isDangling(LONG_HEAD + "해결하려면 4행부터 읽도록 고쳐야 합니다. 추가로 필요하면 말씀드리겠습니다.") === false);
check("긴 분석 + 과거형 완결('제안했습니다')은 통과",
  isDangling(LONG_HEAD + "제가 위 카드의 수정을 제안했습니다. 버튼을 누르면 반영됩니다.") === false);

console.log("[2] 완결된 답변은 건드리지 않는다");
const FINAL_OK = [
  // 짧지만 예고가 아닌 답
  "3단계가 실패한 이유는 시트 이름이 바뀌었기 때문입니다. 파일확인에서 다시 연결해 주세요.",
  "네, 그 값은 1,234,567원이 맞습니다.",
  "그건 지금 확인할 수단이 없습니다. 대신 실행 기록으로 짐작해 볼 수는 있습니다.",
  // 긴 답변 끝의 맺음 인사(겠습니다로 끝나지만 완결) — 길이 조건으로 걸러진다
  "원인은 머리글이 2번째 줄에 있기 때문입니다. " + "이렇게 하시면 됩니다. ".repeat(20) + "언제든 도와드리겠습니다.",
  // 질문으로 끝나는 답
  "두 가지 방법이 있습니다. 어느 쪽으로 할까요?",
  "",
];
for (const t of FINAL_OK) check(`정상 통과: "${(t || "(빈 문자열)").slice(0, 30)}..."`, isDangling(t) === false, t.length);

console.log("[3] 루프 배선 — 감지되면 종료하지 않고 재촉한다");
check("final 경로에 가드가 있다", /assistLooksLikeDanglingAnnouncement\(finalText\)/.test(src));
check("재촉 상한 2회(무한루프 방지)", /danglingNudges < 2/.test(src) && /danglingNudges \+= 1/.test(src));
check("마지막 라운드에는 재촉하지 않음(예산 보호)", /!lastRound && danglingNudges/.test(src));
check("재촉 문구가 즉시 실행을 요구", /예고하지 말고 지금 바로/.test(src));
check("재촉 후 continue(종료 아님)", /danglingNudges \+= 1;[\s\S]{0,600}?continue;/.test(src));

console.log("[4] 프롬프트 — 예고 금지 규칙이 들어갔다");
check("예고로 끝내기 금지 규칙", /예고로 끝내기 금지/.test(src));
check("이유 설명(응답을 끝내면 대화가 멈춘다)", /대화는 거기서 멈춘다/.test(src));
check("규약 위반으로 명시", /"~하겠습니다"로 끝나는 final 응답은 규약 위반/.test(src));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
