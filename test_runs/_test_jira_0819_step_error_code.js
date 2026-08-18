// [지라 2026-08-19] "스킬 등록이 한 사람은 되고 한 사람은 오류 창 — AI 도움을 눌렀는데
// 해당 스킬에 대해 읽어 오지 못하여 도움이 안 됨."
//
// 원인: 만들다가 실패한 단계는 스킬 목록(state.pipeline)에 없다. AI 도움의 유일한 근거인
// 실패 기록(window.__lastPipelineErrorInfo)에 '실패한 코드'가 아예 안 들어 있어서,
// step.error 도구가 메시지·원인만 돌려주고 코드는 못 보여 줬다 — 진단이 헛돌 수밖에 없다.
//
// 수정: 실패 기록에 code 를 담고(4000자), step.error 가 failedCode 로 노출한다.
// note 도 failedCode 를 근거로 진단하라고 안내한다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const at = fs.readFileSync(path.join(ROOT, "scripts", "assist-tools.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 실패 기록에 코드가 담긴다");
check("__lastPipelineErrorInfo 에 code 필드",
  /window\.__lastPipelineErrorInfo = \{[\s\S]{0,700}code: String\(info\.code \|\| ""\)\.slice\(0, 4000\)/.test(pj));
check("코드의 출처 체인이 살아 있다(attach → report)",
  /code: \(step && step\.code\) \|\| currentInfo\.code \|\| ""/.test(pj)
  && /code: rawInfo\.code \|\| ""/.test(pj));

console.log("[2] step.error 도구가 코드를 노출한다");
check("failedCode 로 노출(2500자 상한)",
  /failedCode: String\(e\.code \|\| ""\)\.slice\(0, 2500\)/.test(at));
check("목록에 없는 단계는 failedCode 로 진단하라고 안내",
  /failedCode\(실패한 코드 원문\)/.test(at));

console.log("[3] 동작 — 생성 실패 시나리오 재현");
{
  // step.error 도구 본문을 추출해 실행: 실패 기록에 code 가 있으면 failedCode 로 나온다
  function sliceBalanced(s, i, o, c) {
    let d = 0;
    for (; i < s.length; i++) {
      if (s[i] === o) d++;
      else if (s[i] === c) { d--; if (d === 0) return s.slice(0, 0) || s; }
    }
    throw new Error("unbalanced");
  }
  // 도구 등록 콜백 추출: assistDefineTool("step.error", {...}, () => { ... });
  const defAt = at.indexOf('assistDefineTool("step.error"');
  const arrowAt = at.indexOf("() => {", defAt);
  let d = 0, end = -1;
  for (let i = at.indexOf("{", arrowAt); i < at.length; i++) {
    if (at[i] === "{") d++;
    else if (at[i] === "}") { d--; if (d === 0) { end = i; break; } }
  }
  const body = at.slice(at.indexOf("{", arrowAt) + 1, end);
  const fn = new Function("window", "state", "Date", body);
  const fakeWin = { __lastPipelineErrorInfo: {
    stepIdx: -1, stepId: "gone1", description: "S열 값이 있으면 0.3 곱해 T열에",
    language: "python", message: "SyntaxError: invalid syntax",
    cause: "", rawError: "SyntaxError: invalid syntax (line 7)", at: Date.now() - 60000,
    code: 'def transform(ctx):\n    formulas.append(["=IF(S" + str(r) + "<>"", ...)"])',
  } };
  const out = fn(fakeWin, { pipeline: [] }, Date);
  check("실패한 코드가 failedCode 로 나온다",
    !!out.failedCode && out.failedCode.includes("formulas.append"), JSON.stringify(out.failedCode || "").slice(0, 80));
  check("목록에 없음(inSkill=false)을 알려 준다", out.inSkill === false);
  check("note 가 failedCode 를 보라고 안내", /failedCode/.test(out.note || ""));

  const out2 = fn({ __lastPipelineErrorInfo: null }, { pipeline: [] }, Date);
  check("실패 기록이 없으면 기존 안내 유지", out2.hasError === false);
}

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
