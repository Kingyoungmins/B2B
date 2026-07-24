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
      }).then(resp => {
        // [유휴 누수 수정] 응답 body 를 취소해 data-pipe 핸들을 즉시 반환한다. 이 핑은 모든
        // 유휴 상황에서 15초마다 항상 도는데, body 를 안 비우면 유휴엔 GC 가 늦어 핸들/priv
        // 메모리가 단조 증가한다(working set 은 flat, renderer 재생성 때 톱니 = 관측 증상).
        try { if (resp && resp.body) resp.body.cancel(); } catch (_) {}
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
      // 앱/탭 종료 시 Excel 이 Quit 전 빈 회색 창으로 복원되는 것을 줄이기 위해
      // 세션 종료 신호보다 먼저 모든 미러 창을 숨긴다.
      navigator.sendBeacon("/api/excel/hide-all", "");
    } catch {
      post("/api/excel/hide-all", true);
    }
    try {
      navigator.sendBeacon("/__b2b_close", sessionId);
    } catch {
      post("/__b2b_close", true);
    }
  }

  post("/__b2b_ping", false);
  setInterval(() => post("/__b2b_ping", false), 15000);
  window.addEventListener("pagehide", close);
  window.addEventListener("beforeunload", close);
  window.addEventListener("unload", close);
})();
