/* ============================================================================
 * B2B 클릭 진단 프로브 (console paste)
 * ----------------------------------------------------------------------------
 * 목적: VDI 등에서 "빠른 클릭이 안 먹고, 천천히 꾹 눌렀다 떼면 먹는" 현상의
 *       원인을 mousedown/mouseup/click 쌍 관점에서 판별.
 *
 * 사용법:
 *   1) 앱을 DevTools 켜서 실행 (환경변수 B2B_NATIVE_DEVTOOLS=1 후 재실행)
 *   2) F12 → Console 탭
 *   3) 이 파일 내용 전체를 붙여넣고 Enter
 *   4) 화면 우상단 HUD를 보며, 평소처럼 "안 먹는 빠른 클릭"을 여러 번 시도
 *   5) 카운터를 읽어 아래 판정표로 원인 확정
 *
 * 판정표(핵심):
 *   - "OK" 만 오른다            → 정상 (문제 재현 안 됨)
 *   - "NOCLICK-이동" 이 오른다   → (3) 미세이동 드래그 오인  (커서 지터/폴링레이트)
 *   - "NOCLICK-정지" 가 오른다   → (1) 포커스 레이스 / 쌍 불일치 (foc=N 이면 활성화 레이스 확정)
 *   - "UP누락" 이 오른다         → (2) 입력 병합·드롭 (원격 채널이 up 을 잃음)
 *   - "DOWN없음"(down 자체 0)    → 폴링/훅 단계에서 입력 유실 (앱 밖 문제)
 *
 * HUD 한 줄 예: "NOCLICK-정지 dtUp=41 dtClk=– d=(0,1) foc=N TGT="
 *   dtUp   = down→up 간격(ms),  dtClk = down→click 간격(ms, – 는 click 미발화)
 *   d=(dx,dy) = down 대비 up 좌표 이동(px),  foc = down 시점 document.hasFocus()
 *   TGT= 뒤에 값 있으면 down 과 up 의 타깃 엘리먼트가 다름
 *
 * 종료: window.__b2bClickProbe.stop()
 * ==========================================================================*/
(function () {
  if (window.__b2bClickProbe && window.__b2bClickProbe.stop) {
    try { window.__b2bClickProbe.stop(); } catch (e) {}
  }

  var SLOP = 4;          // 이 px 이하 이동은 "정지"로 간주
  var UP_WAIT = 90;      // up 후 click 을 기다리는 시간(ms)
  var DOWN_WAIT = 500;   // down 후 up 을 기다리는 시간(ms)

  var c = { down: 0, up: 0, click: 0, dbl: 0, ok: 0, moved: 0, still: 0, upMiss: 0, other: 0 };
  var recent = [];
  var cur = null;        // 진행 중 제스처
  var seq = 0;

  function tag(el) {
    if (!el || !el.tagName) return "?";
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    else if (el.className && typeof el.className === "string") s += "." + el.className.split(/\s+/)[0];
    return s.slice(0, 22);
  }

  function classify(g) {
    if (g.done) return;
    g.done = true;
    var line;
    if (g.click) { c.ok++; line = "OK"; }
    else if (!g.up) { c.upMiss++; line = "UP누락"; }
    else {
      var moved = Math.abs(g.dx) > SLOP || Math.abs(g.dy) > SLOP;
      if (moved) { c.moved++; line = "NOCLICK-이동"; }
      else if (g.tgtMismatch) { c.other++; line = "NOCLICK-타깃≠"; }
      else { c.still++; line = "NOCLICK-정지"; }
    }
    var s = line +
      " dtUp=" + (g.dtUp == null ? "–" : g.dtUp) +
      " dtClk=" + (g.dtClick == null ? "–" : g.dtClick) +
      " d=(" + g.dx + "," + g.dy + ")" +
      " foc=" + (g.hadFocus ? "Y" : "N") +
      (g.tgtMismatch ? " TGT=" + g.upTag : "") +
      "  @" + g.downTag;
    recent.push(s);
    if (recent.length > 10) recent.shift();
    render();
  }

  function onDown(e) {
    c.down++;
    if (cur && !cur.done) classify(cur); // 이전 미완 제스처 마감
    cur = {
      id: ++seq, t: e.timeStamp, x: e.clientX, y: e.clientY,
      downTag: tag(e.target), tgt: e.target,
      up: false, click: false, dtUp: null, dtClick: null, dx: 0, dy: 0,
      hadFocus: document.hasFocus(), tgtMismatch: false, upTag: "", done: false
    };
    var g = cur;
    setTimeout(function () { if (!g.done && !g.up) classify(g); }, DOWN_WAIT);
    render();
  }
  function onUp(e) {
    c.up++;
    if (!cur || cur.done) { render(); return; }
    cur.up = true;
    cur.dtUp = Math.round(e.timeStamp - cur.t);
    cur.dx = e.clientX - cur.x;
    cur.dy = e.clientY - cur.y;
    cur.upTag = tag(e.target);
    cur.tgtMismatch = e.target !== cur.tgt;
    var g = cur;
    setTimeout(function () { classify(g); }, UP_WAIT);
    render();
  }
  function onClick(e) {
    c.click++;
    if (cur && !cur.done) { cur.click = true; cur.dtClick = Math.round(e.timeStamp - cur.t); }
    render();
  }
  function onDbl() { c.dbl++; render(); }

  // ---- HUD ----
  var hud = document.getElementById("__b2bClickProbeHud");
  if (!hud) {
    hud = document.createElement("pre");
    hud.id = "__b2bClickProbeHud";
    hud.style.cssText =
      "position:fixed;top:8px;right:8px;z-index:2147483647;margin:0;" +
      "padding:8px 10px;background:rgba(12,14,20,.92);color:#e6edf3;" +
      "font:12px/1.45 Consolas,monospace;white-space:pre;border-radius:8px;" +
      "box-shadow:0 4px 18px rgba(0,0,0,.5);pointer-events:none;" +
      "max-width:46ch;border:1px solid #2b3444";
    document.documentElement.appendChild(hud);
  }
  function render() {
    hud.textContent =
      "B2B 클릭 진단  (stop: __b2bClickProbe.stop())\n" +
      "down " + c.down + "   up " + c.up + "   click " + c.click + "   dbl " + c.dbl + "\n" +
      "OK " + c.ok + "  | NOCLICK-이동 " + c.moved + "  | NOCLICK-정지 " + c.still + "\n" +
      "UP누락 " + c.upMiss + "  | 타깃≠/기타 " + c.other + "\n" +
      "focus=" + (document.hasFocus() ? "Y" : "N") +
      "  active=" + tag(document.activeElement) + "\n" +
      "──────────── 최근(신→구) ────────────\n" +
      recent.slice().reverse().join("\n");
  }

  var opt = true; // capture phase
  window.addEventListener("mousedown", onDown, opt);
  window.addEventListener("mouseup", onUp, opt);
  window.addEventListener("click", onClick, opt);
  window.addEventListener("dblclick", onDbl, opt);

  window.__b2bClickProbe = {
    counts: c,
    reset: function () { for (var k in c) c[k] = 0; recent = []; render(); },
    stop: function () {
      window.removeEventListener("mousedown", onDown, opt);
      window.removeEventListener("mouseup", onUp, opt);
      window.removeEventListener("click", onClick, opt);
      window.removeEventListener("dblclick", onDbl, opt);
      if (hud && hud.parentNode) hud.parentNode.removeChild(hud);
      console.log("[b2bClickProbe] stopped. final=", JSON.stringify(c));
    }
  };
  render();
  console.log("[b2bClickProbe] armed. 화면 우상단 HUD 확인. 종료: __b2bClickProbe.stop()");
})();
