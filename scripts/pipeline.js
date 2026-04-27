/* ===================================================================
   LOGIC PIPELINE
   =================================================================== */
function applyLogic(step) {
  // Try run once to validate and preview
  try {
    runPipeline([...state.pipeline, step]);
    state.pipeline.push(step);
    renderPipeline();
    refreshRunButton();
    toast(`"${step.description}" 단계가 추가되었습니다`, "success");
  } catch (err) {
    toast("코드 실행 오류: " + err.message, "error");
    console.error(err);
  }
}

// 1-based position. position=1 → 맨 앞, position=N+1 → 맨 뒤(append와 동일)
function insertLogic(step, position) {
  const total = state.pipeline.length;
  const idx = Math.max(0, Math.min(total, (position | 0) - 1));
  const next = state.pipeline.slice();
  next.splice(idx, 0, step);
  try {
    runPipeline(next);
    state.pipeline = next;
    renderPipeline();
    refreshRunButton();
    toast(`"${step.description}" 단계가 ${idx + 1}번째에 삽입되었습니다`, "success");
  } catch (err) {
    toast("코드 실행 오류: " + err.message, "error");
    console.error(err);
  }
}

function replaceLogicAt(stepId, newCode, newDescription) {
  const idx = state.pipeline.findIndex(s => s.id === stepId);
  if (idx < 0) {
    toast("수정 대상 단계를 찾지 못했습니다", "error");
    return false;
  }
  const next = state.pipeline.slice();
  next[idx] = { ...next[idx], code: newCode, description: newDescription || next[idx].description };
  try {
    runPipeline(next);
    state.pipeline = next;
    renderPipeline();
    refreshRunButton();
    toast(`Step ${idx + 1} 코드가 수정되었습니다`, "success");
    return true;
  } catch (err) {
    toast("코드 실행 오류: " + err.message, "error");
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
  for (let i = 0; i < stepIdx && i < state.pipeline.length; i++) {
    const step = state.pipeline[i];
    try {
      const fn = new Function("inputs", "output", step.code + "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };");
      const result = fn(inputsMap, outputSheets);
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

function runPipeline(steps) {
  steps = steps || state.pipeline;
  if (!state.outputOriginal && state.inputsOriginal.length === 0) {
    throw new Error("실행할 입력 또는 출력 파일이 없습니다");
  }

  state.inputs = state.inputsOriginal.map(orig => {
    const cloned = cloneFileRecord(orig);
    cloned.originalBuffer = orig.originalBuffer || null;
    return cloned;
  });

  if (state.outputOriginal) {
    const buf = state.outputOriginal.originalBuffer;
    state.output = deepClone({ ...state.outputOriginal, originalBuffer: null });
    state.output.originalBuffer = buf;
  } else {
    state.output = null;
  }

  const inputsMap = {};
  state.inputs.forEach(f => { inputsMap[f.name] = f.sheets; });
  const outputSheets = state.output ? state.output.sheets : {};

  steps.forEach((step) => {
    const fn = new Function("inputs", "output", step.code + "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };");
    const result = fn(inputsMap, outputSheets);
    if (result && typeof result === "object" && !Array.isArray(result)) {
      if (result.inputs && typeof result.inputs === "object") {
        Object.keys(result.inputs).forEach(name => { inputsMap[name] = result.inputs[name]; });
      }
      if (state.output && result.output && typeof result.output === "object") {
        Object.keys(result.output).forEach(k => { state.output.sheets[k] = result.output[k]; });
      } else if (state.output && !result.inputs) {
        Object.keys(result).forEach(k => { state.output.sheets[k] = result[k]; });
      }
    }
  });

  state.inputs.forEach(file => {
    file.sheets = inputsMap[file.name] || {};
    syncFileMetadata(file);
  });

  if (state.output) syncFileMetadata(state.output);

  // 적용 후에도 사용자가 보고 있던 시뮬레이터 화면을 유지한다.
  const currentFile = getFile(state.currentFileId);
  if (!currentFile) {
    if (state.output) {
      state.currentFileId = "output";
      state.currentSheet = state.output.sheetNames[0] || null;
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

function flashFilled() {
  const currentFile = getFile(state.currentFileId);
  if (!currentFile || !state.currentSheet) return;
  let original = null;
  if (state.currentFileId === "output") {
    original = state.outputOriginal;
  } else if (state.currentFileId && state.currentFileId.startsWith("input:")) {
    const name = state.currentFileId.slice(6);
    original = state.inputsOriginal.find(f => f.name === name) || null;
  }
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
          td.classList.add("flash");
        }
      });
    });
  }, 50);
}

function renderPipeline() {
  const list = $("pipeline-list");
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
    if (state.editingStepId === step.id) item.classList.add("editing");
    const editing = state.editingStepId === step.id;
    item.innerHTML = `
      <div class="step-n">${idx+1}</div>
      <div class="step-label" title="${escapeHtml(step.description)}">${escapeHtml(step.description)}</div>
      <button class="step-edit ${editing ? 'active' : ''}" title="${editing ? '수정 모드 해제' : '수정'}">✎</button>
      <button class="step-del" title="삭제">✕</button>
    `;
    item.querySelector(".step-edit").onclick = (e) => {
      e.stopPropagation();
      toggleEditStep(step.id);
    };
    item.querySelector(".step-del").onclick = () => {
      if (state.editingStepId === step.id) state.editingStepId = null;
      state.pipeline.splice(idx, 1);
      try { runPipeline(); } catch {}
      renderPipeline();
      refreshRunButton();
    };
    list.appendChild(item);
  });
  if (typeof renderEditingBanner === "function") renderEditingBanner();
  renderRunnerWorkflow();
}

function refreshRunButton() {
  const hasAnyFile = !!state.output || state.inputs.length > 0;
  const hasOutput = !!state.output;
  const hasSteps = state.pipeline.length > 0;
  $("btn-run").disabled = !(hasAnyFile && hasSteps);
  $("btn-save").disabled = !hasSteps;
  $("btn-download").disabled = !hasOutput;
  renderRunnerWorkflow();
}

$("btn-run").onclick = () => {
  try {
    runPipeline();
    toast(`${state.pipeline.length}개 단계 실행 완료`, "success");
  } catch (err) {
    toast("실행 오류: " + err.message, "error");
  }
};
$("runner-run-btn").onclick = () => {
  if ($("runner-run-btn").disabled) return;
  if (window.runnerSetRunning) window.runnerSetRunning(true);
  // Give the UI a tick to paint the ring, then execute
  setTimeout(() => {
    try {
      runPipeline();
      toast(`${state.pipeline.length}개 단계 실행 완료`, "success");
      if (window.runnerSetDone) window.runnerSetDone();
    } catch (err) {
      toast("실행 오류: " + err.message, "error");
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
