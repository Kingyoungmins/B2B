/* ===================================================================
   AI 도움 — 팝업 창(별도 OS 창)의 뷰
   ===================================================================
   이 파일은 '화면'만 담당한다. 엔진(assist-core)·도구·상태는 전부 메인 페이지에 있고,
   C#(NativeHost)이 두 WebView 사이를 중계한다:
     이 창 → C#  : postMessage("B2B_ASSIST_TO_MAIN\t" + JSON)
     C# → 이 창  : message 이벤트, 데이터는 {"__b2bAssist": {...}} 문자열
   assist-ui.js(메인 쪽 DOM 팝업)와 렌더 코드가 일부 중복된다 — 의도적이다.
   두 문서는 다른 창이라 코드를 공유할 수 없고, 어설픈 공유 시도가 더 위험하다.
   =================================================================== */

(function () {
  "use strict";

  const $id = (x) => document.getElementById(x);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const bridgeUp = !!(window.chrome && window.chrome.webview);
  const post = (obj) => {
    try { window.chrome.webview.postMessage("B2B_ASSIST_TO_MAIN\t" + JSON.stringify(obj)); } catch (_) {}
  };

  const CHIPS = [
    ["실행 전 점검", "지금 전체실행하면 문제 될 게 있는지 점검해줘"],
    ["안 바뀐 이유", "적용됐다는데 값이 안 바뀐 것 같아. 왜인지 봐줘"],
    ["이 스킬 설명", "이 스킬이 단계별로 뭘 하는지 쉽게 설명해줘"],
    ["다음 달 준비", "다음 달 파일로 쓰려면 어디를 고쳐야 하는지 알려줘"],
    ["되돌릴 수 있나", "지금 상태에서 되돌릴 수 있는지 알려줘"],
  ];

  const cards = new Map();   // proposalId → 카드 element (커밋 결과 반영용)

  function addMsg(role, text, opts) {
    const box = $id("assist-messages");
    if (!box) return null;
    const div = document.createElement("div");
    div.className = "assist-msg " + role;
    if (opts && opts.html) div.innerHTML = text;
    else div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }
  function setStatus(s) {
    const el = $id("assist-status");
    if (el) el.textContent = s || "";
  }

  function buildDiffHtml(oldCode, newCode) {
    const a = String(oldCode || "").split("\n");
    const b = String(newCode || "").split("\n");
    const rows = [];
    const max = Math.max(a.length, b.length);
    let shown = 0;
    for (let i = 0; i < max && shown < 40; i++) {
      const x = a[i], y = b[i];
      if (x === y) continue;
      if (x != null) { rows.push('<div class="d-del">- ' + esc(x.slice(0, 200)) + "</div>"); shown++; }
      if (y != null) { rows.push('<div class="d-add">+ ' + esc(y.slice(0, 200)) + "</div>"); shown++; }
    }
    return rows.length ? rows.join("") : '<div class="d-none">(줄 단위 차이 없음)</div>';
  }

  function renderProposal(p) {
    const comps = Array.isArray(p.companions) ? p.companions : [];
    const companionHtml = comps.length ? `
      <div class="assist-comp">
        <div class="assist-comp-head">같이 고칠 곳 (옛 값이 남아 헷갈리는 것 방지)</div>
        ${comps.map((c, i) => `
          <label class="assist-comp-row">
            <input type="checkbox" class="assist-comp-cb" data-i="${i}" checked>
            <span class="assist-comp-label">${esc(c.label)}</span>
            <span class="assist-comp-text"><s>${esc(String(c.before).slice(0, 70))}</s> → ${esc(String(c.after).slice(0, 70))}</span>
          </label>`).join("")}
      </div>` : "";
    const warn = p.touchesNames
      ? '<div class="assist-warn">⚠ 파일명/시트명으로 보이는 문자열을 바꿉니다. 이름이 틀리면 실행이 실패합니다.</div>'
      : "";
    const html = `
      <div class="assist-card">
        <div class="assist-card-head">Step ${Number(p.stepNo) || "?"} 코드 수정 제안
          <span class="assist-card-kind">${p.kind === "replaceLiteral" ? "값 치환" : "코드 교체"}</span></div>
        ${p.reason ? '<div class="assist-card-reason">' + esc(p.reason) + "</div>" : ""}
        ${warn}
        <div class="assist-diff">${buildDiffHtml(p.oldCode, p.newCode)}</div>
        ${companionHtml}
        <div class="assist-card-note">적용하지 않고 스킬만 바꿉니다. 라이브 Excel 은 그대로이며, 반영하려면 나중에 전체실행하세요.</div>
        <div class="assist-card-actions">
          <button type="button" class="assist-ok">이대로 수정</button>
          <button type="button" class="assist-no">취소</button>
        </div>
      </div>`;
    const el = addMsg("assistant", html, { html: true });
    if (!el) return;
    cards.set(String(p.id), el);
    el.querySelector(".assist-no").onclick = () => {
      el.querySelector(".assist-card-actions").innerHTML = '<span class="assist-done">취소했습니다.</span>';
      cards.delete(String(p.id));
    };
    el.querySelector(".assist-ok").onclick = () => {
      const picked = [...el.querySelectorAll(".assist-comp-cb")]
        .filter(cb => cb.checked).map(cb => Number(cb.dataset.i));
      el.querySelector(".assist-card-actions").innerHTML = '<span class="assist-done">반영 중...</span>';
      post({ t: "commit", pid: p.id, picked });
    };
  }

  function onCommitResult(m) {
    const el = cards.get(String(m.pid));
    if (!el) return;
    cards.delete(String(m.pid));
    const box = el.querySelector(".assist-card-actions");
    if (!box) return;
    if (m.ok) {
      const c = m.companions || { step: 0, chat: 0 };
      const extra = (c.step || c.chat) ? ` · 이름/설명 ${c.step}곳, 대화 ${c.chat}곳 함께 수정` : "";
      box.innerHTML = '<span class="assist-done">✓ 수정했습니다 (라이브 미적용)' + esc(extra) + "</span>";
    } else {
      box.innerHTML = '<span class="assist-fail">✕ ' + esc(m.error || "실패") + "</span>";
    }
  }

  function submit(text) {
    const t = String(text || "").trim();
    if (!t) return;
    addMsg("user", t);
    post({ t: "user", text: t });
  }

  let _reportCard = null;
  function renderReport(meta) {
    meta = meta || {};
    const html = `
      <div class="assist-card assist-report">
        <div class="assist-card-head">🧾 이슈 제보 준비</div>
        <div class="assist-card-reason">${esc(meta.reason || "AI 도움 범위를 벗어나는 문제로 보입니다.")}</div>
        <div class="assist-card-note">
          입력 파일 + 스킬 + 진단 기록을 zip 하나로 묶어 드립니다.<br>
          받은 zip 은 <b>사내 지라(SBAGENT 프로젝트)</b>에 새 이슈(버그)로 올리고 통째로 첨부하세요 —
          자세한 절차와 붙여넣을 양식은 zip 안의 <b>제보양식.txt</b> 에 있습니다.
        </div>
        <div class="assist-card-actions">
          <button type="button" class="assist-ok assist-report-build">📦 제보 파일 묶음 만들기</button>
        </div>
      </div>`;
    const el = addMsg("assistant", html, { html: true });
    if (!el) return;
    _reportCard = el;
    el.querySelector(".assist-report-build").onclick = () => {
      el.querySelector(".assist-card-actions").innerHTML = '<span class="assist-done">묶는 중... (저장 대화상자는 메인 창에 뜹니다)</span>';
      post({ t: "report-build", meta });
    };
  }
  function onReportResult(m) {
    const el = _reportCard;
    _reportCard = null;
    if (!el) return;
    const box = el.querySelector(".assist-card-actions");
    if (!box) return;
    if (!m.ok) {
      box.innerHTML = '<span class="assist-fail">✕ ' + esc(m.error || "묶음 생성 실패") + "</span>";
      return;
    }
    const parts = ['<span class="assist-done">✓ ' + esc(m.fileName || "") + ' 저장 대화상자가 메인 창에 열렸습니다.</span>'];
    if (m.included && m.included.length) parts.push('<div class="assist-card-note">포함: ' + esc(m.included.join(", ")) + "</div>");
    if (m.missing && m.missing.length) parts.push('<div class="assist-warn">⚠ 자동으로 못 담은 것(직접 첨부 필요): ' + esc(m.missing.join(", ")) + "</div>");
    box.innerHTML = parts.join("");
  }

  function onBridge(m) {
    switch (m.t) {
      case "history": {
        const box = $id("assist-messages");
        if (box) box.innerHTML = "";
        (m.items || []).forEach(it => {
          if (it && (it.role === "user" || it.role === "assistant")) addMsg(it.role, it.content);
        });
        if (!(m.items || []).length) {
          addMsg("system", "스킬이 뜻대로 안 되거나 무엇을 고쳐야 할지 모를 때 물어보세요. 아래 버튼으로 시작해도 됩니다.");
        }
        break;
      }
      case "status": setStatus(m.s); break;
      case "assistant": addMsg("assistant", m.text); break;
      case "trace": addMsg("trace", (m.ok === false ? "✕ " : "· ") + m.name); break;
      case "proposal": renderProposal(m.proposal || {}); break;
      case "commit-result": onCommitResult(m); break;
      case "report": renderReport(m.meta || {}); break;
      case "report-result": onReportResult(m); break;
      case "cleared": {
        const box = $id("assist-messages");
        if (box) box.innerHTML = "";
        addMsg("system", "대화를 비웠습니다. 스킬과 파일은 그대로입니다.");
        break;
      }
    }
  }

  // ── 배선 ──────────────────────────────────────────────────────────────────
  const chipsBox = $id("assist-chips");
  chipsBox.innerHTML = CHIPS.map((c, i) =>
    `<button type="button" class="assist-chip" data-i="${i}">${esc(c[0])}</button>`).join("");
  chipsBox.querySelectorAll(".assist-chip").forEach(b => {
    b.onclick = () => submit(CHIPS[Number(b.dataset.i)][1]);
  });
  const send = () => { const ta = $id("assist-text"); submit(ta.value); ta.value = ""; };
  $id("assist-send").onclick = send;
  $id("assist-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  $id("assist-clear").onclick = () => post({ t: "clear" });

  if (bridgeUp) {
    window.chrome.webview.addEventListener("message", (ev) => {
      let data = ev && ev.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch (_) { return; } }
      const m = data && data.__b2bAssist;
      if (m && typeof m.t === "string") onBridge(m);
    });
    post({ t: "ready" });          // 메인이 대화 이력을 되돌려준다
  } else {
    $id("assist-offline").style.display = "block";
  }
})();
