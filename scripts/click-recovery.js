/* click-recovery.js
 * 원격(VDI 등)에서 mouseup(뗌) 신호가 유실돼도 클릭이 먹게 하는 안전망.
 *
 * 배경: 브라우저는 mousedown + mouseup 을 둘 다 봐야 click 을 만든다. 원격 입력
 *       채널이 mouseup 을 흘리면(진단상 UP누락) 버튼이 안 눌린 것으로 처리된다.
 *
 * 원리: mousedown 이후 실제 mouseup/click 이 안 왔는데, 다음 마우스 이동에서
 *       버튼이 이미 떼진 게 확인되면(=up 유실) 원래 대상에 click 을 합성한다.
 *       pointerup(마우스와 별개 파이프라인)도 보조 경로로 사용한다.
 *
 * 안전장치:
 *   - 왼쪽 버튼만.
 *   - 실제 mouseup/click 이 오면 즉시 취소(중복 발화 방지).
 *   - down→검출 사이 이동이 크면(드래그) 합성 안 함(리사이저·파일매핑·선택 무영향).
 *   - preventDefault/stopPropagation 절대 호출 안 함.
 *   - 정상 PC 에선 mouseup 이 항상 먼저 도착 → pending 이 즉시 해제되어 발화 안 함(inert).
 *   - 합성 이벤트에 e.__b2bSynthetic=true 표시(진단 카운터가 실제 클릭과 구분).
 *
 * 끄기: URL 에 ?clickrecovery=0  또는  window.__b2bClickRecovery.disable()
 */
(function setupClickRecovery() {
  if (window.__b2bClickRecovery) return;
  try {
    if (/[?&]clickrecovery=0\b/.test(window.location.search || "")) {
      window.__b2bClickRecovery = { enabled: false, synthCount: 0, disable: function () {} };
      return;
    }
  } catch (_) {}

  var SLOP = 8;         // 이 px 초과 이동은 드래그로 보고 합성 안 함
  var MAX_AGE = 2000;   // 이보다 오래된 pending 은 무시(ms)
  var POINTER_WAIT = 70; // pointerup 후 실제 up/click 을 기다리는 시간(ms)
  var pending = null;   // { target, x, y, t }
  var state = { enabled: true, synthCount: 0, lastSynthAt: 0 };

  function onDown(e) {
    if (e.button !== 0) return;
    pending = { target: e.target, x: e.clientX, y: e.clientY, t: e.timeStamp };
  }
  function onRealUpOrClick(e) {
    if (e && e.__b2bSynthetic) return; // 우리가 만든 이벤트는 무시
    pending = null;                    // 실제 뗌/클릭 도착 → 합성 불필요
  }
  function synthClick(g) {
    var target = g.target;
    if (!target || (target.nodeType === 1 && !document.contains(target))) {
      target = document.elementFromPoint(g.x, g.y);
    }
    if (!target) return false;
    var opts = {
      bubbles: true, cancelable: true, view: window,
      button: 0, buttons: 0, clientX: g.x, clientY: g.y
    };
    try {
      var up = new MouseEvent("mouseup", opts); up.__b2bSynthetic = true;
      var clk = new MouseEvent("click", opts); clk.__b2bSynthetic = true;
      target.dispatchEvent(up);
      target.dispatchEvent(clk);
    } catch (_) {
      try { if (typeof target.click === "function") target.click(); } catch (__) { return false; }
    }
    state.synthCount++;
    state.lastSynthAt = g.t;
    return true;
  }
  function tryRecover(g, x, y) {
    if (!g) return;
    if (x != null && y != null) {
      if (Math.abs(x - g.x) > SLOP || Math.abs(y - g.y) > SLOP) return; // 드래그 → 제외
    }
    synthClick(g);
  }

  function onMove(e) {
    if (!pending) return;
    if ((e.buttons & 1) !== 0) return;         // 왼쪽 버튼 여전히 눌림 → 대기
    var g = pending;
    pending = null;                            // 한 제스처당 1회
    if (e.timeStamp - g.t > MAX_AGE) return;   // 오래됨 → 무시
    tryRecover(g, e.clientX, e.clientY);
  }
  function onPointerUp(e) {
    if (!pending) return;
    if (e.pointerType && e.pointerType !== "mouse") return;
    if (typeof e.button === "number" && e.button !== 0) return;
    var g = pending;
    // 잠깐 기다렸다가 그 사이 실제 mouseup/click 이 안 오면(=여전히 pending 이 g) 보충
    setTimeout(function () {
      if (pending !== g) return;
      pending = null;
      if (e.timeStamp - g.t > MAX_AGE) return;
      tryRecover(g, null, null);               // pointerup 좌표 기준 이동은 down 좌표와 사실상 동일
    }, POINTER_WAIT);
  }

  window.addEventListener("mousedown", onDown, true);
  window.addEventListener("mouseup", onRealUpOrClick, true);
  window.addEventListener("click", onRealUpOrClick, true);
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("pointerup", onPointerUp, true);

  state.disable = function () {
    state.enabled = false;
    window.removeEventListener("mousedown", onDown, true);
    window.removeEventListener("mouseup", onRealUpOrClick, true);
    window.removeEventListener("click", onRealUpOrClick, true);
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    pending = null;
  };
  window.__b2bClickRecovery = state;
})();
