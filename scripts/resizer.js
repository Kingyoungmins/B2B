/* ===================================================================
   세로 구분선 드래그로 좌우 너비 조절
   =================================================================== */
(function setupResizer() {
  const resizer = $("resizer");
  const leftEl = document.querySelector(".left");
  const app = document.querySelector(".app");
  if (!resizer || !leftEl || !app) return;
  let dragging = false;

  const onDown = (clientX, e) => {
    dragging = true;
    resizer.classList.add("dragging");
    document.body.classList.add("resizing");
    e.preventDefault();
  };
  const onMove = (clientX) => {
    if (!dragging) return;
    const rect = app.getBoundingClientRect();
    const MIN_LEFT = 320;
    const MIN_RIGHT = 360;
    const raw = clientX - rect.left;
    const clamped = Math.max(MIN_LEFT, Math.min(rect.width - MIN_RIGHT, raw));
    leftEl.style.width = clamped + "px";
    leftEl.style.minWidth = "0"; // CSS 기본 min-width 오버라이드
    leftEl.style.flex = "0 0 auto";
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove("dragging");
    document.body.classList.remove("resizing");
    try {
      localStorage.setItem("mvno_left_width", leftEl.style.width);
    } catch {}
  };

  resizer.addEventListener("mousedown", e => onDown(e.clientX, e));
  document.addEventListener("mousemove", e => onMove(e.clientX));
  document.addEventListener("mouseup", onUp);

  // 터치 지원
  resizer.addEventListener("touchstart", e => {
    if (e.touches[0]) onDown(e.touches[0].clientX, e);
  }, { passive: false });
  document.addEventListener("touchmove", e => {
    if (dragging && e.touches[0]) { onMove(e.touches[0].clientX); e.preventDefault(); }
  }, { passive: false });
  document.addEventListener("touchend", onUp);

  // 더블클릭 시 기본값(42%) 으로 리셋
  resizer.addEventListener("dblclick", () => {
    leftEl.style.width = "";
    leftEl.style.minWidth = "";
    leftEl.style.flex = "";
    try { localStorage.removeItem("mvno_left_width"); } catch {}
  });

  // 이전 세션에서 저장한 너비 복원
  try {
    const saved = localStorage.getItem("mvno_left_width");
    if (saved && window.innerWidth > 1000) {
      leftEl.style.width = saved;
      leftEl.style.minWidth = "0";
      leftEl.style.flex = "0 0 auto";
    }
  } catch {}
})();
