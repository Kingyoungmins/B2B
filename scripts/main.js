// [리뷰⑦] 페이지 (재)시작 시 네이티브 busy 잠금 잔존 해제 — 초기화(location.reload) 가
// busy=0 발행 없이 떠났어도 새 부팅이 즉시 풀어준다(네이티브 failsafe 90초를 기다리지 않음).
try { if (typeof publishNativeUiBusy === "function") publishNativeUiBusy(false); } catch (_) {}

/* Initial render */
renderInputList();
renderOutputChip();
renderPipeline();
refreshTabs();
renderExcelViewer();
renderRunnerWorkflow();
refreshChatState();
if (typeof setupHistoryButtons === "function") setupHistoryButtons();
if (typeof setupMentionAutocomplete === "function") setupMentionAutocomplete();
if (typeof setupExcelMirrorControls === "function") setupExcelMirrorControls();
if (typeof setupThinkToggle === "function") setupThinkToggle();
if (typeof setupSkillEngineToggle === "function") setupSkillEngineToggle();
setPage(state.currentPage);
updateModelLabel();
if (typeof updateSkillEngineToggle === "function") updateSkillEngineToggle();
