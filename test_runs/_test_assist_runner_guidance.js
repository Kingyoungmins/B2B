// [SBAGENT-293 실측 2026-08-25] AI 도움이 수정을 반영한 뒤 "스위치를 켜(ON) 주세요"라고 안내했는데,
// 실행기에서 그대로 하면 라이브 적용 서명이 없어(파일출력 모드) 리셋+전체 재적용으로 떨어진다
// — 30단계 하나 고치고 8분 22초(17:03:01~17:11:24)를 썼다. 실행기에서는 [전체실행]이 정답이고
// 그 경로엔 스냅샷 이어실행이 있다(_test_pipeline_resume_snapshot.py 로 실증).
// 또 30단계만 고치고 34단계의 같은 실수를 놓쳐 8분을 한 번 더 버렸다 → 일괄 수정 유도.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const core = fs.readFileSync(path.join(ROOT, "scripts", "assist-core.js"), "utf8").replace(/^﻿/, "");
const ui = fs.readFileSync(path.join(ROOT, "scripts", "assist-ui.js"), "utf8").replace(/^﻿/, "");
const popup = fs.readFileSync(path.join(ROOT, "scripts", "assist-popup.js"), "utf8").replace(/^﻿/, "");
const tools = fs.readFileSync(path.join(ROOT, "scripts", "assist-tools.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}

console.log("[1] 안내 문구가 화면(실행기/생성기)에 따라 갈린다");
check("메인 창: 실행기면 [전체실행] 안내",
  /_inRunner[\s\S]{0,200}\[전체실행\]을 다시 누르면 반영됩니다/.test(ui));
// [오진 정정 2026-08-26] 원래 실행기 전체실행에는 이어실행이 '아예 없었는데' 있다고 안내했다.
// 이후 실제로 붙였지만(경계 스냅샷, _test_fullrun_resume_live.py), 저장된 지점이 있을 때만 쓰이고
// 동반 워크북이 끼면 안 쓴다 → AI 가 사용자에게 단정하면 또 거짓말이 된다. 단정 문구를 금지한다.
check("사용자에게 '앞 단계는 건너뜁니다'라고 단정하지 않는다",
  !/앞 단계는 건너뜁니다/.test(ui) && !/앞 단계는 건너뜁니다/.test(popup));
check("지시문이 단정 금지를 명시", /"앞 단계는 건너뜁니다"라고 단정하지 마라/.test(core));
check("지시문이 이어실행의 조건을 설명", /저장해 둔 지점이 있을 때만/.test(core));
check("메인 창: 생성기는 기존 스위치 안내 유지",
  /스위치를 켜\(ON\) 주시면 새 코드로 적용됩니다/.test(ui));
check("실행기 판정은 현재 페이지로", /state\.currentPage === "runner"/.test(ui));
check("팝업(별도 창)에도 같은 분기", /m\.inRunner[\s\S]{0,200}\[전체실행\]을 다시 누르면 반영됩니다/.test(popup));
check("팝업은 state 를 못 보므로 메인이 문맥을 실어 보낸다",
  /inRunner: \(typeof state !== "undefined" && !!state && state\.currentPage === "runner"\)/.test(ui));

console.log("[2] 시스템 지시문 — 실행기에서 스위치 안내를 금지하고 근거를 남긴다");
check("실행기 안내가 [전체실행]", /실행기\(파일 실행\)\*\*: "\*\*\[전체실행\]을 다시 누르면 반영됩니다/.test(core));
check("왜 스위치가 함정인지 근거 포함", /리셋 후 처음부터 전부 다시[\s\S]{0,80}8분 22초/.test(core));
check("생성기 안내는 그대로", /\*\*생성기\*\*: "그 단계 스위치를 켜\(ON\)/.test(core));

console.log("[3] 같은 실수가 다른 단계에도 있으면 한 번에 고치게 한다");
check("실측 근거(30→34) 명시", /30단계의 잘못된 열 이름[\s\S]{0,120}34단계가 똑같은/.test(core));
check("실재하는 도구만 지시(preflight.check/literals.scan/pipeline.step)",
  /preflight\.check 로[\s\S]{0,120}literals\.scan[\s\S]{0,120}pipeline\.step/.test(core));
check("두 건 이상이면 replaceLiteralAll 로 일괄", /두 단계 이상이면 replaceLiteralAll 로 한 번에/.test(core));
check("replaceLiteralAll 은 실제로 구현돼 있다", /kind === "replaceLiteralAll"/.test(core));
check("지어낸 도구(batchReplace/pipeline.search)를 지시하지 않는다",
  !/batchReplace/.test(core) && !/pipeline\.search/.test(core));

console.log("[4] AI 의 사전점검이 헤더 불일치도 본다");
check("preflight.check 에 header_not_found", /header_not_found/.test(tools));
check("실행 전 게이트와 같은 판정 함수를 쓴다", /pipelineHeaderMismatchReport\(steps\)/.test(tools));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
