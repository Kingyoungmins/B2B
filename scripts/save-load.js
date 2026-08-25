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

// [지난달 이름 갱신] 불러온 스킬에는 '그 스킬을 만들 때 쓴 파일 이름'(예: ..._2026_4월)이 저장돼
// 있다. 그 스킬을 이번 달 파일로 돌린 뒤(실행기 전체실행 → 결과 편집) 저장하면 저장 창 기본값이
// 지난달 이름으로 떠서, 그대로 저장하면 파일명이 실제 대상과 어긋났다(사용자 실측 2026-08-04).
// 지금 올라온 입력 중 '월·날짜만 다른 같은 계열' 파일이 딱 하나면 그 이름으로 바꿔 제안한다.
// 계열이 다르면(사용자가 직접 지은 이름 등) 손대지 않는다 — 월 재바인딩과 같은 '유일 매칭만' 원칙.
function refreshSaveBaseNameToCurrentInputs(name) {
  try {
    const base = String(name || "").trim();
    if (!base || typeof pipelineStableWorkbookKey !== "function") return name;
    const key = pipelineStableWorkbookKey(base);
    if (!key || key.length < 4) return name;          // 키가 너무 짧으면 매칭 금지(오연결 방지)
    const cur = ((state && state.inputs) || [])
      .map(f => (typeof workbookDisplayName === "function" ? workbookDisplayName(f, "") : (f && f.name) || ""))
      .map(n => String(n || "").replace(/\.(xls[xmb]?|csv|tsv)$/i, "").trim())
      .filter(Boolean);
    const hits = Array.from(new Set(cur.filter(n => pipelineStableWorkbookKey(n) === key)));
    if (hits.length === 1 && hits[0] !== base) return hits[0];   // 유일 일치일 때만 교체
  } catch (_) {}
  return name;
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
  // 기억된 이름이 지난달 파일 이름이면 지금 올라온 같은 계열 파일 이름으로 갱신한다.
  // (typeof 가드: 진단 하네스가 이 함수만 떼어 실행하는 관행이 있어 미로드 시 조용히 건너뛴다)
  const fresh = (typeof refreshSaveBaseNameToCurrentInputs === "function")
    ? refreshSaveBaseNameToCurrentInputs(chosen) : chosen;
  return stripLogicTimestampSuffix(fresh || "logic");
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
      // [수정 유실 2026-08-18] 예전엔 여기서 원본 배열을 '통째로' 돌려줬다. 그래서 실행 상태가
      // 살아 있는 동안 저장하면 — 실행이 길거나(단일 적용도 30~70초), 복원이 어떤 이유로든
      // 안 돌아 상태가 남아 있으면 — 그 사이의 스킬 수정이 저장에서 조용히 빠졌다.
      // 사용자는 수정해서 저장했는데 zip 에는 수정 전 코드가 들어가고, 실행기에서 돌리면
      // 수정 전 스킬이 실행된다(치명 제보). 이제 restore() 와 같은 병합을 쓴다:
      //   · 손 안 댄 스텝 = 코드가 매핑본 그대로 → 원본(제네릭 이름)으로 저장(치환본 유출 방지 유지)
      //   · 실행 중/후 수정된 스텝 = 코드가 매핑본과 다름 → 그 수정을 저장에 반영
      const original = state.pipelineOriginalDuringRun;
      const mapped = Array.isArray(state.pipelineMappedDuringRun) ? state.pipelineMappedDuringRun : [];
      const current = Array.isArray(state.pipeline) ? state.pipeline : original;
      const mappedById = new Map(mapped.map(st => [st && st.id, st]));
      const originalById = new Map(original.map(st => [st && st.id, st]));
      let fromOriginal = 0, keptEdits = 0;
      const merged = current.map(cur => {
        if (!cur || !cur.id) return cur;
        const m = mappedById.get(cur.id);
        const o = originalById.get(cur.id);
        if (!o) return cur;                          // 실행 중 새로 생긴 스텝 → 그대로 저장
        if (m && cur.code === m.code) {
          fromOriginal += 1;
          return { ...cur, code: o.code, targetFileId: o.targetFileId, targetSheetName: o.targetSheetName };
        }
        keptEdits += 1;
        return cur;                                  // 수정된 스텝 — 수정 유지
      });
      // 어느 쪽 코드가 저장됐는지 로그에 남긴다 — '수정했는데 옛 코드가 저장됐다' 제보가 오면
      // 이 한 줄이 원인(실행 상태 잔존 여부)을 바로 가른다.
      try {
        if (typeof traceClientUiEvent === "function") {
          traceClientUiEvent("save.pipeline.source", {
            mappedRunActive: "true", fromOriginal: String(fromOriginal), keptEdits: String(keptEdits),
            steps: String(merged.length),
          });
        }
      } catch (_) {}
      return merged;
    }
  } catch (_) {}
  return state.pipeline;
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

/* [보안 라벨(MIP) 파일 저장 오염 2026-08-12] 백엔드가 워크북을 끝내 못 읽으면(사내 MIP Gateway 가
   붙인 라벨/암호화, DRM 등) inspect_workbook_fallback 이 **파일명을 시트명인 척 지어낸다**.
   앱은 그걸 sheetNamesUnreliable 로 표시해 실행기에서는 무시하는데(drop-handling.js runnerFindSheet),
   스킬 저장은 그 가짜 이름을 envConfig 에 그대로 담고 있었다. 표시는 파일 객체에만 있고 저장 JSON
   에는 안 남으므로, 그 스킬을 나중에 열면 가짜 이름이 '정본'으로 둔갑한다
   → runnerApplyEnvConfigFilter 가 스킬의 진짜 시트 요구를 "그 파일엔 없는 시트"로 보고 강등
   → 시트 치환이 끊겨 나중 실행에서 '시트를 찾을 수 없음'.
   믿을 수 없는 이름은 아예 담지 않는다. 비어 있으면 그 파일은 시트 검증 대상에서 빠지고
   (envConfig 필터가 length 로 게이트한다) 스킬에 적힌 진짜 시트명이 그대로 쓰인다. */
function envConfigSheetNames(file) {
  if (!file || !Array.isArray(file.sheetNames)) return [];
  if (file.sheetNamesUnreliable) return [];
  return [...file.sheetNames];
}

function _buildLogicZipEntriesImpl(safeBase, name) {
  const stepFiles = state.pipeline.map((s, idx) => {
    const lang = s && s.language ? s.language : "javascript";
    return `${safeBase}_step_${idx + 1}.${lang === "python" ? "py" : "js"}`;
  });

  const manifest = {
    version: 3,
    type: "mvno-logic",
    name,
    saveBaseName: currentLogicSaveBaseName(stripLogicTimestampSuffix(name)),
    createdAt: new Date().toISOString(),
    stepCount: state.pipeline.length,
    // [환경 config — 0.6.2 아이디어 채용] 저장 시점의 실제 업로드 파일·시트 목록(휴리스틱이 아닌
    // 사실). 실행기가 코드 스캔으로 뽑은 요구 파일을 이 목록과 '교집합'으로 검증해, 제목/서술문에서
    // 오인된 쓰레기 이름과 (파일,시트) 오귀속을 걸러낸다(수동 저장·자동백업 공용 빌더라 항상 최신).
    envConfig: {
      // name = 실제 업로드 파일명(코드 리터럴이 참조하는 그 이름), displayName = 사용자 편집 표시명.
      // 둘 다 담아야 한다 — 표시명만 담으면 편집된 파일의 코드 리터럴 요구가 '정본에 없음'으로
      // 오폐기된다(교집합의 부분 drop 은 fail-open 이 못 막는다).
      inputs: (state.inputs || []).map((f, idx) => ({
        name: (f && f.name) || "",
        displayName: (typeof workbookDisplayName === "function"
          ? workbookDisplayName(f, `입력 파일 ${idx + 1}`) : "") || "",
        sheetNames: envConfigSheetNames(f),
      })).filter(x => x.name || x.displayName),
      outputs: (state.outputTemplates || []).map(t => {
        const f = t && (t.file || t.original);
        return f && f.name ? {
          name: f.name,
          displayName: (typeof workbookDisplayName === "function" ? workbookDisplayName(f, "") : "") || "",
          sheetNames: envConfigSheetNames(f),
        } : null;
      }).filter(Boolean),
    },
    pipeline: state.pipeline.map((s, idx) => ({
      id: s.id,
      // [다른 달 혼재] prompt/설명 속 옛 달 파일명(@범위 에코 등)도 저장 시 현재 업로드로 유일-재해석
      // — 파일확인 요구 추출이 이 텍스트의 파일명을 읽으므로, 옛 달이 굳으면 두 달을 중복 요구한다.
      description: (typeof normalizeStaleBooksInSavedText === "function"
        ? normalizeStaleBooksInSavedText(s.description) : s.description),
      // [설명 유실 수정] 카드 라벨은 description 이 제네릭("스킬 생성")이면 prompt(사용자 요청)로
      // 폴백한다. prompt 를 저장하지 않아 불러오면 라벨이 "스킬 생성"으로 남던 문제 → prompt 를 함께 보존.
      prompt: (typeof normalizeStaleBooksInSavedText === "function"
        ? normalizeStaleBooksInSavedText(s.prompt || null) : (s.prompt || null)),
      originHistId: s.originHistId || null,   // [번호표 연결] chatHistory 의 histId 와 짝 — 함께 저장돼야 왕복된다
      // [제보 2026-08-21] ✎ 프리필용 '마지막 수정 요청문'. 저장에서 빠지면 zip 왕복 후
      // 다시 최초 프롬프트가 채워져 같은 증상이 재발한다(prompt 와 달리 실행에는 안 쓰인다).
      lastEditPrompt: (typeof normalizeStaleBooksInSavedText === "function"
        ? normalizeStaleBooksInSavedText(s.lastEditPrompt || null) : (s.lastEditPrompt || null)),
      title: s.title || null,   // [사용자 편집 이름] 카드 라벨을 직접 편집한 이름 → zip 에 보존, 불러오면 그 이름으로 표시
      enabled: isStepEnabled(s),
      language: s.language || "javascript",
      stepFile: stepFiles[idx],
      code: s.code,
      // [#18] 스텝의 대상 파일 바인딩 — 저장/불러오기로 유지되어야 재실행 시 올바른 파일에 적용됨.
      // [다른 달 혼재] 옛 달 이름이 zip 에 그대로 굳지 않게, 저장 시점 업로드로 유일-재해석해 기록.
      targetFileId: (typeof normalizeStaleTargetFileIdForSave === "function"
        ? normalizeStaleTargetFileIdForSave(s.targetFileId) : (s.targetFileId || null)),
      targetSheetName: s.targetSheetName || null,
      // [녹화 메타 durable] makeStep 이 도장한 워크북/시트명이 저장에서 빠져 있었다(화이트리스트 누락)
      // — 실행기 '파일확인'의 파일별 요구 도출과 재바인딩이 zip 왕복 후 무력화되던 원인.
      recordedWorkbook: s.recordedWorkbook || null,
      recordedSheet: s.recordedSheet || null,
      // [의도색] 월/날짜 확인 필요 표시(보라 카드)도 왕복 보존 — 불러온 스킬에서 표시가 사라졌다.
      intentNeeded: s.intentNeeded === true || undefined,
      intentReason: s.intentReason || null,
      // 저장된 스킬은 사용자가 적용/확인한 실행 단위다. 이후 전체실행에서 정적검사/재생성으로
      // 원본 코드를 다시 흔들지 않도록 신뢰 플래그를 함께 보존한다.
      // [미적용 편집 방어] '적용됨' 상태면 작성자 확인본으로 보고 trustedStatic 을 박아 왔는데,
      // AI 도움이 '적용 없이' 고친 스텝은 한 번도 실행된 적이 없다. 그대로 승격되면 미검증 코드가
      // 정적검사를 우회하는 저장본이 돼 다음 전체실행에서 터진다 → _unappliedEdit 이면 승격 금지.
      trustedStatic: s._unappliedEdit === true
        ? false
        : (s.trustedStatic === true ||
           (typeof getPipelineRuntimeStatus === "function" && ((getPipelineRuntimeStatus(s.id) || {}).status === "applied"))),
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
      text: header + String(step.code || ""),
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
    window.lastLogicAutoBackup = { ...data, at: Date.now() };
    console.info("Logic auto-backup saved:", data.path || data.name);
  } catch (err) {
    console.warn("Logic auto-backup failed:", err);
    // [AI 도움 가시성 2026-08-25] 실패가 console 에만 남아 사용자도 AI 도 몰랐다(감사 구멍 ③)
    // — auto_backup 폴더에 zip 이 안 생겨도 아무 표시가 없었다. 기록(backup.status 가 읽음) +
    // 서버 트레이스 + 세션당 1회 토스트(매번 띄우면 저장 주기마다 도배가 된다).
    window.__lastLogicBackupError = { at: Date.now(), reason: String(reason || ""),
                                      message: String((err && err.message) || err).slice(0, 300) };
    if (typeof traceClientUiEvent === "function") {
      traceClientUiEvent("save.backup.failed", { reason: String(reason || ""),
        message: String((err && err.message) || err).slice(0, 200) });
    }
    if (!window.__logicBackupFailToasted) {
      window.__logicBackupFailToasted = true;
      toast("스킬 자동저장에 실패했습니다(작업은 계속됩니다). 원인은 AI 도움(F11)에게 물어보세요.", "error");
    }
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
    // [AI 도움 가시성 2026-08-25] zip 조립이 던지면 조용히 끝나고 성공 토스트만 안 떴다(감사
    // 구멍 ③) — 실패를 말하고 모달은 열어 둔다(재시도 자리).
    try {
      downloadZip(buildLogicZipEntries(name), name + ".zip");
    } catch (err) {
      console.error("skill save failed:", err);
      toast("스킬 저장(zip 만들기)에 실패했습니다: " + ((err && err.message) || err), "error");
      return;
    }
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

// ── [다른 달 꼬리표 혼재 수정] ───────────────────────────────────────────────
// 스텝의 targetFileId 는 그 단계를 '만든 달'의 파일명 그대로다. 다른 달 파일로 전체실행/수정한
// 세션에서 저장하면, 수정한 스텝만 이번 달로 되새겨지고 안 건드린 스텝은 옛 달로 남아
// zip 안에 4월·5월이 섞인다(사용자 실측 zip: step1=4월, step2=5월, envConfig=5월만).
// 실행기 파일확인은 스텝별 대상을 원문 이름 그대로 요구 행으로 만들므로 "4월도 필요, 5월도 필요"가 떴다.
// 원칙(사이드이펙트 방지): '유일하게' 해석될 때만 고치고, 모호하면 절대 손대지 않는다(현행 유지).

// [저장 시] 현재 업로드에 없는(stale) targetFileId 만, 기존 4단계 유일 매칭(안정키 포함)으로
// '현재 업로드의 그 파일'로 되새겨 zip 에 기록한다. 라이브 state.pipeline 은 건드리지 않는다.
// 현재 업로드에 실존하는 이름·매칭 실패·모호는 전부 원본 그대로(기존 동작과 동일).
function normalizeStaleTargetFileIdForSave(targetFileId) {
  try {
    const tid = String(targetFileId || "");
    if (!tid.startsWith("input:")) return targetFileId || null;
    if (typeof getFile === "function" && getFile(tid)) return tid;   // 현재 업로드에 실존 → 정상
    if (typeof pipelineResolveSavedTargetFileId === "function") {
      const rebound = pipelineResolveSavedTargetFileId(tid);
      if (rebound && String(rebound).startsWith("input:")) return rebound;
    }
  } catch (_) {}
  return targetFileId || null;
}

// [로드 시] 이미 저장된 zip 의 혼재도 수리한다. envConfig.inputs(저장 시점 업로드 '정본')에 없는
// targetFileId 가 정본의 한 파일과 안정키(월·날짜 무시)로 '유일하게' 일치할 때만 그 이름으로 교정.
// envConfig 없는 구버전 zip·모호(정본에 같은 계열 2개, 예: 4월+5월 동시 업로드)·짧은 키(<4)는
// 전부 무수정 — 기존 동작으로 폴백. 코드/프롬프트 속 리터럴은 건드리지 않는다(요구 행 중복의
// 원인은 꼬리표뿐이고, 리터럴 재작성은 실행 코드를 바꾸는 위험이 있어 범위에서 제외).
function repairStaleTargetFileIds(steps, envConfig) {
  const inputs = (envConfig && Array.isArray(envConfig.inputs)) ? envConfig.inputs : [];
  const cands = inputs
    .map(i => ({ name: String((i && i.name) || "").trim(),
                 displayName: String((i && i.displayName) || "").trim() }))
    .filter(c => c.name || c.displayName);
  if (!cands.length || !Array.isArray(steps)) return 0;
  if (typeof pipelineStableWorkbookKey !== "function") return 0;
  const known = new Set();
  for (const c of cands) {
    if (c.name) known.add(c.name.toLowerCase());
    if (c.displayName) known.add(c.displayName.toLowerCase());
  }
  const keyOf = (v) => { try { return pipelineStableWorkbookKey(v) || ""; } catch (_) { return ""; } };
  let touched = 0;
  for (const s of steps) {
    if (!s) continue;
    const tid = String(s.targetFileId || "");
    if (!tid.startsWith("input:")) continue;
    const book = tid.slice(6).trim();
    if (!book || known.has(book.toLowerCase())) continue;      // 정본에 실존 → 정상
    const key = keyOf(book);
    if (!key || key.length < 4) continue;                      // 짧은 키 매칭 금지(기존 가드와 동일)
    const matches = cands.filter(c =>
      (c.name && keyOf(c.name) === key) || (c.displayName && keyOf(c.displayName) === key));
    if (matches.length !== 1) continue;                        // 모호하면 손대지 않는다
    s.targetFileId = "input:" + (matches[0].name || matches[0].displayName);
    touched++;
  }
  return touched;
}

// [프롬프트/설명 속 옛 달 파일명 교정] 파일확인 요구 추출은 꼬리표만이 아니라 스텝 prompt 의
// @범위[파일/시트!셀] 표기와 자유 텍스트 파일명도 읽는다. 실측(2026-08-04 두 번째 zip): 생성기에서
// 4월 파일 선택 에코가 prompt 에 남은 채 5월 세션에서 단계가 만들어져 — 꼬리표는 전부 5월인데
// prompt 의 "input_원가_2026_4월.xlsx" 때문에 파일확인이 4월·5월을 동시 요구했다.
// 치환 대상은 '.xls* 로 끝나는 정확한 파일명 문자열'만이고 targetFileId 수리와 같은 유일-매칭
// 원칙을 따른다. 코드(step.code)와 chatHistory 는 건드리지 않는다(실행/이력 불변).
function _replaceStaleBookNamesInText(text, resolveName) {
  const s = String(text || "");
  if (!s || !/\.xls(?:x|m|b)?/i.test(s)) return text;
  if (typeof pipelineCollectWorkbookNames !== "function") return text;
  let out = s;
  let changed = false;
  for (const nm of pipelineCollectWorkbookNames(s)) {
    let to = null;
    try { to = resolveName(nm); } catch (_) { to = null; }
    if (to && to !== nm) { out = out.split(nm).join(to); changed = true; }
  }
  return changed ? out : text;
}

function repairStalePromptBookNames(steps, envConfig) {
  const inputs = (envConfig && Array.isArray(envConfig.inputs)) ? envConfig.inputs : [];
  const cands = inputs
    .map(i => ({ name: String((i && i.name) || "").trim(),
                 displayName: String((i && i.displayName) || "").trim() }))
    .filter(c => c.name || c.displayName);
  if (!cands.length || !Array.isArray(steps)) return 0;
  if (typeof pipelineStableWorkbookKey !== "function") return 0;
  const known = new Set();
  for (const c of cands) {
    if (c.name) known.add(c.name.toLowerCase());
    if (c.displayName) known.add(c.displayName.toLowerCase());
  }
  const keyOf = (v) => { try { return pipelineStableWorkbookKey(v) || ""; } catch (_) { return ""; } };
  const resolveName = (nm) => {
    const book = String(nm || "").trim();
    if (!book || known.has(book.toLowerCase())) return null;   // 정본에 실존 → 정상, 무수정
    const key = keyOf(book);
    if (!key || key.length < 4) return null;
    const matches = cands.filter(c =>
      (c.name && keyOf(c.name) === key) || (c.displayName && keyOf(c.displayName) === key));
    if (matches.length !== 1) return null;                     // 모호하면 손대지 않는다
    return matches[0].name || matches[0].displayName;
  };
  let touched = 0;
  for (const s of steps) {
    if (!s) continue;
    let stepChanged = false;
    const p2 = _replaceStaleBookNamesInText(s.prompt, resolveName);
    if (p2 !== s.prompt) { s.prompt = p2; stepChanged = true; }
    const d2 = _replaceStaleBookNamesInText(s.description, resolveName);
    if (d2 !== s.description) { s.description = d2; stepChanged = true; }
    if (stepChanged) touched++;
  }
  return touched;
}

// [저장 시] 위와 같은 교정을 '현재 업로드' 기준으로 — stale 파일명이 유일 재해석될 때만.
function normalizeStaleBooksInSavedText(text) {
  return _replaceStaleBookNamesInText(text, (nm) => {
    const tid = "input:" + String(nm || "").trim();
    if (typeof getFile === "function" && getFile(tid)) return null;   // 현재 업로드에 실존 → 정상
    if (typeof pipelineResolveSavedTargetFileId !== "function") return null;
    const rebound = pipelineResolveSavedTargetFileId(tid);
    if (rebound && String(rebound).startsWith("input:")) return String(rebound).slice(6);
    return null;
  });
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
      // [SBAGENT-289] 저장(297행)만 하고 여기서 떨어뜨렸다 — zip 왕복(실행기 로드→결과편집) 후
      // ✎ 프리필이 최초 프롬프트로 되돌아간 원인. 실측: 저장본 step4 에 "*100" 이 있는데 로드가 버렸다.
      lastEditPrompt: s.lastEditPrompt || null,
      originHistId: s.originHistId || null,   // [번호표 연결] 수정 버튼 → 원 요청 말풍선 정확 연결(텍스트 매칭 아님)
      title: s.title || null,     // [사용자 편집 이름] 저장된 편집 이름 복원 → 불러오면 편집한 이름으로 표시
      enabled: s.enabled !== false,
      language,
      code,
      targetFileId: s.targetFileId || null,  // [#18] 저장된 대상 파일 바인딩 복원(재실행이 올바른 파일에 적용되도록)
      targetSheetName: s.targetSheetName || s.targetSheet || null,
      // [녹화 메타 durable] 저장된 워크북/시트명 복원 — 실행기 파일별 요구 도출·재바인딩용.
      recordedWorkbook: s.recordedWorkbook || null,
      recordedSheet: s.recordedSheet || null,
      intentNeeded: s.intentNeeded === true,
      intentReason: s.intentReason || null,
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

// [구버전 승격] originHistId 없는 스텝(옛 zip): prompt 가 복원된 대화의 user 말풍선과 '정확히 1개'
// 일치할 때만 번호표를 달아준다(재저장하면 신형이 된다). 0개(대화 비움)·2개 이상(같은 문장 중복)은
// 모호하므로 승격하지 않는다 — 월 재바인딩과 같은 '단일 명확 매칭만' 원칙. 캡처/수동 스텝은 대상 아님.
function promoteStepChatOrigins() {
  try {
    const users = (state.chatHistory || []).filter(e => e && e.role === "user" && e.histId);
    if (!users.length) return 0;
    const norm = (typeof _chatNormForMatch === "function")
      ? _chatNormForMatch
      : (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 400);
    let promoted = 0;
    (state.pipeline || []).forEach(step => {
      if (!step || step.originHistId) return;
      const pr = String(step.prompt || "").trim();
      if (!pr || pr === "manual cell edit") return;
      const want = norm(pr);
      if (!want) return;
      const hits = users.filter(e => norm(e.content) === want);
      if (hits.length === 1) { step.originHistId = hits[0].histId; promoted += 1; }
    });
    return promoted;
  } catch (_) { return 0; }
}

function loadLogic(data, filename, meta) {
  // 파이프라인 복원. 자동 실행 X (사용자가 "전체 실행"을 눌러야 적용됨).
  state.pipeline = deepClone(data.pipeline || []);
  // [환경 config] 저장 시점 파일·시트 정본 — 실행기 요구 추출의 교집합 검증 근거.
  // config 없는 구버전 zip 은 null → 필터가 통째로 꺼져 기존 동작 그대로(폴백).
  state.skillEnvConfig = (data && data.envConfig && typeof data.envConfig === "object")
    ? deepClone(data.envConfig) : null;
  rememberLogicSaveBaseName(data.saveBaseName || data.name || filename || "logic");
  if (typeof ensurePipelineStepIds === "function") ensurePipelineStepIds();
  // 채팅 히스토리도 함께 복원 (있으면)
  state.chatHistory = Array.isArray(data.chatHistory) ? deepClone(data.chatHistory) : [];
  // [v4 하위호환] 0.6.2+ 가 저장한 스킬(zip)은 코드의 파일명 리터럴이 자리표(@@FILE_n@@)로 저장되고,
  // 원본 이름은 requiredFiles[].{handle,name} 에 있다. 이 버전은 v4 요구 표를 쓰지 않지만 자리표만은
  // 반드시 원본 이름으로 되돌려야 한다 — 안 하면 실행 코드에 자리표가 남아 "워크북 '@@FILE_1@@' 이
  // 열려 있지 않습니다"로 죽고, 생성시트 판정의 book 키도 어긋나 스킬이 만드는 중간 시트(무선간선망 등)를
  // 업로드하라는 유령 요구가 생긴다(한전 오류신고 2026-07-20 실측). 표 자체는 계속 무시(기존 추론 유지).
  try {
    const rfs = Array.isArray(data && data.requiredFiles)
      ? data.requiredFiles.filter(rf => rf && rf.handle && rf.name)
      : [];
    if (rfs.length && typeof runnerReplaceLiteral === "function") {
      state.pipeline.forEach(step => {
        if (!step || !step.code) return;
        let c = String(step.code);
        rfs.forEach(rf => { c = runnerReplaceLiteral(c, rf.handle, rf.name); });
        step.code = c;
      });
    }
  } catch (_) {}
  // [다른 달 꼬리표 수리] 저장 zip 에 스텝별로 다른 달 파일명이 섞여 있으면(실측: 1단계=4월,
  // 2단계=5월) 실행기 파일확인이 같은 파일을 여러 달로 중복 요구한다 — envConfig 정본 기준
  // '유일' 매칭만 교정(모호·구버전 zip 은 무수정). v4 자리표 복원 '뒤'에 돌아야 한다.
  try {
    if (typeof repairStaleTargetFileIds === "function") {
      const fixedMonths = repairStaleTargetFileIds(state.pipeline, state.skillEnvConfig);
      if (fixedMonths) console.log("[load] 다른 달 대상 꼬리표 수리:", fixedMonths, "단계");
    }
  } catch (_) {}
  // [프롬프트 에코 수리] prompt/@범위 속 옛 달 파일명도 같은 원칙(유일 매칭)으로 교정 —
  // 꼬리표는 깨끗한데 선택 에코가 4월로 남아 파일확인이 두 달을 요구한 실측(2026-08-04 2번째 zip).
  try {
    if (typeof repairStalePromptBookNames === "function") {
      const fixedPrompts = repairStalePromptBookNames(state.pipeline, state.skillEnvConfig);
      if (fixedPrompts) console.log("[load] 프롬프트 옛 달 파일명 수리:", fixedPrompts, "단계");
    }
  } catch (_) {}
  // [구버전 승격] 대화·파이프라인이 모두 복원된 이 시점에 1회. typeof 가드: 진단 하네스가
  // loadLogic 만 추출해 실행하는 관행이 있어(실물 재현 테스트들), 미로드 시 조용히 건너뛴다.
  if (typeof promoteStepChatOrigins === "function") promoteStepChatOrigins();
  state.editingStepId = null;
  // 불러온 파이프라인은 라이브에 아직 적용 안 됨 → 적용추적 시그니처 무효화. 안 하면 첫 '전체 실행'이
  // no-op 으로 거부되거나 옛 서명과 충돌해 "스킬을 적용하지 못했습니다" 가 뜬다. [#18]
  if (typeof invalidateLivePipelineApplied === "function") {
    try { invalidateLivePipelineApplied(); } catch (_) {}
  }
  // [0.7.3 적대 검증] 이전 스킬의 resume(체크포인트) 마커도 함께 무효화 — 남겨두면
  // '보류 일괄 실행' 버튼이 새 스킬에서 살아남아, 리셋 없이 옛 라이브 위에 새 스킬의
  // 뒷단계만 얹는 사고가 난다(체크포인트 이어실행 계열 전부 같은 위험).
  if (typeof clearPipelineResumeFromIndex === "function") {
    try { clearPipelineResumeFromIndex(); } catch (_) {}
  }
  // [실행 상태 잔존 위생 2026-08-18] 매핑 실행 상태(runnerMappingRunActive)가 어떤 이유로든
  // 남아 있으면 이후 '스킬 저장'이 실행 시작 시점의 옛 배열을 참조한다(위 pipelineForSave).
  // 새 스킬을 불러오는 시점엔 정당한 실행이 있을 수 없으므로 강제로 걷어내고, 있었다는 사실을
  // 로그로 남긴다(치명 제보 '수정 전 스킬이 저장·실행됨'의 원인 추적용).
  try {
    if (state.runnerMappingRunActive || state.pipelineOriginalDuringRun) {
      if (typeof traceClientUiEvent === "function") {
        traceClientUiEvent("load.mapped_run_state.leak", { cleared: "true" });
      }
      state.runnerMappingRunActive = false;
      state.pipelineOriginalDuringRun = null;
      state.pipelineMappedDuringRun = null;
    }
  } catch (_) {}
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
      if (shown && shown.trim()) {
        const div = addMessage("user", shown);
        // [번호표 연결] 재렌더 말풍선은 표시용으로 '정리된' 텍스트라 원문 매칭이 안 된다 —
        // histId 를 DOM 에 실어 스텝의 originHistId 조회가 리로드 후에도 동작하게 한다.
        if (div && msg.histId) div.dataset.histId = msg.histId;
      }
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
