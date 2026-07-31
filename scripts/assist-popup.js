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

  // [Tier1] kind 별 카드 본문(assist-ui.js 와 동형 — 다른 창이라 코드 공유 불가, 의도적 중복).
  function proposalBody(p) {
    if (p.kind === "setStepEnabled") {
      return { headScope: "Step " + (Number(p.stepNo) || "?"), headLabel: p.enabled ? "단계 켜기" : "단계 끄기",
        body: '<div class="assist-card-note">Step ' + (Number(p.stepNo) || "?") + ' 을 <b>' + (p.enabled ? "켭니다" : "끕니다") + '</b>. 코드는 그대로이며, 라이브 반영은 전체실행 때 됩니다.</div>' };
    }
    if (p.kind === "replaceLiteralAll") {
      const targets = Array.isArray(p.targets) ? p.targets : [];
      const totalOcc = targets.reduce((n, t) => n + Number(t.occurrences || 0), 0);
      const rows = targets.map(t => '<div class="assist-comp-row" style="cursor:default"><span class="assist-comp-label">Step ' + t.stepNo + '</span><div class="assist-diff">' + buildDiffHtml(t.oldCode, t.newCode) + '</div></div>').join("");
      return { headScope: "스킬 전체", headLabel: "일괄 값 치환",
        body: '<div class="assist-card-reason">\'' + esc(String(p.from)) + '\' → \'' + esc(String(p.to)) + '\' · ' + targets.length + '개 단계 ' + totalOcc + '곳</div>'
          + '<div class="assist-warn">⚠ 여러 단계를 한 번에 바꿉니다. 아래 각 단계 diff 를 확인하세요.</div>' + rows
          + '<div class="assist-card-note">적용하지 않고 스킬만 바꿉니다. 반영하려면 전체실행하세요.</div>' };
    }
    const comps = Array.isArray(p.companions) ? p.companions : [];
    const companionHtml = comps.length ? '<div class="assist-comp"><div class="assist-comp-head">같이 고칠 곳 (옛 값이 남아 헷갈리는 것 방지)</div>'
      + comps.map((c, i) => '<label class="assist-comp-row"><input type="checkbox" class="assist-comp-cb" data-i="' + i + '" checked><span class="assist-comp-label">' + esc(c.label) + '</span><span class="assist-comp-text"><s>' + esc(String(c.before).slice(0, 70)) + '</s> → ' + esc(String(c.after).slice(0, 70)) + '</span></label>').join("") + '</div>' : "";
    const warn = (p.touchesNames
      ? '<div class="assist-warn">⚠ 파일명/시트명으로 보이는 문자열을 바꿉니다. 이름이 틀리면 실행이 실패합니다.</div>'
      : "")
      + (p.kind === "replaceLiteral" && Number(p.occurrences) > 1
        ? '<div class="assist-warn">⚠ 같은 문자열이 코드에 ' + Number(p.occurrences) + '곳 있어 전부 바뀝니다. 아래 diff 로 확인하세요.</div>'
        : "");
    return { headScope: "Step " + (Number(p.stepNo) || "?"), headLabel: p.kind === "replaceLiteral" ? "값 치환" : "코드 교체",
      body: warn + '<div class="assist-diff">' + buildDiffHtml(p.oldCode, p.newCode) + '</div>' + companionHtml
        + '<div class="assist-card-note">적용하지 않고 스킬만 바꿉니다. 라이브 Excel 은 그대로이며, 반영하려면 나중에 전체실행하세요.</div>' };
  }

  // [Tier2] 격리 검증 배지(assist-ui.js 와 동형).
  function verifyBadge(v) {
    if (!v || v.verifiable === false) return "";
    if (v.ok) {
      const n = Number(v.changedCount) || 0;
      const ex = (v.sample || []).map(s => String(s.value)).filter(Boolean).slice(0, 6);
      const exHtml = ex.length ? ' 예: ' + ex.map(x => esc(x)).join(", ") : "";
      return n > 0
        ? '<div class="assist-verified">✓ 격리에서 검증됨 — ' + n + '칸이 바뀝니다.' + exHtml + '</div>'
        : '<div class="assist-warn">⚠ 격리에서 돌려보니 바뀌는 셀이 0건입니다(조건이 안 맞을 수 있음). 그래도 적용할지 확인하세요.</div>';
    }
    return '<div class="assist-warn">⚠ 격리 검증 실패: ' + esc(String(v.error || "").slice(0, 120)) + ' — 검증 없이 적용됩니다.</div>';
  }

  function renderProposal(p) {
    const b = proposalBody(p);
    const html = `
      <div class="assist-card">
        <div class="assist-card-head">${esc(b.headScope)} 제안
          <span class="assist-card-kind">${esc(b.headLabel)}</span></div>
        ${p.reason ? '<div class="assist-card-reason">' + esc(p.reason) + "</div>" : ""}
        ${verifyBadge(p.verify)}
        ${b.body}
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
      const msg = m.heldForToggle
        ? ('✓ 코드를 교체했습니다. ' + (m.stepNo ? 'Step ' + m.stepNo + ' ' : '해당 단계 ') + '스위치를 켜(ON) 주시면 새 코드로 적용됩니다')
        : '✓ 수정했습니다 (라이브 미적용)';
      box.innerHTML = '<span class="assist-done">' + esc(msg) + esc(extra) + "</span>";
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

  function submit(text, images) {
    // [검증 R6] 진행 중 재전송(칩 클릭 포함)은 막는다 — 유령 말풍선 + 조기 done 으로 '중지' 버튼이
    // 풀리는 원인이었다. 칩도 이 함수를 거치므로 여기 한 곳의 가드로 충분하다.
    if (busy) { setStatus("처리 중입니다... (전송 버튼으로 중단할 수 있습니다)"); return; }
    const t = String(text || "").trim();
    if (!t) return;
    addMsg("user", t);
    setBusy(true);
    // [첨부 비전] 첨부 이미지는 메인 창(엔진)으로 함께 relay 한다(LLM 호출은 메인에서 돈다).
    post({ t: "user", text: t, images: (images && images.length ? images : null) });
  }
  // [첨부] 팝업은 백엔드로 첨부를 올려 슬라이드/이미지 base64 를 받는다(팝업도 같은 서버 오리진).
  async function uploadAttachments(staged) {
    const MAX = 30; const out = [];
    for (const a of (staged || [])) {
      if (!a || !a.file) continue;
      const buf = await a.file.arrayBuffer();
      const url = "/api/assist/attachment?name=" + encodeURIComponent(a.name) + "&maxSlides=40";
      const resp = await fetch(url, { method: "POST", body: buf });
      const data = await resp.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || ("첨부 처리 실패: " + a.name));
      (data.slides || []).forEach(s => { if (out.length < MAX) out.push({ mime: s.mime, imageB64: s.imageB64, text: s.text }); });
    }
    return out.length ? out : null;
  }

  let _reportCard = null;
  let _handoffCard = null;
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

  // [Tier1] 핸드오프 카드 — 버튼은 메인 창에 요청문 이관을 부탁한다(팝업은 메인 DOM 을 못 만짐).
  function renderHandoff(meta) {
    meta = meta || {};
    const steps = (Array.isArray(meta.steps) && meta.steps.length) ? meta.steps : null;
    // [단계별 핸드오프] 여러 단계면 단계마다 버튼(클릭 시 그 단계만 메인 설계 채팅으로).
    if (steps) {
      let stepsHtml = "";
      steps.forEach((s, i) => {
        stepsHtml += '<div class="assist-handoff-step">'
          + '<div class="assist-handoff-step-head">단계 ' + (i + 1) + (s.title ? ". " + esc(s.title) : "") + "</div>"
          + '<div class="assist-handoff-req">' + esc(s.request || "") + "</div>"
          + '<div class="assist-card-actions"><button type="button" class="assist-ok assist-handoff-step-go" data-i="' + i + '">이 단계 설계 채팅에 넣기</button></div></div>';
      });
      const html = '<div class="assist-card assist-handoff">'
        + '<div class="assist-card-head">↪ 스킬 설계 채팅으로 넘기기 (' + steps.length + '단계)</div>'
        + (meta.reason ? '<div class="assist-card-reason">' + esc(meta.reason) + "</div>" : "")
        + '<div class="assist-card-note">스킬은 한 단계씩 만듭니다. 아래를 <b>1번부터 순서대로</b> [넣기] → 설계 채팅에서 확인·전송·적용 → 다음 단계 순으로 진행하세요.</div>'
        + stepsHtml + "</div>";
      const el = addMsg("assistant", html, { html: true });
      if (!el) return;
      _handoffCard = null;   // 단계별은 클릭한 버튼만 로컬로 완료 표시(handoff-done 은 단일 카드용)
      el.querySelectorAll(".assist-handoff-step-go").forEach(btn => {
        btn.onclick = () => {
          const box = btn.closest(".assist-card-actions");
          post({ t: "handoff-go", request: steps[Number(btn.dataset.i)].request });
          if (box) box.innerHTML = '<span class="assist-done">✓ 설계 채팅에 넣었습니다. 확인 후 전송하세요.</span>';
        };
      });
      return;
    }
    // 단일 (기존)
    const req = String(meta.request || "");
    const html = '<div class="assist-card assist-handoff">'
      + '<div class="assist-card-head">↪ 스킬 설계 채팅으로 넘기기</div>'
      + (meta.reason ? '<div class="assist-card-reason">' + esc(meta.reason) + "</div>" : "")
      + '<div class="assist-card-note">새 단계를 만드는 작업은 아래 요청문으로 ③ 설계 채팅에서 진행합니다. 내용을 확인하고 [설계 채팅에 넣기]를 누르세요(자동 전송은 안 됩니다).</div>'
      + '<div class="assist-handoff-req">' + esc(req) + "</div>"
      + '<div class="assist-card-actions"><button type="button" class="assist-ok assist-handoff-go">설계 채팅에 넣기</button></div></div>';
    const el = addMsg("assistant", html, { html: true });
    if (!el) return;
    _handoffCard = el;
    el.querySelector(".assist-handoff-go").onclick = () => {
      el.querySelector(".assist-card-actions").innerHTML = '<span class="assist-done">메인 창 설계 채팅에 넣는 중...</span>';
      post({ t: "handoff-go", request: req });
    };
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
      case "ask":            // [실패 진단 연동] 메인이 자동 질문을 넣어줌 — 사용자가 친 것처럼 전송
        if (!busy) submit(String(m.text || ""));
        break;
      case "handoff": renderHandoff(m.meta || {}); setBusy(false); break;
      case "handoff-done":
        if (_handoffCard) { _handoffCard.querySelector(".assist-card-actions").innerHTML = m.ok
          ? '<span class="assist-done">✓ 메인 창 설계 채팅에 넣었습니다. 그쪽에서 확인 후 전송하세요.</span>'
          : '<span class="assist-fail">✕ 설계 채팅으로 전환하지 못했습니다.</span>'; _handoffCard = null; }
        break;
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
  // [첨부] 전송 전까지 대기하는 첨부(파일명만 카드로). 팝업은 메시지 표식만 메인으로 relay(실제 처리는 다음 단계).
  let popupStaged = [];
  const renderAttach = () => {
    const box = $id("assist-attach-list");
    if (!box) return;
    if (!popupStaged.length) { box.innerHTML = ""; box.style.display = "none"; return; }
    box.style.display = "flex";
    box.innerHTML = popupStaged.map((a, i) =>
      `<span class="assist-attach-chip"><span class="ac-ic">📎</span><span class="ac-nm">${esc(a.name)}</span><button type="button" class="ac-x" data-i="${i}" title="첨부 제거">✕</button></span>`).join("");
    box.querySelectorAll(".ac-x").forEach(b => { b.onclick = () => { popupStaged.splice(Number(b.dataset.i), 1); renderAttach(); }; });
  };
  const send = async () => {
    if (busy) { post({ t: "stop" }); setStatus("중단 중..."); return; }   // [검토 #1] 진행 중 = 중지 버튼
    const ta = $id("assist-text");
    let text = String(ta.value || "").trim();
    if (!text && !popupStaged.length) return;
    const staged = popupStaged.slice();
    if (staged.length) {
      const names = staged.map(a => a.name).join(", ");
      if (!text) text = "첨부한 파일을 기반으로 각 단계를 B2B 채팅에 칠 프롬프트로 만들어줘.";
      text += "\n\n[첨부: " + names + "]";
    }
    ta.value = "";
    popupStaged = []; renderAttach();
    let images = null;
    if (staged.length) {
      setStatus("첨부 분석 중... (슬라이드 렌더)");
      try { images = await uploadAttachments(staged); }
      catch (e) { addMsg("system", "첨부 처리 실패: " + ((e && e.message) || e)); }
      setStatus("");
    }
    submit(text, images);
  };
  $id("assist-send").onclick = send;
  $id("assist-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  const attachBtn = $id("assist-attach-btn"), attachInput = $id("assist-attach-input");
  if (attachBtn && attachInput) {
    attachBtn.onclick = () => attachInput.click();
    attachInput.addEventListener("change", () => {
      Array.from(attachInput.files || []).forEach(f => popupStaged.push({ name: f.name, size: f.size, file: f }));
      attachInput.value = ""; renderAttach();
    });
  }
  $id("assist-clear").onclick = () => { popupStaged = []; renderAttach(); post({ t: "clear" }); };

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
