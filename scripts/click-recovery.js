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
 * 삼킴 규칙(중요 — 예전 시간창 방식의 버그를 고친 부분):
 *   - 시간 만료를 두지 않는다. 예전엔 SUPPRESS_MS(1.2초) 안에 온 진짜 click 만 삼켰는데,
 *     길게 누르기나 VDI 전달 지연이 1.2초를 넘으면 진짜 click 이 살아남아 버튼이 두 번
 *     실행됐다(이중발화). 지금은 대기목록이 만료되지 않으므로 아무리 오래 눌러도 1회다.
 *   - 만료를 없애도 '엉뚱한 click 을 삼키는' 사고가 없는 이유 — 삼킴은 세 조건을 모두 만족할 때만:
 *       ① isTrusted (코드가 부르는 el.click(), label 이 체크박스로 전달하는 click 은 untrusted)
 *       ② detail >= 1 (키보드 Enter/Space 로 나는 click 은 detail === 0)
 *       ③ 대기목록에 같은 대상이 있음 (그 대기는 '진짜 눌림'이 만든 것)
 *     즉 진짜 마우스 click 만 삼키는데, 진짜 마우스 click 에는 반드시 자기 눌림이 앞서므로
 *     (최신 것부터 매칭) 남아있는 옛 대기가 나중 클릭을 잡아먹지 않는다.
 *     예전엔 <label><input type=checkbox> 구조에서 label 이 전달한 click 을 포함관계 매칭으로
 *     자기-삼킴해, 뗌이 유실되는 VDI 에서 체크박스가 영영 안 켜졌다(①이 고침).
 *
 * 안전장치:
 *   - 왼쪽 버튼만. 진짜 입력(isTrusted)만 반응.
 *   - 글자 입력/선택 영역(input[text]·textarea·select·contenteditable)은 건드리지 않음.
 *   - 더블클릭 합성은 두 눌림이 DOUBLE_SLOP 안일 때만 — 리사이저를 연속으로 다시 잡을 때
 *     엉뚱한 dblclick(폭 리셋)이 나가던 것을 막는다. (거리 제한이 리사이저 오발화의 실제 해법이라
 *     드래그 핸들을 합성에서 통째로 빼지는 않는다 — '눌림만으로 클릭'은 전 요소에서 유지.)
 *   - 수정자 키(Ctrl/Shift/Alt/Meta)를 합성 이벤트에 복사 — 빠지면 Ctrl+클릭 다중선택이
 *     단일선택으로 뭉개진다.
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

  var DOUBLE_MS = 500;      // 두 눌림이 이 시간 안이면 더블클릭(Windows 기본 더블클릭 시간)
  var DOUBLE_SLOP = 6;      // 두 눌림이 이 픽셀 안이어야 더블클릭(리사이저 재파지 오발화 방지)
  var MAX_PEND = 16;        // 뗌 유실로 안 쓰인 대기가 무한히 쌓이지 않게 하는 상한
  var state = { enabled: true, synthCount: 0, dblCount: 0, swallowed: 0, lastSynthAt: 0 };

  var pendClicks = []; // 삼켜야 할 진짜 click 대기: { target }
  var pendDbls = [];   // 삼켜야 할 진짜 dblclick 대기: { target }
  var lastDown = null; // { t, x, y, target } — 더블 감지용

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
  function push(arr, target) {
    arr.push({ target: target });
    while (arr.length > MAX_PEND) arr.shift();
  }
  // 진짜 마우스 이벤트만 삼킨다(위 '삼킴 규칙' ①②).
  function swallowable(e) {
    return !e.__b2bSynthetic && e.isTrusted === true && (e.detail == null || e.detail >= 1);
  }
  function takeMatch(arr, target) {
    for (var i = arr.length - 1; i >= 0; i--) {          // 최신 것부터 매칭
      if (related(arr[i].target, target)) { arr.splice(i, 1); return true; }
    }
    return false;
  }
  function dispatch(type, target, src, detail) {
    var ev = new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      button: 0, buttons: 0,
      clientX: src.clientX, clientY: src.clientY,
      screenX: src.screenX, screenY: src.screenY,
      ctrlKey: !!src.ctrlKey, shiftKey: !!src.shiftKey,
      altKey: !!src.altKey, metaKey: !!src.metaKey,
      detail: detail
    });
    ev.__b2bSynthetic = true;
    target.dispatchEvent(ev);
  }

  function onDown(e) {
    if (e.button !== 0 || !e.isTrusted) return;
    var target = e.target;
    if (!target || isEditable(target)) return;
    var now = e.timeStamp;

    var isDbl = !!(lastDown &&
      now - lastDown.t <= DOUBLE_MS &&
      related(lastDown.target, target) &&
      Math.abs(e.clientX - lastDown.x) <= DOUBLE_SLOP &&
      Math.abs(e.clientY - lastDown.y) <= DOUBLE_SLOP);

    // 눌림 즉시 click 합성 → 버튼 실행. 뒤따르는 진짜 click 은 삼킬 예정.
    push(pendClicks, target);
    dispatch("click", target, e, isDbl ? 2 : 1);
    state.synthCount++;
    state.lastSynthAt = now;

    // 두 번 연속 눌림(같은 자리) → dblclick 합성. 진짜 dblclick 은 삼킬 예정.
    if (isDbl) {
      push(pendDbls, target);
      dispatch("dblclick", target, e, 2);
      state.dblCount++;
      lastDown = null; // 3연타가 매번 dbl 되지 않도록 초기화
    } else {
      lastDown = { t: now, x: e.clientX, y: e.clientY, target: target };
    }
  }

  function onRealClick(e) {
    if (!swallowable(e) || e.button !== 0) return;
    if (takeMatch(pendClicks, e.target)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      state.swallowed++;
    }
  }
  function onRealDbl(e) {
    if (!swallowable(e)) return;
    if (takeMatch(pendDbls, e.target)) {
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
