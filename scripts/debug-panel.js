/* Developer timing panel toggled by F8. */
(function setupDebugPanel() {
  const stateKey = "b2bDebugPanelVisible";
  const maxRows = 12;
  const records = [];
  let panel = null;
  let body = null;

  function ms(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return `${Math.round(n)}ms`;
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "debug-panel";
    panel.className = "debug-panel";
    panel.hidden = localStorage.getItem(stateKey) !== "1";
    panel.innerHTML = `
      <div class="debug-panel-head">
        <strong>F8 Debug</strong>
        <span>backend timing</span>
        <button type="button" id="debug-panel-clear">clear</button>
      </div>
      <div class="debug-panel-body" id="debug-panel-body"></div>
    `;
    document.body.appendChild(panel);
    body = panel.querySelector("#debug-panel-body");
    panel.querySelector("#debug-panel-clear").onclick = () => {
      records.length = 0;
      render();
    };
    render();
    return panel;
  }

  function render() {
    if (!body) return;
    if (!records.length) {
      body.innerHTML = `<div class="debug-empty">No backend runs yet.</div>`;
      return;
    }
    body.innerHTML = records.map((record, idx) => {
      const server = record.server || {};
      const mode = record.baseMode || "original";
      const steps = record.steps || 0;
      return `
        <div class="debug-row">
          <div class="debug-title">#${records.length - idx} ${record.worker ? "worker" : "fallback"} · ${mode} · ${steps} step</div>
          <div class="debug-grid">
            <span>total</span><b>${ms(record.totalClientMs)}</b>
            <span>start</span><b>${ms(record.startRequestMs)}</b>
            <span>polls</span><b>${record.polls || 0}</b>
            <span>recv</span><b>${ms(record.receiveMs)} / ${formatBytes(record.receiveBytes)}</b>
            <span>apply</span><b>${ms(record.applyRenderMs)}</b>
            <span>server</span><b>${ms(server.totalServerMs)}</b>
            <span>worker</span><b>${ms(server.workerRunAndPreviewMs)}</b>
            <span>cache</span><b>${ms((server.prepareInputsMs || 0) + (server.prepareOutputMs || 0))}</b>
          </div>
        </div>
      `;
    }).join("");
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
    return `${(n / 1024 / 1024).toFixed(2)}MB`;
  }

  window.recordBackendDebugTiming = function(record) {
    records.unshift({ created: Date.now(), ...record });
    if (records.length > maxRows) records.length = maxRows;
    ensurePanel();
    render();
  };

  window.toggleDebugPanel = function() {
    ensurePanel();
    panel.hidden = !panel.hidden;
    localStorage.setItem(stateKey, panel.hidden ? "0" : "1");
  };

  document.addEventListener("keydown", e => {
    if (e.key === "F8") {
      e.preventDefault();
      window.toggleDebugPanel();
    }
  });

  if (localStorage.getItem(stateKey) === "1") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ensurePanel, { once: true });
    } else {
      ensurePanel();
    }
  }
})();
