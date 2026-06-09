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
  hideTimer: null,
  // 호스트 창(웹뷰+네이티브 탭 패널 포함) 활성 여부. C# Activated/Deactivated 이벤트로 갱신.
  // 기본 true(브라우저 모드처럼 C# 이벤트가 없는 환경에서도 동작).
  hostActive: true,
  // 파이프라인 적용 중 표시(이 동안 미러를 숨기고 로딩 애니메이션을 보여준다).
  applying: false,
  applyLoadingTimer: null,
  // owner 모드: 라이브 Excel 을 호스트의 owner 로 띄움(프레임은 유지, frameless 와 조합만 피하면 선택 정상).
  // z-order/최소화를 OS가 처리하므로 주기 raise/hide-inactive/포커스 재배치는 끈다(드래그 선택 보호).
  ownerMode: true,
};
// 업로드한 모든 파일(보통 입력 여러 개 + 출력)을 미리 열어 스택해 둔다.
const EXCEL_MIRROR_MAX_CACHED_SESSIONS = 10;
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
        <div class="mirror-status" data-role="status">업로드가 완료되면 실제 Excel 창이 이 영역에 맞춰집니다.</div>
        <div class="mirror-note">셀/범위 선택은 채팅에 남고, 직접 편집은 막힙니다.</div>
      </div>
    `;
  });
  updateMirrorShellStatus();
}
function updateMirrorShellStatus(text) {
  const target = currentExcelMirrorTarget();
  const excelId = currentExcelId();
  const targetName = target && typeof workbookDisplayName === "function"
    ? workbookDisplayName(target.file, "파일")
    : (target && target.file ? target.file.name : "");
  const msg = text || (target
    ? (excelId ? `연결됨: ${targetName}` : `대기 중: ${targetName}`)
    : "파일을 업로드하면 실제 Excel 창이 열립니다.");
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
    ...state.inputs.map((f, idx) => {
      const name = typeof workbookDisplayName === "function" ? workbookDisplayName(f, `입력 파일 ${idx + 1}`) : (f.name || `입력 파일 ${idx + 1}`);
      return { id: "input:" + name, role: "input", name };
    }),
    ...(state.outputTemplates || []).map((tpl, idx) => ({
      id: typeof outputTemplateFileId === "function" ? outputTemplateFileId(idx) : "output:" + idx,
      role: "output",
      name: typeof workbookDisplayName === "function" ? workbookDisplayName(tpl.file, `출력 파일 ${idx + 1}`) : (tpl.file.name || `출력 파일 ${idx + 1}`),
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

function publishNativeExcelLoading(active, message) {
  const bridge = window.chrome && window.chrome.webview;
  if (!bridge || typeof bridge.postMessage !== "function") return;
  const enc = value => encodeURIComponent(String(value || ""));
  bridge.postMessage(["B2B_EXCEL_LOADING", active ? "1" : "0", enc(message || "")].join("\t"));
}

function setExcelMirrorOpening(target, active) {
  const name = target && typeof workbookDisplayName === "function"
    ? workbookDisplayName(target.file, "파일")
    : (target && target.file ? target.file.name : "파일");
  if (active) {
    const msg = `Excel 여는 중: ${name}`;
    updateMirrorShellStatus(msg);
    // 컴퓨터 성능에 따라 첫 열기/준비가 다소 지연될 수 있음을 안내(특히 사양 낮은 PC).
    publishNativeExcelLoading(true, `${msg}\n컴퓨터 성능에 따라 다소 지연될 수 있습니다`);
  } else {
    publishNativeExcelLoading(false, "");
  }
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
    setExcelMirrorOpening(target, true);
    // 미러들을 같은 위치에 스택해 두고 선택된 것만 z-order 최상단으로 올린다(전환 깜빡임 제거).
    // 따라서 다른 미러를 숨기지(park) 않는다 — 가려져서 안 보일 뿐이라 다시 보일 때 재배치 깜빡임이 없다.
    const existingExcelId = excelMirror.sessionsByFileId[target.fileId];
    if (existingExcelId) {
      excelMirror.activeExcelId = existingExcelId;
      excelMirror.sessionLastUsedByFileId[target.fileId] = Date.now();
      try {
        await positionExcelMirrorWindow(existingExcelId, { force: true });
        stabilizeExcelMirrorZOrder(existingExcelId);
        await pollExcelMirrorChanges(existingExcelId, { baselineOnly: true });
        updateMirrorShellStatus(`Excel 연결됨: ${workbookDisplayName(target.file, "파일")}`);
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
      // 리모콘 모델(0.4.9): 읽기전용 미러 대신 작업용 복사본을 편집가능 라이브로 연다.
      data = await postExcelMirror("/api/excel/open-result", { resultId, liveEditable: true, ...mirrorRect });
    } else {
      if (!target.file.backendWorkbookId) throw new Error("백엔드 workbookId가 없습니다.");
      // 리모콘 모델(0.4.9): 업로드된 실제 파일의 작업용 복사본을 편집가능 라이브로 연다.
      data = await postExcelMirror("/api/excel/open", { workbookId: target.file.backendWorkbookId, liveEditable: true, ...mirrorRect });
    }
    excelMirror.sessionsByFileId[target.fileId] = data.excelId;
    excelMirror.sessionLastUsedByFileId[target.fileId] = Date.now();
    excelMirror.activeExcelId = data.excelId;
    suppressExcelMirrorSelection(1000);
    updateMirrorShellStatus(`Excel 연결됨: ${workbookDisplayName(target.file, "파일")}`);
    toast("실제 Excel 창을 열었습니다.", "success");
    await positionExcelMirrorWindow(data.excelId, { force: true });
    stabilizeExcelMirrorZOrder(data.excelId);
    await pollExcelMirrorChanges(data.excelId, { baselineOnly: true });
    startExcelMirrorPolling();
    await trimExcelMirrorSessionCache(target.fileId);
  } catch (err) {
    updateMirrorShellStatus("Excel 열기 실패: " + err.message);
    toast("Excel 열기 실패: " + err.message, "error");
    console.error(err);
  } finally {
    setExcelMirrorOpening(target, false);
  }
}

async function openExcelMirrorForFileId(fileId) {
  if (fileId && typeof setCurrentView === "function") {
    setCurrentView(fileId);
  }
  await openCurrentWorkbookInExcel();
}

// 업로드된 모든 파일의 fileId 목록(입력 + 출력). publishNativeFileTabs 와 동일한 규칙.
function listAllWorkbookFileIds() {
  const ids = [];
  (state.inputs || []).forEach((f, idx) => {
    const name = typeof workbookDisplayName === "function"
      ? workbookDisplayName(f, `입력 파일 ${idx + 1}`)
      : (f.name || `입력 파일 ${idx + 1}`);
    ids.push("input:" + name);
  });
  (state.outputTemplates || []).forEach((tpl, idx) => {
    ids.push(typeof outputTemplateFileId === "function" ? outputTemplateFileId(idx) : "output:" + idx);
  });
  return ids;
}

// 지정한 파일의 미러 세션을 보장(없으면 연다). 활성화/최상단 올리기는 makeActive 일 때만.
// 다른 미러를 숨기지 않으므로 모두 같은 위치에 스택된다.
async function ensureExcelMirrorSession(fileId, { makeActive = false } = {}) {
  if (!fileId) return null;
  const file = typeof getFile === "function" ? getFile(fileId) : null;
  if (!file) return null;
  let excelId = excelMirror.sessionsByFileId[fileId];
  if (excelId) {
    if (makeActive) {
      excelMirror.activeExcelId = excelId;
      excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
      await positionExcelMirrorWindow(excelId, { force: true });
      stabilizeExcelMirrorZOrder(excelId);
      await pollExcelMirrorChanges(excelId, { baselineOnly: true });
    }
    return excelId;
  }
  const mirrorRect = excelMirrorScreenRect() || {};
  let data;
  if (file.backendDownloadUrl && isBackendResultDownloadUrl(file.backendDownloadUrl)) {
    const resultId = extractResultIdFromDownloadUrl(file.backendDownloadUrl);
    // 리모콘 모델(0.4.9): 업로드 자동 열기도 작업용 복사본을 편집가능 라이브로 연다.
    data = await postExcelMirror("/api/excel/open-result", { resultId, liveEditable: true, ...mirrorRect });
  } else {
    if (!file.backendWorkbookId) throw new Error("백엔드 workbookId가 없습니다.");
    data = await postExcelMirror("/api/excel/open", { workbookId: file.backendWorkbookId, liveEditable: true, ...mirrorRect });
  }
  excelMirror.sessionsByFileId[fileId] = data.excelId;
  excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
  await positionExcelMirrorWindow(data.excelId, { force: true });
  await pollExcelMirrorChanges(data.excelId, { baselineOnly: true });
  if (makeActive) {
    excelMirror.activeExcelId = data.excelId;
    stabilizeExcelMirrorZOrder(data.excelId);
  }
  return data.excelId;
}

// 업로드 직후: 모든 파일의 미러를 미리 열어 같은 위치에 스택해 둔다.
// 이후 탭/보기 전환은 선택된 미러를 z-order 최상단으로 올리기만 하면 되어 깜빡임이 없다.
async function preopenAllExcelMirrors(selectedFileId) {
  const ids = listAllWorkbookFileIds();
  if (!ids.length) return;
  const selected = selectedFileId || state.currentFileId || ids[ids.length - 1];
  // 선택된 파일을 마지막에 열어 자연스럽게 최상단이 되도록(끝에서 churn 최소화).
  const ordered = [...ids.filter(id => id !== selected), selected];
  const failures = [];
  // 업로드는 명시적 사용자 동작 → preopen 동안 호스트를 활성으로 간주해
  // 자동숨김(periodic)이 방금 연 미러들을 park(숨김) 하지 못하게 한다.
  // (park 되면 그 탭 첫 전환이 무거운 재배치가 되어 "보기 눌러야 매끄러운" 증상이 생김)
  excelMirror.hostActive = true;
  publishNativeExcelLoading(true, "Excel 미러 준비 중...\n컴퓨터 성능에 따라 다소 지연될 수 있습니다");
  try {
    for (const fid of ordered) {
      try {
        await ensureExcelMirrorSession(fid, { makeActive: fid === selected });
      } catch (err) {
        failures.push({ fileId: fid, error: err });
        if (!isMissingExcelSessionError(err)) console.warn("Excel mirror preopen failed:", fid, err);
      }
    }
    if (typeof setCurrentView === "function") setCurrentView(selected);
    // 모든 세션을 같은 위치에 스택(=모든 탭을 '보기 누른 상태'로). 혹시 park 된 게 있어도 여기서 복구된다.
    // 이렇게 해두면 이후 전환은 raise 만으로 처리되어 매끄럽다.
    const selExcelId = excelMirror.sessionsByFileId[selected];
    for (const [fid, exId] of Object.entries(excelMirror.sessionsByFileId)) {
      if (!exId || exId === selExcelId) continue;
      try { await positionExcelMirrorWindow(exId, { force: true }); } catch (_) {}
    }
    // 선택 미러를 맨 위로(가드 우회 — 업로드는 명시적 동작).
    if (selExcelId) {
      await positionExcelMirrorWindow(selExcelId, { force: true });
      await raiseExcelMirrorWindow(selExcelId, { force: true });
      setTimeout(() => { raiseExcelMirrorWindow(selExcelId, { force: true }).catch(() => {}); }, 300);
    }
    startExcelMirrorPolling();
    if (failures.length) {
      const msg = `${failures.length}개 파일의 Excel 창을 열지 못했습니다. 파일 목록에서 다시 확인해 주세요.`;
      updateMirrorShellStatus(msg);
      if (typeof toast === "function") toast(msg, "error");
    }
    return { opened: ordered.length - failures.length, failed: failures.length, failures };
  } finally {
    publishNativeExcelLoading(false, "");
  }
}

// 호환용 진입점: 업로드는 이제 완료 전에 모든 파일의 실제 Excel 미러를 연다.
async function autoOpenMirrorAfterUpload(selectedFileId) {
  return preopenAllExcelMirrors(selectedFileId);
}

async function switchVisibleExcelMirrorToFileId(fileId) {
  if (!fileId) return false;
  const excelId = excelMirror.sessionsByFileId[fileId];
  if (!excelId) {
    updateMirrorShellStatus();
    return false;
  }
  // 적용으로 변경됐지만 표시 안 한 입력/출력 미러(stale)는 전환 시 최신 결과로 교체.
  if (excelMirror.staleByFileId && excelMirror.staleByFileId[fileId]) {
    delete excelMirror.staleByFileId[fileId];
    const file = typeof getFile === "function" ? getFile(fileId) : null;
    const url = file && file.backendDownloadUrl;
    if (url && isBackendResultDownloadUrl(url) && typeof refreshExcelMirrorForFileId === "function") {
      try {
        const refreshed = await refreshExcelMirrorForFileId(fileId, url, { openIfMissing: false });
        if (refreshed) return true;
      } catch (err) {
        if (!isMissingExcelSessionError(err)) console.warn("Excel mirror stale refresh failed:", err);
      }
    }
  }
  excelMirror.activeExcelId = excelId;
  excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
  // 이미 열린 미러로의 전환: 강제 재배치(force) 없이 위치가 같으면 건너뛰고 raise만 → 저사양에서도 즉시 전환.
  // (창이 실제로 이동/숨겨졌을 때만 lastNativePositionKey 가 달라져 재배치된다.)
  await positionExcelMirrorWindow(excelId);
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
  const data = await postExcelMirror("/api/excel/open-result", { resultId, liveEditable: true, ...(excelMirrorScreenRect() || {}) });
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
  // 적용 직후 짧게만 억제(프로그램적 선택만 건너뜀) → 사용자의 셀 선택이 곧바로 채팅에 반영됨.
  // selectionMutedUntil 은 직접 리셋(suppressExcelMirrorSelection 은 Math.max 라 이전 10분 억제를 못 줄임).
  excelMirror.mutedUntil = Date.now() + 1500;
  excelMirror.selectionMutedUntil = Date.now() + 1500;
  await positionExcelMirrorWindow(excelId, { force: true });
  await baselineExcelMirrorSession(excelId);
  excelMirror.mutedUntil = Date.now() + 300;
  excelMirror.selectionMutedUntil = Date.now() + 300;
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
    invalidateExcelMirrorPositionTracking(excelId);  // 숨겨지므로 위치 추적 무효화 → 다음 전환 시 재배치
    try {
      await postExcelMirror("/api/excel/hide", { excelId });
    } catch (err) {
      console.warn("Failed to hide inactive Excel mirror:", err);
    }
  }));
}

async function hideAllExcelMirrorWindows() {
  invalidateExcelMirrorPositionTracking();  // 전부 숨김 → 위치 추적 전체 무효화
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
  // 엑셀↔채팅 토글 복귀 시 강제 재배치(force)를 하면 저사양 PC에서 재배치가 느려 3초가량 깜빡인다.
  // 위치가 그대로면(force 없이) position 은 건너뛰고 raise 만 → 깜빡임 없이 즉시 올라온다.
  // (창이 실제로 이동/숨겨졌으면 lastNativePositionKey 가 달라져 자동으로 재배치된다.)
  await positionExcelMirrorWindow(excelId);
  await raiseExcelMirrorWindow(excelId);
  return true;
}

// ---- 적용 중 로딩 애니메이션 (이슈: 적용 중엔 미러가 안 보이므로 엑셀 영역에 로딩 표시) ----
const EXCEL_MIRROR_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// [#19] 작업 중단 버튼: 네이티브 셸에서는 우측이 실제 Excel top-level 오버레이라 그 위에 둔 HTML 은
// 가려진다. 그래서 position:fixed 로 '좌측 하단'(= WebView2 채팅 영역, Excel 에 안 가림)에 띄운다.
function _ensureExcelCancelButton() {
  let btn = document.getElementById("excel-apply-cancel-btn");
  if (btn) return btn;
  btn = document.createElement("button");
  btn.id = "excel-apply-cancel-btn";
  btn.type = "button";
  btn.className = "excel-apply-cancel-btn";
  btn.textContent = "■ 작업 중단";
  btn.style.display = "none";
  btn.onclick = () => {
    if (typeof requestExcelApplyCancel !== "function") return;
    btn.disabled = true;
    btn.textContent = "중단 중...";
    Promise.resolve(requestExcelApplyCancel()).catch(() => {}).then(() => {
      btn.disabled = false;
      btn.textContent = "■ 작업 중단";
    });
  };
  document.body.appendChild(btn);
  return btn;
}
function showExcelApplyCancelButton(show) {
  const btn = _ensureExcelCancelButton();
  if (show) {
    btn.disabled = false;
    btn.textContent = "■ 작업 중단";
    btn.style.display = "inline-flex";
  } else {
    btn.style.display = "none";
  }
}

// 적용 시작: 모든 미러 창을 숨기고(park) 네이티브 패널의 로딩 애니메이션을 돌린다.
// (미러를 숨겨야 적용 중 여러 Excel 창이 앞으로 튀어나오지 않고, 패널의 로딩 표시가 보인다.)
function beginExcelMirrorApplyLoading(message) {
  excelMirror.applying = true;
  if (typeof showExcelApplyCancelButton === "function") showExcelApplyCancelButton(true);
  const label = message || "적용 반영 중...";
  if (typeof hideAllExcelMirrorWindows === "function") {
    hideAllExcelMirrorWindows().catch(() => {});
  }
  let i = 0;
  const tick = () => {
    const frame = EXCEL_MIRROR_SPINNER_FRAMES[i % EXCEL_MIRROR_SPINNER_FRAMES.length];
    i += 1;
    const text = `${frame}  ${label}`;
    if (typeof publishNativeExcelLoading === "function") publishNativeExcelLoading(true, text);
    if (typeof updateMirrorShellStatus === "function") updateMirrorShellStatus(text);
  };
  tick();
  clearInterval(excelMirror.applyLoadingTimer);
  excelMirror.applyLoadingTimer = setInterval(tick, 320);
}

function endExcelMirrorApplyLoading() {
  if (typeof showExcelApplyCancelButton === "function") showExcelApplyCancelButton(false);
  if (!excelMirror.applying && !excelMirror.applyLoadingTimer) return;
  excelMirror.applying = false;
  clearInterval(excelMirror.applyLoadingTimer);
  excelMirror.applyLoadingTimer = null;
  if (typeof publishNativeExcelLoading === "function") publishNativeExcelLoading(false, "");
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
  // 선택 범위가 채팅에 빠르게 뜨도록 폴링 간격을 짧게(활성 미러 1개만 폴링하므로 COM 부담 적음).
  excelMirror.pollTimer = setInterval(() => {
    const excelId = currentExcelId();
    if (excelId) {
      pollExcelMirrorChanges(excelId).catch(err => console.warn("Excel mirror poll failed:", err));
    }
  }, isNativeExcelShell() ? 450 : 400);
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
  // 드래그 중 과도한 갱신만 막을 정도로 짧게(채팅 반영이 바로바로 보이도록).
  excelMirror.selectionChatTimer = setTimeout(() => {
    const pending = excelMirror.pendingChatRange;
    excelMirror.pendingChatRange = null;
    if (!pending || typeof updateChatRangeReference !== "function") return;
    updateChatRangeReference(pending, { preserveFocus: true });
  }, 180);
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
  excelMirror.positionedKeyByExcelId = excelMirror.positionedKeyByExcelId || {};
  // 세션별 추적: 이 미러가 이미 이 위치에 배치돼 있으면(=숨겨지지 않았음) 재배치를 건너뛴다.
  // 전역 키가 아니라 세션별이라, 다른 파일로 전환해도 그 파일이 제자리면 재배치 COM 을 생략 → 저사양에서 즉시 전환.
  if (!options.force && excelMirror.positionedKeyByExcelId[excelId] === key) return true;
  // keepZorder: z-order 를 바꾸지 않고 위치/크기만(비활성 창 재배치 시 위로 안 튀어나오게).
  await postExcelMirror("/api/excel/position", { excelId, ...rect, keepZorder: !!options.keepZorder });
  excelMirror.positionedKeyByExcelId[excelId] = key;
  if (rect.nativeShell) excelMirror.lastNativePositionKey = key;
  excelMirror.lastPositionKey = key;
  return true;
}

// 미러를 숨기면(park) 위치 추적을 무효화해, 다음 전환 시 다시 배치되도록 한다.
function invalidateExcelMirrorPositionTracking(excelId) {
  if (!excelMirror.positionedKeyByExcelId) return;
  if (excelId) delete excelMirror.positionedKeyByExcelId[excelId];
  else excelMirror.positionedKeyByExcelId = {};
}

async function raiseExcelMirrorWindow(excelId = currentExcelId(), options = {}) {
  if (isNativeExcelShell() && !isNativeExcelOverlayShell()) return false;
  if (!excelId) return false;
  // 호스트 창이 비활성(최소화/알트탭/다른 앱)인 동안엔 강제로 최상단에 올리지 않는다.
  // (document.hasFocus는 웹뷰 포커스만 봐서 네이티브 탭 클릭 시 false가 됨 → 호스트 활성 플래그를 사용.)
  // 단, force=true(업로드 직후 자동 보기 등 명시적 동작)는 가드를 우회한다.
  if (!options.force && excelMirror.hostActive === false) return false;
  excelMirror.lastRaiseAt = Date.now();
  await postExcelMirror("/api/excel/raise", { excelId });
  return true;
}

function stabilizeExcelMirrorZOrder(excelId = currentExcelId()) {
  if (isNativeExcelShell() && !isNativeExcelOverlayShell()) return;
  if (!excelId) return;
  excelMirror.zOrderTimers.forEach(timer => clearTimeout(timer));
  excelMirror.zOrderTimers = [];
  if (excelMirror.ownerMode) {
    // owner 모드: 형제 스택 중 선택본만 한 번 위로. 주기적 raise 는 드래그 선택을 깨므로 하지 않는다.
    raiseExcelMirrorWindow(excelId).catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror raise failed:", err);
    });
    return;
  }
  excelMirror.zOrderTimers = [250, 800, 1600, 3200, 5200, 8000].map(delay => setTimeout(() => {
    if (currentExcelId() !== excelId) return;
    raiseExcelMirrorWindow(excelId).catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror raise failed:", err);
    });
  }, delay));
}

// 열려 있는 모든 Excel 세션을 현재 영역 크기/위치로 재배치한다(스플리터/리사이즈 시 전부 함께 이동).
// keepZorder:true 로 z-order 를 안 바꾸므로 비활성 창이 위로 튀어나오는 "순회" 없이 같이 리사이즈된다.
// 활성 세션은 z-order 유지로 그대로 최상단.
function scheduleExcelMirrorPosition(force = false) {
  clearTimeout(excelMirror.positionTimer);
  excelMirror.positionTimer = setTimeout(() => {
    const active = currentExcelId();
    const ids = Array.from(new Set(Object.values(excelMirror.sessionsByFileId || {}).filter(Boolean)));
    if (!ids.length) return;
    Promise.all(ids.map(id => positionExcelMirrorWindow(id, { force, keepZorder: true }).catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror position failed:", err);
    }))).then(() => {
      // 활성 1개만 보정 raise(다른 창은 건드리지 않음 → 순회 없음).
      if (active && currentExcelId() === active) stabilizeExcelMirrorZOrder(active);
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
  // owner 모드: 포커스 기반 재배치/복원(pointerdown/focusin/pointerup)은 불필요하고
  // 드래그 중 SetWindowPos 로 선택을 깰 수 있으므로 설치하지 않는다. 리사이즈 추종만 유지.
  if (excelMirror.ownerMode) return;
  const restoreOverlayAfterUiFocus = event => {
    if (!isNativeExcelOverlayShell()) return;
    const target = event.target;
    if (target && target.closest && target.closest(".excel-mirror-shell")) return;
    if (!currentExcelId() && !excelMirror.activeExcelId) return;
    scheduleExcelMirrorPosition(true);
    scheduleRestoreActiveExcelMirror(0);
  };
  document.addEventListener("pointerdown", restoreOverlayAfterUiFocus, true);
  document.addEventListener("focusin", restoreOverlayAfterUiFocus, true);
  document.addEventListener("pointerup", event => {
    if (!isNativeExcelOverlayShell()) return;
    const target = event.target;
    if (target && target.closest && target.closest(".excel-mirror-shell")) return;
    if (currentExcelId() || excelMirror.activeExcelId) scheduleRestoreActiveExcelMirror(90);
  }, true);
}

async function postExcelMirror(path, body, attempt = 0, options = {}) {
  let resp;
  let timeoutId = null;
  const controller = options.timeoutMs ? new AbortController() : null;
  if (controller) {
    timeoutId = setTimeout(() => controller.abort(), Math.max(1000, Number(options.timeoutMs) || 0));
  }
  try {
    resp = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: controller ? controller.signal : undefined,
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error(options.timeoutMessage || "Excel VBA 실행이 응답하지 않아 중단했습니다.");
    }
    // 네트워크 수준 실패("Failed to fetch") — 저사양 PC 에서 서버가 COM 으로 잠깐 바빠 응답을 못 한 경우.
    // 짧게 2회까지 재시도한 뒤에도 실패하면 성능 안내를 붙여 던진다.
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      return postExcelMirror(path, body, attempt + 1, options);
    }
    throw new Error("서버와 통신하지 못했습니다(컴퓨터 성능에 따라 지연될 수 있습니다). 잠시 후 다시 시도해 주세요.");
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) {
    const err = new Error(data.error || `HTTP ${resp.status}`);
    if (data.errorInfo) {
      err.errorInfo = data.errorInfo;
      err._stepInfo = data.errorInfo;
    }
    throw err;
  }
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
        if (!fileId) return;
        if (excelMirror.sessionsByFileId[fileId]) {
          // 이미 열린 미러 → 빠른 전환(raise만).
          switchVisibleExcelMirrorToFileId(fileId).catch(err => {
            if (!isMissingExcelSessionError(err)) console.warn("Excel mirror switch failed:", err);
          });
        } else if (fileId === state.currentFileId) {
          updateMirrorShellStatus("Excel 창을 준비 중입니다. 업로드가 완료될 때까지 기다려 주세요.");
        }
      }, 0);
      return result;
    };
  }
})();

// 앱이 포커스를 잃으면(최소화 / 파일 대화상자 / 다른 앱 전환) overlay Excel 이 위로 튀어나오지
// 않도록 숨기고, 포커스가 돌아오면 복원한다.
// 포그라운드가 Excel(사용자가 미러를 클릭)인지 판정은 신뢰된 python 백엔드(/api/excel/hide-inactive)가
// 수행한다 — Excel 이면 그대로 두고, 아니면 미러를 숨긴다. (C# 포그라운드/프로세스 조회 제거 → AV 회피)
function installOverlayAutoHide() {
  if (excelMirror.autoHideInstalled) return;
  // owner 모드: 호스트가 비활성(엑셀 클릭 등) 될 때마다 숨기던 로직이 드래그 선택을 끊으므로 설치하지 않는다.
  // 최소화 시 숨김/복원은 owner 관계로 OS 가 자동 처리한다.
  if (excelMirror.ownerMode) {
    excelMirror.autoHideInstalled = true;
    return;
  }
  excelMirror.autoHideInstalled = true;
  const hasSessions = () => Object.keys(excelMirror.sessionsByFileId).length > 0;
  const clearHideTimer = () => {
    clearTimeout(excelMirror.hideTimer);
    excelMirror.hideTimer = null;
  };
  const hideInactive = () => {
    if (!hasSessions()) return;
    // 백엔드가 (포그라운드가 Excel 이 아니면) 전부 숨길 수 있으므로 위치 추적을 전체 무효화.
    invalidateExcelMirrorPositionTracking();
    postExcelMirror("/api/excel/hide-inactive", {}).catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror hide-inactive failed:", err);
    });
  };
  const scheduleHideInactive = (delay = 180) => {
    clearHideTimer();
    excelMirror.hideTimer = setTimeout(() => {
      excelMirror.hideTimer = null;
      if (excelMirror.hostActive !== false && !document.hidden) return;
      hideInactive();
    }, delay);
  };
  const restoreSoon = () => {
    if (!hasSessions() || typeof restoreActiveExcelMirrorWindow !== "function") return;
    excelMirror.hostActive = true;
    clearHideTimer();
    setTimeout(() => {
      restoreActiveExcelMirrorWindow().catch(err => {
        if (!isMissingExcelSessionError(err)) console.warn("Excel mirror restore failed:", err);
      });
    }, 120);
  };

  // 호스트 창(웹뷰 + 네이티브 탭 패널) 활성/비활성은 C# Form.Activated/Deactivated 이벤트로 받는다.
  //  - 네이티브 우측 상단 탭을 클릭하면 웹뷰는 포커스를 잃지만 호스트 창은 계속 활성 → 안 숨김(탭 전환 정상).
  //  - 엑셀 미러/다른 앱/최소화/대화상자로 가면 호스트가 비활성 → 숨김(python이 포그라운드=Excel 이면 유지).
  window.addEventListener("b2bHostActivated", () => {
    excelMirror.hostActive = true;
    clearHideTimer();
    restoreSoon();
  });
  window.addEventListener("b2bHostDeactivated", () => {
    excelMirror.hostActive = false;
    scheduleHideInactive(180);
  });

  // 안전망: 호스트가 비활성인 동안 주기적으로 숨김 유지(raise 타이머가 다시 띄우는 것 방지).
  setInterval(() => {
    if (!hasSessions()) return;
    if (excelMirror.hostActive !== false) return; // 호스트 활성(네이티브 탭 포함) → 그대로
    hideInactive();
  }, 700);

  // 최소화/완전 가려짐 → 즉시 숨김(보조). (엑셀 클릭은 document를 hidden으로 만들지 않으므로 구분됨)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      excelMirror.hostActive = false;
      clearHideTimer();
      hideInactive();
    }
    else restoreSoon();
  });
  // 파일 열기 대화상자가 뜰 때 즉시 숨김(파일 input 클릭). 닫혀서 포커스 돌아오면 복원.
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.tagName === "INPUT" && (t.type === "file" || t.getAttribute("type") === "file")) {
      hideInactive();
    }
  }, true);
  document.addEventListener("pointerdown", restoreSoon, true);
  document.addEventListener("focusin", restoreSoon, true);
  // 앱이 다시 포커스되면(대화상자 닫힘/복귀/복원) 활성 미러 복원.
  window.addEventListener("focus", restoreSoon);
}

setupExcelMirrorControls = function() {
  installMirrorRenderOverride();
  installExcelMirrorPositionListeners();
  installOverlayAutoHide();
  replaceSimulatorWithMirrorShell();
  updateMirrorShellStatus();
  scheduleExcelMirrorPosition(true);
};
