/* ===================================================================
   EXCEL VIEWER POPOUT
   =================================================================== */
let viewerPopout = null;
let viewerPopoutScrollTimer = null;

function getActiveRightPage() {
  return document.querySelector(".right-page.active") || $("right-generator");
}

function setupViewerPopout() {
  document.querySelectorAll(".right-header").forEach((header) => {
    if (header.querySelector(".viewer-popout-btn")) return;
    const btn = document.createElement("button");
    btn.className = "viewer-popout-btn";
    btn.type = "button";
    btn.title = "엑셀 시뮬레이터를 새 창으로 분리";
    btn.textContent = "분리";
    btn.onclick = openViewerPopout;
    header.appendChild(btn);
  });
}

function openViewerPopout() {
  if (viewerPopout && !viewerPopout.closed) {
    viewerPopout.focus();
    syncViewerPopout();
    return;
  }

  const nextPopout = window.open("", "kgm-excel-viewer", "width=1280,height=820,menubar=no,toolbar=no,location=no");
  if (!nextPopout) {
    toast("팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도하세요.", "error");
    return;
  }

  viewerPopout = nextPopout;
  document.body.classList.add("viewer-popped-out");

  const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(link => `<link rel="stylesheet" href="${link.href}">`)
    .join("\n");

  viewerPopout.document.open();
  viewerPopout.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B2B 빌링 Agent ver3.32 - 엑셀 시뮬레이터</title>
  ${cssLinks}
  <style>
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #f8f9fb; }
    body { font-family: Pretendard, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .popout-shell { display: flex; flex-direction: column; height: 100vh; min-width: 0; }
    .popout-bar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #fff; border-bottom: 1px solid #e8e8e8; }
    .popout-note { flex: 1; min-width: 0; font-size: 12px; color: #666; }
    .popout-restore { border: 1px solid #d8dbe2; background: #fff; color: #333; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
    .popout-restore:hover { border-color: #FF0080; color: #FF0080; background: #fff7fc; }
    .popout-content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .popout-content .right-page { display: flex !important; flex-direction: column; height: 100%; min-height: 0; padding: 0; }
    .popout-content .right-header { flex: 0 0 auto; }
    .popout-content .file-tabs, .popout-content .sheet-tabs { flex: 0 0 auto; }
    .popout-content .excel-viewer { flex: 1 1 auto; min-height: 0; }
    .viewer-popout-btn { display: none !important; }
  </style>
</head>
<body>
  <div class="popout-shell">
    <div class="popout-bar">
      <div class="popout-note">메인 창과 동기화된 미리보기입니다. 탭 전환은 가능하며, 셀 편집은 메인 창에서 수행하세요.</div>
      <button class="popout-restore" id="popout-restore" type="button">분리해제</button>
    </div>
    <main class="right popout-content" id="popout-content"></main>
  </div>
</body>
</html>`);
  viewerPopout.document.close();
  viewerPopout.document.getElementById("popout-restore").onclick = restoreViewerPopout;
  viewerPopout.addEventListener("beforeunload", () => {
    document.body.classList.remove("viewer-popped-out");
    viewerPopout = null;
  });
  syncViewerPopout();
}

function restoreViewerPopout() {
  const popout = viewerPopout;
  document.body.classList.remove("viewer-popped-out");
  viewerPopout = null;
  if (popout && !popout.closed) popout.close();
  refreshTabs();
  renderExcelViewer();
}

function syncViewerPopout() {
  if (!viewerPopout || viewerPopout.closed) return;
  const source = getActiveRightPage();
  const target = viewerPopout.document.getElementById("popout-content");
  if (!source || !target) return;

  const oldViewer = target.querySelector(".excel-viewer");
  const oldScroll = oldViewer ? { top: oldViewer.scrollTop, left: oldViewer.scrollLeft } : { top: 0, left: 0 };
  target.innerHTML = source.outerHTML;

  const newViewer = target.querySelector(".excel-viewer");
  if (newViewer) {
    newViewer.scrollTop = oldScroll.top;
    newViewer.scrollLeft = oldScroll.left;
    setupPopoutCellEditing(newViewer);
    newViewer.addEventListener("scroll", () => {
      const sourceViewer = getActiveRightPage()?.querySelector(".excel-viewer");
      if (!sourceViewer) return;
      sourceViewer.scrollTop = newViewer.scrollTop;
      sourceViewer.scrollLeft = newViewer.scrollLeft;
      clearTimeout(viewerPopoutScrollTimer);
      viewerPopoutScrollTimer = setTimeout(syncViewerPopout, 160);
    });
  }

  target.querySelectorAll(".file-tabs .tab[data-file-id]").forEach(tab => {
    tab.addEventListener("click", () => {
      setCurrentView(tab.dataset.fileId);
      syncViewerPopout();
    });
  });

  target.querySelectorAll(".sheet-tabs .sheet-tab[data-sheet-name]").forEach(tab => {
    tab.addEventListener("click", (e) => {
      _toggleSheetSelection(tab.dataset.sheetName, e.ctrlKey || e.metaKey);
      refreshTabs();
      renderExcelViewer();
      syncViewerPopout();
    });
  });
}

function setupPopoutCellEditing(viewer) {
  let dragAnchor = null;
  let didDrag = false;
  let mouseDown = false;

  viewer.addEventListener("mousedown", (e) => {
    const ctx = getPopoutSelectionContext();
    if (!ctx) return;
    const target = getSelectionTarget(e, ctx);
    if (!target) return;
    mouseDown = true;
    didDrag = false;
    const multi = e.ctrlKey || e.metaKey;
    if (e.shiftKey && state.selectionAnchor) {
      applyViewerSelection(viewer, ctx, mergeSelectionTargets(state.selectionAnchor, target, ctx), { append: multi });
      e.preventDefault();
      return;
    }
    if (multi) {
      toggleViewerSelection(viewer, ctx, target);
      e.preventDefault();
      return;
    }
    dragAnchor = target;
    applyViewerSelection(viewer, ctx, target);
    if (target.type !== "cell") e.preventDefault();
  });

  viewer.addEventListener("mouseover", (e) => {
    if (!mouseDown || !dragAnchor) return;
    const ctx = getPopoutSelectionContext();
    if (!ctx) return;
    const target = getSelectionTarget(e, ctx);
    if (!target) return;
    didDrag = true;
    applyViewerSelection(viewer, ctx, mergeSelectionTargets(dragAnchor, target, ctx));
  });

  viewerPopout.document.addEventListener("mouseup", () => {
    mouseDown = false;
    dragAnchor = null;
  });

  viewer.addEventListener("click", (e) => {
    if (didDrag) {
      didDrag = false;
      return;
    }
    const ctx = getPopoutSelectionContext();
    const td = e.target.closest("td[data-r][data-c]");
    if (!ctx || !td || e.ctrlKey || e.metaKey || e.shiftKey) return;
    applyViewerSelection(viewer, ctx, {
      fileId: ctx.fileId,
      sheet: ctx.sheet,
      r1: Number(td.dataset.r),
      c1: Number(td.dataset.c),
      r2: Number(td.dataset.r),
      c2: Number(td.dataset.c),
      type: "cell",
    });
  });

  viewer.addEventListener("focusin", (e) => {
    const td = e.target.closest("td[data-r][data-c]");
    if (!td) return;
    const file = getFile(state.currentFileId);
    const sheet = state.currentSheet;
    const r = Number(td.dataset.r);
    const c = Number(td.dataset.c);
    const raw = file && sheet && file.sheets[sheet] && file.sheets[sheet][r]
      ? file.sheets[sheet][r][c]
      : "";
    td.dataset.editOriginal = String(raw ?? "");
    td.textContent = String(raw ?? "");
  });

  viewer.addEventListener("keydown", (e) => {
    const td = e.target.closest("td[data-r][data-c]");
    if (!td) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitPopoutCell(td);
    } else if (e.key === "Escape") {
      e.preventDefault();
      td.dataset.skipCommit = "1";
      td.textContent = td.dataset.editOriginal || "";
      td.blur();
    }
  });

  viewer.addEventListener("focusout", (e) => {
    const td = e.target.closest("td[data-r][data-c]");
    if (!td) return;
    if (td.dataset.skipCommit === "1") {
      delete td.dataset.skipCommit;
      delete td.dataset.editOriginal;
      syncViewerPopout();
      return;
    }
    if (td.dataset.committed === "1") {
      delete td.dataset.committed;
      delete td.dataset.editOriginal;
      return;
    }
    commitPopoutCell(td);
  });
}

function commitPopoutCell(td) {
  const before = td.dataset.editOriginal || "";
  const after = td.textContent;
  if (before === after) {
    delete td.dataset.editOriginal;
    syncViewerPopout();
    return;
  }

  const fileId = state.currentFileId;
  const sheet = state.currentSheet;
  const r = Number(td.dataset.r);
  const c = Number(td.dataset.c);
  td.dataset.committed = "1";
  commitCellEdit(fileId, sheet, r, c, coerceCellInput(after));
  syncViewerPopout();
}

function getPopoutSelectionContext() {
  const file = getFile(state.currentFileId);
  if (!file || !state.currentSheet) return null;
  const sheet = state.currentSheet;
  const aoa = file.sheets[sheet] || [];
  const formulas = (file.formulas || {})[sheet] || {};
  let maxCols = 1;
  for (let i = 0; i < aoa.length; i++) {
    maxCols = Math.max(maxCols, aoa[i] ? aoa[i].length : 0);
  }
  Object.keys(formulas).forEach(addr => {
    const rc = _addrToRC(addr);
    if (rc) maxCols = Math.max(maxCols, rc.c + 1);
  });
  return {
    file,
    sheet,
    fileId: state.currentFileId,
    visibleCols: Math.min(maxCols, VIEWER_MAX_COLS),
    totalRows: Math.max(aoa.length, _maxRowFromFormulas(formulas)),
  };
}

(function wrapViewerPopoutSync() {
  const originalRefreshTabs = refreshTabs;
  refreshTabs = function(...args) {
    const result = originalRefreshTabs.apply(this, args);
    syncViewerPopout();
    return result;
  };

  const originalRenderExcelViewer = renderExcelViewer;
  renderExcelViewer = function(...args) {
    const result = originalRenderExcelViewer.apply(this, args);
    syncViewerPopout();
    return result;
  };

  const originalSetPage = setPage;
  setPage = function(...args) {
    const result = originalSetPage.apply(this, args);
    syncViewerPopout();
    return result;
  };
})();
