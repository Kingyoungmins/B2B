/* ===================================================================
   외부 웹 화면 임베드 — AX-Trace 스킬 생성기

   [독립 모듈] 본체 전역을 쓰지 않는다. 노출 전역은 window.AXEmbed 하나.

   [iframe 이 막히는 경우가 있다]
   상대 서버가 X-Frame-Options: DENY/SAMEORIGIN 또는
   Content-Security-Policy: frame-ancestors 를 보내면 브라우저가 렌더를 거부한다.
   그건 우리 쪽에서 우회할 수 없다(브라우저 보안). 그래서 로드 여부를 감시해
   실패하면 이유를 설명하고 '새 창으로 열기'를 제공한다.
   =================================================================== */
(function () {
  "use strict";

  const KEY = "axtrace.embed.url";     // 이 PC 에만 저장(localStorage)
  const TIMEOUT_MS = 8000;

  const $ = (id) => document.getElementById(id);

  const state = { url: "", timer: null, loaded: false };

  function read() {
    try { return localStorage.getItem(KEY) || ""; } catch (_) { return ""; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (_) { /* 저장 못 해도 동작은 한다 */ }
  }

  // 사용자가 host:port 만 적어도 동작하게 한다.
  function normalize(raw) {
    let v = String(raw || "").trim();
    if (!v) return "";
    if (!/^https?:\/\//i.test(v)) v = "http://" + v;
    try {
      return new URL(v).href;
    } catch (_) {
      return "";
    }
  }

  function show(which) {
    const frame = $("trace-gen-frame");
    const empty = $("trace-gen-empty");
    const fail = $("trace-gen-fail");
    if (!frame || !empty || !fail) return;
    frame.style.visibility = which === "frame" ? "visible" : "hidden";
    empty.hidden = which !== "empty";
    fail.hidden = which !== "fail";
  }

  function failWith(msg) {
    const el = $("trace-gen-fail-msg");
    if (el) el.textContent = msg;
    show("fail");
  }

  function load(raw, { save = true } = {}) {
    const url = normalize(raw);
    const frame = $("trace-gen-frame");
    if (!frame) return;
    if (!url) {
      failWith("주소 형식을 알아볼 수 없습니다. 예: 192.168.0.10:3000");
      return;
    }
    state.url = url;
    state.loaded = false;
    if (save) write(url);
    const input = $("trace-gen-url");
    if (input && input.value.trim() !== url) input.value = url;

    show("frame");
    clearTimeout(state.timer);
    // 차단당하면 load 가 아예 안 오거나 빈 문서로 온다 → 시간으로 판정한다.
    state.timer = setTimeout(() => {
      if (!state.loaded) {
        failWith("응답이 없습니다. 주소가 맞는지, 그 서버가 켜져 있는지 확인하세요. "
               + "서버가 iframe 표시를 막고 있으면(X-Frame-Options) 새 창으로 열어야 합니다.");
      }
    }, TIMEOUT_MS);
    frame.src = url;
  }

  function bind() {
    const root = $("trace-gen-root");
    const frame = $("trace-gen-frame");
    const input = $("trace-gen-url");
    if (!root || !frame || !input) return;

    frame.addEventListener("load", () => {
      // src 가 비어 있는 초기 상태의 load 는 무시한다.
      if (!state.url) return;
      state.loaded = true;
      clearTimeout(state.timer);
      show("frame");
    });

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-embed]");
      if (!btn) return;
      const act = btn.dataset.embed;
      if (act === "go") load(input.value);
      else if (act === "reload") { if (state.url) load(state.url, { save: false }); }
      else if (act === "open") {
        const url = normalize(input.value) || state.url;
        if (url) window.open(url, "_blank", "noopener");
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") load(input.value);
    });

    const saved = read();
    if (saved) {
      input.value = saved;
      load(saved, { save: false });
    } else {
      show("empty");
    }
  }

  window.AXEmbed = { load, get url() { return state.url; }, normalize };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
