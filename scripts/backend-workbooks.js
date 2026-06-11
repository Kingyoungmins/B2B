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
  // 적용 직후 짧게만 억제. 곧바로 사용자의 셀 선택이 채팅에 반영되게 한다.
  // selectionMutedUntil 은 직접 리셋한다(suppressExcelMirrorSelection 은 Math.max 라 10분 억제를 못 줄임).
  excelMirror.mutedUntil = Date.now() + 1500;
  excelMirror.selectionMutedUntil = Date.now() + 1500;
  if (typeof baselineExcelMirrorSession === "function") {
    setTimeout(() => {
      baselineExcelMirrorSession(outputExcelId, { syncSelection: false })
        .then(() => {
          excelMirror.mutedUntil = Date.now() + 300;
          excelMirror.selectionMutedUntil = Date.now() + 300;
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
  if (window.backendRunViewBeforeApply) {
    result.clientViewBeforeApply = window.backendRunViewBeforeApply;
  }
  return result;
}

function captureBackendCurrentViewForApply() {
  return {
    fileId: state.currentFileId,
    sheet: state.currentSheet,
    selectedSheets: Array.isArray(state.selectedSheets) ? state.selectedSheets.slice() : [],
    selectedCell: state.selectedCell ? { ...state.selectedCell } : null,
    selectedRange: state.selectedRange ? { ...state.selectedRange } : null,
    selectedRanges: Array.isArray(state.selectedRanges) ? state.selectedRanges.map(r => ({ ...r })) : [],
    selectionAnchor: state.selectionAnchor ? { ...state.selectionAnchor } : null,
  };
}

function isBackendOutputFileId(fileId) {
  return fileId === "output" || String(fileId || "").startsWith("output:");
}

function chooseBackendRestoreView(result, viewBeforeApply, downloadUrls) {
  const changedFileIds = new Set(Object.keys(downloadUrls || {}));
  (result.files || []).forEach(fileResult => {
    if (fileResult && fileResult.fileId) changedFileIds.add(fileResult.fileId);
  });
  if (result.liveApplied && result.clientOutputFileId) changedFileIds.add(result.clientOutputFileId);

  const previousId = viewBeforeApply && viewBeforeApply.fileId;
  const outputId = (result.clientOutputFileId && changedFileIds.has(result.clientOutputFileId))
    ? result.clientOutputFileId
    : Array.from(changedFileIds).find(isBackendOutputFileId);
  if (outputId && getFile(outputId)) {
    const previousWasSameOutput = previousId === outputId;
    return {
      ...(viewBeforeApply || {}),
      fileId: outputId,
      sheet: previousWasSameOutput ? viewBeforeApply.sheet : (result.activeSheet || null),
      selectedSheets: previousWasSameOutput ? (viewBeforeApply.selectedSheets || []) : [],
      selectedCell: previousWasSameOutput ? viewBeforeApply.selectedCell : null,
      selectedRange: previousWasSameOutput ? viewBeforeApply.selectedRange : null,
      selectedRanges: previousWasSameOutput ? (viewBeforeApply.selectedRanges || []) : [],
      selectionAnchor: previousWasSameOutput ? viewBeforeApply.selectionAnchor : null,
    };
  }

  if (previousId && changedFileIds.has(previousId) && getFile(previousId)) {
    return viewBeforeApply;
  }

  if (previousId && getFile(previousId)) return viewBeforeApply;
  const firstChangedId = Array.from(changedFileIds).find(id => getFile(id));
  if (firstChangedId) {
    return {
      fileId: firstChangedId,
      sheet: result.activeSheet || null,
      selectedSheets: [],
      selectedCell: null,
      selectedRange: null,
      selectedRanges: [],
      selectionAnchor: null,
    };
  }
  return viewBeforeApply || {};
}

function backendResultUrlForFile(result, downloadUrls, fileId) {
  const file = fileId ? getFile(fileId) : null;
  return (downloadUrls && downloadUrls[fileId]) ||
    (file && file.backendDownloadUrl) ||
    (isBackendOutputFileId(fileId) ? result.downloadUrl : null);
}

async function forceShowBackendResultMirror(result, activeId, downloadUrls) {
  if (!activeId) return false;
  const url = backendResultUrlForFile(result, downloadUrls, activeId);
  try {
    const file = activeId ? getFile(activeId) : null;
    if (file && url) file.backendDownloadUrl = url;
    if (url && typeof refreshExcelMirrorForFileId === "function") {
      const existingExcelId = typeof excelMirrorSessionIdForFileId === "function"
        ? excelMirrorSessionIdForFileId(activeId)
        : null;
      const refreshed = await refreshExcelMirrorForFileId(activeId, url, {
        // 기존 세션이 있으면 /api/excel/replace 만 사용한다.
        // 세션이 유실된 예외 상황에서만 해당 파일 하나를 다시 연다. 전체 close/reopen 은 금지.
        openIfMissing: !existingExcelId,
        preserveFocus: true,
        raiseAfter: true,
      });
      if (refreshed) return true;
    }
    if (typeof switchVisibleExcelMirrorToFileId === "function") {
      return await switchVisibleExcelMirrorToFileId(activeId);
    }
    if (typeof openExcelMirrorForFileId === "function") {
      await openExcelMirrorForFileId(activeId);
      return true;
    }
  } catch (err) {
    console.warn("Excel mirror force-show failed:", err);
    if (typeof toast === "function") {
      toast("Excel 표시 갱신 실패: " + (err && err.message ? err.message : err), "error");
    }
  }
  return false;
}

function applyBackendPipelineResult(result) {
  const viewBeforeApply = result.clientViewBeforeApply || captureBackendCurrentViewForApply();
  const downloadUrls = result.downloadUrls || {};
  const restoreView = chooseBackendRestoreView(result, viewBeforeApply, downloadUrls);
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
    if (fileResult.formulas) {
      file.formulas = file.formulas || {};
      Object.keys(fileResult.formulas).forEach(sheet => {
        file.formulas[sheet] = fileResult.formulas[sheet] || {};
      });
    }
    if (fileResult.originalFormulaValues) {
      file.originalFormulaValues = file.originalFormulaValues || {};
      Object.keys(fileResult.originalFormulaValues).forEach(sheet => {
        file.originalFormulaValues[sheet] = fileResult.originalFormulaValues[sheet] || {};
      });
    }
    if (fileResult.formats) {
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
  // result.activeSheet 는 "어느 시트가 바뀌었는지"에 가까운 실행 메타다.
  // 여기서 현재 탭을 바꾸면 적용 후 사용자가 보던 입력/출력/시트가 임의로 이동한다.
  // 현재 시트가 삭제된 경우의 최소 보정은 위 fileResult.sheetNames 처리에서만 수행한다.
  const previousFile = restoreView.fileId ? getFile(restoreView.fileId) : null;
  if (previousFile) {
    state.currentFileId = restoreView.fileId;
    const sheetNames = previousFile.sheetNames || [];
    state.currentSheet = sheetNames.includes(restoreView.sheet)
      ? restoreView.sheet
      : (sheetNames[0] || null);
    state.selectedSheets = (restoreView.selectedSheets || []).filter(s => sheetNames.includes(s));
    if (!state.selectedSheets.length && state.currentSheet) state.selectedSheets = [state.currentSheet];
    const sameSheet = item => item && item.fileId === state.currentFileId && item.sheet === state.currentSheet;
    state.selectedCell = sameSheet(restoreView.selectedCell) ? restoreView.selectedCell : null;
    state.selectedRange = sameSheet(restoreView.selectedRange) ? restoreView.selectedRange : null;
    state.selectedRanges = (restoreView.selectedRanges || []).filter(sameSheet);
    state.selectionAnchor = sameSheet(restoreView.selectionAnchor) ? restoreView.selectionAnchor : null;
  }
  refreshTabs();
  renderExcelViewer();
  flashBackendDiff(result);
  flashFilled();
  window.backendCurrentCacheDirty = false;
  // 적용 후 미러 반영: "지금 보고 있는 파일" 하나만 즉시 갱신/표시한다.
  // 나머지 변경된 파일은 숨긴 채 stale 로만 표시해, 그 파일로 전환할 때 갱신한다.
  // (예전엔 열린 모든 미러를 한꺼번에 갱신해 전부 떠오르는 미관 문제가 있었음)
  if (result && result.pythonExcel) {
    const changed = new Set(Object.keys(downloadUrls));
    if (result.liveApplied && result.clientOutputFileId) changed.add(result.clientOutputFileId);
    const activeId = state.currentFileId;
    if (typeof excelMirror !== "undefined") {
      excelMirror.staleByFileId = excelMirror.staleByFileId || {};
    }
    changed.forEach(fid => {
      if (!fid) return;
      if (fid !== activeId && typeof excelMirror !== "undefined") excelMirror.staleByFileId[fid] = true;
    });
    setTimeout(async () => {
      await forceShowBackendResultMirror(result, activeId, downloadUrls);
      if (typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
    }, 150);
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
  window.backendRunViewBeforeApply = captureBackendCurrentViewForApply();
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
  // [혼합 호환] vba 스텝은 이제 백엔드 워커가 실행 가능 — JS(레거시)만 별도 취급.
  const hasActiveJavaScriptStep = activeStepsForRun.some(step => !["python", "vba"].includes(inferPipelineStepLanguage(step)));
  const liveOutputExcelId = outputTarget && typeof excelMirrorSessionIdForFileId === "function"
    ? excelMirrorSessionIdForFileId(outputTarget.fileId)
    : null;
  // 스킬 실행 엔진 선택: "python"(openpyxl 우선) / "vba"(VBA step 생성용).
  // 이미 만들어진 Python step은 F7 선택값과 무관하게 Python 백엔드로 실행한다.
  const selectedSkillEngine = typeof getSkillEngine === "function" ? getSkillEngine() : "python";
  const skillEngine = usesPythonExcel ? "python" : selectedSkillEngine;
  // Python(전부 Python 단계) 파이프라인도 라이브 미러에 직접 적용한다(2단계 최적화: 라이브 추가).
  // JS 단계가 섞이거나 openpyxl 엔진이면 라이브를 쓰지 않는다(openpyxl 은 결과 파일로 미러를 교체).
  const shouldUseLiveExcel = !!liveOutputExcelId && !hasActiveJavaScriptStep && skillEngine !== "python";
  let outputExcelId = null;
  if (shouldUseLiveExcel) {
    setProgress("Excel 창 준비 중...");
    outputExcelId = liveOutputExcelId;
  }
  muteExcelMirrorForPipeline(outputExcelId);
  // 적용 중에는 미러 창을 숨기고 엑셀 영역에 로딩 애니메이션을 표시한다(창 튀어나옴 방지 + 진행 표시).
  if (typeof beginExcelMirrorApplyLoading === "function") {
    beginExcelMirrorApplyLoading("적용 반영 중...", { hideWindows: shouldUseLiveExcel || skillEngine !== "python" });
  }
  const payload = {
    inputs: (state.inputsOriginal || []).map(f => ({
      name: f.name,
      backendWorkbookId: f.backendWorkbookId,
    })),
    output: outputTarget ? {
      name: outputTarget.original.name,
      backendWorkbookId: outputTarget.original.backendWorkbookId,
    } : null,
    // [혼합 호환] 워커가 VBA/COM-bulk 스텝의 기준 워크북을 고를 수 있게 대상 파일명을 첨부.
    pipeline: (pipelineForRun || []).map(s => {
      if (!s || !s.targetFileId || typeof getFile !== "function") return s;
      const tf = getFile(s.targetFileId);
      return tf && tf.name ? { ...s, targetFileName: tf.name } : s;
    }),
    baseMode: options.baseMode || "original",
    engine: skillEngine,
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
    // [중단] 진행 중 잡을 전역에 노출 — 말풍선/전역 '작업 중단' 버튼이 협조적 취소를 보낼 수 있게.
    window.__activeBackendPipelineJobId = startData.jobId;

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
        if (status.errorInfo && status.errorInfo.cancelled) {
          // 사용자 중단 — 오류가 아니라 조용한 취소로 처리(상태/토스트는 호출자가 결정).
          setProgress("중단됨");
          return { ok: false, cancelled: true, status: "cancelled" };
        }
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
        // 안전장치 알림: Python 엔진을 골랐지만 호환성(차트/이미지/피벗/매크로/수식/CSV) 때문에
        // 이번 실행만 Excel(COM) 엔진으로 전환된 경우 사용자에게 사유를 알린다.
        if (status.engineFallback === "excel" && skillEngine === "python" && typeof toast === "function") {
          toast(`호환성 보호로 이번 적용은 Excel 엔진으로 실행했습니다 (${status.engineFallbackReason || "차트/수식 등"}). 객체·수식이 유지됩니다.`, "success");
        }
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
    window.__activeBackendPipelineJobId = null;
    releaseExcelMirrorPipelineMute(outputExcelId);
    // 안전망: 적용 결과 반영(applyBackendPipelineResult)이 로딩을 끄지만,
    // 오류/중복실행 등으로 끄지 못한 경우를 대비해 잠시 후 로딩 종료 + 활성 미러 복원.
    setTimeout(() => {
      if (typeof excelMirror !== "undefined" && excelMirror.applying) {
        if (typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
        if (typeof restoreActiveExcelMirrorWindow === "function") {
          restoreActiveExcelMirrorWindow({ preserveFocus: true }).catch(() => {});
        }
      }
    }, 1200);
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

// [중단] 협조적 python 잡 취소 — 실행 중 스텝은 끝까지 돌고, 다음 스텝 경계에서 멈춘다.
async function cancelActiveBackendPipeline() {
  const jobId = window.__activeBackendPipelineJobId;
  if (!jobId) return false;
  try {
    await fetch("/api/pipeline/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    return true;
  } catch (_) { return false; }
}
