// [사용자 제보 2026-08-20] "AI 도움이 결과를 끝까지 못 내고, 내가 중간에 개입해서 말해야 동작함.
//                          그리고 오류 원인도 제대로 파악 못하는 경우가 많음."
//
// 원인 (코드에서 확인)
//   (A) 막다른 길이 세 군데 있었다. 라운드/시간/도구 한도에 걸리면 도구로 최대 7번 조사해
//       모아 둔 근거를 통째로 버리고 "질문을 좁혀 다시 물어봐 주세요"로 끝냈다.
//       사용자 입장에선 '개입해야 동작하는' 게 맞다 — 다시 물어봐야 이어지니까.
//   (B) '적용됐다는데 값이 안 보인다'는 제보는 step.error 로 잡히지 않는다(실패 기록이 없다).
//       그런데 프롬프트에 그 경우의 진단 순서가 없어, 모델이 "기록 없음 = 문제없음"으로 읽고
//       헛돌았다.
//
// 수정: (A) 한도에 걸리면 도구 없이 한 번 더 불러 '지금까지 알아낸 것으로' 답을 맺게 한다.
//       (B) '적용됐다는데 값이 안 보인다' 전용 진단 순서를 프롬프트에 넣는다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const ac = fs.readFileSync(path.join(ROOT, "scripts", "assist-core.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[A] 한도에 걸려도 답을 맺는다 — '개입해야 동작함' 제거");
check("마무리 함수가 있다", /async function assistCloseOut\(\)/.test(ac));
check("도구를 더 못 쓴다고 못박는다", /\*\*도구는 더 쓸 수 없다\.\*\*/.test(ac));
check("'다시 물어봐 달라'로 떠넘기지 말라고 지시", /'다시 물어봐 달라'로 사용자에게 떠넘기지 마라/.test(ac));
check("못 본 부분은 솔직히 밝히게 한다", /여기까지는 확인했고 이건 못 봤다/.test(ac));

console.log("[A-2] 세 갈래 모두 마무리를 거친다");
check("라운드/예산 소진 경로", /if \(await assistCloseOut\(\)\) return;\s*\n\s*assistPushAssistant\("확인을 마치지 못했습니다/.test(ac));
check("한도인데 또 도구를 부른 경로 — 예고문은 최종 답으로 밀어내지 않고 마무리로 보낸다",
  /if \(visible && !assistLooksLikeDanglingAnnouncement\(visible\)\) \{ assistPushAssistant\(visible, ui\); return; \}\s*\n\s*if \(await assistCloseOut\(\)\) return;/.test(ac));
check("마무리도 실패하면 예고문이라도 남긴다(정보 유실 방지)",
  /if \(await assistCloseOut\(\)\) return;\s*\n\s*if \(visible\) \{ assistPushAssistant\(visible, ui\); return; \}\s*\n\s*assistPushAssistant\("확인 한도에 걸려/.test(ac));
check("예산 초과 break 는 루프 뒤 마무리로 떨어진다(별도 종료 아님)",
  /say\("시간이 오래 걸려 여기서 정리합니다\."\);\s*\n\s*break;/.test(ac));

console.log("[A-3] 마무리가 낸 결과를 실제로 쓴다 — 본 루프 응답 가드와 대칭");
check("본문이 있으면 말풍선으로 남긴다", /if \(body\) \{ assistPushAssistant\(body, ui\); return true; \}/.test(ac));
check("설계 채팅 넘김(handoff) — request 형태를 살린다",
  /else if \(req\) \{ ui\.onHandoff && ui\.onHandoff\(\{ request: req, reason: rsn \}\); \}/.test(ac));
check("설계 채팅 넘김(handoff) — steps(단계별) 형태도 살린다",
  /if \(steps && steps\.length\) \{ ui\.onHandoff && ui\.onHandoff\(\{ steps, reason: rsn \}\); \}/.test(ac));
check("마무리가 또 도구를 부르면 1회 교정 후에도 도구면 답으로 안 친다(무한 반복 방지)",
  /if \(cp\.action === "tool"\) return false;/.test(ac));
check("답을 args 에 담아 온 흔한 위반(R9)을 마무리에서도 건진다",
  /if \(!body && cp\.parsed && cp\.args\) \{[\s\S]{0,240}cp\.args\.text \|\| cp\.args\.answer \|\| cp\.args\.content \|\| cp\.args\.message/.test(ac));
check("절단된 액션 펜스의 원시 JSON 을 마무리에서도 걷어낸다(항목6)",
  /if \(!cp\.parsed && !cp\.block\) \{[\s\S]{0,300}ASSIST_FENCE/.test(ac));
check("사용자 중지/워치독 중단을 '질문을 좁혀 달라'로 오보하지 않는다",
  /if \(signal && signal\.aborted\) \{[\s\S]{0,400}"중단했습니다\.", ui\);\s*\n\s*return true;/.test(ac));
check("제보(report) 카드도 마무리에서 살린다", /if \(cp\.action === "report" \|\| cp\.action === "escalate"\) \{[\s\S]{0,500}ui\.onReport && ui\.onReport/.test(ac));
check("수정 제안(propose) 카드도 마무리에서 살린다", /if \(cp\.action === "propose"\) \{[\s\S]{0,700}ui\.onProposal && ui\.onProposal/.test(ac));
check("중국어 혼입 재요청도 마무리에 적용", /if \(assistHasChineseLeak\(closing\)\)/.test(ac));
check("마무리 실패 시에는 예전 안내로 떨어진다", /마무리 실패 → 호출자가 예전 안내로/.test(ac));

console.log("[B] '적용됐다는데 값이 안 보인다' 진단 순서");
check("전용 절이 있다", /## '적용됐다는데 값이 안 보인다' — 이때의 진단 순서/.test(ac));
check("step.error 로는 안 잡힌다는 함정을 알려 준다",
  /step\.error 로는 절대 안 잡힌다/.test(ac) && /'문제없음'으로 읽으면 진단이 통째로 헛돈다/.test(ac));
check("① 같은 열을 건드리는 단계들을 먼저 본다", /pipeline\.list 로 \*\*어느 단계들이 같은 열\/범위를 건드리는지\*\*/.test(ac));
check("② 설명 말고 코드 원문을 본다", /설명을 근거로 삼지 말고 코드를 봐라/.test(ac));
check("③ 실제 값을 확인한다", /data\.read 로 \*\*그 열의 실제 값\*\*/.test(ac));
check("④ 읽기 여부는 run.trace 가 아니라 코드 원문으로 판단(트레이스엔 읽기 이벤트가 없다 — 오진 방지)",
  /run\.trace 가 아니라 \*\*② 의 코드 원문\*\*으로 판단한다/.test(ac)
  && /읽기\s*\n?\s*이벤트가 아예 안 남으므로/.test(ac)
  && /부분 갱신 코드에 대상 열 read 가 없으면 보존이 불가능하므로 그때 원인으로 확정한다/.test(ac));
check("'다시 실행해 보세요'로 끝내지 말라고 한다", /"다시 실행해 보세요"로 끝내지 마라/.test(ac));

console.log("[C] 기존 안전장치는 그대로");
check("도구 상한 유지", /ASSIST_MAX_TOOL_CALLS = 7/.test(ac));
check("라운드 상한 유지", /ASSIST_MAX_ROUNDS = 8/.test(ac));
check("예고 감지 재촉 유지", /assistLooksLikeDanglingAnnouncement\(finalText\)/.test(ac));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
