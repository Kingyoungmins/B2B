/* ===================================================================
   페이지 / 메뉴 / 접기
   =================================================================== */
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
  $("page-title").textContent = page === "runner" ? "스킬 실행기" : "B2B 빌링 Agent";
  // [0.5.16 #1] 실행기(runner)는 헤드리스 — Excel 뷰를 아예 안 보이고 한 화면을 꽉 채운다.
  //  - 브라우저 모드: body.page-runner-active 로 .right/.resizer 를 숨기고 .left 풀폭(CSS).
  //  - 네이티브 셸: 호스트에 B2B_RUNNER_MODE 를 보내 우측 패널을 접고 WebView 풀폭.
  //  - Excel 오버레이(별도 top-level HWND)는 CSS/패널접기로 안 사라지므로 runnerHeadless 플래그로
  //    표시/배치를 막고(hideAll), 생성기 복귀 시 다시 띄운다. (전체실행 파일출력 기능은 그대로 — 표시만 제거)
  const isRunner = page === "runner";
  if (typeof excelMirror !== "undefined" && excelMirror) excelMirror.runnerHeadless = isRunner;
  document.body.classList.toggle("page-runner-active", isRunner);
  closeMenu();
  refreshTabs();
  renderExcelViewer();
  renderRunnerWorkflow();
  try {
    if (isRunner) {
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
