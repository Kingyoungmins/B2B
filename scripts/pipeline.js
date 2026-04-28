/* ===================================================================
   LOGIC PIPELINE
   =================================================================== */
function applyLogic(step) {
  try {
    runPipeline([...state.pipeline, step]);
    state.pipeline.push(step);
    renderPipeline();
    refreshRunButton();
    toast(`"${step.description}" 단계가 추가되었습니다`, "success");
  } catch (err) {
    reportPipelineError(err);
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
    reportPipelineError(err);
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
  for (let i = 0; i < stepIdx && i < state.pipeline.length; i++) {
    const step = state.pipeline[i];
    try {
      const fn = new Function("inputs", "output", "col", "findColumnGlobal", "similarity",
        "insertColumns", "copyColumns", "deleteColumns", "shiftFormulaText",
        step.code +
        "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };"
      );
      const result = fn(proxiedInputs, proxiedOutput, col, findColumnGlobal, similarity,
        typeof insertColumns === "function" ? insertColumns : null,
        typeof copyColumns === "function" ? copyColumns : null,
        typeof deleteColumns === "function" ? deleteColumns : null,
        typeof shiftFormulaText === "function" ? shiftFormulaText : null);
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

  // 유사도 매칭 Proxy로 감싸기 (item 1).
  // 각 시트 객체도 fuzzy proxy 로 감싸서 시트명/컬럼명 모두 관용적으로 처리.
  const wrapSheets = (sheetsObj) => {
    if (!sheetsObj || typeof sheetsObj !== "object") return sheetsObj;
    return (typeof fuzzyProxy === "function") ? fuzzyProxy(sheetsObj, { cache: state.fuzzyResolution }) : sheetsObj;
  };
  const wrappedInputs = {};
  Object.keys(inputsMap).forEach(fileName => {
    wrappedInputs[fileName] = wrapSheets(inputsMap[fileName]);
  });
  const proxiedInputs = (typeof fuzzyProxy === "function")
    ? fuzzyProxy(wrappedInputs, { cache: state.fuzzyResolution })
    : wrappedInputs;
  const proxiedOutput = wrapSheets(outputSheets);

  // 사용자 코드에서 쓸 수 있는 헬퍼 — `col(sheet, "이름")` 등.
  const helpers = {
    col: typeof col === "function" ? col : null,
    findColumnGlobal: typeof findColumnGlobal === "function" ? findColumnGlobal : null,
    similarity: typeof similarity === "function" ? similarity : null,
  };

  state.lastError = null;
  steps.forEach((step, stepIdx) => {
    let fn;
    try {
      fn = new Function("inputs", "output", "col", "findColumnGlobal", "similarity",
        "insertColumns", "copyColumns", "deleteColumns", "shiftFormulaText",
        step.code +
        "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };"
      );
    } catch (err) {
      state.lastError = {
        stepIdx, description: step.description || `Step ${stepIdx + 1}`,
        message: "코드 컴파일 오류: " + err.message, stack: err.stack || "",
      };
      throw _stepError(state.lastError);
    }
    let result;
    try {
      result = fn(proxiedInputs, proxiedOutput,
        helpers.col, helpers.findColumnGlobal, helpers.similarity,
        typeof insertColumns === "function" ? insertColumns : null,
        typeof copyColumns === "function" ? copyColumns : null,
        typeof deleteColumns === "function" ? deleteColumns : null,
        typeof shiftFormulaText === "function" ? shiftFormulaText : null);
    } catch (err) {
      state.lastError = {
        stepIdx, description: step.description || `Step ${stepIdx + 1}`,
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
  });

  state.inputs.forEach(file => {
    file.sheets = inputsMap[file.name] || {};
    syncFileMetadata(file);
  });

  if (state.output) syncFileMetadata(state.output);

  // 수식 재평가 (item 10) — 모든 파일/시트의 수식을 현재 데이터로 다시 계산.
  recomputeAllFormulas();

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

// runPipeline 에서 발생한 step 오류를 풍부한 메시지로 감싸 던진다 (item 9).
function _stepError(info) {
  const stepLabel = `Step ${info.stepIdx + 1}` + (info.description ? ` (${info.description})` : "");
  const err = new Error(`${stepLabel} 실행 중 오류 — ${info.message}`);
  err._stepInfo = info;
  return err;
}

// 모든 파일/시트의 수식을 현재 데이터로 재평가해 state.formulaResults 에 저장.
// 시뮬레이터 렌더 시 이 결과로 셀 표시값을 덮어쓴다.
function recomputeAllFormulas() {
  if (typeof recomputeSheetFormulas !== "function") return;
  state.formulaResults = {};
  const filesById = [];
  state.inputs.forEach(f => filesById.push({ id: "input:" + f.name, file: f }));
  if (state.output) filesById.push({ id: "output", file: state.output });
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
    reportPipelineError(err);
  }
};

// item 9: 어느 단계에서 어떤 사유로 실패했는지 토스트 + 채팅 panel 에 모두 노출.
function reportPipelineError(err) {
  const info = err && err._stepInfo;
  const head = info
    ? `Step ${info.stepIdx + 1} 실행 오류 — ${info.description}`
    : "실행 오류";
  toast(`${head}: ${err.message}`, "error");
  // 채팅 영역에도 시스템 메시지로 남긴다 (chat 가 활성일 때만).
  const chatBox = document.getElementById("chat-messages");
  if (chatBox && info) {
    const div = document.createElement("div");
    div.className = "msg system error";
    div.innerHTML = `
      <div><b>❌ Step ${info.stepIdx + 1} 실행 실패</b> — ${escapeHtml(info.description || "")}</div>
      <div style="margin-top:6px; font-size:11.5px; color:#dc2626; white-space:pre-wrap; text-align:left;">${escapeHtml(info.message)}</div>
      ${info.stack ? `<details style="margin-top:6px; text-align:left;"><summary style="cursor:pointer; font-size:11px; color:#888;">스택 트레이스</summary><pre style="font-size:10.5px; color:#666; white-space:pre-wrap;">${escapeHtml(info.stack)}</pre></details>` : ""}
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}
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
      reportPipelineError(err);
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
