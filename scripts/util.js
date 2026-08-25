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

/* ── [AI 도움 가시성 2026-08-25] 최근 알림 링버퍼 + 실행 오류 히스토리 ──
   토스트는 3초 뒤 사라져 "방금 빨간 메시지 뭐였어?"를 아무도(사용자·AI 도움) 재구성하지
   못했다(가시성 감사 구멍 ①). toast() 를 감싸 최근 50건을 남기고 app.notices 도구가 읽는다.
   __lastPipelineErrorInfo 는 단일 슬롯이라 연속 실패 시 앞 오류가 덮였다(구멍 ⑤) — 대입
   지점(pipeline.js)은 손대지 않고 setter 후킹으로 최근 5건을 함께 쌓는다(다른 세션이 한창
   고치는 파일과의 충돌 면적을 없애기 위한 선택). */
function installAssistVisibilityHooks(g, wrapToast) {
  const notices = [];
  g.__recentNotices = notices;
  g.recordAppNotice = function (msg, type) {
    try {
      notices.push({ at: Date.now(), type: String(type || "info"),
                     msg: String(msg == null ? "" : msg).slice(0, 300) });
      if (notices.length > 50) notices.shift();
    } catch (_) {}
  };
  const hist = [];
  g.__pipelineErrorHistory = hist;
  let cur = ("__lastPipelineErrorInfo" in g) ? g.__lastPipelineErrorInfo : null;
  try {
    Object.defineProperty(g, "__lastPipelineErrorInfo", {
      configurable: true,
      get() { return cur; },
      set(v) {
        cur = v;
        try {
          if (v) {
            hist.push({ at: Date.now(),
                        step: Number(v.stepIdx) >= 0 ? Number(v.stepIdx) + 1 : null,
                        description: String(v.description || "").slice(0, 120),
                        message: String(v.message || "").slice(0, 200),
                        language: v.language || "" });
            if (hist.length > 5) hist.shift();
          }
        } catch (_) {}
      },
    });
  } catch (_) {}
  if (wrapToast) {
    const orig = toast;
    toast = function (msg, type) {          // 전역 재바인딩 — 호출부 95곳은 그대로 둔다
      g.recordAppNotice(msg, type);
      return orig(msg, type);
    };
  }
}
if (typeof window !== "undefined") installAssistVisibilityHooks(window, true);


// [필드 수정] WebView2 의 네이티브 confirm() 은 항상-위 Excel 미러 창/포커스 보정 타이머와
// 충돌해 마우스 클릭이 안 먹는 사례가 있다(키보드만 동작 — 0.5.2.2 §7 계열).
// 같은 문서 안에서 그리는 DOM 모달로 대체한다. 반환: Promise<boolean>.
function openB2bConfirmModal(message, options = {}) {
  return new Promise(resolve => {
    const prev = document.getElementById("b2b-confirm-modal");
    if (prev) { try { prev.remove(); } catch (_) {} }
    const wrap = document.createElement("div");
    wrap.id = "b2b-confirm-modal";
    wrap.style.cssText = "position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:rgba(15,17,26,0.55);";
    const box = document.createElement("div");
    box.style.cssText = "background:#fff;color:#1f2330;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.35);max-width:440px;width:calc(100% - 48px);padding:20px 22px;font-size:14px;line-height:1.6;white-space:pre-line;";
    const msg = document.createElement("div");
    msg.textContent = String(message || "");
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:16px;";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = options.cancelLabel || "취소";
    cancelBtn.style.cssText = "padding:7px 14px;border-radius:7px;border:1px solid #c9cdd6;background:#f5f6f8;cursor:pointer;font-size:13px;";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.textContent = options.okLabel || "확인";
    okBtn.style.cssText = "padding:7px 14px;border-radius:7px;border:1px solid #2f6fed;background:#2f6fed;color:#fff;cursor:pointer;font-size:13px;";
    const done = val => {
      try { wrap.remove(); } catch (_) {}
      document.removeEventListener("keydown", onKey, true);
      resolve(val);
    };
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(true); }
    };
    cancelBtn.onclick = () => done(false);
    okBtn.onclick = () => done(true);
    wrap.addEventListener("mousedown", e => { if (e.target === wrap) done(false); });
    document.addEventListener("keydown", onKey, true);
    row.appendChild(cancelBtn);
    row.appendChild(okBtn);
    box.appendChild(msg);
    box.appendChild(row);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    try { okBtn.focus(); } catch (_) {}
  });
}
