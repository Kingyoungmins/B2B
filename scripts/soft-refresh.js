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
    // [실행기 파일 연결 유지 2026-08-04] 스킬이 찾는 파일 ↔ 실제 업로드 파일의 짝(파일확인 결과).
    // 이걸 안 담으면 새로고침 후 자동 재적용이 '스킬에 적힌 옛 파일명' 그대로 돌아 실패한다
    // (그리고 실행기 전체실행 첫 클릭이 실행 대신 파일확인 패널만 여는 원인). fileId 는
    // "input:"+표시명 규칙이라 같은 파일을 복원하면 그대로 유효하다.
    runnerMappings: (state.runnerMappings && typeof state.runnerMappings === "object")
      ? JSON.parse(JSON.stringify(state.runnerMappings)) : null,
    runnerMappingChecked: !!state.runnerMappingChecked,
    // 저장된 값이 아니라 '지금 계산한' 시그니처를 담는다(state 쪽은 지연 갱신이라 낡을 수 있다).
    // 복원 때 이 값과 현재 시그니처가 같을 때만 매핑을 되살린다 — 파일/스킬이 실제로 달라졌으면
    // 옛 짝을 억지로 씌우지 않고 평소처럼 사용자가 파일확인을 하게 둔다.
    runnerMappingSignature: (typeof runnerCurrentMappingSignature === "function")
      ? runnerCurrentMappingSignature() : (state.runnerMappingSignature || ""),
  };
}

async function softRefreshApp() {
  // [0.7.3] 보류 일괄 실행 모달이 떠 있거나 단계 편집(토글/일괄 실행)이 반영 중이면 보류 —
  // F5 는 캡처 핫키라 게이트를 안 지나는데, 이때 새로고침이 끼면 인플라이트 실행 콜과
  // Excel 강제 종료가 경합하고, 취소만 해도 미러 복원이 일괄 실행 모달을 덮는다.
  if (document.getElementById("b2b-batch-resume-modal")) {
    if (typeof toast === "function") toast("보류 일괄 실행 창을 먼저 닫아 주세요.", "error");
    return;
  }
  {
    const busy = typeof pipelineEditBusyReason === "function" ? pipelineEditBusyReason() : "";
    if (busy) { if (typeof toast === "function") toast(busy, "error"); return; }
  }
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

/* [새로고침 즉시복원 2026-08-04] 스킬 재실행 없이 '적용 끝난 상태'로 열 수 있는지 확인한다.
   가능하면 그 상태 서명을 반환(미러를 그 사본으로 연다), 아니면 "" — 호출부는 평소대로 전체 재실행.
   조건: ① 적용할 스텝이 있고 ② 관여 파일 '전부' 서버에 최종상태 사본이 있을 것.
   사본이 없는 경우(엔진이 안 남겼거나·정리로 지워졌거나·스킬/파일이 달라짐)는 전부 여기서 ""가 된다. */
async function _softRefreshResolveInstantRestore() {
  try {
    if (typeof pipelineLiveStateSig !== "function") return "";
    const sig = pipelineLiveStateSig(state.pipeline);
    if (!sig) return "";
    const ids = [];
    const push = f => { if (f && f.backendWorkbookId && !ids.includes(f.backendWorkbookId)) ids.push(f.backendWorkbookId); };
    (state.inputs || []).forEach(push);
    (state.outputTemplates || []).forEach(t => push(t && (t.original || t.file)));
    if (!ids.length) return "";
    const resp = await fetch("/api/pipeline/live-final-snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workbookIds: ids, stateSig: sig }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.ok || !data.ready) {
      if (data && Array.isArray(data.missing) && data.missing.length) {
        console.info("soft-refresh: 최종상태 사본 없음 → 전체 재실행", data.missing);
      }
      return "";
    }
    return sig;
  } catch (err) {
    console.warn("soft-refresh: 즉시복원 확인 실패(전체 재실행으로 진행):", err);
    return "";
  }
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
    // [즉시복원 2026-08-04] 스킬을 처음부터 다시 돌리는 대신, 서버에 '전부 적용된 최종 상태' 사본이
    // 있으면 그 파일로 미러를 연다. 라이브 Excel 은 작업복사본이고 저장을 안 하므로(SaveChanges=False)
    // 창을 닫는 순간 적용 결과가 사라진다 — 그래서 원래는 항상 전 스텝 재실행이었다.
    // 전부(all-or-nothing) 있을 때만 쓴다. 일부만 쓰면 파일마다 적용 시점이 달라 어긋난다.
    const restoreSig = await _softRefreshResolveInstantRestore();
    if (restoreSig && typeof excelMirror === "object" && excelMirror) {
      excelMirror.restoreFromStateSig = restoreSig;
    }
    // 미러 재오픈 — 업로드 직후와 같은 경로(현재 탭 우선, 나머지 백그라운드).
    const landing = snap.currentFileId && typeof getFile === "function" && getFile(snap.currentFileId)
      ? snap.currentFileId : null;
    try {
      if ((state.inputs.length || state.outputTemplates.length) && typeof preopenAllExcelMirrors === "function") {
        try { await preopenAllExcelMirrors(landing, { source: "upload" }); } catch (err) { console.warn("soft-refresh: 미러 재오픈 실패:", err); }
      }
    } finally {
      // 복원 오픈이 끝나면 반드시 해제 — 이후의 평범한 열기가 옛 사본으로 열리면 안 된다.
      if (typeof excelMirror === "object" && excelMirror) excelMirror.restoreFromStateSig = "";
    }
    // [실행기 파일 연결 복원] 스킬이 찾는 파일 ↔ 실제 업로드 파일의 짝. 파일·스킬이 스냅샷 때와
    // 같을 때(시그니처 일치)만 되살린다. 안 되살리면 자동 재적용이 옛 파일명으로 돌아 실패하고,
    // 실행기 전체실행 첫 클릭도 실행 대신 파일확인 패널만 열린다.
    try {
      if (snap.runnerMappings && typeof runnerCurrentMappingSignature === "function") {
        const curSig = runnerCurrentMappingSignature();
        if (curSig && curSig === snap.runnerMappingSignature) {
          state.runnerMappings = snap.runnerMappings;
          state.runnerMappingChecked = !!snap.runnerMappingChecked;
          state.runnerMappingSignature = curSig;   // 재-앵커: 다음 소스변경 검사가 지우지 않게
          if (typeof renderRunnerWorkflow === "function") renderRunnerWorkflow();
        } else {
          console.warn("soft-refresh: 파일/스킬이 달라져 실행기 매핑은 복원하지 않음");
        }
      }
    } catch (err) {
      console.warn("soft-refresh: 실행기 매핑 복원 실패:", err);
    }
    // [중복 자동복구 차단] 'b2bJustReset'(첫 미러 빈화면 자가복구 표식)이 소비되지 않은 채 남으면,
    // 나중에 세션을 확보하는 시점(전체실행 도중일 수 있음)에 '창 다시 열고 자동 재적용'이 겹쳐
    // 발화해 적용 표시가 풀리거나 값이 어긋난다. 미러를 이미 다시 연 지금 시점에 소비한다.
    try { sessionStorage.removeItem("b2bJustReset"); } catch (_) {}
    const restored = state.inputs.length + state.outputTemplates.length;
    if (failures.length) {
      toast(`새로고침 복원: 파일 ${restored}개 복원, ${failures.length}개 실패(${failures.slice(0, 3).join(", ")}${failures.length > 3 ? " 외" : ""}) — 실패한 파일은 다시 업로드해 주세요.`, "error");
    }
    // [사용자 요청 2026-07-31] 복원한 스킬을 '미적용'으로 두지 않고 바로 자동 적용한다 —
    // 검증된 전체적용 경로(runPipelineWithAutoRepair, '결과 편집하기' 폴백과 동일)를 그대로 태운다.
    // 리로드 직후라 resume/checkpoint 잔재가 없고 라이브는 원본 상태 → ignoreCheckpoint 로 처음부터 1회.
    // 실패하면 표준 오류 카드가 뜨고 스킬은 미적용으로 남는다(수동 '전체 실행'으로 재시도 가능).
    const hasSteps = Array.isArray(state.pipeline) && state.pipeline.some(s => s && s.code && s.enabled !== false);
    if (hasSteps && restoreSig) {
      // 즉시복원 성공 — 이미 '적용 끝난 파일'로 열렸으니 재실행하지 않는다.
      // 화면 표시를 실제와 맞춰준다(안 하면 전부 '보류'로 보여 사용자가 또 실행을 누른다).
      try {
        const ids = (typeof activePipelineSteps === "function" ? activePipelineSteps(state.pipeline) : [])
          .map(s => s && s.id).filter(Boolean);
        if (ids.length && typeof setPipelineRuntimeStatus === "function") {
          setPipelineRuntimeStatus(ids, "applied", "적용됨");
        }
        if (typeof noteLivePipelineApplied === "function") noteLivePipelineApplied(state.pipeline);
      } catch (err) {
        console.warn("soft-refresh: 즉시복원 후 상태 표시 실패:", err);
      }
      toast("새로고침 완료 — 적용된 상태 그대로 되살렸습니다.", "success");
    } else if (hasSteps && typeof runPipelineWithAutoRepair === "function") {
      toast("복원한 스킬을 다시 적용하는 중...", "success");
      // [매핑 적용] 실행기 버튼(pipeline.js)과 동일하게 매핑본으로 돌린다 — 이걸 안 감싸면
      // 스킬에 적힌 옛 파일명 그대로 실행돼 "워크북이 열려 있지 않습니다"로 실패한다.
      const __mapRun = (typeof beginMappedPipelineRun === "function") ? beginMappedPipelineRun() : null;
      // [화면 잠금] 복원 중 사용자가 '전체 실행'을 또 눌러 같은 라이브 세션에 2중 실행되는 것 방지.
      if (typeof setGeneratorRunLoading === "function") {
        try { setGeneratorRunLoading(true, "복원한 스킬을 다시 적용하는 중..."); } catch (_) {}
      }
      try {
        await runPipelineWithAutoRepair({ source: "generator", ignoreCheckpoint: true, backgroundMode: true });
        toast("새로고침 완료 — 파일 복원 후 스킬 적용까지 마쳤습니다.", "success");
      } catch (err) {
        console.warn("soft-refresh: 스킬 자동 적용 실패:", err);
        // [오류 카드] 예전엔 토스트 한 줄로만 알려 '조용히 안 됨'으로 느껴졌다 — 표준 오류 카드로
        // 올려 원인과 복구 버튼([에러 복구 시도] 등)을 쓸 수 있게 한다.
        let shown = false;
        if (typeof reportPipelineError === "function") {
          try { reportPipelineError(err); shown = true; } catch (_) {}
        }
        if (!shown) {
          toast("파일·스킬은 복원했지만 자동 적용에 실패했습니다. '전체 실행'으로 다시 적용해 주세요.", "error");
        }
      } finally {
        if (typeof setGeneratorRunLoading === "function") {
          try { setGeneratorRunLoading(false); } catch (_) {}
        }
        if (__mapRun && typeof __mapRun.restore === "function") {
          try { __mapRun.restore(); } catch (_) {}
        }
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
