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
  // [Undo 죽어있던 원인 0.7.2.1 / 2026-08-10] 예전엔 file.size 합계 8MB 를 넘으면 히스토리를
  // 통째로 꺼 버렸다. 그런데 size 는 '디스크 원본 크기'고, 스냅샷은 그 바이트를 복제하지 않는다
  // (cloneFileForHistory 가 originalBuffer 를 참조 공유). 실제로 복제되는 건 미리보기 격자(sheets)뿐.
  // 백엔드 미리보기(500행) 모델에서는 30MB 파일도 격자는 몇 만 셀이라, 이 기준 때문에 실무 파일을
  // 올리면 Undo/Redo 버튼이 영원히 비활성이었다(실측: 33MB 업로드 세트 = 셀 10만 개 = 전혀 무겁지 않음).
  // → 진짜 스냅샷 무게인 '셀 수'로만 판정한다.
  const HEAVY_CELL_COUNT = 250000;
  let cells = 0;
  const countFile = (file) => {
    if (!file) return;
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
  const heavy = cells >= HEAVY_CELL_COUNT;
  // 여전히 무거우면 조용히 죽이지 말고 세션당 1번은 이유를 알려준다(예전엔 아무 말 없이 비활성).
  if (heavy && !window.__b2bHeavyHistoryNotified && typeof toast === "function") {
    window.__b2bHeavyHistoryNotified = true;
    toast("파일 데이터가 매우 커서 되돌리기(Undo) 기록을 잠시 꺼 둡니다.", "error");
  }
  return heavy;
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
  // [0.7.3] 단계 편집(토글/보류 일괄 실행)이 반영 중이거나 그 모달이 떠 있으면 되돌리기 보류 —
  // 실행 도중 파이프라인을 스냅샷으로 갈아끼우면 실행 결과 정착과 충돌한다.
  if (typeof document !== "undefined" && document.getElementById("b2b-batch-resume-modal")) {
    if (typeof toast === "function") toast("보류 일괄 실행 창을 먼저 닫아 주세요.", "error");
    return;
  }
  {
    const busy = typeof pipelineEditBusyReason === "function" ? pipelineEditBusyReason() : "";
    if (busy) { if (typeof toast === "function") toast(busy, "error"); return; }
  }
  const previousSteps = (state.pipeline || []).slice();  // 복원 '전' 스텝 — 교차 목적지 리셋용
  state.history.redo.push(makeHistorySnapshot("redo"));
  restoreHistorySnapshot(state.history.undo.pop());
  reconcileHistoryRestore(previousSteps);
  toast("이전 작업으로 되돌렸습니다.", "success");
}

function redoHistory() {
  if (!state.history || !state.history.redo.length) return;
  if (typeof document !== "undefined" && document.getElementById("b2b-batch-resume-modal")) {
    if (typeof toast === "function") toast("보류 일괄 실행 창을 먼저 닫아 주세요.", "error");
    return;
  }
  {
    const busy = typeof pipelineEditBusyReason === "function" ? pipelineEditBusyReason() : "";
    if (busy) { if (typeof toast === "function") toast(busy, "error"); return; }
  }
  const previousSteps = (state.pipeline || []).slice();
  state.history.undo.push(makeHistorySnapshot("undo"));
  restoreHistorySnapshot(state.history.redo.pop());
  reconcileHistoryRestore(previousSteps);
  toast("되돌린 작업을 다시 적용했습니다.", "success");
}

// previousSteps = 되돌리기/다시하기 '직전'의 파이프라인. 이걸 안 넘기면 사라진 스텝의 교차파일
// 목적지(dst_book)가 리셋 대상에서 빠져, 교차 스킬을 Ctrl+Z 로 되돌려도 붙여넣은 시트가
// 그대로 남았다(✕ 삭제는 정리되는데 undo 만 안 되던 비대칭).
function reconcileHistoryRestore(previousSteps) {
  if (typeof reconcilePipelineSimulationAfterEdit !== "function") return;
  reconcilePipelineSimulationAfterEdit({ steps: state.pipeline, previousSteps: previousSteps || [] }).catch(err => {
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
