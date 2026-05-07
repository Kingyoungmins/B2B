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
    pipeline: deepClone(state.pipeline || []),
    fuzzyResolution: deepClone(state.fuzzyResolution || {}),
  };
}

function pushHistory(label) {
  if (!state.history) state.history = { undo: [], redo: [], limit: 80 };
  state.history.undo.push(makeHistorySnapshot(label));
  if (state.history.undo.length > (state.history.limit || 80)) state.history.undo.shift();
  state.history.redo = [];
  refreshHistoryButtons();
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
  toast("이전 작업으로 되돌렸습니다.", "success");
}

function redoHistory() {
  if (!state.history || !state.history.redo.length) return;
  state.history.undo.push(makeHistorySnapshot("undo"));
  restoreHistorySnapshot(state.history.redo.pop());
  toast("되돌린 작업을 다시 적용했습니다.", "success");
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
}
