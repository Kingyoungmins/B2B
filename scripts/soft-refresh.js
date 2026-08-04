/* ===================================================================
   새로고침(작업 유지) — 소프트 리프레시
   ===================================================================
   [사용자 요청 2026-07-31] 프로그램/Excel 이 먹통일 때 '초기화'(전부 삭제) 말고, 업로드한
   파일과 만들어 둔 스킬(파이프라인·대화)을 유지한 채 프로그램만 새로 시작하고 싶다.

   동작 = 초기화의 자매:
     1) 열린 Excel 은 전부 강제 종료(멈춘 COM 해소 — 파일이 아니라 '창'이므로 잃는 것 없음.
        업로드 원본은 서버 WORKBOOKS 에 그대로 있다). 서버가 굳었을 때를 대비해 8초 가드.
     2) 가벼운 스냅샷(sessionStorage): 파일은 workbookId 만, 스킬은 .logic.json 매니페스트
        (buildLogicZipEntries 재사용 — 수동 저장과 완전 동일 포맷이라 복원도 loadLogic 그대로).
     3) location.reload() — 모든 JS 상태/타이머/busy 토큰이 부팅 직후와 같아진다(초기화와 동일 근거).
     4) 부팅 시 스냅샷이 있으면: /api/workbooks/reinspect 로 각 workbookId 의 meta 를 다시 받아
        업로드와 같은 레코드(createBackendPreviewRecord)로 파일 목록을 재구성하고, loadLogic 으로
        스킬·대화를 복원한 뒤 미러를 다시 연다. fileId 는 "input:"+이름 규칙이라 순서·이름이
        같으면 리로드 전과 동일 → 스텝 targetFileId 바인딩도 그대로 맞는다.

   주의: 리로드 후 라이브 Excel 은 '원본' 상태다(스킬 적용 전). 파이프라인은 미적용(보류)로
   복원되며 — 이는 스킬 zip 불러오기와 동일한 계약이라 사용자가 이미 아는 흐름이다.
   =================================================================== */

const SOFT_REFRESH_KEY = "b2bSoftRefreshState";

function collectSoftRefreshSnapshot() {
  const fileMeta = f => ({
    workbookId: (f && f.backendWorkbookId) || "",
    name: (f && (f.name || f.originalName)) || "",
    size: (f && f.size) || 0,
  });
  let logic = null;
  try {
    if (state.pipeline && state.pipeline.length && typeof buildLogicZipEntries === "function") {
      const base = typeof defaultLogicBaseNameFromInputs === "function" ? defaultLogicBaseNameFromInputs() : "logic";
      const name = typeof timestampedLogicArchiveName === "function" ? timestampedLogicArchiveName(base) : base;
      const entries = buildLogicZipEntries(name);
      if (entries && entries[0] && entries[0].text) logic = JSON.parse(entries[0].text);
    }
  } catch (err) {
    console.warn("soft-refresh: 스킬 스냅샷 실패(파일만 복원):", err);
  }
  return {
    v: 1,
    at: Date.now(),
    inputs: (state.inputs || []).map(fileMeta).filter(x => x.workbookId),
    outputs: (state.outputTemplates || [])
      .map(t => t && (t.original || t.file)).map(fileMeta).filter(x => x.workbookId),
    activeOutputIndex: state.activeOutputIndex >= 0 ? state.activeOutputIndex : 0,
    currentFileId: state.currentFileId || null,
    logic,
  };
}

async function softRefreshApp() {
  // 초기화와 같은 이유로 confirm 전에 미러 숨김(항상-위 Excel 이 모달을 가리는 문제).
  try { if (typeof hideAllExcelMirrorWindows === "function") await hideAllExcelMirrorWindows(); } catch (_) {}
  const confirmed = typeof openB2bConfirmModal === "function"
    ? await openB2bConfirmModal(
        "새로고침할까요? 업로드한 파일과 만들어 둔 스킬·대화는 유지됩니다." + String.fromCharCode(10)
        + "(멈춘 Excel 창은 모두 닫고 새로 연 뒤, 스킬을 자동으로 다시 적용합니다)",
        { okLabel: "새로고침" })
    : confirm("새로고침할까요? (파일/스킬 유지)");
  if (!confirmed) {
    try { if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0); } catch (_) {}
    return;
  }
  // 스냅샷은 Excel 종료 '전에' 먼저 저장 — 종료 호출이 굳어 가드로 빠져나와도 복원은 보장.
  try { sessionStorage.setItem(SOFT_REFRESH_KEY, JSON.stringify(collectSoftRefreshSnapshot())); } catch (err) {
    console.warn("soft-refresh: 스냅샷 저장 실패(일반 리로드로 진행):", err);
  }
  // 멈춘 COM 해소: Excel 전부 강제 종료(초기화와 동일 경로). 서버 무응답 대비 8초 가드.
  try {
    const closer = typeof forceCloseAllExcelMirrorSessions === "function"
      ? forceCloseAllExcelMirrorSessions()
      : (typeof closeAllExcelMirrorSessions === "function" ? closeAllExcelMirrorSessions() : Promise.resolve());
    await Promise.race([closer, new Promise(r => setTimeout(r, 8000))]);
  } catch (err) {
    console.warn("소프트 새로고침 중 Excel 종료 실패(리로드는 계속 진행):", err);
  }
  try { sessionStorage.setItem("b2bJustReset", "1"); } catch (_) {}   // 첫 미러 빈화면 자가복구 표식(초기화와 공유)
  location.reload();
}

async function _softRefreshRebuildFile(saved) {
  const resp = await fetch("/api/workbooks/reinspect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workbookId: saved.workbookId }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data || !data.ok || !data.meta) {
    throw new Error((data && data.error) || `HTTP ${resp.status}`);
  }
  const rec = createBackendPreviewRecord(
    { name: saved.name, size: saved.size },
    { workbookId: saved.workbookId, name: data.name || saved.name, meta: data.meta }
  );
  if (!rec) throw new Error("레코드 재구성 실패");
  return rec;
}

async function restoreSoftRefreshSnapshot() {
  let raw = null;
  try {
    raw = sessionStorage.getItem(SOFT_REFRESH_KEY);
    if (raw) sessionStorage.removeItem(SOFT_REFRESH_KEY);   // 1회용 — 실패해도 무한 재시도 안 함
  } catch (_) {}
  if (!raw) return false;
  let snap = null;
  try { snap = JSON.parse(raw); } catch (_) { return false; }
  if (!snap || snap.v !== 1) return false;
  const busyToken = typeof beginUiBusy === "function"
    ? beginUiBusy("이전 작업 복원 중...", { showDelayMs: 0, silentComplete: true }) : null;
  const failures = [];
  try {
    for (let i = 0; i < (snap.inputs || []).length; i++) {
      const saved = snap.inputs[i];
      try {
        const rec = await _softRefreshRebuildFile(saved);
        ensureWorkbookDisplayName(rec, { name: saved.name }, `입력 파일 ${state.inputs.length + 1}`);
        state.inputs.push(rec);
        state.inputsOriginal.push(cloneFileRecord(rec));
      } catch (err) {
        failures.push(saved.name || saved.workbookId);
        console.warn("soft-refresh: 입력 복원 실패:", saved.name, err);
      }
    }
    for (let i = 0; i < (snap.outputs || []).length; i++) {
      const saved = snap.outputs[i];
      try {
        const rec = await _softRefreshRebuildFile(saved);
        ensureWorkbookDisplayName(rec, { name: saved.name }, `출력 파일 ${state.outputTemplates.length + 1}`);
        state.outputTemplates.push(makeOutputTemplate(rec));
      } catch (err) {
        failures.push(saved.name || saved.workbookId);
        console.warn("soft-refresh: 출력 복원 실패:", saved.name, err);
      }
    }
    if (state.outputTemplates.length) {
      const idx = Math.min(Math.max(0, snap.activeOutputIndex || 0), state.outputTemplates.length - 1);
      activateOutputTemplate(idx);
    }
    state.fuzzyResolution = {};
    renderInputList();
    if (typeof renderOutputChip === "function") renderOutputChip();
    refreshTabs();
    refreshChatState();
    // 스킬·대화 복원 — 수동 '스킬 불러오기'와 완전히 같은 로더(계약 동일: 미적용 상태로 복원).
    if (snap.logic && typeof loadLogic === "function") {
      try { loadLogic(snap.logic, "새로고침 복원"); } catch (err) { console.warn("soft-refresh: 스킬 복원 실패:", err); }
    }
    // 미러 재오픈 — 업로드 직후와 같은 경로(현재 탭 우선, 나머지 백그라운드).
    const landing = snap.currentFileId && typeof getFile === "function" && getFile(snap.currentFileId)
      ? snap.currentFileId : null;
    if ((state.inputs.length || state.outputTemplates.length) && typeof preopenAllExcelMirrors === "function") {
      try { await preopenAllExcelMirrors(landing, { source: "upload" }); } catch (err) { console.warn("soft-refresh: 미러 재오픈 실패:", err); }
    }
    const restored = state.inputs.length + state.outputTemplates.length;
    if (failures.length) {
      toast(`새로고침 복원: 파일 ${restored}개 복원, ${failures.length}개 실패(${failures.slice(0, 3).join(", ")}${failures.length > 3 ? " 외" : ""}) — 실패한 파일은 다시 업로드해 주세요.`, "error");
    }
    // [사용자 요청 2026-07-31] 복원한 스킬을 '미적용'으로 두지 않고 바로 자동 적용한다 —
    // 검증된 전체적용 경로(runPipelineWithAutoRepair, '결과 편집하기' 폴백과 동일)를 그대로 태운다.
    // 리로드 직후라 resume/checkpoint 잔재가 없고 라이브는 원본 상태 → ignoreCheckpoint 로 처음부터 1회.
    // 실패하면 표준 오류 카드가 뜨고 스킬은 미적용으로 남는다(수동 '전체 실행'으로 재시도 가능).
    const hasSteps = Array.isArray(state.pipeline) && state.pipeline.some(s => s && s.code && s.enabled !== false);
    if (hasSteps && typeof runPipelineWithAutoRepair === "function") {
      toast("복원한 스킬을 다시 적용하는 중...", "success");
      try {
        await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true });
        toast("새로고침 완료 — 파일 복원 후 스킬 적용까지 마쳤습니다.", "success");
      } catch (err) {
        console.warn("soft-refresh: 스킬 자동 적용 실패:", err);
        toast("파일·스킬은 복원했지만 자동 적용에 실패했습니다. '전체 실행'으로 다시 적용해 주세요.", "error");
      }
    } else if (!failures.length && restored) {
      toast("새로고침 완료 — 파일을 복원했습니다.", "success");
    }
    return true;
  } finally {
    if (busyToken && typeof endUiBusy === "function") endUiBusy(busyToken, { silentComplete: true });
  }
}

// 메뉴 버튼 배선(있으면). 초기화(btn-reset) 옆의 자매 버튼.
(function bindSoftRefreshButton() {
  const bind = () => {
    const btn = document.getElementById("btn-soft-refresh");
    if (btn && !btn._softBound) { btn._softBound = true; btn.onclick = () => { softRefreshApp(); }; }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();

// F5 / Ctrl+R = 소프트 새로고침. WebView2 기본 리로드(가속키)는 스냅샷 없이 리로드해 파일/스킬
// '표시'가 전부 사라진 빈 화면이 되므로(서버엔 남아있지만 화면에서 못 봄) 가로채서 대체한다.
(function bindSoftRefreshHotkeys() {
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const isF5 = e.key === "F5";
    const isCtrlR = (e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "r";
    if (!isF5 && !isCtrlR) return;
    e.preventDefault();
    softRefreshApp();
  }, true);   // capture — WebView2/브라우저 기본 새로고침보다 먼저
})();

// 부팅 복원 — main.js 이후 DOMContentLoaded 시점(모든 의존 함수 로드 완료 후).
(function bootSoftRefreshRestore() {
  const boot = () => { restoreSoftRefreshSnapshot().catch(err => console.warn("soft-refresh 복원 실패:", err)); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else setTimeout(boot, 0);
})();
