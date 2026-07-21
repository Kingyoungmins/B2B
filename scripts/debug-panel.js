/* Developer timing panel toggled by F8.
   병목 진단용 — 기본 허용(패널은 F8 누르기 전까지 숨김). URL 에 ?debug=0 을 붙일 때만 끈다. */
(function setupDebugPanel() {
  let allowed = true;
  try {
    if (/[?&]debug=0\b/.test(window.location.search || "")) allowed = false;
  } catch (_) {
    allowed = true;
  }
  if (!allowed) {
    window.recordBackendDebugTiming = function() {};
    window.toggleDebugPanel = function() {};
    try {
      localStorage.removeItem("b2bDebugPanelVisible");
    } catch (_) {}
    const existing = document.getElementById("debug-panel");
    if (existing) existing.remove();
    return;
  }

  const stateKey = "b2bDebugPanelVisible";
  const maxRows = 12;
  const records = [];
  let panel = null;
  let body = null;
  let clickBox = null;

  // ── 클릭 진단 상태 (VDI '빠른 클릭 안 먹음' 원인 판별) ──
  // mousedown/mouseup/click 쌍을 추적해 실패한 클릭이 어떤 유형인지 분류한다.
  const clk = { down: 0, up: 0, click: 0, dbl: 0, ok: 0, moved: 0, still: 0, upMiss: 0, other: 0 };
  const clkRecent = [];
  let clkCur = null;
  const CLK_SLOP = 4;        // 이 px 이하 이동은 '정지'
  const CLK_UP_WAIT = 90;    // up 후 click 을 기다리는 시간(ms)
  const CLK_DOWN_WAIT = 500; // down 후 up 을 기다리는 시간(ms)

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
        <span>backend timing · click</span>
        <button type="button" id="debug-panel-clkreset">click reset</button>
        <button type="button" id="debug-panel-clear">clear</button>
      </div>
      <div class="debug-panel-click" id="debug-panel-click" style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.12)"></div>
      <div class="debug-panel-body" id="debug-panel-body"></div>
    `;
    document.body.appendChild(panel);
    body = panel.querySelector("#debug-panel-body");
    clickBox = panel.querySelector("#debug-panel-click");
    panel.querySelector("#debug-panel-clear").onclick = () => {
      records.length = 0;
      render();
    };
    panel.querySelector("#debug-panel-clkreset").onclick = () => {
      resetClick();
    };
    render();
    renderClick();
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
      // 서버 단계별 타이밍 — server 객체의 *Ms 숫자 키를 전부 동적으로 표시한다.
      // (COM: reset/open/steps/saveResult/… · openpyxl: load/steps/saveInspect · reflect: close/open/present)
      const stageKeys = Object.keys(server)
        .filter(k => /Ms$/.test(k) && k !== "totalServerMs" && Number.isFinite(Number(server[k])))
        .map(k => [k.replace(/Ms$/, ""), server[k]]);
      const stageLine = stageKeys.length
        ? `<div class="debug-stages" style="margin-top:4px;font-size:11px;opacity:.85;line-height:1.5">${server.mode ? `[${server.mode}] ` : ""}${stageKeys.map(([k, v]) => `${k} ${ms(v)}`).join(" · ")}</div>`
        : "";
      return `
        <div class="debug-row">
          <div class="debug-title">#${records.length - idx} ${record.action ? record.action : (record.worker ? "worker" : "fallback")} · ${mode} · ${steps} step</div>
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
          ${stageLine}
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

  function clkTag(el) {
    if (!el || !el.tagName) return "?";
    let s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    else if (el.className && typeof el.className === "string" && el.className.trim()) {
      s += "." + el.className.trim().split(/\s+/)[0];
    }
    return s.slice(0, 22);
  }
  function clkEsc(s) {
    return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function clkClassify(g) {
    if (g.done) return;
    g.done = true;
    let line;
    if (g.click) { clk.ok++; line = "OK"; }
    else if (!g.up) { clk.upMiss++; line = "UP누락"; }
    else {
      const moved = Math.abs(g.dx) > CLK_SLOP || Math.abs(g.dy) > CLK_SLOP;
      if (moved) { clk.moved++; line = "NOCLICK-이동"; }
      else if (g.tgtMismatch) { clk.other++; line = "NOCLICK-타깃≠"; }
      else { clk.still++; line = "NOCLICK-정지"; }
    }
    clkRecent.push(
      line + " dtUp=" + (g.dtUp == null ? "–" : g.dtUp) +
      " dtClk=" + (g.dtClick == null ? "–" : g.dtClick) +
      " d=(" + g.dx + "," + g.dy + ") foc=" + (g.hadFocus ? "Y" : "N") +
      (g.tgtMismatch ? " →" + g.upTag : "") + " @" + g.downTag
    );
    if (clkRecent.length > 8) clkRecent.shift();
    renderClick();
  }
  function clkDown(e) {
    clk.down++;
    if (clkCur && !clkCur.done) clkClassify(clkCur); // 이전 미완 제스처 마감
    const g = {
      t: e.timeStamp, x: e.clientX, y: e.clientY, downTag: clkTag(e.target), tgt: e.target,
      up: false, click: false, dtUp: null, dtClick: null, dx: 0, dy: 0,
      hadFocus: document.hasFocus(), tgtMismatch: false, upTag: "", done: false
    };
    clkCur = g;
    setTimeout(() => { if (!g.done && !g.up) clkClassify(g); }, CLK_DOWN_WAIT);
    renderClick();
  }
  function clkUp(e) {
    clk.up++;
    if (!clkCur || clkCur.done) { renderClick(); return; }
    const g = clkCur;
    g.up = true;
    g.dtUp = Math.round(e.timeStamp - g.t);
    g.dx = e.clientX - g.x;
    g.dy = e.clientY - g.y;
    g.upTag = clkTag(e.target);
    g.tgtMismatch = e.target !== g.tgt;
    setTimeout(() => clkClassify(g), CLK_UP_WAIT);
    renderClick();
  }
  function clkClick(e) {
    if (e && e.__b2bSynthetic) { renderClick(); return; } // 복구망이 만든 클릭은 실제로 세지 않음(진단 정직성)
    clk.click++;
    if (clkCur && !clkCur.done) { clkCur.click = true; clkCur.dtClick = Math.round(e.timeStamp - clkCur.t); }
    renderClick();
  }
  function clkDbl(e) { if (e && e.__b2bSynthetic) { renderClick(); return; } clk.dbl++; renderClick(); }
  function resetClick() {
    clk.down = clk.up = clk.click = clk.dbl = 0;
    clk.ok = clk.moved = clk.still = clk.upMiss = clk.other = 0;
    clkRecent.length = 0;
    clkCur = null;
    renderClick();
  }
  function renderClick() {
    if (!clickBox || (panel && panel.hidden)) return; // 숨김 상태면 카운트만, DOM 갱신 skip
    const recent = clkRecent.slice().reverse().map(l => clkEsc(l)).join("<br>");
    const rec = (window.__b2bClickRecovery && window.__b2bClickRecovery.synthCount) || 0;
    // '선클릭'=눌림 즉시 대신 쏜 클릭 수(≈down). UP누락 은 여전히 실제 뗌 드롭을 보여주지만
    // 선클릭이 눌림에서 이미 버튼을 실행하므로 그 드롭이 클릭 실패로 이어지지 않는다.
    clickBox.innerHTML =
      `<div style="font-size:11px;line-height:1.55">` +
      `<div><strong>클릭 진단</strong> · down ${clk.down} · up ${clk.up} · click ${clk.click} · dbl ${clk.dbl}</div>` +
      `<div>OK <b>${clk.ok}</b> | 이동 <b>${clk.moved}</b> | 정지 <b>${clk.still}</b> | UP누락 <b>${clk.upMiss}</b> | 타깃≠ <b>${clk.other}</b> · 선클릭 <b>${rec}</b></div>` +
      `<div style="opacity:.8">focus=${document.hasFocus() ? "Y" : "N"} · active=${clkEsc(clkTag(document.activeElement))}</div>` +
      (recent ? `<div style="margin-top:4px;font-family:Consolas,monospace;opacity:.9">${recent}</div>` : "") +
      `</div>`;
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
    if (!panel.hidden) renderClick(); // 열릴 때 현재 카운트 즉시 반영
  };

  document.addEventListener("keydown", e => {
    if (e.key === "F8") {
      e.preventDefault();
      window.toggleDebugPanel();
    }
  });

  // 클릭 진단 리스너는 항상 무장(카운터 증가만 — 매우 가벼움, capture 단계라 앱 핸들러보다 먼저 관찰).
  // preventDefault/stopPropagation 을 절대 호출하지 않아 실제 클릭 동작에 영향 없음.
  window.addEventListener("mousedown", clkDown, true);
  window.addEventListener("mouseup", clkUp, true);
  window.addEventListener("click", clkClick, true);
  window.addEventListener("dblclick", clkDbl, true);
  window.__b2bClickProbe = { counts: clk, reset: resetClick };

  if (localStorage.getItem(stateKey) === "1") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ensurePanel, { once: true });
    } else {
      ensurePanel();
    }
  }
})();
