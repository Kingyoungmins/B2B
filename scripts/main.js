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
if (typeof setupViewerPreviewMode === "function") setupViewerPreviewMode();
if (typeof setupViewerPopout === "function") setupViewerPopout();
if (typeof setupThinkToggle === "function") setupThinkToggle();
setPage(state.currentPage);
updateModelLabel();
