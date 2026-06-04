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
    if (!resp.ok || !data.ok) {
      const err = new Error(data.error || `HTTP ${resp.status}`);
      if (data.errorInfo) {
        err._stepInfo = {
          ...data.errorInfo,
          stepIdx: Number(data.errorInfo.stepIdx ?? -1),
          message: data.errorInfo.message || data.error || err.message,
        };
      }
      throw err;
    }
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
  parsed.backendDownloadUrl = `/api/workbooks/source/${encodeURIComponent(backendInfo.workbookId)}`;
  return parsed;
}

function createBackendPreviewRecord(file, backendInfo) {
  if (!file || !backendInfo || !backendInfo.workbookId || !backendInfo.meta) return null;
  const meta = backendInfo.meta || {};
  const displayName = String(backendInfo.name || file.name || "workbook.xlsx").trim() || "workbook.xlsx";
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
    name: displayName,
    originalName: file.name || displayName,
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
    backendDownloadUrl: `/api/workbooks/source/${encodeURIComponent(backendInfo.workbookId)}`,
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

function muteExcelMirrorForPipeline(outputExcelId, ms = 10 * 60 * 1000) {
  if (!outputExcelId || typeof excelMirror === "undefined") return;
  excelMirror.mutedUntil = Math.max(excelMirror.mutedUntil || 0, Date.now() + ms);
  if (typeof suppressExcelMirrorSelection === "function") suppressExcelMirrorSelection(ms);
}

function releaseExcelMirrorPipelineMute(outputExcelId) {
  if (!outputExcelId || typeof excelMirror === "undefined") return;
  excelMirror.mutedUntil = Date.now() + 10000;
  if (typeof suppressExcelMirrorSelection === "function") suppressExcelMirrorSelection(10000);
  if (typeof baselineExcelMirrorSession === "function") {
    setTimeout(() => {
      baselineExcelMirrorSession(outputExcelId)
        .then(() => {
          excelMirror.mutedUntil = Date.now() + 3000;
        })
        .catch(err => console.warn("Failed to refresh Excel baseline after pipeline:", err));
    }, 250);
  }
}

function adaptPipelineForRun(steps) {
  const context = buildPipelineRunAdaptContext();
  return (steps || []).map(step => {
    if (!step || !step.code || !context) return step;
    const lang = step.language || (typeof inferPipelineStepLanguage === "function" ? inferPipelineStepLanguage(step) : "javascript");
    if (lang === "python") return { ...step, language: "python" };
    const code = adaptPipelineCodeForRun(String(step.code), context);
    return code === step.code ? step : { ...step, code, adaptedForRun: true };
  });
}

function buildPipelineRunAdaptContext() {
  const inputFiles = state.inputsOriginal || [];
  const outputTarget = typeof getBackendOutputTarget === "function" ? getBackendOutputTarget() : null;
  const outputFile = (outputTarget && outputTarget.original) || state.outputOriginal || null;
  const allInputText = inputFiles.map(file => [
    file.name,
    ...(file.sheetNames || []),
  ].join("\n")).join("\n");
  const runInputYm = firstYmToken(allInputText);
  if (!runInputYm) return null;
  const inputYear = Number(runInputYm.slice(0, 4));
  const inputMonth = Number(runInputYm.slice(4, 6));
  if (!inputYear || !inputMonth) return null;
  const runOutput = inferOutputMonth(outputFile, inputYear, inputMonth);
  return {
    runInputYm,
    runInputMM: String(inputMonth).padStart(2, "0"),
    runInputM: String(inputMonth),
    runOutputYear: runOutput.year,
    runOutputMM: String(runOutput.month).padStart(2, "0"),
    runOutputM: String(runOutput.month),
    inputFiles,
  };
}

function firstYmToken(text) {
  const match = String(text || "").match(/20\d{2}(0[1-9]|1[0-2])/);
  return match ? match[0] : "";
}

function inferOutputMonth(outputFile, inputYear, inputMonth) {
  const text = outputFile ? [outputFile.name, ...(outputFile.sheetNames || [])].join("\n") : "";
  const explicit = String(text || "").match(/(?:^|[^0-9])(0?[1-9]|1[0-2])\s*월/);
  if (explicit) {
    const month = Number(explicit[1]);
    if (month !== inputMonth) return { year: inputYear, month };
  }
  const next = inputMonth === 12 ? { year: inputYear + 1, month: 1 } : { year: inputYear, month: inputMonth + 1 };
  return next;
}

function adaptPipelineCodeForRun(code, context) {
  const oldInputYm = firstYmToken(code);
  let out = code;
  if (oldInputYm && oldInputYm !== context.runInputYm) {
    const oldInputMonth = Number(oldInputYm.slice(4, 6));
    const oldInputMM = String(oldInputMonth).padStart(2, "0");
    const oldInputM = String(oldInputMonth);
    const oldOutput = oldInputMonth === 12 ? { month: 1 } : { month: oldInputMonth + 1 };
    const oldOutputMM = String(oldOutput.month).padStart(2, "0");
    const oldOutputM = String(oldOutput.month);
    out = out.replaceAll(oldInputYm, context.runInputYm);
    out = replaceYearMonthDateLiteral(out, oldInputYm, context.runInputYm);
    out = replaceMonthLiteral(out, oldOutputMM, context.runOutputMM);
    out = replaceStandaloneMonthLiteral(out, oldOutputM, context.runOutputM);
    out = replaceMonthLiteral(out, oldInputMM, context.runInputMM);
    out = replaceStandaloneMonthLiteral(out, oldInputM, context.runInputM);
  }
  out = adaptInputSheetStringLiterals(out, context.inputFiles);
  return out;
}

function replaceMonthLiteral(code, fromMM, toMM) {
  if (!fromMM || !toMM || fromMM === toMM) return code;
  return code.replace(new RegExp(`${escapeRegExpText(fromMM)}\\s*월`, "g"), `${toMM}월`);
}

function replaceStandaloneMonthLiteral(code, fromM, toM) {
  if (!fromM || !toM || fromM === toM) return code;
  return code.replace(new RegExp(`(^|[^0-9])${escapeRegExpText(fromM)}\\s*월`, "g"), `$1${toM}월`);
}

function replaceYearMonthDateLiteral(code, oldYm, runYm) {
  if (!oldYm || !runYm || oldYm === runYm) return code;
  const oldYear = oldYm.slice(0, 4);
  const oldMM = oldYm.slice(4, 6);
  const runYear = runYm.slice(0, 4);
  const runMM = runYm.slice(4, 6);
  return code
    .replace(new RegExp(`${escapeRegExpText(oldYear)}-${escapeRegExpText(oldMM)}`, "g"), `${runYear}-${runMM}`)
    .replace(new RegExp(`${escapeRegExpText(oldYear)}_${escapeRegExpText(oldMM)}`, "g"), `${runYear}_${runMM}`);
}

function adaptInputSheetStringLiterals(code, inputFiles) {
  let out = code;
  const re = /inputs\[(["'`])([^"'`]+)\1\]\[(["'`])([^"'`]+)\3\]/g;
  const replacements = [];
  let match;
  while ((match = re.exec(code)) !== null) {
    const full = match[0];
    const fileRef = match[2];
    const sheetRef = match[4];
    const file = resolveRunInputFile(fileRef, inputFiles);
    if (!file || !file.sheetNames || file.sheetNames.includes(sheetRef)) continue;
    const sheet = resolveRunSheetName(sheetRef, file.sheetNames);
    if (!sheet || sheet === sheetRef) continue;
    replacements.push([full, `inputs[${match[1]}${fileRef}${match[1]}][${match[3]}${sheet}${match[3]}]`]);
  }
  replacements.forEach(([from, to]) => { out = out.replaceAll(from, to); });
  return out;
}

function resolveRunInputFile(fileRef, inputFiles) {
  if (!fileRef || !inputFiles || !inputFiles.length) return null;
  const exact = inputFiles.find(file => file.name === fileRef);
  if (exact) return exact;
  const result = typeof fuzzyMatch === "function" ? fuzzyMatch(fileRef, inputFiles.map(file => file.name), 0.7) : null;
  if (!result || result.ambiguous) {
    const normalizedRef = typeof normalizeText === "function" ? normalizeText(fileRef) : String(fileRef || "").toLowerCase();
    const refHasCcu = normalizedRef.includes("ccu");
    const refHasReplace = normalizedRef.includes("교체");
    const fallback = inputFiles.filter(file => {
      const name = typeof normalizeText === "function" ? normalizeText(file.name) : String(file.name || "").toLowerCase();
      return (refHasCcu && name.includes("ccu")) || (refHasReplace && name.includes("교체"));
    });
    if (fallback.length === 1) return fallback[0];
    return null;
  }
  return inputFiles.find(file => file.name === result.match) || null;
}

function resolveRunSheetName(sheetRef, sheetNames) {
  if (!sheetRef || !sheetNames || !sheetNames.length) return "";
  if (sheetNames.length === 1) return sheetNames[0];
  const result = typeof fuzzyMatch === "function" ? fuzzyMatch(sheetRef, sheetNames, 0.7) : null;
  return result && !result.ambiguous ? result.match : "";
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

function attachBackendRunClientContext(result, outputTarget, outputExcelId) {
  if (!result || typeof result !== "object") return result;
  result.clientOutputFileId = outputTarget ? outputTarget.fileId : null;
  result.clientOutputExcelId = outputExcelId || null;
  return result;
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
    clearFormulaMetadataForBackendChanges(file, fileResult, resultDiffs[fileResult.fileId], result.forcedValueCells || []);
    applyForcedValueCellsToFile(file, fileResult, result.forcedValueCells || []);
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
  if (result && result.activeSheet) {
    const activeFileId = result.clientOutputFileId ||
      Object.keys(downloadUrls).find(id => id === "output" || id.startsWith("output:"));
    const activeFile = activeFileId ? getFile(activeFileId) : null;
    if (activeFile && activeFile.sheets && activeFile.sheets[result.activeSheet]) {
      state.currentFileId = activeFileId;
      state.currentSheet = result.activeSheet;
      state.selectedSheets = [result.activeSheet];
    }
  }
  refreshTabs();
  renderExcelViewer();
  flashBackendDiff(result);
  flashFilled();
  window.backendCurrentCacheDirty = false;
  if (result && result.pythonExcel && result.liveApplied) {
    // 백엔드가 라이브 미러에 직접 적용함 → 결과 파일 replace 불필요. 미러 폴링만 재동기화.
    const outputFileId = result.clientOutputFileId;
    if (outputFileId && result.clientOutputExcelId && typeof acknowledgeExcelMirrorApplied === "function") {
      setTimeout(() => {
        acknowledgeExcelMirrorApplied(outputFileId).catch(err => {
          console.warn("Failed to re-baseline live Excel mirror:", err);
        });
      }, 150);
    }
  } else if (result && result.pythonExcel) {
    const outputFileId = result.clientOutputFileId ||
      Object.keys(downloadUrls).find(id => id === "output" || id.startsWith("output:"));
    if (outputFileId && result.clientOutputExcelId && typeof acknowledgeExcelMirrorApplied === "function") {
      setTimeout(() => {
        const outputDownloadUrl = downloadUrls[outputFileId] || result.downloadUrl;
        const refresh = outputDownloadUrl && typeof refreshExcelMirrorForFileId === "function"
          ? refreshExcelMirrorForFileId(outputFileId, outputDownloadUrl, { openIfMissing: false })
          : acknowledgeExcelMirrorApplied(outputFileId);
        refresh.catch(err => {
          console.warn("Failed to acknowledge live Excel result:", err);
        });
      }, 150);
    }
  }

  // 입력 파일을 수정하는 스킬: 열려 있는 입력 미러도 최신 결과로 교체해 변경이 보이게 한다.
  if (result && result.pythonExcel) {
    Object.keys(downloadUrls).forEach(fid => {
      if (!fid || fid.indexOf("input:") !== 0) return;
      const inputUrl = downloadUrls[fid];
      if (!inputUrl) return;
      if (typeof excelMirrorSessionIdForFileId === "function" &&
          excelMirrorSessionIdForFileId(fid) &&
          typeof refreshExcelMirrorForFileId === "function") {
        setTimeout(() => {
          refreshExcelMirrorForFileId(fid, inputUrl, { openIfMissing: false }).catch(err => {
            console.warn("Failed to refresh input Excel mirror:", err);
          });
        }, 200);
      }
    });
  }
}

function clearFormulaMetadataForBackendChanges(file, fileResult, fallbackDiff, allForcedValueCells) {
  if (!file) return;
  const fileId = fileResult && fileResult.fileId;
  const forcedCells = [
    ...(fileResult.forcedValueCells || []),
    ...(allForcedValueCells || []).filter(cell => cell && cell.fileId === fileId),
  ];
  forcedCells.forEach(cell => {
    const sheetName = cell && cell.sheetName;
    if (!sheetName) return;
    const r = Number(cell.r);
    const c = Number(cell.c);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return;
    clearCellFormulaDisplayMetadata(file, fileId, sheetName, r, c);
  });
}

function clearCellFormulaDisplayMetadata(file, fileId, sheetName, r, c) {
  const addr = _excelCol(c) + (r + 1);
  markFormulaSuppressed(file, sheetName, addr);
  if (file.formulas && file.formulas[sheetName]) delete file.formulas[sheetName][addr];
  if (file.originalFormulaValues && file.originalFormulaValues[sheetName]) {
    delete file.originalFormulaValues[sheetName][addr];
  }
  if (file.displays && file.displays[sheetName] && file.displays[sheetName][r]) {
    delete file.displays[sheetName][r][c];
  }
  if (fileId && state.formulaResults && state.formulaResults[fileId] && state.formulaResults[fileId][sheetName]) {
    delete state.formulaResults[fileId][sheetName][addr];
  }
}

function markFormulaSuppressed(file, sheetName, addr) {
  if (!file || !sheetName || !addr) return;
  file.formulaSuppressions = file.formulaSuppressions || {};
  file.formulaSuppressions[sheetName] = file.formulaSuppressions[sheetName] || {};
  file.formulaSuppressions[sheetName][addr] = true;
}

function applyForcedValueCellsToFile(file, fileResult, allForcedValueCells) {
  const fileId = fileResult && fileResult.fileId;
  const forcedCells = [
    ...(fileResult.forcedValueCells || []),
    ...(allForcedValueCells || []).filter(cell => cell && cell.fileId === fileId),
  ];
  forcedCells.forEach(cell => {
    const sheetName = cell && cell.sheetName;
    if (!sheetName) return;
    const r = Number(cell.r);
    const c = Number(cell.c);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return;
    if (!file.sheets[sheetName]) file.sheets[sheetName] = [];
    if (!file.sheets[sheetName][r]) file.sheets[sheetName][r] = [];
    file.sheets[sheetName][r][c] = cell.value ?? "";
    clearCellFormulaDisplayMetadata(file, fileResult.fileId, sheetName, r, c);
  });
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
  const perfStartedAt = performance.now();
  let pollCount = 0;
  let startRequestMs = 0;
  const setProgress = (text) => {
    if (typeof window.runnerSetProgress === "function") window.runnerSetProgress(text);
    if (typeof window.generatorSetProgress === "function") window.generatorSetProgress(text);
  };
  const pipelineForRun = typeof adaptPipelineForRun === "function"
    ? adaptPipelineForRun(options.pipeline || state.pipeline)
    : (options.pipeline || state.pipeline);
  const usesPythonExcel = typeof pipelineUsesPython === "function" && pipelineUsesPython(pipelineForRun);
  const activeStepsForRun = (pipelineForRun || []).filter(isStepEnabled);
  const hasActiveJavaScriptStep = activeStepsForRun.some(step => inferPipelineStepLanguage(step) !== "python");
  const liveOutputExcelId = outputTarget && typeof excelMirrorSessionIdForFileId === "function"
    ? excelMirrorSessionIdForFileId(outputTarget.fileId)
    : null;
  // Python(전부 Python 단계) 파이프라인도 라이브 미러에 직접 적용한다(2단계 최적화: 라이브 추가).
  // JS 단계가 섞이면 기존처럼 라이브를 쓰지 않는다.
  const shouldUseLiveExcel = !!liveOutputExcelId && !hasActiveJavaScriptStep;
  let outputExcelId = null;
  if (shouldUseLiveExcel) {
    setProgress("Excel 창 준비 중...");
    outputExcelId = liveOutputExcelId;
  }
  muteExcelMirrorForPipeline(outputExcelId);
  const payload = {
    inputs: (state.inputsOriginal || []).map(f => ({
      name: f.name,
      backendWorkbookId: f.backendWorkbookId,
    })),
    output: outputTarget ? {
      name: outputTarget.original.name,
      backendWorkbookId: outputTarget.original.backendWorkbookId,
    } : null,
    pipeline: pipelineForRun,
    baseMode: options.baseMode || "original",
    current: {
      fileId: state.currentFileId,
      outputFileId: outputTarget ? outputTarget.fileId : null,
      outputExcelId,
      sheet: state.currentSheet,
    },
  };

  try {
    setProgress("파일 읽는 중...");
    let stageStarted = performance.now();
    const startResp = await fetch("/api/pipeline/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const startData = await startResp.json();
    startRequestMs = performance.now() - stageStarted;
    if (!startResp.ok || !startData.ok || !startData.jobId) {
      throw new Error(startData.error || `HTTP ${startResp.status}`);
    }

    while (true) {
      const pollDelay = pollCount < 8 ? 250 : (pollCount < 40 ? 500 : 1000);
      await new Promise(resolve => setTimeout(resolve, pollDelay));
      pollCount += 1;
      stageStarted = performance.now();
      const statusResp = await fetch(`/api/pipeline/status/${encodeURIComponent(startData.jobId)}`);
      const statusText = await statusResp.text();
      const receiveMs = performance.now() - stageStarted;
      const parseStarted = performance.now();
      const status = JSON.parse(statusText);
      const parseMs = performance.now() - parseStarted;
      if (!statusResp.ok) throw new Error(status.error || `HTTP ${statusResp.status}`);

      setProgress(formatBackendProgress(status, startedAt));

      if (status.status === "error") {
        const err = new Error(status.error || "백엔드 스킬 실행 중 오류가 발생했습니다.");
        if (status.errorInfo) {
          err._stepInfo = {
            ...status.errorInfo,
            stepIdx: Number(status.errorInfo.stepIdx ?? -1),
            message: status.errorInfo.message || status.error || err.message,
          };
        }
        err.backendStatus = status;
        throw err;
      }
      if (!status.ok) throw new Error(status.error || `HTTP ${statusResp.status}`);

      if (status.status === "done") {
        if (runToken !== window.backendPipelineRunToken) return status;
        const applyStarted = performance.now();
        attachBackendRunClientContext(status, outputTarget, liveOutputExcelId || outputExcelId);
        applyBackendPipelineResult(status);
        const applyRenderMs = performance.now() - applyStarted;
        window.backendCurrentCacheDirty = false;
        setProgress("완료");
        if (typeof window.recordBackendDebugTiming === "function") {
          window.recordBackendDebugTiming({
            worker: !!status.worker,
            baseMode: payload.baseMode,
            steps: (payload.pipeline || []).filter(step => !(step && step.enabled === false)).length,
            startRequestMs,
            polls: pollCount,
            receiveMs,
            parseMs,
            receiveBytes: statusText.length,
            applyRenderMs,
            totalClientMs: performance.now() - perfStartedAt,
            server: status.debugTimings || {},
          });
        }
        return status;
      }
      if (status.status === "error") {
        throw new Error(status.error || "백엔드 실행 중 오류가 발생했습니다.");
      }
    }
  } finally {
    releaseExcelMirrorPipelineMute(outputExcelId);
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
