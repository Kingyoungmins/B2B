// [사용자 요청 2026-08-04] "새로고침 누르면 처음부터 전체실행하잖아? 스냅샷만 보여주면 되는거아님?"
//   → 라이브 Excel 은 작업복사본 + SaveChanges=False 라 창을 닫으면 적용 결과가 사라진다.
//     그래서 '스킬 전부 적용된 최종 상태' 파일 사본을 엔진 무관(Python/VBA)으로 남기고,
//     새로고침 복원 때 원본 대신 그 사본으로 미러를 연다.
// 이 테스트가 잠그는 계약(프론트 쪽):
//   1. 상태 서명은 '같은 파이프라인 → 같은 값, 뭐라도 바뀌면 다른 값'
//   2. 전체실행이 아닌 경우(부분/이어실행)엔 서명을 내지 않는다 ← 덜 적용된 상태를 최종본으로 오인 방지
//   3. 즉시복원 판정은 all-or-nothing (한 파일이라도 사본이 없으면 전체 재실행)
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
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;   // async 를 떼면 내부 await 이 문법오류
  const b = src.indexOf("{", at);
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const sj = fs.readFileSync(path.join(ROOT, "scripts", "soft-refresh.js"), "utf8").replace(/^﻿/, "");

const bundle = [
  "var window = globalThis;",
  "var state = { pipeline: [], inputs: [], outputTemplates: [] };",
  "function isStepEnabled(s) { return !!s && s.enabled !== false; }",
  fn(pj, "activePipelineSteps"),
  fn(pj, "_pipelineSigHash"),
  fn(pj, "pipelineLiveStateSig"),
  fn(pj, "pipelineFullRunStateSig"),
  // 즉시복원 판정: 서버 응답을 테스트가 조종한다.
  "var _lastQuery = null; var _serverReply = null;",
  `async function fetch(url, opts) {
     _lastQuery = { url, body: JSON.parse(opts.body) };
     if (_serverReply instanceof Error) throw _serverReply;
     return { ok: true, json: async () => _serverReply };
   }`,
  fn(sj, "_softRefreshResolveInstantRestore"),
  `module.exports = {
     state, pipelineLiveStateSig, pipelineFullRunStateSig, _softRefreshResolveInstantRestore,
     setReply(r) { _serverReply = r; },
     get query() { return _lastQuery; },
   };`,
].join("\n\n");

const m = new Module("live-final-extracted", module);
m._compile(bundle, path.join(__dirname, "_extracted_live_final.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail ? "  → " + detail : "")); }
}

const STEP = (id, code, extra) => Object.assign({ id, code, language: "vba", enabled: true, targetFileId: "input:a.xlsx" }, extra || {});
const PIPE = [STEP("s1", "Range(\"A1\").Value = 1"), STEP("s2", "Range(\"A2\").Value = 2")];

console.log("[1] 상태 서명 — 같으면 같고, 바뀌면 다르다");
{
  T.state.pipeline = PIPE;
  const base = T.pipelineLiveStateSig(T.state.pipeline);
  check("비어있지 않음", !!base, base);
  check("같은 내용 → 같은 값", base === T.pipelineLiveStateSig(JSON.parse(JSON.stringify(PIPE))));

  const cases = [
    ["코드가 바뀌면", [STEP("s1", "Range(\"A1\").Value = 999"), PIPE[1]]],
    ["순서가 바뀌면", [PIPE[1], PIPE[0]]],
    ["스텝이 빠지면", [PIPE[0]]],
    ["스텝이 늘면", [...PIPE, STEP("s3", "x")]],
    ["대상 파일이 바뀌면", [STEP("s1", PIPE[0].code, { targetFileId: "input:b.xlsx" }), PIPE[1]]],
    ["언어가 바뀌면", [STEP("s1", PIPE[0].code, { language: "python" }), PIPE[1]]],
    ["OFF 된 스텝이 생기면", [PIPE[0], STEP("s2", PIPE[1].code, { enabled: false })]],
    ["스텝 id 가 바뀌면", [STEP("sX", PIPE[0].code), PIPE[1]]],
  ];
  for (const [label, pipe] of cases) {
    check(label + " 달라짐", T.pipelineLiveStateSig(pipe) !== base, T.pipelineLiveStateSig(pipe));
  }
  // 줄바꿈만 다른 건 같은 코드로 본다(저장/복원 왕복에서 CRLF↔LF 가 섞인다).
  check("CRLF/LF 차이는 무시", T.pipelineLiveStateSig([
    STEP("s1", PIPE[0].code.replace(/\n/g, "\r\n")), PIPE[1],
  ]) === base);
  check("활성 스텝이 없으면 빈 값", T.pipelineLiveStateSig([STEP("s1", "x", { enabled: false })]) === "");
}

console.log("[2] 전체실행일 때만 서명을 낸다");
{
  T.state.pipeline = PIPE;
  check("전체 그대로 → 서명 있음", !!T.pipelineFullRunStateSig(PIPE));
  check("일부만 실행(이어실행) → 빈 값", T.pipelineFullRunStateSig([PIPE[1]]) === "",
    T.pipelineFullRunStateSig([PIPE[1]]));
  check("앞부분만 실행 → 빈 값", T.pipelineFullRunStateSig([PIPE[0]]) === "");
  check("빈 실행 → 빈 값", T.pipelineFullRunStateSig([]) === "");
  T.state.pipeline = [];
  check("파이프라인 자체가 비면 빈 값", T.pipelineFullRunStateSig(PIPE) === "");
}

console.log("[3] 즉시복원 판정 — 전부 있을 때만");
(async () => {
  T.state.pipeline = PIPE;
  T.state.inputs = [{ backendWorkbookId: "wb_a" }, { backendWorkbookId: "wb_b" }];
  T.state.outputTemplates = [{ original: { backendWorkbookId: "wb_out" } }];

  T.setReply({ ok: true, ready: true, have: ["wb_a", "wb_b", "wb_out"], missing: [] });
  const sig = await T._softRefreshResolveInstantRestore();
  check("전부 있으면 서명 반환", sig === T.pipelineLiveStateSig(PIPE), sig);
  check("입력·출력 모두 조회에 포함", JSON.stringify(T.query.body.workbookIds) === JSON.stringify(["wb_a", "wb_b", "wb_out"]),
    JSON.stringify(T.query.body.workbookIds));
  check("조회에 상태 서명 동봉", T.query.body.stateSig === sig);

  T.setReply({ ok: true, ready: false, have: ["wb_a"], missing: ["wb_b", "wb_out"] });
  check("하나라도 없으면 빈 값(전체 재실행)", (await T._softRefreshResolveInstantRestore()) === "");

  T.setReply({ ok: false, error: "boom" });
  check("서버 오류면 빈 값", (await T._softRefreshResolveInstantRestore()) === "");

  T.setReply(new Error("network down"));
  check("네트워크 실패해도 던지지 않고 빈 값", (await T._softRefreshResolveInstantRestore()) === "");

  T.setReply({ ok: true, ready: true });
  T.state.pipeline = [];
  check("적용할 스텝이 없으면 조회조차 안 함", (await T._softRefreshResolveInstantRestore()) === "");

  T.state.pipeline = PIPE;
  T.state.inputs = [];
  T.state.outputTemplates = [];
  check("파일이 없으면 빈 값", (await T._softRefreshResolveInstantRestore()) === "");

  console.log("");
  console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(err => { console.error("테스트 자체 오류:", err); process.exit(2); });
