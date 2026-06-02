/* ===================================================================
   APP LIFECYCLE
   =================================================================== */
(function setupAppLifecycle() {
  const key = "b2bBrowserSessionId";
  const sessionId = sessionStorage.getItem(key) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  sessionStorage.setItem(key, sessionId);

  function post(path, keepalive) {
    try {
      fetch(path, {
        method: "POST",
        body: sessionId,
        keepalive: !!keepalive,
      }).catch(() => {});
    } catch {
      // Lifecycle signals are best-effort; app behavior must not depend on them.
    }
  }

  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    try {
      navigator.sendBeacon("/__b2b_close", sessionId);
    } catch {
      post("/__b2b_close", true);
    }
  }

  post("/__b2b_ping", false);
  setInterval(() => post("/__b2b_ping", false), 5000);
  window.addEventListener("pagehide", close);
  window.addEventListener("beforeunload", close);
  window.addEventListener("unload", close);
})();
