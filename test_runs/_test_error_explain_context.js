// [사용자 지적 2026-08-06] "에러났을 때 원인 설명해주는 녀석이 스마트하지 않다. AI 도움처럼 됐으면."
//
// 왜 멍청했나: explainPipelineErrorForUser 가 LLM 에 넘기던 재료가 3줄뿐이었다
//   (사용자 요청 / 단계 설명 / 오류 문구). 실패한 '코드'도, 대상 시트 '구조'도 안 봤다.
//   게다가 시스템 프롬프트가 "함수명·코드 절대 쓰지 말 것"이라 구체적으로 말하는 게 금지돼 있었다.
//   → 구조적으로 "무언가 잘못됐어요" 이상을 말할 수 없었다.
// AI 도움이 같은 상황에서 정확했던 이유: step.error / 스킬 코드 / sheet.headers 를 직접 조회해
//   근거를 쥐고 답했기 때문. 그래서 같은 근거를 미리 실어 주도록 고쳤다.
//
// 이 테스트가 잠그는 것 = "LLM 에 실제로 무엇을 넘기는가"(품질의 전제조건).
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

function sliceBalanced(src, startIdx, open, close) {
  let depth = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}
function fn(src, name) {
  let at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;
  const b = src.indexOf("{", at);
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

const PRELUDE = `
var window = globalThis;
var OUTPUT_LANGUAGE_RULE = "한국어로 답하세요.";
var state = { pipeline: [], chatHistory: [] };
var _files = {};
function getFile(id) { return _files[id] || null; }
function latestUserRequestForSafety() { return "(최근 요청)"; }
function buildSheetStructureDigest(aoa, sheetName) {
  return { text: "시트 " + sheetName + ": 헤더 2행 / 데이터 3행부터", hasLandmarks: true, totalRows: [] };
}
var _llmCalls = [];
async function callLLMOneShot(system, user, opts) {
  _llmCalls.push({ system: system, user: user, opts: opts });
  return "설명 결과";
}
`;
const EXPORTS = `
module.exports = {
  explainPipelineErrorForUser, state,
  setFiles(m) { _files = m || {}; },
  get calls() { return _llmCalls; },
  get last() { return _llmCalls[_llmCalls.length - 1] || null; },
  reset() { _llmCalls.length = 0; state.pipeline = []; state.chatHistory = []; _files = {}; },
};
`;
const m = new Module("explain-extracted", module);
m._compile(PRELUDE + "\n" + fn(pj, "explainPipelineErrorForUser") + "\n" + EXPORTS,
  path.join(__dirname, "_extracted_error_explain.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail ? "  → " + String(detail).slice(0, 200) : "")); }
}

const FAIL_CODE = 'def transform(ctx):\n    ctx.pivot("VIEW", group_by="서비스", value="할인 후", header_row=2)';
const RAW = "pivot() 에 없는 옵션 header_row 를 넘겼습니다. 쓸 수 있는 옵션: agg, column, dest_name, group_by, header_rows, sheet, value";

(async () => {
  console.log("[1] 실패한 '코드'를 넘긴다  ← 예전엔 안 넘겨서 원인을 짚을 수 없었다");
  T.reset();
  T.state.pipeline = [{ id: "s11", code: FAIL_CODE, language: "python",
                        targetFileId: "input:결과.xlsx", targetSheetName: "VIEW" }];
  await T.explainPipelineErrorForUser({
    stepIdx: 10, stepId: "s11", description: "피벗 생성", language: "python",
    code: FAIL_CODE, rawError: RAW,
  });
  let u = T.last.user;
  check("코드 본문 포함", u.includes("ctx.pivot") && u.includes("header_row=2"), u.slice(0, 200));
  check("언어 표기 포함", /실패한 코드\(python\)/.test(u));
  check("오류 원문 포함", u.includes("쓸 수 있는 옵션"));
  check("단계 번호를 사람 기준(11단계)으로", u.includes("11단계"), u.match(/실패한 단계 번호.*/));

  console.log("[2] '스킬 목록에 남았는지'를 알려준다  ← AI 도움이 짚어낸 그 단서");
  check("목록에 있으면 '예'", /스킬 목록에 남아 있는가: 예/.test(u), u.match(/스킬 목록.*/));
  T.reset();
  T.state.pipeline = [{ id: "other", code: "x" }];
  await T.explainPipelineErrorForUser({ stepIdx: 10, stepId: "s11", description: "피벗 생성", rawError: RAW });
  check("만들다 실패해 목록에 없으면 그 사실을 명시",
    /스킬 목록에 남아 있는가: 아니오/.test(T.last.user), T.last.user.match(/스킬 목록.*/));

  console.log("[3] 대상 시트 구조를 넘긴다  ← '헤더가 2행인데 1행으로 찾는다' 대조용");
  T.reset();
  T.state.pipeline = [{ id: "s1", code: FAIL_CODE, targetFileId: "f1", targetSheetName: "VIEW" }];
  T.setFiles({ f1: { name: "결과.xlsx", sheets: { VIEW: [["제목"], ["서비스", "할인 후"], ["인터넷", 100]] } } });
  await T.explainPipelineErrorForUser({ stepIdx: 0, stepId: "s1", description: "피벗", rawError: RAW });
  check("시트 구조 포함", /대상 시트 구조:/.test(T.last.user), T.last.user);
  check("객체가 아니라 텍스트로 들어감([object Object] 금지)",
    !T.last.user.includes("[object Object]") && T.last.user.includes("헤더 2행"), T.last.user);

  console.log("[4] 시스템 프롬프트가 '구체적으로 말하기'를 허용한다  ← 예전엔 금지였다");
  const sys = T.last.system;
  check("스택트레이스 붙여넣기는 여전히 금지", /스택트레이스/.test(sys));
  check("'쓸 수 있는 옵션' 목록을 활용하라고 지시", /쓸 수 있는 옵션/.test(sys));
  check("근거 없는 단정 금지", /추측을 사실처럼|단정하지 말/.test(sys));
  // [사용자 지시 2026-08-06] 끝맺음은 '복구창에 붙여넣을 문장 + 복구 버튼' 이어야 한다.
  check("복구 메모칸에 넣을 문장을 제시하라고 지시", /메모칸에 그대로 붙여넣을/.test(sys), sys.slice(-400));
  check("복구 버튼을 누르라고 안내시킴", /에러 복구 시도/.test(sys));
  check("잘못을 사용자 탓으로 돌리지 않게 지시", /내가 못한 것으로|제가 알지 못하는/.test(sys));
  check("의도는 이해했다고 안심시키게 지시", /안심시키기|이해했다고/.test(sys));

  console.log("[5] 자료가 없어도 죽지 않는다(폴백)");
  T.reset();
  await T.explainPipelineErrorForUser({ stepIdx: -1, description: "", rawError: "" });
  check("코드/구조 없이도 호출됨", !!T.last);
  check("코드 없으면 코드 섹션을 안 붙임", !/실패한 코드\(/.test(T.last.user));
  check("시트 자료 없으면 구조 섹션을 안 붙임", !/대상 시트 구조:/.test(T.last.user));

  console.log("[6] 토큰 여유를 늘렸다(3줄 요약 → 근거 기반 설명)");
  check("maxTokens 상향", Number(T.last.opts && T.last.opts.maxTokens) >= 700,
    T.last.opts && T.last.opts.maxTokens);

  // [사용자 지시 2026-08-06] "AI 도움과 설명기 모두 비전공자 기준으로. 사업팀·청소년에게 설명하듯이."
  // 말투 규칙은 한 곳(PLAIN_LANGUAGE_RULE)에서 관리하고 두 프롬프트가 모두 물고 있어야 한다 —
  // 한쪽만 물면 같은 앱에서 답변 난이도가 갈린다(그게 원래 문제였다).
  console.log("[7] 비전공자 눈높이 규칙 — 한 곳에서 관리 + 두 곳 모두 적용");
  const schemaJs = fs.readFileSync(path.join(ROOT, "scripts", "file-schema.js"), "utf8");
  const assistJs = fs.readFileSync(path.join(ROOT, "scripts", "assist-core.js"), "utf8");
  const pipeJs = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
  check("공용 규칙이 정의돼 있다", /const PLAIN_LANGUAGE_RULE\s*=/.test(schemaJs));
  check("AI 도움 프롬프트가 물고 있다", /PLAIN_LANGUAGE_RULE/.test(assistJs), "assist-core.js");
  check("오류 설명기가 물고 있다", /PLAIN_LANGUAGE_RULE/.test(pipeJs), "pipeline.js");

  const rule = (schemaJs.match(/const PLAIN_LANGUAGE_RULE = `([\s\S]*?)`;/) || [])[1] || "";
  check("독자를 사업팀/학생으로 못박음", /사업팀|중고등학생/.test(rule), rule.slice(0, 120));
  check("개발 용어 금지 목록 있음", /스택트레이스/.test(rule) && /API|COM|런타임/.test(rule));
  check("어려운 말은 풀어쓰라고 지시", /풀어/.test(rule));
  check("화면에 보이는 이름(파일·시트·열)은 그대로 써도 됨", /파일명·시트명|열 이름/.test(rule));
  check("결론부터 말하기", /결론부터/.test(rule));
  // 영어 설정 이름을 그대로 들이미는 게 어렵다는 지적 → '뜻을 한국어로, 이름은 괄호로만'
  check("내부 명령/설정 이름을 영어로 들이밀지 말라고 지시",
    /영어 그대로 들이밀지 마세요|무슨 뜻인지'?를 한국어로/.test(rule), rule.slice(0, 400));
  check("나쁜 예/좋은 예를 함께 제시", /나쁜 예/.test(rule) && /좋은 예/.test(rule));
  check("1인칭으로 말하라고 지시", /1인칭|제가 ~하지 못했어요/.test(rule));
  check("말투 본보기 포함", /말투 본보기/.test(rule));
  check("본보기가 복구 메모칸+버튼으로 끝남",
    /메모칸에 넣고 \[에러 복구 시도\] 버튼/.test(rule), rule.slice(-300));
  // 코드를 '만드는' 프롬프트에까지 이 규칙이 새면 코드 품질이 흔들린다 — 경계 확인.
  check("코드 생성 프롬프트에는 안 들어감",
    !/PYTHON_COM_SYSTEM_PROMPT = `\$\{OUTPUT_LANGUAGE_RULE\}\s*\$\{PLAIN_LANGUAGE_RULE\}/.test(schemaJs)
    && !/VBA_SYSTEM_PROMPT = `\$\{OUTPUT_LANGUAGE_RULE\}\s*\$\{PLAIN_LANGUAGE_RULE\}/.test(schemaJs));

  console.log("");
  console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(err => { console.error("테스트 자체 오류:", err); process.exit(2); });
