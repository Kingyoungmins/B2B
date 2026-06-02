/* ===================================================================
   EXCEL MIRROR (ver4.1)
   The real Microsoft Excel window is shown as a read-only mirror surface.
   The web app tracks selections, while pipeline writes are applied through
   Excel COM so the visible workbook changes immediately.
   =================================================================== */
const excelMirror = {
  sessionsByFileId: {},
  sessionLastUsedByFileId: {},
  activeExcelId: null,
  pollTimer: null,
  formulaInfoTimer: null,
  polling: false,
  formulaPolling: false,
  mutedUntil: 0,
  selectionMutedUntil: 0,
  lastSelectionByExcelId: {},
  pendingChatRange: null,
  selectionChatTimer: null,
  zOrderTimers: [],
  lastRaiseAt: 0,
  positionTimer: null,
  switchTimer: null,
  restoreTimer: null,
  lastPositionKey: "",
  lastNativePositionKey: "",
  positionListenersInstalled: false,
};
const EXCEL_MIRROR_MAX_CACHED_SESSIONS = 4;
const EXCEL_MIRROR_MAX_ROWS = 1048576;
const EXCEL_MIRROR_MAX_COLS = 16384;

function setupExcelMirrorControls() {
  installMirrorRenderOverride();
  installExcelMirrorPositionListeners();
  replaceSimulatorWithMirrorShell();
  updateMirrorShellStatus();
}
function installMirrorRenderOverride() {
  if (window.__excelMirrorRenderInstalled || typeof renderExcelViewer !== "function") return;
  window.__excelMirrorRenderInstalled = true;
  const original = renderExcelViewer;
  window.renderSimulatorExcelViewer = original;
  renderExcelViewer = function() {
    refreshTabs();
    replaceSimulatorWithMirrorShell();
    updateMirrorShellStatus();
  };
}

function replaceSimulatorWithMirrorShell() {
  ["excel-viewer", "runner-excel-viewer"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.mirrorShell === "1") return;
    el.dataset.mirrorShell = "1";
    el.classList.add("excel-mirror-shell");
    el.innerHTML = `
      <div class="mirror-card">
        <div class="mirror-title">Excel 읽기 전용 미러</div>
        <div class="mirror-status" data-role="status">파일 목록의 보기 버튼을 누르면 실제 Excel 창이 이 영역에 맞춰집니다.</div>
        <div class="mirror-note">셀/범위 선택은 채팅에 남고, 직접 편집은 막힙니다.</div>
      </div>
    `;
  });
  updateMirrorShellStatus();
}
function updateMirrorShellStatus(text) {
  const target = currentExcelMirrorTarget();
  const excelId = currentExcelId();
  const msg = text || (target
    ? (excelId ? `연결됨: ${target.file.name}` : `대기 중: ${target.file.name}`)
    : "파일을 선택한 뒤 보기 버튼을 누르세요.");
  document.querySelectorAll(".excel-mirror-shell [data-role='status']").forEach(el => {
    el.textContent = msg;
  });
  document.querySelectorAll(".excel-control-status[data-role='status']").forEach(el => {
    el.textContent = msg;
  });
  publishNativeFileTabs();
}

function publishNativeFileTabs() {
  const bridge = window.chrome && window.chrome.webview;
  if (!bridge || typeof bridge.postMessage !== "function") return;
  const files = [
    ...state.inputs.map(f => ({ id: "input:" + f.name, role: "input", name: f.name })),
    ...(state.outputTemplates || []).map((tpl, idx) => ({
      id: typeof outputTemplateFileId === "function" ? outputTemplateFileId(idx) : "output:" + idx,
      role: "output",
      name: tpl.file.name,
    })),
  ];
  const enc = value => encodeURIComponent(String(value || ""));
  const payload = [
    "B2B_FILE_TABS",
    enc(state.currentFileId || ""),
    ...files.map(file => [enc(file.id), enc(file.role), enc(file.name)].join("|")),
  ].join("\t");
  if (publishNativeFileTabs.lastPayload === payload) return;
  publishNativeFileTabs.lastPayload = payload;
  bridge.postMessage(payload);
}

function currentExcelMirrorTarget() {
  const fileId = state.currentFileId;
  const file = fileId ? getFile(fileId) : null;
  if (!file) return null;
  return { fileId, file };
}

function extractResultIdFromDownloadUrl(url) {
  const text = String(url || "").split("?")[0].replace(/\/+$/, "");
  return text ? text.split("/").pop() : "";
}

function isBackendResultDownloadUrl(url) {
  return /\/api\/workbooks\/download\//.test(String(url || ""));
}

function suppressExcelMirrorSelection(ms = 2500) {
  excelMirror.selectionMutedUntil = Math.max(excelMirror.selectionMutedUntil || 0, Date.now() + ms);
}

function excelSelectionKey(sheet, address) {
  const cleanAddress = String(address || "").replace(/\$/g, "").split(",")[0].trim();
  if (!sheet || !cleanAddress) return "";
  return `${sheet}!${cleanAddress}`;
}

function shouldAppendExcelSelectionFromPoll(excelId, sheet, address, options = {}) {
  const key = excelSelectionKey(sheet, address);
  if (!excelId || !key) return false;
  const previous = excelMirror.lastSelectionByExcelId[excelId] || "";
  if (options.baselineOnly) {
    excelMirror.lastSelectionByExcelId[excelId] = key;
    return false;
  }
  if (Date.now() < (excelMirror.selectionMutedUntil || 0)) return false;
  excelMirror.lastSelectionByExcelId[excelId] = key;
  if (previous === key) return false;
  return true;
}

async function openCurrentWorkbookInExcel() {
  const target = currentExcelMirrorTarget();
  if (!target) {
    toast("Excel로 열 파일을 먼저 선택하세요.", "error");
    return;
  }
  try {
    await hideInactiveExcelMirrorSessions(target.fileId);
    const existingExcelId = excelMirror.sessionsByFileId[target.fileId];
    if (existingExcelId) {
      excelMirror.activeExcelId = existingExcelId;
      excelMirror.sessionLastUsedByFileId[target.fileId] = Date.now();
      try {
        await positionExcelMirrorWindow(existingExcelId, { force: true });
        stabilizeExcelMirrorZOrder(existingExcelId);
        await pollExcelMirrorChanges(existingExcelId, { baselineOnly: true });
        updateMirrorShellStatus(`Excel 연결됨: ${target.file.name}`);
        startExcelMirrorPolling();
        return;
      } catch (err) {
        if (!isMissingExcelSessionError(err)) throw err;
        forgetExcelMirrorSession(existingExcelId);
      }
    }
    const mirrorRect = excelMirrorScreenRect() || {};
    let data;
    if (target.file.backendDownloadUrl && isBackendResultDownloadUrl(target.file.backendDownloadUrl)) {
      const resultId = extractResultIdFromDownloadUrl(target.file.backendDownloadUrl);
      data = await postExcelMirror("/api/excel/open-result", { resultId, readOnlyMirror: true, ...mirrorRect });
    } else {
      if (!target.file.backendWorkbookId) throw new Error("백엔드 workbookId가 없습니다.");
      data = await postExcelMirror("/api/excel/open", { workbookId: target.file.backendWorkbookId, readOnlyMirror: true, ...mirrorRect });
    }
    excelMirror.sessionsByFileId[target.fileId] = data.excelId;
    excelMirror.sessionLastUsedByFileId[target.fileId] = Date.now();
    excelMirror.activeExcelId = data.excelId;
    suppressExcelMirrorSelection(1000);
    updateMirrorShellStatus(`Excel 연결됨: ${target.file.name}`);
    toast("실제 Excel 창을 열었습니다.", "success");
    await positionExcelMirrorWindow(data.excelId, { force: true });
    stabilizeExcelMirrorZOrder(data.excelId);
    await pollExcelMirrorChanges(data.excelId, { baselineOnly: true });
    startExcelMirrorPolling();
    await trimExcelMirrorSessionCache(target.fileId);
  } catch (err) {
    toast("Excel 열기 실패: " + err.message, "error");
    console.error(err);
  }
}

async function openExcelMirrorForFileId(fileId) {
  if (fileId && typeof setCurrentView === "function") {
    setCurrentView(fileId);
  }
  await openCurrentWorkbookInExcel();
}

async function switchVisibleExcelMirrorToFileId(fileId) {
  if (!fileId) return false;
  const excelId = excelMirror.sessionsByFileId[fileId];
  if (!excelId) {
    updateMirrorShellStatus();
    return false;
  }
  excelMirror.activeExcelId = excelId;
  excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
  await hideInactiveExcelMirrorSessions(fileId);
  await positionExcelMirrorWindow(excelId, { force: true });
  stabilizeExcelMirrorZOrder(excelId);
  await pollExcelMirrorChanges(excelId, { baselineOnly: true });
  startExcelMirrorPolling();
  updateMirrorShellStatus();
  return true;
}

async function openExcelMirrorResultForFileId(fileId, downloadUrl) {
  const resultId = extractResultIdFromDownloadUrl(downloadUrl);
  if (!fileId || !resultId) return false;
  if (typeof setCurrentView === "function") setCurrentView(fileId);
  await hideInactiveExcelMirrorSessions(fileId);
  const data = await postExcelMirror("/api/excel/open-result", { resultId, readOnlyMirror: true, ...(excelMirrorScreenRect() || {}) });
  excelMirror.sessionsByFileId[fileId] = data.excelId;
  excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
  excelMirror.activeExcelId = data.excelId;
  updateMirrorShellStatus(`Excel 결과 열림: ${data.name || ""}`);
  excelMirror.mutedUntil = Date.now() + 1000;
  suppressExcelMirrorSelection(3000);
  await positionExcelMirrorWindow(data.excelId, { force: true });
  stabilizeExcelMirrorZOrder(data.excelId);
  await pollExcelMirrorChanges(data.excelId, { baselineOnly: true });
  startExcelMirrorPolling();
  await trimExcelMirrorSessionCache(fileId);
  return true;
}

async function refreshExcelMirrorForFileId(fileId, downloadUrl, options = {}) {
  const resultId = extractResultIdFromDownloadUrl(downloadUrl);
  if (!fileId || !resultId) return false;
  const existingExcelId = excelMirror.sessionsByFileId[fileId];
  if (existingExcelId) {
    try {
      const data = await postExcelMirror("/api/excel/replace", {
        excelId: existingExcelId,
        resultId,
        readOnlyMirror: true,
      });
      excelMirror.sessionsByFileId[fileId] = data.excelId;
      excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
      excelMirror.activeExcelId = data.excelId;
      updateMirrorShellStatus(`Excel 창이 최신 결과로 갱신됨: ${data.name || ""}`);
      excelMirror.mutedUntil = Date.now() + 1000;
      suppressExcelMirrorSelection(3000);
      await positionExcelMirrorWindow(data.excelId, { force: true });
      stabilizeExcelMirrorZOrder(data.excelId);
      await pollExcelMirrorChanges(data.excelId, { baselineOnly: true });
      startExcelMirrorPolling();
      return true;
    } catch (err) {
      if (!isMissingExcelSessionError(err)) throw err;
      forgetExcelMirrorSession(existingExcelId);
    }
  }
  if (options.openIfMissing) {
    return openExcelMirrorResultForFileId(fileId, downloadUrl);
  }
  return false;
}

function excelMirrorSessionIdForFileId(fileId) {
  return fileId ? (excelMirror.sessionsByFileId[fileId] || null) : null;
}

async function ensureExcelMirrorForFileId(fileId) {
  if (!fileId) return null;
  let excelId = excelMirrorSessionIdForFileId(fileId);
  if (excelId) return excelId;
  await openExcelMirrorForFileId(fileId);
  return excelMirrorSessionIdForFileId(fileId);
}

async function acknowledgeExcelMirrorApplied(fileId) {
  const excelId = excelMirrorSessionIdForFileId(fileId);
  if (!excelId) return false;
  excelMirror.activeExcelId = excelId;
  excelMirror.mutedUntil = Date.now() + 10000;
  suppressExcelMirrorSelection(10000);
  await positionExcelMirrorWindow(excelId, { force: true });
  await baselineExcelMirrorSession(excelId);
  updateMirrorShellStatus("열려 있는 Excel 창에 적용되었습니다.");
  startExcelMirrorPolling();
  return true;
}

async function baselineExcelMirrorSession(excelId, attempts = 8) {
  if (!excelId) return null;
  for (let i = 0; i < attempts; i++) {
    if (!excelMirror.polling) {
      return await pollExcelMirrorChanges(excelId, { baselineOnly: true });
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return null;
}

function currentExcelId() {
  const target = currentExcelMirrorTarget();
  if (target) return excelMirror.sessionsByFileId[target.fileId] || null;
  return excelMirror.activeExcelId;
}

function forgetExcelMirrorSession(excelId) {
  if (!excelId) return;
  Object.keys(excelMirror.sessionsByFileId).forEach(fileId => {
    if (excelMirror.sessionsByFileId[fileId] === excelId) {
      delete excelMirror.sessionsByFileId[fileId];
      delete excelMirror.sessionLastUsedByFileId[fileId];
    }
  });
  if (excelMirror.activeExcelId === excelId) excelMirror.activeExcelId = null;
  if (!Object.keys(excelMirror.sessionsByFileId).length) stopExcelMirrorPolling();
  updateMirrorShellStatus();
}

async function closeExcelMirrorForFileId(fileId) {
  if (!fileId || typeof excelMirror === "undefined") return false;
  const excelId = excelMirror.sessionsByFileId[fileId];
  if (!excelId) return false;
  delete excelMirror.sessionsByFileId[fileId];
  delete excelMirror.sessionLastUsedByFileId[fileId];
  delete excelMirror.lastSelectionByExcelId[excelId];
  if (excelMirror.activeExcelId === excelId) excelMirror.activeExcelId = null;
  if (!Object.keys(excelMirror.sessionsByFileId).length) stopExcelMirrorPolling();
  updateMirrorShellStatus();
  try {
    await postExcelMirror("/api/excel/close", { excelId });
  } catch (err) {
    if (!isMissingExcelSessionError(err)) console.warn("Failed to close removed Excel mirror:", err);
  }
  return true;
}

async function hideInactiveExcelMirrorSessions(activeFileId) {
  const entries = Object.entries(excelMirror.sessionsByFileId);
  await Promise.all(entries.map(async ([fileId, excelId]) => {
    if (!excelId || fileId === activeFileId) return;
    try {
      await postExcelMirror("/api/excel/hide", { excelId });
    } catch (err) {
      console.warn("Failed to hide inactive Excel mirror:", err);
    }
  }));
}

async function hideAllExcelMirrorWindows() {
  const entries = Object.entries(excelMirror.sessionsByFileId);
  await Promise.all(entries.map(async ([fileId, excelId]) => {
    if (!excelId) return;
    try {
      await postExcelMirror("/api/excel/hide", { excelId });
    } catch (err) {
      if (!isMissingExcelSessionError(err)) console.warn("Failed to hide Excel mirror:", err);
    }
  }));
}

async function restoreActiveExcelMirrorWindow() {
  const excelId = currentExcelId() || excelMirror.activeExcelId;
  if (!excelId) return false;
  await positionExcelMirrorWindow(excelId, { force: true });
  await raiseExcelMirrorWindow(excelId);
  return true;
}

function scheduleRestoreActiveExcelMirror(delay = 120) {
  clearTimeout(excelMirror.restoreTimer);
  excelMirror.restoreTimer = setTimeout(() => {
    restoreActiveExcelMirrorWindow().catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror restore failed:", err);
    });
  }, delay);
}

async function trimExcelMirrorSessionCache(activeFileId) {
  const entries = Object.entries(excelMirror.sessionsByFileId);
  if (entries.length <= EXCEL_MIRROR_MAX_CACHED_SESSIONS) return;
  const victims = entries
    .filter(([fileId]) => fileId !== activeFileId)
    .sort(([a], [b]) => (excelMirror.sessionLastUsedByFileId[a] || 0) - (excelMirror.sessionLastUsedByFileId[b] || 0))
    .slice(0, Math.max(0, entries.length - EXCEL_MIRROR_MAX_CACHED_SESSIONS));
  await Promise.all(victims.map(async ([fileId, excelId]) => {
    try {
      await postExcelMirror("/api/excel/close", { excelId });
    } catch (err) {
      console.warn("Failed to trim cached Excel mirror:", err);
    }
    if (excelMirror.sessionsByFileId[fileId] === excelId) delete excelMirror.sessionsByFileId[fileId];
    delete excelMirror.sessionLastUsedByFileId[fileId];
    if (excelMirror.activeExcelId === excelId) excelMirror.activeExcelId = null;
  }));
  if (!Object.keys(excelMirror.sessionsByFileId).length) stopExcelMirrorPolling();
}

function isMissingExcelSessionError(err) {
  return /excel session (not found|is no longer open)/i.test(String(err && err.message || err || ""));
}

function currentExcelAddress() {
  const range = state.selectedRange;
  if (range && range.sheet === state.currentSheet) {
    return excelAddressForRange(range);
  }
  const cell = state.selectedCell;
  if (cell && cell.sheet === state.currentSheet) {
    return `${excelCol(cell.c)}${cell.r + 1}`;
  }
  return "";
}

function excelAddressForRange(range) {
  if (!range) return "";
  if (range.address) return String(range.address).replace(/\$/g, "").split(",")[0].trim();
  if (range.type === "col") {
    return `${excelCol(range.c1)}:${excelCol(range.c2)}`;
  }
  if (range.type === "row") {
    return `${range.r1 + 1}:${range.r2 + 1}`;
  }
  const a = `${excelCol(range.c1)}${range.r1 + 1}`;
  const b = `${excelCol(range.c2)}${range.r2 + 1}`;
  return a === b ? a : `${a}:${b}`;
}

function excelCol(idx) {
  if (typeof _excelCol === "function") return _excelCol(idx);
  let n = Number(idx) + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || "A";
}

async function activateCurrentSelectionInExcel() {
  const excelId = currentExcelId();
  if (!excelId) {
    await openCurrentWorkbookInExcel();
    return;
  }
  suppressExcelMirrorSelection(3000);
  try {
    const data = await postExcelMirror("/api/excel/activate", {
      excelId,
      sheet: state.currentSheet || "",
      range: currentExcelAddress(),
    });
    excelMirror.activeExcelId = data.excelId;
    suppressExcelMirrorSelection(1000);
    await pollExcelMirrorChanges(data.excelId, { baselineOnly: true });
    updateMirrorShellStatus(`Excel 위치: ${data.sheet}${data.address ? "!" + data.address : ""}`);
  } catch (err) {
    updateMirrorShellStatus("Excel 위치 이동을 건너뛰었습니다. 미러 창에서 직접 선택하세요.");
    console.warn("Excel activate skipped:", err);
  }
}

async function saveCurrentExcelMirror() {
  const excelId = currentExcelId();
  if (!excelId) {
    toast("저장할 Excel 창이 없습니다.", "error");
    return;
  }
  try {
    const data = await postExcelMirror("/api/excel/save", { excelId });
    const target = currentExcelMirrorTarget();
    if (target && data.downloadUrl) target.file.backendDownloadUrl = data.downloadUrl;
    updateMirrorShellStatus("Excel 저장본이 다운로드 대상으로 등록되었습니다.");
    toast("Excel 저장본을 다운로드 대상으로 등록했습니다.", "success");
    if (typeof renderRunnerWorkflow === "function") renderRunnerWorkflow();
  } catch (err) {
    toast("Excel 저장 실패: " + err.message, "error");
    console.error(err);
  }
}

async function closeCurrentExcelMirror() {
  const excelId = currentExcelId();
  if (!excelId) return;
  try {
    await postExcelMirror("/api/excel/close", { excelId });
    Object.keys(excelMirror.sessionsByFileId).forEach(fileId => {
      if (excelMirror.sessionsByFileId[fileId] === excelId) {
        delete excelMirror.sessionsByFileId[fileId];
        delete excelMirror.sessionLastUsedByFileId[fileId];
      }
    });
    if (excelMirror.activeExcelId === excelId) excelMirror.activeExcelId = null;
    if (!Object.keys(excelMirror.sessionsByFileId).length) stopExcelMirrorPolling();
    updateMirrorShellStatus();
    toast("Excel 창을 닫았습니다.", "success");
  } catch (err) {
    toast("Excel 닫기 실패: " + err.message, "error");
    console.error(err);
  }
}

function startExcelMirrorPolling() {
  if (excelMirror.pollTimer) return;
  excelMirror.pollTimer = setInterval(() => {
    const excelId = currentExcelId();
    if (excelId) {
      pollExcelMirrorChanges(excelId).catch(err => console.warn("Excel mirror poll failed:", err));
    }
  }, isNativeExcelShell() ? 1800 : 1500);
  if (!excelMirror.formulaInfoTimer) {
    excelMirror.formulaInfoTimer = setInterval(() => {
      const excelId = currentExcelId();
      if (excelId) {
        pollExcelFormulaInfo(excelId).catch(err => console.warn("Excel formula info poll failed:", err));
      }
    }, 850);
  }
}

function stopExcelMirrorPolling() {
  if (excelMirror.pollTimer) {
    clearInterval(excelMirror.pollTimer);
    excelMirror.pollTimer = null;
  }
  if (excelMirror.formulaInfoTimer) {
    clearInterval(excelMirror.formulaInfoTimer);
    excelMirror.formulaInfoTimer = null;
  }
}

async function pollExcelFormulaInfo(excelId) {
  if (!excelId || excelMirror.formulaPolling) return;
  excelMirror.formulaPolling = true;
  try {
    const data = await postExcelMirror("/api/excel/hover-info", { excelId });
    if (data && data.hasFormula && data.formula) {
      const label = `${data.sheet || ""}${data.address ? "!" + data.address : ""}`;
      updateMirrorShellStatus(`${label}  ${data.formula}`);
    }
    return data;
  } finally {
    excelMirror.formulaPolling = false;
  }
}

async function pollExcelMirrorChanges(excelId, options = {}) {
  if (!excelId || excelMirror.polling) return;
  if (!options.baselineOnly && Date.now() < excelMirror.mutedUntil) return;
  excelMirror.polling = true;
  try {
    const data = await postExcelMirror("/api/excel/changes", { excelId });
    if (data.address) {
      const appendToChat = shouldAppendExcelSelectionFromPoll(excelId, data.sheet, data.address, options);
      syncSelectionFromExcel(data.sheet, data.address, { appendToChat });
    }
    if (!options.baselineOnly && Date.now() < excelMirror.mutedUntil) return data;
    if (!options.baselineOnly && Array.isArray(data.changes) && data.changes.length) {
      updateMirrorShellStatus("읽기 전용 미러입니다. 직접 편집은 파이프라인에 추가하지 않습니다.");
    }
    return data;
  } catch (err) {
    if (isMissingExcelSessionError(err)) forgetExcelMirrorSession(excelId);
    throw err;
  } finally {
    excelMirror.polling = false;
  }
}

function syncSelectionFromExcel(sheet, address, options = {}) {
  if (!sheet || !address) return;
  const previousSheet = state.currentSheet;
  state.currentSheet = sheet;
  const target = currentExcelMirrorTarget();
  const fileId = target ? target.fileId : state.currentFileId;
  const range = parseExcelSelectionAddress(address, fileId, sheet);
  if (range) {
    state.selectedRange = range;
    state.selectionAnchor = range;
    state.selectedRanges = [range];
    if (range.r1 === range.r2 && range.c1 === range.c2) {
      state.selectedCell = { fileId, sheet, r: range.r1, c: range.c1 };
    } else {
      state.selectedCell = null;
    }
    if (options.appendToChat && typeof updateChatRangeReference === "function") {
      queueExcelSelectionChatReference(range);
    }
  }
  if (previousSheet !== sheet) refreshTabs();
}

function queueExcelSelectionChatReference(range) {
  excelMirror.pendingChatRange = range;
  clearTimeout(excelMirror.selectionChatTimer);
  excelMirror.selectionChatTimer = setTimeout(() => {
    const pending = excelMirror.pendingChatRange;
    excelMirror.pendingChatRange = null;
    if (!pending || typeof updateChatRangeReference !== "function") return;
    updateChatRangeReference(pending, { preserveFocus: true });
  }, 700);
}

function parseExcelSelectionAddress(address, fileId, sheet) {
  const firstArea = String(address || "").replace(/\$/g, "").split(",")[0].trim();
  const noSheet = firstArea.includes("!") ? firstArea.split("!").pop() : firstArea;
  const parts = noSheet.split(":").map(part => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const startCol = parseExcelColumnAddress(parts[0]);
  const endCol = parseExcelColumnAddress(parts[1] || parts[0]);
  if (startCol !== null && endCol !== null) {
    const c1 = Math.min(startCol, endCol);
    const c2 = Math.max(startCol, endCol);
    return {
      fileId,
      sheet,
      r1: 0,
      c1,
      r2: EXCEL_MIRROR_MAX_ROWS - 1,
      c2,
      type: "col",
      address: `${excelCol(c1)}:${excelCol(c2)}`,
    };
  }
  const startRow = parseExcelRowAddress(parts[0]);
  const endRow = parseExcelRowAddress(parts[1] || parts[0]);
  if (startRow !== null && endRow !== null) {
    const r1 = Math.min(startRow, endRow);
    const r2 = Math.max(startRow, endRow);
    return {
      fileId,
      sheet,
      r1,
      c1: 0,
      r2,
      c2: EXCEL_MIRROR_MAX_COLS - 1,
      type: "row",
      address: `${r1 + 1}:${r2 + 1}`,
    };
  }
  const start = parseExcelCellAddress(parts[0]);
  const end = parseExcelCellAddress(parts[1] || parts[0]);
  if (!start || !end) return null;
  const r1 = Math.min(start.r, end.r);
  const c1 = Math.min(start.c, end.c);
  const r2 = Math.max(start.r, end.r);
  const c2 = Math.max(start.c, end.c);
  const type = start.r === end.r && start.c === end.c ? "cell" : "range";
  return {
    fileId,
    sheet,
    r1,
    c1,
    r2,
    c2,
    type,
    address: excelAddressForRange({ r1, c1, r2, c2, type }),
  };
}

function parseExcelCellAddress(address) {
  const m = String(address || "").trim().match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return { c: colNameToIndex(m[1]), r: Number(m[2]) - 1 };
}

function parseExcelColumnAddress(address) {
  const m = String(address || "").trim().match(/^([A-Z]+)$/i);
  return m ? colNameToIndex(m[1]) : null;
}

function parseExcelRowAddress(address) {
  const m = String(address || "").trim().match(/^(\d+)$/);
  return m ? Math.max(0, Number(m[1]) - 1) : null;
}

function colNameToIndex(name) {
  let n = 0;
  for (const ch of String(name || "").toUpperCase()) {
    n = n * 26 + ch.charCodeAt(0) - 64;
  }
  return Math.max(0, n - 1);
}

function excelMirrorHostElement() {
  return document.querySelector(".right-page.active .excel-native-mirror") ||
    document.querySelector(".right-page.active .excel-mirror-shell") ||
    $("excel-viewer") ||
    $("runner-excel-viewer");
}

function isNativeExcelShell() {
  const nativeShell = window.__B2B_NATIVE_SHELL;
  return !!(nativeShell && nativeShell.enabled && nativeShell.excelParentHwnd);
}

function isNativeExcelOverlayShell() {
  const nativeShell = window.__B2B_NATIVE_SHELL;
  return !!(nativeShell && nativeShell.enabled && nativeShell.excelParentHwnd && nativeShell.excelOverlay !== false);
}

function excelMirrorScreenRect() {
  const nativeShell = window.__B2B_NATIVE_SHELL;
  if (nativeShell && nativeShell.enabled && nativeShell.excelParentHwnd) {
    const left = Number.isFinite(Number(nativeShell.excelLeft)) ? Number(nativeShell.excelLeft) : 0;
    const top = Number.isFinite(Number(nativeShell.excelTop)) ? Number(nativeShell.excelTop) : 0;
    const width = Math.max(320, Number(nativeShell.excelWidth || 0));
    const height = Math.max(240, Number(nativeShell.excelHeight || 0));
    return {
      left: Math.round(left),
      top: Math.round(top),
      width,
      height,
      nativeParentHwnd: nativeShell.excelOverlay ? "" : String(nativeShell.excelParentHwnd),
      nativeHostHwnd: String(nativeShell.nativeHostHwnd || ""),
      nativeOverlay: nativeShell.excelOverlay !== false,
      nativeShell: true,
    };
  }
  const el = excelMirrorHostElement();
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 120) return null;
  const chromeX = Math.max(0, (Number(window.outerWidth || 0) - Number(window.innerWidth || 0)) / 2);
  const chromeY = Math.max(0, Number(window.outerHeight || 0) - Number(window.innerHeight || 0) - chromeX);
  return {
    left: Math.round(Number(window.screenX || window.screenLeft || 0) + chromeX + rect.left),
    top: Math.round(Number(window.screenY || window.screenTop || 0) + chromeY + rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    clientLeft: rect.left,
    clientTop: rect.top,
    clientWidth: rect.width,
    clientHeight: rect.height,
    viewportWidth: window.innerWidth || document.documentElement.clientWidth || 0,
    viewportHeight: window.innerHeight || document.documentElement.clientHeight || 0,
    browserTitle: document.title || "",
  };
}

async function positionExcelMirrorWindow(excelId = currentExcelId(), options = {}) {
  if (!excelId) return false;
  const rect = excelMirrorScreenRect();
  if (!rect) return false;
  const key = `${excelId}:${rect.left}:${rect.top}:${rect.width}:${rect.height}`;
  if (rect.nativeShell) {
    if (!options.force && excelMirror.lastNativePositionKey === key) return true;
    excelMirror.lastNativePositionKey = key;
  }
  if (!options.force && excelMirror.lastPositionKey === key) return true;
  excelMirror.lastPositionKey = key;
  await postExcelMirror("/api/excel/position", { excelId, ...rect });
  return true;
}

async function raiseExcelMirrorWindow(excelId = currentExcelId()) {
  if (isNativeExcelShell() && !isNativeExcelOverlayShell()) return false;
  if (!excelId) return false;
  excelMirror.lastRaiseAt = Date.now();
  await postExcelMirror("/api/excel/raise", { excelId });
  return true;
}

function stabilizeExcelMirrorZOrder(excelId = currentExcelId()) {
  if (isNativeExcelShell() && !isNativeExcelOverlayShell()) return;
  if (!excelId) return;
  excelMirror.zOrderTimers.forEach(timer => clearTimeout(timer));
  excelMirror.zOrderTimers = [250, 800, 1600, 3200, 5200, 8000].map(delay => setTimeout(() => {
    if (currentExcelId() !== excelId) return;
    raiseExcelMirrorWindow(excelId).catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror raise failed:", err);
    });
  }, delay));
}

function scheduleExcelMirrorPosition(force = false) {
  clearTimeout(excelMirror.positionTimer);
  excelMirror.positionTimer = setTimeout(() => {
    positionExcelMirrorWindow(currentExcelId(), { force: isNativeExcelShell() ? false : force }).catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror position failed:", err);
    }).then(() => {
      const excelId = currentExcelId();
      if (excelId) stabilizeExcelMirrorZOrder(excelId);
    });
  }, 80);
}

function installExcelMirrorPositionListeners() {
  if (excelMirror.positionListenersInstalled) return;
  excelMirror.positionListenersInstalled = true;
  window.addEventListener("resize", () => scheduleExcelMirrorPosition(true));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      scheduleExcelMirrorPosition(true);
      scheduleRestoreActiveExcelMirror(180);
    }
  });
  window.addEventListener("b2bNativeResize", () => scheduleExcelMirrorPosition(true));
  document.addEventListener("pointerup", event => {
    if (!isNativeExcelOverlayShell()) return;
    const target = event.target;
    if (target && target.closest && target.closest(".excel-mirror-shell")) return;
    if (currentExcelId() || excelMirror.activeExcelId) scheduleRestoreActiveExcelMirror(90);
  }, true);
}

async function postExcelMirror(path, body) {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

(function wrapExcelMirrorNavigation() {
  const originalSetCurrentView = window.setCurrentView;
  if (typeof originalSetCurrentView === "function") {
    window.setCurrentView = function(...args) {
      const result = originalSetCurrentView.apply(this, args);
      replaceSimulatorWithMirrorShell();
      updateMirrorShellStatus();
      scheduleExcelMirrorPosition(true);
      const fileId = args[0];
      clearTimeout(excelMirror.switchTimer);
      excelMirror.switchTimer = setTimeout(() => {
        if (fileId && excelMirror.sessionsByFileId[fileId]) {
          switchVisibleExcelMirrorToFileId(fileId).catch(err => {
            if (!isMissingExcelSessionError(err)) console.warn("Excel mirror switch failed:", err);
          });
        }
      }, 0);
      return result;
    };
  }
})();

setupExcelMirrorControls = function() {
  installMirrorRenderOverride();
  installExcelMirrorPositionListeners();
  replaceSimulatorWithMirrorShell();
  updateMirrorShellStatus();
  scheduleExcelMirrorPosition(true);
};
