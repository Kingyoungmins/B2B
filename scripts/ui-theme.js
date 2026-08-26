/* ===================================================================
   UI 테마 전환 — 0.8.0(기본) ↔ 0.7.4 클래식
   ===================================================================
   0.8.0 에서 톤앤매너가 블랙(모노)으로 바뀌면서, 0.7.4 의 마젠타 화면에
   익숙한 사용자를 위해 상단에서 되돌릴 수 있게 한다.

   구현: html[data-ui-theme] 한 글자만 바꾼다. 값이 "classic" 이면
   styles/theme-classic.css 가 0.7.4 색·그림자로 덮고, 없으면 0.8.0 기본.
   화면을 다시 그리거나 스크립트를 재실행하지 않으므로 작업 중에 눌러도 안전하다.

   깜빡임(FOUC) 방지: 저장값 적용은 <head> 인라인 스크립트가 먼저 한다
   (index.html). 이 파일은 버튼 배선과 전환만 담당한다.
   =================================================================== */

const UI_THEME_KEY = "axcell_ui_theme_v1";
const UI_THEME_DEFAULT = "mono";              // 0.8.0 = 기본값(사용자 지정)

function currentUiTheme() {
  return document.documentElement.getAttribute("data-ui-theme") === "classic" ? "classic" : UI_THEME_DEFAULT;
}

function applyUiTheme(theme, options) {
  const classic = theme === "classic";
  const root = document.documentElement;
  if (classic) root.setAttribute("data-ui-theme", "classic");
  else root.removeAttribute("data-ui-theme");
  try { localStorage.setItem(UI_THEME_KEY, classic ? "classic" : UI_THEME_DEFAULT); } catch (_) {}
  refreshUiThemeButton();
  if (options && options.announce && typeof toast === "function") {
    toast("테마를 변경했습니다.", "success");
  }
  // 화면 밖(별도 창)인 AI 도움 팝업에도 같은 테마를 알린다 — 있으면 따라오고, 없으면 무시된다.
  try {
    if (typeof assistPopupPost === "function") assistPopupPost({ type: "uiTheme", theme: classic ? "classic" : UI_THEME_DEFAULT });
  } catch (_) {}
}

function toggleUiTheme() {
  applyUiTheme(currentUiTheme() === "classic" ? UI_THEME_DEFAULT : "classic", { announce: true });
}

function refreshUiThemeButton() {
  const btn = document.getElementById("btn-ui-theme");
  if (!btn) return;
  const classic = currentUiTheme() === "classic";
  // [사용자 지시 2026-08-26] 라벨은 상태와 무관하게 '테마' 하나로 통일한다.
  // 지금 어느 테마인지는 눌린 상태(aria-pressed)와 툴팁으로만 알린다.
  btn.setAttribute("aria-pressed", classic ? "true" : "false");
  btn.title = classic ? "테마 — 지금은 이전 버전(0.7.4)" : "테마 — 지금은 기본(0.8.0)";
}

function initUiTheme() {
  // <head> 인라인 스크립트가 이미 저장값을 적용했다. 여기서는 버튼만 맞춘다.
  refreshUiThemeButton();
  const btn = document.getElementById("btn-ui-theme");
  if (btn && !btn._uiThemeBound) {
    btn._uiThemeBound = true;
    btn.addEventListener("click", toggleUiTheme);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initUiTheme);
  else initUiTheme();
}
