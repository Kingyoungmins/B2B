/* ===================================================================
   SAVE / LOAD
   =================================================================== */
$("btn-save").onclick = () => {
  openSaveModal();
};
$("btn-load").onclick = () => {
  openLoadDialog();
};
const logicBackupDirButton = $("btn-backup-dir");
if (logicBackupDirButton) {
  logicBackupDirButton.onclick = () => {
    chooseLogicAutoBackupDir();
  };
}
$("btn-reset").onclick = async () => {
  // [사용자 요청] 초기화 = 띄운 Excel 전부 종료 + 프로그램 재시작처럼 동작.
  // confirm() 이 항상-위 Excel 미러 창 뒤에 가려져 화면이 굳어 보이는 문제(0.5.2.2 §7)가 있어
  // 묻기 전에 미러를 먼저 숨긴다. 취소하면 활성 미러를 복원한다.
  try { if (typeof hideAllExcelMirrorWindows === "function") await hideAllExcelMirrorWindows(); } catch (_) {}
  const confirmed = typeof openB2bConfirmModal === "function"
    ? await openB2bConfirmModal("초기화할까요? 띄워진 Excel 창을 모두 닫고 프로그램을 새로 시작한 상태로 되돌립니다." + String.fromCharCode(10) + "(다운로드한 .logic.json 파일은 영향 없음)", { okLabel: "초기화" })
    : confirm("초기화할까요?");
  if (!confirmed) {
    try { if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0); } catch (_) {}
    return;
  }
  // 1) Excel 전부 강제 종료: 서버가 즉시 응답하고 백그라운드 스레드가 세션/워커/고아 EXCEL.EXE 까지 정리.
  try {
    if (typeof forceCloseAllExcelMirrorSessions === "function") {
      await forceCloseAllExcelMirrorSessions();
    } else if (typeof closeAllExcelMirrorSessions === "function") {
      await closeAllExcelMirrorSessions();
    }
  } catch (err) {
    console.warn("초기화 중 Excel 종료 실패(리로드는 계속 진행):", err);
  }
  // [필드#4] 초기화 직후 첫 업로드에서 Excel 창이 빈 화면으로 남는 케이스 자가복구용 표식.
  try { sessionStorage.setItem("b2bJustReset", "1"); } catch (_) {}
  // 2) SPA 전체 리로드 = 프로그램 재시작과 동일한 상태 초기화.
  //    이전의 수동 state 필드 초기화는 새 상태/타이머/토큰이 생길 때마다 누락돼 '반쯤 초기화'가 됐다 —
  //    리로드는 모든 JS 상태·타이머·busy 토큰·취소 토큰이 부팅 직후와 같아진다(서버/설정은 유지).
  location.reload();
};

function logicBackupTimestamp() {
  // [수정] toISOString() 은 UTC 라 파일명 시각이 로컬(KST=UTC+9)보다 9시간 느렸다.
  // 백업 파일명은 사용자가 보는 로컬 시각으로 만든다(메타데이터 createdAt 의 ISO 는 표준이라 UTC 유지).
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function safeLogicBaseName(name) {
  return String(name || "logic").trim().replace(/[^\w\uAC00-\uD7A3\-\s]/g, "_").replace(/\s+/g, " ").trim() || "logic";
}

function stripLogicTimestampSuffix(name) {
  let base = String(name || "").trim();
  base = base.replace(/\.(?:zip|logic\.json|json)$/i, "");
  base = base.replace(/_step\d+$/i, "");
  base = base.replace(/(?:[_-])?\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/i, "");
  base = base.replace(/(?:[_-])?\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/i, "");
  base = base.replace(/(?:[_-])?\d+\s*(?:단계|steps?)$/i, "");  // 스텝 수 표기(_3단계) 제거 → 재저장 시 누적 방지
  return safeLogicBaseName(base || "logic");
}

// [A안: 입력 바뀌면 이름도 따라오게] '기억된 저장 이름'은 그 이름을 만든 '입력 파일 세트'에 묶는다.
// 지금 올라온 입력이 그때와 다르면 기억된 이름을 쓰지 않고 현재 입력 파일명을 기본값으로 제안한다.
// (예전엔 이름만 localStorage 에 영구 저장 → 한화테크윈으로 여러 번 저장하면 다른 파일로 새 스킬을
//  만들어도 계속 '한화테크윈'이 기본값으로 떴다.)
function currentInputSignature() {
  try {
    const names = ((state && state.inputs) || [])
      .map(f => (typeof workbookDisplayName === "function" ? workbookDisplayName(f, "") : (f && f.name) || ""))
      .map(n => String(n || "").replace(/\.(xls[xmb]?|csv|tsv)$/i, "").trim().toLowerCase())
      .filter(Boolean)
      .sort();
    if (!names.length) {
      const t = ((state && state.outputTemplates) || []).map(x => x && x.file && x.file.name).filter(Boolean);
      if (t.length) return t.map(n => String(n).toLowerCase()).sort().join("|");
      if (state && state.output && state.output.name) return String(state.output.name).toLowerCase();
      return "";
    }
    return names.join("|");
  } catch (_) { return ""; }
}

function currentLogicSaveBaseName(fallback) {
  const curSig = currentInputSignature();
  // 서명이 유효(비어있거나 == 현재)한 이름만 후보로 본다. 서명이 비어있으면(입력 없이 저장/불러온
  // 이전 상태) 판별 불가 → 그대로 존중한다(입력을 나중에 올린 흐름 보호).
  const sigOk = sig => !sig || !curSig || sig === curSig;
  let name = "";
  if (state && state.logicSaveBaseName && sigOk(state.logicSaveInputSig || "")) {
    name = state.logicSaveBaseName;        // 이번 세션에서 저장/불러온 이름(같은 입력 세트일 때)
  } else {
    try {
      const st = localStorage.getItem("b2b_logic_save_input_sig") || "";
      if (sigOk(st)) name = localStorage.getItem("b2b_logic_save_base_name") || "";
    } catch (_) {}
  }
  // 이름이 없거나 옛 기본값 "logic" 이면 호출자 fallback(=현재 입력 파일명)을 쓴다.
  const chosen = (name && name.trim().toLowerCase() !== "logic") ? name : (fallback || name || "logic");
  return stripLogicTimestampSuffix(chosen || "logic");
}

function defaultLogicBaseNameFromInputs() {
  // 스킬 기본 이름 = 첫 입력 파일명(확장자 제거). 없으면 출력 템플릿명, 그래도 없으면 "logic".
  // 어떤 입력으로 만든 스킬인지 파일명으로 식별되게 한다(저장/자동저장 공통).
  try {
    let nm = "";
    const inputs = (state && state.inputs) || [];
    if (inputs.length) {
      nm = (typeof workbookDisplayName === "function") ? workbookDisplayName(inputs[0], "") : (inputs[0] && inputs[0].name) || "";
    }
    if (!nm) {
      const tpls = (state && state.outputTemplates) || [];
      if (tpls.length && tpls[0] && tpls[0].file) nm = tpls[0].file.name || "";
      else if (state && state.output && state.output.name) nm = state.output.name;
    }
    nm = String(nm || "").replace(/\.(xls[xmb]?|csv|tsv)$/i, "");
    return stripLogicTimestampSuffix(nm || "logic");
  } catch (_) {
    return "logic";
  }
}

function rememberLogicSaveBaseName(name) {
  const base = stripLogicTimestampSuffix(name || "logic");
  const sig = currentInputSignature();
  state.logicSaveBaseName = base;
  state.logicSaveInputSig = sig;
  try {
    localStorage.setItem("b2b_logic_save_base_name", base);
    // [A안] 이 이름이 어떤 입력 세트에서 나왔는지 함께 저장 → 다음에 입력이 다르면 이 이름을 안 쓴다.
    localStorage.setItem("b2b_logic_save_input_sig", sig);
  } catch (_) {}
  return base;
}

function timestampedLogicArchiveName(baseName) {
  const base = safeLogicBaseName(baseName || "logic");
  const n = (state && Array.isArray(state.pipeline)) ? state.pipeline.length : 0;
  const stepPart = n > 0 ? `_${n}단계` : "";  // 몇 스텝짜리 스킬인지 파일명에 표기
  return `${base}${stepPart}_${logicBackupTimestamp()}`;
}

// [치환본 저장 방지] 실행 중에는 state.pipeline 이 '매핑본'(실제 파일/시트명으로 치환된 사본)으로
// 잠시 교체된다. 저장(수동 '스킬 저장' + 지연 실행되는 자동백업)이 그때 찍히면 저장 스킬에
// 날짜 박힌 파일명과 그 세션에서만 유효한 시트명(예: <해시>_원본명)이 영구히 박혀 버린다
// → 다음 달 재사용 불가 + 다시 올리면 옛 이름·새 이름이 둘 다 요구로 잡혀 매핑이 폭증(실측 확인).
// 저장은 언제나 '제네릭 이름의 원본'을 써야 하므로, 실행 중이면 원본 배열을 되찾아 쓴다.
function pipelineForSave() {
  try {
    if (state.runnerMappingRunActive && Array.isArray(state.pipelineOriginalDuringRun)) {
      return state.pipelineOriginalDuringRun;
    }
  } catch (_) {}
  return state.pipeline;
}

// [스킬 요구 파일/시트 선언 · v4] 저장 시점에 '만들 당시' 실제로 쓴 입력·출력 파일과 시트를,
// 업로드 원본 스냅샷(state.inputsOriginal / outputTemplates[].original = pristine)과 파이프라인이
// 실제 참조한 것의 '교집합'으로 산출한다. 코드에서 이름을 정규식으로 되추론하는 대신 파일 정체(fileId)와
// pristine 시트 목록을 근거로 삼으므로, (1) excel_open_* 임시명 유령과 (2) 스킬이 실행 중 만든 생성
// 시트가 자동으로 배제된다(생성 시트는 pristine 목록에 없어 교집합에서 빠짐). 러너는 이 표를 우선 읽고,
// 없으면(구버전 zip) 기존 코드 추론으로 폴백한다.
function computeSkillRequirements() {
  const norm = v => (typeof normalizeText === "function"
    ? normalizeText(v)
    : String(v || "").trim().toLowerCase().replace(/\s+/g, ""));
  const canonFileId = fid => { const t = String(fid || ""); return t === "output" ? "output:0" : t; };

  // ── (#1) pristine 업로드 스냅샷: fileId → { role, name, sheets } ──
  const pristine = new Map();
  (state.inputsOriginal || []).forEach(f => {
    if (!f || !f.name) return;
    const sheets = f.sheetNames || Object.keys(f.sheets || {}) || [];
    pristine.set("input:" + f.name, { role: "input", name: f.name, sheets: sheets.slice() });
  });
  (state.outputTemplates || []).forEach((tpl, idx) => {
    const orig = (tpl && tpl.original) || tpl;
    if (!orig || !orig.name) return;
    const sheets = orig.sheetNames || Object.keys(orig.sheets || {}) || [];
    const entry = { role: "output", name: orig.name, sheets: sheets.slice() };
    pristine.set("output:" + idx, entry);
    if (idx === 0) pristine.set("output", entry); // 'output' == 'output:0' 별칭(구 targetFileId 호환)
  });

  // ── (#2) 파이프라인이 실제로 쓴 파일(fileId)과, 파일별 참조 시트 ──
  const usedFileIds = new Set();
  const attributedSheets = new Map(); // fileId → Set(sheetName)
  const unresolved = new Set();       // pristine 에 없는 코드 내 .xls* 이름(유령/미업로드 → 경고용)
  const addSheet = (fid, sheet) => {
    const cf = canonFileId(fid);
    if (!cf || !sheet) return;
    if (!attributedSheets.has(cf)) attributedSheets.set(cf, new Set());
    attributedSheets.get(cf).add(String(sheet));
  };
  const markUsedByName = name => {
    if (!name) return;
    const fid = (typeof pipelineFileIdByWorkbookName === "function") ? pipelineFileIdByWorkbookName(name) : null;
    const cf = canonFileId(fid);
    if (cf && pristine.has(cf)) { usedFileIds.add(cf); return; }
    unresolved.add(String(name)); // pristine 매칭 실패 = 유령(excel_open_*)/미업로드
  };
  const mentionRe = /@(?:범위|시트|컬럼)\s*\[([^\]/\r\n]+)\/([^\]!\r\n]+?)(?:![^\]\r\n]+)?\]/g;

  (state.pipeline || []).forEach(step => {
    if (!step) return;
    const tf = canonFileId(step.targetFileId);
    if (tf && pristine.has(tf)) {
      usedFileIds.add(tf);
      if (step.targetSheetName) addSheet(tf, step.targetSheetName);
    }
    const text = [step.prompt, step.description, step.code].filter(Boolean).join("\n");
    if (typeof pipelineCollectWorkbookNames === "function") {
      pipelineCollectWorkbookNames(text).forEach(markUsedByName);
    }
    let m;
    while ((m = mentionRe.exec(text))) {
      const fid = (typeof pipelineFileIdByWorkbookName === "function") ? pipelineFileIdByWorkbookName(m[1].trim()) : null;
      const cf = canonFileId(fid);
      if (cf && pristine.has(cf)) { usedFileIds.add(cf); addSheet(cf, m[2].trim()); }
    }
    // [보완] 코드 리터럴 (파일, 시트) 쌍도 귀속 — targetSheetName/@멘션만 보면
    // book.read("시트", …)류 코드 참조 시트가 표에서 빠져, v4 경로에서 시트 칩이 파일
    // 단위로만 뜨고 시트 치환 기회를 잃는다. 실행기와 동일한 소유자 판정을 재사용한다.
    if (step.code && typeof runnerSheetOwnersFromCode === "function") {
      try {
        runnerSheetOwnersFromCode(step.code).forEach(pair => {
          const fid = (typeof pipelineFileIdByWorkbookName === "function")
            ? pipelineFileIdByWorkbookName(pair.book) : null;
          const cf2 = canonFileId(fid);
          if (cf2 && pristine.has(cf2)) { usedFileIds.add(cf2); addSheet(cf2, pair.sheet); }
        });
      } catch (_) {}
    }
  });
  // 시트가 귀속됐지만 파일이 used 로 안 잡힌 경우도 used 로 포함
  attributedSheets.forEach((_s, fid) => { if (pristine.has(fid)) usedFileIds.add(fid); });

  // ── 교집합: 요구 파일 + (참조시트 ∩ pristine 시트) ──
  const requiredFiles = [];
  Array.from(usedFileIds).forEach(fid => {
    const p = pristine.get(fid);
    if (!p) return;
    const pristineByNorm = new Map(p.sheets.map(s => [norm(s), s])); // norm → pristine 원본 표기
    const requiredSheets = [];
    (attributedSheets.get(fid) || new Set()).forEach(s => {
      const canon = pristineByNorm.get(norm(s)); // pristine 에 실제 있는 시트만(생성 시트 배제)
      if (canon && !requiredSheets.includes(canon)) requiredSheets.push(canon);
    });
    requiredFiles.push({ fileId: fid, role: p.role, name: p.name, requiredSheets, originalSheets: p.sheets.slice() });
  });

  // 참조됐지만 pristine 어디에도 없는 시트 = 생성 시트(정보용)
  const allPristineNorms = new Set();
  pristine.forEach(p => p.sheets.forEach(s => allPristineNorms.add(norm(s))));
  const genSeen = new Set();
  const generatedSheets = [];
  attributedSheets.forEach((set, fid) => set.forEach(s => {
    if (allPristineNorms.has(norm(s))) return;
    const key = JSON.stringify([fid, s]);
    if (genSeen.has(key)) return;
    genSeen.add(key);
    generatedSheets.push({ fileId: fid, sheet: s });
  }));

  return { requiredFiles, generatedSheets, unresolvedRefs: Array.from(unresolved) };
}

// [v4 staleness 가드] 요구 표가 유효한 '파이프라인 상태'의 서명. 불러올 때 저장하고, 실행기에서 요구를
// 만들 때 지금 파이프라인의 서명과 비교한다 — 생성기에서 편집돼 달라지면 표를 무시하고 추론으로 폴백한다.
function loadedSkillReqSignature(pipeline) {
  const US = String.fromCharCode(31), RS = String.fromCharCode(30); // 충돌 방지용 구분자
  return (pipeline || [])
    .map(s => [s && s.id, s && s.targetFileId, s && s.targetSheetName, (s && s.code) || ""].join(US))
    .join(RS);
}

function buildLogicZipEntries(name) {
  const safeBase = safeLogicBaseName(name);
  const statePipeline = state.pipeline;
  state.pipeline = pipelineForSave();          // 저장 동안만 원본 기준
  try {
    return _buildLogicZipEntriesImpl(safeBase, name);
  } finally {
    state.pipeline = statePipeline;
  }
}

function _buildLogicZipEntriesImpl(safeBase, name) {
  const stepFiles = state.pipeline.map((s, idx) => {
    const lang = s && s.language ? s.language : "javascript";
    return `${safeBase}_step_${idx + 1}.${lang === "python" ? "py" : "js"}`;
  });

  // [v4] 요구 파일/시트 선언표(pristine 업로드 ∩ 파이프라인 사용)의 교집합. 실패해도 저장은 막지 않는다
  // (표가 없으면 러너가 기존 코드 추론으로 폴백하므로 하위호환).
  let requirements = null;
  try { requirements = computeSkillRequirements(); } catch (e) { console.warn("computeSkillRequirements 실패", e); }

  // [바인딩 변수] requiredFiles 에 파일 핸들(@@FILE_n@@)을 배정하고, 저장되는 코드의 파일명 리터럴을
  // 그 핸들로 치환한다(마이그레이션 도구와 동일 규칙). 라이브 state.pipeline 은 안 건드리고(리터럴 유지,
  // 이번 세션 실행/전체실행 정상), 저장 아티팩트만 핸들화한다. 실행 시 러너가 핸들→실제파일 복원한다.
  // runnerReplaceLiteral(따옴표 정확일치 치환)이 없으면 핸들화를 건너뛰고 리터럴 v4 로 저장(하위호환).
  const canHandleize = typeof runnerReplaceLiteral === "function";
  const handleMap = {};
  if (canHandleize && requirements && Array.isArray(requirements.requiredFiles)) {
    requirements.requiredFiles.forEach((rf, i) => {
      if (rf && rf.name) { rf.handle = "@@FILE_" + (i + 1) + "@@"; handleMap[rf.name] = rf.handle; }
    });
  }
  const handleizeCode = (code) => {
    let out = String(code || "");
    if (!canHandleize) return out;
    Object.keys(handleMap).sort((a, b) => b.length - a.length).forEach(n => {  // 긴 이름 먼저(부분침범 방지)
      out = runnerReplaceLiteral(out, n, handleMap[n]);
    });
    return out;
  };

  const manifest = {
    version: 4,
    type: "mvno-logic",
    name,
    saveBaseName: currentLogicSaveBaseName(stripLogicTimestampSuffix(name)),
    createdAt: new Date().toISOString(),
    stepCount: state.pipeline.length,
    // [v4 신규] 이 스킬을 실행하려면 어떤 파일(입력/출력템플릿)과 시트가 필요한지 명시적으로 선언.
    // requiredFiles[].requiredSheets 는 pristine 에 실제 있던 시트만(생성 시트 제외). unresolvedRefs 는
    // 코드에 박혔지만 업로드 원본과 매칭 안 된 이름(excel_open_* 임시명 등) — 진단/경고용.
    requiredFiles: requirements ? requirements.requiredFiles : [],
    generatedSheets: requirements ? requirements.generatedSheets : [],
    unresolvedRefs: requirements ? requirements.unresolvedRefs : [],
    pipeline: state.pipeline.map((s, idx) => ({
      id: s.id,
      description: s.description,
      // [설명 유실 수정] 카드 라벨은 description 이 제네릭("스킬 생성")이면 prompt(사용자 요청)로
      // 폴백한다. prompt 를 저장하지 않아 불러오면 라벨이 "스킬 생성"으로 남던 문제 → prompt 를 함께 보존.
      prompt: s.prompt || null,
      title: s.title || null,   // [사용자 편집 이름] 카드 라벨을 직접 편집한 이름 → zip 에 보존, 불러오면 그 이름으로 표시
      enabled: isStepEnabled(s),
      language: s.language || "javascript",
      stepFile: stepFiles[idx],
      code: handleizeCode(s.code),   // [바인딩 변수] 파일명 리터럴 → @@FILE_n@@ (라이브 코드는 그대로)
      targetFileId: s.targetFileId || null,  // [#18] 스텝의 대상 파일 바인딩 — 저장/불러오기로 유지되어야 재실행 시 올바른 파일에 적용됨
      targetSheetName: s.targetSheetName || null,
      // 저장된 스킬은 사용자가 적용/확인한 실행 단위다. 이후 전체실행에서 정적검사/재생성으로
      // 원본 코드를 다시 흔들지 않도록 신뢰 플래그를 함께 보존한다.
      trustedStatic: s.trustedStatic === true ||
        (typeof getPipelineRuntimeStatus === "function" && ((getPipelineRuntimeStatus(s.id) || {}).status === "applied")),
    })),
    chatHistory: state.chatHistory,
  };

  const zipEntries = [{
    name: name + ".logic.json",
    text: JSON.stringify(manifest, null, 2),
    mime: "application/json",
  }];

  state.pipeline.forEach((step, idx) => {
    const lang = step.language || "javascript";
    const comment = lang === "python" ? "#" : "//";
    const header = [
      `${comment} ${name}`,
      `${comment} Step ${idx + 1}: ${step.description}`,
      `${comment} Created: ${new Date().toISOString()}`,
      "",
    ].join("\n");
    zipEntries.push({
      name: stepFiles[idx],
      text: header + handleizeCode(step.code),   // [바인딩 변수] 외부 step 파일도 핸들화(로드 시 이 파일이 우선)
      mime: lang === "python" ? "text/x-python" : "text/javascript",
    });
  });

  return zipEntries;
}

let logicAutoBackupTimer = null;
let logicAutoBackupSeq = 0;
let logicAutoBackupLastAt = 0;
const LOGIC_AUTO_BACKUP_MIN_INTERVAL_MS = 20000;
const LOGIC_AUTO_BACKUP_DELAY_MS = 1500;

function updateLogicBackupDirButton(info) {
  const btn = $("btn-backup-dir");
  if (!btn || !info || !info.path) return;
  btn.title = `스킬 자동저장 폴더: ${info.path}`;
}

async function refreshLogicAutoBackupDirStatus() {
  if (!window.fetch || location.protocol === "file:") return null;
  try {
    const resp = await fetch("/api/logic/backup-dir");
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 404) throw new Error("현재 실행 중인 서버가 자동저장 폴더 API를 지원하지 않습니다. 프로그램을 완전히 종료한 뒤 다시 실행하세요.");
    if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    updateLogicBackupDirButton(data);
    return data;
  } catch (err) {
    console.warn("Logic auto-backup dir status failed:", err);
    return null;
  }
}

async function chooseLogicAutoBackupDir() {
  if (!window.fetch || location.protocol === "file:") {
    toast("로컬 서버 실행 상태에서만 자동저장 폴더를 선택할 수 있습니다.", "error");
    return;
  }
  const btn = $("btn-backup-dir");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "📁 선택 중...";
  }
  try {
    const resp = await fetch("/api/logic/backup-dir/select", { method: "POST" });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 404) {
      throw new Error("현재 실행 중인 서버가 자동저장 폴더 API를 지원하지 않습니다. 프로그램을 완전히 종료한 뒤 다시 실행하세요.");
    }
    if (data && data.cancelled) {
      toast("자동저장 폴더 선택을 취소했습니다.", "success");
      updateLogicBackupDirButton(data);
      return;
    }
    if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    updateLogicBackupDirButton(data);
    toast(`스킬 자동저장 폴더를 변경했습니다: ${data.path}`, "success");
  } catch (err) {
    toast("자동저장 폴더 선택 실패: " + (err && err.message ? err.message : String(err)), "error");
    console.warn("Logic auto-backup dir select failed:", err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "📁 자동저장 폴더";
    }
  }
}

setTimeout(() => { refreshLogicAutoBackupDirStatus(); }, 0);

function scheduleLogicAutoBackup(reason) {
  if (!state.pipeline || state.pipeline.length === 0) return;
  if (!window.fetch || location.protocol === "file:") return;
  logicAutoBackupSeq += 1;
  const seq = logicAutoBackupSeq;
  clearTimeout(logicAutoBackupTimer);
  const elapsed = Date.now() - logicAutoBackupLastAt;
  const minDelay = state.pipeline.length >= 20 ? 5000 : LOGIC_AUTO_BACKUP_DELAY_MS;
  const delay = Math.max(minDelay, LOGIC_AUTO_BACKUP_MIN_INTERVAL_MS - elapsed);
  logicAutoBackupTimer = setTimeout(() => saveLogicAutoBackup(reason, seq), delay);
}

async function saveLogicAutoBackup(reason, seq) {
  if (seq !== logicAutoBackupSeq) return;
  logicAutoBackupLastAt = Date.now();
  try {
    const name = timestampedLogicArchiveName(defaultLogicBaseNameFromInputs());
    const blob = createZipBlob(buildLogicZipEntries(name));
    const resp = await fetch("/api/logic/backup", {
      method: "POST",
      headers: {
        "content-type": "application/zip",
        // HTTP 헤더는 latin-1 만 허용 → 한글 파일명(예: "...37단계....zip")을 그대로 넣으면 fetch 가 throw 하고
        // 자동저장이 조용히 실패(.zip 안 생김). percent-encode 해서 보내고 서버가 unquote 로 복원한다.
        "x-filename": encodeURIComponent(`${name}.zip`),
        "x-backup-reason": String(reason || "pipeline-step"),
      },
      body: blob,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    window.lastLogicAutoBackup = data;
    console.info("Logic auto-backup saved:", data.path || data.name);
  } catch (err) {
    console.warn("Logic auto-backup failed:", err);
  }
}

function openSaveModal() {
  if (state.pipeline.length === 0) { toast("저장할 단계가 없습니다", "error"); return; }
  const modal = $("modal");
  const defaultName = currentLogicSaveBaseName(defaultLogicBaseNameFromInputs());
  const previewName = timestampedLogicArchiveName(defaultName) + ".zip";
  modal.innerHTML = `
    <h3>스킬 저장 (ZIP 다운로드)</h3>
    <p style="font-size:12px; color:#666; margin-bottom:10px">
      아래 파일들을 ZIP 하나로 묶어 다운로드합니다:
    </p>
    <ul style="font-size:12px; color:#444; margin:0 0 10px 18px; line-height:1.7">
      <li><b>{이름}.logic.json</b> - 파이프라인 매니페스트 + 채팅 히스토리 (${state.chatHistory.length}개 메시지)</li>
      <li><b>{이름}_step_1.js ~ step_${state.pipeline.length}.js</b> - 각 단계별 실행 코드 파일</li>
    </ul>
    <p style="font-size:11.5px; color:#888; margin-bottom:10px">
      .js/.py 파일은 VSCode 등 외부 에디터에서 직접 수정 가능합니다. 불러오기 시 JSON과 함께 선택하면 수정된 코드가 반영됩니다.
    </p>
    <input type="text" id="save-name" placeholder="파일 이름 (확장자/일시 제외)" value="${escapeHtml(defaultName)}" />
    <p id="save-name-preview" style="font-size:11.5px; color:#666; margin:8px 0 0">
      저장 파일명: ${escapeHtml(previewName)}
    </p>
    <div class="row">
      <button class="btn-secondary" id="modal-cancel">취소</button>
      <button class="btn-primary" id="modal-save">ZIP 다운로드</button>
    </div>
  `;
  $("modal-bg").classList.add("show");
  setTimeout(() => $("save-name").select(), 50);
  const refreshPreview = () => {
    const base = stripLogicTimestampSuffix(($("save-name") && $("save-name").value) || defaultName);
    const preview = $("save-name-preview");
    if (preview) preview.textContent = `저장 파일명: ${timestampedLogicArchiveName(base)}.zip`;
  };
  $("save-name").addEventListener("input", refreshPreview);
  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  $("modal-save").onclick = () => {
    const baseName = rememberLogicSaveBaseName($("save-name").value.trim());
    if (!baseName) return;
    const name = timestampedLogicArchiveName(baseName);
    downloadZip(buildLogicZipEntries(name), name + ".zip");
    $("modal-bg").classList.remove("show");
    toast(`"${name}.zip" 다운로드 시작`, "success");
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w\uAC00-\uD7A3.\-\s]/g, "_");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime || "text/plain" });
  downloadBlob(blob, filename);
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename);
}

const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = ZIP_CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZipBlob(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(entry => {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = typeof entry.text === "string" ? encoder.encode(entry.text) : new Uint8Array(entry.bytes || []);
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, entry.mime === "application/json" ? 0x20 : 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + dataBytes.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endHeader], { type: "application/zip" });
}

function downloadZip(entries, filename) {
  const blob = createZipBlob(entries);
  downloadBlob(blob, filename);
}

async function normalizeLoadedFiles(files) {
  const normalized = [];
  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const extracted = await readStoredZip(file);
      normalized.push(...extracted);
    } else {
      normalized.push(file);
    }
  }
  return normalized;
}

async function readStoredZip(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const decoder = new TextDecoder();
  const files = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    const sig = view.getUint32(0, true);
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    if (sig !== 0x04034b50) throw new Error("Unsupported ZIP format.");
    const compression = view.getUint16(8, true);
    if (compression !== 0) throw new Error("Compressed ZIP entries are not supported.");
    const compressedSize = view.getUint32(18, true);
    const nameLen = view.getUint16(26, true);
    const extraLen = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLen));
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    files.push(new File([data], name));
    offset = dataStart + compressedSize;
  }
  return files;
}

function normalizeLoadedLogicCode(code, language) {
  if (language !== "python") return String(code || "");
  let text = String(code || "").replace(/^\uFEFF/, "");
  const fence = text.match(/```(?:python|py)?\s*\n([\s\S]*?)```/i);
  if (fence) text = fence[1];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let seenPython = false;
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!seenPython) {
      if (!trimmed) return;
      if (trimmed.startsWith("```")) return;
      if (trimmed.startsWith("//")) return;
      if (/^(제목|설명|설명문|title|description)\s*[:：]/i.test(trimmed)) return;
    }
    if (/^(def|import|from|class|@)\b/.test(trimmed)) seenPython = true;
    if (trimmed.startsWith("//")) {
      line = line.slice(0, line.length - line.trimStart().length) + "#" + trimmed.slice(2);
    }
    out.push(line);
  });
  return out.join("\n").trim() + "\n";
}

// [SBAGENT-209] 순수 내부 작업본 이름인지 — excel_open_<hash>.xls 처럼 원본명이 전혀 안 남은 형태만.
// (<hash>_원본명.xlsx 는 원본명이 박혀 있어 기존 접두어 제거/별칭 해석으로 이미 동작 → 건드리지 않음.)
function isInternalTempWorkbookName(name) {
  const stem = String(name || "").replace(/\.[^.]+$/, "");
  return /^(?:excel_open_|live_reset_|prestep_)[0-9a-f]{8,}$/i.test(stem) || /^[0-9a-f]{12,}$/i.test(stem);
}

// [SBAGENT-209] 복붙 캡처가 코드에 박아 저장한 '내부 작업본 이름' 수리(구버전 저장 스킬 하위호환).
// 내부명은 캡처한 라이브 세션이 사라지면 어떤 업로드와도 매칭될 수 없어, 실행기 파일확인에
// 영원히 채울 수 없는 '파일 선택 필요' 행이 뜨고 재생(paste_copied)도 그 이름의 워크북을 못 찾아 깨진다.
//  - dst_book 내부명 + 스텝에 targetFileId 有 → kwarg 제거. paste_copied 는 dst_book 생략 시 스텝
//    자신의 대상 세션 워크북에 붙여넣고, 캡처는 targetFileId 를 '붙여넣은 파일'로 고정하므로 동치다.
//  - src_book 내부명 → 파이프라인에서 소스시트를 targetSheetName 으로 쓰는 input: 파일이 '정확히
//    하나'면 그 파일명으로 치환(모호하면 현행 유지 — 사용자가 파일확인에서 직접 고를 수 있다).
function repairPasteCopiedInternalBookNames(steps) {
  const list = Array.isArray(steps) ? steps : [];
  const sheetOwners = new Map(); // 소스시트(소문자) -> Set(input: 파일명)
  for (const s of list) {
    if (!s || !s.targetFileId || !String(s.targetFileId).startsWith("input:")) continue;
    const book = String(s.targetFileId).slice(6);
    const sheet = String(s.targetSheetName || "").trim();
    if (!book || !sheet) continue;
    const key = sheet.toLowerCase();
    if (!sheetOwners.has(key)) sheetOwners.set(key, new Set());
    sheetOwners.get(key).add(book);
  }
  let touched = 0;
  for (const s of list) {
    if (!s || !s.code || !/paste_copied\s*\(/i.test(String(s.code))) continue;
    let code = String(s.code);
    const before = code;
    if (s.targetFileId) {
      code = code.replace(/,\s*dst_book\s*=\s*(["'])([^"']*)\1/gi,
        (whole, q, name) => (isInternalTempWorkbookName(name) ? "" : whole));
    }
    code = code.replace(
      /(paste_copied\s*\(\s*(["'])([^"']+)\2[^\n]*?src_book\s*=\s*)(["'])([^"']*)\4/gi,
      (whole, head, q1, srcSheet, q2, srcBook) => {
        if (!isInternalTempWorkbookName(srcBook)) return whole;
        const owners = sheetOwners.get(String(srcSheet).trim().toLowerCase());
        if (!owners || owners.size !== 1) return whole;
        const owner = String(Array.from(owners)[0]).replace(/["'\\]/g, "");
        return head + q2 + owner + q2;
      });
    if (code !== before) { s.code = code; touched++; }
  }
  return touched;
}

async function loadLogicFiles(files) {
  if (files.length === 0) return;
  files = await normalizeLoadedFiles(files);
  // 매니페스트 JSON 찾기. 파일명이 바뀌어 있을 수 있으므로 내용으로 검증한다.
  const jsonCandidates = files.filter(f => f.name.toLowerCase().endsWith(".json"));
  if (jsonCandidates.length === 0) {
    throw new Error(".logic.json 매니페스트 파일을 포함해서 선택해 주세요");
  }
  let manifestFile = null, manifestData = null, manifestText = "";
  for (const f of jsonCandidates) {
    try {
      const t = await f.text();
      const parsed = JSON.parse(t);
      if (parsed && Array.isArray(parsed.pipeline)) {
        if (manifestFile) {
          throw new Error(`Multiple logic manifests found (${manifestFile.name}, ${f.name}). Select only one manifest.`);
        }
        manifestFile = f; manifestData = parsed; manifestText = t;
      }
    } catch (e) {
      if (e.message && e.message.startsWith("Multiple logic manifests")) throw e;
      // JSON 파싱 실패 시 후보에서 제외
    }
  }
  if (!manifestFile) {
    throw new Error("Valid .logic.json manifest was not found. A JSON file with a pipeline field is required.");
  }
  const data = manifestData;

  // step 파일 후보 - .js / .py
  const stepFiles = files.filter(f => /\.(js|py)$/i.test(f.name));
  const stepContents = {};
  for (const sf of stepFiles) {
    stepContents[sf.name] = await sf.text();
  }
  const consumed = new Set(); // 이미 매칭된 파일명

  // 보조: 파일명에서 step 번호 힌트 추출. "foo_step_3.js" 또는 "step3.js" 모두 OK.
  function stepNumFromName(name) {
    const m = /step[\s_-]*(\d+)/i.exec(name);
    return m ? parseInt(m[1], 10) : NaN;
  }

  let externallyLoaded = 0;
  let fuzzyMatched = 0;
  const resolvedPipeline = data.pipeline.map((s, idx) => {
    let code = s.code || "";
    const expected = s.stepFile || "";
    let matchedName = null;

    // 1) 정확 매칭
    if (expected && stepContents[expected] && !consumed.has(expected)) {
      matchedName = expected;
    }

    // 2) step 번호 매칭 (파일명에 step_N이 들어 있고 N이 idx+1이면)
    if (!matchedName) {
      for (const f of stepFiles) {
        if (consumed.has(f.name)) continue;
        const n = stepNumFromName(f.name);
        if (n === idx + 1) { matchedName = f.name; break; }
      }
    }

    // 3) 파일명 유사도 매칭 (사용자가 이름을 바꿔둔 경우)
    if (!matchedName && expected && typeof similarity === "function") {
      const candidates = stepFiles.filter(f => !consumed.has(f.name));
      let best = null, bestScore = 0;
      for (const f of candidates) {
        // 확장자를 빼고 비교해 더 너그럽게 매칭
        const a = expected.replace(/\.[^.]+$/, "");
        const b = f.name.replace(/\.[^.]+$/, "");
        const score = similarity(a, b);
        if (score > bestScore) { bestScore = score; best = f.name; }
      }
      if (best && bestScore >= 0.6) matchedName = best;
    }

    // 4) 위치 기반 fallback: i번째 미사용 step 파일을 i번째 step에 연결
    if (!matchedName) {
      const remaining = stepFiles.filter(f => !consumed.has(f.name));
      if (remaining[0] && !s.code) matchedName = remaining[0].name;
    }

    if (matchedName && stepContents[matchedName] !== undefined) {
      code = stepContents[matchedName];
      consumed.add(matchedName);
      externallyLoaded++;
      if (expected && matchedName !== expected) fuzzyMatched++;
    }

    const language = s.language || (matchedName && /\.py$/i.test(matchedName) ? "python" : "javascript");
    code = normalizeLoadedLogicCode(code, language);

    return {
      id: s.id || uid(),
      description: s.description || `Step ${idx + 1}`,
      prompt: s.prompt || null,   // [설명 유실 수정] 저장된 사용자 요청을 복원 → 카드 라벨 폴백/에러복구가 live 와 동일하게 동작
      title: s.title || null,     // [사용자 편집 이름] 저장된 편집 이름 복원 → 불러오면 편집한 이름으로 표시
      enabled: s.enabled !== false,
      language,
      code,
      targetFileId: s.targetFileId || null,  // [#18] 저장된 대상 파일 바인딩 복원(재실행이 올바른 파일에 적용되도록)
      targetSheetName: s.targetSheetName || s.targetSheet || null,
      trustedStatic: s.trustedStatic !== false, // 불러온 zip/json 스킬은 작성자가 확인한 저장본으로 취급
    };
  });

  // [SBAGENT-209] 구버전 캡처가 저장한 내부 작업본 이름(excel_open_<hash>.xls) 수리 — 로드 시 1회.
  try {
    const repairedN = repairPasteCopiedInternalBookNames(resolvedPipeline);
    if (repairedN) console.log("[load] 복붙 내부 작업본 이름 수리:", repairedN, "단계");
  } catch (_) {}

  loadLogic({ ...data, pipeline: resolvedPipeline }, manifestFile.name, {
    externallyLoaded,
    fuzzyMatched,
    totalSteps: resolvedPipeline.length,
    jsCount: stepFiles.length,
  });
}

function openLoadDialog() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".zip,.json,application/json,.js,.py,text/javascript";
  input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    try {
      await loadLogicFiles(files);
    } catch (err) {
      toast("불러오기 실패: " + err.message, "error");
      console.error(err);
    }
  };
  input.click();
}

function loadLogic(data, filename, meta) {
  // 파이프라인 복원. 자동 실행 X (사용자가 "전체 실행"을 눌러야 적용됨).
  state.pipeline = deepClone(data.pipeline || []);
  rememberLogicSaveBaseName(data.saveBaseName || data.name || filename || "logic");
  if (typeof ensurePipelineStepIds === "function") ensurePipelineStepIds();
  // 채팅 히스토리도 함께 복원 (있으면)
  state.chatHistory = Array.isArray(data.chatHistory) ? deepClone(data.chatHistory) : [];
  // [v4] 저장 시 계산된 요구 파일/시트 선언표를 보존한다. 러너가 이걸 그대로 '제시'해 코드 추론이 못 거르는
  // 생성 시트까지 요구 목록에서 빠진다(없으면 = 구버전 zip → 기존 추론 폴백). 이 표는 '불러온 파이프라인'
  // 기준이라, 생성기에서 편집돼 파이프라인이 달라지면 낡는다 → 서명을 함께 저장해 러너가 불일치 시 폴백한다.
  state.loadedSkillRequirements = (data && Array.isArray(data.requiredFiles))
    ? {
        requiredFiles: deepClone(data.requiredFiles),
        generatedSheets: Array.isArray(data.generatedSheets) ? deepClone(data.generatedSheets) : [],
        unresolvedRefs: Array.isArray(data.unresolvedRefs) ? deepClone(data.unresolvedRefs) : [],
      }
    : null;
  // [바인딩 변수] 불러오면 코드의 파일 핸들(@@FILE_n@@)을 원본 이름으로 되돌린다. 핸들은 '저장 포맷'일 뿐,
  // 라이브 세션(생성기 편집·전체실행, 실행기 매핑)은 항상 실제 이름을 쓴다 → 코드가 읽히고, 생성기에서
  // 돌려도 "워크북 없음"이 안 난다. 저장 시 Step C(handleizeCode)가 다시 핸들화한다. 서명은 '되돌린 뒤'
  // 계산해야 이후 편집 여부 판정이 맞다. (핸들 필드 없으면 리터럴 스킬 → no-op.)
  if (state.loadedSkillRequirements && Array.isArray(state.loadedSkillRequirements.requiredFiles)
      && typeof runnerReplaceLiteral === "function") {
    const rfs = state.loadedSkillRequirements.requiredFiles.filter(rf => rf && rf.handle && rf.name);
    if (rfs.length) {
      state.pipeline.forEach(step => {
        if (!step || !step.code) return;
        let c = String(step.code);
        rfs.forEach(rf => { c = runnerReplaceLiteral(c, rf.handle, rf.name); });
        step.code = c;
      });
    }
  }
  // [v4 표 기준 재바인딩] 결과 편집 후 재저장된 v4 스킬은 표(requiredFiles)가 '재저장 시점 업로드
  // 이름'으로 갱신되는 반면, 코드 리터럴/targetFileId 는 스킬 원작 시점의 옛 달 이름으로 남을 수 있다
  // (내부 불일치 zip). 구방식 추론은 '코드 속 옛 이름'을 요구행으로 내놓아 퍼지 매칭→치환됐지만,
  // v4 표는 이미 새 이름이라 치환 대상이 사라져 옛 이름이 실행까지 살아남았다(한전 Step11
  // "워크북 '02...260707' 이 열려 있지 않습니다" 실측). 로드 시점에 옛 이름을 표 이름으로 정규화한다
  // — 월·날짜·버전 무시 안정키(pipelineStableWorkbookKey), 단일 명확 매칭만(모호하면 그대로 둔다).
  try {
    const v4rfs = (state.loadedSkillRequirements && state.loadedSkillRequirements.requiredFiles) || [];
    const tableNames = v4rfs.map(rf => rf && rf.name).filter(Boolean);
    if (tableNames.length && typeof pipelineStableWorkbookKey === "function"
        && typeof runnerReplaceLiteral === "function") {
      const norm = v => (typeof normalizeText === "function"
        ? normalizeText(v) : String(v || "").trim().toLowerCase());
      const tset = new Set(tableNames.map(norm));
      const codeNames = new Set();
      state.pipeline.forEach(step => {
        if (!step) return;
        const t = String(step.targetFileId || "");
        if (t.startsWith("input:")) codeNames.add(t.slice(6));
        try {
          if (step.code && typeof pipelineCollectWorkbookNames === "function") {
            pipelineCollectWorkbookNames(step.code).forEach(n => { if (n) codeNames.add(n); });
          }
        } catch (_) {}
      });
      const renames = [];
      codeNames.forEach(oldName => {
        if (tset.has(norm(oldName))) return;                       // 이미 표 이름과 동일
        const key = pipelineStableWorkbookKey(oldName);
        if (!key || key.length < 4) return;
        const hits = tableNames.filter(tn => pipelineStableWorkbookKey(tn) === key);
        if (hits.length === 1 && norm(hits[0]) !== norm(oldName)) renames.push([oldName, hits[0]]);
      });
      if (renames.length) {
        state.pipeline.forEach(step => {
          if (!step) return;
          if (step.code) {
            let c = String(step.code);
            renames.forEach(([a, b]) => { c = runnerReplaceLiteral(c, a, b); });
            step.code = c;
          }
          const t = String(step.targetFileId || "");
          if (t.startsWith("input:")) {
            const hit = renames.find(([a]) => a === t.slice(6));
            if (hit) step.targetFileId = "input:" + hit[1];
          }
        });
        try { console.log("[load] v4 표 기준 파일명 재바인딩:", renames.map(p => p.join(" → ")).join(" | ")); } catch (_) {}
      }
    }
  } catch (_) {}
  state.loadedSkillReqPipelineSig = state.loadedSkillRequirements
    ? (typeof loadedSkillReqSignature === "function" ? loadedSkillReqSignature(state.pipeline) : null)
    : null;
  state.editingStepId = null;
  // 불러온 파이프라인은 라이브에 아직 적용 안 됨 → 적용추적 시그니처 무효화. 안 하면 첫 '전체 실행'이
  // no-op 으로 거부되거나 옛 서명과 충돌해 "스킬을 적용하지 못했습니다" 가 뜬다. [#18]
  if (typeof invalidateLivePipelineApplied === "function") {
    try { invalidateLivePipelineApplied(); } catch (_) {}
  }
  renderPipeline();
  renderChatFromHistory();
  refreshChatState();
  refreshRunButton();
  // [실행기 스킬 편집기] '스킬 수정' 모달의 [스킬(zip) 올리기]로 업로드한 경우, 열려 있는 모달을
  // 새 스킬로 다시 그린다 — 안 그러면 상태는 로드됐는데 모달 목록만 "업로드된 스킬이 없습니다"로
  // 남아 '업로드가 안 된 것처럼' 보인다(삭제 → 재업로드 실측). 모달 내용으로 편집기인지 식별.
  try {
    const bg = document.getElementById("modal-bg");
    if (document.getElementById("runner-logic-upload") && bg && bg.classList.contains("show")
        && typeof openRunnerLogicEditor === "function") {
      openRunnerLogicEditor();
    }
  } catch (_) {}
  const label = data.name || filename;
  const n = state.pipeline.length;
  const extInfo = meta && meta.externallyLoaded > 0
    ? ` (외부 step 파일 ${meta.externallyLoaded}/${n}개 반영${meta.fuzzyMatched ? `, 그중 ${meta.fuzzyMatched}개는 이름 변경 자동 매칭` : ""})`
    : " (매니페스트 임베딩 코드 사용)";
  const chatInfo = state.chatHistory.length > 0
    ? `, 대화 ${state.chatHistory.length}개 복원`
    : "";
  toast(`"${label}" ${n}단계 로드됨${extInfo}${chatInfo}. 입력/출력 업로드 후 "전체 실행"으로 적용하세요.`, "success");
}

function renderChatFromHistory() {
  const container = $("chat-messages");
  container.innerHTML = "";
  if (state.chatHistory.length === 0) {
    const text = state.output
      ? `출력 템플릿 "${state.output.name}" 이 로드되었습니다. 스킬을 만들어보세요.`
      : (state.inputs.length > 0 ? `입력 파일 ${state.inputs.length}개가 로드되었습니다. 스킬을 만들어보세요.` : "입력 또는 출력 파일 업로드 후 활성화됩니다.");
    addMessage("system", text);
    return;
  }
  addMessage("system", `저장된 대화 ${state.chatHistory.length}개 복원 · 이어서 질문 가능`);
  state.chatHistory.forEach(msg => {
    if (msg.role === "user") {
      // 내부 프롬프트 스캐폴딩([정확 참조]·에러복구·재생성 등)은 감추고 사용자가 친 부분만 표시.
      const shown = (typeof cleanChatDisplayText === "function") ? cleanChatDisplayText(msg.content) : msg.content;
      if (shown && shown.trim()) addMessage("user", shown);
    } else if (msg.role === "assistant") {
      addHistoricAssistant(msg.content);
    }
  });
}

function addHistoricAssistant(fullText) {
  const code = extractCode(fullText);
  const stripped = fullText.replace(/```[\s\S]*?```/g, "").trim();
  const div = document.createElement("div");
  div.className = "msg assistant";
  div.innerHTML = `<div>${escapeHtml(stripped)}</div>`;
  if (code) {
    const codeBlk = document.createElement("pre");
    codeBlk.className = "code-block";
    codeBlk.textContent = code;
    div.appendChild(codeBlk);
    const inPipeline = (state.pipeline || []).some(step => String((step && step.code) || "").trim() === String(code || "").trim());
    if (inPipeline) {
      const badge = document.createElement("div");
      badge.style.cssText = "margin-top:6px; font-size:11px; color:#28a745; font-weight:bold;";
      badge.textContent = "파이프라인에 저장된 단계";
      div.appendChild(badge);
    }
    // '대화 기록 코드 · 파이프라인 미저장' 안내는 지저분해 표시하지 않는다(미저장이면 배지 없음).
  }
  $("chat-messages").appendChild(div);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
}

/* Close modal on backdrop click */
$("modal-bg").addEventListener("click", e => {
  if (e.target === $("modal-bg")) $("modal-bg").classList.remove("show");
});
