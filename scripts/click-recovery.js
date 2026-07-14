/* click-recovery.js
 * 원격(VDI 등)에서 mouseup(뗌) 신호가 유실돼도 클릭이 '즉시' 먹게 하는 안전망.
 *
 * 배경: 브라우저는 mousedown + mouseup 둘 다 봐야 click 을 만든다. 원격 채널이 mouseup 을
 *       흘리면(진단상 UP누락 ~7%) 버튼이 안 눌린다. 반면 mousedown 은 유실이 거의 없다.
 *
 * 방식(눌림-즉시): mousedown 이 오면 그 자리에서 바로 click 을 만들어 버튼을 실행한다.
 *   - 뒤따라오는 '진짜 click'(뗌이 정상일 때 발생)은 삼켜서 중복 실행을 막는다.
 *   - 더블클릭은 '두 번 연속 눌림'을 감지해 직접 dblclick 을 만들고, 진짜 dblclick 은 삼킨다.
 *     → 파일탭 전환·단계명 편집 같은 더블클릭 기능이 그대로 동작한다.
 *   이전 버전처럼 mouseup/pointerup/이동을 '기다리지' 않으므로 지연이 없다.
 *
 * 안전장치:
 *   - 왼쪽 버튼만.
 *   - 글자 입력/선택 영역(input[text]·textarea·select·contenteditable)은 건드리지 않음.
 *   - 키보드(Enter)로 발생하는 click·앱이 코드로 부르는 el.click() 은 삼키지 않음
 *     (직전 mousedown 이 없으므로 대기목록에 매칭되지 않음).
 *   - 합성 이벤트엔 e.__b2bSynthetic=true 표시(진단/자기이벤트 구분).
 *   - preventDefault 는 '중복 진짜 click/dblclick 을 삼킬 때만' 사용.
 *
 * 끄기: URL ?clickrecovery=0  또는  window.__b2bClickRecovery.disable()
 */
(function setupClickRecovery() {
  if (window.__b2bClickRecovery) return;
  try {
    if (/[?&]clickrecovery=0\b/.test(window.location.search || "")) {
      window.__b2bClickRecovery = { enabled: false, synthCount: 0, disable: function () {} };
      return;
    }
  } catch (_) {}

  var DOUBLE_MS = 400;      // 두 눌림이 이 시간 안이면 더블클릭
  var SUPPRESS_MS = 1200;   // 눌림 후 이 시간 안에 오는 '진짜 click' 은 중복으로 보고 삼킴
  var state = { enabled: true, synthCount: 0, dblCount: 0, swallowed: 0, lastSynthAt: 0 };

  var pendClicks = []; // 삼켜야 할 진짜 click 대기: { t, target }
  var pendDbls = [];   // 삼켜야 할 진짜 dblclick 대기: { t, target }
  var lastDown = null; // { t, target } — 더블 감지용

  function isEditable(el) {
    if (!el || typeof el.closest !== "function") return false;
    return !!el.closest(
      "input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio])," +
      "textarea, select, option, [contenteditable=''], [contenteditable=\"true\"], [contenteditable=true]"
    );
  }
  function related(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    try { return (a.contains && a.contains(b)) || (b.contains && b.contains(a)); } catch (_) { return false; }
  }
  function prune(arr, now) {
    while (arr.length && now - arr[0].t > SUPPRESS_MS) arr.shift();
  }
  function takeMatch(arr, target, now) {
    prune(arr, now);
    for (var i = arr.length - 1; i >= 0; i--) {          // 최신 것부터 매칭
      if (related(arr[i].target, target)) { arr.splice(i, 1); return true; }
    }
    return false;
  }
  function dispatch(type, target, x, y) {
    var ev = new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      button: 0, buttons: 0, clientX: x, clientY: y, detail: type === "dblclick" ? 2 : 1
    });
    ev.__b2bSynthetic = true;
    target.dispatchEvent(ev);
  }

  function onDown(e) {
    if (e.button !== 0) return;
    var target = e.target;
    if (!target || isEditable(target)) return;
    var now = e.timeStamp;
    var x = e.clientX, y = e.clientY;

    // 눌림 즉시 click 합성 → 버튼 실행. 뒤따르는 진짜 click 은 삼킬 예정.
    pendClicks.push({ t: now, target: target });
    dispatch("click", target, x, y);
    state.synthCount++;
    state.lastSynthAt = now;

    // 두 번 연속 눌림 → dblclick 합성. 진짜 dblclick 은 삼킬 예정.
    if (lastDown && now - lastDown.t <= DOUBLE_MS && related(lastDown.target, target)) {
      pendDbls.push({ t: now, target: target });
      dispatch("dblclick", target, x, y);
      state.dblCount++;
      lastDown = null; // 3연타가 매번 dbl 되지 않도록 초기화
    } else {
      lastDown = { t: now, target: target };
    }
  }

  function onRealClick(e) {
    if (e.__b2bSynthetic) return;           // 우리가 만든 것
    if (e.button !== 0) return;
    if (takeMatch(pendClicks, e.target, e.timeStamp)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      state.swallowed++;
    }
  }
  function onRealDbl(e) {
    if (e.__b2bSynthetic) return;
    if (takeMatch(pendDbls, e.target, e.timeStamp)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }

  window.addEventListener("mousedown", onDown, true);
  window.addEventListener("click", onRealClick, true);
  window.addEventListener("dblclick", onRealDbl, true);

  state.disable = function () {
    state.enabled = false;
    window.removeEventListener("mousedown", onDown, true);
    window.removeEventListener("click", onRealClick, true);
    window.removeEventListener("dblclick", onRealDbl, true);
    pendClicks = []; pendDbls = []; lastDown = null;
  };
  window.__b2bClickRecovery = state;
})();
