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
  next.trustedStatic = next.trustedStatic === true;
  return next;
}

function pipelineUnique(values) {
  const out = [];
  (values || []).forEach(value => {
    const text = String(value || "").trim();
    if (text && !out.includes(text)) out.push(text);
  });
  return out;
}

function pipelineExactSheetNamesFromText(text) {
  const source = String(text || "");
  const names = [];
  const add = value => {
    const text = String(value || "").trim();
    if (text && !names.includes(text)) names.push(text);
  };
  let m;
  const rangeMention = /@(?:범위|컬럼)\s*\[[^\]\r\n/]+\/([^!\]\r\n]+)![^\]\r\n]*\]/g;
  while ((m = rangeMention.exec(source))) add(m[1]);
  const sheetMention = /@시트\s*\[[^\]\r\n/]+\/([^\]\r\n]+)\]/g;
  while ((m = sheetMention.exec(source))) add(m[1]);
  const exactSheet = /(?:정확\s*시트명|시트명)\s*[:：]\s*["“]?([^"\r\n”]+)["”]?/g;
  while ((m = exactSheet.exec(source))) add(m[1]);
  return names;
}

function pipelineCurrentSheetNameForFileId(fileId) {
  const fid = fileId || state.currentFileId;
  if (!fid || fid !== state.currentFileId || !state.currentSheet) return null;
  const file = typeof getFile === "function" ? getFile(fid) : null;
  const names = file && (file.sheetNames || Object.keys(file.sheets || {}));
  return !names || names.includes(state.currentSheet) ? state.currentSheet : null;
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

function getPipelineResumeFromIndex() {
  if (window.__pipelineResumeFromIndex === null || window.__pipelineResumeFromIndex === undefined) return null;
  const n = Number(window.__pipelineResumeFromIndex);
  if (!Number.isInteger(n) || n < 0) return null;
  if (!Array.isArray(state.pipeline) || n >= state.pipeline.length) {
    window.__pipelineResumeFromIndex = null;
    return null;
  }
  return n;
}

function setPipelineResumeFromIndex(idx) {
  const n = Number(idx);
  window.__pipelineResumeFromIndex = Number.isInteger(n) && n >= 0 && n < (state.pipeline || []).length
    ? n
    : null;
}

function clearPipelineResumeFromIndex() {
  window.__pipelineResumeFromIndex = null;
}

function pipelineExecutionStartIndex() {
  const n = getPipelineResumeFromIndex();
  return Number.isInteger(n) ? n : 0;
}

function getPipelineExecutionStepIds() {
  const start = pipelineExecutionStartIndex();
  return (state.pipeline || [])
    .filter((step, idx) => idx >= start && isStepEnabled(step))
    .map(step => step && step.id)
    .filter(Boolean);
}

function markPipelinePendingFromIndex(startIdx, options = {}) {
  const n = Math.max(0, Number(startIdx) | 0);
  const steps = state.pipeline || [];
  const appliedIds = steps.slice(0, n).filter(isStepEnabled).map(s => s && s.id).filter(Boolean);
  const pendingIds = steps.slice(n).map(s => s && s.id).filter(Boolean);
  if (appliedIds.length) setPipelineRuntimeStatus(appliedIds, "applied", "적용됨");
  if (pendingIds.length) setPipelineRuntimeStatus(pendingIds, "review", options.label || "보류");
  if (pendingIds.length) setPipelineResumeFromIndex(n);
  else clearPipelineResumeFromIndex();
  refreshRunButton();
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

// [\uC2A4\uD0AC \uC218\uC815 \uC7AC\uBC14\uC778\uB529] '\uAC19\uC740 \uD15C\uD50C\uB9BF, \uB2E4\uB978 \uC6D4/\uB0A0\uC9DC/\uBC84\uC804' \uD30C\uC77C\uBA85\uC744 \uAC19\uAC8C \uBCF4\uB294 \uC548\uC815 \uD0A4 \u2014
// \uBC31\uC5D4\uB4DC serve_b2b.py \uC758 _VOLATILE_NAME_TOKENS/_stable_workbook_key \uC640 \uBC18\uB4DC\uC2DC \uB3D9\uC77C \uADDC\uCE59 \uC720\uC9C0(\uBE44\uB300\uCE6D\uC774 \uACE7 \uBC84\uADF8).
// 6\uC6D4(2606) \uD30C\uC77C\uB85C \uC800\uC7A5\uD55C \uC2A4\uD0AC\uC744 7\uC6D4(2607) \uD30C\uC77C\uB9CC \uC62C\uB824 '\uC218\uC815'\uD558\uBA74, \uAE30\uC874 3\uB2E8(\uC815\uD655/\uC815\uADDC\uD654/\uC5B4\uAC04) \uB9E4\uCE6D\uC774
// \uC804\uBD80 \uC2E4\uD328\uD574 \uB300\uC0C1\uC774 \uD604\uC7AC \uD0ED\uC73C\uB85C \uD3F4\uBC31\uB410\uACE0, \uB2E4\uD30C\uC77C \uC2A4\uD0AC\uC740 \uACA9\uB9AC \uC2E4\uD589\uC5D0 \uB098\uBA38\uC9C0 \uD30C\uC77C\uC774 \uC544\uC608 \uC548 \uC5F4\uB824
// "\uC6CC\uD06C\uBD81\uC774 \uC5F4\uB824 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4"\uB85C \uD130\uC84C\uB2E4(\uD55C\uC804 Step11\u00B72606\u21922607 \uC81C\uBCF4\uC758 \uACF5\uD1B5 \uBFCC\uB9AC).
const PIPELINE_VOLATILE_NAME_TOKENS = [
  // \uAD6C\uBD84\uC790 \uC788\uB294 \uB0A0\uC9DC\uB9CC(2026-03-01). \uAD6C\uBD84\uC790 \uC5C6\uB294 20260301\u00B7202606\u00B7260607 \uC740 \uC544\uB798 '\uB0A0\uC9DC \uBAA8\uC591' \uD1A0\uD070\uC774 \uB2F4\uB2F9.
  // \uC608\uC804\uC5D4 \uAD6C\uBD84\uC790\uAC00 \uC120\uD0DD\uC774\uB77C \uC784\uC758\uC758 6~8\uC790\uB9AC \uC22B\uC790(\uAC70\uB798\uCC98\uCF54\uB4DC 500255 = "5002"+"5"+"5")\uAE4C\uC9C0 \uB0A0\uC9DC\uB85C \uBA39\uC5C8\uB2E4.
  [/(?<!\d)(\d{4})[-_.\s]+(\d{1,2})[-_.\s]+(\d{1,2})\s*\uC77C?(?!\d)/g,
    (m, y, mm, dd) => (pipelineLooksLikeYmd(y, mm, dd) ? " " : m)],
  [/\d{2,4}\s*\uB144/g, " "],                                          // 2026\uB144 / 26\uB144
  [/\d{1,2}\s*\uC6D4/g, " "],                                          // 3\uC6D4 / 03\uC6D4
  [/\d{1,2}\s*\uBD84\uAE30/g, " "],                                        // 1\uBD84\uAE30
  [/(?<![A-Za-z0-9])v?\d+(?:\.\d+)+/gi, " "],                      // \uBC84\uC804 1.2 / v1.2.3
  // \uC2DC\uAC01(10_55_33) \u2014 \uC2E4\uC81C \uBC30\uD3EC \uD30C\uC77C\uBA85 "..._2026-07-14 10_55_33_DSMC_..." \uB54C\uBB38\uC5D0 \uD544\uC694.
  // \uC608\uC804\uC5D4 \uC544\uB798 \uC21C\uBC88 \uD1A0\uD070\uC774 \uC774\uB984 \uC911\uAC04 1~3\uC790\uB9AC\uB97C \uB2E5\uCE58\uB294 \uB300\uB85C \uC9C0\uC6CC '\uC6B0\uC5F0\uD788' \uC2DC\uAC01\uB3C4 \uC9C0\uC6E0\uB294\uB370,
  // \uADF8 \uBD80\uC791\uC6A9\uC73C\uB85C \uC9C0\uC810\uBC88\uD638 \uAC19\uC740 \uC2DD\uBCC4\uC790\uAE4C\uC9C0 \uC0AC\uB77C\uC84C\uB2E4 \u2192 \uC2DC\uAC01\uC740 \uC2DC\uAC01\uC73C\uB85C \uC815\uD655\uD788 \uC9C0\uC6B4\uB2E4.
  [/(?<!\d)(\d{1,2})[:_.\-](\d{1,2})[:_.\-](\d{1,2})(?!\d)/g,
    (m, h, mi, s) => (pipelineLooksLikeHms(h, mi, s) ? " " : m)],
  // \uC55E\uBA38\uB9AC \uC21C\uBC88 "03." "05." \u2014 \uC774\uB984 '\uC911\uAC04' \uBC88\uD638(\uC9C0\uC810 105 \uACB0\uC0B0)\uB294 \uC2DD\uBCC4\uC790\uB77C \uBCF4\uC874.
  [/^\d{1,3}(?=\s*[.\s_\-])/g, " "],
  // \uB0A0\uC9DC \uBAA8\uC591(YYMMDD/YYYYMM/YYYYMMDD)\uC77C \uB54C\uB9CC \uC81C\uAC70 \u2014 \uAC70\uB798\uCC98\uCF54\uB4DC\u00B7\uACC4\uC57D\uBC88\uD638 \uBCF4\uC874.
  [/(?<!\d)(?:\d{8}|\d{6})(?!\d)/g, m => (pipelineLooksLikeDateNumber(m) ? " " : m)],
];

// \uC811\uBBF8\uC0AC\uB294 \uC11C\uB85C \uC870\uD569\uB41C\uB2E4("X (2) - \uBCF5\uC0AC\uBCF8") \u2192 \uACE0\uC815\uC810\uAE4C\uC9C0 \uBC18\uBCF5 \uC801\uC6A9(\uBC31\uC5D4\uB4DC _VOLATILE_SUFFIX_TOKENS \uC640 \uD328\uB9AC\uD2F0).
const PIPELINE_VOLATILE_SUFFIX_TOKENS = [
  // \uBE0C\uB77C\uC6B0\uC800 \uC911\uBCF5 \uB2E4\uC6B4\uB85C\uB4DC "(2)" \uB294 \uD56D\uC0C1 \uAD6C\uBD84\uC790 \uB4A4 \u2192 \uAD6C\uBD84\uC790 \uC694\uAD6C(\uC758\uBBF8 \uC788\uB294 "\uBA85\uC138\uC11C(2)" \uB294 \uBCF4\uC874).
  [/[\s_\-]+\(\s*\d{1,3}\s*\)\s*$/g, " "],
  // "- \uBCF5\uC0AC\uBCF8" / " - Copy" \u2014 \uAD6C\uBD84\uC790 \uC694\uAD6C(\uC88C\uCE21 \uACBD\uACC4 \uC5C6\uC73C\uBA74 'hardcopy' \u2192 'hard' \uB85C \uD0A4 \uCDA9\uB3CC).
  [/[-_\s]+(?:\uBCF5\uC0AC\uBCF8|copy)\s*$/gi, " "],
];

function pipelineLooksLikeHms(h, mi, s) {
  const hh = Number(h), mm = Number(mi), ss = Number(s);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59 && ss >= 0 && ss <= 59;
}
function pipelineLooksLikeYmd(y, mm, dd) {
  const year = Number(y), month = Number(mm), day = Number(dd);
  return year >= 1900 && year <= 2199 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}
function pipelineLooksLikeDateNumber(digits) {
  const ok = (mm, dd) => mm >= 1 && mm <= 12 && (dd == null || (dd >= 1 && dd <= 31));
  if (digits.length === 6) {
    if (ok(Number(digits.slice(2, 4)), Number(digits.slice(4, 6)))) return true;   // YYMMDD
    const y = Number(digits.slice(0, 4));                                          // YYYYMM
    return y >= 1900 && y <= 2199 && ok(Number(digits.slice(4, 6)), null);
  }
  if (digits.length === 8) {
    const y = Number(digits.slice(0, 4));                                          // YYYYMMDD
    return y >= 1900 && y <= 2199 && ok(Number(digits.slice(4, 6)), Number(digits.slice(6, 8)));
  }
  return false;
}
function pipelineStableWorkbookKey(value) {
  let s = pipelineDecodeWorkbookName(value).trim();
  s = s.replace(/\.[^.]+$/, "");                                                   // \uD655\uC7A5\uC790 \uC81C\uAC70
  s = s.replace(/^(?:[0-9a-f]{12,}|excel_open_[0-9a-f]{12,}|live_reset_[0-9a-f]{12,})[_-]+/i, ""); // \uC0DD\uC131 \uC811\uB450 \uD574\uC2DC
  s = s.toLowerCase();
  s = s.replace(/[​-‍﻿]/g, "");  // zero-width — 2·3단(pipelineWorkbookNameKey)과 정규화 일치
  for (const [rx, rep] of PIPELINE_VOLATILE_NAME_TOKENS) s = s.replace(rx, rep);
  for (let i = 0; i < 4; i++) {                 // 접미사 조합("X (2) - 복사본")까지 흡수
    const prev = s;
    for (const [rx, rep] of PIPELINE_VOLATILE_SUFFIX_TOKENS) s = s.replace(rx, rep);
    if (s === prev) break;
  }
  return s.replace(/[\s_\-().\[\]]+/g, "");
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
  const byStem = pickUnique(files.filter(item =>
    pipelineWorkbookNameKey(item.name, { stem: true }) === stem ||
    pipelineWorkbookNameKey(item.displayName, { stem: true }) === stem));
  if (byStem) return byStem;
  // [스킬 수정 재바인딩] 4단계: 월·날짜·버전 무시 안정키 — '유일' 일치일 때만(모호하면 null 유지).
  // 백엔드 _match_workbook_by_stable_key 와 동일 가드: 키가 너무 짧으면(<4) 매칭 금지.
  const stable = pipelineStableWorkbookKey(wanted);
  if (!stable || stable.length < 4) return null;
  return pickUnique(files.filter(item =>
    pipelineStableWorkbookKey(item.name) === stable ||
    pipelineStableWorkbookKey(item.displayName) === stable));
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

// VBA 문자열 변수 맵: `x = "A.xlsx"` / `Dim x As String: x = "A.xlsx"` / `Const x = "A.xlsx"`.
// LLM 이 VBA 에서 압도적으로 쓰는 관용구가 이것이다:
//     Dim wbDstName As String: wbDstName = "대상.xlsx"
//     For Each wb In Application.Workbooks
//         If wb.Name = wbDstName Then Set wbDst = wb: Exit For
// 리터럴만 보던 정규식은 이 형태에서 대상 추론이 통째로 실패했다. 단일 워크북 폴백이 답을
// 맞춰줘서 안 보였을 뿐이고, 폴백이 안 듣는 '파일 2개 이상'(=교차파일 스킬)이 정확히
// 버그가 터지는 조건이다.
function pipelineVbaStringVars(code) {
  const vars = new Map();
  const lines = String(code || "").split(/\r?\n/);
  // `If ... Then` 안의 `=` 는 비교지 대입이 아니다 — 대입으로 오인하면 안 된다.
  const isCompare = line => /(?:^|[\s:])(?:if|elseif|#if|while|until)\b/i.test(line) || /\bthen\b/i.test(line);
  const assign = /(?:^|:)\s*(?:Const\s+)?([A-Za-z_]\w*)\s*=\s*"([^"\r\n]+)"\s*(?::|$)/i;
  const dimAssign = /^\s*(?:Dim|Const)\s+([A-Za-z_]\w*)\s+As\s+\w+\s*:\s*\1\s*=\s*"([^"\r\n]+)"/i;
  for (const line of lines) {
    if (isCompare(line)) continue;
    let mm = dimAssign.exec(line);
    if (mm) { vars.set(mm[1].toLowerCase(), mm[2]); continue; }
    mm = assign.exec(line);
    if (mm) vars.set(mm[1].toLowerCase(), mm[2]);
  }
  return vars;
}

function pipelineVbaTargetWorkbookNames(code) {
  const text = String(code || "");
  const names = [];
  const add = value => { if (value && !names.includes(value)) names.push(value); };
  const isTargetVar = name => /(?:dst|dest|target|tgt|out|output)$/i.test(String(name || ""));
  const strVars = pipelineVbaStringVars(text);
  // 리터럴이면 그대로, 변수면 문자열 맵에서 해석.
  const lit = tok => {
    const s = String(tok || "").trim();
    const q = /^"([^"]+)"$/.exec(s);
    if (q) return q[1];
    return strVars.get(s.toLowerCase()) || "";
  };
  let m;
  const directSet = /Set\s+([A-Za-z_]\w*)\s*=\s*(?:Application\.)?Workbooks\s*\(\s*("[^"]+"|[A-Za-z_]\w*)\s*\)/gi;
  while ((m = directSet.exec(text))) {
    if (isTargetVar(m[1])) add(lit(m[2]));
  }
  // `.Name = "리터럴"` 뿐 아니라 `.Name = wbDstName`(변수)도 받는다.
  const loopSet = /If\s+[^"\r\n]*?\.Name\s*=\s*("[^"]+"|[A-Za-z_]\w*)[\s\S]{0,260}?Set\s+([A-Za-z_]\w*)\s*=\s*wb\b/gi;
  while ((m = loopSet.exec(text))) {
    if (isTargetVar(m[2])) add(lit(m[1]));
  }
  const targetComment = /(?:대상|출력|붙여넣|목적지)[^\r\n]{0,80}(?:워크북|파일)[\s\S]{0,420}?\.Name\s*=\s*("[^"]+"|[A-Za-z_]\w*)/gi;
  while ((m = targetComment.exec(text))) add(lit(m[1]));
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

function inferPipelineStepTargetSheetName(step, options = {}) {
  if (!step) return null;
  const saved = String(step.targetSheetName || step.targetSheet || "").trim();
  if (saved) return saved;
  const exact = pipelineUnique([
    ...pipelineExactSheetNamesFromText(step.prompt),
    ...pipelineExactSheetNamesFromText(step.description),
  ]);
  if (exact.length === 1) return exact[0];
  const codeSheets = pipelineUnique(pipelineTargetSheetNames(step));
  if (codeSheets.length === 1) return codeSheets[0];
  const fallbackFileId = options.fileId || inferPipelineStepTargetFileId(step);
  const code = String(step.code || "");
  if (/\b(?:ActiveWorkbook\s*\.\s*)?ActiveSheet\b/i.test(code)) {
    return pipelineCurrentSheetNameForFileId(fallbackFileId);
  }
  return null;
}

function bindPipelineStepTargetContext(step) {
  if (!step) return step;
  if (!step.targetFileId && state.currentFileId) step.targetFileId = state.currentFileId;
  if (!step.targetSheetName) {
    const sheet = inferPipelineStepTargetSheetName(step, { fileId: step.targetFileId }) ||
      pipelineCurrentSheetNameForFileId(step.targetFileId);
    if (sheet) step.targetSheetName = sheet;
  }
  return step;
}

// ctx 의 '읽기 전용' 메서드. 이외의 메서드 호출은 변형(쓰기/삭제/구조변경)으로 본다.
const PIPELINE_CTX_READER_METHODS = new Set(["read", "sheets", "used_range", "has_formulas", "formula_mask", "book"]);

// VAR = ctx.book("X" | 변수)  ->  { VAR: "X" }
// 파일명을 변수로 넘기는 형태(src_ctx = ctx.book(src_file))까지 푼다. LLM 은 파일이 둘 이상이
// 되는 순간 반드시 변수를 쓰므로(src_file/tgt_file), 리터럴만 보면 교차파일 스킬이 통째로
// 미탐이었다 — 대상 추론(inferPipelineStepTargetFileId)이 저장된 옛 targetFileId 를 그대로
// 믿어 '엉뚱한 파일에 실행'되고, crossWriteDestinationFileIds 도 비어 리셋이 목적지를 못 되돌린다
// (SBAGENT-171: 매핑 패널만 고치고 실행 경로는 리터럴 전용으로 남았던 반쪽 수정).
function pipelinePythonBookVarNames(code) {
  const text = String(code || "");
  const map = {};
  const vars = typeof pipelineConstStringVars === "function" ? pipelineConstStringVars(text) : {};
  let m;
  const re = /([A-Za-z_]\w*)\s*=\s*ctx\.book\s*\(\s*([^()\r\n]+?)\s*\)/g;
  while ((m = re.exec(text))) {
    const name = typeof pipelineResolvePyArg === "function" ? pipelineResolvePyArg(m[2], vars) : null;
    if (name) map[m[1]] = name;
  }
  return map;
}

// ctx.book("X") 로 가져온 다른 파일을 '변형'(delete_sheet/write/clear/...)하는 경우의 X 목록.
// 추론기가 ctx.book 을 무조건 읽기 소스로 봐서 변형 대상을 놓치는 것을 보완한다(시트삭제/교차파일 쓰기).
function pipelinePythonMutatedBookNames(code) {
  const text = String(code || "");
  if (!/ctx\.book\s*\(/.test(text)) return [];
  const names = [];
  const add = n => { if (n && !names.includes(n)) names.push(n); };
  let m;
  // (a) 직접 체이닝: ctx.book("X" | 변수).<method>(  — 인자가 변수여도 해석한다.
  const constVars = typeof pipelineConstStringVars === "function" ? pipelineConstStringVars(text) : {};
  const chain = /ctx\.book\s*\(\s*([^()\r\n]+?)\s*\)\s*\.\s*([A-Za-z_]\w*)\s*\(/g;
  while ((m = chain.exec(text))) {
    if (PIPELINE_CTX_READER_METHODS.has(m[2])) continue;
    const name = typeof pipelineResolvePyArg === "function" ? pipelineResolvePyArg(m[1], constVars) : null;
    if (name) add(name);
  }
  // (b) 변수 경유: VAR = ctx.book("X"); VAR.<method>(
  const vars = pipelinePythonBookVarNames(text);
  for (const v of Object.keys(vars)) {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("\\b" + esc + "\\s*\\.\\s*([A-Za-z_]\\w*)\\s*\\(", "g");
    while ((m = re.exec(text))) { if (!PIPELINE_CTX_READER_METHODS.has(m[1])) add(vars[v]); }
  }
  return names;
}

// 메인 ctx(=세션 워크북) 자체를 직접 변형하는가. ctx.book(...) 의 .book 은 읽기로 취급(제외).
function pipelineStepMutatesMainCtx(code) {
  const re = /\bctx\s*\.\s*([A-Za-z_]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(String(code || "")))) {
    if (!PIPELINE_CTX_READER_METHODS.has(m[1])) return true;
  }
  return false;
}

function inferPipelineStepTargetFileId(step) {
  if (!step) return null;
  // [교차파일 변형] ctx.book("X").<변형메서드>(...) 로 '다른 파일을 변형'하는 스텝은 X 가 실제 변형 대상이다.
  // 추론기가 ctx.book 을 무조건 읽기 소스로 봐 대상을 (보던 탭 등) 엉뚱하게 잡으면, 전체실행(격리)에서
  // 변형이 '버려지는 동반 복사본'에 적용돼 "적용됨"인데 반영 안 되는 버그가 난다(예: 시트 삭제가 안 됨).
  // 메인 ctx 를 직접 변형하지 않는 경우에 한해, 저장된(잘못될 수 있는) targetFileId 보다 우선해 X 로 복구한다.
  try {
    if (!pipelineStepMutatesMainCtx(step.code)) {
      for (const name of pipelinePythonMutatedBookNames(step.code)) {
        const fid = pipelineFileIdByWorkbookName(name);
        if (fid) return fid;
      }
    }
  } catch (_) {}
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
    if (!name) return;
    const nameKey = pipelineWorkbookNameKey(name);
    // [반쪽 수정 보완] 안정키(월·날짜 무시) 단계가 여기만 빠져 있었다. 실행 측은 안정키로 살아나
    // (백엔드 _resolve_open_workbook_name 이 옛 리터럴을 새 출력에 재바인딩) 쓰기는 성공하는데,
    // 리셋 대상 계산만 옛 이름 기준이라 토글 OFF/삭제가 출력에 안 먹고 재실행 시 중복 기록됐다.
    // (6월 스킬의 Workbooks("출력_202606.xlsx") ↔ 7월 템플릿 "출력_202607.xlsx")
    const stableKey = typeof pipelineStableWorkbookKey === "function" ? pipelineStableWorkbookKey(name) : "";
    const refs = pipelineCollectWorkbookNames(text);
    const hit = text.includes(name)
      || refs.some(ref => pipelineWorkbookNameKey(ref) === nameKey)
      || (stableKey.length >= 4 && refs.some(ref => pipelineStableWorkbookKey(ref) === stableKey));
    if (hit) ids.push(typeof outputTemplateFileId === "function" ? outputTemplateFileId(idx) : "output:" + idx);
  });
  return ids;
}

// 교차파일 '쓰기 대상' 파일 id — ctx.copy_sheet(..., dst_book="X.xlsx") / paste_copied(..., dst_book="X.xlsx").
// crossOutputFileIdsReferencedInCode 는 '출력 템플릿'만 잡지만, 시트를 '입력 파일'로 복사하는 경우엔
// 그 입력 파일도 리셋 대상이어야 한다(안 그러면 스텝 삭제 후에도 붙여넣은 시트가 안 지워진다).
// pipelineFileIdByWorkbookName 으로 입력·출력 모두에서 이름을 fileId 로 해석한다.
// 주석/독스트링 안의 dst_book 리터럴까지 매칭하면, 실제로는 아무것도 안 쓰는 스텝이 '교차'로
// 오판돼 토글마다 전체 pristine 리셋+재적용을 타고(대형 파이프라인에서 수 배 느려짐) 파이프라인
// 밖에서 만든 상태까지 날아간다. 코드 문맥만 남긴다(문자열 리터럴은 dst_book 값 자체라 보존).
function pipelineStripCodeComments(code) {
  return String(code || "")
    .replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, " ")   // python 독스트링
    .replace(/^\s*#.*$/gm, " ")                        // python 주석
    .replace(/^\s*'.*$/gm, " ")                        // VBA 주석
    .replace(/\/\*[\s\S]*?\*\//g, " ");                // 블록 주석
}

function crossWriteDestinationFileIds(code, options = {}) {
  const text = pipelineStripCodeComments(code);
  if (!text) return [];
  const ids = [];
  const seen = new Set();
  // 스텝 자신의 대상 파일은 '교차'가 아니다(같은 파일 복사에 dst_book 을 명시하는 복붙 캡처 스텝이
  // 전부 교차로 오판돼, 빠른 토글/삭제 경로를 통째로 잃었다).
  const selfFileId = options.selfFileId || null;
  const addName = name => {
    const fid = typeof pipelineFileIdByWorkbookName === "function" ? pipelineFileIdByWorkbookName(name) : null;
    if (!fid || fid === selfFileId || seen.has(fid)) return;
    seen.add(fid);
    ids.push(fid);
  };
  const vars = typeof pipelineConstStringVars === "function" ? pipelineConstStringVars(text) : {};
  const addToken = token => {
    const resolved = typeof pipelineResolvePyArg === "function" ? pipelineResolvePyArg(token, vars) : null;
    if (resolved) addName(resolved);
  };
  let m;
  // dst_book="X.xlsx" 뿐 아니라 변수 전달(dst = "매출.xlsx"; ..., dst_book=dst)도 해석한다.
  // [괄호/공백 파일명 수정] 따옴표 문자열을 '우선' 통째로 매칭해야 한다 — bare 토큰 패턴만 쓰면
  // 파일명에 괄호·공백이 있을 때(실측: "output)_LG_CNS_..." 처럼 ')' 포함) 토큰이 중간에서 잘려
  // 교차 쓰기 인식이 실패했고, 그러면 삽입/토글의 빠른경로 가드와 리셋 집합에서 출력 파일이 빠져
  // copy_sheet 재실행 때 시트가 중복으로 쌓였다.
  const reDst = /dst_book\s*=\s*("[^"]*"|'[^']*'|[^,()\s]+)/gi;
  while ((m = reDst.exec(text))) addToken(m[1]);
  // ctx.book("X.xlsx").write(...) 류 — 정식 지원하는 교차 쓰기 방언인데 여기 연결이 빠져 있었다.
  // (스텝이 주 ctx 도 함께 변형하면 대상 추론이 A 를 반환해 B 가 어디에서도 리셋되지 않았다.)
  if (typeof pipelinePythonMutatedBookNames === "function") {
    pipelinePythonMutatedBookNames(text).forEach(addName);
  }
  return ids;
}

// 이 스텝이 '다른 파일에 쓰는' 교차파일 스텝인가(dst_book 대상이 알려진 파일로 해석되면).
// 빠른(마지막 스텝) 삭제 스냅샷 복구는 대상 파일만 되돌려 교차 목적지를 놓치므로, 이런 스텝은
// 전체 reconcile(목적지까지 리셋)로 보낸다.
function pipelineStepWritesCrossFile(step) {
  // 자기 대상 파일에 쓰는 건 교차가 아니다 — 대상 추론이 되면 그 파일은 제외하고 판단한다.
  const selfFileId = (step && step.targetFileId)
    || (typeof inferPipelineStepTargetFileId === "function" ? inferPipelineStepTargetFileId(step) : null);
  return crossWriteDestinationFileIds((step && step.code) || "", { selfFileId }).length > 0;
}

// 체크포인트 빠른경로는 startIdx '이후 전 스텝'을 되돌린다. 그런데 스텝별 _preApplySnapshot 은
// 그 스텝의 '대상 세션'만 캡처돼 교차 목적지 스냅샷은 어디에도 없다.
// 그래서 조작한 스텝이 교차가 아니어도, 되돌려지는 suffix 안에 교차 스텝이 하나라도 있으면
// 목적지가 더러운 채 남는다(UI=보류인데 라이브=적용됨, 재실행 시 '원가 (2)' 중복).
// → suffix 전체를 보고 하나라도 교차면 빠른경로를 포기하고 전체 reconcile 로 보낸다.
function pipelineSuffixWritesCrossFile(steps, startIdx) {
  const list = steps || state.pipeline || [];
  return list.slice(Math.max(0, startIdx)).some(s => s && s.code && pipelineStepWritesCrossFile(s));
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
  const targetSheetName = inferPipelineStepTargetSheetName(step, { fileId: step && step.targetFileId });
  return {
    stepIdx,
    stepId: step && step.id || null,
    id: step && step.id || null,
    description: step && step.description || "",
    code: step && step.code || "",
    language: (step && (step.language || inferPipelineStepLanguage(step))) || "vba",
    targetFileId: step && step.targetFileId || null,
    targetSheetName: targetSheetName || null,
    trustedStatic: step && step.trustedStatic === true,
    // VBA→Python 복구/강제 대용량 스텝 → 백엔드가 정적검사 우회 + 데드라인 확장으로 완주(다시 VBA 로 안 튕김).
    extendedTimeout: step && step.extendedTimeout === true,
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

// 스킬이 참조하는 '모든' 파일의 fileId — 쓰기 대상 + 교차 출력 + '읽기 소스'(교차파일)까지.
// 교차파일 스텝(예: 한전의 05_DAS 를 읽어 DAS 에 쓰기)의 '읽기 소스'는 기존 라우팅/리셋 계산이 안 잡는다
// (crossOutput 은 출력만, target 추론은 쓰기 대상만). 격리 실행은 이 파일들이 '열린 라이브 세션'이어야
// companion 으로 떠 읽을 수 있으므로, 실행 전에 전부 모아 세션을 강제로 연다(느린 PC preopen 레이스 방지).
function collectPipelineReferencedFileIds(steps = state.pipeline) {
  const ids = [];
  const add = fid => { if (fid && !ids.includes(fid)) ids.push(fid); };
  for (const step of activePipelineSteps(steps)) {
    if (!step || !step.code) continue;
    add(inferPipelineStepTargetFileId(step));                 // 쓰기 대상
    try { crossOutputFileIdsReferencedInCode(step.code).forEach(add); } catch (_) {}  // 교차 출력
    // 읽기 소스(교차파일): VBA Workbooks("X")/일반 파일명 언급 + Python ctx.book("X") → fileId 로 변환
    try {
      const names = [];
      (pipelineCollectWorkbookNames(step.code) || []).forEach(n => names.push(n));
      (pipelinePythonSourceWorkbookNames(step.code) || []).forEach(n => names.push(n));
      for (const nm of names) add(pipelineFileIdByWorkbookName(nm));
    } catch (_) {}
  }
  // 실재하는 파일만(추론 실패/모호 이름은 null → 제외).
  return ids.filter(fid => typeof getFile !== "function" || getFile(fid));
}

// 실행 전에 참조 파일 세션을 '전부 열고 대기'한다(읽기 소스는 reset 없이 오픈만 — 동기 오픈이라 완료 보장).
// 이게 없으면 백그라운드 preopen 미완료인 느린 PC 에서 companion 부재로 "시트 못찾음"이 비결정 발생.
async function ensurePipelineReferencedSessionsOpen(steps = state.pipeline) {
  for (const fid of collectPipelineReferencedFileIds(steps)) {
    try { await excelIdForPipelineFileId(fid); } catch (_) {}
  }
}

// [0.5.14 빠른복구] 백엔드가 격리 batch 에서 스텝 실행 '전' 상태를 SaveCopyAs 해 downloadId 로 돌려준다
// (성공=result.stepSnapshots, 실패=errorInfo.stepSnapshots). 이를 각 step._preApplySnapshot 에 '라이브
// 세션 excelId' 와 함께 wiring 하면 VBA/격리 경로도 13 처럼 (a) 마지막 단계 OFF/삭제 빠른복구, (b) 자동복구
// 후 '실패 step 직전'으로 되돌려 이어실행(restorePipelineCheckpointForSuffix)이 동작한다.
function wirePipelineStepSnapshots(stepSnapshots, excelId, sourceSteps) {
  if (!Array.isArray(stepSnapshots) || !stepSnapshots.length || !excelId) return;
  const allSteps = sourceSteps || state.pipeline || [];
  for (const snap of stepSnapshots) {
    if (!snap || !snap.downloadId) continue;
    let orig = Number.isInteger(snap.stepIdx) ? allSteps[snap.stepIdx] : null;
    if (snap.stepId && (!orig || orig.id !== snap.stepId)) {
      orig = allSteps.find(s => s && s.id === snap.stepId) || orig;
    }
    if (!orig) continue;
    const snapObj = {
      resultId: snap.downloadId,
      downloadUrl: snap.downloadUrl || "",
      name: snap.name || "",
      excelId: snap.excelId || excelId,   // 다파일 백그라운드 전체실행: 스냅샷별 세션 우선
      capturedAt: Date.now(),
    };
    orig._preApplySnapshot = snapObj;
    if (typeof syncStepPreApplySnapshot === "function") {
      syncStepPreApplySnapshot(orig, snapObj, Number.isInteger(snap.stepIdx) ? snap.stepIdx : null);
    }
  }
}

async function runIsolatedLivePipelineSteps(sourceSteps, initialExcelId, options = {}) {
  const _runPerfT0 = performance.now();  // [F8] 전체실행 소요 측정(디버그 패널 기록용)
  const startIndex = Number.isInteger(Number(options.startIndex)) ? Math.max(0, Number(options.startIndex)) : 0;
  // [이어실행 라벨] 중간 스텝 수정/토글로 startIndex 이후만 부분 재실행할 땐 오버레이를 '전체실행 중'이 아니라
  // '실행 중'으로 보여준다(부분 실행인데 '전체실행'으로 오해되는 것 방지).
  const _applyLoadingLabel = startIndex > 0 ? "스킬 실행 중..." : "스킬 전체실행 중...";
  const skipReset = options.skipReset === true;
  // [중단 승격 후 이중 재적용 방지] '작업 중단'이 강제 재시작으로 승격하면 이 복귀는 버려진다.
  // 그런데 promise 결과만 무시될 뿐 실행은 계속돼, await 경계에서 깨어나 세션을 새로 열고(없으면
  // ensureExcelMirrorForFileId 가 만든다) 남은 리셋/그룹을 마저 실행했다. 승격 쪽 자동재적용과
  // 같은 파일에 두 번 쓰는 경합(교차파일 중복 기록)의 원인 → 경계마다 스스로 중단한다.
  const _restoreEpoch = options.restoreEpoch;
  const _throwIfAbandoned = () => {
    if (_restoreEpoch == null) return;
    if (typeof window === "undefined" || window.__excelRestoreEpoch === _restoreEpoch) return;
    const err = new Error("중단 승격으로 이 복귀는 취소됐습니다");
    err.__abandonedRestore = true;
    throw err;
  };
  const activeSteps = activePipelineSteps(sourceSteps)
    .filter(step => (sourceSteps || state.pipeline || []).indexOf(step) >= startIndex)
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

  // [느린 PC 레이스 수정] 교차파일 스텝이 참조하는 '읽기 소스'(예: 한전의 05_DAS)는 기존 라우팅/리셋이
  // 안 잡아, 백그라운드 preopen 미완료인 느린 PC 에선 그 파일 세션이 없어 companion 이 안 떠 "시트 못찾음"이
  // 비결정 발생했다. 실행 전에 참조 파일 세션을 전부 동기로 열어 PC 속도와 무관하게 companion 을 보장한다.
  await ensurePipelineReferencedSessionsOpen(sourceSteps);

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
  let lastTouchedFileId = null;
  let lastTouchedExcelId = null;
  // [사용자 지시] Python 대용량(60만 행 등) 완주를 위해 클라 HTTP 타임아웃을 사실상 제거(30일). 백엔드도 무제한.
  const pipelineTimeoutMs = () => 2000000000;
  const pipelineTimeoutMessage = "스킬 파이프라인 실행 응답이 지연되어 중단했습니다. 저사양 PC에서는 백그라운드에서 계속 적용 중일 수 있으니 잠시 후 화면을 확인해 주세요.";
  try {
    // [0.5.15 백그라운드 전체실행] 전체실행 버튼이 backgroundMode:true 로 호출하면, 그룹별 spawn+동기화(N콜)
    // 대신 격리 인스턴스 1개에서 전 파일을 '원본'부터 처리하는 1콜로 보낸다(반복 spawn/sync = '멈춤' 주원인 제거).
    // skipReset(suffix 이어실행)·기타 경로는 기존 per-group 유지. 성공/실패 모두 아래 공용 정리(mute해제/로딩종료)로
    // fall-through (early-return 금지 — 그래야 정리·복원이 한 곳에서 일관 처리됨).
    const useBg = options.backgroundMode === true && !skipReset && groups.length > 0;
    if (useBg) {
      const bgGroups = [];
      for (const g of groups) {
        const exId = await requirePipelineSessionExcelId(g.fileId, "스킬 전체실행");
        bgGroups.push({ excelId: exId, steps: g.steps });
      }
      const resetExcelIds = [];
      const addReset = id => { if (id && !resetExcelIds.includes(id)) resetExcelIds.push(id); };
      bgGroups.forEach(g => addReset(g.excelId));
      for (const rid of explicitResetFileIds) {
        try { addReset(await requirePipelineSessionExcelId(rid, "워크북 리셋")); } catch (_) {}
      }
      const anchorExcelId = bgGroups[0].excelId;
      lastTouchedExcelId = anchorExcelId;            // 실패 시 외부 catch 가 이 세션으로 스냅샷 wiring/복원
      lastTouchedFileId = groups[0] ? groups[0].fileId : null;
      bgGroups.forEach(g => {
        if (!mutedExcelIds.includes(g.excelId) && typeof muteExcelMirrorForPipeline === "function") {
          muteExcelMirrorForPipeline(g.excelId); mutedExcelIds.push(g.excelId);
        }
      });
      if (!loadingStarted && typeof beginExcelMirrorApplyLoading === "function") {
        beginExcelMirrorApplyLoading(_applyLoadingLabel, { hideWindows: false, failsafeMs: 1800000 });
        loadingStarted = true;
      }
      const allStepIds = activeSteps.map(s => s && s.id).filter(Boolean);
      if (allStepIds.length) setPipelineRuntimeStatus(allStepIds, "running", "작업 중");
      const totalSteps = bgGroups.reduce((n, g) => n + g.steps.length, 0);
      // 진행률 폴링(anchor) — 1콜 전체에서 전역 current/total 로 매끄럽게 (그룹 경계 멈춤 없음)
      let _bgTimer = null;
      if (typeof fetch === "function") {
        try {
          _bgTimer = setInterval(() => {
            try {
              fetch("/api/excel/pipeline-progress?excelId=" + encodeURIComponent(anchorExcelId))
                .then(r => r.json())
                .then(pj => {
                  if (pj && typeof window !== "undefined" && typeof window.runnerSetProgress === "function") {
                    if (pj.phase === "syncing") {
                      // 최종 동기화(통째 시트 교체) 단계 — 저사양에선 수 분 걸린다. 'N/N'에서 멈춘 듯 안 보이게.
                      const st = pj.syncTotal ? (" (" + Math.min(pj.syncTotal, pj.syncCurrent || 0) + "/" + pj.syncTotal + ")") : "";
                      window.runnerSetProgress("결과 반영 중" + st + "...");
                    } else if (pj.total) {
                      window.runnerSetProgress(Math.min(pj.total, pj.current || 0) + "/" + pj.total + " 단계 실행 중...");
                    }
                  }
                }).catch(() => {});
            } catch (_) {}
          }, 800);
        } catch (_) {}
      }
      try {
        // [적용됨-미반영 수정] bg 1콜 시작 전 이전 실행의 스냅샷을 비운다 — 실패가 errorInfo 없이 끝나면
        // (타임아웃/네트워크/비스텝 500) 옛 실행의 stale 스냅샷으로 오복원되어 '적용됨' 거짓 표시가 났다.
        // 이번 실행의 스냅샷은 성공(stepSnapshots)/실패(errorInfo.stepSnapshots) 모두에서 새로 wiring 된다.
        (sourceSteps || state.pipeline || []).forEach(s => { if (s && s._preApplySnapshot) delete s._preApplySnapshot; });
        lastData = await postExcelMirror("/api/excel/run-full-pipeline", {
          groups: bgGroups,
          resetExcelIds,
          viewSheet: options.viewSheet || null,
          outputMode: options.outputMode || "sync",   // 실행기='file'(라이브 미반영+파일출력), 생성기='sync'
        }, 0, {
          // [저사양 거짓실패 방지] 백그라운드 전체실행은 1콜에 전 스텝 실행 + 스텝별 스냅샷 + 최종 동기화(통째 시트
          // 교체)까지 포함된다. 저사양 PC 에선 75스텝급이 10분(기존)을 훌쩍 넘겨, 'N/N' 후 동기화 중에 타임아웃으로
          // 거짓 실패했다. 스텝수 비례로 넉넉히(최소 30분, 스텝당 30초). 서버 excel_call(60분)보다는 작게 유지.
          timeoutMs: Math.min(3300000, Math.max(1800000, totalSteps * 30000)),
          timeoutMessage: pipelineTimeoutMessage,
        });
      } catch (bgErr) {
        // [적용됨-미반영 수정] bg 1콜 실패 = 백엔드가 라이브 동기화 '전에' raise → 라이브는 전 파일 무손상.
        // 복원/마킹 단계가 이 사실을 알고 '전 파일 복원 검증' 없이는 적용됨을 찍지 않도록 태깅한다.
        try { bgErr._liveUntouched = true; } catch (_) {}
        throw bgErr;
      } finally {
        if (_bgTimer) { try { clearInterval(_bgTimer); } catch (_) {} }
      }
      applied = (lastData && lastData.applied) || totalSteps;
      if (allStepIds.length) setPipelineRuntimeStatus(allStepIds, "applied", "적용됨");
      // 스텝-전 스냅샷 wiring(빠른복구/이어실행) — 다파일은 snap.excelId 로 정확히 매핑(없으면 anchor).
      if (lastData && Array.isArray(lastData.stepSnapshots)) {
        wirePipelineStepSnapshots(lastData.stepSnapshots, anchorExcelId, sourceSteps);
      }
      // 파일별 라이브 미러 캐시(시트명/미리보기) 갱신 (sync 모드 — file 모드는 perFileLiveSchema 비어있음)
      if (lastData && lastData.perFileLiveSchema) {
        for (const exId of Object.keys(lastData.perFileLiveSchema)) {
          try { applyLiveSchemaToFileCache(exId, lastData.perFileLiveSchema[exId]); } catch (_) {}
        }
      }
      // [실행기 파일출력] 결과 파일 목록을 기억(다운로드 버튼 연결) + 완료 안내. 라이브엔 미반영(뷰 없음).
      if (lastData && Array.isArray(lastData.outputFiles) && lastData.outputFiles.length) {
        try { window.lastRunnerOutputs = lastData.outputFiles; } catch (_) {}
        // [빠른 OFF/삭제] 스텝별 pre-apply 스냅샷을 보관해 둔다. '결과 편집하기'로 결과를 라이브에 불러온 뒤
        // 마지막 단계 OFF/삭제가 이 스냅샷으로 '재실행 없이' 즉시 되돌리게 재연결하기 위함(없으면 reconcile 재적용).
        try { window.lastRunnerStepSnapshots = Array.isArray(lastData.stepSnapshots) ? lastData.stepSnapshots : []; } catch (_) {}
        if (typeof window !== "undefined" && typeof window.runnerSetProgress === "function") {
          window.runnerSetProgress("완료 — 결과 " + lastData.outputFiles.length + "개 파일 저장됨 (다운로드 가능)");
        }
      }
    }
    if (!useBg && explicitResetFileIds.length) {
      for (const resetFileId of explicitResetFileIds) {
        _throwIfAbandoned();
        const resetExcelId = await requirePipelineSessionExcelId(resetFileId, "워크북 리셋");
        lastTouchedFileId = resetFileId;
        lastTouchedExcelId = resetExcelId;
        if (!mutedExcelIds.includes(resetExcelId) && typeof muteExcelMirrorForPipeline === "function") {
          muteExcelMirrorForPipeline(resetExcelId);
          mutedExcelIds.push(resetExcelId);
        }
        if (!loadingStarted && typeof beginExcelMirrorApplyLoading === "function") {
          beginExcelMirrorApplyLoading(_applyLoadingLabel, { hideWindows: false, failsafeMs: 330000 });
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
    for (const group of (useBg ? [] : groups)) {
      _throwIfAbandoned();
      const excelId = await requirePipelineSessionExcelId(group.fileId, "스킬 전체실행");
      lastTouchedFileId = group.fileId;
      lastTouchedExcelId = excelId;
      if (!mutedExcelIds.includes(excelId) && typeof muteExcelMirrorForPipeline === "function") {
        muteExcelMirrorForPipeline(excelId);
        mutedExcelIds.push(excelId);
      }
      if (!loadingStarted && typeof beginExcelMirrorApplyLoading === "function") {
        beginExcelMirrorApplyLoading(_applyLoadingLabel, { hideWindows: false, failsafeMs: 330000 });
        loadingStarted = true;
      }
      // [0.5.14 batch] 첫 그룹이면 reset:true 한 번. 백엔드가 격리 인스턴스를 pristine sourcePath 에서 열고
      // (라이브 현재상태와 무관) 그 위에서 이 그룹의 모든 스텝을 순서대로 실행 → 전체실행은 '항상 원본부터'.
      const needReset = !skipReset && !resetDone.has(group.fileId);
      const groupStepIds = group.steps.map(s => (s && s.stepId)).filter(Boolean);
      if (groupStepIds.length) setPipelineRuntimeStatus(groupStepIds, "running", "작업 중");
      // 실행 전 하드블록(저사양 멈춤 유발 패턴)만 클라에서 빠르게 거른다. (스냅샷은 batch 에선 스텝마다 못 뜬다 —
      // 전체실행은 항상 원본부터 1회 실행이라 복구=재실행이고, 실패한 스텝은 백엔드가 errorInfo 로 알려준다.)
      for (const stepPayload of group.steps) {
        const originalStep = Number.isInteger(stepPayload && stepPayload.stepIdx)
          ? ((sourceSteps || state.pipeline || [])[stepPayload.stepIdx] || null)
          : ((sourceSteps || state.pipeline || []).find(s => s && s.id === (stepPayload && stepPayload.stepId)) || null);
        const hardBlock = findPipelineRuntimeExecutionBlocker([originalStep || stepPayload]);
        if (hardBlock) {
          throw createPipelineRuntimeExecutionBlockError({
            ...hardBlock,
            idx: Number.isInteger(stepPayload && stepPayload.stepIdx) ? stepPayload.stepIdx : hardBlock.idx,
            step: originalStep || stepPayload,
          });
        }
      }
      // [0.5.14 batch] 그룹의 연속 스텝(혼합엔진 vba/python 포함)을 한 격리 인스턴스에서 순서대로 1콜에 실행.
      // 스텝당 격리 인스턴스를 새로 띄우던 기존 구조(N콜=N인스턴스, 저사양에서 수분+timeout N개)를 그룹당 1콜로.
      // [진행률] 배치는 백엔드 한 콜이라 클라가 per-step 을 직접 못 본다 → 백엔드가 PIPELINE_PROGRESS 에 현재
      // 스텝을 기록하고, 여기서 폴링해 실행기 UI 에 "N/총 단계 실행 중"만 표시한다(스킬명은 UI 깨짐 방지로 미표시).
      const _progressBase = applied;            // 이전 그룹까지 완료한 스텝 수(전역 누계용)
      const _progressTotal = activeSteps.length; // 전체 활성 스텝 수
      let _progressTimer = null;
      try {
        if (typeof fetch === "function") {
          _progressTimer = setInterval(() => {
            try {
              fetch("/api/excel/pipeline-progress?excelId=" + encodeURIComponent(excelId))
                .then(r => r.json())
                .then(pj => {
                  if (pj && pj.total && typeof window !== "undefined" && typeof window.runnerSetProgress === "function") {
                    const cur = Math.min(_progressTotal, _progressBase + (pj.current || 0));
                    window.runnerSetProgress(cur + "/" + _progressTotal + " 단계 실행 중...");
                  }
                })
                .catch(() => {});
            } catch (_) {}
          }, 800);
        }
      } catch (_) {}
      let data;
      try {
        data = await postExcelMirror("/api/excel/run-vba-pipeline", {
          excelId,
          steps: group.steps,
          reset: needReset,
          viewSheet: options.viewSheet || null,
        }, 0, {
          timeoutMs: Math.max(600000, pipelineTimeoutMs(group.steps.length)),
          timeoutMessage: pipelineTimeoutMessage,
        });
      } finally {
        if (_progressTimer) { try { clearInterval(_progressTimer); } catch (_) {} }
      }
      lastData = data;
      resetDone.add(group.fileId);
      applied += group.steps.length;
      if (groupStepIds.length) setPipelineRuntimeStatus(groupStepIds, "applied", "적용됨");
      if (data && data.liveSchema) {
        try { applyLiveSchemaToFileCache(excelId, data.liveSchema); } catch (_) {}
      }
      // [0.5.14 빠른복구] 성공한 그룹의 스텝-전 스냅샷을 각 step._preApplySnapshot 으로 wiring
      // (이 그룹의 라이브 세션 excelId 기준). → 마지막 단계 OFF/삭제 빠른복구.
      if (data && Array.isArray(data.stepSnapshots)) {
        wirePipelineStepSnapshots(data.stepSnapshots, excelId, sourceSteps);
      }
    }
    if (loadingStarted && typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
    if (typeof releaseExcelMirrorPipelineMute === "function") {
      mutedExcelIds.forEach(id => releaseExcelMirrorPipelineMute(id));
    }
    if (typeof scheduleRestoreActiveExcelMirror === "function") {
      scheduleRestoreActiveExcelMirror(180, {
        restoreExcelId: lastTouchedExcelId || initialExcelId || null,
        restoreFileId: lastTouchedFileId || null,
      });
    }
    // [#3] 실행기 파일출력(outputMode:"file")은 라이브를 안 건드린다(무손상) → '라이브 적용됨'으로 기록하면
    // 거짓 시그니처가 돼 이후 마지막 스텝 on/off fast-path 가 어긋난 baseline 에서 돌아 플레이키해진다(ON 안 먹힘/
    // 보류). 이 경우 라이브 적용 장부를 무효화 → 생성기에서의 토글/편집은 결정적 full reconcile 로 라이브에
    // 반영(또는 '최종 반영 보기' #2 버튼으로 명시 동기화). sync(생성기)는 기존대로 적용됨 기록.
    if (options && options.outputMode === "file") {
      if (typeof invalidateLivePipelineApplied === "function") invalidateLivePipelineApplied();
    } else {
      noteLivePipelineApplied(sourceSteps);
    }
    // [F8] 전체실행도 디버그 패널에 소요/단계수를 기록한다 — 기존엔 단일 적용만 기록돼 전체실행 시 F8 이 비어 보였다.
    try {
      const _elapsed = Math.round(performance.now() - _runPerfT0);
      recordVbaDebugTiming({
        action: (options && options.outputMode === "file") ? "runner-full-run" : "full-run",
        steps: applied,
        startRequestMs: _elapsed,
        totalClientMs: _elapsed,
        server: (lastData && lastData.debugTimings) || {},
      });
    } catch (_) {}
    const result = lastData || { ok: true, applied };
    if (result && typeof result === "object") {
      result.clientRestoreFileId = lastTouchedFileId || null;
      result.clientRestoreExcelId = lastTouchedExcelId || null;
    }
    return result;
  } catch (err) {
    // [0.5.14 자동복구 이어실행] 실패해도 백엔드가 errorInfo.stepSnapshots 로 '실패 step 직전까지'의 스냅샷을
    // 실어 보낸다. 던지기 전에 각 step._preApplySnapshot 에 wiring 해야 runPipelineWithAutoRepair 가 자동복구
    // 후 '실패 step 직전'으로 되돌려 이어실행할 수 있다(없으면 "스냅샷 없음"으로 중단).
    try {
      const einfo = err && (err.errorInfo || err._stepInfo);
      if (einfo && Array.isArray(einfo.stepSnapshots)) {
        wirePipelineStepSnapshots(einfo.stepSnapshots, lastTouchedExcelId || initialExcelId, sourceSteps);
      }
    } catch (_) {}
    if (loadingStarted && typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
    if (typeof releaseExcelMirrorPipelineMute === "function") {
      mutedExcelIds.forEach(id => releaseExcelMirrorPipelineMute(id));
    }
    if (lastTouchedExcelId || initialExcelId) {
      restoreVbaExcelAfterError(lastTouchedExcelId || initialExcelId, { restoreFileId: lastTouchedFileId || null });
    }
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
  // 교차파일 스텝(복붙 소스≠대상, 또는 ctx.book("X").<변형>으로 다른 파일을 변형)이 하나라도 있으면
  // 격리 파이프라인으로 돌린다. 라이브 경로는 (1) 소스 워크북을 직접 읽어 창 보호뷰가 풀리거나
  // (2) 스텝을 '보던 탭' 세션에서 돌려 정작 변형 대상 파일은 보호 해제가 안 돼 "보호된 시트" 오류가 난다.
  // 격리 경로는 각 스텝을 '변형 대상 파일' 세션(ftarget, 보호 해제됨)에서 돌리고 다른 파일은 throwaway
  // 복사본으로만 열므로 둘 다 해결된다.
  const hasCrossFileStep = activeSteps.some(s =>
    pipelineStepReadsOtherFile(s) || (pipelinePythonMutatedBookNames(s.code).length > 0));
  // [실행기 파일출력] outputMode:"file"(실행기 전체실행)은 라이브를 안 건드리고 결과 파일(outputFiles)을
  // 만들어야 한다. 그러나 이 함수는 hasVbaStep/교차파일일 때만 격리 배치(run_full_pipeline)로 위임하고,
  // 단일파일 Python 은 아래 라이브 순차 적용 루프(applyVbaStepToLiveExcel)로 빠져 라이브만 갱신되고
  // outputFiles 가 안 생겼다(→ '결과 편집하기' 비활성). VBA 는 이 위임 덕에 정상 동작했던 것 = VBA 와의 차이.
  // outputMode:"file" 이면 종류와 무관하게 격리 배치 경로로 보내 결과 파일을 만들고 라이브는 건드리지 않는다.
  if (hasVbaStep || hasCrossFileStep || options.outputMode === "file") {
    // 사용자가 확인한 실패 케이스의 공통점은 전체실행에서 라이브 임베드 Excel 인스턴스가
    // Application.Run 을 거부하는 것이다. VBA 가 하나라도 있으면(또는 교차파일 복붙이면) 새 비임베드
    // Excel 에서 순서대로 실행한 뒤 결과 워크북만 라이브로 복사한다. Python COM 스텝이 섞여도 같은
    // 격리 파이프라인 안에서 순서를 유지한다.
    //
    // [교차 목적지 리셋 전파] 격리 배치는 '그룹 대상'(스텝의 변형 파일)만 pristine sourcePath 에서 열고,
    // 그 밖의 라이브 세션은 '현재 라이브 상태'로 companion 오픈한다. dst_book 교차 스텝의 그룹 대상은
    // 소스(A)이므로 목적지(B, 입력 파일)는 리셋 대상에 없었고, 라이브에 이미 적용된 상태면 전체실행마다
    // '원가 (2)', (3)… 이 누적됐다(reapply 경로만 목적지를 리셋하던 반쪽 수정).
    const crossResetFileIds = [];
    (steps || []).forEach(s => {
      if (!s || !s.code) return;
      const selfFileId = s.targetFileId
        || (typeof inferPipelineStepTargetFileId === "function" ? inferPipelineStepTargetFileId(s) : null);
      crossWriteDestinationFileIds(s.code, { selfFileId }).forEach(fid => {
        if (fid && !crossResetFileIds.includes(fid)) crossResetFileIds.push(fid);
      });
    });
    const mergedResetFileIds = Array.from(new Set([...(options.resetFileIds || []), ...crossResetFileIds]));
    return runIsolatedLivePipelineSteps(steps, excelId,
      mergedResetFileIds.length ? { ...options, resetFileIds: mergedResetFileIds } : options);
  }
  // 전체실행도 "채팅에서 생성 → 적용"과 같은 단일 적용 함수를 스텝 순서대로 재사용한다.
  // 별도 reapply 전용 적용기를 태우면 Native Excel 창 숨김/복원/표시 타이밍이 달라져
  // 단일 적용은 되는데 전체실행만 빈 Excel 창이 뜨거나 VBA 실행이 막히는 차이가 생긴다.
  // [fast OFF/삭제] 모든 live 스텝을 '적용 전'에 스냅샷해 둔다(=각 스텝 직전 상태, 격리 경로의 per-step
  // 캡처와 동형). 이게 있어야 마지막부터 하나씩 연속으로 OFF/삭제해도 전부 전체 재실행 없이 빠르게
  // 되돌릴 수 있다 — 이 for-loop 경로(순수 Python/단일파일)는 그동안 스냅샷을 안 남겨 OFF/삭제가 매번
  // full reconcile 로 떨어지던 비대칭(ON 은 시그니처만 보고 fast)의 원인이었다.
  let appliedCount = 0;
  for (let i = 0; i < activeSteps.length; i++) {
    const step = activeSteps[i];
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
    // 적용 '전'에 캡처해야 그 스텝 직전 상태(1..i-1)가 잡힌다. 적용 후면 그 스텝까지 반영돼 OFF 가 무의미.
    if (stepExcelId && pipelineStepLiveLanguage(step)) {
      const snap = await captureStepPreApplySnapshot(step, stepExcelId);
      syncStepPreApplySnapshot(step, snap, (state.pipeline || []).findIndex(s => s === step || (s && step && s.id === step.id)));
      if (!snap || !snap.resultId) {
        throw createPipelineStepError(
          i,
          step,
          "Step 실행 전 복구 스냅샷을 만들지 못했습니다. 삭제/ON-OFF 복구가 불가능해 실행을 중단했습니다.",
          "pre-apply snapshot capture failed"
        );
      }
    }
    const hardBlock = findPipelineRuntimeExecutionBlocker([step]);
    if (hardBlock) throw createPipelineRuntimeExecutionBlockError(hardBlock);
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

function restoreVbaExcelAfterError(excelId, options = {}) {
  if (typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
  if (typeof releaseExcelMirrorPipelineMute === "function") releaseExcelMirrorPipelineMute(excelId);
  const restoreOptions = {
    restoreExcelId: excelId || null,
    restoreFileId: options.restoreFileId || null,
  };
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
      })
      .finally(() => {
        if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0, restoreOptions);
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
  if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0, restoreOptions);
}

// [중단 자체 멈춤 수정] 협조적 복귀가 유예 내 안 끝날 때의 강제 중단 — '초기화' 버튼과 동일한
// 큐-우회 강제 재시작(forceRestartExcelMirrors → /api/excel/force-restart): 앱 소유 EXCEL.EXE
// pid 를 죽이면 굳어 있던 COM 호출이 RPC 오류로 풀려나고, 세션 재오픈 + 단일 자동재적용기가
// 상태를 복원한다. 어느 계층이 굳어 있어도 유한 시간 안에 끝난다.
// [중단 오승격 수정] 백엔드 진행률(스텝당 1회 갱신). /api/excel/pipeline-progress 는 EXCEL_LOCK 을
// 잡지 않아 COM 이 굳어 있는 동안에도 즉시 응답한다 — '진짜 멈춤' 판정에 쓸 수 있는 유일한 신호.
async function fetchExcelPipelineProgress(excelId) {
  if (!excelId || typeof fetch !== "function") return null;
  try {
    const resp = await fetch("/api/excel/pipeline-progress?excelId=" + encodeURIComponent(excelId));
    if (!resp || !resp.ok) return null;
    const data = await resp.json();
    if (!data || data.ok === false) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function excelPipelineProgressSignature(p) {
  if (!p) return null;
  return [p.phase || "", p.current || 0, p.total || 0, p.syncCurrent || 0, p.syncTotal || 0].join("/");
}

// 복귀가 끝날 때까지 기다리되, 진행이 stallMs 동안 '한 발짝도' 못 나가면 멈춤으로 본다.
// 예전엔 총 경과 10초로만 판단해서, 저사양에서 정상적으로 느린 복귀(격리 인스턴스 spawn + 리셋 +
// 전 스텝 재적용 + 동기화)까지 전부 강제 재시작으로 승격됐다("멈춘 경우만"이 아니라 "느린 경우 전부").
// 한계: 진행률은 폴링 대상 excelId 기준이라, 다른 세션에서만 진행되는 다파일 복귀는 움직임이 안 보여
// stallMs 뒤 승격될 수 있다(그래도 종전 10초 고정보다 관대). 진짜 멈춤의 즉시 탈출은 '중단' 재클릭.
async function waitRestoreOrStall(restore, excelId, opts) {
  const o = opts || {};
  const POLL_MS = o.pollMs || 1500;
  const STALL_MS = o.stallMs || 20000;
  let settled = null;
  restore.then(
    () => { settled = { ok: true }; },
    err => { settled = { err: err || new Error("복귀 실패") }; }
  );
  let lastSig = null;
  let lastMoveAt = Date.now();
  for (;;) {
    await new Promise(r => setTimeout(r, POLL_MS));
    if (settled) return settled.err ? { err: settled.err } : "ok";
    const sig = excelPipelineProgressSignature(await fetchExcelPipelineProgress(excelId));
    if (settled) return settled.err ? { err: settled.err } : "ok";
    const now = Date.now();
    if (sig !== null && sig !== lastSig) { lastSig = sig; lastMoveAt = now; }
    if (now - lastMoveAt >= STALL_MS) return "stalled";
  }
}

async function escalateExcelStopToForceRestart() {
  try {
    if (typeof forceRestartExcelMirrors === "function") {
      await forceRestartExcelMirrors("작업이 응답하지 않아 강제 중단합니다 — Excel 세션을 재시작합니다...");
      return true;
    }
  } catch (_) {}
  try {
    await fetch("/api/excel/force-restart", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    return true;
  } catch (_) {}
  return false;
}

// [#19] 진행 중인 단일 VBA 적용을 취소하고 안전 복귀한다.
// 서버 매크로는 EXCEL_LOCK 동기 실행이라 즉시 인터럽트가 불가하다(한계). 대신 진행 단계의 결과를
// 무시(취소 토큰)하고, 원본 리셋 + 남은 enabled 스텝 재적용으로 '이전 정상 상태'로 되돌린다.
// 실행 중이던 매크로의 부분 변경은 이 재적용이 덮어써서 오류 상태로 남지 않게 한다.
async function requestExcelApplyCancel() {
  const active = window.__activeVbaApply;
  if (!active || !active.token || active.token.cancelled) {
    // [중단 자체 멈춤 수정] 이미 중단 절차가 도는 중에 또 요청됐다 = 복귀가 굳었다는 신호 → 즉시 강제 중단.
    if (window.__excelStopInProgress) {
      await escalateExcelStopToForceRestart();
      return true;
    }
    return false;
  }
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
  window.__excelStopInProgress = true;
  // [중단 자체 멈춤 수정] 복귀 재적용은 '멈춘 원 작업'과 같은 단일 COM 워커 큐(FIFO)에 줄을 서므로,
  // 원 작업이 COM 안에서 굳어 있으면 복귀가 영영 시작되지 않는다("작업 중단 중"에서 멈춤).
  // → 승격은 하되 '시계'가 아니라 '진행'으로 판단한다(waitRestoreOrStall). 예전엔 총 10초 고정이라
  //   저사양에서 정상적으로 느린 복귀까지 전부 강제 재시작으로 날려서, 원 증상보다 더 나빴다
  //   (버려진 복귀의 이중 재적용 + '적용됨' 표시와 실제 pristine 의 괴리 → 다음 적용이 조용히 오답).
  try {
    if (excelId && typeof reapplyVbaPipelineToLive === "function") {
      // 승격 시 버려지는 복귀가 계속 살아 세션을 새로 열고 남은 리셋/그룹을 마저 실행하면
      // 승격 쪽 자동재적용과 같은 파일에 두 번 쓴다(교차파일 중복 기록). epoch 로 무효화한다.
      const epoch = (window.__excelRestoreEpoch = (window.__excelRestoreEpoch || 0) + 1);
      const restore = reapplyVbaPipelineToLive(excelId, { steps: state.pipeline, restoreEpoch: epoch });
      const raced = await waitRestoreOrStall(restore, excelId);
      if (raced === "stalled") {
        window.__excelRestoreEpoch = epoch + 1;  // 버려진 복귀 무효화(경계마다 스스로 중단)
        restore.then(() => {}, () => {});        // 큐가 풀린 뒤 죽은 세션 상대로 늦게 실패해도 조용히 무시
        await escalateExcelStopToForceRestart();
        toast("작업이 응답하지 않아 강제 중단했습니다. Excel 창을 다시 준비하는 중입니다...", "success");
        return true;
      }
      if (raced && raced.err) throw raced.err;
    }
    toast("작업을 중단하고 이전 상태로 되돌렸습니다.", "success");
    return true;
  } catch (err) {
    toast("중단 후 복귀 중 오류: " + ((err && err.message) || err), "error");
    return false;
  } finally {
    window.__excelStopInProgress = false;
  }
}

function pipelineErrorMayHaveAppliedInExcel(err) {
  const msg = String((err && err.message) || err || "");
  return /응답이\s*지연|지연되어\s*중단|백그라운드에서\s*계속\s*적용|timeout|timed\s*out|abort|aborted|network\s*error/i.test(msg);
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
  // [복구/강제 대용량] 이 스텝이 VBA→Python 복구 결과이거나 '원본 Python 강제적용'이면 백엔드가 정적검사를
  // 우회하고 데드라인을 확장해 완주시킨다(다시 VBA 로 튕기는 무한 루프 방지). 클라 HTTP/로딩 타임아웃도 함께 확장.
  const wantExtended = liveLang === "python" && !!(step && step.extendedTimeout);
  try {
    if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.start", {
      stepId: step.id || "",
      excelId: excelId || "",
      liveLang,
      appendToPipeline,
      pipelineLen: Array.isArray(state.pipeline) ? state.pipeline.length : -1,
      desc: String(step.description || "").slice(0, 120),
    });
  } catch (_) {}
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
  if (typeof beginExcelMirrorApplyLoading === "function") beginExcelMirrorApplyLoading(
    liveLang === "python" ? "스킬 적용 중(Python)..." : "스킬 적용 중(VBA)...",
    { failsafeMs: liveLang === "python" ? (wantExtended ? 1350000 : 130000) : 110000 }
  );
  try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.loading_started", { stepId: step.id || "", liveLang }); } catch (_) {}
  const prehide = typeof hideAllExcelMirrorWindows === "function"
    ? (async () => {
        const started = performance.now();
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.prehide_start", { stepId: step.id || "" }); } catch (_) {}
        try {
          await hideAllExcelMirrorWindows();
        } catch (_) {
        } finally {
          prehideMs = performance.now() - started;
          try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.prehide_end", { stepId: step.id || "", prehideMs: Math.round(prehideMs) }); } catch (_) {}
        }
      })()
    : Promise.resolve();
  const promise = prehide
    .then(async () => {
      if (appendToPipeline) {
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.snapshot_before", { stepId: step.id || "", excelId }); } catch (_) {}
        await captureStepPreApplySnapshot(step, excelId);
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.snapshot_after", { stepId: step.id || "", hasSnapshot: !!step._preApplySnapshot }); } catch (_) {}
      }
      const requestStarted = performance.now();
      // [0.5.15 크래시 수정] VBA 단일 적용을 '라이브(임베드/오버레이) Excel'에서 직접 Application.Run 하면
      // 간헐적 RPC 사망으로 백엔드 프로세스가 통째로 죽어(→ 네이티브 호스트 자동 재시작 = "앱이 내려갔다
      // 올라옴") 사용자가 무서워한다. 전체실행과 동일하게 '격리 인스턴스'에서 이 1스텝만 reset:false(현재 라이브
      // 상태 위)로 실행하고 결과만 반영한다 → 라이브 인스턴스에서 VBA 를 안 돌리므로 크래시가 사라진다.
      // Python COM 은 이 RPC 사망을 일으키지 않으므로 기존 라이브 경로(/api/excel/run-python) 유지.
      const isVbaApply = liveLang !== "python";
      const reqUrl = isVbaApply ? "/api/excel/run-vba-pipeline" : liveEndpoint;
      const reqBody = isVbaApply
        ? { excelId, steps: [isolatedPipelineStepPayload(step, (state.pipeline || []).indexOf(step))], reset: false }
        : { excelId, code: step.code, extendedTimeout: wantExtended };
      // 격리는 인스턴스 spawn 이 포함돼 라이브 직접보다 느리다 → VBA 타임아웃을 넉넉히(저사양 대비).
      // 복구/강제 Python(wantExtended)은 백엔드 데드라인(기본 20분)보다 크게 잡아 도중에 끊기지 않게 한다.
      const liveTimeoutMs = liveLang === "python" ? 2000000000 : 180000;  // [사용자 지시] Python 타임아웃 사실상 제거(30일)
      try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.request_before", { stepId: step.id || "", endpoint: reqUrl, timeoutMs: liveTimeoutMs }); } catch (_) {}
      return postExcelMirror(reqUrl, reqBody, 0, {
        timeoutMs: liveTimeoutMs,
        timeoutMessage: "스킬 실행 응답이 지연되어 중단했습니다. 저사양 PC에서는 백그라운드에서 계속 적용 중일 수 있으니 잠시 후 화면을 확인해 주세요.",
      })
        .then(data => {
          requestMs = performance.now() - requestStarted;
          try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.request_after", { stepId: step.id || "", endpoint: reqUrl, requestMs: Math.round(requestMs), ok: !!(data && data.ok !== false) }); } catch (_) {}
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
      if (typeof scheduleRestoreActiveExcelMirror === "function") {
        scheduleRestoreActiveExcelMirror(180, {
          restoreExcelId: excelId,
          restoreFileId: typeof fileIdForExcelMirrorId === "function" ? fileIdForExcelMirrorId(excelId) : null,
        });
      }
      recordVbaDebugTiming({
        action: appendToPipeline ? "append" : "single-replay",
        steps: 1,
        prehideMs,
        startRequestMs: requestMs,
        totalClientMs: performance.now() - perfStartedAt,
        server: (data && data.debugTimings) || {},
      });
      if (showToasts) toast(`"${step.description}" 적용됨`, "success");
      try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.done", { stepId: step.id || "", totalClientMs: Math.round(performance.now() - perfStartedAt) }); } catch (_) {}
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
      const mayHaveApplied = pipelineErrorMayHaveAppliedInExcel(err);
      setPipelineRuntimeStatus([step.id], mayHaveApplied ? "review" : "error", mayHaveApplied ? "확인 필요" : "오류");
      restoreVbaExcelAfterError(excelId, {
        restoreFileId: typeof fileIdForExcelMirrorId === "function" ? fileIdForExcelMirrorId(excelId) : null,
      });
      // [#2] 적용에 실패한(라이브에 들어가지 못한) 새 스텝은 파이프라인에서 제거한다.
      // 안 그러면 항상 raise 하는 깨진 스텝(예: "데이터가 없습니다")이 남아 이후 모든 재적용이
      // 그 스텝에서 또 실패 → 후속 작업이 전부 막히는 마비를 일으킨다(백엔드 경로와 동일하게 정리).
      // 단, 응답 지연/타임아웃은 Excel 백그라운드에서 실제 적용이 끝났을 수 있다. 이때 롤백하면
      // 화면에는 결과가 있는데 파이프라인/자동저장에는 스텝이 빠지는 치명적 불일치가 생긴다.
      if (rollbackOnFailure && !mayHaveApplied && typeof rollbackAddedPipelineStep === "function") {
        rollbackAddedPipelineStep(step.id);
      } else if (mayHaveApplied && appendToPipeline) {
        if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-timeout-preserved");
        toast("응답 지연으로 성공 여부 확인이 필요해 스킬 단계는 삭제하지 않고 보존했습니다. Excel 화면을 확인하세요.", "error");
      }
      renderPipeline();
      refreshRunButton();
      if (options.reportError !== false) reportPipelineError(err);
      try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("pipeline.apply_live.error", { stepId: step.id || "", message: String((err && err.message) || err || "").slice(0, 500) }); } catch (_) {}
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
  // [0.5.15 크래시 수정] VBA 는 라이브(임베드) Excel 에서 직접 Application.Run 하면 RPC 사망으로 백엔드가
  // 통째 죽을 수 있다(앱 재시작). 마지막 스텝 fast-apply 도 격리 인스턴스에서 1스텝 reset:false(현재 상태 위)로
  // 실행한다. Python COM 은 RPC 사망을 안 일으켜 기존 라이브 경로 유지.
  const isVbaSeq = lang !== "python";
  const stepId = step.stepId || step.id || null;
  const stepIdx = Number.isInteger(step.stepIdx) ? step.stepIdx : -1;
  const endpoint = isVbaSeq ? "/api/excel/run-vba-pipeline" : "/api/excel/run-python";
  const timeoutMs = Number(options.timeoutMs) || (lang === "python" ? 105000 : 180000);
  if (stepId) setPipelineRuntimeStatus([stepId], "running", "작업 중");
  const requestStarted = performance.now();
  try {
    if (options.prehide !== false && typeof hideAllExcelMirrorWindows === "function") {
      try { await hideAllExcelMirrorWindows(); } catch (_) {}
    }
    await captureStepPreApplySnapshot(step, excelId);
    const payload = isVbaSeq
      ? { excelId, steps: [isolatedPipelineStepPayload(step, stepIdx >= 0 ? stepIdx : (state.pipeline || []).indexOf(step))], reset: false }
      : { excelId, code: step.code || "" };
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
  bindPipelineStepTargetContext(step);
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
  bindPipelineStepTargetContext(step);
  const total = state.pipeline.length;
  const idx = Math.max(0, Math.min(total, (position | 0) - 1));
  const next = state.pipeline.slice();
  const beforeInsertSnapshot = (state.pipeline || []).map(s => ({ ...s }));
  next.splice(idx, 0, step);
  if (idx < total && canUsePipelineCheckpointFromIndex(idx, beforeInsertSnapshot, next)) {
    if (typeof pushHistory === "function") pushHistory("단계 삽입");
    state.pipeline = next;
    setPipelineRuntimeStatus(state.pipeline.slice(idx).filter(isStepEnabled).map(s => s && s.id).filter(Boolean), "running", "실행 중");
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-inserted");
    const promise = runFromCheckpointAfterEdit(idx, beforeInsertSnapshot, {
      restoreMessage: "삽입 위치 직전 상태로 되돌리는 중...",
    }).catch(err => {
      rollbackAddedPipelineStep(step.id);
      reportPipelineError(err);
      throw err;
    });
    return {
      pending: true,
      promise,
      cancel: () => (typeof requestExcelApplyCancel === "function" ? requestExcelApplyCancel() : false),
    };
  }
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

function replaceLogicAt(stepId, newCode, newDescription, language, opts) {
  const idx = state.pipeline.findIndex(s => s.id === stepId);
  if (idx < 0) {
    toast("수정 대상 단계를 찾지 못했습니다", "error");
    return false;
  }
  const originalStep = state.pipeline[idx];
  const beforeReplaceSnapshot = (state.pipeline || []).map(s => ({ ...s }));
  const next = state.pipeline.slice();
  // VBA 실패→에러복구가 Python 으로 다시 짠 스텝(recoveredFromVba)은 대용량이라 다시 VBA 로 튕기면 안 되고
  // (무한 루프) 75초에 잘려도 안 된다 → trustedStatic(정적검사 우회) + extendedTimeout(데드라인 확장)을 켠다.
  const recoveredFromVba = !!(opts && opts.recoveredFromVba && String(language).toLowerCase() === "python");
  next[idx] = normalizeStep({
    ...next[idx],
    code: newCode,
    description: newDescription || next[idx].description,
    language,
    trustedStatic: recoveredFromVba,
    extendedTimeout: recoveredFromVba,
  });
  // [재바인딩 되새김] 저장 스킬의 targetFileId 는 만들어진 달 그대로다(예: input:…202606…).
  // 다른 달 파일만 올린 채 수정하면 코드/실행은 안정키로 이번 달에 재바인딩되는데 targetFileId 는
  // 옛 달로 남아, 한 스킬의 스텝들이 서로 다른 달 파일을 대상으로 갈리는 일이 있었다.
  // 유일하게 해석될 때만(모호하면 null) 되새겨 대상 판정을 일치시킨다.
  try {
    const tid = next[idx].targetFileId;
    if (tid && typeof getFile === "function" && !getFile(tid) &&
        typeof pipelineResolveSavedTargetFileId === "function") {
      const rebound = pipelineResolveSavedTargetFileId(tid);
      if (rebound && rebound !== tid) next[idx].targetFileId = rebound;
    }
  } catch (_) {}
  // [0.5.15 Bug2 본수정] 마지막 스텝을 수정/에러복구해도 '그 스텝 직전 스냅샷'에서 이어실행한다(전체 재실행 금지).
  // 예전엔 idx<lastBeforeIdx(=마지막이 아님)이거나 resume 보류 중일 때만 이어실행 → 마지막 스텝(예: 6단계)
  // 수정/에러복구가 1단계부터 전체 재실행으로 떨어져 느리고 '멈춤'처럼 보였다. 이어실행 가능(=그 스텝 직전
  // 스냅샷 보유)하면 마지막 스텝도 restore(그 스텝 직전 상태) + '그 스텝만' 재실행으로 처리한다.
  if (canUsePipelineCheckpointFromIndex(idx, beforeReplaceSnapshot, next)) {
    if (typeof pushHistory === "function") pushHistory("단계 수정");
    state.pipeline = next;
    setPipelineRuntimeStatus(state.pipeline.slice(idx).filter(isStepEnabled).map(s => s && s.id).filter(Boolean), "running", "실행 중");
    renderPipeline();
    refreshRunButton();
    if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-updated");
    const promise = runFromCheckpointAfterEdit(idx, beforeReplaceSnapshot, {
      restoreMessage: "수정 위치 직전 상태로 되돌리는 중...",
    }).catch(err => {
      restorePipelineStep(stepId, originalStep);
      reportPipelineError(err);
      throw err;
    });
    return {
      pending: true,
      promise,
      cancel: () => (typeof requestExcelApplyCancel === "function" ? requestExcelApplyCancel() : false),
    };
  }
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
    // 이 스텝을 만든 '원 요청' 말풍선으로 채팅을 스크롤하고 잠깐 강조(어떻게 요청했는지 바로 보이게).
    if (typeof scrollChatToStepRequest === "function") {
      const step = state.pipeline[idx];
      setTimeout(() => scrollChatToStepRequest(step), 0);
    }
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
  // [사용자 편집 이름 우선] 사용자가 카드 라벨을 직접 편집하면 step.title 에 저장된다 → 항상 그걸 먼저 보여준다.
  const userTitle = String((step && step.title) || "").trim();
  if (userTitle) return userTitle.length > 70 ? userTitle.slice(0, 70) + "…" : userTitle;
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
  if (state.renamingStepId && !state.pipeline.some(s => s.id === state.renamingStepId)) {
    state.renamingStepId = null;
    state.renamingDraft = null;
  }
  list.innerHTML = "";
  const frag = document.createDocumentFragment();
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
      <button class="step-rename" title="스킬명 바꾸기">스킬명</button>
      <button class="step-toggle ${isStepEnabled(step) ? 'active' : ''}" title="계산 반영 여부">${isStepEnabled(step) ? 'ON' : 'OFF'}</button>
      <button class="step-edit ${editing ? 'active' : ''}" title="${editing ? '수정 모드 해제' : '수정'}">✎</button>
      <button class="step-del" title="삭제">✕</button>
    `;
    // [사용자 요청] 카드 라벨 이름 편집(step.title 에 저장). 빈 값이면 자동 라벨로 복귀.
    // 편집한 이름은 자동백업/스킬 zip 저장에 함께 실려(save-load), 나중에 불러오면 그 이름으로 보인다.
    // [상태 기반 편집] ✎ 편집모드(state.editingStepId)와 같은 원리로 state.renamingStepId 에 둔다.
    // 예전엔 입력칸이 DOM 에만 있어서, 실행 배지 폴링 등으로 renderPipeline 이 한 번만 스쳐도 입력칸이
    // 소리 없이 사라졌다("눌러도 무변화" / "두 번 클릭해야 먹힘"의 정체). 이제 재렌더돼도 유지된다.
    const labelEl = item.querySelector(".step-label");
    const renaming = state.renamingStepId === step.id;
    if (labelEl && renaming) {
      const input = document.createElement("input");
      input.className = "step-label-input";
      input.type = "text";
      input.value = state.renamingDraft != null
        ? String(state.renamingDraft)
        : (String(step.title || "").trim() || pipelineStepLabel(step, idx));
      input.maxLength = 200;
      labelEl.textContent = "";
      labelEl.appendChild(input);
      input.oninput = () => { state.renamingDraft = input.value; };   // 재렌더 시 값 보존
      const commit = (save) => {
        if (state.renamingStepId !== step.id) return;   // 이미 처리됨
        const v = String(input.value || "").trim();
        state.renamingStepId = null;
        state.renamingDraft = null;
        if (save) {
          const si = state.pipeline.findIndex(s => s && s.id === step.id);
          if (si >= 0) {
            if (typeof pushHistory === "function") pushHistory("단계 이름 편집");
            state.pipeline[si].title = v || null;   // 빈 값 → null(자동 라벨로 복귀)
            if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-renamed");
          }
        }
        renderPipeline();
      };
      input.onkeydown = (ev) => {
        ev.stopPropagation();
        if (ev.key === "Enter") { ev.preventDefault(); commit(true); }
        else if (ev.key === "Escape") { ev.preventDefault(); commit(false); }
      };
      input.onblur = () => commit(true);
      input.onclick = (ev) => ev.stopPropagation();
    }
    const openLabelRename = () => {
      if (state.renamingStepId === step.id) return;
      state.renamingStepId = step.id;
      state.renamingDraft = null;              // 첫 렌더에서 현재 이름으로 채움 + 전체선택
      state.renamingSelectAll = true;
      renderPipeline();
    };
    if (labelEl && !renaming) {
      labelEl.title = pipelineStepLabel(step, idx) + " · '스킬명' 버튼 또는 더블클릭으로 이름 편집";
      labelEl.ondblclick = (e) => { e.stopPropagation(); openLabelRename(); };
      // [포커스 레이스] 클릭 복구망(눌림-즉시 합성 click)에선 onclick 이 mousedown '중'에 돌아,
      // 직후 기본 mousedown 동작(포커스 이동)이 새 입력칸 포커스를 뺏는다 → 기본 동작 차단.
      labelEl.onmousedown = (e) => {
        if (!(e.target && e.target.tagName === "INPUT")) e.preventDefault();
      };
    }
    const renameBtn = item.querySelector(".step-rename");
    if (renameBtn) {
      renameBtn.onmousedown = (e) => e.preventDefault();   // 포커스 뺏김 방지(위와 동일)
      renameBtn.onclick = (e) => { e.stopPropagation(); openLabelRename(); };
    }
    item.querySelector(".step-toggle").onclick = async (e) => {
      e.stopPropagation();
      const busyReason = typeof pipelineEditBusyReason === "function" ? pipelineEditBusyReason() : "";
      if (busyReason) {
        if (typeof toast === "function") toast(busyReason, "error");
        return;
      }
      const stepId = step.id;
      const currentIdx = state.pipeline.findIndex(s => s.id === stepId);
      if (currentIdx < 0) return;
      if (typeof pushHistory === "function") pushHistory("단계 적용 여부 변경");
      const prevEnabled = isStepEnabled(state.pipeline[currentIdx]);
      const beforeToggleSnapshot = (state.pipeline || []).map(s => ({ ...s })); // [중단 복원] 변경 전
      const fastLast = canFastEditLastPipelineStep(state.pipeline[currentIdx], currentIdx, beforeToggleSnapshot);
      const resumeBeforeToggle = getPipelineResumeFromIndex();
      state.pipeline[currentIdx] = { ...state.pipeline[currentIdx], enabled: !prevEnabled };
      const toggledStep = state.pipeline[currentIdx];
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-toggled");
      if (Number.isInteger(resumeBeforeToggle) && currentIdx >= resumeBeforeToggle) {
        // [토글 즉시 반영] 보류 구간 안의 스텝을 ON/OFF 하면 보류 지점부터 바로 이어실행해 라이브에 반영한다.
        // 단 runFromCheckpointAfterEdit 는 '실패 step 직전 스냅샷'이 없으면(이어실행 불가) false 를 반환한다 —
        // 이때 보류로 방치하면 "ON 했는데 안 돌아오고 계속 보류"가 된다(STEP4 ON 사례). false/예외면 보류를
        // 비우고 전체 재실행으로 폴백한다(현재 ON/OFF 반영, 전체실행은 pristine reset 이라 중복 없이 안전).
        let _resumed = false;
        try {
          _resumed = await runFromCheckpointAfterEdit(currentIdx, beforeToggleSnapshot, {
            restoreMessage: "보류 구간을 다시 적용하는 중...",
          });
        } catch (err) {
          console.warn("[pipeline] pending-region toggle resume threw; falling back to full re-run", err);
        }
        if (_resumed) return;
        clearPipelineResumeFromIndex();
        try {
          await reconcilePipelineSimulationAfterEdit({ affectedStep: toggledStep, restorePipeline: beforeToggleSnapshot });
        } catch (err2) {
          state.pipeline[currentIdx] = { ...state.pipeline[currentIdx], enabled: prevEnabled };
          renderPipeline();
          refreshRunButton();
          markPipelinePendingFromIndex(resumeBeforeToggle, { label: "보류" });
          if (typeof reportPipelineError === "function") reportPipelineError(err2);
        }
        return;
      }
      // [#3] 라이브가 '알려진 적용 상태'가 아니면(예: 실행기 파일출력 전체실행 직후 — 라이브 무손상이라 시그니처를
      // invalidate) fast 토글/체크포인트-보류를 쓰지 말고 곧장 full reconcile(reset→enabled 재적용)로 라이브에
      // 결정적으로 반영한다. 거짓 baseline 위 fast 토글이 'ON 안 먹힘/보류'로 플레이키하던 것을 제거(이 reconcile
      // 이 끝나면 시그니처가 채워져 다음 토글부터는 기존 빠른 경로). #2 '최종 반영 보기'를 먼저 눌렀다면 이미
      // 시그니처가 있어 이 분기는 안 탄다.
      if (_lastLiveAppliedSignature === null && pipelineStepLiveLanguage(beforeToggleSnapshot[currentIdx])) {
        try {
          await reconcilePipelineSimulationAfterEdit({ affectedStep: toggledStep, restorePipeline: beforeToggleSnapshot });
        } catch (err) {
          const idxNow = state.pipeline.findIndex(s => s.id === stepId);
          if (idxNow >= 0) {
            state.pipeline[idxNow] = { ...state.pipeline[idxNow], enabled: prevEnabled };
            renderPipeline();
            refreshRunButton();
          }
          if (typeof reportPipelineError === "function") reportPipelineError(err);
        }
        return;
      }
      if (fastLast) {
        try {
          if (prevEnabled) {
            if (await restoreLastStepPreApplySnapshot(beforeToggleSnapshot[currentIdx], { message: "마지막 단계 OFF 반영 중..." })) {
              noteLivePipelineApplied(state.pipeline);
              if (typeof toast === "function") toast("마지막 단계만 빠르게 OFF 처리했습니다.", "success");
              return;
            }
            // [스냅샷 없음 폴백] 실행기 파일출력 결과를 '결과 편집하기'로 불러온 뒤엔 라이브에 스텝별 OFF용
            // 스냅샷이 없다(스냅샷은 격리 실행분이라 replace 로드 상태와 어긋남). 취소/에러 대신 full reconcile
            // (reset→enabled 재적용)로 결정적으로 반영한다(느리지만 정확). state.pipeline 은 이미 OFF 가 반영된 상태.
            try {
              await reconcilePipelineSimulationAfterEdit({ affectedStep: toggledStep, restorePipeline: beforeToggleSnapshot });
              return;
            } catch (err2) {
              state.pipeline = beforeToggleSnapshot;
              renderPipeline();
              refreshRunButton();
              if (typeof reportPipelineError === "function") reportPipelineError(err2);
              return;
            }
          } else if (_lastLiveAppliedSignature !== null &&
              liveEnabledStepsSignature(beforeToggleSnapshot) === _lastLiveAppliedSignature) {
            await applyLastEnabledStepFast(toggledStep, { steps: state.pipeline });
            if (typeof toast === "function") toast("마지막 단계만 빠르게 ON 처리했습니다.", "success");
            return;
          }
        } catch (err) {
          console.warn("[pipeline] fast last-step toggle failed; cancelling fast edit", err);
          state.pipeline = beforeToggleSnapshot;
          renderPipeline();
          refreshRunButton();
          if (typeof toast === "function") {
            toast("마지막 단계 ON/OFF 반영에 실패해 변경을 취소했습니다. 전체실행을 다시 완료한 뒤 시도해 주세요.", "error");
          }
          return;
        }
      }
      if (!fastLast && pipelineStepLiveLanguage(beforeToggleSnapshot[currentIdx])
          && !pipelineSuffixWritesCrossFile(beforeToggleSnapshot, currentIdx)) {
        try {
          if (await restorePipelineToCheckpointAndHold(currentIdx, beforeToggleSnapshot, {
            message: "선택한 단계 직전 상태로 되돌리는 중...",
            toast: `Step ${currentIdx + 1}부터 보류 상태로 전환했습니다.`,
          })) {
            return;
          }
        } catch (err) {
          console.warn("[pipeline] middle-step toggle checkpoint restore failed; falling back to full reconcile", err);
        }
      }
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
    item.querySelector(".step-del").onclick = async (e) => {
      e.stopPropagation();
      const busyReason = typeof pipelineEditBusyReason === "function" ? pipelineEditBusyReason() : "";
      if (busyReason) {
        if (typeof toast === "function") toast(busyReason, "error");
        return;
      }
      const stepId = step.id;
      const currentIdx = state.pipeline.findIndex(s => s.id === stepId);
      if (currentIdx < 0) return;
      if (typeof pushHistory === "function") pushHistory("단계 삭제");
      if (state.editingStepId === stepId) state.editingStepId = null;
      const removedStep = state.pipeline[currentIdx];
      const beforeDeleteSnapshot = (state.pipeline || []).map(s => ({ ...s })); // [중단 복원] 삭제 전
      const fastLast = canFastEditLastPipelineStep(removedStep, currentIdx, beforeDeleteSnapshot);
      const lastLiveDelete = isLastLivePipelineStep(removedStep, currentIdx, beforeDeleteSnapshot);
      const resumeBeforeDelete = getPipelineResumeFromIndex();
      // [필드] 이 스텝이 라이브에 '실제 적용된' 상태였는지 — 적용 실패(오류) 스텝은 라이브에 없으므로
      // 아래 reconcile 이 실패해도 부활시키면 안 된다(오류 스킬이 영영 안 지워지는 현상).
      const removedWasApplied = typeof getPipelineRuntimeStatus === "function"
        && (getPipelineRuntimeStatus(stepId) || {}).status === "applied";
      state.pipeline.splice(currentIdx, 1);
      renderPipeline();
      refreshRunButton();
      if (typeof scheduleLogicAutoBackup === "function") scheduleLogicAutoBackup("step-deleted");
      if (Number.isInteger(resumeBeforeDelete) && currentIdx >= resumeBeforeDelete) {
        markPipelinePendingFromIndex(Math.min(resumeBeforeDelete, state.pipeline.length), { label: "보류" });
        if (typeof toast === "function") toast("보류 구간의 단계만 삭제했습니다.", "success");
        return;
      }
      if (fastLast) {
        if (!removedWasApplied || !isStepEnabled(removedStep)) {
          noteLivePipelineApplied(state.pipeline);
          if (typeof toast === "function") toast("마지막 미적용 단계만 삭제했습니다.", "success");
          return;
        }
        try {
          if (await restoreLastStepPreApplySnapshot(removedStep, { message: "마지막 단계 삭제 반영 중..." })) {
            noteLivePipelineApplied(state.pipeline);
            if (typeof toast === "function") toast("마지막 단계만 빠르게 삭제했습니다.", "success");
            return;
          }
        } catch (err) {
          console.warn("[pipeline] fast last-step delete failed; falling back to full reconcile", err);
        }
      }
      // 마지막 live 단계 삭제는 전체 재실행 fallback 으로 보내지 않는다.
      // - 오류/보류/미적용 마지막 단계: Excel 에 실제 반영된 것이 없으므로 UI 에서만 제거하면 된다.
      // - 적용된 마지막 단계: 스냅샷 복구가 실패하면 전체 재실행으로 중복 적용하지 말고 삭제를 취소한다.
      if (lastLiveDelete) {
        if (!removedWasApplied || !isStepEnabled(removedStep)) {
          noteLivePipelineApplied(state.pipeline);
          if (typeof toast === "function") toast("마지막 미적용 단계만 삭제했습니다.", "success");
          return;
        }
        // [스냅샷 없음 폴백] 파일출력 결과를 '결과 편집하기'로 불러온 뒤엔 라이브에 삭제용 스냅샷이 없다.
        // 취소/에러 대신 full reconcile 로 결정적으로 반영한다. state.pipeline 은 이미 삭제가 반영된 상태.
        try {
          await reconcilePipelineSimulationAfterEdit({ affectedStep: removedStep, restorePipeline: beforeDeleteSnapshot });
          return;
        } catch (err2) {
          const at = Math.max(0, Math.min(currentIdx, state.pipeline.length));
          state.pipeline.splice(at, 0, removedStep);
          renderPipeline();
          refreshRunButton();
          if (typeof reportPipelineError === "function") reportPipelineError(err2);
          return;
        }
      }
      if (!fastLast && removedWasApplied && isStepEnabled(removedStep) && pipelineStepLiveLanguage(removedStep)
          && !pipelineSuffixWritesCrossFile(beforeDeleteSnapshot, currentIdx)) {
        try {
          if (await restorePipelineToCheckpointAndHold(currentIdx, beforeDeleteSnapshot, {
            message: "선택한 단계 직전 상태로 되돌리는 중...",
            toast: `Step ${currentIdx + 1}부터 보류 상태로 전환했습니다.`,
          })) {
            return;
          }
        } catch (err) {
          console.warn("[pipeline] middle-step delete checkpoint restore failed; falling back to full reconcile", err);
        }
      }
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
    frag.appendChild(item);
  });
  list.appendChild(frag);
  // [상태 기반 이름 편집] 재렌더로 입력칸 요소가 새로 만들어지면 포커스를 되돌려 준다.
  // 첫 오픈(renamingSelectAll)엔 전체선택, 이후 재렌더에는 커서를 끝으로(타이핑 방해 최소화).
  if (state.renamingStepId) {
    const renameInput = list.querySelector(".step-label-input");
    if (renameInput && document.activeElement !== renameInput) {
      try {
        renameInput.focus();
        if (state.renamingSelectAll) {
          state.renamingSelectAll = false;
          renameInput.select();
        } else {
          const n = renameInput.value.length;
          renameInput.setSelectionRange(n, n);
        }
      } catch (_) {}
    }
  }
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

// 직전에 라이브 파이프라인이 적용돼 있었는지. 강제재시작 직전에 캡처해 '자동 1회 재적용' 여부 판단에 쓴다
// (invalidate 호출 이후엔 항상 null 이라 알 수 없으므로, 그 전에 읽어야 함).
function isLivePipelineApplied() {
  return _lastLiveAppliedSignature !== null;
}

async function captureStepPreApplySnapshot(step, excelId) {
  if (!step || !step.id || !excelId || typeof postExcelMirror !== "function") return null;
  try {
    // Do not pass name here. /api/excel/save with name uses SaveAs and mutates
    // the live session path/name; without name it uses SaveCopyAs.
    const snap = await postExcelMirror("/api/excel/save", { excelId });
    if (snap && snap.downloadId) {
      step._preApplySnapshot = {
        resultId: snap.downloadId,
        downloadUrl: snap.downloadUrl || "",
        name: snap.name || "",
        excelId,
        capturedAt: Date.now(),
      };
      syncStepPreApplySnapshot(step, step._preApplySnapshot);
      return step._preApplySnapshot;
    }
  } catch (err) {
    console.warn("[pipeline] failed to capture pre-apply snapshot", err);
  }
  return null;
}

function syncStepPreApplySnapshot(step, snap, stepIdx = null) {
  if (!step || !snap || !snap.resultId || !Array.isArray(state.pipeline)) return;
  const targets = [];
  const add = candidate => {
    if (candidate && !targets.includes(candidate)) targets.push(candidate);
  };
  if (Number.isInteger(stepIdx) && stepIdx >= 0) add(state.pipeline[stepIdx]);
  if (step.id) add(state.pipeline.find(s => s && s.id === step.id));
  for (const target of targets) {
    if (!target) continue;
    target._preApplySnapshot = { ...snap };
  }
}

function lastLiveStepIndex(steps = state.pipeline) {
  for (let i = (steps || []).length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step && step.code && pipelineStepLiveLanguage(step)) return i;
  }
  return -1;
}

function canFastEditLastPipelineStep(step, idx, beforeSteps) {
  if (!step || !step.code || !pipelineStepLiveLanguage(step)) return false;
  // 교차파일 쓰기 스텝(dst_book)은 빠른 스냅샷 복구가 대상 파일만 되돌려 교차 목적지를 놓친다.
  // 전체 reconcile 로 보내 목적지까지 pristine 으로 리셋되게 한다.
  if (pipelineStepWritesCrossFile(step)) return false;
  const list = beforeSteps || state.pipeline || [];
  if (idx < 0 || idx !== lastLiveStepIndex(list)) return false;
  if (typeof getPipelineRuntimeStatus === "function") {
    const st = getPipelineRuntimeStatus(step.id);
    if (st && st.status && st.status !== "applied") return false;
  }
  return true;
}

function isLastLivePipelineStep(step, idx, beforeSteps) {
  if (!step || !step.code || !pipelineStepLiveLanguage(step)) return false;
  const list = beforeSteps || state.pipeline || [];
  return idx >= 0 && idx === lastLiveStepIndex(list);
}

async function restoreLastStepPreApplySnapshot(step, options = {}) {
  const snap = step && step._preApplySnapshot;
  if (!snap || !snap.resultId) return false;
  let excelId = snap.excelId || null;
  if (!excelId && step) {
    const fileId = inferPipelineStepTargetFileId(step) || preferredVbaRunFileId();
    if (fileId) excelId = await requirePipelineSessionExcelId(fileId, "스킬 빠른 복구");
  }
  if (!excelId) return false;
  if (typeof beginExcelMirrorApplyLoading === "function") beginExcelMirrorApplyLoading(options.message || "마지막 단계 되돌리는 중...");
  try {
    const data = await postExcelMirror("/api/excel/replace", {
      excelId,
      resultId: snap.resultId,
      readOnlyMirror: false,
    }, 0, {
      timeoutMs: 120000,
      timeoutMessage: "마지막 단계 되돌리기 응답이 지연되어 중단했습니다. 전체 재적용으로 다시 시도해 주세요.",
    });
    if (data && data.liveSchema) {
      try { applyLiveSchemaToFileCache(excelId, data.liveSchema); } catch (_) {}
    }
    // [회색창] /api/excel/replace 로 워크북을 재오픈하면 라이브 프레임이 다시 안 떠 그리드가 회색으로 남을 수
    // 있다(사용자: OFF 후 탭 더블클릭하면 보임 — 즉 강제 show 가 필요). scheduleRestore 만으론 부족하므로
    // 탭 더블클릭과 동일하게 그 세션을 강제로 다시 보여준다(showOnlyExcelMirrorWindow).
    if (typeof showOnlyExcelMirrorWindow === "function") {
      try { await showOnlyExcelMirrorWindow(excelId, { force: true }); } catch (_) {}
    }
    if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(120);
    return true;
  } finally {
    if (typeof endExcelMirrorApplyLoading === "function") endExcelMirrorApplyLoading();
  }
}

async function restorePipelineCheckpointForSuffix(startIdx, beforeSteps, options = {}) {
  const steps = Array.isArray(beforeSteps) ? beforeSteps : (state.pipeline || []);
  const start = Math.max(0, Number(startIdx) | 0);
  const restoreSteps = [];
  const seen = new Set();
  for (let i = start; i < steps.length; i += 1) {
    const step = steps[i];
    const snap = step && step._preApplySnapshot;
    if (!snap || !snap.resultId) continue;
    const key = snap.excelId || snap.resultId;
    if (seen.has(key)) continue;
    seen.add(key);
    restoreSteps.push(step);
  }
  if (!restoreSteps.length) return false;
  const label = options.message || "선택한 단계 직전 상태로 되돌리는 중...";
  let restored = 0;
  const restoredExcelIds = new Set();
  for (const step of restoreSteps) {
    const ok = await restoreLastStepPreApplySnapshot(step, { message: label });
    if (ok) {
      restored += 1;
      const sid = step && step._preApplySnapshot && step._preApplySnapshot.excelId;
      if (sid) restoredExcelIds.add(sid);
    }
  }
  // 전부 성공 시 '복원된 세션 집합'(truthy)을 반환 — 호출자가 커버리지 검증에 쓴다.
  return restored === restoreSteps.length ? restoredExcelIds : false;
}

// [적용됨-미반영 수정] prefix(0..start-1) 스텝들이 변형하는 파일의 라이브 세션이 전부
// restoredExcelIds 에 포함되는지 검증. bg 전체실행 실패(라이브 무손상)에서 실패 스텝 파일
// 하나만 복원해 놓고 인덱스 기준으로 '적용됨'을 찍으면 나머지 파일은 원본인데 라벨만
// 적용됨이 되는 거짓 표시(+거짓 시그니처 고착)가 났다 — 커버 안 되면 마킹 금지.
async function verifyPrefixRestoreCoverage(start, restoredExcelIds) {
  if (!(restoredExcelIds instanceof Set)) return false;
  try {
    const prefixFileIds = new Set();
    (state.pipeline || []).slice(0, start).forEach(s => {
      if (!s || !s.code || !isStepEnabled(s)) return;
      const fid = inferPipelineStepTargetFileId(s);
      if (fid) prefixFileIds.add(fid);
      try { crossWriteDestinationFileIds(s.code).forEach(f => prefixFileIds.add(f)); } catch (_) {}
      try { crossOutputFileIdsReferencedInCode(s.code).forEach(f => prefixFileIds.add(f)); } catch (_) {}
    });
    for (const fid of prefixFileIds) {
      let exId = null;
      try { exId = await excelIdForPipelineFileId(fid); } catch (_) { exId = null; }
      if (!exId) continue;               // 라이브 세션이 없는 파일은 화면 불일치 자체가 없음
      if (!restoredExcelIds.has(exId)) return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

async function restorePipelineToCheckpointAndHold(startIdx, beforeSteps, options = {}) {
  const start = Math.max(0, Number(startIdx) | 0);
  const liveUntouched = options.failState && options.failState.liveUntouched === true;
  const failSnaps = options.failState && Array.isArray(options.failState.failStateSnapshots)
    ? options.failState.failStateSnapshots.filter(s => s && s.excelId && s.downloadId)
    : [];
  let restoredExcelIds = null;
  if (failSnaps.length) {
    // [적용됨-미반영 수정] 백엔드가 실패 '시점'의 관여 파일 전체 스냅샷을 동봉 — 라이브 세션 전부를
    // 그 상태(=마지막 완료 스텝까지 반영본)로 복원한다. 다파일/교차파일 스킬에서도 'Step1~N-1
    // 적용됨' 표시가 모든 파일에서 실제 라이브와 일치하게 된다.
    restoredExcelIds = new Set();
    let okAll = true;
    for (const snap of failSnaps) {
      const ok = await restoreLastStepPreApplySnapshot(
        { _preApplySnapshot: { resultId: snap.downloadId, excelId: snap.excelId } },
        { message: options.message || "실패 직전 상태로 되돌리는 중..." });
      if (ok) restoredExcelIds.add(snap.excelId);
      else okAll = false;
    }
    if (!okAll && liveUntouched) {
      if (typeof invalidateLivePipelineApplied === "function") { try { invalidateLivePipelineApplied(); } catch (_) {} }
      return false;
    }
  } else {
    const res = await restorePipelineCheckpointForSuffix(startIdx, beforeSteps, options);
    if (!res) return false;
    restoredExcelIds = res instanceof Set ? res : new Set();
  }
  if (liveUntouched) {
    // bg 전체실행 실패(라이브 전 파일 무손상) 컨텍스트: prefix 파일 전부가 복원됐을 때만 '적용됨' 마킹.
    // (토글/삭제/이어실행 등 라이브가 이미 적용 상태인 편집 컨텍스트는 기존 동작 유지 — 이 검증 미적용.)
    const covered = await verifyPrefixRestoreCoverage(start, restoredExcelIds);
    if (!covered) {
      if (typeof invalidateLivePipelineApplied === "function") { try { invalidateLivePipelineApplied(); } catch (_) {} }
      return false;
    }
  }
  markPipelinePendingFromIndex(start, { label: options.pendingLabel || "보류" });
  noteLivePipelineApplied((state.pipeline || []).slice(0, start));
  if (typeof toast === "function") {
    toast(options.toast || `Step ${start + 1}부터 보류 상태로 전환했습니다.`, "success");
  }
  return true;
}

// [매핑 보존] '수정 이후 부분만 이어실행'도 매핑본으로 돈다 — 안 그러면 수정 스텝은 새 코드로,
// 뒤 스텝들은 저장 스킬의 옛 파일명으로 실행돼 그 파일이 안 열린 채 "워크북이 열려 있지 않습니다".
async function runPipelineSuffixFromCheckpoint(startIdx, options = {}) {
  const __mapRun = beginMappedPipelineRun();
  try {
    return await _runPipelineSuffixFromCheckpointImpl(startIdx, options);
  } finally {
    __mapRun.restore();
  }
}

async function _runPipelineSuffixFromCheckpointImpl(startIdx, options = {}) {
  const start = Math.max(0, Number(startIdx) | 0);
  const steps = state.pipeline || [];
  if (start >= steps.length) {
    clearPipelineResumeFromIndex();
    return { ok: true, applied: 0 };
  }
  const suffix = steps.slice(start);
  const activeSuffix = suffix.filter(isStepEnabled);
  if (!activeSuffix.length) {
    markPipelinePendingFromIndex(steps.length);
    clearPipelineResumeFromIndex();
    return { ok: true, applied: 0 };
  }
  if (pipelineHasBackendOnlyStep(suffix)) {
    throw new Error("보류 구간에 구버전 백엔드 전용 스킬이 있어 부분 실행할 수 없습니다. 전체 실행으로 다시 동기화해 주세요.");
  }
  const ids = activeSuffix.map(s => s && s.id).filter(Boolean);
  setPipelineRuntimeStatus(ids, "running", "실행 중");
  let excelId = vbaTargetExcelId() || (typeof currentExcelId === "function" ? currentExcelId() : null);
  if (!excelId) {
    const fid = pipelinePinnedTargetFileId(steps) || preferredVbaRunFileId();
    if (fid) excelId = await excelIdForPipelineFileId(fid);
  }
  if (!excelId) throw new Error("보류 구간을 실행할 Excel 창을 찾지 못했습니다. 파일 탭을 먼저 선택해 주세요.");
  const data = await runIsolatedLivePipelineSteps(steps, excelId, {
    ...options,
    startIndex: start,
    skipReset: true,
  });
  setPipelineRuntimeStatus(ids, "applied", "적용됨");
  clearPipelineResumeFromIndex();
  noteLivePipelineApplied(steps);
  if (typeof toast === "function") toast(`보류된 ${activeSuffix.length}개 단계를 실행했습니다.`, "success");
  return data || { ok: true, applied: activeSuffix.length };
}

async function runFromCheckpointAfterEdit(startIdx, beforeSteps, options = {}) {
  const existingResume = getPipelineResumeFromIndex();
  const requestedStart = Math.max(0, Number(startIdx) | 0);
  const start = Number.isInteger(existingResume)
    ? Math.min(existingResume, requestedStart)
    : requestedStart;
  // resume 지점보다 앞 단계를 수정/삽입하면 현재 라이브 Excel은 이미 더 뒤(prefix=resume)
  // 상태다. 여기서 복원을 생략하고 start부터 실행하면 start..resume-1 단계가 중복 반영된다.
  // resume 이후 보류 구간만 바꾼 경우(existingResume <= requestedStart)에만 기존 prefix를 그대로 쓴다.
  const mustRestore = !Number.isInteger(existingResume) || requestedStart < existingResume;
  if (mustRestore) {
    const restored = await restorePipelineCheckpointForSuffix(start, beforeSteps, {
      message: options.restoreMessage || "수정 위치 직전 상태로 되돌리는 중...",
    });
    if (!restored) {
      // [수정 미반영 수정(판교테크윈 실측)] 복원 실패가 조용히 false 로 끝나면 수정 코드가 '아예
      // 실행되지 않은' 채 호출 UI(finalizeActionButtonFromResult)가 '✓ 수정 적용됨'으로 표시했다.
      // 'W가 빈 행만 채우기' 같은 조건부 스킬은 옛 실행이 채운 값이 그대로 남아 산출물에 수정이
      // 안 보인다(오류도 없음). → pristine 리셋 + 전체 재적용으로 폴백해 수정본을 반드시 실행한다.
      const excelId = (typeof vbaTargetExcelId === "function" && vbaTargetExcelId())
        || (typeof currentExcelId === "function" && currentExcelId());
      if (excelId && typeof reapplyVbaPipelineToLive === "function") {
        if (typeof toast === "function") toast("이전 상태 복원에 실패해 스킬 전체를 처음부터 다시 적용합니다...", "info");
        await reapplyVbaPipelineToLive(excelId);
        return true;
      }
      throw new Error("수정 위치 직전 상태로 복원하지 못해 재실행을 중단했습니다. '전체 실행'으로 다시 적용해 주세요.");
    }
  }
  markPipelinePendingFromIndex(start, { label: "보류" });
  return runPipelineSuffixFromCheckpoint(start, options);
}

function canUsePipelineCheckpointFromIndex(startIdx, beforeSteps, nextSteps) {
  const start = Math.max(0, Number(startIdx) | 0);
  const steps = nextSteps || state.pipeline || [];
  if (!pipelineUsesLiveSkill(steps) || pipelineHasBackendOnlyStep(steps)) return false;
  // [교차파일 목적지 누락] 이 빠른경로는 '대상 세션' 스냅샷만 되돌리므로 교차 목적지가 더러운 채
  // 남는다. 토글/삭제엔 가드가 있었지만 스킬 '수정'·'삽입' 경로는 여기로 선점돼 가드가 없었다.
  // '수정 전' 코드(beforeSteps)와 '수정 후' 코드(steps) 양쪽을 봐야 한다 — 수정으로 dst_book 호출
  // 자체가 사라지면 옛 목적지는 next 어디에도 안 남아 영영 리셋되지 않는다(삭제 버그의 재현).
  if (pipelineSuffixWritesCrossFile(beforeSteps, start) || pipelineSuffixWritesCrossFile(steps, start)) return false;
  const existingResume = getPipelineResumeFromIndex();
  if (Number.isInteger(existingResume) && existingResume <= start) return true;
  // [수정 미반영 수정] 예전 .some(뒤쪽 '아무' 스텝이나 스냅샷 보유)의 결함: 시작 스텝 스냅샷이
  // 없고 뒤 스텝 것만 있으면, 복원이 '뒤 스텝 직전'(=시작 스텝이 이미 반영된 상태)으로 되돌아가
  // 시작..뒤 구간이 중복/무효 실행된다 — 'W가 빈 행만 채우기' 같은 조건부 스킬은 아무것도 못 쓰고
  // 옛 값이 남는다(판교테크윈 실측). 이어실행 대상(활성+코드) 전부가 자기 직전 스냅샷을 가질 때만
  // 빠른경로를 탄다(아니면 pristine 전체 재적용 경로로 — 느리지만 항상 옳다).
  const suffix = (beforeSteps || []).slice(start).filter(s => s && s.code && isStepEnabled(s));
  return suffix.length > 0 && suffix.every(s => s._preApplySnapshot && s._preApplySnapshot.resultId);
}

async function applyLastEnabledStepFast(step, options = {}) {
  if (!step || !pipelineStepLiveLanguage(step)) return false;
  const hardBlock = findPipelineRuntimeExecutionBlocker([step]);
  if (hardBlock) throw createPipelineRuntimeExecutionBlockError(hardBlock);
  const excelId = await requirePipelineSessionExcelId(
    inferPipelineStepTargetFileId(step) || preferredVbaRunFileId(),
    "마지막 단계 적용"
  );
  if (!excelId) return false;
  // [fast OFF 대칭] 이 마지막 단계를 적용하기 '직전' 상태(=1..N-1)를 스냅샷해 둔다.
  // 반드시 적용 '전'에 캡처해야 한다 — 적용 후에 잡으면 N 까지 반영된 상태가 잡혀, 이후 이 단계 OFF/삭제가
  // 1..N 으로 되돌아가 사실상 아무것도 안 되돌린다(검증 지적사항). 이게 있어야 ON 직후의 OFF/삭제도 fast.
  const snap = await captureStepPreApplySnapshot(step, excelId);
  if (!snap || !snap.resultId) {
    throw createPipelineStepError(
      (state.pipeline || []).findIndex(s => s && s.id === step.id),
      step,
      "마지막 단계 적용 전 복구 스냅샷을 만들지 못했습니다. ON/OFF 복구가 불가능해 적용을 중단했습니다.",
      "pre-apply snapshot capture failed"
    );
  }
  const result = await runLivePipelineStepSequentially(step, excelId, {
    timeoutMs: 90000,
    prehide: true,
  });
  noteLivePipelineApplied(options.steps || state.pipeline);
  return result || true;
}

function pipelineEditBusyReason() {
  if (window.__activeVbaApply && window.__activeVbaApply.token && !window.__activeVbaApply.token.cancelled) {
    return "현재 Excel 적용 작업이 끝난 뒤 다시 시도하세요.";
  }
  // [중단 중 편집 차단] 취소 시작 즉시 __activeVbaApply=null 로 비우므로 여기서 ""(=편집 가능)를
  // 돌려줘, 되돌리는 동안 토글/삭제/새 적용이 통과했다. 그 새 작업이 COM 큐에 줄서 있다가
  // 승격이 나면 EXCEL.EXE kill 로 함께 폭파돼 스텝이 오류/불일치 상태로 남았다.
  if (window.__excelStopInProgress) {
    return "작업을 중단하고 이전 상태로 되돌리는 중입니다. 잠시 후 다시 시도하세요.";
  }
  return "";
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

// [매핑 보존] 실행기에서 사용자가 확정한 파일·시트 매핑을 '생성기 재실행'에도 적용한다.
// 실행기 실행 버튼과 동일한 방식: 실행 '동안만' state.pipeline 을 매핑본으로 교체하고 finally 로 복원
// (자동복구·체크포인트 이어실행이 state.pipeline 을 읽으므로 교체해야 전부 치환된 코드로 동작).
//
// 왜 필요한가: 매핑은 실행기 실행 버튼에서만 적용됐다. 그래서 '실행기 매핑 전체실행(성공) →
// 결과 편집하기 → 생성기에서 스텝 수정 → 수정 이후 재실행' 하면 저장 스킬의 옛 파일명 리터럴
// (예: 02...2026-07-07...)이 그대로 나가 대상 추론이 실패하고 현재 탭으로 폴백 →
// 격리 인스턴스에 그 파일이 안 열려 "워크북이 열려 있지 않습니다"로 죽었다.
// 도서/시내처럼 기계가 고를 수 없어 사람이 지정한 매핑은 자동 추론으로 대체 불가라 반드시 재사용해야 한다.
function beginMappedPipelineRun() {
  const original = state.pipeline;
  const noop = { steps: original, restore: () => {} };
  if (state.runnerMappingRunActive) return noop;   // 실행기 실행 중이면 이미 매핑본으로 교체돼 있음
  let mapped = original;
  try {
    if (typeof window !== "undefined" && typeof window.buildRunnerMappedPipeline === "function") {
      mapped = window.buildRunnerMappedPipeline(original) || original;
    }
  } catch (_) {
    return noop;
  }
  if (!mapped || mapped === original) return noop;  // 매핑 미확인/치환 대상 없음 → 기존 동작 그대로
  state.runnerMappingRunActive = true;
  // [치환본 저장 방지] 원본을 별도 보관 — 저장(save-load.pipelineForSave)이 실행 중에도 이걸 쓴다.
  // 그냥 지역변수로만 들고 있으면, 실행 중 renderPipeline→ensurePipelineStepIds 가 state.pipeline 을
  // '새 배열'로 갈아끼우는 순간 원본 참조가 끊겨 복원이 어긋난다(치환본이 정본으로 굳어 저장에 샘).
  state.pipelineOriginalDuringRun = original;
  state.pipeline = mapped;
  return {
    steps: mapped,
    restore: () => {
      // 실행 중 스텝이 교체됐을 수 있으므로(자동복구·편집), '지금 파이프라인'의 변경을 id 기준으로
      // 원본에 옮겨 담은 뒤 되돌린다 — 원본 이름은 지키고 사용자의 수정분은 잃지 않는다.
      const current = state.pipeline;
      if (Array.isArray(current) && current !== original) {
        const mappedById = new Map(mapped.map(s => [s && s.id, s]));
        const merged = current.map(cur => {
          if (!cur || !cur.id) return cur;
          const mappedStep = mappedById.get(cur.id);
          const originalStep = original.find(o => o && o.id === cur.id);
          if (!originalStep) return cur;                 // 실행 중 새로 생긴 스텝 → 그대로 둔다
          // 실행 중 코드가 '매핑본 그대로'였다면 원본 코드로 되돌린다(치환 흔적 제거).
          // 코드가 매핑본과 다르면 = 실행 중 실제로 바뀐 것 → 그 변경을 유지한다.
          if (mappedStep && cur.code === mappedStep.code) {
            return { ...cur, code: originalStep.code, targetFileId: originalStep.targetFileId,
                     targetSheetName: originalStep.targetSheetName, runnerMapped: undefined };
          }
          return { ...cur, runnerMapped: undefined };
        });
        state.pipeline = merged;
      } else {
        state.pipeline = original;
      }
      state.pipelineOriginalDuringRun = null;
      state.runnerMappingRunActive = false;
    },
  };
}

// 0.4.9 리모콘 모델: VBA 엔진에서 토글/삭제/편집/순서변경 등으로 파이프라인이 바뀌면
// 라이브 워크북을 원본으로 리셋한 뒤 enabled VBA 스텝을 순서대로 다시 적용한다.


// [매핑 보존] 수정 후 적용 / ON·OFF / 삽입 등 편집발 재적용의 최종 관문. 호출자가 steps 를 명시하지
// 않은 경우(replaceLogicAt·insertLogic 의 직접 호출 등) 여기서 매핑본으로 교체한다. 명시한 경우는
// 상위(reconcile)가 이미 교체했으므로 건드리지 않는다.
async function reapplyVbaPipelineToLive(excelId, options = {}) {
  const __mapRun = options.steps ? null : beginMappedPipelineRun();
  try {
    return await _reapplyVbaPipelineToLiveImpl(excelId, options);
  } finally {
    if (__mapRun) __mapRun.restore();
  }
}

async function _reapplyVbaPipelineToLiveImpl(excelId, options = {}) {
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
      targetSheetName: inferPipelineStepTargetSheetName(s, { fileId: s.targetFileId }) || null,
      trustedStatic: s.trustedStatic === true,
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
    crossWriteDestinationFileIds(s.code).forEach(addResetTarget); // 교차파일 쓰기 대상(입력 파일 포함)
  });
  // [교차파일 삭제 원복] 삭제/토글된 스텝의 교차 쓰기 대상 — 코드가 사라져도 그 파일을 pristine 으로
  // 되돌려야 붙여넣은 시트가 지워진다(호출자가 affectedStep 목적지를 extraResetFileIds 로 넘김).
  (options.extraResetFileIds || []).forEach(addResetTarget);
  if (!resetFileIds.length && fallbackFileId) addResetTarget(fallbackFileId);
  // [리뷰⑥] 대상 폴백 체인이 전부 비면(세션 강제종료 직후 등) null 이 흘러가 '창을 열지 못해'류의
  // 엉뚱한 에러가 났다 — 원인을 그대로 말하는 에러로 교체.
  if (!resetFileIds.length) {
    throw new Error("작업 대상 파일을 결정할 수 없습니다. 파일 탭을 먼저 선택해 Excel 창을 띄운 뒤 다시 시도해 주세요.");
  }
  // [실행기 파일출력] outputMode:"file" = 라이브 미반영 + 결과 파일(outputFiles) 생성.
  // 기존엔 VBA 포함 파이프라인만 격리 배치(run_full_pipeline) 경로를 타서, Python 전용 실행기 전체실행은
  // 라이브에 그대로 반영되고 outputFiles 가 없어 '결과 편집하기' 버튼이 활성화되지 않았다(예: CSV "E열 합산").
  // Python/VBA 무관하게 격리 배치 경로로 보내 결과 파일을 만들고(=버튼 활성화), 라이브는 건드리지 않는다.
  if (options.outputMode === "file") {
    if (window.runnerSetRunning) window.runnerSetRunning(true);
    return await runIsolatedLivePipelineSteps(sourceSteps, excelId, {
      ...options,
      resetFileIds,
      fallbackFileId,
      viewSheet: options.viewSheet || null,
    });
  }
  if (window.runnerSetRunning) window.runnerSetRunning(true);
  if (!hasVbaStep && typeof muteExcelMirrorForPipeline === "function") muteExcelMirrorForPipeline(excelId);
  if (!hasVbaStep && typeof beginExcelMirrorApplyLoading === "function") {
    beginExcelMirrorApplyLoading("스킬 재적용 중...", { failsafeMs: 330000 });
  }
  let failingStep = null;
  const _resetDone = []; // [리뷰③] 다중 파일 리셋이 중간 실패하면 어디까지 되돌렸는지 추적
  const liveSequentialMutedExcelIds = [];
  let liveSequentialLoadingStarted = false;
  let lastTouchedFileId = null;
  let lastTouchedExcelId = null;
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
    const stepPayload = st => ({
      stepIdx: st.stepIdx,
      stepId: st.stepId,
      description: st.description,
      code: st.code,
      language: st.language,
      targetSheetName: st.targetSheetName || null,
      trustedStatic: st.trustedStatic === true,
    });
    const pipelineTimeoutMs = () => 2000000000;  // [사용자 지시] 타임아웃 사실상 제거(30일)
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
      if (data && typeof data === "object") {
        lastTouchedFileId = data.clientRestoreFileId || lastTouchedFileId;
        lastTouchedExcelId = data.clientRestoreExcelId || lastTouchedExcelId;
      }
    } else {
      // Python 전용 파이프라인: 기존 번들 reset 경로(정상 동작 — VBA 매크로 실행이 없어 reset 안전).
      const uniqueTargets = Array.from(new Set(enabledSteps.map(stepTargetFileId)));
      const singleFileFlow = resetFileIds.length === 1 &&
        (uniqueTargets.length === 0 || (uniqueTargets.length === 1 && uniqueTargets[0] === resetFileIds[0]));
      if (singleFileFlow) {
        const sessionExcelId = await requirePipelineSessionExcelId(resetFileIds[0], "재적용");
        lastTouchedFileId = resetFileIds[0];
        lastTouchedExcelId = sessionExcelId;
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
          lastTouchedFileId = fid;
          lastTouchedExcelId = sessionExcelId;
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
          lastTouchedFileId = group.fileId;
          lastTouchedExcelId = sessionExcelId;
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
        if (typeof scheduleRestoreActiveExcelMirror === "function") {
          scheduleRestoreActiveExcelMirror(180, {
            restoreExcelId: lastTouchedExcelId || excelId || null,
            restoreFileId: lastTouchedFileId || null,
          });
        }
      } else {
        const visibleExcelId = lastTouchedExcelId || (typeof currentExcelId === "function" && currentExcelId()) || excelId;
        if (visibleExcelId && typeof showOnlyExcelMirrorWindow === "function") {
          await showOnlyExcelMirrorWindow(visibleExcelId, { force: true });
        } else if (visibleExcelId) {
          await positionExcelMirrorWindow(visibleExcelId, { force: true });
        }
        if (visibleExcelId && typeof stabilizeExcelMirrorZOrder === "function") {
          stabilizeExcelMirrorZOrder(visibleExcelId);
        }
        if (typeof scheduleRestoreActiveExcelMirror === "function") {
          scheduleRestoreActiveExcelMirror(180, {
            preserveFocus: true,
            restoreExcelId: visibleExcelId || null,
            restoreFileId: lastTouchedFileId || null,
          });
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
    restoreVbaExcelAfterError(lastTouchedExcelId || excelId, { restoreFileId: lastTouchedFileId || null });
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
  // [매핑 보존] 편집(수정/토글/삭제/삽입)발 재실행도 실행기에서 확정한 매핑을 쓴다 — 안 그러면
  // 저장 스킬의 옛 파일명 리터럴이 그대로 나가 대상 추론 실패 → 현재 탭 폴백 → "워크북이 열려 있지 않습니다".
  // 호출자가 steps 를 명시하지 않은 경우에만 교체한다(명시했으면 그 배열의 정체성을 존중).
  const __mapRun = options.steps ? null : beginMappedPipelineRun();
  try {
    return await _reconcilePipelineSimulationAfterEditImpl(options);
  } finally {
    if (__mapRun) __mapRun.restore();
  }
}

async function _reconcilePipelineSimulationAfterEditImpl(options = {}) {
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
      // [교차파일 삭제 원복] 삭제/편집된 스텝이 다른 파일에 썼다면(dst_book), 남은 스텝 코드엔 그
      // 참조가 없어 리셋에서 빠진다 → 그 목적지를 명시적으로 리셋 대상에 추가한다.
      // affectedStep 만 보면 구멍이 남았다:
      //   · undo/redo(reconcileHistoryRestore)는 affectedStep 을 못 넘겨 리셋 대상이 아예 빈다.
      //   · '수정'으로 dst_book 호출 자체가 사라지면 옛 목적지는 next 어디에도 안 남는다.
      // → '편집 전 파이프라인(restorePipeline/previousSteps)' 전체의 교차 목적지를 함께 넣는다.
      //   (현재 스텝들의 목적지는 reapply 가 이미 리셋하므로 중복은 무해하다.)
      const extraResetFileIds = [];
      const addExtra = fid => { if (fid && !extraResetFileIds.includes(fid)) extraResetFileIds.push(fid); };
      const extraSources = [];
      if (options.affectedStep && options.affectedStep.code) extraSources.push(options.affectedStep);
      (options.previousSteps || options.restorePipeline || []).forEach(s => {
        if (s && s.code) extraSources.push(s);
      });
      extraSources.forEach(s => {
        crossWriteDestinationFileIds(s.code).forEach(addExtra);
        crossOutputFileIdsReferencedInCode(s.code).forEach(addExtra);
      });
      return reapplyVbaPipelineToLive(liveExcelId, { steps: stepsForReconcile, viewSheet: affectedStepViewSheetHint(options.affectedStep), extraResetFileIds })
        .then(result => {
          // [P1] 활성창 기본 — 뷰 이동은 '실제 변경된 스텝의 대상 파일'로만(출력으로 무조건 점프 금지).
          try {
            const affected = options.affectedStep || null;
            const tfid = affectedStepViewFileId(affected);
            void tfid;
          } catch (_) {}
          return result;
        })
        .catch(async err => {
          const restoreSteps = Array.isArray(options.restorePipeline) ? options.restorePipeline : null;
          if (restoreSteps && !cancelToken.cancelled) {
            try {
              await reapplyVbaPipelineToLive(liveExcelId, {
                steps: restoreSteps,
                viewSheet: affectedStepViewSheetHint(options.affectedStep),
              });
              err.message = String(err && err.message ? err.message : err) +
                "\n\n이전 스킬 목록으로 Excel 상태를 다시 복구했습니다. 삭제/토글은 적용되지 않았습니다.";
            } catch (restoreErr) {
              err.message = String(err && err.message ? err.message : err) +
                "\n\n주의: 삭제/토글 실패 후 이전 스킬 목록 재적용도 실패했습니다. Excel 화면과 스킬 목록이 어긋날 수 있으니 전체 실행을 다시 눌러 동기화하세요." +
                "\n복구 실패 상세: " + String(restoreErr && restoreErr.message ? restoreErr.message : restoreErr);
            }
          }
          throw err;
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

function pipelineFailedStepIdFromError(err) {
  const info = (err && (err._stepInfo || err.errorInfo)) || {};
  if (info && info.stepId) return info.stepId;
  const idx = Number(info && info.stepIdx);
  if (Number.isInteger(idx) && idx >= 0 && state.pipeline && state.pipeline[idx]) {
    return state.pipeline[idx].id || null;
  }
  if (typeof resolveRunnerRecoveryStepIndex === "function") {
    const resolved = resolveRunnerRecoveryStepIndex(info || {});
    if (Number.isInteger(resolved) && resolved >= 0 && state.pipeline && state.pipeline[resolved]) {
      return state.pipeline[resolved].id || null;
    }
  }
  return null;
}

function markPipelineRunFailureStatus(err, activeStepIds) {
  const ids = (activeStepIds || []).filter(Boolean);
  const failedId = pipelineFailedStepIdFromError(err);
  const clearIds = [];
  const errorIds = [];
  ids.forEach(stepId => {
    const runtime = getPipelineRuntimeStatus(stepId) || {};
    if (runtime.status === "applied") return;
    if (failedId) {
      if (stepId === failedId) errorIds.push(stepId);
      else if (runtime.status === "running") clearIds.push(stepId);
      return;
    }
    if (runtime.status === "running") errorIds.push(stepId);
  });
  if (failedId && !ids.includes(failedId)) errorIds.push(failedId);
  if (clearIds.length) setPipelineRuntimeStatus(clearIds, null);
  if (errorIds.length) setPipelineRuntimeStatus(Array.from(new Set(errorIds)), "error", "\uC624\uB958");
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

function shouldSkipRuntimeAutoRepairForStep(step, options = {}) {
  if (!step) return false;
  const source = String(options.source || "");
  // Saved/loaded skills are treated as user-confirmed. During normal full-run
  // execution, do not silently regenerate those steps after a runtime failure:
  // it can loop for minutes and replace a known saved step with an unrelated
  // repair. Manual "error recovery" still uses source=runner-recovery and is
  // allowed to request a new candidate.
  // 단, hardRuntimeBlock 은 실제 실행 전에 "Excel을 멈출 가능성이 높은 구형 저장 스킬"을
  // 막은 경우다. 여기서는 기존 코드를 실행하지 않았으므로, 명확한 로컬 규칙/복구 후보로
  // 같은 Step을 교체해 이어 실행하는 편이 사용자가 수동으로 '다시해'를 누르는 흐름과 같다.
  if (options.hardRuntimeBlock === true) return false;
  if (source === "runner-recovery" || options.allowTrustedRuntimeRepair === true) return false;
  return step.trustedStatic === true;
}

function stripVbaCommentsForPipelineRuntimeGate(code) {
  return String(code || "").split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (/^rem(?:\s|$)/i.test(trimmed)) return "";
    if (/^\/\//.test(trimmed)) return "";
    let out = "";
    let inString = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        out += ch;
        if (inString && line[i + 1] === '"') {
          out += line[i + 1];
          i += 1;
          continue;
        }
        inString = !inString;
        continue;
      }
      if (ch === "'" && !inString) break;
      out += ch;
    }
    return out;
  }).join("\n");
}

function pipelineRuntimeExecutionBlockersForStep(step) {
  const language = inferPipelineStepLanguage(step);
  if (language !== "vba") return [];
  const code = stripVbaCommentsForPipelineRuntimeGate(step && step.code || "");
  if (!code.trim()) return [];

  const failures = [];
  const usedRangeVars = new Set();
  const setUsedRangeRe = /\bSet\s+([A-Za-z_]\w*)\s*=\s*[^\r\n:]*\bUsedRange\b/gi;
  let m = null;
  while ((m = setUsedRangeRe.exec(code))) usedRangeVars.add(m[1].toLowerCase());

  const activeSheetUsedRange =
    /\b(?:ActiveWorkbook\s*\.\s*)?ActiveSheet\b[\s\S]{0,180}\bUsedRange\b/i.test(code) ||
    /\bUsedRange\b[\s\S]{0,180}\b(?:ActiveWorkbook\s*\.\s*)?ActiveSheet\b/i.test(code);
  if (activeSheetUsedRange) {
    failures.push(
      "ActiveSheet/ActiveWorkbook.ActiveSheet 기반 UsedRange 작업은 전체실행/격리실행에서 활성 시트가 달라질 수 있어 실행 전에 차단했습니다. 정확한 Worksheets(\"시트명\") 범위를 지정해야 합니다."
    );
  }

  const forEachRe = /\bFor\s+Each\s+([A-Za-z_]\w*)\s+In\s+([^\r\n:]+?\.Cells)\b/gi;
  while ((m = forEachRe.exec(code))) {
    const loopVar = m[1];
    const sourceExpr = String(m[2] || "");
    const lowerExpr = sourceExpr.toLowerCase();
    const iteratesUsedRange =
      /\bUsedRange\b/i.test(sourceExpr) ||
      Array.from(usedRangeVars).some(v => new RegExp(`\\b${v}\\b`, "i").test(lowerExpr));
    if (!iteratesUsedRange) continue;
    const mutatesLoopCell = new RegExp(
      `\\b${loopVar}\\s*\\.\\s*(?:Value2?|Formula(?:R1C1)?|NumberFormat(?:Local)?|Style|Clear(?:Contents|Formats)?|Delete|EntireRow|EntireColumn|Interior\\s*\\.|Font\\s*\\.)`,
      "i"
    ).test(code);
    if (mutatesLoopCell) {
      failures.push(
        "UsedRange.Cells 전체를 셀 단위 For Each 로 돌며 값/서식을 바꾸는 VBA는 큰 파일에서 Excel이 멈출 수 있어 실행 전에 차단했습니다. Range 단위 서식 변경이나 명시 범위 작업으로 다시 생성해야 합니다."
      );
      break;
    }
  }
  return Array.from(new Set(failures));
}

function findPipelineRuntimeExecutionBlocker(steps = state.pipeline) {
  const list = steps || [];
  for (let i = 0; i < list.length; i += 1) {
    const step = list[i];
    if (!step || !isStepEnabled(step) || !step.code) continue;
    const failures = pipelineRuntimeExecutionBlockersForStep(step);
    if (!failures.length) continue;
    const globalIdx = (state.pipeline || []).indexOf(step);
    return { idx: globalIdx >= 0 ? globalIdx : i, step, failures };
  }
  return null;
}

function createPipelineRuntimeExecutionBlockError(blocker) {
  const err = createPipelineStepError(
    blocker && blocker.idx,
    blocker && blocker.step,
    "저장된 스킬이 현재 Excel을 멈출 수 있는 실행 패턴이라 실행 전에 중단했습니다.",
    (blocker && blocker.failures || []).join("\n"),
  );
  err._stepInfo = {
    ...(err._stepInfo || {}),
    hardRuntimeBlock: true,
    recoverable: true,
  };
  err.errorInfo = err._stepInfo;
  return err;
}

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

function pipelineStepIsStaticTrusted(step) {
  if (!step) return false;
  if (step.trustedStatic === true) return true;
  if (!step.id || typeof getPipelineRuntimeStatus !== "function") return false;
  return ((getPipelineRuntimeStatus(step.id) || {}).status === "applied");
}

function findPipelineStaticPreflightFailure(steps = state.pipeline, options = {}) {
  const skipApplied = options.skipApplied !== false;
  for (let i = 0; i < (steps || []).length; i += 1) {
    const step = steps[i];
    if (!step || !isStepEnabled(step) || !step.code) continue;
    // 이미 성공 적용된 저장 스킬은 다시 정적검사/자동재생성하지 않는다.
    // 실패 스텝 복구나 보류 구간 재실행 중 prefix 단계가 다시 검사되어
    // 1..N 반복/기존 완료 스킬 오류 판정으로 번지는 회귀를 막는다.
    if (skipApplied && pipelineStepIsStaticTrusted(step)) continue;
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

function choosePipelineRepairLanguage(step, reason, repairCount) {
  const language = inferPipelineStepLanguage(step);
  const forced = String((reason && reason.forceLanguage) || "").toLowerCase();
  if (forced === "vba" || forced === "python") return forced;
  const source = pipelineStepRepairSourceMessage(step);
  const explicitVba = typeof userExplicitlyRequestsVba === "function" && userExplicitlyRequestsVba(source);
  const explicitPython = typeof userExplicitlyRequestsPython === "function" && userExplicitlyRequestsPython(source);

  // 전체실행 자동복구도 채팅 에러복구와 같은 원칙을 따른다.
  // 저장된 Step이 VBA였다는 이유만으로 복구까지 VBA를 강제하면,
  // ctx 로 고칠 수 있는 후보가 다시 VBA 재생성 루프에 갇혀 사용자가 같은 오류를 반복해서 보게 된다.
  // 사용자가 원래 프롬프트에서 명시적으로 VBA/매크로를 요구한 경우에만 VBA를 보존한다.
  if (language === "vba") {
    if (explicitVba && !explicitPython) return "vba";
    if (!explicitPython && typeof filterToNewSheetIntent === "function" && filterToNewSheetIntent(source)) return "vba";
    return "python";
  }

  if (explicitPython && !explicitVba) return "python";
  if (typeof shouldRouteRequestToVba === "function" && shouldRouteRequestToVba(source)) return "vba";
  if (language === "python" && repairCount >= 1) return "vba";
  const message = [
    reason && reason.message,
    reason && reason.errorInfo && reason.errorInfo.message,
    reason && reason.errorInfo && reason.errorInfo.rawError,
  ].filter(Boolean).join("\n");
  if (language === "python" && /(out\s*of\s*memory|memory|ram|응답\s*없|멈춤|다운|COM|RPC|macro|매크로|Excel)/i.test(message)) {
    return "vba";
  }
  return language === "vba" ? "python" : language;
}

function shouldForceVbaForPipelineRepair(step, reason, repairCount) {
  return choosePipelineRepairLanguage(step, reason, repairCount) === "vba";
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
  const duplicateDeleteHint = isVba && typeof duplicateRowDeleteVbaHint === "function"
    ? duplicateRowDeleteVbaHint(source)
    : "";
  const filterToSheetHint = isVba && typeof filterToNewSheetVbaHint === "function"
    ? filterToNewSheetVbaHint(source)
    : "";
  return [
    "불러온 .zip 스킬 파이프라인을 전체 실행하는 중입니다.",
    "사용자는 코딩을 전혀 모르므로, 사용자가 코드를 수정하거나 복구 버튼을 누르지 않아도 이 Step이 바로 실행되도록 고쳐야 합니다.",
    "실패한 Step 하나만 교체하세요. 이전/다음 Step의 작업을 반복하거나 새 기능을 추가하지 마세요.",
    isVba
      ? "반드시 하나의 ```vba 코드 블록만 출력하고, Sub B2BSkill() 전체 구현을 포함하세요."
      : "반드시 하나의 ```python 코드 블록만 출력하고, def transform(ctx): 전체 구현을 포함하세요.",
    isVba
      ? "실패한 Step은 VBA로 복구해야 합니다. Python COM으로 전환하면 대용량/조건/필터/매칭 작업에서 저사양 VM이 멈출 수 있으므로 Python def transform(ctx)는 절대 작성하지 마세요."
      : "실패한 Step이 VBA였더라도 이번 자동복구는 Python/ctx 로 작성하세요. ctx 헬퍼나 ctx.read/write 로 해결하고, 적용 전 안전검사에 걸려도 다시 VBA로 전환하지 않습니다.",
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
    duplicateDeleteHint,
    duplicateDeleteHint ? "" : null,
    filterToSheetHint,
    filterToSheetHint ? "" : null,
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
      "- 저장된 VBA Step이 실패한 뒤의 복구입니다. 기존 VBA를 그대로 고치려 하지 말고 현재 Python COM ctx API로 같은 작업을 다시 작성하세요.",
      "- 사용자가 원래 요청에서 명시적으로 'vba로/매크로로'라고 한 경우가 아니라면 Python 복구 후보를 VBA로 되돌리지 마세요.",
      "- 작업에 맞는 ctx 헬퍼가 있으면 헬퍼를 우선 사용하세요(ctx.copy_sheet/rename_sheet/add_sheet/delete_sheet/sort/filter_to_sheet/pivot/shift_months/delete_rows/delete_cols 등).",
      "- ctx.copy 로 값만 복사하지 마세요. 값/값만 요청은 ctx.read 후 ctx.write(..., overwrite_formulas=True) 흐름으로 작성하세요.",
      "- 대량 행 삭제는 가능한 한 행을 하나씩 지우는 긴 루프를 피하고 ctx 헬퍼/벌크 방식으로 작성하세요. 헬퍼로 처리할 수 없는 경우에는 실패를 숨기지 말고 raise ValueError로 알리세요.",
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

function unescapeVbaStringLiteralBody(body) {
  return String(body || "")
    .replace(/\\"/g, '"')
    .replace(/""/g, '"');
}

function pythonStringLiteral(value) {
  return JSON.stringify(String(value == null ? "" : value));
}

function localRepairActiveSheetUsedRangeFormatVba(code, step) {
  const text = String(code || "");
  if (!/\bSub\s+B2BSkill\s*\(/i.test(text)) return null;
  const stripped = stripVbaCommentsForPipelineRuntimeGate(text);
  if (!/\b(?:ActiveWorkbook\s*\.\s*)?ActiveSheet\b[\s\S]{0,240}\bUsedRange\b/i.test(stripped)
      && !/\bUsedRange\b[\s\S]{0,240}\b(?:ActiveWorkbook\s*\.\s*)?ActiveSheet\b/i.test(stripped)) {
    return null;
  }
  if (!/\bFor\s+Each\s+[A-Za-z_]\w*\s+In\s+[^\r\n:]+?\.Cells\b/i.test(stripped)) return null;

  // 자동 변환은 "셀마다 회계/숫자 서식 적용"만 다룬다. 값/수식/삭제/색상 변경까지 섞인
  // UsedRange 루프는 작업 의미가 달라질 수 있어 LLM 복구 또는 사용자 확인 대상으로 남긴다.
  const withoutNumberFormat = stripped.replace(
    /\b[A-Za-z_]\w*\s*\.\s*NumberFormat(?:Local)?\s*=\s*"((?:\\.|""|[^"])*)"/gi,
    "",
  );
  if (/\b[A-Za-z_]\w*\s*\.\s*(?:Value2?|Formula(?:R1C1)?|Style|Clear(?:Contents|Formats)?|Delete|EntireRow|EntireColumn|Interior\s*\.|Font\s*\.)/i.test(withoutNumberFormat)) {
    return null;
  }

  const fmtMatch = stripped.match(/\.\s*NumberFormat(?:Local)?\s*=\s*"((?:\\.|""|[^"])*)"/i);
  if (!fmtMatch) return null;
  const fmt = unescapeVbaStringLiteralBody(fmtMatch[1]);
  if (!fmt.trim()) return null;
  const targetSheet = inferPipelineStepTargetSheetName(step) || null;
  const sheetLine = targetSheet
    ? `    sheet = ${pythonStringLiteral(targetSheet)}`
    : "    sheet = ctx.sheets()[0]";

  const repaired = [
    "def transform(ctx):",
    "    # 레거시 VBA ActiveSheet+UsedRange 셀 반복 서식 작업을 범위 단위 COM 호출로 복구",
    sheetLine,
    "    last_r = ctx.last_row(sheet)",
    "    last_c = ctx.last_col(sheet)",
    "    if last_r < 1 or last_c < 1:",
    "        raise ValueError(\"데이터 범위가 없습니다.\")",
    "",
    "    def col_to_letter(c):",
    "        s = \"\"",
    "        while c > 0:",
    "            c, r = divmod(c - 1, 26)",
    "            s = chr(r + 65) + s",
    "        return s",
    "",
    "    rng = f\"A1:{col_to_letter(last_c)}{last_r}\"",
    `    ctx.set_number_format(sheet, rng, ${pythonStringLiteral(fmt)})`,
  ].join("\n");
  return {
    code: repaired,
    language: "python",
    description: "활성 시트 사용 범위 셀서식을 범위 단위로 변경",
  };
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
  if (language === "vba" && /ActiveSheet|UsedRange|UsedRange\.Cells/i.test(reasonText + "\n" + code)) {
    const repaired = localRepairActiveSheetUsedRangeFormatVba(code, step);
    if (repaired) return repaired;
  }
  if (language === "vba" && /Application\.(?:ScreenUpdating|Calculation|EnableEvents|DisplayAlerts)|Cleanup|Copy\s+Destination/i.test(reasonText + "\n" + code)) {
    const repaired = localRepairCopyPasteVbaCleanup(code);
    if (repaired) return { code: repaired, language: "vba", description: step.description || "교차 워크북 범위 복사 붙여넣기" };
  }
  return null;
}

async function autoRepairPipelineStep(stepIdx, reason, repairCount) {
  const step = state.pipeline && state.pipeline[stepIdx];
  if (!step || !step.code) throw createPipelineStepError(stepIdx, step, "자동 복구할 Step 코드를 찾지 못했습니다.");
  const targetLanguage = choosePipelineRepairLanguage(step, reason || {}, repairCount || 0);
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
  // targetLanguage=python 인 자동복구에서 로컬 VBA 수리가 끼어들면 사용자가 본 "VBA 실패 → ctx 복구"
  // 원칙이 깨진다. 로컬 수리는 대상 언어와 일치할 때만 사용한다.
  if (localRepair && localRepair.code && localRepair.language === targetLanguage) {
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
        trustedStatic: false,
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
    if (language === "python" && targetLanguage === "python" && Number(repairCount || 0) < 1) {
      return autoRepairPipelineStep(stepIdx, {
        ...(reason || {}),
        forceLanguage: "python",
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
    trustedStatic: false,
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
  const repairSource = String(options.source || "");
  const runOptions = { ...options };
  delete runOptions.maxRepairs;
  delete runOptions.source;
  let repairsDone = 0;
  const repairsByStep = new Map();
  let lastErr = null;
  const pipelineForRepair = runOptions.pipeline || state.pipeline;

  const resumeIdx = getPipelineResumeFromIndex();
  if (Number.isInteger(resumeIdx) && !runOptions.ignoreCheckpoint) {
    return runPipelineSuffixFromCheckpoint(resumeIdx, runOptions);
  }

  // [사용자/Codex 진단] 저장된(이미 검증된) 스킬을 전체실행할 때, 정적 게이트 자동복구가 VBA 를 매번
  // LLM 으로 재생성하며 느려지고("스텝2 자동복구 오래걸림") 원본 코드를 갈아치웠다 — 이게 문제의 한 축.
  // VBA 가 포함된 파이프라인은 정적 게이트 자동복구(실행 전 재생성)를 건너뛰고 저장된 코드를 그대로
  // 실행한다(위험 VBA 의 Cleanup 누락 등은 happy-path 에선 문제 없고, 실패 시엔 서버가 상태를 복원).
  const _pipelineHasVba = (pipelineForRepair || []).some(
    s => s && s.code && String(s.language || "").toLowerCase() !== "python"
  );

  while (repairsDone <= PIPELINE_AUTO_REPAIR_MAX_REPAIRS) {
    const preflight = _pipelineHasVba ? null : findPipelineStaticPreflightFailure(runOptions.pipeline || state.pipeline);
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
      // 실패 원인이 "앞 단계에서 만들어졌어야 하는 중간 시트 누락"이면, 해당 Step 코드를
      // Python/VBA 로 억지 자동복구하지 않는다. 대화 기록에 남은 시트 생성 후보를 사용자에게
      // "삽입"하도록 보여주는 것이 정답이다. 그렇지 않으면 Step 3만 고쳐도 계속 같은 시트 없음
      // 오류가 반복된다.
      if (typeof findMissingDependencySkillSuggestion === "function" && findMissingDependencySkillSuggestion(info)) {
        throw err;
      }
      const step = state.pipeline[stepIdx];
      let restoredToCheckpoint = false;
      // [SBAGENT-198] 실행기 headless 전체실행(파일출력)은 라이브를 건드리지 않으므로 실패 시 체크포인트
      // 복원이 불필요하다. 복원 경로(/api/excel/replace)는 headless 가드 없이 백엔드가 app.Visible=True 로
      // excel_open_<hash> 작업사본 창을 화면에 띄우고, 무변형 라이브 세션을 격리 실행 중간 스냅샷으로
      // 교체까지 하므로 실행기에서는 건너뛴다(에러 보고/복구 UI 는 그대로 동작).
      const _runnerHeadlessNow = typeof excelMirror !== "undefined" && excelMirror && !!excelMirror.runnerHeadless;
      if (!_runnerHeadlessNow && step && pipelineStepLiveLanguage(step)) {
        try {
          restoredToCheckpoint = await restorePipelineToCheckpointAndHold(stepIdx, state.pipeline, {
            message: `Step ${stepIdx + 1} 직전 상태로 되돌리는 중...`,
            pendingLabel: "오류 후 보류",
            toast: `Step ${stepIdx + 1} 직전 상태로 복구했습니다. 실패한 단계부터 보류 상태입니다.`,
            // [적용됨-미반영 수정] bg 전체실행 실패(라이브 무손상)면 백엔드의 전-파일 실패시점
            // 스냅샷으로 복원하고, prefix 파일 커버리지가 검증될 때만 '적용됨'을 찍는다.
            failState: { ...info, liveUntouched: !!(err && err._liveUntouched) },
          });
          if (restoredToCheckpoint && err && typeof err === "object") {
            err._stepInfo = {
              ...(err._stepInfo || info),
              restoredToCheckpoint: true,
            };
            err.errorInfo = err._stepInfo;
          }
        } catch (restoreErr) {
          console.warn("[pipeline] failed to restore checkpoint after runtime failure", restoreErr);
        }
      }
      // 캡처한 복붙은 '사용자가 실제로 한 동작의 정확 좌표 재생'이 목적이다. LLM 자동복구로
      // 재생성하면 동작이 바뀌고(복붙 버그 재발) 같은 실패를 반복하며 "박힘" → 재생성하지 말고 그대로 보고.
      if (step && step.code && /\[복붙 캡처\]/.test(String(step.code))) throw err;
      if (shouldSkipRuntimeAutoRepairForStep(step, {
        source: repairSource,
        hardRuntimeBlock: !!(info && info.hardRuntimeBlock),
      })) throw err;
      const key = step.id || `idx:${stepIdx}`;
      const count = repairsByStep.get(key) || 0;
      if (count >= PIPELINE_AUTO_REPAIR_MAX_PER_STEP || repairsDone >= PIPELINE_AUTO_REPAIR_MAX_REPAIRS) throw err;
      repairsByStep.set(key, count + 1);
      repairsDone += 1;
      const repairedStep = await autoRepairPipelineStep(stepIdx, {
        kind: "runtime",
        errorInfo: info,
        message: err && err.message || String(err || ""),
      }, count);
      // Runtime 실패는 이미 앞 단계가 라이브 Excel에 적용된 뒤 발생한다. 복구 후 전체 재실행으로
      // 돌아가면 1..N이 다시 반복되어 값복붙/누적/외부쓰기 단계가 중복될 수 있다. 실패 스텝
      // 직전 스냅샷이 있으면 그 지점으로 되돌린 뒤 실패 스텝부터만 이어 실행한다.
      if (repairedStep && pipelineStepLiveLanguage(repairedStep)) {
        try {
          const restored = restoredToCheckpoint || await restorePipelineCheckpointForSuffix(stepIdx, state.pipeline, {
            message: `Step ${stepIdx + 1} 직전 상태로 되돌리는 중...`,
          });
          if (restored) {
            markPipelinePendingFromIndex(stepIdx, { label: "자동 복구 후 보류" });
            return await runPipelineSuffixFromCheckpoint(stepIdx, {
              ...runOptions,
              ignoreCheckpoint: true,
            });
          }
          // [데드엔드 제거] 실패 step 직전 스냅샷이 없으면(백엔드 호출 전 클라단 실패라 스냅샷이 아예 안 떠진
          // 경우 등) 이어실행을 못 한다. 예전엔 '중복 적용 방지' 명목으로 여기서 중단(데드엔드)했지만, 전체실행은
          // reset:true 로 항상 pristine 부터(+관련 파일 전부 리셋) 다시 돌므로 전체 재실행이 안전하다. → 보류
          // 체크포인트를 비우고 자동복구된 코드로 전체 재실행한다(loop 계속). 같은 실패가 반복되면 repair 한도에서
          // '진짜 오류'(lastErr)로 보고된다 — 혼란스러운 "스냅샷 없음" 메시지 대신.
          console.warn("[pipeline] no pre-step snapshot for suffix resume; falling back to full pristine re-run", { stepIdx });
          clearPipelineResumeFromIndex();
          continue;
        } catch (resumeErr) {
          console.warn("[pipeline] auto-repair suffix resume failed; cancelling full retry", resumeErr);
          throw resumeErr;
        }
      }
    }
  }
  throw lastErr || new Error("파이프라인 자동 복구 한도를 초과했습니다.");
}

$("btn-run").onclick = async () => {
  // [전체실행 = 항상 원본부터] 직전 실패/타임아웃이 남긴 '보류 체크포인트'를 그대로 물려받으면 reset(원본복원)을
  // 건너뛴 채(skipReset) 실행돼, 입력 워크북이 이전 실행 중간상태(예: Step9에서 Sheet1→06_DAS 이름변경된 뒤)로
  // 남은 채 1단계부터 "시트 못 찾음"으로 터진다. 명시적 '전체실행'은 보류 체크포인트를 무시·초기화하고 항상 원본부터
  // 전체 재실행한다(편집 후 자동 빠른적용 runFromCheckpointAfterEdit 은 이 버튼을 안 타므로 무관).
  clearPipelineResumeFromIndex();
  const activeStepIds = getPipelineExecutionStepIds();
  setGeneratorRunLoading(true, "\uC2E4\uD589 \uC900\uBE44 \uC911...");
  setPipelineRuntimeStatus(activeStepIds, "running", "\uC2E4\uD589 \uC911");
  try {
    clearPipelineExecutionMemory({ keepViewer: true });
    await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true });
    setPipelineRuntimeStatus(activeStepIds, "applied", "\uC801\uC6A9\uB428");
    toast(`${state.pipeline.length}개 단계 실행 완료`, "success");
  } catch (err) {
    markPipelineRunFailureStatus(err, activeStepIds);
    renderExcelViewer();
    reportPipelineError(err);
  } finally {
    setGeneratorRunLoading(false);
  }
};

// [#2 결과 편집하기 — 실행기 버튼] 누르면 (1) 생성기로 전환하고 (2) 실행기(헤드리스/파일출력)가 만든 결과
// 파일(최종본)을 라이브 세션에 '가볍게 불러오기'(/api/excel/replace, 재계산 없음)해서 편집 가능 상태로 띄운다.
// 실행기 전체실행이 만든 스텝별 스냅샷이 그대로 라이브에 wiring 돼 있어 불러온 뒤 ON/OFF·이어실행 편집이 바로
// 된다(전체 재실행 불필요). 실행기 결과가 없으면 생성기 sync 재적용으로 폴백.
// (#3: 불러온 뒤 noteLivePipelineApplied 로 시그니처를 채워 토글 fast-path 정합)
(function () {
  const btn = (typeof $ === "function") ? $("runner-edit-result-btn") : null;
  if (!btn) return;
  btn.onclick = async () => {
    if (btn.disabled) return;
    // 실행기 버튼 → 즉시 생성기로 전환(헤드리스 해제·우측 패널 펼침). 이후 결과를 라이브에 불러와 보여준다.
    if (typeof setPage === "function") setPage("generator");
    const hasSteps = Array.isArray(state.pipeline) && state.pipeline.some(s => s && s.code && s.enabled !== false);
    if (!hasSteps) { if (typeof toast === "function") toast("라이브에 반영할 활성 스킬 단계가 없습니다.", "error"); return; }
    const busyReason = typeof pipelineEditBusyReason === "function" ? pipelineEditBusyReason() : "";
    if (busyReason) { if (typeof toast === "function") toast(busyReason, "error"); return; }
    const outs = (typeof window !== "undefined" && Array.isArray(window.lastRunnerOutputs))
      ? window.lastRunnerOutputs.filter(o => o && o.excelId && o.downloadId) : [];
    const activeStepIds = getPipelineExecutionStepIds();
    if (typeof setGeneratorRunLoading === "function") {
      setGeneratorRunLoading(true, outs.length ? "최종 결과를 라이브에 불러오는 중..." : "최종 상태를 라이브에 반영 중...");
    }
    setPipelineRuntimeStatus(activeStepIds, "running", "반영 중");
    try {
      if (outs.length) {
        // 가벼운 경로: 실행기 결과 파일(최종본)을 각 라이브 세션에 불러오기(재계산 없음 — 스냅샷-복원과 동일 메커니즘).
        let loaded = 0, lastExcelId = null;
        const loadedExcelIds = [];
        for (const o of outs) {
          try {
            await postExcelMirror("/api/excel/replace", { excelId: o.excelId, resultId: o.downloadId, readOnlyMirror: false }, 0, {
              timeoutMs: 120000,
              timeoutMessage: "결과 불러오기 응답이 지연되어 중단했습니다.",
            });
            loaded++; lastExcelId = o.excelId; loadedExcelIds.push(o.excelId);
          } catch (e) { console.warn("[#2] 결과 불러오기 실패:", o && o.name, e); }
        }
        if (!loaded) throw new Error("결과 파일을 라이브에 불러오지 못했습니다. 실행기에서 전체실행을 다시 해주세요.");
        clearPipelineResumeFromIndex();
        // [빠른 OFF/삭제] 실행기 전체실행이 만든 스텝별 pre-apply 스냅샷을 '지금 라이브에 불러온' state.pipeline
        // 스텝에 재연결한다. 이러면 마지막 단계 OFF/삭제가 reconcile(reset+재적용) 없이 스냅샷 되돌림으로 즉시 처리된다.
        try {
          if (Array.isArray(window.lastRunnerStepSnapshots) && window.lastRunnerStepSnapshots.length
              && typeof wirePipelineStepSnapshots === "function") {
            wirePipelineStepSnapshots(window.lastRunnerStepSnapshots, lastExcelId, state.pipeline);
          }
        } catch (_) {}
        noteLivePipelineApplied(state.pipeline);  // 라이브 = 최종(전 스텝 적용) → 토글 fast-path 정합
        setPipelineRuntimeStatus(activeStepIds, "applied", "적용됨");
        // [교차파일 뷰 결정성] 여러 파일을 로드했을 때, '마지막에 로드된 파일'(백엔드 나열 순서에 좌우 → 플래키)이
        // 아니라 '마지막으로 실행된 스텝이 건드린 파일'을 보여준다(라이브 단일적용과 대칭). 예: 마지막 스텝이
        // ctx.book("B").add_sheet("새시트") 면 B 를 표시 → 방금 만든 새 시트가 항상 보인다(안 보였다 보였다 하던 원인).
        let viewExcelId = lastExcelId;
        try {
          const enabled = activePipelineSteps(state.pipeline);
          const lastStep = enabled.length ? enabled[enabled.length - 1] : null;
          const lastFileId = lastStep && typeof inferPipelineStepTargetFileId === "function"
            ? inferPipelineStepTargetFileId(lastStep) : null;
          if (lastFileId) {
            const match = loadedExcelIds.find(eid =>
              (typeof fileIdForExcelMirrorId === "function" ? fileIdForExcelMirrorId(eid) : null) === lastFileId);
            if (match) viewExcelId = match;
          }
        } catch (_) {}
        if (viewExcelId && typeof showOnlyExcelMirrorWindow === "function") {
          try { await showOnlyExcelMirrorWindow(viewExcelId, { force: true }); } catch (_) {}
        }
        if (typeof toast === "function") toast("실행기 결과(최종본)를 라이브에 불러왔습니다. 이제 편집/ON·OFF가 가능합니다.", "success");
      } else {
        // 폴백: 실행기 결과가 없으면 생성기 sync 재적용(라이브 reset→재적용)으로 최종 상태를 만든다.
        clearPipelineResumeFromIndex();
        clearPipelineExecutionMemory({ keepViewer: true });
        await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true });
        setPipelineRuntimeStatus(activeStepIds, "applied", "적용됨");
        if (typeof toast === "function") toast("실행기 결과가 없어 재적용으로 최종 상태를 띄웠습니다. 편집/ON·OFF 가능합니다.", "success");
      }
    } catch (err) {
      markPipelineRunFailureStatus(err, activeStepIds);
      renderExcelViewer();
      reportPipelineError(err);
    } finally {
      if (typeof setGeneratorRunLoading === "function") setGeneratorRunLoading(false);
    }
  };
})();

// [복붙 캡처] 우측 라이브 엑셀에서 Ctrl+C(복사) → Ctrl+V(붙여넣기) 한 직후 이 버튼을 누르면,
// 서버가 클립보드(소스 범위)와 현재 선택영역(붙여넣은 대상)을 역추적해 ctx.paste_copied(...) 스킬 단계로
// 저장한다. Excel 네이티브 복사를 그대로 재생하므로 값/수식/서식이 보존되고, LLM 추측이 없어 복붙 버그가 없다.
// (재생은 Python COM 경로 → VBA 러너를 타지 않음.)
(function () {
  const btn = (typeof $ === "function") ? $("btn-capture-copypaste") : null;
  const valuesOnlyInput = (typeof $ === "function") ? $("capture-copypaste-values-only") : null;
  if (!btn) return;
  btn.onclick = async () => {
    const excelId = (typeof vbaTargetExcelId === "function" && vbaTargetExcelId())
      || (typeof currentExcelId === "function" && currentExcelId());
    if (!excelId) { toast("먼저 우측에 엑셀 파일을 열어 주세요", "error"); return; }
    const valuesOnly = !!(valuesOnlyInput && valuesOnlyInput.checked);
    btn.disabled = true;
    if (valuesOnlyInput) valuesOnlyInput.disabled = true;
    try {
      const data = await postExcelMirror("/api/excel/capture-copypaste", { excelId, valuesOnly }, 0, { timeoutMs: 20000 });
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
      if (valuesOnlyInput) valuesOnlyInput.disabled = false;
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
      // [사용자 지시] Python COM 읽기 한도 초과 같은 '하드 VBA 전환' 런타임 오류는 사용자가 복구 버튼을
      // 누를 때까지 멈춰 있지 말고, 기존 에러복구 흐름(requestErrorRecovery → VBA 전환)을 즉시 자동 발사한다.
      // 가드 플래그는 공유 err 객체에 둬서 chat/runner 양쪽 렌더에서 한 번만 자동 발사되게 한다.
      if (err && typeof err === "object"
          && !err.__autoReadLimitVbaTried
          && typeof isPythonComReadLimitRuntimeError === "function"
          && isPythonComReadLimitRuntimeError(info.message || (err && err.message) || "")) {
        err.__autoReadLimitVbaTried = true;
        setTimeout(() => { if (recoverBtn && !recoverBtn.disabled) recoverBtn.click(); }, 0);
      }
    }
    if (typeof offerMissingDependencySkillCandidate === "function") {
      try { offerMissingDependencySkillCandidate(info); } catch (suggestErr) { console.warn("[pipeline] missing dependency suggestion failed", suggestErr); }
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

function pipelineExtractAssistantCode(text) {
  if (typeof extractCode === "function") return extractCode(String(text || ""));
  const m = /```(?:vba|vb|python|py|javascript|js)?\s*([\s\S]*?)```/i.exec(String(text || ""));
  return m ? m[1].trim() : "";
}

function pipelineSheetLiteralsFromCode(code) {
  const text = String(code || "");
  const out = new Set();
  const patterns = [
    /\b(?:Worksheets|Sheets)\s*\(\s*["']([^"']+)["']\s*\)/gi,
    /\b[A-Za-z_][A-Za-z0-9_]*\s*\.\s*Name\s*=\s*["']([^"']+)["']/gi,
    /\bStrComp\s*\(\s*[^,\r\n)]*\.Name\s*,\s*["']([^"']+)["']/gi,
    /\bctx\.(?:sheet|read|write|clear|sort|filter_to_sheet|pivot|add_sheet)\s*\(\s*["']([^"']+)["']/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) out.add(String(m[1]));
    }
  }
  return [...out];
}

function pipelineCodeCreatesSheetNamed(code, sheetName) {
  const text = String(code || "");
  const escaped = String(sheetName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  const hasAdd = /\bWorksheets\s*\.\s*Add\b|\bSheets\s*\.\s*Add\b|\bctx\.add_sheet\s*\(|\bctx\.filter_to_sheet\s*\(|\bctx\.pivot\s*\(/i.test(text);
  const namesSheet = new RegExp("\\.\\s*Name\\s*=\\s*[\"']" + escaped + "[\"']|new_name\\s*=\\s*[\"']" + escaped + "[\"']|[\"']" + escaped + "[\"']", "i").test(text);
  return hasAdd && namesSheet;
}

function pipelinePriorStepCreatesSheet(stepIdx, sheetName) {
  const idx = Number(stepIdx);
  if (!Number.isInteger(idx) || idx <= 0) return false;
  const steps = Array.isArray(state.pipeline) ? state.pipeline : [];
  for (let i = 0; i < idx && i < steps.length; i += 1) {
    if (pipelineCodeCreatesSheetNamed((steps[i] && steps[i].code) || "", sheetName)) return true;
  }
  return false;
}

function findChatHistorySheetCreationCandidate(sheetName, failedCode) {
  const history = Array.isArray(state.chatHistory) ? state.chatHistory : [];
  const failed = String(failedCode || "").trim();
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i] || {};
    if (item.role !== "assistant") continue;
    const content = String(item.content || "");
    const code = pipelineExtractAssistantCode(content);
    if (!code || String(code).trim() === failed) continue;
    if (!pipelineCodeCreatesSheetNamed(code, sheetName)) continue;
    let sourceUserMessage = "";
    for (let j = i - 1; j >= 0; j--) {
      const prev = history[j] || {};
      if (prev.role === "user") {
        sourceUserMessage = String(prev.content || "");
        if (!sourceUserMessage.includes("## 막힌 코드") && !/정적\s*안전\s*검사|안전\s*검사에서\s*막/i.test(sourceUserMessage)) break;
      }
    }
    return { content, code, sourceUserMessage, historyIndex: i };
  }
  return null;
}

function findMissingDependencySkillSuggestion(info) {
  const stepIdx = Number(info && info.stepIdx);
  if (!Number.isInteger(stepIdx) || stepIdx < 0) return null;
  const failedCode = String((info && info.code) || "");
  const sheets = pipelineSheetLiteralsFromCode(failedCode);
  if (!sheets.length) return null;
  for (const sheetName of sheets) {
    if (pipelinePriorStepCreatesSheet(stepIdx, sheetName)) continue;
    const candidate = findChatHistorySheetCreationCandidate(sheetName, failedCode);
    if (!candidate) continue;
    return { stepIdx, sheetName, candidate, insertPos: stepIdx + 1 };
  }
  return null;
}

function offerMissingDependencySkillCandidate(info) {
  const suggestion = findMissingDependencySkillSuggestion(info);
  if (!suggestion) return;
  window.__b2bMissingDependencySuggestions = window.__b2bMissingDependencySuggestions || new Set();
  const { stepIdx, sheetName, candidate, insertPos } = suggestion;
  const key = `${stepIdx}:${sheetName}`;
  if (window.__b2bMissingDependencySuggestions.has(key)) return;
  // 오류 문구가 백엔드 timeout/인코딩 문제로 뭉개져도, 실패 코드가 중간 시트를 전제로 하고
  // 저장된 대화 기록에 그 시트를 만드는 후보가 있으면 복구 후보로 보여준다.
  window.__b2bMissingDependencySuggestions.add(key);
  addMessage(
    "system",
    `이 Step은 "${sheetName}" 시트가 이미 있다고 가정하지만, 현재 파이프라인 앞 단계에는 그 시트를 만드는 스킬이 없습니다.\n` +
    `저장된 대화 기록에서 "${sheetName}" 시트를 만드는 후보 코드를 찾았습니다. 아래 후보의 "삽입"을 눌러 ${insertPos}번 위치(Step ${stepIdx + 1} 앞)에 넣은 뒤 전체실행을 다시 눌러 주세요.`
  );
  if (typeof addAssistantReply === "function") {
    addAssistantReply(candidate.content, {
      sourceUserMessage: candidate.sourceUserMessage,
      suggestInsertPosition: insertPos,
    });
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
    const resumeIdx = getPipelineResumeFromIndex();
    // 실패 직후 checkpoint 로 보류된 상태라면, 복구 버튼이 같은 깨진 step을
    // 먼저 재실행하면 안 된다. 실패 step을 먼저 교체한 뒤 보류 구간을 실행한다.
    if (Number.isInteger(stepIdx) && stepIdx >= 0 && state.pipeline[stepIdx] &&
        (Number.isInteger(resumeIdx) || (errorInfo && (errorInfo.restoredToCheckpoint || errorInfo.hardRuntimeBlock)))) {
      await autoRepairPipelineStep(stepIdx, {
        kind: errorInfo && errorInfo.hardRuntimeBlock ? "runtime-hard-block" : "runtime",
        errorInfo: errorInfo || {},
        message: errorInfo && errorInfo.message || "실패한 저장 스킬 복구",
        failures: errorInfo && errorInfo.rawError ? [errorInfo.rawError] : [],
      }, 0);
    }
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
    // [사용자 지시] 읽기 한도 초과 오류는 파일/시트 참조 자동보정(attemptRunnerAutoRecovery)으로 풀리지 않는다.
    // 구조보정을 건너뛰고 LLM 복구(requestErrorRecovery → VBA 전환)로 보내, 아래에서 즉시 자동 발사한다.
    const isReadLimitRuntime = typeof isPythonComReadLimitRuntimeError === "function"
      && isPythonComReadLimitRuntimeError(message);
    const canAutoRecover = Number.isInteger(runnerStepIdx) && runnerStepIdx >= 0
      && !!state.pipeline[runnerStepIdx] && !isReadLimitRuntime;
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
    // [사용자 지시] 읽기 한도 초과 오류는 버튼을 기다리지 말고 즉시 VBA 전환 복구를 자동 발사한다.
    // 가드 플래그는 공유 err 객체에 둔다(reportPipelineError 가 이 함수를 먼저 호출하므로 chat 쪽은 중복 발사 안 함).
    if (err && typeof err === "object"
        && !err.__autoReadLimitVbaTried
        && isReadLimitRuntime) {
      err.__autoReadLimitVbaTried = true;
      setTimeout(() => { if (recoverBtn && !recoverBtn.disabled) recoverBtn.click(); }, 0);
    }
  }
  const openBtn = panel.querySelector(".runner-error-open-generator");
  if (openBtn) openBtn.onclick = () => { if (typeof setPage === "function") setPage("generator"); };
}

$("runner-run-btn").onclick = () => {
  if ($("runner-run-btn").disabled) return;
  clearRunnerPipelineError();
  if (!state.runnerMappingChecked) {
    if (typeof window.runnerShowMappingPanel === "function") {
      window.runnerShowMappingPanel();
    } else {
      state.runnerMappingChecked = true;
    }
    return;
  }
  if (typeof runnerMappingHasBlockingMissing === "function" && runnerMappingHasBlockingMissing()) {
    toast("선택 필요 항목을 먼저 매핑해 주세요.", "error");
    return;
  }
  // [생성기 전체실행과 로직 일치] 실행 전 '실행 중' / 성공 후 '적용됨' 으로 스텝 상태를 동일하게 갱신한다.
  // (실행 자체는 양쪽 다 runPipelineWithAutoRepair 로 동일. 실행기는 이 상태 표시만 빠져 있었다.)
  // [전체실행 = 항상 원본부터] 보류 체크포인트를 무시·초기화해 reset(원본복원)을 건너뛰지 않게 한다(생성기와 동일).
  clearPipelineResumeFromIndex();
  const activeStepIds = getPipelineExecutionStepIds();
  if (window.runnerSetRunning) window.runnerSetRunning(true);
  setPipelineRuntimeStatus(activeStepIds, "running", "실행 중");
  // Give the UI a tick to paint the ring, then execute
  setTimeout(async () => {
    // [매핑 일관성] 실행 '동안만' state.pipeline 을 매핑본으로 교체한다(자동복구·이어실행이 state.pipeline 을
    // 읽으므로). 복원/원본보관은 beginMappedPipelineRun 이 전담 — 예전엔 여기서 지역변수로만 원본을 들고 있어,
    // 실행 중 renderPipeline→ensurePipelineStepIds 가 state.pipeline 을 새 배열로 갈아끼우면 복원이 어긋나
    // 치환본(날짜 박힌 파일명 + 세션 전용 해시 시트명)이 저장 스킬에 그대로 새어 나갔다(실측 확인).
    const __mapRun = beginMappedPipelineRun();
    const runnerPipeline = __mapRun.steps;
    try {
      clearPipelineExecutionMemory({ keepViewer: true });
      await runPipelineWithAutoRepair({ source: "runner", ignoreCheckpoint: true, backgroundMode: true, outputMode: "file", pipeline: runnerPipeline });
      setPipelineRuntimeStatus(activeStepIds, "applied", "적용됨");
      toast(`${state.pipeline.length}개 단계 실행 완료`, "success");
      if (window.runnerSetDone) window.runnerSetDone();
    } catch (err) {
      renderExcelViewer();
      markPipelineRunFailureStatus(err, activeStepIds);
      reportPipelineError(err, { compatibilityCheck: true, runner: true });
      if (window.runnerSetRunning) window.runnerSetRunning(false);
    } finally {
      __mapRun.restore();
    }
  }, 650);
};
$("runner-download-btn").onclick = async () => {
  // [실행기 파일출력] 직전 실행이 파일출력(outputMode:file)이면, 변경된 '모든' 파일(수정된 입력 포함)을
  // 한 zip(전체 다운로드)으로 받는다 — 기존 전체 다운로드와 동일하게 /api/workbooks/archive(서버 zip) 사용.
  // (file 모드는 라이브를 안 건드려서 기존 collectAllDownloadFiles 기반 zip 은 옛 상태라 안 맞음 → outputFiles 사용.)
  const outs = (typeof window !== "undefined" && Array.isArray(window.lastRunnerOutputs)) ? window.lastRunnerOutputs : null;
  if (outs && outs.length) {
    const btn = $("runner-download-btn");
    const original = btn ? btn.textContent : "";
    try {
      if (btn) { btn.disabled = true; btn.textContent = "ZIP 생성 중..."; }
      const filename = (typeof archiveFilename === "function") ? archiveFilename() : ("결과_" + Date.now() + ".zip");
      const resp = await fetch("/api/workbooks/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename,
          files: outs.map(o => ({ role: "output", downloadId: o.downloadId, name: o.name })),
        }),
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const blob = await resp.blob();
      if (typeof downloadArchiveBlob === "function") downloadArchiveBlob(blob, filename);
      if (typeof toast === "function") toast(`결과 ${outs.length}개 파일을 zip 으로 다운로드합니다.`, "success");
    } catch (err) {
      if (typeof toast === "function") toast("결과 다운로드 오류: " + (err && err.message ? err.message : err), "error");
      console.error(err);
    } finally {
      if (btn) { btn.textContent = original || "📥 전체 파일 다운로드"; if (typeof refreshRunButton === "function") refreshRunButton(); else btn.disabled = false; }
    }
    return;
  }
  if (typeof downloadAllFilesZip === "function") downloadAllFilesZip($("runner-download-btn"));
  else openDownloadModal();
};
$("runner-load-btn").onclick = () => openLoadDialog();

setupDrop($("drop-logic"), $("logic-files"), async (files) => {
  try {
    await loadLogicFiles(files);
  } catch (err) {
    toast("불러오기 실패: " + err.message, "error");
    console.error(err);
  }
});
