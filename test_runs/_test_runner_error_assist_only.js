// [사용자 지시 2026-08-11] 실행기 오류 화면에서 [에러 복구 시도]를 없애고 AI 도움만 남긴다.
//
// 왜: 실행기에서 복구 버튼을 누르면 설계 채팅이 열려 '생성기에서 다시 만들어야 하는 것'처럼 보였다.
//     실행기 사용자는 스킬을 다시 만들 생각이 없고, 고쳐서 [전체실행]을 다시 누르고 싶을 뿐이다.
// 대신: AI 도움이 원인을 찾아 '코드 수정'을 제안 → 반영 → 전체실행 재실행.
//
// 이 테스트가 잠그는 것
//   1. 실행기 오류 화면에 복구 버튼/메모칸이 없다
//   2. AI 도움 버튼이 있고, 스킬 단계 실패면 자동으로 열린다
//   3. 실행기용 질문은 '없는 UI'(메모칸/복구버튼)를 안내하지 않고 코드 수정을 결론으로 요구한다
//   4. 생성기 오류 창의 기존 안내는 그대로다(회귀 금지)
//   5. 읽기 한도 초과 자동 복구는 버튼이 사라져도 살아 있다
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
  let at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;
  const paren = src.indexOf("(", at);
  let d = 0, paramEnd = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") d++;
    else if (src[i] === ")") { d--; if (d === 0) { paramEnd = i; break; } }
  }
  const b = src.indexOf("{", paramEnd);
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const ac = fs.readFileSync(path.join(ROOT, "scripts", "assist-core.js"), "utf8").replace(/^﻿/, "");

const STUBS = `
var window = globalThis;
var state = { pipeline: [{ id: "s1" }, { id: "s2" }] };
`;
const m = new Module("runner-err-extracted", module);
m._compile(STUBS + "\n" + fn(pj, "_assistErrorDiagnoseQuestion")
  + "\nmodule.exports = { _assistErrorDiagnoseQuestion };\n",
  path.join(__dirname, "_extracted_runner_err.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}

// showRunnerPipelineError 의 마크업/배선 부분만 떼어 문자열로 검사한다(DOM 렌더가 필요해 실행은 안 함).
const runnerFnSrc = fn(pj, "showRunnerPipelineError");

// 화면에 실제로 그려지는 부분(panel.innerHTML 템플릿)만 떼어 본다 — 주석에 남은 설명까지 잡으면
// "왜 없앴는지" 기록을 못 남기게 된다.
const panelHtml = (runnerFnSrc.match(/panel\.innerHTML = `([\s\S]*?)`;/) || [])[1] || "";

console.log("[1] 실행기 오류 화면 — 복구 버튼과 메모칸이 사라졌다");
check("화면 템플릿을 찾았다", panelHtml.length > 50);
check("에러 복구 버튼 마크업 없음", !/runner-error-recover/.test(panelHtml));
check("메모칸(textarea) 없음", !/runner-error-note|textarea/.test(panelHtml));
check("'에러 복구 시도' 문구 없음", !/에러 복구 시도/.test(panelHtml));
check("복구 버튼 핸들러 잔재 없음", !/recoverBtn/.test(runnerFnSrc));
check("안내문이 'AI 도움이 코드를 고쳐 준다'로 바뀜", /AI 도움이 원인을 찾아/.test(runnerFnSrc));

console.log("[2] AI 도움만 남았고, 단계 실패면 자동으로 연다");
check("AI 도움 버튼 존재", /runner-error-assist/.test(runnerFnSrc));
check("실행기 맥락을 질문에 넘김", /_assistErrorDiagnoseQuestion\(info \|\| \{\}, \{ runner: true \}\)/.test(runnerFnSrc));
check("스킬 안 단계 실패일 때만 자동 오픈", /_inSkill && err && typeof err === "object" && !err\.__runnerAssistAutoAsked/.test(runnerFnSrc));
check("자동 오픈은 한 번만(가드 플래그)", /err\.__runnerAssistAutoAsked = true;/.test(runnerFnSrc));
check("생성기에서 보기는 남아 있다(탈출구)", /runner-error-open-generator/.test(runnerFnSrc));

console.log("[3] 실행기용 질문 — 없는 UI 를 안내하지 않는다  ← 이번 변경의 핵심");
{
  const q = T._assistErrorDiagnoseQuestion({ stepIdx: 2, stepId: "s1" }, { runner: true });
  // 메모칸/복구버튼을 '쓰라고' 하면 안 된다. 다만 "여기엔 없다"고 못 박는 건 필요하다
  // (그래야 모델이 습관적으로 그 안내를 내놓지 않는다).
  check("메모칸을 '쓰라고' 하지 않음", !/메모칸에 .*(넣|적)/.test(q), q);
  check("메모칸·복구버튼이 없다고 명시", /'에러 복구 시도' 버튼도, 오류 창 메모칸도 없어/.test(q), q.slice(0, 200));
  check("코드 수정을 결론으로 요구", /코드 수정 제안/.test(q), q);
  check("전체실행 재실행 맥락을 알려줌", /전체실행/.test(q));
  check("원본부터 도는 특성을 알려줌(중간 시트 전제 금지)", /원본 파일부터/.test(q));
  check("단계 번호가 들어감", /3단계/.test(q), q.slice(0, 60));
  // [사용자 지시] 저장된 스킬은 이미 검증된 것 → 설계를 의심하지 말고 반드시 성공시키게 고쳐라.
  check("검증된 스킬이라는 전제를 준다", /잘 돌아가던 검증된 스킬/.test(q), q);
  check("'다시 만드세요'로 도망가지 말라고 못 박음", /다시 만드세요'로 넘기지 말고/.test(q), q);
  check("실제 이름을 읽어 확인하라고 요구(추측 금지)", /실제 파일·시트·헤더 이름을 읽어 확인/.test(q));
  check("기능을 빼서 오류만 없애는 것 금지", /기능을 빼거나 단순화해서/.test(q));
}

console.log("[4] 생성기 오류 창은 그대로(회귀 금지)");
{
  const q = T._assistErrorDiagnoseQuestion({ stepIdx: 2, stepId: "s1" });
  check("기존 안내 유지(메모칸)", /메모칸/.test(q), q);
  check("runner 옵션 없으면 실행기 문구 안 나옴", !/전체실행을 눌렀는데/.test(q));
}
{
  const q = T._assistErrorDiagnoseQuestion({ stepIdx: 0, stepId: "없는스텝" });
  check("스킬에 없는 단계는 기존 경로 유지", /스킬 목록에는 안 들어갔어/.test(q));
}

console.log("[5] 읽기 한도 초과 자동 복구는 살아 있다");
check("자동 복구 조건 유지", /isPythonComReadLimitRuntimeError\(message\)/.test(runnerFnSrc));
check("버튼 클릭이 아니라 직접 호출로 발사", /requestErrorRecovery\(info && info\.stepIdx, recoveryInfo, ""\)/.test(runnerFnSrc));
check("한 번만(가드 플래그 유지)", /err\.__autoReadLimitVbaTried = true;/.test(runnerFnSrc));
check("실패하면 오류로 보고", /reportPipelineError\(recoverErr, \{ compatibilityCheck: true, runner: true \}\)/.test(runnerFnSrc));

console.log("[6] AI 도움 지침도 실행기를 안다");
check("실행기엔 복구버튼/메모칸이 없다고 못 박음", /실행기\(파일 실행\) 화면의 오류라면/.test(ac));
check("실행기 결론은 코드 수정 제안", /결론은 \*\*코드 수정 제안\(action="propose"\)\*\* 이어야 한다/.test(ac));
check("검증된 스킬 전제 + 반드시 성공시키기", /잘 돌아가던 검증된 스킬/.test(ac) && /반드시 성공시키는 방향으로 코드를 고쳐 놓아라/.test(ac));
check("handoff/report 는 마지막 수단", /넘기는 것은 여기서는 마지막 수단이다/.test(ac));
check("생성기 안내는 '생성기 오류 창'으로 한정", /생성기 오류 창\)/.test(ac));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
