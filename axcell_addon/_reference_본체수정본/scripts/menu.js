/* ===================================================================
   페이지 / 메뉴 / 접기
   =================================================================== */
const PAGE_TITLES = {
  generator: "AX-Cell · 스킬 생성기",
  runner: "AX-Cell · 스킬 실행기",
  "trace-generator": "AX-Trace · 스킬 생성기",
  "trace-runner": "AX-Trace · 스킬 실행기",
  scheduler: "E2E 작업 등록 · 스킬 등록",
  schedules: "E2E 작업 등록 · 스킬 목록",
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
  $("page-title").textContent = PAGE_TITLES[page] || PAGE_TITLES.generator;
  // [0.5.16 #1] 실행기(runner)는 헤드리스 — Excel 뷰를 아예 안 보이고 한 화면을 꽉 채운다.
  //  - 브라우저 모드: body.page-runner-active 로 .right/.resizer 를 숨기고 .left 풀폭(CSS).
  //  - 네이티브 셸: 호스트에 B2B_RUNNER_MODE 를 보내 우측 패널을 접고 WebView 풀폭.
  //  - Excel 오버레이(별도 top-level HWND)는 CSS/패널접기로 안 사라지므로 runnerHeadless 플래그로
  //    표시/배치를 막고(hideAll), 생성기 복귀 시 다시 띄운다. (전체실행 파일출력 기능은 그대로 — 표시만 제거)
  const isRunner = page === "runner";
  // Excel 을 안 쓰는 화면들 — 미러를 내리고 좌측을 풀폭으로 쓴다.
  const isScheduler = page === "scheduler" || page === "schedules"
    || page === "trace-generator" || page === "trace-runner";
  // 스케줄 등록도 Excel 을 안 쓴다 → 실행기와 같이 헤드리스로 두고 좌측을 풀폭으로 쓴다.
  // 문서마다 수집 스킬을 붙이는 화면이라 좁은 패널에 밀어넣으면 읽기 어렵다.
  const noExcel = isRunner || isScheduler;
  if (typeof excelMirror !== "undefined" && excelMirror) excelMirror.runnerHeadless = noExcel;
  document.body.classList.toggle("page-runner-active", noExcel);
  closeMenu();
  refreshTabs();
  renderExcelViewer();
  renderRunnerWorkflow();
  try {
    if (isRunner) {
      // [깜빡임 방지] 패널을 접기 *전에* Excel 오버레이부터 숨긴다 — 반대 순서면 접힌 WebView 위로 오버레이가
      // 잠깐 떠 깜빡인다. 헤드리스에선 raise/복원이 모두 가드돼 이후 다시 안 뜬다.
      const _hide = (typeof hideAllExcelMirrorWindows === "function") ? hideAllExcelMirrorWindows() : null;
      Promise.resolve(_hide).catch(() => {}).then(() => {
        if (typeof publishNativeRunnerMode === "function") publishNativeRunnerMode(true);
      });
    } else if (isScheduler) {
      // 실행기와 동일하게 처리한다 — 오버레이부터 내리고 우측 패널을 접는다.
      const _h = (typeof hideAllExcelMirrorWindows === "function") ? hideAllExcelMirrorWindows() : null;
      Promise.resolve(_h).catch(() => {}).then(() => {
        if (typeof publishNativeRunnerMode === "function") publishNativeRunnerMode(true);
      });
    } else {
      if (typeof publishNativeRunnerMode === "function") publishNativeRunnerMode(false);  // 우측 패널 펼침
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
