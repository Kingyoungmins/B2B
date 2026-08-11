// [사용자 요청 2026-08-11] AI 도움이 생각 중일 때 표시가 창 맨 위에만 떠서 잘 안 보였다.
// → 대화가 흐르는 채팅창 '맨 아래'에, 애니메이션과 함께 작게 띄운다(살아 있다는 느낌).
//
// 이 테스트가 잠그는 것
//   1. 상태 문구가 채팅 목록 맨 끝에 말풍선으로 붙는다
//   2. 새 메시지가 와도 표시가 위에 파묻히지 않는다(항상 맨 끝으로 이동)
//   3. 상태가 비면 사라진다(다 끝났는데 '생각 중'이 남지 않는다)
//   4. 상단 표시도 그대로 동작한다(팝업/좁은 화면 호환)
//   5. 팝업 창(코드가 분리돼 있음)도 같은 동작
//   6. 애니메이션을 꺼 둔 사용자(prefers-reduced-motion)는 움직임 없이 글자만
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

function sliceBalanced(src, startIdx, open, close) {
  let d = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === open) d++;
    else if (ch === close) { d--; if (d === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}
function fn(src, name) {
  const at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const b = src.indexOf("{", src.indexOf("(", at));
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}

const ui = fs.readFileSync(path.join(ROOT, "scripts", "assist-ui.js"), "utf8").replace(/^﻿/, "");
const pop = fs.readFileSync(path.join(ROOT, "scripts", "assist-popup.js"), "utf8").replace(/^﻿/, "");
const css = fs.readFileSync(path.join(ROOT, "styles", "panels.css"), "utf8").replace(/^﻿/, "");

// 최소 DOM 스텁 — appendChild/remove/lastElementChild/querySelector 만 쓴다.
const STUBS = `
function El(tag) {
  this.tagName = tag; this.id = ""; this.className = ""; this.children = [];
  this.parentNode = null; this.textContent = ""; this._html = ""; this.attrs = {};
  this.scrollTop = 0; this.scrollHeight = 999;
}
El.prototype.appendChild = function (c) {
  if (c.parentNode) c.parentNode.removeChild(c);
  c.parentNode = this; this.children.push(c); return c;
};
El.prototype.removeChild = function (c) {
  const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1);
  c.parentNode = null; return c;
};
El.prototype.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
Object.defineProperty(El.prototype, "lastElementChild", {
  get() { return this.children.length ? this.children[this.children.length - 1] : null; },
});
Object.defineProperty(El.prototype, "innerHTML", {
  get() { return this._html; },
  set(v) {
    this._html = String(v);
    // 우리 마크업(<span class="assist-thinking-text">)만 알아보면 충분하다.
    this.children = [];
    if (/assist-thinking-text/.test(this._html)) {
      const t = new El("span"); t.className = "assist-thinking-text"; this.appendChild(t);
    }
    if (/assist-thinking-dots/.test(this._html)) {
      const d = new El("span"); d.className = "assist-thinking-dots"; this.appendChild(d);
    }
  },
});
El.prototype.querySelector = function (sel) {
  const want = String(sel).replace(/^\\./, "");
  const walk = (n) => {
    for (const c of n.children) {
      if (c.className === want) return c;
      const r = walk(c); if (r) return r;
    }
    return null;
  };
  return walk(this);
};
var _byId = {};
var document = {
  getElementById: (id) => _byId[id] || null,
  createElement: (tag) => new El(tag),
};
function $id(id) { return _byId[id] || null; }
function _reset() {
  _byId = {};
  const msgs = new El("div"); msgs.id = "assist-messages"; _byId["assist-messages"] = msgs;
  const st = new El("span"); st.id = "assist-status"; _byId["assist-status"] = st;
  return msgs;
}
// createElement 로 만든 assist-thinking 을 getElementById 가 찾을 수 있게 연결
const _origAppend = El.prototype.appendChild;
El.prototype.appendChild = function (c) { if (c.id) _byId[c.id] = c; return _origAppend.call(this, c); };
const _origRemove = El.prototype.remove;
El.prototype.remove = function () { if (this.id) delete _byId[this.id]; return _origRemove.call(this); };
`;

const m = new Module("assist-thinking-extracted", module);
m._compile(
  STUBS + "\n" + fn(ui, "assistSetStatus") + "\n"
  + "const popupSetStatus = " + fn(pop, "setStatus").replace(/^function setStatus/, "function") + ";\n"
  + "module.exports = { assistSetStatus, popupSetStatus, _reset, El, get byId() { return _byId; } };\n",
  path.join(__dirname, "_extracted_assist_thinking.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

for (const [label, setStatus] of [["창 안", T.assistSetStatus], ["팝업", T.popupSetStatus]]) {
  console.log(`[${label}] 채팅창 하단 '생각 중' 표시`);
  const box = T._reset();

  setStatus("생각 중...");
  const bubble = T.byId["assist-thinking"];
  check("채팅 목록에 표시가 생김", !!bubble && bubble.parentNode === box);
  check("맨 끝에 위치", box.lastElementChild === bubble);
  check("점 세 개 애니메이션 마크업", /assist-thinking-dots/.test(bubble.innerHTML));
  check("말줄임표는 떼고 표시(점은 애니메이션이 대신)",
    bubble.querySelector(".assist-thinking-text").textContent === "생각 중",
    bubble.querySelector(".assist-thinking-text").textContent);
  check("상단 표시도 그대로", T.byId["assist-status"].textContent === "생각 중...");
  check("스크롤을 맨 아래로", box.scrollTop === box.scrollHeight);

  // 새 말풍선이 뒤에 붙어도 표시가 파묻히면 안 된다
  const msg = new T.El("div"); msg.className = "assist-msg assistant";
  box.appendChild(msg);
  setStatus("확인 중... (2)");
  check("새 메시지 뒤로 다시 내려옴", box.lastElementChild === T.byId["assist-thinking"]);
  check("문구 갱신", T.byId["assist-thinking"].querySelector(".assist-thinking-text").textContent === "확인 중... (2)".replace(/\.{2,}$/, ""));
  check("표시는 하나만", box.children.filter(c => c.className === "assist-thinking").length === 1);

  setStatus("");
  check("끝나면 사라짐", !T.byId["assist-thinking"] && !box.children.some(c => c.className === "assist-thinking"));
  check("상단도 비워짐", T.byId["assist-status"].textContent === "");
  setStatus("");
  check("이미 없을 때 또 지워도 안전", true);
  console.log("");
}

console.log("[스타일] 애니메이션과 접근성");
check("표시 스타일 정의", /\.assist-thinking\s*\{/.test(css));
check("글자 흐름(shimmer) 애니메이션", /@keyframes assistThinkingShimmer/.test(css));
check("점 튀는 애니메이션", /@keyframes assistThinkingDot/.test(css));
check("점마다 시차", /\.assist-thinking-dots i:nth-child\(2\)/.test(css) && /nth-child\(3\)/.test(css));
check("움직임 최소화 설정 존중", /prefers-reduced-motion: reduce[\s\S]{0,200}\.assist-thinking-text \{ animation: none/.test(css));
check("말풍선처럼 왼쪽 정렬", /\.assist-thinking \{[\s\S]{0,160}align-self: flex-start/.test(css));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
