/* Debug panel disabled in production builds. */
(function disableDebugPanel() {
  window.recordBackendDebugTiming = function() {};
  window.toggleDebugPanel = function() {};
  try {
    localStorage.removeItem("b2bDebugPanelVisible");
  } catch (_) {}
  const existing = document.getElementById("debug-panel");
  if (existing) existing.remove();
})();
