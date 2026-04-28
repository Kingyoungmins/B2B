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
  const formulas = {};            // ver2.0: { sheetName: { "A1": "=SUM(...)" } }
  const originalFormulaValues = {}; // 원본 캐시값 (수식 평가 실패 시 fallback)
  const tables = {};              // ver2.0: { sheetName: [{ startRow, endRow, ... }] }
  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    sheets[name] = aoa;
    merges[name] = ws["!merges"] ? ws["!merges"].map(m => ({ s: {...m.s}, e: {...m.e} })) : [];
    const sheetStyles = [];
    const sheetFormulas = {};
    const sheetOriginalValues = {};
    const ref = ws["!ref"];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let r = range.s.r; r <= range.e.r; r++) {
        const row = useCellStyles ? [] : null;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (!cell) continue;
          if (useCellStyles && row && cell.s) row[c] = extractCellStyle(cell.s);
          // 수식 추출 (ver2.0)
          if (cell.f) {
            sheetFormulas[addr] = "=" + cell.f;
            // .v는 저장 시점 캐시 값
            if (cell.v !== undefined) sheetOriginalValues[addr] = cell.v;
          }
        }
        if (row) sheetStyles[r] = row;
      }
    }
    styles[name] = sheetStyles;
    formulas[name] = sheetFormulas;
    originalFormulaValues[name] = sheetOriginalValues;
    // 표 감지 (ver2.0)
    try {
      tables[name] = (typeof detectTables === "function") ? detectTables(aoa) : [];
    } catch (e) { tables[name] = []; }
  });
  return {
    name: file.name,
    size: file.size,
    sheetNames: wb.SheetNames,
    sheets,
    merges,
    styles,
    formulas,
    originalFormulaValues,
    tables,
    lightweightPreview: !useCellStyles,
    originalBuffer: buf,
  };
}

// xlsx.js cell style → inline CSS string.
//
// SheetJS 커뮤니티 빌드는 폰트 색을 추출하지 않고 fill(배경) 색만 추출한다.
// 따라서 어두운 셀에 폰트 색을 명시적으로 못 주면 기본 검정 글씨가 묻힌다.
// 해결책: 배경의 상대 명도를 보고 자동으로 대비되는 텍스트 색을 부여한다.
function _hexLuminance(hex) {
  // hex: 6자리 RRGGBB
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // 단순 가중 평균 (sRGB 근사)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function extractCellStyle(s) {
  if (!s) return null;
  const css = [];
  let bgHex = null;

  // Background color
  const fill = s.fgColor || (s.fill && s.fill.fgColor) || s.patternFill;
  const fgRgb = fill && (fill.rgb || fill.RGB);
  if (fgRgb && typeof fgRgb === "string" && fgRgb.length >= 6) {
    const hex = fgRgb.length === 8 ? fgRgb.slice(2) : fgRgb;
    if (!/^f{6}$/i.test(hex) && !/^0{6}$/i.test(hex)) {
      bgHex = hex.toLowerCase();
      css.push(`background:#${hex}`);
    } else if (/^f{6}$/i.test(hex)) {
      bgHex = "ffffff";
      css.push(`background:#FFFFFF`);
    }
  }

  // Font color (시도). SheetJS 커뮤니티에선 보통 둘 다 undefined 임.
  let fontHex = null;
  const fontColor = (s.font && s.font.color) || s.color;
  const fcRgb = fontColor && (fontColor.rgb || fontColor.RGB);
  if (fcRgb && typeof fcRgb === "string" && fcRgb.length >= 6) {
    const hex = fcRgb.length === 8 ? fcRgb.slice(2) : fcRgb;
    if (!/^0{6}$/i.test(hex)) fontHex = hex.toLowerCase();
  }

  // 폰트 색이 없거나, fill 과 동일하게 추출돼 묻힐 위험이 있으면 자동 대비 적용.
  if (bgHex) {
    const lum = _hexLuminance(bgHex);
    const isDark = lum < 0.55;
    if (!fontHex || fontHex === bgHex) {
      // 어두운 배경이면 흰 글씨, 밝은 배경이면 어두운 글씨로 보정
      if (isDark) css.push("color:#FFFFFF");
      // 밝은 배경에선 기본(검정) 글씨로 두면 보임 — 색 추가 안 함
    } else {
      // 폰트 색이 따로 있으면 그대로 사용
      css.push(`color:#${fontHex}`);
    }
  } else if (fontHex) {
    css.push(`color:#${fontHex}`);
  }

  // Bold / italic
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
    formulas: file.formulas || {},
    originalFormulaValues: file.originalFormulaValues || {},
    tables: file.tables || {},
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
