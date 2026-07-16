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
      _tag: tag, _isEditable: !!opts.editable, _isDragHandle: !!opts.dragHandle,
      _children: opts.children || [], _own: own,
      addEventListener(t, fn) { (own[t] = own[t] || []).push(fn); },
      contains(x) { return x === el || el._children.indexOf(x) >= 0; },
      closest(sel) {
        if (el._isEditable && /input|textarea|select|contenteditable|option/.test(sel)) return el;
        if (el._isDragHandle && /resizer|no-click-synth/.test(sel)) return el;
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
  // 진짜 사용자 입력 = 브라우저가 isTrusted:true 로 만든다. 셧도 그대로 모사해야
  // '진짜만 삼킨다' 규칙이 실제와 같은 조건에서 검증된다.
  function fireReal(target, type, props) {
    ts += 5;
    const ev = new MouseEvent(type, Object.assign({ timeStamp: ts, isTrusted: true, button: 0, buttons: 0, clientX: 50, clientY: 50 }, props || {}));
    return dispatchThrough(target, ev);
  }
  // 코드가 부르는 el.click() / label 이 체크박스로 전달하는 click = untrusted.
  function fireUntrusted(target, type, props) {
    ts += 1;
    const ev = new MouseEvent(type, Object.assign({ timeStamp: ts, isTrusted: false, button: 0, buttons: 0, clientX: 50, clientY: 50 }, props || {}));
    return dispatchThrough(target, ev);
  }
  return { windowObj, makeEl, fireReal, fireUntrusted, setTs(v) { ts = v; }, bumpTs(d) { ts += d; },
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

// S8: [회귀] 길게 누르기 — 진짜 click 이 한참 뒤 와도 삼켜져야 함(예전 SUPPRESS_MS 1.2초 만료 → 이중발화)
{
  const h = makeHarness();
  const btn = h.makeEl("button"); let clicks = 0; btn.addEventListener("click", () => clicks++);
  h.fireReal(btn, "mousedown", { button: 0 });     // 눌림 → 합성 click(1회 실행)
  h.bumpTs(5000);                                  // 5초 길게 누름(또는 VDI 전달 지연)
  h.fireReal(btn, "click", {});                    // 뒤늦게 도착한 진짜 click
  ck("(S8) 5초 롱프레스: 버튼 1회만(이중발화 없음)", clicks === 1, clicks);
  ck("(S8) 뒤늦은 진짜 click 삼킴", h.swallowed === 1, h.swallowed);
}

// S9: [회귀] 수정자 키 복사 — Ctrl+클릭 다중선택이 단일선택으로 뭉개지면 안 됨
{
  const h = makeHarness();
  const tab = h.makeEl("div"); let seen = null;
  tab.addEventListener("click", e => { seen = { ctrl: !!e.ctrlKey, shift: !!e.shiftKey }; });
  h.fireReal(tab, "mousedown", { button: 0, ctrlKey: true });
  ck("(S9) Ctrl 수정자 합성에 복사", seen && seen.ctrl === true, seen);
  const h2 = makeHarness();
  const t2 = h2.makeEl("div"); let seen2 = null;
  t2.addEventListener("click", e => { seen2 = !!e.shiftKey; });
  h2.fireReal(t2, "mousedown", { button: 0, shiftKey: true });
  ck("(S9) Shift 수정자 합성에 복사", seen2 === true, seen2);
}

// S10: [회귀] <label><input type=checkbox> — label 이 전달하는 untrusted click 을 삼키면
//      뗌이 유실되는 VDI 에서 체크박스가 영영 안 켜진다.
{
  const h = makeHarness();
  const input = h.makeEl("input");                       // type=checkbox → isEditable 대상 아님
  const label = h.makeEl("label", { children: [input] });
  let toggles = 0;
  input.addEventListener("click", () => toggles++);
  label.addEventListener("click", ev => {                // 브라우저 label 활성화 동작 모사
    if (!ev.__fwd) h.fireUntrusted(input, "click", { __fwd: true });
  });
  h.fireReal(label, "mousedown", { button: 0 });         // 눌림만(뗌 유실)
  ck("(S10) label 체크박스: 전달 click 안 삼킴", toggles === 1, toggles);
}

// S11: [회귀] 더블 판정에 거리 제한 — 리사이저를 멀리 떨어진 곳에서 다시 잡으면 dbl 아님
{
  const h = makeHarness();
  const el = h.makeEl("div"); let dbls = 0; el.addEventListener("dblclick", () => dbls++);
  h.fireReal(el, "mousedown", { button: 0, clientX: 50, clientY: 50 });
  h.bumpTs(120);
  h.fireReal(el, "mousedown", { button: 0, clientX: 260, clientY: 50 }); // 210px 이동 후 재파지
  ck("(S11) 먼 두 눌림은 dblclick 아님", dbls === 0 && h.dbl === 0, { d: dbls, s: h.dbl });
}

// S12: 드래그 핸들(#resizer)은 눌림-즉시 합성 제외 — 누르자마자 click 이 나가면 드래그가 오발화
{
  const h = makeHarness();
  const rez = h.makeEl("div", { dragHandle: true });
  let clicks = 0; rez.addEventListener("click", () => clicks++);
  h.fireReal(rez, "mousedown", { button: 0 });
  ck("(S12) 드래그 핸들 합성 제외", h.synth === 0 && clicks === 0, { s: h.synth, c: clicks });
}

// S13: 키보드(Enter) click 은 detail===0 — 남아있는 옛 대기가 잡아먹으면 안 됨
{
  const h = makeHarness();
  const btn = h.makeEl("button"); let clicks = 0; btn.addEventListener("click", () => clicks++);
  h.fireReal(btn, "mousedown", { button: 0 });     // 뗌 유실 → 대기 1건 잔류
  clicks = 0;                                      // 합성분 리셋하고 키보드만 관찰
  h.bumpTs(30);
  h.fireReal(btn, "click", { detail: 0 });         // Enter 로 나는 click
  ck("(S13) 키보드 click 은 안 삼킴", clicks === 1 && h.swallowed === 0, { c: clicks, s: h.swallowed });
}

// S14: 코드가 부르는 el.click()(untrusted) 도 안 삼킴
{
  const h = makeHarness();
  const btn = h.makeEl("button"); let clicks = 0; btn.addEventListener("click", () => clicks++);
  h.fireReal(btn, "mousedown", { button: 0 });     // 뗌 유실 → 대기 1건 잔류
  clicks = 0;
  h.fireUntrusted(btn, "click", {});               // el.click()
  ck("(S14) 프로그램 click 은 안 삼킴", clicks === 1 && h.swallowed === 0, { c: clicks, s: h.swallowed });
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
