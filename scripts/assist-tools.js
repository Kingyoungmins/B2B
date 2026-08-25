/* ===================================================================
   AI 도움 — 도구 레지스트리
   ===================================================================
   설계 원칙(중요):
   - 여기에는 '읽기(read)' 도구만 둔다. 상태를 바꾸는 동작은 이 파일에 존재하지 않는다.
     LLM 이 지시를 어겨도 부를 수 있는 쓰기 함수가 없어서 못 어긴다("능력 부재"로 막는다).
   - 상태 변경은 assist-core 의 제안(proposal) → 사용자 승인 카드 경로에서만 일어난다.
   - 각 도구는 반드시 {ok, ...} 를 반환하고 절대 throw 하지 않는다. 실패도 데이터로 되먹여
     모델이 스스로 교정하게 한다(사용자에게 되묻는 것보다 성공률이 높다).
   =================================================================== */

const ASSIST_TOOLS = {};

function assistDefineTool(name, meta, fn) {
  ASSIST_TOOLS[name] = { name, desc: meta.desc, args: meta.args || "", fn };
}

function assistToolCatalog() {
  return Object.values(ASSIST_TOOLS)
    .map(t => `- ${t.name}(${t.args}) — ${t.desc}`)
    .join("\n");
}

async function assistRunTool(name, args) {
  const tool = ASSIST_TOOLS[name];
  if (!tool) {
    return { ok: false, error: "unknown_tool", given: name, available: Object.keys(ASSIST_TOOLS) };
  }
  try {
    const out = await tool.fn(args || {});
    return (out && typeof out === "object") ? out : { ok: true, value: out };
  } catch (err) {
    return { ok: false, error: "tool_failed", message: String((err && err.message) || err).slice(0, 300) };
  }
}

// ── 공통 헬퍼 ────────────────────────────────────────────────────────────────
function _assistSteps() {
  return Array.isArray(state.pipeline) ? state.pipeline : [];
}

// [라이브 캐시 갱신] AI 도움 data 도구는 state.inputs 미리보기 캐시만 읽는다. 파이프라인이
// 교차파일 붙여넣기 대상(컴패니언)을 바꿔도 liveSchema 는 주 세션만 실어 그 파일 캐시가 stale
// 로 남는다(실측: 정산서에 붙여넣었는데 AI 도움이 '데이터 없음'). 조회 직전, 그 파일에 열린
// 라이브 세션이 있으면 서버에서 '현재' 미리보기를 받아 캐시를 갱신한다 — '보이는 것'과 일치.
async function _assistRefreshLiveFile(f, sheet) {
  try {
    if (!f || typeof excelMirror === "undefined" || !excelMirror || !excelMirror.sessionsByFileId) return;
    if (typeof postExcelMirror !== "function" || typeof applyLiveSchemaToFileCache !== "function") return;
    let excelId = null;
    for (const [fid, eid] of Object.entries(excelMirror.sessionsByFileId)) {
      if (typeof getFile === "function" && getFile(fid) === f) { excelId = eid; break; }
    }
    if (!excelId) return;   // 업로드만 되고 라이브 미러 세션이 없는 파일 → 캐시 그대로
    // 조회 대상 시트만 읽는다(전 시트 UsedRange 읽기 회피 → excel_call 워커 점유 최소화,
    // record-start 등 다른 요청이 뒤에 줄서는 '준비 중' 지연 완화). 시트 미지정이면 전체.
    const body = { excelId };
    const sn = String(sheet || "").trim();
    if (sn) body.sheet = sn;
    const r = await postExcelMirror("/api/excel/preview-schema", body, 0, { timeoutMs: 15000 });
    if (r && r.ok && r.schema) applyLiveSchemaToFileCache(excelId, r.schema);
  } catch (_) { /* 라이브 직독 실패는 무해 — 캐시 그대로 진행 */ }
}

// [헤더행 감지 통일] 실무 파일은 제목/빈 행이 헤더 위에 있는 경우가 흔하다. sheet.headers 는
// 자동 감지하는데 data.query 는 rows[0] 을 하드코딩해 둘이 어긋났다(헤더가 2행이면 data.query 가
// 제목행을 헤더로 봐 unknown_column/오열). 같은 규칙을 공유해 일치시킨다.
function _assistDetectHeaderRow(rows, explicitHeaderRow) {
  if (Number.isInteger(Number(explicitHeaderRow)) && Number(explicitHeaderRow) >= 1) {
    return Math.min(Number(explicitHeaderRow) - 1, Math.max(0, (rows || []).length - 1));
  }
  let best = 0, bestScore = -1;
  for (let r = 0; r < Math.min((rows || []).length, 5); r++) {
    const row = rows[r] || [];
    const filled = row.filter(v => String(v == null ? "" : v).trim()).length;
    const texty = row.filter(v => typeof v === "string" && v.trim() && isNaN(Number(v))).length;
    const score = filled + texty;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}
function _assistStepIndexById(stepId) {
  const t = String(stepId || "").trim();
  if (!t) return -1;
  const steps = _assistSteps();
  const byId = steps.findIndex(s => s && String(s.id) === t);
  if (byId >= 0) return byId;
  const n = Number(t.replace(/[^0-9]/g, ""));      // "3", "3단계", "step3" 모두 허용
  if (Number.isInteger(n) && n >= 1 && n <= steps.length) return n - 1;
  return -1;
}
function _assistStepLabel(step, idx) {
  return `Step ${idx + 1}` + (step && (step.title || step.description) ? ` (${String(step.title || step.description).slice(0, 40)})` : "");
}
function _assistColLetter(idx) {   // 0→A, 25→Z, 26→AA
  let n = Number(idx) + 1, s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s || "A";
}
function _assistFileList() {
  const out = [];
  // [가시성 감사 ⑦] 이름·시트만 주면 '어떻게 올라갔는지'를 AI 가 모른다 — 가짜 시트명
  // (sheetNamesUnreliable: 백엔드가 못 읽어 파일명으로 지어낸 상태)과 검사 오류를 함께 싣는다.
  const push = (role, f, index) => {
    if (!f || !f.name) return;
    const item = { role, name: f.name, sheets: f.sheetNames || [] };
    if (index !== undefined) item.index = index;
    if (f.backendOnly) item.backendOnly = true;
    if (f.sheetNamesUnreliable) item.unreliableSheets = true;   // 이 시트명 목록을 근거로 쓰지 말 것
    if (f.inspectError) item.inspectError = String(f.inspectError).slice(0, 160);
    out.push(item);
  };
  (state.inputs || []).forEach(f => push("input", f));
  (state.outputTemplates || []).forEach((t, i) => push("output", t && (t.file || t.original), i));
  return out;
}

// ── 1. 스킬 전체 개요 ────────────────────────────────────────────────────────
assistDefineTool("pipeline.list", { desc: "스킬 전체 단계 목록(번호·설명·언어·대상 파일/시트·활성 여부·코드 길이)" },
  () => ({
    ok: true,
    stepCount: _assistSteps().length,
    steps: _assistSteps().map((s, i) => ({
      no: i + 1,
      id: s.id,
      title: s.title || s.description || "",
      language: s.language || "",
      targetFile: String(s.targetFileId || "").replace(/^input:/, ""),
      targetSheet: s.targetSheetName || "",
      enabled: typeof isStepEnabled === "function" ? isStepEnabled(s) : s.enabled !== false,
      codeChars: String(s.code || "").length,
    })),
  }));

// ── 2. 단계 코드 원문 ────────────────────────────────────────────────────────
assistDefineTool("pipeline.step", { desc: "특정 단계의 코드 원문과 메타", args: "stepId" },
  (a) => {
    const idx = _assistStepIndexById(a.stepId);
    if (idx < 0) {
      return { ok: false, error: "unknown_step", given: a.stepId,
               available: _assistSteps().map((s, i) => `${i + 1}:${s.id}`) };
    }
    const s = _assistSteps()[idx];
    return { ok: true, no: idx + 1, id: s.id, language: s.language || "",
             title: s.title || s.description || "",
             targetFile: String(s.targetFileId || "").replace(/^input:/, ""),
             targetSheet: s.targetSheetName || "",
             code: String(s.code || "").slice(0, 12000) };
  });

// ── 3. 업로드 파일/시트 구조 ─────────────────────────────────────────────────
assistDefineTool("schema.summary", { desc: "현재 업로드된 입력/출력 파일과 각 시트 이름" },
  () => ({ ok: true, files: _assistFileList() }));

// ── 4. 적용 상태 진단 (백엔드 호출 없음, 가장 자주 맞는 진단) ────────────────
assistDefineTool("diag.stepStatus", { desc: "각 단계가 라이브에 실제로 반영돼 있는지 3중 대조(상태칩·적용시그니처·스냅샷 신선도)" },
  () => {
    const steps = _assistSteps();
    const rows = steps.map((s, i) => {
      const st = (typeof getPipelineRuntimeStatus === "function" && getPipelineRuntimeStatus(s.id)) || {};
      const snap = s._preApplySnapshot;
      return {
        no: i + 1, id: s.id,
        statusChip: st.status || "(없음)",
        // [검토 #21] 상태 저장 형태는 {status, label} — st.text 는 존재하지 않는 필드라 항상 "" 였다.
        statusText: st.label || "",
        unappliedEdit: s._unappliedEdit === true,
        hasSnapshot: !!(snap && snap.resultId),
        snapshotAgeSec: (snap && snap.capturedAt) ? Math.round((Date.now() - snap.capturedAt) / 1000) : null,
      };
    });
    let sigMatch = null;
    try {
      if (typeof liveEnabledStepsSignature === "function" && typeof isLivePipelineApplied === "function") {
        sigMatch = isLivePipelineApplied() ? "적용기록 있음" : "적용기록 없음(초기화됨)";
      }
    } catch (_) {}
    const resume = (typeof getPipelineResumeFromIndex === "function") ? getPipelineResumeFromIndex() : null;
    return { ok: true, steps: rows, liveAppliedRecord: sigMatch,
             resumeFromStep: Number.isInteger(resume) ? resume + 1 : null,
             note: "unappliedEdit=true 는 코드는 고쳤지만 라이브에 아직 안 돌린 단계다." };
  });

// ── 5. 실행 전 점검 ──────────────────────────────────────────────────────────
assistDefineTool("preflight.check", { desc: "지금 전체실행하면 걸릴 문제(대상 미해결·실행 차단 사유)를 미리 점검" },
  () => {
    const steps = _assistSteps();
    const problems = [];
    try {
      if (typeof pipelineHasUnresolvedTarget === "function" && pipelineHasUnresolvedTarget(steps)) {
        problems.push({ kind: "unresolved_target", detail: "대상 파일이 해결되지 않은 단계가 있습니다(업로드 파일과 스킬의 파일명이 다를 수 있음)." });
      }
    } catch (_) {}
    steps.forEach((s, i) => {
      if (!s || !s.code) return;
      const enabled = typeof isStepEnabled === "function" ? isStepEnabled(s) : s.enabled !== false;
      if (!enabled) return;
      try {
        if (typeof findPipelineRuntimeExecutionBlocker === "function") {
          const blocker = findPipelineRuntimeExecutionBlocker([s]);
          if (blocker) problems.push({ kind: "blocked", step: i + 1, detail: String(blocker.message || blocker).slice(0, 200) });
        }
      } catch (_) {}
      const tid = String(s.targetFileId || "");
      if (tid.startsWith("input:") && typeof getFile === "function" && !getFile(tid)) {
        problems.push({ kind: "missing_file", step: i + 1, detail: `대상 파일 '${tid.slice(6)}' 이 현재 업로드 목록에 없습니다.` });
      }
    });
    // [SBAGENT-293 실측] '코드가 찾는 열 이름이 실제 파일에 없음'이 이 점검에 빠져 있었다 —
    // 30단계를 고쳐 8분을 다시 돌린 뒤 34단계가 같은 이유로 죽었다. 실행 전 게이트와 같은
    // 판정(pipelineHeaderMismatchReport)을 여기서도 돌려, AI 가 한 번에 전부 찾아 고치게 한다.
    try {
      if (typeof pipelineHeaderMismatchReport === "function") {
        pipelineHeaderMismatchReport(steps).forEach(r => {
          problems.push({ kind: "header_not_found", step: r.stepNo, detail: String(r.message).slice(0, 300) });
        });
      }
    } catch (_) {}
    return { ok: true, stepCount: steps.length, problemCount: problems.length, problems };
  });

// ── 6. 코드 속 하드코딩 스캔 (다음 달 재사용 사고 예방) ──────────────────────
assistDefineTool("literals.scan", { desc: "코드에 박힌 월·날짜·파일명·시트명 리터럴을 단계별로 수집(다음 달 재사용 시 고칠 지점)" },
  () => {
    // 앵커 상한을 명시한다 — 이 프로젝트에 정규식 백트래킹으로 수 분 멈춘 전례가 있다.
    const reMonth = /["']([^"'\r\n]{0,40}?\d{1,2}\s*월[^"'\r\n]{0,20})["']/g;
    const reDate = /["']([^"'\r\n]{0,40}?20\d{2}[-_.]?\d{1,2}[^"'\r\n]{0,20})["']/g;
    const reBook = /["']([^"'\r\n]{1,120}\.(?:xls[xmb]?|csv))["']/gi;
    const out = [];
    _assistSteps().forEach((s, i) => {
      const code = String(s.code || "").slice(0, 20000);
      const hits = { months: [], dates: [], books: [] };
      let m, n = 0;
      while ((m = reMonth.exec(code)) && n++ < 12) hits.months.push(m[1]);
      n = 0; while ((m = reDate.exec(code)) && n++ < 12) hits.dates.push(m[1]);
      n = 0; while ((m = reBook.exec(code)) && n++ < 12) hits.books.push(m[1]);
      reMonth.lastIndex = reDate.lastIndex = reBook.lastIndex = 0;
      if (hits.months.length || hits.dates.length || hits.books.length) {
        out.push({ step: i + 1, id: s.id, ...hits });
      }
    });
    return { ok: true, stepsWithLiterals: out.length, items: out };
  });

// ── 7. 데이터 질의 (클라이언트 미리보기 한정, 백엔드 호출 없음) ──────────────
assistDefineTool("data.query", {
  desc: "업로드 미리보기 데이터 조회. op=count|sum|distinct|sample|groupSum|groupCount. groupSum/groupCount 는 groupBy 열로 묶어 상위 topN(기본20). where=[{col,op,value}] 로 조건.",
  args: "file, sheet, op, column, groupBy?, topN?, where?, headerRow?",
}, async (a) => {
    const files = _assistFileList();
    const fname = String(a.file || "").trim();
    const f = (state.inputs || []).find(x => x && x.name === fname)
      || ((state.outputTemplates || []).map(t => t && (t.file || t.original)).find(x => x && x.name === fname));
    if (!f) return { ok: false, error: "unknown_file", given: fname, available: files.map(x => x.name) };
    await _assistRefreshLiveFile(f, a.sheet);   // 라이브 세션 있으면 캐시를 '현재'로 갱신 후 읽는다
    const sheets = f.sheets || {};
    const sname = String(a.sheet || "").trim();
    const rows = Array.isArray(sheets[sname]) ? sheets[sname] : null;
    if (!rows) {
      return { ok: false, error: "unknown_sheet", given: sname,
               available: f.sheetNames || Object.keys(sheets) };
    }
    if (!rows.length) return { ok: false, error: "empty_preview", note: "이 시트는 미리보기 데이터가 비어 있습니다." };
    // 헤더행 자동 감지(sheet.headers 와 동일) — 제목행이 위에 있어도 정확한 헤더/데이터 분리.
    const hr = _assistDetectHeaderRow(rows, a.headerRow);
    const header = (rows[hr] || []).map(v => String(v == null ? "" : v).trim());
    const _body = rows.slice(hr + 1);
    // [중복 헤더 개선] 같은 이름 헤더가 여러 열이면(예: 템플릿의 빈 '회사' A열 + 붙여넣은 '회사' D열)
    // '데이터가 있는' 열을 고른다 — first-match(빈 A열)로 잡아 개수 0 이 되던 실측 버그 방지.
    const _nonEmptyInCol = (idx) => _body.reduce((n, r) => n + ((r && String(r[idx] == null ? "" : r[idx]).trim()) ? 1 : 0), 0);
    const _pickBestCol = (indices) => {
      if (indices.length <= 1) return indices.length ? indices[0] : -1;
      let best = indices[0], bestN = _nonEmptyInCol(best);
      for (const i of indices.slice(1)) { const n = _nonEmptyInCol(i); if (n > bestN) { best = i; bestN = n; } }
      return best;
    };
    const colIdx = (name) => {
      const t = String(name || "").trim();
      if (!t) return -1;
      const exacts = header.reduce((acc, h, i) => (h === t ? (acc.push(i), acc) : acc), []);
      if (exacts.length) return _pickBestCol(exacts);
      const norm = s => String(s || "").toLowerCase().replace(/\s+/g, "");
      const nt = norm(t);
      const normMatches = header.reduce((acc, h, i) => (norm(h) === nt ? (acc.push(i), acc) : acc), []);
      if (normMatches.length) return _pickBestCol(normMatches);
      if (/^[A-Z]{1,2}$/i.test(t)) {                       // 열문자(A, B, AA)
        let n = 0; for (const ch of t.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
        return n - 1;
      }
      return -1;
    };
    const ci = colIdx(a.column);
    if (ci < 0) return { ok: false, error: "unknown_column", given: a.column, available: header.slice(0, 40) };
    const body = rows.slice(hr + 1);
    const conds = Array.isArray(a.where) ? a.where : [];
    const norm = v => String(v == null ? "" : v).trim();
    const pass = (row) => conds.every(c => {
      const idx = colIdx(c.col ?? c.column);
      if (idx < 0) return false;
      const cell = norm(row[idx]), want = norm(c.value);
      const op = String(c.op || "eq").toLowerCase();
      if (op === "eq") return cell === want;
      if (op === "ne") return cell !== want;
      if (op === "contains") return cell.includes(want);
      if (op === "gt" || op === "lt") {
        const x = parseFloat(cell.replace(/[,\s]/g, "")), y = parseFloat(want.replace(/[,\s]/g, ""));
        if (!isFinite(x) || !isFinite(y)) return false;
        return op === "gt" ? x > y : x < y;
      }
      return false;
    });
    const hit = body.filter(r => Array.isArray(r) && pass(r));
    const op = String(a.op || "count").toLowerCase();
    // [행상한 명시] 미리보기(라이브 직독도)는 최대 60행이라, 실제 데이터가 더 많으면 count/sum/
    // distinct 가 '최소값'일 뿐이다. dims 로 실제 데이터 행수를 얻어 truncated 를 크게 알린다 —
    // LLM 이 잘린 수를 '확정 개수'로 단정하던 실측 오답 방지.
    const _dims = (f.backendPreviewDimensions && f.backendPreviewDimensions[sname]) || null;
    const _totalRows = _dims && Number(_dims.maxRow) ? Number(_dims.maxRow) : null;
    const _dataRowsTotal = _totalRows != null ? Math.max(0, _totalRows - (hr + 1)) : null;
    const _truncated = _dataRowsTotal != null && _dataRowsTotal > body.length;
    const previewNote = _truncated
      ? `⚠ 미리보기 ${body.length}행만 계산했습니다. 이 시트 실제 데이터는 약 ${_dataRowsTotal}행 — 개수/합계는 '최소값'이며 정확한 전체값이 아닙니다. 정확한 전체 집계가 필요하면 사용자에게 그 사실을 밝히세요.`
      : `데이터 ${body.length}행 전체 기준(잘림 없음).`;
    const _trunc = { truncated: _truncated, previewRows: body.length, totalDataRowsEstimate: _dataRowsTotal };
    if (op === "count") {
      const nonEmpty = hit.filter(r => norm(r[ci]) !== "").length;
      return { ok: true, op, matchedRows: hit.length, nonEmptyInColumn: nonEmpty, scannedRows: body.length, ..._trunc, note: previewNote };
    }
    if (op === "sum") {
      let sum = 0, used = 0;
      hit.forEach(r => {
        const x = parseFloat(norm(r[ci]).replace(/[,\s₩]/g, ""));
        if (isFinite(x)) { sum += x; used += 1; }
      });
      return { ok: true, op, sum, numericCells: used, matchedRows: hit.length, scannedRows: body.length, ..._trunc, note: previewNote };
    }
    if (op === "distinct") {
      const set = new Map();
      hit.forEach(r => { const v = norm(r[ci]); if (v) set.set(v, (set.get(v) || 0) + 1); });
      const items = [...set.entries()].sort((x, y) => y[1] - x[1]).slice(0, 30).map(([v, c]) => ({ value: v, count: c }));
      return { ok: true, op, distinctCount: set.size, top: items, scannedRows: body.length, ..._trunc, note: previewNote };
    }
    if (op === "sample") {
      return { ok: true, op, header, rows: hit.slice(0, 8).map(r => r.slice(0, 12)), matchedRows: hit.length, note: previewNote };
    }
    // [Tier0] 그룹별 집계 — 정산 실무의 기본 질의("거래처별 합계", "요금제별 건수 상위 N").
    // groupBy 열로 묶어 대상 열을 합산(groupSum)하거나 건수를 센다(groupCount). 상위 topN 만 반환.
    if (op === "groupsum" || op === "groupcount") {
      const gi = colIdx(a.groupBy);
      if (gi < 0) return { ok: false, error: "unknown_groupBy", given: a.groupBy, available: header.slice(0, 40) };
      const topN = Math.max(1, Math.min(50, Number(a.topN) || 20));
      const agg = new Map();
      hit.forEach(r => {
        const key = norm(r[gi]); if (!key) return;
        if (op === "groupcount") { agg.set(key, (agg.get(key) || 0) + 1); return; }
        const x = parseFloat(norm(r[ci]).replace(/[,\s₩]/g, ""));
        if (isFinite(x)) agg.set(key, (agg.get(key) || 0) + x);
      });
      const groups = [...agg.entries()].sort((x, y) => y[1] - x[1]).slice(0, topN)
        .map(([k, v]) => ({ key: k, value: op === "groupsum" ? Math.round(v * 100) / 100 : v }));
      return { ok: true, op, groupBy: a.groupBy, valueColumn: op === "groupsum" ? a.column : null,
               groupCount: agg.size, top: groups, scannedRows: body.length, note: previewNote };
    }
    return { ok: false, error: "unknown_op", given: a.op, available: ["count", "sum", "distinct", "sample", "groupSum", "groupCount"] };
  });

// ── 8. 되돌리기 가능성 안내 ──────────────────────────────────────────────────
assistDefineTool("undo.advice", { desc: "지금 상태에서 무엇을 되돌릴 수 있는지(스냅샷 보유·교차파일 제약)" },
  () => {
    const steps = _assistSteps();
    const withSnap = steps.filter(s => s && s._preApplySnapshot && s._preApplySnapshot.resultId).length;
    let crossFile = false;
    try { crossFile = typeof pipelineSuffixWritesCrossFile === "function" && pipelineSuffixWritesCrossFile(steps, 0); } catch (_) {}
    return {
      ok: true, stepCount: steps.length, stepsWithSnapshot: withSnap,
      crossFileWrites: crossFile,
      note: crossFile
        ? "교차파일에 쓰는 스킬이라 부분 되돌리기가 구조적으로 불가하다(목적지 파일은 스냅샷에 없음). 되돌리려면 원본을 다시 올려 전체실행해야 한다."
        : "스냅샷이 있는 단계는 그 직전 상태로 되돌릴 수 있다. 앱 재시작·세션 종료 시 스냅샷은 사라진다.",
    };
  });

// ── 9. [Tier0] 방금 전체실행 결과 요약 ───────────────────────────────────────
// (이름은 result.summary — 도구는 전부 읽기 전용이라 'run/apply/save' 동사를 이름에 쓰지 않는다.)
assistDefineTool("result.summary", { desc: "직전 전체실행 결과 요약(만들어진 출력 파일 수·이름, 스텝별 스냅샷 보유). '방금 실행 뭐 나왔어?'에 답할 근거." },
  () => {
    const outs = (typeof window !== "undefined" && Array.isArray(window.lastRunnerOutputs)) ? window.lastRunnerOutputs : [];
    const snaps = (typeof window !== "undefined" && Array.isArray(window.lastRunnerStepSnapshots)) ? window.lastRunnerStepSnapshots : [];
    if (!outs.length && !snaps.length) {
      // [감사 G4] '기록 없음'을 "실행 안 함/실패"로 단정하게 하던 문구 교정 — 라이브 모드 실행이나
      // 앱 재시작(기록 휘발) 뒤에도 여기로 온다. 라이브 적용 여부는 diag.stepStatus 가 정답.
      return { ok: true, hasRun: false,
               note: "이번 세션에 '파일 출력' 전체실행 기록이 없습니다. 이것은 미실행/실패의 증거가 아닙니다 — "
                   + "라이브(화면 직접 적용) 모드였거나 앱 재시작으로 기록이 사라졌을 수 있습니다. "
                   + "라이브 적용 여부는 diag.stepStatus 로 확인하세요." };
    }
    return {
      ok: true, hasRun: true,
      outputFileCount: outs.length,
      outputFiles: outs.slice(0, 20).map(o => ({ name: (o && o.name) || "", hasDownload: !!(o && o.downloadId) })),
      stepSnapshotCount: snaps.length,
      note: "출력 파일은 '결과 편집하기'로 라이브에 불러오거나 다운로드할 수 있습니다(다운로드는 사용자 클릭).",
    };
  });

// ── 10. [Tier0] 방금 실패한 스텝의 실제 오류 ─────────────────────────────────
assistDefineTool("step.error", { desc: "직전 실행에서 실패한 스텝의 실제 오류(메시지·원인·기술 세부). '방금 왜 실패했어?'에 추측 말고 근거로 답할 때 쓴다." },
  () => {
    const e = (typeof window !== "undefined" && window.__lastPipelineErrorInfo) || null;
    if (!e) return { ok: true, hasError: false, note: "이번 세션에 기록된 실패가 없습니다(성공했거나 아직 실행하지 않음)." };
    const ageMin = Math.round((Date.now() - (e.at || 0)) / 60000);
    // [생성 실패 진단 2026-08-10] 만들다가 실패한 단계는 스킬 목록에 없다 — 그걸 모르면
    // AI 가 pipeline.step 만 뒤지다 "그런 단계가 없다"로 끝낸다(사용자 실측). 목록에 있는지를
    // 도구가 직접 알려주고, 없으면 다음에 뭘 봐야 하는지까지 데이터에 담는다.
    const inSkill = !!(e.stepId && Array.isArray(state.pipeline)
      && state.pipeline.some(s => s && s.id === e.stepId));
    return {
      ok: true, hasError: true,
      step: Number(e.stepIdx) >= 0 ? Number(e.stepIdx) + 1 : null,
      stepId: e.stepId || null, description: e.description || "", language: e.language || "",
      message: String(e.message || "").slice(0, 600),
      cause: String(e.cause || "").slice(0, 600),
      rawError: String(e.rawError || "").slice(0, 800),
      // [가시성 감사 ⑤] 단일 슬롯이라 연속 실패가 덮였다 — util.js 후킹이 쌓은 최근 5건(최신이 뒤).
      recentErrors: (typeof window !== "undefined" && Array.isArray(window.__pipelineErrorHistory))
        ? window.__pipelineErrorHistory.slice() : [],
      // [지라 2026-08-19] 실패한 코드 원문 — 만들다가 실패한 단계는 스킬 목록에 없어 이게 유일한
      // 코드 근거다. 없으면 AI 도움이 "스킬을 읽어 오지 못했다"로 끝났다(교육 실측).
      failedCode: String(e.code || "").slice(0, 2500),
      ageMinutes: ageMin,
      inSkill,
      note: inSkill
        ? "이 오류는 마지막 실패 시점의 기록이다. 지금 스킬이 그 사이 수정됐으면 최신 상태와 다를 수 있다."
        : "이 단계는 스킬 목록에 없다 — 없어진 게 아니라 '만들다가 실패해 등록되지 못한' 단계다. "
          + "pipeline.step 으로 찾으려 하지 말고(없는 게 정상), 위 failedCode(실패한 코드 원문)와 "
          + "message/rawError, chat.history(사용자가 뭘 요청했는지)로 진단하라.",
    };
  });

// ── 11. [Tier0] 대상 시트 헤더(열 이름) 다이제스트 ──────────────────────────
// ── [실행 타임라인] 서버 트레이스 — step.error 보다 한 층 깊은 '실제로 무슨 일이 있었나' ──
// 실측 15:30: 1조각이 엉뚱한 워크북(마지막에 연 동반본)에서 실행된 사실은 클라 상태 어디에도
// 없고 서버 트레이스에만 남았다 — 이 도구가 없으면 그 층의 진단은 원천 불가.
assistDefineTool("run.trace", {
  desc: "직전 실행의 서버 트레이스 타임라인(스텝 시작/성공/실패 순서·런타임 오류 원문·격리 인스턴스에 열린 파일과 각 스텝이 실제로 돈 워크북). step.error 로 부족할 때 — '어느 파일에서 돌았는지/어디서 멈췄는지'의 결정적 근거.",
  args: "limit?(기본 80)",
}, async (a) => {
  if (typeof postExcelMirror !== "function") return { ok: false, error: "no_backend" };
  const r = await postExcelMirror("/api/diag/recent-trace",
    { limit: Number(a && a.limit) || 80 }, 0, { timeoutMs: 15000 });
  return r || { ok: false, error: "empty" };
});

assistDefineTool("sheet.headers", { desc: "특정 파일/시트의 헤더(열 이름) 목록. data.query 전에 열 이름을 미리 알아 unknown_column 재시도를 없앤다.", args: "file, sheet, headerRow?" },
  async (a) => {
    const fname = String(a.file || "").trim();
    const f = (state.inputs || []).find(x => x && x.name === fname)
      || ((state.outputTemplates || []).map(t => t && (t.file || t.original)).find(x => x && x.name === fname));
    if (!f) return { ok: false, error: "unknown_file", given: fname, available: _assistFileList().map(x => x.name) };
    await _assistRefreshLiveFile(f, a.sheet);
    const sheets = f.sheets || {};
    const sname = String(a.sheet || "").trim();
    const rows = Array.isArray(sheets[sname]) ? sheets[sname] : null;
    if (!rows) return { ok: false, error: "unknown_sheet", given: sname, available: f.sheetNames || Object.keys(sheets) };
    if (!rows.length) return { ok: false, error: "empty_preview", note: "이 시트는 미리보기 데이터가 비어 있습니다." };
    // 헤더 행 자동 추정(지정 없으면) — data.query 와 동일 규칙(공용 헬퍼)으로 일치.
    const hr = _assistDetectHeaderRow(rows, a.headerRow);
    const header = (rows[hr] || []).map((v, i) => ({ col: _assistColLetter(i), name: String(v == null ? "" : v).trim() }))
      .filter(h => h.name);
    return { ok: true, file: fname, sheet: sname, headerRow: hr + 1, columnCount: header.length,
             headers: header.slice(0, 60),
             note: "col 은 엑셀 열문자(A,B,…), name 은 헤더 텍스트다. data.query 의 column 에는 둘 중 아무거나 넣어도 된다." };
  });

// ── 12. [Tier0] 스킬 설계 채팅(③) 대화 읽기 ─────────────────────────────────
// "내가 설계 채팅에서 말한 것만 뽑아줘", "지금까지 뭐라고 시켰지?", "이 스킬 어떻게 만들었더라"
// 같은 요청을 위해 ③ 스킬 설계 채팅의 대화를 노출한다. role=user 는 사용자 발화, assistant 는 AI 응답.
// (이건 ③ 설계 채팅 기록이고, AI 도움 창 자기 대화(state.assist)와는 다르다.)
assistDefineTool("chat.history", {
  desc: "스킬 설계 채팅(③)의 대화 기록. role=user|assistant|all(기본 all), limit(기본 40, 최근 것부터).",
  args: "role?, limit?",
}, (a) => {
  const hist = (typeof state !== "undefined" && state && Array.isArray(state.chatHistory)) ? state.chatHistory : [];
  const roleWant = String(a.role || "all").toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(a.limit) || 40));
  const picked = [];
  for (let i = hist.length - 1; i >= 0 && picked.length < limit; i--) {
    const m = hist[i];
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    if (roleWant !== "all" && m.role !== roleWant) continue;
    const content = String(m.content || m.text || m.message || "").trim();
    if (!content) continue;
    picked.push({ index: i, role: m.role, content: content.slice(0, 1200) });
  }
  picked.reverse();
  return {
    ok: true, totalMessages: hist.length, returned: picked.length,
    role: roleWant, truncatedEach: 1200,
    messages: picked,
    note: hist.length === 0
      ? "설계 채팅에 대화가 없습니다(아직 대화하지 않았거나 새 세션입니다)."
      : "이건 ③ 스킬 설계 채팅의 대화다. 'user'가 사용자가 말한 것, 'assistant'가 AI 응답. 최근 것부터 최대 limit 개.",
  };
});

// ── 13. [범용 읽기] 아무 파일/시트의 원시 범위 읽기 ──────────────────────────
// data.query 가 집계라면, 이건 '있는 그대로'의 셀 값을 A1 범위로 읽는다("A2:C20", "F:F", "B5").
// 안전: 클라 미리보기 데이터(state.inputs[].sheets)만 읽는다 — COM 미사용(엑셀 멈춤 없음). 셀 수 상한.
function _assistColToIdx(col) {
  let n = 0; for (const ch of String(col || "").toUpperCase()) { if (ch < "A" || ch > "Z") break; n = n * 26 + (ch.charCodeAt(0) - 64); }
  return n - 1;   // 0-based, 없으면 -1
}
assistDefineTool("data.read", {
  desc: "파일/시트의 셀 값을 A1 범위로 '있는 그대로' 읽는다. range 예: 'A2:C20', 'F:F'(열 전체), 'B5'(한 셀). 최대 3000셀(미리보기 기준).",
  args: "file, sheet, range",
}, async (a) => {
  const fname = String(a.file || "").trim();
  const f = (state.inputs || []).find(x => x && x.name === fname)
    || ((state.outputTemplates || []).map(t => t && (t.file || t.original)).find(x => x && x.name === fname));
  if (!f) return { ok: false, error: "unknown_file", given: fname, available: _assistFileList().map(x => x.name) };
  await _assistRefreshLiveFile(f, a.sheet);
  const sheets = f.sheets || {};
  const sname = String(a.sheet || "").trim();
  const rows = Array.isArray(sheets[sname]) ? sheets[sname] : null;
  if (!rows) return { ok: false, error: "unknown_sheet", given: sname, available: f.sheetNames || Object.keys(sheets) };
  const nRows = rows.length, nCols = rows.reduce((m, r) => Math.max(m, (r || []).length), 0);
  // A1 파싱: "A2:C20" | "F:F" | "B5"
  const m = /^\s*([A-Za-z]{1,3})?(\d+)?(?::([A-Za-z]{1,3})?(\d+)?)?\s*$/.exec(String(a.range || ""));
  if (!m) return { ok: false, error: "bad_range", given: a.range, hint: "예: A2:C20, F:F, B5" };
  let c1 = m[1] ? _assistColToIdx(m[1]) : 0;
  let r1 = m[2] ? Number(m[2]) - 1 : 0;
  let c2 = m[3] ? _assistColToIdx(m[3]) : (m[1] && !m[3] && !m[4] ? c1 : nCols - 1);
  let r2 = m[4] ? Number(m[4]) - 1 : (m[2] && !m[4] && !m[3] ? r1 : nRows - 1);
  if (m[1] && !m[2] && !m[4]) { r1 = 0; r2 = nRows - 1; }         // "F:F" = 열 전체
  c1 = Math.max(0, c1); r1 = Math.max(0, r1);
  c2 = Math.min(nCols - 1, Math.max(c1, c2)); r2 = Math.min(nRows - 1, Math.max(r1, r2));
  let truncated = false;
  const CAP = 3000;
  if ((r2 - r1 + 1) * (c2 - c1 + 1) > CAP) { r2 = r1 + Math.max(0, Math.floor(CAP / (c2 - c1 + 1)) - 1); truncated = true; }
  const out = [];
  for (let r = r1; r <= r2 && r < nRows; r++) {
    const row = rows[r] || [];
    out.push(row.slice(c1, c2 + 1).map(v => (v == null ? "" : v)));
  }
  return { ok: true, file: fname, sheet: sname,
           range: `${_assistColLetter(c1)}${r1 + 1}:${_assistColLetter(c2)}${r2 + 1}`,
           rows: out, rowCount: out.length, colCount: c2 - c1 + 1, truncated,
           note: "미리보기 데이터 기준(파일 전체가 아닐 수 있음). 값은 있는 그대로다." };
});

// ── 14. [범용 읽기] 현재 앱 상태 스냅샷 ──────────────────────────────────────
// "지금 어떤 파일/시트 보고 있어?", "내가 뭘 선택했지?", "엔진/모델 뭐로 돼 있어?" 등에 답한다.
// 안전: API 키 등 비밀값은 노출하지 않는다(마스킹). 상태 '읽기'만, 변경 없음.
assistDefineTool("app.state", { desc: "현재 앱 상태 스냅샷 — 보고 있는 파일/시트, 선택 범위, 페이지, 스킬 엔진, AI 모델/네트워크(키 제외), 업로드 파일 목록, 실행기 파일확인 매핑, 녹화 중 여부. '지금 뭐 선택했지/어떤 설정이지/어느 파일이 연결됐지'에 답." },
  () => {
    const s = (typeof settings !== "undefined" && settings) ? settings : {};
    const sel = state.selectedRange || state.selectedCell || null;
    const selText = (() => {
      try {
        if (state.selectedRange) { const g = state.selectedRange; return `${_assistColLetter(g.c1)}${g.r1 + 1}:${_assistColLetter(g.c2)}${g.r2 + 1}`; }
        if (state.selectedCell) { const c = state.selectedCell; return `${_assistColLetter(c.c)}${c.r + 1}`; }
      } catch (_) {}
      return null;
    })();
    // [감사 G1] 실행기 '파일확인' 매핑(스킬 요구파일 → 실제 업로드 파일/시트) — 이전엔 어떤 도구도
    // 못 읽어 "어떤 파일이 연결됐어?"에 답 못 했다. userSet=true 는 사용자가 직접 고른 연결.
    const mappings = (() => {
      try {
        const m = state.runnerMappings || {};
        const out = {};
        for (const k of Object.keys(m).slice(0, 40)) {
          const v = m[k] || {};
          out[k] = { file: String(v.fileId || "").replace(/^input:/, "") || null,
                     sheet: v.sheet || null, userSet: !!v.userSet };
        }
        return out;
      } catch (_) { return {}; }
    })();
    return {
      ok: true,
      currentFile: String(state.currentFileId || "").replace(/^input:/, "") || null,
      currentSheet: state.currentSheet || null,
      selection: selText ? { sheet: (sel && sel.sheet) || state.currentSheet || null, range: selText,
                             fileId: String((sel && sel.fileId) || "").replace(/^input:/, "") || null } : null,
      multiSelectionCount: Array.isArray(state.selectedRanges) ? state.selectedRanges.length : 0,
      page: state.currentPage || null,
      skillEngine: (typeof getSkillEngine === "function" ? getSkillEngine() : s.skillEngine) || null,
      ai: {
        provider: s.provider || null, network: s.network || null, model: s.model || null,
        thinkMode: s.thinkMode === true,
        apiKey: s.apiKey ? "***(마스킹)" : "(없음)",   // 비밀값은 절대 노출 안 함
      },
      files: _assistFileList(),
      stepCount: _assistSteps().length,
      runnerMappings: mappings,                     // 파일확인: 요구키 → {file, sheet, userSet}
      runnerMappingRunActive: !!state.runnerMappingRunActive,   // 실행기 전체실행 진행 중 여부
      // [감사 G2] 화면 녹화 진행 여부 — "지금 녹화 중이야?"에 답(F10 으로 시작/정지).
      recordingActive: !!(typeof globalThis !== "undefined" && globalThis.__excelRecordingActive),
      note: "상태 '읽기'만 한 결과다(아무것도 바꾸지 않음). API 키 등 비밀값은 마스킹돼 있다.",
    };
  });


// ── [가시성 감사 2026-08-25] 실행 '밖' 문제용 도구 3종 ───────────────────────
// 저장·보안문서·화면·연결 질문은 그동안 읽을 데이터가 없어 제보(report)로 낙하했다.

assistDefineTool("app.notices", {
  desc: "최근 화면 알림(토스트) 기록 — '방금 뜬 빨간 메시지 뭐였어?'에 답할 근거. 업로드/저장/다운로드 오류 대부분이 여기 남는다(최신이 뒤, 최대 50건).",
  args: "limit?(기본 20)",
}, (a) => {
  const buf = (typeof window !== "undefined" && Array.isArray(window.__recentNotices))
    ? window.__recentNotices : [];
  const limit = Math.max(1, Math.min(50, Number(a && a.limit) || 20));
  const items = buf.slice(-limit).map(n => ({
    agoSec: Math.round((Date.now() - (n.at || 0)) / 1000), type: n.type || "info", msg: n.msg || "",
  }));
  return { ok: true, count: items.length, notices: items,
           note: items.length ? "agoSec 는 '몇 초 전'이다. type=error 가 실패 알림." :
                 "기록된 알림이 없습니다(앱 시작 후 아직 토스트가 없었음)." };
});

assistDefineTool("backup.status", {
  desc: "스킬 저장/자동저장(자동백업) 상태 — 마지막 자동백업 성공·실패와 저장 폴더. '스킬이 저장 안 돼요/폴더에 zip 이 없어요' 진단 근거.",
}, async () => {
  let dir = null;
  try {
    const r = await fetch("/api/logic/backup-dir");
    dir = await r.json();
  } catch (_) {}
  const okInfo = (typeof window !== "undefined" && window.lastLogicAutoBackup) || null;
  const errInfo = (typeof window !== "undefined" && window.__lastLogicBackupError) || null;
  return {
    ok: true,
    autoBackupDir: dir ? { path: dir.path || null, exists: dir.exists !== false, custom: !!dir.custom } : null,
    lastSuccess: okInfo ? { agoSec: okInfo.at ? Math.round((Date.now() - okInfo.at) / 1000) : null,
                           name: okInfo.name || null, path: okInfo.path || null } : null,
    lastFailure: errInfo ? { agoSec: Math.round((Date.now() - (errInfo.at || 0)) / 1000),
                             message: errInfo.message || "", reason: errInfo.reason || "" } : null,
    stepCount: _assistSteps().length,
    note: "자동백업은 단계가 바뀔 때마다 autoBackupDir 에 zip 으로 쌓인다(단계 0개면 저장할 게 없어 안 만든다). "
        + "수동 [스킬 저장]은 서버 폴더가 아니라 '브라우저 다운로드'다. 불러오기는 프로그램이 만든 "
        + "무압축(STORED) zip 만 받는다 — 다른 도구로 재압축한 zip 은 'Compressed ZIP entries' 오류로 거부된다.",
  };
});

assistDefineTool("secure.status", {
  desc: "보안문서(AIP/DRM) 해제/재적용 상태 — '보안 해제 실패/다운로드 중단(보안적용 실패)' 진단 근거. 서버 연결·해제/적용 횟수·마지막 오류.",
}, async () => {
  try {
    const r = await fetch("/api/secure-doc/status");
    const s = await r.json();
    return { ok: true, enabled: !!s.enabled, serverOk: !!s.serverOk, configured: !!s.configured,
             active: !!s.active, anySecured: !!s.anySecured,
             releasedCount: s.releasedCount || 0, appliedCount: s.appliedCount || 0,
             lastError: s.lastError || "",
             note: "released=업로드 때 보안 해제한 횟수, applied=다운로드 때 보안을 다시 건 횟수. "
                 + "anySecured=true 면 이후 모든 문서 다운로드에 보안이 다시 걸린다(실패 시 다운로드가 "
                 + "일부러 중단된다 — 평문 유출 방지). serverOk=false 면 보안 서버(수집 서버)에 못 간 것." };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err),
             note: "상태 조회 실패 — 백엔드가 꺼져 있거나 이 버전에 보안문서 기능이 없다." };
  }
});
