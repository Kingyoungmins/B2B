/* ===================================================================
   UNDO / REDO HISTORY
   =================================================================== */

function cloneFileForHistory(file) {
  if (!file) return null;
  const buf = file.originalBuffer || null;
  const cloned = deepClone({ ...file, originalBuffer: null });
  cloned.originalBuffer = buf;
  return cloned;
}

function cloneTemplateForHistory(tpl) {
  if (!tpl) return null;
  return {
    id: tpl.id,
    file: cloneFileForHistory(tpl.file),
    original: cloneFileForHistory(tpl.original),
  };
}

function makeHistorySnapshot(label) {
  return {
    label: label || "작업",
    inputs: state.inputs.map(cloneFileForHistory),
    inputsOriginal: state.inputsOriginal.map(cloneFileForHistory),
    output: cloneFileForHistory(state.output),
    outputOriginal: cloneFileForHistory(state.outputOriginal),
    outputTemplates: (state.outputTemplates || []).map(cloneTemplateForHistory),
    activeOutputIndex: state.activeOutputIndex,
    currentFileId: state.currentFileId,
    currentSheet: state.currentSheet,
    selectedSheets: deepClone(state.selectedSheets || []),
    selectedCell: deepClone(state.selectedCell || null),
    selectedRange: deepClone(state.selectedRange || null),
    selectedRanges: deepClone(state.selectedRanges || []),
    selectionAnchor: deepClone(state.selectionAnchor || null),
    pipeline: deepClone(state.pipeline || []),
    fuzzyResolution: deepClone(state.fuzzyResolution || {}),
  };
}

function pushHistory(label) {
  if (!state.history) state.history = { undo: [], redo: [], limit: 80 };
  if (shouldSkipHeavyHistory()) {
    state.history.undo = [];
    state.history.redo = [];
    refreshHistoryButtons();
    return;
  }
  state.history.undo.push(makeHistorySnapshot(label));
  if (state.history.undo.length > (state.history.limit || 80)) state.history.undo.shift();
  state.history.redo = [];
  refreshHistoryButtons();
}

function shouldSkipHeavyHistory() {
  const HEAVY_FILE_BYTES = 8 * 1024 * 1024;
  const HEAVY_CELL_COUNT = 250000;
  let bytes = 0;
  let cells = 0;
  const countFile = (file) => {
    if (!file) return;
    bytes += file.size || 0;
    Object.values(file.sheets || {}).forEach(sheet => {
      cells += (sheet || []).reduce((sum, row) => sum + (row ? row.length : 0), 0);
    });
  };
  (state.inputs || []).forEach(countFile);
  (state.inputsOriginal || []).forEach(countFile);
  countFile(state.output);
  countFile(state.outputOriginal);
  (state.outputTemplates || []).forEach(tpl => {
    countFile(tpl && tpl.file);
    countFile(tpl && tpl.original);
  });
  return bytes >= HEAVY_FILE_BYTES || cells >= HEAVY_CELL_COUNT;
}

function restoreHistorySnapshot(snapshot) {
  if (!snapshot) return;
  state.inputs = snapshot.inputs.map(cloneFileForHistory);
  state.inputsOriginal = snapshot.inputsOriginal.map(cloneFileForHistory);
  state.output = cloneFileForHistory(snapshot.output);
  state.outputOriginal = cloneFileForHistory(snapshot.outputOriginal);
  state.outputTemplates = (snapshot.outputTemplates || []).map(cloneTemplateForHistory);
  state.activeOutputIndex = snapshot.activeOutputIndex ?? -1;
  if (state.outputTemplates[state.activeOutputIndex]) {
    state.output = state.outputTemplates[state.activeOutputIndex].file;
    state.outputOriginal = state.outputTemplates[state.activeOutputIndex].original;
  }
  state.currentFileId = snapshot.currentFileId;
  state.currentSheet = snapshot.currentSheet;
  state.selectedSheets = deepClone(snapshot.selectedSheets || []);
  state.selectedCell = deepClone(snapshot.selectedCell || null);
  state.selectedRange = deepClone(snapshot.selectedRange || null);
  state.selectedRanges = deepClone(snapshot.selectedRanges || []);
  state.selectionAnchor = deepClone(snapshot.selectionAnchor || null);
  state.pipeline = deepClone(snapshot.pipeline || []);
  state.fuzzyResolution = deepClone(snapshot.fuzzyResolution || {});
  state.editingStepId = null;
  if (typeof recomputeAllFormulas === "function") recomputeAllFormulas();
  renderInputList();
  renderOutputChip();
  renderPipeline();
  refreshTabs();
  renderExcelViewer();
  refreshChatState();
  refreshRunButton();
  refreshHistoryButtons();
}

function undoHistory() {
  if (!state.history || !state.history.undo.length) return;
  state.history.redo.push(makeHistorySnapshot("redo"));
  restoreHistorySnapshot(state.history.undo.pop());
  reconcileHistoryRestore();
  toast("이전 작업으로 되돌렸습니다.", "success");
}

function redoHistory() {
  if (!state.history || !state.history.redo.length) return;
  state.history.undo.push(makeHistorySnapshot("undo"));
  restoreHistorySnapshot(state.history.redo.pop());
  reconcileHistoryRestore();
  toast("되돌린 작업을 다시 적용했습니다.", "success");
}

function reconcileHistoryRestore() {
  if (typeof reconcilePipelineSimulationAfterEdit !== "function") return;
  reconcilePipelineSimulationAfterEdit({ steps: state.pipeline }).catch(err => {
    if (typeof reportPipelineError === "function") reportPipelineError(err);
    else console.error(err);
  });
}

function refreshHistoryButtons() {
  const undo = $("btn-undo");
  const redo = $("btn-redo");
  if (undo) undo.disabled = !(state.history && state.history.undo.length);
  if (redo) redo.disabled = !(state.history && state.history.redo.length);
}

function setupHistoryButtons() {
  const undo = $("btn-undo");
  const redo = $("btn-redo");
  if (undo) undo.onclick = undoHistory;
  if (redo) redo.onclick = redoHistory;
  refreshHistoryButtons();
  // [편의] Ctrl/Cmd+Z = undo, Ctrl/Cmd+Y 또는 Ctrl/Cmd+Shift+Z = redo.
  // 입력 필드(채팅/셀 편집 등)에서는 그 필드의 기본 실행취소를 살리기 위해 가로채지 않는다.
  if (!window.__b2bHistoryHotkeys) {
    window.__b2bHistoryHotkeys = true;
    document.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target;
      const tag = (el && el.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (el && el.isContentEditable)) return;
      const k = String(e.key || "").toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undoHistory(); }
      else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redoHistory(); }
    });
  }
}
