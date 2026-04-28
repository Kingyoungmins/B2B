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
function _addrToRC(addr) {
  const m = /^([A-Z]+)([0-9]+)$/.exec(addr);
  if (!m) return null;
  let n = 0;
  for (let i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
  return { r: parseInt(m[2], 10) - 1, c: n - 1 };
}

function setCurrentView(fileId) {
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
  if (fileId.startsWith("input:")) {
    const name = fileId.slice(6);
    return state.inputs.find(f => f.name === name);
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
    ...(state.output ? [{ id: "output", name: state.output.name, cls: "output" }] : []),
  ];

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
  for (let c = 0; c < visibleCols; c++) tableHtml += `<th class="col-header">${_excelCol(c)}</th>`;
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
    buf.push(`<tr><td class="row-header">${r + 1}</td>`);
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
      const realStyle = file.styles && file.styles[sheet] && file.styles[sheet][r] && file.styles[sheet][r][c];
      if (!realStyle) {
        const styleCls = classifyCell(aoa[r] && aoa[r][0], r, c, aoa);
        if (styleCls) cls.push(styleCls);
      }
      const display = isNum
        ? (neg ? `(${_formatNumberKR(Math.abs(Number(v)))})` : _formatNumberKR(Number(v)))
        : escapeHtml(String(v));
      const rs = rowspan > 1 ? ` rowspan="${rowspan}"` : "";
      const cs = colspan > 1 ? ` colspan="${colspan}"` : "";
      const styleAttr = realStyle ? ` style="${realStyle}"` : "";
      const titleAttr = hasFormula ? ` title="${escapeHtml(formulas[addr])}"` : "";
      buf.push(`<td class="${cls.join(" ")}" data-r="${r}" data-c="${c}"${rs}${cs}${styleAttr}${titleAttr}>${display}</td>`);
    }
    if (truncatedCols) buf.push('<td class="truncated-cell">...</td>');
    buf.push("</tr>");
  }
  ctx.tbody.insertAdjacentHTML("beforeend", buf.join(""));
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
