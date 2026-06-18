/* ===================================================================
   LOGIC PIPELINE
   =================================================================== */
function isStepEnabled(step) {
  return !step || step.enabled !== false;
}

function inferPipelineStepLanguage(step) {
  if (step && (step.language === "python" || step.language === "javascript" || step.language === "vba")) return step.language;
  const code = String((step && step.code) || "");
  if (/^\s*sub\s+\w+\s*\(/im.test(code) && /\bend\s+sub\b/i.test(code)) return "vba";
  if (/^\s*def\s+transform\s*\(\s*ctx\s*\)\s*:/m.test(code)) return "python";
  if (/^\s*def\s+transform\s*\(/m.test(code) || /\bctx\.(?:sheet|input|output|workbook|excel)\b/.test(code)) return "python";
  if (/^\s*function\s+transform\s*\(\s*inputs\s*,\s*output\s*\)/m.test(code)) return "javascript";
  return "javascript";
}

function normalizeStep(step) {
  const next = { enabled: true, ...step };
  next.language = inferPipelineStepLanguage(next);
  return next;
}

function ensurePipelineStepIds() {
  const seen = new Set();
  let changed = false;
  state.pipeline = (state.pipeline || []).map(step => {
    const next = normalizeStep(step || {});
    if (!next.id || seen.has(next.id)) {
      next.id = uid();
      changed = true;
    }
    seen.add(next.id);
    return next;
  });
  return changed;
}

function shouldDeferImmediatePipelineRun() {
  return pipelineUsesPython(state.pipeline) ||
    (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks());
}

// [혼합 호환] 레거시 python 방언 감지 — 구버전 openpyxl ctx 헬퍼(rows/sheet/value/write_grid…),
// openpyxl 직접 사용, 구 마커(# B2B_ENGINE: openpyxl / # B2B_ENGINE_FALLBACK: excel-com).
// 이런 스텝은 라이브 COM ctx 로 실행할 수 없으므로 백엔드(openpyxl/숨김 Excel 워커) 경로로 보낸다.
function pythonStepUsesLegacyDialect(code) {
  const text = String(code || "");
  if (/^\s*#\s*B2B_ENGINE\s*:\s*openpyxl/im.test(text)) return true;
  if (/^\s*#\s*B2B_ENGINE_FALLBACK\s*:\s*excel-com/im.test(text)) return true;
  if (/\bopenpyxl\b|\bload_workbook\s*\(/.test(text)) return true;
  if (/\bctx\.(?:rows|rows_with_index|iter_rows|sheet|input|workbook|write_grid|set_range|col|display_rows|display_value|value|cell)\s*\(/.test(text)) return true;
  if (/\bctx\.workbook\b/.test(text)) return true;
  if (/\bws\.cell\s*\(|\.iter_rows\s*\(/.test(text)) return true;
  return false;
}

// [혼합 호환] 스텝의 라이브 실행 언어 — vba/python(COM bulk)이면 라이브 Excel 에서 실행 가능.
// 레거시 방언이면 null(백엔드 전용). 파이프라인에 백엔드 전용 스텝이 하나라도 섞이면
// 순서 보존을 위해 전체를 백엔드 체인으로 보낸다(pipelineHasBackendOnlyStep).
function pipelineStepLiveLanguage(s) {
  if (!s || !s.code) return null;
  const lang = s.language || (typeof inferPipelineStepLanguage === "function" ? inferPipelineStepLanguage(s) : "");
  if (lang === "vba") return "vba";
  if (lang !== "python") return null;
  return pythonStepUsesLegacyDialect(s.code) ? null : "python";
}

// 켜진 스텝 중 라이브 실행 불가(레거시 python/기타) 스텝이 있는가 — 있으면 전체 백엔드 라우팅.
function pipelineHasBackendOnlyStep(steps = state.pipeline) {
  return (steps || []).some(s => s && s.code && isStepEnabled(s) && !pipelineStepLiveLanguage(s));
}

function pipelineUsesPython(steps = state.pipeline) {
  return (steps || []).some(step => step && isStepEnabled(step) && inferPipelineStepLanguage(step) === "python");
}

function pipelineUsesVba(steps = state.pipeline) {
  return (steps || []).some(step => step && isStepEnabled(step) && inferPipelineStepLanguage(step) === "vba");
}

function pipelineMixesLivePythonAndVba(steps = state.pipeline) {
  const active = activePipelineSteps(steps);
  const hasVba = active.some(step => inferPipelineStepLanguage(step) === "vba");
  const hasLivePython = active.some(step =>
    inferPipelineStepLanguage(step) === "python" && !pythonStepUsesLegacyDialect(step && step.code));
  return hasVba && hasLivePython;
}

function pipelineUsesLiveSkill(steps = state.pipeline) {
  return (steps || []).some(s => !!pipelineStepLiveLanguage(s));
}

function activePipelineSteps(steps = state.pipeline) {
  return (steps || []).filter(step => step && isStepEnabled(step));
}

function stepRequiresFullWorkbookExecution(step) {
  if (!step || !isStepEnabled(step)) return false;
  if (step.manual || step.manualEdit) return false;

  const code = String(step.code || "");
  const text = [
    step.description || "",
    step.prompt || "",
    step.title || "",
    code,
  ].join("\n");

  const fullCodePatterns = [
    /\bdataStartRowIndex\s*\(/,
    /\bheaderRowIndex\s*\(/,
    /for\s*\([^;]*;[^;]*<[^;]*\.length\s*;/,
    /\.(?:sort|filter|reduce)\s*\(/,
    /\bnew\s+Map\s*\(/,
    /\bObject\.(?:entries|keys|values)\s*\(/,
    /\brows\.push\s*\(/,
    /\.push\s*\(\s*row(?:\.slice\s*\(\s*\))?\s*\)/,
    /\b(?:inputs|output)\s*\[[\s\S]{0,120}\]\s*\[[\s\S]{0,120}\]\s*=\s*\[/,
  ];
  if (/\b[a-zA-Z_$][\w$]*\s*\[[\s\S]{0,120}\]\s*=\s*\[/.test(code)) return true;
  if (fullCodePatterns.some(pattern => pattern.test(code))) return true;

  const koreanFullIntentPattern = /(\uC804\uCCB4|\uC0C8\s*\uC2DC\uD2B8|\uC0C8\uD0ED|\uC0C8\s*\uD0ED|\uC815\uB82C|\uC624\uB984\uCC28\uC21C|\uB0B4\uB9BC\uCC28\uC21C|\uD544\uD130|\uCD94\uCD9C|\uC911\uBCF5|\uC9D1\uACC4|\uD569\uACC4|\uC6D4\uBCC4|\uD68C\uC0AC\uBCC4|\uADF8\uB8F9|\uD589\uB9CC|\uC870\uAC74|\uBAA9\uB85D)/;
  if (koreanFullIntentPattern.test(text)) return true;

  const fullIntentPattern = koreanFullIntentPattern;
  const scansRows = /(?:sheet|rows?|data|range|시트|행)\.length|dataStartRowIndex|headerRowIndex|for\s*\(/.test(code);
  return fullIntentPattern.test(text) && scansRows;
}

function shouldUseFastPreviewPipelineRun(steps = state.pipeline) {
  return !(steps || []).some(stepRequiresFullWorkbookExecution);
}

function getPipelineRuntimeStatus(stepId) {
  const map = window.pipelineStepRuntimeStatus || {};
  return stepId ? map[stepId] : null;
}

function setPipelineRuntimeStatus(stepIds, status, label) {
  window.pipelineStepRuntimeStatus = window.pipelineStepRuntimeStatus || {};
  (stepIds || []).forEach(stepId => {
    if (!stepId) return;
    if (!status) delete window.pipelineStepRuntimeStatus[stepId];
    else window.pipelineStepRuntimeStatus[stepId] = { status, label };
  });
  if (typeof renderPipeline === "function") renderPipeline();
}

function canUseBackendCurrentCacheForAppend() {
  return typeof hasBackendOnlyWorkbooks === "function" &&
    hasBackendOnlyWorkbooks() &&
    !window.backendCurrentCacheDirty;
}

function toJsLiteral(value) {
  return JSON.stringify(value === undefined ? "" : value);
}

function createManualEditStep(fileId, sheet, r, c, value) {
  const isOutputTarget = fileId === "output";
  const inputName = !isOutputTarget && fileId && fileId.startsWith("input:") ? fileId.slice(6) : "";
  const target = isOutputTarget ? "output" : `inputs[${toJsLiteral(inputName)}]`;
  const sheetKey = toJsLiteral(sheet);
  const valueLiteral = toJsLiteral(value);
  const descTarget = `${fileId === "output" ? "출력" : fileId.slice(6)} / ${sheet}!${_excelCol(c)}${r + 1}`;
  return {
    id: uid(),
    prompt: "manual cell edit",
    description: `직접 편집: ${descTarget}`,
    enabled: true,
    manual: true,
    code: `function transform(inputs, output) {
  if (typeof setCellValue === "function") {
    setCellValue(${isOutputTarget ? toJsLiteral("output") : toJsLiteral("input:" + inputName)}, ${sheetKey}, ${r}, ${c}, ${valueLiteral});
  } else {
    const target = ${target};
    if (!target[${sheetKey}]) target[${sheetKey}] = [];
    if (!target[${sheetKey}][${r}]) target[${sheetKey}][${r}] = [];
    target[${sheetKey}][${r}][${c}] = ${valueLiteral};
  }
  return { inputs, output };
}`,
  };
}

function createManualEditStepV3(fileId, sheet, r, c, value) {
  const outputIdx = typeof outputTemplateIndexFromFileId === "function" ? outputTemplateIndexFromFileId(fileId) : -1;
  const isOutputTarget = fileId === "output" || outputIdx >= 0;
  const inputName = !isOutputTarget && fileId && fileId.startsWith("input:") ? fileId.slice(6) : "";
  const target = isOutputTarget ? "output" : `inputs[${toJsLiteral(inputName)}]`;
  const sheetKey = toJsLiteral(sheet);
  const valueLiteral = toJsLiteral(value);
  const descName = isOutputTarget
    ? (outputIdx >= 0 ? `output template ${outputIdx + 1}` : "output")
    : inputName;
  const descTarget = `${descName} / ${sheet}!${_excelCol(c)}${r + 1}`;
  return {
    id: uid(),
    prompt: "manual cell edit",
    description: `직접 편집: ${descTarget}`,
    enabled: true,
    manual: true,
    manualEdit: { fileId, sheet, r, c, value },
    code: `function transform(inputs, output) {
  if (typeof setCellValue === "function") {
    setCellValue(${isOutputTarget ? toJsLiteral("output") : toJsLiteral("input:" + inputName)}, ${sheetKey}, ${r}, ${c}, ${valueLiteral});
  } else {
    const target = ${target};
    if (!target[${sheetKey}]) target[${sheetKey}] = [];
    if (!target[${sheetKey}][${r}]) target[${sheetKey}][${r}] = [];
    target[${sheetKey}][${r}][${c}] = ${valueLiteral};
  }
  return { inputs, output };
}`,
  };
}

createManualEditStep = createManualEditStepV3;

function rollbackAddedPipelineStep(stepId) {
  const before = state.pipeline || [];
  const next = before.filter(step => step && step.id !== stepId);
  if (next.length === before.length) return;
  state.pipeline = next;
  renderPipeline();
  refreshRunButton();
}

function restorePipelineStep(stepId, originalStep) {
  const idx = (state.pipeline || []).findIndex(step => step && step.id === stepId);
  if (idx < 0 || !originalStep) return;
  state.pipeline[idx] = originalStep;
  renderPipeline();
  refreshRunButton();
}

// VBA 스킬은 '사용자가 보고 있는 파일'(현재 세션)을 대상으로 실행한다 — 그 워크북에 결과를 쓴다.
// 다른 파일들은 라이브 최신 상태로 읽기전용 동반 오픈된다. 따라서 출력을 보며 적용하면 출력에 쓰고,
// 입력을 보며 적용하면 그 입력을 수정한다(입력 선작업 → 출력 활용 워크플로 지원).
function vbaTargetExcelId() {
  return typeof currentExcelId === "function" ? currentExcelId() : null;
}

// ---- 실행 대상 워크북 고정(pinning) ----
// 스텝은 만들어질 때의 파일(targetFileId)에 묶인다. 이후 사용자가 다른 워크북 탭(B)을 보는
// 상태에서 실행/토글/편집해도, A에서 만든 스킬은 A 탭으로 전환한 뒤 A에 적용한다.
// (B의 같은 범위 셀이 수정되는 사고 방지 — 사용자기대: "스킬은 만든 파일에서 돈다")
function pipelineDecodeWorkbookName(value) {
  let text = String(value || "").replace(/\u00a0/g, " ");
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(text);
      if (decoded === text) break;
      text = decoded;
    } catch (_) {
      break;
    }
  }
  return text;
}

function pipelineWorkbookNameKey(value, options = {}) {
  let text = pipelineDecodeWorkbookName(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (options.stem) text = text.replace(/\.[^.]+$/, "");
  return text;
}

function pipelineKnownFiles() {
  const files = [];
  const seen = new Set();
  const push = (id, file, fallback) => {
    if (!id || !file || seen.has(id)) return;
    seen.add(id);
    const displayName = typeof workbookDisplayName === "function"
      ? workbookDisplayName(file, fallback || "파일")
      : (file.name || fallback || "파일");
    files.push({ id, file, name: file.name || displayName, displayName });
  };
  (state.inputs || []).forEach((file, idx) => {
    const displayName = typeof workbookDisplayName === "function"
      ? workbookDisplayName(file, `입력 파일 ${idx + 1}`)
      : (file && file.name) || `입력 파일 ${idx + 1}`;
    push("input:" + displayName, file, `입력 파일 ${idx + 1}`);
  });
  (state.outputTemplates || []).forEach((tpl, idx) => {
    push(typeof outputTemplateFileId === "function" ? outputTemplateFileId(idx) : "output:" + idx,
      tpl && tpl.file, `출력 파일 ${idx + 1}`);
  });
  if (state.output && !(state.outputTemplates && state.outputTemplates.length)) {
    push("output", state.output, "출력 파일");
  }
  return files;
}

function pipelineFileIdByWorkbookName(name) {
  const wanted = String(name || "").trim();
  if (!wanted) return null;
  const files = pipelineKnownFiles();
  const pickUnique = matches => {
    const ids = Array.from(new Set((matches || []).map(item => item && item.id).filter(Boolean)));
    return ids.length === 1 ? ids[0] : null;
  };
  const exact = pickUnique(files.filter(item =>
    item.name === wanted || item.displayName === wanted ||
    pipelineDecodeWorkbookName(item.name) === pipelineDecodeWorkbookName(wanted) ||
    pipelineDecodeWorkbookName(item.displayName) === pipelineDecodeWorkbookName(wanted)));
  if (exact) return exact;
  const key = pipelineWorkbookNameKey(wanted);
  const normalized = pickUnique(files.filter(item =>
    pipelineWorkbookNameKey(item.name) === key ||
    pipelineWorkbookNameKey(item.displayName) === key));
  if (normalized) return normalized;
  const stem = pipelineWorkbookNameKey(wanted, { stem: true });
  return pickUnique(files.filter(item =>
    pipelineWorkbookNameKey(item.name, { stem: true }) === stem ||
    pipelineWorkbookNameKey(item.displayName, { stem: true }) === stem));
}

function pipelineFileIdsBySheetName(sheetName) {
  const wanted = String(sheetName || "").trim();
  if (!wanted) return [];
  const key = typeof normalizeText === "function"
    ? normalizeText(wanted)
    : wanted.toLowerCase().replace(/\s+/g, "");
  return pipelineKnownFiles()
    .filter(item => {
      const names = (item.file && (item.file.sheetNames || Object.keys(item.file.sheets || {}))) || [];
      return names.some(name => {
        if (name === wanted) return true;
        const cur = typeof normalizeText === "function"
          ? normalizeText(name)
          : String(name || "").toLowerCase().replace(/\s+/g, "");
        return cur === key;
      });
    })
    .map(item => item.id);
}

function pipelineResolveSavedTargetFileId(targetFileId) {
  const tid = String(targetFileId || "");
  if (!tid) return null;
  if (typeof getFile === "function" && getFile(tid)) return tid;
  if (tid.startsWith("input:")) return pipelineFileIdByWorkbookName(tid.slice(6));
  return null;
}

function pipelineCollectWorkbookNames(text) {
  const source = String(text || "");
  const names = [];
  const add = value => {
    const name = String(value || "").trim().replace(/^[:\-\s]+/, "").trim();
    if (name && /\.xls(?:x|m|b)?$/i.test(name) && !names.includes(name)) names.push(name);
  };
  let m;
  const quoted = /["']([^"'\r\n]+\.xls(?:x|m|b)?)["']/gi;
  while ((m = quoted.exec(source))) add(m[1]);
  const loose = /(?:^|[\s\[(])([^\\/:*?"<>|\r\n\[\]]+?\.xls(?:x|m|b)?)(?=$|[\s\])\/])/gim;
  while ((m = loose.exec(source))) add(m[1]);
  return names;
}

function pipelineVbaTargetWorkbookNames(code) {
  const text = String(code || "");
  const names = [];
  const add = value => { if (value && !names.includes(value)) names.push(value); };
  const isTargetVar = name => /(?:dst|dest|target|tgt|out|output)$/i.test(String(name || ""));
  let m;
  const directSet = /Set\s+([A-Za-z_]\w*)\s*=\s*(?:Application\.)?Workbooks\s*\(\s*"([^"]+)"\s*\)/gi;
  while ((m = directSet.exec(text))) {
    if (isTargetVar(m[1])) add(m[2]);
  }
  const loopSet = /If\s+[^"\r\n]*?\.Name\s*=\s*"([^"]+)"[\s\S]{0,260}?Set\s+([A-Za-z_]\w*)\s*=\s*wb\b/gi;
  while ((m = loopSet.exec(text))) {
    if (isTargetVar(m[2])) add(m[1]);
  }
  const targetComment = /(?:대상|출력|붙여넣|목적지)[^\r\n]{0,80}(?:워크북|파일)[\s\S]{0,420}?\.Name\s*=\s*"([^"]+)"/gi;
  while ((m = targetComment.exec(text))) add(m[1]);
  if (!names.length) {
    const all = pipelineCollectWorkbookNames(text);
    if (all.length === 1) add(all[0]);
  }
  return names;
}

function pipelinePythonSourceWorkbookNames(code) {
  const text = String(code || "");
  const names = [];
  let m;
  const direct = /ctx\.book\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = direct.exec(text))) {
    if (m[1] && !names.includes(m[1])) names.push(m[1]);
  }
  const varValues = {};
  const assigns = /^\s*([A-Za-z_]\w*)\s*=\s*["']([^"']+\.xls(?:x|m|b)?)["']\s*$/gim;
  while ((m = assigns.exec(text))) varValues[m[1]] = m[2];
  const viaVar = /ctx\.book\s*\(\s*([A-Za-z_]\w*)\s*\)/g;
  while ((m = viaVar.exec(text))) {
    const name = varValues[m[1]];
    if (name && !names.includes(name)) names.push(name);
  }
  // [복붙 캡처] ctx.paste_copied(..., src_book='소스', dst_book='대상') 의 src_book 은 '읽기 소스'다.
  // 교차파일(src≠dst)일 때만 소스로 표시 → 대상 추론이 dst_book(붙여넣은 파일)을 고르게 한다.
  // (같은 파일이면 src_book 을 빼지 않아 기존 동작 유지.)
  const sb = /src_book\s*=\s*["']([^"']+\.xls(?:x|m|b)?)["']/i.exec(text);
  const db = /dst_book\s*=\s*["']([^"']+\.xls(?:x|m|b)?)["']/i.exec(text);
  if (sb && db && typeof pipelineWorkbookNameKey === "function"
      && pipelineWorkbookNameKey(sb[1]) !== pipelineWorkbookNameKey(db[1])) {
    if (!names.includes(sb[1])) names.push(sb[1]);
  }
  return names;
}

function pipelinePythonTargetWorkbookNames(step) {
  const text = [step && step.prompt, step && step.description, step && step.code].filter(Boolean).join("\n");
  const sourceKeys = new Set(pipelinePythonSourceWorkbookNames(step && step.code).map(name => pipelineWorkbookNameKey(name)));
  return pipelineCollectWorkbookNames(text).filter(name => !sourceKeys.has(pipelineWorkbookNameKey(name)));
}

function pipelineConstStringVars(code) {
  const vars = {};
  let m;
  const assign = /^\s*([A-Za-z_]\w*)\s*=\s*["']([^"']+)["']\s*$/gim;
  while ((m = assign.exec(String(code || "")))) vars[m[1]] = m[2];
  return vars;
}

function pipelineResolvePyArg(token, vars) {
  const raw = String(token || "").trim();
  const quoted = /^["']([^"']+)["']$/.exec(raw);
  if (quoted) return quoted[1];
  return vars && Object.prototype.hasOwnProperty.call(vars, raw) ? vars[raw] : null;
}

function pipelineTargetSheetNames(step) {
  const code = String((step && step.code) || "");
  const lang = (step && step.language) || inferPipelineStepLanguage(step);
  const names = [];
  const add = value => { if (value && !names.includes(value)) names.push(value); };
  let m;
  if (lang === "vba") {
    const dstLoop = /If\s+[^"\r\n]*?\.Name\s*=\s*"([^"]+)"[\s\S]{0,220}?Set\s+ws(?:Dst|Dest|Target|Tgt|Out|Output)\s*=\s*sh\b/gi;
    while ((m = dstLoop.exec(code))) add(m[1]);
    const direct = /Set\s+ws(?:Dst|Dest|Target|Tgt|Out|Output)\s*=\s*[^.\r\n]+\.Worksheets\s*\(\s*"([^"]+)"\s*\)/gi;
    while ((m = direct.exec(code))) add(m[1]);
    const allSheetLiterals = [];
    const sheetLit = /(?:Worksheets|Sheets)\s*\(\s*"([^"]+)"\s*\)|\.Range\s*\(\s*"([^"]+![^"]+)"\s*\)/gi;
    while ((m = sheetLit.exec(code))) {
      const value = m[1] || (m[2] && m[2].split("!")[0]);
      if (value && !allSheetLiterals.includes(value)) allSheetLiterals.push(value);
    }
    if (!names.length && allSheetLiterals.length === 1) add(allSheetLiterals[0]);
  } else if (lang === "python") {
    const vars = pipelineConstStringVars(code);
    const copy = /ctx\.copy\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,/g;
    while ((m = copy.exec(code))) add(pipelineResolvePyArg(m[3], vars));
    const write = /ctx\.(?:write|write_cell|write_formulas|clear|set_number_format|merge|unmerge|sort|filter_to_sheet)\s*\(\s*([^,\)]+)/g;
    while ((m = write.exec(code))) add(pipelineResolvePyArg(m[1], vars));
  }
  return names;
}

function inferPipelineStepTargetFileId(step) {
  if (!step) return null;
  const saved = pipelineResolveSavedTargetFileId(step.targetFileId);
  if (saved) return saved;
  const lang = (step.language || inferPipelineStepLanguage(step));
  const workbookNames = lang === "vba"
    ? pipelineVbaTargetWorkbookNames(step.code)
    : (lang === "python" ? pipelinePythonTargetWorkbookNames(step) : []);
  for (const name of workbookNames) {
    const fid = pipelineFileIdByWorkbookName(name);
    if (fid) return fid;
  }
  for (const sheetName of pipelineTargetSheetNames(step)) {
    const matches = pipelineFileIdsBySheetName(sheetName);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function pipelinePinnedTargetFileId(steps = state.pipeline) {
  const liveSteps = (steps || []).filter(s => s && pipelineStepLiveLanguage(s));
  const resolve = list => {
    for (const s of list) {
      const fid = inferPipelineStepTargetFileId(s);
      if (fid && typeof getFile === "function" && getFile(fid)) return fid;
    }
    return null;
  };
  // 켜진 스텝의 대상을 우선하되, 전부 꺼진 경우(마지막 토글 OFF 등)에도
  // 리셋이 엉뚱한(현재 탭) 워크북에 가지 않도록 전체 스텝에서 폴백한다.
  return resolve(liveSteps.filter(s => s.enabled !== false)) || resolve(liveSteps);
}

// python 스텝까지 포함한 언어 무관 핀 대상(백엔드 재실행 후 '변경된 파일' 탭 이동용).
function pipelinePinnedAnyTargetFileId(steps = state.pipeline) {
  const withTarget = (steps || []).filter(s => s && (s.targetFileId || pipelineStepLiveLanguage(s)));
  const resolve = list => {
    for (const s of list) {
      const fid = inferPipelineStepTargetFileId(s);
      if (fid && typeof getFile === "function" && getFile(fid)) return fid;
    }
    return null;
  };
  return resolve(withTarget.filter(s => s.enabled !== false)) || resolve(withTarget);
}

function pipelineHasUnresolvedTarget(steps = state.pipeline) {
  return (steps || []).some(s =>
    s && s.targetFileId && typeof getFile === "function" && !getFile(s.targetFileId) && !inferPipelineStepTargetFileId(s));
}

let _unresolvedTargetToastAt = 0;
function warnUnresolvedPipelineTarget() {
  if (Date.now() - _unresolvedTargetToastAt < 5000) return; // 실행 경로가 중첩 호출돼도 토스트 1회
  _unresolvedTargetToastAt = Date.now();
  if (typeof toast === "function") {
    toast("이 스킬이 만들어졌던 파일을 찾지 못해 현재 탭의 파일에 실행합니다.", "error");
  }
}

async function ensurePinnedVbaTargetExcelId(steps = state.pipeline) {
  const fileId = pipelinePinnedTargetFileId(steps);
  if (!fileId) return null;
  let excelId = (typeof excelMirror !== "undefined" && excelMirror.sessionsByFileId)
    ? excelMirror.sessionsByFileId[fileId]
    : null;
  if (!excelId && typeof ensureExcelMirrorForFileId === "function") {
    try { excelId = await ensureExcelMirrorForFileId(fileId); } catch (_) { excelId = null; }
  }
  return excelId ? { fileId, excelId } : null;
}

async function excelIdForPipelineFileId(fileId) {
  if (!fileId) return null;
  let excelId = (typeof excelMirror !== "undefined" && excelMirror.sessionsByFileId)
    ? excelMirror.sessionsByFileId[fileId]
    : null;
  if (!excelId && typeof ensureExcelMirrorForFileId === "function") {
    try { excelId = await ensureExcelMirrorForFileId(fileId); } catch (_) { excelId = null; }
  }
  return excelId || null;
}

// 대상 파일의 세션을 반드시 확보 — 실패하면 '다른 워크북으로 조용히 폴백'하지 않고 중단한다.
// (폴백하면 ctx.write/ActiveWorkbook 이 현재 탭 파일에 실행돼, "적용됐다"는데 출력 파일은
// 그대로이고 엉뚱한 파일이 오염되는 사고가 난다 — 탭 이동 후 토글 ON 미반영 버그의 원인.)

async function requirePipelineSessionExcelId(fileId, purpose) {
  const excelId = await excelIdForPipelineFileId(fileId);
  if (excelId) return excelId;
  const file = (typeof getFile === "function") ? getFile(fileId) : null;
  const name = (file && file.name) ? file.name : String(fileId || "대상 파일");
  throw new Error(
    `'${name}' 의 Excel 창을 열지 못해 ${purpose}를 중단했습니다(다른 파일에 잘못 쓰는 것을 막기 위한 중단). ` +
    "해당 파일 탭을 눌러 Excel 창이 뜨는 것을 확인한 뒤 다시 시도해 주세요."
  );
}

// 스텝 코드가 파일명으로 직접 참조하는 출력 파일들(교차 기록 대상).
// 입력 탭에서 만든 스킬이 Workbooks("output_....xlsx") / ctx.book("...") 으로 출력에 쓰는
// 패턴이 흔한데, 이때 리셋이 스텝의 대상(입력)만 되돌리면 출력에 쓴 값이 남아
// 토글 OFF 가 안 풀리고 ON 재실행이 중복 기록된다 → 참조된 출력도 리셋 대상에 포함.
// (입력 파일 참조는 대부분 읽기이므로 대상(targetFileId)일 때만 리셋한다.)

function crossOutputFileIdsReferencedInCode(code) {
  const text = String(code || "");
  if (!text) return [];
  const ids = [];
  (state.outputTemplates || []).forEach((tpl, idx) => {
    const name = tpl && tpl.file && tpl.file.name;
    const nameKey = pipelineWorkbookNameKey(name);
    if (name && (text.includes(name) || pipelineCollectWorkbookNames(text).some(ref => pipelineWorkbookNameKey(ref) === nameKey))) {
      ids.push(typeof outputTemplateFileId === "function" ? outputTemplateFileId(idx) : "output:" + idx);
    }
  });
  return ids;
}


function preferredVbaRunFileId() {
  if (state.currentFileId && typeof getFile === "function" && getFile(state.currentFileId)) {
    return state.currentFileId;
  }
  if (state.outputTemplates && state.outputTemplates.length) {
    const idx = state.activeOutputIndex >= 0 ? state.activeOutputIndex : 0;
    return typeof outputTemplateFileId === "function" ? outputTemplateFileId(idx) : "output:" + idx;
  }
  if (state.output) return "output";
  if (state.inputs && state.inputs.length) {
    const first = state.inputs[0];
    const name = typeof workbookDisplayName === "function"
      ? workbookDisplayName(first, "입력 파일 1")
      : first.name;
    return "input:" + name;
  }
  return null;
}

async function ensureVbaRunExcelId() {
  let excelId = vbaTargetExcelId();
  if (excelId) return excelId;

  const fileId = preferredVbaRunFileId();
  if (!fileId) throw new Error("VBA 실행 대상 파일이 없습니다. 입력 또는 출력 파일을 먼저 업로드하세요.");
  if (typeof ensureExcelMirrorForFileId === "function") {
    excelId = await ensureExcelMirrorForFileId(fileId);
    if (excelId) return excelId;
  }
  throw new Error("VBA 실행 대상 Excel 창을 열지 못했습니다. 파일 탭을 선택해 Excel 창을 연 뒤 다시 실행하세요.");
}

function shouldRunPipelineAsVba(steps = state.pipeline) {
  if (!activePipelineSteps(steps).length) return false;
  // [혼합 호환] 백엔드 전용(레거시) 스텝이 하나라도 있으면 전체를 백엔드 만능 경로로.
  if (pipelineHasBackendOnlyStep(steps)) return false;
  // Python COM + VBA 모두 라이브 실행 가능한 스텝이면 전체실행을 Excel 세션 기반 경로로 보낸다.
  // VBA가 하나라도 있으면 runVbaPipelinePreferLive 내부에서 단일 적용과 동일하게 검증된
  // /api/excel/run-vba-pipeline 격리 파이프라인을 사용한다.
  if (pipelineUsesLiveSkill(steps)) return true;
  return typeof getSkillEngine === "function" && ["vba", "python"].includes(getSkillEngine());
}

function isolatedPipelineStepPayload(step, stepIdx) {
  return {
    stepIdx,
    stepId: step && step.id || null,
    id: step && step.id || null,
    description: step && step.description || "",
    code: step && step.code || "",
    language: (step && (step.language || inferPipelineStepLanguage(step))) || "vba",
    targetFileId: step && step.targetFileId || null,
  };
}

function pipelineStepMutationFileId(step, fallbackFileId) {
  try {
    // 출력 파일을 Workbooks("output...") / ctx.book("output...") 로 직접 쓰는 스텝은
    // 격리 실행 결과를 그 출력 파일 세션에 복사해야 하므로 출력 파일을 우선 실행 대상으로 둔다.
    const cross = typeof crossOutputFileIdsReferencedInCode === "function"
      ? crossOutputFileIdsReferencedInCode(step && step.code || "") : [];
    if (cross && cross.length) return cross[0];
  } catch (_) {}
  return inferPipelineStepTargetFileId(step) || fallbackFileId;
}

async function runIsolatedLivePipelineSteps(sourceSteps, initialExcelId, options = {}) {
  const activeSteps = activePipelineSteps(sourceSteps)
    .filter(step => step && step.code && pipelineStepLiveLanguage(step));
  const explicitResetFileIds = Array.isArray(options.resetFileIds)
    ? Array.from(new Set(options.resetFileIds.filter(Boolean)))
    : [];
  if (!activeSteps.length && !explicitResetFileIds.length) return { ok: true, applied: 0 };

  const pinnedFileId = pipelinePinnedTargetFileId(sourceSteps);
  const visibleFileId = initialExcelId && typeof fileIdForExcelMirrorId === "function"
    ? fileIdForExcelMirrorId(initialExcelId) : null;
  const fallbackFileId = options.fallbackFileId || pinnedFileId || visibleFileId || explicitResetFileIds[0] || state.currentFileId || preferredVbaRunFileId();
  if (!fallbackFileId) {
    throw new Error("전체실행 대상 파일을 결정할 수 없습니다. 파일 탭을 먼저 선택한 뒤 다시 실행하세요.");
  }

  const groups = [];
  for (const step of activeSteps) {
    const stepIdx = (sourceSteps || state.pipeline || []).indexOf(step);
    const fileId = pipelineStepMutationFileId(step, fallbackFileId);
    if (!fileId) throw new Error("스킬 실행 대상 파일을 결정할 수 없습니다: " + (step.description || "이름 없는 단계"));
    const payload = isolatedPipelineStepPayload(step, stepIdx);
    const last = groups[groups.length - 1];
    if (last && last.fileId === fileId) last.steps.push(payload);
    else groups.push({ fileId, steps: [payload] });
  }

  const mutedExcelIds = [];
  const resetDone = new Set();
  let loadingStarted = false;
  let applied = 0;
  let lastData = null;
  const pipelineTimeoutMs = n => Math.max(90000, Math.min(300000, 60000 + n * 30000));
  const pipelineTimeoutMessage = "스킬 파이프라인 실행 응답이 지연되어 중단했습니다. 저사양 PC에서는 백그라운드에서 계속 적용 중일 수 있으니 잠시 후 화면을 확인해 주세요.";
  try {
    if (explicitResetFileIds.length) {
      for (const resetFileId of explicitResetFileIds) {
        const resetExcelId = await requirePipelineSessionExcelId(resetFileId, "워크북 리셋");
        if (!mutedExcelIds.includes(resetExcelId) && typeof muteExcelMirrorForPipeline === "function") {
          muteExcelMirrorForPipeline(resetExcelId);
          mutedExcelIds.push(resetExcelId);
        }
        if (!loadingStarted && typeof beginExcelMirrorApplyLoading === "function") {
          beginExcelMirrorApplyLoading("스킬 전체실행 중...", { hideWindows: false });
          loadingStarted = true;
        }
        const resetData = await postExcelMirror("/api/excel/run-vba-pipeline", {
          excelId: resetExcelId,
          steps: [],
          reset: true,
          viewSheet: options.viewSheet || null,
        }, 0, {
          timeoutMs: 180000,
          timeoutMessage: "워크북 리셋 응답이 지연되어 중단했습니다. 저사양 PC에서는 백그라운드에서 계속 진행 중일 수 있으니 잠시 후 화면을 확인해 주세요.",
        });
        lastData = resetData;
        resetDone.add(resetFileId);
        if (resetData && resetData.liveSchema) {
          try { applyLiveSchemaToFileCache(resetExcelId, resetData.liveSchema); } catch (_) {}
        }
      }
    }
    for (const group of groups) {
      const excelId = await requirePipelineSessionExcelId(group.fileId, "스킬 전체실행");
      const ids = group.steps.map(s => s.stepId).filter(Boolean);
      if (ids.length) setPipelineRuntimeStatus(ids, "running", "작업 중");
      if (!mutedExcelIds.includes(excelId) && typeof muteExcelMirrorForPipeline === "function") {
        muteExcelMirrorForPipeline(excelId);
        mutedExcelIds.push(excelId);
      }
      if (!loadingStarted && typeof beginExcelMirrorApplyLoading === "function") {
        beginExcelMirrorApplyLoading("스킬 전체실행 중...", { hideWindows: false });
        loadingStarted = true;
      }
      const data = await postExcelMirror("/api/excel/run-vba-pipeline", {
        excelId,
        steps: group.steps,
        reset: !resetDone.has(group.fileId),
        viewSheet: options.viewSheet || null,
      }, 0, {
        timeoutMs: pipelineTimeoutMs(group.steps.length),
        timeoutMessage: pipelineTimeoutMessage,
      });
      lastData = data;
      resetDone.add(group.fileId);
      applied += group.steps.length;
      if (ids.length) setPipelineRuntimeStatus(ids, "applied", "적용됨");
      if (data && data.liveSchema) {
        try { applyLiveSchemaToFileCache(excelId, data.liveSchema); } catch (_) {}
      }
    }
    if (loadingStarted && typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
    if (typeof releaseExcelMirrorPipelineMute === "function") {
      mutedExcelIds.forEach(id => releaseExcelMirrorPipelineMute(id));
    }
    if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(180);
    noteLivePipelineApplied(sourceSteps);
    return lastData || { ok: true, applied };
  } catch (err) {
    if (loadingStarted && typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
    if (typeof releaseExcelMirrorPipelineMute === "function") {
      mutedExcelIds.forEach(id => releaseExcelMirrorPipelineMute(id));
    }
    if (initialExcelId) restoreVbaExcelAfterError(initialExcelId);
    throw err;
  }
}

function pipelineStepReadsOtherFile(step) {
  // 교차파일 복붙(소스≠대상): ctx.paste_copied(..., src_book='X', dst_book='Y') 에서 X≠Y.
  // 라이브 경로로 돌리면 소스 워크북을 직접 읽어 그 창의 보호뷰(리본 숨김)가 풀리고 잠겨
  // 재업로드가 안 된다. 격리 경로는 소스를 throwaway 복사본으로 읽어 라이브 소스를 안 건드린다.
  const code = String((step && step.code) || "");
  const sb = /src_book\s*=\s*["']([^"']+)["']/i.exec(code);
  const db = /dst_book\s*=\s*["']([^"']+)["']/i.exec(code);
  if (sb && db && typeof pipelineWorkbookNameKey === "function") {
    return pipelineWorkbookNameKey(sb[1]) !== pipelineWorkbookNameKey(db[1]);
  }
  return false;
}

async function runVbaPipelinePreferLive(options = {}) {
  const steps = options.pipeline || state.pipeline;
  const activeSteps = activePipelineSteps(steps);
  if (!activeSteps.length) throw new Error("실행할 활성 스킬이 없습니다.");
  const unsupported = activeSteps.filter(step => !["vba", "python"].includes(inferPipelineStepLanguage(step)));
  if (unsupported.length) {
    throw new Error("현재 실행기는 VBA/Python 스킬만 라이브 Excel에서 실행합니다. 기존 JavaScript 스킬은 다시 생성해 주세요.");
  }
  // 실행 버튼: VBA는 "단일 적용"처럼 실행 직전 탭/오버레이 전환을 하지 않는다.
  // 전체실행에서만 Application.Run 이 막히는 환경은 이 전환 직후 Excel 인스턴스가
  // 매크로 실행 불가 상태가 되는 케이스라, 대상 세션 ID만 확보해서 그대로 실행한다.
  const hasVbaStep = activeSteps.some(step => inferPipelineStepLanguage(step) === "vba");
  // 단일 적용은 항상 현재 보이는 Excel 세션(vbaTargetExcelId)을 쓴다.
  // 전체실행도 같은 파일이면 이 세션을 우선해야 한다. 파일명 추론으로 같은 이름의
  // 다른 작업복사본/숨김 세션을 잡으면 단일 적용과 다른 Excel 상태에서 실행된다.
  let excelId = vbaTargetExcelId() || (typeof currentExcelId === "function" ? currentExcelId() : null);
  if (!excelId && !hasVbaStep) {
    try {
      const pinned = await ensurePinnedVbaTargetExcelId(steps);
      if (pinned) excelId = pinned.excelId;
    } catch (_) {}
  }
  if (!excelId && pipelineHasUnresolvedTarget(steps)) warnUnresolvedPipelineTarget();
  if (!excelId) {
    if (hasVbaStep) {
      const fid = pipelinePinnedTargetFileId(steps) || preferredVbaRunFileId();
      if (!excelId && fid) excelId = await excelIdForPipelineFileId(fid);
    } else if (pipelineHasUnresolvedTarget(steps)) {
      warnUnresolvedPipelineTarget();
    }
  }
  if (!excelId) {
    if (hasVbaStep) {
      throw new Error("VBA 전체실행 대상 Excel 창을 열지 못했습니다. 파일 탭에서 Excel 창이 열린 상태인지 확인한 뒤 다시 실행하세요.");
    }
    excelId = await ensureVbaRunExcelId();
  }
  // 교차파일 복붙(소스≠대상)이 하나라도 있으면 격리 파이프라인으로 돌린다. 라이브 경로는 소스
  // 워크북을 직접 읽어 그 창의 보호뷰가 풀리고/잠겨 재업로드가 막히는 부작용이 있다(실측). 격리
  // 경로는 소스를 throwaway 복사본으로만 읽으므로 라이브 소스를 전혀 건드리지 않는다.
  const hasCrossFileStep = activeSteps.some(pipelineStepReadsOtherFile);
  if (hasVbaStep || hasCrossFileStep) {
    // 사용자가 확인한 실패 케이스의 공통점은 전체실행에서 라이브 임베드 Excel 인스턴스가
    // Application.Run 을 거부하는 것이다. VBA 가 하나라도 있으면(또는 교차파일 복붙이면) 새 비임베드
    // Excel 에서 순서대로 실행한 뒤 결과 워크북만 라이브로 복사한다. Python COM 스텝이 섞여도 같은
    // 격리 파이프라인 안에서 순서를 유지한다.
    return runIsolatedLivePipelineSteps(steps, excelId, options);
  }
  // 전체실행도 "채팅에서 생성 → 적용"과 같은 단일 적용 함수를 스텝 순서대로 재사용한다.
  // 별도 reapply 전용 적용기를 태우면 Native Excel 창 숨김/복원/표시 타이밍이 달라져
  // 단일 적용은 되는데 전체실행만 빈 Excel 창이 뜨거나 VBA 실행이 막히는 차이가 생긴다.
  let appliedCount = 0;
  for (const step of activeSteps) {
    let stepExcelId = excelId;
    const stepFileId = inferPipelineStepTargetFileId(step);
    if (stepFileId) {
      if (stepFileId === state.currentFileId) {
        stepExcelId = vbaTargetExcelId() || (typeof currentExcelId === "function" ? currentExcelId() : null) || excelId;
      }
      if (!stepExcelId) stepExcelId = await requirePipelineSessionExcelId(stepFileId, "스킬 적용");
    } else if (!stepExcelId) {
      stepExcelId = await ensureVbaRunExcelId();
    }
    const res = applyVbaStepToLiveExcel(step, stepExcelId, {
      appendToPipeline: false,
      showToasts: false,
      rollbackOnFailure: false,
      reportError: false,
    });
    const applied = res && res.promise ? await res.promise : res;
    if (applied && applied.cancelled) return applied;
    appliedCount += 1;
  }
  return { ok: true, applied: appliedCount };
}

function recordVbaDebugTiming(record) {
  if (typeof window.recordBackendDebugTiming !== "function") return;
  window.recordBackendDebugTiming({
    kind: "vba",
    worker: false,
    baseMode: "live",
    polls: 0,
    receiveMs: 0,
    receiveBytes: 0,
    applyRenderMs: 0,
    ...record,
  });
}

function restoreVbaExcelAfterError(excelId) {
  if (typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
  if (typeof releaseExcelMirrorPipelineMute === "function") releaseExcelMirrorPipelineMute(excelId);
  if (excelId && typeof recoverExcelMirrorWindow === "function") {
    recoverExcelMirrorWindow(excelId)
      .catch(err => {
        if (typeof isMissingExcelSessionError !== "function" || !isMissingExcelSessionError(err)) {
          console.warn("Excel mirror error recovery failed:", err);
        }
        if (typeof showOnlyExcelMirrorWindow === "function") {
          return showOnlyExcelMirrorWindow(excelId, { force: true }).catch(() => null);
        }
        return null;
      });
    return;
  }
  if (excelId && typeof positionExcelMirrorWindow === "function") {
    positionExcelMirrorWindow(excelId, { force: true })
      .then(() => {
        if (typeof raiseExcelMirrorWindow === "function") return raiseExcelMirrorWindow(excelId);
        return null;
      })
      .catch(err => {
        if (typeof isMissingExcelSessionError !== "function" || !isMissingExcelSessionError(err)) {
          console.warn("Excel mirror error restore failed:", err);
        }
      });
  }
  if (excelId && typeof stabilizeExcelMirrorZOrder === "function") {
    try { stabilizeExcelMirrorZOrder(excelId); } catch (_) {}
  }
  if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0);
}

// [#19] 진행 중인 단일 VBA 적용을 취소하고 안전 복귀한다.
// 서버 매크로는 EXCEL_LOCK 동기 실행이라 즉시 인터럽트가 불가하다(한계). 대신 진행 단계의 결과를
// 무시(취소 토큰)하고, 원본 리셋 + 남은 enabled 스텝 재적용으로 '이전 정상 상태'로 되돌린다.
// 실행 중이던 매크로의 부분 변경은 이 재적용이 덮어써서 오류 상태로 남지 않게 한다.
async function requestExcelApplyCancel() {
  const active = window.__activeVbaApply;
  if (!active || !active.token || active.token.cancelled) return false;
  active.token.cancelled = true;
  toast("작업 중단 요청 — 이전 상태로 되돌리는 중...", "error");
  // 낙관적으로 추가/수정됐던 진행 단계를 파이프라인에서 제거하거나 이전 내용으로 복원.
  if (active.restorePipeline && Array.isArray(active.restorePipeline)) {
    // [중단 복원] 토글/삭제발 재적용을 중단하면 변경 전 파이프라인 전체로 되돌린다
    // (reconcile 경로는 단일 stepId 가 아니라 파이프라인 상태 변경이라 스냅샷으로 복원).
    state.pipeline = active.restorePipeline;
  } else if (active.stepId && Array.isArray(state.pipeline)) {
    if (active.restoreStep) {
      const idx = state.pipeline.findIndex(s => s && s.id === active.stepId);
      if (idx >= 0) state.pipeline[idx] = active.restoreStep;
    } else {
      state.pipeline = state.pipeline.filter(s => s && s.id !== active.stepId);
    }
    if (typeof setPipelineRuntimeStatus === "function") setPipelineRuntimeStatus([active.stepId], null);
  }
  if (typeof renderPipeline === "function") renderPipeline();
  if (typeof refreshRunButton === "function") refreshRunButton();
  const excelId = active.excelId || (typeof vbaTargetExcelId === "function" ? vbaTargetExcelId() : null);
  window.__activeVbaApply = null;
  try {
    if (excelId && typeof reapplyVbaPipelineToLive === "function") {
      await reapplyVbaPipelineToLive(excelId, { steps: state.pipeline });
    }
    toast("작업을 중단하고 이전 상태로 되돌렸습니다.", "success");
    return true;
  } catch (err) {
    toast("중단 후 복귀 중 오류: " + ((err && err.message) || err), "error");
    return false;
  }
}

// 0.4.9 리모콘 모델: 생성된 VBA를 라이브 워크북에 즉시 주입 실행한다.
// 파이프라인 재실행/시뮬레이터를 거치지 않으므로 초저지연이고, 결과는 우측 라이브 엑셀에 바로 보인다.
function applyVbaStepToLiveExcel(step, excelId, options = {}) {
  const perfStartedAt = performance.now();
  const appendToPipeline = options.appendToPipeline !== false;
  const showToasts = options.showToasts !== false;
  const rollbackOnFailure = options.rollbackOnFailure !== false;
  // [0.5.2.2] 언어에 따라 실행기 선택 — python(def transform(ctx)) 은 Python COM 라이브 엔진.
  const liveLang = step.language || (typeof inferPipelineStepLanguage === "function" ? inferPipelineStepLanguage(step) : "vba");
  const liveEndpoint = liveLang === "python" ? "/api/excel/run-python" : "/api/excel/run-vba";
  let prehideMs = 0;
  let requestMs = 0;
  if (appendToPipeline && typeof pushHistory === "function") pushHistory("단계 추가");
  if (appendToPipeline) state.pipeline.push(step);
  setPipelineRuntimeStatus([step.id], "running", "작업 중");
  renderPipeline();
  refreshRunButton();
  if (appendToPipeline && typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-added");
  if (typeof muteExcelMirrorForPipeline === "function") muteExcelMirrorForPipeline(excelId);
  // [#19] 취소 토큰 등록: '작업 중단' 버튼이 이 적용을 취소하고 안전 복귀(reset 재적용)하게 한다.
  // 서버 매크로는 EXCEL_LOCK 동기 실행이라 즉시 인터럽트는 불가 → 취소 시엔 결과를 무시하고
  // 원본 리셋+남은 스텝 재적용으로 '이전 상태'로 되돌린다(requestExcelApplyCancel 참고).
  const cancelToken = { cancelled: false };
  window.__activeVbaApply = { token: cancelToken, excelId, stepId: step.id };
  if (typeof beginExcelMirrorApplyLoading === "function") beginExcelMirrorApplyLoading(liveLang === "python" ? "스킬 적용 중(Python)..." : "스킬 적용 중(VBA)...");
  const prehide = typeof hideAllExcelMirrorWindows === "function"
    ? (async () => {
        const started = performance.now();
        try {
          await hideAllExcelMirrorWindows();
        } catch (_) {
        } finally {
          prehideMs = performance.now() - started;
        }
      })()
    : Promise.resolve();
  const promise = prehide
    .then(() => {
      const requestStarted = performance.now();
      return postExcelMirror(liveEndpoint, { excelId, code: step.code }, 0, {
        // 저사양 PC: 실행 + 전/후 변경검출(전 시트 스냅샷 2회)까지 포함되므로 20초는 빠듯해
        // '실패 표시 후 실제로는 적용되는' 상태 불일치를 만들었다 → 45초로 완화.
        timeoutMs: 45000,
        timeoutMessage: "스킬 실행 응답이 지연되어 중단했습니다. 저사양 PC에서는 백그라운드에서 계속 적용 중일 수 있으니 잠시 후 화면을 확인해 주세요.",
      })
        .then(data => {
          requestMs = performance.now() - requestStarted;
          return data;
        });
    })
    .then((data) => {
      // [#19] 취소된 적용이면 결과를 무시(상태/토스트/복원은 취소 핸들러가 담당).
      if (cancelToken.cancelled) {
        if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
        return { cancelled: true };
      }
      if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
      // [#5] 구조 변경(열삭제·시트추가 등) 응답이면 대상 파일의 스키마 캐시를 갱신 —
      // 다음 단계 생성이 옛 구조(삭제된 열 등)를 보지 않게 한다.
      if (data && data.liveSchema) {
        try { applyLiveSchemaToFileCache(excelId, data.liveSchema); } catch (_) {}
      }
      setPipelineRuntimeStatus([step.id], "applied", "적용됨");
      noteLivePipelineApplied(state.pipeline); // [0.5.2.2] 추가 적용 완료 상태 기억(no-op 편집 생략용)
      if (typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
      if (typeof releaseExcelMirrorPipelineMute === "function") releaseExcelMirrorPipelineMute(excelId);
      if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(180);
      recordVbaDebugTiming({
        action: appendToPipeline ? "append" : "single-replay",
        steps: 1,
        prehideMs,
        startRequestMs: requestMs,
        totalClientMs: performance.now() - perfStartedAt,
        server: (data && data.debugTimings) || {},
      });
      if (showToasts) toast(`"${step.description}" 적용됨`, "success");
      return true;
    })
    .catch(err => {
      // [#19] 취소된 적용의 (지연된) 오류는 삼킨다 — 복귀는 취소 핸들러가 이미 수행 중.
      if (cancelToken.cancelled) {
        if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
        return { cancelled: true };
      }
      if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
      const failedIdx = (state.pipeline || []).findIndex(s => s && s.id === step.id);
      attachPipelineStepError(err, step, failedIdx >= 0 ? failedIdx : (state.pipeline || []).length - 1);
      setPipelineRuntimeStatus([step.id], "error", "오류");
      restoreVbaExcelAfterError(excelId);
      // [#2] 적용에 실패한(라이브에 들어가지 못한) 새 스텝은 파이프라인에서 제거한다.
      // 안 그러면 항상 raise 하는 깨진 스텝(예: "데이터가 없습니다")이 남아 이후 모든 재적용이
      // 그 스텝에서 또 실패 → 후속 작업이 전부 막히는 마비를 일으킨다(백엔드 경로와 동일하게 정리).
      if (rollbackOnFailure && typeof rollbackAddedPipelineStep === "function") rollbackAddedPipelineStep(step.id);
      renderPipeline();
      refreshRunButton();
      if (options.reportError !== false) reportPipelineError(err);
      throw err;
    });
  if (showToasts) toast(`"${step.description}" 단계를 라이브 Excel에 적용 중...`, "success");
  return {
    pending: true,
    promise,
    cancel: () => (typeof requestExcelApplyCancel === "function" ? requestExcelApplyCancel() : false),
  };
}

async function runLivePipelineStepSequentially(step, excelId, options = {}) {
  const lang = step.language || pipelineStepLiveLanguage(step) ||
    (typeof inferPipelineStepLanguage === "function" ? inferPipelineStepLanguage(step) : "vba");
  if (!["vba", "python"].includes(lang)) {
    throw new Error("라이브 전체실행에서 지원하지 않는 스킬 언어입니다: " + lang);
  }
  const endpoint = lang === "python" ? "/api/excel/run-python" : "/api/excel/run-vba";
  const stepId = step.stepId || step.id || null;
  const stepIdx = Number.isInteger(step.stepIdx) ? step.stepIdx : -1;
  const timeoutMs = Number(options.timeoutMs) || 90000;
  if (stepId) setPipelineRuntimeStatus([stepId], "running", "작업 중");
  const requestStarted = performance.now();
  try {
    // 단일 채팅 적용(applyVbaStepToLiveExcel)과 같은 Excel 상태로 맞춘다.
    // Native/WebView에서 보이는 Excel 창을 호스트로 둔 채 Application.Run 하면
    // 대상 .xlsx 직접 주입도, 임시 .xlsm runner도 "매크로 실행 불가"로 막히는 경우가 있다.
    if (options.prehide !== false && typeof hideAllExcelMirrorWindows === "function") {
      try { await hideAllExcelMirrorWindows(); } catch (_) {}
    }
    const payload = { excelId, code: step.code || "" };
    if (options.restoreWindow === false && lang === "vba") payload.restoreWindow = false;
    const data = await postExcelMirror(endpoint, payload, 0, {
      timeoutMs,
      timeoutMessage: "스킬 실행 응답이 지연되어 중단했습니다. 저사양 PC에서는 백그라운드에서 계속 적용 중일 수 있으니 잠시 후 화면을 확인해 주세요.",
    });
    if (data && data.liveSchema) {
      try { applyLiveSchemaToFileCache(excelId, data.liveSchema); } catch (_) {}
    }
    if (stepId) setPipelineRuntimeStatus([stepId], "applied", "적용됨");
    return { data, requestMs: performance.now() - requestStarted };
  } catch (err) {
    if (stepId) setPipelineRuntimeStatus([stepId], "error", "오류");
    attachPipelineStepError(err, step, stepIdx);
    throw err;
  }
}

function applyLogic(step) {
  step = normalizeStep(step);
  // 이 스텝이 만들어진(=지금 보고 있는) 파일을 실행 대상으로 고정한다.
  // 이후 다른 탭에서 실행/토글해도 이 파일로 전환해 실행된다.
  if (!step.targetFileId && state.currentFileId) step.targetFileId = state.currentFileId;
  // 라이브 실행기(VBA/Python COM): 파이프라인/시뮬레이터를 우회해 라이브 엑셀에 즉시 실행.
  {
    const liveLang = pipelineStepLiveLanguage(step);
    // [혼합 호환] 기존 파이프라인에 백엔드 전용(레거시) 스텝이 있으면 새 스텝도 백엔드 체인에
    // 합류시킨다 — 라이브와 백엔드에 절반씩 적용되면 스텝 간 데이터 의존 순서가 깨진다.
    if ((liveLang === "vba" || liveLang === "python") && !pipelineHasBackendOnlyStep(state.pipeline)) {
      const liveExcelId = vbaTargetExcelId();
      if (liveExcelId) return applyVbaStepToLiveExcel(step, liveExcelId);
      // 라이브 세션이 없으면 대상 파일 미러를 연 뒤 적용(Python 을 백엔드 openpyxl 로 보내지 않는다).
      const pendingPromise = ensureVbaRunExcelId().then(excelId => {
        const res = applyVbaStepToLiveExcel(step, excelId);
        return res && res.promise ? res.promise : res;
      });
      return { pending: true, promise: pendingPromise };
    }
  }
  const next = [...state.pipeline, step];
  const mustUseExcelBackend = pipelineUsesPython(next) || shouldDeferImmediatePipelineRun();
  if (mustUseExcelBackend) {
    if (typeof pushHistory === "function") pushHistory("단계 추가");
    state.pipeline.push(step);
    setPipelineRuntimeStatus([step.id], "running", "\uC791\uC5C5 \uC911");
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-added");
    const useCurrentCache = !pipelineUsesPython(state.pipeline) && canUseBackendCurrentCacheForAppend();
    const promise = reconcilePipelineSimulationAfterEdit({
      forceBackend: true,
      affectedStep: step,
      steps: useCurrentCache ? [step] : state.pipeline,
      backendBaseMode: useCurrentCache ? "current" : "original",
    })
      .then((st) => {
        if (st && st.cancelled) {
          setPipelineRuntimeStatus([step.id], "review", "중단됨 · 미적용");
          return { cancelled: true };
        }
        setPipelineRuntimeStatus([step.id], "applied", "\uC801\uC6A9\uB428");
        return true;
      })
      .catch(err => {
        setPipelineRuntimeStatus([step.id], "error", "\uC624\uB958");
        rollbackAddedPipelineStep(step.id);
        reportPipelineError(err);
        throw err;
      });
    toast(`"${step.description}" 단계가 추가되었습니다. 시뮬레이터에 반영 중입니다.`, "success");
    return { pending: true, promise, cancel: () => (typeof cancelActiveBackendPipeline === "function" ? cancelActiveBackendPipeline() : false) };
  }
  try {
    runPipeline(next);
    if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
      window.backendCurrentCacheDirty = true;
    }
    if (typeof pushHistory === "function") pushHistory("단계 추가");
    state.pipeline.push(step);
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-added");
    toast(`"${step.description}" 단계가 추가되었습니다`, "success");
    return true;
  } catch (err) {
    reportPipelineError(err);
    console.error(err);
    return { error: true, errorObject: err };
  }
}

// 1-based position. position=1 → 맨 앞, position=N+1 → 맨 뒤(append와 동일)
function insertLogic(step, position) {
  step = normalizeStep(step);
  if (!step.targetFileId && state.currentFileId) step.targetFileId = state.currentFileId;
  const total = state.pipeline.length;
  const idx = Math.max(0, Math.min(total, (position | 0) - 1));
  const next = state.pipeline.slice();
  next.splice(idx, 0, step);
  // 0.4.9 VBA: 중간 삽입은 순서가 바뀌므로 라이브를 리셋하고 enabled 스텝을 처음부터 재적용.
  if (step.language === "vba") {
    const liveExcelId = vbaTargetExcelId();
    if (liveExcelId) {
      if (typeof pushHistory === "function") pushHistory("단계 삽입");
      state.pipeline = next;
      setPipelineRuntimeStatus([step.id], "running", "작업 중");
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-inserted");
      const cancelToken = { cancelled: false };
      window.__activeVbaApply = { token: cancelToken, excelId: liveExcelId, stepId: step.id };
      const promise = reapplyVbaPipelineToLive(liveExcelId)
        .then(() => {
          if (cancelToken.cancelled) {
            if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
            return { cancelled: true };
          }
          if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
          setPipelineRuntimeStatus([step.id], "applied", "적용됨");
          return true;
        })
        .catch(err => {
          if (cancelToken.cancelled) {
            if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
            return { cancelled: true };
          }
          if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
          setPipelineRuntimeStatus([step.id], "error", "오류");
          // 깨진 삽입 스텝을 파이프라인에서 제거 — 안 하면 이후 모든 재적용이 이 스텝에서 반복
          // 실패해 작업 마비(다른 적용 경로와 동일하게 롤백). [#17]
          rollbackAddedPipelineStep(step.id);
          renderPipeline();
          refreshRunButton();
          reportPipelineError(err);
          throw err;
        });
      return {
        pending: true,
        promise,
        cancel: () => (typeof requestExcelApplyCancel === "function" ? requestExcelApplyCancel() : false),
      };
    }
  }
  const mustUseExcelBackend = pipelineUsesPython(next) || shouldDeferImmediatePipelineRun();
  if (mustUseExcelBackend) {
    if (typeof pushHistory === "function") pushHistory("단계 삽입");
    state.pipeline = next;
    setPipelineRuntimeStatus([step.id], "running", "\uC791\uC5C5 \uC911");
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-inserted");
    const promise = reconcilePipelineSimulationAfterEdit({ forceBackend: true, affectedStep: step })
      .then((st) => {
        if (st && st.cancelled) {
          setPipelineRuntimeStatus([step.id], "review", "중단됨 · 미적용");
          return { cancelled: true };
        }
        setPipelineRuntimeStatus([step.id], "applied", "\uC801\uC6A9\uB428");
        return true;
      })
      .catch(err => {
        setPipelineRuntimeStatus([step.id], "error", "\uC624\uB958");
        rollbackAddedPipelineStep(step.id);
        reportPipelineError(err);
        throw err;
      });
    toast(`"${step.description}" 단계가 ${idx + 1}번째에 삽입되었습니다. 시뮬레이터에 반영 중입니다.`, "success");
    return { pending: true, promise, cancel: () => (typeof cancelActiveBackendPipeline === "function" ? cancelActiveBackendPipeline() : false) };
  }
  try {
    runPipeline(next);
    if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
      window.backendCurrentCacheDirty = true;
    }
    if (typeof pushHistory === "function") pushHistory("단계 삽입");
    state.pipeline = next;
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-inserted");
    toast(`"${step.description}" 단계가 ${idx + 1}번째에 삽입되었습니다`, "success");
    return true;
  } catch (err) {
    reportPipelineError(err);
    console.error(err);
    return { error: true, errorObject: err };
  }
}

function replaceLogicAt(stepId, newCode, newDescription, language) {
  const idx = state.pipeline.findIndex(s => s.id === stepId);
  if (idx < 0) {
    toast("수정 대상 단계를 찾지 못했습니다", "error");
    return false;
  }
  const originalStep = state.pipeline[idx];
  const next = state.pipeline.slice();
  next[idx] = normalizeStep({ ...next[idx], code: newCode, description: newDescription || next[idx].description, language });
  if ((typeof getSkillEngine === "function" && getSkillEngine() === "vba") || pipelineUsesVba(next)) {
    const liveExcelId = vbaTargetExcelId();
    if (liveExcelId) {
      if (typeof pushHistory === "function") pushHistory("단계 수정");
      state.pipeline = next;
      setPipelineRuntimeStatus([stepId], "running", "작업 중");
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-updated");
      const cancelToken = { cancelled: false };
      window.__activeVbaApply = { token: cancelToken, excelId: liveExcelId, stepId, restoreStep: originalStep };
      const promise = reapplyVbaPipelineToLive(liveExcelId)
        .then(() => {
          if (cancelToken.cancelled) {
            if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
            return { cancelled: true };
          }
          if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
          setPipelineRuntimeStatus([stepId], "applied", "적용됨");
          return true;
        })
        .catch(err => {
          if (cancelToken.cancelled) {
            if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
            return { cancelled: true };
          }
          if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
          setPipelineRuntimeStatus([stepId], "error", "오류");
          restorePipelineStep(stepId, originalStep);
          reportPipelineError(err);
          throw err;
        });
      toast(`Step ${idx + 1} 코드가 수정되었습니다. 라이브 Excel에 다시 반영 중입니다.`, "success");
      return {
        pending: true,
        promise,
        cancel: () => (typeof requestExcelApplyCancel === "function" ? requestExcelApplyCancel() : false),
      };
    }
  }
  const mustUseExcelBackend = pipelineUsesPython(next) || shouldDeferImmediatePipelineRun();
  if (mustUseExcelBackend) {
    if (typeof pushHistory === "function") pushHistory("단계 수정");
    state.pipeline = next;
    setPipelineRuntimeStatus([stepId], "running", "\uC791\uC5C5 \uC911");
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-updated");
    const promise = reconcilePipelineSimulationAfterEdit({ forceBackend: true, affectedStep: state.pipeline.find(s => s.id === stepId) || null })
      .then((st) => {
        if (st && st.cancelled) {
          setPipelineRuntimeStatus([stepId], "review", "중단됨 · 미적용");
          return { cancelled: true };
        }
        setPipelineRuntimeStatus([stepId], "applied", "\uC801\uC6A9\uB428");
        return true;
      })
      .catch(err => {
        setPipelineRuntimeStatus([stepId], "error", "\uC624\uB958");
        restorePipelineStep(stepId, originalStep);
        reportPipelineError(err);
        throw err;
      });
    toast(`Step ${idx + 1} 코드가 수정되었습니다. 시뮬레이터에 반영 중입니다.`, "success");
    return { pending: true, promise, cancel: () => (typeof cancelActiveBackendPipeline === "function" ? cancelActiveBackendPipeline() : false) };
  }
  try {
    runPipeline(next);
    if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
      window.backendCurrentCacheDirty = true;
    }
    if (typeof pushHistory === "function") pushHistory("단계 수정");
    state.pipeline = next;
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-updated");
    toast(`Step ${idx + 1} 코드가 수정되었습니다`, "success");
    return true;
  } catch (err) {
    reportPipelineError(err);
    console.error(err);
    return false;
  }
}

// 특정 step 직전(=steps[0..stepIdx-1] 이 적용된) 입력/출력 상태를 계산해서 반환.
// 실제 state는 변경하지 않는다. 실패 시 null 반환.
function computeStateBeforeStep(stepIdx) {
  if (state.inputsOriginal.length === 0 && !state.outputOriginal) return null;
  const inputsMap = {};
  state.inputsOriginal.forEach(orig => {
    const cloned = cloneFileRecord(orig);
    inputsMap[orig.name] = cloned.sheets;
  });
  const outputSheets = state.outputOriginal ? deepClone(state.outputOriginal.sheets) : {};
  const wrapSheets = (s) => (typeof fuzzyProxy === "function") ? fuzzyProxy(s, { cache: state.fuzzyResolution }) : s;
  const wrappedInputs = {};
  Object.keys(inputsMap).forEach(name => { wrappedInputs[name] = wrapSheets(inputsMap[name]); });
  const proxiedInputs = wrapSheets(wrappedInputs);
  const proxiedOutput = wrapSheets(outputSheets);
  const localSetCellValue = (fileRef, sheetName, r, c, value) => {
    let target = null;
    if (fileRef === "output") {
      target = outputSheets;
    } else {
      let name = String(fileRef || "");
      if (name.startsWith("input:")) name = name.slice(6);
      target = inputsMap[name];
    }
    if (!target) throw new Error(`setCellValue: file not found: ${fileRef}`);
    if (!target[sheetName]) target[sheetName] = [];
    const rowIdx = Math.max(0, Number(r) || 0);
    const colIdx = Math.max(0, Number(c) || 0);
    if (!target[sheetName][rowIdx]) target[sheetName][rowIdx] = [];
    target[sheetName][rowIdx][colIdx] = value;
    return value;
  };
  for (let i = 0; i < stepIdx && i < state.pipeline.length; i++) {
    const step = state.pipeline[i];
    if (!isStepEnabled(step)) continue;
    try {
      const fn = new Function("inputs", "output", "col", "findColumnGlobal", "findInputBySheet", "similarity", "normalizeText", "replaceNormalizedText", "includesNormalizedText", "equalsNormalizedText",
        "headerRowIndex", "dataStartRowIndex", "excelRowToIndex",
        "insertColumns", "copyColumns", "deleteColumns", "shiftFormulaText", "setCellValue",
        step.code +
        "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };"
      );
      const result = fn(proxiedInputs, proxiedOutput, col, findColumnGlobal, findInputBySheet, similarity,
        typeof normalizeText === "function" ? normalizeText : ((v) => String(v || "").trim().toLowerCase().replace(/\s+/g, "")),
        typeof replaceNormalizedText === "function" ? replaceNormalizedText : ((v) => String(v ?? "")),
        typeof includesNormalizedText === "function" ? includesNormalizedText : ((v, s) => String(v || "").trim().toLowerCase().replace(/\s+/g, "").includes(String(s || "").trim().toLowerCase().replace(/\s+/g, ""))),
        typeof equalsNormalizedText === "function" ? equalsNormalizedText : ((v, s) => String(v || "").trim().toLowerCase().replace(/\s+/g, "") === String(s || "").trim().toLowerCase().replace(/\s+/g, "")),
        typeof headerRowIndex === "function" ? headerRowIndex : (() => 0),
        typeof dataStartRowIndex === "function" ? dataStartRowIndex : (() => 1),
        typeof excelRowToIndex === "function" ? excelRowToIndex : ((n) => Math.max(0, Number(n) - 1)),
        typeof insertColumns === "function" ? insertColumns : null,
        typeof copyColumns === "function" ? copyColumns : null,
        typeof deleteColumns === "function" ? deleteColumns : null,
        typeof shiftFormulaText === "function" ? shiftFormulaText : null,
        localSetCellValue);
      if (result && typeof result === "object" && !Array.isArray(result)) {
        if (result.inputs && typeof result.inputs === "object") {
          Object.keys(result.inputs).forEach(name => { inputsMap[name] = result.inputs[name]; });
        }
        if (result.output && typeof result.output === "object") {
          Object.keys(result.output).forEach(k => { outputSheets[k] = result.output[k]; });
        } else if (!result.inputs) {
          Object.keys(result).forEach(k => { outputSheets[k] = result[k]; });
        }
      }
    } catch (err) {
      console.warn(`Step ${i+1} 시뮬레이션 실패:`, err);
      return null;
    }
  }
  return { inputsMap, outputSheets };
}

function toggleEditStep(stepId) {
  if (state.editingStepId === stepId) {
    state.editingStepId = null;
    toast("수정 모드 해제", "success");
  } else {
    state.editingStepId = stepId;
    const idx = state.pipeline.findIndex(s => s.id === stepId);
    toast(`Step ${idx + 1} 수정 모드 활성화 — 채팅으로 수정 사항을 입력하세요`, "success");
  }
  renderPipeline();
  if (typeof renderEditingBanner === "function") renderEditingBanner();
}

function applyManualEditForPipeline(edit, inputsMap, outputSheets) {
  if (!edit) return false;
  let targetSheets = null;
  if (edit.fileId === "output") {
    targetSheets = outputSheets;
  } else if (edit.fileId && edit.fileId.startsWith("output:")) {
    const idx = typeof outputTemplateIndexFromFileId === "function" ? outputTemplateIndexFromFileId(edit.fileId) : -1;
    const tpl = state.outputTemplates && state.outputTemplates[idx];
    if (!tpl) return true;
    targetSheets = idx === state.activeOutputIndex ? outputSheets : tpl.file.sheets;
  } else if (edit.fileId && edit.fileId.startsWith("input:")) {
    const name = edit.fileId.slice(6);
    if (!inputsMap[name]) inputsMap[name] = {};
    targetSheets = inputsMap[name];
  }
  if (!targetSheets) return false;
  if (!targetSheets[edit.sheet]) targetSheets[edit.sheet] = [];
  if (!targetSheets[edit.sheet][edit.r]) targetSheets[edit.sheet][edit.r] = [];
  targetSheets[edit.sheet][edit.r][edit.c] = edit.value;
  clearManualEditFormulaMetadata(edit);
  return true;
}

function clearManualEditFormulaMetadata(edit) {
  if (!edit) return;
  clearFormulaCellMetadataForFileId(edit.fileId, edit.sheet, edit.r, edit.c);
}

function clearFormulaCellMetadataForFileId(fileId, sheetName, r, c) {
  const file = typeof getFile === "function" ? getFile(fileId) : null;
  if (!file) return;
  const addr = _excelCol(c) + (r + 1);
  file.formulaSuppressions = file.formulaSuppressions || {};
  file.formulaSuppressions[sheetName] = file.formulaSuppressions[sheetName] || {};
  file.formulaSuppressions[sheetName][addr] = true;
  if (file.formulas && file.formulas[sheetName]) delete file.formulas[sheetName][addr];
  if (file.originalFormulaValues && file.originalFormulaValues[sheetName]) {
    delete file.originalFormulaValues[sheetName][addr];
  }
  if (file.displays && file.displays[sheetName] && file.displays[sheetName][r]) {
    delete file.displays[sheetName][r][c];
  }
  if (state.formulaResults && state.formulaResults[fileId] && state.formulaResults[fileId][sheetName]) {
    delete state.formulaResults[fileId][sheetName][addr];
  }
}

function runPipeline(steps, options = {}) {
  steps = steps || state.pipeline;
  if (!options.skipRunAdaptation && typeof adaptPipelineForRun === "function") {
    steps = adaptPipelineForRun(steps);
  }
  if (!state.outputOriginal && state.inputsOriginal.length === 0) {
    throw new Error("실행할 입력 또는 출력 파일이 없습니다");
  }

  state.inputs = [];
  state.inputsOriginal.forEach(orig => {
    const cloned = cloneFileRecord(orig);
    cloned.originalBuffer = orig.originalBuffer || null;
    state.inputs.push(cloned);
  });

  if (state.outputTemplates && state.outputTemplates.length) {
    state.output = null;
    state.outputTemplates.forEach((tpl, idx) => {
      const source = tpl.original || tpl.file;
      const file = cloneFileRecord(source);
      file.originalBuffer = source.originalBuffer || null;
      state.outputTemplates[idx] = { ...tpl, file, original: source };
    });
    if (state.activeOutputIndex < 0 || !state.outputTemplates[state.activeOutputIndex]) {
      state.activeOutputIndex = 0;
    }
    state.output = state.outputTemplates[state.activeOutputIndex].file;
    state.outputOriginal = state.outputTemplates[state.activeOutputIndex].original;
  } else if (state.outputOriginal) {
    const buf = state.outputOriginal.originalBuffer;
    state.output = null;
    state.output = deepClone({ ...state.outputOriginal, originalBuffer: null });
    state.output.originalBuffer = buf;
  } else {
    state.output = null;
  }

  const inputsMap = {};
  state.inputs.forEach(f => { inputsMap[f.name] = f.sheets; });
  const outputSheets = state.output ? state.output.sheets : {};
  const outputFileId = state.outputTemplates && state.outputTemplates.length ? "output:" + state.activeOutputIndex : "output";
  const rowProxyCache = new WeakMap();
  const sheetProxyCache = new WeakMap();
  const clearedValueCells = {};
  const clearThenSetKey = (fileId, sheetName, r, c) => `${fileId}\u0000${sheetName}\u0000${r}\u0000${c}`;
  const trackClearThenSet = (fileId, sheetName, r, c, value) => {
    if (!fileId || !sheetName) return;
    const key = clearThenSetKey(fileId, sheetName, r, c);
    if (value === "") {
      clearedValueCells[key] = true;
      return;
    }
    if (clearedValueCells[key]) {
      delete clearedValueCells[key];
      clearFormulaCellMetadataForFileId(fileId, sheetName, r, c);
    }
  };
  const trackedRowProxy = (row, fileId, sheetName, r) => {
    if (!row || typeof row !== "object") return row;
    const key = `${fileId}\u0000${sheetName}\u0000${r}`;
    let cached = rowProxyCache.get(row);
    if (cached && cached[key]) return cached[key];
    if (!cached) {
      cached = {};
      rowProxyCache.set(row, cached);
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
  };
  const trackedSheetRowsProxy = (sheet, fileId, sheetName) => {
    if (!sheet || typeof sheet !== "object") return sheet;
    return new Proxy(sheet, {
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
  };
  const trackedSheetsProxy = (sheetsObj, fileId) => {
    if (!sheetsObj || typeof sheetsObj !== "object") return sheetsObj;
    let cached = sheetProxyCache.get(sheetsObj);
    if (cached && cached[fileId]) return cached[fileId];
    if (!cached) {
      cached = {};
      sheetProxyCache.set(sheetsObj, cached);
    }
    cached[fileId] = new Proxy(sheetsObj, {
      get(target, prop) {
        if (typeof prop === "symbol") return target[prop];
        const key = Object.prototype.hasOwnProperty.call(target, prop) ? prop :
          (typeof fuzzyGetKey === "function" ? fuzzyGetKey(target, String(prop)) : null);
        if (!key) return undefined;
        const sheet = target[key];
        return Array.isArray(sheet) ? trackedSheetRowsProxy(sheet, fileId, String(key)) : sheet;
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
      ownKeys(target) {
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, prop) {
        return Object.getOwnPropertyDescriptor(target, prop) || { configurable: true, enumerable: true, writable: true, value: target[prop] };
      },
    });
    return cached[fileId];
  };

  // 유사도 매칭 Proxy로 감싸기 (item 1).
  // 각 시트 객체도 fuzzy proxy 로 감싸서 시트명/컬럼명 모두 관용적으로 처리.
  const wrapSheets = (sheetsObj) => {
    if (!sheetsObj || typeof sheetsObj !== "object") return sheetsObj;
    return (typeof fuzzyProxy === "function") ? fuzzyProxy(sheetsObj, { cache: state.fuzzyResolution }) : sheetsObj;
  };
  const wrappedInputs = {};
  Object.keys(inputsMap).forEach(fileName => {
    wrappedInputs[fileName] = wrapSheets(trackedSheetsProxy(inputsMap[fileName], "input:" + fileName));
  });
  const proxiedInputs = (typeof fuzzyProxy === "function")
    ? fuzzyProxy(wrappedInputs, { cache: state.fuzzyResolution })
    : wrappedInputs;
  const proxiedOutput = wrapSheets(trackedSheetsProxy(outputSheets, outputFileId));

  // 사용자 코드에서 쓸 수 있는 헬퍼 — `col(sheet, "이름")` 등.
  const helpers = {
    col: typeof col === "function" ? col : null,
    findColumnGlobal: typeof findColumnGlobal === "function" ? findColumnGlobal : null,
    findInputBySheet: typeof findInputBySheet === "function" ? findInputBySheet : null,
    similarity: typeof similarity === "function" ? similarity : null,
    normalizeText: typeof normalizeText === "function" ? normalizeText : ((v) => String(v || "").trim().toLowerCase().replace(/\s+/g, "")),
    replaceNormalizedText: typeof replaceNormalizedText === "function" ? replaceNormalizedText : ((v) => String(v ?? "")),
    includesNormalizedText: typeof includesNormalizedText === "function" ? includesNormalizedText : ((v, s) => String(v || "").trim().toLowerCase().replace(/\s+/g, "").includes(String(s || "").trim().toLowerCase().replace(/\s+/g, ""))),
    equalsNormalizedText: typeof equalsNormalizedText === "function" ? equalsNormalizedText : ((v, s) => String(v || "").trim().toLowerCase().replace(/\s+/g, "") === String(s || "").trim().toLowerCase().replace(/\s+/g, "")),
    headerRowIndex: typeof headerRowIndex === "function" ? headerRowIndex : (() => 0),
    dataStartRowIndex: typeof dataStartRowIndex === "function" ? dataStartRowIndex : (() => 1),
    excelRowToIndex: typeof excelRowToIndex === "function" ? excelRowToIndex : ((n) => Math.max(0, Number(n) - 1)),
  };

  state.lastError = null;
  steps.forEach((step, stepIdx) => {
    if (!isStepEnabled(step)) return;
    const beforeStep = options.onBeforeStep ? options.onBeforeStep({ step, stepIdx }) : null;
    if (step.manualEdit && applyManualEditForPipeline(step.manualEdit, inputsMap, outputSheets)) {
      if (options.onStepApplied) {
        syncRuntimeFileRecords(inputsMap);
        options.onStepApplied({ step, stepIdx, beforeStep });
      }
      return;
    }
    let fn;
    try {
      fn = new Function("inputs", "output", "col", "findColumnGlobal", "findInputBySheet", "similarity", "normalizeText", "replaceNormalizedText", "includesNormalizedText", "equalsNormalizedText",
        "headerRowIndex", "dataStartRowIndex", "excelRowToIndex",
        "insertColumns", "copyColumns", "deleteColumns", "shiftFormulaText", "setCellValue",
        step.code +
        "\nreturn typeof transform === 'function' ? transform(inputs, output) : { inputs, output };"
      );
    } catch (err) {
      state.lastError = {
        stepIdx, description: step.description || `Step ${stepIdx + 1}`,
        stepId: step.id || null,
        code: step.code || "",
        message: "코드 컴파일 오류: " + err.message, stack: err.stack || "",
      };
      throw _stepError(state.lastError);
    }
    let result;
    try {
      result = fn(proxiedInputs, proxiedOutput,
        helpers.col, helpers.findColumnGlobal, helpers.findInputBySheet, helpers.similarity, helpers.normalizeText, helpers.replaceNormalizedText, helpers.includesNormalizedText, helpers.equalsNormalizedText,
        helpers.headerRowIndex, helpers.dataStartRowIndex, helpers.excelRowToIndex,
        typeof insertColumns === "function" ? insertColumns : null,
        typeof copyColumns === "function" ? copyColumns : null,
        typeof deleteColumns === "function" ? deleteColumns : null,
        typeof shiftFormulaText === "function" ? shiftFormulaText : null,
        typeof setCellValue === "function" ? setCellValue : null);
    } catch (err) {
      state.lastError = {
        stepIdx, description: step.description || `Step ${stepIdx + 1}`,
        stepId: step.id || null,
        code: step.code || "",
        message: err.message || String(err), stack: err.stack || "",
      };
      throw _stepError(state.lastError);
    }
    if (result && typeof result === "object" && !Array.isArray(result)) {
      if (result.inputs && typeof result.inputs === "object") {
        Object.keys(result.inputs).forEach(name => {
          // 결과로 새 inputs[name]을 받으면 기존 키에 fuzzy match해서 쓰거나 새로 추가
          if (!inputsMap[name]) inputsMap[name] = result.inputs[name];
          else Object.assign(inputsMap[name], result.inputs[name]);
        });
      }
      if (state.output && result.output && typeof result.output === "object") {
        Object.keys(result.output).forEach(k => { state.output.sheets[k] = result.output[k]; });
      } else if (state.output && !result.inputs) {
        Object.keys(result).forEach(k => { state.output.sheets[k] = result[k]; });
      }
    }
    if (options.onStepApplied) {
      syncRuntimeFileRecords(inputsMap);
      options.onStepApplied({ step, stepIdx, beforeStep });
    }
  });

  syncRuntimeFileRecords(inputsMap);

  if (state.output) {
    syncFileMetadata(state.output);
    if (state.outputTemplates && state.activeOutputIndex >= 0 && state.outputTemplates[state.activeOutputIndex]) {
      state.outputTemplates[state.activeOutputIndex].file = state.output;
      state.outputTemplates[state.activeOutputIndex].original = state.outputOriginal;
    }
  }
  (state.outputTemplates || []).forEach(tpl => {
    if (tpl && tpl.file) syncFileMetadata(tpl.file);
  });

  // 수식 재평가 (item 10) — 모든 파일/시트의 수식을 현재 데이터로 다시 계산.
  recomputeAllFormulas();

  // 적용 후에도 사용자가 보고 있던 시뮬레이터 화면을 유지한다.
  const currentFile = getFile(state.currentFileId);
  if (currentFile && state.currentSheet && !currentFile.sheetNames.includes(state.currentSheet)) {
    state.currentSheet = currentFile.sheetNames[0] || null;
  } else if (currentFile && !state.currentSheet) {
    state.currentSheet = currentFile.sheetNames[0] || null;
  }

  renderInputList();
  renderOutputChip();
  refreshTabs();
  renderExcelViewer();
  flashFilled();
}

function runPipelineRealtime(steps) {
  steps = steps || state.pipeline;
  const changedByStep = [];
  runPipeline(steps, {
    onBeforeStep: ({ stepIdx }) => captureCurrentViewSnapshot(`before-${stepIdx}`),
    onStepApplied: ({ step, stepIdx, beforeStep }) => {
      const afterStep = captureCurrentViewSnapshot(`after-${stepIdx}`);
      const localChanges = diffViewSnapshots(beforeStep, afterStep);
      changedByStep.push({ stepIdx, count: localChanges.length });
      renderExcelViewer();
      flashChangedViewCells(localChanges);
      requestBackendViewDiff(beforeStep, afterStep, step, stepIdx);
    },
  });
  return changedByStep;
}

function captureCurrentViewSnapshot(label) {
  const file = getFile(state.currentFileId);
  const sheet = state.currentSheet;
  if (!file || !sheet) return { label, fileId: state.currentFileId, sheet, cells: [] };
  const aoa = (file.sheets && file.sheets[sheet]) || [];
  const viewer = document.querySelector(".right-page.active .excel-viewer") || $("excel-viewer") || $("runner-excel-viewer");
  const cells = [];
  const seen = new Set();
  const addCell = (r, c) => {
    const key = r + ":" + c;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ r, c, value: aoa[r] && aoa[r][c] !== undefined ? aoa[r][c] : "" });
  };
  if (viewer) {
    viewer.querySelectorAll("td[data-r][data-c]").forEach(td => {
      addCell(Number(td.dataset.r), Number(td.dataset.c));
    });
  }
  if (!cells.length) {
    const rows = Math.min(120, aoa.length);
    for (let r = 0; r < rows; r++) {
      const cols = Math.min(40, aoa[r] ? aoa[r].length : 0);
      for (let c = 0; c < cols; c++) addCell(r, c);
    }
  }
  return { label, fileId: state.currentFileId, sheet, cells };
}

function diffViewSnapshots(before, after) {
  if (!before || !after || before.fileId !== after.fileId || before.sheet !== after.sheet) return [];
  const prev = new Map((before.cells || []).map(cell => [cell.r + ":" + cell.c, normalizeDiffValue(cell.value)]));
  return (after.cells || []).filter(cell => prev.get(cell.r + ":" + cell.c) !== normalizeDiffValue(cell.value));
}

function normalizeDiffValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null) return "";
  return String(value);
}

function flashChangedViewCells(changes) {
  if (!changes || !changes.length) return;
  ["excel-viewer", "runner-excel-viewer"].forEach(id => {
    const viewer = $(id);
    if (!viewer) return;
    changes.forEach(cell => {
      const td = viewer.querySelector(`td[data-r="${cell.r}"][data-c="${cell.c}"]`);
      if (td) {
        td.classList.add("flash");
        setTimeout(() => td.classList.remove("flash"), 1400);
      }
    });
  });
}

function requestBackendViewDiff(before, after, step, stepIdx) {
  if (!before || !after || !window.fetch || location.protocol === "file:") return;
  fetch("/api/diff/current-view", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      stepIdx,
      description: step && step.description,
      before,
      after,
    }),
  }).catch(() => {});
}

async function runPipelinePreferBackend(options = {}) {
  const stepsForRun = options.pipeline || state.pipeline;
  if (shouldRunPipelineAsVba(stepsForRun)) {
    return runVbaPipelinePreferLive({ ...options, pipeline: stepsForRun });
  }
  if (typeof canRunPipelineOnBackend === "function" && canRunPipelineOnBackend()) {
    try {
      const result = await runPipelineOnBackend(options);
      if (result && result.cancelled) return result;  // 사용자 중단 — 토스트 없이 조용히
      toast("백엔드 실행 결과를 현재 화면에 반영했습니다", "success");
      return result;
    } catch (err) {
      console.warn("Backend pipeline failed, falling back to browser execution:", err);
      if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
        throw err;
      }
      toast("백엔드 실행이 실패해 기존 방식으로 실행합니다", "error");
    }
  }
  return runPipelineRealtime(options.pipeline);
}

function syncRuntimeFileRecords(inputsMap) {
  state.inputs.forEach(file => {
    file.sheets = inputsMap[file.name] || {};
    syncFileMetadata(file);
  });

  if (state.output) {
    syncFileMetadata(state.output);
    if (state.outputTemplates && state.activeOutputIndex >= 0 && state.outputTemplates[state.activeOutputIndex]) {
      state.outputTemplates[state.activeOutputIndex].file = state.output;
      state.outputTemplates[state.activeOutputIndex].original = state.outputOriginal;
    }
  }
  (state.outputTemplates || []).forEach(tpl => {
    if (tpl && tpl.file) syncFileMetadata(tpl.file);
  });
}

function clearPipelineExecutionMemory(options = {}) {
  if (!options.keepViewer) clearViewerDomForPipelineRun();
}

function clearViewerDomForPipelineRun() {
  ["excel-viewer", "runner-excel-viewer"].forEach(id => {
    const viewer = $(id);
    if (!viewer) return;
    viewer.innerHTML = `<div class="excel-empty">
      <div class="big-ico">…</div>
      <div>실행 준비 중입니다</div>
      <div>대용량 파일 메모리를 정리하고 있습니다</div>
    </div>`;
  });
}

// runPipeline 에서 발생한 step 오류를 풍부한 메시지로 감싸 던진다 (item 9).
function _stepError(info) {
  const stepLabel = `Step ${info.stepIdx + 1}` + (info.description ? ` (${info.description})` : "");
  const err = new Error(`${stepLabel} 실행 중 오류 — ${info.message}`);
  err._stepInfo = info;
  return err;
}

function attachPipelineStepError(err, step, stepIdx, extra = {}) {
  const numericIdx = Number(stepIdx);
  const currentInfo = (err && (err._stepInfo || err.errorInfo)) || {};
  const inferredLanguage = step && typeof inferPipelineStepLanguage === "function"
    ? inferPipelineStepLanguage(step)
    : "";
  const info = {
    stepIdx: Number.isInteger(numericIdx) && numericIdx >= 0 ? numericIdx : -1,
    stepId: (step && (step.id || step.stepId)) || currentInfo.stepId || null,
    description: (step && step.description) || currentInfo.description || "",
    code: (step && step.code) || currentInfo.code || "",
    language: (step && step.language) || inferredLanguage || currentInfo.language || "",
    message: currentInfo.message || (err && err.message) || String(err || ""),
    stack: currentInfo.stack || (err && err.stack) || "",
    ...extra,
  };
  if (err && typeof err === "object") {
    err._stepInfo = info;
    err.errorInfo = info;
  }
  return err;
}

// 모든 파일/시트의 수식을 현재 데이터로 재평가해 state.formulaResults 에 저장.
// 시뮬레이터 렌더 시 이 결과로 셀 표시값을 덮어쓴다.
function recomputeAllFormulas() {
  if (typeof recomputeSheetFormulas !== "function") return;
  state.formulaResults = {};
  const filesById = [];
  state.inputs.forEach(f => filesById.push({ id: "input:" + f.name, file: f }));
  (state.outputTemplates || []).forEach((tpl, idx) => {
    if (tpl && tpl.file) filesById.push({ id: "output:" + idx, file: tpl.file });
  });
  if (state.output) filesById.push({ id: "output", file: state.output });
  if (isHeavyFormulaRecompute(filesById)) return;
  filesById.forEach(({ id, file }) => {
    if (!file.formulas) return;
    state.formulaResults[id] = {};
    Object.keys(file.formulas).forEach(sheetName => {
      const aoa = file.sheets[sheetName] || [];
      const cached = file.originalFormulaValues && file.originalFormulaValues[sheetName];
      const computed = recomputeSheetFormulas(aoa, file.formulas[sheetName], cached);
      if (computed) state.formulaResults[id][sheetName] = computed;
    });
  });
}

function isHeavyFormulaRecompute(filesById) {
  const FORMULA_RECOMPUTE_CELL_LIMIT = 250000;
  let cells = 0;
  for (const { file } of filesById) {
    Object.values((file && file.sheets) || {}).forEach(sheet => {
      cells += (sheet || []).reduce((sum, row) => sum + (row ? row.length : 0), 0);
    });
    if (cells > FORMULA_RECOMPUTE_CELL_LIMIT) return true;
  }
  return false;
}

function flashFilled() {
  const currentFile = getFile(state.currentFileId);
  if (!currentFile || !state.currentSheet) return;
  let original = typeof getOriginalFile === "function" ? getOriginalFile(state.currentFileId) : null;
  if (!original) return;
  const cur = currentFile.sheets[state.currentSheet] || [];
  const orig = original.sheets[state.currentSheet] || [];
  setTimeout(() => {
    ["excel-viewer", "runner-excel-viewer"].forEach(id => {
      const root = $(id);
      if (!root) return;
      root.querySelectorAll("td[data-r]").forEach(td => {
        const r = Number(td.dataset.r);
        const c = Number(td.dataset.c);
        const o = orig[r] && orig[r][c];
        const n = cur[r] && cur[r][c];
        if (String(o || "") !== String(n || "")) {
          if (!td.classList.contains("selected-cell") && !td.classList.contains("selected-range")) {
            td.classList.add("flash");
          }
        }
      });
    });
  }, 50);
}

// 스킬 카드 라벨: 제목(description)이 비었거나 제네릭("스킬 생성")이거나 코드 첫 줄이면
// 사용자 요청(step.prompt)으로 폴백 → 어떤 스킬인지 알아볼 수 있게(삭제/관리 편의).
function pipelineStepLabel(step, idx) {
  let d = String((step && step.description) || "").trim();
  const looksGeneric = !d || d === "스킬 생성" || d === "스킬 수정";
  const looksLikeCode = /^(sub\b|end\s+sub|def\s|function\b|dim\b|application\.|set\s|for\s|if\s|'|\/\/|#)/i.test(d);
  if (looksGeneric || looksLikeCode) {
    const pr = String((step && step.prompt) || "").trim();
    if (pr && pr !== "manual cell edit" && !pr.startsWith("##")) d = pr;
  }
  if (!d) d = `스킬 ${idx + 1}`;
  return d.length > 70 ? d.slice(0, 70) + "…" : d;
}

function renderPipeline() {
  const list = $("pipeline-list");
  ensurePipelineStepIds();
  $("pipe-count").textContent = state.pipeline.length + " 단계";
  if (state.pipeline.length === 0) {
    list.innerHTML = `<div class="pipeline-empty">아직 단계가 없습니다. AI가 생성한 코드를 "적용"하면 추가됩니다.</div>`;
    if (state.editingStepId) state.editingStepId = null;
    if (typeof renderEditingBanner === "function") renderEditingBanner();
    renderRunnerWorkflow();
    return;
  }
  // 편집 중이던 step이 사라졌으면 정리
  if (state.editingStepId && !state.pipeline.some(s => s.id === state.editingStepId)) {
    state.editingStepId = null;
  }
  list.innerHTML = "";
  state.pipeline.forEach((step, idx) => {
    const item = document.createElement("div");
    item.className = "pipeline-item";
    if (!isStepEnabled(step)) item.classList.add("disabled");
    if (state.editingStepId === step.id) item.classList.add("editing");
    const editing = state.editingStepId === step.id;
    const runtime = getPipelineRuntimeStatus(step.id);
    if (runtime && runtime.status) item.classList.add(`runtime-${runtime.status}`);
    const runtimeBadge = runtime && runtime.label
      ? `<span class="step-runtime ${escapeHtml(runtime.status || "")}">${escapeHtml(runtime.label)}</span>`
      : "";
    item.innerHTML = `
      <div class="step-n">${idx+1}</div>
      <div class="step-label" title="${escapeHtml(pipelineStepLabel(step, idx))}">${escapeHtml(pipelineStepLabel(step, idx))}${runtimeBadge}</div>
      <button class="step-toggle ${isStepEnabled(step) ? 'active' : ''}" title="계산 반영 여부">${isStepEnabled(step) ? 'ON' : 'OFF'}</button>
      <button class="step-edit ${editing ? 'active' : ''}" title="${editing ? '수정 모드 해제' : '수정'}">✎</button>
      <button class="step-del" title="삭제">✕</button>
    `;
    item.querySelector(".step-toggle").onclick = (e) => {
      e.stopPropagation();
      const stepId = step.id;
      const currentIdx = state.pipeline.findIndex(s => s.id === stepId);
      if (currentIdx < 0) return;
      if (typeof pushHistory === "function") pushHistory("단계 적용 여부 변경");
      const prevEnabled = isStepEnabled(state.pipeline[currentIdx]);
      const beforeToggleSnapshot = (state.pipeline || []).map(s => ({ ...s })); // [중단 복원] 변경 전
      state.pipeline[currentIdx] = { ...state.pipeline[currentIdx], enabled: !prevEnabled };
      const toggledStep = state.pipeline[currentIdx];
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-toggled");
      reconcilePipelineSimulationAfterEdit({ affectedStep: toggledStep, restorePipeline: beforeToggleSnapshot }).catch(err => {
        // [0.5.2.2 §5.5] 라이브 반영 실패 — ON 표시인데 미적용인 '유령 상태'를 막기 위해 토글 원복.
        const idxNow = state.pipeline.findIndex(s => s.id === stepId);
        if (idxNow >= 0) {
          state.pipeline[idxNow] = { ...state.pipeline[idxNow], enabled: prevEnabled };
          renderPipeline();
          refreshRunButton();
        }
        reportPipelineError(err);
      });
    };
    item.querySelector(".step-edit").onclick = (e) => {
      e.stopPropagation();
      toggleEditStep(step.id);
    };
    item.querySelector(".step-del").onclick = (e) => {
      e.stopPropagation();
      const stepId = step.id;
      const currentIdx = state.pipeline.findIndex(s => s.id === stepId);
      if (currentIdx < 0) return;
      if (typeof pushHistory === "function") pushHistory("단계 삭제");
      if (state.editingStepId === stepId) state.editingStepId = null;
      const removedStep = state.pipeline[currentIdx];
      const beforeDeleteSnapshot = (state.pipeline || []).map(s => ({ ...s })); // [중단 복원] 삭제 전
      // [필드] 이 스텝이 라이브에 '실제 적용된' 상태였는지 — 적용 실패(오류) 스텝은 라이브에 없으므로
      // 아래 reconcile 이 실패해도 부활시키면 안 된다(오류 스킬이 영영 안 지워지는 현상).
      const removedWasApplied = typeof getPipelineRuntimeStatus === "function"
        && (getPipelineRuntimeStatus(stepId) || {}).status === "applied";
      state.pipeline.splice(currentIdx, 1);
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-deleted");
      reconcilePipelineSimulationAfterEdit({ affectedStep: removedStep, restorePipeline: beforeDeleteSnapshot }).catch(err => {
        // [0.5.2.2 §5.5] 라이브 반영 실패 — UI 에선 지워졌는데 라이브엔 남는 어긋남 방지, 원위치 복원.
        // 단, 적용된 적 없는(오류/대기) 스텝은 라이브에 존재하지 않으므로 복원하지 않는다 —
        // reconcile 실패는 남은 스텝/세션 문제이지 이 삭제를 되돌릴 이유가 아니다.
        if (removedWasApplied && removedStep && state.pipeline.findIndex(s => s.id === stepId) < 0) {
          const at = Math.max(0, Math.min(currentIdx, state.pipeline.length));
          state.pipeline.splice(at, 0, removedStep);
          renderPipeline();
          refreshRunButton();
        }
        reportPipelineError(err);
      });
    };
    list.appendChild(item);
  });
  if (typeof renderEditingBanner === "function") renderEditingBanner();
  renderRunnerWorkflow();
}

// 0.4.9 리모콘 모델: 라이브 실행 가능한 파이프라인을 현재 Excel 세션에 적용한다.
// VBA 포함 파이프라인은 검증된 /run-vba-pipeline 격리 경로를 사용한다.
// Python 전용 파이프라인은 기존 reset 가능한 서버 번들 경로를 유지한다.
// [0.5.2.2] 마지막으로 라이브에 적용 완료된 '켜진 스텝 집합' 시그니처 — no-op 편집 생략용.
let _lastLiveAppliedSignature = null;

function liveEnabledStepsSignature(steps = state.pipeline) {
  return (steps || [])
    .filter(s => !!(s && s.code && isStepEnabled(s) && pipelineStepLiveLanguage(s)))
    .map(s => [s.id || "", s.language || "", s.targetFileId || "", String(s.code || "")].join(""))
    .join("");
}

function noteLivePipelineApplied(steps = state.pipeline) {
  _lastLiveAppliedSignature = liveEnabledStepsSignature(steps);
}

// 라이브 상태를 더 이상 신뢰할 수 없을 때(세션 전부 닫힘/초기화/적용 실패) 호출 —
// 다음 편집은 무조건 실제 재적용을 수행한다.
function invalidateLivePipelineApplied() {
  _lastLiveAppliedSignature = null;
}

// [#5] 라이브 COM 적용으로 구조가 바뀐 파일의 클라 스키마 캐시(미리보기 AoA/시트명/차원)를
// 서버가 보낸 경량 스키마로 갱신한다. 백엔드 경로(runPipeline)와 동일 수준(sheets + sheetNames)으로
// 맞춰 캐시 불일치를 피한다(tables/formulas 는 백엔드처럼 건드리지 않음). 안 하면 다음 단계 생성 시
// buildSchemaSummary 가 옛 구조(삭제된 열 등)를 LLM 에 전달한다.
function applyLiveSchemaToFileCache(excelId, schema) {
  if (!excelId || !schema) return;
  const fileId = typeof fileIdForExcelMirrorId === "function" ? fileIdForExcelMirrorId(excelId) : null;
  const f = (fileId && typeof getFile === "function") ? getFile(fileId) : null;
  if (!f) return;
  const names = (Array.isArray(schema.sheetNames) && schema.sheetNames.length)
    ? schema.sheetNames
    : Object.keys(schema.sheets || {});
  if (!names.length) return;
  if (schema.sheets && typeof schema.sheets === "object") {
    f.sheets = f.sheets || {};
    names.forEach(nm => { if (Array.isArray(schema.sheets[nm])) f.sheets[nm] = schema.sheets[nm]; });
    // 서버에 없는(삭제된) 시트의 캐시는 제거 — syncFileMetadata 가 sheetNames 를 f.sheets 키로 재구성.
    Object.keys(f.sheets).forEach(nm => { if (!names.includes(nm)) delete f.sheets[nm]; });
  }
  if (schema.dims && typeof schema.dims === "object") {
    f.backendPreviewDimensions = f.backendPreviewDimensions || {};
    names.forEach(nm => { if (schema.dims[nm]) f.backendPreviewDimensions[nm] = schema.dims[nm]; });
  }
  if (typeof syncFileMetadata === "function") { try { syncFileMetadata(f); } catch (_) {} }
}

// 0.4.9 리모콘 모델: VBA 엔진에서 토글/삭제/편집/순서변경 등으로 파이프라인이 바뀌면
// 라이브 워크북을 원본으로 리셋한 뒤 enabled VBA 스텝을 순서대로 다시 적용한다.


async function reapplyVbaPipelineToLive(excelId, options = {}) {
  const perfStartedAt = performance.now();
  let prehideMs = 0;
  let requestMs = 0;
  const sourceSteps = options.steps || state.pipeline;
  const liveLangOf = s => pipelineStepLiveLanguage(s);
  // 꺼진 스텝 포함 전체 라이브 스텝 — 리셋 대상 계산에 사용(토글 OFF 의 효과를 되돌리려면
  // 그 꺼진 스텝이 건드렸던 워크북도 리셋해야 한다).
  const allLiveSteps = (sourceSteps || []).filter(s => s && s.code && liveLangOf(s));
  const enabledSteps = allLiveSteps
    .filter(isStepEnabled)
    .map(s => ({
      stepIdx: (sourceSteps || []).indexOf(s),
      id: s.id || null,
      stepId: s.id || null,
      description: s.description || "",
      code: s.code || "",
      language: liveLangOf(s) || "vba",
      targetFileId: s.targetFileId || null,
    }));
  const hasVbaStep = enabledSteps.some(s => String((s && s.language) || "").toLowerCase() !== "python");
  // 대상 고정: 호출자가 넘긴 excelId(보통 '현재 탭')보다 스텝이 만들어졌던 파일이 우선.
  // B 탭을 보던 중 토글/실행해도 A에서 만든 스킬은 A로 전환 후 A에 리셋·재적용된다.
  let pinnedFileId = null;
  try {
    if (hasVbaStep) {
      // VBA 전체실행은 매크로 실행 직전 탭/오버레이 조작이 Excel 인스턴스를
      // "매크로 실행 불가" 상태로 만들 수 있다. 대상 세션만 확보하고 화면 전환은
      // 실행 이후로 미룬다.
      const fid = pipelinePinnedTargetFileId(sourceSteps);
      if (fid) {
        pinnedFileId = fid;
        const pinnedExcelId = await excelIdForPipelineFileId(fid);
        if (pinnedExcelId) excelId = pinnedExcelId;
      } else if (pipelineHasUnresolvedTarget(sourceSteps)) {
        warnUnresolvedPipelineTarget();
      }
    } else {
      const pinned = await ensurePinnedVbaTargetExcelId(sourceSteps);
      if (pinned && pinned.excelId) {
        excelId = pinned.excelId;
        pinnedFileId = pinned.fileId;
      } else if (pipelineHasUnresolvedTarget(sourceSteps)) {
        warnUnresolvedPipelineTarget();
      }
    }
  } catch (_) {}
  // 스텝별 실행 대상: 자기 targetFileId(살아있으면) > 고정 대상 > 현재 세션의 파일.
  const fallbackFileId = pinnedFileId
    || (typeof fileIdForExcelMirrorId === "function" ? fileIdForExcelMirrorId(excelId) : null)
    || state.currentFileId;
  const stepTargetFileId = s => {
    const inferred = inferPipelineStepTargetFileId(s);
    return (inferred && typeof getFile === "function" && getFile(inferred)) ? inferred : fallbackFileId;
  };
  // 리셋 대상 = 모든 라이브 스텝(꺼진 것 포함)의 대상 파일 ∪ 코드가 파일명으로 참조하는 출력 파일.
  // (입력→출력 스킬: 대상은 입력이지만 출력에 썼으므로, 출력도 리셋해야 OFF 가 실제로 풀린다.)
  const resetFileIds = [];
  const addResetTarget = fid => { if (fid && !resetFileIds.includes(fid)) resetFileIds.push(fid); };
  allLiveSteps.forEach(s => {
    addResetTarget(stepTargetFileId(s));
    crossOutputFileIdsReferencedInCode(s.code).forEach(addResetTarget);
  });
  if (!resetFileIds.length && fallbackFileId) addResetTarget(fallbackFileId);
  // [리뷰⑥] 대상 폴백 체인이 전부 비면(세션 강제종료 직후 등) null 이 흘러가 '창을 열지 못해'류의
  // 엉뚱한 에러가 났다 — 원인을 그대로 말하는 에러로 교체.
  if (!resetFileIds.length) {
    throw new Error("작업 대상 파일을 결정할 수 없습니다. 파일 탭을 먼저 선택해 Excel 창을 띄운 뒤 다시 시도해 주세요.");
  }
  if (window.runnerSetRunning) window.runnerSetRunning(true);
  if (!hasVbaStep && typeof muteExcelMirrorForPipeline === "function") muteExcelMirrorForPipeline(excelId);
  if (!hasVbaStep && typeof beginExcelMirrorApplyLoading === "function") {
    beginExcelMirrorApplyLoading("스킬 재적용 중...");
  }
  let failingStep = null;
  const _resetDone = []; // [리뷰③] 다중 파일 리셋이 중간 실패하면 어디까지 되돌렸는지 추적
  const liveSequentialMutedExcelIds = [];
  let liveSequentialLoadingStarted = false;
  try {
    if (!hasVbaStep && typeof hideAllExcelMirrorWindows === "function") {
      const started = performance.now();
      try {
        await hideAllExcelMirrorWindows();
      } catch (_) {
      } finally {
        prehideMs = performance.now() - started;
      }
    }
    const requestStarted = performance.now();
    const stepPayload = st => ({ stepIdx: st.stepIdx, stepId: st.stepId, description: st.description, code: st.code, language: st.language });
    const pipelineTimeoutMs = n => Math.max(90000, Math.min(300000, 60000 + n * 30000));
    const pipelineTimeoutMessage = "스킬 파이프라인 실행 응답이 지연되어 중단했습니다. 저사양 PC에서는 백그라운드에서 계속 적용 중일 수 있으니 잠시 후 화면을 확인해 주세요.";
    let data = null;
    // VBA 포함: 일반 전체실행/실행기 전체실행/재적용 모두 같은 격리 파이프라인을 탄다.
    // Python 전용: 기존 번들 reset 경로를 유지한다. 서버 호출 수를 줄여 reset/reapply 장기화를 막는다.
    if (hasVbaStep) {
      data = await runIsolatedLivePipelineSteps(sourceSteps, excelId, {
        ...options,
        resetFileIds,
        fallbackFileId,
        viewSheet: options.viewSheet || null,
      });
    } else {
      // Python 전용 파이프라인: 기존 번들 reset 경로(정상 동작 — VBA 매크로 실행이 없어 reset 안전).
      const uniqueTargets = Array.from(new Set(enabledSteps.map(stepTargetFileId)));
      const singleFileFlow = resetFileIds.length === 1 &&
        (uniqueTargets.length === 0 || (uniqueTargets.length === 1 && uniqueTargets[0] === resetFileIds[0]));
      if (singleFileFlow) {
        const sessionExcelId = await requirePipelineSessionExcelId(resetFileIds[0], "재적용");
        data = await postExcelMirror("/api/excel/run-vba-pipeline", {
          excelId: sessionExcelId,
          steps: enabledSteps.map(stepPayload),
          reset: true,
          viewSheet: options.viewSheet || null,
        }, 0, {
          timeoutMs: pipelineTimeoutMs(enabledSteps.length),
          timeoutMessage: pipelineTimeoutMessage,
        });
      } else {
        for (const fid of resetFileIds) {
          const sessionExcelId = await requirePipelineSessionExcelId(fid, "워크북 리셋");
          data = await postExcelMirror("/api/excel/run-vba-pipeline", { excelId: sessionExcelId, steps: [], reset: true }, 0, {
            timeoutMs: 180000,
            timeoutMessage: "워크북 리셋 응답이 지연되어 중단했습니다. 저사양 PC에서는 백그라운드에서 계속 진행 중일 수 있으니 잠시 후 화면을 확인해 주세요.",
          });
          _resetDone.push(fid);
        }
        const groups = [];
        for (const st of enabledSteps) {
          const fid = stepTargetFileId(st);
          const last = groups[groups.length - 1];
          if (last && last.fileId === fid) last.steps.push(st);
          else groups.push({ fileId: fid, steps: [st] });
        }
        for (const group of groups) {
          failingStep = group.steps[0];
          const sessionExcelId = await requirePipelineSessionExcelId(group.fileId, "스킬 적용");
          data = await postExcelMirror("/api/excel/run-vba-pipeline", {
            excelId: sessionExcelId,
            steps: group.steps.map(stepPayload),
            reset: false,
            viewSheet: options.viewSheet || null,
          }, 0, {
            timeoutMs: pipelineTimeoutMs(group.steps.length),
            timeoutMessage: pipelineTimeoutMessage,
          });
        }
      }
    }
    failingStep = null;
    requestMs = performance.now() - requestStarted;
    if ((liveSequentialLoadingStarted || !hasVbaStep) && typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
    if (hasVbaStep && typeof releaseExcelMirrorPipelineMute === "function") {
      liveSequentialMutedExcelIds.forEach(id => releaseExcelMirrorPipelineMute(id));
    } else if (!hasVbaStep && typeof releaseExcelMirrorPipelineMute === "function") {
      releaseExcelMirrorPipelineMute(excelId);
    }
    // VBA 포함 전체실행은 단일 적용과 같은 복원 흐름을 쓴다.
    // showOnly(force) 는 Native frame 모드에서 빈 Excel 창을 직접 띄울 수 있어 사용하지 않는다.
    try {
      if (hasVbaStep) {
        if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(180);
      } else {
        const visibleExcelId = (typeof currentExcelId === "function" && currentExcelId()) || excelId;
        if (visibleExcelId && typeof showOnlyExcelMirrorWindow === "function") {
          await showOnlyExcelMirrorWindow(visibleExcelId, { force: true });
        } else if (visibleExcelId) {
          await positionExcelMirrorWindow(visibleExcelId, { force: true });
        }
        if (visibleExcelId && typeof stabilizeExcelMirrorZOrder === "function") {
          stabilizeExcelMirrorZOrder(visibleExcelId);
        }
        if (typeof scheduleRestoreActiveExcelMirror === "function") {
          scheduleRestoreActiveExcelMirror(180, { preserveFocus: true });
        }
      }
    } catch (_) {}
    if (window.runnerSetDone) window.runnerSetDone();
    noteLivePipelineApplied(sourceSteps); // 이 적용 상태와 같은 편집은 이후 no-op 으로 생략
    recordVbaDebugTiming({
      action: "reapply",
      steps: enabledSteps.length,
      prehideMs,
      startRequestMs: requestMs,
      totalClientMs: performance.now() - perfStartedAt,
      server: (data && data.debugTimings) || {},
    });
    return data || { ok: true, applied: enabledSteps.length };
  } catch (err) {
    invalidateLivePipelineApplied(); // 부분 적용 가능성 — 다음 편집은 반드시 실제 재적용
    // [리뷰③] 다중 파일 리셋이 중간에 끊기면 '일부 원본/일부 적용값' 혼합 상태 — 사용자에게 정확히 알린다.
    try {
      if (_resetDone.length && _resetDone.length < (resetFileIds || []).length) {
        const nameOf = fid => { try { const f = typeof getFile === "function" ? getFile(fid) : null; return (f && f.name) || String(fid); } catch (_) { return String(fid); } };
        const done = _resetDone.map(nameOf).join(", ");
        const rest = (resetFileIds || []).filter(f => !_resetDone.includes(f)).map(nameOf).join(", ");
        err.message = String(err.message || err) +
          ` — 주의: 일부 파일만 원본으로 되돌려진 상태입니다(되돌림: ${done} / 미처리: ${rest}). 지금 데이터는 일시적으로 어긋나 있으니, 같은 동작을 다시 시도하면 전체가 다시 적용됩니다.`;
      }
    } catch (_) {}
    if (err && (err._stepInfo || err.errorInfo)) {
      const info = err._stepInfo || err.errorInfo;
      err._stepInfo = { ...info, stepIdx: Number(info.stepIdx ?? (failingStep ? failingStep.stepIdx : -1)) };
      err.errorInfo = err._stepInfo;
    } else if (failingStep) {
      attachPipelineStepError(err, failingStep, failingStep.stepIdx);
    } else if (enabledSteps.length === 1) {
      attachPipelineStepError(err, enabledSteps[0], enabledSteps[0].stepIdx);
    }
    if (liveSequentialLoadingStarted && typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
    if (hasVbaStep && typeof releaseExcelMirrorPipelineMute === "function") {
      liveSequentialMutedExcelIds.forEach(id => releaseExcelMirrorPipelineMute(id));
    }
    restoreVbaExcelAfterError(excelId);
    if (window.runnerSetRunning) window.runnerSetRunning(false);
    throw err;
  }
}


// [필드 추가#1] 토글/삭제 후 뷰 이동 대상: 스킬 코드가 다른 파일(출력)에 쓰는 교차 파일
// 스킬이면 '실제 값이 들어간' 그 파일로 이동한다. 아니면 스킬이 만들어진 파일(targetFileId).
// [사용자 요청] affectedStep 코드에서 '값이 쓰인 시트'를 추정 — on/off 후 그 시트로 이동.
// COM dialect: 쓰기 계열 ctx 호출의 첫 번째 시트 인자(copy 는 대상 시트=3번째 인자).
// VBA: Worksheets("...")/Sheets("...") 첫 등장. 못 찾으면 null(서버가 토글 전 시트로 복원).
function affectedStepViewSheetHint(affected) {
  const code = String((affected && affected.code) || "");
  if (!code) return null;
  const lang = (affected && affected.language) || "";
  if (lang === "vba") {
    const m = code.match(/(?:Worksheets|Sheets)\(\s*"([^"]+)"\s*\)/);
    return m ? m[1] : null;
  }
  let m = code.match(/ctx\.copy\(\s*["'][^"']*["']\s*,\s*["'][^"']*["']\s*,\s*["']([^"']+)["']/);
  if (m) return m[1];
  m = code.match(/ctx\.(?:write|write_cell|write_formulas|clear|sort|insert_rows|insert_cols|delete_rows|delete_cols|merge|unmerge|set_number_format|hide_rows|hide_cols|add_sheet)\(\s*["']([^"']+)["']/);
  if (m) return m[1];
  m = code.match(/ctx\.read(?:_formulas)?\(\s*["']([^"']+)["']/);
  return m ? m[1] : null;
}

function affectedStepViewFileId(affected) {
  if (!affected) return null;
  try {
    const cross = typeof crossOutputFileIdsReferencedInCode === "function"
      ? crossOutputFileIdsReferencedInCode(affected.code || "") : [];
    for (const fid of cross || []) {
      if (fid && typeof getFile === "function" && getFile(fid)) return fid;
    }
  } catch (_) {}
  const tid = inferPipelineStepTargetFileId(affected);
  return (tid && typeof getFile === "function" && getFile(tid)) ? tid : null;
}

async function reconcilePipelineSimulationAfterEdit(options = {}) {
  // 라이브 엔진(vba/python COM) + 라이브 세션이면 파이프라인 재동기화를 라이브 리셋+재적용으로 처리.
  // (주의: 이 분기를 안 타면 백엔드 openpyxl 경로로 빠져 '라이브 Excel 은 리셋되지 않는' 상태가 된다 —
  //  python 엔진 강제 후 토글 OFF 가 해제되지 않던 버그의 원인. vba 단독 체크 금지.)
  const liveEngine = typeof getSkillEngine === "function" ? getSkillEngine() : "";
  const stepsForReconcile = options.steps || state.pipeline;
  const hasLivePipelineForReconcile = (stepsForReconcile || []).some(s => !!pipelineStepLiveLanguage(s));
  // [혼합 호환] 레거시(백엔드 전용) 스텝이 섞여 있으면 라이브 리셋-재적용 대신 아래 백엔드
  // 전체 재실행으로 보낸다(백엔드 워커가 VBA/COM-bulk/openpyxl 스텝을 순서대로 모두 실행).
  if ((liveEngine === "vba" || liveEngine === "python" || hasLivePipelineForReconcile) &&
      !pipelineHasBackendOnlyStep(stepsForReconcile)) {
    // 대상 고정: 스킬이 만들어졌던 파일(A)을 우선 대상으로 삼는다(현재 탭이 B여도).
    // reapplyVbaPipelineToLive 내부에서도 다시 보정하지만, 여기서 먼저 A 세션을
    // 확보(필요 시 새로 오픈)해 두면 A 미러가 트림돼 닫힌 경우에도 안전하게 동작한다.
    // no-op 편집 생략: 이미 OFF 인 스킬의 삭제처럼 '켜진 스텝 집합'이 변하지 않는 편집은
    // 라이브 적용 상태도 그대로이므로 느린 전체 리셋+재적용을 건너뛴다.
    if (_lastLiveAppliedSignature !== null &&
        liveEnabledStepsSignature(stepsForReconcile) === _lastLiveAppliedSignature) {
      if (typeof toast === "function") toast("적용 상태 변화가 없어 Excel 재적용을 건너뛰었습니다.", "success");
      return;
    }
    const hasVbaStepForReconcile = (stepsForReconcile || [])
      .some(s => s && isStepEnabled(s) && inferPipelineStepLanguage(s) === "vba");
    let liveExcelId = null;
    try {
      if (hasVbaStepForReconcile) {
        const fid = pipelinePinnedTargetFileId(stepsForReconcile);
        if (fid) {
          liveExcelId = await excelIdForPipelineFileId(fid);
        } else if (pipelineHasUnresolvedTarget(stepsForReconcile)) {
          warnUnresolvedPipelineTarget();
        }
      } else {
        const pinned = await ensurePinnedVbaTargetExcelId(stepsForReconcile);
        if (pinned && pinned.excelId) liveExcelId = pinned.excelId;
      }
    } catch (_) {}
    if (!liveExcelId) {
      liveExcelId = vbaTargetExcelId();
      if (hasVbaStepForReconcile) {
        const fid = pipelinePinnedTargetFileId(stepsForReconcile) || preferredVbaRunFileId();
        if (!liveExcelId && fid) liveExcelId = await excelIdForPipelineFileId(fid);
      }
    }
    if (liveExcelId) {
      // [#19] 토글/삭제발 재적용에도 취소 토큰을 등록해 '작업 중단' 버튼이 뜨고 동작하게 한다.
      const cancelToken = { cancelled: false };
      window.__activeVbaApply = { token: cancelToken, excelId: liveExcelId, restorePipeline: options.restorePipeline || null };
      return reapplyVbaPipelineToLive(liveExcelId, { steps: stepsForReconcile, viewSheet: affectedStepViewSheetHint(options.affectedStep) })
        .then(result => {
          // [P1] 활성창 기본 — 뷰 이동은 '실제 변경된 스텝의 대상 파일'로만(출력으로 무조건 점프 금지).
          try {
            const affected = options.affectedStep || null;
            const tfid = affectedStepViewFileId(affected);
            void tfid;
          } catch (_) {}
          return result;
        })
        .finally(() => {
          if (window.__activeVbaApply && window.__activeVbaApply.token === cancelToken) window.__activeVbaApply = null;
        });
    }
    // 라이브 세션을 전혀 못 구했는데 백엔드(openpyxl 시뮬) 경로로 떨어지면, 결과는 미리보기에만
    // 반영되고 라이브 Excel 은 그대로인 채 "반영했다" 토스트가 떠서 유령 적용이 된다 → 명확히 실패.
    const hasLiveSteps = (stepsForReconcile || []).some(s => !!pipelineStepLiveLanguage(s));
    if (hasLiveSteps) {
      throw new Error(
        "적용할 Excel 창을 열지 못해 변경을 라이브에 반영하지 못했습니다. " +
        "파일 탭을 눌러 Excel 창이 뜨는 것을 확인한 뒤 다시 시도해 주세요."
      );
    }
  }
  const steps = options.steps || state.pipeline;
  const hasAnyOriginal = !!state.outputOriginal || ((state.inputsOriginal || []).length > 0);
  if (!hasAnyOriginal) return;
  const mustUseBackend = pipelineUsesPython(steps) ||
    (typeof shouldDeferImmediatePipelineRun === "function" && shouldDeferImmediatePipelineRun());
  if (!state.pipeline.length) {
    if (mustUseBackend) {
      if (window.runnerSetRunning) window.runnerSetRunning(true);
      clearPipelineExecutionMemory({ keepViewer: true });
      try {
        await runPipelinePreferBackend({
          pipeline: [],
          baseMode: "original",
        });
        if (window.runnerSetDone) window.runnerSetDone();
      } catch (err) {
        if (window.runnerSetRunning) window.runnerSetRunning(false);
        throw err;
      }
      return;
    }
    runPipeline([]);
    refreshTabs();
    renderExcelViewer();
    return;
  }
  if (!mustUseBackend && !options.forceBackend && shouldUseFastPreviewPipelineRun(steps)) {
    runPipeline(steps);
    if (typeof hasBackendOnlyWorkbooks === "function" && hasBackendOnlyWorkbooks()) {
      window.backendCurrentCacheDirty = true;
    }
    return;
  }
  if (mustUseBackend) {
    if (window.runnerSetRunning) window.runnerSetRunning(true);
    clearPipelineExecutionMemory({ keepViewer: true });
    try {
      const _st = await runPipelinePreferBackend({
        pipeline: steps,
        baseMode: options.backendBaseMode || "original",
      });
      if (_st && _st.cancelled) {
        if (window.runnerSetRunning) window.runnerSetRunning(false);
        toast("작업을 중단했습니다.", "success");
        return _st;
      }
      toast("스킬 변경 사항을 시뮬레이터에 다시 반영했습니다", "success");
      // [P1] 활성창 기본 — 뷰 이동은 '실제 변경된 스텝의 대상 파일'로만.
      // 토글/삭제/수정된 그 스킬의 targetFileId 가 있고 현재 탭과 다를 때만 그 파일로 이동한다.
      // (출력으로 무조건 점프하지 않음. 예: 3번 탭에서 2번 파일 스킬을 off → 2번이 변경 → 뷰는 2번으로)
      try {
        const affected = options.affectedStep || null;
        void affectedStepViewFileId(affected);
      } catch (_) {}
      if (window.runnerSetDone) window.runnerSetDone();
    } catch (err) {
      if (window.runnerSetRunning) window.runnerSetRunning(false);
      throw err;
    }
    return;
  }
  runPipeline(steps);
}

function refreshRunButton() {
  const hasAnyFile = !!state.output || state.inputs.length > 0;
  const hasDownloadableFiles =
    (state.inputs && state.inputs.length > 0) ||
    (state.outputTemplates && state.outputTemplates.length > 0) ||
    !!state.output;
  const hasSteps = activePipelineSteps(state.pipeline).length > 0;
  $("btn-run").disabled = !(hasAnyFile && hasSteps);
  $("btn-save").disabled = !hasSteps;
  $("btn-download").disabled = !hasDownloadableFiles;
  renderRunnerWorkflow();
}

function getActivePipelineStepIds() {
  return (state.pipeline || []).filter(isStepEnabled).map(step => step && step.id).filter(Boolean);
}

function setGeneratorRunLoading(running, text) {
  const btn = $("btn-run");
  if (!btn) return;
  if (running) {
    if (!btn.dataset.defaultText) btn.dataset.defaultText = btn.textContent || "\u25B6 \uC804\uCCB4 \uC2E4\uD589";
    btn.disabled = true;
    btn.classList.add("running");
    btn.textContent = text || "\uC2E4\uD589 \uC911...";
    return;
  }
  btn.classList.remove("running");
  btn.textContent = btn.dataset.defaultText || "\u25B6 \uC804\uCCB4 \uC2E4\uD589";
  refreshRunButton();
}

window.generatorSetProgress = function(text) {
  const btn = $("btn-run");
  if (!btn || !btn.classList.contains("running")) return;
  btn.textContent = text || "\uC2E4\uD589 \uC911...";
};

const PIPELINE_AUTO_REPAIR_MAX_REPAIRS = 3;
const PIPELINE_AUTO_REPAIR_MAX_PER_STEP = 2;

function pipelineStepRepairSourceMessage(step) {
  // 전체 실행 자동복구는 "실패한 Step 하나"만 고쳐야 한다. 최신 채팅/이전 대화까지
  // 섞으면 저장된 zip 의 Step 2 복구가 Step 4 의 날짜 작업이나 전혀 다른 파일 작업으로
  // 오염된다. Step 자체의 prompt/description/code 를 기준으로만 판단한다.
  return [
    step && step.prompt ? `Step prompt:\n${step.prompt}` : "",
    step && step.description ? `Step description:\n${step.description}` : "",
  ].filter(Boolean).join("\n\n").trim();
}

function pipelineStaticFailuresForCode(code, language, sourceUserMessage) {
  const lang = language || "python";
  if (lang === "vba" && typeof vbaStaticSafetyFailures === "function") {
    return vbaStaticSafetyFailures(code, sourceUserMessage || "");
  }
  if (lang === "python" && typeof pythonComStaticSafetyFailures === "function") {
    return pythonComStaticSafetyFailures(code, sourceUserMessage || "");
  }
  return [];
}

function pipelineStaticFailuresForStep(step) {
  const language = inferPipelineStepLanguage(step);
  if (language !== "vba" && language !== "python") return [];
  return pipelineStaticFailuresForCode(step && step.code, language, pipelineStepRepairSourceMessage(step));
}

function findPipelineStaticPreflightFailure(steps = state.pipeline) {
  for (let i = 0; i < (steps || []).length; i += 1) {
    const step = steps[i];
    if (!step || !isStepEnabled(step) || !step.code) continue;
    const failures = pipelineStaticFailuresForStep(step);
    if (failures.length) return { idx: i, step, failures };
  }
  return null;
}

function createPipelineStepError(stepIdx, step, message, details) {
  const err = new Error(message || "스킬 자동 복구에 실패했습니다.");
  err._stepInfo = {
    stepIdx,
    stepId: step && step.id || null,
    description: step && step.description || "",
    code: step && step.code || "",
    language: step && (step.language || inferPipelineStepLanguage(step)) || "",
    message: message || "",
    rawError: details || message || "",
    recoverable: false,
  };
  return err;
}

function shouldForceVbaForPipelineRepair(step, reason, repairCount) {
  const language = inferPipelineStepLanguage(step);
  if (language === "vba") return true;
  if (reason && reason.forceLanguage === "vba") return true;
  const source = pipelineStepRepairSourceMessage(step);
  if (typeof shouldRouteRequestToVba === "function" && shouldRouteRequestToVba(source)) return true;
  if (language === "python" && repairCount >= 1) return true;
  const message = [
    reason && reason.message,
    reason && reason.errorInfo && reason.errorInfo.message,
    reason && reason.errorInfo && reason.errorInfo.rawError,
  ].filter(Boolean).join("\n");
  if (language === "python" && /(out\s*of\s*memory|memory|ram|응답\s*없|멈춤|다운|COM|RPC|macro|매크로|Excel)/i.test(message)) {
    return true;
  }
  return false;
}

function pipelineRepairSystemPrompt(targetLanguage) {
  const schema = (typeof buildSchemaSummary === "function") ? buildSchemaSummary() : "";
  if (targetLanguage === "vba" && typeof VBA_SYSTEM_PROMPT === "string") {
    return VBA_SYSTEM_PROMPT + "\n\n## 현재 파일 스키마\n" + schema;
  }
  if (targetLanguage === "python" && typeof PYTHON_COM_SYSTEM_PROMPT === "string") {
    return PYTHON_COM_SYSTEM_PROMPT + "\n\n## 현재 파일 스키마\n" + schema;
  }
  return "You generate one executable Excel automation skill.\n\n## 현재 파일 스키마\n" + schema;
}

function buildPipelineAutoRepairPrompt(step, stepIdx, reason, targetLanguage) {
  const isVba = targetLanguage === "vba";
  const source = pipelineStepRepairSourceMessage(step);
  const failures = (reason && reason.failures || []).map(f => `- ${f}`).join("\n");
  const errInfo = reason && reason.errorInfo || {};
  const extraFailures = (reason && reason.previousFailures || []).map(f => `- ${f}`).join("\n");
  return [
    "불러온 .zip 스킬 파이프라인을 전체 실행하는 중입니다.",
    "사용자는 코딩을 전혀 모르므로, 사용자가 코드를 수정하거나 복구 버튼을 누르지 않아도 이 Step이 바로 실행되도록 고쳐야 합니다.",
    "실패한 Step 하나만 교체하세요. 이전/다음 Step의 작업을 반복하거나 새 기능을 추가하지 마세요.",
    isVba
      ? "반드시 하나의 ```vba 코드 블록만 출력하고, Sub B2BSkill() 전체 구현을 포함하세요."
      : "반드시 하나의 ```python 코드 블록만 출력하고, def transform(ctx): 전체 구현을 포함하세요.",
    "코드 밖 설명은 최소화하세요.",
    "",
    "## 원래 사용자 의도/대화 단서",
    source || "(저장된 대화 단서 없음. Step 설명과 기존 코드를 기준으로 같은 작업만 유지)",
    "",
    "## 교체 대상 Step",
    `Step ${stepIdx + 1}`,
    `설명: ${step && step.description || ""}`,
    `기존 언어: ${step && (step.language || inferPipelineStepLanguage(step)) || ""}`,
    `새 언어: ${targetLanguage}`,
    "",
    failures ? "## 실행 전 안전 검사에서 막힌 이유\n" + failures : "",
    extraFailures ? "## 직전 자동 복구 후보도 막힌 이유\n" + extraFailures : "",
    errInfo.message || reason && reason.message ? [
      "## 실행 중 오류",
      String(errInfo.message || reason.message || ""),
      errInfo.rawError ? String(errInfo.rawError) : "",
      errInfo.stack ? String(errInfo.stack).slice(0, 4000) : "",
    ].filter(Boolean).join("\n") : "",
    "",
    "## 기존 코드",
    "```" + (step && (step.language || inferPipelineStepLanguage(step)) || ""),
    String(step && step.code || ""),
    "```",
    "",
    isVba ? [
      "## VBA 복구 필수 규칙",
      "- Workbooks/Worksheets/Range 참조는 현재 열려 있는 실제 워크북과 시트명을 기준으로 명확히 지정하세요.",
      "- PivotTable 객체를 억지로 만들지 말고, 행/열/합계 형태 요약은 Scripting.Dictionary 기반 집계로 작성하세요.",
      "- 전화번호/가입번호/계약번호처럼 앞 0이 의미 있는 키는 .Text 로 읽고, 결과 열 NumberFormat=\"@\" 를 데이터 쓰기 전에 적용하세요.",
      "- 값만 복사/붙여넣기는 수식을 복사하지 말고 표시값 또는 Value를 읽어 대상 Range.Value로 쓰세요.",
      "- 값 채우기/입력/반영은 요청받은 대상 범위에 쓰세요. 대상 셀에 기존 수식이 있으면 값으로 대체해도 되지만, 합계/소계/부가세포함 같은 요약 행은 데이터 행이 아니므로 제외하세요.",
      "- 조건별 시간 환산은 '01:02:03' 같은 텍스트와 Excel 시간 serial 값을 모두 처리하세요.",
      "- 키 기준 행 덮어쓰기는 대상 행 중 매칭된 행만 갱신하고, 미매칭 행은 그대로 두세요.",
      "- On Error Resume Next, MsgBox, InputBox, Shell, Workbooks.Open, Save/Close, Application.Quit 을 쓰지 마세요.",
      "- 대상을 못 찾으면 Err.Raise vbObjectError + 513, \"B2BSkill\", \"사유\" 로 실패시키세요.",
    ].join("\n") : [
      "## Python COM 복구 필수 규칙",
      "- ctx.copy 로 값만 복사하지 마세요. 값/값만 요청은 ctx.read 후 ctx.write(..., overwrite_formulas=True) 흐름으로 작성하세요.",
      "- 복잡한 피벗형 집계, 조건 다중 계산, 시트 전체 복사는 Python이 아니라 VBA로 복구해야 합니다.",
      "- 레거시 openpyxl ctx(sheet/rows/write_grid 등) 방언을 쓰지 말고 현재 Python COM ctx API만 사용하세요.",
    ].join("\n"),
    "/no_think",
  ].filter(Boolean).join("\n");
}

function extractPipelineRepairCode(reply) {
  if (typeof extractCode === "function") return extractCode(reply);
  const m = String(reply || "").match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/);
  return m ? m[1].trim() : "";
}

function localRepairFormulaPreserveZeroVba(code) {
  let text = String(code || "");
  if (!/\bSub\s+B2BSkill\s*\(/i.test(text)) return "";
  if (!/\bHasFormula\b/i.test(text)) return "";
  if (!/\b(?:rng|targetRng|dstRng|range|targetRange)\s*\.\s*(?:Value|Value2)\s*=\s*(?:outArr|arr|values|dataArr)\b/i.test(text)) return "";
  if (!/\bSet\s+(?:rng|targetRng|dstRng|range|targetRange)\s*=\s*[^'\r\n]*\.Range\s*\(\s*["'][^"']+["']\s*\)/i.test(text)) return "";

  if (!/\bDim\s+cell\s+As\s+Range\b/i.test(text)) {
    text = text.replace(/(\bDim\s+(?:rng|targetRng|dstRng|range|targetRange)\s+As\s+Range\b[^\r\n]*(?:\r?\n)?)/i, "$1    Dim cell As Range\n");
  }
  const replacement = [
    "    ' 수식 셀은 그대로 두고 값 셀만 0으로 입력",
    "    For Each cell In rng.Cells",
    "        If Not cell.HasFormula Then",
    "            cell.Value = 0",
    "        End If",
    "    Next cell",
  ].join("\n");
  text = text.replace(
    /\s*arr\s*=\s*rng\.Value[\s\S]*?'[^'\r\n]*한\s*번에\s*쓰기[^\r\n]*\r?\n\s*rng\.Value\s*=\s*outArr/i,
    "\n" + replacement,
  );
  if (/\brng\.Value\s*=\s*outArr\b/i.test(text)) {
    text = text.replace(
      /\s*arr\s*=\s*rng\.Value[\s\S]*?\brng\.Value\s*=\s*outArr\b/i,
      "\n" + replacement,
    );
  }
  return text;
}

function localRepairCopyPasteVbaCleanup(code) {
  const text = String(code || "");
  if (!/\bSub\s+B2BSkill\s*\(/i.test(text)) return "";
  if (!/\bApplication\s*\.\s*(?:ScreenUpdating|Calculation|EnableEvents|DisplayAlerts)\s*=/i.test(text)) return "";
  if (/\bOn\s+Error\s+GoTo\s+Cleanup\b/i.test(text) && /^\s*Cleanup\s*:/im.test(text)) return "";
  if (!/\bCopy\s+Destination\s*:=/i.test(text)) return "";

  const strings = [...text.matchAll(/wb\.Name\s*=\s*["']([^"']+\.xlsm?|[^"']+\.xlsx|[^"']+\.xlsb)["']/gi)].map(m => m[1]);
  const srcFile = strings[0] || "";
  const dstFile = strings[1] || strings[0] || "";
  const srcSheet = (text.match(/If\s+sh\.Name\s*=\s*["']([^"']+)["']\s+Then\s*\r?\n\s*Set\s+wsSrc/i) || [])[1] || "";
  const dstSheet = (text.match(/If\s+sh\.Name\s*=\s*["']([^"']+)["']\s+Then\s*\r?\n\s*Set\s+wsDst/i) || [])[1] || "";
  const srcRange = (text.match(/Set\s+rngSrc\s*=\s*wsSrc\.Range\s*\(\s*["']([^"']+)["']\s*\)/i) || [])[1] || "";
  const dstCell = (text.match(/Set\s+rngDst\s*=\s*wsDst\.Range\s*\(\s*["']([^"']+)["']\s*\)/i) || [])[1] || "";
  if (!srcFile || !dstFile || !srcSheet || !dstSheet || !srcRange || !dstCell) return "";

  const q = s => String(s).replace(/"/g, '""');
  return [
    "Sub B2BSkill()",
    "    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation",
    "    Dim prevScreenUpdating As Boolean: prevScreenUpdating = Application.ScreenUpdating",
    "    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String",
    "    On Error GoTo Cleanup",
    "    Application.ScreenUpdating = False",
    "    Application.Calculation = xlCalculationManual",
    "",
    "    Dim wbSrc As Workbook, wbDst As Workbook, wb As Workbook",
    "    Dim wsSrc As Worksheet, wsDst As Worksheet, sh As Worksheet",
    "    Dim rngSrc As Range, rngDst As Range",
    "",
    "    For Each wb In Application.Workbooks",
    `        If wb.Name = "${q(srcFile)}" Then Set wbSrc = wb`,
    `        If wb.Name = "${q(dstFile)}" Then Set wbDst = wb`,
    "    Next wb",
    `    If wbSrc Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'${q(srcFile)}' 가 열려 있지 않습니다."`,
    `    If wbDst Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'${q(dstFile)}' 가 열려 있지 않습니다."`,
    "",
    "    For Each sh In wbSrc.Worksheets",
    `        If sh.Name = "${q(srcSheet)}" Then Set wsSrc = sh: Exit For`,
    "    Next sh",
    `    If wsSrc Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'${q(srcSheet)}' 시트를 찾지 못했습니다."`,
    "",
    "    For Each sh In wbDst.Worksheets",
    `        If sh.Name = "${q(dstSheet)}" Then Set wsDst = sh: Exit For`,
    "    Next sh",
    `    If wsDst Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'${q(dstSheet)}' 시트를 찾지 못했습니다."`,
    "",
    `    Set rngSrc = wsSrc.Range("${q(srcRange)}")`,
    `    Set rngDst = wsDst.Range("${q(dstCell)}")`,
    "    rngSrc.Copy Destination:=rngDst",
    "",
    "Cleanup:",
    "    If Err.Number <> 0 Then",
    "        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description",
    "    End If",
    "    Application.Calculation = prevCalc",
    "    Application.ScreenUpdating = prevScreenUpdating",
    "    Application.CutCopyMode = False",
    "    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc",
    "End Sub",
  ].join("\n");
}

function localRepairPipelineStep(step, failures) {
  const language = inferPipelineStepLanguage(step);
  const code = String(step && step.code || "");
  const reasonText = (failures || []).join("\n");
  if (language === "vba" && /Application\.(?:ScreenUpdating|Calculation|EnableEvents|DisplayAlerts)|Cleanup|Copy\s+Destination/i.test(reasonText + "\n" + code)) {
    const repaired = localRepairCopyPasteVbaCleanup(code);
    if (repaired) return { code: repaired, language: "vba", description: step.description || "교차 워크북 범위 복사 붙여넣기" };
  }
  return null;
}

async function autoRepairPipelineStep(stepIdx, reason, repairCount) {
  const step = state.pipeline && state.pipeline[stepIdx];
  if (!step || !step.code) throw createPipelineStepError(stepIdx, step, "자동 복구할 Step 코드를 찾지 못했습니다.");
  const targetLanguage = shouldForceVbaForPipelineRepair(step, reason || {}, repairCount || 0) ? "vba" : inferPipelineStepLanguage(step);
  const sourceUserMessage = pipelineStepRepairSourceMessage(step);
  const label = `Step ${stepIdx + 1} 자동 복구 중`;
  if (window.generatorSetProgress) window.generatorSetProgress(label + "...");
  if (window.runnerSetRunning) {
    const runBtn = document.getElementById("runner-run-btn");
    if (runBtn) runBtn.textContent = label + "...";
  }
  setPipelineRuntimeStatus([step.id], "running", "자동 복구");
  toast(`${label}입니다.`, "success");

  const localRepair = localRepairPipelineStep(step, (reason && reason.failures) || (reason && reason.previousFailures) || []);
  if (localRepair && localRepair.code) {
    const localFailures = pipelineStaticFailuresForCode(localRepair.code, localRepair.language, sourceUserMessage);
    if (!localFailures.length) {
      if (typeof pushHistory === "function") pushHistory("전체 실행 로컬 자동 복구");
      state.pipeline[stepIdx] = normalizeStep({
        ...step,
        code: localRepair.code,
        language: localRepair.language,
        description: localRepair.description,
        autoRepairedAt: new Date().toISOString(),
        localAutoRepaired: true,
      });
      setPipelineRuntimeStatus([step.id], "review", "자동 복구됨");
      renderPipeline();
      refreshRunButton();
      if (typeof renderRunnerWorkflow === "function") renderRunnerWorkflow();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("pipeline-local-auto-repair");
      const msg = `Step ${stepIdx + 1}을 로컬 규칙으로 자동 복구해 같은 위치의 코드로 교체했습니다.`;
      if (typeof addMessage === "function") addMessage("system", msg);
      toast(msg, "success");
      return state.pipeline[stepIdx];
    }
  }

  const system = pipelineRepairSystemPrompt(targetLanguage);
  const prompt = buildPipelineAutoRepairPrompt(step, stepIdx, reason || {}, targetLanguage);
  let reply;
  if (typeof callLLMOneShot === "function") {
    reply = await callLLMOneShot(system, prompt, { maxTokens: 4096 });
  } else if (typeof callLLM === "function") {
    reply = await callLLM(prompt, { forceEngine: targetLanguage, skipHistoryPush: true });
  } else {
    throw createPipelineStepError(stepIdx, step, "LLM 복구 엔진을 사용할 수 없습니다.");
  }

  const code = extractPipelineRepairCode(reply);
  const language = (typeof inferCodeLanguage === "function" ? inferCodeLanguage(code, reply) : targetLanguage) || targetLanguage;
  if (!code) throw createPipelineStepError(stepIdx, step, "자동 복구 응답에 실행 코드가 없습니다.", String(reply || "").slice(0, 2000));
  if (targetLanguage === "vba" && language !== "vba") {
    throw createPipelineStepError(stepIdx, step, "자동 복구가 VBA 코드 대신 다른 언어를 반환했습니다.", String(reply || "").slice(0, 2000));
  }
  if (targetLanguage === "python" && language !== "python") {
    throw createPipelineStepError(stepIdx, step, "자동 복구가 Python 코드 대신 다른 언어를 반환했습니다.", String(reply || "").slice(0, 2000));
  }

  const candidateFailures = pipelineStaticFailuresForCode(code, language, sourceUserMessage);
  if (candidateFailures.length) {
    if (language === "python" && targetLanguage !== "vba") {
      return autoRepairPipelineStep(stepIdx, {
        ...(reason || {}),
        forceLanguage: "vba",
        previousFailures: candidateFailures,
      }, Number(repairCount || 0) + 1);
    }
    throw createPipelineStepError(
      stepIdx,
      { ...step, code, language },
      "자동 복구 후보가 안전 검사를 통과하지 못했습니다.",
      candidateFailures.join("\n"),
    );
  }

  const newDescription = step.description || (typeof extractDescription === "function" ? extractDescription(reply) : "");
  if (typeof pushHistory === "function") pushHistory("전체 실행 자동 복구");
  state.pipeline[stepIdx] = normalizeStep({
    ...step,
    code,
    language,
    description: newDescription,
    autoRepairedAt: new Date().toISOString(),
  });
  setPipelineRuntimeStatus([step.id], "review", "자동 복구됨");
  renderPipeline();
  refreshRunButton();
  if (typeof renderRunnerWorkflow === "function") renderRunnerWorkflow();
  if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("pipeline-auto-repair");
  const msg = `Step ${stepIdx + 1}을 자동 복구해 같은 위치의 코드로 교체했습니다.`;
  if (typeof addMessage === "function") addMessage("system", msg);
  toast(msg, "success");
  return state.pipeline[stepIdx];
}

async function runPipelineWithAutoRepair(options = {}) {
  const runOptions = { ...options };
  delete runOptions.maxRepairs;
  delete runOptions.source;
  let repairsDone = 0;
  const repairsByStep = new Map();
  let lastErr = null;

  // [사용자/Codex 진단] 저장된(이미 검증된) 스킬을 전체실행할 때, 정적 게이트 자동복구가 VBA 를 매번
  // LLM 으로 재생성하며 느려지고("스텝2 자동복구 오래걸림") 원본 코드를 갈아치웠다 — 이게 문제의 한 축.
  // VBA 가 포함된 파이프라인은 정적 게이트 자동복구(실행 전 재생성)를 건너뛰고 저장된 코드를 그대로
  // 실행한다(위험 VBA 의 Cleanup 누락 등은 happy-path 에선 문제 없고, 실패 시엔 서버가 상태를 복원).
  const _pipelineHasVba = (state.pipeline || []).some(
    s => s && s.code && String(s.language || "").toLowerCase() !== "python"
  );

  while (repairsDone <= PIPELINE_AUTO_REPAIR_MAX_REPAIRS) {
    const preflight = _pipelineHasVba ? null : findPipelineStaticPreflightFailure(state.pipeline);
    if (preflight) {
      const key = preflight.step.id || `idx:${preflight.idx}`;
      const count = repairsByStep.get(key) || 0;
      if (count >= PIPELINE_AUTO_REPAIR_MAX_PER_STEP) {
        throw createPipelineStepError(preflight.idx, preflight.step, "같은 Step의 안전 검사 자동 복구가 반복 실패했습니다.", preflight.failures.join("\n"));
      }
      repairsByStep.set(key, count + 1);
      repairsDone += 1;
      await autoRepairPipelineStep(preflight.idx, { kind: "static", failures: preflight.failures }, count);
      continue;
    }

    try {
      return await runPipelinePreferBackend(runOptions);
    } catch (err) {
      lastErr = err;
      // [매크로 비활성 = 환경 문제] "매크로를 실행할 수 없습니다" 류는 코드를 다시 생성해도 못 고친다.
      // 자동복구(LLM 재생성)를 돌리면 같은 실패를 반복하며 느려지기만 하므로(스텝2가 오래 걸리던 원인),
      // 이런 에러는 복구하지 말고 즉시 보고한다.
      const _emsg = String((err && err.message) || err || "");
      if (/매크로를 실행할 수 없습니다|매크로를 사용하지 못할|cannot run the macro|macros may be disabled/i.test(_emsg)) {
        throw err;
      }
      const info = (err && (err._stepInfo || err.errorInfo)) || {};
      const stepIdx = resolveRunnerRecoveryStepIndex(info);
      if (!Number.isInteger(stepIdx) || stepIdx < 0 || !state.pipeline[stepIdx]) throw err;
      const step = state.pipeline[stepIdx];
      // 캡처한 복붙/셀삭제는 '사용자가 실제로 한 동작의 정확 좌표 재생'이 목적이다. LLM 자동복구로
      // 재생성하면 동작이 바뀌고(복붙 버그 재발) 같은 실패를 반복하며 "박힘" → 재생성하지 말고 그대로 보고.
      if (step && step.code && /\[복붙 캡처\]|\[셀 삭제 캡처\]/.test(String(step.code))) throw err;
      const key = step.id || `idx:${stepIdx}`;
      const count = repairsByStep.get(key) || 0;
      if (count >= PIPELINE_AUTO_REPAIR_MAX_PER_STEP || repairsDone >= PIPELINE_AUTO_REPAIR_MAX_REPAIRS) throw err;
      repairsByStep.set(key, count + 1);
      repairsDone += 1;
      await autoRepairPipelineStep(stepIdx, {
        kind: "runtime",
        errorInfo: info,
        message: err && err.message || String(err || ""),
      }, count);
    }
  }
  throw lastErr || new Error("파이프라인 자동 복구 한도를 초과했습니다.");
}

$("btn-run").onclick = async () => {
  const activeStepIds = getActivePipelineStepIds();
  setGeneratorRunLoading(true, "\uC2E4\uD589 \uC900\uBE44 \uC911...");
  setPipelineRuntimeStatus(activeStepIds, "running", "\uC2E4\uD589 \uC911");
  try {
    clearPipelineExecutionMemory({ keepViewer: true });
    await runPipelineWithAutoRepair({ source: "generator" });
    setPipelineRuntimeStatus(activeStepIds, "applied", "\uC801\uC6A9\uB428");
    toast(`${state.pipeline.length}개 단계 실행 완료`, "success");
  } catch (err) {
    setPipelineRuntimeStatus(activeStepIds, "error", "\uC624\uB958");
    renderExcelViewer();
    reportPipelineError(err);
  } finally {
    setGeneratorRunLoading(false);
  }
};

// [복붙 캡처] 우측 라이브 엑셀에서 Ctrl+C(복사) → Ctrl+V(붙여넣기) 한 직후 이 버튼을 누르면,
// 서버가 클립보드(소스 범위)와 현재 선택영역(붙여넣은 대상)을 역추적해 ctx.paste_copied(...) 스킬 단계로
// 저장한다. Excel 네이티브 복사를 그대로 재생하므로 값/수식/서식이 보존되고, LLM 추측이 없어 복붙 버그가 없다.
// (재생은 Python COM 경로 → VBA 러너를 타지 않음.)
(function () {
  const btn = (typeof $ === "function") ? $("btn-capture-copypaste") : null;
  if (!btn) return;
  btn.onclick = async () => {
    const excelId = (typeof vbaTargetExcelId === "function" && vbaTargetExcelId())
      || (typeof currentExcelId === "function" && currentExcelId());
    if (!excelId) { toast("먼저 우측에 엑셀 파일을 열어 주세요", "error"); return; }
    btn.disabled = true;
    try {
      const data = await postExcelMirror("/api/excel/capture-copypaste", { excelId }, 0, { timeoutMs: 20000 });
      if (!data || !data.ok) { toast((data && data.error) || "복붙을 찾지 못했습니다", "error"); return; }
      if (data.dimsMatch === false) {
        toast("붙여넣은 범위 크기가 복사한 범위와 달라요. 복사→붙여넣기 직후 다시 눌러 주세요.", "error");
        return;
      }
      const step = {
        id: (typeof uid === "function" ? uid() : ("cap_" + ((state.pipeline || []).length + 1))),
        prompt: "복붙 캡처: " + data.description,
        code: data.code,
        description: data.description,
        language: "python",
        // 대상 = 붙여넣은(=캡처한 세션) 파일. 교차파일 복붙은 코드에 소스/대상 두 파일명이 있어
        // 자동 추론이 소스를 대상으로 잘못 고를 수 있다 → 전체실행이 엉뚱한 세션에서 돌아 실패.
        // 명시 targetFileId 로 대상을 '붙여넣은 파일'로 고정한다.
        targetFileId: (typeof fileIdForExcelMirrorId === "function" ? fileIdForExcelMirrorId(excelId) : null)
          || state.currentFileId || null,
      };
      applyLogic(step);
      toast("복붙을 스킬 단계로 저장했습니다 — " + data.description, "success");
    } catch (err) {
      toast("복붙 캡처 실패: " + (err && err.message ? err.message : String(err)), "error");
    } finally {
      btn.disabled = false;
    }
  };
})();

// [셀 삭제 캡처] 우측 라이브 엑셀에서 지울 범위를 선택(또는 Delete)한 직후 이 버튼을 누르면,
// 서버가 현재 선택영역을 역추적해 ctx.clear(...) 스킬 단계로 저장한다(값/수식 삭제, 서식 유지).
// 재생은 Python COM 경로 → VBA 러너를 타지 않음.
(function () {
  const btn = (typeof $ === "function") ? $("btn-capture-delete") : null;
  if (!btn) return;
  btn.onclick = async () => {
    const excelId = (typeof vbaTargetExcelId === "function" && vbaTargetExcelId())
      || (typeof currentExcelId === "function" && currentExcelId());
    if (!excelId) { toast("먼저 우측에 엑셀 파일을 열어 주세요", "error"); return; }
    btn.disabled = true;
    try {
      const data = await postExcelMirror("/api/excel/capture-delete", { excelId }, 0, { timeoutMs: 20000 });
      if (!data || !data.ok) { toast((data && data.error) || "선택 영역을 찾지 못했습니다", "error"); return; }
      const step = {
        id: (typeof uid === "function" ? uid() : ("del_" + ((state.pipeline || []).length + 1))),
        prompt: "셀 삭제 캡처: " + data.description,
        code: data.code,
        description: data.description,
        language: "python",
        targetFileId: (typeof fileIdForExcelMirrorId === "function" ? fileIdForExcelMirrorId(excelId) : null)
          || state.currentFileId || null,
      };
      applyLogic(step);
      toast("셀 삭제를 스킬 단계로 저장했습니다 — " + data.description, "success");
    } catch (err) {
      toast("셀 삭제 캡처 실패: " + (err && err.message ? err.message : String(err)), "error");
    } finally {
      btn.disabled = false;
    }
  };
})();

// item 9: 어느 단계에서 어떤 사유로 실패했는지 토스트 + 채팅 panel 에 모두 노출.
function hasErrorRecoverySeed(info) {
  if (info && (Number(info.stepIdx) >= 0 || !!info.stepId || !!info.code || !!info.description)) return true;
  // 에러가 특정 step을 못 짚었더라도(백엔드 비-스텝 오류 등) 파이프라인에 적용 가능한 스킬이 있으면
  // 마지막 단계를 기준으로 복구를 시도할 수 있게 버튼을 활성화한다.
  return Array.isArray(state.pipeline) && state.pipeline.some(s => s && s.enabled !== false && s.code);
}

// [#2] 실행 오류를 코드 지식이 없는 사용자에게 풀어 설명한다(단발 LLM 호출, 대화 기록 무관).
// 반환: 사용자용 안내 문자열 또는 null(LLM 미설정/실패 → 호출자가 기존 안내로 폴백).
async function explainPipelineErrorForUser(info) {
  if (typeof callLLMOneShot !== "function") return null;
  const req = (typeof latestUserRequestForSafety === "function") ? latestUserRequestForSafety() : "";
  const system = [
    "당신은 한국어 엑셀 자동화 도우미입니다. 방금 사용자가 시킨 작업이 오류로 실패했습니다.",
    "엑셀/코드 지식이 전혀 없는 사용자에게 친절하고 평이하게 설명하세요. 반드시 이 흐름을 지키세요:",
    "(1) 사용자가 무엇을 하려 했는지 한 문장으로 되짚기",
    "(2) 어느 단계/어느 부분에서 막혔는지(엑셀 화면 기준의 일상어로)",
    "(3) 왜 막혔는지 쉬운 말로 — 함수명·영문 오류·코드·스택트레이스는 절대 쓰지 말 것",
    "(4) 사용자의 의도가 '…'가 맞는지 확인하는 질문 하나, 또는 어떻게 바꿔 말하면 되는지 1가지 제안",
    "전체 3~5문장, 따뜻하고 명확하게. 기술 용어/코드/영문 오류 메시지를 그대로 옮기지 마세요.",
  ].join("\n");
  const user = [
    `사용자 요청: ${req || "(기록 없음)"}`,
    `실패한 단계 설명: ${info.description || "(설명 없음)"}`,
    `내부 오류(참고용 — 사용자에게 그대로 보여주지 말 것): ${info.rawError || info.message || info.cause || ""}`,
  ].join("\n");
  try {
    const out = await callLLMOneShot(system, user, { maxTokens: 500 });
    const text = String(out || "").trim();
    return text || null;
  } catch (_) {
    return null;
  }
}

function reportPipelineError(err, options) {
  options = options || {};
  const rawInfo = (err && (err._stepInfo || err.errorInfo)) || null;
  const info = rawInfo ? {
    stepIdx: Number(rawInfo.stepIdx ?? -1),
    stepId: rawInfo.stepId || null,
    description: rawInfo.description || "",
    code: rawInfo.code || "",
    language: rawInfo.language || "",
    message: rawInfo.message || (err && err.message) || String(err || ""),
    cause: rawInfo.cause || "",
    promptGuide: rawInfo.promptGuide || "",
    rawError: rawInfo.rawError || "",
    stack: rawInfo.stack || (err && err.stack) || "",
    recoverable: rawInfo.recoverable !== false,
  } : {
    stepIdx: -1,
    stepId: null,
    description: "",
    code: "",
    message: (err && err.message) || String(err || ""),
    cause: "",
    promptGuide: "",
    rawError: "",
    stack: (err && err.stack) || "",
    recoverable: false,
  };
  const stepLabel = Number(info.stepIdx) >= 0 ? `Step ${info.stepIdx + 1}` : "\uC2A4\uD0AC";
  toast(`${stepLabel}을 적용하지 못했습니다. 안내 메시지를 확인하세요.`, "error");
  if (options.runner) showRunnerPipelineError(err, options);
  // 채팅 영역에도 시스템 메시지로 남긴다 (chat 가 활성일 때만).
  const chatBox = document.getElementById("chat-messages");
  if (chatBox) {
    const div = document.createElement("div");
    div.className = "msg system error";
    div.innerHTML = `
      <div class="error-title"><b>스킬을 적용하지 못했습니다</b></div>
      <div class="error-desc">${Number(info.stepIdx) >= 0 ? `Step ${info.stepIdx + 1}${info.description ? ` · ${escapeHtml(info.description)}` : ""}` : "backend/runner stage"}</div>
      ${info.cause ? `<div class="error-cause">${escapeHtml(info.cause)}</div>` : ""}
      <div class="error-help">🔎 무엇이 잘못됐는지 쉬운 말로 확인하는 중…</div>
      <textarea class="error-recover-note" rows="2" placeholder="(선택) 무엇을 하려 했는지·실제로 어떻게 됐는지·기대 결과를 적으면 복구가 더 정확해집니다. 예: 매출을 회사별로 합쳐 B열에 넣으려 했는데 #VALUE!가 떴고, 숫자 합계가 보이길 원해요."></textarea>
      <button class="error-recover-btn" type="button">에러 복구 시도</button>
      <details class="error-details">
        <summary>상세 오류 보기 (기술 세부)</summary>
        <pre>${escapeHtml(info.rawError || info.message || err.message || String(err))}${info.stack ? "\n\n" + escapeHtml(info.stack) : ""}</pre>
      </details>
    `;
    chatBox.appendChild(div);
    // [#2] 기존 매크로성 안내 대신, LLM 이 코드 모르는 사용자 눈높이로 "무엇을 하려다 어디서 왜
    // 막혔는지 + 의도 확인"을 한 번 더 풀어 쓴다. 실패/미설정이면 기존 안내로 폴백(에러 표시를 막지 않음).
    {
      const helpEl = div.querySelector(".error-help");
      const fallbackHelp = info.promptGuide
        ? `💡 이렇게 요청해 보세요: ${escapeHtml(info.promptGuide)}`
        : "입력 파일, 시트명, 선택 범위가 요청과 맞는지 확인한 뒤 스킬을 수정하거나 다시 생성해 주세요.";
      if (typeof explainPipelineErrorForUser === "function") {
        explainPipelineErrorForUser(info)
          .then(text => {
            if (!helpEl) return;
            helpEl.innerHTML = text
              ? `🙂 ${escapeHtml(text).replace(/\n/g, "<br>")}`
              : fallbackHelp;
          })
          .catch(() => { if (helpEl) helpEl.innerHTML = fallbackHelp; });
      } else if (helpEl) {
        helpEl.innerHTML = fallbackHelp;
      }
    }
    const recoverBtn = div.querySelector(".error-recover-btn");
    if (recoverBtn) {
      // 복구 버튼은 항상 활성화한다(사용자 요구). 시드가 없으면 requestErrorRecovery 가
      // 마지막 적용 가능한 단계로 폴백하거나 안내 토스트를 띄운다.
      recoverBtn.disabled = false;
      recoverBtn.onclick = () => {
        if (recoverBtn.disabled) return;
        recoverBtn.disabled = true;
        recoverBtn.textContent = "복구 요청 중...";
        const recoverNote = ((div.querySelector(".error-recover-note") || {}).value || "").trim();
        if (typeof requestErrorRecovery === "function") {
          requestErrorRecovery(info.stepIdx, {
            stepIdx: Number(info.stepIdx) >= 0 ? Number(info.stepIdx) : -1,
            stepId: info.stepId || null,
            description: info.description || "",
            code: info.code || "",
            language: info.language || "",
            message: info.message || err.message || String(err),
            stack: info.stack || "",
            compatibilityCheck: !!options.compatibilityCheck,
          }, recoverNote).finally(() => {
            recoverBtn.textContent = "에러 복구 시도";
            recoverBtn.disabled = false;
          });
        }
      };
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

function resolveRunnerRecoveryStepIndex(errorInfo) {
  if (typeof resolveErrorRecoveryStepIndex === "function") {
    return resolveErrorRecoveryStepIndex(errorInfo && errorInfo.stepIdx, errorInfo || {});
  }
  const idx = Number(errorInfo && errorInfo.stepIdx);
  if (Number.isInteger(idx) && idx >= 0 && state.pipeline[idx]) return idx;
  const stepId = errorInfo && errorInfo.stepId;
  if (stepId) {
    const byId = (state.pipeline || []).findIndex(step => step && step.id === stepId);
    if (byId >= 0) return byId;
  }
  const code = String((errorInfo && errorInfo.code) || "");
  if (code) {
    const byCode = (state.pipeline || []).findIndex(step => String((step && step.code) || "") === code);
    if (byCode >= 0) return byCode;
  }
  return -1;
}

async function attemptRunnerAutoRecovery(errorInfo) {
  const stepIdx = resolveRunnerRecoveryStepIndex(errorInfo || {});
  if (Number.isInteger(stepIdx) && stepIdx >= 0 && state.pipeline[stepIdx]) {
    const originalStep = state.pipeline[stepIdx];
    const adaptedStep = typeof adaptPipelineForRun === "function"
      ? (adaptPipelineForRun([originalStep]) || [originalStep])[0]
      : originalStep;
    if (adaptedStep && adaptedStep.code && adaptedStep.code !== originalStep.code) {
      state.pipeline[stepIdx] = { ...originalStep, code: adaptedStep.code, adaptedForRun: true };
    }
  }

  if (!state.pipeline || !state.pipeline.length) {
    throw new Error("자동 복구할 스킬이 없습니다.");
  }

  if (typeof adaptPipelineForRun === "function") {
    state.pipeline = adaptPipelineForRun(state.pipeline || []);
  }
  ensurePipelineStepIds();
  renderPipeline();
  if (typeof renderRunnerWorkflow === "function") renderRunnerWorkflow();

  clearRunnerPipelineError();
  if (window.runnerSetRunning) window.runnerSetRunning(true);
  clearPipelineExecutionMemory({ keepViewer: true });
  try {
    await runPipelineWithAutoRepair({ source: "runner-recovery" });
    toast("자동 복구 후 실행을 완료했습니다.", "success");
    if (window.runnerSetDone) window.runnerSetDone();
  } catch (err) {
    renderExcelViewer();
    if (window.runnerSetRunning) window.runnerSetRunning(false);
    throw err;
  }
}

function clearRunnerPipelineError() {
  const panel = document.getElementById("runner-error-panel");
  if (!panel) return;
  panel.hidden = true;
  panel.innerHTML = "";
}

function showRunnerPipelineError(err, options) {
  options = options || {};
  const panel = document.getElementById("runner-error-panel");
  if (!panel) return;
  const fallbackInfo = (typeof state !== "undefined" && state.lastError) ? state.lastError : null;
  const info = (err && err._stepInfo) || (err && err.errorInfo) || fallbackInfo || null;
  const hasStep = info && Number(info.stepIdx) >= 0;
  const title = hasStep ? "스킬을 적용하지 못했습니다" : "스킬 실행 중 오류가 발생했습니다";
  const stepText = hasStep
    ? `Step ${Number(info.stepIdx) + 1}${info.description ? ` · ${info.description}` : ""}`
    : "실행기 또는 백엔드 실행 단계";
  const message = (info && info.message) || (err && err.message) || String(err || "");
  const stack = (info && info.stack) || (err && err.stack) || "";
  panel.hidden = false;
  panel.innerHTML = `
    <div class="runner-error-title">
      <span>${escapeHtml(title)}</span>
      <span>확인 필요</span>
    </div>
    <div class="runner-error-step">${escapeHtml(stepText)}</div>
    <div class="runner-error-help">입력 파일명, 시트명, 선택 범위 또는 불러온 스킬의 대상이 현재 파일과 맞는지 확인하세요. 복구 버튼은 현재 파일 구조에 맞게 스킬 참조를 보정한 뒤 다시 실행합니다.</div>
    <textarea class="runner-error-note" rows="2" placeholder="(선택) 하려던 작업·실제 결과·기대 결과를 적으면 LLM 복구가 더 정확해집니다. 적으면 자동 보정 대신 이 설명을 최우선으로 복구합니다."></textarea>
    <div class="runner-error-actions">
      <button class="runner-error-recover" type="button">에러 복구 시도</button>
      <button class="runner-error-open-generator" type="button">생성기에서 보기</button>
    </div>
    <details class="runner-error-details" open>
      <summary>상세 오류 보기</summary>
      <pre>${escapeHtml(message)}${stack ? "\n\n" + escapeHtml(stack) : ""}</pre>
    </details>
  `;
  const recoverBtn = panel.querySelector(".runner-error-recover");
  if (recoverBtn) {
    const runnerStepIdx = resolveRunnerRecoveryStepIndex(info || {});
    const canAutoRecover = Number.isInteger(runnerStepIdx) && runnerStepIdx >= 0 && !!state.pipeline[runnerStepIdx];
    // 복구 버튼은 항상 활성화한다(사용자 요구). 자동 복구 불가하면 LLM 복구 요청으로 폴백.
    recoverBtn.disabled = false;
    recoverBtn.onclick = async () => {
      recoverBtn.disabled = true;
      const originalText = recoverBtn.textContent;
      recoverBtn.textContent = "자동 복구 중...";
      try {
        const recoverNote = ((panel.querySelector(".runner-error-note") || {}).value || "").trim();
        const recoveryInfo = {
          stepIdx: info && info.stepIdx,
          stepId: info && info.stepId || null,
          description: info && info.description || "",
          code: info && info.code || "",
          language: info && info.language || "",
          message,
          stack,
          compatibilityCheck: !!options.compatibilityCheck,
        };
        // 사용자가 추가 설명을 적었으면, 그 설명을 못 쓰는 자동 보정 대신 LLM 복구(대화+설명 반영)로 보낸다.
        if (canAutoRecover && !recoverNote) {
          recoverBtn.textContent = "자동 복구 중...";
          await attemptRunnerAutoRecovery(recoveryInfo);
        } else {
          recoverBtn.textContent = "복구 요청 중...";
          await requestErrorRecovery(info && info.stepIdx, recoveryInfo, recoverNote);
        }
      } catch (recoverErr) {
        reportPipelineError(recoverErr, { compatibilityCheck: true, runner: true });
      } finally {
        recoverBtn.textContent = originalText;
        recoverBtn.disabled = false;
      }
    };
  }
  const openBtn = panel.querySelector(".runner-error-open-generator");
  if (openBtn) openBtn.onclick = () => { if (typeof setPage === "function") setPage("generator"); };
}

$("runner-run-btn").onclick = () => {
  if ($("runner-run-btn").disabled) return;
  clearRunnerPipelineError();
  if (window.runnerSetRunning) window.runnerSetRunning(true);
  // Give the UI a tick to paint the ring, then execute
  setTimeout(async () => {
    try {
      clearPipelineExecutionMemory({ keepViewer: true });
      await runPipelineWithAutoRepair({ source: "runner" });
      toast(`${state.pipeline.length}개 단계 실행 완료`, "success");
      if (window.runnerSetDone) window.runnerSetDone();
    } catch (err) {
      renderExcelViewer();
      reportPipelineError(err, { compatibilityCheck: true, runner: true });
      if (window.runnerSetRunning) window.runnerSetRunning(false);
    }
  }, 650);
};
$("runner-download-btn").onclick = () => {
  if (typeof downloadAllFilesZip === "function") downloadAllFilesZip($("runner-download-btn"));
  else openDownloadModal();
};
$("runner-load-btn").onclick = () => openLoadDialog();
$("runner-open-generator").onclick = () => setPage("generator");

setupDrop($("drop-logic"), $("logic-files"), async (files) => {
  try {
    await loadLogicFiles(files);
  } catch (err) {
    toast("불러오기 실패: " + err.message, "error");
    console.error(err);
  }
});
