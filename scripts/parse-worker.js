/* ===================================================================
   XLSX PARSE WORKER
   =================================================================== */
importScripts("../vendor/xlsx.full.js", "table-detect.js");

self.onmessage = (event) => {
  const { id, name, size, buffer } = event.data || {};
  try {
    const parsed = parseWorkbookInWorker(name, size, buffer);
    self.postMessage({ id, ok: true, parsed }, [parsed.originalBuffer]);
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  }
};

function parseWorkbookInWorker(name, size, buf) {
  const LARGE_FILE_BYTES = 8 * 1024 * 1024;
  const useCellStyles = size <= LARGE_FILE_BYTES;
  const wb = XLSX.read(buf, {
    type: "array",
    cellDates: true,
    cellStyles: useCellStyles,
    cellNF: true,
    cellFormula: true,
  });
  const sheets = {};
  const merges = {};
  const styles = {};
  const formats = {};
  const displays = {};
  const formulas = {};
  const originalFormulaValues = {};
  const tables = {};

  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const cellKeys = getWorksheetCellKeys(ws);
    const aoa = sheetToFullAoA(ws, cellKeys);
    sheets[sheetName] = aoa;
    merges[sheetName] = ws["!merges"] ? ws["!merges"].map(m => ({ s: { ...m.s }, e: { ...m.e } })) : [];

    const sheetStyles = [];
    const sheetFormats = [];
    const sheetDisplays = [];
    const sheetFormulas = {};
    const sheetOriginalValues = {};

    cellKeys.forEach(addr => {
      const cell = ws[addr];
      if (!cell) return;
      const pos = XLSX.utils.decode_cell(addr);
      if (useCellStyles && cell.s) {
        if (!sheetStyles[pos.r]) sheetStyles[pos.r] = [];
        sheetStyles[pos.r][pos.c] = extractCellStyle(cell.s);
      }
      if (cell.z) {
        if (!sheetFormats[pos.r]) sheetFormats[pos.r] = [];
        sheetFormats[pos.r][pos.c] = cell.z;
      }
      if (cell.w !== undefined) {
        if (!sheetDisplays[pos.r]) sheetDisplays[pos.r] = [];
        sheetDisplays[pos.r][pos.c] = cell.w;
      }
      if (cell.f) {
        sheetFormulas[addr] = "=" + cell.f;
        if (cell.v !== undefined) sheetOriginalValues[addr] = cell.v;
      }
    });

    styles[sheetName] = sheetStyles;
    formats[sheetName] = sheetFormats;
    displays[sheetName] = sheetDisplays;
    formulas[sheetName] = sheetFormulas;
    originalFormulaValues[sheetName] = sheetOriginalValues;
    try {
      tables[sheetName] = typeof detectTables === "function" ? detectTables(aoa) : [];
    } catch {
      tables[sheetName] = [];
    }
  });

  return {
    name,
    size,
    sheetNames: wb.SheetNames,
    sheets,
    merges,
    styles,
    formats,
    displays,
    formulas,
    originalFormulaValues,
    tables,
    lightweightPreview: !useCellStyles,
    originalBuffer: buf,
  };
}

function getWorksheetCellKeys(ws) {
  if (!ws) return [];
  return Object.keys(ws).filter(key => key[0] !== "!" && ws[key] && (
    ws[key].v !== undefined || ws[key].f || ws[key].w !== undefined
  ));
}

function sheetToFullAoA(ws, cellKeys) {
  cellKeys = cellKeys || getWorksheetCellKeys(ws);
  if (!cellKeys.length) return [];
  let maxR = 0;
  let maxC = 0;
  cellKeys.forEach(addr => {
    const pos = XLSX.utils.decode_cell(addr);
    if (pos.r > maxR) maxR = pos.r;
    if (pos.c > maxC) maxC = pos.c;
  });
  const rows = [];
  for (let r = 0; r <= maxR; r++) {
    const row = [];
    if (maxC >= 0) row[maxC] = "";
    rows[r] = row;
  }
  cellKeys.forEach(addr => {
    const cell = ws[addr];
    const pos = XLSX.utils.decode_cell(addr);
    rows[pos.r][pos.c] = cell && cell.v !== undefined ? cell.v : "";
  });
  return rows;
}

function _hexLuminance(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function extractCellStyle(s) {
  if (!s) return null;
  const css = [];
  let bgHex = null;
  const fill = s.fgColor || (s.fill && s.fill.fgColor) || s.patternFill;
  const fgRgb = fill && (fill.rgb || fill.RGB);
  if (fgRgb && typeof fgRgb === "string" && fgRgb.length >= 6) {
    const hex = fgRgb.length === 8 ? fgRgb.slice(2) : fgRgb;
    if (!/^f{6}$/i.test(hex) && !/^0{6}$/i.test(hex)) {
      bgHex = hex.toLowerCase();
      css.push(`background:#${hex}`);
    } else if (/^f{6}$/i.test(hex)) {
      bgHex = "ffffff";
      css.push("background:#FFFFFF");
    }
  }

  let fontHex = null;
  const fontColor = (s.font && s.font.color) || s.color;
  const fcRgb = fontColor && (fontColor.rgb || fontColor.RGB);
  if (fcRgb && typeof fcRgb === "string" && fcRgb.length >= 6) {
    const hex = fcRgb.length === 8 ? fcRgb.slice(2) : fcRgb;
    if (!/^0{6}$/i.test(hex)) fontHex = hex.toLowerCase();
  }

  if (bgHex) {
    const lum = _hexLuminance(bgHex);
    const isDark = lum < 0.55;
    if (!fontHex || fontHex === bgHex) {
      if (isDark) css.push("color:#FFFFFF");
    } else {
      css.push(`color:#${fontHex}`);
    }
  } else if (fontHex) {
    css.push(`color:#${fontHex}`);
  }

  if (s.font && (s.font.bold || s.bold)) css.push("font-weight:700");
  if (s.font && (s.font.italic || s.italic)) css.push("font-style:italic");
  const align = s.alignment || {};
  if (align.horizontal) css.push(`text-align:${align.horizontal}`);
  return css.length ? css.join(";") : null;
}
