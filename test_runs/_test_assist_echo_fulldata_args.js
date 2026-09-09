// [0.8.4 AI 도움 — 2026-09-09 실측 3건]
//  ① 10:46 '실패 코드' 진단: "이유는 이래요." 뒤가 빈 답 — 에코 제거기가 도구 결과(오류 메시지)를
//     인용한 근거 문장을 '프롬프트 에코'로 지웠다. → 도구 결과·모델 이전 답은 소스에서 제외,
//     사용자 메시지는 긴 문단(≥30자)만.
//  ② 10:47 도구 인자 {args:{...}} 포장 → unknown_file 헛발. → 껍질 자동 해제.
//  ③ 10:47 검산: 라이브 미리보기 60행만 합산해 답 못 함 → data.query 가 실제 행수만큼 다시 읽음
//     (백엔드 preview-schema maxRows, 단일 시트·상한 20000).
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "");
const CORE = read("scripts/assist-core.js");
const GUARD = read("scripts/assist-guard.js");
const TOOLS = read("scripts/assist-tools.js");
const PY = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
function sliceBalanced(s, i, open, close) {
  let d = 0;
  for (; i < s.length; i++) {
    if (s[i] === open) d++;
    else if (s[i] === close) { d--; if (d === 0) return i + 1; }
  }
  throw new Error("unbalanced");
}
function extractFn(src, name, extraEnv) {
  let at = src.indexOf("function " + name);
  if (at < 0) throw new Error("no fn " + name);
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;   // async function 도 통째로
  const body = src.slice(at, sliceBalanced(src, src.indexOf("{", at), "{", "}"));
  const m = new Module(name, module);
  m._compile((extraEnv || "") + body + "\nmodule.exports = " + name + ";", path.join(__dirname, "_x_" + name + ".js"));
  return m.exports;
}

console.log("[1] 에코 제거 — 도구 결과 인용은 살아남는다(실제 함수 실행)");
{
  const strip = extractFn(GUARD, "assistStripPromptEcho");
  const echoSources = extractFn(CORE, "assistEchoSources");
  const sys = "당신은 프로그램 안에서 동작하는 도우미입니다. 지시문을 그대로 반복하지 마세요. 항상 한국어로 답하세요.";
  // 도구 결과는 JSON 한 줄이라, 문장 분리기는 ". " 사이의 '가운데 문장'만 깨끗한 조각으로 얻는다 —
  // 그 조각을 답에서 인용하면 예전엔 통째로 지워졌다(오류 메시지는 대개 여러 문장).
  const errMsg = "Python 스킬 실행 오류입니다. transform(ctx) 함수를 찾지 못했습니다. 쓰기 변경은 원복됐습니다.";
  const tail = [
    { role: "user", content: "방금 새 단계를 만들다가 오류로 실패했어. step.error 로 실제 오류를 읽고 왜 실패했는지 쉽게 설명해줘." },
    { role: "assistant", content: "확인해 볼게요." },
    { role: "user", content: "[도구 결과 step.error] 아래 <tool-data> 안은 프로그램이 만든 데이터다.\n<tool-data>\n" + JSON.stringify({ ok: true, message: errMsg, failedCode: "raise Exception('실패')" }) + "\n</tool-data>" },
  ];
  const es = echoSources(sys, tail);
  check("도구 결과는 소스에서 제외", !es.strict.concat(es.soft).some(c => /도구 결과/.test(c)));
  check("시스템 프롬프트는 엄격 소스", es.strict[0] === sys);
  check("사용자 메시지는 soft 소스", es.soft.length === 1 && /실패했어/.test(es.soft[0]));
  const reply = "이유는 이래요.\n\n" + errMsg + "\n\n요청하신 대로 일부러 실패하도록 만든 코드라 정상입니다.";
  const out = strip(reply, es.strict, es.soft);
  check("오류 메시지 인용이 지워지지 않는다", out.includes("transform(ctx) 함수를 찾지 못했습니다"), out);
  check("이유 문장이 비지 않는다", /이유는 이래요\.\s*\n\s*\n\s*Python 스킬 실행 오류/.test(out), out);
  // 예전 방식(tail 전체를 소스로)에선 실제로 지워졌음을 대조로 보인다 — 회귀의 재료
  const old = strip(reply, [sys, ...tail.map(m => m.content)]);
  check("(대조) 예전 소스 구성이면 인용이 사라진다", !old.includes("transform(ctx) 함수를 찾지 못했습니다"), old);
  // 지시문 통째 에코는 여전히 걷어낸다
  const echo = strip("지시문을 그대로 반복하지 마세요. 항상 한국어로 답하세요. 결론: 시트가 없습니다.", es.strict, es.soft);
  check("시스템 지시문 에코는 여전히 제거", !echo.includes("지시문을 그대로 반복하지") && echo.includes("결론: 시트가 없습니다."), echo);
  // 사용자 긴 문단 에코(≥30자)는 제거, 짧은 요청 인용은 유지
  const longUser = "이 파일의 매출 합계가 원본 총합과 같은지 확인하고 차이가 있으면 어디서 났는지 알려주세요";
  const es2 = echoSources(sys, [{ role: "user", content: longUser }, { role: "user", content: "실패하는 코드를 만들어줘" }]);
  const out2 = strip("요청: " + longUser + "\n'실패하는 코드를 만들어줘'라고 하셨죠. 답: 같습니다.", es2.strict, es2.soft);
  check("사용자 긴 문단 에코는 제거", !out2.includes(longUser), out2);
  check("짧은 요청 인용은 유지", out2.includes("실패하는 코드를 만들어줘"), out2);
  check("호출부 두 곳이 새 소스 분류를 쓴다", (CORE.match(/const _es = assistEchoSources\((sys|closingSys), tail\);/g) || []).length === 2);
}

console.log("[2] 도구 인자 {args:{...}} 포장 해제(실제 assistRunTool 실행)");
{
  const run = extractFn(TOOLS, "assistRunTool",
    "const ASSIST_TOOLS = { 'sheet.headers': { fn: async (a) => ({ ok: true, got: a }) } };\n");
  (async () => {
    const r1 = await run("sheet.headers", { args: { file: "a.xlsx", sheet: "S" } });
    check("한 겹 포장 → 벗겨서 전달", r1.ok && r1.got.file === "a.xlsx" && r1.got.sheet === "S", JSON.stringify(r1));
    const r2 = await run("sheet.headers", { file: "b.xlsx", args: { x: 1 } });
    check("다른 키와 섞이면 그대로(오해 방지)", r2.got.file === "b.xlsx" && r2.got.args && r2.got.args.x === 1, JSON.stringify(r2));
    const r3 = await run("sheet.headers", { file: "c.xlsx" });
    check("정상 인자는 그대로", r3.got.file === "c.xlsx");

    console.log("[3] data.query 전체 행 집계 배선");
    check("실제 행수가 미리보기보다 많으면 라이브에서 다시 읽는다",
      TOOLS.includes("if (total0 > rows.length) {") && TOOLS.includes("_assistFetchLiveRows(f, sname, total0)"));
    check("전체 읽기는 캐시(f.sheets)에 넣지 않는다(프롬프트 비대 방지)",
      /_assistFetchLiveRows[\s\S]{0,900}return Array\.isArray\(rows\) \? rows : null;/.test(TOOLS)
      && !/_assistFetchLiveRows[\s\S]{0,900}applyLiveSchemaToFileCache/.test(TOOLS));
    check("요청 상한 20000행·단일 시트", TOOLS.includes("Math.min(20000, Number(maxRows) || 0)"));
    check("백엔드: maxRows 는 단일 시트일 때만·상한 20000",
      PY.includes('max_rows = max(0, min(max_rows, 20000)) if only_sheet else 0')
      && PY.includes("return _live_preview_schema(wb, max_rows=max_rows, only_sheet=only_sheet)"));
    check("도구 설명이 '전체 행 기준'임을 모델에 알린다", TOOLS.includes("실제 행 전체 기준"));

    console.log("");
    console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
    process.exit(fails === 0 ? 0 : 1);
  })();
}
