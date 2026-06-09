/* ===================================================================
   LOGIC PIPELINE
   =================================================================== */
function isStepEnabled(step) {
  return !step || step.enabled !== false;
}

function inferPipelineStepLanguage(step) {
  if (step && (step.language === "python" || step.language === "javascript" || step.language === "vba")) return step.language;
  const code = String((step && step.code) || "");
  if (/^\s*sub\s+\w+\s*\(/im.test(code) && /\bend\s+sub\b/i.test(code)) return "vba";
  if (/^\s*def\s+transform\s*\(\s*ctx\s*\)\s*:/m.test(code)) return "python";
  if (/^\s*def\s+transform\s*\(/m.test(code) || /\bctx\.(?:sheet|input|output|workbook|excel)\b/.test(code)) return "python";
  if (/^\s*function\s+transform\s*\(\s*inputs\s*,\s*output\s*\)/m.test(code)) return "javascript";
  return "javascript";
}

function normalizeStep(step) {
  const next = { enabled: true, ...step };
  next.language = inferPipelineStepLanguage(next);
  return next;
}

function ensurePipelineStepIds() {
  const seen = new Set();
  let changed = false;
  state.pipeline = (state.pipeline || []).map(step => {
    const next = normalizeStep(step || {});
    if (!next.id || seen.has(next.id)) {
      next.id = uid();
      changed = true;
    }
    seen.add(next.id);
    return next;
  });
  return changed;
}

function shouldDeferImmediatePipelineRun() {
  return pipelineUsesPython(state.pipeline) ||
    (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks());
}

function pipelineUsesPython(steps = state.pipeline) {
  return (steps || []).some(step => step && isStepEnabled(step) && inferPipelineStepLanguage(step) === "python");
}

function pipelineUsesVba(steps = state.pipeline) {
  return (steps || []).some(step => step && isStepEnabled(step) && inferPipelineStepLanguage(step) === "vba");
}

function activePipelineSteps(steps = state.pipeline) {
  return (steps || []).filter(step => step && isStepEnabled(step));
}

function stepRequiresFullWorkbookExecution(step) {
  if (!step || !isStepEnabled(step)) return false;
  if (step.manual || step.manualEdit) return false;

  const code = String(step.code || "");
  const text = [
    step.description || "",
    step.prompt || "",
    step.title || "",
    code,
  ].join("\n");

  const fullCodePatterns = [
    /\bdataStartRowIndex\s*\(/,
    /\bheaderRowIndex\s*\(/,
    /for\s*\([^;]*;[^;]*<[^;]*\.length\s*;/,
    /\.(?:sort|filter|reduce)\s*\(/,
    /\bnew\s+Map\s*\(/,
    /\bObject\.(?:entries|keys|values)\s*\(/,
    /\brows\.push\s*\(/,
    /\.push\s*\(\s*row(?:\.slice\s*\(\s*\))?\s*\)/,
    /\b(?:inputs|output)\s*\[[\s\S]{0,120}\]\s*\[[\s\S]{0,120}\]\s*=\s*\[/,
  ];
  if (/\b[a-zA-Z_$][\w$]*\s*\[[\s\S]{0,120}\]\s*=\s*\[/.test(code)) return true;
  if (fullCodePatterns.some(pattern => pattern.test(code))) return true;

  const koreanFullIntentPattern = /(\uC804\uCCB4|\uC0C8\s*\uC2DC\uD2B8|\uC0C8\uD0ED|\uC0C8\s*\uD0ED|\uC815\uB82C|\uC624\uB984\uCC28\uC21C|\uB0B4\uB9BC\uCC28\uC21C|\uD544\uD130|\uCD94\uCD9C|\uC911\uBCF5|\uC9D1\uACC4|\uD569\uACC4|\uC6D4\uBCC4|\uD68C\uC0AC\uBCC4|\uADF8\uB8F9|\uD589\uB9CC|\uC870\uAC74|\uBAA9\uB85D)/;
  if (koreanFullIntentPattern.test(text)) return true;

  const fullIntentPattern = koreanFullIntentPattern;
  const scansRows = /(?:sheet|rows?|data|range|시트|행)\.length|dataStartRowIndex|headerRowIndex|for\s*\(/.test(code);
  return fullIntentPattern.test(text) && scansRows;
}

function shouldUseFastPreviewPipelineRun(steps = state.pipeline) {
  return !(steps || []).some(stepRequiresFullWorkbookExecution);
}

function getPipelineRuntimeStatus(stepId) {
  const map = window.pipelineStepRuntimeStatus || {};
  return stepId ? map[stepId] : null;
}

function setPipelineRuntimeStatus(stepIds, status, label) {
  window.pipelineStepRuntimeStatus = window.pipelineStepRuntimeStatus || {};
  (stepIds || []).forEach(stepId => {
    if (!stepId) return;
    if (!status) delete window.pipelineStepRuntimeStatus[stepId];
    else window.pipelineStepRuntimeStatus[stepId] = { status, label };
  });
  if (typeof renderPipeline === "function") renderPipeline();
}

function canUseBackendCurrentCacheForAppend() {
  return typeof hasBackendOnlyWorkbooks === "function" &&
    hasBackendOnlyWorkbooks() &&
    !window.backendCurrentCacheDirty;
}

function toJsLiteral(value) {
  return JSON.stringify(value === undefined ? "" : value);
}

function createManualEditStep(fileId, sheet, r, c, value) {
  const isOutputTarget = fileId === "output";
  const inputName = !isOutputTarget && fileId && fileId.startsWith("input:") ? fileId.slice(6) : "";
  const target = isOutputTarget ? "output" : `inputs[${toJsLiteral(inputName)}]`;
  const sheetKey = toJsLiteral(sheet);
  const valueLiteral = toJsLiteral(value);
  const descTarget = `${fileId === "output" ? "출력" : fileId.slice(6)} / ${sheet}!${_excelCol(c)}${r + 1}`;
  return {
    id: uid(),
    prompt: "manual cell edit",
    description: `직접 편집: ${descTarget}`,
    enabled: true,
    manual: true,
    code: `function transform(inputs, output) {
  if (typeof setCellValue === "function") {
    setCellValue(${isOutputTarget ? toJsLiteral("output") : toJsLiteral("input:" + inputName)}, ${sheetKey}, ${r}, ${c}, ${valueLiteral});
  } else {
    const target = ${target};
    if (!target[${sheetKey}]) target[${sheetKey}] = [];
    if (!target[${sheetKey}][${r}]) target[${sheetKey}][${r}] = [];
    target[${sheetKey}][${r}][${c}] = ${valueLiteral};
  }
  return { inputs, output };
}`,
  };
}

function createManualEditStepV3(fileId, sheet, r, c, value) {
  const outputIdx = typeof outputTemplateIndexFromFileId === "function" ? outputTemplateIndexFromFileId(fileId) : -1;
  const isOutputTarget = fileId === "output" || outputIdx >= 0;
  const inputName = !isOutputTarget && fileId && fileId.startsWith("input:") ? fileId.slice(6) : "";
  const target = isOutputTarget ? "output" : `inputs[${toJsLiteral(inputName)}]`;
  const sheetKey = toJsLiteral(sheet);
  const valueLiteral = toJsLiteral(value);
  const descName = isOutputTarget
    ? (outputIdx >= 0 ? `output template ${outputIdx + 1}` : "output")
    : inputName;
  const descTarget = `${descName} / ${sheet}!${_excelCol(c)}${r + 1}`;
  return {
    id: uid(),
    prompt: "manual cell edit",
    description: `직접 편집: ${descTarget}`,
    enabled: true,
    manual: true,
    manualEdit: { fileId, sheet, r, c, value },
    code: `function transform(inputs, output) {
  if (typeof setCellValue === "function") {
    setCellValue(${isOutputTarget ? toJsLiteral("output") : toJsLiteral("input:" + inputName)}, ${sheetKey}, ${r}, ${c}, ${valueLiteral});
  } else {
    const target = ${target};
    if (!target[${sheetKey}]) target[${sheetKey}] = [];
    if (!target[${sheetKey}][${r}]) target[${sheetKey}][${r}] = [];
    target[${sheetKey}][${r}][${c}] = ${valueLiteral};
  }
  return { inputs, output };
}`,
  };
}

createManualEditStep = createManualEditStepV3;

function rollbackAddedPipelineStep(stepId) {
  const before = state.pipeline || [];
  const next = before.filter(step => step && step.id !== stepId);
  if (next.length === before.length) return;
  state.pipeline = next;
  renderPipeline();
  refreshRunButton();
}

function restorePipelineStep(stepId, originalStep) {
  const idx = (state.pipeline || []).findIndex(step => step && step.id === stepId);
  if (idx < 0 || !originalStep) return;
  state.pipeline[idx] = originalStep;
  renderPipeline();
  refreshRunButton();
}

// VBA 스킬은 '사용자가 보고 있는 파일'(현재 세션)을 대상으로 실행한다 — 그 워크북에 결과를 쓴다.
// 다른 파일들은 라이브 최신 상태로 읽기전용 동반 오픈된다. 따라서 출력을 보며 적용하면 출력에 쓰고,
// 입력을 보며 적용하면 그 입력을 수정한다(입력 선작업 → 출력 활용 워크플로 지원).
function vbaTargetExcelId() {
  return typeof currentExcelId === "function" ? currentExcelId() : null;
}

function preferredVbaRunFileId() {
  if (state.currentFileId && typeof getFile === "function" && getFile(state.currentFileId)) {
    return state.currentFileId;
  }
  if (state.outputTemplates && state.outputTemplates.length) {
    const idx = state.activeOutputIndex >= 0 ? state.activeOutputIndex : 0;
    return typeof outputTemplateFileId === "function" ? outputTemplateFileId(idx) : "output:" + idx;
  }
  if (state.output) return "output";
  if (state.inputs && state.inputs.length) {
    const first = state.inputs[0];
    const name = typeof workbookDisplayName === "function"
      ? workbookDisplayName(first, "입력 파일 1")
      : first.name;
    return "input:" + name;
  }
  return null;
}

async function ensureVbaRunExcelId() {
  let excelId = vbaTargetExcelId();
  if (excelId) return excelId;

  const fileId = preferredVbaRunFileId();
  if (!fileId) throw new Error("VBA 실행 대상 파일이 없습니다. 입력 또는 출력 파일을 먼저 업로드하세요.");
  if (typeof setCurrentView === "function") setCurrentView(fileId);

  excelId = vbaTargetExcelId();
  if (excelId) return excelId;
  if (typeof ensureExcelMirrorForFileId === "function") {
    excelId = await ensureExcelMirrorForFileId(fileId);
    if (excelId) return excelId;
  }
  throw new Error("VBA 실행 대상 Excel 창을 열지 못했습니다. 파일 탭을 선택해 Excel 창을 연 뒤 다시 실행하세요.");
}

function shouldRunPipelineAsVba(steps = state.pipeline) {
  if (!activePipelineSteps(steps).length) return false;
  return pipelineUsesVba(steps) || (typeof getSkillEngine === "function" && getSkillEngine() === "vba");
}

async function runVbaPipelinePreferLive(options = {}) {
  const steps = options.pipeline || state.pipeline;
  const activeSteps = activePipelineSteps(steps);
  if (!activeSteps.length) throw new Error("실행할 활성 스킬이 없습니다.");
  const nonVba = activeSteps.filter(step => inferPipelineStepLanguage(step) !== "vba");
  if (nonVba.length) {
    throw new Error("현재 실행기는 VBA 스킬만 라이브 Excel에서 실행합니다. 기존 JavaScript/Python 스킬은 VBA로 다시 생성해 주세요.");
  }
  const excelId = await ensureVbaRunExcelId();
  return reapplyVbaPipelineToLive(excelId, { steps });
}

function recordVbaDebugTiming(record) {
  if (typeof window.recordBackendDebugTiming !== "function") return;
  window.recordBackendDebugTiming({
    kind: "vba",
    worker: false,
    baseMode: "live",
    polls: 0,
    receiveMs: 0,
    receiveBytes: 0,
    applyRenderMs: 0,
    ...record,
  });
}

function restoreVbaExcelAfterError(excelId) {
  if (typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
  if (typeof releaseExcelMirrorPipelineMute === "function") releaseExcelMirrorPipelineMute(excelId);
  if (excelId && typeof positionExcelMirrorWindow === "function") {
    positionExcelMirrorWindow(excelId, { force: true })
      .then(() => {
        if (typeof raiseExcelMirrorWindow === "function") return raiseExcelMirrorWindow(excelId);
        return null;
      })
      .catch(err => {
        if (typeof isMissingExcelSessionError !== "function" || !isMissingExcelSessionError(err)) {
          console.warn("Excel mirror error restore failed:", err);
        }
      });
  }
  if (excelId && typeof stabilizeExcelMirrorZOrder === "function") {
    try { stabilizeExcelMirrorZOrder(excelId); } catch (_) {}
  }
  if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0);
}

// 0.4.9 리모콘 모델: 생성된 VBA를 라이브 워크북에 즉시 주입 실행한다.
// 파이프라인 재실행/시뮬레이터를 거치지 않으므로 초저지연이고, 결과는 우측 라이브 엑셀에 바로 보인다.
function applyVbaStepToLiveExcel(step, excelId) {
  const perfStartedAt = performance.now();
  let prehideMs = 0;
  let requestMs = 0;
  if (typeof pushHistory === "function") pushHistory("단계 추가");
  state.pipeline.push(step);
  setPipelineRuntimeStatus([step.id], "running", "작업 중");
  renderPipeline();
  refreshRunButton();
  if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-added");
  if (typeof muteExcelMirrorForPipeline === "function") muteExcelMirrorForPipeline(excelId);
  if (typeof beginExcelMirrorApplyLoading === "function") beginExcelMirrorApplyLoading("VBA 적용 중...");
  const prehide = typeof hideAllExcelMirrorWindows === "function"
    ? (async () => {
        const started = performance.now();
        try {
          await hideAllExcelMirrorWindows();
        } catch (_) {
        } finally {
          prehideMs = performance.now() - started;
        }
      })()
    : Promise.resolve();
  const promise = prehide
    .then(() => {
      const requestStarted = performance.now();
      return postExcelMirror("/api/excel/run-vba", { excelId, code: step.code })
        .then(data => {
          requestMs = performance.now() - requestStarted;
          return data;
        });
    })
    .then((data) => {
      setPipelineRuntimeStatus([step.id], "applied", "적용됨");
      if (typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
      if (typeof releaseExcelMirrorPipelineMute === "function") releaseExcelMirrorPipelineMute(excelId);
      if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(180);
      recordVbaDebugTiming({
        action: "append",
        steps: 1,
        prehideMs,
        startRequestMs: requestMs,
        totalClientMs: performance.now() - perfStartedAt,
        server: (data && data.debugTimings) || {},
      });
      toast(`"${step.description}" 적용됨`, "success");
      return true;
    })
    .catch(err => {
      const failedIdx = (state.pipeline || []).findIndex(s => s && s.id === step.id);
      attachPipelineStepError(err, step, failedIdx >= 0 ? failedIdx : (state.pipeline || []).length - 1);
      setPipelineRuntimeStatus([step.id], "error", "오류");
      restoreVbaExcelAfterError(excelId);
      renderPipeline();
      refreshRunButton();
      reportPipelineError(err);
      throw err;
    });
  toast(`"${step.description}" 단계를 라이브 Excel에 적용 중...`, "success");
  return { pending: true, promise };
}

function applyLogic(step) {
  step = normalizeStep(step);
  // 0.4.9 리모콘 모델: VBA 스킬은 파이프라인/시뮬레이터를 우회해 라이브 엑셀에 즉시 주입 실행.
  if (((typeof getSkillEngine === "function" && getSkillEngine() === "vba") || step.language === "vba")) {
    const liveExcelId = vbaTargetExcelId();
    if (liveExcelId) return applyVbaStepToLiveExcel(step, liveExcelId);
    // 라이브 세션이 없으면 아래 기존 경로로 폴백.
  }
  const next = [...state.pipeline, step];
  const mustUseExcelBackend = pipelineUsesPython(next) || shouldDeferImmediatePipelineRun();
  if (mustUseExcelBackend) {
    if (typeof pushHistory === "function") pushHistory("단계 추가");
    state.pipeline.push(step);
    setPipelineRuntimeStatus([step.id], "running", "\uC791\uC5C5 \uC911");
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-added");
    const useCurrentCache = !pipelineUsesPython(state.pipeline) && canUseBackendCurrentCacheForAppend();
    const promise = reconcilePipelineSimulationAfterEdit({
      forceBackend: true,
      steps: useCurrentCache ? [step] : state.pipeline,
      backendBaseMode: useCurrentCache ? "current" : "original",
    })
      .then(() => {
        setPipelineRuntimeStatus([step.id], "applied", "\uC801\uC6A9\uB428");
        return true;
      })
      .catch(err => {
        setPipelineRuntimeStatus([step.id], "error", "\uC624\uB958");
        rollbackAddedPipelineStep(step.id);
        reportPipelineError(err);
        throw err;
      });
    toast(`"${step.description}" 단계가 추가되었습니다. 시뮬레이터에 반영 중입니다.`, "success");
    return { pending: true, promise };
  }
  try {
    runPipeline(next);
    if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
      window.backendCurrentCacheDirty = true;
    }
    if (typeof pushHistory === "function") pushHistory("단계 추가");
    state.pipeline.push(step);
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-added");
    toast(`"${step.description}" 단계가 추가되었습니다`, "success");
    return true;
  } catch (err) {
    reportPipelineError(err);
    console.error(err);
    return { error: true, errorObject: err };
  }
}

// 1-based position. position=1 → 맨 앞, position=N+1 → 맨 뒤(append와 동일)
function insertLogic(step, position) {
  step = normalizeStep(step);
  const total = state.pipeline.length;
  const idx = Math.max(0, Math.min(total, (position | 0) - 1));
  const next = state.pipeline.slice();
  next.splice(idx, 0, step);
  // 0.4.9 VBA: 중간 삽입은 순서가 바뀌므로 라이브를 리셋하고 enabled 스텝을 처음부터 재적용.
  if ((typeof getSkillEngine === "function" && getSkillEngine() === "vba") || step.language === "vba") {
    const liveExcelId = vbaTargetExcelId();
    if (liveExcelId) {
      if (typeof pushHistory === "function") pushHistory("단계 삽입");
      state.pipeline = next;
      setPipelineRuntimeStatus([step.id], "running", "작업 중");
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-inserted");
      const promise = reapplyVbaPipelineToLive(liveExcelId)
        .then(() => { setPipelineRuntimeStatus([step.id], "applied", "적용됨"); return true; })
        .catch(err => {
          setPipelineRuntimeStatus([step.id], "error", "오류");
          renderPipeline();
          refreshRunButton();
          reportPipelineError(err);
          throw err;
        });
      return { pending: true, promise };
    }
  }
  const mustUseExcelBackend = pipelineUsesPython(next) || shouldDeferImmediatePipelineRun();
  if (mustUseExcelBackend) {
    if (typeof pushHistory === "function") pushHistory("단계 삽입");
    state.pipeline = next;
    setPipelineRuntimeStatus([step.id], "running", "\uC791\uC5C5 \uC911");
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-inserted");
    const promise = reconcilePipelineSimulationAfterEdit({ forceBackend: true })
      .then(() => {
        setPipelineRuntimeStatus([step.id], "applied", "\uC801\uC6A9\uB428");
        return true;
      })
      .catch(err => {
        setPipelineRuntimeStatus([step.id], "error", "\uC624\uB958");
        rollbackAddedPipelineStep(step.id);
        reportPipelineError(err);
        throw err;
      });
    toast(`"${step.description}" 단계가 ${idx + 1}번째에 삽입되었습니다. 시뮬레이터에 반영 중입니다.`, "success");
    return { pending: true, promise };
  }
  try {
    runPipeline(next);
    if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
      window.backendCurrentCacheDirty = true;
    }
    if (typeof pushHistory === "function") pushHistory("단계 삽입");
    state.pipeline = next;
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-inserted");
    toast(`"${step.description}" 단계가 ${idx + 1}번째에 삽입되었습니다`, "success");
    return true;
  } catch (err) {
    reportPipelineError(err);
    console.error(err);
    return { error: true, errorObject: err };
  }
}

function replaceLogicAt(stepId, newCode, newDescription, language) {
  const idx = state.pipeline.findIndex(s => s.id === stepId);
  if (idx < 0) {
    toast("수정 대상 단계를 찾지 못했습니다", "error");
    return false;
  }
  const originalStep = state.pipeline[idx];
  const next = state.pipeline.slice();
  next[idx] = normalizeStep({ ...next[idx], code: newCode, description: newDescription || next[idx].description, language });
  if ((typeof getSkillEngine === "function" && getSkillEngine() === "vba") || pipelineUsesVba(next)) {
    const liveExcelId = vbaTargetExcelId();
    if (liveExcelId) {
      if (typeof pushHistory === "function") pushHistory("단계 수정");
      state.pipeline = next;
      setPipelineRuntimeStatus([stepId], "running", "작업 중");
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-updated");
      const promise = reapplyVbaPipelineToLive(liveExcelId)
        .then(() => {
          setPipelineRuntimeStatus([stepId], "applied", "적용됨");
          return true;
        })
        .catch(err => {
          setPipelineRuntimeStatus([stepId], "error", "오류");
          restorePipelineStep(stepId, originalStep);
          reportPipelineError(err);
          throw err;
        });
      toast(`Step ${idx + 1} 코드가 수정되었습니다. 라이브 Excel에 다시 반영 중입니다.`, "success");
      return { pending: true, promise };
    }
  }
  const mustUseExcelBackend = pipelineUsesPython(next) || shouldDeferImmediatePipelineRun();
  if (mustUseExcelBackend) {
    if (typeof pushHistory === "function") pushHistory("단계 수정");
    state.pipeline = next;
    setPipelineRuntimeStatus([stepId], "running", "\uC791\uC5C5 \uC911");
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-updated");
    const promise = reconcilePipelineSimulationAfterEdit({ forceBackend: true })
      .then(() => {
        setPipelineRuntimeStatus([stepId], "applied", "\uC801\uC6A9\uB428");
        return true;
      })
      .catch(err => {
        setPipelineRuntimeStatus([stepId], "error", "\uC624\uB958");
        restorePipelineStep(stepId, originalStep);
        reportPipelineError(err);
        throw err;
      });
    toast(`Step ${idx + 1} 코드가 수정되었습니다. 시뮬레이터에 반영 중입니다.`, "success");
    return { pending: true, promise };
  }
  try {
    runPipeline(next);
    if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
      window.backendCurrentCacheDirty = true;
    }
    if (typeof pushHistory === "function") pushHistory("단계 수정");
    state.pipeline = next;
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-updated");
    toast(`Step ${idx + 1} 코드가 수정되었습니다`, "success");
    return true;
  } catch (err) {
    reportPipelineError(err);
    console.error(err);
    return false;
  }
}

// 특정 step 직전(=steps[0..stepIdx-1] 이 적용된) 입력/출력 상태를 계산해서 반환.
// 실제 state는 변경하지 않는다. 실패 시 null 반환.
function computeStateBeforeStep(stepIdx) {
  if (state.inputsOriginal.length === 0 && !state.outputOriginal) return null;
  const inputsMap = {};
  state.inputsOriginal.forEach(orig => {
    const cloned = cloneFileRecord(orig);
    inputsMap[orig.name] = cloned.sheets;
  });
  const outputSheets = state.outputOriginal ? deepClone(state.outputOriginal.sheets) : {};
  const wrapSheets = (s) => (typeof fuzzyProxy === "function") ? fuzzyProxy(s, { cache: state.fuzzyResolution }) : s;
  const wrappedInputs = {};
  Object.keys(inputsMap).forEach(name => { wrappedInputs[name] = wrapSheets(inputsMap[name]); });
  const proxiedInputs = wrapSheets(wrappedInputs);
  const proxiedOutput = wrapSheets(outputSheets);
  const localSetCellValue = (fileRef, sheetName, r, c, value) => {
    let target = null;
    if (fileRef === "output") {
      target = outputSheets;
    } else {
      let name = String(fileRef || "");
      if (name.startsWith("input:")) name = name.slice(6);
      target = inputsMap[name];
    }
    if (!target) throw new Error(`setCellValue: file not found: ${fileRef}`);
    if (!target[sheetName]) target[sheetName] = [];
    const rowIdx = Math.max(0, Number(r) || 0);
    const colIdx = Math.max(0, Number(c) || 0);
    if (!target[sheetName][rowIdx]) target[sheetName][rowIdx] = [];
    target[sheetName][rowIdx][colIdx] = value;
    return value;
  };
  for (let i = 0; i < stepIdx && i < state.pipeline.length; i++) {
    const step = state.pipeline[i];
    if (!isStepEnabled(step)) continue;
    try {
      const fn = new Function("inputs", "output", "col", "findColumnGlobal", "findInputBySheet", "similarity", "normalizeText", "replaceNormalizedText", "includesNormalizedText", "equalsNormalizedText",
        "headerRowIndex", "dataStartRowIndex", "excelRowToIndex",
        "insertColumns", "copyColumns", "deleteColumns", "shiftFormulaText", "setCellValue",
        step.code +
        "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };"
      );
      const result = fn(proxiedInputs, proxiedOutput, col, findColumnGlobal, findInputBySheet, similarity,
        typeof normalizeText === "function" ? normalizeText : ((v) => String(v || "").trim().toLowerCase().replace(/\s+/g, "")),
        typeof replaceNormalizedText === "function" ? replaceNormalizedText : ((v) => String(v ?? "")),
        typeof includesNormalizedText === "function" ? includesNormalizedText : ((v, s) => String(v || "").trim().toLowerCase().replace(/\s+/g, "").includes(String(s || "").trim().toLowerCase().replace(/\s+/g, ""))),
        typeof equalsNormalizedText === "function" ? equalsNormalizedText : ((v, s) => String(v || "").trim().toLowerCase().replace(/\s+/g, "") === String(s || "").trim().toLowerCase().replace(/\s+/g, "")),
        typeof headerRowIndex === "function" ? headerRowIndex : (() => 0),
        typeof dataStartRowIndex === "function" ? dataStartRowIndex : (() => 1),
        typeof excelRowToIndex === "function" ? excelRowToIndex : ((n) => Math.max(0, Number(n) - 1)),
        typeof insertColumns === "function" ? insertColumns : null,
        typeof copyColumns === "function" ? copyColumns : null,
        typeof deleteColumns === "function" ? deleteColumns : null,
        typeof shiftFormulaText === "function" ? shiftFormulaText : null,
        localSetCellValue);
      if (result && typeof result === "object" && !Array.isArray(result)) {
        if (result.inputs && typeof result.inputs === "object") {
          Object.keys(result.inputs).forEach(name => { inputsMap[name] = result.inputs[name]; });
        }
        if (result.output && typeof result.output === "object") {
          Object.keys(result.output).forEach(k => { outputSheets[k] = result.output[k]; });
        } else if (!result.inputs) {
          Object.keys(result).forEach(k => { outputSheets[k] = result[k]; });
        }
      }
    } catch (err) {
      console.warn(`Step ${i+1} 시뮬레이션 실패:`, err);
      return null;
    }
  }
  return { inputsMap, outputSheets };
}

function toggleEditStep(stepId) {
  if (state.editingStepId === stepId) {
    state.editingStepId = null;
    toast("수정 모드 해제", "success");
  } else {
    state.editingStepId = stepId;
    const idx = state.pipeline.findIndex(s => s.id === stepId);
    toast(`Step ${idx + 1} 수정 모드 활성화 — 채팅으로 수정 사항을 입력하세요`, "success");
  }
  renderPipeline();
  if (typeof renderEditingBanner === "function") renderEditingBanner();
}

function applyManualEditForPipeline(edit, inputsMap, outputSheets) {
  if (!edit) return false;
  let targetSheets = null;
  if (edit.fileId === "output") {
    targetSheets = outputSheets;
  } else if (edit.fileId && edit.fileId.startsWith("output:")) {
    const idx = typeof outputTemplateIndexFromFileId === "function" ? outputTemplateIndexFromFileId(edit.fileId) : -1;
    const tpl = state.outputTemplates && state.outputTemplates[idx];
    if (!tpl) return true;
    targetSheets = idx === state.activeOutputIndex ? outputSheets : tpl.file.sheets;
  } else if (edit.fileId && edit.fileId.startsWith("input:")) {
    const name = edit.fileId.slice(6);
    if (!inputsMap[name]) inputsMap[name] = {};
    targetSheets = inputsMap[name];
  }
  if (!targetSheets) return false;
  if (!targetSheets[edit.sheet]) targetSheets[edit.sheet] = [];
  if (!targetSheets[edit.sheet][edit.r]) targetSheets[edit.sheet][edit.r] = [];
  targetSheets[edit.sheet][edit.r][edit.c] = edit.value;
  clearManualEditFormulaMetadata(edit);
  return true;
}

function clearManualEditFormulaMetadata(edit) {
  if (!edit) return;
  clearFormulaCellMetadataForFileId(edit.fileId, edit.sheet, edit.r, edit.c);
}

function clearFormulaCellMetadataForFileId(fileId, sheetName, r, c) {
  const file = typeof getFile === "function" ? getFile(fileId) : null;
  if (!file) return;
  const addr = _excelCol(c) + (r + 1);
  file.formulaSuppressions = file.formulaSuppressions || {};
  file.formulaSuppressions[sheetName] = file.formulaSuppressions[sheetName] || {};
  file.formulaSuppressions[sheetName][addr] = true;
  if (file.formulas && file.formulas[sheetName]) delete file.formulas[sheetName][addr];
  if (file.originalFormulaValues && file.originalFormulaValues[sheetName]) {
    delete file.originalFormulaValues[sheetName][addr];
  }
  if (file.displays && file.displays[sheetName] && file.displays[sheetName][r]) {
    delete file.displays[sheetName][r][c];
  }
  if (state.formulaResults && state.formulaResults[fileId] && state.formulaResults[fileId][sheetName]) {
    delete state.formulaResults[fileId][sheetName][addr];
  }
}

function runPipeline(steps, options = {}) {
  steps = steps || state.pipeline;
  if (!options.skipRunAdaptation && typeof adaptPipelineForRun === "function") {
    steps = adaptPipelineForRun(steps);
  }
  if (!state.outputOriginal && state.inputsOriginal.length === 0) {
    throw new Error("실행할 입력 또는 출력 파일이 없습니다");
  }

  state.inputs = [];
  state.inputsOriginal.forEach(orig => {
    const cloned = cloneFileRecord(orig);
    cloned.originalBuffer = orig.originalBuffer || null;
    state.inputs.push(cloned);
  });

  if (state.outputTemplates && state.outputTemplates.length) {
    state.output = null;
    state.outputTemplates.forEach((tpl, idx) => {
      const source = tpl.original || tpl.file;
      const file = cloneFileRecord(source);
      file.originalBuffer = source.originalBuffer || null;
      state.outputTemplates[idx] = { ...tpl, file, original: source };
    });
    if (state.activeOutputIndex < 0 || !state.outputTemplates[state.activeOutputIndex]) {
      state.activeOutputIndex = 0;
    }
    state.output = state.outputTemplates[state.activeOutputIndex].file;
    state.outputOriginal = state.outputTemplates[state.activeOutputIndex].original;
  } else if (state.outputOriginal) {
    const buf = state.outputOriginal.originalBuffer;
    state.output = null;
    state.output = deepClone({ ...state.outputOriginal, originalBuffer: null });
    state.output.originalBuffer = buf;
  } else {
    state.output = null;
  }

  const inputsMap = {};
  state.inputs.forEach(f => { inputsMap[f.name] = f.sheets; });
  const outputSheets = state.output ? state.output.sheets : {};
  const outputFileId = state.outputTemplates && state.outputTemplates.length ? "output:" + state.activeOutputIndex : "output";
  const rowProxyCache = new WeakMap();
  const sheetProxyCache = new WeakMap();
  const clearedValueCells = {};
  const clearThenSetKey = (fileId, sheetName, r, c) => `${fileId}\u0000${sheetName}\u0000${r}\u0000${c}`;
  const trackClearThenSet = (fileId, sheetName, r, c, value) => {
    if (!fileId || !sheetName) return;
    const key = clearThenSetKey(fileId, sheetName, r, c);
    if (value === "") {
      clearedValueCells[key] = true;
      return;
    }
    if (clearedValueCells[key]) {
      delete clearedValueCells[key];
      clearFormulaCellMetadataForFileId(fileId, sheetName, r, c);
    }
  };
  const trackedRowProxy = (row, fileId, sheetName, r) => {
    if (!row || typeof row !== "object") return row;
    const key = `${fileId}\u0000${sheetName}\u0000${r}`;
    let cached = rowProxyCache.get(row);
    if (cached && cached[key]) return cached[key];
    if (!cached) {
      cached = {};
      rowProxyCache.set(row, cached);
    }
    cached[key] = new Proxy(row, {
      set(target, prop, value) {
        target[prop] = value;
        const c = Number(prop);
        if (Number.isInteger(c) && c >= 0) trackClearThenSet(fileId, sheetName, r, c, value);
        return true;
      },
    });
    return cached[key];
  };
  const trackedSheetRowsProxy = (sheet, fileId, sheetName) => {
    if (!sheet || typeof sheet !== "object") return sheet;
    return new Proxy(sheet, {
      get(target, prop) {
        const value = target[prop];
        const r = Number(prop);
        if (Number.isInteger(r) && r >= 0 && Array.isArray(value)) {
          return trackedRowProxy(value, fileId, sheetName, r);
        }
        return value;
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });
  };
  const trackedSheetsProxy = (sheetsObj, fileId) => {
    if (!sheetsObj || typeof sheetsObj !== "object") return sheetsObj;
    let cached = sheetProxyCache.get(sheetsObj);
    if (cached && cached[fileId]) return cached[fileId];
    if (!cached) {
      cached = {};
      sheetProxyCache.set(sheetsObj, cached);
    }
    cached[fileId] = new Proxy(sheetsObj, {
      get(target, prop) {
        if (typeof prop === "symbol") return target[prop];
        const key = Object.prototype.hasOwnProperty.call(target, prop) ? prop :
          (typeof fuzzyGetKey === "function" ? fuzzyGetKey(target, String(prop)) : null);
        if (!key) return undefined;
        const sheet = target[key];
        return Array.isArray(sheet) ? trackedSheetRowsProxy(sheet, fileId, String(key)) : sheet;
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
      ownKeys(target) {
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, prop) {
        return Object.getOwnPropertyDescriptor(target, prop) || { configurable: true, enumerable: true, writable: true, value: target[prop] };
      },
    });
    return cached[fileId];
  };

  // 유사도 매칭 Proxy로 감싸기 (item 1).
  // 각 시트 객체도 fuzzy proxy 로 감싸서 시트명/컬럼명 모두 관용적으로 처리.
  const wrapSheets = (sheetsObj) => {
    if (!sheetsObj || typeof sheetsObj !== "object") return sheetsObj;
    return (typeof fuzzyProxy === "function") ? fuzzyProxy(sheetsObj, { cache: state.fuzzyResolution }) : sheetsObj;
  };
  const wrappedInputs = {};
  Object.keys(inputsMap).forEach(fileName => {
    wrappedInputs[fileName] = wrapSheets(trackedSheetsProxy(inputsMap[fileName], "input:" + fileName));
  });
  const proxiedInputs = (typeof fuzzyProxy === "function")
    ? fuzzyProxy(wrappedInputs, { cache: state.fuzzyResolution })
    : wrappedInputs;
  const proxiedOutput = wrapSheets(trackedSheetsProxy(outputSheets, outputFileId));

  // 사용자 코드에서 쓸 수 있는 헬퍼 — `col(sheet, "이름")` 등.
  const helpers = {
    col: typeof col === "function" ? col : null,
    findColumnGlobal: typeof findColumnGlobal === "function" ? findColumnGlobal : null,
    findInputBySheet: typeof findInputBySheet === "function" ? findInputBySheet : null,
    similarity: typeof similarity === "function" ? similarity : null,
    normalizeText: typeof normalizeText === "function" ? normalizeText : ((v) => String(v || "").trim().toLowerCase().replace(/\s+/g, "")),
    replaceNormalizedText: typeof replaceNormalizedText === "function" ? replaceNormalizedText : ((v) => String(v ?? "")),
    includesNormalizedText: typeof includesNormalizedText === "function" ? includesNormalizedText : ((v, s) => String(v || "").trim().toLowerCase().replace(/\s+/g, "").includes(String(s || "").trim().toLowerCase().replace(/\s+/g, ""))),
    equalsNormalizedText: typeof equalsNormalizedText === "function" ? equalsNormalizedText : ((v, s) => String(v || "").trim().toLowerCase().replace(/\s+/g, "") === String(s || "").trim().toLowerCase().replace(/\s+/g, "")),
    headerRowIndex: typeof headerRowIndex === "function" ? headerRowIndex : (() => 0),
    dataStartRowIndex: typeof dataStartRowIndex === "function" ? dataStartRowIndex : (() => 1),
    excelRowToIndex: typeof excelRowToIndex === "function" ? excelRowToIndex : ((n) => Math.max(0, Number(n) - 1)),
  };

  state.lastError = null;
  steps.forEach((step, stepIdx) => {
    if (!isStepEnabled(step)) return;
    const beforeStep = options.onBeforeStep ? options.onBeforeStep({ step, stepIdx }) : null;
    if (step.manualEdit && applyManualEditForPipeline(step.manualEdit, inputsMap, outputSheets)) {
      if (options.onStepApplied) {
        syncRuntimeFileRecords(inputsMap);
        options.onStepApplied({ step, stepIdx, beforeStep });
      }
      return;
    }
    let fn;
    try {
      fn = new Function("inputs", "output", "col", "findColumnGlobal", "findInputBySheet", "similarity", "normalizeText", "replaceNormalizedText", "includesNormalizedText", "equalsNormalizedText",
        "headerRowIndex", "dataStartRowIndex", "excelRowToIndex",
        "insertColumns", "copyColumns", "deleteColumns", "shiftFormulaText", "setCellValue",
        step.code +
        "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };"
      );
    } catch (err) {
      state.lastError = {
        stepIdx, description: step.description || `Step ${stepIdx + 1}`,
        stepId: step.id || null,
        code: step.code || "",
        message: "코드 컴파일 오류: " + err.message, stack: err.stack || "",
      };
      throw _stepError(state.lastError);
    }
    let result;
    try {
      result = fn(proxiedInputs, proxiedOutput,
        helpers.col, helpers.findColumnGlobal, helpers.findInputBySheet, helpers.similarity, helpers.normalizeText, helpers.replaceNormalizedText, helpers.includesNormalizedText, helpers.equalsNormalizedText,
        helpers.headerRowIndex, helpers.dataStartRowIndex, helpers.excelRowToIndex,
        typeof insertColumns === "function" ? insertColumns : null,
        typeof copyColumns === "function" ? copyColumns : null,
        typeof deleteColumns === "function" ? deleteColumns : null,
        typeof shiftFormulaText === "function" ? shiftFormulaText : null,
        typeof setCellValue === "function" ? setCellValue : null);
    } catch (err) {
      state.lastError = {
        stepIdx, description: step.description || `Step ${stepIdx + 1}`,
        stepId: step.id || null,
        code: step.code || "",
        message: err.message || String(err), stack: err.stack || "",
      };
      throw _stepError(state.lastError);
    }
    if (result && typeof result === "object" && !Array.isArray(result)) {
      if (result.inputs && typeof result.inputs === "object") {
        Object.keys(result.inputs).forEach(name => {
          // 결과로 새 inputs[name]을 받으면 기존 키에 fuzzy match해서 쓰거나 새로 추가
          if (!inputsMap[name]) inputsMap[name] = result.inputs[name];
          else Object.assign(inputsMap[name], result.inputs[name]);
        });
      }
      if (state.output && result.output && typeof result.output === "object") {
        Object.keys(result.output).forEach(k => { state.output.sheets[k] = result.output[k]; });
      } else if (state.output && !result.inputs) {
        Object.keys(result).forEach(k => { state.output.sheets[k] = result[k]; });
      }
    }
    if (options.onStepApplied) {
      syncRuntimeFileRecords(inputsMap);
      options.onStepApplied({ step, stepIdx, beforeStep });
    }
  });

  syncRuntimeFileRecords(inputsMap);

  if (state.output) {
    syncFileMetadata(state.output);
    if (state.outputTemplates && state.activeOutputIndex >= 0 && state.outputTemplates[state.activeOutputIndex]) {
      state.outputTemplates[state.activeOutputIndex].file = state.output;
      state.outputTemplates[state.activeOutputIndex].original = state.outputOriginal;
    }
  }
  (state.outputTemplates || []).forEach(tpl => {
    if (tpl && tpl.file) syncFileMetadata(tpl.file);
  });

  // 수식 재평가 (item 10) — 모든 파일/시트의 수식을 현재 데이터로 다시 계산.
  recomputeAllFormulas();

  // 적용 후에도 사용자가 보고 있던 시뮬레이터 화면을 유지한다.
  const currentFile = getFile(state.currentFileId);
  if (!currentFile) {
    if (state.outputTemplates && state.outputTemplates.length) {
      const idx = state.activeOutputIndex >= 0 ? state.activeOutputIndex : 0;
      state.currentFileId = "output:" + idx;
      state.currentSheet = state.outputTemplates[idx].file.sheetNames[0] || null;
    } else if (state.inputs[0]) {
      state.currentFileId = "input:" + state.inputs[0].name;
      state.currentSheet = state.inputs[0].sheetNames[0] || null;
    } else {
      state.currentFileId = null;
      state.currentSheet = null;
    }
  } else if (state.currentSheet && !currentFile.sheetNames.includes(state.currentSheet)) {
    state.currentSheet = currentFile.sheetNames[0] || null;
  } else if (!state.currentSheet) {
    state.currentSheet = currentFile.sheetNames[0] || null;
  }

  renderInputList();
  renderOutputChip();
  refreshTabs();
  renderExcelViewer();
  flashFilled();
}

function runPipelineRealtime(steps) {
  steps = steps || state.pipeline;
  const changedByStep = [];
  runPipeline(steps, {
    onBeforeStep: ({ stepIdx }) => captureCurrentViewSnapshot(`before-${stepIdx}`),
    onStepApplied: ({ step, stepIdx, beforeStep }) => {
      const afterStep = captureCurrentViewSnapshot(`after-${stepIdx}`);
      const localChanges = diffViewSnapshots(beforeStep, afterStep);
      changedByStep.push({ stepIdx, count: localChanges.length });
      renderExcelViewer();
      flashChangedViewCells(localChanges);
      requestBackendViewDiff(beforeStep, afterStep, step, stepIdx);
    },
  });
  return changedByStep;
}

function captureCurrentViewSnapshot(label) {
  const file = getFile(state.currentFileId);
  const sheet = state.currentSheet;
  if (!file || !sheet) return { label, fileId: state.currentFileId, sheet, cells: [] };
  const aoa = (file.sheets && file.sheets[sheet]) || [];
  const viewer = document.querySelector(".right-page.active .excel-viewer") || $("excel-viewer") || $("runner-excel-viewer");
  const cells = [];
  const seen = new Set();
  const addCell = (r, c) => {
    const key = r + ":" + c;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ r, c, value: aoa[r] && aoa[r][c] !== undefined ? aoa[r][c] : "" });
  };
  if (viewer) {
    viewer.querySelectorAll("td[data-r][data-c]").forEach(td => {
      addCell(Number(td.dataset.r), Number(td.dataset.c));
    });
  }
  if (!cells.length) {
    const rows = Math.min(120, aoa.length);
    for (let r = 0; r < rows; r++) {
      const cols = Math.min(40, aoa[r] ? aoa[r].length : 0);
      for (let c = 0; c < cols; c++) addCell(r, c);
    }
  }
  return { label, fileId: state.currentFileId, sheet, cells };
}

function diffViewSnapshots(before, after) {
  if (!before || !after || before.fileId !== after.fileId || before.sheet !== after.sheet) return [];
  const prev = new Map((before.cells || []).map(cell => [cell.r + ":" + cell.c, normalizeDiffValue(cell.value)]));
  return (after.cells || []).filter(cell => prev.get(cell.r + ":" + cell.c) !== normalizeDiffValue(cell.value));
}

function normalizeDiffValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null) return "";
  return String(value);
}

function flashChangedViewCells(changes) {
  if (!changes || !changes.length) return;
  ["excel-viewer", "runner-excel-viewer"].forEach(id => {
    const viewer = $(id);
    if (!viewer) return;
    changes.forEach(cell => {
      const td = viewer.querySelector(`td[data-r="${cell.r}"][data-c="${cell.c}"]`);
      if (td) {
        td.classList.add("flash");
        setTimeout(() => td.classList.remove("flash"), 1400);
      }
    });
  });
}

function requestBackendViewDiff(before, after, step, stepIdx) {
  if (!before || !after || !window.fetch || location.protocol === "file:") return;
  fetch("/api/diff/current-view", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      stepIdx,
      description: step && step.description,
      before,
      after,
    }),
  }).catch(() => {});
}

async function runPipelinePreferBackend(options = {}) {
  const stepsForRun = options.pipeline || state.pipeline;
  if (shouldRunPipelineAsVba(stepsForRun)) {
    return runVbaPipelinePreferLive({ ...options, pipeline: stepsForRun });
  }
  if (typeof canRunPipelineOnBackend === "function" && canRunPipelineOnBackend()) {
    try {
      const result = await runPipelineOnBackend(options);
      toast("백엔드 실행 결과를 현재 화면에 반영했습니다", "success");
      return result;
    } catch (err) {
      console.warn("Backend pipeline failed, falling back to browser execution:", err);
      if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
        throw err;
      }
      toast("백엔드 실행이 실패해 기존 방식으로 실행합니다", "error");
    }
  }
  return runPipelineRealtime(options.pipeline);
}

function syncRuntimeFileRecords(inputsMap) {
  state.inputs.forEach(file => {
    file.sheets = inputsMap[file.name] || {};
    syncFileMetadata(file);
  });

  if (state.output) {
    syncFileMetadata(state.output);
    if (state.outputTemplates && state.activeOutputIndex >= 0 && state.outputTemplates[state.activeOutputIndex]) {
      state.outputTemplates[state.activeOutputIndex].file = state.output;
      state.outputTemplates[state.activeOutputIndex].original = state.outputOriginal;
    }
  }
  (state.outputTemplates || []).forEach(tpl => {
    if (tpl && tpl.file) syncFileMetadata(tpl.file);
  });
}

function clearPipelineExecutionMemory(options = {}) {
  if (!options.keepViewer) clearViewerDomForPipelineRun();
}

function clearViewerDomForPipelineRun() {
  ["excel-viewer", "runner-excel-viewer"].forEach(id => {
    const viewer = $(id);
    if (!viewer) return;
    viewer.innerHTML = `<div class="excel-empty">
      <div class="big-ico">…</div>
      <div>실행 준비 중입니다</div>
      <div>대용량 파일 메모리를 정리하고 있습니다</div>
    </div>`;
  });
}

// runPipeline 에서 발생한 step 오류를 풍부한 메시지로 감싸 던진다 (item 9).
function _stepError(info) {
  const stepLabel = `Step ${info.stepIdx + 1}` + (info.description ? ` (${info.description})` : "");
  const err = new Error(`${stepLabel} 실행 중 오류 — ${info.message}`);
  err._stepInfo = info;
  return err;
}

function attachPipelineStepError(err, step, stepIdx, extra = {}) {
  const numericIdx = Number(stepIdx);
  const currentInfo = (err && (err._stepInfo || err.errorInfo)) || {};
  const inferredLanguage = step && typeof inferPipelineStepLanguage === "function"
    ? inferPipelineStepLanguage(step)
    : "";
  const info = {
    stepIdx: Number.isInteger(numericIdx) && numericIdx >= 0 ? numericIdx : -1,
    stepId: (step && (step.id || step.stepId)) || currentInfo.stepId || null,
    description: (step && step.description) || currentInfo.description || "",
    code: (step && step.code) || currentInfo.code || "",
    language: (step && step.language) || inferredLanguage || currentInfo.language || "",
    message: currentInfo.message || (err && err.message) || String(err || ""),
    stack: currentInfo.stack || (err && err.stack) || "",
    ...extra,
  };
  if (err && typeof err === "object") {
    err._stepInfo = info;
    err.errorInfo = info;
  }
  return err;
}

// 모든 파일/시트의 수식을 현재 데이터로 재평가해 state.formulaResults 에 저장.
// 시뮬레이터 렌더 시 이 결과로 셀 표시값을 덮어쓴다.
function recomputeAllFormulas() {
  if (typeof recomputeSheetFormulas !== "function") return;
  state.formulaResults = {};
  const filesById = [];
  state.inputs.forEach(f => filesById.push({ id: "input:" + f.name, file: f }));
  (state.outputTemplates || []).forEach((tpl, idx) => {
    if (tpl && tpl.file) filesById.push({ id: "output:" + idx, file: tpl.file });
  });
  if (state.output) filesById.push({ id: "output", file: state.output });
  if (isHeavyFormulaRecompute(filesById)) return;
  filesById.forEach(({ id, file }) => {
    if (!file.formulas) return;
    state.formulaResults[id] = {};
    Object.keys(file.formulas).forEach(sheetName => {
      const aoa = file.sheets[sheetName] || [];
      const cached = file.originalFormulaValues && file.originalFormulaValues[sheetName];
      const computed = recomputeSheetFormulas(aoa, file.formulas[sheetName], cached);
      if (computed) state.formulaResults[id][sheetName] = computed;
    });
  });
}

function isHeavyFormulaRecompute(filesById) {
  const FORMULA_RECOMPUTE_CELL_LIMIT = 250000;
  let cells = 0;
  for (const { file } of filesById) {
    Object.values((file && file.sheets) || {}).forEach(sheet => {
      cells += (sheet || []).reduce((sum, row) => sum + (row ? row.length : 0), 0);
    });
    if (cells > FORMULA_RECOMPUTE_CELL_LIMIT) return true;
  }
  return false;
}

function flashFilled() {
  const currentFile = getFile(state.currentFileId);
  if (!currentFile || !state.currentSheet) return;
  let original = typeof getOriginalFile === "function" ? getOriginalFile(state.currentFileId) : null;
  if (!original) return;
  const cur = currentFile.sheets[state.currentSheet] || [];
  const orig = original.sheets[state.currentSheet] || [];
  setTimeout(() => {
    ["excel-viewer", "runner-excel-viewer"].forEach(id => {
      const root = $(id);
      if (!root) return;
      root.querySelectorAll("td[data-r]").forEach(td => {
        const r = Number(td.dataset.r);
        const c = Number(td.dataset.c);
        const o = orig[r] && orig[r][c];
        const n = cur[r] && cur[r][c];
        if (String(o || "") !== String(n || "")) {
          if (!td.classList.contains("selected-cell") && !td.classList.contains("selected-range")) {
            td.classList.add("flash");
          }
        }
      });
    });
  }, 50);
}

function renderPipeline() {
  const list = $("pipeline-list");
  ensurePipelineStepIds();
  $("pipe-count").textContent = state.pipeline.length + " 단계";
  if (state.pipeline.length === 0) {
    list.innerHTML = `<div class="pipeline-empty">아직 단계가 없습니다. AI가 생성한 코드를 "적용"하면 추가됩니다.</div>`;
    if (state.editingStepId) state.editingStepId = null;
    if (typeof renderEditingBanner === "function") renderEditingBanner();
    renderRunnerWorkflow();
    return;
  }
  // 편집 중이던 step이 사라졌으면 정리
  if (state.editingStepId && !state.pipeline.some(s => s.id === state.editingStepId)) {
    state.editingStepId = null;
  }
  list.innerHTML = "";
  state.pipeline.forEach((step, idx) => {
    const item = document.createElement("div");
    item.className = "pipeline-item";
    if (!isStepEnabled(step)) item.classList.add("disabled");
    if (state.editingStepId === step.id) item.classList.add("editing");
    const editing = state.editingStepId === step.id;
    const runtime = getPipelineRuntimeStatus(step.id);
    if (runtime && runtime.status) item.classList.add(`runtime-${runtime.status}`);
    const runtimeBadge = runtime && runtime.label
      ? `<span class="step-runtime ${escapeHtml(runtime.status || "")}">${escapeHtml(runtime.label)}</span>`
      : "";
    item.innerHTML = `
      <div class="step-n">${idx+1}</div>
      <div class="step-label" title="${escapeHtml(step.description)}">${escapeHtml(step.description)}${runtimeBadge}</div>
      <button class="step-toggle ${isStepEnabled(step) ? 'active' : ''}" title="계산 반영 여부">${isStepEnabled(step) ? 'ON' : 'OFF'}</button>
      <button class="step-edit ${editing ? 'active' : ''}" title="${editing ? '수정 모드 해제' : '수정'}">✎</button>
      <button class="step-del" title="삭제">✕</button>
    `;
    item.querySelector(".step-toggle").onclick = (e) => {
      e.stopPropagation();
      const stepId = step.id;
      const currentIdx = state.pipeline.findIndex(s => s.id === stepId);
      if (currentIdx < 0) return;
      if (typeof pushHistory === "function") pushHistory("단계 적용 여부 변경");
      state.pipeline[currentIdx] = { ...state.pipeline[currentIdx], enabled: !isStepEnabled(state.pipeline[currentIdx]) };
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-toggled");
      reconcilePipelineSimulationAfterEdit().catch(err => reportPipelineError(err));
    };
    item.querySelector(".step-edit").onclick = (e) => {
      e.stopPropagation();
      toggleEditStep(step.id);
    };
    item.querySelector(".step-del").onclick = (e) => {
      e.stopPropagation();
      const stepId = step.id;
      const currentIdx = state.pipeline.findIndex(s => s.id === stepId);
      if (currentIdx < 0) return;
      if (typeof pushHistory === "function") pushHistory("단계 삭제");
      if (state.editingStepId === stepId) state.editingStepId = null;
      state.pipeline.splice(currentIdx, 1);
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-deleted");
      reconcilePipelineSimulationAfterEdit().catch(err => reportPipelineError(err));
    };
    list.appendChild(item);
  });
  if (typeof renderEditingBanner === "function") renderEditingBanner();
  renderRunnerWorkflow();
}

// 0.4.9 리모콘 모델: VBA 엔진에서 토글/삭제/편집/순서변경 등으로 파이프라인이 바뀌면
// 라이브 워크북을 원본으로 리셋한 뒤 enabled VBA 스텝을 순서대로 다시 적용한다.
async function reapplyVbaPipelineToLive(excelId, options = {}) {
  const perfStartedAt = performance.now();
  let prehideMs = 0;
  let requestMs = 0;
  const sourceSteps = options.steps || state.pipeline;
  const steps = (sourceSteps || [])
    .filter(s => isStepEnabled(s) && (s.language === "vba" || (typeof inferPipelineStepLanguage === "function" && inferPipelineStepLanguage(s) === "vba")))
    .map(s => ({
      stepIdx: (sourceSteps || []).indexOf(s),
      stepId: s.id || null,
      description: s.description || "",
      code: s.code || "",
      language: s.language || (typeof inferPipelineStepLanguage === "function" ? inferPipelineStepLanguage(s) : "vba"),
    }));
  if (window.runnerSetRunning) window.runnerSetRunning(true);
  if (typeof muteExcelMirrorForPipeline === "function") muteExcelMirrorForPipeline(excelId);
  if (typeof beginExcelMirrorApplyLoading === "function") beginExcelMirrorApplyLoading("VBA 재적용 중...");
  try {
    if (typeof hideAllExcelMirrorWindows === "function") {
      const started = performance.now();
      try {
        await hideAllExcelMirrorWindows();
      } catch (_) {
      } finally {
        prehideMs = performance.now() - started;
      }
    }
    const requestStarted = performance.now();
    const data = await postExcelMirror("/api/excel/run-vba-pipeline", { excelId, steps, reset: true });
    requestMs = performance.now() - requestStarted;
    if (typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
    if (typeof releaseExcelMirrorPipelineMute === "function") releaseExcelMirrorPipelineMute(excelId);
    // 리셋 과정에서 창이 잠깐 offscreen 으로 갔다 오므로 위치/최상단 보정.
    try { await positionExcelMirrorWindow(excelId, { force: true }); } catch (_) {}
    try { stabilizeExcelMirrorZOrder(excelId); } catch (_) {}
    if (window.runnerSetDone) window.runnerSetDone();
    recordVbaDebugTiming({
      action: "reapply",
      steps: steps.length,
      prehideMs,
      startRequestMs: requestMs,
      totalClientMs: performance.now() - perfStartedAt,
      server: (data && data.debugTimings) || {},
    });
    return data;
  } catch (err) {
    if (err && (err._stepInfo || err.errorInfo)) {
      const info = err._stepInfo || err.errorInfo;
      err._stepInfo = { ...info, stepIdx: Number(info.stepIdx ?? -1) };
      err.errorInfo = err._stepInfo;
    } else if (steps.length === 1) {
      attachPipelineStepError(err, steps[0], steps[0].stepIdx);
    }
    restoreVbaExcelAfterError(excelId);
    if (window.runnerSetRunning) window.runnerSetRunning(false);
    throw err;
  }
}

async function reconcilePipelineSimulationAfterEdit(options = {}) {
  // VBA 엔진 + 라이브 세션이면 파이프라인 재동기화를 라이브 리셋+재적용으로 처리.
  if (typeof getSkillEngine === "function" && getSkillEngine() === "vba") {
    const liveExcelId = vbaTargetExcelId();
    if (liveExcelId) return reapplyVbaPipelineToLive(liveExcelId);
  }
  const steps = options.steps || state.pipeline;
  const hasAnyOriginal = !!state.outputOriginal || ((state.inputsOriginal || []).length > 0);
  if (!hasAnyOriginal) return;
  const mustUseBackend = pipelineUsesPython(steps) ||
    (typeof shouldDeferImmediatePipelineRun === "function" && shouldDeferImmediatePipelineRun());
  if (!state.pipeline.length) {
    if (mustUseBackend) {
      if (window.runnerSetRunning) window.runnerSetRunning(true);
      clearPipelineExecutionMemory({ keepViewer: true });
      try {
        await runPipelinePreferBackend({
          pipeline: [],
          baseMode: "original",
        });
        if (window.runnerSetDone) window.runnerSetDone();
      } catch (err) {
        if (window.runnerSetRunning) window.runnerSetRunning(false);
        throw err;
      }
      return;
    }
    runPipeline([]);
    refreshTabs();
    renderExcelViewer();
    return;
  }
  if (!mustUseBackend && !options.forceBackend && shouldUseFastPreviewPipelineRun(steps)) {
    runPipeline(steps);
    if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
      window.backendCurrentCacheDirty = true;
    }
    return;
  }
  if (mustUseBackend) {
    if (window.runnerSetRunning) window.runnerSetRunning(true);
    clearPipelineExecutionMemory({ keepViewer: true });
    try {
      await runPipelinePreferBackend({
        pipeline: steps,
        baseMode: options.backendBaseMode || "original",
      });
      toast("스킬 변경 사항을 시뮬레이터에 다시 반영했습니다", "success");
      if (window.runnerSetDone) window.runnerSetDone();
    } catch (err) {
      if (window.runnerSetRunning) window.runnerSetRunning(false);
      throw err;
    }
    return;
  }
  runPipeline(steps);
}

function refreshRunButton() {
  const hasAnyFile = !!state.output || state.inputs.length > 0;
  const hasDownloadableFiles =
    (state.inputs && state.inputs.length > 0) ||
    (state.outputTemplates && state.outputTemplates.length > 0) ||
    !!state.output;
  const hasSteps = activePipelineSteps(state.pipeline).length > 0;
  $("btn-run").disabled = !(hasAnyFile && hasSteps);
  $("btn-save").disabled = !hasSteps;
  $("btn-download").disabled = !hasDownloadableFiles;
  renderRunnerWorkflow();
}

function getActivePipelineStepIds() {
  return (state.pipeline || []).filter(isStepEnabled).map(step => step && step.id).filter(Boolean);
}

function setGeneratorRunLoading(running, text) {
  const btn = $("btn-run");
  if (!btn) return;
  if (running) {
    if (!btn.dataset.defaultText) btn.dataset.defaultText = btn.textContent || "\u25B6 \uC804\uCCB4 \uC2E4\uD589";
    btn.disabled = true;
    btn.classList.add("running");
    btn.textContent = text || "\uC2E4\uD589 \uC911...";
    return;
  }
  btn.classList.remove("running");
  btn.textContent = btn.dataset.defaultText || "\u25B6 \uC804\uCCB4 \uC2E4\uD589";
  refreshRunButton();
}

window.generatorSetProgress = function(text) {
  const btn = $("btn-run");
  if (!btn || !btn.classList.contains("running")) return;
  btn.textContent = text || "\uC2E4\uD589 \uC911...";
};

$("btn-run").onclick = async () => {
  const activeStepIds = getActivePipelineStepIds();
  setGeneratorRunLoading(true, "\uC2E4\uD589 \uC900\uBE44 \uC911...");
  setPipelineRuntimeStatus(activeStepIds, "running", "\uC2E4\uD589 \uC911");
  try {
    clearPipelineExecutionMemory({ keepViewer: true });
    await runPipelinePreferBackend();
    setPipelineRuntimeStatus(activeStepIds, "applied", "\uC801\uC6A9\uB428");
    toast(`${state.pipeline.length}개 단계 실행 완료`, "success");
  } catch (err) {
    setPipelineRuntimeStatus(activeStepIds, "error", "\uC624\uB958");
    renderExcelViewer();
    reportPipelineError(err);
  } finally {
    setGeneratorRunLoading(false);
  }
};

// item 9: 어느 단계에서 어떤 사유로 실패했는지 토스트 + 채팅 panel 에 모두 노출.
function hasErrorRecoverySeed(info) {
  if (info && (Number(info.stepIdx) >= 0 || !!info.stepId || !!info.code || !!info.description)) return true;
  // 에러가 특정 step을 못 짚었더라도(백엔드 비-스텝 오류 등) 파이프라인에 적용 가능한 스킬이 있으면
  // 마지막 단계를 기준으로 복구를 시도할 수 있게 버튼을 활성화한다.
  return Array.isArray(state.pipeline) && state.pipeline.some(s => s && s.enabled !== false && s.code);
}

function reportPipelineError(err, options) {
  options = options || {};
  const rawInfo = (err && (err._stepInfo || err.errorInfo)) || null;
  const info = rawInfo ? {
    stepIdx: Number(rawInfo.stepIdx ?? -1),
    stepId: rawInfo.stepId || null,
    description: rawInfo.description || "",
    code: rawInfo.code || "",
    language: rawInfo.language || "",
    message: rawInfo.message || (err && err.message) || String(err || ""),
    stack: rawInfo.stack || (err && err.stack) || "",
    recoverable: rawInfo.recoverable !== false,
  } : {
    stepIdx: -1,
    stepId: null,
    description: "",
    code: "",
    message: (err && err.message) || String(err || ""),
    stack: (err && err.stack) || "",
    recoverable: false,
  };
  const stepLabel = Number(info.stepIdx) >= 0 ? `Step ${info.stepIdx + 1}` : "\uC2A4\uD0AC";
  toast(`${stepLabel}을 적용하지 못했습니다. 안내 메시지를 확인하세요.`, "error");
  if (options.runner) showRunnerPipelineError(err, options);
  // 채팅 영역에도 시스템 메시지로 남긴다 (chat 가 활성일 때만).
  const chatBox = document.getElementById("chat-messages");
  if (chatBox) {
    const div = document.createElement("div");
    div.className = "msg system error";
    div.innerHTML = `
      <div class="error-title"><b>스킬을 적용하지 못했습니다</b></div>
      <div class="error-desc">${Number(info.stepIdx) >= 0 ? `Step ${info.stepIdx + 1}${info.description ? ` · ${escapeHtml(info.description)}` : ""}` : "backend/runner stage"}</div>
      <div class="error-help">입력 파일, 시트명, 선택 범위가 요청과 맞는지 확인한 뒤 스킬을 수정하거나 다시 생성해 주세요.</div>
      <button class="error-recover-btn" type="button">에러 복구 시도</button>
      <details class="error-details">
        <summary>상세 오류 보기</summary>
        <pre>${escapeHtml(info.message || err.message || String(err))}${info.stack ? "\n\n" + escapeHtml(info.stack) : ""}</pre>
      </details>
    `;
    chatBox.appendChild(div);
    const recoverBtn = div.querySelector(".error-recover-btn");
    if (recoverBtn) {
      // 복구 버튼은 항상 활성화한다(사용자 요구). 시드가 없으면 requestErrorRecovery 가
      // 마지막 적용 가능한 단계로 폴백하거나 안내 토스트를 띄운다.
      recoverBtn.disabled = false;
      recoverBtn.onclick = () => {
        if (recoverBtn.disabled) return;
        recoverBtn.disabled = true;
        recoverBtn.textContent = "복구 요청 중...";
        if (typeof requestErrorRecovery === "function") {
          requestErrorRecovery(info.stepIdx, {
            stepIdx: Number(info.stepIdx) >= 0 ? Number(info.stepIdx) : -1,
            stepId: info.stepId || null,
            description: info.description || "",
            code: info.code || "",
            language: info.language || "",
            message: info.message || err.message || String(err),
            stack: info.stack || "",
            compatibilityCheck: !!options.compatibilityCheck,
          }).finally(() => {
            recoverBtn.textContent = "에러 복구 시도";
            recoverBtn.disabled = false;
          });
        }
      };
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

function resolveRunnerRecoveryStepIndex(errorInfo) {
  if (typeof resolveErrorRecoveryStepIndex === "function") {
    return resolveErrorRecoveryStepIndex(errorInfo && errorInfo.stepIdx, errorInfo || {});
  }
  const idx = Number(errorInfo && errorInfo.stepIdx);
  if (Number.isInteger(idx) && idx >= 0 && state.pipeline[idx]) return idx;
  const stepId = errorInfo && errorInfo.stepId;
  if (stepId) {
    const byId = (state.pipeline || []).findIndex(step => step && step.id === stepId);
    if (byId >= 0) return byId;
  }
  const code = String((errorInfo && errorInfo.code) || "");
  if (code) {
    const byCode = (state.pipeline || []).findIndex(step => String((step && step.code) || "") === code);
    if (byCode >= 0) return byCode;
  }
  return -1;
}

async function attemptRunnerAutoRecovery(errorInfo) {
  const stepIdx = resolveRunnerRecoveryStepIndex(errorInfo || {});
  if (Number.isInteger(stepIdx) && stepIdx >= 0 && state.pipeline[stepIdx]) {
    const originalStep = state.pipeline[stepIdx];
    const adaptedStep = typeof adaptPipelineForRun === "function"
      ? (adaptPipelineForRun([originalStep]) || [originalStep])[0]
      : originalStep;
    if (adaptedStep && adaptedStep.code && adaptedStep.code !== originalStep.code) {
      state.pipeline[stepIdx] = { ...originalStep, code: adaptedStep.code, adaptedForRun: true };
    }
  }

  if (!state.pipeline || !state.pipeline.length) {
    throw new Error("자동 복구할 스킬이 없습니다.");
  }

  if (typeof adaptPipelineForRun === "function") {
    state.pipeline = adaptPipelineForRun(state.pipeline || []);
  }
  ensurePipelineStepIds();
  renderPipeline();
  if (typeof renderRunnerWorkflow === "function") renderRunnerWorkflow();

  clearRunnerPipelineError();
  if (window.runnerSetRunning) window.runnerSetRunning(true);
  clearPipelineExecutionMemory({ keepViewer: true });
  try {
    await runPipelinePreferBackend();
    toast("자동 복구 후 실행을 완료했습니다.", "success");
    if (window.runnerSetDone) window.runnerSetDone();
  } catch (err) {
    renderExcelViewer();
    if (window.runnerSetRunning) window.runnerSetRunning(false);
    throw err;
  }
}

function clearRunnerPipelineError() {
  const panel = document.getElementById("runner-error-panel");
  if (!panel) return;
  panel.hidden = true;
  panel.innerHTML = "";
}

function showRunnerPipelineError(err, options) {
  options = options || {};
  const panel = document.getElementById("runner-error-panel");
  if (!panel) return;
  const fallbackInfo = (typeof state !== "undefined" && state.lastError) ? state.lastError : null;
  const info = (err && err._stepInfo) || (err && err.errorInfo) || fallbackInfo || null;
  const hasStep = info && Number(info.stepIdx) >= 0;
  const title = hasStep ? "스킬을 적용하지 못했습니다" : "스킬 실행 중 오류가 발생했습니다";
  const stepText = hasStep
    ? `Step ${Number(info.stepIdx) + 1}${info.description ? ` · ${info.description}` : ""}`
    : "실행기 또는 백엔드 실행 단계";
  const message = (info && info.message) || (err && err.message) || String(err || "");
  const stack = (info && info.stack) || (err && err.stack) || "";
  panel.hidden = false;
  panel.innerHTML = `
    <div class="runner-error-title">
      <span>${escapeHtml(title)}</span>
      <span>확인 필요</span>
    </div>
    <div class="runner-error-step">${escapeHtml(stepText)}</div>
    <div class="runner-error-help">입력 파일명, 시트명, 선택 범위 또는 불러온 스킬의 대상이 현재 파일과 맞는지 확인하세요. 복구 버튼은 현재 파일 구조에 맞게 스킬 참조를 보정한 뒤 다시 실행합니다.</div>
    <div class="runner-error-actions">
      <button class="runner-error-recover" type="button">에러 복구 시도</button>
      <button class="runner-error-open-generator" type="button">생성기에서 보기</button>
    </div>
    <details class="runner-error-details" open>
      <summary>상세 오류 보기</summary>
      <pre>${escapeHtml(message)}${stack ? "\n\n" + escapeHtml(stack) : ""}</pre>
    </details>
  `;
  const recoverBtn = panel.querySelector(".runner-error-recover");
  if (recoverBtn) {
    const runnerStepIdx = resolveRunnerRecoveryStepIndex(info || {});
    const canAutoRecover = Number.isInteger(runnerStepIdx) && runnerStepIdx >= 0 && !!state.pipeline[runnerStepIdx];
    // 복구 버튼은 항상 활성화한다(사용자 요구). 자동 복구 불가하면 LLM 복구 요청으로 폴백.
    recoverBtn.disabled = false;
    recoverBtn.onclick = async () => {
      recoverBtn.disabled = true;
      const originalText = recoverBtn.textContent;
      recoverBtn.textContent = "자동 복구 중...";
      try {
        const recoveryInfo = {
          stepIdx: info && info.stepIdx,
          stepId: info && info.stepId || null,
          description: info && info.description || "",
          code: info && info.code || "",
          language: info && info.language || "",
          message,
          stack,
          compatibilityCheck: !!options.compatibilityCheck,
        };
        if (canAutoRecover) {
          recoverBtn.textContent = "자동 복구 중...";
          await attemptRunnerAutoRecovery(recoveryInfo);
        } else {
          recoverBtn.textContent = "복구 요청 중...";
          await requestErrorRecovery(info && info.stepIdx, recoveryInfo);
        }
      } catch (recoverErr) {
        reportPipelineError(recoverErr, { compatibilityCheck: true, runner: true });
      } finally {
        recoverBtn.textContent = originalText;
        recoverBtn.disabled = false;
      }
    };
  }
  const openBtn = panel.querySelector(".runner-error-open-generator");
  if (openBtn) openBtn.onclick = () => { if (typeof setPage === "function") setPage("generator"); };
}

$("runner-run-btn").onclick = () => {
  if ($("runner-run-btn").disabled) return;
  clearRunnerPipelineError();
  if (window.runnerSetRunning) window.runnerSetRunning(true);
  // Give the UI a tick to paint the ring, then execute
  setTimeout(async () => {
    try {
      clearPipelineExecutionMemory({ keepViewer: true });
      await runPipelinePreferBackend();
      toast(`${state.pipeline.length}개 단계 실행 완료`, "success");
      if (window.runnerSetDone) window.runnerSetDone();
    } catch (err) {
      renderExcelViewer();
      reportPipelineError(err, { compatibilityCheck: true, runner: true });
      if (window.runnerSetRunning) window.runnerSetRunning(false);
    }
  }, 650);
};
$("runner-download-btn").onclick = () => openDownloadModal();
$("runner-load-btn").onclick = () => openLoadDialog();
$("runner-open-generator").onclick = () => setPage("generator");

setupDrop($("drop-logic"), $("logic-files"), async (files) => {
  try {
    await loadLogicFiles(files);
  } catch (err) {
    toast("불러오기 실패: " + err.message, "error");
    console.error(err);
  }
});
