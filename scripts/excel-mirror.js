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
  hiddenByExcelId: {},
  // UI 주도 전환 직후에는 서버 active-sync(activeExcelId)를 잠시 무시한다.
  // 전환 전에 출발한 in-flight 폴 응답이 이전 탭으로 setCurrentView 를 되돌리는 바운스 방지.
  activeSyncMutedUntil: 0,
  pendingChatRange: null,
  selectionChatTimer: null,
  selectionTimer: null,      // [0.5.17] 선택→채팅 빠른 반영용 경량 폴 타이머
  selectionPolling: false,
  zOrderTimers: [],
  lastRaiseAt: 0,
  positionTimer: null,
  switchTimer: null,
  restoreTimer: null,
  baselinePollTimer: null,
  uiClickGuardUntil: 0,
  lastPositionKey: "",
  lastNativePositionKey: "",
  lastBackgroundPollAt: 0,
  lastFormulaInfoAt: 0,
  lastHideInactiveAt: 0,
  positionListenersInstalled: false,
  hideTimer: null,
  // 호스트 창(웹뷰+네이티브 탭 패널 포함) 활성 여부. C# Activated/Deactivated 이벤트로 갱신.
  // 기본 true(브라우저 모드처럼 C# 이벤트가 없는 환경에서도 동작).
  hostActive: true,
  // 파이프라인 적용 중 표시(이 동안 미러를 숨기고 로딩 애니메이션을 보여준다).
  applying: false,
  applyLoadingTimer: null,
  quietUntil: 0,
  // owner 모드: 라이브 Excel 을 호스트의 owner 로 띄움(프레임은 유지, frameless 와 조합만 피하면 선택 정상).
  // z-order/최소화를 OS가 처리하므로 주기 raise/hide-inactive/포커스 재배치는 끈다(드래그 선택 보호).
  ownerMode: true,
};
// 업로드한 모든 파일(보통 입력 여러 개 + 출력)을 미리 열어 스택해 둔다.
// [0.5.2 이식] 전역 작업 잠금(busy gate)
// DOM 오버레이는 WebView 영역만 덮는다. 오른쪽 네이티브 파일탭과 Excel 창(별도 HWND)은
// 네이티브 호스트가 직접 잠가야 하므로 busy 상태를 호스트에 중계한다.
function publishNativeUiBusy(active, label, failsafeMs) {
  const bridge = window.chrome && window.chrome.webview;
  if (!bridge || typeof bridge.postMessage !== "function") return;
  const enc = value => encodeURIComponent(String(value || ""));
  // [적대 검증 2026-08-13] 넷째 칸 = 이 작업의 failsafe(ms). 예전엔 안 보내서 네이티브가 90초
  // 하드코딩으로 스스로 잠금을 풀었다 — 38MB 파일 여러 개를 되돌려쓰면(파일당 34.6초 실측)
  // 90초를 넘겨, 작업 중인데 파일 탭과 Excel 입력이 다시 열려 원래 사고가 재현된다.
  const fs = Math.max(0, Number(failsafeMs) || 0);
  bridge.postMessage(["B2B_UI_BUSY", active ? "1" : "0", enc(label || ""), fs ? String(fs) : ""].join("\t"));
}

// [0.5.16 #1] 실행기(runner)는 헤드리스 — 네이티브 셸의 우측 패널(파일탭+Excel 영역)을 접어 WebView 가
// 화면을 꽉 채우게 호스트에 알린다. 생성기로 돌아오면 다시 펼친다. (Excel 오버레이 자체는 웹이 hideAll 로 숨김)
function publishNativeRunnerMode(isRunner) {
  const bridge = window.chrome && window.chrome.webview;
  if (!bridge || typeof bridge.postMessage !== "function") return;
  try { bridge.postMessage(["B2B_RUNNER_MODE", isRunner ? "1" : "0"].join("\t")); } catch (_) {}
}

// ---- 전역 작업 잠금(busy gate) ----
// Excel 창 로딩/스킬 적용/전환/복구 같은 COM 직렬 작업이 도는 동안 다른 클릭이 끼어들면
// 큐가 꼬여 탭/창 상태가 어긋난다 → 작업 중에는 포인터 입력을 즉시 차단하고,
// 120ms 이상 길어지는 작업만 오버레이로 표시한다. 빠른 탭 전환은 깜빡임을 줄이고,
// 느린 Excel COM 작업은 사용자가 "지금 조작 불가"임을 명확히 볼 수 있게 한다.
// 안전장치: 어떤 버그로 해제가 누락돼도 토큰마다 90초 후 자동 해제된다.
const uiBusy = { count: 0, el: null, since: 0, guardInstalled: false, lastBlockedTraceAt: 0 };

function traceClientUiEvent(event, fields = {}) {
  const now = Date.now();
  const overlay = uiBusy.el;
  const snapshot = {
    clientTs: new Date(now).toISOString(),
    perfMs: Math.round(performance.now()),
    uiBusyCount: uiBusy.count,
    uiBusyHeldMs: uiBusy.count > 0 && uiBusy.since ? now - uiBusy.since : 0,
    overlayShown: !!(overlay && overlay.classList && overlay.classList.contains("show")),
    excelApplying: !!excelMirror.applying,
    hasApplyBusyToken: !!excelMirror.applyBusyToken,
    activeExcelId: excelMirror.activeExcelId || "",
    nativeShell: typeof isNativeExcelShell === "function" ? !!isNativeExcelShell() : false,
    ...fields,
  };
  try { console.debug("[client-trace]", event, snapshot); } catch (_) {}
  try {
    fetch("/api/client/trace", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, fields: snapshot }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}

function _ensureUiBusyOverlay() {
  if (uiBusy.el) return uiBusy.el;
  const style = document.createElement("style");
  style.textContent = `
    #b2b-busy-overlay {
      position: fixed; inset: 0; z-index: 2147483000;
      display: none; align-items: flex-start; justify-content: center;
      background: rgba(250, 250, 252, 0.45);
      cursor: wait;
    }
    #b2b-busy-overlay.show { display: flex; }
    body.b2b-ui-busy, body.b2b-ui-busy * { cursor: wait !important; }
    #b2b-busy-overlay .busy-pill {
      margin-top: 18vh;
      display: inline-flex; align-items: center; gap: 10px;
      background: #fff; border: 1px solid var(--border, #e1e4eb);
      border-radius: 999px; padding: 10px 18px;
      font-size: 13px; font-weight: 700; color: var(--ink-900, #202430);
      box-shadow: 0 6px 24px rgba(0,0,0,0.12);
    }
    #b2b-busy-overlay .busy-spin {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid var(--m-400, #ff4db8); border-top-color: transparent;
      animation: b2bBusySpin 0.8s linear infinite;
    }
    #b2b-busy-overlay .busy-stop {
      display: none;
      border: 1px solid #ef4444;
      background: #fff;
      color: #dc2626;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }
    #b2b-busy-overlay .busy-stop.show { display: inline-flex; }
    #b2b-busy-overlay .busy-stop:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    @keyframes b2bBusySpin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
  const el = document.createElement("div");
  el.id = "b2b-busy-overlay";
  el.innerHTML = `<div class="busy-pill"><span class="busy-spin"></span><span class="busy-label">작업 중...</span><button class="busy-stop" type="button">작업 중단</button></div>`;
  // 오버레이가 모든 포인터 입력을 흡수한다(클릭/더블클릭/휠 차단).
  // 단, 오버레이 안의 '작업 중단' 버튼만은 통과시킨다 — capture 단계에서 stopPropagation 하면
  // 자기 자식인 버튼의 click 핸들러까지 막혀 버튼이 눌리지 않는 버그가 있었다.
  ["pointerdown", "pointerup", "click", "dblclick", "wheel", "contextmenu"].forEach(type => {
    el.addEventListener(type, e => {
      const target = e.target;
      if (target && typeof target.closest === "function" && target.closest(".busy-stop")) return;
      e.stopPropagation();
      e.preventDefault();
    }, true);
  });
  document.body.appendChild(el);
  uiBusy.el = el;
  _installUiBusyInputGuard();
  return el;
}

function _installUiBusyInputGuard() {
  if (uiBusy.guardInstalled) return;
  uiBusy.guardInstalled = true;
  const blockedTypes = ["pointerdown", "pointerup", "click", "dblclick", "contextmenu", "wheel", "dragenter", "dragover", "drop"];
  blockedTypes.forEach(type => {
    document.addEventListener(type, e => {
      // [버튼 안 눌림 수정] 오버레이가 '실제로 보일 때'만 입력을 막는다. 예전엔 count>0 이면
      // 막았는데, 오버레이는 showDelay(120~180ms) 뒤에야 표시되므로 그 사이(또는 showDelay 보다
      // 빨리 끝나는 탭전환/짧은 작업)에 전송/적용 클릭이 '시각적 안내 없이' 먹혔다.
      const overlay = uiBusy.el;
      if (!isUiBusy() || !overlay || !overlay.classList.contains("show")) return;
      if (overlay.contains(e.target)) return;
      const now = Date.now();
      if (now - (uiBusy.lastBlockedTraceAt || 0) > 2000) {
        uiBusy.lastBlockedTraceAt = now;
        traceClientUiEvent("ui.busy.input_blocked", {
          inputType: type,
          targetTag: e.target && e.target.tagName ? e.target.tagName : "",
          targetClass: e.target && e.target.className ? String(e.target.className).slice(0, 160) : "",
        });
      }
      e.stopPropagation();
      e.preventDefault();
    }, true);
  });
}

function isUiBusy() {
  return uiBusy.count > 0;
}

function beginUiBusy(label = "작업 중...", options = {}) {
  uiBusy.count += 1;
  if (uiBusy.count === 1) uiBusy.since = Date.now();
  traceClientUiEvent("ui.busy.begin", {
    label,
    showDelayMs: Math.max(0, Number(options.showDelayMs ?? 120)),
    failsafeMs: Math.max(1000, Number(options.failsafeMs || 90000)),
    hasStop: typeof options.onStop === "function",
  });
  const showDelayMs = Math.max(0, Number(options.showDelayMs ?? 120));
  try {
    const el = _ensureUiBusyOverlay();
    const labelEl = el.querySelector(".busy-label");
    if (labelEl) labelEl.textContent = label;
    const stopBtn = el.querySelector(".busy-stop");
    if (stopBtn) {
      stopBtn.textContent = options.stopLabel || "작업 중단";
      stopBtn.disabled = false;
      stopBtn.classList.toggle("show", typeof options.onStop === "function");
      stopBtn.onclick = typeof options.onStop === "function"
        ? async e => {
            e.preventDefault();
            e.stopPropagation();
            if (stopBtn.disabled) return;
            stopBtn.disabled = true;
            stopBtn.textContent = options.stoppingLabel || "중단 중...";
            try {
              // [죽은 중단 버튼 2026-08-12] 취소할 대상이 없으면 onStop 이 false 를 돌려준다.
              // 예전엔 그 경우에도 버튼이 '중단 중...' 인 채로 굳어(작업이 끝날 때까지, 실측 34초)
              // 사용자는 중단을 눌렀는데 아무 일도 안 일어나는 것으로 보였다. 되살리고 사실대로 알린다.
              const _ok = await options.onStop();
              if (_ok === false) {
                stopBtn.disabled = false;
                stopBtn.textContent = options.stopLabel || "작업 중단";
                if (typeof toast === "function") toast("지금은 중단할 수 없는 작업입니다. 끝날 때까지 기다려 주세요.", "error");
              }
            } catch (err) {
              console.warn("busy stop failed:", err);
              if (typeof toast === "function") toast("작업 중단 요청에 실패했습니다: " + (err.message || err), "error");
              stopBtn.disabled = false;
              stopBtn.textContent = options.stopLabel || "작업 중단";
            }
          }
        : null;
    }
    document.body.classList.add("b2b-ui-busy");
  } catch (_) {}
  try { publishNativeUiBusy(true, label, options.failsafeMs); } catch (_) {}
  const token = { released: false, timer: null, showTimer: null };
  token.showTimer = setTimeout(() => {
    if (token.released || !isUiBusy()) return;
    try {
      const el = _ensureUiBusyOverlay();
      const labelEl = el.querySelector(".busy-label");
      if (labelEl) labelEl.textContent = label;
      el.classList.add("show");
    } catch (_) {}
  }, showDelayMs);
  const failsafeMs = Math.max(1000, Number(options.failsafeMs || 90000));
  token.timer = setTimeout(() => endUiBusy(token, { failsafe: true }), failsafeMs);
  return token;
}

function endUiBusy(token, opts = {}) {
  if (!token || token.released) {
    traceClientUiEvent("ui.busy.end_ignored", { hasToken: !!token, alreadyReleased: !!(token && token.released) });
    return;
  }
  traceClientUiEvent("ui.busy.end", { failsafe: !!opts.failsafe, silentComplete: !!opts.silentComplete });
  token.released = true;
  clearTimeout(token.showTimer);
  clearTimeout(token.timer);
  uiBusy.count = Math.max(0, uiBusy.count - 1);
  if (uiBusy.count === 0) {
    if (uiBusy.el) uiBusy.el.classList.remove("show");
    const stopBtn = uiBusy.el && uiBusy.el.querySelector(".busy-stop");
    if (stopBtn) {
      stopBtn.classList.remove("show");
      stopBtn.onclick = null;
      stopBtn.disabled = false;
    }
    try { document.body.classList.remove("b2b-ui-busy"); } catch (_) {}
    try { publishNativeUiBusy(false, ""); } catch (_) {}
    const held = Date.now() - uiBusy.since;
    if (typeof toast === "function") {
      if (opts.failsafe) {
        toast("작업이 예상보다 오래 걸려 화면 잠금을 해제했습니다. 화면이 이상하면 탭을 다시 눌러 주세요.", "success");
      } else if (!opts.silentComplete && held > 1200) {
        toast("작업 완료 — 화면 조작이 가능합니다.", "success");
      }
    }
  }
}

async function withUiBusy(label, fn, options = {}) {
  const token = beginUiBusy(label, options);
  try {
    return await fn();
  } finally {
    endUiBusy(token, options);
  }
}

const EXCEL_MIRROR_MAX_CACHED_SESSIONS = 10;
const EXCEL_MIRROR_MAX_ROWS = 1048576;
const EXCEL_MIRROR_MAX_COLS = 16384;
const EXCEL_MIRROR_POLL_MS = 2200;
const EXCEL_MIRROR_FORMULA_POLL_MS = 7000;
const EXCEL_MIRROR_HIDE_IDLE_MS = 5000;

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
  if (!(state.outputTemplates && state.outputTemplates.length) && state.output) {
    files.push({
      id: "output",
      role: "output",
      name: typeof workbookDisplayName === "function" ? workbookDisplayName(state.output, "출력 파일") : (state.output.name || "출력 파일"),
    });
  }
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
        await showOnlyExcelMirrorWindow(existingExcelId, { force: true });
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
      data = await postExcelMirror("/api/excel/open-result", { resultId, liveEditable: true, deferVisible: !!excelMirror.runnerHeadless, ...mirrorRect });
    } else {
      if (!target.file.backendWorkbookId) throw new Error("백엔드 workbookId가 없습니다.");
      // 리모콘 모델(0.4.9): 업로드된 실제 파일의 작업용 복사본을 편집가능 라이브로 연다.
      data = await postExcelMirror("/api/excel/open", { workbookId: target.file.backendWorkbookId, liveEditable: true, deferVisible: !!excelMirror.runnerHeadless, ...mirrorRect });
    }
    excelMirror.sessionsByFileId[target.fileId] = data.excelId;
    excelMirror.sessionLastUsedByFileId[target.fileId] = Date.now();
    excelMirror.activeExcelId = data.excelId;
    suppressExcelMirrorSelection(1000);
    updateMirrorShellStatus(`Excel 연결됨: ${workbookDisplayName(target.file, "파일")}`);
    // [0.5.16 #1] 실행기 헤드리스: 숨겨서 열었으니 표시/토스트 생략(showOnly 는 가드돼 no-op).
    if (!excelMirror.runnerHeadless) toast("실제 Excel 창을 열었습니다.", "success");
    excelMirror.hiddenByExcelId[data.excelId] = !!excelMirror.runnerHeadless;
    await showOnlyExcelMirrorWindow(data.excelId, { force: true });
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

async function openExcelMirrorForFileId(fileId, options = {}) {
  if (fileId && typeof setCurrentView === "function" && excelMirrorAllowsViewSwitch(options)) {
    setCurrentView(fileId, options);
  }
  if (excelMirrorAllowsViewSwitch(options)) {
    await openCurrentWorkbookInExcel();
  } else {
    const excelId = await ensureExcelMirrorSession(fileId, { makeActive: false, deferVisible: true });
    if (!excelId) return null;
  }
  // [필드#4] 초기화(전체 Excel 강제종료) 직후의 첫 오픈은 창이 빈 화면으로 남는 케이스가
  // 보고됨 — 그 부팅에 한해 1초 뒤 한 번 recover 로 재표시를 보정한다(표식은 1회용).
  try {
    if (sessionStorage.getItem("b2bJustReset") === "1") {
      sessionStorage.removeItem("b2bJustReset");
      const justOpenedFileId = fileId;
      setTimeout(() => {
        try {
          // [핫픽스] 1초 사이에 다른 파일로 넘어갔으면(연속 업로드 등) 절대 발화하지 않는다 —
          // 이 복구가 이전 파일을 들어올리며 뷰를 빼앗던 치명 회귀의 원인.
          if (state.currentFileId !== justOpenedFileId) return;
          const excelId = excelMirror.sessionsByFileId[justOpenedFileId];
          if (excelId && typeof recoverExcelMirrorWindow === "function") {
            recoverExcelMirrorWindow(excelId, { skipBaseline: true, preserveView: true }).catch(() => {});
          }
        } catch (_) {}
      }, 1000);
    }
  } catch (_) {}
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
  if (!(state.outputTemplates && state.outputTemplates.length) && state.output) {
    ids.push("output");
  }
  return ids;
}

function excelMirrorAllowsViewSwitch(options) {
  return typeof isExplicitViewSwitchSource === "function" && isExplicitViewSwitchSource(options);
}

// 지정한 파일의 미러 세션을 보장(없으면 연다). 활성화/최상단 올리기는 makeActive 일 때만.
// 다른 미러를 숨기지 않으므로 모두 같은 위치에 스택된다.
async function ensureExcelMirrorSession(fileId, { makeActive = false, deferVisible = false } = {}) {
  if (excelMirror.runnerHeadless) { deferVisible = true; makeActive = false; }  // [0.5.16 #1] 실행기 헤드리스: 숨겨서 열고 표시 안 함
  if (!fileId) return null;
  const file = typeof getFile === "function" ? getFile(fileId) : null;
  if (!file) return null;
  let excelId = excelMirror.sessionsByFileId[fileId];
  if (excelId) {
    if (makeActive) {
      excelMirror.activeExcelId = excelId;
      excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
      await showOnlyExcelMirrorWindow(excelId, { force: true });
      await pollExcelMirrorChanges(excelId, { baselineOnly: true });
    }
    return excelId;
  }
  const mirrorRect = excelMirrorScreenRect() || {};
  let data;
  if (file.backendDownloadUrl && isBackendResultDownloadUrl(file.backendDownloadUrl)) {
    const resultId = extractResultIdFromDownloadUrl(file.backendDownloadUrl);
    // 리모콘 모델(0.4.9): 업로드 자동 열기도 작업용 복사본을 편집가능 라이브로 연다.
    data = await postExcelMirror("/api/excel/open-result", { resultId, liveEditable: true, deferVisible, ...mirrorRect });
  } else {
    if (!file.backendWorkbookId) throw new Error("백엔드 workbookId가 없습니다.");
    data = await postExcelMirror("/api/excel/open", {
      workbookId: file.backendWorkbookId,
      liveEditable: true,
      deferVisible,
      // [새로고침 즉시복원] 새로고침 복원 중이고 '스킬 적용 끝난 사본'이 서버에 있으면 그걸로 연다
      // (없으면 서버가 조용히 원본으로 연다). 평소에는 빈 값이라 기존 동작 그대로.
      fromStateSig: excelMirror.restoreFromStateSig || "",
      ...mirrorRect,
    });
  }
  excelMirror.sessionsByFileId[fileId] = data.excelId;
  excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
  excelMirror.hiddenByExcelId[data.excelId] = !!deferVisible;
  // [실행기 오버레이 수정 2026-08-04] deferVisible 은 '요청 시점' 값으로 굳는다 — 요청이 서버에
  // 줄 서 있는 동안 사용자가 실행기(헤드리스)로 이동하면, 보이게 열린 창이 실행기 화면 위로 뜬다.
  // 응답 시점에 헤드리스면 방금 연 세션을 즉시 숨겨 사후 정리한다(가드들은 멱등이라 안전).
  if (!deferVisible && excelMirror.runnerHeadless) {
    excelMirror.hiddenByExcelId[data.excelId] = true;
    try { await hideAllExcelMirrorWindows(); } catch (_) {}
    return data.excelId;
  }
  if (!deferVisible) {
    await positionExcelMirrorWindow(data.excelId, { force: true });
    await pollExcelMirrorChanges(data.excelId, { baselineOnly: true });
  }
  if (makeActive) {
    excelMirror.activeExcelId = data.excelId;
    if (deferVisible) {
      await showOnlyExcelMirrorWindow(data.excelId, { force: true });
    } else {
      stabilizeExcelMirrorZOrder(data.excelId);
    }
  }
  return data.excelId;
}

// 업로드 직후: 모든 파일의 미러를 미리 열어 같은 위치에 스택해 둔다.
// 이후 탭/보기 전환은 선택된 미러를 z-order 최상단으로 올리기만 하면 되어 깜빡임이 없다.
// 저사양 개선: 선택 파일을 '먼저' 열어 즉시 표시하고, 나머지는 백그라운드로 순차 오픈한다.
// (기존: 전부 연 뒤에야 표시 → 파일 수 × 오픈시간 동안 빈 화면)
async function preopenAllExcelMirrors(selectedFileId, options = {}) {
  const ids = listAllWorkbookFileIds();
  if (!ids.length) return;
  const selected = selectedFileId || state.currentFileId || ids[ids.length - 1];
  const rest = ids.filter(id => id !== selected);
  const total = rest.length + 1;
  const failures = [];
  // 재진입 가드: 새 preopen 이 시작되면 이전 백그라운드 오픈 루프는 중단한다.
  const seq = (excelMirror.preopenSeq = (excelMirror.preopenSeq || 0) + 1);
  excelMirror.preopening = true;
  // 업로드는 명시적 사용자 동작 → preopen 동안 호스트를 활성으로 간주해
  // 자동숨김(periodic)이 방금 연 미러들을 park(숨김) 하지 못하게 한다.
  excelMirror.hostActive = true;
  publishNativeExcelLoading(true, `Excel 창 준비 중... (1/${total})\n컴퓨터 성능에 따라 다소 지연될 수 있습니다`);
  try {
    // 1) 선택 파일 먼저: 열자마자 표시해 업로드 직후 빈 화면 시간을 최소화.
    try {
      await ensureExcelMirrorSession(selected, { makeActive: false, deferVisible: true });
    } catch (err) {
      failures.push({ fileId: selected, error: err });
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror preopen failed:", selected, err);
    }
    if (typeof setCurrentView === "function" && excelMirrorAllowsViewSwitch(options)) {
      setCurrentView(selected, options);
    }
    const selExcelId = excelMirror.sessionsByFileId[selected];
    if (selExcelId) {
      try {
        await showOnlyExcelMirrorWindow(selExcelId, { force: true });
        scheduleExcelMirrorBaselinePoll(selExcelId, 700);
      } catch (err) {
        if (!isMissingExcelSessionError(err)) console.warn("Excel mirror first show failed:", err);
      }
    }
    startExcelMirrorPolling();
  } catch (err) {
    // 1단계가 예외로 빠져도 백그라운드 단계 플래그가 남지 않게 정리 후 전파.
    if (excelMirror.preopenSeq === seq) excelMirror.preopening = false;
    throw err;
  } finally {
    // 선택본이 보이면 로딩 오버레이는 내린다(나머지는 화면 밖에서 조용히 열림).
    publishNativeExcelLoading(false, "");
  }
  // 2) 나머지 파일은 백그라운드 순차 오픈(숨김 상태). 진행률은 상태줄로만 표시.
  try {
    let done = 1;
    for (const fid of rest) {
      if (excelMirror.preopenSeq !== seq) return; // 새 preopen/리셋이 시작됨 → 이 루프 중단
      updateMirrorShellStatus(`다른 파일 Excel 준비 중... (${done}/${total})`);
      try {
        await ensureExcelMirrorSession(fid, { makeActive: false, deferVisible: true });
      } catch (err) {
        failures.push({ fileId: fid, error: err });
        if (!isMissingExcelSessionError(err)) console.warn("Excel mirror preopen failed:", fid, err);
      }
      done += 1;
    }
    // [빈 회색 Excel 수정] 나머지 파일을 백그라운드로 여는 동안 새로 뜬 Excel 창이(deferVisible 로 열어도
    // Excel 이 새 창을 전면에 올려) 선택 미러 위에 '빈 회색'으로 남을 수 있다(파일 1개면 rest 가 없어 이 현상
    // 없음). 모두 연 뒤 선택 창만 다시 확실히 표시해(나머지 재숨김) 정리한다 — 선택은 이미 보이므로 재배치 없이
    // 나머지만 숨긴다(force 없음).
    if (excelMirror.preopenSeq === seq && rest.length && !excelMirror.runnerHeadless) {
      const _sel = excelMirror.sessionsByFileId[selected];
      if (_sel) {
        try { await showOnlyExcelMirrorWindow(_sel); } catch (_) {}
      }
    }
    updateMirrorShellStatus();
    if (failures.length) {
      const msg = `${failures.length}개 파일의 Excel 창을 열지 못했습니다. 파일 목록에서 다시 확인해 주세요.`;
      updateMirrorShellStatus(msg);
      if (typeof toast === "function") toast(msg, "error");
    }
    return { opened: total - failures.length, failed: failures.length, failures };
  } finally {
    if (excelMirror.preopenSeq === seq) excelMirror.preopening = false;
  }
}

// 호환용 진입점: 업로드 직후에는 현재 파일만 열어 화면 순회/깜빡임을 막는다.
async function autoOpenMirrorAfterUpload(selectedFileId) {
  return preopenAllExcelMirrors(selectedFileId, { source: "upload" });
}

async function switchVisibleExcelMirrorToFileId(fileId) {
  const _busyTok = typeof beginUiBusy === "function" ? beginUiBusy("Excel 탭 전환 중...", { showDelayMs: 180, silentComplete: true }) : null;
  // [전환 침묵 실패 금지] 실측(12:52): 재현 실패 직후 탭 클릭 15회가 전부 40ms 만에 조용히
  // return false — 사용자는 "파일 전환 안됨"으로만 인지, 로그엔 원인 없음. 실패 사유를
  // 트레이스+토스트로 반드시 노출한다(진단 가능하게).
  const _fail = (reason, err) => {
    try {
      if (typeof traceClientUiEvent === "function") traceClientUiEvent("mirror.switch.fail", {
        fileId: String(fileId || ""), reason: String(reason || ""),
        error: String((err && err.message) || err || "").slice(0, 200),
      });
    } catch (_) {}
    try {
      if (typeof toast === "function") toast("파일 전환 실패(" + reason + ")"
        + ((err && err.message) ? " — " + err.message : "") + ". 다시 클릭하면 재시도합니다.", "error");
    } catch (_) {}
    updateMirrorShellStatus();
    return false;
  };
  try {
  if (!fileId) return false;
  let excelId = excelMirror.sessionsByFileId[fileId];
  if (!excelId) {
    const file = typeof getFile === "function" ? getFile(fileId) : null;
    const url = file && file.backendDownloadUrl;
    if (url && isBackendResultDownloadUrl(url) && typeof refreshExcelMirrorForFileId === "function") {
      try {
        return await refreshExcelMirrorForFileId(fileId, url, {
          openIfMissing: true,
          preserveFocus: true,
          raiseAfter: true,
        });
      } catch (err) {
        if (!isMissingExcelSessionError(err)) console.warn("Excel mirror result open failed:", err);
      }
    }
    let _openErr = null;
    try {
      excelId = await ensureExcelMirrorSession(fileId, { makeActive: true });
    } catch (err) {
      _openErr = err;
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror lazy open failed:", err);
    }
    if (!excelId) return _fail("세션 열기 실패", _openErr);
  }
  // 적용으로 변경됐지만 표시 안 한 입력/출력 미러(stale)는 전환 시 최신 결과로 교체.
  if (excelMirror.staleByFileId && excelMirror.staleByFileId[fileId]) {
    delete excelMirror.staleByFileId[fileId];
    const file = typeof getFile === "function" ? getFile(fileId) : null;
    const url = file && file.backendDownloadUrl;
    if (url && isBackendResultDownloadUrl(url) && typeof refreshExcelMirrorForFileId === "function") {
      try {
        const refreshed = await refreshExcelMirrorForFileId(fileId, url, {
          openIfMissing: false,
          preserveFocus: true,
          raiseAfter: true,
        });
        if (refreshed) return true;
      } catch (err) {
        if (!isMissingExcelSessionError(err)) console.warn("Excel mirror stale refresh failed:", err);
      }
    }
  }
  try {
    if (typeof traceClientUiEvent === "function") traceClientUiEvent("mirror.switch.ok", {
      fileId: String(fileId || ""), toExcelId: String(excelId || ""),
      fromExcelId: String(excelMirror.activeExcelId || ""),
    });
  } catch (_) {}
  excelMirror.activeExcelId = excelId;
  excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
  // 탭 연타 가드: 이 전환이 끝나기 전에 새 전환이 시작됐으면(seq 변경) 후속 처리를 건너뛴다.
  // (서버 show-only 는 COM 큐에서 순서대로 실행되므로 마지막 전환이 최종 상태를 결정)
  const seq = (excelMirror.switchSeq = (excelMirror.switchSeq || 0) + 1);
  await showOnlyExcelMirrorWindow(excelId);
  if (excelMirror.switchSeq !== seq) return true;
  scheduleExcelMirrorBaselinePoll(excelId, 700);
  startExcelMirrorPolling();
  updateMirrorShellStatus();
  return true;
  } finally {
    if (_busyTok && typeof endUiBusy === "function") endUiBusy(_busyTok, { silentComplete: true });
  }
}

async function openExcelMirrorResultForFileId(fileId, downloadUrl, options = {}) {
  const resultId = extractResultIdFromDownloadUrl(downloadUrl);
  if (!fileId || !resultId) return false;
  if (!options.preserveFocus && typeof setCurrentView === "function" && excelMirrorAllowsViewSwitch(options)) {
    setCurrentView(fileId, options);
  }
  const data = await postExcelMirror("/api/excel/open-result", { resultId, liveEditable: true, ...(excelMirrorScreenRect() || {}) });
  excelMirror.sessionsByFileId[fileId] = data.excelId;
  excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
  excelMirror.activeExcelId = data.excelId;
  excelMirror.hiddenByExcelId[data.excelId] = false;
  updateMirrorShellStatus(`Excel 결과 열림: ${data.name || ""}`);
  excelMirror.mutedUntil = Date.now() + 1000;
  suppressExcelMirrorSelection(3000);
  await showOnlyExcelMirrorWindow(data.excelId, { force: true });
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
      const _reflectT0 = performance.now();
      const data = await postExcelMirror("/api/excel/replace", {
        excelId: existingExcelId,
        resultId,
      });
      // [F8] 결과→Excel 반영(replace) 소요를 단계별로 패널에 기록(close/open/present 는 서버 계측).
      if (typeof window.recordBackendDebugTiming === "function") {
        window.recordBackendDebugTiming({
          action: "reflect(replace)",
          fileId: fileId,
          replaceMs: Math.round(performance.now() - _reflectT0),
          server: data.debugTimings || {},
        });
      }
      excelMirror.sessionsByFileId[fileId] = data.excelId;
      excelMirror.sessionLastUsedByFileId[fileId] = Date.now();
      excelMirror.activeExcelId = data.excelId;
      updateMirrorShellStatus(`Excel 창이 최신 결과로 갱신됨: ${data.name || ""}`);
      excelMirror.mutedUntil = Date.now() + 1000;
      suppressExcelMirrorSelection(3000);
      await positionExcelMirrorWindow(data.excelId, { force: true, keepZorder: !!options.preserveFocus });
      if (options.raiseAfter) {
        await raiseExcelMirrorWindow(data.excelId, { force: true });
      } else if (!options.preserveFocus) {
        stabilizeExcelMirrorZOrder(data.excelId, { allowNative: true });
      }
      await pollExcelMirrorChanges(data.excelId, { baselineOnly: true, syncSelection: false });
      startExcelMirrorPolling();
      return true;
    } catch (err) {
      if (!isMissingExcelSessionError(err)) throw err;
      forgetExcelMirrorSession(existingExcelId);
    }
  }
  if (options.openIfMissing) {
    return openExcelMirrorResultForFileId(fileId, downloadUrl, {
      preserveFocus: !!options.preserveFocus,
      raiseAfter: !!options.raiseAfter,
    });
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
    await openExcelMirrorForFileId(fileId, { source: "session" });
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
  await baselineExcelMirrorSession(excelId, { syncSelection: false });
  excelMirror.mutedUntil = Date.now() + 300;
  excelMirror.selectionMutedUntil = Date.now() + 300;
  updateMirrorShellStatus("열려 있는 Excel 창에 적용되었습니다.");
  startExcelMirrorPolling();
  return true;
}

async function baselineExcelMirrorSession(excelId, options = {}, attempts = 8) {
  if (typeof options === "number") {
    attempts = options;
    options = {};
  }
  if (!excelId) return null;
  for (let i = 0; i < attempts; i++) {
    if (!excelMirror.polling) {
      return await pollExcelMirrorChanges(excelId, {
        baselineOnly: true,
        syncSelection: options.syncSelection !== false,
      });
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return null;
}

function currentExcelId() {
  const target = currentExcelMirrorTarget();
  if (target) return excelMirror.sessionsByFileId[target.fileId] || null;
  if (state.currentFileId) return null;
  return excelMirror.activeExcelId;
}

function fileIdForExcelMirrorId(excelId) {
  if (!excelId) return null;
  for (const [fileId, sessionExcelId] of Object.entries(excelMirror.sessionsByFileId || {})) {
    if (sessionExcelId === excelId) return fileId;
  }
  return null;
}

function forgetExcelMirrorSession(excelId) {
  if (!excelId) return;
  Object.keys(excelMirror.sessionsByFileId).forEach(fileId => {
    if (excelMirror.sessionsByFileId[fileId] === excelId) {
      delete excelMirror.sessionsByFileId[fileId];
      delete excelMirror.sessionLastUsedByFileId[fileId];
    }
  });
  delete excelMirror.hiddenByExcelId[excelId];
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
  delete excelMirror.hiddenByExcelId[excelId];
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

async function hideInactiveExcelMirrorSessions(activeFileId, options = {}) {
  const light = !!options.light;
  const entries = Object.entries(excelMirror.sessionsByFileId);
  await Promise.all(entries.map(async ([fileId, excelId]) => {
    if (!excelId || fileId === activeFileId) return;
    // 빠른 연속 탭 클릭 레이스 가드: 보내는 시점에 활성이 된 세션은 숨기지 않는다.
    if (excelId === excelMirror.activeExcelId) return;
    if (!light) {
      invalidateExcelMirrorPositionTracking(excelId);  // 하드 숨김은 위치를 흐트러뜨림 → 다음 전환 시 재배치
    }
    try {
      await postExcelMirror("/api/excel/hide", { excelId });
      excelMirror.hiddenByExcelId[excelId] = true;
    } catch (err) {
      console.warn("Failed to hide inactive Excel mirror:", err);
    }
  }));
}

async function hideAllExcelMirrorWindows(options = {}) {
  invalidateExcelMirrorPositionTracking();  // 전부 숨김 → 위치 추적 전체 무효화
  const entries = Object.entries(excelMirror.sessionsByFileId);
  if (!entries.length) return;
  try {
    // 세션별 N회 왕복(hide × N) 대신 서버 일괄 엔드포인트 1회 — 적용 시작 지연이
    // 세션 수와 무관해진다(저사양에서 세션당 큐 작업 비용 × N 절감). 동작은 동일.
    // timeoutMs 필수 — 미지정 시 서버 COM 교착으로 응답이 없으면 prehide 가 무한 대기해
    // 적용 화면이 멈춘다(붙여넣기 적용 시 멈춤). 지연 시 숨김은 건너뛰고 적용을 진행. [#16]
    await postExcelMirror("/api/excel/hide-all", {}, 0, {
      timeoutMs: 15000,
      timeoutMessage: "미러 숨김이 지연되어 건너뜁니다.",
    });
    entries.forEach(([fileId, excelId]) => {
      if (excelId) excelMirror.hiddenByExcelId[excelId] = true;
    });
  } catch (err) {
    if (!isMissingExcelSessionError(err)) console.warn("Failed to hide Excel mirrors:", err);
  }
}

function clearExcelMirrorClientState() {
  // [0.5.2.2] 라이브 세션이 사라지면 no-op 생략 시그니처를 무효화 — 다음 편집은 반드시 실제 재적용.
  if (typeof invalidateLivePipelineApplied === "function") { try { invalidateLivePipelineApplied(); } catch (_) {} }
  stopExcelMirrorPolling();
  // 진행 중인 preopen 백그라운드 루프가 있다면 seq 를 올려 즉시 중단시킨다.
  excelMirror.preopenSeq = (excelMirror.preopenSeq || 0) + 1;
  excelMirror.preopening = false;
  clearInterval(excelMirror.applyLoadingTimer);
  excelMirror.sessionsByFileId = {};
  excelMirror.sessionLastUsedByFileId = {};
  excelMirror.activeExcelId = null;
  excelMirror.lastSelectionByExcelId = {};
  excelMirror.hiddenByExcelId = {};
  excelMirror.pendingChatRange = null;
  excelMirror.positionedKeyByExcelId = {};
  excelMirror.lastPositionKey = "";
  excelMirror.lastNativePositionKey = "";
  excelMirror.zOrderTimers.forEach(timer => clearTimeout(timer));
  excelMirror.zOrderTimers = [];
  clearTimeout(excelMirror.switchTimer);
  clearTimeout(excelMirror.restoreTimer);
  clearTimeout(excelMirror.baselinePollTimer);
  clearTimeout(excelMirror.positionTimer);
  clearTimeout(excelMirror.hideTimer);
  excelMirror.switchTimer = null;
  excelMirror.restoreTimer = null;
  excelMirror.baselinePollTimer = null;
  excelMirror.positionTimer = null;
  excelMirror.hideTimer = null;
  excelMirror.applying = false;
  excelMirror.applyLoadingTimer = null;
  if (typeof publishNativeExcelLoading === "function") publishNativeExcelLoading(false, "");
  updateMirrorShellStatus();
}

async function closeAllExcelMirrorSessions() {
  try {
    await postExcelMirror("/api/excel/close-all-async", {});
  } catch (err) {
    if (!isMissingExcelSessionError(err)) console.warn("Failed to close all Excel mirrors:", err);
  } finally {
    clearExcelMirrorClientState();
  }
}

// 초기화(전부 폐기)용 강제 정리: graceful 닫기(워크북별 wb.Close, 대형 파일은 건당 수 초 +
// COM 큐 점유 → 직후 재업로드가 그 뒤에 줄섬) 대신, 큐를 우회해 EXCEL.EXE 를 즉시 종료한다.
// 작업복사본 + SaveChanges:=False 폐기라 의미는 동일하고, 모든 창이 한 번에 사라진다.
// '문서 복구' 창 방지는 열 때마다 wb.EnableAutoRecover=False 로 처리(excel_workbooks_open).
// forceRestartExcelMirrors 와 달리 재오픈을 하지 않는다(초기화는 상태를 비우는 동작).
async function forceCloseAllExcelMirrorSessions() {
  clearExcelMirrorClientState(); // 타이머/세션 매핑부터 즉시 차단(초기화 UI 와 동기)
  try {
    await postExcelMirror("/api/excel/force-restart", {});
  } catch (err) {
    if (!isMissingExcelSessionError(err)) console.warn("Excel force close failed:", err);
  }
  return true;
}

function restoreExcelMirrorIdFromOptions(options = {}) {
  if (options.restoreExcelId) return options.restoreExcelId;
  if (options.restoreFileId && excelMirror.sessionsByFileId) {
    const byFile = excelMirror.sessionsByFileId[options.restoreFileId];
    if (byFile) return byFile;
  }
  return null;
}

async function restoreActiveExcelMirrorWindow(options = {}) {
  if (excelMirror.runnerHeadless) return false;  // [0.5.16 #1] 실행기 헤드리스: 미러 복원(위치/raise) 안 함
  if (isNativeExcelShell() && options.preserveFocus) {
    return false;
  }
  const target = currentExcelMirrorTarget();
  const explicitExcelId = restoreExcelMirrorIdFromOptions(options);
  const excelId = explicitExcelId || (target
    ? (excelMirror.sessionsByFileId[target.fileId] || null)
    : (state.currentFileId ? null : excelMirror.activeExcelId));
  if (!excelId) return false;
  if (Date.now() < (excelMirror.uiClickGuardUntil || 0)) return false;
  const restoreFileId = options.restoreFileId || (typeof fileIdForExcelMirrorId === "function" ? fileIdForExcelMirrorId(excelId) : null);
  if (restoreFileId) {
    excelMirror.activeExcelId = excelId;
    excelMirror.sessionLastUsedByFileId[restoreFileId] = Date.now();
  }
  // 엑셀↔채팅 토글 복귀 시 강제 재배치(force)를 하면 저사양 PC에서 재배치가 느려 3초가량 깜빡인다.
  // 위치가 그대로면(force 없이) position 은 건너뛰고 raise 만 → 깜빡임 없이 즉시 올라온다.
  // (창이 실제로 이동/숨겨졌으면 lastNativePositionKey 가 달라져 자동으로 재배치된다.)
  await positionExcelMirrorWindow(excelId, { keepZorder: !!options.preserveFocus });
  if (!options.preserveFocus) await raiseExcelMirrorWindow(excelId);
  return true;
}

async function recoverExcelMirrorWindow(excelId = currentExcelId() || excelMirror.activeExcelId, options = {}) {
  if (excelMirror.runnerHeadless) return false;  // [0.5.16 #1] 실행기 헤드리스: Excel 복구/표시 안 함(전체실행 후 폴링이 이걸 불러 떠버림)
  const _rbusy = typeof beginUiBusy === "function" ? beginUiBusy("Excel 창 복구 중...", { showDelayMs: 120, silentComplete: true }) : null;
  try {
  if (!excelId) return false;
  const rect = excelMirrorScreenRect();
  if (!rect) return false;
  excelMirror.activeSyncMutedUntil = Date.now() + 1500;
  excelMirror.lastUserSwitchAt = Date.now();
  invalidateExcelMirrorPositionTracking(excelId);
  const data = await postExcelMirror("/api/excel/recover", { excelId, ...rect });
  // 복구도 같은 게이트 아래다 — 건너뛴 응답에 '보임'을 찍으면 파킹된 창을 보인다고 기록해
  // 이후 showOnly 가 재배치를 생략한다(회색 화면 재현 경로).
  if (data && data.skipped) return false;
  const activeExcelId = data.activeExcelId || data.excelId || excelId;
  const activeFileId = fileIdForExcelMirrorId(activeExcelId);
  if (activeFileId) {
    excelMirror.activeExcelId = activeExcelId;
    excelMirror.sessionLastUsedByFileId[activeFileId] = Date.now();
    // 복구는 Excel 창 상태만 보정하고, 사용자가 보던 앱 탭은 바꾸지 않는다.
  } else {
    excelMirror.activeExcelId = activeExcelId;
  }
  const key = `${activeExcelId}:${rect.left}:${rect.top}:${rect.width}:${rect.height}`;
  excelMirror.positionedKeyByExcelId = excelMirror.positionedKeyByExcelId || {};
  excelMirror.positionedKeyByExcelId[activeExcelId] = key;
  excelMirror.hiddenByExcelId[activeExcelId] = false;
  (data.hiddenIds || []).forEach(id => {
    if (id) excelMirror.hiddenByExcelId[id] = true;
  });
  if (data.address) {
    syncSelectionFromExcel(data.sheet, data.address, { fileId: activeFileId, excelId: activeExcelId });
  }
  if (!options.skipBaseline) scheduleExcelMirrorBaselinePoll(activeExcelId, 300);
  updateMirrorShellStatus(data.reopened ? "Excel 창을 복구해 다시 열었습니다." : "Excel 창을 복구했습니다.");
  if (data.reopened) maybeAutoReapplyAfterRecover(activeExcelId);
  return true;
  } finally {
    if (_rbusy && typeof endUiBusy === "function") endUiBusy(_rbusy, { silentComplete: true });
  }
}

// 복구가 워크북을 '파일에서 다시 열었다'(reopened) = 메모리에 적용돼 있던 스킬 결과가
// 사라진 상태. 파이프라인은 '적용됨'인데 화면은 원본이라 어긋나므로, 적용된 VBA 스텝을
// 자동으로 재적용해 상태를 일치시킨다. (반복 실패 루프 방지를 위해 쿨다운 2분)
// [적용됨-미반영 괴리] 창을 다시 열었는데(=라이브는 pristine 원본) 자동재적용이 스킵되면,
// 파이프라인은 여전히 '적용됨'으로 표시되고 step._preApplySnapshot(죽은 세션 id)·resume 인덱스도
// 살아남는다. 그 상태에서 다음 스킬을 적용하면 reset:false 로 '원본 위에' 그 스텝만 실행돼,
// 앞 스텝 결과(정렬/필터)를 전제로 한 계산이 조용히 틀린 값을 낸다(가장 위험한 실패 모드).
// → 재적용을 못 했으면 상태를 사실대로 되돌린다(적용됨 표시 해제 + 스냅샷/이어실행 폐기).
function markLivePipelineOutOfSync(reason) {
  try {
    const steps = (state.pipeline || []).filter(s => s && s.code);
    if (!steps.length) return;
    if (typeof setPipelineRuntimeStatus === "function") {
      setPipelineRuntimeStatus(steps.map(s => s.id), null);
    }
    steps.forEach(s => { if (s._preApplySnapshot) delete s._preApplySnapshot; });
    if (typeof setPipelineResumeFromIndex === "function") setPipelineResumeFromIndex(null);
    else window.__pipelineResumeFromIndex = null;
    if (typeof invalidateLivePipelineApplied === "function") invalidateLivePipelineApplied();
    if (typeof renderPipeline === "function") renderPipeline();
    if (typeof refreshRunButton === "function") refreshRunButton();
    if (typeof toast === "function") {
      toast("Excel 창을 다시 열어 적용 상태가 풀렸습니다. '전체실행'으로 다시 적용해 주세요.", "error");
    }
    traceClientUiEvent("pipeline.live_out_of_sync", { reason: String(reason || ""), steps: steps.length });
  } catch (_) {}
}

function maybeAutoReapplyAfterRecover(excelId) {
  try {
    if (!excelId) return;
    const steps = (state.pipeline || []).filter(s => s && s.enabled !== false && s.code);
    if (!steps.length) return;
    if (typeof pipelineUsesLiveSkill === "function") {
      if (!pipelineUsesLiveSkill(state.pipeline)) return;
    } else if (typeof pipelineUsesVba === "function" && !pipelineUsesVba(state.pipeline)) {
      return;
    }
    const now = Date.now();
    if (now < (excelMirror.autoReapplyBlockedUntil || 0)) return markLivePipelineOutOfSync("cooldown");
    excelMirror.autoReapplyBlockedUntil = now + 120000;
    if (typeof reapplyVbaPipelineToLive !== "function") return markLivePipelineOutOfSync("no-reapply");
    if (typeof toast === "function") toast("Excel 창을 다시 열어, 적용돼 있던 스킬을 자동으로 재적용합니다.", "success");
    reapplyVbaPipelineToLive(excelId).catch(err => {
      console.warn("auto reapply after recover failed:", err);
      if (typeof toast === "function") toast("자동 재적용에 실패했습니다. 실행 버튼으로 다시 적용해 주세요.", "error");
    });
  } catch (_) {}
}

// ---- COM 응답불능(행) 자동 복구: 단일 Excel 인스턴스의 유일한 약점 보호 ----
// 공유 EXCEL.EXE 가 모달/행으로 굳으면 모든 요청이 "COM 작업이 N초 안에 끝나지 않았습니다"로
// 타임아웃되고, 복구 API 조차 같은 큐에 줄을 서서 영영 못 들어간다. 짧은 시간 안에 이 타임아웃이
// 반복되면 큐를 우회하는 강제 재시작(/api/excel/force-restart)으로 탈출한다.
function noteExcelComTimeout(err) {
  try {
    const msg = String((err && err.message) || "");
    if (!/COM 작업이 .*초 안에 끝나지 않았습니다/.test(msg)) return;
    // [녹화 보호] 녹화 중에는 서버가 매크로 레코더로 COM 을 의도적으로 블록/지연시킬 수 있다 —
    // 이때의 타임아웃을 '행(hang)'으로 오판해 강제 재시작하면 공유 라이브 Excel 이 죽어 진행 중
    // 녹화가 통째로 유실된다(실측 2026-07-28: 시작~정지 사이 사망 → harvested=0). 워치독을 끈다.
    if (typeof globalThis !== "undefined" && globalThis.__excelRecordingActive) return;
    // 적용/업로드 중의 타임아웃은 '바쁨'일 가능성이 높으므로 행 판정에서 제외.
    if (excelMirror.applying || excelMirror.preopening) return;
    const now = Date.now();
    const recent = (excelMirror.comTimeoutTimes || []).filter(t => now - t < 90000);
    recent.push(now);
    excelMirror.comTimeoutTimes = recent;
    if (recent.length >= 2 && now > (excelMirror.forceRestartCooldownUntil || 0)) {
      excelMirror.forceRestartCooldownUntil = now + 180000;
      excelMirror.comTimeoutTimes = [];
      forceRestartExcelMirrors("Excel이 계속 응답하지 않아 자동으로 재시작합니다. 잠시만 기다려 주세요...").catch(() => {});
    }
  } catch (_) {}
}

async function forceRestartExcelMirrors(reason) {
  // [녹화 보호] 녹화 중에는 어떤 경로로 불려도 강제 재시작하지 않는다 — 공유 라이브 Excel 이 죽어
  // 진행 중 녹화가 통째로 유실된다(서버도 동일 사유로 스킵하지만, 클라 UI 교란/재오픈까지 막는다).
  if (typeof globalThis !== "undefined" && globalThis.__excelRecordingActive) {
    try { console.warn("[record] 녹화 중 강제 재시작 요청 무시:", reason || ""); } catch (_) {}
    return false;
  }
  // [0.5.2.2] 라이브 세션이 사라지면 no-op 생략 시그니처를 무효화 — 다음 편집은 반드시 실제 재적용.
  if (typeof invalidateLivePipelineApplied === "function") { try { invalidateLivePipelineApplied(); } catch (_) {} }
  if (excelMirror.forceRestarting) return false;
  excelMirror.forceRestarting = true;
  try {
    if (typeof toast === "function") toast(reason || "Excel을 강제로 재시작합니다...", "error");
    try {
      await fetch("/api/excel/force-restart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } catch (_) {}
    clearExcelMirrorClientState();
    const current = state.currentFileId;
    const hasFiles = (state.inputs && state.inputs.length) || (state.outputTemplates && state.outputTemplates.length) || state.output;
    if (hasFiles && typeof preopenAllExcelMirrors === "function") {
      await preopenAllExcelMirrors(current);
      if (typeof toast === "function") toast("Excel 창을 다시 준비했습니다.", "success");
      // 강제재시작은 항상 재오픈(=적용분 유실)이므로, 복구 경로와 '동일한 단일 자동재적용기'를 쓴다.
      // (쿨다운 autoReapplyBlockedUntil 공유 → recover 경로와 이중 재적용 방지. await 안 함: 재시작 큐 차단 방지.)
      if (typeof maybeAutoReapplyAfterRecover === "function") {
        maybeAutoReapplyAfterRecover(excelMirror.activeExcelId || (typeof currentExcelId === "function" ? currentExcelId() : null));
      }
    }
    return true;
  } finally {
    excelMirror.forceRestarting = false;
  }
}

// (중복 제거) 과거 forceRestart 전용 maybeAutoReapplyAfterRestart 는 복구 경로의 maybeAutoReapplyAfterRecover
// 로 통합됨 — 쿨다운(autoReapplyBlockedUntil)·재적용기(reapplyVbaPipelineToLive)를 공유해 이중 적용을 막는다.

// ---- 적용 중 로딩 애니메이션 (이슈: 적용 중엔 미러가 안 보이므로 엑셀 영역에 로딩 표시) ----
const EXCEL_MIRROR_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// [#19] 작업 중단 버튼은 작업 중인 채팅 말풍선의 액션 버튼 옆에 붙인다.
// 이전 버전의 전역 floating 버튼은 남아 있더라도 숨김 처리만 한다.
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
    const vbaActive = window.__activeVbaApply && window.__activeVbaApply.token && !window.__activeVbaApply.token.cancelled;
    if (!vbaActive && window.__activeBackendPipelineJobId && typeof cancelActiveBackendPipeline === "function") {
      btn.disabled = true; btn.textContent = "중단 중...";
      Promise.resolve(cancelActiveBackendPipeline()).catch(() => {}).then(() => { btn.disabled = false; btn.textContent = "■ 작업 중단"; });
      return;
    }
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
  // [#19 재수리] 채팅 말풍선으로 옮기며 전역 버튼을 무조건 숨기던 잔해 → 토글/삭제발 적용처럼
  // 말풍선이 없는 경로에서 "작업 중"인데 중단 버튼이 어디에도 없던 문제를 고친다.
  // VBA 취소 토큰이 활성일 때만 표시(python 백엔드 잡은 중단 API 없음).
  const btn = _ensureExcelCancelButton();
  if (!btn) return;
  if (!show) { btn.style.display = "none"; return; }
  const sync = () => {
    const a = window.__activeVbaApply;
    const hasVba = !!(a && a.token && !a.token.cancelled);
    const hasJob = !!window.__activeBackendPipelineJobId;
    btn.style.display = (excelMirror.applying && (hasVba || hasJob)) ? "" : "none";
  };
  sync();
  setTimeout(sync, 150);  // begin 이 토큰 등록보다 먼저 불려도 잡히게 한 번 더
}

// 적용 시작: 모든 미러 창을 숨기고(park) 네이티브 패널의 로딩 애니메이션을 돌린다.
// (미러를 숨겨야 적용 중 여러 Excel 창이 앞으로 튀어나오지 않고, 패널의 로딩 표시가 보인다.)
function beginExcelMirrorApplyLoading(message, options = {}) {
  traceClientUiEvent("excel.apply_loading.begin", {
    message: message || "적용 반영 중...",
    requestedFailsafeMs: options.failsafeMs || "",
    existingToken: !!excelMirror.applyBusyToken,
    forceHideWindows: options.forceHideWindows === true,
    hideWindowsOption: options.hideWindows,
  });
  excelMirror.applying = true;
  // [적대 검증 2026-08-13] 중첩 카운트. 예전엔 begin 이 토큰만 안 만들고 end 는 무조건 닫아서,
  // 바깥 잠금 구간(예: '결과를 라이브에 반영 중') 안에서 도는 내부 경로가 자기 end 로 바깥
  // 잠금을 먼저 열어 버렸다 — 작업이 한창인데 화면이 풀린다.
  excelMirror.applyDepth = (excelMirror.applyDepth || 0) + 1;
  excelMirror.applyDepthTouchedAt = Date.now();   // 짝이 깨졌을 때의 강제 해제 판정용(아래 end 참조)
  // [제보 2026-08-24] 실측 로그가 begin 12 / end 10 이었는데, '어느 begin 이 안 닫혔는지'를
  // 알 수단이 없어 누수 지점을 못 찾았다. 열려 있는 잠금의 라벨을 들고 있다가 강제 해제 때
  // 그대로 찍는다 — 다음 로그 한 줄로 범인이 지목된다(step.code.full 과 같은 접근).
  try {
    excelMirror.applyOpenLabels = excelMirror.applyOpenLabels || [];
    excelMirror.applyOpenLabels.push({ label: String(message || "").slice(0, 60), at: Date.now() });
    if (excelMirror.applyOpenLabels.length > 20) excelMirror.applyOpenLabels.shift();
  } catch (_) {}
  if (!excelMirror.applyBusyToken && typeof beginUiBusy === "function") {
    excelMirror.applyBusyToken = beginUiBusy(message || "적용 반영 중...", {
      showDelayMs: 120,
      failsafeMs: Math.max(90000, Number(options.failsafeMs || 130000)),
      stopLabel: "작업 중단",
      stoppingLabel: "중단 중...",
      // [검증패치#1] 말풍선 '작업 중단' 버튼과 완전히 같은 로직을 쓴다(버튼 복사).
      // 이전 버전은 토큰이 아직 등록되지 않은 찰나에 누르면 forceRestart(Excel 강제 재시작)로
      // 빠져 '중단'이 세션 전체 재시작처럼 동작했다 — 협조 취소만 수행하고 강제 재시작은 하지 않는다.
      // 결과를 그대로 돌려준다 — false 면 '취소할 대상이 없었다'는 뜻이고, 위 핸들러가 버튼을 되살린다.
      onStop: async () => {
        const vbaActive = window.__activeVbaApply && window.__activeVbaApply.token && !window.__activeVbaApply.token.cancelled;
        if (!vbaActive && window.__activeBackendPipelineJobId && typeof cancelActiveBackendPipeline === "function") {
          await cancelActiveBackendPipeline();
          return true;
        }
        if (typeof requestExcelApplyCancel === "function") return await requestExcelApplyCancel();
        return false;
      },
    });
  }
  if (typeof showExcelApplyCancelButton === "function") showExcelApplyCancelButton(true);
  const label = message || "적용 반영 중...";
  const hideWindows = options.forceHideWindows === true || (!isNativeExcelShell() && options.hideWindows !== false);
  traceClientUiEvent("excel.apply_loading.hide_decision", {
    hideWindows,
    nativeShell: isNativeExcelShell(),
  });
  if (hideWindows && typeof hideAllExcelMirrorWindows === "function") {
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

function endExcelMirrorApplyLoading(options) {
  traceClientUiEvent("excel.apply_loading.end", {
    hadToken: !!excelMirror.applyBusyToken,
    hadTimer: !!excelMirror.applyLoadingTimer,
    applying: !!excelMirror.applying,
  });
  // 중첩됐으면 가장 바깥 end 에서만 실제로 푼다(내부 경로가 바깥 잠금을 먼저 열지 않게).
  excelMirror.applyDepth = Math.max(0, (excelMirror.applyDepth || 0) - 1);
  // [제보 2026-08-24 회색 화면이 안 꺼짐] 중첩 카운트는 begin 과 end 가 정확히 짝을 이룰 때만
  // 성립한다. 실측 로그에서 begin 12 / end 10 으로 2개가 비었고(예외로 빠져나가 end 를 못 부른
  // 경로가 있다), 그러면 깊이가 0 으로 안 내려가 오버레이가 영구히 남는다 — 화면이 회색으로
  // 굳고 분할선도 안 먹는다. 카운트 도입 전에는 아무 end 나 닫아 줘서 이 사고가 없었다.
  // 대칭이 깨져도 회복되게 한다: 깊이가 남아 있어도 마지막 begin 이후 오래 지났으면 강제로 푼다.
  if (excelMirror.applyDepth > 0) {
    const startedAt = Number(excelMirror.applyDepthTouchedAt || 0);
    const stale = startedAt && (Date.now() - startedAt) > 180000;   // 3분 — 정상 적용의 상한 밖
    if (!stale && !(options && options.force)) return;
    traceClientUiEvent("excel.apply_loading.depth_forced", {
      depth: excelMirror.applyDepth, stale: !!stale, forced: !!(options && options.force),
      // 안 닫힌 잠금의 라벨 — 여기가 누수 지점이다.
      open: (excelMirror.applyOpenLabels || []).map(o => o && o.label).filter(Boolean).join(" | ").slice(0, 300),
    });
    excelMirror.applyDepth = 0;   // 짝이 깨진 것 — 여기서 정상화한다
  }
  try { excelMirror.applyOpenLabels = []; } catch (_) {}   // 정상 해제 — 추적 목록 비움
  if (excelMirror.applyBusyToken && typeof endUiBusy === "function") {
    endUiBusy(excelMirror.applyBusyToken, { silentComplete: true });
    excelMirror.applyBusyToken = null;
  }
  if (typeof showExcelApplyCancelButton === "function") showExcelApplyCancelButton(false);
  if (!excelMirror.applying && !excelMirror.applyLoadingTimer) return;
  excelMirror.applying = false;
  if (isNativeExcelShell()) {
    excelMirror.quietUntil = Date.now() + 2500;
  }
  clearInterval(excelMirror.applyLoadingTimer);
  excelMirror.applyLoadingTimer = null;
  if (typeof publishNativeExcelLoading === "function") publishNativeExcelLoading(false, "");
}

function scheduleRestoreActiveExcelMirror(delay = 120, options = {}) {
  clearTimeout(excelMirror.restoreTimer);
  const guardedDelay = Math.max(Number(delay) || 0, Math.max(0, (excelMirror.uiClickGuardUntil || 0) - Date.now()));
  excelMirror.restoreTimer = setTimeout(() => {
    restoreActiveExcelMirrorWindow(options).catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror restore failed:", err);
    });
  }, guardedDelay);
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
    delete excelMirror.hiddenByExcelId[excelId];
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
    await pollExcelMirrorChanges(data.excelId, { baselineOnly: true, syncSelection: false });
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
    const _closed = await postExcelMirror("/api/excel/close", { excelId });
    if (_closed && _closed.keptAliveForRecording) {
      // [녹화 보호] 녹화 중엔 서버가 라이브 세션을 닫지 않고 유지한다(진행 중 녹화 유실 방지).
      // 여기서 매핑을 지우면 살아있는 워크북 창이 클라 관리 밖 '고아'가 돼 회색 창으로 남는다 —
      // 매핑을 유지해 이후 정상 닫힘/전환 관리가 계속 되게 한다.
      return;
    }
    Object.keys(excelMirror.sessionsByFileId).forEach(fileId => {
      if (excelMirror.sessionsByFileId[fileId] === excelId) {
        delete excelMirror.sessionsByFileId[fileId];
        delete excelMirror.sessionLastUsedByFileId[fileId];
        delete excelMirror.hiddenByExcelId[excelId];
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
  // 네이티브 Excel 오버레이에서는 COM 폴링이 셀/채팅 포커스를 끊을 수 있어 보수적으로 둔다.
  excelMirror.pollTimer = setInterval(() => {
    if (document.hidden || excelMirror.hostActive === false) return;
    if (isNativeExcelShell() && Date.now() < (excelMirror.quietUntil || 0)) return;
    const excelId = currentExcelId();
    if (excelId) {
      pollExcelMirrorChanges(excelId).catch(err => console.warn("Excel mirror poll failed:", err));
    }
  }, isNativeExcelShell() ? EXCEL_MIRROR_POLL_MS : 450);
  if (!excelMirror.selectionTimer) {
    // [0.5.17] 행/열/셀 선택 → 채팅 반영을 빠르게. 무거운 changes 폴(2200ms, active-sync=탭 따라가기 포함)과
    // 분리해, 현재 탭의 Selection 만 가볍게 자주 읽는다(탭 전환 로직은 안 건드려 회귀 위험 없음).
    // Selection.Address 읽기는 hover-info(수식표시줄)처럼 포커스를 끊지 않는다.
    excelMirror.selectionTimer = setInterval(() => {
      if (document.hidden || excelMirror.hostActive === false) return;
      if (isNativeExcelShell() && Date.now() < (excelMirror.quietUntil || 0)) return;
      const excelId = currentExcelId();
      if (excelId) pollExcelSelection(excelId).catch(() => {});
    }, isNativeExcelShell() ? 550 : 400);
  }
  if (!excelMirror.formulaInfoTimer) {
    // [#1] 네이티브 셸에서도 수식 표시줄을 갱신한다. hover-info 는 Selection 읽기 + StatusBar 쓰기뿐이라
    // 포커스를 끊지 않는다(changes 폴은 이미 네이티브에서 돈다). 적용 중(quietUntil)엔 건너뛰고,
    // 네이티브에서는 주기를 보수적으로 둔다(COM 부하 최소화).
    const formulaInterval = isNativeExcelShell() ? EXCEL_MIRROR_FORMULA_POLL_MS : 2500;
    excelMirror.formulaInfoTimer = setInterval(() => {
      if (document.hidden || excelMirror.hostActive === false) return;
      if (isNativeExcelShell() && Date.now() < (excelMirror.quietUntil || 0)) return;
      const excelId = currentExcelId();
      if (excelId) {
        pollExcelFormulaInfo(excelId).catch(err => console.warn("Excel formula info poll failed:", err));
      }
    }, formulaInterval);
  }
}

function stopExcelMirrorPolling() {
  if (excelMirror.pollTimer) {
    clearInterval(excelMirror.pollTimer);
    excelMirror.pollTimer = null;
  }
  if (excelMirror.selectionTimer) {
    clearInterval(excelMirror.selectionTimer);
    excelMirror.selectionTimer = null;
  }
  if (excelMirror.formulaInfoTimer) {
    clearInterval(excelMirror.formulaInfoTimer);
    excelMirror.formulaInfoTimer = null;
  }
}

// [0.5.17] 현재 탭의 Selection 만 가볍게 읽어 선택→채팅 반영을 빠르게 한다. active-sync(탭 따라가기)는
// 하지 않으므로(무거운 changes 폴이 담당) 탭 회귀 등 회귀 위험이 없다. 선택이 '바뀐 경우에만' 채팅에 반영.
async function pollExcelSelection(excelId) {
  if (!excelId || excelMirror.selectionPolling) return;
  if (excelMirror.runnerHeadless) return;  // 실행기 헤드리스: 미러 없음
  if (Date.now() < excelMirror.mutedUntil) return;  // 적용/전환 중 억제
  excelMirror.selectionPolling = true;
  try {
    const data = await postExcelMirror("/api/excel/selection", { excelId });
    if (!data || !data.address) return;
    const fileId = fileIdForExcelMirrorId(excelId);
    // 현재 탭의 선택만 반영(다른 탭/스테일 방지). syncSelectionFromExcel 도 동일 가드가 있다.
    if (!fileId || fileId !== state.currentFileId) return;
    const appendToChat = shouldAppendExcelSelectionFromPoll(excelId, data.sheet, data.address, {});
    syncSelectionFromExcel(data.sheet, data.address, { appendToChat, fileId, excelId });
  } catch (err) {
    if (isMissingExcelSessionError(err)) forgetExcelMirrorSession(excelId);
    // 그 외 오류는 조용히(폴 실패는 다음 틱에서 회복)
  } finally {
    excelMirror.selectionPolling = false;
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
  if (excelMirror.runnerHeadless) return;  // [0.5.16 #1] 실행기 헤드리스: active-sync 폴링/표시 안 함
  if (!excelId || excelMirror.polling) return;
  if (!options.baselineOnly && Date.now() < excelMirror.mutedUntil) return;
  excelMirror.polling = true;
  // 이 폴이 '출발한 시각'을 기억한다. 거대 파일에서는 서버 폴 처리가 수 초 걸릴 수 있어,
  // 고정 시간 mute 만으로는 전환 직전에 출발한 응답이 mute 종료 후 도착해 탭을 되돌릴 수 있다.
  const sentAt = Date.now();
  try {
    const data = await postExcelMirror("/api/excel/changes", { excelId });
    if (data.address) {
      const activeExcelId = data.activeExcelId || data.excelId || excelId;
      const syncMuted = Date.now() < (excelMirror.activeSyncMutedUntil || 0);
      const switchedAfterSend = (excelMirror.lastUserSwitchAt || 0) > sentAt;
      if (activeExcelId !== excelId && (syncMuted || switchedAfterSend)) {
        // 전환 이전/직후에 출발한 stale active-sync → 탭/선택 모두 무시(탭 회귀 방지).
        return data;
      }
      const activeFileId = fileIdForExcelMirrorId(activeExcelId);
      // [필드#3] frame 모드의 탭 전환은 no-activate(표시만)라 서버 ActiveWorkbook 이 옛 파일로
      // 남는다. 현재값(level) 기준으로 탭을 맞추면 가드 만료 후 매 폴마다 옛 탭으로 회귀한다 —
      // '변화(edge)'가 있을 때만 따라간다(사용자가 Excel 창을 직접 클릭해 활성화한 경우 등).
      const prevPolledActive = excelMirror.lastPolledActiveExcelId || null;
      excelMirror.lastPolledActiveExcelId = activeExcelId;
      const activeChanged = prevPolledActive !== null && prevPolledActive !== activeExcelId;
      if (activeFileId) {
        excelMirror.sessionLastUsedByFileId[activeFileId] = Date.now();
        if (activeChanged) {
          excelMirror.activeExcelId = activeExcelId;
          // Excel 활성 워크북 변화는 기록만 하고 앱의 현재 탭은 바꾸지 않는다.
        }
      }
      // 탭과 다른(스테일 활성) 파일의 Selection 으로 현재 탭의 선택/멘션을 덮지 않는다.
      if (activeFileId && activeFileId === state.currentFileId) {
        const appendToChat = shouldAppendExcelSelectionFromPoll(activeExcelId, data.sheet, data.address, options);
        syncSelectionFromExcel(data.sheet, data.address, { appendToChat, fileId: activeFileId, excelId: activeExcelId });
      }
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
  const target = currentExcelMirrorTarget();
  const fileId = options.fileId || (target ? target.fileId : state.currentFileId);
  if (!fileId || fileId !== state.currentFileId) return;
  const previousSheet = state.currentSheet;
  const previousFileId = state.currentFileId;
  state.currentSheet = sheet;
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
  if (previousSheet !== sheet || previousFileId !== state.currentFileId) refreshTabs();
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
  if (excelMirror.runnerHeadless) return false;  // [0.5.16 #1] 실행기 헤드리스: Excel 오버레이 배치 안 함
  const rect = excelMirrorScreenRect();
  if (!rect) return false;
  const key = `${excelId}:${rect.left}:${rect.top}:${rect.width}:${rect.height}`;
  excelMirror.positionedKeyByExcelId = excelMirror.positionedKeyByExcelId || {};
  // 세션별 추적: 이 미러가 이미 이 위치에 배치돼 있으면(=숨겨지지 않았음) 재배치를 건너뛴다.
  // 전역 키가 아니라 세션별이라, 다른 파일로 전환해도 그 파일이 제자리면 재배치 COM 을 생략 → 저사양에서 즉시 전환.
  if (!options.force && excelMirror.positionedKeyByExcelId[excelId] === key) return true;
  // keepZorder: z-order 를 바꾸지 않고 위치/크기만(비활성 창 재배치 시 위로 안 튀어나오게).
  const posData = await postExcelMirror("/api/excel/position", { excelId, ...rect, keepZorder: !!options.keepZorder });
  // [캐시 오염 2026-08-13] 호스트가 최소화된 동안 백엔드는 배치 요청을 조용히 건너뛴다
  // (skipped:"host-minimized"). 그 응답까지 '이 위치에 배치됨'으로 캐시하면, 복귀 뒤의 복구가
  // 위 short-circuit(같은 key → return true)에 걸려 창이 파킹된 채 남는다(회색 화면·무반응).
  // 복구 경로(restoreActiveExcelMirrorWindow)가 force 없이 이 함수를 부르므로 여기가 실제 급소다.
  if (posData && posData.skipped) return false;
  excelMirror.positionedKeyByExcelId[excelId] = key;
  if (rect.nativeShell) excelMirror.lastNativePositionKey = key;
  excelMirror.lastPositionKey = key;
  return true;
}

async function showOnlyExcelMirrorWindow(excelId = currentExcelId(), options = {}) {
  if (!excelId) return false;
  if (excelMirror.runnerHeadless) return false;  // [0.5.16 #1] 실행기 헤드리스: Excel 오버레이 표시 안 함
  const rect = excelMirrorScreenRect();
  if (!rect) return false;
  // UI 주도 전환: 이후 잠시 동안 폴링의 active-sync 를 무시하고(이전 탭으로 바운스 방지),
  // 이 시각보다 먼저 출발한 폴 응답의 리다이렉트도 무시한다(거대 파일의 느린 폴 대비).
  excelMirror.activeSyncMutedUntil = Date.now() + 1500;
  excelMirror.lastUserSwitchAt = Date.now();
  const key = `${excelId}:${rect.left}:${rect.top}:${rect.width}:${rect.height}`;
  excelMirror.positionedKeyByExcelId = excelMirror.positionedKeyByExcelId || {};
  // 직전에 숨김/파킹됐던 창은 위치캐시가 같아도 반드시 재배치(화면 밖에 그대로 뜨는 것 방지).
  const wasHidden = !!excelMirror.hiddenByExcelId[excelId];
  const skipPosition = !options.force && !wasHidden && excelMirror.positionedKeyByExcelId[excelId] === key;
  const data = await postExcelMirror("/api/excel/show-only", { excelId, ...rect, skipPosition });
  // [캐시 오염 2026-08-13] 호스트가 최소화된 동안 백엔드는 표시 요청을 조용히 건너뛴다
  // (skipped:"host-minimized"). 그런데 예전엔 그 응답도 성공으로 보고 '배치됨·보임'으로 캐시해,
  // 복귀 뒤의 복구가 캐시에서 short-circuit 돼 창이 파킹된 채 남았다(회색 화면·무반응).
  // 건너뛴 응답은 캐시를 건드리지 않고 실패로 돌려 다음 시도가 다시 배치하게 한다.
  if (data && data.skipped) return false;
  excelMirror.positionedKeyByExcelId[excelId] = key;
  excelMirror.hiddenByExcelId[excelId] = false;
  (data.hiddenIds || []).forEach(id => {
    if (id) excelMirror.hiddenByExcelId[id] = true;
  });
  if (rect.nativeShell) excelMirror.lastNativePositionKey = key;
  excelMirror.lastPositionKey = key;
  return true;
}

function scheduleExcelMirrorBaselinePoll(excelId = currentExcelId(), delay = 500) {
  clearTimeout(excelMirror.baselinePollTimer);
  if (!excelId) return;
  excelMirror.baselinePollTimer = setTimeout(() => {
    if (currentExcelId() !== excelId && excelMirror.activeExcelId !== excelId) return;
    pollExcelMirrorChanges(excelId, { baselineOnly: true }).catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror delayed baseline poll failed:", err);
    });
  }, Math.max(0, Number(delay) || 0));
}

// 미러를 숨기면(park) 위치 추적을 무효화해, 다음 전환 시 다시 배치되도록 한다.
function invalidateExcelMirrorPositionTracking(excelId) {
  if (!excelMirror.positionedKeyByExcelId) return;
  if (excelId) delete excelMirror.positionedKeyByExcelId[excelId];
  else excelMirror.positionedKeyByExcelId = {};
}

async function raiseExcelMirrorWindow(excelId = currentExcelId(), options = {}) {
  if (excelMirror.runnerHeadless) return false;  // [0.5.16 #1] 실행기 헤드리스: Excel 띄우기(raise) 안 함
  if (isNativeExcelShell() && !isNativeExcelOverlayShell()) return false;
  if (!excelId) return false;
  // 호스트 창이 비활성(최소화/알트탭/다른 앱)인 동안엔 강제로 최상단에 올리지 않는다.
  // (document.hasFocus는 웹뷰 포커스만 봐서 네이티브 탭 클릭 시 false가 됨 → 호스트 활성 플래그를 사용.)
  // 단, force=true(업로드 직후 자동 보기 등 명시적 동작)는 가드를 우회한다.
  if (!options.force && excelMirror.hostActive === false) return false;
  // [입력 지연/IME 제보 2026-08-20] 타이핑/한글 조합 중의 백그라운드 raise(z-order 안정화 타이머,
  // focusin 복원 등)는 조합을 깨뜨려 글자가 좌상단 IME 창으로 빠진다 — 입력이 멎을 때까지 건너뛴다.
  if (!options.force && Date.now() < (excelMirror.typingGuardUntil || 0)) return false;
  excelMirror.lastRaiseAt = Date.now();
  await postExcelMirror("/api/excel/raise", { excelId });
  return true;
}

function stabilizeExcelMirrorZOrder(excelId = currentExcelId(), options = {}) {
  if (isNativeExcelShell() && !isNativeExcelOverlayShell()) return;
  if (!excelId) return;
  if (isNativeExcelShell() && !options.allowNative) return;
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

// A방식: 단일 Excel 앱 창만 관리하므로 활성 세션 기준으로 한 번만 위치를 보정한다.
function scheduleExcelMirrorPosition(force = false) {
  if (isNativeExcelShell() && Date.now() < (excelMirror.quietUntil || 0)) return;
  clearTimeout(excelMirror.positionTimer);
  excelMirror.positionTimer = setTimeout(() => {
    const active = currentExcelId();
    if (!active) return;
    positionExcelMirrorWindow(active, { force, keepZorder: true }).catch(err => {
      if (!isMissingExcelSessionError(err)) console.warn("Excel mirror position failed:", err);
    }).then(() => {
      if (active && currentExcelId() === active) stabilizeExcelMirrorZOrder(active);
    });
  }, 80);
}

// [입력 지연/IME 제보 2026-08-20] 채팅 등 텍스트 입력 대상인가 — 타이핑 중 Excel 창 조작 억제용.
function isTextEditableEventTarget(t) {
  try {
    if (!t) return false;
    if (t.isContentEditable) return true;
    const tag = String(t.tagName || "").toUpperCase();
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const type = String(t.type || "text").toLowerCase();
      return !["button", "checkbox", "radio", "range", "submit", "reset", "file", "color"].includes(type);
    }
    return false;
  } catch (_) { return false; }
}

function installExcelMirrorPositionListeners() {
  if (excelMirror.positionListenersInstalled) return;
  excelMirror.positionListenersInstalled = true;
  document.addEventListener("pointerdown", event => {
    const target = event.target;
    if (target && target.closest && target.closest(".excel-mirror-shell")) return;
    // Excel 에서 B2B UI 로 돌아오는 첫 클릭은 버튼/입력에 먼저 도달해야 한다.
    // 이 짧은 구간에는 Excel restore/raise 를 미뤄 첫 클릭이 포커스 보정에 소비되지 않게 한다.
    excelMirror.uiClickGuardUntil = Date.now() + 450;
  }, true);
  // [입력 지연/IME 제보 2026-08-20] 타이핑/한글 조합 중에는 백그라운드 raise/z-order 보정을 멈춘다.
  // 조합(ㄱㄴㄷㄹ…) 도중 미러 창 조작이 끼어들면 마지막 글자가 화면 좌상단 기본 IME 조합창에 남고
  // 다음 키를 눌러야 들어오는 '한 박자 늦는 입력'이 됐다. 입력이 멈추면 ~1초 뒤 자동 해제된다.
  const _noteTyping = event => {
    if (isTextEditableEventTarget(event.target)) excelMirror.typingGuardUntil = Date.now() + 1000;
  };
  document.addEventListener("keydown", _noteTyping, true);
  document.addEventListener("compositionstart", _noteTyping, true);
  document.addEventListener("compositionupdate", _noteTyping, true);
  window.addEventListener("resize", () => scheduleExcelMirrorPosition(true));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      scheduleExcelMirrorPosition(true);
      scheduleRestoreActiveExcelMirror(180, { preserveFocus: true });
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
    // [입력 지연/IME 제보 2026-08-20] 채팅 입력 클릭(focusin)은 Excel 창 상태를 바꾸지 않는다 —
    // 여기서 position(force)+복원을 돌리면 이어지는 타이핑과 창 조작이 겹쳐 조합이 깨진다.
    // (Excel→UI 복귀 복원은 pointerdown 핸들러가 이미 담당하므로 기능 손실 없음.)
    if (event.type === "focusin" && isTextEditableEventTarget(target)) return;
    if (!currentExcelId() && !excelMirror.activeExcelId) return;
    scheduleExcelMirrorPosition(true);
    scheduleRestoreActiveExcelMirror(0, { preserveFocus: true });
  };
  document.addEventListener("pointerdown", restoreOverlayAfterUiFocus, true);
  document.addEventListener("focusin", restoreOverlayAfterUiFocus, true);
  document.addEventListener("pointerup", event => {
    if (!isNativeExcelOverlayShell()) return;
    const target = event.target;
    if (target && target.closest && target.closest(".excel-mirror-shell")) return;
    if (currentExcelId() || excelMirror.activeExcelId) scheduleRestoreActiveExcelMirror(90, { preserveFocus: true });
  }, true);
}

async function postExcelMirror(path, body, attempt = 0, options = {}) {
  let resp;
  let timeoutId = null;
  const controller = options.timeoutMs ? new AbortController() : null;
  if (controller) {
    // [버그수정] setTimeout 지연은 32-bit(2^31-1=2147483647ms≈24.8일)를 넘으면 오버플로로 '즉시' 발동해
    // 요청을 바로 abort → 백엔드가 성공해도 클라가 '응답 지연 중단'으로 오인한다(대용량 무제한 타임아웃을
    // 2592000000ms 로 줬다가 이 현상 발생). 안전 상한(2147483647)으로 클램프한다.
    const _delay = Math.min(2147483647, Math.max(1000, Number(options.timeoutMs) || 0));
    timeoutId = setTimeout(() => controller.abort(), _delay);
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
      throw new Error(options.timeoutMessage || "Excel 스킬 실행이 응답하지 않아 중단했습니다.");
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
    if (typeof noteExcelComTimeout === "function") noteExcelComTimeout(err);
    throw err;
  }
  return data;
}

(function wrapExcelMirrorNavigation() {
  const originalSetCurrentView = window.setCurrentView;
  if (typeof originalSetCurrentView === "function") {
    window.setCurrentView = function(...args) {
      const result = originalSetCurrentView.apply(this, args);
      if (result === false) return result;
      replaceSimulatorWithMirrorShell();
      updateMirrorShellStatus();
      // (제거) scheduleExcelMirrorPosition(true): 탭 클릭마다 모든 세션을 강제 재배치하던 COM 폭풍 —
      // 전환 자체는 switchVisibleExcelMirrorToFileId 가 처리하고, 리사이즈는 resize/b2bNativeResize 리스너가 처리.
      // setCurrentView("output") 는 내부에서 "output:0" 으로 정규화된다.
      // 미러 세션도 정규화된 현재 fileId 로 열어야 탭/미러가 서로 다른 파일을 보지 않는다.
      const fileId = state.currentFileId || args[0];
      clearTimeout(excelMirror.switchTimer);
      // [전환 침묵 실패 금지] 세션이 죽어 매핑이 forget 된 파일 탭을 클릭하면 재오픈(ensure)로
      // 오는데, 실패가 console.warn 으로만 삼켜져 사용자는 '클릭해도 무반응'만 겪었다
      // (실측 12:52 — 재현 실패 후 청구내역 클릭이 이 분기에서 흔적 없이 증발). 토스트+트레이스로 노출.
      const _lazyFail = (kind, err) => {
        try {
          if (typeof traceClientUiEvent === "function") traceClientUiEvent("mirror.lazyopen.fail", {
            fileId: String(fileId || ""), kind,
            error: String((err && err.message) || err || "").slice(0, 200),
          });
        } catch (_) {}
        if (!isMissingExcelSessionError(err)) console.warn("Excel mirror " + kind + " failed:", err);
        try {
          if (typeof toast === "function") toast("Excel 세션을 다시 열지 못했습니다 — "
            + ((err && err.message) || err) + ". 탭을 다시 클릭하면 재시도합니다.", "error");
        } catch (_) {}
        updateMirrorShellStatus();
      };
      excelMirror.switchTimer = setTimeout(() => {
        if (!fileId) return;
        // 적용 중(applying)엔 전환을 보류 — 핀(setCurrentView)발 전환이 hideAll/파킹과 경합해
        // 프레임이 꼬이는 문제 방지. 적용 종료 후 scheduleRestoreActiveExcelMirror 가 현재 탭을 표시한다.
        if (excelMirror.applying) {
          try {
            if (typeof traceClientUiEvent === "function") traceClientUiEvent("mirror.switch.deferred_applying", { fileId: String(fileId || "") });
          } catch (_) {}
          return;
        }
        if (excelMirror.sessionsByFileId[fileId]) {
          // 이미 열린 미러 → 빠른 전환(raise만).
          switchVisibleExcelMirrorToFileId(fileId).catch(err => {
            if (!isMissingExcelSessionError(err)) console.warn("Excel mirror switch failed:", err);
          });
        } else if (fileId === state.currentFileId) {
          updateMirrorShellStatus("Excel 창 준비 중...");
          const file = typeof getFile === "function" ? getFile(fileId) : null;
          const url = file && file.backendDownloadUrl;
          if (url && isBackendResultDownloadUrl(url) && typeof refreshExcelMirrorForFileId === "function") {
            refreshExcelMirrorForFileId(fileId, url, {
              openIfMissing: true,
              preserveFocus: true,
              raiseAfter: true,
            }).catch(err => _lazyFail("result lazy open", err));
          } else {
            ensureExcelMirrorSession(fileId, { makeActive: true }).catch(err => _lazyFail("lazy open", err));
          }
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
  const hideInactive = (options = {}) => {
    if (!hasSessions()) return;
    const now = Date.now();
    if (!options.force && now - (excelMirror.lastHideInactiveAt || 0) < EXCEL_MIRROR_HIDE_IDLE_MS) return;
    excelMirror.lastHideInactiveAt = now;
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
      hideInactive({ force: true });
    }, delay);
  };
  const restoreSoon = (options = {}) => {
    if (!hasSessions() || typeof restoreActiveExcelMirrorWindow !== "function") return;
    excelMirror.hostActive = true;
    clearHideTimer();
    setTimeout(() => {
      restoreActiveExcelMirrorWindow(options).catch(err => {
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
    restoreSoon({ preserveFocus: true });
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
  }, EXCEL_MIRROR_HIDE_IDLE_MS);

  // 최소화/완전 가려짐 → 즉시 숨김(보조). (엑셀 클릭은 document를 hidden으로 만들지 않으므로 구분됨)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      excelMirror.hostActive = false;
      clearHideTimer();
      hideInactive({ force: true });
    }
    else restoreSoon({ preserveFocus: true });
  });
  // 파일 열기 대화상자가 뜰 때 즉시 숨김(파일 input 클릭). 닫혀서 포커스 돌아오면 복원.
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.tagName === "INPUT" && (t.type === "file" || t.getAttribute("type") === "file")) {
      hideInactive({ force: true });
    }
  }, true);
  document.addEventListener("pointerdown", () => restoreSoon({ preserveFocus: true }), true);
  document.addEventListener("focusin", () => restoreSoon({ preserveFocus: true }), true);
  // 앱이 다시 포커스되면(대화상자 닫힘/복귀/복원) 활성 미러 복원.
  window.addEventListener("focus", () => restoreSoon({ preserveFocus: true }));
}

setupExcelMirrorControls = function() {
  installMirrorRenderOverride();
  installExcelMirrorPositionListeners();
  installOverlayAutoHide();
  replaceSimulatorWithMirrorShell();
  updateMirrorShellStatus();
  scheduleExcelMirrorPosition(true);
};
