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
if (typeof setupViewerPopout === "function") setupViewerPopout();
setPage(state.currentPage);
updateModelLabel();
