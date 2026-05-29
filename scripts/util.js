/* ===================================================================
   UTIL
   =================================================================== */
function $(id) { return document.getElementById(id); }
function toast(msg, type) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast show " + (type || "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3000);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtNum(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (Math.abs(n) >= 1 && Number.isInteger(n)) return n.toLocaleString("ko-KR");
  if (!Number.isInteger(n)) return n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  return String(n);
}
function isNumLike(v) {
  if (v === "" || v === null || v === undefined) return false;
  return !isNaN(Number(v)) && String(v).trim() !== "";
}
function uid() { return Math.random().toString(36).slice(2, 10); }
