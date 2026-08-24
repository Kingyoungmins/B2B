/* ===================================================================
   DROP HANDLING
   =================================================================== */
function setupDrop(zone, input, handler) {
  if (!zone || !input) return;
  input.multiple = true;
  input.setAttribute("multiple", "multiple");
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
  input.multiple = true;
  input.setAttribute("multiple", "multiple");
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

function workbookDisplayName(file, fallback) {
  const raw = file && (file.name || file.originalName || file.displayName);
  const name = String(raw || "").trim();
  return name || fallback || "파일";
}

function ensureWorkbookDisplayName(parsed, sourceFile, fallback) {
  if (!parsed) return parsed;
  const sourceName = sourceFile && sourceFile.name;
  parsed.name = workbookDisplayName(parsed, sourceName || fallback);
  parsed.originalName = parsed.originalName || sourceName || parsed.name;
  return parsed;
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
  // [필드#2] 업로드(파싱~미러 오픈) 동안 탭 전환/엑셀 뷰 클릭이 끼어들면 상태가 어긋난다 —
  // 전 구간을 전역 busy 게이트로 잠그고, 중단은 오버레이의 '작업 중단' 버튼으로 받는다.
  const busyToken = typeof beginUiBusy === "function"
    ? beginUiBusy("입력 파일 업로드 중...", {
        onStop: () => { job.cancelled = true; },
        stopLabel: "업로드 중단",
        stoppingLabel: "중단 중...",
      })
    : null;
  try {
    for (let i = 0; i < files.length; i++) {
      if (job.cancelled) break;
      const f = files[i];
      updateUpload(job, i, f.name);
      await new Promise(requestAnimationFrame);
      try {
        const parsed = typeof parseFileWithBackendPreview === "function"
          ? await parseFileWithBackendPreview(f)
          : await parseFile(f);
        if (job.cancelled) break;
        ensureWorkbookDisplayName(parsed, f, `입력 파일 ${startInputCount + i + 1}`);
        parsed.originalBuffer = null;
        state.inputs.push(parsed);
        state.inputsOriginal.push(cloneFileRecord(parsed));
      } catch (err) {
        toast("파일 파싱 실패: " + f.name, "error");
        console.error(err);
      }
      updateUpload(job, i + 1, f.name);
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
    if (state.inputs.length > startInputCount) {
      const lastInput = state.inputs[state.inputs.length - 1];
      const selected = lastInput ? "input:" + lastInput.name : null;
      if (selected) {
        updateUpload(job, files.length, "실제 Excel 창 여는 중...");
        if (typeof preopenAllExcelMirrors === "function") {
          await preopenAllExcelMirrors(selected, { source: "upload" });
        } else if (typeof openExcelMirrorForFileId === "function") {
          await openExcelMirrorForFileId(selected, { source: "upload" });
        }
      }
    }
  } finally {
    if (busyToken && typeof endUiBusy === "function") endUiBusy(busyToken, { silentComplete: true });
    finishUpload(job);
  }
}

async function loadOutputTemplates(files) {
  if (!files.length) return;
  prepareMemoryForFileUpload(files);
  const job = beginUpload("출력 템플릿 업로드", files.length);
  // [필드#2] 업로드(파싱~미러 오픈) 동안 탭 전환/엑셀 뷰 클릭이 끼어들면 상태가 어긋난다 —
  // 전 구간을 전역 busy 게이트로 잠그고, 중단은 오버레이의 '작업 중단' 버튼으로 받는다.
  const busyToken = typeof beginUiBusy === "function"
    ? beginUiBusy("출력 템플릿 업로드 중...", {
        onStop: () => { job.cancelled = true; },
        stopLabel: "업로드 중단",
        stoppingLabel: "중단 중...",
      })
    : null;
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
        const parsed = typeof parseFileWithBackendPreview === "function"
          ? await parseFileWithBackendPreview(f)
          : await parseFile(f);
        if (job.cancelled) break;
        ensureWorkbookDisplayName(parsed, f, `출력 파일 ${startIndex + i + 1}`);
        state.outputTemplates.push(makeOutputTemplate(parsed));
      } catch (err) {
        toast("파일 파싱 실패: " + f.name, "error");
        console.error(err);
      }
      updateUpload(job, i + 1, f.name);
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
      const lastOutputFileId = "output:" + (state.outputTemplates.length - 1);
      updateUpload(job, files.length, "실제 Excel 창 여는 중...");
      if (typeof preopenAllExcelMirrors === "function") {
        await preopenAllExcelMirrors(lastOutputFileId, { source: "upload" });
      } else if (typeof openExcelMirrorForFileId === "function") {
        await openExcelMirrorForFileId(lastOutputFileId, { source: "upload" });
      } else if (!state.currentFileId) {
        setCurrentView(lastOutputFileId, { source: "upload" });
      }
      toast(`${state.outputTemplates.length - startIndex}개 출력 템플릿을 로드했습니다.`, "success");
    }
  } finally {
    if (busyToken && typeof endUiBusy === "function") endUiBusy(busyToken, { silentComplete: true });
    finishUpload(job);
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

function firstAvailableFileId() {
  if (state.inputs && state.inputs.length) return "input:" + state.inputs[0].name;
  if (state.outputTemplates && state.outputTemplates.length) return "output:0";
  if (state.output) return "output";
  return null;
}

// 현재 보던 파일을 닫은 뒤, 남은 파일로 전환해 그 미러를 즉시 표시한다.
// 남은 파일이 없으면 선택을 비우고 모든 Excel 미러를 숨긴다.
function selectFallbackFileAfterRemoval() {
  state.currentFileId = null;
  state.currentSheet = null;
  state.selectedCell = null;
  state.selectedRange = null;
  state.selectedRanges = [];
  state.selectionAnchor = null;
  if (typeof hideAllExcelMirrorWindows === "function") {
    hideAllExcelMirrorWindows().catch(() => {});
  }
}

function removeInputFileAt(idx) {
  if (typeof pushHistory === "function") pushHistory("입력 파일 삭제");
  const removed = state.inputs.splice(idx, 1)[0];
  state.inputsOriginal.splice(idx, 1);
  const removedFileId = removed ? "input:" + removed.name : "";
  const wasCurrent = removed && state.currentFileId === removedFileId;
  if (removedFileId && typeof closeExcelMirrorForFileId === "function") {
    closeExcelMirrorForFileId(removedFileId).catch(err => console.warn("Failed to close removed input Excel mirror:", err));
  }
  if (wasCurrent) {
    selectFallbackFileAfterRemoval();
  }
  renderInputList();
  refreshTabs();
  refreshChatState();
  renderExcelViewer();
}

function removeOutputTemplateAt(idx) {
  if (typeof pushHistory === "function") pushHistory("출력 템플릿 삭제");
  const wasCurrentOutput = state.currentFileId === "output" ||
    (state.currentFileId && state.currentFileId.startsWith("output:"));
  if (typeof closeExcelMirrorForFileId === "function") {
    for (let i = idx; i < state.outputTemplates.length; i++) {
      closeExcelMirrorForFileId("output:" + i).catch(err => console.warn("Failed to close removed output Excel mirror:", err));
    }
  }
  state.outputTemplates.splice(idx, 1);
  if (!state.outputTemplates.length) {
    state.output = null;
    state.outputOriginal = null;
    state.activeOutputIndex = -1;
    if (wasCurrentOutput) {
      selectFallbackFileAfterRemoval();
    }
  } else {
    activateOutputTemplate(0);
    if (wasCurrentOutput) {
      selectFallbackFileAfterRemoval();
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
    const totalRows = getTotalWorkbookRows(f).toLocaleString("ko-KR");
    div.innerHTML = `
      <div class="chip-icon">XLSX</div>
      <div class="chip-body">
        <div class="chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
        <div class="chip-meta">${kb} KB \u00B7 \uC2DC\uD2B8 ${f.sheetNames.length}\uAC1C \u00B7 \uC804\uCCB4 ${totalRows}\uD589</div>
      </div>
      <button class="chip-view" data-idx="${idx}">보기</button>
      <button class="chip-remove" data-idx="${idx}" title="삭제">×</button>
    `;
    list.appendChild(div);
  });
  list.querySelectorAll(".chip-view").forEach(btn => {
    btn.onclick = () => showTopTabSwitchHint();
  });
  list.querySelectorAll(".chip-remove").forEach(btn => {
    btn.onclick = () => {
      removeInputFileAt(Number(btn.dataset.idx));
    };
  });
  renderRunnerWorkflow();
}

function getTotalWorkbookRows(file) {
  const dims = (file && file.backendPreviewDimensions) || {};
  const metaSheets = (file && file.backendWorkbookMeta && file.backendWorkbookMeta.sheets) || {};
  const names = file && file.sheetNames ? file.sheetNames : Object.keys((file && file.sheets) || {});
  return names.reduce((total, sheetName) => {
    const dimRows = Number((dims[sheetName] && dims[sheetName].maxRow) ||
      (metaSheets[sheetName] && metaSheets[sheetName].maxRow)) || 0;
    const sheetRows = ((file.sheets || {})[sheetName] || []).length || 0;
    return total + Math.max(dimRows, sheetRows);
  }, 0);
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
    const totalRows = getTotalWorkbookRows(f).toLocaleString("ko-KR");
    const div = document.createElement("div");
    div.className = "file-chip output";
    div.innerHTML = `
      <div class="chip-icon">XLSX</div>
      <div class="chip-body">
        <div class="chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
        <div class="chip-meta">${kb} KB \u00B7 \uC2DC\uD2B8 ${f.sheetNames.length}\uAC1C \u00B7 \uC804\uCCB4 ${totalRows}\uD589</div>
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
        const totalRows = getTotalWorkbookRows(f).toLocaleString("ko-KR");
        return `
          <div class="file-chip ${isOutput ? "output" : ""}">
            <div class="chip-icon">XLSX</div>
            <div class="chip-body">
              <div class="chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
              <div class="chip-meta">${kb} KB \u00B7 \uC2DC\uD2B8 ${f.sheetNames.length}\uAC1C \u00B7 \uC804\uCCB4 ${totalRows}\uD589</div>
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
      showTopTabSwitchHint();
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

// [실행기 스킬 편집기] '스킬 수정'은 입력/출력의 '파일 수정/다운'과 같은 자리·같은 방식이어야 한다 —
// 예전엔 곧장 생성기로 화면을 전환해 버려서, 올린 스킬 zip 을 빼거나 다른 zip 으로 바꿀 수단이 없었다.
// 여기서는 (1) 올린 스킬 확인 (2) 제거(=파이프라인 비우기) (3) 다른 zip 올리기 (4) 필요하면 생성기에서 편집.
function openRunnerLogicEditor() {
  const modal = $("modal");
  if (!modal) return;
  const steps = state.pipeline || [];
  const name = state.logicSaveBaseName || "불러온 스킬";
  const enabled = steps.filter(s => s && s.enabled !== false).length;
  modal.innerHTML = `
    <h3>스킬 수정</h3>
    <p style="font-size:12px; color:#666; margin-bottom:10px">실행기에 연결된 스킬을 확인하고, 제거하거나 다른 스킬로 바꿀 수 있습니다.</p>
    <div class="runner-file-editor-list">
      ${steps.length ? `
        <div class="file-chip">
          <div class="chip-icon">ZIP</div>
          <div class="chip-body">
            <div class="chip-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
            <div class="chip-meta">${steps.length}단계 · 활성 ${enabled}개</div>
          </div>
          <button class="chip-view" id="runner-logic-edit" type="button">단계 편집</button>
          <button class="chip-remove" id="runner-logic-remove" type="button" title="스킬 제거">×</button>
        </div>` : `<div class="pipeline-empty">업로드된 스킬이 없습니다. 아래에서 스킬(zip)을 올려주세요.</div>`}
    </div>
    <div class="row" style="margin-top:14px; gap:8px">
      <button class="btn-secondary" id="runner-logic-upload" type="button">스킬(zip) 올리기</button>
      <button class="btn-secondary" id="modal-cancel" type="button">닫기</button>
    </div>
  `;
  $("modal-bg").classList.add("show");
  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  const upload = $("runner-logic-upload");
  if (upload) upload.onclick = () => { const inp = $("logic-files"); if (inp) inp.click(); };
  const edit = $("runner-logic-edit");
  if (edit) edit.onclick = () => {
    $("modal-bg").classList.remove("show");
    if (typeof setPage === "function") setPage("generator");   // 단계 편집 UI 는 생성기에만 있음
  };
  const remove = $("runner-logic-remove");
  if (remove) remove.onclick = () => {
    if (typeof clearRunnerLogic === "function") clearRunnerLogic();
    openRunnerLogicEditor();
  };
}

// 올린 스킬을 비운다(파이프라인 + 매핑 + 대화). 파일은 건드리지 않는다 — 스킬만 교체하는 흐름.
function clearRunnerLogic() {
  if (typeof pushHistory === "function") { try { pushHistory("스킬 제거"); } catch (_) {} }
  state.pipeline = [];
  state.editingStepId = null;
  state.logicSaveBaseName = "";      // 다음에 올리는 스킬 이름과 섞이지 않게
  state.runnerMappings = {};
  state.runnerMappingChecked = false;
  state.runnerMappingSignature = "";
  if (typeof clearPipelineResumeFromIndex === "function") { try { clearPipelineResumeFromIndex(); } catch (_) {} }
  // 불러온 스킬이 사라졌으니 '라이브에 적용됨' 장부도 무효화(다음 실행이 no-op 으로 건너뛰지 않게).
  if (typeof invalidateLivePipelineApplied === "function") { try { invalidateLivePipelineApplied(); } catch (_) {} }
  if (typeof renderPipeline === "function") renderPipeline();
  if (typeof refreshRunButton === "function") refreshRunButton();
  if (typeof renderRunnerWorkflow === "function") renderRunnerWorkflow();
  if (typeof toast === "function") toast("스킬을 제거했습니다. 다른 스킬(zip)을 올릴 수 있습니다.", "success");
}

function runnerMappingFileId(file, idx, role) {
  if (role === "output") {
    return typeof outputTemplateFileId === "function" ? outputTemplateFileId(idx) : "output:" + idx;
  }
  return "input:" + workbookDisplayName(file, `입력 파일 ${idx + 1}`);
}

function runnerMappingKnownFiles() {
  const out = [];
  (state.inputs || []).forEach((file, idx) => {
    if (!file) return;
    out.push({
      id: runnerMappingFileId(file, idx, "input"),
      file,
      name: workbookDisplayName(file, `입력 파일 ${idx + 1}`),
      role: "input",
    });
  });
  (state.outputTemplates || []).forEach((tpl, idx) => {
    const file = tpl && tpl.file;
    if (!file) return;
    out.push({
      id: runnerMappingFileId(file, idx, "output"),
      file,
      name: workbookDisplayName(file, `출력 파일 ${idx + 1}`),
      role: "output",
    });
  });
  if (state.output && !(state.outputTemplates && state.outputTemplates.length)) {
    out.push({ id: "output", file: state.output, name: workbookDisplayName(state.output, "출력 파일"), role: "output" });
  }
  return out;
}

function runnerMappingSheetNames(file) {
  return (file && (file.sheetNames || Object.keys(file.sheets || {}))) || [];
}

function runnerMappingNorm(value) {
  if (typeof normalizeText === "function") return normalizeText(value);
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function runnerMappingStem(value) {
  return runnerMappingNorm(String(value || "").replace(/\.[^.]+$/, ""));
}

function runnerMappingKey(book, sheet) {
  return `${String(book || "").trim()}\u0000${String(sheet || "").trim()}`;
}

function runnerCleanWorkbookRequirementName(value) {
  let clean = String(value || "").trim();
  if (!/\.xls(?:x|m|b)?$/i.test(clean)) return clean;
  // Loose workbook-name extraction can over-capture English prose, e.g.
  // "Create Validation_Result sheet from expected_output.xlsx". Keep Korean
  // filenames with spaces intact, but trim obvious English prose prefixes.
  const lastToken = /([^\s\\/:*?"<>|\[\]]+\.xls(?:x|m|b)?)$/i.exec(clean);
  if (lastToken && lastToken.index > 0) {
    const prefix = clean.slice(0, lastToken.index).trim();
    // [앞부분 잘림 수정] 산문 판정은 '공백으로 구분된 독립 단어'일 때만. 예전 \b 부분일치는
    // "input)_기업DW추출_131 통화상세내역(마스킹)_2026-03-13 10_02_56_….xlsx" 처럼 파일명 자체가
    // input/output 으로 시작하고 공백(타임스탬프)을 품으면 마지막 토큰만 남겨 — 요구 파일명이
    // "10_02_56_….xlsx" 로 잘리고, 그 잘린 이름이 자동매칭 점수·실행 치환에까지 쓰였다.
    const prose = /^(?:from|to|into|copy|create|created|sheet|file|workbook|output|input|target|source)[.,:;]?$/i;
    if (prefix.split(/\s+/).some(t => prose.test(t))) {
      clean = lastToken[1];
    }
  }
  return clean;
}

// [역할(안정키) 정규화 — 같은 파일의 다른 달 이름 통합] 스킬 안에는 같은 파일이 시기마다 다른
// 이름(4월/5월)으로 스텝 꼬리표·@범위 에코·코드 리터럴에 남을 수 있다(사용자 실측 zip 2건).
// 요구 추출이 그 이름들을 그대로 행으로 만들면 파일확인이 같은 파일을 여러 줄로 요구한다.
// 여기서 envConfig(저장 시점 정본)를 '역할표'로 삼아 요구의 book 을 정본 이름으로 정규화하고,
// 같은 (정본, 시트) 요구를 한 행으로 합친다. 원문 이름은 req.aliases 로 보존해 실행 치환이
// 코드/프롬프트 속 옛 이름까지 전부 실제 파일명으로 바꾼다 — v4 자리표의 실패 원인이던
// '코드 자체를 훼손'하는 방식이 아니라 경계(요구·치환)에서만 정규화한다.
// 가드: 정본 없으면 무변화(구버전 zip). 정본에 같은 안정키 파일이 2개면(진짜로 두 달을 함께 쓰는
// 스킬) 그 키는 정규화하지 않는다(모호 금지 — 월 재바인딩과 동일 원칙).
function runnerCanonicalizeRequirementsByEnv(map, cfg) {
  const out = { renamed: [], merged: [] };
  if (!cfg || typeof cfg !== "object") return out;
  const cfgFiles = [...(Array.isArray(cfg.inputs) ? cfg.inputs : []),
                    ...(Array.isArray(cfg.outputs) ? cfg.outputs : [])]
    .filter(f => f && (f.name || f.displayName));
  if (!cfgFiles.length) return out;
  const stable = (n) => {
    try {
      return ((typeof pipelineStableWorkbookKey === "function")
        ? pipelineStableWorkbookKey(n) : "") || "";
    } catch (_) { return ""; }
  };
  const byKey = new Map();   // 안정키 → Set(정본 파일)
  for (const f of cfgFiles) {
    for (const n of [f.name, f.displayName]) {
      if (!n) continue;
      const k = stable(n);
      if (!k || k.length < 4) continue;
      if (!byKey.has(k)) byKey.set(k, new Set());
      byKey.get(k).add(f);
    }
  }
  const cfgOf = (book) => {   // book 이 가리키는 정본 파일(안정키 유일일 때만)
    const k = stable(book);
    if (!k || k.length < 4) return null;
    const set = byKey.get(k);
    if (!set || set.size !== 1) return null;   // 모호(같은 계열 정본 2개) → 정규화 금지
    return Array.from(set)[0];
  };
  // [시트도 동일 원칙] 시트명에 월이 박힌 경우("원가_4월", "202605_..._P")도 정본 시트로 정규화.
  // 파일보다 후보 공간이 좁아(한 파일의 시트들) 키 길이 하한은 2자. 유일 일치만, 원문은 sheetAliases.
  const sheetCanonOf = (cfgFile, sheet) => {
    const names = (cfgFile && Array.isArray(cfgFile.sheetNames)) ? cfgFile.sheetNames : [];
    if (!names.length || !sheet) return null;
    if (names.some(n => runnerMappingNorm(n) === runnerMappingNorm(sheet))) return null;   // 이미 정본
    const k = stable(sheet);
    if (!k || k.length < 2) return null;
    const hits = names.filter(n => stable(n) === k);
    return hits.length === 1 ? hits[0] : null;
  };
  for (const [key, req] of Array.from(map.entries())) {
    if (!req || !req.book) continue;
    const cfgF = cfgOf(req.book);
    if (!cfgF) continue;
    const canon = cfgF.name || cfgF.displayName || null;
    if (!canon) continue;
    const bookChanged = runnerMappingNorm(canon) !== runnerMappingNorm(req.book);
    const sheetCanon = sheetCanonOf(cfgF, req.sheet);
    if (!bookChanged && !sheetCanon) continue;
    map.delete(key);
    const newSheet = sheetCanon || req.sheet;
    const newKey = runnerMappingKey(canon, newSheet);
    const exist = map.get(newKey);
    const mergeAliases = (a, b) => Array.from(new Set([...(a || []), ...(b || [])]));
    if (exist) {   // 같은 (정본,시트) 행이 이미 있음 → 별칭만 흡수(한 행으로 합쳐짐)
      if (bookChanged) exist.aliases = mergeAliases(exist.aliases, [req.book, ...(req.aliases || [])]);
      else exist.aliases = mergeAliases(exist.aliases, req.aliases);
      if (sheetCanon) exist.sheetAliases = mergeAliases(exist.sheetAliases, [req.sheet, ...(req.sheetAliases || [])]);
      else exist.sheetAliases = mergeAliases(exist.sheetAliases, req.sheetAliases);
      out.merged.push(req.book + "/" + (req.sheet || "") + " -> " + canon + "/" + (newSheet || ""));
    } else {
      map.set(newKey, {
        ...req, key: newKey, book: canon, sheet: newSheet,
        aliases: bookChanged ? mergeAliases([req.book], req.aliases) : (req.aliases || []),
        sheetAliases: sheetCanon ? mergeAliases([req.sheet], req.sheetAliases) : (req.sheetAliases || []),
      });
      out.renamed.push(req.book + "/" + (req.sheet || "") + " -> " + canon + "/" + (newSheet || ""));
    }
  }
  return out;
}

// [환경 config 교집합 — 0.6.2 아이디어] 저장 시점의 실제 파일·시트 정본(envConfig)으로 요구를
// 검증한다: ① 정본에 없는 파일명 요구 = 휴리스틱 오인(제목/서술문 조각) → 제거,
// ② 파일은 맞는데 그 파일에 없던 시트 = 오귀속 → 시트만 '자동'으로 강등(파일 요구는 유지).
// 비교는 정규화+안정키(월/날짜 무시)로 — 표기 차이로 멀쩡한 요구를 떨어뜨리지 않는다.
// 안전장치: 필터가 파일 요구를 전멸시키면 적용하지 않는다(fail-open — 정본 캡처 누락 대비).
function runnerApplyEnvConfigFilter(map, cfg) {
  const out = { dropped: [], downgraded: [], fallbackAdded: [], uncovered: [] };
  if (!cfg || typeof cfg !== "object") return out;
  const cfgFiles = [...(Array.isArray(cfg.inputs) ? cfg.inputs : []),
                    ...(Array.isArray(cfg.outputs) ? cfg.outputs : [])]
    .filter(f => f && f.name);
  if (!cfgFiles.length) return out;
  const norm = (n) => runnerMappingNorm(n);
  const stable = (n) => (typeof pipelineStableWorkbookKey === "function"
    ? pipelineStableWorkbookKey(n) : norm(n));
  // name(실제 업로드명)과 displayName(사용자 편집 표시명) 둘 다 매칭 허용 — 표시명 편집된
  // 파일의 코드 리터럴 요구가 오폐기되지 않게(부분 drop 은 fail-open 이 못 막는다).
  const _cfgNames = (f) => [f.name, f.displayName].filter(Boolean);
  const findCfg = (book) => cfgFiles.find(f => _cfgNames(f).some(n => norm(n) === norm(book)))
    || cfgFiles.find(f => _cfgNames(f).some(n => stable(n) && stable(n) === stable(book)));
  const plans = [];
  for (const [key, req] of Array.from(map.entries())) {
    if (!req || !req.book) continue;                 // 파일 미지정(시트만) 요구는 config 검증 대상 아님
    const hit = findCfg(req.book);
    if (!hit) { plans.push({ act: "drop", key, req }); continue; }
    if (req.sheet && Array.isArray(hit.sheetNames) && hit.sheetNames.length
        && !hit.sheetNames.some(s => norm(s) === norm(req.sheet))
        // [월 변형 시트] 정본 시트와 안정키(월·날짜 무시)로 같으면 오귀속이 아니다 — 강등하면
        // 시트 요구가 사라져 치환이 끊기고 옛 시트명이 실행까지 살아남는다.
        && !hit.sheetNames.some(s => stable(s) && stable(s) === stable(req.sheet))) {
      plans.push({ act: "downgrade", key, req });
    }
  }
  const bookedCount = Array.from(map.values()).filter(r => r && r.book).length;
  const dropCount = plans.filter(p => p.act === "drop").length;
  if (dropCount >= bookedCount && bookedCount > 0) return out;  // fail-open
  for (const p of plans) {
    map.delete(p.key);
    if (p.act === "downgrade") {
      runnerAddRequirement(map, p.req.book, "", "config-sheet-downgrade");
      // [별칭 보존] 강등 재등록이 원 요구의 aliases(옛 달 이름들)를 버리면 실행 치환이 그 이름을 놓친다.
      try {
        const ne = map.get(runnerMappingKey(runnerCleanWorkbookRequirementName(p.req.book), ""));
        if (ne && Array.isArray(p.req.aliases) && p.req.aliases.length) {
          ne.aliases = Array.from(new Set([...(ne.aliases || []), ...p.req.aliases]));
        }
      } catch (_) {}
      out.downgraded.push(p.req.book + "/" + p.req.sheet);
    } else {
      out.dropped.push(p.req.book);
    }
  }
  // [추출 미탐 역보완] 교집합은 추출기가 제안조차 못 한 파일(동적 파일명/간접 참조)을 구제 못 한다.
  // ① 파일 요구 전멸이면 정본 파일 전체를 폴백 요구로(단일 시트면 그 시트, 아니면 자동) —
  //    스킬이 아무 파일도 안 찾는 것보다 정본을 보여주는 게 낫다.
  // ② 부분 미탐(정본에 있는데 어느 요구에도 안 잡힌 파일)은 트레이스로만(과요구 방지 — 미사용일 수 있음).
  if (bookedCount === 0) {
    for (const f of cfgFiles) {
      const nm = f.name || f.displayName;
      runnerAddRequirement(map, nm,
        (Array.isArray(f.sheetNames) && f.sheetNames.length === 1) ? f.sheetNames[0] : "",
        "config-fallback");
      out.fallbackAdded.push(nm);
    }
  } else {
    out.uncovered = cfgFiles
      .filter(f => !Array.from(map.values()).some(r => r && r.book && findCfg(r.book) === f))
      .map(f => f.name || f.displayName);
  }
  return out;
}

function runnerAddRequirement(map, book, sheet, source) {
  const cleanBook = runnerCleanWorkbookRequirementName(book);
  const cleanSheet = String(sheet || "").trim();
  if (!cleanBook && !cleanSheet) return;
  const key = runnerMappingKey(cleanBook, cleanSheet);
  if (!map.has(key)) map.set(key, { key, book: cleanBook, sheet: cleanSheet, source: source || "" });
}

function runnerLooksLikeA1Address(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (/^\$?[A-Z]{1,3}\$?\d+$/i.test(s)) return true;
  if (/^\$?[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?\d+$/i.test(s)) return true;
  if (/^\$?[A-Z]{1,3}:\$?[A-Z]{1,3}$/i.test(s)) return true;
  if (/^\$?[A-Z]{1,3}\$?\d*:\$?[A-Z]{1,3}\$?\d*$/i.test(s)) return true;
  if (/^R\d+C\d+(?::R\d+C\d+)?$/i.test(s)) return true;
  return false;
}

function runnerAddGeneratedSheet(list, book, sheet) {
  const cleanSheet = String(sheet || "").trim();
  if (!cleanSheet || runnerLooksLikeA1Address(cleanSheet) || cleanSheet.toLowerCase().endsWith(".xlsx")) return;
  list.push({ book: String(book || "").trim(), sheet: cleanSheet });
}

function runnerIsGeneratedSheet(generated, book, sheet) {
  const cleanSheet = String(sheet || "").trim();
  if (!cleanSheet) return false;
  const cleanBook = String(book || "").trim();
  return (generated || []).some(item => {
    if (runnerMappingNorm(item.sheet) !== runnerMappingNorm(cleanSheet)) return false;
    return !item.book || !cleanBook || runnerMappingNorm(item.book) === runnerMappingNorm(cleanBook);
  });
}

// `VAR = ctx.book(<리터럴 또는 변수>)` 를 { VAR: "실제 파일명" } 으로 푼다.
// 세 추출기(생성시트/요구시트/시트소유자)가 같은 규칙을 쓰도록 한 곳에 모았다 —
// 예전엔 같은 로직이 3벌 복제돼 있었고 ctx.book( 뒤에 '따옴표 리터럴'만 허용했다. 그래서
//     src_file = "A.xlsx"; src_ctx = ctx.book(src_file); src_ctx.read("콜센터", ...)
// 처럼 파일명을 변수로 넘기면 수신자의 소속 파일을 몰라, 그 시트 요구가 엉뚱한 파일에
// 붙었다(SBAGENT-171: 'sheet' 시트가 로우데이터 파일이 아니라 콜센터 파일에 요구됨).
function runnerPyBookVarMap(src) {
  const text = String(src || "");
  const literals = new Map();
  const assignLine = /^\s*([A-Za-z_]\w*)\s*=\s*(["'])([^"'\r\n]+)\2\s*(?:#.*)?$/;
  for (const line of text.split(/\r?\n/)) {
    const av = assignLine.exec(line);
    if (av) literals.set(av[1], av[3]);
  }
  const resolve = expr => {
    const s = String(expr || "").trim();
    const lit = /^(["'])([^"']+)\1$/.exec(s);
    if (lit) return lit[2];
    return /^[A-Za-z_]\w*$/.test(s) ? (literals.get(s) || "") : "";
  };
  const books = new Map();
  // [괄호 파일명] 따옴표 문자열을 '우선' 통째로 매칭 — bare 패턴([^()\r\n])만 쓰면
  // "…복사본 (2).xlsx" 처럼 파일명에 괄호가 있을 때 매칭 자체가 실패해 수신자 변수 해석이
  // 통째로 죽었다(UCAP dst_book 과 동일 계열, 한전 인천본부 실측).
  const re = /\b([A-Za-z_]\w*)\s*=\s*ctx\.book\(\s*((?:"[^"\r\n]*"|'[^'\r\n]*')|[^()\r\n]+?)\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    const name = resolve(m[2]);
    if (name) books.set(m[1], name);
  }
  return books;
}

// 여는 괄호 위치(openIdx)에서 짝이 맞는 닫는 괄호까지 = '그 호출의 인자 목록'만 반환.
// 고정 길이(400자) 창은 호출 경계를 안 지켜 인접 호출의 dest_name/new_name 을 훔친다.
// 문자열 리터럴 안의 괄호는 세지 않는다(조건 람다에 괄호·콤마가 흔하다).
// 호출 인자 텍스트("(a, lambda r: f(r, \"x\"), \"y\")")를 '최상위 콤마' 기준으로 분해한다.
// 람다/중첩 호출/리스트의 내부 콤마·괄호에 속지 않기 위한 균형 스캐너(문자열 인지).
function runnerSplitTopLevelArgs(callText) {
  const text = String(callText || "");
  if (text[0] !== "(") return [];
  const args = [];
  let depth = 0, quote = "", cur = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { cur += c; if (c === quote && text[i - 1] !== "\\") quote = ""; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "(" || c === "[" || c === "{") { depth++; if (depth === 1 && i === 0) continue; cur += c; continue; }
    if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0 && c === ")") { if (cur.trim()) args.push(cur.trim()); return args; }
      cur += c; continue;
    }
    if (c === "," && depth === 1) { args.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  return args;
}

function runnerSliceCallArgs(src, openIdx) {
  const text = String(src || "");
  if (text[openIdx] !== "(") return "";
  let depth = 0;
  let quote = "";
  for (let i = openIdx; i < text.length && i - openIdx < 4000; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== "\\") quote = "";
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return text.slice(openIdx, i + 1);
    }
  }
  return "";
}

// [스킬 기본값] '이 시트는 치환하지 말고 스킬 코드에 적힌 값 그대로 실행하라'는 사용자의 명시적 선택.
// 매핑은 스킬 코드의 시트 리터럴을 실제 시트명으로 바꿔치기하는데(runnerReplaceLiteral), 그 판단이
// 틀리면 원래 잘 돌던 스킬이 깨진다(SBAGENT-198 계열). 그럴 때 사용자가 치환을 꺼서 스킬에
// 일임할 수 있는 탈출구다. 저장은 되지만 치환에는 쓰이지 않는 센티넬 값.
const RUNNER_SHEET_SKILL_DEFAULT = "__b2b_skill_default__";
function runnerIsSkillDefaultSheet(v) {
  return String(v || "") === RUNNER_SHEET_SKILL_DEFAULT;
}

function runnerExtractGeneratedSheetsFromCode(code) {
  const src = String(code || "");
  const generated = [];
  let m;

  const pyDirectAdd = /ctx\.book\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:add_sheet|create_sheet|ensure_sheet)\(\s*["']([^"']+)["']/gi;
  while ((m = pyDirectAdd.exec(src))) runnerAddGeneratedSheet(generated, m[1], m[2]);
  const pyDirectRename = /ctx\.book\(\s*["']([^"']+)["']\s*\)\s*\.\s*rename_sheet\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/gi;
  while ((m = pyDirectRename.exec(src))) runnerAddGeneratedSheet(generated, m[1], m[2]);
  const pyActiveAdd = /ctx\.(?:add_sheet|create_sheet|ensure_sheet)\(\s*["']([^"']+)["']/gi;
  while ((m = pyActiveAdd.exec(src))) runnerAddGeneratedSheet(generated, "", m[1]);
  const pyActiveRename = /ctx\.rename_sheet\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/gi;
  while ((m = pyActiveRename.exec(src))) runnerAddGeneratedSheet(generated, "", m[1]);

  // [SBAGENT-198 반쪽 수정 보완] `name = "시트"` / `target_file = "03.xlsx"` 처럼 단독 대입한
  // 문자열 변수 맵. 아래 '모든' 패턴이 리터럴/변수를 함께 받도록 맨 앞에서 한 번만 만든다.
  // 예전엔 시트명 변수만 풀고 '파일명 변수'는 안 봐서 ctx.book(변수).<헬퍼> 가 통째로 미탐이었다.
  const pyLiteralVars = new Map();
  const pyAssignLine = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(["'])([^"'\r\n]+)\2\s*(?:#.*)?$/;
  for (const line of src.split(/\r?\n/)) {
    const av = pyAssignLine.exec(line);
    if (av) pyLiteralVars.set(av[1], av[3]);
  }
  const resolvePyName = expr => {
    const s = String(expr || "").trim();
    const lit = /^(["'])([^"']+)\1$/.exec(s);
    if (lit) return lit[2];
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? (pyLiteralVars.get(s) || "") : "";
  };

  // ctx.book 인자가 변수여도 잡는다(b = ctx.book(target_file)) — 리터럴만 보던 탓에
  // '수신자 변수의 출처'를 몰라 b.add_sheet("리터럴") 이 미탐이었다.
  // 세 추출기가 같은 규칙을 쓰도록 공용 헬퍼 사용(예전엔 3벌 복제라 한 곳만 고치면 반쪽이 됐다).
  const pyVars = runnerPyBookVarMap(src);
  pyVars.forEach((book, varName) => {
    const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let mm;
    const addRe = new RegExp(`\\b${esc}\\s*\\.\\s*(?:add_sheet|create_sheet|ensure_sheet)\\(\\s*["']([^"']+)["']`, "g");
    while ((mm = addRe.exec(src))) runnerAddGeneratedSheet(generated, book, mm[1]);
    const renameRe = new RegExp(`\\b${esc}\\s*\\.\\s*rename_sheet\\(\\s*["'][^"']+["']\\s*,\\s*["']([^"']+)["']`, "g");
    while ((mm = renameRe.exec(src))) runnerAddGeneratedSheet(generated, book, mm[1]);
  });

  // [SBAGENT-198] Python '변수 인자' 해석 — `new_name = "sheet1"` 처럼 단독 대입한 리터럴 변수를
  // rename_sheet/add_sheet 류에 넘기는 패턴도 생성시트로 인식한다(VBA vbaLiteralVars 와 동일 원리).
  // 위 정규식들은 인라인 리터럴만 잡아, `book.rename_sheet(old_name, new_name)` 변수 호출이 사각지대였다
  // → "sheet1" 이 생성시트로 등록되지 않아 매핑 요구로 남고, 실행기 매핑이 rename '목적지' 리터럴까지
  //   실제 시트명(31자 초과)으로 치환해 rename 이 0x800A03EC 로 터졌다(첫 시트→sheet1 스킬 회귀).
  // 수신자: ctx.book("리터럴") | ctx.book(변수) | 변수 | ctx.
  // 예전엔 ctx.book( 뒤에 '따옴표 리터럴'만 허용해, ctx.book(target_file).rename_sheet(...) 는
  // 정규식 자체가 매칭되지 않아 생성시트가 등록되지 않았다(한전 Step22). 그러면 매핑이 그 시트를
  // '업로드된 파일에 있어야 할 시트'로 요구하고, 단일시트 파일이면 Sheet1 과 짝지어져
  // rename_sheet("Sheet1","Sheet1") 로 목적지 리터럴까지 치환 — 오류도 없이 조용히 이름이 안 바뀐다.
  const RECV = '((?:ctx\\s*\\.\\s*book\\(\\s*[^()\\r\\n]+?\\s*\\))|[A-Za-z_][A-Za-z0-9_]*)';
  const receiverBook = recv => {
    const r = String(recv || "").trim();
    const viaBook = /^ctx\s*\.\s*book\(\s*(.+?)\s*\)$/.exec(r);
    if (viaBook) return resolvePyName(viaBook[1]);   // 리터럴·변수 모두 해석
    if (r === "ctx") return "";
    return pyVars.get(r) || "";
  };
  // [괄호 시트명 수정] 첫 인자(옛 이름)에 따옴표 문자열을 우선 매칭 — 시트명에 괄호/콤마가 있으면
  // (실존: "(2) LGU+") bare 토큰 패턴이 중간에서 끊겨 새 이름 캡처가 어긋나 생성시트 등록이 실패했다.
  const anyRename = new RegExp(
    RECV + '\\s*\\.\\s*rename_sheet\\(\\s*(?:"[^"]*"|\\\'[^\\\']*\\\'|[^,()\\r\\n]+?)\\s*,\\s*(?:new_name\\s*=\\s*)?((["\'])[^"\']*\\3|[A-Za-z_][A-Za-z0-9_]*)\\s*[),]', 'g');
  while ((m = anyRename.exec(src))) {
    const name = resolvePyName(m[2]);
    if (name) runnerAddGeneratedSheet(generated, receiverBook(m[1]), name);
  }
  const anyAddVar = new RegExp(
    RECV + '\\s*\\.\\s*(?:add_sheet|create_sheet|ensure_sheet)\\(\\s*(?:(?:sheet|name)\\s*=\\s*)?([A-Za-z_][A-Za-z0-9_]*)\\s*[,)]', 'g');
  while ((m = anyAddVar.exec(src))) {
    const name = resolvePyName(m[2]);
    if (name) runnerAddGeneratedSheet(generated, receiverBook(m[1]), name);
  }
  // ctx.book(변수).add_sheet("리터럴") — 리터럴 인자는 위 anyAddVar(변수 전용)가 안 잡는다.
  const anyAddLit = new RegExp(
    RECV + '\\s*\\.\\s*(?:add_sheet|create_sheet|ensure_sheet)\\(\\s*(?:(?:sheet|name)\\s*=\\s*)?(["\'])([^"\']+)\\2', 'g');
  while ((m = anyAddLit.exec(src))) {
    runnerAddGeneratedSheet(generated, receiverBook(m[1]), m[3]);
  }

  // [한전 스킬셋] 시트를 '만들어내는' 그 밖의 헬퍼 — filter_to_sheet(원본, 조건, "새시트"),
  // pivot/native_pivot(dest_name=, 기본 "피벗요약"). 목적지 시트는 업로드 요구가 아니라 산출물인데
  // 여기 없어서 filter_to_sheet 산출(무선간선망/고압모계기/고압자계기)이 '필요 시트'로 잘못 떴다.
  const creatorRe = new RegExp(RECV + '\\s*\\.\\s*(filter_to_sheet|pivot|native_pivot)\\s*\\(', 'g');
  while ((m = creatorRe.exec(src))) {
    const bookName = receiverBook(m[1]);
    const fn = m[2];
    // [P2] 창을 '이 호출의 인자 목록'으로 한정한다. 예전엔 무조건 400자를 잘라, 인접 호출의
    // dest_name/new_name 을 훔쳐 엉뚱한 시트를 산출물로 등록하거나(오탐) 반대로 놓쳤다.
    const win = runnerSliceCallArgs(src, creatorRe.lastIndex - 1) || src.slice(m.index, m.index + 400);
    const kw = /(?:dest_name|new_name)\s*=\s*(["'])([^"']+)\1/.exec(win);
    if (kw) {
      runnerAddGeneratedSheet(generated, bookName, kw[2]);
      continue;
    }
    const kwVar = /(?:dest_name|new_name)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,)]/.exec(win);
    if (kwVar) {
      const name = resolvePyName(kwVar[1]);
      if (name) runnerAddGeneratedSheet(generated, bookName, name);
      continue;
    }
    if (fn === "filter_to_sheet") {
      // [한전 인천본부 실측] 3번째 위치 인자를 정규식이 아니라 '최상위 인자 분해'로 뽑는다.
      // 예전 '닫는 괄호 앞 리터럴' 휴리스틱은 조건이 람다면 — filter_to_sheet(sheet,
      // lambda r: f(r, "512102405339"), "무선간선망") — 람다 내부 리터럴("512...")을 산출물로
      // 오등록하고 실제 목적지("무선간선망")를 놓쳐, 생성 시트 3개가 전부 '필수 업로드'로 떴다.
      const args = runnerSplitTopLevelArgs(win);
      const dest = args.length >= 3 ? args[2] : "";
      const lit = /^(["'])([^"']*)\1$/.exec(dest);
      if (lit && lit[2]) {
        runnerAddGeneratedSheet(generated, bookName, lit[2]);
      } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(dest)) {
        const name = resolvePyName(dest);
        if (name) runnerAddGeneratedSheet(generated, bookName, name);
      }
    } else {
      // pivot/native_pivot 에 dest_name 이 없으면 기본 산출 시트 "피벗요약"
      runnerAddGeneratedSheet(generated, bookName, "피벗요약");
    }
  }

  // [교차파일 복사] ctx.copy_sheet("소스시트", dst_book="대상파일"[, new_name="Y"]) 는 대상파일에 그 시트를
  // '새로 만든다'(예: 원본→KG모빌리티). 대상파일 입장에선 업로드해야 할 기존 시트가 아니라 생성 시트다.
  // (ctx.copy_sheet / ctx.book("소스").copy_sheet 둘 다 커버. 파일명에 괄호가 있어도 안전하게 근처 창에서 추출.)
  const copyCallRe = /\bcopy_sheet\s*\(/gi;
  let cc;
  while ((cc = copyCallRe.exec(src))) {
    const near = src.slice(cc.index, cc.index + 400);
    const srcM = /copy_sheet\s*\(\s*["']([^"']+)["']/.exec(near);
    const dstM = /dst_book\s*=\s*["']([^"']+)["']/.exec(near);
    if (srcM && dstM) {
      const nameM = /new_name\s*=\s*["']([^"']+)["']/.exec(near);
      runnerAddGeneratedSheet(generated, dstM[1], nameM ? nameM[1] : srcM[1]);
    }
  }

  // VBA 는 '=' 가 대입/비교 겸용이라 `.Name = "X"` 가 시트 생성/이름지정일 수도,
  // `If sh.Name = "X" Then ...`(기존 시트 찾기) 같은 '비교문'일 수도 있다. 비교문을 생성으로
  // 오판하면 그 시트가 '필수 업로드'에서 잘못 제외돼 매핑 UI 에 '시트 자동'(빈 시트)으로 뜬다.
  // If/ElseIf/While/Until/Then/Case 문맥의 .Name= 은 생성으로 보지 않는다(라인 단위로 판정).
  const vbaIsComparisonLine = line =>
    /(?:^|[\s:])(?:if|elseif|#if|while|until)\b/i.test(line) ||
    /\bthen\b/i.test(line) ||
    /(?:^|[\s:])case\b/i.test(line);
  const vbaLiteralVars = new Map();
  // `baseName = "C_611769344898"` — 단독 대입문. VBA 는 `:` 로 문장을 이어 쓸 수 있어
  // (`newName = baseName: idx = 1`) 꼬리를 허용한다.
  const vbaAssignLine = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']([^"']+)["']\s*(?::.*)?$/;
  // `newName = baseName` — 변수→변수 대입. 예전엔 이 한 단계를 못 넘어 사슬이 끊겼다:
  //   baseName = "C_611769344898"   ← 잡힘
  //   newName  = baseName: idx = 1  ← 못 잡음(변수 대입 + `:` 꼬리)
  //   wsNew.Name = newName          ← newName 을 몰라 생성시트로 등록 실패
  // 그러면 스킬이 '만드는' 시트를 매핑이 '업로드에 있어야 할 시트'로 요구한다(SBAGENT-138).
  const vbaAliasLine = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?::.*)?$/;
  const vbaAliases = [];
  const vbaLines = src.split(/\r?\n/);
  // 1) 변수부터 전부 수집 — 대입이 사용보다 뒤에 나와도 해석되게 두 패스로 나눈다.
  for (const line of vbaLines) {
    if (vbaIsComparisonLine(line)) continue;   // `If sh.Name = newName Then` 은 대입이 아니다
    const av = vbaAssignLine.exec(line);
    if (av) { vbaLiteralVars.set(String(av[1] || "").toLowerCase(), av[2]); continue; }
    const al = vbaAliasLine.exec(line);
    if (al) vbaAliases.push([String(al[1] || "").toLowerCase(), String(al[2] || "").toLowerCase()]);
  }
  // 2) 별칭 사슬 해소(newName ← baseName ← "C_...") — 더 이상 안 늘 때까지.
  for (let i = 0; i < 4; i++) {
    let changed = false;
    for (const [dst, srcVar] of vbaAliases) {
      if (!vbaLiteralVars.has(dst) && vbaLiteralVars.has(srcVar)) {
        vbaLiteralVars.set(dst, vbaLiteralVars.get(srcVar));
        changed = true;
      }
    }
    if (!changed) break;
  }
  // 3) 시트 생성/이름지정 검출
  for (const line of vbaLines) {
    if (vbaIsComparisonLine(line)) continue;  // 비교문은 생성 아님 → 스킵
    let mm;
    const litRe = /\.Name\s*=\s*["']([^"']+)["']/gi;
    while ((mm = litRe.exec(line))) runnerAddGeneratedSheet(generated, "", mm[1]);
    // `.Name = 변수` — 단, 뒤에 `&`(문자열 연결)가 붙으면 변수 하나만 떼서 등록하면 안 된다.
    // `wsNew.Name = base & "_" & idx` 에서 base 만 잡으면 실제로 만들어지지도 않는 접두사가
    // 생성시트로 등록된다(오탐은 미탐보다 나쁘다 — 멀쩡한 시트 요구를 지워버린다).
    const varRe = /\.Name\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*(&|$|')/gi;
    while ((mm = varRe.exec(line))) {
      if (mm[2] === "&") continue;            // 동적 조합 → 이름을 확정할 수 없으므로 등록 안 함
      const val = vbaLiteralVars.get(String(mm[1] || "").toLowerCase());
      if (val) runnerAddGeneratedSheet(generated, "", val);
    }
  }

  return generated;
}

// [녹화 관용구 (파일,시트) 쌍] MS 매크로 레코더 출력은 Workbooks("X").Worksheets("Y") 대신
// `Windows("X.xlsx").Activate` 다음 줄에 비한정 `Sheets("Y").Select` 로 나온다 — 기존 vbaDirect
// 패턴엔 안 보여서 교차파일 녹화 스킬의 두 번째 파일부터 시트 요구·리터럴 재작성이 통째로
// 빠졌다(다른 달 시트명이면 subscript 오류). 줄 단위로 현재 활성 창을 추적해 쌍을 뽑는다.
function runnerRecordedActivatePairs(code) {
  const pairs = [];
  let win = "";
  for (const line of String(code || "").split(/\r?\n/)) {
    const w = line.match(/^\s*(?:Windows|Workbooks)\(\s*["']([^"'\r\n]+\.xls[xmb]?)["']\s*\)\s*\.\s*Activate\b/i);
    if (w) { win = w[1]; continue; }
    const s = line.match(/^\s*(?:Sheets|Worksheets)\(\s*["']([^"'\r\n]+)["']\s*\)\s*\.\s*Select\b/i);
    if (s && win) pairs.push({ book: win, sheet: s[1] });
  }
  return pairs;
}

function runnerAddPairedCodeRequirements(map, code, shouldSkip) {
  const src = String(code || "");
  let m;
  const pyDirect = /ctx\.book\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:read|write|write_cell|copy|sort|delete_rows|delete_cols|last_row|last_col|find_header)\(\s*["']([^"']+)["']/gi;
  while ((m = pyDirect.exec(src))) {
    if (!runnerLooksLikeA1Address(m[2]) && !(shouldSkip && shouldSkip(m[1], m[2]))) {
      runnerAddRequirement(map, m[1], m[2], "python-pair");
    }
  }

  // 파일명을 변수로 넘긴 ctx.book(src_file) 도 푼다(runnerPyBookVarMap) — 리터럴만 보던 탓에
  // 시트 요구가 엉뚱한 파일에 붙었다(SBAGENT-171).
  const pyVars = runnerPyBookVarMap(src);
  pyVars.forEach((book, varName) => {
    const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${esc}\\s*\\.\\s*(?:read|write|write_cell|copy|sort|delete_rows|delete_cols|last_row|last_col|find_header)\\(\\s*["']([^"']+)["']`, "g");
    let mm;
    while ((mm = re.exec(src))) {
      if (!runnerLooksLikeA1Address(mm[1]) && !(shouldSkip && shouldSkip(book, mm[1]))) {
        runnerAddRequirement(map, book, mm[1], "python-var-pair");
      }
    }
  });

  const vbaDirect = /Workbooks\(\s*["']([^"']+)["']\s*\)(?:\.[A-Za-z_][A-Za-z0-9_]*){0,4}\.Worksheets\(\s*["']([^"']+)["']\s*\)/gi;
  while ((m = vbaDirect.exec(src))) {
    if (!runnerLooksLikeA1Address(m[2]) && !(shouldSkip && shouldSkip(m[1], m[2]))) {
      runnerAddRequirement(map, m[1], m[2], "vba-pair");
    }
  }

  // [녹화 관용구] Windows("X").Activate + Sheets("Y").Select → (X,Y) 요구(위 vbaDirect 가 못 보는 형태).
  runnerRecordedActivatePairs(src).forEach((p) => {
    if (!runnerLooksLikeA1Address(p.sheet) && !(shouldSkip && shouldSkip(p.book, p.sheet))) {
      runnerAddRequirement(map, p.book, p.sheet, "vba-recorded-pair");
    }
  });

  // [복붙 캡처] ctx.paste_copied('소스시트','범위','대상시트','셀', src_book='A', dst_book='B') —
  // 소스/대상 시트도 그 파일의 '필요 시트'다. 이걸 안 뽑으면 복붙 스킬 파일이 '시트 자동'으로만 떠서
  // 스킬이 실제로 어떤 시트를 쓰는지(좌측)도, 다른 달 파일에서 어떤 시트로 바꿀지(우측)도 안 보였다.
  const pasteRe = /\bpaste_copied\s*\(/g;
  let pc;
  while ((pc = pasteRe.exec(src))) {
    const near = src.slice(pc.index, pc.index + 500);
    const argM = /paste_copied\s*\(\s*(["'])([^"']+)\1\s*,\s*(["'])[^"']*\3\s*,\s*(["'])([^"']+)\4/.exec(near);
    if (!argM) continue;
    const srcSheet = argM[2];
    const dstSheet = argM[5];
    const srcBookM = /src_book\s*=\s*["']([^"']+)["']/.exec(near);
    const dstBookM = /dst_book\s*=\s*["']([^"']+)["']/.exec(near);
    if (srcBookM && srcSheet && !runnerLooksLikeA1Address(srcSheet) && !(shouldSkip && shouldSkip(srcBookM[1], srcSheet))) {
      runnerAddRequirement(map, srcBookM[1], srcSheet, "paste-src");
    }
    if (dstBookM && dstSheet && !runnerLooksLikeA1Address(dstSheet) && !(shouldSkip && shouldSkip(dstBookM[1], dstSheet))) {
      runnerAddRequirement(map, dstBookM[1], dstSheet, "paste-dst");
    }
  }
}

// 코드에서 '어떤 시트가 어떤 워크북 소유인지' (book,sheet) 쌍을 뽑는다(교차파일 오귀속 방지 + 자기 시트 회수).
// 예: VBA `Set wbDst=Workbooks("원본_DSMC")` + `wbDst.Worksheets("202605")` → (원본_DSMC, 202605).
//     `Set wbSrc=Workbooks("CCU")` + `wbSrc.Worksheets("교체된 CCU 목록")` → (CCU, 교체된 CCU 목록).
// 저장된 스텝의 targetFileId=CCU 인데 targetSheetName=202605(원본_DSMC 소유)면 202605 를 CCU 요구로 짝짓지 않고,
// 대신 CCU 가 코드상 실제 쓰는 시트(교체된 CCU 목록)를 요구로 넣는다. 반환: [{book, sheet}] (원본 표기, 중복 제거).
function runnerSheetOwnersFromCode(code) {
  const src = String(code || "");
  const pairs = [];
  const seen = new Set();
  const add = (book, sheet) => {
    if (!book || !sheet || runnerLooksLikeA1Address(sheet)) return;
    const key = runnerMappingNorm(book) + " " + runnerMappingNorm(sheet);
    if (!runnerMappingNorm(book) || !runnerMappingNorm(sheet) || seen.has(key)) return;
    seen.add(key);
    pairs.push({ book, sheet });
  };
  let m;
  const vbaDirect = /Workbooks\(\s*["']([^"']+)["']\s*\)\s*\.\s*Worksheets\(\s*["']([^"']+)["']\s*\)/gi;
  while ((m = vbaDirect.exec(src))) add(m[1], m[2]);
  // [녹화 관용구] Windows("X").Activate + Sheets("Y").Select — 소유 쌍으로 등록(교차파일 오귀속 방지).
  runnerRecordedActivatePairs(src).forEach((p) => add(p.book, p.sheet));
  const vbaVars = new Map();
  const setWb = /Set\s+([A-Za-z_]\w*)\s*=\s*(?:Application\.)?Workbooks\(\s*["']([^"']+)["']\s*\)/gi;
  while ((m = setWb.exec(src))) vbaVars.set(m[1].toLowerCase(), m[2]);
  const loopWb = /If\s+[A-Za-z_]\w*\.Name\s*=\s*["']([^"']+)["'][\s\S]{0,80}?Set\s+([A-Za-z_]\w*)\s*=\s*[A-Za-z_]\w*/gi;
  while ((m = loopWb.exec(src))) vbaVars.set(m[2].toLowerCase(), m[1]);
  vbaVars.forEach((book, varLc) => {
    const esc = varLc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${esc}\\s*\\.\\s*Worksheets\\(\\s*["']([^"']+)["']`, "gi");
    let mm;
    while ((mm = re.exec(src))) add(book, mm[1]);
  });
  const PY_OWNER_VERBS = "read|write|write_cell|copy|sort|clear|find_header|last_row|last_col|delete_rows|delete_cols|used_last_row|used_last_col|rename_sheet";
  const pyDirect = new RegExp(`ctx\\.book\\(\\s*["']([^"']+)["']\\s*\\)\\s*\\.\\s*(?:${PY_OWNER_VERBS})\\(\\s*["']([^"']+)["']`, "gi");
  while ((m = pyDirect.exec(src))) add(m[1], m[2]);
  // 파일명 변수(ctx.book(tgt_file))도 푼다 — 세 추출기가 같은 규칙을 쓰게 통일.
  const pyVars = runnerPyBookVarMap(src);
  pyVars.forEach((book, varName) => {
    const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${esc}\\s*\\.\\s*(?:${PY_OWNER_VERBS})\\(\\s*["']([^"']+)["']`, "g");
    let mm;
    while ((mm = re.exec(src))) add(book, mm[1]);
  });
  // [한전 인천본부 실측] 시트 인자가 '변수'인 경우 — sheet = "Sheet1"; book.delete_rows(sheet, ...) —
  // 리터럴만 보던 탓에 소유자 판정이 빠져, 다른 파일을 다루는 스텝의 잘못 저장된 targetFileId 에
  // 남의 시트(Sheet1)가 '필수 업로드'로 붙었다. 단독 리터럴 대입이 '유일'할 때만 해석(모호하면 안 씀).
  const litVars = new Map();
  {
    const lvRe = /^[ \t]*([A-Za-z_]\w*)\s*=\s*(["'])([^"'\r\n]+)\2\s*(?:#.*)?$/gm;
    let lv;
    while ((lv = lvRe.exec(src))) {
      if (!litVars.has(lv[1])) litVars.set(lv[1], lv[3]);
      else if (litVars.get(lv[1]) !== lv[3]) litVars.set(lv[1], null); // 재대입 상이 → 모호
    }
  }
  const pyDirectVar = new RegExp(`ctx\\.book\\(\\s*["']([^"']+)["']\\s*\\)\\s*\\.\\s*(?:${PY_OWNER_VERBS})\\(\\s*([A-Za-z_]\\w*)\\s*[,)]`, "g");
  while ((m = pyDirectVar.exec(src))) {
    const v = litVars.get(m[2]);
    if (v) add(m[1], v);
  }
  pyVars.forEach((book, varName) => {
    const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${esc}\\s*\\.\\s*(?:${PY_OWNER_VERBS})\\(\\s*([A-Za-z_]\\w*)\\s*[,)]`, "g");
    let mm;
    while ((mm = re.exec(src))) {
      const v = litVars.get(mm[1]);
      if (v) add(book, v);
    }
  });
  return pairs;
}

function runnerExtractMappingRequirements() {
  const map = new Map();
  const steps = state.pipeline || [];
  const generatedSheets = [];
  for (const step of steps) {
    if (!step || !step.code) continue;
    // [녹화 스텝 제목 오염 차단] 녹화 스텝의 prompt/description 은 LLM 서술문이라 파일명이
    // 문장 속에 섞인다("...복사 + X.xlsx J1에 붙여넣기..."). loose 파일명 수집기가 주변 단어까지
    // 파일명으로 오인해 실행기 요구 카드가 쓰레기 이름으로 도배됐다(실측 16:09). 녹화 스텝의
    // 권위 소스는 코드 리터럴+recordedWorkbook 이므로 자유 텍스트는 스캔에서 뺀다.
    const _recordedFreeTextExcluded = !!(step.recorded || step.recordedWorkbook
      || /\[녹화됨\/VBA\]/.test(String(step.prompt || "")));
    const text = _recordedFreeTextExcluded
      ? String(step.code || "")
      : [step.prompt, step.description, step.code].filter(Boolean).join("\n");
    const generatedHere = runnerExtractGeneratedSheetsFromCode(step.code);
    const shouldSkipRequirement = (book, sheet) =>
      runnerIsGeneratedSheet(generatedSheets, book, sheet) || runnerIsGeneratedSheet(generatedHere, book, sheet);
    let m;
    const refRe = /@(?:범위|시트|컬럼)\s*\[([^\]\r\n/]+)\/([^\]!\r\n]+)(?:![^\]\r\n]+)?\]/g;
    while ((m = refRe.exec(text))) {
      if (!shouldSkipRequirement(m[1], m[2])) runnerAddRequirement(map, m[1], m[2], "ref");
    }
    runnerAddPairedCodeRequirements(map, step.code, shouldSkipRequirement);

    const names = [];
    try {
      if (typeof pipelineCollectWorkbookNames === "function") {
        pipelineCollectWorkbookNames(text).forEach(n => { if (n && !names.includes(n)) names.push(n); });
      }
      if (typeof pipelinePythonSourceWorkbookNames === "function") {
        pipelinePythonSourceWorkbookNames(step.code).forEach(n => { if (n && !names.includes(n)) names.push(n); });
      }
      if (typeof pipelinePythonTargetWorkbookNames === "function") {
        pipelinePythonTargetWorkbookNames(step).forEach(n => { if (n && !names.includes(n)) names.push(n); });
      }
      if (typeof pipelineVbaTargetWorkbookNames === "function") {
        pipelineVbaTargetWorkbookNames(step.code).forEach(n => { if (n && !names.includes(n)) names.push(n); });
      }
    } catch (_) {}

    const sheets = [];
    try {
      if (typeof pipelineTargetSheetNames === "function") {
        pipelineTargetSheetNames(step).forEach(s => { if (s && !sheets.includes(s)) sheets.push(s); });
      }
      if (typeof pipelineSheetLiteralsFromCode === "function") {
        pipelineSheetLiteralsFromCode(step.code).forEach(s => { if (s && !sheets.includes(s)) sheets.push(s); });
      }
    } catch (_) {}
    if (step.targetSheetName && !runnerLooksLikeA1Address(step.targetSheetName) && !sheets.includes(step.targetSheetName)) {
      sheets.push(step.targetSheetName);
    }
    const candidateSheets = sheets.filter(sheet =>
      sheet &&
      !runnerLooksLikeA1Address(sheet) &&
      !String(sheet).toLowerCase().endsWith(".xlsx")
    );

    if (step.targetFileId && String(step.targetFileId).startsWith("input:")) {
      const savedBook = String(step.targetFileId).slice(6);
      // [교차파일 오귀속 방지] targetSheetName 이 코드상 '다른 워크북 소유' 시트면(예: targetFile=CCU 인데
      // 202605 는 원본_DSMC 의 쓰기 대상 시트), CCU 요구에 202605 를 짝지으면 안 된다. 대신 CCU 가 코드상
      // 실제 쓰는 자기 시트(교체된 CCU 목록)를 요구로 넣어, 원본_DSMC 처럼 시트 칩↔드롭다운이 뜨게 한다.
      const ownerPairs = runnerSheetOwnersFromCode(step.code);
      const nSaved = runnerMappingNorm(savedBook);
      const nTarget = runnerMappingNorm(step.targetSheetName || "");
      const targetOwnerBooks = step.targetSheetName
        ? ownerPairs.filter(p => runnerMappingNorm(p.sheet) === nTarget).map(p => runnerMappingNorm(p.book))
        : [];
      const sheetBelongsElsewhere = targetOwnerBooks.length > 0 && !targetOwnerBooks.includes(nSaved);
      if (step.targetSheetName && !runnerLooksLikeA1Address(step.targetSheetName) && !sheetBelongsElsewhere) {
        if (!shouldSkipRequirement(savedBook, step.targetSheetName)) {
          runnerAddRequirement(map, savedBook, step.targetSheetName, "target");
        }
      } else if (sheetBelongsElsewhere) {
        // 이 파일이 코드상 실제로 다루는 자기 시트를 요구로(교차파일 소스 파일의 진짜 시트). 없으면 파일만.
        const ownSheets = Array.from(new Set(
          ownerPairs.filter(p => runnerMappingNorm(p.book) === nSaved).map(p => p.sheet)
        )).filter(s => !shouldSkipRequirement(savedBook, s));
        if (ownSheets.length) ownSheets.forEach(s => runnerAddRequirement(map, savedBook, s, "target-own"));
        else runnerAddRequirement(map, savedBook, "", "target");
      } else if (candidateSheets.length === 1 && !shouldSkipRequirement(savedBook, candidateSheets[0])) {
        runnerAddRequirement(map, savedBook, candidateSheets[0], "target");
      }
      else runnerAddRequirement(map, savedBook, "", "target");
    }

    // [녹화 메타 durable] 녹화 스텝에 파일/시트 표시명이 박혀 있으면(다른 달·다른 파일에서도) 파일확인 요구로.
    // 위 "input:" 게이트와 독립 — 이름 문자열이라 zip 재로드 후에도 도출 가능. 중복/무효는 아래 오탐정리가 걸러줌.
    if (step.recordedWorkbook || step.recordedSheet) {
      runnerAddRequirement(map, step.recordedWorkbook, step.recordedSheet, "recorded");
    }

    names.forEach(name => {
      const cleanName = runnerCleanWorkbookRequirementName(name);
      const hasNamedRequirement = Array.from(map.values()).some(req =>
        runnerMappingNorm(req.book) === runnerMappingNorm(cleanName)
      );
      if (!hasNamedRequirement) runnerAddRequirement(map, cleanName, "", "code-book");
    });
    if (!names.length) {
      candidateSheets
        .filter(sheet => !shouldSkipRequirement("", sheet))
        .forEach(sheet => runnerAddRequirement(map, "", sheet, "sheet"));
    }
    generatedSheets.push(...generatedHere);
  }
  // ── 오탐/중복 정리 ──
  const hasSpreadsheetExt = name => /\.(?:xls[xmb]?|csv|tsv)$/i.test(String(name || "").trim());
  const coveredSheets = new Set(   // '구체 파일 + 시트'로 이미 요구되는 시트명
    Array.from(map.values()).filter(req => req.book && req.sheet).map(req => runnerMappingNorm(req.sheet))
  );
  const booksWithSheet = new Set(  // '시트까지' 요구가 있는 파일명
    Array.from(map.values()).filter(req => req.book && req.sheet).map(req => runnerMappingNorm(req.book))
  );
  for (const [key, req] of Array.from(map.entries())) {
    const emptySheet = !String(req.sheet || "").trim();
    // (1) 파일 없는 '시트만' 요구가, 같은 시트를 '구체 파일+시트'로 이미 요구하면 중복 → 제거.
    if (!req.book && req.sheet && coveredSheets.has(runnerMappingNorm(req.sheet))) { map.delete(key); continue; }
    // (2) '파일'처럼 안 생긴(스프레드시트 확장자 없는) book 이 시트 없이 요구로 잡힌 건 대개 VBA `.Name="시트"`
    //     비교/이름지정에서 시트명이 워크북명으로 샌 오탐(예: 올인원중복제거값/세부내역/피벗_결과) → 제거.
    if (req.book && emptySheet && !hasSpreadsheetExt(req.book)) { map.delete(key); continue; }
    // (3) 같은 파일을 '시트까지' 요구하는 항목이 있으면, 그 파일의 '빈 시트' 중복 요구는 제거.
    if (req.book && emptySheet && booksWithSheet.has(runnerMappingNorm(req.book))) { map.delete(key); continue; }
  }
  // [역할 정규화] 같은 파일의 다른 달 이름 요구를 정본 이름 한 행으로 통합(원문은 aliases 보존).
  // 반드시 envConfig 필터 '앞' — 필터가 canonical 이름 기준으로 정확 일치하게.
  try {
    const _canonRes = runnerCanonicalizeRequirementsByEnv(map, state.skillEnvConfig);
    if ((_canonRes.renamed.length || _canonRes.merged.length)
        && typeof traceClientUiEvent === "function") {
      traceClientUiEvent("runner.requirement.canonicalize", {
        renamed: _canonRes.renamed.slice(0, 8).join(" | ").slice(0, 300),
        merged: _canonRes.merged.slice(0, 8).join(" | ").slice(0, 300),
      });
    }
  } catch (_) {}
  // [환경 config 교집합] 저장 시점 정본이 있으면(0.6.2 채용, 구버전 zip 은 null → 그대로)
  // 정본에 없는 파일 요구 제거 + 그 파일에 없던 시트는 '자동' 강등. 결과는 트레이스로 남긴다.
  try {
    const _cfgRes = runnerApplyEnvConfigFilter(map, state.skillEnvConfig);
    if ((_cfgRes.dropped.length || _cfgRes.downgraded.length || _cfgRes.fallbackAdded.length
         || _cfgRes.uncovered.length)
        && typeof traceClientUiEvent === "function") {
      traceClientUiEvent("runner.envconfig.filter", {
        dropped: _cfgRes.dropped.slice(0, 8).join(" | ").slice(0, 300),
        downgraded: _cfgRes.downgraded.slice(0, 8).join(" | ").slice(0, 300),
        fallbackAdded: _cfgRes.fallbackAdded.slice(0, 8).join(" | ").slice(0, 300),
        uncovered: _cfgRes.uncovered.slice(0, 8).join(" | ").slice(0, 300),
      });
    }
  } catch (_) {}
  return Array.from(map.values()).slice(0, 40);
}

function runnerMappingScoreFile(requiredName, item) {
  if (!requiredName || !item) return 0;
  const req = runnerMappingNorm(requiredName);
  const cur = runnerMappingNorm(item.name);
  const reqStem = runnerMappingStem(requiredName);
  const curStem = runnerMappingStem(item.name);
  if (req === cur) return 100;
  if (reqStem === curStem) return 96;
  if (reqStem && curStem && (reqStem.includes(curStem) || curStem.includes(reqStem))) return 78;
  const tokens = reqStem.split(/[_\-\s.()]+/).filter(t => t && t.length >= 2);
  if (!tokens.length) return 0;
  const hit = tokens.filter(t => curStem.includes(t)).length;
  return Math.round((hit / tokens.length) * 70);
}

function runnerFindAutoFile(req, files) {
  if (!files.length) return null;
  if (req.book && typeof pipelineFileIdByWorkbookName === "function") {
    const fid = pipelineFileIdByWorkbookName(req.book);
    const exact = fid && files.find(f => f.id === fid);
    if (exact) {
      // [점수 구분] 예전엔 무조건 100 이라, 월·날짜 무시 '안정키 재바인딩'(4단계)으로 잡힌 근사
      // 매칭도 초록 '정확 매칭/자동 확인'으로 떠 사용자 검토 게이트가 사라졌다. 이름이 실제로
      // 같을 때만 100(정확)이고, 재바인딩이면 90(=95 미만 → '확인 필요')으로 낮춰 노출한다.
      const nameOf = f => (typeof workbookDisplayName === "function" ? workbookDisplayName(f.file, "") : (f.file && f.file.name)) || "";
      const sameName = typeof pipelineWorkbookNameKey === "function"
        ? pipelineWorkbookNameKey(nameOf(exact)) === pipelineWorkbookNameKey(req.book)
        : nameOf(exact) === req.book;
      return { item: exact, score: sameName ? 100 : 90, rebound: !sameName };
    }
  }
  if (req.sheet) {
    const bySheet = files.filter(item => runnerMappingSheetNames(item.file).some(s => runnerMappingNorm(s) === runnerMappingNorm(req.sheet)));
    if (bySheet.length === 1 && !req.book) return { item: bySheet[0], score: 86 };
  }
  const scored = files
    .map(item => ({ item, score: runnerMappingScoreFile(req.book, item) }))
    .sort((a, b) => b.score - a.score);
  if (!scored[0] || scored[0].score < 45) return null;
  // [모호성 가드] pipelineFileIdByWorkbookName 은 후보가 둘 이상이면 일부러 null 을 준다
  // ('잘못된 파일에 실행'이 최악이라 모호하면 사용자에게 묻는 원칙). 그런데 그 null 이 이 폴백으로
  // 내려와 동점 1위(=업로드 순서상 첫 파일)를 조용히 골라, 지난달 파일에 실행되는 일이 있었다.
  // 1위와 2위가 사실상 같은 점수면 자동 선택하지 않고 사용자 선택으로 넘긴다.
  if (scored[1] && scored[0].score - scored[1].score < 5) return null;
  return scored[0];
}

// [생성시트 오매칭 방어] 이 스킬이 실행 중 만드는 시트 이름 전부(책 구분 없이 이름만).
// runnerIsGeneratedSheet 는 (책, 시트) 쌍이 모두 맞아야 '생성시트'로 보는데, 교차파일 스킬은
// 만든 책과 참조하는 책의 이름 해석이 갈려 생성시트가 요구 목록으로 새어 나온다(실물 확인:
// KGM 202605_SS001643_ENTR_BY_STACC_P, UCAP VIEW). 그 요구는 업로드 원본에 있을 리가 없으니
// '시트가 하나뿐이니 그거겠지' 추측이 엉뚱한 원본 시트를 물어와 치환해 버린다.
// 이 집합은 그 '추측'만 끄는 데 쓴다 — 이름이 실제로 일치하면 아래 정확매칭이 그대로 이긴다.
function runnerGeneratedSheetNameSet(steps) {
  const out = new Set();
  (steps || state.pipeline || []).forEach(step => {
    if (!step || !step.code) return;
    try {
      (runnerExtractGeneratedSheetsFromCode(step.code) || []).forEach(g => {
        const nm = runnerMappingNorm(g && g.sheet);
        if (nm) out.add(nm);
      });
    } catch (_) {}
  });
  return out;
}

function runnerFindSheet(req, file, preferredSheet, generatedNames) {
  const sheets = runnerMappingSheetNames(file);
  if (!sheets.length) return "";
  if (preferredSheet && sheets.includes(preferredSheet)) return preferredSheet;
  if (req.sheet) {
    const exact = sheets.find(s => s === req.sheet);
    if (exact) return exact;
    const norm = runnerMappingNorm(req.sheet);
    const normalized = sheets.find(s => runnerMappingNorm(s) === norm);
    if (normalized) return normalized;
  }
  // [가짜 시트명 방어] 시트가 하나뿐이면 '당연히 그것'이라 자동 채택해 왔는데, 보안문서(DRM/AIP)처럼
  // 백엔드가 못 읽은 파일은 그 하나가 실제 시트가 아니라 '파일명'으로 지어낸 자리표다
  // (inspect_workbook_fallback). 그걸 채택하면 스킬의 올바른 시트명이 파일명으로 치환돼
  // step1 부터 "시트를 찾을 수 없음"이 난다(실측). 신뢰불가 목록에서는 자동 채택하지 않는다 —
  // 빈 값으로 두면 runnerBuildMappingRows 가 '스킬 기본값(자동)'으로 잡아 치환 없이 원본대로 실행한다.
  if (file && file.sheetNamesUnreliable) return "";
  // 요구 시트가 '스킬이 만드는 시트'면 업로드 원본에 없는 게 정상이다. 여기서 단일시트를 추측으로
  // 채택하면 새 시트 참조가 엉뚱한 원본 시트로 치환돼, 만들어 둔 시트 대신 원본을 덮어쓴다.
  // 추측을 포기하면 runnerBuildMappingRows 가 '스킬 기본값(자동)'으로 잡아 원래 이름 그대로 실행한다.
  if (req && req.sheet && generatedNames && generatedNames.has(runnerMappingNorm(req.sheet))) return "";
  // [월 변형 시트] 표기 정규화로도 못 잡으면 안정키(월·날짜 무시)로 '유일' 일치 시 채택 —
  // 파일 재바인딩과 동일 원칙("원가_4월" 요구 → 6월 파일의 "원가_6월"). 생성시트 이름은 후보에서
  // 제외(위 가드와 대칭). 2개 이상 걸리면 모호 → 채택하지 않는다(사용자 선택으로).
  if (req && req.sheet && typeof pipelineStableWorkbookKey === "function") {
    let k = "";
    try { k = pipelineStableWorkbookKey(req.sheet) || ""; } catch (_) { k = ""; }
    if (k && k.length >= 2) {
      const hits = sheets.filter(s => {
        if (generatedNames && generatedNames.has(runnerMappingNorm(s))) return false;
        try { return (pipelineStableWorkbookKey(s) || "") === k; } catch (_) { return false; }
      });
      if (hits.length === 1) return hits[0];
    }
  }
  return sheets.length === 1 ? sheets[0] : "";
}

// [매핑 보존] 시그니처는 '어떤 파일이 올라와 있나 + 어떤 스킬이 로드돼 있나'만 본다.
// 예전엔 파일의 '시트 목록'과 스텝 '코드/targetFileId'까지 넣어서, 매핑과 무관한 정상 변화에도
// 사용자가 직접 확정한 매핑(도서/시내처럼 기계가 절대 못 고르는 것)이 통째로 초기화됐다:
//   · '결과 편집하기'로 결과를 불러오면 스킬이 만든 새 시트 때문에 시트 목록이 바뀜 → 초기화
//   · 스텝 코드를 한 글자(청구계정번호 등) 고치면 코드가 바뀜 → 초기화
// 그 뒤 재실행은 매핑 없이 돌아 대상 추론 실패 → 현재 탭으로 조용히 폴백 → "워크북이 열려 있지 않습니다".
// 매핑은 (파일명,시트명) 키라 요구가 바뀌면 옛 항목은 그냥 조회되지 않고(무해), 저장된 fileId 가
// 사라진 파일이면 runnerBuildMappingRows 가 자동매칭으로 되돌린다 — 즉 통째 초기화할 이유가 없다.
function runnerCurrentMappingSignature() {
  const files = runnerMappingKnownFiles().map(item => [item.id, item.name].join("|"));
  const steps = (state.pipeline || []).map(s => (s && s.id) || "");
  return JSON.stringify({ files, steps });
}

function runnerResetMappingIfSourceChanged() {
  // 실행 동안은 state.pipeline 이 '매핑본'으로 잠시 교체돼 코드 시그니처가 달라진다 — 이때 소스 변경으로
  // 오인해 매핑을 초기화하면 안 된다(실행 후 원본 복원 시 시그니처도 원래대로 돌아온다).
  if (state.runnerMappingRunActive) return;
  const sig = runnerCurrentMappingSignature();
  if (state.runnerMappingSignature !== sig) {
    state.runnerMappingSignature = sig;
    state.runnerMappingChecked = false;
    state.runnerMappings = {};
  }
}

function runnerBuildMappingRows() {
  const reqs = runnerExtractMappingRequirements();
  const files = runnerMappingKnownFiles();
  const generatedNames = runnerGeneratedSheetNameSet();   // 행마다 재계산하지 않도록 1회
  return reqs.map(req => {
    const stored = state.runnerMappings && state.runnerMappings[req.key];
    let fileItem = stored && files.find(item => item.id === stored.fileId);
    let score = stored && fileItem ? 100 : 0;
    let rebound = false;   // 월·날짜 무시 안정키로 '다른 달 파일'에 이어붙인 근사 매칭인가
    if (!fileItem) {
      const auto = runnerFindAutoFile(req, files);
      fileItem = auto && auto.item;
      score = auto && auto.score || 0;
      rebound = !!(auto && auto.rebound);
    }
    // [스킬 기본값] 사용자가 '치환하지 말라'고 명시한 시트 — sheet 를 비워 두면
    // buildRunnerMappedPipeline 의 `if (row.req.sheet && row.sheet)` 가 걸러 치환이 일어나지 않는다.
    // 다만 '선택 필요'(bad)로 떨어져 실행이 막히면 안 되므로 상태는 정상으로 둔다.
    let skillDefault = !!(stored && runnerIsSkillDefaultSheet(stored.sheet));
    const sheet = (fileItem && !skillDefault) ? runnerFindSheet(req, fileItem.file, stored && stored.sheet, generatedNames) : "";
    // [안전판] 파일은 정해졌는데 요구 시트가 자동 매칭되지 않고 사용자가 고르지도 않았으면
    // '시트 선택'(선택 강요) 대신 '스킬 기본값(그대로 실행)'을 기본 선택으로 둔다 — 요구 추출이
    // 놓친 케이스(생성 시트 감지 누락 등)가 실행을 막거나 사용자를 헤매게 하지 않게(치환만 생략).
    let autoSkillDefault = false;
    if (fileItem && req.sheet && !sheet && !(stored && stored.sheet)) {
      skillDefault = true;
      autoSkillDefault = true;
    }
    let status = "bad";
    let statusText = "선택 필요";
    if (fileItem && skillDefault) {
      status = "ok";
      statusText = autoSkillDefault ? "스킬 기본값(자동)" : "스킬 기본값";
    } else if (fileItem && (!req.sheet || sheet)) {
      const sheetExact = !req.sheet || sheet === req.sheet || runnerMappingNorm(sheet) === runnerMappingNorm(req.sheet);
      if ((score >= 95 || !req.book) && sheetExact) {
        status = "ok";
        statusText = "자동 확인";
      } else {
        status = "warn";
        // 다른 달 파일에 이어붙인 경우엔 이유를 보여준다(사용자가 맞는지 눈으로 확인하도록).
        statusText = rebound ? "확인 필요(다른 달 추정)" : "확인 필요";
      }
    }
    return { req, files, fileItem, sheet, score, status, statusText, rebound, skillDefault, autoSkillDefault, userSet: !!(stored && stored.userSet) };
  });
}

// per-(book,sheet) 행들을 '파일별 1행'으로 접는다. 한 파일이 여러 시트를 쓰면 그 파일 한 줄에
// 시트들을 함께 보여준다(사용자는 '올려야 할 파일'을 파일 단위로 한눈에 보고 매핑). 내부 매핑
// (state.runnerMappings / buildRunnerMappedPipeline)은 여전히 per-(book,sheet) 키로 동작한다.
function runnerGroupMappingRowsByFile(rows) {
  const groups = [];
  const byKey = new Map();
  (rows || []).forEach(row => {
    const gkey = runnerMappingNorm(row.req.book) || " __nofile__";
    let g = byKey.get(gkey);
    if (!g) {
      g = { gkey, book: row.req.book || "", files: row.files, fileItem: row.fileItem || null, members: [] };
      byKey.set(gkey, g);
      groups.push(g);
    }
    if (!g.fileItem && row.fileItem) g.fileItem = row.fileItem;   // 파일 매핑은 그룹 공통
    g.members.push(row);
  });
  groups.forEach(g => {
    g.userSet = g.members.some(m => m.userSet);   // 사람이 직접 파일/시트를 고른 그룹
    const sheetMembers = g.members.filter(m => m.req.sheet);
    if (!g.fileItem) { g.status = "bad"; g.statusText = "파일 선택 필요"; return; }
    // 스킬 기본값(사용자 명시/자동 안전판)은 '치환 없이 그대로 실행'이 확정된 상태 — 미해결이 아니다.
    const unresolved = sheetMembers.filter(m => !m.sheet && !m.skillDefault);
    if (unresolved.length) { g.status = "warn"; g.statusText = "시트 확인"; return; }
    // 파일+시트 모두 해결됨 → 초록(ok). 어떻게 해결됐는지에 따라 라벨만 구분.
    if (g.userSet) { g.status = "ok"; g.statusText = "사용자 확인 완료"; }                      // 사람이 직접 지정
    else if (g.members.some(m => m.autoSkillDefault)) { g.status = "ok"; g.statusText = "스킬 기본값 포함"; }  // 자동 안전판 — 정확 매칭으로 과장하지 않음
    else if (g.members.every(m => m.status === "ok")) { g.status = "ok"; g.statusText = "정확 매칭"; }  // 정확 자동
    else { g.status = "ok"; g.statusText = "AI 자동매칭"; }                                     // 유사도 자동(예전 '확인 필요')
  });
  return groups;
}

function runnerMappingHasBlockingMissing() {
  if (!state.runnerMappingChecked) return false;
  return runnerGroupMappingRowsByFile(runnerBuildMappingRows()).some(g => g.status === "bad");
}

// 칩에 보여줄 라벨: 10자까지는 그대로, 넘으면 10자 + …(전체 이름은 title 툴팁으로).
function runnerChipLabel(value) {
  const t = String(value == null ? "" : value);
  return t.length > 10 ? t.slice(0, 10) + "…" : t;
}

// [표시명 정리] 확장자와 실제 내용이 다른 위장 파일(예: .xlsx 인데 내용은 구형 .xls/HTML — 한전
// 시스템 추출물)은 호환 변환을 거치며 시트명이 '<32hex>_원본파일명'으로 파생된다. 진짜 xlsx 는
// 파일 안의 시트명이 그대로라 이런 접두가 없다(같은 화면에서 한국전력공사만 깨끗했던 이유).
// 실행·치환·저장(value)은 실제 시트명을 그대로 쓰고, 사용자가 고르는 '라벨'만 해시를 벗겨 보여준다.
function runnerDisplaySheetName(name) {
  const s = String(name == null ? "" : name);
  const cleaned = s.replace(/^(?:excel_open_|live_reset_|prestep_)?[0-9a-f]{12,}[_-]+/i, "");
  return cleaned || s;
}

function runnerRenderMappingPanel() {
  const grid = $("runner-main-grid");
  const panel = $("runner-mapping-panel");
  const table = $("runner-mapping-table");
  const badge = $("runner-mapping-badge");
  if (!grid || !panel || !table) return;
  const show = !!state.runnerMappingChecked;
  panel.hidden = !show;
  grid.classList.toggle("mapping-visible", show);
  if (!show) return;

  const rows = runnerBuildMappingRows();
  const groups = runnerGroupMappingRowsByFile(rows);
  const counts = groups.reduce((acc, g) => { acc[g.status] = (acc[g.status] || 0) + 1; return acc; }, {});
  if (badge) {
    if (!groups.length) badge.textContent = "확인할 항목 없음";
    else badge.textContent = `파일 ${groups.length}개 · 자동 ${counts.ok || 0} · 확인 ${counts.warn || 0} · 선택 ${counts.bad || 0}`;
  }
  if (!groups.length) {
    table.innerHTML = `<div class="runner-mapping-empty">스킬에서 명시적인 파일·시트 참조를 찾지 못했습니다. 현재 실행 대상 기준으로 진행합니다.</div>`;
    return;
  }
  table.innerHTML = groups.map((g, gidx) => {
    const fileOptions = [`<option value="">파일 선택</option>`].concat(g.files.map(item =>
      `<option value="${escapeHtml(item.id)}" ${g.fileItem && g.fileItem.id === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    )).join("");
    const sheetsInFile = g.fileItem ? runnerMappingSheetNames(g.fileItem.file) : [];
    // 표시 라벨 충돌 방지: 서로 다른 실제 시트가 같은 정리명으로 겹치면(드묾) 그 시트들은 원래 이름 유지.
    const displayCount = {};
    sheetsInFile.forEach(s => { const d = runnerDisplaySheetName(s); displayCount[d] = (displayCount[d] || 0) + 1; });
    const sheetOptionLabel = s => {
      const d = runnerDisplaySheetName(s);
      return (d !== s && displayCount[d] > 1) ? s : d;
    };
    const sheetMembers = g.members.filter(m => m.req.sheet);
    // 왼쪽: 스킬이 찾는 시트들을 칩으로 표시(해시 접두는 표시에서만 정리 — 툴팁에 원래 이름).
    const sheetChips = sheetMembers.length
      ? sheetMembers.map(m =>
          `<span class="runner-mapping-sheet-chip" title="${escapeHtml(m.req.sheet)}">${escapeHtml(runnerChipLabel(runnerDisplaySheetName(m.req.sheet)))}</span>`
        ).join("")
      : `<span class="runner-mapping-sheet-chip">시트 자동</span>`;
    // 오른쪽: 각 시트마다 [요청 시트 칩] ↔ [실제 파일의 시트 드롭다운]. 자동 해결된 시트는 드롭다운이 미리 선택됨.
    // '시트 자동' 그룹(스킬 코드에 시트명이 없음)에도 선택은 열어 두되, 왜 '자동'인지 안내를 붙인다.
    // 예전엔 안내 없이 드롭다운만 있어서, 스킬이 시트명을 안 가진 사실 자체가 안 보였다.
    const pairMembers = sheetMembers.length ? sheetMembers : g.members.slice(0, 1);
    const sheetMaps = pairMembers.map(m => {
      const isAuto = !m.req.sheet;
      // '스킬 기본값' = 치환하지 않고 스킬 코드에 적힌 값 그대로 실행(원래 돌던 스킬용 탈출구).
      const skillDefaultOpt =
        `<option value="${RUNNER_SHEET_SKILL_DEFAULT}" ${m.skillDefault ? "selected" : ""}>스킬 기본값(그대로 실행)</option>`;
      const opts = [`<option value="">${isAuto ? "시트 자동(첫 시트)" : "시트 선택"}</option>`, skillDefaultOpt].concat(sheetsInFile.map(s =>
        `<option value="${escapeHtml(s)}" title="${escapeHtml(s)}" ${!m.skillDefault && m.sheet && runnerMappingNorm(m.sheet) === runnerMappingNorm(s) ? "selected" : ""}>${escapeHtml(sheetOptionLabel(s))}</option>`
      )).join("");
      const chipCls = isAuto ? "" : (m.sheet ? "ok" : "warn");
      if (isAuto) {
        return `<div class="runner-mapping-sheet-map">
            <span class="runner-mapping-sheet-chip" title="스킬 코드에 시트명이 없어 기본은 첫 번째 시트입니다.">시트 자동</span>
            <span class="runner-mapping-sheet-link">↔</span>
            <select class="runner-mapping-select runner-map-sheet2" data-mi="${g.members.indexOf(m)}" data-gidx="${gidx}" ${g.fileItem ? "" : "disabled"}>${opts}</select>
            <div class="runner-mapping-sheet-note">* 스킬 생성 당시 명확한 시트명이 제공되지 않아 첫 번째 시트 기준으로 생성되었습니다. 다른 시트를 쓰려면 직접 골라 주세요.</div>
          </div>`;
      }
      // data-key 에 req.key(널 문자   구분자 포함)를 넣으면 HTML 속성에서 널이 U+FFFD 로 바뀌어
      // 핸들러의 키가 실제 키와 안 맞았다 → 선택이 저장돼도 반영 안 됨(클릭은 되는데 선택 안 되는 증상).
      // 멤버 인덱스(data-mi)로만 넘기고, 실제 키는 핸들러에서 g.members[mi].req.key 로 직접 얻는다.
      return `<div class="runner-mapping-sheet-map">
            <span class="runner-mapping-sheet-chip ${chipCls}" title="${escapeHtml(m.req.sheet)}">${escapeHtml(runnerChipLabel(runnerDisplaySheetName(m.req.sheet)))}</span>
            <span class="runner-mapping-sheet-link">↔</span>
            <select class="runner-mapping-select runner-map-sheet2" data-mi="${g.members.indexOf(m)}" data-gidx="${gidx}" ${g.fileItem ? "" : "disabled"}>${opts}</select>
          </div>`;
    }).join("");
    return `
      <div class="runner-mapping-row" data-gidx="${gidx}" data-status="${g.status}">
        <div class="runner-mapping-need">
          <div class="runner-mapping-label">스킬이 찾는 파일</div>
          <div class="runner-mapping-file" title="${escapeHtml(g.book || "파일 미지정")}">${escapeHtml(g.book || "현재 대상 파일")}</div>
          <div class="runner-mapping-sheets">${sheetChips}</div>
        </div>
        <div class="runner-mapping-arrow">→</div>
        <div class="runner-mapping-actual">
          <div class="runner-mapping-label">실제 사용할 파일 / 시트</div>
          <div class="runner-mapping-selects">
            <select class="runner-mapping-select runner-map-file2" data-gidx="${gidx}">${fileOptions}</select>
            ${sheetMaps}
          </div>
        </div>
        <div class="runner-mapping-status ${g.status}">${escapeHtml(g.statusText)}</div>
      </div>
    `;
  }).join("");

  // 파일 선택 → 그 파일 그룹의 '모든' (book,sheet) 요구 키에 fileId + 자동해결 시트를 채운다.
  table.querySelectorAll(".runner-map-file2").forEach(sel => {
    sel.onchange = () => {
      const gidx = Number(sel.dataset.gidx);
      const g = groups[gidx];
      if (!g) return;
      const fileItem = g.files.find(item => item.id === sel.value);
      g.members.forEach(m => {
        const sheet = fileItem ? runnerFindSheet(m.req, fileItem.file, "", runnerGeneratedSheetNameSet()) : "";
        state.runnerMappings[m.req.key] = { fileId: sel.value || "", sheet, userSet: !!sel.value };  // 사람이 직접 파일 지정 → '사용자 확인'
      });
      runnerRenderMappingPanel();
      renderRunnerWorkflow();
    };
  });
  // 시트 직접 선택(파일은 그룹 매핑 유지). 키는 DOM 속성이 아니라 멤버에서 직접 얻는다(널 문자 키 훼손 회피).
  table.querySelectorAll(".runner-map-sheet2").forEach(sel => {
    sel.onchange = () => {
      const gidx = Number(sel.dataset.gidx);
      const mi = Number(sel.dataset.mi);
      const g = groups[gidx];
      const m = g && g.members[mi];
      if (!g || !m) return;
      state.runnerMappings[m.req.key] = { fileId: g.fileItem ? g.fileItem.id : "", sheet: sel.value || "", userSet: true };  // 사람이 직접 시트 변경 → '사용자 확인'
      runnerRenderMappingPanel();
      renderRunnerWorkflow();
    };
  });
}

// [진짜 시트명 재확보] 업로드 순간 Excel 이 바빠서 검사에 실패한 워크북은 시트 목록이 '파일명'
// 자리표다(requiresExcel). 매핑 화면을 여는 시점엔 Excel 이 한가한 경우가 많아 한 번 더 시도하면
// 진짜 시트명을 얻는다. 끝내 실패하는 파일(DRM/AIP)은 신뢰불가로 남아 '스킬 기본값'으로 폴백된다.
async function runnerRefreshUnreliableSheetNames() {
  if (!window.fetch || location.protocol === "file:") return 0;
  const targets = (state.inputs || [])
    .concat((state.outputTemplates || []).map(t => t && t.file).filter(Boolean))
    .filter(f => f && f.sheetNamesUnreliable && f.backendWorkbookId);
  if (!targets.length) return 0;
  let fixed = 0;
  for (const file of targets) {
    try {
      const resp = await fetch("/api/workbooks/reinspect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workbookId: file.backendWorkbookId }),
      });
      const data = await resp.json();
      if (!resp.ok || !data || !data.ok || !data.meta) continue;
      const meta = data.meta;
      if (meta.requiresExcel === true) continue;          // 여전히 못 읽음 → 자리표 유지
      const names = Array.isArray(meta.sheetNames) ? meta.sheetNames.filter(Boolean) : [];
      if (!names.length) continue;
      file.sheetNames = names.slice();
      file.sheetNamesUnreliable = false;
      file.inspectError = "";
      // pristine 스냅샷도 같은 파일이면 함께 갱신(요구 계산이 원본 기준이라 어긋나면 안 된다).
      (state.inputsOriginal || []).forEach(orig => {
        if (orig && orig.backendWorkbookId === file.backendWorkbookId) {
          orig.sheetNames = names.slice();
          orig.sheetNamesUnreliable = false;
        }
      });
      fixed += 1;
    } catch (_) { /* 네트워크 실패는 무시 — 자리표 유지 후 스킬 기본값 폴백 */ }
  }
  return fixed;
}

window.runnerShowMappingPanel = function() {
  runnerResetMappingIfSourceChanged();
  state.runnerMappingChecked = true;
  runnerRenderMappingPanel();
  renderRunnerWorkflow();
  // 재검사는 비동기 — 먼저 화면을 그리고, 진짜 이름을 얻으면 그 자리에서 다시 그린다.
  runnerRefreshUnreliableSheetNames().then(fixed => {
    if (!fixed) return;
    try {
      runnerRenderMappingPanel();
      renderRunnerWorkflow();
      if (typeof toast === "function") toast(`실제 시트 이름을 확인했습니다(파일 ${fixed}개).`, "success");
    } catch (_) {}
  }).catch(() => {});
};

function runnerReplaceLiteral(text, from, to) {
  const src = String(text || "");
  const a = String(from || "");
  const b = String(to || "");
  if (!a || !b || a === b) return src;
  const esc = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return src.replace(new RegExp(`(["'])${esc}\\1`, "g"), (_, quote) => `${quote}${b}${quote}`);
}

// 스텝이 스스로 밝힌 '쓰기 대상' 파일 이름. 저장 스킬의 targetFileId 는 "input:파일명.xlsx" 꼴이다.
// (출력 템플릿 대상은 "output:N" 이라 이름이 없다 → 빈 문자열 = 선언 없음으로 본다.)
function runnerDeclaredTargetBookName(step) {
  const tid = String((step && step.targetFileId) || "");
  return tid.startsWith("input:") ? tid.slice(6).trim() : "";
}

// 같은 워크북 이름인가. 실행기 매핑은 확장자/공백 표기가 조금씩 다른 파일을 다루므로
// 정확 일치 → 확장자 뗀 이름 일치까지만 본다(그 이상 느슨하게 보면 남의 파일을 대상으로 삼는다).
function runnerSameBookName(a, b) {
  const norm = s => String(s || "").trim().toLowerCase();
  const stem = s => norm(s).replace(/\.[a-z0-9]+$/, "");
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || stem(x) === stem(y);
}

window.buildRunnerMappedPipeline = function(steps) {
  // [진단] '실행기 매핑이 생성기 재실행에 안 실려 옛 파일명으로 실패'(실측 2026-07-29 test_mapping)의
  // 정확한 원인 게이트를 실측으로 잡는다 — checked=false 인가, 매핑행이 0인가.
  const _traceMap = (reason, extra) => {
    try {
      if (typeof traceClientUiEvent === "function") traceClientUiEvent("runner.mapping.build", {
        reason: String(reason),
        checked: String(!!state.runnerMappingChecked),
        knownFiles: String((typeof runnerMappingKnownFiles === "function" ? runnerMappingKnownFiles() : []).length),
        mappings: String(Object.keys(state.runnerMappings || {}).length),
        runActive: String(!!state.runnerMappingRunActive),
        ...(extra || {}),
      });
    } catch (_) {}
  };
  if (!state.runnerMappingChecked) { _traceMap("skip:not-checked"); return steps || state.pipeline; }
  // [뻑남 수정] 예전엔 '시트까지 해결된 행'만 남겨서, 시트가 안 잡히면 그 행을 통째로 버려 파일명조차
  // 치환 안 됐다 → 코드에 옛 파일명(expected_output.xlsx)이 남아 "워크북이 열려 있지 않습니다"로 실패.
  // 이제 '파일이 매핑된 행'은 모두 남겨 파일명을 반드시 치환하고(시트는 해결됐을 때만 치환) 파일 누락 실패를 막는다.
  const _allRows = runnerBuildMappingRows();
  const rows = _allRows.filter(row => row.fileItem);
  if (!rows.length) { _traceMap("skip:no-mapped-rows", { totalReqRows: String(_allRows.length) }); return steps || state.pipeline; }
  // mapped: 파일은 치환되지만 '시트'는 row.sheet 가 비면(스킬 기본값/미해결) 치환 안 됨 → 시트명 오류 가능.
  // book→actual, sheet→row.sheet(빈값이면 '(기본값)') 을 함께 남겨 파일/시트 어느 쪽이 문제인지 구분한다.
  _traceMap("mapped", { rows: String(rows.length),
    map: rows.slice(0, 6).map(r => `${(r.req && r.req.book) || "?"}→${(r.fileItem && r.fileItem.name) || "?"}/${(r.req && r.req.sheet) || "?"}→${r.sheet || "(기본값)"}`).join(" | ") });
  return (steps || state.pipeline || []).map(step => {
    if (!step || !step.code) return step;
    let code = String(step.code || "");
    let targetFileId = step.targetFileId || null;
    let targetSheetName = step.targetSheetName || null;
    const stepText = [step.prompt, step.description, step.code, step.targetFileId, step.targetSheetName].filter(Boolean).join("\n");
    // 스텝이 스스로 밝힌 '쓰기 대상' 파일 이름("input:파일명" 형태). 없으면 빈 문자열.
    const declaredBook = runnerDeclaredTargetBookName(step);
    const isOutputSlot = /^output:/.test(String((step && step.targetFileId) || ""));
    const matchedRows = [];    // 텍스트에 이름이 등장한 행(읽기 소스도 섞인다)
    const declaredRows = [];   // 그중 '선언된 쓰기 대상'과 같은 파일인 행
    rows.forEach(row => {
      const actualName = row.fileItem ? row.fileItem.name : "";
      // [역할 정규화 별칭] 요구 book 이 정본 이름으로 정규화됐어도, 코드에는 옛 달 이름(4월 등)이
      // 그대로 있을 수 있다 — canonical + aliases 전부 치환해야 실행이 그 워크북을 찾는다.
      const bookNames = [row.req.book, ...((row.req && row.req.aliases) || [])].filter(Boolean);
      // 파일명 치환은 '스킬 기본값'에서도 유지한다 — 안 하면 옛 파일명이 남아 워크북을 못 찾는다.
      if (actualName) bookNames.forEach(bn => { code = runnerReplaceLiteral(code, bn, actualName); });
      // 시트는 사용자가 '스킬 기본값'을 고르면 손대지 않는다(row.sheet 가 비어 있음).
      // [월 변형 시트 별칭] 정규화된 시트의 원문 이름들(sheetAliases)도 함께 치환 — 코드에
      // "원가_4월"이 남아 있으면 실제 시트로 못 간다.
      if (row.sheet) {
        const sheetNames = [row.req.sheet, ...((row.req && row.req.sheetAliases) || [])].filter(Boolean);
        sheetNames.forEach(sn => { code = runnerReplaceLiteral(code, sn, row.sheet); });
      }
      const touchesBook = bookNames.some(bn => stepText.includes(bn));
      const touchesSheet = row.req.sheet && stepText.includes(row.req.sheet);
      // [쓰기 대상 오염 수정 2026-08-13] 예전엔 여기서 곧바로 targetFileId 를 덮었다. 조건이
      // '스텝 텍스트 어딘가에 이 파일 이름이 있다'뿐이라 읽기 소스와 쓰기 대상을 구분하지 못했고,
      // rows 를 끝까지 돌아 '마지막에 걸린 행이 이기는' 구조였다.
      //   실측 모양: 3단계가 A 를 읽어 B 에 붙여넣는데(ctx.copy("A.xlsx!시트", ...)),
      //   스텝 텍스트에 A(코드 리터럴)와 B(targetFileId 문자열)가 둘 다 있어 두 행이 걸리고,
      //   A 행이 뒤에 있으면 대상이 A 로 바뀐다 → 붙여넣기·피벗이 B 가 아니라 A 에 생긴다.
      //   생성기에선 매핑이 안 돌아(파일확인 미확정) 안 보이고 실행기에서만 터졌다.
      // 이제 '걸린 행'을 모아 두기만 하고, 무엇으로 정할지는 아래에서 한 번에 판단한다.
      if (touchesBook || (!row.req.book && touchesSheet)) matchedRows.push(row);
      if (declaredBook && bookNames.some(bn => runnerSameBookName(bn, declaredBook))) declaredRows.push(row);
    });
    // 스텝이 대상을 선언했으면 그 선언에 해당하는 행으로만 다시 묶는다(읽기 소스는 대상이 아니다).
    // 선언이 없는 옛 스킬은 예전처럼 텍스트로 찾되, 여러 행이 걸리면 '마지막 승' 대신 손대지 않는다
    // — 어느 쪽인지 모르는 채 고르면 그게 바로 위 버그다.
    // 출력 템플릿 대상("output:N")은 이름이 아니라 '슬롯'이다 — 실행기에도 같은 슬롯이 있으므로
    // 그대로 두면 맞는다. 이름으로 다시 묶으려 들면, 코드가 소스 파일만 언급하는 스텝이
    // 그 소스로 끌려가 엉뚱한 파일에 쓴다(VM 실측 6단계가 정확히 이 모양이었다).
    let pick = declaredRows.length ? declaredRows : (isOutputSlot ? [] : matchedRows);
    // 여러 행이 걸렸을 때 대상 '시트' 이름이 한 행에만 맞으면 그 행이 쓰기 대상이다.
    // (출력 슬롯은 위에서 이미 후보를 비웠으므로 여기 안 온다 — 선언 이름이 여러 행에 걸리는
    //  경우에만 쓰인다.)
    if (pick.length > 1 && targetSheetName) {
      const bySheet = pick.filter(r => r.req && r.req.sheet && String(r.req.sheet) === String(targetSheetName));
      if (bySheet.length === 1) pick = bySheet;
    }
    if (pick.length === 1) {
      targetFileId = pick[0].fileItem.id;
      if (pick[0].sheet) targetSheetName = pick[0].sheet;
    } else if (pick.length > 1) {
      _traceMap("target.ambiguous", {
        stepId: String(step.id || ""),
        declared: declaredBook || "(없음)",
        rows: pick.map(r => (r.fileItem && r.fileItem.name) || "?").join(","),
      });
    }
    return { ...step, code, targetFileId, targetSheetName, runnerMapped: true };
  });
};

function renderRunnerWorkflow() {
  runnerResetMappingIfSourceChanged();
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
  const activeStepCount = state.pipeline.filter(isStepEnabled).length;
  if (resultList) {
    resultList.innerHTML = state.output && activeStepCount
      ? `<div class="workflow-pill">${activeStepCount}개 활성 단계 실행 대상</div>`
      : "";
  }

  if (inputNode) inputNode.classList.toggle("filled", state.inputs.length > 0);
  if (outputNode) outputNode.classList.toggle("filled", !!state.output);
  if (logicNode) logicNode.classList.toggle("filled", state.pipeline.length > 0);
  if (resultNode) resultNode.classList.toggle("filled", !!state.output && activeStepCount > 0);
  setNodeStatus(inputNode, state.inputs.length > 0, "파일 수정/다운", () => openRunnerFileEditor("input"));
  setNodeStatus(outputNode, state.outputTemplates.length > 0, "파일 수정/다운", () => openRunnerFileEditor("output"));
  setNodeStatus(logicNode, state.pipeline.length > 0, "스킬 수정", () => openRunnerLogicEditor());

  const setCount = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  setCount("runner-input-count", state.inputs.length);
  setCount("runner-output-count", state.outputTemplates.length || "–");
  setCount("runner-logic-count", state.pipeline.length);

  const runnable = (state.inputs.length > 0 || !!state.output) && activeStepCount > 0;
  const mappingChecked = !!state.runnerMappingChecked;
  const mappingMissing = runnerMappingHasBlockingMissing();
  const waitingForMapping = runnable && !mappingChecked;
  const readyToRun = runnable && mappingChecked && !mappingMissing;
  const centerLabel = resultNode && resultNode.querySelector(".runner-center-label");
  if (centerLabel && !resultNode?.classList.contains("running") && !resultNode?.classList.contains("done")) {
    centerLabel.textContent = mappingChecked ? "실행하기" : "파일확인";
  }
  const centerSub = $("runner-center-sub");
  if (centerSub && !resultNode?.classList.contains("running") && !resultNode?.classList.contains("done")) {
    centerSub.textContent = !runnable ? "대기 중" : waitingForMapping ? "매핑 확인" : mappingMissing ? "선택 필요" : "실행 준비";
  }
  const heroBadge = $("runner-hero-badge");
  const isRunnerBusy = resultNode && resultNode.classList.contains("running");
  const isRunnerDone = resultNode && resultNode.classList.contains("done");
  if (heroBadge && !isRunnerBusy && !isRunnerDone) {
    heroBadge.classList.remove("ready", "running", "done");
    if (readyToRun) { heroBadge.classList.add("ready"); heroBadge.textContent = "실행 준비 완료"; }
    else if (mappingMissing) { heroBadge.textContent = "매핑 선택 필요"; }
    else if (waitingForMapping) { heroBadge.textContent = "파일 확인 필요"; }
    else { heroBadge.textContent = "대기 중"; }
  }

  const statInputs = $("runner-stat-inputs");
  const statTemplate = $("runner-stat-template");
  const statSteps = $("runner-stat-steps");
  const statState = $("runner-stat-state");
  if (statInputs) statInputs.textContent = state.inputs.length;
  if (statTemplate) statTemplate.textContent = state.outputTemplates.length || "–";
  if (statSteps) statSteps.textContent = state.pipeline.length;
  if (statState) statState.textContent = !runnable ? "준비" : waitingForMapping ? "파일확인" : mappingMissing ? "선택필요" : "준비완료";

  if (summary) {
    const current = state.currentFileId ? (getFile(state.currentFileId)?.name || "") + " / " + (state.currentSheet || "-") : "미리보기 없음";
    summary.innerHTML = state.inputs.length || state.output || state.pipeline.length
      ? `<span class="runner-summary-ico">●</span><span>입력 <b>${state.inputs.length}개</b> · 출력 템플릿 <b>${state.outputTemplates.length}개</b> · 스킬 단계 <b>${state.pipeline.length}개</b> · 현재 미리보기: ${escapeHtml(current)}</span>`
      : `<span class="runner-summary-ico">●</span><span>아직 로드된 파일과 스킬이 없습니다.</span>`;
  }

  if (runBtn) runBtn.disabled = !runnable || (mappingChecked && mappingMissing);
  if (downloadBtn) {
    const hasDownloadableFiles = typeof collectAllDownloadFiles === "function"
      ? collectAllDownloadFiles().length > 0
      : !!state.output;
    downloadBtn.disabled = !hasDownloadableFiles;
  }
  runnerRenderMappingPanel();
}

window.runnerSetRunning = function(running) {
  const node = document.getElementById("runner-result-node");
  const sub = document.getElementById("runner-center-sub");
  const statState = document.getElementById("runner-stat-state");
  const badge = document.getElementById("runner-hero-badge");
  if (!node) return;
  node.classList.toggle("running", !!running);
  if (running) node.classList.remove("done");
  if (running) { const _eb = document.getElementById("runner-edit-result-btn"); if (_eb) _eb.disabled = true; }  // [#2] 실행 중 비활성
  if (sub && running) sub.textContent = "실행 중...";
  if (statState) statState.textContent = running ? "실행 중" : "준비";
  if (badge) {
    badge.classList.remove("ready", "running", "done");
    if (running) {
      badge.classList.add("running");
      badge.textContent = "실행 중";
    }
  }
};

window.runnerSetProgress = function(text) {
  const sub = document.getElementById("runner-center-sub");
  const statState = document.getElementById("runner-stat-state");
  const badge = document.getElementById("runner-hero-badge");
  if (sub) sub.textContent = text || "실행 중...";
  if (statState) statState.textContent = text || "실행 중";
  if (badge) {
    badge.classList.remove("ready", "done");
    badge.classList.add("running");
    badge.textContent = text || "실행 중";
  }
};

/* [사용자 지시 2026-08-12] 실행이 끝나면 '완료'가 2.5초 뒤 스스로 '실행 준비'로 돌아가서,
   잠깐 눈을 떼면 성공했는지·아무 일도 없었는지·뻗었는지 구분이 안 됐다.
   → 끝나면 결과 요약 카드를 띄우고 **사용자가 직접 닫게** 한다. 자리를 비웠다 와도 결과가 남는다.
   실수로 닫히지 않게 바깥 클릭으로는 안 닫고, [확인]과 ESC 로만 닫는다. */
window.runnerShowRunSummary = function(info) {
  info = info || {};
  const prev = document.getElementById("runner-run-summary");
  if (prev) prev.remove();

  const outs = Array.isArray(window.lastRunnerOutputs) ? window.lastRunnerOutputs.filter(Boolean) : [];
  const steps = Number(info.steps) || 0;
  const ms = Number(info.ms) || 0;
  const took = ms >= 60000
    ? `${Math.floor(ms / 60000)}분 ${Math.round((ms % 60000) / 1000)}초`
    : `${(ms / 1000).toFixed(1)}초`;
  const now = info.finishedAt instanceof Date ? info.finishedAt : new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const wrap = document.createElement("div");
  wrap.id = "runner-run-summary";
  wrap.className = "runner-summary-backdrop";
  wrap.innerHTML = `
    <div class="runner-summary-card" role="dialog" aria-modal="true" aria-labelledby="runner-summary-title">
      <div class="runner-summary-head">
        <span class="runner-summary-check" aria-hidden="true">✓</span>
        <div>
          <div class="runner-summary-title" id="runner-summary-title">실행이 끝났습니다</div>
          <div class="runner-summary-sub">${esc(steps)}개 단계 · ${esc(took)} 걸림 · ${esc(hh)}:${esc(mm)} 완료</div>
        </div>
      </div>
      ${outs.length ? `
      <div class="runner-summary-files">
        <div class="runner-summary-files-title">결과 파일 ${outs.length}개</div>
        <ul>${outs.slice(0, 8).map((o, i) => `<li><span class="runner-summary-fname">${esc(o.name || "결과 파일")}</span>`
          + (o.downloadUrl || o.downloadId
            ? `<button class="runner-summary-dl1" type="button" data-idx="${i}" title="이 파일만 내려받기">⬇</button>`
            : "") + `</li>`).join("")}
        ${outs.length > 8 ? `<li class="more">외 ${outs.length - 8}개</li>` : ""}</ul>
      </div>` : `
      <div class="runner-summary-files">
        <div class="runner-summary-files-title">결과 파일이 만들어지지 않았습니다</div>
        <div class="runner-summary-note">단계는 모두 끝났지만 저장된 파일이 없습니다. 스킬이 값을 쓰는 대상이 맞는지 확인해 주세요.</div>
      </div>`}
      <div class="runner-summary-actions">
        ${outs.length ? '<button class="runner-summary-edit" type="button">📝 결과 편집하기</button>' : ""}
        ${outs.length ? '<button class="runner-summary-dlall" type="button">📥 전체 파일 다운로드</button>' : ""}
        <button class="runner-summary-close" type="button">확인</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const close = () => {
    try { document.removeEventListener("keydown", onKey, true); } catch (_) {}
    wrap.remove();
  };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
  document.addEventListener("keydown", onKey, true);
  wrap.querySelector(".runner-summary-close").onclick = close;
  const editBtn = wrap.querySelector(".runner-summary-edit");
  if (editBtn) {
    editBtn.onclick = () => {
      close();
      const real = document.getElementById("runner-edit-result-btn");
      if (real && !real.disabled) real.click();
    };
  }
  // [사용자 지시 2026-08-13] 완료 카드에서 바로 받을 수 있게 — 로직은 기존 것을 그대로 쓴다.
  //   전체: 실행기의 '전체 파일 다운로드' 버튼을 그대로 누른다(zip 생성·이름 규칙·토스트까지 동일).
  //   개별: 결과 파일마다 백엔드가 이미 downloadUrl 을 실어 준다(/api/workbooks/download/<id>).
  const dlAllBtn = wrap.querySelector(".runner-summary-dlall");
  if (dlAllBtn) {
    dlAllBtn.onclick = () => {
      const real = document.getElementById("runner-download-btn");
      if (!real || real.disabled) {
        if (typeof toast === "function") toast("내려받을 결과 파일이 없습니다.", "error");
        return;
      }
      real.click();   // 카드는 닫지 않는다 — zip 생성이 끝날 때까지 사용자가 여기 머문다
    };
  }
  wrap.querySelectorAll(".runner-summary-dl1").forEach(btn => {
    btn.onclick = () => {
      const out = outs[Number(btn.dataset.idx)];
      const url = out && (out.downloadUrl || (out.downloadId ? "/api/workbooks/download/" + out.downloadId : ""));
      if (!url) { if (typeof toast === "function") toast("이 파일은 내려받을 수 없습니다.", "error"); return; }
      // [문서보안 0.7.5] 보안 재적용 안내/실패 처리가 있는 공용 다운로드 경로로 보낸다.
      if (typeof secureDownloadUrl === "function") { secureDownloadUrl(url, out.name || ""); return; }
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = out.name || "";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        if (typeof toast === "function") toast("다운로드 오류: " + (err && err.message ? err.message : err), "error");
      }
    };
  });
  try { wrap.querySelector(".runner-summary-close").focus(); } catch (_) {}
};

window.runnerSetDone = function() {
  const node = document.getElementById("runner-result-node");
  const sub = document.getElementById("runner-center-sub");
  const statState = document.getElementById("runner-stat-state");
  const badge = document.getElementById("runner-hero-badge");
  if (!node) return;
  node.classList.remove("running");
  node.classList.add("done");
  if (sub) sub.textContent = "완료";
  if (statState) statState.textContent = "완료";
  if (badge) {
    badge.classList.remove("ready", "running");
    badge.classList.add("done");
    badge.textContent = "완료";
  }
  // [#2] 실행 완료 + 결과(outputFiles) 있으면 '결과 편집하기' 활성화.
  { const _eb = document.getElementById("runner-edit-result-btn"); if (_eb) _eb.disabled = !(Array.isArray(window.lastRunnerOutputs) && window.lastRunnerOutputs.length); }
  setTimeout(() => {
    node.classList.remove("done");
    if (sub) sub.textContent = "실행 준비";
    if (typeof renderRunnerWorkflow === "function") renderRunnerWorkflow();
  }, 2500);
};

function showTopTabSwitchHint() {
  if (typeof toast === "function") {
    toast("파일 전환은 상단 파일 탭을 더블클릭해서 해주세요.", "success");
  }
}

function openWorkbookFileFromList(fileId) {
  return switchWorkbookFileFromUserTab(fileId);
}

function downloadWorkbookFileFromList(fileId) {
  if (typeof downloadCurrentWorkbookFile === "function") {
    downloadCurrentWorkbookFile(fileId);
    return;
  }
  toast("다운로드 기능을 초기화하지 못했습니다.", "error");
}

function notifyNativeWorkbookTabs() {
  if (typeof publishNativeFileTabs === "function") {
    publishNativeFileTabs();
    return;
  }
  if (typeof updateMirrorShellStatus === "function") updateMirrorShellStatus();
}

renderInputList = function() {
  const list = $("input-list");
  if (!list) return;
  list.innerHTML = "";
  const count = $("input-count");
  if (count) count.textContent = state.inputs.length + "개";
  state.inputs.forEach((f, idx) => {
    const name = workbookDisplayName(f, `입력 파일 ${idx + 1}`);
    const div = document.createElement("div");
    div.className = "file-chip" + (state.currentFileId === "input:" + name ? " active" : "");
    const kb = (f.size / 1024).toFixed(1);
    const totalRows = getTotalWorkbookRows(f).toLocaleString("ko-KR");
    div.innerHTML = `
      <div class="chip-icon">XLSX</div>
      <div class="chip-body">
        <div class="chip-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
        <div class="chip-meta">${kb} KB · 시트 ${f.sheetNames.length}개 · 전체 ${totalRows}행</div>
      </div>
      <button class="chip-view" data-idx="${idx}" type="button">보기</button>
      <button class="chip-download" data-idx="${idx}" type="button" title="현재 상태 다운로드">다운로드</button>
      <button class="chip-remove" data-idx="${idx}" title="삭제">×</button>
    `;
    list.appendChild(div);
  });
  list.querySelectorAll(".chip-view").forEach(btn => {
    btn.onclick = () => showTopTabSwitchHint();
  });
  list.querySelectorAll(".chip-download").forEach(btn => {
    btn.onclick = () => downloadWorkbookFileFromList("input:" + workbookDisplayName(state.inputs[btn.dataset.idx], `입력 파일 ${Number(btn.dataset.idx) + 1}`));
  });
  list.querySelectorAll(".chip-remove").forEach(btn => {
    btn.onclick = () => removeInputFileAt(Number(btn.dataset.idx));
  });
  renderRunnerWorkflow();
  notifyNativeWorkbookTabs();
};

renderOutputChip = function() {
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
    const name = workbookDisplayName(f, `출력 파일 ${idx + 1}`);
    const kb = (f.size / 1024).toFixed(1);
    const totalRows = getTotalWorkbookRows(f).toLocaleString("ko-KR");
    const div = document.createElement("div");
    div.className = "file-chip output" + (state.currentFileId === "output:" + idx ? " active" : "");
    div.innerHTML = `
      <div class="chip-icon">XLSX</div>
      <div class="chip-body">
        <div class="chip-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
        <div class="chip-meta">${kb} KB · 시트 ${f.sheetNames.length}개 · 전체 ${totalRows}행</div>
      </div>
      <button class="chip-view" data-idx="${idx}" type="button">보기</button>
      <button class="chip-download" data-idx="${idx}" type="button" title="현재 상태 다운로드">다운로드</button>
      <button class="chip-remove" data-idx="${idx}" title="삭제">×</button>
    `;
    el.appendChild(div);
  });
  el.querySelectorAll(".chip-view").forEach(btn => {
    btn.onclick = () => showTopTabSwitchHint();
  });
  el.querySelectorAll(".chip-download").forEach(btn => {
    btn.onclick = () => downloadWorkbookFileFromList("output:" + btn.dataset.idx);
  });
  el.querySelectorAll(".chip-remove").forEach(btn => {
    btn.onclick = () => removeOutputTemplateAt(Number(btn.dataset.idx));
  });
  renderRunnerWorkflow();
  notifyNativeWorkbookTabs();
};

openRunnerFileEditor = function(role) {
  const isOutput = role === "output";
  const files = isOutput ? state.outputTemplates.map(t => t.file) : state.inputs;
  const modal = $("modal");
  if (!modal) return;
  const title = isOutput ? "출력 파일" : "입력 파일";
  const emptyText = isOutput ? "업로드된 출력 파일이 없습니다." : "업로드된 입력 파일이 없습니다.";
  modal.innerHTML = `
    <h3>${title}</h3>
    <p style="font-size:12px; color:#666; margin-bottom:10px">보기는 이미 열린 Excel 미러로 전환하고, 다운로드는 현재까지 저장된 상태를 받습니다.</p>
    <div class="runner-file-editor-list">
      ${files.length ? files.map((f, idx) => {
        const name = workbookDisplayName(f, `${isOutput ? "출력" : "입력"} 파일 ${idx + 1}`);
        const kb = (f.size / 1024).toFixed(1);
        const totalRows = getTotalWorkbookRows(f).toLocaleString("ko-KR");
        return `
          <div class="file-chip ${isOutput ? "output" : ""}">
            <div class="chip-icon">XLSX</div>
            <div class="chip-body">
              <div class="chip-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
              <div class="chip-meta">${kb} KB · 시트 ${f.sheetNames.length}개 · 전체 ${totalRows}행</div>
            </div>
            <button class="chip-view" data-idx="${idx}" type="button">보기</button>
            <button class="chip-download" data-idx="${idx}" type="button" title="현재 상태 다운로드">다운로드</button>
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
      showTopTabSwitchHint();
      $("modal-bg").classList.remove("show");
    };
  });
  modal.querySelectorAll(".chip-download").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      downloadWorkbookFileFromList(isOutput ? "output:" + idx : "input:" + workbookDisplayName(state.inputs[idx], `입력 파일 ${idx + 1}`));
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
};
