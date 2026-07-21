/* ===================================================================
   AI 도움 — 드로어 UI
   ===================================================================
   기존 ③ 스킬 설계 채팅과 DOM/상태를 완전히 분리한다(같은 함수를 재사용하면
   $("chat-messages") 하드코딩 때문에 두 대화가 한 곳에 섞인다).
   네이티브 Excel 미러는 항상 위에 떠 있어 드로어를 덮으므로, 열 때 숨기고 닫을 때 복구한다.
   =================================================================== */

let _assistOpen = false;

function assistEnsureDom() {
  if (document.getElementById("assist-drawer")) return;
  const el = document.createElement("div");
  el.id = "assist-drawer";
  el.className = "assist-drawer";
  el.innerHTML = `
    <div class="assist-head">
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
    </div>`;
  document.body.appendChild(el);

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
  });
}

// 승인 카드 — 여기 버튼을 눌러야만 스킬이 바뀐다.
function assistRenderProposalCard(p) {
  const diffHtml = assistBuildDiffHtml(p.oldCode, p.newCode);
  const warn = p.touchesNames
    ? `<div class="assist-warn">⚠ 파일명/시트명으로 보이는 문자열을 바꿉니다. 이름이 틀리면 실행이 실패합니다.</div>`
    : "";
  const html = `
    <div class="assist-card" data-pid="${escapeHtml(p.id)}">
      <div class="assist-card-head">Step ${p.stepNo} 코드 수정 제안 <span class="assist-card-kind">${p.kind === "replaceLiteral" ? "값 치환" : "코드 교체"}</span></div>
      ${p.reason ? `<div class="assist-card-reason">${escapeHtml(p.reason)}</div>` : ""}
      ${warn}
      <div class="assist-diff">${diffHtml}</div>
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
    const r = assistCommitProposal(p.id);
    const box = el.querySelector(".assist-card-actions");
    if (r && r.ok) {
      box.innerHTML = `<span class="assist-done">✓ 수정했습니다 (라이브 미적용)</span>`;
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

function assistToggleDrawer(force) {
  assistEnsureDom();
  const el = document.getElementById("assist-drawer");
  const btn = document.getElementById("btn-ai-help");
  _assistOpen = (typeof force === "boolean") ? force : !_assistOpen;
  el.classList.toggle("open", _assistOpen);
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

(function assistBindButton() {
  const bind = () => {
    const btn = document.getElementById("btn-ai-help");
    if (!btn || btn._assistBound) return;
    btn._assistBound = true;
    btn.onclick = () => assistToggleDrawer();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
