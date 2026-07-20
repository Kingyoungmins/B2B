/* Persistent backend pipeline worker for ver3.7.
   Keeps workbook AoA caches in Node so repeated steps do not resend full sheets. */
const readline = require("readline");

const PREVIEW_ROWS = 500;
const PREVIEW_COLS = null;
const MAX_DIFF_CELLS_PER_SHEET = 5000;
const PIPELINE_CACHE_LIMIT = Math.max(0, Number(process.env.B2B_WORKER_PIPELINE_CACHE_ENTRIES || 3) || 0);
const workbooks = new Map();
const pipelineCache = new Map();

function deepClone(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
}

function activePipelineSignature(pipeline) {
  return (pipeline || [])
    .filter(step => !(step && step.enabled === false))
    .map(step => ({
      id: step && step.id || "",
      description: step && step.description || "",
      code: step && step.code || "",
      manualEdit: step && step.manualEdit || null,
    }));
}

function cacheKeyForPayload(payload) {
  if (!PIPELINE_CACHE_LIMIT) return "";
  if ((payload.baseMode || "original") !== "original") return "";
  return stableStringify({
    baseMode: "original",
    inputs: (payload.inputs || []).map(item => ({
      name: item.name || "",
      id: item.backendWorkbookId || "",
    })),
    output: payload.output ? {
      name: payload.output.name || "",
      id: payload.output.backendWorkbookId || "",
    } : null,
    pipeline: activePipelineSignature(payload.pipeline),
  });
}

function rememberPipelineCache(key, entry) {
  if (!key || !PIPELINE_CACHE_LIMIT) return;
  if (pipelineCache.has(key)) pipelineCache.delete(key);
  pipelineCache.set(key, entry);
  while (pipelineCache.size > PIPELINE_CACHE_LIMIT) {
    const oldest = pipelineCache.keys().next().value;
    pipelineCache.delete(oldest);
  }
}

function restorePipelineCache(key) {
  if (!key || !pipelineCache.has(key)) return null;
  const entry = pipelineCache.get(key);
  pipelineCache.delete(key);
  pipelineCache.set(key, entry);
  for (const item of entry.workbooks || []) {
    const wb = workbooks.get(item.workbookId);
    if (wb) wb.current = deepClone(item.sheets || {});
  }
  return deepClone(entry.result || {});
}

function normalizeText(v) { return String(v ?? "").trim().toLowerCase().replace(/\s+/g, ""); }
function includesNormalizedText(v, s) { return normalizeText(v).includes(normalizeText(s)); }
function equalsNormalizedText(v, s) { return normalizeText(v) === normalizeText(s); }
function replaceNormalizedText(v) { return String(v ?? ""); }
function similarity(a, b) {
  a = normalizeText(a);
  b = normalizeText(b);
  if (!a || !b) return 0;
  return a === b ? 1 : (a.includes(b) || b.includes(a) ? 0.8 : 0);
}

function headerRowIndex(sheetAoA) {
  let best = 0, bestScore = -1;
  for (let r = 0; r < Math.min((sheetAoA || []).length, 30); r++) {
    const row = sheetAoA[r] || [];
    const score = row.filter(v => String(v ?? "").trim()).length;
    if (score > bestScore) { best = r; bestScore = score; }
  }
  return best;
}
function dataStartRowIndex(sheetAoA) { return headerRowIndex(sheetAoA) + 1; }
function excelRowToIndex(n) { return Math.max(0, Number(n) - 1); }

function col(sheetAoA, name) {
  const h = headerRowIndex(sheetAoA);
  const row = sheetAoA[h] || [];
  const target = normalizeText(name);
  let fallback = -1;
  for (let i = 0; i < row.length; i++) {
    const cur = normalizeText(row[i]);
    if (cur === target) return i;
    if (fallback < 0 && cur && (cur.includes(target) || target.includes(cur))) fallback = i;
  }
  return fallback;
}

function findColumnGlobal(inputsMap, name) {
  const hits = [];
  Object.entries(inputsMap || {}).forEach(([file, sheets]) => {
    Object.entries(sheets || {}).forEach(([sheet, aoa]) => {
      const colIdx = col(aoa, name);
      if (colIdx >= 0) hits.push({ file, sheet, colIdx });
    });
  });
  return hits;
}

function fuzzyGetKey(target, prop) {
  if (!target || typeof target !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(target, prop)) return prop;
  const keys = Object.keys(target);
  if (keys.length === 1) return keys[0];
  const wanted = normalizeText(prop);
  let best = null;
  for (const key of keys) {
    const cur = normalizeText(key);
    if (cur === wanted || (cur && wanted && (cur.includes(wanted) || wanted.includes(cur)))) {
      best = key;
      break;
    }
  }
  return best;
}

function fuzzyProxy(target) {
  if (!target || typeof target !== "object") return target;
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === "symbol" || prop in t) return t[prop];
      const key = fuzzyGetKey(t, String(prop));
      return key ? t[key] : undefined;
    },
    set(t, prop, value) {
      if (typeof prop === "symbol" || Object.prototype.hasOwnProperty.call(t, prop)) {
        t[prop] = value;
        return true;
      }
      const key = fuzzyGetKey(t, String(prop));
      if (key && normalizeText(key) === normalizeText(prop)) t[key] = value;
      else t[prop] = value;
      return true;
    },
  });
}

function trackedRowProxy(row, fileId, sheetName, r) {
  if (!row || typeof row !== "object") return row;
  const key = `${fileId}\u0000${sheetName}\u0000${r}`;
  let cached = activeRowProxyCache.get(row);
  if (cached && cached[key]) return cached[key];
  if (!cached) {
    cached = {};
    activeRowProxyCache.set(row, cached);
  }
  cached[key] = new Proxy(row, {
    set(target, prop, value) {
      target[prop] = value;
      const c = Number(prop);
      if (Number.isInteger(c) && c >= 0) trackClearThenSet(fileId, sheetName, r, c, value);
      return true;
    },
  });
  return cached[key];
}

function trackedSheetProxy(sheet, fileId, sheetName) {
  if (!sheet || typeof sheet !== "object") return sheet;
  const key = `${fileId}\u0000${sheetName}`;
  let cached = activeSheetProxyCache.get(sheet);
  if (cached && cached[key]) return cached[key];
  if (!cached) {
    cached = {};
    activeSheetProxyCache.set(sheet, cached);
  }
  cached[key] = new Proxy(sheet, {
    get(target, prop) {
      const value = target[prop];
      const r = Number(prop);
      if (Number.isInteger(r) && r >= 0 && Array.isArray(value)) {
        return trackedRowProxy(value, fileId, sheetName, r);
      }
      return value;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  return cached[key];
}

function trackedSheetsProxy(sheets, fileId) {
  if (!sheets || typeof sheets !== "object") return sheets;
  return new Proxy(sheets, {
    get(target, prop) {
      if (typeof prop === "symbol") return target[prop];
      const key = Object.prototype.hasOwnProperty.call(target, prop) ? prop : fuzzyGetKey(target, String(prop));
      return key ? trackedSheetProxy(target[key], fileId, String(key)) : undefined;
    },
    set(target, prop, value) {
      if (typeof prop === "symbol" || Object.prototype.hasOwnProperty.call(target, prop)) {
        target[prop] = value;
      } else {
        const key = fuzzyGetKey(target, String(prop));
        if (key && normalizeText(key) === normalizeText(prop)) target[key] = value;
        else target[prop] = value;
      }
      return true;
    },
  });
}

function findInputBySheet(inputsMap, sheetName, options) {
  options = options || {};
  const target = normalizeText(sheetName);
  const preferredFile = options.preferredFile ? normalizeText(options.preferredFile) : "";
  const matches = [];
  Object.entries(inputsMap || {}).forEach(([fileName, sheets]) => {
    Object.entries(sheets || {}).forEach(([sn, sheet]) => {
      if (normalizeText(sn) === target) matches.push({ fileName, file: sheets, sheetName: sn, sheet });
    });
  });
  if (!matches.length) return null;
  if (preferredFile) {
    const preferred = matches.find(item => normalizeText(item.fileName).includes(preferredFile) || preferredFile.includes(normalizeText(item.fileName)));
    if (preferred) return preferred;
  }
  return matches[0];
}

let activeInputs = {};
let activeOutput = {};
let activeProxiedInputs = {};
let activeProxiedOutput = {};
let activeOutputFileId = "output:0";
let activeForcedValueCells = {};
let activeClearedValueCells = {};
let activeSheetProxyCache = new WeakMap();
let activeRowProxyCache = new WeakMap();

function resolveTargetSheets(fileRef) {
  if (fileRef === "output") return activeOutput;
  let key = String(fileRef || "");
  if (key.startsWith("input:")) key = key.slice(6);
  if (Object.prototype.hasOwnProperty.call(activeInputs, key)) return activeInputs[key];
  const fuzzyKey = fuzzyGetKey(activeInputs, key);
  return fuzzyKey ? activeInputs[fuzzyKey] : null;
}

function insertColumns(fileRef, sheetName, atColIdx, count) {
  const file = resolveTargetSheets(fileRef);
  if (!file) throw new Error(`insertColumns: file not found: ${fileRef}`);
  const sheet = file[sheetName];
  if (!sheet) throw new Error(`insertColumns: sheet not found: ${sheetName}`);
  const at = Math.max(0, Number(atColIdx) || 0);
  const n = Math.max(0, Number(count) || 0);
  if (!n) return;
  for (let r = 0; r < sheet.length; r++) {
    if (!sheet[r]) sheet[r] = [];
    while (sheet[r].length < at) sheet[r].push("");
    sheet[r].splice(at, 0, ...new Array(n).fill(""));
  }
}

function copyColumns(fileRef, sheetName, srcStart, srcCount, destStart) {
  const file = resolveTargetSheets(fileRef);
  if (!file) throw new Error(`copyColumns: file not found: ${fileRef}`);
  const sheet = file[sheetName];
  if (!sheet) throw new Error(`copyColumns: sheet not found: ${sheetName}`);
  const src = Math.max(0, Number(srcStart) || 0);
  const n = Math.max(0, Number(srcCount) || 0);
  const dest = Math.max(0, Number(destStart) || 0);
  if (!n) return;
  for (let r = 0; r < sheet.length; r++) {
    if (!sheet[r]) sheet[r] = [];
    const values = [];
    for (let c = 0; c < n; c++) values.push(sheet[r][src + c] !== undefined ? sheet[r][src + c] : "");
    while (sheet[r].length < dest) sheet[r].push("");
    for (let c = 0; c < n; c++) sheet[r][dest + c] = values[c];
  }
}

function deleteColumns(fileRef, sheetName, atColIdx, count) {
  const file = resolveTargetSheets(fileRef);
  if (!file) throw new Error(`deleteColumns: file not found: ${fileRef}`);
  const sheet = file[sheetName];
  if (!sheet) throw new Error(`deleteColumns: sheet not found: ${sheetName}`);
  const at = Math.max(0, Number(atColIdx) || 0);
  const n = Math.max(0, Number(count) || 0);
  if (!n) return;
  for (let r = 0; r < sheet.length; r++) {
    if (sheet[r]) sheet[r].splice(at, n);
  }
}
function shiftFormulaText(v) { return v; }

function forcedCellKey(fileId, sheetName, r, c) {
  return `${fileId}\u0000${sheetName}\u0000${r}\u0000${c}`;
}

function addForcedValueCell(fileId, sheetName, r, c, value) {
  if (!fileId || !sheetName) return;
  activeForcedValueCells[forcedCellKey(fileId, sheetName, r, c)] = { fileId, sheetName, r, c, value };
}

function trackClearThenSet(fileId, sheetName, r, c, value) {
  if (!fileId || !sheetName) return;
  const key = forcedCellKey(fileId, sheetName, r, c);
  if (value === "") {
    activeClearedValueCells[key] = true;
    return;
  }
  if (activeClearedValueCells[key]) {
    delete activeClearedValueCells[key];
    addForcedValueCell(fileId, sheetName, r, c, value);
  }
}

function fileIdForSetCellTarget(fileRef) {
  if (fileRef === "output") return activeOutputFileId || "output:0";
  if (typeof fileRef === "string" && fileRef.startsWith("output:")) return fileRef;
  let key = String(fileRef || "");
  if (key.startsWith("input:")) return key;
  if (Object.prototype.hasOwnProperty.call(activeInputs, key)) return `input:${key}`;
  return "";
}

function setCellValue(fileRef, sheetName, r, c, value) {
  const file = resolveTargetSheets(fileRef);
  if (!file) throw new Error(`setCellValue: file not found: ${fileRef}`);
  if (!file[sheetName]) file[sheetName] = [];
  const rowIdx = Math.max(0, Number(r) || 0);
  const colIdx = Math.max(0, Number(c) || 0);
  if (!file[sheetName][rowIdx]) file[sheetName][rowIdx] = [];
  file[sheetName][rowIdx][colIdx] = value;
  addForcedValueCell(fileIdForSetCellTarget(fileRef), sheetName, rowIdx, colIdx, value);
  return value;
}

function sheetDimensions(sheets) {
  const dimensions = {};
  Object.entries(sheets || {}).forEach(([name, rows]) => {
    rows = rows || [];
    dimensions[name] = {
      maxRow: rows.length,
      maxCol: rows.reduce((mx, row) => Math.max(mx, (row || []).length), 0),
      previewRows: Math.min(rows.length, PREVIEW_ROWS),
      previewCols: rows.slice(0, PREVIEW_ROWS).reduce((mx, row) => Math.max(mx, (row || []).length), 0),
    };
  });
  return dimensions;
}

function previewSheets(sheets) {
  const out = {};
  Object.entries(sheets || {}).forEach(([name, rows]) => {
    out[name] = (rows || []).slice(0, PREVIEW_ROWS).map(row => {
      const values = Array.isArray(row) ? row.slice() : [];
      return PREVIEW_COLS == null ? values : values.slice(0, PREVIEW_COLS);
    });
  });
  return out;
}

function pickPreviewSheets(previews, sheetNames) {
  const out = {};
  for (const name of sheetNames || []) {
    if (Object.prototype.hasOwnProperty.call(previews, name)) {
      out[name] = previews[name];
    }
  }
  return out;
}

function diffValue(value) {
  if (value == null) return "";
  return String(value);
}

function computeSheetDiff(beforeRows, afterRows) {
  beforeRows = beforeRows || [];
  afterRows = afterRows || [];
  const maxRows = Math.max(beforeRows.length, afterRows.length);
  const cells = [];
  let changedCount = 0;
  let truncated = false;
  for (let r = 0; r < maxRows; r++) {
    const before = beforeRows[r] || [];
    const after = afterRows[r] || [];
    if (before === after) continue;
    const maxCols = Math.max(before.length, after.length);
    for (let c = 0; c < maxCols; c++) {
      if (diffValue(before[c]) === diffValue(after[c])) continue;
      changedCount++;
      if (cells.length < MAX_DIFF_CELLS_PER_SHEET) cells.push({ r, c, value: after[c] ?? "" });
      else {
        truncated = true;
        return { cells, changedCount, truncated };
      }
    }
  }
  return { cells, changedCount, truncated };
}

function computeWorkbookDiff(beforeSheets, afterSheets) {
  beforeSheets = beforeSheets || {};
  afterSheets = afterSheets || {};
  const sheets = {};
  let changedCount = 0;
  let truncated = false;
  for (const name of new Set([...Object.keys(beforeSheets), ...Object.keys(afterSheets)])) {
    const diff = computeSheetDiff(beforeSheets[name], afterSheets[name]);
    if (diff.changedCount || !(name in beforeSheets) || !(name in afterSheets)) {
      sheets[name] = diff;
      changedCount += diff.changedCount;
      truncated = truncated || diff.truncated;
    }
  }
  return { sheets, changedCount, truncated };
}

function mergeForcedCellsIntoDiff(diff, fileId, forcedCells, afterSheets) {
  diff = diff || { sheets: {}, changedCount: 0, truncated: false };
  diff.sheets = diff.sheets || {};
  for (const cell of forcedCells || []) {
    if (!cell || cell.fileId !== fileId) continue;
    const sheetName = cell.sheetName;
    if (!diff.sheets[sheetName]) diff.sheets[sheetName] = { cells: [], changedCount: 0, truncated: false };
    const sheetDiff = diff.sheets[sheetName];
    const exists = (sheetDiff.cells || []).some(item => item.r === cell.r && item.c === cell.c);
    if (!exists) {
      const rows = (afterSheets || {})[sheetName] || [];
      const row = rows[cell.r] || [];
      sheetDiff.cells = sheetDiff.cells || [];
      if (sheetDiff.cells.length < MAX_DIFF_CELLS_PER_SHEET) {
        sheetDiff.cells.push({ r: cell.r, c: cell.c, value: row[cell.c] ?? cell.value ?? "" });
      } else {
        sheetDiff.truncated = true;
        diff.truncated = true;
      }
      sheetDiff.changedCount = Number(sheetDiff.changedCount || 0) + 1;
      diff.changedCount = Number(diff.changedCount || 0) + 1;
    }
  }
  return diff;
}

function getWorkbook(id) {
  const wb = workbooks.get(id);
  if (!wb) throw new Error(`worker workbook not found: ${id}`);
  return wb;
}

function setWorkbook(id, sheets, currentSheets) {
  workbooks.set(id, {
    original: deepClone(sheets || {}),
    current: deepClone(currentSheets || sheets || {}),
  });
}

function prepareRun(payload) {
  const baseMode = payload.baseMode || "original";
  const inputRefs = payload.inputs || [];
  const outputRef = payload.output || null;
  const inputs = {};
  const beforeInputs = {};
  const inputTargets = [];

  for (const item of inputRefs) {
    const wb = getWorkbook(item.backendWorkbookId);
    const name = item.name;
    const useCurrent = baseMode === "current" && wb.current;
    const base = useCurrent ? wb.current : wb.original;
    const working = useCurrent ? base : deepClone(base);
    inputs[name] = working;
    beforeInputs[name] = previewSheets(working);
    inputTargets.push({ name, workbookId: item.backendWorkbookId, working, original: wb.original, wb });
  }

  let output = {};
  let beforeOutput = {};
  let outputTarget = null;
  if (outputRef && outputRef.backendWorkbookId) {
    const wb = getWorkbook(outputRef.backendWorkbookId);
    const useCurrent = baseMode === "current" && wb.current;
    const base = useCurrent ? wb.current : wb.original;
    output = useCurrent ? base : deepClone(base);
    beforeOutput = previewSheets(output);
    outputTarget = { workbookId: outputRef.backendWorkbookId, working: output, original: wb.original, wb };
  }
  return { inputs, output, beforeInputs, beforeOutput, inputTargets, outputTarget };
}

function runSteps(inputs, output, pipeline, progress, options) {
  options = options || {};
  activeInputs = inputs;
  activeOutput = output;
  activeOutputFileId = options.outputFileId || "output:0";
  activeForcedValueCells = {};
  activeClearedValueCells = {};
  activeSheetProxyCache = new WeakMap();
  activeRowProxyCache = new WeakMap();
  const wrappedInputs = {};
  Object.entries(inputs).forEach(([fileName, sheets]) => {
    wrappedInputs[fileName] = trackedSheetsProxy(sheets, `input:${fileName}`);
  });
  activeProxiedInputs = fuzzyProxy(wrappedInputs);
  activeProxiedOutput = trackedSheetsProxy(output, activeOutputFileId);

  let activeStepIndex = 0;
  const totalSteps = (pipeline || []).filter(step => !(step && step.enabled === false)).length;
  for (const step of pipeline || []) {
    if (step && step.enabled === false) continue;
    if (progress) progress({
      currentStep: activeStepIndex,
      completedSteps: activeStepIndex,
      totalSteps,
      stepRunning: true,
      stepDescription: (step && step.description) || `Step ${activeStepIndex + 1}`,
    });
    try {
      const code = String((step && step.code) || "");
      const fn = new Function("inputs", "output", "col", "findColumnGlobal", "findInputBySheet", "similarity", "normalizeText", "replaceNormalizedText", "includesNormalizedText", "equalsNormalizedText", "headerRowIndex", "dataStartRowIndex", "excelRowToIndex", "insertColumns", "copyColumns", "deleteColumns", "shiftFormulaText", "setCellValue",
        code + "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };");
      const result = fn(activeProxiedInputs, activeProxiedOutput, col, findColumnGlobal, findInputBySheet, similarity, normalizeText, replaceNormalizedText, includesNormalizedText, equalsNormalizedText, headerRowIndex, dataStartRowIndex, excelRowToIndex, insertColumns, copyColumns, deleteColumns, shiftFormulaText, setCellValue);
      if (result && typeof result === "object" && !Array.isArray(result)) {
        if (result.inputs && result.inputs !== activeProxiedInputs && typeof result.inputs === "object") {
          Object.assign(inputs, result.inputs);
        }
        if (result.output && result.output !== activeProxiedOutput && typeof result.output === "object") {
          Object.assign(output, result.output);
        }
      }
    } catch (err) {
      const info = {
        stepIdx: activeStepIndex,
        stepId: step && step.id || null,
        description: step && step.description || "",
        code: step && step.code || "",
        message: err && err.message || String(err),
        stack: err && err.stack || "",
      };
      throw Object.assign(new Error(info.message), { errorInfo: info });
    }
    activeStepIndex++;
    if (progress) progress({
      currentStep: activeStepIndex,
      completedSteps: activeStepIndex,
      totalSteps,
      stepRunning: false,
      stepDescription: (step && step.description) || `Step ${activeStepIndex}`,
    });
  }
  return Object.values(activeForcedValueCells);
}

function runPipeline(payload) {
  const cacheKey = cacheKeyForPayload(payload || {});
  const cached = restorePipelineCache(cacheKey);
  if (cached) {
    cached.cacheHit = true;
    return cached;
  }

  const prepared = prepareRun(payload);
  const outputFileId = (payload.current && payload.current.outputFileId) || "output:0";
  const forcedCells = runSteps(prepared.inputs, prepared.output, payload.pipeline || [], null, { outputFileId });

  const files = [];
  const diffs = {};
  const cacheWorkbooks = [];
  const current = payload.current || {};
  for (const target of prepared.inputTargets) {
    target.wb.current = target.working;
    cacheWorkbooks.push({ workbookId: target.workbookId, sheets: deepClone(target.working) });
    const fileId = `input:${target.name}`;
    const afterPreview = previewSheets(target.working);
    const diff = mergeForcedCellsIntoDiff(
      computeWorkbookDiff(prepared.beforeInputs[target.name], afterPreview),
      fileId,
      forcedCells,
      target.working,
    );
    const changedSheets = new Set(Object.keys(diff.sheets || {}));
    if (current.fileId === fileId && current.sheet) changedSheets.add(current.sheet);
    diffs[fileId] = diff;
    files.push({
      fileId,
      name: target.name,
      sheetNames: Object.keys(target.working || {}),
      sheets: pickPreviewSheets(afterPreview, changedSheets),
      forcedValueCells: forcedCells.filter(cell => cell.fileId === fileId),
      formulas: {},
      formats: {},
      dimensions: sheetDimensions(target.working),
      diff,
      workerWorkbookId: target.workbookId,
    });
  }
  if (prepared.outputTarget) {
    prepared.outputTarget.wb.current = prepared.outputTarget.working;
    cacheWorkbooks.push({ workbookId: prepared.outputTarget.workbookId, sheets: deepClone(prepared.outputTarget.working) });
    const fileId = outputFileId;
    const afterPreview = previewSheets(prepared.outputTarget.working);
    const diff = mergeForcedCellsIntoDiff(
      computeWorkbookDiff(prepared.beforeOutput, afterPreview),
      fileId,
      forcedCells,
      prepared.outputTarget.working,
    );
    const changedSheets = new Set(Object.keys(diff.sheets || {}));
    if (current.outputFileId === fileId && current.sheet) changedSheets.add(current.sheet);
    diffs[fileId] = diff;
    files.push({
      fileId,
      name: "output",
      sheetNames: Object.keys(prepared.outputTarget.working || {}),
      sheets: pickPreviewSheets(afterPreview, changedSheets),
      forcedValueCells: forcedCells.filter(cell => cell.fileId === fileId),
      formulas: {},
      formats: {},
      dimensions: sheetDimensions(prepared.outputTarget.working),
      diff,
      workerWorkbookId: prepared.outputTarget.workbookId,
    });
  }
  const result = { files, diffs, forcedValueCells: forcedCells, cacheHit: false };
  rememberPipelineCache(cacheKey, {
    result: deepClone(result),
    workbooks: cacheWorkbooks,
  });
  return result;
}

function exportWorkbook(payload) {
  const wb = getWorkbook(payload.workbookId);
  return { sheets: wb.current || wb.original || {} };
}

function handleCommand(cmd) {
  if (cmd.type === "ping") return { ok: true };
  if (cmd.type === "initWorkbook") {
    setWorkbook(cmd.workbookId, cmd.sheets || {}, cmd.currentSheets || null);
    pipelineCache.clear();
    return { ok: true };
  }
  if (cmd.type === "runPipeline") {
    return { ok: true, ...runPipeline(cmd.payload || {}) };
  }
  if (cmd.type === "exportWorkbook") {
    return { ok: true, ...exportWorkbook(cmd.payload || {}) };
  }
  throw new Error(`unknown command: ${cmd.type}`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", line => {
  if (!line.trim()) return;
  let cmd = null;
  try {
    cmd = JSON.parse(line);
    Promise.resolve(handleCommand(cmd))
      .then(result => process.stdout.write(JSON.stringify({ id: cmd.id, ...result }) + "\n"))
      .catch(err => process.stdout.write(JSON.stringify({
        id: cmd.id,
        ok: false,
        error: err && err.message || String(err),
        errorInfo: err && err.errorInfo || null,
      }) + "\n"));
  } catch (err) {
    process.stdout.write(JSON.stringify({
      id: cmd && cmd.id,
      ok: false,
      error: err && err.message || String(err),
    }) + "\n");
  }
});
