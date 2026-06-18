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
  closeMenu();
  refreshTabs();
  renderExcelViewer();
  renderRunnerWorkflow();
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
