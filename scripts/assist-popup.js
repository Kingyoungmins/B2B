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

  // [검토 #10] 같은 줄번호끼리 비교하면 줄 하나 삽입에도 이후 전체가 어긋난 diff 로 보였다(승인 근거
  // 왜곡). 공통 앞/뒤를 걷어낸 '실제 변경 블록'만 보여주고, 잘리면 반드시 표시한다(assist-ui 와 동일).
  function buildDiffHtml(oldCode, newCode) {
    const a = String(oldCode || "").split("\n");
    const b = String(newCode || "").split("\n");
    let pre = 0;
    while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    let endA = a.length, endB = b.length;
    while (endA > pre && endB > pre && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
    const dels = a.slice(pre, endA);
    const adds = b.slice(pre, endB);
    if (!dels.length && !adds.length) return '<div class="d-none">(줄 단위 차이 없음)</div>';
    const CAP = 25;
    const rows = [];
    if (pre > 0) rows.push('<div class="d-ctx">… ' + (pre + 1) + '번째 줄부터 변경 …</div>');
    dels.slice(0, CAP).forEach(x => rows.push('<div class="d-del">- ' + esc(x.slice(0, 200)) + "</div>"));
    if (dels.length > CAP) rows.push('<div class="d-ctx">… 삭제 ' + (dels.length - CAP) + '줄 더 있음(반영은 코드 전체 기준) …</div>');
    adds.slice(0, CAP).forEach(y => rows.push('<div class="d-add">+ ' + esc(y.slice(0, 200)) + "</div>"));
    if (adds.length > CAP) rows.push('<div class="d-ctx">… 추가 ' + (adds.length - CAP) + '줄 더 있음(반영은 코드 전체 기준) …</div>');
    return rows.join("");
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
    const warn = (p.touchesNames
      ? '<div class="assist-warn">⚠ 파일명/시트명으로 보이는 문자열을 바꿉니다. 이름이 틀리면 실행이 실패합니다.</div>'
      : "")
      + (p.kind === "replaceLiteral" && Number(p.occurrences) > 1
        ? '<div class="assist-warn">⚠ 같은 문자열이 코드에 ' + Number(p.occurrences) + '곳 있어 전부 바뀝니다. 아래 diff 로 확인하세요.</div>'
        : "");
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
    // [검증 항목8] 실패 시 [다시 시도] 버튼을 복원할 수 있게 액션 영역을 재바인딩 함수로 만든다.
    const bindActions = (prefixHtml) => {
      const box = el.querySelector(".assist-card-actions");
      if (!box) return;
      box.innerHTML = (prefixHtml || "")
        + '<button type="button" class="assist-ok">' + (prefixHtml ? "다시 시도" : "이대로 수정") + '</button>'
        + '<button type="button" class="assist-no">취소</button>';
      el.querySelector(".assist-no").onclick = () => {
        box.innerHTML = '<span class="assist-done">취소했습니다.</span>';
        cards.delete(String(p.id));
      };
      el.querySelector(".assist-ok").onclick = () => {
        const picked = [...el.querySelectorAll(".assist-comp-cb")]
          .filter(cb => cb.checked).map(cb => Number(cb.dataset.i));
        box.innerHTML = '<span class="assist-done">반영 중...</span>';
        post({ t: "commit", pid: p.id, picked });
      };
    };
    cards.set(String(p.id), { el, bindActions });
    bindActions("");
  }

  function onCommitResult(m) {
    const entry = cards.get(String(m.pid));
    if (!entry) return;
    const box = entry.el.querySelector(".assist-card-actions");
    if (!box) return;
    if (m.ok) {
      cards.delete(String(m.pid));   // 성공했을 때만 소거 — 실패는 재시도 가능해야 한다
      const c = m.companions || { step: 0, chat: 0 };
      const extra = (c.step || c.chat) ? ` · 이름/설명 ${c.step}곳, 대화 ${c.chat}곳 함께 수정` : "";
      box.innerHTML = '<span class="assist-done">✓ 수정했습니다 (라이브 미적용)' + esc(extra) + "</span>";
    } else {
      entry.bindActions('<span class="assist-fail">✕ ' + esc(m.error || "실패") + "</span> ");
    }
  }

  // [검토 #1] 응답 진행 상태 추적 — 진행 중엔 전송 버튼이 '중지'가 된다. 완료 신호는 메인이 보내는
  // status:""(루프 finally 의 say(""))와 assistant/proposal/report 수신이다.
  let busy = false;
  function setBusy(on) {
    busy = !!on;
    const btn = $id("assist-send");
    if (btn) btn.textContent = busy ? "중지" : "전송";
  }

  function submit(text) {
    // [검증 R6] 진행 중 재전송(칩 클릭 포함)은 막는다 — 유령 말풍선 + 조기 done 으로 '중지' 버튼이
    // 풀리는 원인이었다. 칩도 이 함수를 거치므로 여기 한 곳의 가드로 충분하다.
    if (busy) { setStatus("처리 중입니다... (전송 버튼으로 중단할 수 있습니다)"); return; }
    const t = String(text || "").trim();
    if (!t) return;
    addMsg("user", t);
    setBusy(true);
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
      case "status":
        setStatus(m.s);
        if (!String(m.s || "").trim()) setBusy(false);   // say("") = 라운드 루프 종료 신호
        break;
      case "done": setBusy(false); break;                // 조기 거절 포함 모든 종료를 덮는 확정 신호
      case "assistant": addMsg("assistant", m.text); setBusy(false); break;
      case "trace": addMsg("trace", (m.ok === false ? "✕ " : "· ") + m.name); break;
      case "proposal": renderProposal(m.proposal || {}); setBusy(false); break;
      case "commit-result": onCommitResult(m); break;
      case "report": renderReport(m.meta || {}); setBusy(false); break;
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
  const send = () => {
    if (busy) { post({ t: "stop" }); setStatus("중단 중..."); return; }   // [검토 #1] 진행 중 = 중지 버튼
    const ta = $id("assist-text"); submit(ta.value); ta.value = "";
  };
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
