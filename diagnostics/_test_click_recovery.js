// click-recovery.js 상태머신을 최소 DOM 셧으로 실제 구동해 검증.
// node diagnostics/_test_click_recovery.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
function ck(name, cond, got) {
  console.log((cond ? " OK  " : "FAIL ") + name + (cond ? "" : "  got=" + JSON.stringify(got)));
  if (!cond) fails++;
}

// ---- 최소 DOM/이벤트 셧 ----
function makeHarness() {
  const winListeners = {};
  let buttonClicks = 0;
  let buttonMouseups = 0;

  const button = {
    nodeType: 1,
    _tag: "button#run",
    _own: {},
    addEventListener(t, fn) { (this._own[t] = this._own[t] || []).push(fn); },
    dispatchEvent(ev) {
      ev.target = ev.target || button;
      // 버블: 대상 자체 리스너 → window(capture 대용) 리스너
      (button._own[ev.type] || []).slice().forEach(fn => fn(ev));
      (winListeners[ev.type] || []).slice().forEach(fn => fn(ev));
      return true;
    },
    click() { buttonClicks++; }
  };
  button.addEventListener("click", () => { buttonClicks++; });
  button.addEventListener("mouseup", () => { buttonMouseups++; });

  const windowObj = {
    location: { search: "" },
    addEventListener(t, fn) { (winListeners[t] = winListeners[t] || []).push(fn); },
    removeEventListener(t, fn) { if (winListeners[t]) winListeners[t] = winListeners[t].filter(f => f !== fn); },
  };
  const documentObj = {
    contains() { return true; },
    elementFromPoint() { return button; },
  };
  function MouseEvent(type, opts) { Object.assign(this, { type }, opts || {}); }

  const sandbox = {
    window: windowObj, document: documentObj, MouseEvent,
    setTimeout, clearTimeout, console,
  };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, "..", "scripts", "click-recovery.js"), "utf8");
  vm.runInContext(code, sandbox);

  let ts = 1000;
  function fire(type, props) {
    ts += 5;
    const ev = Object.assign({ type, timeStamp: ts, button: 0, buttons: 0, clientX: 100, clientY: 100 }, props || {});
    (winListeners[type] || []).slice().forEach(fn => fn(ev));
    return ev;
  }
  return {
    windowObj, button,
    fire,
    get synth() { return windowObj.__b2bClickRecovery.synthCount; },
    get bClicks() { return buttonClicks; },
    get bUps() { return buttonMouseups; },
    setTs(v) { ts = v; },
  };
}

(async () => {
  // S1: 정상 클릭 (down→up→click) → 합성 없음
  {
    const h = makeHarness();
    h.fire("mousedown", { buttons: 1 });
    h.fire("mouseup", { buttons: 0 });
    h.fire("click", { buttons: 0 });
    ck("(S1) 정상클릭: 합성 0", h.synth === 0, h.synth);
  }

  // S2: mouseup 유실 → 이후 mousemove(버튼 뗌) → 합성 1, 버튼에 click 도달
  {
    const h = makeHarness();
    h.fire("mousedown", { buttons: 1 });
    // up 이 안 옴. 사용자가 마우스를 움직임(버튼 이미 뗌)
    h.fire("mousemove", { buttons: 0, clientX: 101, clientY: 100 });
    ck("(S2) up유실→이동감지 합성 1", h.synth === 1, h.synth);
    ck("(S2) 버튼 click 도달", h.bClicks >= 1, h.bClicks);
    ck("(S2) 보충 mouseup 도 도달", h.bUps >= 1, h.bUps);
  }

  // S3: 드래그(이동 큼) → 합성 안 함
  {
    const h = makeHarness();
    h.fire("mousedown", { buttons: 1, clientX: 100, clientY: 100 });
    h.fire("mousemove", { buttons: 0, clientX: 200, clientY: 240 }); // 100,140 px 이동
    ck("(S3) 드래그(이동>SLOP): 합성 0", h.synth === 0, h.synth);
  }

  // S4: 버튼 계속 눌림(buttons=1) 동안엔 대기, 뗀 뒤에만 합성
  {
    const h = makeHarness();
    h.fire("mousedown", { buttons: 1 });
    h.fire("mousemove", { buttons: 1, clientX: 101, clientY: 101 }); // 아직 눌림
    ck("(S4a) 눌린 상태 이동: 합성 0", h.synth === 0, h.synth);
    h.fire("mousemove", { buttons: 0, clientX: 101, clientY: 101 }); // 뗌
    ck("(S4b) 뗀 뒤 이동: 합성 1", h.synth === 1, h.synth);
  }

  // S5: pointerup 경로 — down→pointerup, 실제 up/click 없음 → 70ms 뒤 합성
  {
    const h = makeHarness();
    h.fire("mousedown", { buttons: 1 });
    h.fire("pointerup", { buttons: 0, pointerType: "mouse" });
    ck("(S5a) pointerup 직후엔 아직 대기", h.synth === 0, h.synth);
    await new Promise(r => setTimeout(r, 130));
    ck("(S5b) 70ms 뒤 실제 up 없으면 합성 1", h.synth === 1, h.synth);
  }

  // S6: pointerup 후 실제 click 이 곧 도착 → 합성 안 함
  {
    const h = makeHarness();
    h.fire("mousedown", { buttons: 1 });
    h.fire("pointerup", { buttons: 0, pointerType: "mouse" });
    h.fire("mouseup", { buttons: 0 });   // 실제 up 이 살짝 늦게 도착
    h.fire("click", { buttons: 0 });
    await new Promise(r => setTimeout(r, 130));
    ck("(S6) pointerup 뒤 실제 click 오면 합성 0", h.synth === 0, h.synth);
  }

  // S7: 오른쪽 버튼은 무시
  {
    const h = makeHarness();
    h.fire("mousedown", { button: 2, buttons: 2 });
    h.fire("mousemove", { buttons: 0 });
    ck("(S7) 우클릭 down 은 복구 안 함", h.synth === 0, h.synth);
  }

  console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
  process.exit(fails ? 1 : 0);
})();
