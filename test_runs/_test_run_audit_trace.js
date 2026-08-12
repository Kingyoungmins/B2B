// [진단 계측 2026-08-11] "5단계 스킬에서 3단계 수정 → 5단계 ON 했더니, 꺼져 있는 4단계가 시트에
// 반영돼 있더라" 제보. 사실이면 둘 중 하나다.
//   (가) 실행에 꺼진 단계가 섞여 들어갔다            → pipeline.run.request 의 offSent 가 잡는다
//   (나) 단계를 껐을 때 라이브 되돌리기가 조용히 실패해 그 결과가 남아 있다 → toggle_off 의 ok 가 잡는다
// 둘 다 지금까지는 로그가 없어 사후 판별이 불가능했다.
//
// 이 테스트가 잠그는 것
//   1. 켜짐/꺼짐 지도를 한 줄로 남긴다(스텝 많아도 로그가 안 터진다)
//   2. 보낸 단계 중 '지금 꺼진' 단계를 골라낸다 — 이게 (가)의 증거
//   3. OFF 다섯 갈래가 각각 성공/실패로 기록된다 — 특히 '조용한 false' 도 남는다
//   4. 계측이 판정 로직을 바꾸지 않는다
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
const sb = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8").replace(/^﻿/, "");

const STUBS = `
var window = globalThis;
var _traces = [];
function traceClientUiEvent(event, fields) { _traces.push({ event: event, fields: fields }); }
function isStepEnabled(s) { return !!(s && s.enabled !== false); }
`;
const EXTRACT = [
  fn(pj, "_stepsOnOffMap"),
  fn(pj, "_offStepsAmongSent"),
  fn(pj, "tracePipelineRun"),
].join("\n\n");
const EXPORTS = `
module.exports = {
  _stepsOnOffMap, _offStepsAmongSent, tracePipelineRun,
  get traces() { return _traces; },
  last() { return _traces[_traces.length - 1]; },
  reset() { _traces.length = 0; },
};
`;
const m = new Module("run-audit-extracted", module);
m._compile(STUBS + "\n" + EXTRACT + "\n" + EXPORTS, path.join(__dirname, "_extracted_run_audit.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}

// 제보와 같은 모양: 5단계 스킬, 3단계 수정 후 4·5단계가 꺼진 상태
function fiveSteps() {
  return [
    { id: "s1", enabled: true },
    { id: "s2", enabled: true },
    { id: "s3", enabled: true },
    { id: "s4", enabled: false },
    { id: "s5", enabled: false },
  ];
}

console.log("[1] 켜짐/꺼짐 지도");
check("한 줄로 idx:id:on/off", T._stepsOnOffMap(fiveSteps()) === "0:s1:on|1:s2:on|2:s3:on|3:s4:off|4:s5:off",
  T._stepsOnOffMap(fiveSteps()));
check("빈 배열도 안전", T._stepsOnOffMap([]) === "" && T._stepsOnOffMap(null) === "");
check("구멍(빈 스텝)도 표시", T._stepsOnOffMap([null, { id: "x", enabled: true }]) === "0:∅|1:x:on");
{
  const many = Array.from({ length: 50 }, (_, i) => ({ id: "id" + i, enabled: true }));
  const s = T._stepsOnOffMap(many);
  check("스텝이 많으면 잘라내고 남은 수를 표시", s.endsWith("|…+10"), s.slice(-24));
}

console.log("[2] 보낸 단계 중 '꺼진' 단계 골라내기  ← 제보의 핵심 증거");
{
  const steps = fiveSteps();
  check("정상: 켜진 것만 보냄 → 빈 값", T._offStepsAmongSent(steps, [0, 1, 2]) === "", T._offStepsAmongSent(steps, [0, 1, 2]));
  check("꺼진 4단계가 섞이면 지목", T._offStepsAmongSent(steps, [0, 1, 2, 3]) === "3:s4",
    T._offStepsAmongSent(steps, [0, 1, 2, 3]));
  check("여러 개면 모두 지목", T._offStepsAmongSent(steps, [3, 4]) === "3:s4,4:s5", T._offStepsAmongSent(steps, [3, 4]));
  check("없는 인덱스도 표시", T._offStepsAmongSent(steps, [9]) === "9:없음", T._offStepsAmongSent(steps, [9]));
  check("빈 목록은 빈 값", T._offStepsAmongSent(steps, []) === "");
}

console.log("[3] 실행 기록 이벤트");
T.reset();
T.tracePipelineRun("request", { mode: "isolated", sentIdx: "0,1,2", offSent: "", steps: "0:s1:on" });
check("이벤트 이름", T.last().event === "pipeline.run.request", T.last().event);
check("값은 문자열로 직렬화", typeof T.last().fields.sentIdx === "string" && typeof T.last().fields.mode === "string");
T.reset();
T.tracePipelineRun("toggle_off", { route: "checkpoint_rollback", ok: false, stepIdx: 3 });
check("끄기 이벤트", T.last().event === "pipeline.run.toggle_off" && T.last().fields.ok === "false", JSON.stringify(T.last().fields));

console.log("[4] 배선 — 실제 실행 경로에 붙어 있는가");
check("격리/전체실행 경로에 request 기록", /tracePipelineRun\("request", \{[\s\S]{0,200}mode: options\.backgroundMode \? "fullrun_bg" : "isolated"/.test(pj));
check("리셋 후 재적용 경로에도 request 기록", /mode: "reapply_from_pristine"/.test(pj));
check("재적용 경로는 '넘겨받은 배열'과 '화면 상태' 둘 다 대조", /offSentVsLive: _offStepsAmongSent\(state\.pipeline, _sent\)/.test(pj));
check("보낸 목록은 실제 payload 에서 뽑는다(추정 아님)", /groups\.reduce\(\(acc, g\) => acc\.concat\(\(g\.steps \|\| \[\]\)\.map\(p => p && p\.stepIdx\)\), \[\]\)/.test(pj));

console.log("[5] OFF 다섯 갈래가 전부 기록되는가");
for (const route of ["non_live_reconcile", "reconcile_no_signature", "fast_last_snapshot", "checkpoint_rollback", "reconcile_fallback"]) {
  check(`${route} 기록`, new RegExp(`traceOff\\("${route}"`).test(pj));
}
check("'조용한 false'(예외 아님)도 실패로 남긴다", /traceOff\("fast_last_snapshot", false, \{ reason: "no_snapshot_or_session" \}\)/.test(pj)
  && /traceOff\("checkpoint_rollback", false, \{ reason: "restore_returned_false" \}\)/.test(pj));
// [2026-08-12] 교차파일 구간도 목적지 사본까지 갖췄으면 빠른 롤백을 한다(_crossRollbackReady).
// 판정은 여전히 한 번만 계산해 공유한다.
check("교차파일 판정을 한 번만 계산해 공유(중복 호출 제거)",
  /const _crossSuffix = /.test(pj) && /if \(!_crossSuffix \|\| _crossRollbackReady\) \{/.test(pj));

console.log("[6] 백엔드도 받은 단계를 남기는가(교차 확인용)");
check("pipeline.impl.start 에 stepIdxs", /stepIdxs=",".join\(/.test(sb));

console.log("[7] 판정 로직 무변경");
check("OFF 캐스케이드 그대로", /for \(let j = currentIdx; j < state\.pipeline\.length; j \+= 1\) \{/.test(pj));
check("마지막 단계 빠른 되돌리기 조건 그대로", /if \(fastLast\) \{/.test(pj));
check("교차파일이라도 목적지 사본이 갖춰졌을 때만 사본 되돌리기로 간다",
  /if \(!_crossSuffix \|\| _crossRollbackReady\) \{[\s\S]{0,220}restorePipelineToCheckpointAndHold\(currentIdx/.test(pj));
check("목적지 사본이 하나라도 없으면 빠른 롤백을 안 한다(반쪽 복원 금지)",
  /\.every\(stepHasFullRollbackSnapshots\)/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
