/* ===================================================================
   BACKEND WORKBOOKS (ver3.7)
   =================================================================== */
async function registerWorkbookBackend(file) {
  if (!file || !window.fetch || location.protocol === "file:") return null;
  try {
    const resp = await fetch(`/api/workbooks/upload?name=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: file,
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
  } catch (err) {
    console.warn("Backend workbook registration failed:", err);
    return null;
  }
}

function attachBackendWorkbookMeta(parsed, backendInfo) {
  if (!parsed || !backendInfo || !backendInfo.workbookId) return parsed;
  parsed.backendWorkbookId = backendInfo.workbookId;
  parsed.backendWorkbookMeta = backendInfo.meta || null;
  return parsed;
}

function createBackendPreviewRecord(file, backendInfo) {
  if (!file || !backendInfo || !backendInfo.workbookId || !backendInfo.meta) return null;
  const meta = backendInfo.meta || {};
  const sheetNames = Array.isArray(meta.sheetNames) ? meta.sheetNames.slice() : Object.keys(meta.sheets || {});
  const sheets = {};
  const previewDimensions = {};
  Object.keys(meta.sheets || {}).forEach(sheetName => {
    const info = meta.sheets[sheetName] || {};
    sheets[sheetName] = Array.isArray(info.rows) ? info.rows : [];
    previewDimensions[sheetName] = {
      maxRow: info.maxRow || sheets[sheetName].length || 0,
      maxCol: info.maxCol || Math.max(0, ...sheets[sheetName].map(row => (row || []).length)),
      previewRows: sheets[sheetName].length || 0,
      previewCols: Math.max(0, ...sheets[sheetName].map(row => (row || []).length)),
    };
  });
  const formulas = {};
  const originalFormulaValues = {};
  const formats = {};
  Object.keys(meta.sheets || {}).forEach(sheetName => {
    const info = meta.sheets[sheetName] || {};
    formulas[sheetName] = info.formulas || {};
    originalFormulaValues[sheetName] = info.originalFormulaValues || {};
    formats[sheetName] = Array.isArray(info.formats) ? info.formats : [];
  });
  return {
    name: backendInfo.name || file.name,
    size: file.size || 0,
    sheetNames,
    sheets,
    merges: {},
    styles: {},
    formats,
    displays: {},
    formulas,
    originalFormulaValues,
    tables: {},
    lightweightPreview: true,
    backendOnly: true,
    backendWorkbookId: backendInfo.workbookId,
    backendWorkbookMeta: meta,
    backendPreviewDimensions: previewDimensions,
    backendDownloadUrl: null,
    originalBuffer: null,
  };
}

async function parseFileWithBackendPreview(file) {
  const backendInfo = typeof registerWorkbookBackend === "function" ? await registerWorkbookBackend(file) : null;
  const backendRecord = createBackendPreviewRecord(file, backendInfo);
  if (backendRecord) return backendRecord;
  const parsed = await parseFile(file);
  if (typeof attachBackendWorkbookMeta === "function") attachBackendWorkbookMeta(parsed, backendInfo);
  parsed.originalBuffer = null;
  return parsed;
}

function canRunPipelineOnBackend() {
  const hasBackendInputs = (state.inputsOriginal || []).every(f => !!f.backendWorkbookId);
  const templates = state.outputTemplates || [];
  const hasBackendOutputs = templates.length
    ? templates.every(tpl => tpl && tpl.original && tpl.original.backendWorkbookId)
    : (!state.outputOriginal || !!state.outputOriginal.backendWorkbookId);
  return hasBackendInputs && hasBackendOutputs && window.fetch && location.protocol !== "file:";
}

function hasBackendOnlyWorkbooks() {
  const inputs = state.inputsOriginal || [];
  const templates = state.outputTemplates || [];
  return inputs.some(f => !!(f && f.backendOnly)) ||
    templates.some(tpl => !!(tpl && tpl.original && tpl.original.backendOnly)) ||
    !!(state.outputOriginal && state.outputOriginal.backendOnly);
}

async function runPipelineOnBackend(options = {}) {
  if (!canRunPipelineOnBackend()) throw new Error("backend workbook ids are not ready");
  window.backendPipelineRunToken = (window.backendPipelineRunToken || 0) + 1;
  const runToken = window.backendPipelineRunToken;
  const outputTarget = getBackendOutputTarget();
  const activeSteps = (state.pipeline || []).filter(isStepEnabled).length;
  const startedAt = Date.now();
  let tick = 0;
  const setProgress = (text) => {
    if (typeof window.runnerSetProgress === "function") window.runnerSetProgress(text);
    if (typeof window.generatorSetProgress === "function") window.generatorSetProgress(text);
  };
  setProgress("파일 읽는 중...");
  const progressTimer = setInterval(() => {
    tick += 1;
    const elapsed = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    if (tick < 3) setProgress(`파일 읽는 중... ${elapsed}s`);
    else if (tick < 6) setProgress(`스킬 실행 준비 중... ${elapsed}s`);
    else setProgress(`스킬 실행 중 (${activeSteps}단계) ${elapsed}s`);
  }, 1000);
  try {
    const resp = await fetch("/api/pipeline/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inputs: (state.inputsOriginal || []).map(f => ({
          name: f.name,
          backendWorkbookId: f.backendWorkbookId,
        })),
        output: outputTarget ? {
          name: outputTarget.original.name,
          backendWorkbookId: outputTarget.original.backendWorkbookId,
        } : null,
        pipeline: state.pipeline,
        current: {
          fileId: state.currentFileId,
          outputFileId: outputTarget ? outputTarget.fileId : null,
          sheet: state.currentSheet,
        },
      }),
    });
    setProgress("결과 미리보기 반영 중...");
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    applyBackendPipelineResult(data);
    setProgress("완료");
    return data;
  } finally {
    clearInterval(progressTimer);
  }
}

function getBackendOutputTarget() {
  if (state.outputTemplates && state.outputTemplates.length) {
    const idx = state.activeOutputIndex >= 0 ? state.activeOutputIndex : 0;
    const tpl = state.outputTemplates[idx];
    if (!tpl) return null;
    return { fileId: "output:" + idx, file: tpl.file, original: tpl.original };
  }
  if (state.outputOriginal) return { fileId: "output", file: state.output, original: state.outputOriginal };
  return null;
}

function applyBackendPipelineResult(result) {
  const downloadUrls = result.downloadUrls || {};
  const resultDiffs = result.diffs || {};
  (result.files || []).forEach(fileResult => {
    const file = getFile(fileResult.fileId);
    if (!file || !fileResult.sheets) return;
    if (Array.isArray(fileResult.sheetNames)) {
      const keepSheets = new Set(fileResult.sheetNames);
      Object.keys(file.sheets || {}).forEach(sheet => {
        if (!keepSheets.has(sheet)) delete file.sheets[sheet];
      });
      if (file.backendPreviewDimensions) {
        Object.keys(file.backendPreviewDimensions).forEach(sheet => {
          if (!keepSheets.has(sheet)) delete file.backendPreviewDimensions[sheet];
        });
      }
      file.sheetNames = fileResult.sheetNames.slice();
      if (state.currentFileId === fileResult.fileId && state.currentSheet && !keepSheets.has(state.currentSheet)) {
        state.currentSheet = file.sheetNames[0] || null;
        state.selectedSheets = state.currentSheet ? [state.currentSheet] : [];
        state.selectedCell = null;
        state.selectedRange = null;
        state.selectedRanges = [];
        state.selectionAnchor = null;
      }
    }
    Object.keys(fileResult.sheets).forEach(sheet => {
      file.sheets[sheet] = fileResult.sheets[sheet];
    });
    if (fileResult.formulas && Object.keys(fileResult.formulas).length) {
      file.formulas = file.formulas || {};
      Object.keys(fileResult.formulas).forEach(sheet => {
        file.formulas[sheet] = fileResult.formulas[sheet] || {};
      });
    }
    if (fileResult.formats && Object.keys(fileResult.formats).length) {
      file.formats = file.formats || {};
      Object.keys(fileResult.formats).forEach(sheet => {
        file.formats[sheet] = fileResult.formats[sheet] || [];
      });
    }
    const fileDownloadUrl = downloadUrls[fileResult.fileId] ||
      ((fileResult.fileId === "output" || fileResult.fileId.startsWith("output:")) ? result.downloadUrl : null);
    if (fileDownloadUrl) {
      file.backendDownloadUrl = fileDownloadUrl;
      if ((fileResult.fileId === "output" || fileResult.fileId.startsWith("output:")) && state.output) {
        state.output.backendDownloadUrl = fileDownloadUrl;
      }
    }
    file.backendLastDiffId = result.diffId || null;
    file.backendLastDiff = fileResult.diff || resultDiffs[fileResult.fileId] || null;
    if (fileResult.dimensions) {
      file.backendPreviewDimensions = file.backendPreviewDimensions || {};
      Object.keys(fileResult.dimensions).forEach(sheet => {
        file.backendPreviewDimensions[sheet] = {
          ...(file.backendPreviewDimensions[sheet] || {}),
          ...(fileResult.dimensions[sheet] || {}),
        };
      });
    } else {
      file.backendPreviewDimensions = file.backendPreviewDimensions || {};
      Object.keys(fileResult.sheets || {}).forEach(sheet => {
        const previewRows = fileResult.sheets[sheet] || [];
        const existing = file.backendPreviewDimensions[sheet] || {};
        file.backendPreviewDimensions[sheet] = {
          ...existing,
          maxRow: Math.max(existing.maxRow || 0, previewRows.length || 0),
          maxCol: Math.max(existing.maxCol || 0, ...previewRows.map(row => (row || []).length), 0),
          previewRows: previewRows.length || 0,
          previewCols: Math.max(0, ...previewRows.map(row => (row || []).length), 0),
        };
      });
    }
    syncFileMetadata(file);
  });
  if (typeof recomputeAllFormulas === "function") recomputeAllFormulas();
  refreshTabs();
  renderExcelViewer();
  flashBackendDiff(result);
  flashFilled();
  window.backendCurrentCacheDirty = false;
}

function flashBackendDiff(result) {
  const file = getFile(state.currentFileId);
  if (!file || !file.backendLastDiff || !state.currentSheet) return;
  const sheetDiff = file.backendLastDiff.sheets && file.backendLastDiff.sheets[state.currentSheet];
  if (!sheetDiff || !Array.isArray(sheetDiff.cells) || !sheetDiff.cells.length) return;
  if (typeof flashChangedViewCells === "function") {
    flashChangedViewCells(sheetDiff.cells);
  }
}

async function runPipelineOnBackend(options = {}) {
  if (!canRunPipelineOnBackend()) throw new Error("backend workbook ids are not ready");
  window.backendPipelineRunToken = (window.backendPipelineRunToken || 0) + 1;
  const runToken = window.backendPipelineRunToken;
  const outputTarget = getBackendOutputTarget();
  const startedAt = Date.now();
  const setProgress = (text) => {
    if (typeof window.runnerSetProgress === "function") window.runnerSetProgress(text);
    if (typeof window.generatorSetProgress === "function") window.generatorSetProgress(text);
  };
  const payload = {
    inputs: (state.inputsOriginal || []).map(f => ({
      name: f.name,
      backendWorkbookId: f.backendWorkbookId,
    })),
    output: outputTarget ? {
      name: outputTarget.original.name,
      backendWorkbookId: outputTarget.original.backendWorkbookId,
    } : null,
    pipeline: options.pipeline || state.pipeline,
    baseMode: options.baseMode || "original",
    current: {
      fileId: state.currentFileId,
      outputFileId: outputTarget ? outputTarget.fileId : null,
      sheet: state.currentSheet,
    },
  };

  setProgress("파일 읽는 중...");
  const startResp = await fetch("/api/pipeline/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const startData = await startResp.json();
  if (!startResp.ok || !startData.ok || !startData.jobId) {
    throw new Error(startData.error || `HTTP ${startResp.status}`);
  }

  while (true) {
    await new Promise(resolve => setTimeout(resolve, 120));
    const statusResp = await fetch(`/api/pipeline/status/${encodeURIComponent(startData.jobId)}`);
    const status = await statusResp.json();
    if (!statusResp.ok) throw new Error(status.error || `HTTP ${statusResp.status}`);

    setProgress(formatBackendProgress(status, startedAt));

    if (status.status === "error") {
      const err = new Error(status.error || "백엔드 스킬 실행 중 오류가 발생했습니다.");
      if (status.errorInfo) {
        err._stepInfo = {
          ...status.errorInfo,
          stepIdx: Number(status.errorInfo.stepIdx || 0),
          message: status.errorInfo.message || status.error || err.message,
        };
      }
      err.backendStatus = status;
      throw err;
    }
    if (!status.ok) throw new Error(status.error || `HTTP ${statusResp.status}`);

    if (status.status === "done") {
      if (runToken !== window.backendPipelineRunToken) return status;
      applyBackendPipelineResult(status);
      window.backendCurrentCacheDirty = false;
      setProgress("완료");
      return status;
    }
    if (status.status === "error") {
      throw new Error(status.error || "백엔드 실행 중 오류가 발생했습니다.");
    }
  }
}

function formatBackendProgress(status, startedAt) {
  const elapsed = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
  const stage = status.stage || "실행 중";
  const cur = Number(status.currentStep || 0);
  const total = Number(status.totalSteps || 0);
  const desc = status.stepDescription ? ` · ${status.stepDescription}` : "";
  const stepPart = total ? ` (${Math.min(cur + (status.stepRunning ? 1 : 0), total)}/${total})` : "";
  const eta = estimateRemainingSeconds(status, elapsed);
  const etaPart = eta !== null ? ` · 남은 시간 약 ${formatDuration(eta)}` : "";
  return `${stage}${stepPart}${desc} · 경과 ${formatDuration(elapsed)}${etaPart}`;
}

function estimateRemainingSeconds(status, elapsed) {
  const total = Number(status.totalSteps || 0);
  const completed = Number(status.completedSteps || 0);
  if (!total || completed <= 0 || completed >= total) return null;
  const avg = elapsed / completed;
  return Math.max(1, Math.round(avg * (total - completed)));
}

function formatDuration(seconds) {
  seconds = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}분 ${s}초` : `${s}초`;
}
