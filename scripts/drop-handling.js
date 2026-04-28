/* ===================================================================
   DROP HANDLING
   =================================================================== */
function setupDrop(zone, input, handler) {
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

setupDrop($("drop-inputs"), $("input-files"), async (files) => {
  for (const f of files) {
    try {
      const parsed = await parseFile(f);
      state.inputs.push(parsed);
      state.inputsOriginal.push(cloneFileRecord(parsed));
    } catch (err) {
      toast("파일 파싱 실패: " + f.name, "error");
    }
  }
  // 파일이 바뀌면 fuzzy 캐시는 리셋해야 stale 매핑이 안 남는다.
  state.fuzzyResolution = {};
  renderInputList();
  refreshTabs();
  refreshChatState();
  if (typeof recomputeAllFormulas === "function") recomputeAllFormulas();
});

setupDrop($("drop-output"), $("output-file"), async (files) => {
  if (files.length === 0) return;
  const f = files[0];
  try {
    const parsed = await parseFile(f);
    state.output = parsed;
    const buf = parsed.originalBuffer;
    // deepClone 은 ArrayBuffer 를 복사하지 못하므로 버퍼는 별도 보관 후 다시 붙임
    state.outputOriginal = deepClone({ ...parsed, originalBuffer: null });
    state.outputOriginal.originalBuffer = buf;
    state.output.originalBuffer = buf;
    renderOutputChip();
    refreshTabs();
    refreshChatState();
    setCurrentView("output");
    if (state.pipeline.length > 0) {
      toast(`출력 템플릿 로드됨. 좌측 "▶ 전체 실행" 버튼을 눌러 ${state.pipeline.length}단계 로직을 적용하세요.`, "success");
    } else {
      toast("출력 템플릿 로드: " + f.name, "success");
    }
  } catch (err) {
    toast("파일 파싱 실패: " + f.name, "error");
  }
});

setupNodeDrop($("runner-input-node"), $("input-files"), async (files) => {
  if (!files.length) return;
  for (const f of files) {
    try {
      const parsed = await parseFile(f);
      state.inputs.push(parsed);
      state.inputsOriginal.push(cloneFileRecord(parsed));
    } catch (err) {
      toast("파일 파싱 실패: " + f.name, "error");
    }
  }
  state.fuzzyResolution = {};
  renderInputList();
  refreshTabs();
  refreshChatState();
  if (typeof recomputeAllFormulas === "function") recomputeAllFormulas();
});

setupNodeDrop($("runner-output-node"), $("output-file"), async (files) => {
  if (!files.length) return;
  const f = files[0];
  try {
    const parsed = await parseFile(f);
    state.output = parsed;
    const buf = parsed.originalBuffer;
    state.outputOriginal = deepClone({ ...parsed, originalBuffer: null });
    state.outputOriginal.originalBuffer = buf;
    state.output.originalBuffer = buf;
    renderOutputChip();
    refreshTabs();
    refreshChatState();
    setCurrentView("output");
    toast("출력 템플릿 로드: " + f.name, "success");
  } catch (err) {
    toast("파일 파싱 실패: " + f.name, "error");
  }
});

setupNodeDrop($("runner-logic-node"), $("logic-files"), async (files) => {
  if (!files.length) return;
  try {
    await loadLogicFiles(files);
  } catch (err) {
    toast("불러오기 실패: " + err.message, "error");
    console.error(err);
  }
});

function renderInputList() {
  const list = $("input-list");
  list.innerHTML = "";
  $("input-count").textContent = state.inputs.length + "개";
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
      <button class="chip-remove" data-idx="${idx}" title="삭제">✕</button>
    `;
    list.appendChild(div);
  });
  list.querySelectorAll(".chip-view").forEach(btn => {
    btn.onclick = () => setCurrentView("input:" + state.inputs[btn.dataset.idx].name);
  });
  list.querySelectorAll(".chip-remove").forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      const removed = state.inputs.splice(idx, 1)[0];
      state.inputsOriginal.splice(idx, 1);
      if (state.currentFileId === "input:" + removed.name) {
        state.currentFileId = null;
        state.currentSheet = null;
      }
      renderInputList();
      refreshTabs();
      refreshChatState();
      renderExcelViewer();
    };
  });
  renderRunnerWorkflow();
}

function renderOutputChip() {
  const el = $("output-chip");
  el.innerHTML = "";
  if (!state.output) {
    $("output-status").textContent = "미업로드";
    renderRunnerWorkflow();
    return;
  }
  $("output-status").textContent = "로드됨";
  const f = state.output;
  const kb = (f.size / 1024).toFixed(1);
  const totalRows = Object.values(f.sheets).reduce((a, s) => a + s.length, 0);
  const div = document.createElement("div");
  div.className = "file-chip output" + (state.currentFileId === "output" ? " active" : "");
  div.innerHTML = `
    <div class="chip-icon">XLSX</div>
    <div class="chip-body">
      <div class="chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
      <div class="chip-meta">${kb} KB · 시트 ${f.sheetNames.length}개 · 행 ${totalRows}</div>
    </div>
    <button class="chip-view" id="view-output">보기</button>
    <button class="chip-remove" id="remove-output" title="삭제">✕</button>
  `;
  el.appendChild(div);
  $("view-output").onclick = () => setCurrentView("output");
  $("remove-output").onclick = () => {
    state.output = null;
    state.outputOriginal = null;
    if (state.currentFileId === "output") {
      state.currentFileId = null; state.currentSheet = null;
    }
    renderOutputChip();
    refreshTabs();
    refreshChatState();
    renderExcelViewer();
  };
  renderRunnerWorkflow();
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
  if (!inputList || !outputList || !logicList || !resultList || !summary || !runBtn || !downloadBtn) return;

  inputList.innerHTML = state.inputs.length
    ? state.inputs.map(f => `<div class="workflow-pill" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>`).join("")
    : ``;
  outputList.innerHTML = state.output
    ? `<div class="workflow-pill" title="${escapeHtml(state.output.name)}">${escapeHtml(state.output.name)}</div>`
    : ``;
  logicList.innerHTML = state.pipeline.length
    ? state.pipeline.map((step, idx) => `<div class="workflow-pill" title="${escapeHtml(step.description)}">${idx + 1}. ${escapeHtml(step.description)}</div>`).join("")
    : ``;
  resultList.innerHTML = state.output && state.pipeline.length
    ? `<div class="workflow-pill">${state.pipeline.length}개 단계 실행 대상</div>`
    : ``;

  if (inputNode) inputNode.classList.toggle("filled", state.inputs.length > 0);
  if (outputNode) outputNode.classList.toggle("filled", !!state.output);
  if (logicNode) logicNode.classList.toggle("filled", state.pipeline.length > 0);
  if (resultNode) resultNode.classList.toggle("filled", !!state.output && state.pipeline.length > 0);

  // Circle count badges
  const setCount = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  setCount('runner-input-count', state.inputs.length);
  setCount('runner-output-count', state.output ? '1' : '—');
  setCount('runner-logic-count', state.pipeline.length);

  // Circle status pills (new layout)
  const setStatus = (node, ok, okLabel, emptyLabel) => {
    if (!node) return;
    const pill = node.querySelector('.runner-circle-status') || node.querySelector('.runner-step-status');
    if (!pill) return;
    pill.dataset.status = ok ? 'ok' : 'empty';
    pill.textContent = ok ? okLabel : emptyLabel;
  };
  setStatus(inputNode, state.inputs.length > 0, `${state.inputs.length}개`, '비어있음');
  setStatus(outputNode, !!state.output, '연결됨', '비어있음');
  setStatus(logicNode, state.pipeline.length > 0, `${state.pipeline.length}단계`, '비어있음');

  const runnable = (state.inputs.length > 0 || !!state.output) && state.pipeline.length > 0;

  // Center (4) sub label
  const centerSub = $("runner-center-sub");
  if (centerSub && !resultNode?.classList.contains('running') && !resultNode?.classList.contains('done')) {
    centerSub.textContent = runnable ? '실행 준비' : '대기 중';
  }

  // Hero badge
  const heroBadge = $("runner-hero-badge");
  if (heroBadge) {
    heroBadge.classList.remove('ready','running','done');
    if (runnable) { heroBadge.classList.add('ready'); heroBadge.textContent = '실행 준비 완료'; }
    else { heroBadge.textContent = '대기 중'; }
  }

  // Stats
  const statInputs = $("runner-stat-inputs");
  const statTemplate = $("runner-stat-template");
  const statSteps = $("runner-stat-steps");
  const statState = $("runner-stat-state");
  if (statInputs) statInputs.textContent = state.inputs.length;
  if (statTemplate) statTemplate.textContent = state.output ? '1' : '—';
  if (statSteps) statSteps.textContent = state.pipeline.length;
  if (statState) statState.textContent = runnable ? '준비완료' : '준비';

  const hasAny = state.inputs.length || state.output || state.pipeline.length;
  summary.innerHTML = hasAny
    ? `<span class="runner-summary-ico">📊</span><span>` + [
        `입력 <b>${state.inputs.length}개</b>`,
        `출력 템플릿 <b>${state.output ? "1개" : "0개"}</b>`,
        `로직 단계 <b>${state.pipeline.length}개</b>`,
        state.currentFileId ? `현재 미리보기: ${escapeHtml(getFile(state.currentFileId)?.name || "")} / ${escapeHtml(state.currentSheet || "-")}` : "미리보기 없음",
      ].join(" · ") + `</span>`
    : `<span class="runner-summary-ico">💡</span><span>아직 로드된 파일과 로직이 없습니다. 위 4단계를 순서대로 채워주세요.</span>`;

  runBtn.disabled = !runnable;
  downloadBtn.disabled = !state.output;
}

// Running state helpers for center circle
window.runnerSetRunning = function(running) {
  const node = document.getElementById('runner-result-node');
  const sub = document.getElementById('runner-center-sub');
  if (!node) return;
  node.classList.toggle('running', !!running);
  if (running) node.classList.remove('done');
  if (sub && running) sub.textContent = '실행 중...';
};
window.runnerSetDone = function() {
  const node = document.getElementById('runner-result-node');
  const sub = document.getElementById('runner-center-sub');
  if (!node) return;
  node.classList.remove('running');
  node.classList.add('done');
  if (sub) sub.textContent = '완료';
  setTimeout(() => {
    node.classList.remove('done');
    if (sub) sub.textContent = '실행 준비';
  }, 2500);
};
