// pipeline.js 의 '실제' 함수 본문을 추출해 leaf I/O 만 스텁하고 그대로 실행한다.
// 대상: runFromCheckpointAfterEdit(수정/삽입/추가 경로의 이어실행 함수) 계약 —
//   · 배리어 안(start>=resume) 편집은 끝까지 이어실행(배리어 해제)
//   · 배리어 앞(start<resume) 편집은 [start,resume) 캡(배리어 뒤 held 스텝 미실행)
// 주의: '스위치 토글'은 2026-07-29 부터 이 함수를 타지 않는다(단일 축 모델 —
//   handlePipelineStepToggle, 검증은 _test_switch_axis_model.js). 여기 시나리오는 토글이 아니라
//   수정/삽입/추가가 이 함수를 부를 때의 동작을 잠근다.
const fs = require("fs");
const path = require("path");
const ROOT = require("path").resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

// function/async function NAME(...) { ... } 를 중괄호 매칭으로 추출(async 접두 포함).
function extractFn(str, name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(");
  const m = re.exec(str);
  if (!m) throw new Error("not found: " + name);
  const start = m.index;
  // 파라미터 괄호를 먼저 균형 맞춘다(기본값 options = {} 의 {} 를 본문으로 오인하지 않도록).
  let i = start + m[0].length - 1; // '(' 위치
  let pd = 0;
  for (; i < str.length; i++) {
    if (str[i] === "(") pd++;
    else if (str[i] === ")") { pd--; if (pd === 0) { i++; break; } }
  }
  const open = str.indexOf("{", i); // 진짜 본문 여는 중괄호
  let depth = 0;
  for (let j = open; j < str.length; j++) {
    if (str[j] === "{") depth++;
    else if (str[j] === "}") { depth--; if (depth === 0) return str.slice(start, j + 1); }
  }
  throw new Error("unbalanced: " + name);
}
const NAMES = [
  "getPipelineResumeFromIndex", "setPipelineResumeFromIndex", "clearPipelineResumeFromIndex",
  "markPipelinePendingFromIndex", "runPipelineSuffixFromCheckpoint",
  "_runPipelineSuffixFromCheckpointImpl", "runFromCheckpointAfterEdit",
];
const BODY = NAMES.map(n => extractFn(src, n)).join("\n\n");

// ── 주입할 leaf 스텁(호출 기록) ──
const DEPS = [
  "state", "window", "isStepEnabled", "setPipelineRuntimeStatus", "refreshRunButton",
  "beginMappedPipelineRun", "restorePipelineCheckpointForSuffix", "runIsolatedLivePipelineSteps",
  "vbaTargetExcelId", "currentExcelId", "noteLivePipelineApplied", "toast",
  "pipelineHasBackendOnlyStep", "reapplyVbaPipelineToLive", "pipelinePinnedTargetFileId",
  "preferredVbaRunFileId", "excelIdForPipelineFileId",
];
const factory = new Function(...DEPS, BODY + "\nreturn {runFromCheckpointAfterEdit, markPipelinePendingFromIndex, getPipelineResumeFromIndex};");

let pass = 0, fail = 0;
const t = (n, c) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n); } };
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: "s" + (i + 1), enabled: true, code: "'x'" }));

function makeEnv() {
  const CALLS = [];
  const win = {};
  const state = { pipeline: [] };
  const deps = {
    state, window: win,
    isStepEnabled: (s) => s && s.enabled !== false,
    setPipelineRuntimeStatus: () => {},
    refreshRunButton: () => {},
    beginMappedPipelineRun: () => ({ restore() {} }),
    restorePipelineCheckpointForSuffix: async () => { CALLS.push({ kind: "restore" }); return true; },
    runIsolatedLivePipelineSteps: async (runSteps, excelId, opts) => {
      CALLS.push({ kind: "run", runIds: (runSteps || []).map(s => s.id), startIndex: opts && opts.startIndex, skipReset: opts && opts.skipReset });
      return { ok: true, applied: (runSteps || []).length };
    },
    vbaTargetExcelId: () => "excel-1",
    currentExcelId: () => "excel-1",
    noteLivePipelineApplied: () => {},
    toast: () => {},
    pipelineHasBackendOnlyStep: () => false,
    reapplyVbaPipelineToLive: async () => { CALLS.push({ kind: "reapplyFull" }); return true; },
    pipelinePinnedTargetFileId: () => null,
    preferredVbaRunFileId: () => null,
    excelIdForPipelineFileId: async () => "excel-1",
  };
  const api = factory(...DEPS.map(d => deps[d]));
  return { api, CALLS, win, state };
}

(async () => {
  // ── 시나리오 A: 보류(resume=5) 구간 안의 OFF 스텝을 ON 토글 → 즉시 반영(보류 해제) ──
  {
    const { api, CALLS, win, state } = makeEnv();
    state.pipeline = mk(7);
    state.pipeline[5].enabled = false;               // s6 = 보류 구간 안, 처음엔 OFF
    api.markPipelinePendingFromIndex(5);             // [0,5) 적용 · [5,7) 보류, resume=5
    t("A0 배리어 생성 resume=5", api.getPipelineResumeFromIndex() === 5);
    const before = state.pipeline.map(s => ({ ...s }));
    state.pipeline[5] = { ...state.pipeline[5], enabled: true };  // 토글 핸들러가 하는 flip(ON)
    await api.runFromCheckpointAfterEdit(5, before, {});          // currentIdx=5 (>= resume)
    const runCalls = CALLS.filter(c => c.kind === "run");
    t("A1 러너가 정확히 1회 호출됨(무실행 아님)", runCalls.length === 1);
    t("A2 러너 startIndex=5(보류 지점부터)", runCalls[0] && runCalls[0].startIndex === 5);
    t("A3 러너에 s6·s7 포함(끝까지 이어실행)", runCalls[0] && runCalls[0].runIds.includes("s6") && runCalls[0].runIds.includes("s7"));
    t("A4 restore 호출 안 됨(prefix 위 실행, 이중적용 아님)", !CALLS.some(c => c.kind === "restore"));
    t("A5 배리어 해제됨(resume=null)", api.getPipelineResumeFromIndex() === null);
    t("A6 전체재실행 폴백 안 탐", !CALLS.some(c => c.kind === "reapplyFull"));
  }

  // ── 시나리오 B: 배리어 앞(idx2) 편집 → 여전히 캡(held 유지) — 불변식 회귀 방지 ──
  {
    const { api, CALLS, state } = makeEnv();
    state.pipeline = mk(7);
    api.markPipelinePendingFromIndex(5);             // resume=5, [5,7) held
    const before = state.pipeline.map(s => ({ ...s }));
    await api.runFromCheckpointAfterEdit(2, before, {});  // requestedStart=2 (< resume)
    const runCalls = CALLS.filter(c => c.kind === "run");
    t("B1 러너 1회 호출", runCalls.length === 1);
    t("B2 러너 startIndex=2", runCalls[0] && runCalls[0].startIndex === 2);
    t("B3 러너에 [s1..s5]만(배리어 뒤 s6·s7 미전달)",
      runCalls[0] && JSON.stringify(runCalls[0].runIds) === JSON.stringify(["s1","s2","s3","s4","s5"]));
    t("B4 배리어 유지 resume=5(held 그대로)", api.getPipelineResumeFromIndex() === 5);
    t("B5 배리어 앞 편집이므로 restore 호출됨", CALLS.some(c => c.kind === "restore"));
  }

  // ── 시나리오 C: 보류 구간 스텝을 OFF 토글(그 스텝만 off) → 나머지 held 실행 + 보류 해제 ──
  {
    const { api, CALLS, state } = makeEnv();
    state.pipeline = mk(7);                            // 전부 ON
    api.markPipelinePendingFromIndex(5);              // resume=5, held=[s6,s7]
    const before = state.pipeline.map(s => ({ ...s }));
    state.pipeline[6] = { ...state.pipeline[6], enabled: false };  // s7 OFF 토글
    await api.runFromCheckpointAfterEdit(6, before, {});
    const runCalls = CALLS.filter(c => c.kind === "run");
    t("C1 러너 1회(=s6만 실행, s7는 off)", runCalls.length === 1);
    t("C2 러너 startIndex=5", runCalls[0] && runCalls[0].startIndex === 5);
    t("C3 배리어 해제", api.getPipelineResumeFromIndex() === null);
  }

  // ── D: 옛(버그) 캡 규칙으로 되돌린 변이체 → 시나리오 A 가 '무실행'으로 재현되는가(판별력 확인) ──
  {
    const OLD = BODY.replace(
      /const _capEnd = \(Number\.isInteger\(existingResume\) && requestedStart < existingResume\)\s*\n?\s*\? existingResume : undefined;/,
      "const _capEnd = Number.isInteger(existingResume) ? existingResume : undefined;"
    );
    t("D0 변이체가 실제로 옛 규칙으로 치환됨", OLD !== BODY && /_capEnd = Number\.isInteger\(existingResume\) \? existingResume/.test(OLD));
    const buggyFactory = new Function(...DEPS, OLD + "\nreturn {runFromCheckpointAfterEdit, markPipelinePendingFromIndex, getPipelineResumeFromIndex};");
    const CALLS = [];
    const win = {}, state = { pipeline: mk(7) };
    const deps = {
      state, window: win,
      isStepEnabled: (s) => s && s.enabled !== false,
      setPipelineRuntimeStatus: () => {}, refreshRunButton: () => {},
      beginMappedPipelineRun: () => ({ restore() {} }),
      restorePipelineCheckpointForSuffix: async () => true,
      runIsolatedLivePipelineSteps: async (rs, e, o) => { CALLS.push({ kind: "run", startIndex: o && o.startIndex }); return { ok: true }; },
      vbaTargetExcelId: () => "excel-1", currentExcelId: () => "excel-1",
      noteLivePipelineApplied: () => {}, toast: () => {},
      pipelineHasBackendOnlyStep: () => false, reapplyVbaPipelineToLive: async () => true,
      pipelinePinnedTargetFileId: () => null, preferredVbaRunFileId: () => null, excelIdForPipelineFileId: async () => "excel-1",
    };
    const api = buggyFactory(...DEPS.map(d => deps[d]));
    state.pipeline[5].enabled = false;
    api.markPipelinePendingFromIndex(5);
    const before = state.pipeline.map(s => ({ ...s }));
    state.pipeline[5] = { ...state.pipeline[5], enabled: true };
    await api.runFromCheckpointAfterEdit(5, before, {});
    t("D1 옛 규칙에선 러너 0회(=동작 안함 버그 재현)", CALLS.filter(c => c.kind === "run").length === 0);
  }

  // ── E: [보류=OFF·ON=적용] 배리어 없는 '중간 스텝 토글' → 홀드 대신 restore+이어실행 ──
  // 실측(2026-07-29): 중간 스텝 토글이 그 뒤 ON 스텝을 ON+보류로 남겼다. 수정 — 토글 시
  // restorePipelineToCheckpointAndHold(홀드) 대신 runFromCheckpointAfterEdit(restore+실행).
  // 배리어 없이 호출하면 그 지점 직전으로 되돌린 뒤 활성 스텝을 실행하고 '보류를 안 남긴다'.
  {
    const { api, CALLS, state } = makeEnv();
    state.pipeline = mk(6);                                    // 배리어 없음, 전부 ON
    const before = state.pipeline.map(s => ({ ...s }));        // 토글 전 스냅샷
    state.pipeline[3] = { ...state.pipeline[3], enabled: false }; // step4(idx3) OFF 토글
    await api.runFromCheckpointAfterEdit(3, before, {});
    const runCalls = CALLS.filter(c => c.kind === "run");
    t("E1 중간 토글(배리어 없음) → 러너 1회(적용, 무실행 아님)", runCalls.length === 1);
    t("E2 그 스텝 직전으로 restore(되돌림) 호출", CALLS.some(c => c.kind === "restore"));
    t("E3 실행 후 보류 안 남김(resume=null) — ON+보류 방지", api.getPipelineResumeFromIndex() === null);
    t("E4 러너 startIndex=3(토글 스텝부터 이어실행)", runCalls[0] && runCalls[0].startIndex === 3);
  }

  console.log(pass + "/" + (pass + fail) + " PASS");
  process.exit(fail ? 1 : 0);
})();
