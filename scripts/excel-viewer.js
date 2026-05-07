/* ===================================================================
   EXCEL VIEWER (ver2.0)
   ===================================================================
   - 가상 스크롤: 처음 300행 렌더, 스크롤 내려가면 +300행씩 자동 확장
   - 다중 시트 탭 선택 (Ctrl/Cmd+click) — 채팅 기본 대상으로 사용
   - 수식 실시간 평가 결과 표시 (state.formulaResults)
   - 검색(Ctrl+F) 하이라이트와 연동
   =================================================================== */

const VIEWER_INITIAL_ROWS = 300;
const VIEWER_ROW_INCREMENT = 300;
const VIEWER_MAX_COLS = 60;

// 각 viewer DOM별 렌더 상태
const _viewerState = new WeakMap();

function _excelCol(n) {
  let s = ""; n++;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// 숫자 표시 — 자릿수를 값 크기에 따라 동적으로. 0.998... 같은 비율 값이 "1" 로
// 반올림돼 정보 손실되는 걸 막는다.
function _formatNumberKR(n) {
  if (Number.isInteger(n)) return n.toLocaleString("ko-KR");
  const abs = Math.abs(n);
  let frac;
  if (abs >= 1000) frac = 0;
  else if (abs >= 100) frac = 1;
  else if (abs >= 10) frac = 2;
  else if (abs >= 1) frac = 3;
  else frac = 4; // |n| < 1 — 비율/소수 케이스
  return n.toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: frac });
}
function _formatCellDisplay(value, numFormat) {
  if (!isNumLike(value)) return escapeHtml(String(value));
  const n = Number(value);
  const fmt = String(numFormat || "");
  if (fmt.includes("%")) {
    const decimals = (() => {
      const m = fmt.match(/0\.([0#]+)/);
      return m ? m[1].length : 0;
    })();
    return (n * 100).toLocaleString("ko-KR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + "%";
  }
  if (fmt.includes(",")) {
    return n.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
  }
  return n < 0 ? `(${_formatNumberKR(Math.abs(n))})` : _formatNumberKR(n);
}
function _addrToRC(addr) {
  const m = /^([A-Z]+)([0-9]+)$/.exec(addr);
  if (!m) return null;
  let n = 0;
  for (let i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
  return { r: parseInt(m[2], 10) - 1, c: n - 1 };
}

function outputTemplateFileId(index) {
  return "output:" + index;
}

function outputTemplateIndexFromFileId(fileId) {
  if (fileId === "output") return state.activeOutputIndex >= 0 ? state.activeOutputIndex : 0;
  const m = /^output:(\d+)$/.exec(String(fileId || ""));
  return m ? Number(m[1]) : -1;
}

function isOutputFileId(fileId) {
  return fileId === "output" || outputTemplateIndexFromFileId(fileId) >= 0;
}

function setCurrentView(fileId) {
  if (fileId === "output" && state.outputTemplates && state.outputTemplates.length) {
    const idx = state.activeOutputIndex >= 0 ? state.activeOutputIndex : 0;
    fileId = outputTemplateFileId(idx);
  }
  if (fileId && fileId.startsWith("output:") && typeof activateOutputTemplate === "function") {
    activateOutputTemplate(outputTemplateIndexFromFileId(fileId));
  }
  const changed = state.currentFileId !== fileId;
  state.currentFileId = fileId;
  const file = getFile(fileId);
  if (file) {
    if (changed || !state.currentSheet || !file.sheetNames.includes(state.currentSheet)) {
      state.currentSheet = file.sheetNames[0];
    }
    // 파일이 바뀌면 다중 선택은 초기화
    if (changed) state.selectedSheets = state.currentSheet ? [state.currentSheet] : [];
  }
  renderInputList();
  renderOutputChip();
  refreshTabs();
  renderExcelViewer();
}

function getFile(fileId) {
  if (!fileId) return null;
  if (fileId === "output") return state.output;
  if (fileId.startsWith("output:")) {
    const idx = outputTemplateIndexFromFileId(fileId);
    return (state.outputTemplates[idx] && state.outputTemplates[idx].file) || null;
  }
  if (fileId.startsWith("input:")) {
    const name = fileId.slice(6);
    return state.inputs.find(f => f.name === name);
  }
  return null;
}

function getOriginalFile(fileId) {
  if (!fileId) return null;
  if (fileId === "output") return state.outputOriginal;
  if (fileId.startsWith("output:")) {
    const idx = outputTemplateIndexFromFileId(fileId);
    return (state.outputTemplates[idx] && state.outputTemplates[idx].original) || null;
  }
  if (fileId.startsWith("input:")) {
    const name = fileId.slice(6);
    return state.inputsOriginal.find(f => f.name === name) || null;
  }
  return null;
}

function _toggleSheetSelection(sn, multi) {
  if (!multi) {
    state.currentSheet = sn;
    state.selectedSheets = [sn];
    return;
  }
  // multi-select: toggle membership; current is the latest clicked
  const set = new Set(state.selectedSheets || []);
  if (set.has(sn)) {
    set.delete(sn);
    if (state.currentSheet === sn) {
      const remaining = Array.from(set);
      state.currentSheet = remaining[remaining.length - 1] || null;
    }
  } else {
    set.add(sn);
    state.currentSheet = sn;
  }
  state.selectedSheets = Array.from(set);
}

function refreshTabs() {
  const tabTargets = [
    { fileTabs: $("file-tabs"), sheetTabs: $("sheet-tabs"), info: $("view-info"), empty: "파일이 업로드되면 여기에 표시됩니다" },
    { fileTabs: $("runner-file-tabs"), sheetTabs: $("runner-sheet-tabs"), info: $("runner-view-info"), empty: "실행 후 결과를 우측에서 확인합니다" },
  ];
  const all = [
    ...state.inputs.map(f => ({ id: "input:" + f.name, name: f.name, cls: "" })),
    ...(state.outputTemplates || []).map((tpl, idx) => ({
      id: outputTemplateFileId(idx),
      name: tpl.file.name,
      cls: "output",
    })),
  ];

  if (state.currentFileId === "output" && state.outputTemplates && state.outputTemplates.length) {
    const idx = state.activeOutputIndex >= 0 ? state.activeOutputIndex : 0;
    state.currentFileId = outputTemplateFileId(idx);
  }

  if (state.currentFileId && !all.some(f => f.id === state.currentFileId)) {
    state.currentFileId = null;
    state.currentSheet = null;
    state.selectedSheets = [];
  }

  if (!state.currentFileId && all.length) {
    setCurrentView(all[all.length - 1].id);
    return;
  }

  // 현재 파일에서 selectedSheets 정합성 유지
  const cur = getFile(state.currentFileId);
  if (cur) {
    state.selectedSheets = (state.selectedSheets || []).filter(s => cur.sheetNames.includes(s));
    if (state.selectedSheets.length === 0 && state.currentSheet) {
      state.selectedSheets = [state.currentSheet];
    }
  }

  tabTargets.forEach(({ fileTabs, sheetTabs, info, empty }) => {
    if (!fileTabs || !sheetTabs || !info) return;
    fileTabs.innerHTML = "";
    all.forEach(f => {
      const t = document.createElement("div");
      t.className = "tab " + f.cls + (state.currentFileId === f.id ? " active" : "");
      t.innerHTML = `<span class="dot"></span>${escapeHtml(f.name)}`;
      t.onclick = () => setCurrentView(f.id);
      fileTabs.appendChild(t);
    });

    sheetTabs.innerHTML = "";
    if (cur) {
      const selected = new Set(state.selectedSheets || []);
      // 다중 선택 모드 = 2개 이상 선택됐을 때만 체크 표식 노출 (단일 선택은 .active 만)
      const multiMode = selected.size > 1;
      cur.sheetNames.forEach(sn => {
        const t = document.createElement("div");
        const isCurrent = state.currentSheet === sn;
        const isSelected = selected.has(sn);
        const cls = ["sheet-tab"];
        if (isCurrent) cls.push("active");
        if (multiMode && isSelected) cls.push("selected");
        t.className = cls.join(" ");
        t.textContent = sn;
        t.title = "Ctrl/Cmd+click 로 다중 선택";
        t.onclick = (e) => {
          const multi = e.ctrlKey || e.metaKey;
          _toggleSheetSelection(sn, multi);
          refreshTabs();
          renderExcelViewer();
        };
        sheetTabs.appendChild(t);
      });
      const selLabel = state.selectedSheets && state.selectedSheets.length > 1
        ? ` (${state.selectedSheets.length}개 시트 선택)`
        : "";
      info.textContent = `${cur.name} · ${state.currentSheet || ""}${selLabel}`;
    } else {
      info.textContent = empty;
    }
  });
}

function classifyCell(value, rowIdx, colIdx, aoa) {
  const s = String(value || "").trim();
  if (s.startsWith("■")) return "section-title";
  if (s === "계") return "sum-row";
  if (s.includes("부가세") && s.includes("별도")) return "vat-row";
  if (aoa[rowIdx]) {
    const rowStr = aoa[rowIdx].map(v => String(v||"")).join("|");
    if (/구분.*건수.*금액/.test(rowStr) || /구분.*금액.*금액/.test(rowStr)) return "header-row";
    const first = String(aoa[rowIdx][0] || "").trim();
    if (first === "계") return "sum-row";
    if (first.includes("부가세") && first.includes("별도")) return "vat-row";
  }
  return "";
}

function renderExcelViewer() {
  const file = getFile(state.currentFileId);
  const viewers = [$("excel-viewer"), $("runner-excel-viewer")].filter(Boolean);
  if (!file || !state.currentSheet) {
    viewers.forEach(viewer => {
      _viewerState.delete(viewer);
      viewer.innerHTML = `<div class="excel-empty">
      <div class="big-ico">📊</div>
      <div>입력 또는 출력 파일을 업로드하면</div>
      <div>여기에 엑셀이 렌더링됩니다</div>
    </div>`;
    });
    return;
  }
  viewers.forEach(viewer => _renderViewerInitial(viewer, file));
  // 검색 강조 다시 적용
  if (typeof reapplyFindHighlights === "function") setTimeout(reapplyFindHighlights, 0);
}

function _renderViewerInitial(viewer, file) {
  const sheet = state.currentSheet;
  const aoa = file.sheets[sheet] || [];
  const merges = file.merges[sheet] || [];

  // hidden cells from merges
  const hidden = new Set();
  const merge_map = {};
  merges.forEach(m => {
    merge_map[m.s.r + "," + m.s.c] = m;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        hidden.add(r + "," + c);
      }
    }
  });

  let maxCols = 1;
  for (let i = 0; i < aoa.length; i++) {
    const len = aoa[i] ? aoa[i].length : 0;
    if (len > maxCols) maxCols = len;
  }
  // 수식 영역도 고려
  const formulas = (file.formulas || {})[sheet] || {};
  Object.keys(formulas).forEach(addr => {
    const rc = _addrToRC(addr);
    if (rc && rc.c + 1 > maxCols) maxCols = rc.c + 1;
  });

  const visibleCols = Math.min(maxCols, VIEWER_MAX_COLS);
  const totalRows = Math.max(aoa.length, _maxRowFromFormulas(formulas));
  const initialRows = Math.min(totalRows, VIEWER_INITIAL_ROWS);

  const ctx = {
    file, sheet, aoa, merges, hidden, merge_map,
    maxCols, totalRows, visibleCols,
    rendered: 0,
    fileId: state.currentFileId,
    formulas,
    formulaResults: ((state.formulaResults || {})[state.currentFileId] || {})[sheet] || {},
  };
  _viewerState.set(viewer, ctx);

  let html = "";
  const truncatedCols = visibleCols < maxCols;
  if (truncatedCols) html += `<div class="excel-preview-note">열 ${visibleCols}/${maxCols} (오른쪽 ${maxCols - visibleCols}열 생략)</div>`;
  if (file.lightweightPreview) html += `<div class="excel-preview-note">대용량 파일 경량 미리보기</div>`;

  let tableHtml = '<table class="excel-sheet"><thead><tr><th class="col-header"></th>';
  for (let c = 0; c < visibleCols; c++) tableHtml += `<th class="col-header" data-col-header="${c}">${_excelCol(c)}</th>`;
  if (truncatedCols) tableHtml += '<th class="col-header">...</th>';
  tableHtml += '</tr></thead><tbody id="" class="excel-tbody"></tbody></table>';
  // sentinel for infinite scroll
  tableHtml += `<div class="excel-scroll-sentinel" data-role="sentinel"></div>`;
  html += tableHtml;
  viewer.innerHTML = html;

  const tbody = viewer.querySelector("tbody.excel-tbody");
  ctx.tbody = tbody;
  _appendRows(viewer, ctx, 0, initialRows);
  ctx.rendered = initialRows;
  setupExcelCellEditing(viewer, ctx);

  // 가상 스크롤 IntersectionObserver
  const sentinel = viewer.querySelector(".excel-scroll-sentinel");
  if (ctx.observer) ctx.observer.disconnect();
  if (sentinel && initialRows < totalRows) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && ctx.rendered < ctx.totalRows) {
          const next = Math.min(ctx.totalRows, ctx.rendered + VIEWER_ROW_INCREMENT);
          _appendRows(viewer, ctx, ctx.rendered, next);
          ctx.rendered = next;
          if (ctx.rendered >= ctx.totalRows) observer.disconnect();
          if (typeof reapplyFindHighlights === "function") setTimeout(reapplyFindHighlights, 0);
        }
      });
    }, { root: viewer, rootMargin: "240px 0px" });
    observer.observe(sentinel);
    ctx.observer = observer;
  }
}

function _appendRows(viewer, ctx, fromRow, toRow) {
  const { file, sheet, aoa, hidden, merge_map, visibleCols, maxCols, formulas, formulaResults } = ctx;
  const truncatedCols = visibleCols < maxCols;
  const buf = [];
  for (let r = fromRow; r < toRow; r++) {
    buf.push(`<tr><td class="row-header" data-row-header="${r}">${r + 1}</td>`);
    for (let c = 0; c < visibleCols; c++) {
      if (hidden.has(r + "," + c)) continue;
      const m = merge_map[r + "," + c];
      const rowspan = m ? (Math.min(m.e.r, ctx.totalRows - 1) - m.s.r + 1) : 1;
      const colspan = m ? (Math.min(m.e.c, visibleCols - 1) - m.s.c + 1) : 1;
      const addr = _excelCol(c) + (r + 1);
      const hasFormula = !!formulas[addr];
      let v = (aoa[r] && aoa[r][c] !== undefined) ? aoa[r][c] : "";
      // 수식 평가 결과가 있으면 우선 사용 (item 10)
      if (hasFormula && formulaResults[addr] !== undefined && formulaResults[addr] !== "") {
        v = formulaResults[addr];
      }
      const isNum = isNumLike(v);
      const neg = isNum && Number(v) < 0;
      const cls = [];
      if (isNum) cls.push("num");
      if (neg) cls.push("negative");
      if (hasFormula) cls.push("has-formula");
      if (state.selectedCell &&
          state.selectedCell.fileId === ctx.fileId &&
          state.selectedCell.sheet === sheet &&
          state.selectedCell.r === r &&
          state.selectedCell.c === c) {
        cls.push("selected-cell");
      }
      const realStyle = file.styles && file.styles[sheet] && file.styles[sheet][r] && file.styles[sheet][r][c];
      const numFormat = file.formats && file.formats[sheet] && file.formats[sheet][r] && file.formats[sheet][r][c];
      if (!realStyle) {
        const styleCls = classifyCell(aoa[r] && aoa[r][0], r, c, aoa);
        if (styleCls) cls.push(styleCls);
      }
      const display = _formatCellDisplay(v, numFormat);
      const rs = rowspan > 1 ? ` rowspan="${rowspan}"` : "";
      const cs = colspan > 1 ? ` colspan="${colspan}"` : "";
      const styleAttr = realStyle ? ` style="${realStyle}"` : "";
      const titleAttr = hasFormula ? ` title="${escapeHtml(formulas[addr])}"` : "";
      buf.push(`<td class="${cls.join(" ")}" data-r="${r}" data-c="${c}" contenteditable="true" tabindex="0"${rs}${cs}${styleAttr}${titleAttr}>${display}</td>`);
    }
    if (truncatedCols) buf.push('<td class="truncated-cell">...</td>');
    buf.push("</tr>");
  }
  ctx.tbody.insertAdjacentHTML("beforeend", buf.join(""));
}

function setupExcelCellEditing(viewer, ctx) {
  let dragAnchor = null;
  let didDrag = false;
  let mouseDown = false;

  viewer.onmousedown = (e) => {
    const target = getSelectionTarget(e, ctx);
    if (!target) return;
    mouseDown = true;
    didDrag = false;
    dragAnchor = target;
    applyViewerSelection(viewer, ctx, target);
    if (target.type !== "cell") e.preventDefault();
  };

  viewer.onmouseover = (e) => {
    if (!mouseDown || !dragAnchor) return;
    const target = getSelectionTarget(e, ctx);
    if (!target) return;
    didDrag = true;
    applyViewerSelection(viewer, ctx, mergeSelectionTargets(dragAnchor, target, ctx));
  };

  document.addEventListener("mouseup", () => {
    mouseDown = false;
    dragAnchor = null;
  });

  viewer.onclick = (e) => {
    if (didDrag) {
      didDrag = false;
      return;
    }
    const td = e.target.closest("td[data-r][data-c]");
    if (!td) return;
    const r = Number(td.dataset.r);
    const c = Number(td.dataset.c);
    state.selectedCell = { fileId: ctx.fileId, sheet: ctx.sheet, r, c };
    state.selectedRange = { fileId: ctx.fileId, sheet: ctx.sheet, r1: r, c1: c, r2: r, c2: c, type: "cell" };
    document.querySelectorAll("td.selected-cell").forEach(el => el.classList.remove("selected-cell"));
    td.classList.add("selected-cell");
    updateChatRangeReference(state.selectedRange);
    if (typeof renderMentionMenu === "function") renderMentionMenu();
  };

  viewer.onfocusin = (e) => {
    const td = e.target.closest("td[data-r][data-c]");
    if (!td) return;
    const r = Number(td.dataset.r);
    const c = Number(td.dataset.c);
    const raw = (ctx.aoa[r] && ctx.aoa[r][c] !== undefined) ? ctx.aoa[r][c] : "";
    td.dataset.editOriginal = String(raw ?? "");
    td.textContent = String(raw ?? "");
  };

  viewer.onkeydown = (e) => {
    const td = e.target.closest("td[data-r][data-c]");
    if (!td) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitCellFromElement(td, ctx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      td.dataset.skipCommit = "1";
      td.textContent = td.dataset.editOriginal || "";
      td.blur();
    }
  };

  viewer.onfocusout = (e) => {
    const td = e.target.closest("td[data-r][data-c]");
    if (!td) return;
    if (td.dataset.skipCommit === "1") {
      delete td.dataset.skipCommit;
      delete td.dataset.editOriginal;
      renderExcelViewer();
      return;
    }
    if (td.dataset.committed === "1") {
      delete td.dataset.committed;
      delete td.dataset.editOriginal;
      return;
    }
    commitCellFromElement(td, ctx);
  };
}

function commitCellFromElement(td, ctx) {
    const before = td.dataset.editOriginal || "";
    const after = td.textContent;
    if (before === after) {
      delete td.dataset.editOriginal;
      renderExcelViewer();
      return;
    }
    td.dataset.committed = "1";
    commitCellEdit(ctx.fileId, ctx.sheet, Number(td.dataset.r), Number(td.dataset.c), coerceCellInput(after));
}

function getSelectionTarget(e, ctx) {
  const td = e.target.closest("td[data-r][data-c]");
  if (td) {
    const r = Number(td.dataset.r);
    const c = Number(td.dataset.c);
    return { fileId: ctx.fileId, sheet: ctx.sheet, r1: r, c1: c, r2: r, c2: c, type: "cell" };
  }
  const rh = e.target.closest("[data-row-header]");
  if (rh) {
    const r = Number(rh.dataset.rowHeader);
    return { fileId: ctx.fileId, sheet: ctx.sheet, r1: r, c1: 0, r2: r, c2: ctx.visibleCols - 1, type: "row" };
  }
  const ch = e.target.closest("[data-col-header]");
  if (ch) {
    const c = Number(ch.dataset.colHeader);
    return { fileId: ctx.fileId, sheet: ctx.sheet, r1: 0, c1: c, r2: Math.max(ctx.totalRows - 1, 0), c2: c, type: "col" };
  }
  return null;
}

function mergeSelectionTargets(a, b, ctx) {
  if (a.type === "row" || b.type === "row") {
    return {
      fileId: ctx.fileId, sheet: ctx.sheet,
      r1: Math.min(a.r1, b.r1), c1: 0,
      r2: Math.max(a.r2, b.r2), c2: ctx.visibleCols - 1,
      type: "row",
    };
  }
  if (a.type === "col" || b.type === "col") {
    return {
      fileId: ctx.fileId, sheet: ctx.sheet,
      r1: 0, c1: Math.min(a.c1, b.c1),
      r2: Math.max(ctx.totalRows - 1, 0), c2: Math.max(a.c2, b.c2),
      type: "col",
    };
  }
  return {
    fileId: ctx.fileId, sheet: ctx.sheet,
    r1: Math.min(a.r1, b.r1), c1: Math.min(a.c1, b.c1),
    r2: Math.max(a.r2, b.r2), c2: Math.max(a.c2, b.c2),
    type: "range",
  };
}

function applyViewerSelection(viewer, ctx, range) {
  state.selectedRange = normalizeRange(range);
  if (range.type === "cell") {
    state.selectedCell = { fileId: ctx.fileId, sheet: ctx.sheet, r: range.r1, c: range.c1 };
  }
  viewer.querySelectorAll(".selected-cell,.selected-range").forEach(el => {
    el.classList.remove("selected-cell", "selected-range");
  });
  viewer.querySelectorAll("td[data-r][data-c]").forEach(td => {
    const r = Number(td.dataset.r);
    const c = Number(td.dataset.c);
    if (r >= state.selectedRange.r1 && r <= state.selectedRange.r2 && c >= state.selectedRange.c1 && c <= state.selectedRange.c2) {
      td.classList.add(range.type === "cell" ? "selected-cell" : "selected-range");
    }
  });
  updateChatRangeReference(state.selectedRange);
}

function normalizeRange(range) {
  return {
    ...range,
    r1: Math.min(range.r1, range.r2),
    c1: Math.min(range.c1, range.c2),
    r2: Math.max(range.r1, range.r2),
    c2: Math.max(range.c1, range.c2),
  };
}

function updateChatRangeReference(range) {
  const ta = $("chat-text");
  if (!ta || !range) return;
  const file = getFile(range.fileId);
  const name = file ? file.name : range.fileId;
  const a = _excelCol(range.c1) + (range.r1 + 1);
  const b = _excelCol(range.c2) + (range.r2 + 1);
  const ref = `${name}/${range.sheet}!${a}${a === b ? "" : ":" + b}`;
  const line = `선택 범위: @범위[${ref}]`;
  const marker = /(?:^|\n)선택 범위: @범위\[[^\]]+\]/;
  if (marker.test(ta.value)) {
    ta.value = ta.value.replace(marker, (m) => (m.startsWith("\n") ? "\n" : "") + line);
  } else {
    ta.value = ta.value.trim() ? ta.value + "\n" + line : line;
  }
}

function coerceCellInput(text) {
  const value = String(text ?? "").trim();
  if (value === "") return "";
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (/^(true|false)$/i.test(value)) return /^true$/i.test(value);
  return text;
}

function commitCellEdit(fileId, sheet, r, c, value) {
  const file = getFile(fileId);
  if (!file || !sheet) return;
  if (typeof createManualEditStep !== "function") {
    toast("직접 편집 기능을 초기화하지 못했습니다.", "error");
    renderExcelViewer();
    return;
  }
  try {
    if (typeof pushHistory === "function") pushHistory("셀 직접 편집");
    const step = createManualEditStep(fileId, sheet, r, c, value);
    const next = [...state.pipeline, step];
    if (fileId && fileId.startsWith("output:")) {
      applyManualEditToFile(file, sheet, r, c, value);
      if (typeof syncFileMetadata === "function") syncFileMetadata(file);
      state.pipeline = next;
      if (typeof recomputeAllFormulas === "function") recomputeAllFormulas();
      renderInputList();
      renderOutputChip();
      refreshTabs();
      renderExcelViewer();
    } else {
      runPipeline(next);
      state.pipeline = next;
    }
    state.selectedCell = { fileId, sheet, r, c };
    renderPipeline();
    refreshRunButton();
    toast(`${sheet}!${_excelCol(c)}${r + 1} 값을 변경했습니다.`, "success");
  } catch (err) {
    reportPipelineError(err);
    renderExcelViewer();
  }
}

function applyManualEditToFile(file, sheet, r, c, value) {
  if (!file.sheets) file.sheets = {};
  if (!file.sheets[sheet]) file.sheets[sheet] = [];
  if (!file.sheets[sheet][r]) file.sheets[sheet][r] = [];
  file.sheets[sheet][r][c] = value;
}

function _maxRowFromFormulas(formulas) {
  let mx = 0;
  Object.keys(formulas || {}).forEach(addr => {
    const rc = _addrToRC(addr);
    if (rc && rc.r + 1 > mx) mx = rc.r + 1;
  });
  return mx;
}

// search.js 가 호출 — 특정 행이 보이도록 가상 스크롤 확장
function ensureRowVisible(rowIdx) {
  const viewers = [$("excel-viewer"), $("runner-excel-viewer")].filter(Boolean);
  viewers.forEach(viewer => {
    const ctx = _viewerState.get(viewer);
    if (!ctx) return;
    if (ctx.rendered <= rowIdx && rowIdx < ctx.totalRows) {
      const next = Math.min(ctx.totalRows, rowIdx + VIEWER_ROW_INCREMENT);
      _appendRows(viewer, ctx, ctx.rendered, next);
      ctx.rendered = next;
    }
  });
}
