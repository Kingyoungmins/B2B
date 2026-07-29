// [스위치=라이브 적용 상태 단일 축] 사용자 확정 모델(2026-07-29)의 '실행' 검증.
//   ON=적용됨 · OFF=보류(미적용). ON+보류 공존 없음.
//   ① 끄기: 그 스텝+뒤 전부 OFF+보류, 라이브는 그 직전으로 롤백
//   ② 켜기: 그 스텝 '하나만' 현재 라이브 위에 적용(앞의 OFF 건너뜀 허용), resume 해제
//   ③ 삽입/추가: 윗 스텝 OFF면 새 스텝도 OFF+보류(적용 안 함)
//   ⑤ 삭제: 끄기와 동일(뒤 스텝 OFF+보류) — 소스 배선으로 검증(인라인 onclick)
// regex 배선이 아니라 pipeline.js 의 '실제 함수'(handlePipelineStepToggle/insertLogic/applyLogic/
// resume 함수들)를 추출해 leaf I/O 만 스텁으로 바꿔 그대로 실행한다.
// 실행: node diagnostics/_test_switch_axis_model.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

let pass = 0, fail = 0;
const t = (n, c, got) => {
  if (c) { pass++; console.log("PASS " + n); }
  else { fail++; console.log("FAIL " + n + (got !== undefined ? "  got=" + JSON.stringify(got) : "")); }
};

// (async )function NAME(...) — 파라미터 괄호 균형 후 본문 중괄호 균형(기본값 {} 오인 방지)
function extractFn(str, name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(");
  const m = re.exec(str);
  if (!m) throw new Error("not found: " + name);
  const start = m.index;
  let i = start + m[0].length - 1, pd = 0;
  for (; i < str.length; i++) {
    if (str[i] === "(") pd++;
    else if (str[i] === ")") { pd--; if (pd === 0) { i++; break; } }
  }
  const open = str.indexOf("{", i);
  let d = 0;
  for (let j = open; j < str.length; j++) {
    if (str[j] === "{") d++;
    else if (str[j] === "}") { d--; if (d === 0) return str.slice(start, j + 1); }
  }
  throw new Error("unbalanced: " + name);
}

const REAL = [
  "getPipelineResumeFromIndex", "setPipelineResumeFromIndex", "clearPipelineResumeFromIndex",
  "markPipelinePendingFromIndex", "handlePipelineStepToggle", "insertLogic", "applyLogic",
  "replaceLogicAt", "applyMappedSingleStep", "_syncPipelineToggleStatus",
].map(n => extractFn(src, n)).join("\n\n");

const DEPS = [
  "state", "window", "console", "isStepEnabled", "renderPipeline", "refreshRunButton",
  "scheduleLogicAutoBackup", "pushHistory", "toast", "reportPipelineError", "pipelineEditBusyReason",
  "canFastEditLastPipelineStep", "restoreLastStepPreApplySnapshot", "applyLastEnabledStepFast",
  "beginMappedPipelineRun",
  "restorePipelineToCheckpointAndHold", "reconcilePipelineSimulationAfterEdit",
  "setPipelineRuntimeStatus", "noteLivePipelineApplied", "_lastLiveAppliedSignature",
  "liveEnabledStepsSignature", "pipelineStepLiveLanguage", "pipelineSuffixWritesCrossFile",
  "pipelineStepWritesCrossFile", "normalizeStep", "bindPipelineStepTargetContext",
  "canUsePipelineCheckpointFromIndex", "runFromCheckpointAfterEdit", "rollbackAddedPipelineStep",
  "requestExcelApplyCancel", "vbaTargetExcelId", "reapplyVbaPipelineToLive",
  "pipelineHasBackendOnlyStep", "applyVbaStepToLiveExcel", "ensureVbaRunExcelId",
  "pipelineUsesPython", "shouldDeferImmediatePipelineRun", "canUseBackendCurrentCacheForAppend",
  "getPipelineRuntimeStatus", "getFile", "pipelineResolveSavedTargetFileId",
];
const factory = new Function(...DEPS, REAL + `
  return { toggle: handlePipelineStepToggle, insert: insertLogic, append: applyLogic,
           edit: replaceLogicAt, syncStatus: _syncPipelineToggleStatus,
           mark: markPipelinePendingFromIndex, getResume: getPipelineResumeFromIndex,
           setResume: setPipelineResumeFromIndex };
`);

const mk = (n, en) => Array.from({ length: n }, (_, i) => ({
  id: "s" + (i + 1), enabled: en ? en[i] : true, code: "'x'", language: "vba",
}));

// 시나리오별 환경 — CALLS 에 leaf 호출을 기록, STATUS 에 상태칩 기록
function makeEnv(opts = {}) {
  const CALLS = [];
  const STATUS = {};
  const win = {};
  const state = { pipeline: [] };
  const deps = {
    state, window: win, console,
    isStepEnabled: (s) => s && s.enabled !== false,
    renderPipeline: () => {}, refreshRunButton: () => {},
    scheduleLogicAutoBackup: () => {}, pushHistory: () => {},
    toast: (msg, kind) => CALLS.push({ kind: "toast", msg: String(msg).slice(0, 40), level: kind }),
    reportPipelineError: (err) => CALLS.push({ kind: "reportError", msg: String(err && err.message || err).slice(0, 60) }),
    pipelineEditBusyReason: () => opts.busy || "",
    canFastEditLastPipelineStep: (stp, idx, before) => idx === (before.length - 1) && !opts.noFastLast,
    restoreLastStepPreApplySnapshot: async (stp) => { CALLS.push({ kind: "restoreLast", id: stp.id }); return opts.restoreLastFails ? false : true; },
    applyLastEnabledStepFast: async (stp) => {
      CALLS.push({ kind: "applySingle", id: stp.id, code: stp && stp.code });
      if (opts.applyThrows) throw new Error("apply boom");
      if (opts.applyReturnsFalse) return false;
      return true;
    },
    // [실행기 매핑 시뮬] 스왑 시 코드의 expected_* → actual_* 치환(실제 buildRunnerMappedPipeline 등가).
    // opts.noMapping 이면 noop(매핑 미확인 등가) — 원본 그대로 적용됨을 검증.
    beginMappedPipelineRun: () => {
      if (opts.noMapping) { CALLS.push({ kind: "mapRun.noop" }); return { steps: state.pipeline, restore: () => {} }; }
      CALLS.push({ kind: "mapRun.begin" });
      const orig = state.pipeline;
      state.pipeline = orig.map(s => ({ ...s, code: String((s && s.code) || "").replace(/expected_output\.xlsx/g, "actual_output_template.xlsx") }));
      return { steps: state.pipeline, restore: () => { CALLS.push({ kind: "mapRun.restore" }); state.pipeline = orig; } };
    },
    restorePipelineToCheckpointAndHold: async (idx, before, o) => {
      CALLS.push({ kind: "hold", idx });
      if (opts.holdFails) return false;
      if (opts.holdThrows) throw new Error("hold boom");
      // 실제 hold 처럼: 복원 후 [idx..) 보류 마킹(진짜 markPipelinePendingFromIndex 로)
      api.mark(idx, { label: "보류" });
      return true;
    },
    reconcilePipelineSimulationAfterEdit: async (o) => {
      CALLS.push({ kind: "reconcile" });
      if (opts.reconcileThrows) throw new Error("reconcile boom");
      return true;
    },
    setPipelineRuntimeStatus: (ids, status, label) => (ids || []).forEach(id => { STATUS[id] = { status, label }; }),
    noteLivePipelineApplied: (steps) => CALLS.push({ kind: "noteApplied" }),
    _lastLiveAppliedSignature: "_sig" in opts ? opts._sig : "SIG",
    liveEnabledStepsSignature: (steps) => "SIG",   // before 스냅샷 서명(스텁) — opts._sig 와 대조됨
    pipelineStepLiveLanguage: (s) => (s && s.language) || "",
    pipelineSuffixWritesCrossFile: () => !!opts.crossSuffix,
    pipelineStepWritesCrossFile: (s) => !!opts.crossStep,
    normalizeStep: (s) => s, bindPipelineStepTargetContext: () => {},
    canUsePipelineCheckpointFromIndex: () => !opts.noCheckpoint,
    runFromCheckpointAfterEdit: async (idx, before, o) => { CALLS.push({ kind: "runFromCk", idx }); return true; },
    rollbackAddedPipelineStep: () => CALLS.push({ kind: "rollbackAdded" }),
    requestExcelApplyCancel: () => false,
    vbaTargetExcelId: () => "excel-1",
    reapplyVbaPipelineToLive: async () => { CALLS.push({ kind: "reapplyAll" }); return true; },
    pipelineHasBackendOnlyStep: () => false,
    applyVbaStepToLiveExcel: (s) => { CALLS.push({ kind: "applyVbaLive", id: s.id }); return { pending: false, applied: true }; },
    ensureVbaRunExcelId: async () => "excel-1",
    pipelineUsesPython: () => false, shouldDeferImmediatePipelineRun: () => false,
    canUseBackendCurrentCacheForAppend: () => false,
    getPipelineRuntimeStatus: (id) => STATUS[id] || {},
    getFile: () => null, pipelineResolveSavedTargetFileId: (t) => t,
  };
  const api = factory(...DEPS.map(d => deps[d]));
  return { api, CALLS, STATUS, state, win };
}

(async () => {
  // ══ S1. 끄기: [1..5 전부 ON적용] → 3번(idx2) OFF → 3,4,5 전부 OFF+보류, 롤백 1회 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv();
    state.pipeline = mk(5);
    await api.toggle("s3");
    t("S1a 3·4·5 전부 OFF(캐스케이드)", state.pipeline.map(s => s.enabled).join() === "true,true,false,false,false", state.pipeline.map(s => s.enabled));
    t("S1b 롤백(hold) 정확히 1회, idx=2", CALLS.filter(c => c.kind === "hold").length === 1 && CALLS.find(c => c.kind === "hold").idx === 2);
    t("S1c 3·4·5 상태칩=보류", ["s3", "s4", "s5"].every(id => STATUS[id] && STATUS[id].label === "보류"), STATUS);
    t("S1d 1·2 상태칩=적용됨", ["s1", "s2"].every(id => STATUS[id] && STATUS[id].status === "applied"));
    t("S1e resume=2(라이브=프리픽스 [0,2))", api.getResume() === 2);
    t("S1f 단일적용/전체재적용 호출 없음", !CALLS.some(c => c.kind === "applySingle" || c.kind === "reconcile"));
  }

  // ══ S2. 켜기: [1,2 ON | 3,4,5 OFF보류] → 4번 ON → 4만 단일 적용, 3·5는 그대로 OFF보류 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv();
    state.pipeline = mk(5, [true, true, false, false, false]);
    api.mark(2, { label: "보류" });                       // 끄기 직후 상태 재현(resume=2)
    await api.toggle("s4");
    t("S2a 4만 단일 적용(applySingle 1회, id=s4)", CALLS.filter(c => c.kind === "applySingle").length === 1 && CALLS.find(c => c.kind === "applySingle").id === "s4");
    t("S2b 4=ON·적용됨", state.pipeline[3].enabled === true && STATUS.s4 && STATUS.s4.status === "applied");
    t("S2c 3·5는 여전히 OFF+보류", state.pipeline[2].enabled === false && state.pipeline[4].enabled === false
      && STATUS.s3.label === "보류" && STATUS.s5.label === "보류");
    t("S2d resume 해제(라이브가 더는 프리픽스 아님)", api.getResume() === null);
    t("S2e 전체재적용/이어실행 호출 없음", !CALLS.some(c => c.kind === "reconcile" || c.kind === "runFromCk"));
  }

  // ══ S3. 순서 건너뛰고 켜기: 5번을 먼저 ON(3,4는 OFF 유지) ══
  {
    const { api, CALLS, state } = makeEnv();
    state.pipeline = mk(5, [true, true, false, false, false]);
    api.mark(2, { label: "보류" });
    await api.toggle("s5");
    t("S3a 5만 단일 적용(3,4 건너뜀)", CALLS.filter(c => c.kind === "applySingle").length === 1 && CALLS.find(c => c.kind === "applySingle").id === "s5");
    t("S3b 3·4는 그대로 OFF", state.pipeline[2].enabled === false && state.pipeline[3].enabled === false);
  }

  // ══ S4. 끄기 롤백 실패 → reconcile 폴백(enabled=프리픽스 재적용) + 보류 라벨 유지 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv({ holdFails: true });
    state.pipeline = mk(5);
    await api.toggle("s3");
    t("S4a hold 실패 → reconcile 폴백 1회", CALLS.filter(c => c.kind === "reconcile").length === 1);
    t("S4b 캐스케이드 유지 + 보류 라벨", state.pipeline[3].enabled === false && STATUS.s4 && STATUS.s4.label === "보류");
    t("S4c resume=2 유지", api.getResume() === 2);
  }

  // ══ S5. 켜기 실패 → OFF+보류로 원복 + 오류 보고 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv({ applyThrows: true });
    state.pipeline = mk(5, [true, true, false, false, false]);
    api.mark(2, { label: "보류" });
    await api.toggle("s4");
    t("S5a 실패 시 4는 다시 OFF", state.pipeline[3].enabled === false);
    t("S5b 상태칩=보류로 복귀", STATUS.s4 && STATUS.s4.status === "review");
    t("S5c 오류 보고됨", CALLS.some(c => c.kind === "reportError"));
  }

  // ══ S6. 교차파일 쓰기 스텝 ON → 단일적용 대신 결정적 reset+재적용 ══
  {
    const { api, CALLS, state } = makeEnv({ crossStep: true });
    state.pipeline = mk(5, [true, true, false, false, false]);
    api.mark(2, { label: "보류" });
    await api.toggle("s4");
    t("S6a 교차파일 ON → reconcile(단일적용 아님)", CALLS.some(c => c.kind === "reconcile") && !CALLS.some(c => c.kind === "applySingle"));
    t("S6b resume 해제", api.getResume() === null);
  }

  // ══ S7. 라이브 서명 불일치(미기록/실행기 직후) ON → 결정적 reconcile ══
  {
    const { api, CALLS } = (() => { const e = makeEnv({ _sig: "OTHER" }); e.state.pipeline = mk(5, [true, true, false, false, false]); return e; })();
    await api.toggle("s4");
    t("S7 서명 불일치 ON → reconcile", CALLS.some(c => c.kind === "reconcile") && !CALLS.some(c => c.kind === "applySingle"));
  }

  // ══ S8. 마지막 스텝 OFF(fast) → 직전 스냅샷 복원 + 보류 라벨 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv();
    state.pipeline = mk(3);
    await api.toggle("s3");
    t("S8a 마지막 OFF = 스냅샷 복원 fast", CALLS.some(c => c.kind === "restoreLast" && c.id === "s3"));
    t("S8b 상태칩=보류 + resume=2", STATUS.s3 && STATUS.s3.label === "보류" && api.getResume() === 2);
  }

  // ══ S9. 서명 미기록(null) 끄기 → 결정적 reconcile + 보류 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv({ _sig: null });
    state.pipeline = mk(5);
    await api.toggle("s3");
    t("S9a 서명 null OFF → reconcile", CALLS.some(c => c.kind === "reconcile"));
    t("S9b 캐스케이드+보류 라벨", state.pipeline[4].enabled === false && STATUS.s5 && STATUS.s5.label === "보류");
  }

  // ══ S10. busy 중 토글 → 아무 것도 안 바뀜 ══
  {
    const { api, CALLS, state } = makeEnv({ busy: "작업 중" });
    state.pipeline = mk(3);
    await api.toggle("s2");
    t("S10 busy → 변경 없음(토스트만)", state.pipeline[1].enabled === true
      && CALLS.every(c => c.kind === "toast"));
  }

  // ══ S11. 삽입: 윗 스텝 OFF → 새 스텝 OFF+보류, 적용 안 함 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv();
    state.pipeline = mk(2, [true, false]);
    const r = api.insert({ id: "NEW", enabled: true, code: "'n'", language: "vba" }, 3); // idx2, 위=s2(OFF)
    t("S11a 새 스텝 OFF+보류로 삽입", state.pipeline[2].id === "NEW" && state.pipeline[2].enabled === false
      && STATUS.NEW && STATUS.NEW.label === "보류");
    t("S11b 어떤 적용 경로도 호출 안 됨", !CALLS.some(c => ["runFromCk", "reconcile", "applySingle", "reapplyAll", "applyVbaLive"].includes(c.kind)));
    t("S11c 반환 held=true", r && r.held === true);
  }

  // ══ S12. 삽입(위가 ON): 새 스텝 '하나만' 즉시 적용 — 뒤 재실행/전체 재적용 없음 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv();
    state.pipeline = mk(3);                                  // 전부 ON
    const r = api.insert({ id: "NEW", enabled: true, code: "'n'", language: "vba" }, 2); // idx1, 위=s1(ON)
    if (r && r.promise) await r.promise.catch(() => {});
    t("S12a 새 스텝만 단일 적용(applySingle 1회, id=NEW)", CALLS.filter(c => c.kind === "applySingle").length === 1
      && CALLS.find(c => c.kind === "applySingle").id === "NEW", CALLS);
    t("S12b 뒤 재실행/전체 재적용 없음(runFromCk·reconcile·reapplyAll 0회)",
      !CALLS.some(c => ["runFromCk", "reconcile", "reapplyAll"].includes(c.kind)));
    t("S12c NEW=적용됨·ON, 기존 스텝 그대로 ON", STATUS.NEW && STATUS.NEW.status === "applied"
      && state.pipeline[1].id === "NEW" && state.pipeline[1].enabled === true
      && state.pipeline[2].enabled === true);
  }

  // ══ S12d. 삽입 실패 → 스텝은 남기되 보류(꺼짐)로 강등 + 오류 보고 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv({ applyThrows: true });
    state.pipeline = mk(3);
    const r = api.insert({ id: "NEW", enabled: true, code: "'n'", language: "vba" }, 2);
    if (r && r.promise) await r.promise.catch(() => {});
    t("S12d 삽입 적용 실패 → OFF+보류 강등 + 오류 보고", state.pipeline[1].enabled === false
      && STATUS.NEW && STATUS.NEW.label === "보류" && CALLS.some(c => c.kind === "reportError"));
  }

  // ══ S12e. 교차파일 쓰기 스텝 삽입 → 단일적용 대신 기존 정합 경로(체크포인트) ══
  {
    const { api, CALLS, state } = makeEnv({ crossStep: true });
    state.pipeline = mk(3);
    const r = api.insert({ id: "NEW", enabled: true, code: "'n'", language: "vba" }, 2);
    if (r && r.promise) await r.promise.catch(() => {});
    t("S12e 교차파일 삽입 → 기존 경로(단일적용 아님)", !CALLS.some(c => c.kind === "applySingle")
      && CALLS.some(c => c.kind === "runFromCk" || c.kind === "reapplyAll"));
  }

  // ══ S13. 추가(append): 마지막 스텝 OFF → 새 스텝 OFF+보류 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv();
    state.pipeline = mk(2, [true, false]);
    const r = api.append({ id: "NEW", enabled: true, code: "'n'", language: "vba" });
    t("S13a 마지막이 OFF면 append 도 OFF+보류", state.pipeline[2].id === "NEW" && state.pipeline[2].enabled === false
      && STATUS.NEW && STATUS.NEW.label === "보류");
    t("S13b 적용 경로 호출 없음 + held 반환", r && r.held === true
      && !CALLS.some(c => ["runFromCk", "reconcile", "applySingle", "applyVbaLive"].includes(c.kind)));
  }

  // ══ S15. 수정 적용: 적용돼 있던 3번 수정 → 3번은 새 코드로 '즉시 ON+적용', 4·5만 OFF+보류 ══
  //         (사용자 확정 2026-07-29: "수정적용하면 그 스텝은 ON으로 적용하고, 그 이후만 OFF+보류")
  {
    const { api, CALLS, STATUS, state } = makeEnv();
    state.pipeline = mk(5);
    ["s1", "s2", "s3", "s4", "s5"].forEach(id => { STATUS[id] = { status: "applied", label: "적용됨" }; });
    const r = api.edit("s3", "'NEW CODE'", "새 설명", "vba", {});
    if (r && r.promise) await r.promise;
    t("S15a 코드 교체됨", state.pipeline[2].code === "'NEW CODE'");
    t("S15b 3=ON 유지 · 4·5만 OFF", state.pipeline.map(s => s.enabled).join() === "true,true,true,false,false", state.pipeline.map(s => s.enabled));
    t("S15c 옛 효과 롤백(hold) 1회 + 새 코드 단일 적용(applySingle s3) 1회",
      CALLS.filter(c => c.kind === "hold").length === 1
      && CALLS.filter(c => c.kind === "applySingle").length === 1
      && CALLS.find(c => c.kind === "applySingle").id === "s3", CALLS);
    t("S15d 뒤 재실행/전체 재적용 없음", !CALLS.some(c => ["runFromCk", "reapplyAll", "reconcile"].includes(c.kind)));
    t("S15e 3=적용됨 · 4·5=보류 · resume=3(라이브=[0,3) 프리픽스)",
      STATUS.s3.status === "applied" && STATUS.s4.label === "보류" && STATUS.s5.label === "보류" && api.getResume() === 3);
    t("S15f 하류 스냅샷 폐기·미검증 강등", state.pipeline[2].trustedStatic === false);
  }

  // ══ S16. 수정 적용: 보류(OFF) 구간의 4번 수정 → 4번만 즉시 적용(건너뛰기), 3·5는 그대로 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv();
    state.pipeline = mk(5, [true, true, false, false, false]);
    STATUS.s1 = STATUS.s2 = { status: "applied", label: "적용됨" };
    ["s3", "s4", "s5"].forEach(id => { STATUS[id] = { status: "review", label: "보류" }; });
    const r = api.edit("s4", "'NEW2'", null, "vba", {});
    if (r && r.promise) await r.promise;
    t("S16a 코드 교체 + 4번 단일 적용(롤백 불필요 — 구간에 적용된 것 없음)",
      state.pipeline[3].code === "'NEW2'"
      && CALLS.filter(c => c.kind === "applySingle").length === 1
      && CALLS.find(c => c.kind === "applySingle").id === "s4"
      && !CALLS.some(c => ["hold", "reconcile", "runFromCk"].includes(c.kind)), CALLS);
    t("S16b 4=ON+적용됨 · 3은 OFF 그대로 · 5=OFF+보류", state.pipeline[3].enabled === true
      && STATUS.s4.status === "applied" && state.pipeline[2].enabled === false
      && state.pipeline[4].enabled === false && STATUS.s5.label === "보류");
  }

  // ══ S17. 수정 롤백 실패 → reconcile 폴백(프리픽스+수정스텝 재적용=수정 반영과 등가) ══
  {
    const { api, CALLS, STATUS, state } = makeEnv({ holdFails: true });
    state.pipeline = mk(5);
    ["s1", "s2", "s3", "s4", "s5"].forEach(id => { STATUS[id] = { status: "applied", label: "적용됨" }; });
    const r = api.edit("s3", "'N'", null, "vba", {});
    if (r && r.promise) await r.promise;
    t("S17 hold 실패 → reconcile 폴백(수정 스텝 enabled 포함) + 뒤만 보류",
      CALLS.filter(c => c.kind === "reconcile").length === 1
      && state.pipeline[2].enabled === true && STATUS.s5.label === "보류" && api.getResume() === 3);
  }

  // ══ S18. 수정: 뒤 구간이 교차파일 쓰기 → 스냅샷 롤백 건너뛰고 곧장 결정적 reconcile ══
  {
    const { api, CALLS, STATUS, state } = makeEnv({ crossSuffix: true });
    state.pipeline = mk(5);
    ["s1", "s2", "s3", "s4", "s5"].forEach(id => { STATUS[id] = { status: "applied", label: "적용됨" }; });
    const r = api.edit("s3", "'N'", null, "vba", {});
    if (r && r.promise) await r.promise;
    t("S18 교차파일 수정 → hold 없이 reconcile(정합 우선)", !CALLS.some(c => c.kind === "hold")
      && CALLS.some(c => c.kind === "reconcile"));
  }

  // ══ S19. 수정 적용 실패 → 수정 스텝을 보류(꺼짐)로 강등(새 코드 유지) + 오류 보고 ══
  {
    const { api, CALLS, STATUS, state } = makeEnv({ applyThrows: true });
    state.pipeline = mk(5);
    ["s1", "s2", "s3", "s4", "s5"].forEach(id => { STATUS[id] = { status: "applied", label: "적용됨" }; });
    const r = api.edit("s3", "'N'", null, "vba", {});
    if (r && r.promise) await r.promise;
    t("S19 적용 실패 → 3=OFF+보류 강등(새 코드 유지) + 오류 보고", state.pipeline[2].enabled === false
      && state.pipeline[2].code === "'N'" && STATUS.s3.label === "보류"
      && CALLS.some(c => c.kind === "reportError"));
  }

  // ══ S14. 삭제(소스 배선): 캐스케이드 + hold, 자동 재적용 없음 ══
  {
    const delBlock = (() => { const i = src.indexOf('if (!fastLast && removedWasApplied'); return src.slice(i, i + 2200); })();
    t("S14a 삭제 = 캐스케이드 OFF 루프", /for \(let j = currentIdx; j < state\.pipeline\.length; j \+= 1\) \{\s*\n\s*state\.pipeline\[j\] = \{ \.\.\.state\.pipeline\[j\], enabled: false \};/.test(delBlock));
    t("S14b 삭제 = hold 롤백(자동 재적용 아님)", /restorePipelineToCheckpointAndHold\(currentIdx, beforeDeleteSnapshot/.test(delBlock)
      && !/runFromCheckpointAfterEdit\(currentIdx, beforeDeleteSnapshot/.test(delBlock));
    t("S14c 폴백 reconcile + 보류 마킹", /reconcilePipelineSimulationAfterEdit\(\{ affectedStep: removedStep/.test(delBlock)
      && /markPipelinePendingFromIndex\(currentIdx, \{ label: "보류" \}\)/.test(delBlock));
  }

  // ══ R. [실행기 매핑] 단일 적용(토글 ON/삽입/수정)이 매핑본으로 실행되는가 ══
  //   실측(2026-07-29 test_mapping): 파일확인 매핑 후 전체실행 성공 → 4번 OFF→ON 시 옛 파일명
  //   expected_output.xlsx 로 실행돼 "워크북이 열려 있지 않습니다" 실패(단일축 토글 회귀).
  //   수정: 단일 적용을 applyMappedSingleStep 으로 — beginMappedPipelineRun 스왑 후 매핑본 적용.
  {
    // 보류 스텝을 ON → 그 스텝만 단일 적용. 코드에 옛 파일명이 있으면 매핑본(actual_*)으로 실행돼야.
    const { api, CALLS, state } = makeEnv();
    state.pipeline = mk(5, [true, true, false, false, false]);
    state.pipeline[3].code = "def transform(ctx):\n    ctx.book('expected_output.xlsx')";  // s4 = 옛 파일명
    api.mark(2, { label: "보류" });
    await api.toggle("s4");   // ON
    const single = CALLS.find(c => c.kind === "applySingle" && c.id === "s4");
    t("R1 ON 단일 적용 전 beginMappedPipelineRun 스왑", CALLS.some(c => c.kind === "mapRun.begin"));
    t("R2 적용된 코드가 매핑본(actual_output_template, expected_output 아님)",
      single && /actual_output_template\.xlsx/.test(single.code) && !/expected_output\.xlsx/.test(single.code), single && single.code);
    t("R3 적용 후 restore 로 코드 원복(원본 보존)",
      CALLS.some(c => c.kind === "mapRun.restore") && /expected_output\.xlsx/.test(state.pipeline[3].code));
  }
  {
    // 매핑 미확인(noMapping) — beginMappedPipelineRun noop → 원본 그대로 적용(무회귀).
    const { api, CALLS, state } = makeEnv({ noMapping: true });
    state.pipeline = mk(5, [true, true, false, false, false]);
    state.pipeline[3].code = "def transform(ctx):\n    ctx.book('expected_output.xlsx')";
    api.mark(2, { label: "보류" });
    await api.toggle("s4");
    const single = CALLS.find(c => c.kind === "applySingle" && c.id === "s4");
    t("R4 매핑 미확인이면 원본 코드 그대로(noop, 무회귀)", single && /expected_output\.xlsx/.test(single.code));
  }
  {
    // 삽입(위가 ON) 단일 적용도 매핑본으로 — 소스 배선 검증(insertLogic 이 applyMappedSingleStep 사용).
    t("R5 삽입 단일 적용이 applyMappedSingleStep 사용",
      /const ok = await applyMappedSingleStep\(step\.id\)/.test(src));
    t("R6 수정 단일 적용이 applyMappedSingleStep 사용",
      /const ok = await applyMappedSingleStep\(stepId\)/.test(src));
    t("R7 토글 ON 단일 적용이 applyMappedSingleStep 사용",
      /const _applied = await applyMappedSingleStep\(stepId\)/.test(src));
    t("R8 직접 applyLastEnabledStepFast 호출은 헬퍼 안에서만(단일축 경로 누수 없음)",
      (src.match(/await applyLastEnabledStepFast\(/g) || []).length === 1);
  }

  // ══ TS. [상태칩 정착] 'ON인데 보류' 방지 — 실측(2026-07-29): 3 OFF→4 ON→3 ON 시 3 ON 이
  //   reconcile 로 적용됐는데 상태칩이 옛 '보류'로 남음. 수정: 토글 성공 후 ON=적용/OFF=보류 동기화.
  {
    // ON 이 서명 불일치로 reconcile 경로를 타도 상태칩이 '적용됨'이어야(보류 아님).
    const { api, CALLS, STATUS, state } = makeEnv({ _sig: "OTHER" });   // 서명 불일치 → ON reconcile
    state.pipeline = mk(4, [true, true, false, true]);                  // 3 OFF, 4 ON(사용자 중간상태)
    STATUS.s3 = { status: "review", label: "보류" };
    STATUS.s4 = { status: "applied", label: "적용됨" };
    await api.toggle("s3");                                             // 3 ON
    t("TS1 3 ON(reconcile 경유) → 상태칩 '적용됨'(보류 아님)", STATUS.s3 && STATUS.s3.status === "applied", STATUS.s3);
    t("TS2 reconcile 경로 확인 + sync 로 정착", CALLS.some(c => c.kind === "reconcile"));
  }
  {
    // ON 단일적용 성공 후에도 나머지 상태칩이 스위치에 맞아야(옛 보류 잔존 없음).
    const { api, STATUS, state } = makeEnv();                           // 서명 일치(SIG) → 단일적용
    state.pipeline = mk(4, [true, true, false, true]);
    STATUS.s3 = { status: "review", label: "보류" };
    STATUS.s4 = { status: "applied", label: "적용됨" };
    await api.toggle("s3");                                             // 3 ON(단일적용)
    t("TS3 3 ON(단일적용) → 상태칩 '적용됨'", STATUS.s3 && STATUS.s3.status === "applied", STATUS.s3);
  }
  {
    // sync 헬퍼: ON=적용됨 / OFF=보류 / '오류'·'실행중'은 보존.
    const { api, STATUS, state } = makeEnv();
    state.pipeline = mk(5, [true, false, true, false, true]);
    STATUS.s3 = { status: "error", label: "오류" };
    STATUS.s5 = { status: "running", label: "실행 중" };
    api.syncStatus();
    t("TS4a ON→적용됨(s1)", STATUS.s1 && STATUS.s1.status === "applied");
    t("TS4b OFF→보류(s2,s4)", STATUS.s2.label === "보류" && STATUS.s4.label === "보류");
    t("TS4c 오류 보존(s3, 적용됨으로 안 덮음)", STATUS.s3.status === "error");
    t("TS4d 실행중 보존(s5)", STATUS.s5.status === "running");
  }
  // 배선/서명정합 소스 검증
  t("TS5 ON reconcile·단일적용 둘 다 _syncPipelineToggleStatus 호출",
    (src.match(/_syncPipelineToggleStatus\(\);/g) || []).length >= 2);
  t("TS6 applyMappedSingleStep: 복원 후 원본 파이프라인 서명 재기록(불필요 reconcile 방지)",
    /_result && typeof noteLivePipelineApplied === "function"[\s\S]{0,90}noteLivePipelineApplied\(state\.pipeline\)/.test(src));

  console.log(pass + "/" + (pass + fail) + " PASS");
  process.exit(fail ? 1 : 0);
})();
