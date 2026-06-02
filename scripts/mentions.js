/* ===================================================================
   @ MENTION AUTOCOMPLETE
   =================================================================== */

let mentionMenu = null;
let mentionItems = [];
let activeMentionIndex = 0;

function setupMentionAutocomplete() {
  const ta = $("chat-text");
  if (!ta) return;
  mentionMenu = document.createElement("div");
  mentionMenu.className = "mention-menu";
  mentionMenu.hidden = true;
  document.body.appendChild(mentionMenu);

  ta.addEventListener("input", renderMentionMenu);
  ta.addEventListener("click", renderMentionMenu);
  ta.addEventListener("keydown", (e) => {
    if (!isMentionMenuOpen()) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeMentionIndex = Math.min(activeMentionIndex + 1, mentionItems.length - 1);
      drawMentionMenu();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeMentionIndex = Math.max(activeMentionIndex - 1, 0);
      drawMentionMenu();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      insertMention(mentionItems[activeMentionIndex]);
    } else if (e.key === "Escape") {
      hideMentionMenu();
    }
  }, true);
  document.addEventListener("click", (e) => {
    if (e.target !== ta && !mentionMenu.contains(e.target)) hideMentionMenu();
  });
}

function isMentionMenuOpen() {
  return !!mentionMenu && !mentionMenu.hidden;
}

function getMentionQuery() {
  const ta = $("chat-text");
  if (!ta) return null;
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const m = /(^|\s)@([^\s@]*)$/.exec(before);
  if (!m) return null;
  return { query: m[2], start: pos - m[2].length - 1, end: pos };
}

function buildMentionItems() {
  const items = [];
  state.inputs.forEach(file => addFileMentions(items, file, "입력 파일"));
  if (state.outputTemplates && state.outputTemplates.length) {
    state.outputTemplates.forEach((tpl, idx) => addFileMentions(items, tpl.file, `출력 템플릿 ${idx + 1}`));
  } else if (state.output) {
    addFileMentions(items, state.output, "출력 템플릿");
  }
  return items;
}

function addFileMentions(items, file, fileMeta) {
  items.push({ type: "file", label: file.name, token: `@파일[${file.name}]`, meta: fileMeta });
  file.sheetNames.forEach(sheet => {
    items.push({ type: "sheet", label: sheet, token: `@시트[${file.name}/${sheet}]`, meta: `시트 · ${file.name}` });
    getSheetColumns(file, sheet).forEach(colName => {
      items.push({ type: "column", label: colName, token: `@컬럼[${file.name}/${sheet}/${colName}]`, meta: `컬럼 · ${file.name}/${sheet}` });
    });
  });
}

function getSheetColumns(file, sheet) {
  const aoa = file.sheets[sheet] || [];
  const header = aoa.find(row => row && row.filter(v => String(v ?? "").trim()).length >= 2) || [];
  return header
    .map(v => String(v ?? "").trim())
    .filter(Boolean)
    .slice(0, 80);
}

function renderMentionMenu() {
  if (!mentionMenu) return;
  const info = getMentionQuery();
  if (!info) return hideMentionMenu();
  const q = info.query.toLowerCase();
  mentionItems = buildMentionItems()
    .filter(item => item.label.toLowerCase().includes(q) || item.token.toLowerCase().includes(q) || item.meta.toLowerCase().includes(q))
    .slice(0, 30);
  activeMentionIndex = 0;
  if (!mentionItems.length) return hideMentionMenu();
  drawMentionMenu();
  const ta = $("chat-text");
  const rect = ta.getBoundingClientRect();
  mentionMenu.style.left = rect.left + "px";
  mentionMenu.style.top = Math.max(12, rect.top - Math.min(240, 44 * mentionItems.length) - 8) + "px";
  mentionMenu.hidden = false;
}

function drawMentionMenu() {
  mentionMenu.innerHTML = mentionItems.map((item, idx) => `
    <button type="button" class="mention-item ${idx === activeMentionIndex ? "active" : ""}" data-idx="${idx}">
      <span class="mention-label">${escapeHtml(item.label)}</span>
      <span class="mention-meta">${escapeHtml(item.meta)}</span>
    </button>
  `).join("");
  mentionMenu.querySelectorAll(".mention-item").forEach(btn => {
    btn.onclick = () => insertMention(mentionItems[Number(btn.dataset.idx)]);
  });
}

function insertMention(item) {
  if (!item) return;
  const ta = $("chat-text");
  const info = getMentionQuery();
  if (!ta || !info) return;
  ta.value = ta.value.slice(0, info.start) + item.token + " " + ta.value.slice(info.end);
  const nextPos = info.start + item.token.length + 1;
  ta.focus();
  ta.setSelectionRange(nextPos, nextPos);
  hideMentionMenu();
}

function hideMentionMenu() {
  if (mentionMenu) mentionMenu.hidden = true;
}

function augmentUserPromptWithMentions(message) {
  const lines = [];
  const seen = new Set();
  const add = (line) => {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  };

  const readable = /@(파일|시트|컬럼|범위)\[([^\]]+)\]/g;
  let m;
  while ((m = readable.exec(String(message))) !== null) {
    const kind = m[1];
    const parts = m[2].split("/");
    if (kind === "파일") {
      add(`- 파일명: ${parts.join("/")}`);
    } else if (kind === "시트") {
      add(`- 시트명: 파일 "${parts[0] || ""}", 시트 "${parts.slice(1).join("/")}"`);
    } else if (kind === "컬럼") {
      add(`- 컬럼명: 파일 "${parts[0] || ""}", 시트 "${parts[1] || ""}", 컬럼 "${parts.slice(2).join("/")}"`);
    } else if (kind === "범위") {
      add(`- 선택 범위: ${m[2]}`);
    }
  }

  // Backward compatibility for old encoded mention tokens in saved chat drafts.
  const tokens = Array.from(new Set(String(message).match(/@[^\s]+/g) || []));
  const dec = (v) => decodeURIComponent(v || "");
  tokens.forEach(token => {
    if (token.startsWith("@file:")) {
      add(`- 파일명: ${dec(token.slice(6))}`);
    } else if (token.startsWith("@sheet:")) {
      const [file, sheet] = token.slice(7).split("/");
      add(`- 시트명: 파일 "${dec(file)}", 시트 "${dec(sheet)}"`);
    } else if (token.startsWith("@column:")) {
      const [file, sheet, ...col] = token.slice(8).split("/");
      add(`- 컬럼명: 파일 "${dec(file)}", 시트 "${dec(sheet)}", 컬럼 "${dec(col.join("/"))}"`);
    }
  });

  if (state.selectedCell) {
    const file = getFile(state.selectedCell.fileId);
    add(`- 선택 셀: 파일 "${file ? file.name : state.selectedCell.fileId}", 시트 "${state.selectedCell.sheet}", 셀 "${_excelCol(state.selectedCell.c)}${state.selectedCell.r + 1}"`);
  }
  if (state.selectedRange) {
    add(`- 선택 범위: ${formatRangeMentionBody(state.selectedRange)}`);
  }
  (state.selectedRanges || []).forEach(range => add(`- 선택 범위: ${formatRangeMentionBody(range)}`));
  if (!lines.length) return message;
  return `${message}\n\n[정확 참조]\n${lines.join("\n")}`;
}

function formatRangeMentionBody(range) {
  const file = getFile(range.fileId);
  const name = file ? file.name : range.fileId;
  return `${name}/${range.sheet}!${formatRangeAddress(range)}`;
}

function formatRangeAddress(range) {
  if (range && range.address) {
    return String(range.address).replace(/\$/g, "").split(",")[0].trim();
  }
  if (range && range.type === "col") {
    const a = _excelCol(range.c1);
    const b = _excelCol(range.c2);
    return `${a}:${b}`;
  }
  if (range && range.type === "row") {
    const a = range.r1 + 1;
    const b = range.r2 + 1;
    return `${a}:${b}`;
  }
  const a = _excelCol(range.c1) + (range.r1 + 1);
  const b = _excelCol(range.c2) + (range.r2 + 1);
  return `${a}${a === b ? "" : ":" + b}`;
}
