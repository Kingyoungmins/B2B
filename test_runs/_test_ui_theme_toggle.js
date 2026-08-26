/* [디자인 전환 2026-08-26] 실행: node test_runs/_test_ui_theme_toggle.js
   상단 [디자인] 버튼으로 0.8.0(기본) ↔ 0.7.4(클래식) 전환.
   토글 함수는 가짜 document/localStorage 를 붙여 '동작'으로 검증하고,
   배선(링크 순서·인라인 선적용·버튼)과 CSS 스코프는 소스 계약으로 고정한다. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? "  PASS  " : "  FAIL  ") + name + (!cond && detail ? "  -> " + detail : ""));
  if (!cond) fails += 1;
}

/* ── 1. 토글 동작 ─────────────────────────────────────────────────────── */
console.log("[1] 토글 동작 — 기본은 0.8.0, 누르면 클래식, 다시 누르면 복귀");
const themeSrc = read("scripts/ui-theme.js");

function makeEnv(saved) {
  const attrs = {};
  const store = {};
  if (saved) store["axcell_ui_theme_v1"] = saved;
  const btn = {
    id: "btn-ui-theme", title: "", _attrs: {}, _label: { textContent: "" }, _handlers: {},
    querySelector: () => btn._label,
    setAttribute: (k, v) => { btn._attrs[k] = v; },
    addEventListener: (ev, fn) => { btn._handlers[ev] = fn; },
  };
  const env = {
    document: {
      readyState: "complete",
      documentElement: {
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        setAttribute: (k, v) => { attrs[k] = v; },
        removeAttribute: (k) => { delete attrs[k]; },
        classList: { add() {} },
      },
      getElementById: (id) => (id === "btn-ui-theme" ? btn : null),
      addEventListener() {},
    },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
    },
    toasts: [],
    attrs, store, btn,
  };
  // <head> 인라인 스크립트가 하는 선적용을 그대로 재현
  if (env.localStorage.getItem("axcell_ui_theme_v1") === "classic") {
    env.document.documentElement.setAttribute("data-ui-theme", "classic");
  }
  const api = new Function("document", "localStorage", "toast",
    themeSrc + "\nreturn { applyUiTheme, toggleUiTheme, currentUiTheme, refreshUiThemeButton };"
  )(env.document, env.localStorage, (m) => env.toasts.push(m));
  return { env, api };
}

let { env, api } = makeEnv(null);
check("첫 실행 기본값은 0.8.0(mono)", api.currentUiTheme() === "mono" && env.attrs["data-ui-theme"] === undefined,
  JSON.stringify(env.attrs));
check("라벨은 상태와 무관하게 '테마' 하나(사용자 지시) — 토글이 라벨을 안 건드린다",
  env.btn._label.textContent === "", env.btn._label.textContent);

api.toggleUiTheme();
check("누르면 클래식으로", env.attrs["data-ui-theme"] === "classic" && api.currentUiTheme() === "classic");
check("저장된다", env.store["axcell_ui_theme_v1"] === "classic", env.store["axcell_ui_theme_v1"]);
check("눌린 상태(aria-pressed)로 현재 테마를 알린다", env.btn._attrs["aria-pressed"] === "true",
  env.btn._attrs["aria-pressed"]);
check("툴팁에 현재 테마 표시", /지금은 이전 버전/.test(env.btn.title), env.btn.title);
check("안내 토스트는 '테마를 변경했습니다.' 한 줄(사용자 지시)",
  env.toasts.length === 1 && env.toasts[0] === "테마를 변경했습니다.", JSON.stringify(env.toasts));

api.toggleUiTheme();
check("다시 누르면 기본으로(속성 제거)", env.attrs["data-ui-theme"] === undefined && api.currentUiTheme() === "mono");
check("기본도 저장된다(다음 실행에 유지)", env.store["axcell_ui_theme_v1"] === "mono", env.store["axcell_ui_theme_v1"]);

({ env, api } = makeEnv("classic"));
check("저장값이 classic 이면 재시작 후에도 클래식", api.currentUiTheme() === "classic"
  && env.attrs["data-ui-theme"] === "classic");
check("클래식으로 시작하면 버튼이 눌린 상태로 표시", env.btn._attrs["aria-pressed"] === "true");

/* ── 2. CSS 스코프 ────────────────────────────────────────────────────── */
console.log("[2] 클래식 CSS 는 스코프 밖으로 새지 않는다");
const classicCss = read("styles/theme-classic.css");
const ruleHeads = classicCss.split("\n").filter(l => /\{\s*$/.test(l) && !/^\s*@/.test(l));
check("모든 규칙이 html[data-ui-theme=\"classic\"] 로 스코프됨",
  ruleHeads.length > 0 && ruleHeads.every(l => l.includes('html[data-ui-theme="classic"]')),
  ruleHeads.find(l => !l.includes('html[data-ui-theme="classic"]')) || "");
check("중괄호 균형", (classicCss.match(/\{/g) || []).length === (classicCss.match(/\}/g) || []).length);
check("0.7.4 마젠타 토큰이 복원된다", /--m-500:\s*#FF0080/.test(classicCss) && /--grad:\s*linear-gradient\(135deg,\s*#FF0080/.test(classicCss));
check("0.8.0 기본 CSS 는 그대로(블랙 유지)", /--m-500:\s*#1A1A1A/.test(read("styles/base.css")));

/* ── 3. index.html 배선 ───────────────────────────────────────────────── */
console.log("[3] index.html 배선");
const html = read("index.html");
check("클래식 CSS 가 마지막 스타일시트(뒤에 와야 덮는다)",
  html.indexOf('styles/theme-classic.css') > html.indexOf('styles/runner.css'));
check("깜빡임 방지 — head 인라인에서 저장값 선적용",
  /localStorage\.getItem\("axcell_ui_theme_v1"\) === "classic"/.test(html)
  && html.indexOf('axcell_ui_theme_v1') < html.indexOf('styles/base.css'));
check("상단에 전환 버튼", /id="btn-ui-theme"/.test(html));
check("버튼 라벨이 '테마'", /<span class="ai-help-text">테마<\/span>/.test(html));
check("ui-theme.js 로드", /scripts\/ui-theme\.js/.test(html));
check("util.js(toast) 뒤에 로드", html.indexOf("scripts/ui-theme.js") > html.indexOf("scripts/util.js"));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails ? 1 : 0);
