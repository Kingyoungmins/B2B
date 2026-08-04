/* ===================================================================
   AI 도움 — 떠 있는 팝업 창
   ===================================================================
   앱 레이아웃에 붙지 않고 자유롭게 움직이는 창(제목줄 드래그 이동, 우하단 손잡이로 크기 조절,
   위치·크기는 localStorage 에 기억). 기존 ③ 스킬 설계 채팅과 DOM/상태를 완전히 분리한다
   (같은 함수를 재사용하면 컨테이너 하드코딩 때문에 두 대화가 한 곳에 섞인다).
   네이티브 Excel 미러는 항상 위에 떠 있어 이 창을 덮으므로, 열 때 숨기고 닫을 때 복구한다.
   =================================================================== */

let _assistOpen = false;
let _assistMirrorHidden = false;   // [검토 #20] 👁 미러 버튼의 실제 토글 상태
// [첨부] 전송 전까지 대기하는 첨부 파일 목록(파일명만 카드로 표시). 실제 렌더/비전 처리는 다음 단계.
let assistStagedAttachments = [];

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
    <div class="assist-attach-list" id="assist-attach-list"></div>
    <div class="assist-input-row">
      <button class="assist-attach-btn" id="assist-attach-btn" type="button" title="파일 첨부 (PPT·이미지 등)">📎</button>
      <input type="file" id="assist-attach-input" accept=".pptx,.ppt,.pdf,.png,.jpg,.jpeg,image/*" multiple style="display:none">
      <textarea id="assist-text" rows="2" placeholder="예) 3단계가 적용됐다는데 값이 안 바뀌었어 / 이 스킬 뭐 하는 거야? / 5월 파일로 바꾸려면 뭘 고쳐야 해?"></textarea>
      <button class="assist-send" id="assist-send" type="button">전송</button>
    </div>
    <div class="assist-resize" id="assist-resize" title="크기 조절"></div>`;
  document.body.appendChild(el);
  assistBindDrag(el);

  document.getElementById("assist-close").onclick = () => assistToggleDrawer(false);
  document.getElementById("assist-clear").onclick = () => {
    // [검토 #17] 응답 진행 중 비우면 늦게 도착한 assistant 가 빈 대화 앞에 고아로 붙는다 — 먼저 중단.
    if (typeof assistIsBusy === "function" && assistIsBusy() && typeof assistAbortCurrent === "function") {
      assistAbortCurrent();
    }
    state.assist = { history: [] };
    document.getElementById("assist-messages").innerHTML = "";
    assistRenderChips();
    assistClearAttachments();
    assistAddMsg("system", "대화를 비웠습니다. 스킬과 파일은 그대로입니다.");
  };
  document.getElementById("assist-mirror-toggle").onclick = () => {
    // [검토 #20] 기존엔 hide + 120ms 뒤 restore 예약을 '동시에' 걸어 깜빡이기만 했다 — 진짜 토글로.
    try {
      if (_assistMirrorHidden) {
        if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0);
        _assistMirrorHidden = false;
      } else {
        if (typeof hideAllExcelMirrorWindows === "function") hideAllExcelMirrorWindows();
        _assistMirrorHidden = true;
      }
    } catch (_) {}
  };
  const send = async () => {
    // [검토 #1] 응답 중엔 같은 버튼이 '중지'로 동작한다.
    if (typeof assistIsBusy === "function" && assistIsBusy()) {
      if (typeof assistAbortCurrent === "function") assistAbortCurrent();
      assistSetStatus("중단 중...");
      return;
    }
    const ta = document.getElementById("assist-text");
    let text = String(ta.value || "").trim();
    if (!text && !assistStagedAttachments.length) return;
    // [첨부] 대기 중 첨부는 표식을 붙이고, 파일은 백엔드에서 슬라이드/이미지로 렌더해 비전으로 함께 보낸다.
    const staged = assistStagedAttachments.slice();
    if (staged.length) {
      const names = staged.map(a => a.name).join(", ");
      if (!text) text = "첨부한 파일을 기반으로 각 단계를 B2B 채팅에 칠 프롬프트로 만들어줘.";
      text += "\n\n[첨부: " + names + "]";
    }
    ta.value = "";
    assistClearAttachments();
    let images = null;
    if (staged.length) {
      assistSetStatus("첨부 분석 중... (슬라이드 렌더)");
      try { images = await assistUploadAttachments(staged); }
      catch (e) { assistAddMsg("system", "첨부 처리 실패: " + ((e && e.message) || e)); }
      assistSetStatus("");
    }
    assistSubmit(text, images);
  };
  document.getElementById("assist-send").onclick = send;
  document.getElementById("assist-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  // [첨부] 클립 아이콘 → 파일 선택 → 카드로 대기(전송 시 함께 나감)
  const attachBtn = document.getElementById("assist-attach-btn");
  const attachInput = document.getElementById("assist-attach-input");
  if (attachBtn && attachInput) {
    attachBtn.onclick = () => attachInput.click();
    attachInput.addEventListener("change", () => {
      Array.from(attachInput.files || []).forEach(f => {
        assistStagedAttachments.push({ name: f.name, size: f.size, file: f });
      });
      attachInput.value = "";   // 같은 파일 다시 선택 가능하도록
      assistRenderAttachments();
    });
  }
  assistRenderChips();
  assistRenderAttachments();
}

// [첨부] 대기 중 첨부 파일을 카드(파일명 + 삭제)로 렌더. 없으면 목록을 숨긴다.
function assistRenderAttachments() {
  const box = document.getElementById("assist-attach-list");
  if (!box) return;
  if (!assistStagedAttachments.length) { box.innerHTML = ""; box.style.display = "none"; return; }
  box.style.display = "flex";
  box.innerHTML = assistStagedAttachments.map((a, i) =>
    `<span class="assist-attach-chip"><span class="ac-ic">📎</span><span class="ac-nm">${escapeHtml(a.name)}</span><button type="button" class="ac-x" data-i="${i}" title="첨부 제거">✕</button></span>`
  ).join("");
  box.querySelectorAll(".ac-x").forEach(b => {
    b.onclick = () => { assistStagedAttachments.splice(Number(b.dataset.i), 1); assistRenderAttachments(); };
  });
}
function assistClearAttachments() {
  assistStagedAttachments = [];
  assistRenderAttachments();
}

// [첨부] 대기 파일들을 백엔드(/api/assist/attachment)로 보내 슬라이드/이미지 base64 를 받는다.
// PPT 는 슬라이드마다 PNG 로 렌더된다. 반환: [{mime, imageB64, text}] (비전 content 용), 없으면 null.
async function assistUploadAttachments(staged) {
  const MAX_IMAGES = 30;   // 토큰 폭주 방지(슬라이드 합산 상한)
  const out = [];
  for (const a of (staged || [])) {
    if (!a || !a.file) continue;
    const buf = await a.file.arrayBuffer();
    const url = "/api/assist/attachment?name=" + encodeURIComponent(a.name) + "&maxSlides=40";
    const resp = await fetch(url, { method: "POST", body: buf });
    const data = await resp.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.error || ("첨부 처리 실패: " + a.name));
    (data.slides || []).forEach(s => {
      if (out.length < MAX_IMAGES) out.push({ mime: s.mime, imageB64: s.imageB64, text: s.text });
    });
  }
  return out.length ? out : null;
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

function assistSubmit(text, images) {
  if (typeof assistIsBusy === "function" && assistIsBusy()) {
    assistSetStatus("처리 중입니다... (전송 버튼으로 중단할 수 있습니다)");
    return;
  }
  // [검토 #16] 생성기 채팅 중이면 말풍선을 만들기 전에 막는다 — 기존엔 화면에만 남고 히스토리에는
  // 없는 유령 메시지가 됐고, 상태 문구도 초기화되지 않아 고착됐다.
  if (typeof window !== "undefined" && window.__b2bChatInFlight) {
    assistSetStatus("스킬 설계 채팅이 응답 중입니다. 끝난 뒤 다시 시도해 주세요.");
    setTimeout(() => { if (!(typeof assistIsBusy === "function" && assistIsBusy())) assistSetStatus(""); }, 4000);
    return;
  }
  assistAddMsg("user", text);
  const sendBtn = document.getElementById("assist-send");
  if (sendBtn) sendBtn.textContent = "중지";
  const restore = () => { if (sendBtn) sendBtn.textContent = "전송"; };
  Promise.resolve(assistHandleUserMessage(text, {
    onStatus: assistSetStatus,
    onAssistantText: (t) => assistAddMsg("assistant", t),
    onToolTrace: (name, result) => {
      const okMark = result && result.ok === false ? "✕" : "·";
      assistAddMsg("trace", `${okMark} ${name}`);
    },
    onProposal: assistRenderProposalCard,
    onReport: assistRenderReportCard,
    onHandoff: assistRenderHandoffCard,
  }, images)).catch(() => {}).finally(restore);
}

// [Tier1] 핸드오프 카드 — 새 단계 생성은 ③ 설계 채팅의 일. 정리된 요청문을 넣어주고 사용자가 검토·전송.
function assistPutToDesignChat(req) {
  const ta = document.getElementById("chat-text");
  if (ta) ta.value = String(req || "");
  if (typeof setPage === "function") setPage("generator");
  if (ta) ta.focus();
}

function assistRenderHandoffCard(meta) {
  const steps = (Array.isArray(meta.steps) && meta.steps.length) ? meta.steps : null;
  // [단계별 핸드오프] 여러 단계면 단계마다 요청문 + [이 단계 넣기] 버튼(스킬은 한 메시지=한 단계).
  if (steps) {
    const stepsHtml = steps.map((s, i) => `
      <div class="assist-handoff-step">
        <div class="assist-handoff-step-head">단계 ${i + 1}${s.title ? ". " + escapeHtml(s.title) : ""}</div>
        <div class="assist-handoff-req">${escapeHtml(s.request)}</div>
        <div class="assist-card-actions"><button type="button" class="assist-ok assist-handoff-step-go" data-i="${i}">이 단계 설계 채팅에 넣기</button></div>
      </div>`).join("");
    const html = `
      <div class="assist-card assist-handoff">
        <div class="assist-card-head">↪ 스킬 설계 채팅으로 넘기기 (${steps.length}단계)</div>
        ${meta.reason ? `<div class="assist-card-reason">${escapeHtml(meta.reason)}</div>` : ""}
        <div class="assist-card-note">스킬은 한 단계씩 만듭니다. 아래를 <b>1번부터 순서대로</b> [넣기] → 설계 채팅에서 확인·전송·적용 → 다음 단계 순으로 진행하세요.</div>
        ${stepsHtml}
      </div>`;
    const el = assistAddMsg("assistant", html, { html: true });
    if (!el) return;
    el.querySelectorAll(".assist-handoff-step-go").forEach(btn => {
      btn.onclick = () => {
        const box = btn.closest(".assist-card-actions");
        try {
          assistPutToDesignChat(steps[Number(btn.dataset.i)].request);
          if (box) box.innerHTML = `<span class="assist-done">✓ 설계 채팅에 넣었습니다. 확인 후 전송하세요.</span>`;
        } catch (_) {
          if (box) box.innerHTML = `<span class="assist-fail">✕ 설계 채팅으로 전환하지 못했습니다.</span>`;
        }
      };
    });
    return;
  }
  // 단일 (기존)
  const req = String(meta.request || "");
  const html = `
    <div class="assist-card assist-handoff">
      <div class="assist-card-head">↪ 스킬 설계 채팅으로 넘기기</div>
      ${meta.reason ? `<div class="assist-card-reason">${escapeHtml(meta.reason)}</div>` : ""}
      <div class="assist-card-note">새 단계를 만드는 작업은 아래 요청문으로 ③ 설계 채팅에서 진행합니다. 내용을 확인하고 [설계 채팅에 넣기]를 누르세요(자동 전송은 안 됩니다).</div>
      <div class="assist-handoff-req">${escapeHtml(req)}</div>
      <div class="assist-card-actions">
        <button type="button" class="assist-ok assist-handoff-go">설계 채팅에 넣기</button>
      </div>
    </div>`;
  const el = assistAddMsg("assistant", html, { html: true });
  if (!el) return;
  el.querySelector(".assist-handoff-go").onclick = () => {
    try {
      assistPutToDesignChat(req);
      el.querySelector(".assist-card-actions").innerHTML = `<span class="assist-done">✓ 설계 채팅 입력창에 넣었습니다. 확인 후 전송하세요.</span>`;
    } catch (_) {
      el.querySelector(".assist-card-actions").innerHTML = `<span class="assist-fail">✕ 설계 채팅으로 전환하지 못했습니다.</span>`;
    }
  };
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

// [Tier1] 카드 본문을 kind 별로 구성(공통 헤더/액션은 아래에서 공유). 반환: {headLabel, body}.
function _assistProposalCardBody(p) {
  if (p.kind === "setStepEnabled") {
    return { headLabel: p.enabled ? "단계 켜기" : "단계 끄기",
      body: `<div class="assist-card-note">Step ${p.stepNo} 을 <b>${p.enabled ? "켭니다" : "끕니다"}</b>. 코드는 그대로이며, 라이브 반영은 전체실행 때 됩니다.</div>` };
  }
  if (p.kind === "replaceLiteralAll") {
    const targets = Array.isArray(p.targets) ? p.targets : [];
    const totalOcc = targets.reduce((n, t) => n + Number(t.occurrences || 0), 0);
    const rows = targets.map(t => `
      <div class="assist-comp-row" style="cursor:default">
        <span class="assist-comp-label">Step ${t.stepNo}</span>
        <div class="assist-diff">${assistBuildDiffHtml(t.oldCode, t.newCode)}</div>
      </div>`).join("");
    return { headLabel: "일괄 값 치환",
      body: `<div class="assist-card-reason">'${escapeHtml(String(p.from))}' → '${escapeHtml(String(p.to))}' · ${targets.length}개 단계 ${totalOcc}곳</div>
        <div class="assist-warn">⚠ 여러 단계를 한 번에 바꿉니다. 아래 각 단계 diff 를 확인하세요.</div>
        ${rows}
        <div class="assist-card-note">적용하지 않고 스킬만 바꿉니다. 반영하려면 바뀐 단계 스위치를 한 번 껐다 켜 주세요(끄면 보류됐다가, 켜면 새 코드로 적용).</div>` };
  }
  // 기본: 단일 코드 수정(replaceLiteral / replaceStepCode)
  const warn = (p.touchesNames
    ? `<div class="assist-warn">⚠ 파일명/시트명으로 보이는 문자열을 바꿉니다. 이름이 틀리면 실행이 실패합니다.</div>`
    : "")
    + (p.kind === "replaceLiteral" && Number(p.occurrences) > 1
      ? `<div class="assist-warn">⚠ 같은 문자열이 코드에 ${Number(p.occurrences)}곳 있어 전부 바뀝니다. 아래 diff 로 확인하세요.</div>`
      : "");
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
  return { headLabel: p.kind === "replaceLiteral" ? "값 치환" : "코드 교체",
    body: `${warn}<div class="assist-diff">${assistBuildDiffHtml(p.oldCode, p.newCode)}</div>${companionHtml}
      <div class="assist-card-note">적용하지 않고 스킬만 바꿉니다. 라이브 Excel 은 그대로이며, 반영하려면 나중에 전체실행하세요.</div>` };
}

// [Tier2] 격리 검증 배지 — 실측 결과를 카드 상단에 붙인다(추측 카드와 구분).
function assistVerifyBadgeHtml(v) {
  if (!v || v.verifiable === false) return "";               // 검증 불가(교차파일·스냅샷 없음 등)는 무배지
  if (v.ok) {
    const n = Number(v.changedCount) || 0;
    const ex = (v.sample || []).map(s => String(s.value)).filter(Boolean).slice(0, 6);
    const exHtml = ex.length ? ` 예: ${ex.map(x => escapeHtml(x)).join(", ")}` : "";
    return n > 0
      ? `<div class="assist-verified">✓ 격리에서 검증됨 — ${n.toLocaleString()}칸이 바뀝니다.${escapeHtml(exHtml)}</div>`
      : `<div class="assist-warn">⚠ 격리에서 돌려보니 바뀌는 셀이 0건입니다(조건이 안 맞을 수 있음). 그래도 적용할지 확인하세요.</div>`;
  }
  return `<div class="assist-warn">⚠ 격리 검증 실패: ${escapeHtml(String(v.error || "").slice(0, 120))} — 검증 없이 적용됩니다.</div>`;
}

// 승인 카드 — 여기 버튼을 눌러야만 스킬이 바뀐다.
function assistRenderProposalCard(p) {
  const b = _assistProposalCardBody(p);
  const headScope = p.kind === "replaceLiteralAll" ? "스킬 전체" : `Step ${p.stepNo}`;
  const html = `
    <div class="assist-card" data-pid="${escapeHtml(p.id)}">
      <div class="assist-card-head">${escapeHtml(headScope)} 제안 <span class="assist-card-kind">${escapeHtml(b.headLabel)}</span></div>
      ${p.reason ? `<div class="assist-card-reason">${escapeHtml(p.reason)}</div>` : ""}
      ${assistVerifyBadgeHtml(p.verify)}
      ${b.body}
      <div class="assist-card-actions">
        <button type="button" class="assist-ok">이대로 수정</button>
        <button type="button" class="assist-no">취소</button>
      </div>
    </div>`;
  const el = assistAddMsg("assistant", html, { html: true });
  if (!el) return;
  // [검증 항목8] 실패 시 버튼을 없애면 '카드에서 다시 시도' 안내가 거짓이 된다 — 액션 영역을
  // 재바인딩 가능한 함수로 만들어, 일시 실패 후 [다시 시도] 버튼을 복원한다(제안은 성공 시에만 소거됨).
  const bindActions = (prefixHtml) => {
    const box = el.querySelector(".assist-card-actions");
    if (!box) return;
    box.innerHTML = `${prefixHtml || ""}
      <button type="button" class="assist-ok">${prefixHtml ? "다시 시도" : "이대로 수정"}</button>
      <button type="button" class="assist-no">취소</button>`;
    el.querySelector(".assist-no").onclick = () => {
      box.innerHTML = `<span class="assist-done">취소했습니다.</span>`;
    };
    el.querySelector(".assist-ok").onclick = () => {
      const picked = [...el.querySelectorAll(".assist-comp-cb")]
        .filter(cb => cb.checked).map(cb => Number(cb.dataset.i));
      const r = assistCommitProposal(p.id, picked);
      if (r && r.ok) {
        const c = r.companions || { step: 0, chat: 0 };
        const extra = (c.step || c.chat)
          ? ` · 이름/설명 ${c.step}곳, 대화 ${c.chat}곳 함께 수정`
          : "";
        const msg = r.heldForToggle
          ? `✓ 코드를 교체했습니다. ${r.stepNo ? "Step " + r.stepNo + " " : "해당 단계 "}스위치를 켜(ON) 주시면 새 코드로 적용됩니다`
          : r.toggled
            ? (r.enabled
              ? `✓ Step ${r.stepNo || "?"} 스위치를 켰습니다 — 지금 적용됩니다`
              : `✓ Step ${r.stepNo || "?"} 스위치를 껐습니다 — 그 단계부터 보류되고 Excel 은 직전 상태로 돌아갑니다`)
            : (r.stepNo && typeof r.enabled === "boolean")
              ? `✓ Step ${r.stepNo}은(는) 이미 ${r.enabled ? "켜져" : "꺼져"} 있었습니다 (변경 없음)`
              : r.batch
                ? `✓ ${r.batch}개 단계의 값을 바꿨습니다 — 반영하려면 바뀐 단계 스위치를 껐다 켜 주세요`
                : "✓ 수정했습니다 (라이브 미적용)";
        box.innerHTML = `<span class="assist-done">${escapeHtml(msg)}${escapeHtml(extra)}</span>`;
      } else {
        bindActions(`<span class="assist-fail">✕ ${escapeHtml((r && r.error) || "실패")}</span>`);
      }
    };
  };
  bindActions("");
}

// 줄 단위 diff. [검토 #10] 같은 줄번호끼리 비교하면 줄 하나만 삽입돼도 이후 전체가 어긋난 diff 로
// 보였다(승인 근거 왜곡). 공통 앞/뒤를 걷어낸 '실제 변경 블록'만 보여주고, 잘리면 반드시 표시한다.
function assistBuildDiffHtml(oldCode, newCode) {
  const a = String(oldCode || "").split("\n");
  const b = String(newCode || "").split("\n");
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let endA = a.length, endB = b.length;
  while (endA > pre && endB > pre && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const dels = a.slice(pre, endA);
  const adds = b.slice(pre, endB);
  if (!dels.length && !adds.length) return `<div class="d-none">(줄 단위 차이 없음)</div>`;
  const CAP = 25;
  const rows = [];
  if (pre > 0) rows.push(`<div class="d-ctx">… ${pre + 1}번째 줄부터 변경 …</div>`);
  dels.slice(0, CAP).forEach(x => rows.push(`<div class="d-del">- ${escapeHtml(x.slice(0, 200))}</div>`));
  if (dels.length > CAP) rows.push(`<div class="d-ctx">… 삭제 ${dels.length - CAP}줄 더 있음(반영은 코드 전체 기준) …</div>`);
  adds.slice(0, CAP).forEach(y => rows.push(`<div class="d-add">+ ${escapeHtml(y.slice(0, 200))}</div>`));
  if (adds.length > CAP) rows.push(`<div class="d-ctx">… 추가 ${adds.length - CAP}줄 더 있음(반영은 코드 전체 기준) …</div>`);
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
    _assistMirrorHidden = true;
    const box = document.getElementById("assist-messages");
    if (box && !box.children.length) {
      assistAddMsg("system", "스킬이 뜻대로 안 되거나 무엇을 고쳐야 할지 모를 때 물어보세요. 아래 버튼으로 시작해도 됩니다.");
    }
    setTimeout(() => { const t = document.getElementById("assist-text"); if (t) t.focus(); }, 60);
  } else {
    try { if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(120); } catch (_) {}
    _assistMirrorHidden = false;
    // [검증 R4 대칭] 창을 닫는 것은 곧 중단 — 보이지 않는 인플라이트가 생성기 채팅을 막지 않게.
    if (typeof assistIsBusy === "function" && assistIsBusy() && typeof assistAbortCurrent === "function") {
      assistAbortCurrent();
    }
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
      // [검증 R4] 응답 진행 중 팝업을 닫으면 보이지 않는 인플라이트가 남아 생성기 채팅이 이유도
      // 안 보인 채 수 분간 차단됐다 — 창을 닫는 것은 곧 중단이다.
      if (typeof assistIsBusy === "function" && assistIsBusy() && typeof assistAbortCurrent === "function") {
        assistAbortCurrent();
      }
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
      // [실패 진단 연동] 오류 카드로 열린 경우, 창이 준비되면 보관해둔 질문을 자동 전송한다.
      if (_assistPendingAsk) {
        const q = _assistPendingAsk; _assistPendingAsk = null;
        assistSendToPopup({ t: "ask", text: q });
      }
      break;
    case "user":
      // done 신호는 '인플라이트 슬롯을 잡은 호출'의 모든 종료에서 팝업 busy(중지 버튼)를 원복한다.
      // [검증 R6] 조기 거절(반환값 false — 이미 처리 중일 때의 중복 전송 등)에는 done 을 보내지
      // 않는다: 보내면 '먼저 돌던' 요청의 중지 버튼이 진행 중에 풀려 버린다.
      Promise.resolve(assistHandleUserMessage(String(m.text || ""), {
        onStatus: (s) => assistSendToPopup({ t: "status", s }),
        onAssistantText: (t) => assistSendToPopup({ t: "assistant", text: t }),
        onToolTrace: (name, result) => assistSendToPopup({ t: "trace", name, ok: !(result && result.ok === false) }),
        onProposal: (p) => assistSendToPopup({ t: "proposal", proposal: p }),
        onReport: (meta) => assistSendToPopup({ t: "report", meta }),
        onHandoff: (meta) => assistSendToPopup({ t: "handoff", meta }),
      }, (Array.isArray(m.images) && m.images.length ? m.images : null))).then(
        (res) => { if (res !== false) assistSendToPopup({ t: "done" }); },
        () => assistSendToPopup({ t: "done" })
      );
      break;
    case "handoff-go":
      // [Tier1] 팝업 핸드오프 카드 → 메인 창의 설계 채팅 입력창에 요청문을 넣고 전환(사용자가 검토·전송).
      try {
        const ta = document.getElementById("chat-text");
        if (ta) ta.value = String(m.request || "");
        if (typeof setPage === "function") setPage("generator");
        if (ta) ta.focus();
        assistSendToPopup({ t: "handoff-done", ok: true });
      } catch (_) {
        assistSendToPopup({ t: "handoff-done", ok: false });
      }
      break;
    case "commit": {
      // [검증 항목8] 커밋 도중 예외가 나도 commit-result 는 반드시 보낸다 — 안 보내면 팝업 카드가
      // '반영 중...' 으로 영구 고착된다(브리지 바깥 catch 가 예외를 삼킴).
      let r = null;
      try {
        r = assistCommitProposal(m.pid, Array.isArray(m.picked) ? m.picked : []);
      } catch (err) {
        r = { ok: false, error: String((err && err.message) || err).slice(0, 200) };
      }
      assistSendToPopup({
        t: "commit-result", pid: m.pid,
        ok: !!(r && r.ok), error: (r && r.error) || "",
        companions: (r && r.companions) || null,
        heldForToggle: !!(r && r.heldForToggle),
        toggled: !!(r && r.toggled),
        enabled: (r && typeof r.enabled === "boolean") ? r.enabled : null,
        stepNo: (r && r.stepNo) || null,
        batch: (r && r.batch) || 0,
      });
      break;
    }
    case "stop":
      // [검토 #1] 팝업의 중지 버튼 — 진행 중인 라운드 루프를 abort 한다.
      if (typeof assistAbortCurrent === "function") assistAbortCurrent();
      break;
    case "clear":
      // [검토 #17] 진행 중 비우면 늦게 온 assistant 가 빈 대화 앞에 고아로 붙는다 — 먼저 중단.
      if (typeof assistIsBusy === "function" && assistIsBusy() && typeof assistAbortCurrent === "function") {
        assistAbortCurrent();
      }
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

// [실패 진단 연동] 오류 카드의 'AI 도움에게 진단 요청' 버튼이 부른다 — AI 도움을 열고 질문을 자동 전송.
// DOM/네이티브 팝업 모두 대응. 네이티브는 창이 뜬 뒤('ready') 전송하도록 질문을 잠깐 보관한다.
let _assistPendingAsk = null;
function assistOpenAndAsk(question) {
  const q = String(question || "").trim();
  if (!q) return;
  try {
    if (assistNativeShellAvailable()) {
      assistEnsureNativeBridge();
      if (_assistNativeMode) { assistSendToPopup({ t: "ask", text: q }); return; }  // 이미 열림 → 즉시
      _assistPendingAsk = q;                                    // 열린 뒤 ready 에서 전송
      assistPostToHost("B2B_ASSIST_POPUP\ttoggle");             // 닫힘 상태 → 토글=열기
      clearTimeout(_assistNativeAckTimer);
      _assistNativeAckTimer = setTimeout(() => {                // 구버전 exe 무응답 → DOM 폴백
        // [중단 버그 수정] 파이프라인 오류 처리 중엔 메인이 바빠 팝업 브리지 응답이 1.2초를 넘겨,
        // 폴백 드로어가 먼저 질문을 제출한 뒤 팝업이 늦게 열려 상태가 꼬였다(사용자 재클릭→abort).
        // 네이티브 창이 뜰 시간을 넉넉히 준다(진짜 구버전 exe 만 폴백).
        if (!_assistNativeMode) {
          const pend = _assistPendingAsk; _assistPendingAsk = null;
          assistToggleDrawer(true);
          if (pend) assistSubmit(pend);
        }
      }, 3000);
      return;
    }
    assistToggleDrawer(true);
    assistSubmit(q);
  } catch (_) {}
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
            if (!_assistNativeMode) assistToggleDrawer();   // 구버전 exe 폴백(창 뜰 시간 넉넉히)
          }, 3000);
        }
        return;
      }
      assistToggleDrawer();                                  // 브라우저 모드: DOM 팝업
    };
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();

// [0.7.1 단축키] F10 = 화면 녹화 시작/정지 토글(btn-excel-record)   F11 = AI 도움 토글(btn-ai-help)
//   녹화 버튼은 UI 에서 숨김 유지(index.html hidden). AI 도움 버튼은 [사용자 요청 2026-07-31] 다시
//   노출 — 헤더의 [✦ AI 도움] 버튼과 F11 둘 다 동작한다(같은 onclick 재사용).
// 숨긴 버튼의 기존 onclick 을 그대로 재사용한다(.click()) — 로직 중복/분기 없음(display:none 버튼도
// click() 은 정상 발화). 녹화 버튼이 전환 중(disabled)이면 무시해 상태 꼬임을 막는다.
// F11 은 브라우저/WebView 기본 전체화면이라 preventDefault 로 가로챈다. 입력칸 포커스 중에도
// F10/F11 은 기능키라 텍스트 입력과 충돌하지 않으므로 그대로 처리한다(키 반복은 1회로 제한).
(function bindHiddenButtonHotkeys() {
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key === "F10") {
      e.preventDefault();
      const b = document.getElementById("btn-excel-record");
      if (b && !b.disabled) b.click();
    } else if (e.key === "F11") {
      e.preventDefault();
      const b = document.getElementById("btn-ai-help");
      if (b) b.click();
    }
  }, true);   // capture 단계 — 앱/WebView 기본 동작(F11 전체화면)보다 먼저 가로챈다
})();
