// [사용자 제보 2026-08-21] 스킬 단계 편집 관련 두 가지.
//
//  1. ✎ 프리필이 '최초 프롬프트'로 되돌아간다.
//     한 번 수정한 단계를 또 수정하려 하면, 입력창에 채워지는 텍스트가 1회 수정 후 내용이 아니라
//     최초 프롬프트다(말풍선은 수정 후 텍스트로 올라가는데 프리필만 옛것).
//     원인: 프리필이 step.prompt 를 읽는데, 수정 시 step.prompt 는 '일부러' 안 바꾼다 —
//     대상/시트 추론이 step.prompt 를 읽으므로 바꾸면 실행 대상이 흔들리기 때문(chat-ui 주석).
//     수정: step.prompt 는 그대로 두고 '마지막 수정 요청문'을 lastEditPrompt 에 따로 남겨
//     프리필만 그걸 우선한다. 저장에도 실어 zip 왕복 후 재발하지 않게 한다.
//
//  2. 수정 적용 후 [해제]를 깜빡하고 다음 단계를 이어 쓰면, 그 입력이 '새 단계'가 아니라
//     '같은 단계 재수정'으로 들어간다. 수정 적용 직후 해제를 눈에 띄게 안내한다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const cu = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8").replace(/^﻿/, "");
const sl = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8").replace(/^﻿/, "");
const css = fs.readFileSync(path.join(ROOT, "styles", "chat.css"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
function sliceBalanced(src, startIdx, open, close) {
  let d = 0;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === open) d++;
    else if (src[i] === close) { d--; if (d === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}
function fnBody(src, name) {
  const at = src.indexOf("function " + name);
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const b = src.indexOf("{", src.indexOf(")", at));
  return sliceBalanced(src, b, "{", "}").slice(1, -1);
}

console.log("[1] ✎ 프리필은 '마지막 수정 요청문'을 쓴다");
{
  // 실제 소스의 _editPrefillPromptOf 를 그대로 실행한다(정규식 확인이 아니라 동작 확인).
  const body = fnBody(pj, "_editPrefillPromptOf");
  const f = new Function("step", "stepChatOriginless", body.replace(/typeof stepChatOriginless === "function" && /, ""));
  const originless = () => false;

  check("수정 이력이 없으면 최초 프롬프트를 쓴다(기존 동작 보존)",
    f({ prompt: "D18에 300 써줘" }, originless) === "D18에 300 써줘");
  check("한 번 수정했으면 그 수정 요청문을 쓴다  ← 제보의 핵심",
    f({ prompt: "D18에 300 써줘", lastEditPrompt: "D18에 500으로 바꿔줘" }, originless) === "D18에 500으로 바꿔줘");
  check("두 번째 수정도 가장 최근 것을 쓴다",
    f({ prompt: "최초", lastEditPrompt: "세 번째 요청" }, originless) === "세 번째 요청");
  check("녹화/캡처로 태어난 단계도 채팅으로 고쳤으면 그 요청문을 쓴다",
    f({ prompt: "[녹화됨] 셀 편집", lastEditPrompt: "금액을 1000으로 해줘" }, originless) === "금액을 1000으로 해줘");
  check("녹화 단계인데 채팅 수정이 없으면 여전히 비워 둔다(기존 동작 보존)",
    f({ prompt: "[녹화됨] 셀 편집" }, originless) === "");
  check("복붙 캡처도 마찬가지", f({ prompt: "복붙 캡처: A1:B2" }, originless) === "");
  check("빈 값은 빈 문자열", f({}, originless) === "" && f({ lastEditPrompt: "   " }, originless) === "");
}

console.log("[2] 수정 적용 시 lastEditPrompt 를 남긴다");
check("수정 적용 성공 경로에서 기록한다",
  /if \(st && String\(_src \|\| ""\)\.trim\(\)\) st\.lastEditPrompt = String\(_src\)\.trim\(\);/.test(cu));
check("step.prompt 는 여전히 안 건드린다(대상 추론 안정성 유지)",
  /prompt 는 건드리지 않는다/.test(cu) && !/st\.prompt = /.test(cu));
check("저장에 실린다(zip 왕복 후 재발 방지)", /lastEditPrompt: \(typeof normalizeStaleBooksInSavedText/.test(sl));

console.log("[3] 수정 적용 직후 [해제] 안내");
check("적용 성공 시 표시를 세운다", /window\.__b2bEditJustApplied = true;/.test(cu));
check("배너를 다시 그린다(함수명 정확)", /typeof renderEditingBanner === "function"\) renderEditingBanner\(\)/.test(cu));
check("토스트로 이유까지 알려 준다", /다음 단계를 만들려면 아래 \[해제\]를 먼저 누르세요/.test(cu));
check("배너가 강조 클래스를 붙인다", /banner\.classList\.add\("just-applied"\)/.test(cu));
check("표시는 한 번만 쓰고 내린다(다음 렌더에 안 남게)", /window\.__b2bEditJustApplied = false;/.test(cu));
check("일정 시간 뒤 스스로 멈춘다(영구 깜빡임 방지)",
  /setTimeout\(\(\) => \{ try \{ _b\.classList\.remove\("just-applied"\); \} catch \(_\) \{\} \}, 12000\)/.test(cu));

console.log("[4] 스타일 — 시선은 주되 과하지 않게");
check("해제 버튼만 맥동한다(배너 전체를 흔들지 않음)",
  /\.chat-edit-banner\.just-applied \.edit-cancel \{[\s\S]{0,140}animation: b2bEditCancelPulse/.test(css));
check("애니메이션 정의가 있다", /@keyframes b2bEditCancelPulse/.test(css));
check("움직임 최소화 설정을 존중한다(깜빡임 대신 진하게)",
  /prefers-reduced-motion: reduce[\s\S]{0,220}\.chat-edit-banner\.just-applied \.edit-cancel \{[\s\S]{0,120}animation: none/.test(css));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
