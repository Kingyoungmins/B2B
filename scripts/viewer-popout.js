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

  viewerPopout = window.open("", "kgm-excel-viewer", "width=1280,height=820,menubar=no,toolbar=no,location=no");
  if (!viewerPopout) {
    toast("팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도하세요.", "error");
    return;
  }

  const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(link => `<link rel="stylesheet" href="${link.href}">`)
    .join("\n");

  viewerPopout.document.open();
  viewerPopout.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B2B 빌링 Agent ver3.1 - 엑셀 시뮬레이터</title>
  ${cssLinks}
  <style>
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #f8f9fb; }
    body { font-family: Pretendard, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .popout-shell { display: flex; flex-direction: column; height: 100vh; min-width: 0; }
    .popout-note { padding: 8px 14px; font-size: 12px; color: #666; background: #fff; border-bottom: 1px solid #e8e8e8; }
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
    <div class="popout-note">메인 창과 동기화된 미리보기입니다. 탭 전환은 가능하며, 셀 편집은 메인 창에서 수행하세요.</div>
    <main class="right popout-content" id="popout-content"></main>
  </div>
</body>
</html>`);
  viewerPopout.document.close();
  viewerPopout.addEventListener("beforeunload", () => { viewerPopout = null; });
  syncViewerPopout();
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
