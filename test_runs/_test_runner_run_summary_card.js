// [사용자 지시 2026-08-12] 실행기 전체실행이 끝나면 결과 요약 카드를 띄우고 '사용자가 직접 닫게' 한다.
//
// 왜: 예전엔 '완료'가 2.5초 뒤 스스로 '실행 준비'로 돌아가서, 잠깐 눈을 떼면
//     성공했는지·아무 일도 없었는지·뻗었는지 구분이 안 됐다(사용자 제보).
//
// 이 테스트가 잠그는 것
//   1. 완료 시 카드가 뜨고, 단계 수·소요 시간·완료 시각이 보인다
//   2. 결과 파일 목록이 보인다(많으면 접고 '외 N개')
//   3. 결과 파일이 없으면 그 사실을 알려 준다(빈 카드 금지)
//   4. [확인]과 ESC 로만 닫힌다 — 바깥 클릭으로 실수로 닫히지 않는다
//   5. 두 번 실행해도 카드가 겹치지 않는다
//   6. [결과 편집하기]는 기존 버튼을 그대로 누른다(중복 구현 금지)
//   7. 실행 실패 시에는 카드를 띄우지 않는다(성공 경로에서만)
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

const dh = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8").replace(/^﻿/, "");
const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const css = fs.readFileSync(path.join(ROOT, "styles", "runner.css"), "utf8").replace(/^﻿/, "");

const at = dh.indexOf("window.runnerShowRunSummary = function(info) {");
if (at < 0) throw new Error("runnerShowRunSummary 못 찾음");
const body = dh.slice(at, dh.indexOf("\n};", at) + 3);

// 최소 DOM 스텁 — innerHTML 은 문자열로 두고 querySelector 는 클래스 문자열로 찾는다.
const STUBS = `
var _listeners = [];
var _removed = [];
function El(tag) {
  this.tagName = tag; this.id = ""; this.className = ""; this.innerHTML = "";
  this.children = []; this.parentNode = null; this.disabled = false; this.clicked = 0;
  this.attrs = {}; this._handlers = {};
}
El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); if (c.id) _byId[c.id] = c; return c; };
El.prototype.remove = function () {
  _removed.push(this.id || this.className);
  if (this.id) delete _byId[this.id];
  if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this);
};
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
El.prototype.focus = function () { this.focused = true; };
El.prototype.click = function () { this.clicked += 1; if (typeof this.onclick === "function") this.onclick(); };
// innerHTML 안에서 버튼을 찾아 가짜 엘리먼트로 돌려준다(핸들러 부착 대상).
El.prototype.querySelector = function (sel) {
  const cls = String(sel).replace(/^\\./, "");
  if (!this.innerHTML.includes(cls)) return null;
  this._fake = this._fake || {};
  if (!this._fake[cls]) { const e = new El("button"); e.className = cls; this._fake[cls] = e; }
  return this._fake[cls];
};
var _byId = {};
var document = {
  getElementById: (id) => _byId[id] || null,
  createElement: (tag) => new El(tag),
  addEventListener: (t, fn, cap) => _listeners.push({ t, fn, cap }),
  removeEventListener: (t, fn) => { _listeners = _listeners.filter(l => l.fn !== fn); },
  body: new El("body"),
};
var window = globalThis;
function _reset() {
  _byId = {}; _listeners = []; _removed = [];
  document.body = new El("body");
  const eb = new El("button"); eb.id = "runner-edit-result-btn"; eb.disabled = false;
  _byId["runner-edit-result-btn"] = eb;
  window.lastRunnerOutputs = [];
}
`;
const m = new Module("runner-summary-extracted", module);
m._compile(STUBS + "\n" + body
  + "\nmodule.exports = { show: window.runnerShowRunSummary, _reset, "
  + "setOutputs(list) { window.lastRunnerOutputs = list; }, "
  + "get card() { return _byId['runner-run-summary']; }, get body() { return document.body; }, "
  + "get listeners() { return _listeners; }, get removed() { return _removed; }, "
  + "get editBtn() { return _byId['runner-edit-result-btn']; } };\n",
  path.join(__dirname, "_extracted_runner_summary.js"));
const T = m.exports;

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 완료 카드 내용");
T._reset();
T.setOutputs([{ name: "결과_정산서.xlsx" }, { name: "결과_청구내역.xlsx" }]);
T.show({ steps: 10, ms: 74300, finishedAt: new Date(2026, 7, 12, 16, 42) });
{
  const card = T.card;
  check("카드가 화면에 붙음", !!card && card.parentNode === T.body);
  check("제목", /실행이 끝났습니다/.test(card.innerHTML));
  check("단계 수", /10개 단계/.test(card.innerHTML), card.innerHTML.slice(0, 300));
  check("소요 시간(분·초)", /1분 14초/.test(card.innerHTML), card.innerHTML.slice(0, 300));
  check("완료 시각", /16:42 완료/.test(card.innerHTML));
  check("결과 파일 개수", /결과 파일 2개/.test(card.innerHTML));
  check("파일 이름 나열", /결과_정산서\.xlsx/.test(card.innerHTML) && /결과_청구내역\.xlsx/.test(card.innerHTML));
  check("ESC 리스너 등록", T.listeners.some(l => l.t === "keydown"));
}

console.log("[2] 초 단위 표기");
T._reset();
T.show({ steps: 3, ms: 8400 });
check("1분 미만은 초로", /8\.4초/.test(T.card.innerHTML), T.card.innerHTML.slice(0, 240));

console.log("[3] 파일이 많으면 접는다");
T._reset();
T.setOutputs(Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.xlsx` })));
T.show({ steps: 11, ms: 1000 });
check("앞 8개만 나열", (T.card.innerHTML.match(/<li>/g) || []).length === 8, (T.card.innerHTML.match(/<li>/g) || []).length);
check("나머지는 '외 N개'", /외 3개/.test(T.card.innerHTML));

console.log("[4] 결과 파일이 없을 때");
T._reset();
T.show({ steps: 5, ms: 2000 });
check("빈 카드가 아니라 사실을 알려 준다", /결과 파일이 만들어지지 않았습니다/.test(T.card.innerHTML));
check("무엇을 확인할지 안내", /값을 쓰는 대상이 맞는지/.test(T.card.innerHTML));
check("결과 편집 버튼은 숨김", !/runner-summary-edit/.test(T.card.innerHTML));

console.log("[5] 닫기 — 사용자가 직접만");
T._reset();
T.setOutputs([{ name: "a.xlsx" }]);
T.show({ steps: 1, ms: 100 });
{
  const card = T.card;
  check("바깥(backdrop) 클릭 핸들러 없음 — 실수 방지", typeof card.onclick !== "function");
  card.querySelector(".runner-summary-close").click();
  check("확인 누르면 닫힘", !T.card);
  check("ESC 리스너도 정리됨", !T.listeners.some(l => l.t === "keydown"));
}

console.log("[6] 두 번 실행해도 겹치지 않음");
T._reset();
T.show({ steps: 1, ms: 100 });
T.show({ steps: 2, ms: 200 });
check("이전 카드 제거", T.removed.includes("runner-run-summary"));
check("카드는 하나", T.body.children.filter(c => c.id === "runner-run-summary").length === 1);

console.log("[7] 결과 편집하기는 기존 버튼을 누른다(중복 구현 금지)");
T._reset();
T.setOutputs([{ name: "a.xlsx" }]);
T.show({ steps: 1, ms: 100 });
{
  const card = T.card;
  card.querySelector(".runner-summary-edit").click();
  check("실제 [결과 편집하기] 버튼이 눌림", T.editBtn.clicked === 1, T.editBtn.clicked);
  check("누른 뒤 카드는 닫힘", !T.card);
}

console.log("[8] 배선 — 성공했을 때만 뜬다");
check("실행기 성공 경로에서 호출", /runnerSetDone\(\);[\s\S]{0,400}window\.runnerShowRunSummary\(\{/.test(pj));
check("소요 시간을 실제로 잰다", /const _runT0 = Date\.now\(\);/.test(pj) && /ms: Date\.now\(\) - _runT0/.test(pj));
check("실패 경로(catch)에는 없다", !/catch \(err\) \{[\s\S]{0,400}runnerShowRunSummary/.test(pj));

console.log("[9] 스타일");
check("카드 스타일 정의", /\.runner-summary-card \{/.test(css));
check("체크 애니메이션", /@keyframes runnerSummaryCheck/.test(css));
check("움직임 최소화 존중", /prefers-reduced-motion: reduce[\s\S]{0,160}runner-summary-backdrop/.test(css));
check("CSS 파일에 </style> 잔재 없음", !/<\/style>/.test(css));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
