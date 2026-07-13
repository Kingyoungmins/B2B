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
    if (/\b(?:from|to|into|copy|create|created|sheet|file|workbook|output|input|target|source)\b/i.test(prefix)) {
      clean = lastToken[1];
    }
  }
  return clean;
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

  const pyVars = new Map();
  const pyAssign = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*ctx\.book\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = pyAssign.exec(src))) pyVars.set(m[1], m[2]);
  pyVars.forEach((book, varName) => {
    const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let mm;
    const addRe = new RegExp(`\\b${esc}\\s*\\.\\s*(?:add_sheet|create_sheet|ensure_sheet)\\(\\s*["']([^"']+)["']`, "g");
    while ((mm = addRe.exec(src))) runnerAddGeneratedSheet(generated, book, mm[1]);
    const renameRe = new RegExp(`\\b${esc}\\s*\\.\\s*rename_sheet\\(\\s*["'][^"']+["']\\s*,\\s*["']([^"']+)["']`, "g");
    while ((mm = renameRe.exec(src))) runnerAddGeneratedSheet(generated, book, mm[1]);
  });

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
  const vbaAssignLine = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']([^"']+)["']\s*$/;  // 단독 대입문만
  for (const line of src.split(/\r?\n/)) {
    const av = vbaAssignLine.exec(line);
    if (av) vbaLiteralVars.set(String(av[1] || "").toLowerCase(), av[2]);
    if (vbaIsComparisonLine(line)) continue;  // 비교문은 생성 아님 → 스킵
    let mm;
    const litRe = /\.Name\s*=\s*["']([^"']+)["']/gi;
    while ((mm = litRe.exec(line))) runnerAddGeneratedSheet(generated, "", mm[1]);
    const varRe = /\.Name\s*=\s*([A-Za-z_][A-Za-z0-9_]*)/gi;
    while ((mm = varRe.exec(line))) {
      const val = vbaLiteralVars.get(String(mm[1] || "").toLowerCase());
      if (val) runnerAddGeneratedSheet(generated, "", val);
    }
  }

  return generated;
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

  const pyVars = new Map();
  const pyAssign = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*ctx\.book\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = pyAssign.exec(src))) pyVars.set(m[1], m[2]);
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
  const pyDirect = /ctx\.book\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:read|write|write_cell|copy|sort|clear|find_header|last_row|last_col)\(\s*["']([^"']+)["']/gi;
  while ((m = pyDirect.exec(src))) add(m[1], m[2]);
  const pyVars = new Map();
  const pyAssign = /\b([A-Za-z_]\w*)\s*=\s*ctx\.book\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = pyAssign.exec(src))) pyVars.set(m[1], m[2]);
  pyVars.forEach((book, varName) => {
    const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${esc}\\s*\\.\\s*(?:read|write|write_cell|copy|sort|clear|find_header|last_row|last_col)\\(\\s*["']([^"']+)["']`, "g");
    let mm;
    while ((mm = re.exec(src))) add(book, mm[1]);
  });
  return pairs;
}

function runnerExtractMappingRequirements() {
  const map = new Map();
  const steps = state.pipeline || [];
  const generatedSheets = [];
  for (const step of steps) {
    if (!step || !step.code) continue;
    const text = [step.prompt, step.description, step.code].filter(Boolean).join("\n");
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
    if (exact) return { item: exact, score: 100 };
  }
  if (req.sheet) {
    const bySheet = files.filter(item => runnerMappingSheetNames(item.file).some(s => runnerMappingNorm(s) === runnerMappingNorm(req.sheet)));
    if (bySheet.length === 1 && !req.book) return { item: bySheet[0], score: 86 };
  }
  const scored = files
    .map(item => ({ item, score: runnerMappingScoreFile(req.book, item) }))
    .sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score >= 45 ? scored[0] : null;
}

function runnerFindSheet(req, file, preferredSheet) {
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
  return sheets.length === 1 ? sheets[0] : "";
}

function runnerCurrentMappingSignature() {
  const files = runnerMappingKnownFiles().map(item => [
    item.id,
    item.name,
    ...runnerMappingSheetNames(item.file),
  ].join("|"));
  const steps = (state.pipeline || []).map(s => [s && s.id, s && s.targetFileId, s && s.targetSheetName, s && s.code].join("|"));
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
  return reqs.map(req => {
    const stored = state.runnerMappings && state.runnerMappings[req.key];
    let fileItem = stored && files.find(item => item.id === stored.fileId);
    let score = stored && fileItem ? 100 : 0;
    if (!fileItem) {
      const auto = runnerFindAutoFile(req, files);
      fileItem = auto && auto.item;
      score = auto && auto.score || 0;
    }
    const sheet = fileItem ? runnerFindSheet(req, fileItem.file, stored && stored.sheet) : "";
    let status = "bad";
    let statusText = "선택 필요";
    if (fileItem && (!req.sheet || sheet)) {
      const sheetExact = !req.sheet || sheet === req.sheet || runnerMappingNorm(sheet) === runnerMappingNorm(req.sheet);
      if ((score >= 95 || !req.book) && sheetExact) {
        status = "ok";
        statusText = "자동 확인";
      } else {
        status = "warn";
        statusText = "확인 필요";
      }
    }
    return { req, files, fileItem, sheet, score, status, statusText, userSet: !!(stored && stored.userSet) };
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
    const unresolved = sheetMembers.filter(m => !m.sheet);
    if (unresolved.length) { g.status = "warn"; g.statusText = "시트 확인"; return; }
    // 파일+시트 모두 해결됨 → 초록(ok). 어떻게 해결됐는지에 따라 라벨만 구분.
    if (g.userSet) { g.status = "ok"; g.statusText = "사용자 확인 완료"; }                      // 사람이 직접 지정
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
    const sheetMembers = g.members.filter(m => m.req.sheet);
    // 왼쪽: 스킬이 찾는 시트들을 '요청 시트명 그대로' 칩으로만 표시.
    const sheetChips = sheetMembers.length
      ? sheetMembers.map(m =>
          `<span class="runner-mapping-sheet-chip" title="${escapeHtml(m.req.sheet)}">${escapeHtml(runnerChipLabel(m.req.sheet))}</span>`
        ).join("")
      : `<span class="runner-mapping-sheet-chip">시트 자동</span>`;
    // 오른쪽: 각 시트마다 [요청 시트 칩] ↔ [실제 파일의 시트 드롭다운]. 자동 해결된 시트는 드롭다운이 미리 선택됨.
    const sheetMaps = sheetMembers.map(m => {
      const opts = [`<option value="">시트 선택</option>`].concat(sheetsInFile.map(s =>
        `<option value="${escapeHtml(s)}" ${runnerMappingNorm(m.sheet) === runnerMappingNorm(s) ? "selected" : ""}>${escapeHtml(s)}</option>`
      )).join("");
      const chipCls = m.sheet ? "ok" : "warn";
      // data-key 에 req.key(널 문자   구분자 포함)를 넣으면 HTML 속성에서 널이 U+FFFD 로 바뀌어
      // 핸들러의 키가 실제 키와 안 맞았다 → 선택이 저장돼도 반영 안 됨(클릭은 되는데 선택 안 되는 증상).
      // 멤버 인덱스(data-mi)로만 넘기고, 실제 키는 핸들러에서 g.members[mi].req.key 로 직접 얻는다.
      return `<div class="runner-mapping-sheet-map">
            <span class="runner-mapping-sheet-chip ${chipCls}" title="${escapeHtml(m.req.sheet)}">${escapeHtml(runnerChipLabel(m.req.sheet))}</span>
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
        const sheet = fileItem ? runnerFindSheet(m.req, fileItem.file, "") : "";
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

window.runnerShowMappingPanel = function() {
  runnerResetMappingIfSourceChanged();
  state.runnerMappingChecked = true;
  runnerRenderMappingPanel();
  renderRunnerWorkflow();
};

function runnerReplaceLiteral(text, from, to) {
  const src = String(text || "");
  const a = String(from || "");
  const b = String(to || "");
  if (!a || !b || a === b) return src;
  const esc = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return src.replace(new RegExp(`(["'])${esc}\\1`, "g"), (_, quote) => `${quote}${b}${quote}`);
}

window.buildRunnerMappedPipeline = function(steps) {
  if (!state.runnerMappingChecked) return steps || state.pipeline;
  // [뻑남 수정] 예전엔 '시트까지 해결된 행'만 남겨서, 시트가 안 잡히면 그 행을 통째로 버려 파일명조차
  // 치환 안 됐다 → 코드에 옛 파일명(expected_output.xlsx)이 남아 "워크북이 열려 있지 않습니다"로 실패.
  // 이제 '파일이 매핑된 행'은 모두 남겨 파일명을 반드시 치환하고(시트는 해결됐을 때만 치환) 파일 누락 실패를 막는다.
  const rows = runnerBuildMappingRows().filter(row => row.fileItem);
  if (!rows.length) return steps || state.pipeline;
  return (steps || state.pipeline || []).map(step => {
    if (!step || !step.code) return step;
    let code = String(step.code || "");
    let targetFileId = step.targetFileId || null;
    let targetSheetName = step.targetSheetName || null;
    const stepText = [step.prompt, step.description, step.code, step.targetFileId, step.targetSheetName].filter(Boolean).join("\n");
    rows.forEach(row => {
      const actualName = row.fileItem ? row.fileItem.name : "";
      if (row.req.book && actualName) code = runnerReplaceLiteral(code, row.req.book, actualName);
      if (row.req.sheet && row.sheet) code = runnerReplaceLiteral(code, row.req.sheet, row.sheet);
      const touchesBook = row.req.book && stepText.includes(row.req.book);
      const touchesSheet = row.req.sheet && stepText.includes(row.req.sheet);
      if (touchesBook || (!row.req.book && touchesSheet)) {
        targetFileId = row.fileItem.id;
        if (row.sheet) targetSheetName = row.sheet;
      }
    });
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
  setNodeStatus(logicNode, state.pipeline.length > 0, "스킬 수정", () => {
    if (typeof setPage === "function") setPage("generator");
  });

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
