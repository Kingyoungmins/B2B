/* ===================================================================
   페이지 / 메뉴 / 접기
   =================================================================== */
// [E2E 작업 등록 애드온] 페이지 제목.
// [실측 회귀 2026-08-28] 제목에 그룹까지 넣었더니("AX-Cell · 스킬 생성기") 브랜드 바에서
// 한 글자씩 세로로 쪼개졌다 — 0.8.0 은 이 줄에 버튼이 5개(AI 도움·새로고침·테마·Think·⚙)
// 들어가고 .brand-info 가 flex:1/min-width:0 이라 남는 폭이 없으면 0 까지 줄기 때문이다.
// 그룹은 메뉴가 이미 보여준다 → 제목은 짧게. 기존 두 페이지는 0.8.0 원문 그대로 둔다.
const PAGE_TITLES = {
  generator: "AX-Cell",
  runner: "스킬 실행기",
  "trace-generator": "AX-Trace 생성기",
  "trace-runner": "AX-Trace 실행기",
  scheduler: "스킬 등록",
  schedules: "스킬 목록",
};

function setPage(page) {
  state.currentPage = page;
  document.querySelectorAll(".page-panel").forEach(el => {
    el.classList.toggle("active", el.id === `page-${page}`);
  });
  document.querySelectorAll(".right-page").forEach(el => {
    el.classList.toggle("active", el.id === `right-${page}`);
  });
  document.querySelectorAll(".menu-item[data-page]").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });
  // [버전 표기 2026-08-06] textContent 로 덮어쓰면 제목 안의 버전 <span> 이 같이 지워진다.
  // 제목 글자만 바꾸고 버전 칩은 살려 둔 뒤, 다시 채워 넣는다(페이지 전환마다 사라지던 문제 방지).
  {
    const titleEl = $("page-title");
    const verEl = titleEl ? titleEl.querySelector(".app-version") : null;
    if (titleEl) titleEl.textContent = PAGE_TITLES[page] || PAGE_TITLES.generator;
    if (titleEl && verEl) titleEl.appendChild(verEl);
  }
  // [0.5.16 #1] 실행기(runner)는 헤드리스 — Excel 뷰를 아예 안 보이고 한 화면을 꽉 채운다.
  //  - 브라우저 모드: body.page-runner-active 로 .right/.resizer 를 숨기고 .left 풀폭(CSS).
  //  - 네이티브 셸: 호스트에 B2B_RUNNER_MODE 를 보내 우측 패널을 접고 WebView 풀폭.
  //  - Excel 오버레이(별도 top-level HWND)는 CSS/패널접기로 안 사라지므로 runnerHeadless 플래그로
  //    표시/배치를 막고(hideAll), 생성기 복귀 시 다시 띄운다. (전체실행 파일출력 기능은 그대로 — 표시만 제거)
  const isRunner = page === "runner";
  // [애드온] 스케줄 등록/목록·AX-Trace 화면은 Excel 을 안 쓴다 → 실행기와 똑같이 헤드리스(미러 내림 + 좌측 풀폭 +
  // 서버 라이브 복원 억제). 억제(runner-mode suppress)까지 같이 걸어야 진행 중 실행이 끝날 때 서버가 그리는
  // 라이브 프레임이 스케줄 화면 위로 회색 Excel 을 띄우지 않는다(실행기에서 실측했던 그 증상).
  const isScheduler = page === "scheduler" || page === "schedules"
    || page === "trace-generator" || page === "trace-runner";
  const noExcel = isRunner || isScheduler;
  if (typeof excelMirror !== "undefined" && excelMirror) excelMirror.runnerHeadless = noExcel;
  document.body.classList.toggle("page-runner-active", noExcel);
  closeMenu();
  refreshTabs();
  renderExcelViewer();
  renderRunnerWorkflow();
  try {
    if (noExcel) {
      // [깜빡임 방지] 패널을 접기 *전에* Excel 오버레이부터 숨긴다 — 반대 순서면 접힌 WebView 위로 오버레이가
      // 잠깐 떠 깜빡인다. 헤드리스에선 raise/복원이 모두 가드돼 이후 다시 안 뜬다.
      const _hide = (typeof hideAllExcelMirrorWindows === "function") ? hideAllExcelMirrorWindows() : null;
      // [이슈2] 서버의 라이브 프레임 복원을 억제 — 녹화 재현/폴링이 실행기 화면 위로 오버레이를 다시 띄우지 않게.
      if (typeof postExcelMirror === "function") postExcelMirror("/api/excel/runner-mode", { suppress: true }).catch(() => {});
      Promise.resolve(_hide).catch(() => {}).then(() => {
        if (typeof publishNativeRunnerMode === "function") publishNativeRunnerMode(true);
      });
    } else {
      if (typeof publishNativeRunnerMode === "function") publishNativeRunnerMode(false);  // 우측 패널 펼침
      // [이슈2] 서버 억제 해제를 복원 *전에* — 억제가 걸린 상태로 복원하면 미러가 다시 안 뜬다.
      if (typeof postExcelMirror === "function") postExcelMirror("/api/excel/runner-mode", { suppress: false }).catch(() => {});
      if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(220, {});  // 미러 복원
    }
  } catch (_) {}
}

function openMenu() {
  $("menu-drawer").classList.add("open");
  $("menu-scrim").classList.add("show");
}

function closeMenu() {
  $("menu-drawer").classList.remove("open");
  $("menu-scrim").classList.remove("show");
}

$("btn-menu").onclick = openMenu;
$("menu-close").onclick = closeMenu;
$("menu-scrim").onclick = closeMenu;
document.querySelectorAll(".menu-item[data-page]").forEach(item => {
  item.onclick = () => setPage(item.dataset.page);
});

// [사용 가이드 제거] 메뉴 항목을 뺐다. 버튼이 없으면 조용히 건너뛴다(구버전 index.html 대비).
const guideButton = $("btn-open-guide");
if (guideButton) {
  guideButton.onclick = () => {
    closeMenu();
    window.open("USER_GUIDE.html", "_blank", "noopener");
  };
}

document.addEventListener("click", e => {
  const head = e.target.closest(".panel-head");
  if (!head) return;
  const section = document.getElementById(head.dataset.target);
  if (section) section.classList.toggle("collapsed");
});

// [숨김 메뉴 2026-08-31] AX-Cell 외 그룹(AX-Trace·E2E 작업 등록)은 준비 중이라 기본 숨김.
// F6 으로 표시/숨김 토글(F8 디버그 패널과 같은 패턴 — localStorage 로 선택 유지).
// 주의: F6 은 브라우저 기본이 '영역 간 포커스 이동'이라 preventDefault 필수.
(function () {
  const KEY = "b2bShowExtraMenus";
  function applyExtraMenus(show) {
    document.body.classList.toggle("show-extra-menus", !!show);
    // 숨기는 순간 그 그룹 페이지를 보고 있었으면 생성기로 돌려보낸다
    // (메뉴에서 사라진 페이지에 갇히지 않게 — 항목 없이는 되돌아올 길이 없다).
    const extraPages = ["trace-generator", "trace-runner", "scheduler", "schedules"];
    if (!show && typeof state === "object" && state && extraPages.includes(state.currentPage)) {
      try { setPage("generator"); } catch (_) {}
    }
  }
  document.addEventListener("keydown", e => {
    if (e.key !== "F6") return;
    e.preventDefault();
    const show = !document.body.classList.contains("show-extra-menus");
    localStorage.setItem(KEY, show ? "1" : "0");
    applyExtraMenus(show);
    if (typeof toast === "function") {
      toast(show ? "추가 메뉴(AX-Trace·E2E)를 표시합니다." : "추가 메뉴를 숨겼습니다.", "success");
    }
  });
  if (localStorage.getItem(KEY) === "1") applyExtraMenus(true);
})();
