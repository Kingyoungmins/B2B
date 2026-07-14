// click-recovery.js(눌림-즉시 모델) 상태머신을 최소 DOM 셧으로 실제 구동해 검증.
// node diagnostics/_test_click_recovery.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
function ck(name, cond, got) {
  console.log((cond ? " OK  " : "FAIL ") + name + (cond ? "" : "  got=" + JSON.stringify(got)));
  if (!cond) fails++;
}

function makeHarness() {
  const winListeners = {};
  const windowObj = {
    location: { search: "" },
    addEventListener(t, fn) { (winListeners[t] = winListeners[t] || []).push(fn); },
    removeEventListener(t, fn) { if (winListeners[t]) winListeners[t] = winListeners[t].filter(f => f !== fn); },
  };
  function dispatchThrough(target, ev) {
    ev.target = ev.target || target;
    let stopped = false;
    ev.stopImmediatePropagation = () => { stopped = true; };
    ev.stopPropagation = () => {};
    ev.preventDefault = () => { ev.defaultPrevented = true; };
    const wl = (winListeners[ev.type] || []).slice();
    for (const fn of wl) { fn(ev); if (stopped) return true; }
    const tl = (target._own[ev.type] || []).slice();
    for (const fn of tl) fn(ev);
    return true;
  }
  function makeEl(tag, opts) {
    opts = opts || {};
    const own = {};
    const el = {
      _tag: tag, _isEditable: !!opts.editable, _own: own,
      addEventListener(t, fn) { (own[t] = own[t] || []).push(fn); },
      contains(x) { return x === el; },
      closest(sel) {
        if (el._isEditable && /input|textarea|select|contenteditable|option/.test(sel)) return el;
        return null;
      },
      dispatchEvent(ev) { return dispatchThrough(el, ev); },
    };
    return el;
  }
  function MouseEvent(type, opts) { Object.assign(this, { type, detail: 1 }, opts || {}); }

  const sandbox = { window: windowObj, document: { contains: () => true }, MouseEvent, setTimeout, clearTimeout, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "scripts", "click-recovery.js"), "utf8"), sandbox);

  let ts = 1000;
  function fireReal(target, type, props) {
    ts += 5;
    const ev = new MouseEvent(type, Object.assign({ timeStamp: ts, button: 0, buttons: 0, clientX: 50, clientY: 50 }, props || {}));
    return dispatchThrough(target, ev);
  }
  return { windowObj, makeEl, fireReal, setTs(v) { ts = v; }, bumpTs(d) { ts += d; },
    get synth() { return windowObj.__b2bClickRecovery.synthCount; },
    get dbl() { return windowObj.__b2bClickRecovery.dblCount; },
    get swallowed() { return windowObj.__b2bClickRecovery.swallowed; } };
}

// S1: 정상 단일클릭(뗌 정상) → 버튼 1회만 실행(중복 없음)
{
  const h = makeHarness();
  const btn = h.makeEl("button"); let clicks = 0; btn.addEventListener("click", () => clicks++);
  h.fireReal(btn, "mousedown", { button: 0 });     // 눌림 → 합성 click
  h.fireReal(btn, "click", {});                    // 진짜 click → 삼켜짐
  ck("(S1) 정상클릭: 버튼 1회만", clicks === 1, clicks);
  ck("(S1) 진짜 click 1개 삼킴", h.swallowed === 1, h.swallowed);
}

// S2: 뗌 유실(진짜 click 없음) → 그래도 버튼 1회 실행
{
  const h = makeHarness();
  const btn = h.makeEl("button"); let clicks = 0; btn.addEventListener("click", () => clicks++);
  h.fireReal(btn, "mousedown", { button: 0 });     // 눌림만 옴(up 드롭)
  ck("(S2) up유실에도 버튼 1회", clicks === 1, clicks);
}

// S3: 더블클릭 → onclick 2회 + ondblclick 1회 (정상 브라우저와 동일), 진짜 것들은 삼킴
{
  const h = makeHarness();
  const el = h.makeEl("div"); let clicks = 0, dbls = 0;
  el.addEventListener("click", () => clicks++);
  el.addEventListener("dblclick", () => dbls++);
  h.fireReal(el, "mousedown", { button: 0 });      // down1 → click
  h.bumpTs(120);
  h.fireReal(el, "mousedown", { button: 0 });      // down2(400ms내) → click + dblclick
  h.fireReal(el, "click", {}); h.fireReal(el, "click", {}); h.fireReal(el, "dblclick", {}); // 진짜들 삼킴
  ck("(S3) 더블: onclick 2회", clicks === 2, clicks);
  ck("(S3) 더블: ondblclick 1회", dbls === 1, dbls);
}

// S4: 글자입력 영역은 건드리지 않음
{
  const h = makeHarness();
  const inp = h.makeEl("input", { editable: true }); let clicks = 0; inp.addEventListener("click", () => clicks++);
  h.fireReal(inp, "mousedown", { button: 0 });
  ck("(S4) input(text): 합성 안 함", h.synth === 0 && clicks === 0, { s: h.synth, c: clicks });
}

// S5: 키보드/프로그램 click(직전 down 없음)은 삼키지 않음
{
  const h = makeHarness();
  const btn = h.makeEl("button"); let clicks = 0; btn.addEventListener("click", () => clicks++);
  h.fireReal(btn, "click", {});                    // down 없이 click 만(Enter/el.click())
  ck("(S5) 키보드 click 통과", clicks === 1 && h.swallowed === 0, { c: clicks, s: h.swallowed });
}

// S6: 우클릭은 무시
{
  const h = makeHarness();
  const btn = h.makeEl("button"); let clicks = 0; btn.addEventListener("click", () => clicks++);
  h.fireReal(btn, "mousedown", { button: 2 });
  ck("(S6) 우클릭 down 무시", h.synth === 0 && clicks === 0, { s: h.synth, c: clicks });
}

// S7: 두 버튼 연타(다른 대상)는 각각 1회씩, 서로 안 섞임
{
  const h = makeHarness();
  const a = h.makeEl("button"); const b = h.makeEl("button");
  let ca = 0, cb = 0; a.addEventListener("click", () => ca++); b.addEventListener("click", () => cb++);
  h.fireReal(a, "mousedown", { button: 0 }); h.fireReal(a, "click", {});
  h.fireReal(b, "mousedown", { button: 0 }); h.fireReal(b, "click", {});
  ck("(S7) 버튼A 1회", ca === 1, ca);
  ck("(S7) 버튼B 1회", cb === 1, cb);
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
