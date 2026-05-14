/* ===================================================================
   DROP HANDLING
   =================================================================== */
function setupDrop(zone, input, handler) {
  if (!zone || !input) return;
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    handler(Array.from(e.dataTransfer.files));
  });
  input.addEventListener("change", e => {
    handler(Array.from(e.target.files));
    input.value = "";
  });
}

function setupNodeDrop(zone, input, handler) {
  if (!zone || !input) return;
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", e => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove("drag-over");
  });
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    handler(Array.from(e.dataTransfer.files));
  });
}

function beginUpload(label, total) {
  const job = { id: uid(), cancelled: false, total: total || 0, done: 0, label: label || "파일 업로드" };
  state.uploadJob = job;
  const box = $("upload-status");
  const text = $("upload-status-text");
  if (text) text.textContent = `${job.label} 중... 0/${job.total}`;
  if (box) box.hidden = false;
  const cancel = $("upload-cancel");
  if (cancel) cancel.onclick = () => {
    job.cancelled = true;
    if (text) text.textContent = "중단 요청됨. 현재 파일 처리 후 멈춥니다...";
  };
  return job;
}

function updateUpload(job, done, name) {
  if (!job || state.uploadJob !== job) return;
  job.done = done;
  const text = $("upload-status-text");
  if (text) text.textContent = `${job.label} 중... ${done}/${job.total}${name ? " - " + name : ""}`;
}

function finishUpload(job) {
  if (!job || state.uploadJob !== job) return;
  state.uploadJob = null;
  const box = $("upload-status");
  if (box) box.hidden = true;
}

function makeOutputTemplate(parsed) {
  const buf = parsed.originalBuffer;
  const original = deepClone({ ...parsed, originalBuffer: null });
  original.originalBuffer = buf;
  parsed.originalBuffer = buf;
  return { id: uid(), file: parsed, original };
}

function prepareMemoryForFileUpload(files) {
  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const largeUploadBytes = 8 * 1024 * 1024;
  if (totalBytes < largeUploadBytes || !state.history) return;
  state.history.undo = [];
  state.history.redo = [];
  if (typeof refreshHistoryButtons === "function") refreshHistoryButtons();
}

function activateOutputTemplate(index) {
  const tpl = state.outputTemplates[index];
  if (!tpl) return false;
  state.activeOutputIndex = index;
  state.output = tpl.file;
  state.outputOriginal = tpl.original;
  if (state.currentFileId === "output") {
    const sheetNames = state.output.sheetNames || [];
    if (!sheetNames.includes(state.currentSheet)) {
      state.currentSheet = sheetNames[0] || null;
      state.selectedSheets = state.currentSheet ? [state.currentSheet] : [];
    }
  }
  return true;
}

async function loadInputFiles(files) {
  if (!files.length) return;
  prepareMemoryForFileUpload(files);
  const startInputCount = state.inputs.length;
  const startOriginalCount = state.inputsOriginal.length;
  const job = beginUpload("입력 파일 업로드", files.length);
  try {
    for (let i = 0; i < files.length; i++) {
      if (job.cancelled) break;
      const f = files[i];
      updateUpload(job, i, f.name);
      await new Promise(requestAnimationFrame);
      try {
        const parsed = await parseFile(f);
        if (job.cancelled) break;
        parsed.originalBuffer = null;
        state.inputs.push(parsed);
        state.inputsOriginal.push(cloneFileRecord(parsed));
      } catch (err) {
        toast("파일 파싱 실패: " + f.name, "error");
        console.error(err);
      }
      updateUpload(job, i + 1, f.name);
    }
  } finally {
    finishUpload(job);
  }
  if (job.cancelled) {
    state.inputs.splice(startInputCount);
    state.inputsOriginal.splice(startOriginalCount);
    toast("파일 업로드를 중단하고 이전 상태로 복귀했습니다.", "success");
    return;
  }
  state.fuzzyResolution = {};
  renderInputList();
  refreshTabs();
  refreshChatState();
  if (typeof recomputeAllFormulas === "function") recomputeAllFormulas();
}

async function loadOutputTemplates(files) {
  if (!files.length) return;
  prepareMemoryForFileUpload(files);
  const job = beginUpload("출력 템플릿 업로드", files.length);
  const startIndex = state.outputTemplates.length;
  const previousActiveOutputIndex = state.activeOutputIndex;
  const previousOutput = state.output;
  const previousOutputOriginal = state.outputOriginal;
  try {
    for (let i = 0; i < files.length; i++) {
      if (job.cancelled) break;
      const f = files[i];
      updateUpload(job, i, f.name);
      await new Promise(requestAnimationFrame);
      try {
        const parsed = await parseFile(f);
        if (job.cancelled) break;
        state.outputTemplates.push(makeOutputTemplate(parsed));
      } catch (err) {
        toast("파일 파싱 실패: " + f.name, "error");
        console.error(err);
      }
      updateUpload(job, i + 1, f.name);
    }
  } finally {
    finishUpload(job);
  }
  if (job.cancelled) {
    state.outputTemplates.splice(startIndex);
    state.activeOutputIndex = previousActiveOutputIndex;
    state.output = previousOutput;
    state.outputOriginal = previousOutputOriginal;
    toast("출력 템플릿 업로드를 중단하고 이전 상태로 복귀했습니다.", "success");
    return;
  }
  if (state.outputTemplates.length > startIndex) {
    if (state.activeOutputIndex < 0 || !state.output) activateOutputTemplate(0);
    renderOutputChip();
    refreshTabs();
    refreshChatState();
    if (!state.currentFileId) setCurrentView("output:" + startIndex);
    toast(`${state.outputTemplates.length - startIndex}개 출력 템플릿을 로드했습니다.`, "success");
  }
}

setupDrop($("drop-inputs"), $("input-files"), loadInputFiles);
setupDrop($("drop-output"), $("output-file"), loadOutputTemplates);
setupNodeDrop($("runner-input-node"), $("input-files"), loadInputFiles);
setupNodeDrop($("runner-output-node"), $("output-file"), loadOutputTemplates);
setupNodeDrop($("runner-logic-node"), $("logic-files"), async (files) => {
  if (!files.length) return;
  try {
    await loadLogicFiles(files);
  } catch (err) {
    toast("불러오기 실패: " + err.message, "error");
    console.error(err);
  }
});

function removeInputFileAt(idx) {
  if (typeof pushHistory === "function") pushHistory("입력 파일 삭제");
  const removed = state.inputs.splice(idx, 1)[0];
  state.inputsOriginal.splice(idx, 1);
  if (removed && state.currentFileId === "input:" + removed.name) {
    state.currentFileId = null;
    state.currentSheet = null;
    state.selectedCell = null;
    state.selectedRange = null;
    state.selectedRanges = [];
    state.selectionAnchor = null;
  }
  renderInputList();
  refreshTabs();
  refreshChatState();
  renderExcelViewer();
}

function removeOutputTemplateAt(idx) {
  if (typeof pushHistory === "function") pushHistory("출력 템플릿 삭제");
  state.outputTemplates.splice(idx, 1);
  if (!state.outputTemplates.length) {
    state.output = null;
    state.outputOriginal = null;
    state.activeOutputIndex = -1;
    if (state.currentFileId === "output" || (state.currentFileId && state.currentFileId.startsWith("output:"))) {
      state.currentFileId = null;
      state.currentSheet = null;
      state.selectedCell = null;
      state.selectedRange = null;
      state.selectedRanges = [];
      state.selectionAnchor = null;
    }
  } else {
    activateOutputTemplate(0);
    if (state.currentFileId && state.currentFileId.startsWith("output:")) {
      const nextIdx = Math.min(idx, state.outputTemplates.length - 1);
      state.currentFileId = "output:" + nextIdx;
    }
  }
  renderOutputChip();
  refreshTabs();
  refreshChatState();
  renderExcelViewer();
}

function renderInputList() {
  const list = $("input-list");
  if (!list) return;
  list.innerHTML = "";
  const count = $("input-count");
  if (count) count.textContent = state.inputs.length + "개";
  state.inputs.forEach((f, idx) => {
    const div = document.createElement("div");
    div.className = "file-chip" + (state.currentFileId === "input:" + f.name ? " active" : "");
    const kb = (f.size / 1024).toFixed(1);
    const totalRows = Object.values(f.sheets).reduce((a, s) => a + s.length, 0);
    div.innerHTML = `
      <div class="chip-icon">XLSX</div>
      <div class="chip-body">
        <div class="chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
        <div class="chip-meta">${kb} KB · 시트 ${f.sheetNames.length}개 · 행 ${totalRows}</div>
      </div>
      <button class="chip-view" data-idx="${idx}">보기</button>
      <button class="chip-remove" data-idx="${idx}" title="삭제">×</button>
    `;
    list.appendChild(div);
  });
  list.querySelectorAll(".chip-view").forEach(btn => {
    btn.onclick = () => setCurrentView("input:" + state.inputs[btn.dataset.idx].name);
  });
  list.querySelectorAll(".chip-remove").forEach(btn => {
    btn.onclick = () => {
      removeInputFileAt(Number(btn.dataset.idx));
    };
  });
  renderRunnerWorkflow();
}

function renderOutputChip() {
  const el = $("output-chip");
  if (!el) return;
  el.innerHTML = "";
  if (!state.outputTemplates.length) {
    if ($("output-status")) $("output-status").textContent = "미업로드";
    state.output = null;
    state.outputOriginal = null;
    state.activeOutputIndex = -1;
    renderRunnerWorkflow();
    return;
  }
  if ($("output-status")) $("output-status").textContent = `${state.outputTemplates.length}개`;
  state.outputTemplates.forEach((tpl, idx) => {
    const f = tpl.file;
    const kb = (f.size / 1024).toFixed(1);
    const totalRows = Object.values(f.sheets).reduce((a, s) => a + s.length, 0);
    const div = document.createElement("div");
    div.className = "file-chip output";
    div.innerHTML = `
      <div class="chip-icon">XLSX</div>
      <div class="chip-body">
        <div class="chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
        <div class="chip-meta">${kb} KB · 시트 ${f.sheetNames.length}개 · 행 ${totalRows}</div>
      </div>
      <button class="chip-remove" data-idx="${idx}" title="삭제">×</button>
    `;
    el.appendChild(div);
  });
  el.querySelectorAll(".chip-remove").forEach(btn => {
    btn.onclick = () => {
      removeOutputTemplateAt(Number(btn.dataset.idx));
    };
  });
  renderRunnerWorkflow();
}

function openRunnerFileEditor(role) {
  const isOutput = role === "output";
  const files = isOutput ? state.outputTemplates.map(t => t.file) : state.inputs;
  const modal = $("modal");
  if (!modal) return;
  const title = isOutput ? "출력 템플릿 수정" : "입력 파일 수정";
  const emptyText = isOutput ? "업로드된 출력 템플릿이 없습니다." : "업로드된 입력 파일이 없습니다.";
  modal.innerHTML = `
    <h3>${title}</h3>
    <p style="font-size:12px; color:#666; margin-bottom:10px">실행기에 연결된 파일을 확인하고 필요 없는 파일을 제거할 수 있습니다.</p>
    <div class="runner-file-editor-list">
      ${files.length ? files.map((f, idx) => {
        const kb = (f.size / 1024).toFixed(1);
        const totalRows = Object.values(f.sheets || {}).reduce((a, s) => a + s.length, 0);
        return `
          <div class="file-chip ${isOutput ? "output" : ""}">
            <div class="chip-icon">XLSX</div>
            <div class="chip-body">
              <div class="chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
              <div class="chip-meta">${kb} KB · 시트 ${f.sheetNames.length}개 · 행 ${totalRows}</div>
            </div>
            <button class="chip-view" data-idx="${idx}" type="button">보기</button>
            <button class="chip-remove" data-idx="${idx}" type="button" title="삭제">×</button>
          </div>
        `;
      }).join("") : `<div class="pipeline-empty">${emptyText}</div>`}
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn-secondary" id="modal-cancel" type="button">닫기</button>
    </div>
  `;
  $("modal-bg").classList.add("show");
  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  modal.querySelectorAll(".chip-view").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      setCurrentView(isOutput ? "output:" + idx : "input:" + state.inputs[idx].name);
      $("modal-bg").classList.remove("show");
    };
  });
  modal.querySelectorAll(".chip-remove").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      if (isOutput) removeOutputTemplateAt(idx);
      else removeInputFileAt(idx);
      openRunnerFileEditor(role);
    };
  });
}

function renderRunnerWorkflow() {
  const inputNode = $("runner-input-node");
  const outputNode = $("runner-output-node");
  const logicNode = $("runner-logic-node");
  const resultNode = $("runner-result-node");
  const inputList = $("runner-input-list");
  const outputList = $("runner-output-list");
  const logicList = $("runner-logic-list");
  const resultList = $("runner-result-list");
  const summary = $("runner-summary");
  const runBtn = $("runner-run-btn");
  const downloadBtn = $("runner-download-btn");
  const setNodeStatus = (node, filled, label, onClick) => {
    if (!node) return;
    const status = node.querySelector(".runner-circle-status");
    if (!status) return;
    status.textContent = filled ? label : "비어있음";
    status.dataset.status = filled ? "ok" : "empty";
    status.classList.toggle("editable", !!filled);
    status.onclick = filled
      ? (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      : null;
  };

  if (inputList) {
    inputList.innerHTML = state.inputs.map(f => `<div class="workflow-pill" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>`).join("");
  }
  if (outputList) {
    outputList.innerHTML = state.outputTemplates.map((t, i) =>
      `<div class="workflow-pill" title="${escapeHtml(t.file.name)}">${escapeHtml(t.file.name)}</div>`
    ).join("");
  }
  if (logicList) {
    logicList.innerHTML = state.pipeline.map((step, idx) =>
      `<div class="workflow-pill ${isStepEnabled(step) ? "" : "disabled"}" title="${escapeHtml(step.description)}">${idx + 1}. ${escapeHtml(step.description)}${isStepEnabled(step) ? "" : " (OFF)"}</div>`
    ).join("");
  }
  if (resultList) {
    resultList.innerHTML = state.output && state.pipeline.length
      ? `<div class="workflow-pill">${state.pipeline.filter(isStepEnabled).length}개 활성 단계 실행 대상</div>`
      : "";
  }

  if (inputNode) inputNode.classList.toggle("filled", state.inputs.length > 0);
  if (outputNode) outputNode.classList.toggle("filled", !!state.output);
  if (logicNode) logicNode.classList.toggle("filled", state.pipeline.length > 0);
  if (resultNode) resultNode.classList.toggle("filled", !!state.output && state.pipeline.length > 0);
  setNodeStatus(inputNode, state.inputs.length > 0, "파일 수정", () => openRunnerFileEditor("input"));
  setNodeStatus(outputNode, state.outputTemplates.length > 0, "파일 수정", () => openRunnerFileEditor("output"));
  setNodeStatus(logicNode, state.pipeline.length > 0, "스킬 수정", () => {
    if (typeof setPage === "function") setPage("generator");
  });

  const setCount = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  setCount("runner-input-count", state.inputs.length);
  setCount("runner-output-count", state.outputTemplates.length || "–");
  setCount("runner-logic-count", state.pipeline.length);

  const runnable = (state.inputs.length > 0 || !!state.output) && state.pipeline.length > 0;
  const centerSub = $("runner-center-sub");
  if (centerSub && !resultNode?.classList.contains("running") && !resultNode?.classList.contains("done")) {
    centerSub.textContent = runnable ? "실행 준비" : "대기 중";
  }
  const heroBadge = $("runner-hero-badge");
  if (heroBadge) {
    heroBadge.classList.remove("ready", "running", "done");
    if (runnable) { heroBadge.classList.add("ready"); heroBadge.textContent = "실행 준비 완료"; }
    else { heroBadge.textContent = "대기 중"; }
  }

  const statInputs = $("runner-stat-inputs");
  const statTemplate = $("runner-stat-template");
  const statSteps = $("runner-stat-steps");
  const statState = $("runner-stat-state");
  if (statInputs) statInputs.textContent = state.inputs.length;
  if (statTemplate) statTemplate.textContent = state.outputTemplates.length || "–";
  if (statSteps) statSteps.textContent = state.pipeline.length;
  if (statState) statState.textContent = runnable ? "준비완료" : "준비";

  if (summary) {
    const current = state.currentFileId ? (getFile(state.currentFileId)?.name || "") + " / " + (state.currentSheet || "-") : "미리보기 없음";
    summary.innerHTML = state.inputs.length || state.output || state.pipeline.length
      ? `<span class="runner-summary-ico">●</span><span>입력 <b>${state.inputs.length}개</b> · 출력 템플릿 <b>${state.outputTemplates.length}개</b> · 스킬 단계 <b>${state.pipeline.length}개</b> · 현재 미리보기: ${escapeHtml(current)}</span>`
      : `<span class="runner-summary-ico">●</span><span>아직 로드된 파일과 스킬이 없습니다.</span>`;
  }

  if (runBtn) runBtn.disabled = !runnable;
  if (downloadBtn) downloadBtn.disabled = !state.output;
}

window.runnerSetRunning = function(running) {
  const node = document.getElementById("runner-result-node");
  const sub = document.getElementById("runner-center-sub");
  if (!node) return;
  node.classList.toggle("running", !!running);
  if (running) node.classList.remove("done");
  if (sub && running) sub.textContent = "실행 중...";
};

window.runnerSetDone = function() {
  const node = document.getElementById("runner-result-node");
  const sub = document.getElementById("runner-center-sub");
  if (!node) return;
  node.classList.remove("running");
  node.classList.add("done");
  if (sub) sub.textContent = "완료";
  setTimeout(() => {
    node.classList.remove("done");
    if (sub) sub.textContent = "실행 준비";
  }, 2500);
};
