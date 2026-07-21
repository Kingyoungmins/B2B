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
function _assistFileList() {
  const out = [];
  (state.inputs || []).forEach(f => { if (f && f.name) out.push({ role: "input", name: f.name, sheets: f.sheetNames || [] }); });
  (state.outputTemplates || []).forEach((t, i) => {
    const f = t && (t.file || t.original);
    if (f && f.name) out.push({ role: "output", index: i, name: f.name, sheets: f.sheetNames || [] });
  });
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
  desc: "업로드 미리보기 데이터에서 개수/합계/고유값/표본 조회. op=count|sum|distinct|sample, where=[{col,op,value}]",
  args: "file, sheet, op, column, where?",
}, (a) => {
    const files = _assistFileList();
    const fname = String(a.file || "").trim();
    const f = (state.inputs || []).find(x => x && x.name === fname)
      || ((state.outputTemplates || []).map(t => t && (t.file || t.original)).find(x => x && x.name === fname));
    if (!f) return { ok: false, error: "unknown_file", given: fname, available: files.map(x => x.name) };
    const sheets = f.sheets || {};
    const sname = String(a.sheet || "").trim();
    const rows = Array.isArray(sheets[sname]) ? sheets[sname] : null;
    if (!rows) {
      return { ok: false, error: "unknown_sheet", given: sname,
               available: f.sheetNames || Object.keys(sheets) };
    }
    if (!rows.length) return { ok: false, error: "empty_preview", note: "이 시트는 미리보기 데이터가 비어 있습니다." };
    const header = (rows[0] || []).map(v => String(v == null ? "" : v).trim());
    const colIdx = (name) => {
      const t = String(name || "").trim();
      if (!t) return -1;
      const exact = header.indexOf(t);
      if (exact >= 0) return exact;
      const norm = s => String(s || "").toLowerCase().replace(/\s+/g, "");
      const i2 = header.findIndex(h => norm(h) === norm(t));
      if (i2 >= 0) return i2;
      if (/^[A-Z]{1,2}$/i.test(t)) {                       // 열문자(A, B, AA)
        let n = 0; for (const ch of t.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
        return n - 1;
      }
      return -1;
    };
    const ci = colIdx(a.column);
    if (ci < 0) return { ok: false, error: "unknown_column", given: a.column, available: header.slice(0, 40) };
    const body = rows.slice(1);
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
    const previewNote = `미리보기 ${body.length}행 기준(파일 전체가 아닐 수 있음)`;
    if (op === "count") {
      const nonEmpty = hit.filter(r => norm(r[ci]) !== "").length;
      return { ok: true, op, matchedRows: hit.length, nonEmptyInColumn: nonEmpty, scannedRows: body.length, note: previewNote };
    }
    if (op === "sum") {
      let sum = 0, used = 0;
      hit.forEach(r => {
        const x = parseFloat(norm(r[ci]).replace(/[,\s₩]/g, ""));
        if (isFinite(x)) { sum += x; used += 1; }
      });
      return { ok: true, op, sum, numericCells: used, matchedRows: hit.length, scannedRows: body.length, note: previewNote };
    }
    if (op === "distinct") {
      const set = new Map();
      hit.forEach(r => { const v = norm(r[ci]); if (v) set.set(v, (set.get(v) || 0) + 1); });
      const items = [...set.entries()].sort((x, y) => y[1] - x[1]).slice(0, 30).map(([v, c]) => ({ value: v, count: c }));
      return { ok: true, op, distinctCount: set.size, top: items, scannedRows: body.length, note: previewNote };
    }
    if (op === "sample") {
      return { ok: true, op, header, rows: hit.slice(0, 8).map(r => r.slice(0, 12)), matchedRows: hit.length, note: previewNote };
    }
    return { ok: false, error: "unknown_op", given: a.op, available: ["count", "sum", "distinct", "sample"] };
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
