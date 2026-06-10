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
