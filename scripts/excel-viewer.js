/* ===================================================================
   EXCEL VIEWER
   =================================================================== */
function setCurrentView(fileId) {
  const changed = state.currentFileId !== fileId;
  state.currentFileId = fileId;
  const file = getFile(fileId);
  if (file) {
    if (changed || !state.currentSheet || !file.sheetNames.includes(state.currentSheet)) {
      state.currentSheet = file.sheetNames[0];
    }
  }
  renderInputList();
  renderOutputChip();
  refreshTabs();
  renderExcelViewer();
}

function getFile(fileId) {
  if (!fileId) return null;
  if (fileId === "output") return state.output;
  if (fileId.startsWith("input:")) {
    const name = fileId.slice(6);
    return state.inputs.find(f => f.name === name);
  }
  return null;
}

function refreshTabs() {
  const tabTargets = [
    { fileTabs: $("file-tabs"), sheetTabs: $("sheet-tabs"), info: $("view-info"), empty: "파일이 업로드되면 여기에 표시됩니다" },
    { fileTabs: $("runner-file-tabs"), sheetTabs: $("runner-sheet-tabs"), info: $("runner-view-info"), empty: "실행 후 결과를 우측에서 확인합니다" },
  ];
  const all = [
    ...state.inputs.map(f => ({ id: "input:" + f.name, name: f.name, cls: "" })),
    ...(state.output ? [{ id: "output", name: state.output.name, cls: "output" }] : []),
  ];

  if (state.currentFileId && !all.some(f => f.id === state.currentFileId)) {
    state.currentFileId = null;
    state.currentSheet = null;
  }

  if (!state.currentFileId && all.length) {
    setCurrentView(all[all.length - 1].id);
    return;
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
    const cur = getFile(state.currentFileId);
    if (cur) {
      cur.sheetNames.forEach(sn => {
        const t = document.createElement("div");
        t.className = "sheet-tab" + (state.currentSheet === sn ? " active" : "");
        t.textContent = sn;
        t.onclick = () => { state.currentSheet = sn; refreshTabs(); renderExcelViewer(); };
        sheetTabs.appendChild(t);
      });
      info.textContent = `${cur.name} · ${state.currentSheet || ""}`;
    } else {
      info.textContent = empty;
    }
  });
}

function classifyCell(value, rowIdx, colIdx, aoa) {
  // Heuristic styling for Korean spreadsheet conventions
  const s = String(value || "").trim();
  if (s.startsWith("■")) return "section-title";
  if (s === "계") return "sum-row";
  if (s.includes("부가세") && s.includes("별도")) return "vat-row";
  // Header row: 구분/건수/금액 in same row
  if (aoa[rowIdx]) {
    const rowStr = aoa[rowIdx].map(v => String(v||"")).join("|");
    if (/구분.*건수.*금액/.test(rowStr) || /구분.*금액.*금액/.test(rowStr)) {
      return "header-row";
    }
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
      viewer.innerHTML = `<div class="excel-empty">
      <div class="big-ico">📊</div>
      <div>입력 또는 출력 파일을 업로드하면</div>
      <div>여기에 엑셀이 렌더링됩니다</div>
    </div>`;
    });
    return;
  }
  const aoa = file.sheets[state.currentSheet] || [];
  const merges = file.merges[state.currentSheet] || [];
  const MAX_PREVIEW_ROWS = 300;
  const MAX_PREVIEW_COLS = 60;

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
    const rowLen = aoa[i] ? aoa[i].length : 0;
    if (rowLen > maxCols) maxCols = rowLen;
  }
  const visibleRows = Math.min(aoa.length, MAX_PREVIEW_ROWS);
  const visibleCols = Math.min(maxCols, MAX_PREVIEW_COLS);
  const isTrimmed = visibleRows < aoa.length || visibleCols < maxCols;
  const excelCol = (n) => {
    let s = ""; n++;
    while (n > 0) { const r = (n-1) % 26; s = String.fromCharCode(65+r) + s; n = Math.floor((n-1)/26); }
    return s;
  };

  let html = "";
  if (isTrimmed) {
    const hints = [];
    if (visibleRows < aoa.length) hints.push(`행 ${visibleRows}/${aoa.length}`);
    if (visibleCols < maxCols) hints.push(`열 ${visibleCols}/${maxCols}`);
    if (file.lightweightPreview) hints.push("대용량 파일 경량 미리보기");
    html += `<div class="excel-preview-note">${hints.join(" · ")}</div>`;
  }
  let tableHtml = '<table class="excel-sheet"><thead><tr><th class="col-header"></th>';
  for (let c = 0; c < visibleCols; c++) tableHtml += `<th class="col-header">${excelCol(c)}</th>`;
  if (visibleCols < maxCols) tableHtml += '<th class="col-header">...</th>';
  tableHtml += '</tr></thead><tbody>';

  for (let r = 0; r < visibleRows; r++) {
    tableHtml += `<tr><td class="row-header">${r+1}</td>`;
    for (let c = 0; c < visibleCols; c++) {
      if (hidden.has(r + "," + c)) continue;
      const m = merge_map[r + "," + c];
      const rowspan = m ? Math.min(m.e.r, visibleRows - 1) - m.s.r + 1 : 1;
      const colspan = m ? Math.min(m.e.c, visibleCols - 1) - m.s.c + 1 : 1;
      const v = (aoa[r] && aoa[r][c] !== undefined) ? aoa[r][c] : "";
      const isNum = isNumLike(v);
      const neg = isNum && Number(v) < 0;
      const cls = [];
      if (isNum) cls.push("num");
      if (neg) cls.push("negative");
      // Prefer real xlsx cell styles; fall back to heuristic only if cell has no style
      const realStyle = file.styles && file.styles[state.currentSheet] && file.styles[state.currentSheet][r] && file.styles[state.currentSheet][r][c];
      if (!realStyle) {
        const styleCls = classifyCell(aoa[r] && aoa[r][0], r, c, aoa);
        if (styleCls) cls.push(styleCls);
      }
      const display = isNum
        ? (neg ? `(${Math.abs(Number(v)).toLocaleString("ko-KR")})` : Number(v).toLocaleString("ko-KR", {maximumFractionDigits: 2}))
        : escapeHtml(String(v));
      const rs = rowspan > 1 ? ` rowspan="${rowspan}"` : "";
      const cs = colspan > 1 ? ` colspan="${colspan}"` : "";
      const styleAttr = realStyle ? ` style="${realStyle}"` : "";
      tableHtml += `<td class="${cls.join(" ")}" data-r="${r}" data-c="${c}"${rs}${cs}${styleAttr}>${display}</td>`;
    }
    if (visibleCols < maxCols) tableHtml += '<td class="truncated-cell">...</td>';
    tableHtml += '</tr>';
  }
  if (visibleRows < aoa.length) {
    tableHtml += `<tr><td class="row-header">...</td><td colspan="${visibleCols + (visibleCols < maxCols ? 1 : 0)}" class="truncated-cell">나머지 ${aoa.length - visibleRows}개 행은 미리보기에서 생략됨</td></tr>`;
  }
  tableHtml += '</tbody></table>';
  html += tableHtml;
  viewers.forEach(viewer => { viewer.innerHTML = html; });
}
