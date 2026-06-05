/* ===================================================================
   SERVER CONNECTION MONITOR
   로컬 백엔드(/api/backend/health) 연결을 폴링해 끊김을 감지하고,
   상단 배너 + "지금 재연결" 버튼 + 자동 재시도로 복구한다.
   네이티브 셸에서는 webview 브릿지로 서버 재시작을 요청한다.
   기존엔 서버가 죽으면 앱 창을 다 끄고 다시 켜야 했던 문제 해결.
   =================================================================== */
(function setupServerMonitor() {
  if (location.protocol === "file:") return; // 서버 없는 정적 모드는 제외

  const HEALTH_URL = "/api/backend/health";
  const POLL_MS = 4000;
  const FAIL_THRESHOLD = 2; // 연속 실패 2회부터 끊김으로 간주(일시적 깜빡임 무시)

  let failCount = 0;
  let disconnected = false;
  let reconnecting = false;
  let banner = null;
  let restartRequestedAt = 0;

  // 자동 재연결은 내부적으로 계속 동작하지만, 사용자에게는 일상적인 끊김/재연결 안내를 숨긴다.
  // (너무 자주 떠서 정신없다는 피드백) 진짜 죽어서 사용자 조치가 필요한 "반복 종료"만 노출한다.
  const SILENT_RECONNECT = true;

  function isNativeShell() {
    return !!(window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === "function");
  }

  // 재연결/배너는 ixi 모델이 선택됐을 때만 동작. (Claude·개발망 vLLM 선택 시엔 알림 안 띄움)
  function isIxiSelected() {
    try {
      return typeof settings !== "undefined" && settings &&
        settings.provider === "openai-compat" && settings.network !== "dev-vllm";
    } catch (_) {
      return false;
    }
  }

  async function pingHealth(timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 3000);
    try {
      const resp = await fetch(HEALTH_URL, {
        method: "GET",
        signal: ctrl.signal,
        cache: "no-store",
      });
      return resp.ok;
    } catch (_) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = "server-monitor-banner";
    banner.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:2147483647",
      "display:none", "align-items:center", "justify-content:center", "gap:14px",
      "padding:10px 16px", "background:#b00020", "color:#fff",
      "font-size:13px", "font-weight:600", "box-shadow:0 2px 10px rgba(0,0,0,.3)",
    ].join(";");
    banner.innerHTML =
      '<span data-role="msg">서버 연결이 끊겼습니다. 재연결 중...</span>' +
      '<button type="button" data-role="retry" style="background:#fff;color:#b00020;border:none;border-radius:6px;padding:5px 14px;font-weight:700;cursor:pointer">지금 재연결</button>';
    (document.body || document.documentElement).appendChild(banner);
    banner.querySelector("[data-role='retry']").onclick = () => reconnectNow();
    return banner;
  }

  function showBanner(msg, force) {
    // 조용한 모드에서는 치명적(force) 알림만 노출하고, 일상적 재연결 안내는 띄우지 않는다.
    if (SILENT_RECONNECT && !force) return;
    const b = ensureBanner();
    if (msg) b.querySelector("[data-role='msg']").textContent = msg;
    b.style.display = "flex";
  }
  function hideBanner() {
    if (banner) banner.style.display = "none";
  }
  function setBannerMsg(msg) {
    if (banner) banner.querySelector("[data-role='msg']").textContent = msg;
  }

  function onDisconnected() {
    if (disconnected) return;
    disconnected = true;
    showBanner("서버 연결이 끊겼습니다. 재연결 중...");
    autoReconnectLoop();
  }

  function onReconnected() {
    failCount = 0;
    if (!disconnected) return;
    disconnected = false;
    reconnecting = false;
    hideBanner();
    if (!SILENT_RECONNECT && typeof toast === "function") toast("서버에 다시 연결되었습니다.", "success");
  }

  function requestServerRestart() {
    if (!isNativeShell()) return false;
    const now = Date.now();
    if (now - restartRequestedAt < 8000) return false; // 재시작 요청 과도 방지
    restartRequestedAt = now;
    try {
      window.chrome.webview.postMessage("B2B_RESTART_SERVER");
      return true;
    } catch (_) {
      return false;
    }
  }

  async function autoReconnectLoop() {
    if (reconnecting) return;
    reconnecting = true;
    let attempt = 0;
    while (disconnected) {
      if (!isIxiSelected()) { disconnected = false; hideBanner(); break; }
      attempt++;
      const ok = await pingHealth(2500);
      if (ok) {
        onReconnected();
        return;
      }
      // 자동으로 서버를 재시작하지 않는다(재시작은 메모리 상태를 모두 지우므로).
      // 일시적 끊김은 폴링으로 자연 복구하고, 진짜 죽었으면 사용자가 [지금 재연결]을 눌러 재시작한다.
      setBannerMsg("서버 연결이 끊겼습니다. [지금 재연결]을 누르세요. (" + attempt + "회)");
      await new Promise(r => setTimeout(r, 3000));
    }
    reconnecting = false;
  }

  async function reconnectNow() {
    if (!isIxiSelected()) { disconnected = false; reconnecting = false; failCount = 0; hideBanner(); return; }
    setBannerMsg("재연결 시도 중...");
    const ok = await pingHealth(2500);
    if (ok) {
      onReconnected();
      return;
    }
    // 살아 있는 서버를 죽이지 않는다(=메모리 상태 유지). 연결만 재시도한다.
    // 서버 프로세스가 진짜 종료된 경우에만 네이티브 호스트가 종료를 감지해 재기동한다.
    if (!disconnected) {
      disconnected = true;
      showBanner();
    }
    if (!reconnecting) autoReconnectLoop();
  }

  async function poll() {
    if (!isIxiSelected()) {
      // ixi가 아니면 모니터링/배너 비활성화 + 상태 초기화.
      if (disconnected || (banner && banner.style.display !== "none")) {
        disconnected = false;
        reconnecting = false;
        hideBanner();
      }
      failCount = 0;
      return;
    }
    const ok = await pingHealth(3000);
    if (ok) {
      if (disconnected) onReconnected();
      else failCount = 0;
    } else {
      failCount++;
      if (failCount >= FAIL_THRESHOLD) onDisconnected();
    }
  }

  setInterval(poll, POLL_MS);

  // 다른 모듈에서 백엔드 호출 실패 시 즉시 점검을 트리거할 수 있도록 노출.
  window.b2bReportServerError = function () {
    if (!isIxiSelected()) return;
    failCount = Math.max(failCount, FAIL_THRESHOLD - 1);
    poll();
  };

  // ---- AI 모델 서버(업스트림) 알림 배너 ----
  // LLM 호출 실패 시 호출됨. 로컬 백엔드가 살아있으면 업스트림(주황) 배너를 띄우고,
  // 로컬이 죽었으면 로컬(빨강) 배너 경로로 넘긴다. 다음 LLM 성공 시 자동으로 사라진다.
  let upstreamBanner = null;
  function ensureUpstreamBanner() {
    if (upstreamBanner) return upstreamBanner;
    upstreamBanner = document.createElement("div");
    upstreamBanner.id = "upstream-monitor-banner";
    upstreamBanner.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:2147483646",
      "display:none", "align-items:center", "justify-content:center", "gap:14px",
      "padding:10px 16px", "background:#b26a00", "color:#fff",
      "font-size:13px", "font-weight:600", "box-shadow:0 2px 10px rgba(0,0,0,.3)",
    ].join(";");
    upstreamBanner.innerHTML =
      '<span data-role="msg">AI 모델 서버에 연결할 수 없습니다.</span>' +
      '<button type="button" data-role="dismiss" style="background:#fff;color:#b26a00;border:none;border-radius:6px;padding:5px 14px;font-weight:700;cursor:pointer">닫기</button>';
    (document.body || document.documentElement).appendChild(upstreamBanner);
    upstreamBanner.querySelector("[data-role='dismiss']").onclick = () => { upstreamBanner.style.display = "none"; };
    return upstreamBanner;
  }
  function showUpstreamBanner(msg) {
    const b = ensureUpstreamBanner();
    b.querySelector("[data-role='msg']").textContent = msg || "AI 모델 서버에 연결할 수 없습니다.";
    b.style.display = "flex";
  }

  window.b2bReportUpstreamOk = function () {
    if (upstreamBanner) upstreamBanner.style.display = "none";
  };

  window.b2bReportUpstreamError = async function (err) {
    // 로컬 백엔드가 멀쩡한지 먼저 확인 — 로컬이 죽었으면 그건 로컬 배너 경로가 처리.
    const localOk = await pingHealth(2500);
    if (!localOk) {
      if (isIxiSelected()) { failCount = Math.max(failCount, FAIL_THRESHOLD); poll(); }
      return;
    }
    if (disconnected) return; // 로컬 끊김 배너가 떠 있으면 양보
    const detail = (err && err.message) ? String(err.message).split("\n")[0] : "";
    showUpstreamBanner("AI 모델 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요." + (detail ? "  (" + detail.slice(0, 80) + ")" : ""));
  };

  // 네이티브 호스트가 서버를 재시작했음을 알리면 즉시 재확인. (ixi일 때만 배너 표시)
  window.addEventListener("b2bServerReconnected", () => { reconnectNow(); });
  window.addEventListener("b2bServerRestarting", () => {
    if (!isIxiSelected()) return;
    if (!disconnected) { disconnected = true; }
    showBanner("서버를 재시작하는 중...");
  });
  window.addEventListener("b2bServerCrashedFatal", () => {
    if (!isIxiSelected()) return;
    // 치명적: 반복 종료라 사용자 조치가 필요 → 조용한 모드에서도 노출(force).
    showBanner("서버가 반복적으로 종료되었습니다. 앱을 재시작해 주세요. [지금 재연결]로 한 번 더 시도할 수 있습니다.", true);
  });
})();
