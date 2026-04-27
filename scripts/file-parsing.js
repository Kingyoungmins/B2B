/* ===================================================================
   FILE PARSING
   =================================================================== */
async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const buf = await file.arrayBuffer();
  const LARGE_FILE_BYTES = 8 * 1024 * 1024;
  const useCellStyles = file.size <= LARGE_FILE_BYTES;
  const wb = XLSX.read(buf, { type: "array", cellDates: true, cellStyles: useCellStyles });
  const sheets = {};
  const merges = {};
  const styles = {};
  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    sheets[name] = aoa;
    merges[name] = ws["!merges"] ? ws["!merges"].map(m => ({ s: {...m.s}, e: {...m.e} })) : [];
    // Extract per-cell styles from xlsx
    const sheetStyles = [];
    const ref = ws["!ref"];
    if (useCellStyles && ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let r = range.s.r; r <= range.e.r; r++) {
        const row = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          row[c] = cell && cell.s ? extractCellStyle(cell.s) : null;
        }
        sheetStyles[r] = row;
      }
    }
    styles[name] = sheetStyles;
  });
  return {
    name: file.name,
    size: file.size,
    sheetNames: wb.SheetNames,
    sheets,
    merges,
    styles,
    lightweightPreview: !useCellStyles,
    originalBuffer: buf,  // 다운로드 시 원본 양식 복원용
  };
}

// xlsx.js cell style → inline CSS string
function extractCellStyle(s) {
  if (!s) return null;
  const css = [];
  // Background color
  const fill = s.fgColor || (s.fill && s.fill.fgColor) || s.patternFill;
  const fgRgb = fill && (fill.rgb || fill.RGB);
  if (fgRgb && typeof fgRgb === "string" && fgRgb.length >= 6) {
    const hex = fgRgb.length === 8 ? fgRgb.slice(2) : fgRgb;
    if (!/^f{6}$/i.test(hex) && !/^0{6}$/i.test(hex)) {
      css.push(`background:#${hex}`);
    } else if (/^f{6}$/i.test(hex)) {
      // explicit white background — keep so it beats class defaults
      css.push(`background:#FFFFFF`);
    }
  }
  // Font color
  const fontColor = s.color || (s.font && s.font.color);
  const fcRgb = fontColor && (fontColor.rgb || fontColor.RGB);
  if (fcRgb && typeof fcRgb === "string" && fcRgb.length >= 6) {
    const hex = fcRgb.length === 8 ? fcRgb.slice(2) : fcRgb;
    if (!/^0{6}$/i.test(hex)) css.push(`color:#${hex}`);
  }
  // Bold
  if (s.font && (s.font.bold || s.bold)) css.push("font-weight:700");
  if (s.font && (s.font.italic || s.italic)) css.push("font-style:italic");
  // Alignment
  const align = s.alignment || {};
  if (align.horizontal) css.push(`text-align:${align.horizontal}`);
  return css.length ? css.join(";") : null;
}

function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  if (value === null || typeof value !== "object") return value;

  const root = Array.isArray(value) ? [] : {};
  const stack = [{ source: value, target: root }];

  while (stack.length) {
    const { source, target } = stack.pop();
    if (Array.isArray(source)) {
      for (let i = 0; i < source.length; i++) {
        const item = source[i];
        if (item && typeof item === "object") {
          const next = Array.isArray(item) ? [] : {};
          target[i] = next;
          stack.push({ source: item, target: next });
        } else {
          target[i] = item;
        }
      }
      continue;
    }

    Object.keys(source).forEach(key => {
      const item = source[key];
      if (item && typeof item === "object") {
        const next = Array.isArray(item) ? [] : {};
        target[key] = next;
        stack.push({ source: item, target: next });
      } else {
        target[key] = item;
      }
    });
  }

  return root;
}
function cloneFileRecord(file) {
  return deepClone({
    name: file.name,
    size: file.size,
    sheetNames: file.sheetNames,
    sheets: file.sheets,
    merges: file.merges,
    styles: file.styles,
    originalBuffer: null,
  });
}
function syncFileMetadata(file) {
  const sheetKeys = Object.keys(file.sheets || {});
  file.sheetNames = [
    ...file.sheetNames.filter(name => sheetKeys.includes(name)),
    ...sheetKeys.filter(name => !file.sheetNames.includes(name)),
  ];
  file.sheetNames.forEach(name => {
    if (!file.merges[name]) file.merges[name] = [];
  });
}
