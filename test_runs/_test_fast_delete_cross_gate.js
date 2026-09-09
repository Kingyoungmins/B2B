// [0.8.4] 마지막 단계 삭제/OFF 빠른 복구 게이트 — 교차파일 스텝도 '사본이 전부 있으면' 빠른 경로.
//
// 실측(2026-09-09 10:19 세션): 마지막 4단계(교차파일 쓰기)를 삭제했더니 reset:True ×3 + 전 스텝
// 재적용(전체 재적용)이 돌았다. 적용 직전 사본은 두 파일 모두 저장돼 있었고(10:18:54 snapshot ×2),
// 복원부(restoreLastStepPreApplySnapshot)는 교차 목적지 복원을 지원하는데
// canFastEditLastPipelineStep 이 교차 스텝을 무조건 거부해 그 재료를 버렸다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "scripts/pipeline.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

// 실제 함수들을 소스에서 잘라 스텁과 함께 실행한다(로직을 베끼지 않는다).
const i0 = SRC.indexOf("function stepHasFullRollbackSnapshots(step)");
const i1 = SRC.indexOf("/* 사본 하나를 그 세션에 되돌린다.");
if (i0 < 0 || i1 < 0) throw new Error("함수 블록을 못 찾음");
const BLOCK = SRC.slice(i0, i1);

function makeEnv({ crossWriter, runtimeIds, status }) {
  const env = {
    state: { pipeline: [] },
    pipelineStepLiveLanguage: () => "python",
    pipelineStepWritesCrossFile: (s) => !!(s && s.__cross),
    stepRuntimeCrossExcelIds: (s) => (s && s.__runtimeIds) || runtimeIds || [],
    getPipelineRuntimeStatus: () => ({ status: status || "applied" }),
    Number, Array, Set, Date,
  };
  const fn = new Function(...Object.keys(env), BLOCK + "\nreturn { canFastEditLastPipelineStep, stepHasFullRollbackSnapshots, lastLiveStepIndex };");
  return fn(...Object.values(env));
}

const base = { code: "def transform(ctx): pass", id: "s4" };
const pre = { resultId: "R-target", excelId: "E-target" };

console.log("[1] 비교차 마지막 스텝 — 종전대로 빠른 경로");
{
  const api = makeEnv({});
  const step = { ...base, _preApplySnapshot: pre };
  const steps = [{ code: "x" }, step];
  check("사본 있는 마지막 스텝 → true", api.canFastEditLastPipelineStep(step, 1, steps) === true);
  check("마지막이 아니면 false", api.canFastEditLastPipelineStep(steps[0], 0, steps) === false);
}

console.log("[2] 교차파일 마지막 스텝 — 사본이 '전부' 있으면 빠른 경로(실측 케이스)");
{
  const api = makeEnv({});
  const step = { ...base, __cross: true, __runtimeIds: ["E-cost"],
    _preApplySnapshot: pre,
    _crossPreApplySnapshots: [{ resultId: "R-cost", excelId: "E-cost" }],
    _crossSnapshotFor: "R-target" };
  const steps = [{ code: "x" }, step];
  check("대상+목적지 사본 완비 → true", api.canFastEditLastPipelineStep(step, 1, steps) === true);
  check("stepHasFullRollbackSnapshots 도 true", api.stepHasFullRollbackSnapshots(step) === true);
}

console.log("[3] 교차파일인데 사본이 부족/어긋나면 — 종전대로 전체 reconcile(false)");
{
  const api = makeEnv({});
  const noCross = { ...base, __cross: true, __runtimeIds: ["E-cost"], _preApplySnapshot: pre };
  check("목적지 사본 없음 → false", api.canFastEditLastPipelineStep(noCross, 1, [{ code: "x" }, noCross]) === false);
  const stale = { ...base, __cross: true, __runtimeIds: ["E-cost"], _preApplySnapshot: pre,
    _crossPreApplySnapshots: [{ resultId: "R-old", excelId: "E-cost" }], _crossSnapshotFor: "R-older" };
  check("사본 시점 불일치 → false", api.canFastEditLastPipelineStep(stale, 1, [{ code: "x" }, stale]) === false);
  const uncovered = { ...base, __cross: true, __runtimeIds: ["E-cost", "E-other"], _preApplySnapshot: pre,
    _crossPreApplySnapshots: [{ resultId: "R-cost", excelId: "E-cost" }], _crossSnapshotFor: "R-target" };
  check("런타임 목적지 일부 미커버 → false", api.canFastEditLastPipelineStep(uncovered, 1, [{ code: "x" }, uncovered]) === false);
  const noPre = { ...base, __cross: true, __runtimeIds: ["E-cost"],
    _crossPreApplySnapshots: [{ resultId: "R-cost", excelId: "E-cost" }], _crossSnapshotFor: "R-target" };
  check("대상 사본 자체가 없음 → false", api.canFastEditLastPipelineStep(noPre, 1, [{ code: "x" }, noPre]) === false);
}

console.log("[4] 적용 상태가 아니면 빠른 경로 아님(기존 규칙 유지)");
{
  const api = makeEnv({ status: "error" });
  const step = { ...base, _preApplySnapshot: pre };
  check("status=error → false", api.canFastEditLastPipelineStep(step, 0, [step]) === false);
}

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
