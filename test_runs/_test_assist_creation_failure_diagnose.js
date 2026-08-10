// [사용자 제보 2026-08-10] 오류 후 'AI 도움에게 진단 요청'을 누르면 "그 단계는 스킬에 없다"로 끝남.
//   당연히 없다 — 만들다가 실패했으니까. 채팅을 보고 분석하라고 사용자가 한 번 더 말해야 진단했다.
//
// 수정 3곳:
//   ① step.error 도구가 inSkill(목록에 있는지)을 직접 알려주고, 없으면 '만들다 실패한 게 정상,
//      pipeline.step 찾지 말고 오류+chat.history 로 진단하라'는 안내를 데이터에 담는다
//   ② 자동 질문 — 목록에 없는 실패면 "새 단계를 만들다 실패했어" 서사로 바꿔 처음부터 옳은 곳을 보게
//   ③ 프롬프트 — inSkill:false 에서 "그런 단계가 없다"로 끝내기 금지
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
function extractFn(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error("못 찾음: " + marker);
  const b = src.indexOf("{", at);
  return src.slice(at, sliceBalanced(src, b, "{", "}"));
}

const toolsSrc = fs.readFileSync(path.join(ROOT, "scripts", "assist-tools.js"), "utf8").replace(/^﻿/, "");
const pipeSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const coreSrc = fs.readFileSync(path.join(ROOT, "scripts", "assist-core.js"), "utf8").replace(/^﻿/, "");

// ── ① step.error 도구 콜백을 실제로 실행 ──────────────────────────────────
{
  const at = toolsSrc.indexOf('assistDefineTool("step.error"');
  const arrow = toolsSrc.indexOf("() => {", at);
  const cb = toolsSrc.slice(arrow, sliceBalanced(toolsSrc, toolsSrc.indexOf("{", arrow), "{", "}"));
  const m = new Module("steperr-extracted", module);
  m._compile(
    "var window = globalThis;\nvar state = { pipeline: [] };\n"
    + "var stepError = " + cb + ";\n"
    + "module.exports = { run: stepError, state, setErr(e){ globalThis.__lastPipelineErrorInfo = e; } };",
    path.join(__dirname, "_extracted_steperr.js"));
  const T = m.exports;

  console.log("[1] step.error 도구 — 목록에 있는지(inSkill)를 직접 알려준다");
  T.setErr(null);
  check("실패 기록 없으면 기존 동작", T.run().hasError === false);

  T.setErr({ stepIdx: 10, stepId: "sNew", message: "pivot() got ...", at: Date.now() });
  T.state.pipeline = [{ id: "s1" }, { id: "s2" }];        // 실패 스텝은 목록에 없음(생성 실패)
  let r = T.run();
  check("생성 실패: inSkill=false", r.inSkill === false, JSON.stringify(r).slice(0, 120));
  check("'만들다가 실패해 등록되지 못한' 안내", /만들다가 실패해 등록되지 못한/.test(r.note), r.note);
  check("pipeline.step 으로 찾지 말라고 안내", /pipeline\.step 으로 찾으려 하지 말고/.test(r.note));
  check("chat.history 를 보라고 안내", /chat\.history/.test(r.note));

  T.state.pipeline = [{ id: "s1" }, { id: "sNew" }];      // 목록에 있는 스텝의 실패
  r = T.run();
  check("목록에 있으면 inSkill=true + 기존 안내", r.inSkill === true && /마지막 실패 시점의 기록/.test(r.note), r.note);
}

// ── ② 자동 질문을 실제로 실행 ────────────────────────────────────────────
{
  const fn = extractFn(pipeSrc, "function _assistErrorDiagnoseQuestion");
  const m = new Module("diagq-extracted", module);
  m._compile("var state = { pipeline: [] };\n" + fn
    + "\nmodule.exports = { q: _assistErrorDiagnoseQuestion, state };",
    path.join(__dirname, "_extracted_diagq.js"));
  const T = m.exports;

  console.log("[2] 자동 질문 — 목록에 없으면 '만들다 실패' 서사로");
  T.state.pipeline = [{ id: "s1" }, { id: "s2" }];
  const qGone = T.q({ stepIdx: 10, stepId: "sNew" });     // 11번째를 만들다 실패(목록에 없음)
  check("'새 단계를 만들다가' 로 시작하는 질문", /새 단계를 만들다가 오류로 실패/.test(qGone), qGone);
  check("'스킬 목록에는 안 들어갔다'를 명시", /스킬 목록에는 안 들어갔/.test(qGone));
  check("step.error 와 chat.history 를 지목", /step\.error/.test(qGone) && /chat\.history/.test(qGone));
  check("'N단계가 실패했어'(목록을 뒤지게 만드는 문구)는 없음", !/11단계가 오류로 실패/.test(qGone));
  // [사용자 지시 2026-08-10] "그래서 결론까지 나와야함. 이렇게 채팅에 넣으라고"
  check("결론을 요구(설계 채팅에 넘기거나 메모칸 문장)", /결론까지 내줘/.test(qGone)
    && /handoff/.test(qGone) && /메모칸에 그대로 붙여넣을 문장/.test(qGone), qGone);

  const qIn = T.q({ stepIdx: 1, stepId: "s2" });          // 목록에 있는 스텝의 실패
  check("목록에 있으면 기존 질문(2단계) 유지", /2단계가 오류로 실패/.test(qIn), qIn);
  check("목록에 있어도 결론을 요구", /결론까지 내줘/.test(qIn), qIn);

  const qNoId = T.q({ stepIdx: 2, stepId: null });        // stepId 없음 → 목록에 없는 것으로 취급
  check("stepId 없어도 안전(만들다 실패 서사)", /새 단계를 만들다가/.test(qNoId), qNoId);
}

// ── ③ 프롬프트 규칙 ───────────────────────────────────────────────────────
console.log("[3] 프롬프트 — inSkill:false 에서 포기 금지");
check("inSkill:false 규칙이 실패 진단 섹션에 있음", /inSkill:false.*도 같은 뜻/.test(coreSrc));
check("'그런 단계가 없다'로 끝내기 금지 명시", /"그런 단계가 없다"고 답하고 끝내는 것은 \*\*금지\*\*/.test(coreSrc));
check("사용자 재촉을 기다리지 말라고 명시", /다시\s*말해 줄 때까지 기다리지 말고/.test(coreSrc));

console.log("[4] 프롬프트 — 설명만 하고 끝내기 금지(결론 의무)");
check("설명만 하고 끝내는 것도 미완성", /설명만 하고 끝내는 것도 미완성/.test(coreSrc));
check("결론 형식 ①: 메모칸 문장 + [에러 복구 시도]", /메모칸에 이 문장을 넣고 \[에러 복구 시도\]/.test(coreSrc));
check("결론 형식 ②: handoff 로 고친 요청문", /handoff.*고친 요청문을 설계 채팅에/.test(coreSrc));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
