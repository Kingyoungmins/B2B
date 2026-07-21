/* ===================================================================
   AI 도움 — 떠 있는 팝업 창
   ===================================================================
   앱 레이아웃에 붙지 않고 자유롭게 움직이는 창(제목줄 드래그 이동, 우하단 손잡이로 크기 조절,
   위치·크기는 localStorage 에 기억). 기존 ③ 스킬 설계 채팅과 DOM/상태를 완전히 분리한다
   (같은 함수를 재사용하면 컨테이너 하드코딩 때문에 두 대화가 한 곳에 섞인다).
   네이티브 Excel 미러는 항상 위에 떠 있어 이 창을 덮으므로, 열 때 숨기고 닫을 때 복구한다.
   =================================================================== */

let _assistOpen = false;

// 창 위치/크기는 세션 간 유지한다(매번 가운데로 튀면 거슬린다).
const ASSIST_POS_KEY = "b2b_assist_popup_rect";
function assistLoadRect() {
  try {
    const r = JSON.parse(localStorage.getItem(ASSIST_POS_KEY) || "null");
    if (r && typeof r.l === "number" && typeof r.t === "number") return r;
  } catch (_) {}
  return null;
}
function assistSaveRect(el) {
  try {
    localStorage.setItem(ASSIST_POS_KEY, JSON.stringify({
      l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight,
    }));
  } catch (_) {}
}
// 화면 밖으로 나가 못 잡는 일이 없도록 항상 보이는 영역으로 되돌린다.
function assistClampIntoView(el) {
  const maxL = Math.max(0, window.innerWidth - 120);
  const maxT = Math.max(0, window.innerHeight - 60);
  if (el.offsetLeft > maxL) el.style.left = maxL + "px";
  if (el.offsetTop > maxT) el.style.top = maxT + "px";
  if (el.offsetLeft < -el.offsetWidth + 120) el.style.left = "0px";
  if (el.offsetTop < 0) el.style.top = "0px";
}

function assistEnsureDom() {
  if (document.getElementById("assist-drawer")) return;
  const el = document.createElement("div");
  el.id = "assist-drawer";
  el.className = "assist-popup";
  const r = assistLoadRect();
  if (r) {
    el.style.left = r.l + "px"; el.style.top = r.t + "px";
    if (r.w) el.style.width = r.w + "px";
    if (r.h) el.style.height = r.h + "px";
  } else {
    // 처음엔 오른쪽 위, 화면 안쪽으로
    el.style.left = Math.max(12, window.innerWidth - 460) + "px";
    el.style.top = "72px";
  }
  el.innerHTML = `
    <div class="assist-head" id="assist-drag">
      <span class="assist-title">✦ AI 도움</span>
      <span class="assist-sub" id="assist-status"></span>
      <button type="button" class="assist-mini" id="assist-mirror-toggle" title="Excel 미러를 잠시 숨기거나 다시 보기">👁 미러</button>
      <button type="button" class="assist-mini" id="assist-clear" title="이 대화 비우기">비우기</button>
      <button type="button" class="assist-mini" id="assist-close" title="닫기">✕</button>
    </div>
    <div class="assist-messages" id="assist-messages"></div>
    <div class="assist-chips" id="assist-chips"></div>
    <div class="assist-input-row">
      <textarea id="assist-text" rows="2" placeholder="예) 3단계가 적용됐다는데 값이 안 바뀌었어 / 이 스킬 뭐 하는 거야? / 5월 파일로 바꾸려면 뭘 고쳐야 해?"></textarea>
      <button class="assist-send" id="assist-send" type="button">전송</button>
    </div>
    <div class="assist-resize" id="assist-resize" title="크기 조절"></div>`;
  document.body.appendChild(el);
  assistBindDrag(el);

  document.getElementById("assist-close").onclick = () => assistToggleDrawer(false);
  document.getElementById("assist-clear").onclick = () => {
    state.assist = { history: [] };
    document.getElementById("assist-messages").innerHTML = "";
    assistRenderChips();
    assistAddMsg("system", "대화를 비웠습니다. 스킬과 파일은 그대로입니다.");
  };
  document.getElementById("assist-mirror-toggle").onclick = () => {
    try {
      if (typeof hideAllExcelMirrorWindows === "function") hideAllExcelMirrorWindows();
      if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(120);
    } catch (_) {}
  };
  const send = () => {
    const ta = document.getElementById("assist-text");
    const text = String(ta.value || "").trim();
    if (!text) return;
    ta.value = "";
    assistSubmit(text);
  };
  document.getElementById("assist-send").onclick = send;
  document.getElementById("assist-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  assistRenderChips();
}

const ASSIST_CHIPS = [
  ["실행 전 점검", "지금 전체실행하면 문제 될 게 있는지 점검해줘"],
  ["안 바뀐 이유", "적용됐다는데 값이 안 바뀐 것 같아. 왜인지 봐줘"],
  ["이 스킬 설명", "이 스킬이 단계별로 뭘 하는지 쉽게 설명해줘"],
  ["다음 달 준비", "다음 달 파일로 쓰려면 어디를 고쳐야 하는지 알려줘"],
  ["되돌릴 수 있나", "지금 상태에서 되돌릴 수 있는지 알려줘"],
];

function assistRenderChips() {
  const box = document.getElementById("assist-chips");
  if (!box) return;
  box.innerHTML = ASSIST_CHIPS.map((c, i) => `<button type="button" class="assist-chip" data-i="${i}">${escapeHtml(c[0])}</button>`).join("");
  box.querySelectorAll(".assist-chip").forEach(b => {
    b.onclick = () => assistSubmit(ASSIST_CHIPS[Number(b.dataset.i)][1]);
  });
}

function assistAddMsg(role, text, opts) {
  const box = document.getElementById("assist-messages");
  if (!box) return null;
  const div = document.createElement("div");
  div.className = "assist-msg " + role;
  if (opts && opts.html) div.innerHTML = text;
  else div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function assistSetStatus(s) {
  const el = document.getElementById("assist-status");
  if (el) el.textContent = s || "";
}

function assistSubmit(text) {
  if (typeof assistIsBusy === "function" && assistIsBusy()) {
    assistSetStatus("처리 중입니다...");
    return;
  }
  assistAddMsg("user", text);
  assistHandleUserMessage(text, {
    onStatus: assistSetStatus,
    onAssistantText: (t) => assistAddMsg("assistant", t),
    onToolTrace: (name, result) => {
      const okMark = result && result.ok === false ? "✕" : "·";
      assistAddMsg("trace", `${okMark} ${name}`);
    },
    onProposal: assistRenderProposalCard,
    onReport: assistRenderReportCard,
  });
}

// 해결 불가 → 제보 카드. [묶음 만들기]를 눌러야만 파일이 만들어진다.
function assistRenderReportCard(meta) {
  const html = `
    <div class="assist-card assist-report">
      <div class="assist-card-head">🧾 이슈 제보 준비</div>
      <div class="assist-card-reason">${escapeHtml(meta.reason || "AI 도움 범위를 벗어나는 문제로 보입니다.")}</div>
      <div class="assist-card-note">
        입력 파일 + 스킬 + 진단 기록을 zip 하나로 묶어 드립니다.<br>
        받은 zip 은 <b>사내 지라(SBAGENT 프로젝트)</b>에 새 이슈(버그)로 올리고 통째로 첨부하세요 —
        자세한 절차와 붙여넣을 양식은 zip 안의 <b>제보양식.txt</b> 에 있습니다.
      </div>
      <div class="assist-card-actions">
        <button type="button" class="assist-ok assist-report-build">📦 제보 파일 묶음 만들기</button>
      </div>
    </div>`;
  const el = assistAddMsg("assistant", html, { html: true });
  if (!el) return;
  el.querySelector(".assist-report-build").onclick = async () => {
    const box = el.querySelector(".assist-card-actions");
    box.innerHTML = `<span class="assist-done">묶는 중...</span>`;
    try {
      const r = await assistPrepareReportBundle(meta);
      box.innerHTML = assistReportResultHtml(r);
    } catch (err) {
      box.innerHTML = `<span class="assist-fail">✕ ${escapeHtml(String(err && err.message).slice(0, 120))}</span>`;
    }
  };
}

function assistReportResultHtml(r) {
  if (!r || !r.ok) {
    return `<span class="assist-fail">✕ ${escapeHtml((r && r.error) || "묶음 생성 실패")}</span>`;
  }
  const parts = [`<span class="assist-done">✓ ${escapeHtml(r.fileName)} 저장 대화상자가 열렸습니다.</span>`];
  if (r.included && r.included.length) {
    parts.push(`<div class="assist-card-note">포함: ${escapeHtml(r.included.join(", "))}</div>`);
  }
  if (r.missing && r.missing.length) {
    parts.push(`<div class="assist-warn">⚠ 자동으로 못 담은 것(직접 첨부 필요): ${escapeHtml(r.missing.join(", "))}</div>`);
  }
  return parts.join("");
}

// 승인 카드 — 여기 버튼을 눌러야만 스킬이 바뀐다.
function assistRenderProposalCard(p) {
  const diffHtml = assistBuildDiffHtml(p.oldCode, p.newCode);
  const warn = p.touchesNames
    ? `<div class="assist-warn">⚠ 파일명/시트명으로 보이는 문자열을 바꿉니다. 이름이 틀리면 실행이 실패합니다.</div>`
    : "";
  // [동반 수정] 코드만 고치면 단계 이름·설명·대화기록에 옛 값이 남아 헷갈리고, 그 기록이 다음
  // 스킬 생성 문맥으로 들어가 옛 값으로 되돌리는 원인이 된다. 기본 체크 상태로 함께 제안한다.
  const comps = Array.isArray(p.companions) ? p.companions : [];
  const companionHtml = comps.length ? `
      <div class="assist-comp">
        <div class="assist-comp-head">같이 고칠 곳 (옛 값이 남아 헷갈리는 것 방지)</div>
        ${comps.map((c, i) => `
          <label class="assist-comp-row">
            <input type="checkbox" class="assist-comp-cb" data-i="${i}" checked>
            <span class="assist-comp-label">${escapeHtml(c.label)}</span>
            <span class="assist-comp-text"><s>${escapeHtml(String(c.before).slice(0, 70))}</s> → ${escapeHtml(String(c.after).slice(0, 70))}</span>
          </label>`).join("")}
      </div>` : "";
  const html = `
    <div class="assist-card" data-pid="${escapeHtml(p.id)}">
      <div class="assist-card-head">Step ${p.stepNo} 코드 수정 제안 <span class="assist-card-kind">${p.kind === "replaceLiteral" ? "값 치환" : "코드 교체"}</span></div>
      ${p.reason ? `<div class="assist-card-reason">${escapeHtml(p.reason)}</div>` : ""}
      ${warn}
      <div class="assist-diff">${diffHtml}</div>
      ${companionHtml}
      <div class="assist-card-note">적용하지 않고 스킬만 바꿉니다. 라이브 Excel 은 그대로이며, 반영하려면 나중에 전체실행하세요.</div>
      <div class="assist-card-actions">
        <button type="button" class="assist-ok">이대로 수정</button>
        <button type="button" class="assist-no">취소</button>
      </div>
    </div>`;
  const el = assistAddMsg("assistant", html, { html: true });
  if (!el) return;
  el.querySelector(".assist-no").onclick = () => {
    el.querySelector(".assist-card-actions").innerHTML = `<span class="assist-done">취소했습니다.</span>`;
  };
  el.querySelector(".assist-ok").onclick = () => {
    const picked = [...el.querySelectorAll(".assist-comp-cb")]
      .filter(cb => cb.checked).map(cb => Number(cb.dataset.i));
    const r = assistCommitProposal(p.id, picked);
    const box = el.querySelector(".assist-card-actions");
    if (r && r.ok) {
      const c = r.companions || { step: 0, chat: 0 };
      const extra = (c.step || c.chat)
        ? ` · 이름/설명 ${c.step}곳, 대화 ${c.chat}곳 함께 수정`
        : "";
      box.innerHTML = `<span class="assist-done">✓ 수정했습니다 (라이브 미적용)${escapeHtml(extra)}</span>`;
    } else {
      box.innerHTML = `<span class="assist-fail">✕ ${escapeHtml((r && r.error) || "실패")}</span>`;
    }
  };
}

// 줄 단위 diff(간단). 큰 코드는 변경 지점 주변만 보여준다.
function assistBuildDiffHtml(oldCode, newCode) {
  const a = String(oldCode || "").split("\n");
  const b = String(newCode || "").split("\n");
  const rows = [];
  const max = Math.max(a.length, b.length);
  let shown = 0;
  for (let i = 0; i < max && shown < 40; i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (x != null) { rows.push(`<div class="d-del">- ${escapeHtml(x.slice(0, 200))}</div>`); shown++; }
    if (y != null) { rows.push(`<div class="d-add">+ ${escapeHtml(y.slice(0, 200))}</div>`); shown++; }
  }
  if (!rows.length) return `<div class="d-none">(줄 단위 차이 없음)</div>`;
  return rows.join("");
}

// 제목줄 드래그로 이동, 우하단 손잡이로 크기 조절. pointer 이벤트로 마우스/터치 동시 지원.
function assistBindDrag(el) {
  const head = el.querySelector("#assist-drag");
  const grip = el.querySelector("#assist-resize");
  let mode = null, sx = 0, sy = 0, sl = 0, st = 0, sw = 0, sh = 0;

  const down = (kind) => (e) => {
    // 헤더의 버튼을 눌렀을 땐 드래그하지 않는다.
    if (kind === "move" && e.target && e.target.closest && e.target.closest("button")) return;
    mode = kind;
    sx = e.clientX; sy = e.clientY;
    sl = el.offsetLeft; st = el.offsetTop; sw = el.offsetWidth; sh = el.offsetHeight;
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  };
  const move = (e) => {
    if (!mode) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (mode === "move") {
      el.style.left = (sl + dx) + "px";
      el.style.top = Math.max(0, st + dy) + "px";
    } else {
      el.style.width = Math.max(300, sw + dx) + "px";
      el.style.height = Math.max(240, sh + dy) + "px";
    }
  };
  const up = () => {
    if (!mode) return;
    mode = null;
    assistClampIntoView(el);
    assistSaveRect(el);
  };
  if (head) head.addEventListener("pointerdown", down("move"));
  if (grip) grip.addEventListener("pointerdown", down("resize"));
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("resize", () => { if (_assistOpen) assistClampIntoView(el); });
}

function assistToggleDrawer(force) {
  assistEnsureDom();
  const el = document.getElementById("assist-drawer");
  const btn = document.getElementById("btn-ai-help");
  _assistOpen = (typeof force === "boolean") ? force : !_assistOpen;
  el.classList.toggle("open", _assistOpen);
  if (_assistOpen) assistClampIntoView(el);
  if (btn) { btn.classList.toggle("on", _assistOpen); btn.setAttribute("aria-pressed", String(_assistOpen)); }
  if (_assistOpen) {
    // 네이티브 미러가 드로어를 덮으므로 잠시 숨긴다(사용자가 [👁 미러] 로 되돌릴 수 있다).
    try { if (typeof hideAllExcelMirrorWindows === "function") hideAllExcelMirrorWindows(); } catch (_) {}
    const box = document.getElementById("assist-messages");
    if (box && !box.children.length) {
      assistAddMsg("system", "스킬이 뜻대로 안 되거나 무엇을 고쳐야 할지 모를 때 물어보세요. 아래 버튼으로 시작해도 됩니다.");
    }
    setTimeout(() => { const t = document.getElementById("assist-text"); if (t) t.focus(); }, 60);
  } else {
    try { if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(120); } catch (_) {}
  }
}

/* ── 네이티브 팝업(별도 OS 창) 브리지 ───────────────────────────────────────
   WebView 는 SplitContainer 왼쪽에만 있어 DOM 팝업이 우측(네이티브 Excel 영역) 위로 못 올라간다
   (사용자 실측). 네이티브 셸에서는 C# 이 진짜 창(assist.html + WebView2)을 띄우고, 이 페이지의
   엔진(assistHandleUserMessage/assistCommitProposal)과 창 사이를 메시지로 중계한다.
   구버전 exe(중계 미지원)면 열기 요청에 응답이 없다 → 1.2초 내 무응답 시 DOM 팝업으로 폴백. */
let _assistNativeMode = false;      // 네이티브 창이 떠 있는가(버튼 표시용)
let _assistNativeAckTimer = null;

function assistNativeShellAvailable() {
  return !!(window.chrome && window.chrome.webview && /[?&]nativeShell=1/.test(location.search));
}
function assistPostToHost(text) {
  try { window.chrome.webview.postMessage(text); } catch (_) {}
}
function assistSendToPopup(obj) {
  assistPostToHost("B2B_ASSIST_TO_POPUP	" + JSON.stringify(obj));
}

function assistSetButtonOn(on) {
  const btn = document.getElementById("btn-ai-help");
  if (btn) { btn.classList.toggle("on", !!on); btn.setAttribute("aria-pressed", String(!!on)); }
}

function assistEnsureNativeBridge() {
  if (window.__b2bAssistBridgeBound || !assistNativeShellAvailable()) return;
  window.__b2bAssistBridgeBound = true;
  window.chrome.webview.addEventListener("message", (ev) => {
    let data = ev && ev.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch (_) { return; } }
    const m = data && data.__b2bAssist;
    if (!m || typeof m.t !== "string") return;
    try { assistHandleBridgeMessage(m); } catch (err) { console.warn("[assist] bridge", err); }
  });
}

function assistHandleBridgeMessage(m) {
  switch (m.t) {
    case "popup-opened":
      _assistNativeMode = true;
      clearTimeout(_assistNativeAckTimer);
      assistSetButtonOn(true);
      break;
    case "popup-closed":
      _assistNativeMode = false;
      assistSetButtonOn(false);
      break;
    case "popup-failed":
      _assistNativeMode = false;
      clearTimeout(_assistNativeAckTimer);
      assistToggleDrawer(true);            // 네이티브 실패 → DOM 팝업으로라도 연다
      break;
    case "ready":                          // 팝업 페이지 로드 완료 → 대화 이력 재생
      assistSendToPopup({
        t: "history",
        items: ((state.assist && state.assist.history) || []).slice(-40)
          .map(x => ({ role: x.role, content: String(x.content || "").slice(0, 4000) })),
      });
      break;
    case "user":
      assistHandleUserMessage(String(m.text || ""), {
        onStatus: (s) => assistSendToPopup({ t: "status", s }),
        onAssistantText: (t) => assistSendToPopup({ t: "assistant", text: t }),
        onToolTrace: (name, result) => assistSendToPopup({ t: "trace", name, ok: !(result && result.ok === false) }),
        onProposal: (p) => assistSendToPopup({ t: "proposal", proposal: p }),
        onReport: (meta) => assistSendToPopup({ t: "report", meta }),
      });
      break;
    case "commit": {
      const r = assistCommitProposal(m.pid, Array.isArray(m.picked) ? m.picked : []);
      assistSendToPopup({
        t: "commit-result", pid: m.pid,
        ok: !!(r && r.ok), error: (r && r.error) || "",
        companions: (r && r.companions) || null,
      });
      break;
    }
    case "clear":
      state.assist = { history: [] };
      assistSendToPopup({ t: "cleared" });
      break;
    case "report-build":
      // 다운로드(저장 대화상자)는 메인 WebView 에서 떠야 NativeHost 의 DownloadStarting 이 받는다.
      assistPrepareReportBundle(m.meta || {}).then(r => {
        assistSendToPopup({ t: "report-result", ok: !!r.ok, fileName: r.fileName || "",
                            included: r.included || [], missing: r.missing || [], error: r.error || "" });
      }).catch(err => {
        assistSendToPopup({ t: "report-result", ok: false, error: String(err && err.message).slice(0, 120) });
      });
      break;
  }
}

(function assistBindButton() {
  const bind = () => {
    const btn = document.getElementById("btn-ai-help");
    if (!btn || btn._assistBound) return;
    btn._assistBound = true;
    btn.onclick = () => {
      if (assistNativeShellAvailable()) {
        assistEnsureNativeBridge();
        const opening = !_assistNativeMode;
        assistPostToHost("B2B_ASSIST_POPUP	toggle");
        if (opening) {
          clearTimeout(_assistNativeAckTimer);
          _assistNativeAckTimer = setTimeout(() => {
            if (!_assistNativeMode) assistToggleDrawer();   // 구버전 exe 폴백
          }, 1200);
        }
        return;
      }
      assistToggleDrawer();                                  // 브라우저 모드: DOM 팝업
    };
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
