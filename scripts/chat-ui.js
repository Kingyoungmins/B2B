/* ===================================================================
   CHAT UI
   =================================================================== */
function refreshChatState() {
  const ready = state.output !== null || state.inputs.length > 0;
  const panel = $("panel-chat");
  panel.classList.toggle("disabled", !ready);
  $("chat-send").disabled = !ready;
  if (ready && $("chat-messages").children.length === 1 &&
      $("chat-messages").children[0].classList.contains("system") &&
      !$("chat-messages").children[0].classList.contains("cleared-marker")) {
    $("chat-messages").innerHTML = "";
    const targetLabel = state.output
      ? `출력 템플릿 "${state.output.name}" 이 로드되었습니다.`
      : `입력 파일 ${state.inputs.length}개가 로드되었습니다.`;
    addMessage("system", `${targetLabel} 입력/출력 파일을 함께 수정하는 스킬을 만들어보세요.`);
  }
  renderEditingBanner();
  refreshRunButton();
}

function renderEditingBanner() {
  const inputRow = document.querySelector("#panel-chat .chat-input-row");
  if (!inputRow) return;
  let banner = document.getElementById("chat-edit-banner");
  const idx = state.editingStepId
    ? state.pipeline.findIndex(s => s.id === state.editingStepId)
    : -1;
  if (idx < 0) {
    if (banner) banner.remove();
    const ta = $("chat-text");
    if (ta) ta.classList.remove("editing");
    return;
  }
  const step = state.pipeline[idx];
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "chat-edit-banner";
    banner.className = "chat-edit-banner";
    inputRow.parentNode.insertBefore(banner, inputRow);
  }
  banner.innerHTML = `
    <span class="edit-ico">✎</span>
    <span class="edit-text"><b>Step ${idx + 1}</b> 수정 중 — ${escapeHtml(step.description)}</span>
    <button class="edit-cancel" type="button" title="수정 모드 해제">해제</button>
  `;
  banner.querySelector(".edit-cancel").onclick = () => {
    if (typeof toggleEditStep === "function") toggleEditStep(state.editingStepId);
  };
  // [사용자 제보 2026-08-21] 한 단계 수정을 끝내고 [해제]를 깜빡한 채 다음 단계를 이어 쓰면,
  // 그 입력이 '다음 단계 만들기'가 아니라 '방금 그 단계 또 고치기'로 들어가 버린다.
  // 수정 적용 직후에는 배너를 눈에 띄게 만들어(해제를 강조) 실수를 줄인다.
  if (window.__b2bEditJustApplied) {
    banner.classList.add("just-applied");
    const _b = banner;
    setTimeout(() => { try { _b.classList.remove("just-applied"); } catch (_) {} }, 12000);
    window.__b2bEditJustApplied = false;
  }
  const ta = $("chat-text");
  if (ta) ta.classList.add("editing");
}

function addMessage(role, text, opts) {
  const container = $("chat-messages");
  const div = document.createElement("div");
  div.className = "msg " + role;
  if (opts && opts.html) {
    div.innerHTML = text;
  } else {
    div.textContent = text;
  }
  container.appendChild(div);
  // 사용자가 방금 보낸 메시지는 항상 맨 아래로(자기 행동), 그 외(어시스턴트/시스템)는 stick 상태 존중.
  scrollChatToBottom({ force: role === "user" });
  return div;
}

// 사용자가 위로 스크롤해 이전 내용을 읽는 중이면 스트리밍 delta 가 화면을 끌어내리지 않도록
// "맨 아래 근처일 때만 자동 스크롤"(stick-to-bottom) 한다.
let _chatAutoStick = true;
function _isChatNearBottom(container, threshold) {
  threshold = (threshold == null) ? 80 : threshold;
  return (container.scrollHeight - container.scrollTop - container.clientHeight) <= threshold;
}
function _ensureChatScrollWatcher() {
  const container = $("chat-messages");
  if (!container || container._b2bScrollWatch) return;
  container._b2bScrollWatch = true;
  // 사용자/프로그램 스크롤 후의 위치로 stick 여부를 갱신. 맨 아래면 따라가고, 위로 올리면 멈춘다.
  container.addEventListener("scroll", () => {
    _chatAutoStick = _isChatNearBottom(container);
  }, { passive: true });
}
function scrollChatToBottom(opts) {
  const container = $("chat-messages");
  if (!container) return;
  _ensureChatScrollWatcher();
  const force = !!(opts && opts.force);
  if (!force && !_chatAutoStick) return;   // 위로 스크롤해 읽는 중이면 자동 스크롤 보류
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      _chatAutoStick = true;
    });
  });
}

// ---- [스킬 수정 → 원 요청으로 스크롤] ----
// 스텝 수정 모드에 들어갈 때, 그 스텝을 만든 '사용자 요청' 말풍선으로 채팅을 스크롤하고 잠깐 강조한다.
// 매칭 근거: 저장/복원되는 step.prompt(사용자 요청) 를 화면의 user 말풍선 텍스트와 비교(정규화).
function _chatNormForMatch(s) {
  return String(s || "")
    .replace(/\[정확\s*참조\][\s\S]*$/, "")        // 자동 첨부된 정확참조 블록 제거
    .replace(/\[사용자\s*보충\s*설명\]/g, " ")
    .replace(/\[규칙\s*수정\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}
function _chatMatchScore(stepText, msgText) {
  const a = _chatNormForMatch(stepText), b = _chatNormForMatch(msgText);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  if (typeof similarity === "function") return similarity(a, b) * 0.85;
  return 0;
}
function _chatMsgPlainText(div) {
  // × 삭제버튼 등 자식 요소 텍스트는 제외하고 말풍선 본문만.
  let t = "";
  div.childNodes.forEach(n => {
    if (n.nodeType === 3) t += n.textContent;
    else if (n.nodeType === 1 && !n.classList.contains("msg-del")) t += n.textContent;
  });
  return (t || div.textContent || "").replace(/×\s*$/, "").trim();
}
function _flashChatMessage(div) {
  if (!div) return;
  try { div.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) { div.scrollIntoView(); }
  _chatAutoStick = false;                 // 위로 올라간 상태 유지(스트리밍 없을 때라 안전)
  div.classList.remove("chat-flash");
  void div.offsetWidth;                    // 리플로우로 애니메이션 재시작
  div.classList.add("chat-flash");
  setTimeout(() => div.classList.remove("chat-flash"), 2000);
}
function _normCodeForMatch(s) {
  // 헤더 주석/공백 차이를 흡수해 스텝 코드와 말풍선 코드블록을 비교하기 위한 정규화.
  return String(s || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}
// [순수 코어] 스텝을 채팅 엔트리(display 순서 [{role, text, code}])에 매칭 → 스크롤할 엔트리 인덱스.
// 다단계 폴백(예전 저장 스킬은 prompt 없고 코드가 대화에 없을 수 있어 순서 폴백까지 둔다):
//   1) 코드 매칭(그 스텝 코드를 담은 assistant → 바로 앞 user)
//   2) prompt(사용자 요청) 텍스트 매칭
//   3) description(제네릭 아님) 을 assistant 제목과 매칭
//   4) 순서 폴백: stepIdx 번째 '코드 있는 assistant' 의 앞 user
// 자동 생성된 '재생성/복구' 프롬프트(사용자 실제 요청 아님)인지 — 이런 말풍선으로 이동하면 혼란스럽다.
function _isSyntheticRequest(text) {
  const s = String(text || "");
  return /정적\s*안전\s*검사|안전\s*검사에서\s*막|방금\s*생성한|##\s*실패한\s*코드|##\s*상세\s*오류|##\s*막힌\s*코드|원래\s*사용자\s*요청|Python\s*스킬이\s*정적|VBA\s*로\s*전환|안전\s*재생성|실행\s*중\s*오류가\s*발생|Python\s*(?:→|->)\s*VBA/i.test(s);
}
// [번호표 연결] 스텝 생성 시점에 '그 요청 말풍선'의 histId 를 찾아 스텝에 박는다.
// 생성 직후엔 방금 push 된 내용과 정확히 일치하므로 뒤에서부터 exact 매칭이 결정적이다.
function originHistIdForPrompt(promptText) {
  const want = String(promptText || "");
  if (!want.trim()) return null;
  const hist = state.chatHistory || [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const e = hist[i];
    if (e && e.role === "user" && e.histId && String(e.content) === want) return e.histId;
  }
  return null;
}

/* [SBAGENT-289] 수정 요청의 말풍선 찾기 — 완전 일치만으로는 실패한다.
   실측: step4 를 두 번 수정("*10", "*100")했는데 originHistId 가 최초 "*5" 그대로였다.
   chatHistory 의 content 에는 [정확 참조] 블록이 붙고 sourceUserMessage 와 어긋날 수 있어
   완전 일치(originHistIdForPrompt)가 조용히 null 을 돌려주고 갱신이 빠진 것.
   → 최신 것부터 ① 완전 일치 ② 접두 일치(블록 부착/제거 차이 흡수) ③ 마지막 user 항목
   (수정 적용 버튼은 '방금 보낸 요청'의 응답에 붙으므로 마지막 user 가 곧 그 요청이다). */
function originHistIdForPromptLoose(promptText) {
  const want = String(promptText || "").trim();
  const hist = state.chatHistory || [];
  // [코드리뷰 2026-08-24] 빈 프롬프트(replyContext 유실)는 매칭하지 않는다 — '마지막 user'
  // 폴백까지 흘러가면 근거 없이 최신 말풍선을 스탬프해, 이 기능이 없애려던 '남의 말풍선
  // 잡기'가 방향만 바뀌어 재현된다. 근거가 없으면 갱신 안 함(기존 번호표 유지)이 정직하다.
  if (!want) return { histId: null, via: "none" };
  {
    const exact = originHistIdForPrompt(promptText);
    if (exact) return { histId: exact, via: "exact" };
    for (let i = hist.length - 1; i >= 0; i--) {
      const e = hist[i];
      if (!e || e.role !== "user" || !e.histId) continue;
      const c = String(e.content || "").trim();
      if (c && (c.startsWith(want) || want.startsWith(c))) return { histId: e.histId, via: "prefix" };
    }
  }
  for (let i = hist.length - 1; i >= 0; i--) {
    const e = hist[i];
    if (e && e.role === "user" && e.histId) return { histId: e.histId, via: "last" };
  }
  return { histId: null, via: "none" };
}

// 대화 없이 태어난 스텝(복붙 캡처·수동 셀편집)인가 — 이런 스텝은 텍스트 매칭을 시도하는 것
// 자체가 오매핑의 원인이다(빈 prompt 가 순서 폴백까지 흘러 남의 말풍선을 잡았다 — 실측).
function stepChatOriginless(step) {
  const pr = String((step && step.prompt) || "").trim();
  if (!pr || pr === "manual cell edit") return true;
  if (/\[복붙 캡처\]/.test(String((step && step.code) || ""))) return true;
  return false;
}

function _matchStepToChatIndex(step, entries, stepIdx) {
  if (!step || !Array.isArray(entries) || !entries.length) return -1;
  // 코드 말풍선 앞의 '진짜' 사용자 요청을 찾는다. 자동 재생성/복구 프롬프트는 건너뛰고 더 앞으로.
  const nearestUserBefore = (i) => {
    let firstUser = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (entries[j].role !== "user") continue;
      if (firstUser < 0) firstUser = j;
      if (!_isSyntheticRequest(entries[j].text)) return j;
    }
    return firstUser >= 0 ? firstUser : i;   // 전부 자동 프롬프트면 그나마 가까운 user
  };
  const wc = _normCodeForMatch(step.code);
  if (wc && wc.length >= 20) {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].role !== "assistant") continue;
      const c = _normCodeForMatch(entries[i].code || "");
      if (c && (c === wc || c.includes(wc) || wc.includes(c))) return nearestUserBefore(i);
    }
  }
  const want = step.prompt || "";
  if (_chatNormForMatch(want)) {
    let best = -1, bestScore = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].role !== "user" || _isSyntheticRequest(entries[i].text)) continue;
      const sc = _chatMatchScore(want, entries[i].text || "");
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    if (best >= 0 && bestScore >= 0.5) return best;
  }
  const desc = _chatNormForMatch(step.description || "");
  if (desc && desc !== "스킬 생성" && desc !== "스킬 수정" && desc.length >= 4) {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].role !== "assistant") continue;
      const t = _chatNormForMatch(entries[i].text || "");
      if (t && t.includes(desc)) return nearestUserBefore(i);
    }
  }
  if (typeof stepIdx === "number" && stepIdx >= 0) {
    let count = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].role === "assistant" && _normCodeForMatch(entries[i].code || "")) {
        if (++count === stepIdx) return nearestUserBefore(i);
      }
    }
  }
  return -1;
}
// [말풍선 표시 정리] 저장된 대화를 다시 그릴 때, 내부 프롬프트 스캐폴딩은 감추고 '사용자가 직접 친 부분'만
// 보여준다(프롬프트/히스토리 원문은 그대로 유지 — 표시만 정리). 반환이 빈 문자열이면 그 말풍선은 숨긴다.
//  - 자동 재생성/에러복구 프롬프트(Step N 실행 중 오류 / ## 실패한 코드·상세 오류·스택 / 정적 안전 검사 /
//    방금 생성한 / Python→VBA): 사용자가 적은 '추가 설명' 메모만 남기고 나머지는 감춘다(메모 없으면 숨김).
//  - 일반 요청: 자동 첨부되는 [정확 참조]…[정확 참조 사용 규칙 - 강제] 블록과 [규칙 수정]/[사용자 보충 설명]
//    래퍼 라벨을 제거하고, 사용자가 실제로 친 요청만 남긴다.
function cleanChatDisplayText(content) {
  let s = String(content || "");
  const isRecovery = /Step\s+\d+\s+실행\s*중\s*오류|##\s*실패한\s*(?:Step|코드)|##\s*상세\s*오류|정적\s*안전\s*검사|안전\s*검사에서\s*막|방금\s*생성한|Python\s*스킬이\s*정적|Python\s*(?:→|->)\s*VBA/i.test(s);
  if (isRecovery) {
    const m = /##\s*★?\s*사용자\s*추가\s*설명[^\n]*\n(?:[^\n]*\n)?([\s\S]*?)(?=\n\s*(?:##|Step\s+\d+\s+실행)|$)/.exec(s);
    return m ? m[1].trim() : "";               // 사용자 메모만, 없으면 숨김
  }
  s = s.replace(/\n*\[정확\s*참조\][\s\S]*$/i, "");   // 자동 첨부 참조/강제규칙 블록 제거
  s = s.replace(/^\s*\[규칙\s*수정\]\s*/i, "");        // 래퍼 라벨 제거(내용은 유지)
  s = s.replace(/\[사용자\s*보충\s*설명\]\s*/gi, "");
  return s.trim();
}
// 스텝의 원 요청 말풍선을 찾아 스크롤+강조. 못 찾으면 false.
function scrollChatToStepRequest(step) {
  try {
    const container = $("chat-messages");
    if (!container || !step) return false;
    const msgs = Array.from(container.querySelectorAll(".msg"));
    // 0단: 번호표(originHistId) — 텍스트를 보지 않고 정확히 그 말풍선으로.
    if (step.originHistId) {
      const hit = msgs.find(d => d.dataset && d.dataset.histId === String(step.originHistId));
      if (hit) { _flashChatMessage(hit); return true; }
      // 번호표는 있는데 말풍선이 없다(삭제/비우기) — 텍스트 폴백으로 '다른' 말풍선을 잡으면
      // 그게 바로 오매핑이다. 여기서 정직하게 멈춘다.
      if (typeof toast === "function") toast("이 단계를 만든 대화가 삭제되었거나 비워져 찾을 수 없습니다.", "info");
      return false;
    }
    // 출처 없는 스텝(복붙 캡처·수동 편집): 매칭 시도 자체가 오매핑의 원인 — 안내만 하고 끝.
    if (stepChatOriginless(step)) {
      if (typeof toast === "function") toast("이 단계는 복붙 캡처 등으로 만들어져 연결된 대화가 없습니다. 수정 내용을 채팅에 입력하세요.", "info");
      return false;
    }
    const entries = msgs.map(div => {
      const role = div.classList.contains("user") ? "user"
        : div.classList.contains("assistant") ? "assistant" : "system";
      const pre = div.querySelector("pre.code-block, pre, code");
      return { role, text: _chatMsgPlainText(div), code: pre ? pre.textContent : "" };
    });
    const stepIdx = (state.pipeline || []).findIndex(s => s && s.id === step.id);
    const idx = _matchStepToChatIndex(step, entries, stepIdx);
    if (idx >= 0 && msgs[idx]) { _flashChatMessage(msgs[idx]); return true; }
  } catch (_) {}
  return false;
}

// ---- 대화 기억(히스토리) 삭제 ----
// 잘못된 턴이 히스토리에 남아 다음 생성을 오염시키는 문제("기존작업 잔존")의 UI 해소책.
// llm-api 가 push 시 histId 를 붙이고, 여기서 메시지 말풍선과 연결해 × 버튼으로 제거한다.
const _boundChatHistIds = new Set();

function bindChatHistoryEntryToMessage(div, role, content) {
  try {
    if (!div || !content) return;
    const history = state.chatHistory || [];
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (entry && entry.role === role && entry.content === content &&
          entry.histId && !_boundChatHistIds.has(entry.histId)) {
        _boundChatHistIds.add(entry.histId);
        div.dataset.histId = entry.histId;   // [번호표 연결] 수정 버튼 → 원 요청 스크롤이 ID 로 찾는다
        attachChatMessageDeleteButton(div, entry.histId);
        return;
      }
    }
  } catch (_) {}
}

function attachChatMessageDeleteButton(div, histId) {
  if (!div || !histId || div.querySelector(".msg-del")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "msg-del";
  btn.title = "이 메시지를 대화 기억에서 삭제 (이후 생성에 반영되지 않음. 적용된 스킬은 유지)";
  btn.textContent = "×";
  btn.onclick = (e) => {
    e.stopPropagation();
    const idx = (state.chatHistory || []).findIndex(en => en && en.histId === histId);
    if (idx >= 0) state.chatHistory.splice(idx, 1);
    div.remove();
    if (typeof toast === "function") toast("대화 기억에서 삭제했습니다. 이후 요청에 반영되지 않습니다.", "success");
  };
  div.appendChild(btn);
}

function scrollReasoningToBottom(el) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}

function clearViewerDragSelection() {
  state.selectedCell = null;
  state.selectedRange = null;
  state.selectedRanges = [];
  state.selectionAnchor = null;
  document.querySelectorAll(".selected-cell,.selected-range").forEach(el => {
    el.classList.remove("selected-cell", "selected-range");
  });
}

function setActionButtonPending(button, pendingText) {
  if (!button) return;
  button.textContent = pendingText || "\uC791\uC5C5 \uC911...";
  button.classList.add("pending");
}

function finalizeActionButtonFromResult(button, result, doneText, onFailure, options = {}) {
  if (!button) return;
  if (result && result.pending && result.promise) {
    setActionButtonPending(button);
    let cancelBtn = null;
    const actions = options.actions || button.parentElement;
    if (typeof result.cancel === "function" && actions) {
      cancelBtn = document.createElement("button");
      cancelBtn.className = "action-btn danger apply-cancel";
      cancelBtn.type = "button";
      cancelBtn.textContent = "■ 작업 중단";
      cancelBtn.onclick = () => {
        cancelBtn.disabled = true;
        cancelBtn.textContent = "중단 중...";
        Promise.resolve(result.cancel()).catch(() => {});
      };
      actions.appendChild(cancelBtn);
    }
    const cleanupCancelButton = () => {
      if (cancelBtn && cancelBtn.parentElement) cancelBtn.remove();
    };
    result.promise
      .then((value) => {
        cleanupCancelButton();
        if (value && value.cancelled) {
          button.textContent = "\uC911\uB2E8\uB428";
          button.classList.remove("pending");
          button.classList.add("error");
          return;
        }
        if (value === false) {
          // [\uC218\uC815 \uBBF8\uBC18\uC601 \uC218\uC815] '\uC870\uC6A9\uD55C \uBB34\uC2E4\uD589'(\uCCB4\uD06C\uD3EC\uC778\uD2B8 \uBCF5\uC6D0 \uC2E4\uD328 \uB4F1)\uC774 false \uB85C \uB3CC\uC544\uC624\uB294\uB370
          // \uC774\uB97C \uC131\uACF5\uCC98\uB7FC '\u2713 \uC801\uC6A9\uB428'\uC73C\uB85C \uCE60\uD558\uBA74, \uC218\uC815\uC774 \uBC18\uC601 \uC548 \uB41C \uC0B0\uCD9C\uBB3C\uC774 \uADF8\uB300\uB85C \uB098\uAC04\uB2E4(\uC2E4\uCE21).
          button.textContent = "\uC801\uC6A9 \uC2E4\uD328";
          button.classList.remove("pending");
          button.classList.add("error");
          if (typeof onFailure === "function") onFailure();
          return;
        }
        // [\uBCF4\uB958=OFF \uBAA8\uB378] \uC218\uC815\uC740 \uC0C8 \uCF54\uB4DC\uB97C \uC801\uC6A9\uD558\uC9C0 \uC54A\uACE0 \uBCF4\uB958(\uAEBC\uC9D0)\uB85C \uC800\uC7A5\uD55C\uB2E4 \u2014 '\uC801\uC6A9\uB428'\uC73C\uB85C
        // \uCE60\uD558\uBA74 \uB77C\uC774\uBE0C \uBC18\uC601\uC73C\uB85C \uC624\uD574\uD55C\uB2E4. held \uACB0\uACFC\uB294 \uBCF4\uB958 \uC800\uC7A5\uC73C\uB85C \uC815\uC9C1\uD558\uAC8C \uD45C\uC2DC.
        button.textContent = (result && result.held) ? "\u2713 \uC800\uC7A5\uB428 \u2014 \uBCF4\uB958(\uAEBC\uC9D0)" : (doneText || "\u2713 \uC801\uC6A9\uB428");
        button.classList.remove("pending");
      })
      .catch(() => {
        cleanupCancelButton();
        button.textContent = "\uC801\uC6A9 \uC2E4\uD328";
        button.classList.remove("pending");
        button.classList.add("error");
        if (typeof onFailure === "function") onFailure();
      });
    return;
  }
  if (result && result.error) {
    button.textContent = "\uC801\uC6A9 \uC2E4\uD328";
    button.classList.add("error");
    if (typeof onFailure === "function") onFailure();
    return;
  }
  // [\uBCF4\uB958=OFF \uBAA8\uB378] \uC717 \uB2E8\uACC4 OFF \uB85C \uBCF4\uB958 \uCD94\uAC00/\uC800\uC7A5\uB41C \uACBD\uC6B0 \u2014 \uC801\uC6A9\uB41C \uAC8C \uC544\uB2D8\uC744 \uC815\uC9C1\uD558\uAC8C \uD45C\uC2DC.
  button.textContent = (result && result.held) ? "\u2713 \uC800\uC7A5\uB428 \u2014 \uBCF4\uB958(\uAEBC\uC9D0)" : (doneText || "\u2713 \uC801\uC6A9\uB428");
}

function restoreActionButtonsAfterFailure(buttons, primaryButton, retryText) {
  (buttons || []).forEach(btn => {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove("pending", "error");
  });
  if (primaryButton) primaryButton.textContent = retryText || "\uC7AC\uC2DC\uB3C4";
}

function userExplicitlyRequestsFormulaOverwrite(text) {
  const t = String(text || "");
  return /수식\s*(제거|삭제|지워|없애|값으로|대체|덮어)|기존\s*수식.*(제거|삭제|지워|없애|값)|formula\s*(remove|delete|overwrite|replace)|값으로\s*(덮어|대체|바꿔)/i.test(t)
    || /(?:값\s*만|값만|보이는\s*값|계산(?:된)?\s*값|paste\s*values?|values?\s*only|copy\s*values?)/i.test(t)
    || /값(?:만)?\s*(?:을|를)?\s*(?:복사|붙여\s*넣|붙여넣|입력|기입|채워|반영)|(?:복사|붙여\s*넣|붙여넣)\s*.*값(?:만)?/i.test(t)
    || /값\s*으로\s*(?:붙여\s*넣|붙여넣|덮어|대체|바꿔|입력|기입|채워)/i.test(t);
}

function codeMentionsFormulaOverwrite(code) {
  return /수식\s*(제거|삭제|지워|없애)|수식을?\s*값으로|값으로\s*덮어쓰기|formula\s*(remove|delete|overwrite|replace)/i.test(String(code || ""));
}

function userExplicitlyRequestsVba(text) {
  const t = String(text || "");
  return /(?:^|[^\w])vba(?:[^\w]|$)|vba\s*(?:로|모드|버전|코드|작성|짜|해|써)|매크로|Sub\s+B2BSkill\s*\(/i.test(t);
}

// 사용자가 'python/파이썬/COM 으로 짜줘' 처럼 엔진을 명시했는지. [사용자 지시] 이 의도는
// VBA 기본값/휴리스틱보다 최우선 — 채팅·에러복구창 양쪽에서 python 으로 생성하게 한다.
// (실패하면 복구가 어차피 VBA 로 되돌리므로 안전망은 유지됨.)
function userExplicitlyRequestsPython(text) {
  const t = String(text || "");
  return /(?:^|[^\w])python(?:[^\w]|$)|python\s*(?:으|로|모드|버전|코드|작성|짜|해|써)|파이썬|(?:^|[^\w])py\s*(?:으로|로)|(?:^|[^\w])com\s*(?:으로|로)|def\s+transform\s*\(/i.test(t);
}

function exactSheetNamesFromMentions(text) {
  const source = String(text || "");
  const names = new Set();
  const mentionRe = /@(?:범위|컬럼|시트)\[([^\]]+)\]/g;
  let m;
  while ((m = mentionRe.exec(source)) !== null) {
    const body = String(m[1] || "").trim();
    if (!body) continue;
    let sheet = "";
    const bang = body.lastIndexOf("!");
    if (bang >= 0) {
      const left = body.slice(0, bang);
      sheet = left.slice(left.lastIndexOf("/") + 1);
    } else {
      const fileSep = body.search(/\.(?:xlsx|xlsm|xlsb|xls|csv)\//i);
      if (fileSep >= 0) {
        const afterFile = body.slice(fileSep).replace(/^\.(?:xlsx|xlsm|xlsb|xls|csv)\//i, "");
        sheet = afterFile.split("/")[0] || "";
      }
    }
    sheet = sheet.replace(/^'|'$/g, "").trim();
    if (sheet) names.add(sheet);
  }
  return [...names];
}

function exactSheetNameReminder(text) {
  const sheets = exactSheetNamesFromMentions(text);
  if (!sheets.length) return "";
  return [
    `정확 시트명(절대 변경 금지): ${sheets.map(s => `"${s}"`).join(", ")}`,
    "위 시트명은 코드에 그대로 복사하세요. 번역/영문화/띄어쓰기 보정 금지.",
    `"2026년"은 "2026 년"이 아니며, "통합인터넷(국제)"는 "통합internet(국제)"가 아닙니다.`,
  ].join(" ");
}

/* [제보 2026-08-25] "j1 셀은 전산화번호, k1셀은 전주번호 입력" → 모델이 자꾸 '전자화번호'로
   코딩(한 글자 오타 복사). 사용자가 문장에 쓴 한글 토큰과 '한 글자만 다른' 리터럴이 코드에
   있으면 적용 전에 잡아 자동 재생성으로 보낸다.
   오탐 가드: ① 다른 글자가 '한글'일 때만(숫자/영문 차이는 연도·월·코드값처럼 정상 변형이
   흔하다 — 26년7월_raw vs 26년8월_raw) ② 사용자 문장에 코드 리터럴 자체도 있으면(둘 다
   언급) 통과 ③ 토큰 길이 4자 이상만. */
function hangulLiteralTypoFailures(code, sourceUserMessage) {
  const failures = [];
  const source = String(sourceUserMessage || "");
  const text = String(code || "");
  if (!source || !text) return failures;
  const isHangul = (ch) => /[가-힣]/.test(ch || "");
  // 한 글자 차이(같은 길이 치환 1 / 길이±1 삽입·삭제 1)인지 + 그 차이가 한글인지.
  const oneHangulEdit = (a, b) => {
    if (a === b) return false;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la === lb) {
      let diff = 0, at = -1;
      for (let i = 0; i < la; i++) if (a[i] !== b[i]) { diff++; at = i; if (diff > 1) return false; }
      return diff === 1 && isHangul(a[at]) && isHangul(b[at]);
    }
    const [s, l] = la < lb ? [a, b] : [b, a];   // s=짧은 쪽
    let i = 0;
    while (i < s.length && s[i] === l[i]) i++;
    if (s.slice(i) !== l.slice(i + 1)) return false;
    return isHangul(l[i]);
  };
  const userTokens = Array.from(new Set((source.match(/[가-힣0-9A-Za-z_]{4,}/g) || [])));
  const codeLiterals = Array.from(new Set(
    Array.from(text.matchAll(/["']([^"'\n]{4,60})["']/g)).map(m => m[1]),
  ));
  for (const lit of codeLiterals) {
    if (source.includes(lit)) continue;         // 사용자도 쓴 표현 — 정상
    for (const tok of userTokens) {
      // 올바른 토큰이 코드에 '함께' 있으면 lit 는 실제 파일의 다른(비슷한) 열일 수 있다
      // (예: 전산화번호·전자화번호 열이 둘 다 실재) — 오타 확정은 '올바른 표기가 코드에 없을 때'만.
      if (text.includes(tok)) continue;
      if (oneHangulEdit(lit, tok)) {
        failures.push(
          `사용자가 쓴 '${tok}' 와 한 글자 다른 '${lit}' 가 코드에 있습니다 — 오타 복사로 보입니다. `
          + `사용자 문장의 표기('${tok}')를 글자 그대로 쓰세요(임의 교정 금지).`,
        );
        break;
      }
    }
  }
  return failures;
}

function exactReferenceFailures(code, sourceUserMessage) {
  const failures = [];
  const source = String(sourceUserMessage || "");
  const text = String(code || "");
  if (!/@(?:범위|컬럼|시트)\[/.test(source)) return failures;
  // 공백/_/- 만 다른 경우(모델이 한글 식별자에 공백을 끼우는 흔한 케이스, 예: "2026년"→"2026 년")는 통과.
  // Python 런타임은 normalize_sheet_lookup 으로 정규화 매칭하고, VBA 는 vbaExactSheetReferenceFailures 가
  // 별도로 정확(띄어쓰기 보정 없이) 검사하므로 이 완화가 VBA 정확성을 해치지 않는다.
  const norm = (v) => String(v || "").toLowerCase().replace(/[\s_\-]+/g, "");
  const normCode = norm(text);
  for (const sheetName of exactSheetNamesFromMentions(source)) {
    if (text.includes(sheetName)) continue;
    if (normCode.includes(norm(sheetName))) continue;
    failures.push(`요청의 정확한 시트명 "${sheetName}" 이 코드에 그대로 들어 있지 않습니다. @범위/@컬럼의 시트명은 번역하거나 영문화하지 말고 한 글자도 바꾸지 마세요.`);
  }
  return failures;
}

function vbaSheetReferenceLiterals(code) {
  const text = typeof _stripVbaCommentsForGate === "function"
    ? _stripVbaCommentsForGate(code)
    : String(code || "");
  const literals = new Set();
  const worksheetVars = new Set();

  const wsDeclRe = /(?:\bDim|,)\s+([A-Za-z_][A-Za-z0-9_]*)\s+As\s+Worksheet\b/gi;
  let wsDeclMatch;
  while ((wsDeclMatch = wsDeclRe.exec(text)) !== null) {
    worksheetVars.add(String(wsDeclMatch[1]).toLowerCase());
  }

  const wsLoopRe = /\bFor\s+Each\s+([A-Za-z_][A-Za-z0-9_]*)\s+In\s+[^\r\n:]*\bWorksheets\b/gi;
  let wsLoopMatch;
  while ((wsLoopMatch = wsLoopRe.exec(text)) !== null) {
    worksheetVars.add(String(wsLoopMatch[1]).toLowerCase());
  }

  const wsSetRe = /\bSet\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^\r\n:]*\b(?:Worksheets|Sheets)\s*(?:\.Add|\()/gi;
  let wsSetMatch;
  while ((wsSetMatch = wsSetRe.exec(text)) !== null) {
    worksheetVars.add(String(wsSetMatch[1]).toLowerCase());
  }

  // VBA 문자열은 큰따옴표(")뿐이고 '는 문자열 안에서 일반 문자다(시트명 'NHN(5분)_'26년..'의 ' 포함).
  // 이전 ["']([^"']+)["'] 는 '를 구분자로 봐 시트명을 잘라(=오탐) 정확한 시트명을 못 찾았다 → "([^"]+)".
  const patterns = [
    /\b(?:Worksheets|Sheets)\s*\(\s*"([^"]+)"\s*\)/gi,
    /\b[A-Za-z_][A-Za-z0-9_]*\s*\.\s*Worksheets\s*\(\s*"([^"]+)"\s*\)/gi,
    /\b[A-Za-z_][A-Za-z0-9_]*\s*\.\s*Sheets\s*\(\s*"([^"]+)"\s*\)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) literals.add(String(m[1]));
    }
  }

  const wsNameLiteralRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*Name\s*=\s*"([^"]+)"/gi;
  let wsNameLiteralMatch;
  while ((wsNameLiteralMatch = wsNameLiteralRe.exec(text)) !== null) {
    const receiver = String(wsNameLiteralMatch[1]).toLowerCase();
    if (worksheetVars.has(receiver) && wsNameLiteralMatch[2]) {
      literals.add(String(wsNameLiteralMatch[2]));
    }
  }

  const strCompLiteralRe = /\bStrComp\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*Name\s*,\s*"([^"]+)"/gi;
  let strCompLiteralMatch;
  while ((strCompLiteralMatch = strCompLiteralRe.exec(text)) !== null) {
    const receiver = String(strCompLiteralMatch[1]).toLowerCase();
    if (worksheetVars.has(receiver) && strCompLiteralMatch[2]) {
      literals.add(String(strCompLiteralMatch[2]));
    }
  }

  // 변수에 정확 시트명을 담고 Worksheets(sheetName) 로 접근하는 생성물도 허용한다.
  const assignments = new Map();
  const assignRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]+)"/gi;
  let assignMatch;
  while ((assignMatch = assignRe.exec(text)) !== null) {
    assignments.set(String(assignMatch[1]).toLowerCase(), String(assignMatch[2]));
  }
  const wsVarRe = /\b(?:Worksheets|Sheets)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/gi;
  let wsVarMatch;
  while ((wsVarMatch = wsVarRe.exec(text)) !== null) {
    const assigned = assignments.get(String(wsVarMatch[1]).toLowerCase());
    if (assigned) literals.add(assigned);
  }
  const nameVarRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*Name\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\b/gi;
  let nameVarMatch;
  while ((nameVarMatch = nameVarRe.exec(text)) !== null) {
    const receiver = String(nameVarMatch[1]).toLowerCase();
    if (!worksheetVars.has(receiver)) continue;
    const assigned = assignments.get(String(nameVarMatch[2]).toLowerCase());
    if (assigned) literals.add(assigned);
  }
  const strCompVarRe = /\bStrComp\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*Name\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\b/gi;
  let strCompVarMatch;
  while ((strCompVarMatch = strCompVarRe.exec(text)) !== null) {
    const receiver = String(strCompVarMatch[1]).toLowerCase();
    if (!worksheetVars.has(receiver)) continue;
    const assigned = assignments.get(String(strCompVarMatch[2]).toLowerCase());
    if (assigned) literals.add(assigned);
  }
  return [...literals];
}

function vbaExactSheetReferenceFailures(code, sourceUserMessage) {
  const source = String(sourceUserMessage || "");
  if (!/@(?:범위|컬럼|시트)\[/.test(source)) return [];
  const exactSheets = exactSheetNamesFromMentions(source);
  if (!exactSheets.length) return [];
  const literals = vbaSheetReferenceLiterals(code);
  const literalSet = new Set(literals);
  const failures = [];
  for (const sheetName of exactSheets) {
    if (literalSet.has(sheetName)) continue;
    const used = literals.length ? literals.map(v => `"${v}"`).join(", ") : "없음";
    failures.push(
      `VBA 코드의 실제 시트 접근 구문에 요청의 정확한 시트명 "${sheetName}" 이 없습니다. ` +
      `현재 감지된 시트명은 ${used} 입니다. @범위/@컬럼/@시트의 시트명은 번역·영문화·띄어쓰기 보정 없이 그대로 사용하세요.`
    );
  }
  return failures;
}

function wholeColumnCountRowTwoFailures(code, sourceUserMessage) {
  const source = String(sourceUserMessage || "");
  const text = String(code || "");
  const wholeColumnRange = /@범위\[[^\]]+![A-Z]{1,3}:[A-Z]{1,3}\]/i.test(source);
  const countIntent = /(동일\s*값|같은\s*값|중복).{0,20}(개수|갯수|건수)|(?:개수|갯수|건수).{0,20}(적어|입력|채워|작성|구해)|COUNTIF/i.test(source);
  const explicitHeaderRow2 = /(?:헤더|제목)\s*(?:가|는|은)?\s*2\s*행|2\s*행\s*(?:헤더|제목)|hdr_row\s*=\s*2|header_row\s*=\s*2/i.test(source);
  if (!wholeColumnRange || !countIntent || explicitHeaderRow2) return [];
  const skipsRow2 = (
    /\b(?:hdr_row|header_row)\s*=\s*2\b/i.test(text)
    && /(?:hdr_row|header_row)\s*\+\s*1|\{\s*(?:hdr_row|header_row)\s*\+\s*1\s*\}/i.test(text)
  ) || /\b(?:For\s+\w+\s*=\s*3\s+To|for\s+\w+\s+in\s+range\s*\(\s*3\s*,)/i.test(text)
    || /["'][A-Z]{1,3}3(?::|\{|\$|["'])/i.test(text);
  if (!skipsRow2) return [];
  return ["전체 열 범위에서 동일값 개수/중복 개수를 채우는 요청인데 코드가 2행을 헤더로 가정하고 3행부터 처리합니다. 요청에 '2행이 헤더'라고 명시되지 않았으면 1행을 헤더로 보고 2행부터 포함하거나, 실제 2행이 헤더인지 검사한 뒤 시작 행을 정하세요."];
}

// [소수점 쪼개기 차단] re.findall(r'\d+') 류 '연속 숫자만' 패턴 + 콤마 join 조합은 '20.0' 을
// '20','0' 으로 쪼개 "20, 0" 오답을 만든다(실측: 한화테크윈 DSMC ':' 뒤 숫자 추출 — 프롬프트
// 규칙만으로는 모델이 반복 위반해 정적 게이트로 승격). ''.join(전화번호 숫자 이어붙이기) 같은
// 정상 패턴은 콤마 join 이 아니므로 걸리지 않는다. 서버 AST 게이트에도 동일 검사가 있다(최종 방어).
function decimalSplitNumberExtractFailures(code) {
  const text = String(code || "");
  const digitOnlyFindall = /\bfind(?:all|iter)\s*\(\s*r?['"](?:\\d\+|\[0-9\]\+)['"]/.test(text);
  const commaJoin = /['"],\s?['"]\s*\.\s*join\s*\(/.test(text);
  if (!digitOnlyFindall || !commaJoin) return [];
  return ["re.findall 의 숫자 패턴이 '연속 숫자만'(\\d+)이라 '20.0' 같은 소수점 값을 '20'과 '0'으로 쪼개 콤마 나열합니다. 소수점 포함 r'\\d+(?:\\.\\d+)?' 패턴을 쓰거나 구분자로 자른 조각을 통째로 기입하고, 매칭이 1개면 join 나열 대신 그 값 하나만 쓰세요."];
}

function userRequestsSort(text) {
  return /(정렬|내림\s*차순|오름\s*차순|소트|sort|order\s*by)/i.test(String(text || ""));
}

// 라우팅 '의도' 판정용: @범위/@컬럼/@시트[...] 안의 파일명·시트명·범위를 제거한다.
// 파일명에 '작성/복사/정산/계산' 같은 라우팅 키워드가 들어 있으면(예: output_..._LG작성.xlsx)
// 의도가 오분류되어 엔진이 잘못 선택되던 버그를 막는다. 대상 '존재' 판정(@범위 유무 등)은 원문을 쓴다.
function routingIntentText(text) {
  let s = String(text || "").replace(/@(?:범위|컬럼|시트)\[[^\]]*\]/g, " ");
  // 기계가 붙인 '정확 참조' 에코(파일/시트/열 '이름')는 사용자 의도가 아니다. 시트명에 '중복건 제거'·'요약'·
  // '번호' 등이 들어가면 duplicateRowDelete/idPivot 등 의도판정이 오탐한다(예: 시트 "…CCU중복건 제거…"
  // 로 값붙여넣기 요청이 '중복행 삭제'로 오분류돼 무관한 규칙이 주입됨). 의도 텍스트에서만 제거한다.
  // 주의: 사용자가 직접 쓴 자유문("… 삭제해줘")은 남겨야 하므로 '- '로 시작하는 에코 불릿과 지정 헤더만 지운다.
  s = s
    .replace(/^\s*(?:\[정확\s*참조[^\]]*\]|##\s*정확\s*시트명).*$/gim, " ")
    .replace(/^\s*[-•*]\s*(?:정확\s*(?:파일명|시트명|주소|컬럼명)|선택\s*범위|시트명|파일명|주소|컬럼명)\s*[:：].*$/gim, " ")
    .replace(/^\s*정확\s*시트명\s*\(절대\s*변경\s*금지\).*$/gim, " ")
    .replace(/^.*(?:절대\s*번역하지|번역\s*[·,]?\s*영문화|코드에\s*그대로\s*복사하세요).*$/gim, " ");
  return s;
}

function shouldRouteSimpleStructureEditToPython(text) {
  const t = String(text || "");
  if (!t.trim()) return false;
  if (typeof duplicateRowDeleteIntent === "function" && duplicateRowDeleteIntent(t)) return false;
  if (typeof conditionalRowDeleteIntent === "function" && conditionalRowDeleteIntent(t)) return false;
  const intent = routingIntentText(t);
  const hasDirectTarget = /@범위\[[^\]]+![^\]]+\]/i.test(t)
    || /\b[A-Z]{1,3}\s*:\s*[A-Z]{1,3}\b/i.test(t)
    || /\b\d+\s*:\s*\d+\b/i.test(t)
    || /[A-Z]{1,3}\s*열|\d+\s*행|선택\s*(?:범위|행|열|셀)/i.test(intent);
  if (!hasDirectTarget) return false;

  const insertAxis = /(행|열).{0,16}(추가|삽입|insert)|(?:추가|삽입|insert).{0,16}(행|열)/i.test(intent);
  const deleteAxis = /(행|열).{0,16}(삭제|지워|없애|제거|delete)|(?:삭제|지워|없애|제거|delete).{0,16}(행|열)/i.test(intent);
  const clearCells = /(셀|범위|데이터|내용|값).{0,20}(삭제|지워|비워|제거|clear)|(?:삭제|지워|비워|제거|clear).{0,20}(셀|범위|데이터|내용|값)/i.test(intent);
  if (!(insertAxis || deleteAxis || clearCells)) return false;

  // 조건/매칭/집계/복붙이 섞인 작업은 단순 구조 조작이 아니므로 기존 라우팅 규칙에 맡긴다.
  // (의도 텍스트로만 검사 — 파일명/시트명 키워드 충돌 방지.)
  return !/(일치|매칭|같은|동일|찾아서|찾아|조건|이면|일\s*때|경우|피벗|그룹|집계|합계|합산|개수|건수|정렬|복사|붙여\s*넣|붙여넣|덮어|갱신|업데이트|분리|토큰|환산|계산|입력|작성|채워|가져)/i.test(intent);
}

// [사용자 지시] 시트 복사/복사후 이름변경/추가/삭제, 단순 정렬처럼 'ctx 헬퍼가 결정적으로 처리하는' 작업은
// VBA 로 손으로 짜지 말고 Python COM(ctx.copy_sheet/rename_sheet/add_sheet/delete_sheet/sort)으로 라우팅한다.
// 헬퍼가 없는 복합/매칭/대량 루프 작업(중복행 삭제, 다중값 매칭 합산 등)은 안정성 위해 VBA 유지.
function sheetOpIntent(text) {
  const original = String(text || "");
  const intent = routingIntentText(original);
  // @시트[...] 는 '시트 자체'를 가리킨다(범위 아님). routingIntentText 가 이 멘션을 지워 '시트' 단어가
  // 사라지므로, 멘션이 있으면 op 단어(복사/이름변경/추가/삭제)만으로도 시트 작업으로 인정한다.
  const sheetMention = /@시트\[/.test(original);
  if (!/(시트|탭|worksheet|sheet)/i.test(intent) && !sheetMention) return false;
  // 매칭/집계/조건이 섞인 복합 작업은 단순 시트조작이 아니므로 기존 라우팅에 맡긴다(안정성).
  if (/(일치|매칭|같은\s*값|동일\s*값|찾아서|피벗|pivot|집계|합계|합산|그룹|조건|이면|일\s*때|분리|토큰|split)/i.test(intent)) return false;
  const clearLike = /(데이터|내용|값|범위)[^\n]{0,6}(삭제|제거|지워|비워|clear)/i.test(intent);
  // [0.5.17] 이름변경 감지 강화: (1) "이름/명 … 변경/바꾸" 사이 간격을 넉넉히(긴 새이름 "2026년 5월로" 허용),
  // (2) "이름/명" 단어 없이 자연스럽게 말한 "X(으)로 바꿔/변경"도 인정 — "이 시트를 3월로 바꿔줘",
  // "Sheet1을 요약으로 바꿔줘", "@시트[…]을 3월로 바꿔줘" 가 VBA 로 새던 것 수정. 단 내용/서식 변경은 제외.
  const contentOrFormatChange = /(데이터|내용|값|셀|행|열|칸|범위|서식|형식|색|색상|글꼴|폰트|정렬|너비|높이|테두리)/i.test(intent);
  const renameSignal = (
    /(이름|명|rename)[^\n]{0,20}(변경|바꾸|바꿔|수정|rename)/i.test(intent)
    || /(변경|수정)[^\n]{0,12}(이름|명)/i.test(intent)
    || (/(?:으로|로)\s*(?:이름\s*(?:을|를)?\s*)?(변경|바꾸|바꿔|수정)/i.test(intent) && !contentOrFormatChange)
  );
  let copy, rename, add, del;
  if (sheetMention) {
    copy = /(복사|복제|copy)/i.test(intent);
    rename = renameSignal;
    add = /(추가|생성|만들)|(?:add|insert)\s*(?:sheet|tab)/i.test(intent);
    del = /(삭제|제거|지워|없애|delete)/i.test(intent) && !clearLike;
  } else {
    copy = /(시트|탭|worksheet|sheet)[^\n]{0,12}(복사|복제|copy)|(복사|복제|copy)[^\n]{0,12}(시트|탭|worksheet|sheet)/i.test(intent);
    rename = renameSignal;
    add = /(시트|탭)[^\n]{0,8}(추가|생성|만들)|(?:add|insert)\s*(?:sheet|tab)/i.test(intent);
    del = /(시트|탭)[^\n]{0,8}(삭제|제거|지워|없애|delete)/i.test(intent) && !clearLike;
  }
  // [2026-06-23] 시트 복사/이름변경/추가/삭제는 같은 파일·교차파일 모두 Python(ctx) 으로 보낸다.
  // 교차파일은 ctx.book/dst_book/copy_sheet 가 처리하며, 파일명에 공백이 끼어도 정규화 매칭으로 찾는다
  // (VBA 는 Workbooks() 가 정확 매칭이라 모델의 공백 삽입을 못 견뎌 오히려 실패함).
  return copy || rename || add || del;
}
function ctxSortIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (!/(정렬|sort|오름차순|내림차순|순으로\s*정렬|순\s*정렬)/i.test(intent)) return false;
  // 매칭/집계/피벗/조건/덮어쓰기가 섞인 복합 작업은 기존(VBA) 라우팅에 맡긴다.
  if (/(일치|매칭|같은|동일|찾아|피벗|pivot|집계|합계|합산|그룹|조건|이면|일\s*때|덮어|갱신)/i.test(intent)) return false;
  return true;
}
// "월 정보 +1 / 월 +1 / 다음달로 변경 / N개월 이동" 류 — ctx.shift_months 로 결정적 처리(모델이 VBA 정규식·
// 한글에 공백을 끼워 매번 깨뜨리던 문제를 백엔드 헬퍼로 제거). Python 우선 라우팅.
function monthShiftIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (/(월\s*정보|월|날짜)\s*(?:을|를|에|값)?\s*[+\-]\s*\d+/i.test(intent)) return true;
  if (/[+\-]\s*\d+\s*개?월\s*(?:이동|증감|뒤|전|후|로|만큼)/i.test(intent)) return true;
  if (/(월\s*정보|날짜)[^\n]{0,10}(더해|올려|늘려|증가|이동|증감|미뤄|당겨)/i.test(intent)) return true;
  if (/(다음\s*달|지난\s*달|한\s*달\s*(?:뒤|전|후))\s*(?:로|으로)?\s*(?:바꿔|변경|이동|미뤄|당겨|해|처리|수정|업데이트)/i.test(intent)) return true;
  return false;
}

// "E6:E16 값을 1000000으로 나눈 값을 D6:D16에 입력" 같은 단순 범위 산술은 ctx.read/write가
// 가장 안정적이다. VBA LLM은 한글+숫자 시트명에 공백을 끼우는 회귀가 반복됐으므로 Python 우선.
function simpleRangeArithmeticIntent(text) {
  const original = String(text || "");
  const intent = routingIntentText(original);
  const rangeRefs = original.match(/@범위\[[^\]]+\]/g) || [];
  if (rangeRefs.length < 2) return false;
  const hasArithmetic = /(나눈\s*값|나누|나눠|\/|÷|곱한\s*값|곱하|\*|×|더한\s*값|더해|빼|뺀\s*값|차감|[+\-]\s*\d+|\d+\s*(?:으로|로)\s*(?:나눈|나누|곱한|곱하))/i.test(intent);
  const hasWrite = /(입력|작성|기입|채워|넣어|반영|써줘|붙여|write)/i.test(intent);
  if (!hasArithmetic || !hasWrite) return false;
  // 조건/매칭/집계/행삭제/피벗은 대량·복합 작업이므로 기존 VBA 라우팅에 맡긴다.
  if (/(일치|매칭|같은|동일|찾아서|찾아|기준|조건|이면|일\s*때|경우|필터|추출|중복|행\s*삭제|행을\s*삭제|피벗|pivot|그룹|집계|합계|합산|개수|건수|여러\s*개|여러개|토큰|분리|병합)/i.test(intent)) {
    return false;
  }
  return true;
}

// ctx 헬퍼가 결정적으로 처리하는(=Python 우선) 작업 묶음. 필요 시 안전한 헬퍼 작업을 여기에 더한다.
// 피벗/크로스탭/그룹요약 → ctx.pivot 으로 결정적 처리(1D group_by, 2D column). 손코딩(VBA/ctx) 대신.
function pivotIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (/(피벗|pivot|유사\s*피벗|그룹\s*별|그룹별|집계표|요약표|크로스\s*탭|crosstab)/i.test(intent)) return true;
  // "회사별 (매출) 합계/요약" — 별과 집계어 사이에 한 절(쉼표 전, 최대 12자) 끼어도 인정.
  if (/(?:별|별로)\s*[^\n,.]{0,12}(합계|집계|요약|평균|개수|건수|총합)/i.test(intent)) return true;
  // 2D 크로스탭 형태: 행 기준 + 열 기준 + 값/집계
  if (/행\s*(?:으로|기준|라벨|은|는)/i.test(intent)
      && /열\s*(?:로|으로|기준|배치|은|는)/i.test(intent)
      && /(합계|집계|요약|평균|개수|건수|값\s*(?:은|는|으로))/i.test(intent)) return true;
  return false;
}

function appendSameFormatSheetsIntent(text) {
  const intent = routingIntentText(String(text || ""));
  const hasManyFiles = /(여러\s*파일|입력\s*파일들|입력\s*파일|5\s*개|다섯\s*개|복수\s*파일|각\s*파일)/i.test(intent);
  const hasAppend = /(통합|이어\s*붙|이어붙|붙여\s*하나|하나의\s*표|합쳐|합치|연결|append|concat)/i.test(intent);
  const hasHeaderOnce = /(헤더\s*(?:하나|1\s*회|한\s*번|한개|한\s*개)|하나의\s*헤더|헤더.*남기|첫\s*파일.*헤더|이후.*헤더\s*(?:제외|다음))/i.test(intent);
  const hasOutputSheet = /(새\s*시트|출력\s*파일|결과\s*시트|통합\s*시트)/i.test(intent);
  return hasManyFiles && hasAppend && (hasHeaderOnce || /동일(?:한)?\s*포맷|같은\s*포맷|가입자별청구내역/i.test(intent)) && hasOutputSheet;
}

// [0.5.16] ctx 헬퍼가 결정적으로 처리하는 추가 작업들 — Python 우선 라우팅(헬퍼가 있는데 기본엔진 VBA 로
// 새던 것 수정). 행/열 숨김·숨김해제, VLOOKUP/조인, 단순 중복제거, 셀 분리, 합계행.
function hideUnhideIntent(text) {
  const intent = routingIntentText(String(text || ""));
  return /(행|열|컬럼|column|row)[^\n]{0,12}(숨김|숨겨|감춰|숨기|hide|보이게|표시|unhide)/i.test(intent)
      || /(숨김|숨겨|감춰|숨기|hide|보이게|표시|unhide)[^\n]{0,12}(행|열|컬럼|column|row)/i.test(intent);
}
function lookupJoinIntent(text) {
  const intent = routingIntentText(String(text || ""));
  // '한 셀에 여러 값' 분리+합산 매칭은 ctx.lookup 으로 안 되므로 제외(그건 VBA multiValueLookup 유지).
  if (/(한\s*셀|셀\s*안|셀안|여러\s*값|병합|줄\s*바꿈|줄바꿈|split)/i.test(intent)) return false;
  const lookupWord = /(vlookup|lookup|조인|join|매핑|단가(?:표)?\s*(?:에서|를|을|로|적용|매칭|붙)|찾아\s*(?:와|서)\s*(?:채워|넣어|기입|작성|가져)|매칭(?:해|하여|해서)?\s*(?:가져|채워|넣어|기입|작성))/i.test(intent);
  return lookupWord && /(채워|넣어|기입|작성|가져|붙여|반영|매핑|매칭|적용)/i.test(intent);
}
// [0.7.1] 피벗/요약 값을 다른 시트의 '구분명(이름)'에 맞춰 '여러 값 열'을 채우는 붙여넣기 = ctx.match_fill.
// lookup(단일 값열)보다 넓은 다중열+퍼지매칭+불일치리포트. 손코딩 read→dict→부분매칭 루프를 막는다.
function matchFillIntent(text) {
  const intent = routingIntentText(String(text || ""));
  const nameMatch = /(이름|구분명|명칭|항목명|상품명|품목명)\s*[^\n]{0,10}(맞춰|맞추|기준|매칭|일치|같지\s*않아도|다르(?:면|어도)|비슷)/i.test(intent)
      || /(이름\s*맞춰|매칭\s*해|매칭해|매칭시켜)/i.test(intent);
  const fillVerb = /(채워|채우|붙여\s*넣|붙여넣|값만|기입|반영|넣어|입력)/i.test(intent);
  // 값-요약/피벗 소스이거나, '구분명/여러 값/각각' 신호가 있어야(단일 셀 vlookup 은 lookup 이 담당).
  const multiOrSummary = /(피벗|pivot|요약|집계|그룹|구분명|여러\s*값|각각(?:의)?|열에\s*각각|값만)/i.test(intent);
  return nameMatch && fillVerb && multiOrSummary;
}
function dedupeIntent(text) {
  const intent = routingIntentText(String(text || ""));
  // 조건부(수납금액 보호 등) 복잡 중복삭제는 기존 VBA(duplicateRowDeleteIntent)에 맡긴다.
  if (typeof duplicateRowDeleteIntent === "function" && duplicateRowDeleteIntent(text)
      && /(보호|지우면\s*안|삭제하면\s*안|1\s*이상|>=\s*1|수납금액|먼저|위에\s*있는|아래쪽\s*1개)/i.test(intent)) return false;
  return /(중복|duplicate)[^\n]{0,16}(제거|삭제|지워|없애|정리|remove|delete|dedupe)/i.test(intent)
      || /(제거|삭제|지워|없애|정리)[^\n]{0,12}(중복|duplicate)/i.test(intent);
}
function splitColumnIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (/(한\s*셀에\s*여러|병합)/i.test(intent)) return false;
  return /(셀|열|컬럼|값)[^\n]{0,16}(분리|나눠|나누|쪼개|split|분할|구분)/i.test(intent)
      || /(분리|나눠|나누|쪼개|split|분할)[^\n]{0,12}(셀|열|컬럼|값|기준|구분자)/i.test(intent);
}
function totalRowIntent(text) {
  const intent = routingIntentText(String(text || ""));
  return /(합계|총합|소계|total)[^\n]{0,12}(행|줄)[^\n]{0,12}(추가|만들|넣어|작성|기록|생성)/i.test(intent)
      || /(맨\s*(?:아래|밑)|표\s*끝|마지막\s*행\s*(?:아래|밑))[^\n]{0,16}(합계|총합|소계|sum)/i.test(intent);
}

// [0.5.17] 단순 '값 채우기/쓰기' — 특정 셀/열/범위에 값을 입력(계산·매칭·조건 없음)은 ctx.write 로
// 결정적 처리(Python). 헬퍼가 있는데 기본엔진이 VBA 라, "셀값 채워"가 모델(클로드 포함) 무관하게 VBA 로
// 새던 것 수정. simpleRangeArithmeticIntent(산술+범위2개)와 달리 '산술 없는 순수 값 쓰기'를 담당한다.
function simpleValueWriteIntent(text) {
  const original = String(text || "");
  const intent = routingIntentText(original);
  if (!intent.trim()) return false;
  const hasWrite = /(입력|작성|기입|채워|채우|넣어|반영|써\s*줘|write)/i.test(intent);
  if (!hasWrite) return false;
  // 계산/매칭/조건/집계/삭제/피벗/교차·복사 등 복합은 기존 경로(VBA/전용 인텐트)에 맡긴다 — 회귀 방지.
  if (/(일치|매칭|같은|동일|찾아서|찾아|기준|조건|이면|일\s*때|경우|필터|추출|중복|삭제|제거|피벗|pivot|그룹|집계|합계|합산|평균|개수|건수|누적|소계|총계|여러\s*개|여러개|토큰|분리|병합|나눈|나누|곱한|곱하|더한|빼|차감|수식|함수|countif|sumif|복사|붙여|시트\s*전체|전체\s*시트|다른\s*파일|교차)/i.test(intent)) {
    return false;
  }
  // 대상 신호(열/셀주소/범위/@멘션/'셀'·'칸'·'여기')가 있어야 오탐 감소.
  return /([A-Z]{1,3}\s*열|[A-Z]{1,3}\d+\b|@(?:범위|시트|컬럼|파일)\s*\[|셀|칸|범위|여기)/i.test(original);
}

// [0.5.17] 열(컬럼) 이동/재배치/맞바꾸기 → ctx.move_cols 로 결정적 처리(Python). VBA 로 보내면 모델이 병합
// 제목/헤더 위에서 Columns.Cut/Insert 를 짜다 1004(병합된 셀에서는 실행할 수 없습니다)로 통째 실패하던 것을
// 대체한다(move_cols 는 네이티브 copy + 병합안전 insert/delete 라 병합 헤더가 있어도 안전 — 라이브 COM 검증됨).
// [0.5.18] "X열을 Y로 이동/복사하고 원래 열은 비우기" — 이건 순서 재배치(move_cols=원본 삭제·시프트)가 아니라
// copy(원본→대상) + ctx.clear(원본) 이다. 원본을 delete_cols/move 로 처리하면 다른 열이 왼쪽으로 시프트돼
// E→D, F→E 로 라벨이 어긋나고 F열 SUMIF/SUM 이 #REF! 로 파손된다(eval 실패 케이스). 별도 경로로 안전 처리.
function columnCopyClearIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (!/([A-Z]{1,3}\s*열|열|컬럼|칼럼|column)/i.test(intent)) return false;
  if (!/(이동|옮기|옮겨|복사|copy|move)/i.test(intent)) return false;
  const clearOriginal = /(원래|원본|기존)[^\n]{0,14}(비우|비워|비운|지우|지워|clear|empty)/i.test(intent)
    || /(비우|비워|지우|지워)[^\n]{0,10}(원래|원본|기존)/i.test(intent);
  if (!clearOriginal) return false;
  if (/(일치|매칭|피벗|pivot|집계|합산|중복)/i.test(intent)) return false;
  return true;
}

// [0.5.18] 인접 두 열 '맞바꿈' → ctx.swap_cols(네이티브 Cut/Insert, 수식 참조 자동보정). move_cols(copy+delete)는
// =SUM(D..) 등 참조가 #REF! 로 파손됨(eval rearrange_keep_data 실패).
function columnSwapIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (!/([A-Z]{1,3}\s*열|열|컬럼|칼럼|column)/i.test(intent)) return false;
  return /(맞바꾸|맞바꿔|서로\s*바꾸|서로\s*바꿔|자리\s*(?:를)?\s*바꾸|자리\s*바꿔|위치\s*(?:를)?\s*(?:서로\s*)?바꾸|위치\s*(?:를)?\s*(?:서로\s*)?바꿔|swap)/i.test(intent);
}

// [0.5.18] 범위/셀을 '값으로/원문 텍스트 그대로' 복사 → ctx.copy_values(서식 보존, 수식 시프트 없음). ctx.copy 는
// 수식을 그대로 옮겨 상대참조가 시프트됨(eval preserve_date_on_load 실패).
function copyValuesIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (!/(복사|copy)/i.test(intent)) return false;
  if (!/(값으로|값만|원문|텍스트\s*그대로|그대로\s*(?:복사|유지)|계산\s*(?:결과|값)|결과\s*값)/i.test(intent)) return false;
  if (/(일치|매칭|피벗|pivot|집계|중복|삭제|합산)/i.test(intent)) return false;
  return true;
}

// [0.5.18] 한 열을 다른 열로 (서식째) 복사 → ctx.copy_col(병합 안전, 원본 유지). ctx.copy 로 1행부터 통복사하면
// 제목 가로병합에 걸려 1004(eval copy_time_values 실패). 값복사/원본비우기/맞바꿈은 각자 경로.
function columnCopyIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (!/([A-Z]{1,3}\s*열|컬럼|칼럼|column)/i.test(intent)) return false;
  if (!/(복사|copy)/i.test(intent)) return false;
  if (columnCopyClearIntent(text) || copyValuesIntent(text) || columnSwapIntent(text)) return false;
  if (/(일치|매칭|피벗|pivot|집계|중복|삭제|합산)/i.test(intent)) return false;
  return true;
}

function columnMoveIntent(text) {
  const intent = routingIntentText(String(text || ""));
  const hasColumn = /([A-Z]{1,3}\s*열|열\s*(?:을|를|들|순서|위치)|컬럼|칼럼|column)/i.test(intent);
  if (!hasColumn) return false;
  // 원본비우기(copy+clear)·맞바꿈(swap)·단순복사(copy_col)는 move(원본삭제) 아님 → 각자 경로로.
  if (columnCopyClearIntent(text) || columnSwapIntent(text) || columnCopyIntent(text)) return false;
  const moveVerb = /(이동|옮기|옮겨|reorder|재배치|(?:순서|위치|자리)\s*(?:를)?\s*(?:변경|바꾸|바꿔|조정)|앞으로|뒤로|맨\s*(?:앞|뒤)|사이에|맞바꾸|맞바꿔|바꿔\s*치|swap)/i.test(intent);
  if (!moveVerb) return false;
  // 매칭/집계/피벗/조건/삭제는 열이동이 아님 → 기존 경로 유지(회귀 방지).
  if (/(일치|매칭|찾아서|찾아|기준으로|피벗|pivot|그룹\s*별|그룹별|집계|합산|조건|이면|일\s*때|삭제|제거)/i.test(intent)) return false;
  return true;
}

// [0.5.18] '열/데이터만 비우기(수식 유지)' → ctx.clear(범위, keep_formulas=?). write+formula_mask 로 배열을 짜다
// 세로/가로 축을 뒤집어 changed=0 되던 것(eval replace_deleted_logic) 대체 — 한 줄 결정적.
function clearDataIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (!/(비우|비워|비운|지우|지워|clear|초기화)/i.test(intent)) return false;
  if (!(/(데이터|내용|값|셀)/i.test(intent) || /[A-Z]{1,3}\s*열/i.test(intent))) return false;
  // 행/열 '삭제'(구조 제거)·조건부 행삭제·중복/필터는 제외 → 기존 경로.
  if (/(행\s*(?:을|를)?\s*삭제|열\s*(?:을|를)?\s*삭제|행\s*삭제|중복|필터|조건|이면|일\s*때)/i.test(intent)) return false;
  return true;
}

// [0.5.18] '합계 열에 여러 열 합계 수식 채우기'(병합 그룹 단위) → ctx.fill_sum_col. 단순 =D+E 를 헤더/라벨행까지
// 채우고 병합 그룹 SUM 을 놓치던 것(eval feedback_refines_prior / formula_result_check_not_overwrite) 대체.
function fillSumColIntent(text) {
  const intent = routingIntentText(String(text || ""));
  if (!/([A-Z]{1,3}\s*열|합계\s*열|컬럼)/i.test(intent)) return false;
  const sumFill = /(합계|소계|더한|합산|합\s*을|[A-Z]\s*[+＋]\s*[A-Z])/i.test(intent)
    && /(수식|채우|채워|입력|넣|기입|작성)/i.test(intent);
  if (!sumFill) return false;
  if (/(일치|매칭|피벗|pivot|중복|삭제)/i.test(intent)) return false;
  return true;
}

function ctxHelperPreferredIntent(text) {
  return sheetOpIntent(text) || ctxSortIntent(text) || monthShiftIntent(text) || simpleRangeArithmeticIntent(text)
    || pivotIntent(text) || appendSameFormatSheetsIntent(text)
    || hideUnhideIntent(text) || lookupJoinIntent(text) || dedupeIntent(text) || splitColumnIntent(text) || totalRowIntent(text)
    || simpleValueWriteIntent(text) || columnMoveIntent(text) || columnCopyClearIntent(text)
    || columnSwapIntent(text) || copyValuesIntent(text) || columnCopyIntent(text)
    || clearDataIntent(text) || fillSumColIntent(text)
    || (typeof filterToNewSheetIntent === "function" && filterToNewSheetIntent(text));
}

function shouldRouteRequestToVba(text) {
  const t = String(text || "");
  if (!t.trim()) return false;
  const intent = routingIntentText(t);  // 키워드 매칭은 멘션(파일명/시트명) 제거한 의도 텍스트로
  const explicitVba = userExplicitlyRequestsVba(intent);
  const simplePythonStructureEdit = shouldRouteSimpleStructureEditToPython(t);
  const duplicateRowDelete = duplicateRowDeleteIntent(t);
  const conditionalRowDelete = typeof conditionalRowDeleteIntent === "function" && conditionalRowDeleteIntent(t);
  const filterToSheet = typeof filterToNewSheetIntent === "function" && filterToNewSheetIntent(t);
  const ctxHelperPreferred = ctxHelperPreferredIntent(t);
  const rangeRefs = t.match(/@범위\[/g) || [];                  // 구조 신호: 원문
  const explicitColumns = /![A-Z]{1,3}:[A-Z]{1,3}\]/i.test(t);  // 구조 신호: 원문(멘션 내 전체열)
  const pivotLike = /(피벗|pivot|유사\s*피벗|그룹\s*별|그룹별|집계표|요약표|크로스탭)/i.test(intent)
    || (/(?:별|별로)\s*(?:합계|집계|요약|평균|개수|건수)/i.test(intent) && /(합계|집계|요약|평균|개수|건수)/i.test(intent));
  // "피벗"이라는 단어가 없어도 "D열을 행으로, H열을 열로, R열 합계" 같은 요청은
  // 실질적으로 크로스탭/유사 피벗이다. 저사양 환경에서 Python 경로가 무거워질 수 있고
  // 발신번호/ID 같은 식별자 보존도 중요하므로 VBA 라우팅 대상으로 본다.
  const pivotShape = (
    /(행\s*(?:으로|기준|라벨|필드|값)|row\s*(?:field|label|as|by))/i.test(intent)
    && /(열\s*(?:로|으로|기준|필드|배치|분리|추가)|column\s*(?:field|label|as|by))/i.test(intent)
    && /(합계|집계|요약|평균|개수|건수|sum|count|average|avg|값\s*으로|값\s*에)/i.test(intent)
  );
  const keyedRowOverwrite = (
    /(가입번호|계약번호|청구번호|고객번호|발신번호|전화번호|ID|코드|키|key)/i.test(intent)
    && /(일치|매칭|같은|동일|찾아서|찾아|기준으로|기준)/i.test(intent)
    && /(행\s*전체|해당\s*행|그\s*행|row)/i.test(intent)
    && /(덮어\s*씌|덮어쓰|갱신|업데이트|update|overwrite|반영)/i.test(intent)
  );
  const conditionMarkers = intent.match(/(일\s*때|이면|일\s*경우|인\s*경우|조건|조건문|where|when|if|그리고|또는|동시에|and|or|&&|\|\||필터|추출)/gi) || [];
  const colRefs = t.match(/(?:[A-Z]{1,3}\s*열|@[^\s\]]*컬럼|컬럼|열\s*\()/gi) || [];
  const rowwiseWrite = /(동일\s*행|같은\s*행|각\s*행|행마다|입력|기입|채워|환산|변환|계산|반영)/i.test(intent);
  const wholeSheetCrossCopy = /(시트\s*전체|전체\s*시트|sheet\s*전체|worksheet|탭\s*전체)/i.test(intent)
    && /(복사|붙여\s*넣|붙여넣|copy|paste)/i.test(intent)
    && /(파일|workbook|다른\s*파일|출력|입력|@파일)/i.test(intent);
  const multiValueLookupAggregate = (
    /(하나의\s*셀에\s*여러|한\s*셀에\s*여러|셀\s*안(?:의|에)?\s*데이터|셀안의?\s*데이터|여러\s*개\s*(?:들어|데이터|값)|여러개\s*(?:들어|데이터|값)|병합(?:된|한)?\s*경우\s*합산|분리.*합산|줄\s*바꿈|줄바꿈|split)/i.test(intent)
    && /(일치|매칭|같은|동일|찾아서|찾아|기준)/i.test(intent)
    && /(합계값|합계|합산|더해|sum|작성|입력|기입|채워|넣어|반영|가져)/i.test(intent)
    && (rangeRefs.length >= 3 || explicitColumns)
  );
  if (explicitVba) return true;
  if (simplePythonStructureEdit) return false;
  if (ctxHelperPreferred) return false;   // [사용자 지시] 시트 복사/이름변경/정렬/동일포맷 병합 등 ctx 헬퍼 작업은 Python 우선
  if (duplicateRowDelete || conditionalRowDelete || filterToSheet) return true;
  if (pivotLike || pivotShape || keyedRowOverwrite || wholeSheetCrossCopy || multiValueLookupAggregate) return true;
  if (conditionMarkers.length >= 2 && (rowwiseWrite || colRefs.length >= 2)) return true;
  return conditionMarkers.length >= 1 && rowwiseWrite && colRefs.length >= 2;
}

function shouldRouteRequestToPython(text) {
  const t = String(text || "");
  if (!t.trim()) return false;
  const intent = routingIntentText(t);  // 키워드 매칭은 멘션(파일명/시트명) 제거한 의도 텍스트로
  if (userExplicitlyRequestsVba(intent)) return false;
  // [사용자 지시] 시트 복사/복사후 이름변경/추가/삭제·단순 정렬·동일포맷 병합처럼
  // ctx 헬퍼가 결정적인 작업은 "새 시트" 같은 일반 필터 키워드보다 먼저 Python으로 보낸다.
  if (ctxHelperPreferredIntent(t)) return true;
  if (duplicateRowDeleteIntent(t)) return false;
  if (typeof conditionalRowDeleteIntent === "function" && conditionalRowDeleteIntent(t)) return false;
  if (typeof filterToNewSheetIntent === "function" && filterToNewSheetIntent(t)) return false;
  // Python COM은 저사양 VM에서 COM 멈춤 리스크가 있으므로 단순한 1개 기능 요청에만 강제 라우팅한다.
  // 매칭/합산/조건/피벗/행삭제 같은 복합 작업은 기본 VBA 경로가 처리한다.
  if (shouldRouteSimpleStructureEditToPython(t)) return true;
  return false;
}

function excelColumnLetterToIndex(letter) {
  const col = String(letter || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!col) return 0;
  let n = 0;
  for (const ch of col) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

function requestedExcelColumnLetters(text) {
  const out = new Set();
  const src = String(text || "");
  const rangeRe = /!\$?([A-Z]{1,3})(?::\$?([A-Z]{1,3}))?\]?/gi;
  let m;
  while ((m = rangeRe.exec(src)) !== null) {
    if (m[1]) out.add(String(m[1]).toUpperCase());
    if (m[2]) out.add(String(m[2]).toUpperCase());
  }
  const colWordRe = /\b([A-Z]{1,3})\s*열\b/gi;
  while ((m = colWordRe.exec(src)) !== null) {
    out.add(String(m[1]).toUpperCase());
  }
  return [...out].filter(c => c && excelColumnLetterToIndex(c) > 0);
}

function multiValueLookupIntent(sourceUserMessage) {
  const s = String(sourceUserMessage || "");
  const cols = requestedExcelColumnLetters(s);
  const explicitLookupShape = cols.length >= 3 && /(열로|열에|가져|넣어|작성|입력|채워|반영|대상|결과)/i.test(s);
  return (
    (/(가입번호|계약번호|고객번호|발신번호|전화번호|ID|코드|키|key)/i.test(s) || explicitLookupShape)
    && /(일치|매칭|같은|동일|찾아서|찾아|기준)/i.test(s)
    && /(합계|합산|더해|가져|넣어|작성|입력|채워|반영)/i.test(s)
    && /(한\s*셀|셀\s*안|셀안|여러|병합|줄\s*바꿈|줄바꿈|TEXTSPLIT|CHAR\s*\(\s*10\s*\)|P90|P:P)/i.test(s)
  );
}

function duplicateRowDeleteIntent(sourceUserMessage) {
  const source = String(sourceUserMessage || "");
  const s = typeof routingIntentText === "function" ? routingIntentText(source) : source;
  // "중복 지우지 마 / 삭제하지 말고 / 제거하지 마" = 삭제를 '하지 말라'는 뜻 → 삭제 작업이 아니다.
  if (/(?:지우|삭제|제거|없애)\s*(?:지|하지)\s*(?:마|말|않)/.test(s)) return false;
  const duplicateDelete = /(?:중복\s*값?|중복값|duplicate).{0,24}(?:제거|삭제|지워|없애|remove|delete)|(?:제거|삭제|지워|없애|remove|delete).{0,24}(?:중복\s*값?|중복값|duplicate)/i.test(s);
  if (!duplicateDelete) return false;
  const rowDeleteShape = /(행|위에\s*있는|아래|먼저|EID|ID|키|코드|가입번호|고객번호|계약번호|수납금액|금액|보호|지우면\s*안|삭제하면\s*안|1\s*이상|>=\s*1)/i.test(s);
  const hasColumnRefs = requestedExcelColumnLetters(source).length >= 2;
  return rowDeleteShape || hasColumnRefs;
}

function conditionalRowDeleteIntent(sourceUserMessage) {
  const source = String(sourceUserMessage || "");
  const s = typeof routingIntentText === "function" ? routingIntentText(source) : source;
  if (/(?:지우|삭제|제거|없애)\s*(?:지|하지)\s*(?:마|말|않)/.test(s)) return false;  // "삭제하지 마" = 삭제 작업 아님
  const rowDelete = /(행|row).{0,20}(삭제|지워|없애|제거|delete|remove)|(?:삭제|지워|없애|제거|delete|remove).{0,20}(행|row)/i.test(s);
  if (!rowDelete) return false;
  const hasCondition = /(이면|라면|일\s*때|인\s*경우|경우|조건|필터|이전|이후|보다\s*(?:작|크)|미만|초과|이상|이하|<=|>=|<|>|before|after|where|when|if)/i.test(s)
    || /\b\d{6,8}\b/.test(s);
  const hasColumnOrSelection = requestedExcelColumnLetters(source).length >= 1
    || /@범위\[[^\]]+![^\]]+\]/i.test(source)
    || /선택\s*(?:범위|열|컬럼|셀)|열\s*선택|선택한\s*열|해당\s*열/i.test(source);
  return hasCondition && hasColumnOrSelection;
}

function filterToNewSheetIntent(sourceUserMessage) {
  const source = String(sourceUserMessage || "");
  const s = typeof routingIntentText === "function" ? routingIntentText(source) : source;
  // [회귀 #2 수정] 이 함수가 true 면 대용량 AutoFilter VBA 경로로 '강제'된다. 따라서 "조건으로 행을 걸러
  // 새 시트로" 같은 진짜 필터/추출만 잡아야 하고, "새 시트에 작성/복사/붙여넣기" 같은 단순 복사는 제외해야
  // 한다(단순 복사는 ctx.copy 네이티브 경로가 안전·정확). 과거엔 같은/동일/찾아 + 복사/작성/넣어 만으로도
  // 강제돼 평범한 복사를 무겁게 VBA 로 보냈다.
  // (1) 목적지: 반드시 '새/별도 시트' 생성이어야 한다. 단순 복사동사(복사/작성/넣어/옮겨)만으론 인정 안 함.
  const newSheetDest = /(?:새\s*(?:시트|탭|sheet)|별도\s*(?:시트|탭|sheet)|new\s*sheet)/i.test(s);
  if (!newSheetDest) return false;
  // (2-a) 강한 필터/추출 신호: 그 자체로 필터 의도가 분명한 단어들.
  const explicitFilter = /(?:필터|필터링|추출|골라|걸러|조건에\s*맞|해당(?:하는)?\s*행|[가-힣A-Za-z0-9)\]]+만\s*(?:새|별도|골라|추출|남기|모아|모은|모와)|\d{4}\s*년\s*(?:것|데이터|행|분|만)|filter)/i.test(s);
  // (2-b) 약한 신호(찾아/일치/같은/동일/중에)는 그 자체론 평범한 말이라, '추출 대상이 되는 특정 값/조건'
  //       (따옴표 값·3자리+ 숫자 식별자·"특정 ~"·"~인 행")이 함께일 때만 필터로 인정한다.
  const weakMatchWord = /(?:찾아서?|일치|같은|동일|중에|중\s*['"`])/i.test(s);
  const hasSpecificValue = /(?:['"`][^'"`\n]+['"`]|\b\d{3,}\b|특정\s*(?:값|행|조건|문자|코드)|[가-힣A-Za-z0-9]+\s*(?:인|이는|==|=)\s*(?:행|것|데이터))/i.test(s);
  const valueScopedMatch = weakMatchWord && hasSpecificValue;
  return explicitFilter || valueScopedMatch;
}

function userExplicitlyRequestsForceProceed(text) {
  const source = String(text || "");
  const s = typeof routingIntentText === "function" ? routingIntentText(source) : source;
  return /(그냥|일단|무시하고|상관\s*없으니|위험해도|깨져도|덮어써도|안전\s*검사\s*무시|정적\s*검사\s*무시|가드\s*무시|강제(?:로)?|묻지\s*말고|질문하지\s*말고).{0,20}(해|하라|해줘|진행|실행|적용|돌려|처리)|(?:해|하라|해줘|진행|실행|적용|돌려|처리).{0,20}(그냥|일단|무시하고|상관\s*없으니|위험해도|깨져도|덮어써도|안전\s*검사\s*무시|정적\s*검사\s*무시|가드\s*무시|강제(?:로)?|묻지\s*말고|질문하지\s*말고)/i.test(s);
}

function isHardVbaStaticFailure(message) {
  const m = String(message || "");
  return /VBA 문법 오류|On Error Resume Next|MsgBox|InputBox|Shell|Workbooks\.Open|Application\.Quit|Save\/SaveAs\/Close|Continue For|CreateObject|ScreenUpdating\/Calculation\/EnableEvents\/DisplayAlerts|For Each 제어 변수|마지막 열 계산|열 번호를 암산|열 번호\(|요청에 없는 다중문자 열|VBA에는 Continue For|전체 시트' 요청이 아닌데/i.test(m);
}

function numericArithmeticIntent(text) {
  return /(합계|합산|더해|더해서|더하|차감|빼|계산|정산|금액|요금|매출|원가|수납|청구|총액|잔액|손익|sum|total|amount|fee|charge|balance|net|profit|cost|revenue)/i.test(String(text || ""));
}

function userRequestsAbsoluteValue(text) {
  return /(절대값|절댓값|양수로|모두\s*양수|음수\s*(?:제거|없애|양수)|부호\s*(?:제거|무시)|absolute\s*value|abs\s*\()/i.test(String(text || ""));
}

function negativeSignLossFailures(code, sourceUserMessage, languageLabel) {
  const scan = String(code || "");
  const source = String(sourceUserMessage || "");
  if (userRequestsAbsoluteValue(source)) return [];
  if (!numericArithmeticIntent(source + "\n" + scan)) return [];
  const failures = [];
  const prefix = languageLabel || "코드";
  const add = (msg) => {
    if (!failures.includes(msg)) failures.push(msg);
  };
  const absScan = scan
    .replace(/-\s*(?:abs|Abs)\s*\(/g, "NEGATIVE_ABS_OK(")
    .replace(/-\s*(?:WorksheetFunction|Application\s*\.\s*WorksheetFunction)\s*\.\s*Abs\s*\(/gi, "NEGATIVE_ABS_OK(");
  if (/\b(?:Math\s*\.\s*)?abs\s*\(/i.test(absScan)
      || /\b(?:WorksheetFunction|Application\s*\.\s*WorksheetFunction)\s*\.\s*Abs\s*\(/i.test(absScan)) {
    add(`${prefix}가 금액/요금/합계 계산에서 abs/Abs 로 음수를 양수로 바꿉니다. 사용자가 절대값/양수화를 명시하지 않았으면 음수 부호를 보존하세요.`);
  }
  if (/\.\s*replace\s*\(\s*["'][-−–]["']\s*,\s*["']{2}\s*\)/i.test(scan)
      || /\bReplace\s*\([^,\n\r]+,\s*["'][-−–]["']\s*,\s*["']{2}\s*\)/i.test(scan)) {
    add(`${prefix}가 숫자 문자열에서 '-' 부호를 제거합니다. 쉼표/공백만 제거하고 마이너스 부호는 보존한 뒤 합산하세요.`);
  }
  if (/\.\s*(?:strip|lstrip|rstrip)\s*\(\s*["'][-−–]["']\s*\)/i.test(scan)) {
    add(`${prefix}가 strip/lstrip/rstrip 으로 '-' 부호를 제거합니다. 금액 계산에서는 부호 제거가 아니라 부호 보존 파싱을 해야 합니다.`);
  }
  const reSubMatches = scan.match(/re\s*\.\s*sub\s*\(\s*r?["'][^"']*\[\^[^\]]*0-9[^\]]*\][^"']*["']\s*,\s*["']{2}/gi) || [];
  for (const pat of reSubMatches) {
    const cls = (/\[\^([^\]]+)\]/.exec(pat) || [])[1] || "";
    if (!/[-−–]/.test(cls)) {
      add(`${prefix}가 re.sub 숫자 정리에서 '-' 부호를 허용하지 않아 음수를 양수로 만들 수 있습니다. 정규식 숫자 정리 시 마이너스 부호를 보존하세요.`);
      break;
    }
  }
  const removesAccountingParens = /(?:\.replace|Replace)\s*\([^)]*["']\(["']\s*,\s*["']{2}/i.test(scan)
    && /(?:\.replace|Replace)\s*\([^)]*["']\)["']\s*,\s*["']{2}/i.test(scan);
  const hasAccountingNegativeHandling = /\b(?:neg|negative|isNegative|is_negative)\b|-\s*abs\s*\(|-\s*Abs\s*\(|\*\s*-1\b|\bIf\b[\s\S]{0,120}<\s*0/i.test(scan);
  if (removesAccountingParens && !hasAccountingNegativeHandling) {
    add(`${prefix}가 회계식 음수 괄호 '(1,234)'의 괄호만 제거해 양수로 만들 수 있습니다. 괄호 음수는 -1234 로 변환하세요.`);
  }
  return failures;
}

function isBenignRepeatedCodeLine(line) {
  const t = String(line || "").trim();
  return /^(?:End\s+(?:If|With|Select|Sub|Function|Property|Type)|Next(?:\s+\w+)?|Else|Loop|Wend|Cleanup:|Finally:|Try:|Except\b.*|pass|continue)$/i.test(t);
}

// [0.5.2 이식·하이브리드] degenerate 출력 감지 — 준-greedy 디코딩의 Qwen 이 같은 줄을 끝없이
// 반복하는 경우. VBA 의 End If/Next 같은 정상 구조 반복은 제외한다.
function pythonDegenerateOutputFailure(code) {
  const lines = String(code || "").split("\n");
  const counts = {};
  let maxRepeat = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length < 6) continue; // 빈 줄·괄호 등 자연스러운 반복은 허용
    if (isBenignRepeatedCodeLine(line)) continue;
    const n = (counts[line] || 0) + 1;
    counts[line] = n;
    if (n > maxRepeat) maxRepeat = n;
  }
  if (maxRepeat >= 8) {
    return "같은 코드 줄이 비정상적으로 여러 번 반복되었습니다. 반복 없이, 필요한 로직만 간결하게 다시 생성해 주세요(비슷한 처리는 for 루프로 묶기).";
  }
  return null;
}

// [0.5.2 이식·하이브리드] COM 폴백(# B2B_ENGINE_FALLBACK: excel-com) 코드 한정 bulk 위반 검사.
// openpyxl(인프로세스) 코드는 셀 루프가 빨라 대상이 아니고, COM 은 셀 단위 호출이 왕복당 느려
// 루프 내 COM 쓰기/전체 열 연산/Select·Activate 를 차단한다.

function codeHasBroadValueRewrite(code) {
  const text = String(code || "");
  const newSheetVars = new Set();
  const newSheetRe = /\bSet\s+([A-Za-z_]\w*)\s*=\s*[^\n\r']*\bWorksheets\s*\.\s*Add\b/gi;
  let newSheetMatch;
  while ((newSheetMatch = newSheetRe.exec(text)) !== null) {
    newSheetVars.add(String(newSheetMatch[1] || "").toLowerCase());
  }
  const isNewSheetWriteLine = (line) => {
    if (!newSheetVars.size || !/\.\s*(?:Value|Value2)\s*=/.test(line)) return false;
    return Array.from(newSheetVars).some(varName => {
      const re = new RegExp("\\b" + varName + "\\s*\\.\\s*(?:Range|Cells)\\s*\\(", "i");
      return re.test(line);
    });
  };
  const scanText = text.split(/\r?\n/).filter(line => !isNewSheetWriteLine(line)).join("\n");
  if (/\bUsedRange\s*\.Value\s*=/.test(scanText)) return true;
  if (/\bRange\s*\([^'\n\r]*(lastCol|xlToLeft|Columns\.Count)[^'\n\r]*\)\s*\.Value\s*=/i.test(scanText)) return true;
  if (/\bRange\s*\(\s*"[$]?[A-Z]+:[$]?[A-Z]+"\s*\)\s*\.Value\s*=/i.test(scanText)) return true;
  if (/\bColumns\s*\([^)]*\)\s*\.Value\s*=/i.test(scanText)) return true;

  const broadRangeVars = new Set();
  const setRe = /\bSet\s+([A-Za-z_]\w*)\s*=\s*([^\n\r']+)/gi;
  let match;
  while ((match = setRe.exec(scanText)) !== null) {
    const varName = match[1];
    const expr = match[2] || "";
    const targetsNewSheet = Array.from(newSheetVars).some(sheetVar =>
      new RegExp("\\b" + sheetVar + "\\s*\\.\\s*(?:Range|Cells)\\s*\\(", "i").test(expr)
    );
    if (targetsNewSheet) continue;
    const isBroadRange = /\bUsedRange\b/i.test(expr)
      || (/\bRange\s*\(/i.test(expr) && /\b(lastCol|xlToLeft|Columns\.Count)\b/i.test(expr))
      || /\bRange\s*\(\s*"[$]?[A-Z]+:[$]?[A-Z]+"/i.test(expr)
      || /\bColumns\s*\(/i.test(expr);
    if (isBroadRange) {
      broadRangeVars.add(varName.toLowerCase());
    }
  }

  for (const varName of broadRangeVars) {
    const writeRe = new RegExp("\\b" + varName + "\\s*\\.\\s*Value\\s*=", "i");
    if (writeRe.test(scanText)) return true;
  }

  const roundTripRe = /\b([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*\.Value\b[\s\S]{0,4000}\b\2\s*\.Value\s*=\s*\1\b/i;
  const roundTrip = roundTripRe.exec(scanText);
  if (roundTrip) {
    const rangeVar = (roundTrip[2] || "").toLowerCase();
    return broadRangeVars.has(rangeVar);
  }
  return false;
}

// VBA 적용 직전 정적 안전 필터(런타임에 주입되기 전 차단). 평가 하니스
// (tests/vba_regression/vba_static_checks.py)의 hard-block 패턴을 exe 로 포팅한 것.
// 위반 시 자동으로 Qwen 재생성 → 재검사(최대 VBA_STATIC_MAX_REGEN 회) 후에도 실패하면
// 사용자에게 차단 안내한다. (정적 FAIL 실패는 '정상 응답이지만 위험'이라 재생성 대상.)
const VBA_STATIC_MAX_REGEN = 1;
// Python 정적 게이트는 2회 실패(최초 1회 + 재생성 1회)면 더 끌지 않고 바로 VBA 전환한다.
// (Python COM 기반 제약일 가능성이 높은데 같은 제약으로 3번째 재생성을 돌리는 것은 낭비.)
const PYTHON_STATIC_MAX_REGEN = 1;

function vbaStaticSafetyFailures(code, sourceUserMessage) {
  // 주석 제거 후 검사 — "' Workbooks.Open 금지" 같은 규칙 메아리 주석이 오탐되지 않게.
  const text = _stripVbaCommentsForGate(code);
  const failures = [];
  const blocked = [
    [/\bOn\s+Error\s+Resume\s+Next\b/i, "On Error Resume Next 로 오류를 삼키면 안 됩니다(실패가 '적용됨'으로 오보). 실패는 Err.Raise 로 전파하거나 On Error GoTo Cleanup 으로 상태 원복 후 재전파하세요."],
    [/\bMsgBox\s*(?:\(|\s)/i, "MsgBox 는 자동 실행을 멈춥니다. 제거하고 실패는 Err.Raise 로 알리세요."],
    [/\bInputBox\s*(?:\(|\s)/i, "InputBox 는 자동 실행을 멈춥니다. 제거하세요."],
    [/\bShell\s*(?:\(|\s)/i, "Shell 실행은 금지입니다."],
    [/\bWorkbooks\s*\.\s*Open\b/i, "Workbooks.Open 금지(다른 파일을 열지 마세요). 이미 열린 워크북만 다루세요."],
    [/\bApplication\s*\.\s*Quit\b/i, "Application.Quit 금지."],
    [/\.(?:Save|SaveAs|SaveCopyAs|Close)\b/i, "Save/SaveAs/Close 금지(파일 저장·닫기를 코드에서 하지 마세요)."],
    [/\bContinue\s+For\b/i, "Excel VBA에는 Continue For 문법이 없습니다. 빈 토큰은 If Len(...) > 0 Then ... End If 로 감싸거나 GoTo 라벨을 사용하세요."],
  ];
  for (const [re, msg] of blocked) {
    if (re.test(text)) failures.push(msg);
  }
  if (/\b[A-Za-z_][A-Za-z0-9_]*\s*\([^()\r\n]*,\s*\)/.test(text)) {
    failures.push("VBA 문법 오류: 함수/배열 호출에서 쉼표 뒤 인수가 비어 있습니다. 예: dataArr(1, ) 같은 코드는 실행할 수 없습니다.");
  }
  // 파일/네트워크용 CreateObject 금지.
  // 허용 객체는 Excel 런타임 안에서 메모리 자료구조/문자열 처리만 수행하는 것에 한정한다.
  const coRe = /\bCreateObject\s*\(\s*["']([^"']+)["']\s*\)/gi;
  let m;
  while ((m = coRe.exec(text)) !== null) {
    const progId = String(m[1]).toLowerCase();
    const allowedObjects = new Set([
      "scripting.dictionary",
      "system.collections.arraylist",
      "vbscript.regexp",
    ]);
    if (!allowedObjects.has(progId)) {
      failures.push(`CreateObject("${m[1]}") 금지(Scripting.Dictionary/System.Collections.ArrayList/VBScript.RegExp 외 파일/네트워크 객체 생성 불가).`);
    }
  }
  const mutatesAppState = /\bApplication\s*\.\s*(?:ScreenUpdating|Calculation|EnableEvents|DisplayAlerts)\s*=/i.test(text);
  if (mutatesAppState) {
    const hasCleanupHandler = /\bOn\s+Error\s+GoTo\s+Cleanup\b/i.test(text) && /^\s*Cleanup\s*:/im.test(text);
    const restoresState = /\bApplication\s*\.\s*(?:ScreenUpdating|Calculation|EnableEvents|DisplayAlerts)\s*=/gi.test(text.replace(/\bApplication\s*\.\s*(?:ScreenUpdating|Calculation|EnableEvents|DisplayAlerts)\s*=\s*(?:False|xlCalculationManual)\b/gi, ""));
    if (!hasCleanupHandler || !restoresState) {
      failures.push("Application.ScreenUpdating/Calculation/EnableEvents/DisplayAlerts 를 바꾸는 VBA는 오류가 나도 반드시 Cleanup 라벨에서 원복해야 합니다. On Error GoTo Cleanup, prevCalc 저장, Cleanup: 원복 후 Err.Raise 패턴으로 작성하세요.");
    }
  }
  // 발신번호/ID 같은 식별자 피벗은 결과 열을 텍스트 서식으로 먼저 잡아야 한다.
  // 값을 쓴 뒤 NumberFormat="@"를 적용하면 Excel 이 이미 선행 0을 제거한 상태라 복구되지 않는다.
  // 주의: 'ID' 는 단어경계(\bID\b)로 — 안 그러면 mIdx/bIdx 같은 루프 변수의 'Id' 에 오탐해
  // 일반 숫자 피벗(지점/월/매출)을 '식별자 피벗'으로 잘못 보고 NumberFormat="@" 안전재생성을 유발한다.
  // [오탐 수정] 1) sourceUserMessage 는 routingIntentText 로 '정확 참조' 에코를 지운다 — 규칙문의
  //   "컬럼명은 '코드'에 그대로 복사하세요"(소스코드의 '코드')가 예전 bare '코드' 토큰에 걸려, 상품명
  //   피벗(선행 0 없는 텍스트 키)까지 '식별자 피벗'으로 오판해 NumberFormat="@" 재생성을 유발했다.
  //   2) bare 번호/코드/계정 대신 '복합 식별자어'만 본다(발신/전화/가입번호·EID·ID·식별자 등).
  const idPivotBlob = (typeof routingIntentText === "function" ? routingIntentText(String(sourceUserMessage || "")) : String(sourceUserMessage || "")) + "\n" + text;
  const idPivotIntent = /(피벗|pivot|그룹|요약|호유형|분리|열로)/i.test(idPivotBlob)
    && /(발신번호|전화번호|휴대폰번호|가입번호|고객번호|계약번호|계좌번호|사업자번호|주민(?:등록)?번호|우편번호|청구계정번호|계정번호|\bEID\b|\bID\b|식별자)/i.test(idPivotBlob);
  if (idPivotIntent) {
    const fmtMatch = /(?:Columns\s*\(\s*(?:1|"A"|'A')\s*\)|Range\s*\(\s*["']A:A["']\s*\))\s*\.\s*NumberFormat\s*=\s*["']@["']/i.exec(text);
    const dataWriteMatch = /(?:Cells\s*\(\s*(?:outRow|outR|rowNo|rIdx|kIdx\s*\+\s*\d+)\s*,\s*1\s*\)\s*\.\s*(?:Value|Value2)|Range\s*\(\s*["']A[2-9]\d*:?)/i.exec(text);
    if (!fmtMatch) {
      failures.push("발신번호/ID 같은 식별자 피벗 결과 열은 값을 쓰기 전에 Columns(1).NumberFormat = \"@\" 로 텍스트 서식을 지정하세요.");
    } else if (dataWriteMatch && fmtMatch.index > dataWriteMatch.index) {
      failures.push("식별자 결과 열 NumberFormat=\"@\" 가 데이터 쓰기 뒤에 있습니다. 시트 생성 직후, 데이터 쓰기 전에 적용하세요.");
    }
  }
  // VBA For Each 제어 변수는 Variant/Object 여야 한다. Dictionary.Keys 를 String 변수로 돌리면
  // "For Each control variable must be Variant or Object" 컴파일 오류로 매크로가 실행되지 않는다.
  const scalarDecls = new Map();
  const scalarDeclRe = /(?:\bDim|,)\s+([A-Za-z_][A-Za-z0-9_]*)\s+As\s+(String|Long|Integer|Double|Currency|Single|Date|Boolean)\b/gi;
  let declMatch;
  while ((declMatch = scalarDeclRe.exec(text)) !== null) {
    scalarDecls.set(String(declMatch[1]).toLowerCase(), String(declMatch[2]));
  }
  const forEachRe = /\bFor\s+Each\s+([A-Za-z_][A-Za-z0-9_]*)\s+In\b/gi;
  let forEachMatch;
  while ((forEachMatch = forEachRe.exec(text)) !== null) {
    const varName = String(forEachMatch[1] || "");
    const scalarType = scalarDecls.get(varName.toLowerCase());
    if (scalarType) {
      failures.push(`For Each 제어 변수 '${varName}' 가 ${scalarType} 로 선언되어 있습니다. Dictionary/Collection 순회 변수는 Variant 또는 Object 로 선언하세요.`);
    }
  }
  const timeToSecondsIntent = /(시간|time).{0,20}(초|second)|초.{0,20}(환산|변환|계산)/i.test(String(sourceUserMessage || ""));
  if (timeToSecondsIntent) {
    const hasTextTimeBranch = /\b(?:Split|TimeValue|DateDiff)\s*\(|\bInStr\s*\([^)]*["']:["']/i.test(text);
    const hasSerialHandling = /86400|\b(?:TimeValue|DateDiff)\s*\(/i.test(text);
    if (!hasTextTimeBranch) {
      failures.push("시간을 초로 환산하는 VBA는 '01:02:03' 같은 콜론 텍스트를 Split/InStr/TimeValue/DateDiff 로 처리해야 합니다. IsNumeric 분기만 있으면 텍스트 시간이 건너뜁니다.");
    }
    if (!hasSerialHandling) {
      failures.push("Excel 시간 시리얼(0~1 숫자)을 초로 바꾸는 86400 처리도 포함하세요.");
    }
  }
  if (/\bColumns\s*\.\s*Count\b[\s\S]{0,80}\.\s*End\s*\(\s*xlToRight\s*\)/i.test(text)) {
    failures.push("마지막 열 계산에서 Columns.Count 기준 End(xlToRight)는 XFD 끝열로 잡혀 오작동합니다. End(xlToLeft)를 쓰세요.");
  }
  const exactReferenceIntent = /@(?:범위|시트|파일|컬럼)\s*\[|정확\s*(?:참조|파일명|시트명|주소|범위)|선택\s*범위\s*:/i.test(String(sourceUserMessage || ""));
  if (exactReferenceIntent && /\b(?:ActiveWorkbook\s*\.\s*)?ActiveSheet\b/i.test(text)) {
    failures.push("@범위/@시트/정확 참조가 있는 VBA가 ActiveSheet 에 의존합니다. 사용자가 지정한 정확한 Workbooks(\"파일명\").Worksheets(\"시트명\") 또는 해당 Worksheet 변수로 범위를 잡으세요.");
  }
  if (/\bUsedRange\b/i.test(text)
      && /\bFor\s+Each\s+[A-Za-z_][A-Za-z0-9_]*\s+In\s+[A-Za-z_][A-Za-z0-9_]*\s*\.\s*Cells\b/i.test(text)) {
    failures.push("UsedRange.Cells 를 셀 단위 For Each 로 순회하면 큰 파일에서 Excel RPC 타임아웃/멈춤이 발생합니다. 실제 대상 범위를 한정하거나, 서식 변경은 Range.NumberFormat 같은 범위 단위 작업으로 처리하세요.");
  }
  failures.push(...negativeSignLossFailures(text, sourceUserMessage, "VBA 코드"));
  const formulaPreserveIntent = /수식\s*(?:셀)?\s*(?:제외|건너|유지|보존)|(?:제외|건너|유지|보존)\s*.*수식/i.test(String(sourceUserMessage || ""));
  if (formulaPreserveIntent
      && /\bHasFormula\b/i.test(text)
      && /\b(?:rng|targetRng|dstRng|range|targetRange)\s*\.\s*(?:Value|Value2)\s*=\s*(?:outArr|arr|values|dataArr)\b/i.test(text)) {
    failures.push("수식 셀을 제외/보존해야 하는 VBA가 범위 전체를 배열로 다시 써서 수식 셀까지 값으로 바꿀 수 있습니다. HasFormula=False 인 셀만 개별 갱신하세요.");
  }
  if (typeof filterToNewSheetIntent === "function" && filterToNewSheetIntent(sourceUserMessage)) {
    const createsSheet = /\bWorksheets\s*\.\s*Add\b/i.test(text);
    const writesArrayToNewSheet = /\b(?:wsNew|newWs|wsOut|outWs|resultWs|dstWs)\s*\.\s*Range\s*\([^'\r\n]*\)\s*\.\s*(?:Value|Value2)\s*=\s*(?:outArr|dataArr|arr|resultArr|values)\b/i.test(text)
      || /\bRange\s*\([^'\r\n]*\)\s*\.\s*(?:Value|Value2)\s*=\s*(?:outArr|dataArr|arr|resultArr|values)\b/i.test(text);
    const preservesByCopy = /\.\s*Copy\b|Copy\s+Destination\s*:=|PasteSpecial/i.test(text);
    const hasTextProtection = /\.\s*NumberFormat\s*=\s*["']@["']/i.test(text) && /\.\s*Text\b/i.test(text);
    if (createsSheet && writesArrayToNewSheet && !preservesByCopy && !hasTextProtection) {
      failures.push("필터 결과를 새 시트에 배열 Value로 다시 쓰면 긴 숫자 ID/번호가 과학표기나 15자리 손실로 바뀔 수 있습니다. 원본 행/범위를 Copy Destination으로 복사하거나, 식별자 컬럼은 쓰기 전에 NumberFormat=\"@\" 설정 후 .Text 값으로 보존하세요.");
    }
  }
  // [EID/긴 숫자 텍스트 손상 방지] '<var> = <멀티셀 범위>.Value' 로 읽어 '<범위>.Value = <var>' 로 되쓰는
  // 라운드트립은 긴 숫자 텍스트(EID/가입번호 32자리 등)를 8.9E+31 로 손상시킨다(서로 다른 값이 같은 수로
  // 뭉개져 정렬 불가). 변수명(srcData 등)과 무관하게, 멀티셀 범위 읽기→.Value 되쓰기 패턴을 잡는다.
  {
    const arrReadVars = [];
    const arrReadRe = /^[ \t]*([A-Za-z_]\w*)\s*=\s*[^\n]*(?:Cells\s*\([^\n]*Cells\s*\(|Range\s*\([^\n]*:|UsedRange)[^\n]*\.\s*(?:Value|Value2)\s*\r?$/gim;
    let arm;
    while ((arm = arrReadRe.exec(text)) !== null) arrReadVars.push(arm[1]);
    const movesArrayByValue = arrReadVars.some(v =>
      new RegExp("\\.\\s*(?:Value|Value2)\\s*=\\s*" + v + "\\b", "i").test(text));
    if (movesArrayByValue) {
      failures.push("범위를 .Value 배열로 읽어 다른 범위에 .Value 로 되쓰면 긴 숫자 텍스트(EID/가입번호 등 16자리+)가 8.9E+31 처럼 손상돼 정렬이 깨집니다. 데이터 이동은 원본 범위를 네이티브 .Copy Destination:= 로 복사하거나, 값만 필요하면 .Copy 후 PasteSpecial Paste:=xlPasteValuesAndNumberFormats 로 옮기세요(긴 텍스트·서식 보존).");
    }
  }
  const requestedCols = requestedExcelColumnLetters(sourceUserMessage);
  const requestedColIndices = new Set(requestedCols.map(excelColumnLetterToIndex).filter(Boolean));
  const requestedMultiCols = requestedCols.filter(c => c.length >= 2);
  if (requestedMultiCols.length) {
    const colVarAssignRe = /\b([A-Za-z_][A-Za-z0-9_]*(?:Col|Column|col|column)[A-Za-z0-9_]*)\s*=\s*(\d{1,5})\b/gi;
    let colVarAssignMatch;
    while ((colVarAssignMatch = colVarAssignRe.exec(text)) !== null) {
      const varName = String(colVarAssignMatch[1] || "");
      const assigned = Number(colVarAssignMatch[2]);
      for (const col of requestedMultiCols) {
        const expected = excelColumnLetterToIndex(col);
        const varMentionsCol = new RegExp(col.split("").join("[_\\s]*"), "i").test(varName);
        if (varMentionsCol && assigned !== expected) {
          failures.push(`${varName} = ${assigned} 로 되어 있지만 ${col}열은 ${expected}입니다. BP/BQ 같은 다중문자 열 번호를 암산하지 말고 ws.Columns("${col}").Column 또는 ws.Cells(r, "${col}")처럼 열 문자를 그대로 쓰세요.`);
        }
      }
    }
    const numericColUses = new Set();
    const cellNumRe = /\bCells\s*\(\s*[^,\n\r()]+,\s*(\d{2,5})\s*\)/gi;
    let cellNumMatch;
    while ((cellNumMatch = cellNumRe.exec(text)) !== null) {
      numericColUses.add(Number(cellNumMatch[1]));
    }
    const columnsNumRe = /\bColumns\s*\(\s*(\d{2,5})\s*\)/gi;
    while ((cellNumMatch = columnsNumRe.exec(text)) !== null) {
      numericColUses.add(Number(cellNumMatch[1]));
    }
    const unexpected = [...numericColUses]
      .filter(n => n >= 27 && n <= 16384 && !requestedColIndices.has(n))
      .sort((a, b) => a - b);
    if (unexpected.length) {
      const expected = requestedMultiCols
        .map(c => `${c}=${excelColumnLetterToIndex(c)}`)
        .join(", ");
      failures.push(`요청에 ${requestedMultiCols.join(", ")} 열이 명시되어 있는데 코드가 다른 다중문자 열 번호(${unexpected.join(", ")})를 하드코딩했습니다. ${expected} 입니다. 열 번호를 추측하지 말고 Columns("BP")/Range("BP" & r) 같은 열 문자 참조 또는 검증된 변환 함수를 쓰세요.`);
    }
    const quotedColRe = /\b(?:Range|Columns)\s*\(\s*["']\$?([A-Z]{2,3})(?::\$?([A-Z]{2,3}))?/gi;
    let quotedMatch;
    const unexpectedLetters = new Set();
    while ((quotedMatch = quotedColRe.exec(text)) !== null) {
      for (const col of [quotedMatch[1], quotedMatch[2]]) {
        if (col && !requestedCols.includes(String(col).toUpperCase())) {
          unexpectedLetters.add(String(col).toUpperCase());
        }
      }
    }
    if (unexpectedLetters.size) {
      failures.push(`요청에 없는 다중문자 열(${[...unexpectedLetters].join(", ")})을 참조했습니다. BP/BQ 같은 열 문자는 한 글자 열과 달리 숫자 변환 실수가 잦으므로 요청 열 문자 그대로 사용하세요.`);
    }
  }
  if (multiValueLookupIntent(sourceUserMessage)) {
    if (/\bInStr\s*\(/i.test(text) || /\bLike\b/i.test(text)) {
      failures.push("가입번호/코드가 한 셀에 여러 개 들어 있는 조회는 부분일치(InStr/Like)가 아니라 셀 값을 구분자로 분리한 토큰과 BP/키 값을 정확 일치 비교해야 합니다.");
    }
    const writesWholeRangeArray = /\b(?:targetRng|outRng|dstRng|resultRng|rng)\s*\.\s*(?:Value|Value2)\s*=\s*(?:[A-Za-z_]\w*)?(?:Arr|Array|Values|Data)\b/i.test(text)
      || String(text || "").split(/\r?\n/).some(line =>
        /\bRange\s*\(/i.test(line)
        && /\.\s*(?:Value|Value2)\s*=\s*[A-Za-z_]\w*(?:Arr|Array|Values|Data)\b/i.test(line)
        && /(?:\b(?:hCol|targetColOut|targetCol|outCol|resultCol)\b|Cells\s*\([^)]*,\s*(?:8|["']H["'])\s*\)|["']H)/i.test(line)
      );
    if (writesWholeRangeArray) {
      failures.push("다중 가입번호 매칭 결과를 H열 전체 배열로 다시 쓰면 매칭 없는 행과 합계 수식이 0/값으로 오염됩니다. 매칭된 행의 H셀만 갱신하고 미매칭/수식 행은 그대로 두세요.");
    }
    if (/\bCells\s*\(\s*r\s*,\s*(?:targetColOut|8)\s*\)\s*\.\s*(?:Value|Value2)\s*=\s*totalAmount\b/i.test(text)
        && !/\b(?:matchFound|matched|hasMatch)\b/i.test(text)
        && !/\bIf\s+totalAmount\s*>\s*0\b/i.test(text)) {
      failures.push("다중 가입번호 매칭에서 totalAmount=0 을 H열에 무조건 쓰면 미매칭 행이나 '부가세포함' 합계 행의 수식이 0으로 덮입니다. 매칭된 데이터 행에서만 쓰고, P열이 요약 라벨인 행은 제외하세요.");
    }
  }
  if (typeof duplicateRowDeleteIntent === "function" && duplicateRowDeleteIntent(sourceUserMessage)) {
    const readsWholeExcelGrid = /\bRange\s*\(\s*["']\$?[A-Z]{1,3}:\$?[A-Z]{1,3}["']\s*\)\s*\.\s*(?:Value|Value2)\b/i.test(text)
      || /\bColumns\s*\([^)]*\)\s*\.\s*(?:Value|Value2)\b/i.test(text)
      || /\bRows\s*\([^)]*\)\s*\.\s*(?:Value|Value2)\b/i.test(text)
      || /\bRange\s*\(\s*(?:ws\.)?Cells\s*\(\s*1\s*,\s*1\s*\)\s*,\s*(?:ws\.)?Cells\s*\(\s*(?:ws\.)?Rows\.Count\s*,\s*(?:ws\.)?Columns\.Count\s*\)\s*\)\s*\.\s*(?:Value|Value2)\b/i.test(text);
    if (readsWholeExcelGrid) {
      failures.push("대량 조건부 중복 행 삭제에서 행 번호 없는 전체 열/전체 시트 값을 통째로 읽지 마세요. 실제 lastRow/lastCol 로 한정된 데이터 범위는 허용되며, 가능하면 필요한 열(E=상품명, M=수납금액, T=EID)만 읽으세요.");
    }
    const rowDeleteLoop = /\bFor\b[\s\S]{0,1800}\b(?:Rows\s*\([^\n\r]*\)|EntireRow)\s*\.\s*Delete\b/i.test(text);
    if (rowDeleteLoop && !/\bAutoFilter\b/i.test(text)) {
      failures.push("대량 중복 행 삭제에서 Rows(...).Delete 를 루프 안에서 반복하면 30만 행 파일에서 타임아웃됩니다. 보조열에 삭제표시를 한 뒤 AutoFilter 로 표시된 행을 한 번에 삭제하세요.");
    }
    if (/\bFor\s+\w+\s*=\s*0\s+To\s+\w+\s*-\s*2\b[\s\S]{0,1400}\bFor\s+\w+\s*=\s*\w+\s*\+\s*1\s+To\b/i.test(text)) {
      failures.push("삭제 행 목록 정렬에 이중 For 버블정렬을 쓰지 마세요. System.Collections.ArrayList 에 Add 후 .Sort 를 쓰거나, 보조열+AutoFilter 패턴으로 정렬 자체를 피하세요.");
    }
    if (/\bIf\s+del(?:List|Dict|Rows|Keys)?\.Count\s*=\s*0\s+Then\s+Err\.Raise/i.test(text)) {
      failures.push("조건부 중복 제거에서 삭제 대상이 0건이면 오류가 아니라 정상 no-op 으로 종료하세요. 이미 중복이 정리된 상태에서도 스킬 생성이 막히면 안 됩니다.");
    }
  }
  if (typeof conditionalRowDeleteIntent === "function" && conditionalRowDeleteIntent(sourceUserMessage)) {
    const rowDeleteLoop = /\bFor\b[\s\S]{0,1800}\b(?:Rows\s*\([^\n\r]*\)|EntireRow)\s*\.\s*Delete\b/i.test(text);
    if (rowDeleteLoop && !/\bAutoFilter\b/i.test(text)) {
      failures.push("조건부 행 삭제에서 Rows(...).Delete 를 루프 안에서 반복하면 큰 파일에서 앱이 멈춥니다. 임시 보조열에 삭제 대상만 표시한 뒤 AutoFilter + SpecialCells(xlCellTypeVisible).EntireRow.Delete 로 한 번에 삭제하세요.");
    }
    const visibleRangeVars = [];
    const visibleRangeAssignRe = /\bSet\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^\r\n]*\.\s*SpecialCells\s*\(\s*xlCellTypeVisible\s*\)/gi;
    let visibleRangeAssignMatch;
    while ((visibleRangeAssignMatch = visibleRangeAssignRe.exec(text)) !== null) {
      visibleRangeVars.push(String(visibleRangeAssignMatch[1] || ""));
    }
    const badVisibleOffsetDelete = /\.\s*SpecialCells\s*\(\s*xlCellTypeVisible\s*\)\s*\.\s*Offset\s*\(\s*1\s*,\s*0\s*\)\s*\.\s*Resize[\s\S]{0,600}\.\s*EntireRow\s*\.\s*Delete\b/i.test(text)
      || visibleRangeVars.some(varName => new RegExp("\\b" + varName + "\\s*\\.\\s*Offset\\s*\\(\\s*1\\s*,\\s*0\\s*\\)\\s*\\.\\s*Resize[\\s\\S]{0,600}\\.\\s*EntireRow\\s*\\.\\s*Delete\\b", "i").test(text));
    if (badVisibleOffsetDelete) {
      failures.push("AutoFilter 후 SpecialCells(xlCellTypeVisible) 결과에 Offset/Resize 를 걸어 삭제하면 필터된 비연속 행에서 삭제 범위가 틀리거나 no-op 이 됩니다. 헤더를 제외한 명시적 데이터 본문 범위(hdrRow+1:lastRow)를 따로 잡고, 그 범위의 SpecialCells(xlCellTypeVisible).EntireRow.Delete 만 실행하세요.");
    }
    const dateConditionIntent = /\b20\d{6}\b|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|날짜|이전|이후|전이면|후이면/i.test(String(sourceUserMessage || ""));
    const dateNormalizationCode = /\b(?:NormalizeDate|dateVal|yyyymmdd|DateSerial|IsDate|CDate|Format\$?)\b/i.test(text);
    const handlesExcelDateSerial = /\bIsDate\s*\(|\bCDate\s*\(|\bDateSerial\s*\(\s*1899\s*,\s*12\s*,\s*30\s*\)|\bFormat\$?\s*\([^)]*["']yyyymmdd["']/i.test(text);
    const treatsTimeSerialAsDate = /\b[A-Za-z_][A-Za-z0-9_]*\s*>\s*0\s+And\s+[A-Za-z_][A-Za-z0-9_]*\s*<\s*1\b[\s\S]{0,120}(?:86400|Excel\s+serial)/i.test(text);
    if (dateConditionIntent && dateNormalizationCode && (!handlesExcelDateSerial || treatsTimeSerialAsDate)) {
      failures.push("날짜 조건 행 삭제는 20260401 같은 8자리 값뿐 아니라 2026-03-31 텍스트와 Excel 실제 날짜 시리얼도 yyyymmdd 정수로 변환해야 합니다. 날짜 시리얼을 v>0 And v<1 로 처리하면 시간값으로 오판되어 실제 날짜 행이 살아남습니다. Range.Text 확인 후 Range.Value 의 IsDate/CDate 또는 DateSerial(1899,12,30)+CLng(value) 처리를 포함하세요.");
    }
    if (/\b(?:Range|Columns)\s*\(\s*["']\$?[A-Z]{1,3}:\$?[A-Z]{1,3}["']\s*\)\s*\.\s*(?:Value|Value2)\b/i.test(text)
        || /\bRange\s*\(\s*(?:ws\.)?Cells\s*\(\s*1\s*,\s*1\s*\)\s*,\s*(?:ws\.)?Cells\s*\(\s*(?:ws\.)?Rows\.Count\s*,\s*(?:ws\.)?Columns\.Count\s*\)\s*\)\s*\.\s*(?:Value|Value2)\b/i.test(text)) {
      failures.push("조건부 행 삭제에서 행 번호 없는 전체 열/전체 시트 값을 통째로 읽지 마세요. 선택/요청 열의 실제 lastRow까지만 읽고 보조열+AutoFilter로 삭제하세요.");
    }
    if (/\bIf\s+\w*(?:Delete|Del|Target|Match|Rows?)\w*\.Count\s*=\s*0\s+Then\s+Err\.Raise/i.test(text)) {
      failures.push("조건부 행 삭제에서 삭제 대상이 0건이면 오류가 아니라 정상 no-op 으로 종료하세요.");
    }
  }
  const keyedOverwriteIntent = (
    /(가입번호|계약번호|청구번호|고객번호|ID|코드|키|key)/i.test(String(sourceUserMessage || ""))
    && /(일치|매칭|같은|동일|찾아서|찾아|기준으로|기준)/i.test(String(sourceUserMessage || ""))
    && /(행\s*전체|해당\s*행|그\s*행|row)/i.test(String(sourceUserMessage || ""))
    && /(덮어\s*씌|덮어쓰|갱신|업데이트|update|overwrite|반영)/i.test(String(sourceUserMessage || ""))
    && !/(피벗|pivot|크로스탭|행\s*으로.*열\s*로)/i.test(String(sourceUserMessage || ""))
  );
  if (keyedOverwriteIntent) {
    if (/\b(?:dstRange|dstRng|targetRange|targetRng|destRange|destRng|outRange|outRng|dataRange|dataRng|rng)\s*\.\s*(?:Value|Value2)\s*=\s*(?:dstArr|targetArr|destArr|outArr|arr|dataArr)/i.test(text)
        || /\b(?:wsDst|targetWs|dstWs|destWs)\s*\.\s*Range\s*\([^)]*\)\s*\.\s*(?:Value|Value2)\s*=\s*(?:dstArr|targetArr|destArr|outArr|arr|dataArr)/i.test(text)) {
      failures.push("키 매칭 행 덮어쓰기에서 대상 전체 범위를 배열로 다시 쓰면 미매칭 행/수식이 오염될 수 있습니다. 매칭된 대상 행만 한 행씩 갱신하세요.");
    }
    if (!/\.Text\b/i.test(text) && /\b(?:srcArr|dstArr|dataArr|arr)\s*\(/i.test(text)) {
      failures.push("가입번호/계약번호 같은 매칭 키를 배열 Value 로만 읽으면 앞 0/표시형식 차이로 매칭이 깨질 수 있습니다. 키 비교는 ws.Cells(row, keyCol).Text 를 정규화해서 사용하세요.");
    }
    if (/\bElse\b[\s\S]{0,240}(?:\.\s*(?:Value|Value2)\s*=\s*0|\w+\s*\([^)]*\)\s*=\s*0)/i.test(text)) {
      failures.push("키가 매칭되지 않은 행에 0을 쓰면 기존 청구 데이터가 오염됩니다. 미매칭 행은 그대로 두세요.");
    }
  }
  // 전체 시트 순회는 사용자가 "전체/모든 시트"를 명시했을 때만 허용.
  const allSheetIntent = /(\b(all|every)\s+sheets?\b|전체\s*시트|모든\s*시트|전\s*시트|시트\s*전체)/i.test(String(sourceUserMessage || ""));
  if (!allSheetIntent && /\bFor\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets\b/i.test(text)) {
    failures.push("'전체 시트' 요청이 아닌데 For Each ... In Worksheets 로 모든 시트를 순회합니다. 요청한 특정 시트만 대상으로 하세요.");
  }
  if (userExplicitlyRequestsForceProceed(sourceUserMessage)) {
    return failures.filter(isHardVbaStaticFailure);
  }
  return failures;
}

// 게이트 검사용 주석 제거 — 모델이 프롬프트의 금지 규칙을 주석으로 메아리치는 일이 흔한데
// ("# openpyxl 이 아니라 ctx 사용", "' Workbooks.Open 금지") 주석까지 검사하면 전부 오탐이 된다.
// 문자열 리터럴은 보존한다(CreateObject("...") 등 문자열 내용을 보는 검사가 있음).
function _stripPythonCommentsForGate(code) {
  return String(code || "").split("\n").map(line => {
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inStr) {
        if (ch === "\\") { i++; continue; }
        if (ch === inStr) inStr = null;
      } else if (ch === '"' || ch === "'") {
        inStr = ch;
      } else if (ch === "#") {
        return line.slice(0, i);
      }
    }
    return line;
  }).join("\n");
}

function _stripVbaCommentsForGate(code) {
  return String(code || "").split("\n").map(line => {
    if (/^\s*Rem\b/i.test(line)) return "";
    let inStr = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inStr = !inStr;
      else if (ch === "'" && !inStr) return line.slice(0, i);
    }
    return line;
  }).join("\n");
}

// ver0.5.2 4단계: Python COM 스킬용 클라이언트 정적 안전 검사(적용 직전 1차 게이트).
// 서버의 AST 게이트가 최종 권위이고, 여기서는 빠른 차단 + 자동 재생성을 위해 같은 규칙을
// 정규식 휴리스틱으로 검사한다.
function pythonComStaticSafetyFailures(code, sourceUserMessage) {
  const text = String(code || "");
  // 주석을 제거한 본문으로 금지 패턴을 검사한다(주석 속 키워드 오탐 방지).
  const scanText = _stripPythonCommentsForGate(text);
  const failures = [];
  if (!/def\s+transform\s*\(\s*ctx\s*\)\s*:/.test(text)) {
    failures.push("def transform(ctx): 진입 함수가 필요합니다.");
  }
  const blocked = [
    // [SBAGENT-296] 제공 모듈(re/datetime/math)의 '단순' import 는 무해한데 일률 차단 탓에
    // import datetime 한 줄이 재생성 1회를 태우고 VBA 폴백까지 밀었다(서버 게이트·샌드박스
    // __import__ 와 같은 정책: 단순형만 허용, as 별칭/from/미제공 모듈은 차단).
    [/^\s*from\s+\w+/m, "from-import 는 사용할 수 없습니다(re/datetime/math 는 이미 주어져 있음 — datetime.date 처럼 모듈 경로로 쓰세요)."],
    [/^\s*import\s+(?!(?:re|datetime|math)(?:\s*,\s*(?:re|datetime|math))*\s*(?:$|#))/m, "import 는 제공 모듈(re/datetime/math)의 단순 import 만 가능합니다(as 별칭 불가 — 이미 주어져 있으니 지워도 됩니다)."],
    // (?<![\w.]) — re.compile()/ctx.input() 같은 '제공 모듈/ctx 의 메서드 호출'은 빌트인이 아니다.
    // 서버 AST 게이트도 bare 이름 호출만 차단한다(속성 호출은 허용).
    [/(?<![\w.])(?:open|eval|exec|__import__|input|compile)\s*\(/, "open/eval/exec/__import__ 등 빌트인은 사용할 수 없습니다."],
    [/\b(?:win32com|openpyxl|subprocess|os\.|sys\.)/, "win32com/openpyxl/os/sys 모듈은 사용할 수 없습니다(ctx API 만 사용)."],
    [/\bload_workbook\s*\(|\bws\s*\[\s*["']/, 'openpyxl 관용구(ws["A1"], load_workbook)는 지원되지 않습니다. ctx.read()/ctx.write() 를 사용하세요.'],
    [/\.(?:Select|Activate)\s*\(/, ".Select/.Activate 는 사용할 수 없습니다."],
    [/\bActiveWorkbook\b|\bActiveSheet\b/, "ActiveWorkbook/ActiveSheet 에 의존하지 마세요(ctx 가 대상 파일에 고정되어 있음)."],
    [/while\s+(?:True|1)\s*:/, "while True 무한 루프는 금지입니다."],
    [/\.(?:Save|SaveAs|SaveCopyAs|Close|Quit)\s*\(/, "저장/닫기/종료 호출은 금지입니다."],
  ];
  for (const [re, msg] of blocked) {
    if (re.test(scanText)) failures.push(msg);
  }
  // [제보 2026-08-25 "0인 행 삭제" 스킬] '행 삭제' 요청에 filter_to_sheet 로 추출한 뒤 원본
  // 시트를 delete_sheet(+rename)로 '교체'하는 재구성이 생성됨 — 라이브 미러가 그 시트를 보고
  // 있어 적용 직후 화면이 깨졌다(정상 엑셀 화면 아님). 추출원본을 지우는 조합만 좁게 잡는다
  // (단순 시트 삭제·이동(copy_sheet 후 delete_sheet)은 정상 패턴이라 건드리지 않는다).
  {
    const ftsSrcs = Array.from(scanText.matchAll(/filter_to_sheet\s*\(\s*["']([^"']+)["']/g)).map(m => m[1]);
    const delSheets = Array.from(scanText.matchAll(/delete_sheet\s*\(\s*["']([^"']+)["']/g)).map(m => m[1]);
    // [SBAGENT-295] 시트 '이동' 흉내(임시시트 복사→원본 delete_sheet→같은 이름으로 rename)도
    // 같은 교체 재구성이다 — delete_sheet(X) 와 rename(→X) 조합이면 move_sheet 로 보낸다.
    const renameTargets = Array.from(scanText.matchAll(/rename_sheet\s*\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/g)).map(m => m[1]);
    const moveMimic = delSheets.find(n => renameTargets.includes(n));
    if (moveMimic) {
      failures.push(
        `시트 '${moveMimic}' 를 지우고 다른 시트 이름을 그 이름으로 바꾸는 '교체' 방식은 금지입니다 — `
        + "화면이 깨지고 틀고정·수식 참조가 사라집니다. 같은 파일 안 시트 위치 변경은 "
        + "ctx.move_sheet(시트, before=기준 또는 after=기준) 한 줄로 하세요(내용·이름 유지).",
      );
    }
    const replaced = delSheets.find(n => ftsSrcs.includes(n));
    if (replaced) {
      failures.push(
        `filter_to_sheet 로 추출한 원본 시트('${replaced}')를 delete_sheet 로 지워 '교체'하는 방식은 금지입니다 — `
        + "라이브 화면이 그 시트를 보고 있어 적용 직후 화면이 깨지고, 시트 순서·틀고정이 사라집니다. "
        + "조건에 맞는 행 삭제는 ctx.delete_rows_where(시트, predicate, header_rows=헤더행수) 로 '제자리에서' 삭제하세요"
        + "(predicate 는 데이터 행을 받아 True=삭제, 서식·수식·병합 보존).",
      );
    }
  }
  failures.push(...negativeSignLossFailures(scanText, sourceUserMessage, "Python 코드"));
  // 루프 내부의 ctx 쓰기 반복(셀 단위 COM 폭주) 휴리스틱 — 서버 AST 게이트와 동일 규칙.
  // 수신자는 ctx 와 ctx.book(...) 별칭만 본다 — (?:\w+)\. 로 아무 변수나 매칭하면
  // 루프 안의 일반 리스트 .copy()/.sort()/.clear() 까지 오탐으로 차단된다.
  {
    const ctxAliases = new Set(["ctx"]);
    const aliasRe = /(\w+)\s*=\s*(\w+)\s*\.\s*book\s*\(/g;
    let grew = true;
    while (grew) { // book = ctx.book(...), other = book.book(...) 같은 연쇄 별칭까지 수렴
      grew = false;
      let am;
      aliasRe.lastIndex = 0;
      while ((am = aliasRe.exec(scanText)) !== null) {
        if (ctxAliases.has(am[2]) && !ctxAliases.has(am[1])) { ctxAliases.add(am[1]); grew = true; }
      }
    }
    const recv = Array.from(ctxAliases).join("|");
    // 들여쓰기 인식: '루프 헤더보다 깊게 들여쓴 줄'만 루프 본문으로 본다.
    // [성능 수정] 이전엔 본문 전체를 한 정규식으로 매칭했는데 "(?:(?:\1[ \t]+...)?\n)*?" 의
    // '옵션 안 별표'가 catastrophic backtracking 을 일으켜, else/try/except 로 본문이 길어진
    // 코드의 [적용] 정적검사가 수 분간 멈췄다(저사양일수록 심함 — run-python 은 1초인데 검사가 수분).
    // 같은 의미를 줄 단위 스캔으로 대체한다 — 백트래킹 불가능, O(줄수).
    const ctxWriteRe = new RegExp(
      "\\b(?:" + recv + ")\\s*(?:\\.\\s*book\\s*\\([^\\n]*?\\))?" +   // ctx 또는 ctx.book("...") 체이닝
      "\\s*\\.\\s*(?:write|write_cell|write_formulas|insert_rows|insert_cols|merge|unmerge|sort)\\s*\\("
    );
    const _gateLines = scanText.split("\n");
    const _indentLen = (s) => /^[ \t]*/.exec(s)[0].length;
    let _loopWriteHit = false;
    for (let _i = 0; _i < _gateLines.length && !_loopWriteHit; _i++) {
      const _h = /^([ \t]*)(?:for|while)\s[^\n]*:[ \t]*$/.exec(_gateLines[_i]);
      if (!_h) continue;                              // 루프 헤더 줄이 아니면 skip
      const _headIndent = _h[1].length;
      for (let _j = _i + 1; _j < _gateLines.length; _j++) {
        const _ln = _gateLines[_j];
        if (_ln.trim() === "") continue;              // 빈 줄 — 아직 본문
        if (_indentLen(_ln) <= _headIndent) break;    // 들여쓰기가 헤더 이하로 빠짐 — 본문 끝
        if (ctxWriteRe.test(_ln)) { _loopWriteHit = true; break; }  // 루프 본문에서 ctx 쓰기 반복
      }
    }
    // [사용자 지시 2026-08-12] 루프 안 ctx 쓰기 반복은 더 막지 않는다 — 느릴 뿐 결과는 맞는
    // 코드였는데, 이 규칙 때문에 재생성 루프를 돌았다. 진짜 폭주는 실행 중 COM 호출 예산이 잡는다.
    // 되살리려면 window.B2B_PY_QUALITY_GATE = true.
    if (_loopWriteHit && typeof window !== "undefined" && window.B2B_PY_QUALITY_GATE === true) {
      failures.push("루프 안에서 ctx 쓰기 함수를 반복 호출하면 안 됩니다. 값을 2차원 리스트로 모은 뒤 ctx.write() 한 번으로 쓰세요.");
    }
  }
  if (/\bnon_none\s*=\s*\[[\s\S]{0,300}\bfor\b[\s\S]{0,120}\bif\b[\s\S]{0,120}is\s+not\s+None[\s\S]{0,900}\bctx\s*\.\s*write\s*\([^)]*\bnon_none\b/i.test(scanText)) {
    failures.push("None 행을 필터링한 결과(non_none)를 원래 시작 행에 다시 쓰면 중간 행이 위로 당겨져 다른 행/합계행을 오염시킵니다. 행 위치를 보존한 전체 2차원 배열로 쓰거나 VBA로 작성하세요.");
  }
  // degenerate 출력 감지: 준-greedy 디코딩의 Qwen 이 같은 줄을 끝없이 반복하거나
  // 단순 작업에 수백 줄을 토해내는 경우 — 적용 전에 걸러 간결 재생성을 유도한다.
  const lines = text.split("\n");
  const lineCounts = {};
  let maxRepeat = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 6) continue; // 빈 줄·괄호 등 자연스러운 반복은 허용
    if (typeof isBenignRepeatedCodeLine === "function" && isBenignRepeatedCodeLine(line)) continue;
    const n = (lineCounts[line] || 0) + 1;
    lineCounts[line] = n;
    if (n > maxRepeat) maxRepeat = n;
  }
  if (maxRepeat >= 8) {
    failures.push("같은 코드 줄이 비정상적으로 여러 번 반복되었습니다. 반복 없이, 필요한 로직만 간결하게 다시 작성하세요(비슷한 처리는 for 루프로 묶기).");
  }
  if (lines.length > 150) {
    failures.push("코드가 비정상적으로 깁니다. 요청을 만족하는 최소한의 코드(보통 40줄 이내)로 다시 작성하세요.");
  }
  // [정렬 헤더 보호] 사용자가 정렬을 요청했는데:
  //  (a) ctx.sort 없이 파이썬 .sort()/sorted() 로 정렬 후 ctx.write → 헤더가 데이터와 섞이고 행이 어긋남
  //  (b) has_header=False 를 명시 → 1행 헤더가 정렬에 휩쓸림
  if (typeof userRequestsSort === "function" && userRequestsSort(sourceUserMessage)) {
    const usesCtxSort = /ctx\.sort\s*\(/.test(scanText);
    const pySort = /(?:\.sort\s*\(|sorted\s*\()/.test(scanText);
    const writesBack = /ctx\.(?:write|write_cell|write_formulas)\s*\(/.test(scanText);
    if (!usesCtxSort && pySort && writesBack) {
      failures.push("정렬은 ctx.sort(시트, 범위, key_col=열문자, has_header=True) 로 하세요. read→파이썬 정렬→write 는 헤더가 데이터와 섞이고 다른 열이 행 단위로 어긋납니다.");
    }
    const headerFalseOnRowOneRange = /ctx\.sort\s*\([\s\S]{0,240}["'][A-Z]{1,3}\$?1\s*:/i.test(scanText)
      && /has_header\s*=\s*False/.test(scanText);
    if (usesCtxSort && headerFalseOnRowOneRange) {
      failures.push("표 1행이 헤더이므로 ctx.sort 에 has_header=True(기본값)를 쓰세요 — has_header=False 는 헤더 행을 정렬에 포함시킵니다.");
    }
  }
  {
    const colIndex = (col) => String(col || "").toUpperCase().split("").reduce((n, ch) => {
      const c = ch.charCodeAt(0);
      return c >= 65 && c <= 90 ? n * 26 + (c - 64) : n;
    }, 0);
    const estimateCells = (rangeText) => {
      const s = String(rangeText || "").replace(/\$/g, "").trim();
      let m = s.match(/^([A-Z]{1,3})(\d+)?\s*:\s*([A-Z]{1,3})(\d+)?$/i);
      if (!m) return null;
      const c1 = colIndex(m[1]), c2 = colIndex(m[3]);
      if (!c1 || !c2) return null;
      const cols = Math.abs(c2 - c1) + 1;
      if (!m[2] && !m[4]) return Number.POSITIVE_INFINITY; // A:A / A:U
      if (!m[2] || !m[4]) return null;
      const r1 = Number(m[2]), r2 = Number(m[4]);
      if (!Number.isFinite(r1) || !Number.isFinite(r2)) return null;
      return (Math.abs(r2 - r1) + 1) * cols;
    };
    const dynamicRangeTextIsWide = (rangeText) => {
      const s = String(rangeText || "").replace(/\$/g, "").trim();
      if (/last_col|col_letter|UsedRange/i.test(s)) return true;
      const m = s.match(/^([A-Z]{1,3})\d+\s*:\s*([A-Z]{1,3})(?:\d+|\{[^}]+\})$/i);
      if (!m) return false;
      return Math.abs(colIndex(m[2]) - colIndex(m[1])) + 1 > 1;
    };
    const hasRead = /\b(?:ctx|[A-Za-z_]\w*)\s*\.\s*read\s*\(/.test(scanText);
    const hasWrite = /\b(?:ctx|[A-Za-z_]\w*)\s*\.\s*(?:write|write_cell|write_formulas)\s*\(/.test(scanText);
    const hasPythonTransform = /\bfor\s+\w+\s+in\s+\w+|\bsorted\s*\(|\.\s*sort\s*\(|\.append\s*\(|\bfilter\s*\(|\blambda\b/i.test(scanText);
    if (hasRead && hasWrite) {
      let riskyRead = false;
      const readLiteralRe = /\.\s*read\s*\(\s*[^,\n]+,\s*[fF]?(["'`])([^"'`]+)\1/g;
      let rm;
      while ((rm = readLiteralRe.exec(scanText)) !== null) {
        const cells = estimateCells(rm[2]);
        if (cells === Number.POSITIVE_INFINITY || (cells !== null && cells >= 200000)) {
          riskyRead = true;
          break;
        }
      }
      let dynamicWideRead = false;
      const directFReadRe = /\.\s*read\s*\(\s*[^,\n]+,\s*f(["'`])([^"'`]+)\1/g;
      while ((rm = directFReadRe.exec(scanText)) !== null) {
        if (dynamicRangeTextIsWide(rm[2])) { dynamicWideRead = true; break; }
      }
      const rangeAssignRe = /\b(?:rng|range_|a1|src_range|read_range)\w*\s*=\s*f(["'`])([^"'`]+)\1/g;
      while (!dynamicWideRead && (rm = rangeAssignRe.exec(scanText)) !== null) {
        if (dynamicRangeTextIsWide(rm[2])) { dynamicWideRead = true; break; }
      }
      if (!dynamicWideRead) {
        dynamicWideRead = /\.\s*read\s*\(\s*[^,\n]+,\s*(?:rng|range_|a1|src_range|read_range)\w*\b/i.test(scanText)
          && /\blast_col\b|col_letter|UsedRange/i.test(scanText);
      }
      // [사용자 지시] '셀 갯수/큰 표 read' 를 이유로 Python 을 막지 않는다 — 대용량이어도 Python 으로 시도하게
      // 둔다(타임아웃·셀 상한도 무제한으로 풀림). 예전엔 riskyRead/dynamicWideRead 를 '큰 표 read 금지' 실패로
      // 올려 VBA 로 강제 전환했으나, 이제 그 강제는 하지 않는다(느릴 수 있으나 사용자가 감수). env 로 재활성 가능.
      if ((riskyRead || dynamicWideRead) && hasPythonTransform
          && typeof window !== "undefined" && window.B2B_BLOCK_BIG_PYTHON_READ === true) {
        failures.push(
          "큰 표를 ctx.read 로 Python 리스트에 올려 가공한 뒤 ctx.write 로 다시 쓰지 마세요. "
          + "대용량 파일에서 WebView/COM 응답이 멈추고 긴 숫자·날짜·서식이 손실될 수 있습니다. "
          + "복사/이어붙이기는 ctx.copy 또는 ctx.append_same_format_sheets, 정렬은 ctx.sort, 필터 새 시트는 VBA AutoFilter/전용 헬퍼를 쓰세요."
        );
      }
    }
  }
  return failures;
}

// 전용(네이티브) ctx 헬퍼를 쓰는 코드인지. 이 헬퍼들은 '읽기루프/행삭제 반복'이 아니라 Range 기반
// 한 번의 연산이라 큰 파일에서 멈출 위험이 없다 → 헬퍼가 있는 작업은 VBA 로 강제 전환하지 않는다.
// (read/write/write_cell/write_formulas/book 같은 '원시' 는 제외 — 오용/루프 가능. 그건 정적 안전
//  게이트가 별도로 계속 검사한다. 이 함수는 '의도 기반 VBA 강제'만 건너뛴다.)
function codeUsesSafeCtxHelper(code) {
  return /\bctx\s*\.\s*(?:copy_key_blocks|copy_values|copy_col|copy_sheet|paste_copied|copy|move_col_clear|move_cols|swap_cols|sort|pivot|filter_to_sheet|fill_sum_col|sum_column|append_same_format_sheets|shift_months|clear|delete_cols|delete_rows|insert_rows|insert_cols|merge|unmerge|add_sheet|rename_sheet|delete_sheet)\s*\(/i.test(String(code || ""));
}

function pythonComMustUseVbaReason(code, sourceUserMessage) {
  const source = String(sourceUserMessage || "");
  const text = String(code || "");
  // [결정적] 생성 코드가 이미 전용 ctx 헬퍼를 쓰면 그게 정답 경로다. 소스 문구가 뭐든(예: "중복이라고
  // 지우지 마" 처럼 삭제 키워드가 섞여도) VBA 로 강제 전환하지 않는다. → "헬퍼가 있는 건 VBA 없이 실행".
  if (codeUsesSafeCtxHelper(text)) {
    return "";
  }
  if (typeof appendSameFormatSheetsIntent === "function" && appendSameFormatSheetsIntent(source)) {
    return "";
  }
  if (typeof ctxHelperPreferredIntent === "function" && ctxHelperPreferredIntent(source)
      && /append_same_format_sheets\s*\(|ctx\.copy\s*\(|ctx\.sort\s*\(|ctx\.copy_sheet\s*\(|ctx\.filter_to_sheet\s*\(/i.test(text)) {
    return "";
  }
  if (typeof filterToNewSheetIntent === "function" && filterToNewSheetIntent(source)) {
    return "대용량 필터/값 찾기 후 새 시트 생성은 Python COM에서 전체 범위를 ctx.read로 직접 읽어 루프 처리하면 앱이 멈출 수 있습니다. 이 작업은 ctx.filter_to_sheet 헬퍼를 쓰거나 VBA AutoFilter + 네이티브 Copy 방식으로 실행해야 합니다.";
  }
  if (typeof duplicateRowDeleteIntent === "function" && duplicateRowDeleteIntent(source)) {
    return "조건이 붙은 중복 행 삭제는 Python COM으로 넓은 범위를 읽거나 행 삭제를 반복하면 큰 파일에서 멈춥니다. 이 작업은 VBA 보조열+AutoFilter 방식으로 실행해야 합니다.";
  }
  if (typeof conditionalRowDeleteIntent === "function" && conditionalRowDeleteIntent(source)) {
    return "조건이 붙은 행 삭제는 Python COM으로 행을 반복 삭제하면 큰 파일에서 앱이 멈춥니다. 이 작업은 VBA 보조열+AutoFilter 일괄 삭제 방식으로 실행해야 합니다.";
  }
  if (typeof multiValueLookupIntent === "function" && multiValueLookupIntent(source)) {
    return "한 셀 여러 값 분리 + 다른 파일 키 매칭 + 합산 후 열 쓰기 작업은 Python COM으로 실행하면 앱이 멈추거나 행 위치가 밀릴 수 있습니다. 이 작업은 VBA로 실행해야 합니다.";
  }
  const codeLooksLikeMultiValueLookup = (
    /\bctx\s*\.\s*book\s*\(/i.test(text)
    && /(?:BP|BQ|P:P|H:H|account|가입|key|token|tokens|split|re\.split)/i.test(text)
    && /\b(?:split|re\s*\.\s*split)\s*\(/i.test(text)
    && /\b(?:sum|total|합계|amount|fee)\b/i.test(text)
    && /\bctx\s*\.\s*(?:write|write_cell)\s*\(/i.test(text)
  );
  // [사용자 지시 2026-08-12] '생성된 코드의 모양'을 보고 VBA 로 되돌리는 판정은 더 하지 않는다.
  // 백엔드 정적 게이트에서 같은 규칙을 걷어냈고, 여기만 남으면 클라가 먼저 막아 효과가 없다.
  // (요청 의도로 엔진을 고르는 위쪽 라우팅은 성격이 달라 그대로 둔다 — 그건 '무엇을 생성할지'지
  //  '잘 도는 코드를 막을지'가 아니다.) 되살리려면 window.B2B_PY_QUALITY_GATE = true.
  if (codeLooksLikeMultiValueLookup && typeof window !== "undefined" && window.B2B_PY_QUALITY_GATE === true) {
    return "생성된 Python COM 코드가 다중 토큰 매칭/합산/쓰기 패턴입니다. 이 패턴은 현장 멈춤 재현 케이스라 실행하지 않고 VBA로 전환해야 합니다.";
  }
  const timeToSecondsIntent = /(시간|time).{0,30}(초|second)|초.{0,30}(환산|변환|계산)/i.test(source);
  const multiConditionIntent = ((source.match(/(일\s*때|이면|일\s*경우|인\s*경우|조건|where|when|if|그리고|동시에|and)/gi) || []).length >= 1)
    && /(?:[A-Z]{1,3}\s*열|@범위\[|@컬럼\[|동일\s*행|같은\s*행)/i.test(source);
  if (timeToSecondsIntent && multiConditionIntent) {
    return "조건이 걸린 행 단위 시간 환산은 Python COM 셀 루프가 생성되기 쉬운 현장 멈춤 재현 케이스입니다. VBA로 실행해야 합니다.";
  }
  return "";
}

function isHardPythonComVbaReason(reason) {
  return /대용량\s*필터|값\s*찾기\s*후\s*새\s*시트|ctx\.read\/filter_to_sheet/i.test(String(reason || ""));
}

function buildPythonStaticSafetyRegenPrompt(code, failures, sourceUserMessage) {
  const fixList = failures.map(f => `- ${f}`).join("\n");
  const exactSheetHint = exactSheetNameReminder(sourceUserMessage);
  return [
    "방금 생성한 Python 스킬이 적용 직전 정적 안전 검사에서 막혔습니다.",
    "원래 사용자 요청을 그대로 만족하되, 아래 위반을 모두 제거해 다시 작성하세요.",
    "",
    "## 원래 사용자 요청",
    String(sourceUserMessage || "(직전 요청 참조)"),
    exactSheetHint ? "\n## 정확 시트명\n" + exactSheetHint : "",
    "",
    "## 막힌 이유(모두 고칠 것)",
    fixList,
    "",
    "## 막힌 코드",
    "```python",
    String(code || ""),
    "```",
    "",
    "반드시 하나의 ```python 코드 블록으로 def transform(ctx): 를 출력하세요.",
    "규칙: import 금지(re/datetime/math 는 제공됨) · ctx API 만 사용 · 작은 범위 계산은 ctx.read() 한 번 + ctx.write() 한 번,",
    "큰 표 이동/정렬/병합은 ctx.copy/ctx.sort/ctx.append_same_format_sheets 같은 네이티브 헬퍼 사용 · 루프 안 ctx 쓰기 금지 · 실패는 raise ValueError.",
    "/no_think",
  ].join("\n");
}

function duplicateRowDeleteVbaHint(sourceUserMessage) {
  if (!(typeof duplicateRowDeleteIntent === "function" && duplicateRowDeleteIntent(sourceUserMessage))) return "";
  return [
    "",
    "## 대량 조건부 중복 행 삭제 작성 규칙",
    "- 이 요청은 조건부 중복 '행 삭제'입니다. 반드시 VBA로 작성하세요.",
    "- 성능상 필요한 열만 각각 1열 배열로 읽는 방식을 우선하세요. 예: E열 상품명, M열 수납금액, T열 EID.",
    "- 파일이 큰 것은 정상일 수 있으므로 실제 lastRow/lastCol 로 한정된 데이터 범위 읽기는 허용됩니다. 행 번호 없는 전체 열(A:T, E:T) 또는 전체 시트 끝까지 읽는 코드는 쓰지 마세요.",
    "- 사용자가 'E열 MVNO상품명에서 안전제일만'이라고 하면 E열 값이 정확히 '안전제일'인 행만 대상으로 하세요. '안전제일(망개통용)' 같은 접미사 값은 포함하지 마세요.",
    "- 같은 EID 그룹에서 수납금액이 1 이상인 행은 절대 삭제하지 마세요.",
    "- 수납금액이 1 미만인 중복 행은 위쪽 행부터 삭제하고, 같은 그룹의 삭제 가능 행 중 가장 아래쪽 1개만 남기세요.",
    "- 삭제할 행이 0개면 오류를 내지 말고 정상 종료하세요.",
    "- 30만 행 이상도 가능해야 하므로 Rows(...).Delete를 루프 안에서 반복하지 마세요.",
    "- 빠른 삭제 패턴: 임시 보조열(마지막 열+1)에 삭제 대상 행만 'B2B_DELETE' 표시 → AutoFilter로 보조열='B2B_DELETE' 필터 → 데이터 행 SpecialCells(xlCellTypeVisible).EntireRow.Delete 한 번 → 보조열 삭제/정리.",
    "- 보조열 추가/삭제는 작업 끝 Cleanup에서 정리하세요. AutoFilterMode도 끄세요.",
    "- 정렬이 꼭 필요하면 System.Collections.ArrayList는 사용 가능하지만, 버블정렬 이중 For는 쓰지 마세요.",
  ].join("\n");
}

function conditionalRowDeleteVbaHint(sourceUserMessage) {
  if (!(typeof conditionalRowDeleteIntent === "function" && conditionalRowDeleteIntent(sourceUserMessage))) return "";
  return [
    "",
    "## 대량 조건부 행 삭제 작성 규칙",
    "- 이 요청은 조건부 '행 삭제'입니다. 반드시 VBA로 작성하세요.",
    "- 선택한 열/요청 열의 실제 lastRow까지만 대상으로 하세요. 전체 열/전체 시트 끝까지 읽지 마세요.",
    "- 20260403 같은 날짜 조건은 Range.Text 와 Range.Value 를 모두 안전하게 처리하고 yyyymmdd 정수로 정규화해 비교하세요.",
    "- 날짜 정규화 함수는 셀 Range를 인자로 받아 먼저 cell.Text의 20260401/2026-03-31/2026/03/31 표기를 처리하고, 그 다음 cell.Value가 IsDate/CDate 이거나 Excel 날짜 시리얼(대략 20000~60000)이면 DateSerial(1899,12,30)+CLng(value) 또는 CDate(value)로 yyyymmdd를 만드세요. v > 0 And v < 1 은 시간 시리얼이지 날짜가 아니므로 날짜 판정에 쓰지 마세요.",
    "- 삭제할 행 번호를 모은 뒤 For ... Rows(row).Delete 로 하나씩 지우지 마세요. 큰 파일에서 타임아웃됩니다.",
    "- 빠른 삭제 패턴: 마지막 열+1 임시 보조열에 삭제 대상만 B2B_DELETE 표시 → 보조열 AutoFilter → 헤더를 제외한 명시적 데이터 본문 범위(hdrRow+1:lastRow)의 SpecialCells(xlCellTypeVisible).EntireRow.Delete 한 번 → 보조열 삭제/AutoFilter 해제.",
    "- SpecialCells 결과에 Offset(1,0).Resize(...) 를 걸어 삭제 범위를 만들지 마세요. 필터 결과가 비연속이면 행 수가 틀려 삭제가 빠질 수 있습니다.",
    "- 삭제 대상이 0건이면 오류를 내지 말고 정상 종료하세요.",
  ].join("\n");
}

function filterToNewSheetVbaHint(sourceUserMessage) {
  if (!(typeof filterToNewSheetIntent === "function" && filterToNewSheetIntent(sourceUserMessage))) return "";
  return [
    "",
    "## 대용량 필터 후 새 시트 생성 작성 규칙",
    "- 이 요청은 특정 열 값/조건에 맞는 행을 새 시트로 복사하는 작업입니다. 반드시 VBA로 작성하세요.",
    "- Python ctx.read 로 전체 범위를 읽어 직접 필터링하는 방식은 큰 파일에서 앱이 멈출 수 있으므로 쓰지 마세요.",
    "- 전체 열/전체 시트 끝까지 읽지 말고, 요청 열의 실제 lastRow 또는 사용자가 제공한 마지막 행까지만 대상으로 하세요.",
    "- 원본 시트는 보존하고, 새 시트에 헤더와 필터된 행 전체를 복사하세요.",
    "- AutoFilter Field 번호는 절대 열 번호가 아니라 필터 범위 안의 상대 번호입니다. 예: firstCol=1, targetCol=5 이면 filterField=targetCol-firstCol+1 입니다. Range가 E열부터 시작하면 Field:=1 입니다.",
    "- 헤더 행은 1행으로 고정하지 말고 실제 헤더 행을 쓰세요. @범위가 E:E 이고 헤더가 2행이면 hdrRow=2, 데이터는 hdrRow+1부터입니다.",
    "- 행을 한 줄씩 쓰는 루프나 UsedRange.Value 배열 재작성 대신 AutoFilter + SpecialCells(xlCellTypeVisible).Copy Destination을 우선하세요.",
    "- SpecialCells(xlCellTypeVisible)는 결과 0건이면 오류가 납니다. 호출 전에 Application.WorksheetFunction.Subtotal(103, 필터대상열_본문범위)로 보이는 데이터 행 수를 확인하고, 0건이면 새 시트에 헤더만 만들고 정상 종료하세요.",
    "- 긴 숫자 ID/계약번호/전화번호는 과학표기/15자리 손실이 나지 않도록 원본 Range.Copy로 형식과 텍스트 값을 보존하세요.",
    "- 병합 해제 뒤 생긴 빈칸은 임의로 위 값으로 채우지 마세요. 현 상태에서 조건값이 실제로 들어 있는 행만 필터 대상입니다.",
    "- 매칭 0건은 오류가 아니라 헤더만 있는 결과 시트 생성 후 정상 종료입니다. 프로그램이 멈추는 루프나 불필요한 재생성을 만들지 마세요.",
  ].join("\n");
}

function buildStaticSafetyRegenPrompt(code, failures, sourceUserMessage) {
  const fixList = failures.map(f => `- ${f}`).join("\n");
  const exactSheetHint = exactSheetNameReminder(sourceUserMessage);
  return [
    "방금 생성한 VBA 가 적용 직전 정적 안전 검사에서 막혔습니다.",
    "원래 사용자 요청을 그대로 만족하되, 아래 위반을 모두 제거해 VBA 를 다시 작성하세요.",
    "",
    "## 원래 사용자 요청",
    String(sourceUserMessage || "(직전 요청 참조)"),
    exactSheetHint ? "\n## 정확 시트명\n" + exactSheetHint : "",
    "",
    "## 막힌 이유(모두 고칠 것)",
    fixList,
    "",
    "## 막힌 코드",
    "```vba",
    String(code || ""),
    "```",
    duplicateRowDeleteVbaHint(sourceUserMessage),
    conditionalRowDeleteVbaHint(sourceUserMessage),
    filterToNewSheetVbaHint(sourceUserMessage),
    "",
    "반드시 하나의 ```vba 코드 블록만 출력하세요. On Error Resume Next / MsgBox / InputBox / Shell /",
    "Workbooks.Open / Save·Close / Application.Quit / 무관한 전체 시트 순회를 쓰지 마세요.",
    "대상을 못 찾으면 Err.Raise vbObjectError + 513, \"B2BSkill\", \"사유\" 로 실패를 알리세요.",
    "/no_think",
  ].join("\n");
}

function showCodeGuardBlock(message, context) {
  context = context || {};
  // [B2B#18 진단] '적용 버튼이 안 눌린다'의 상당수는 가드가 조용히 막은 경우다. 로그로 구분.
  console.warn(`[B2B#18] 적용 가드 차단: ${message}`);
  toast(message, "error");
  const div = addMessage("system", "", {});
  div.innerHTML = `
    <div>${escapeHtml(message)}</div>
    ${context.onForceApply ? `
      <div class="action-btns" style="margin-top:8px">
        <button class="action-btn danger" type="button">${escapeHtml(context.forceLabel || "강제로 적용")}</button>
      </div>
    ` : ""}
  `;
  const forceBtn = div.querySelector("button");
  if (forceBtn && context.onForceApply) {
    forceBtn.onclick = () => {
      if (forceBtn.disabled) return;
      forceBtn.disabled = true;
      forceBtn.textContent = "강제 적용 중...";
      try {
        context.onForceApply();
      } catch (err) {
        forceBtn.disabled = false;
        forceBtn.textContent = context.forceLabel || "강제로 적용";
        throw err;
      }
    };
  }
  scrollChatToBottom({ force: true });   // 가드 안내/강제적용 버튼은 항상 보이도록(#18)
}

// [사용자 지시] VBA 전환 재생성까지 실패("뻑나면")하면, 게이트를 우회해 '원본 Python 코드'를 그대로
// 강제 적용한다(VBA 는 아무리 굴려도 안 되는 케이스가 있어 사용자가 직접 빠져나올 수 있게).
function applyForcedPythonFallback(pythonCode, context) {
  context = context || {};
  const prompt = (typeof replyStepPrompt === "function") ? replyStepPrompt(context) : (context.sourceUserMessage || "");
  const result = applyLogic({
    id: uid(),
    prompt,
    originHistId: originHistIdForPrompt(prompt),   // [번호표 연결]
    code: String(pythonCode || ""),
    description: context.originalPythonDesc || "원본 Python 스킬(강제 적용)",
    language: "python",
    // 강제 적용은 대용량이 전제(VBA 로는 안 풀림) → 백엔드 정적검사 우회 + 데드라인 확장으로 완주시킨다.
    extendedTimeout: true,
  });
  if (result && result.error) {
    toast("강제 적용 실패: " + result.error, "error");
  } else {
    toast("원본 Python 코드를 강제로 적용했습니다.", "success");
  }
  return result;
}

// 정적 안전 위반 시 Qwen 을 자동 재호출해 고친 코드를 받아 다시 검사 흐름에 태운다.
// addAssistantReply 가 새 코드에 대해 validateAssistantCodeBeforeApply 를 다시 호출하므로
// staticRegenAttempt 카운터로 무한 재생성을 막는다(언어별 MAX_REGEN 회까지).
async function autoRegenerateForStaticSafety(code, failures, context) {
  const sourceUserMessage = (context && context.sourceUserMessage) || latestUserRequestForSafety();
  const attempt = Number((context && context.staticRegenAttempt) || 0) + 1;
  const isPythonRegen = !!(context && context.skillLanguage === "python");
  const maxRegen = isPythonRegen ? PYTHON_STATIC_MAX_REGEN : VBA_STATIC_MAX_REGEN;
  const prompt = isPythonRegen
    ? buildPythonStaticSafetyRegenPrompt(code, failures, sourceUserMessage)
    : buildStaticSafetyRegenPrompt(code, failures, sourceUserMessage);
  toast(`안전하지 않은 패턴이 감지되어 코드를 자동으로 다시 생성합니다. (${attempt}/${maxRegen})`, "success");
  const loading = addMessage("assistant", "", {});
  const aiName = (typeof getAiDisplayName === "function" ? getAiDisplayName() : "AI");
  const streamView = setupStreamingAssistantMessage(loading, `(안전 재생성 ${attempt}/${maxRegen}) `, aiName, null);
  // degenerate(줄 반복/비정상 길이) 위반이 포함된 재생성에서만 강한 반복 억제를 건다.
  // (일반 요청에 1.5 를 상시 적용하면 코드 토큰 재사용까지 벌점을 줘 출력이 망가진다.)
  const hasDegenerateFailure = (failures || []).some(f => /반복|비정상적으로\s*깁니다/.test(String(f)));
  try {
    $("chat-send").disabled = true;
    const reply = await callLLM(prompt, {
      forceEngine: isPythonRegen ? "python" : "vba",
      presencePenalty: hasDegenerateFailure ? 1.5 : undefined,
      onDelta: (_d, full) => { streamView.setAnswer(full); scrollChatToBottom(); },
      onReconnect: (a, max) => { streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${a}/${max})`); },
    });
    streamView.flush();
    loading.remove();
    // 새 응답을 일반 흐름으로 렌더 → 원래 "적용" 동작이면 자동으로 다시 검사/적용한다.
    // [증상 A/B 수정] 수정 모드에서 재생성되면 editTargetId 를 반드시 이어받아야 '수정 적용(in-place)'이
    // 유지된다. 예전엔 이 함수가 editTargetId 를 안 넘겨(대조: autoRegenerateForMissingCode 는 넘김),
    // 수정한 스텝의 정적검사/VBA→Python 재작성 결과가 '적용(append)'으로 둔갑해 새 스텝이 붙었다.
    addAssistantReply(reply, {
      sourceUserMessage,
      staticRegenAttempt: attempt,
      vbaFallbackTried: !!(context && context.vbaFallbackTried),
      allowPythonRecovery: !!(context && context.allowPythonRecovery),
      autoApplyMode: context && context.autoApplyMode,
      editTargetId: context && context.editTargetId,
    });
    scrollChatToBottom();
  } catch (err) {
    loading.innerHTML = "안전 재생성 실패: " + escapeHtml(err && err.message ? err.message : String(err));
    loading.classList.remove("assistant");
    loading.classList.add("system", "error");
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
  }
}

// Python COM 정적 게이트를 (최초 생성 + 자동 재생성 PYTHON_STATIC_MAX_REGEN 회) 연속으로 통과하지
// 못하면 같은 요청을 VBA 매크로로 전환해 한 번 더 생성한다. 이 호출 1회만 VBA 시스템 프롬프트를
// 쓰고(forceEngine), 전역 엔진 설정은 바꾸지 않는다. 생성된 VBA 는 일반 흐름(addAssistantReply)을
// 타므로 VBA 정적 게이트가 다시 검사하고, 적용 시 language="vba" 라우팅으로 run-vba 에 실행된다.
async function autoRegenerateAsVbaFallback(code, failures, context) {
  const sourceUserMessage = (context && context.sourceUserMessage) || latestUserRequestForSafety();
  const fixList = (failures || []).map(f => `- ${f}`).join("\n");
  const prompt = [
    "Python 스킬이 정적 안전 검사를 여러 번 통과하지 못했습니다. 같은 요청을 VBA 매크로로 전환해 다시 작성하세요.",
    "",
    "## 원래 사용자 요청",
    String(sourceUserMessage || "(직전 요청 참조)"),
    "",
    "## Python 에서 막혔던 이유(같은 실수를 VBA 에서 반복하지 말 것)",
    fixList,
    "",
    duplicateRowDeleteVbaHint(sourceUserMessage),
    conditionalRowDeleteVbaHint(sourceUserMessage),
    filterToNewSheetVbaHint(sourceUserMessage),
    "",
    "반드시 하나의 ```vba 코드 블록만 출력하세요. On Error Resume Next / MsgBox / InputBox / Shell /",
    "Workbooks.Open / Save·Close / Application.Quit / 무관한 전체 시트 순회를 쓰지 마세요.",
    "대상을 못 찾으면 Err.Raise vbObjectError + 513, \"B2BSkill\", \"사유\" 로 실패를 알리세요.",
    "/no_think",
  ].join("\n");
  toast("Python 안전 검사를 계속 통과하지 못해 VBA 로 전환해 다시 생성합니다.", "success");
  const loading = addMessage("assistant", "", {});
  const aiName = (typeof getAiDisplayName === "function" ? getAiDisplayName() : "AI");
  const streamView = setupStreamingAssistantMessage(loading, "(VBA 전환 재생성) ", aiName, null);
  try {
    $("chat-send").disabled = true;
    const reply = await callLLM(prompt, {
      forceEngine: "vba",
      onDelta: (_d, full) => { streamView.setAnswer(full); scrollChatToBottom(); },
      onReconnect: (a, max) => { streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${a}/${max})`); },
    });
    streamView.flush();
    loading.remove();
    // vbaFallbackTried: VBA 쪽 게이트도 끝내 막히면, 최종 차단 대신 '원본 Python 강제 적용'을 열어준다.
    // → 원본 Python 코드(이 함수의 code 인자)를 보존해 다음 검증 컨텍스트로 넘긴다.
    // [증상 A/B 수정] 수정 모드였다면 editTargetId 이어받아 in-place 유지(append 로 새는 것 방지).
    addAssistantReply(reply, {
      sourceUserMessage,
      staticRegenAttempt: 0,
      vbaFallbackTried: true,
      originalPythonCode: (context && context.originalPythonCode) || code,
      autoApplyMode: (context && context.autoApplyMode) || "apply",
      editTargetId: context && context.editTargetId,
    });
    scrollChatToBottom();
  } catch (err) {
    loading.innerHTML = "VBA 전환 재생성 실패: " + escapeHtml(err && err.message ? err.message : String(err));
    loading.classList.remove("assistant");
    loading.classList.add("system", "error");
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
  }
}

function validateAssistantCodeBeforeApply(code, context) {
  context = context || {};
  const sourceUserMessage = context.sourceUserMessage || "";
  const allowPythonRecovery = !!context.allowPythonRecovery;
  const explicitPythonHere = typeof userExplicitlyRequestsPython === "function"
    && userExplicitlyRequestsPython(sourceUserMessage)
    && !(typeof userExplicitlyRequestsVba === "function" && userExplicitlyRequestsVba(sourceUserMessage));
  // ver0.5.2 4단계: Python COM 스킬은 전용 게이트로(서버 AST 게이트의 1차 방어선).
  const codeText = String(code || "");
  const isPythonSkill = /def\s+transform\s*\(\s*ctx\s*\)\s*:/.test(codeText) ||
    (/\bctx\.\w+\s*\(/.test(codeText) && !/\bSub\s+\w+\s*\(/i.test(codeText));
  // [사용자 지시] 'VBA 적용실패 → 에러복구가 Python 으로 다시 짠' 코드(recoveredFromVba)는
  // '강제적용과 동일하게' 게이트 없이 무조건 적용한다. 이게 없으면 read 과다 등으로 다시 VBA 로
  // 튕기고, 그 VBA 가 또 실패하면 복구가 다시 Python → … VBA↔Python 무한 루프가 된다.
  // (하드 안전은 서버 AST 게이트가 최종 판정하므로 클라 정적검사를 건너뛰어도 위험코드는 서버가 막는다.
  //  순수 Python→Python 복구는 이 우회 대상이 아니라 기존 게이트를 그대로 거친다 — allowPythonRecovery
  //  가드 때문에 어차피 VBA 로 튕기지 않아 루프가 안 생김.)
  if (isPythonSkill && allowPythonRecovery && context.recoveredFromVba) {
    try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.ok", { language: "python", bypass: "pythonRecoveryForce" }); } catch (_) {}
    return true;
  }
  // [사용자 지시] 이 코드가 'VBA 전환 재생성' 결과(vbaFallbackTried)인데 게이트에 또 막히면,
  // 최종 차단 화면의 강제적용 버튼이 '원본 Python' 을 적용하도록 바꾼다(VBA 는 아무리 굴려도 안 되니까).
  if (context.originalPythonCode && context.vbaFallbackTried && !isPythonSkill && typeof applyLogic === "function") {
    context = {
      ...context,
      forceLabel: "원본 Python 코드로 강제 적용",
      onForceApply: () => applyForcedPythonFallback(context.originalPythonCode, context),
    };
  }
  try {
    if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.start", {
      mode: context.autoApplyMode || "",
      language: isPythonSkill ? "python" : "vba",
      codeHash: String(codeText.length) + ":" + String(codeText.charCodeAt(0) || 0),
      sourceLen: sourceUserMessage.length,
    });
  } catch (_) {}
  const traceValidationStage = (name, fn) => {
    const started = performance.now();
    try {
      return fn();
    } finally {
      try {
        if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.stage", {
          stage: name,
          ms: Math.round(performance.now() - started),
        });
      } catch (_) {}
    }
  };
  if (isPythonSkill && userExplicitlyRequestsVba(sourceUserMessage)) {
    const reason = "사용자가 이번 요청에서 VBA/매크로로 작성하라고 명시했는데 Python COM 코드가 생성되었습니다. Python 으로 적용하지 않고 VBA 매크로로 다시 생성합니다.";
    if (!context.vbaFallbackTried) {
      autoRegenerateAsVbaFallback(code, [reason], context);
    } else {
      showCodeGuardBlock(reason, context);
    }
    return false;
  }
  const commonFailures = [
    ...traceValidationStage("exactReferenceFailures", () => exactReferenceFailures(code, sourceUserMessage)),
    ...traceValidationStage("wholeColumnCountRowTwoFailures", () => wholeColumnCountRowTwoFailures(code, sourceUserMessage)),
    ...traceValidationStage("decimalSplitNumberExtractFailures", () => decimalSplitNumberExtractFailures(code)),
    ...traceValidationStage("hangulLiteralTypoFailures", () => hangulLiteralTypoFailures(code, sourceUserMessage)),
  ];
  if (commonFailures.length) {
    const attemptsSoFar = Number(context.staticRegenAttempt || 0);
    if (isPythonSkill) {
      if (attemptsSoFar < PYTHON_STATIC_MAX_REGEN) {
        autoRegenerateForStaticSafety(code, commonFailures, { ...context, skillLanguage: "python" });
      } else if (!context.vbaFallbackTried && !explicitPythonHere && !allowPythonRecovery) {
        autoRegenerateAsVbaFallback(code, commonFailures, context);
      } else {
        showCodeGuardBlock(
          (explicitPythonHere || allowPythonRecovery
            ? "사용자가 Python/COM 복구를 요청했거나 에러복구에서 Python/ctx 전환을 허용했으므로 VBA로 전환하지 않았습니다. 여러 번 다시 생성했지만 정확 참조/행 범위 문제가 남아 적용을 막았습니다:\n- "
            : "여러 번 다시 생성했지만 정확 참조/행 범위 문제가 남아 적용을 막았습니다:\n- ") +
            commonFailures.join("\n- "),
          context,
        );
      }
    } else if (attemptsSoFar < VBA_STATIC_MAX_REGEN && !context.vbaFallbackTried) {
      autoRegenerateForStaticSafety(code, commonFailures, context);
    } else {
      showCodeGuardBlock(
        "여러 번 다시 생성했지만 정확 참조/행 범위 문제가 남아 적용을 막았습니다:\n- " +
          commonFailures.join("\n- "),
        context,
      );
    }
    try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.block", { reason: "commonFailures", count: commonFailures.length }); } catch (_) {}
    return false;
  }
  if (isPythonSkill) {
    const mustUseVba = traceValidationStage("pythonComMustUseVbaReason", () => pythonComMustUseVbaReason(code, sourceUserMessage));
    // [사용자 지시] 사용자가 python/COM 을 명시했으면 위험작업이라도 VBA 강제전환하지 않고 python 유지
    // (멈춤/실패 시 에러복구가 VBA 로 되돌림). 명시가 없을 때만 기존 안전 전환 동작.
    const hardVbaReason = typeof isHardPythonComVbaReason === "function" && isHardPythonComVbaReason(mustUseVba);
    if (mustUseVba && !explicitPythonHere && (!allowPythonRecovery || hardVbaReason)) {
      if (!context.vbaFallbackTried) {
        autoRegenerateAsVbaFallback(code, [mustUseVba], context);
      } else {
        showCodeGuardBlock(mustUseVba, context);
      }
      try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.block", { reason: "pythonMustUseVba" }); } catch (_) {}
      return false;
    }
    const pyFailures = traceValidationStage("pythonComStaticSafetyFailures", () => pythonComStaticSafetyFailures(code, sourceUserMessage));
    if (pyFailures.length) {
      const attemptsSoFar = Number(context.staticRegenAttempt || 0);
      // [사용자 지시] 'read 과다(큰 표를 ctx.read 로 올려 가공)' 계열은 Python 재생성으로 안 고쳐진다
      // (패턴상 VBA/네이티브가 정답). → Python 재생성을 건너뛰고 '바로' VBA 로 전환한다.
      //   VBA 도 뻑나면, autoRegenerateAsVbaFallback 가 넘긴 originalPythonCode 로 최종 화면에서
      //   '원본 Python 강제 적용' 버튼이 뜬다(위 vbaFallbackTried 오버라이드).
      const readTooHeavy = pyFailures.some(f => /큰\s*표를\s*ctx\.read\s*로\s*Python\s*리스트에\s*올려/.test(String(f)));
      if (readTooHeavy && !context.vbaFallbackTried && !explicitPythonHere && !allowPythonRecovery) {
        autoRegenerateAsVbaFallback(code, pyFailures, { ...context, originalPythonCode: code });
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.block", { reason: "pythonReadTooHeavyStraightToVba" }); } catch (_) {}
        return false;
      }
      if (attemptsSoFar < PYTHON_STATIC_MAX_REGEN) {
        autoRegenerateForStaticSafety(code, pyFailures, { ...context, skillLanguage: "python" });
      } else if (!context.vbaFallbackTried && !explicitPythonHere && !allowPythonRecovery) {
        // Python 정적 제약을 2회(최초+재생성 1회) 통과하지 못함 → 같은 요청을
        // VBA 로 전환해 다시 시도한다(전역 엔진 설정은 그대로).
        autoRegenerateAsVbaFallback(code, pyFailures, context);
      } else {
        showCodeGuardBlock(
          (explicitPythonHere || allowPythonRecovery
            ? "사용자가 Python/COM 복구를 요청했거나 에러복구에서 Python/ctx 전환을 허용했으므로 VBA로 전환하지 않았습니다. 여러 번 다시 생성했지만 안전하지 않은 패턴이 남아 적용을 막았습니다:\n- "
            : "여러 번 다시 생성했지만 안전하지 않은 패턴이 남아 적용을 막았습니다:\n- ") +
            pyFailures.join("\n- "),
          context,
        );
      }
      try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.block", { reason: "pythonStatic", count: pyFailures.length }); } catch (_) {}
      return false;
    }
    try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.ok", { language: "python" }); } catch (_) {}
    return true; // 아래 VBA 전용 휴리스틱은 건너뜀
  }
  const vbaReferenceFailures = traceValidationStage("vbaExactSheetReferenceFailures", () => vbaExactSheetReferenceFailures(code, sourceUserMessage));
  if (vbaReferenceFailures.length) {
    const attemptsSoFar = Number(context.staticRegenAttempt || 0);
    if (attemptsSoFar < VBA_STATIC_MAX_REGEN && !context.vbaFallbackTried) {
      autoRegenerateForStaticSafety(code, vbaReferenceFailures, context);
    } else {
      showCodeGuardBlock(
        "여러 번 다시 생성했지만 VBA 시트명이 요청과 다릅니다:\n- " +
          vbaReferenceFailures.join("\n- "),
        context,
      );
    }
    try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.block", { reason: "vbaReference", count: vbaReferenceFailures.length }); } catch (_) {}
    return false;
  }
  // 0) VBA 런타임 안전 하드블록(On Error Resume Next, MsgBox, Workbooks.Open/.Save/.Close,
  //    Application.Quit, Shell, 무관 전체시트순회, 파일 CreateObject). 위반 시 자동 재생성.
  const safetyFailures = traceValidationStage("vbaStaticSafetyFailures", () => vbaStaticSafetyFailures(code, sourceUserMessage));
  if (safetyFailures.length) {
    const attemptsSoFar = Number(context.staticRegenAttempt || 0);
    if (context.vbaFallbackTried) {
      showCodeGuardBlock(
        "VBA 우회 코드도 안전하지 않은 패턴이 남아 적용을 막았습니다:\n- " +
          safetyFailures.join("\n- "),
        context,
      );
    } else if (attemptsSoFar < VBA_STATIC_MAX_REGEN) {
      autoRegenerateForStaticSafety(code, safetyFailures, context);
    } else {
      showCodeGuardBlock(
        "여러 번 다시 생성했지만 안전하지 않은 패턴이 남아 적용을 막았습니다:\n- " +
          safetyFailures.join("\n- "),
        context,
      );
    }
    try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.block", { reason: "vbaStatic", count: safetyFailures.length }); } catch (_) {}
    return false;
  }
  const broadValueRewrite = traceValidationStage("codeHasBroadValueRewrite", () => codeHasBroadValueRewrite(code));
  if (broadValueRewrite
      && !userExplicitlyRequestsForceProceed(sourceUserMessage)
      && !/표\s*전체|시트\s*전체|UsedRange|전체\s*범위/i.test(sourceUserMessage)) {
    const message = "표 전체/UsedRange를 Value 배열로 다시 쓰는 VBA가 감지되어 적용을 막았습니다. 요청받은 대상 열/셀 범위만 한정해서 쓰는 코드로 다시 생성해 주세요.";
    showCodeGuardBlock(message, context);
    try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.block", { reason: "broadValueRewrite" }); } catch (_) {}
    return false;
  }
  // VBA 응답에도 같은 줄 도배(degenerate) 가드를 적용한다(Python 쪽은 COM 게이트가 담당).
  const degen = traceValidationStage("pythonDegenerateOutputFailure", () => pythonDegenerateOutputFailure(code));
  if (degen) {
    showCodeGuardBlock(degen, context);
    try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.block", { reason: "degenerateOutput" }); } catch (_) {}
    return false;
  }
  try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.validate.ok", { language: "vba" }); } catch (_) {}
  return true;
}

function latestUserRequestForSafety() {
  const history = state.chatHistory || [];
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i] || {};
    if (item.role !== "user") continue;
    const content = String(item.content || item.text || item.message || "");
    if (!content) continue;
    if (content.includes("## 실패한 코드") || content.includes("## 상세 오류")) continue;
    if (content.includes("## 막힌 코드") || /정적\s*안전\s*검사|안전\s*검사에서\s*막/i.test(content)) continue;
    return content;
  }
  return "";
}

function replyStepPrompt(replyContext) {
  return (replyContext && replyContext.sourceUserMessage) || latestUserRequestForSafety();
}

// ---- 코드 미생성/주석-only 출력 감지 (Qwen 이 설명만 하거나 # 주석만 잔뜩 다는 문제) ----
const NO_CODE_MAX_REGEN = 2;

// 사용자에게 되묻는 정상적인 명확화 질문이면 재생성하지 않는다.
function _looksLikeClarifyingQuestion(text) {
  const t = String(text || "");
  if (!/\?|까요|입니까|인가요/.test(t)) return false;
  return /(어떤|어느|무엇|어디|몇|중에|선택|알려\s*주|확인해\s*주|말씀해\s*주|값으로|수식으로|숫자로|적을지|넣을지|적을까요|넣을까요)/.test(t);
}

// 실행 가능한 문장이 없는 주석-only 코드인지 검사(파이썬 # / VBA '·Rem).
function _isCommentOnlyCode(code, language) {
  const lines = String(code || "").split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return true;
  const isComment = (l) => language === "vba"
    ? (l.startsWith("'") || /^rem\b/i.test(l))
    : l.startsWith("#");
  // 시그니처/끝맺음/pass/docstring 만 있고 나머지가 전부 주석이면 본문이 없는 것.
  const scaffold = /^(def\s+transform|sub\s+b2bskill|end\s+sub|pass$|return(\s+none)?$|"""|''')/i;
  return lines.every(l => isComment(l) || scaffold.test(l));
}

// 코드를 만들어야 하는 응답인데 코드가 없거나 비어 있으면 문제 목록을 돌려준다.
function assistantReplyCodeProblems(fullText, code) {
  const text = String(fullText || "");
  const stripped = text.replace(/```[\s\S]*?```/g, "").trim();
  if (!code) {
    if (_looksLikeClarifyingQuestion(stripped)) return []; // 정당한 되물음은 통과
    return ["코드 블록 없이 설명만 출력했습니다."];
  }
  const language = typeof inferCodeLanguage === "function" ? inferCodeLanguage(code, text) : "";
  if (_isCommentOnlyCode(code, language)) {
    return ["코드 블록이 주석/뼈대뿐이고 실제 실행 문장이 없습니다."];
  }
  const hasEntry = language === "vba"
    ? /\bSub\s+B2BSkill\s*\(/i.test(code)
    : (language === "python" ? /def\s+transform\s*\(\s*ctx\s*\)\s*:/.test(code) : true);
  if (!hasEntry) {
    return [language === "vba"
      ? "진입점 Sub B2BSkill() 이 없습니다."
      : "진입 함수 def transform(ctx): 가 없습니다."];
  }
  return [];
}

// 설명만/주석만 응답을 받았을 때 교정 지시와 함께 자동 재생성한다(최대 NO_CODE_MAX_REGEN 회).
async function autoRegenerateForMissingCode(fullText, problems, context) {
  const sourceUserMessage = (context && context.sourceUserMessage) || latestUserRequestForSafety();
  const attempt = Number((context && context.noCodeRegenAttempt) || 0) + 1;
  const engine = typeof getSkillEngine === "function" ? getSkillEngine() : "python";
  const isVba = engine === "vba";
  const prompt = [
    "방금 응답에는 실행할 코드가 없었습니다:",
    ...problems.map(p => `- ${p}`),
    "",
    "## 원래 사용자 요청",
    String(sourceUserMessage || "(직전 요청 참조)"),
    "",
    "설명·계획·주석만 쓰지 말고, 위 요청을 실제로 수행하는 코드를 지금 바로 작성하세요.",
    isVba
      ? "반드시 하나의 ```vba 코드 블록으로 Sub B2BSkill() 전체 구현을 출력하세요."
      : "반드시 하나의 ```python 코드 블록으로 def transform(ctx): 전체 구현을 출력하세요.",
    "코드 밖 설명은 1~2문장만. 주석은 꼭 필요한 곳에만 짧게.",
    "/no_think",
  ].join("\n");
  toast(`응답에 코드가 없어 자동으로 다시 생성합니다. (${attempt}/${NO_CODE_MAX_REGEN})`, "success");
  const loading = addMessage("assistant", "", {});
  const aiName = (typeof getAiDisplayName === "function" ? getAiDisplayName() : "AI");
  const streamView = setupStreamingAssistantMessage(loading, `(코드 재생성 ${attempt}/${NO_CODE_MAX_REGEN}) `, aiName, null);
  try {
    $("chat-send").disabled = true;
    const reply = await callLLM(prompt, {
      onDelta: (_d, full) => { streamView.setAnswer(full); scrollChatToBottom(); },
      onReconnect: (a, max) => { streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${a}/${max})`); },
    });
    streamView.flush();
    loading.remove();
    addAssistantReply(reply, {
      ...(context || {}),
      sourceUserMessage,
      noCodeRegenAttempt: attempt,
    });
    scrollChatToBottom();
  } catch (err) {
    loading.innerHTML = "코드 재생성 실패: " + escapeHtml(err && err.message ? err.message : String(err));
    loading.classList.remove("assistant");
    loading.classList.add("system", "error");
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
  }
}

function addAssistantReply(fullText, replyContext) {
  const code = extractCode(fullText);
  const language = typeof inferCodeLanguage === "function" ? inferCodeLanguage(code, fullText) : "javascript";
  const desc = extractDescription(fullText);
  const stripped = fullText.replace(/```[\s\S]*?```/g, "").trim();
  const editTargetId = replyContext && replyContext.editTargetId;
  const reasoning = replyContext && replyContext.reasoning;

  const div = document.createElement("div");
  div.className = "msg assistant";
  div.innerHTML = `<div>${escapeHtml(stripped)}</div>`;
  if (reasoning) div.insertBefore(createReasoningBox(reasoning), div.firstChild);
  bindChatHistoryEntryToMessage(div, "assistant", fullText);
  if (code) {
    const codeBlk = document.createElement("pre");
    codeBlk.className = "code-block";
    codeBlk.textContent = code;
    div.appendChild(codeBlk);

    const actions = document.createElement("div");
    actions.className = "action-btns";

    if (editTargetId) {
      const editApplyBtn = document.createElement("button");
      editApplyBtn.className = "action-btn";
      editApplyBtn.textContent = "\u2713 \uC218\uC815 \uC801\uC6A9";
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "action-btn reject";
      rejectBtn.textContent = "\u2715 \uAC70\uC808";
      actions.appendChild(editApplyBtn);
      actions.appendChild(rejectBtn);
      div.appendChild(actions);

      const runEditApply = () => {
        const result = replaceLogicAt(editTargetId, code, desc, language,
          // 기존 스텝의 VBA 실패→Python 에러복구도 대용량 완주(정적검사 우회+데드라인 확장)를 허용한다.
          { recoveredFromVba: !!(replyContext && replyContext.recoveredFromVba && String(language).toLowerCase() === "python") });
        if (result !== false) {
          // [번호표 연결] 채팅으로 내용을 바꿨으면 출처도 이 수정 요청으로 갱신한다 — 캡처로 태어난
          // 스텝도 이 순간부터 연결된 대화가 생긴다. prompt 는 건드리지 않는다(시트/대상 추론이
          // step.prompt 를 읽으므로 바꾸면 실행 대상이 흔들린다 — 연결은 번호표만 담당).
          try {
            const _src = (replyContext && replyContext.sourceUserMessage) || "";
            const _m = originHistIdForPromptLoose(_src);
            const st = (state.pipeline || []).find(x => x && x.id === editTargetId);
            if (_m.histId && st) st.originHistId = _m.histId;
            try {
              if (typeof traceClientUiEvent === "function") {
                traceClientUiEvent("edit.histid.update", { stepId: editTargetId, via: _m.via });
              }
            } catch (_) {}
            // [사용자 제보 2026-08-21] ✎ 프리필이 '최초 프롬프트'로 되돌아가던 문제.
            // step.prompt 는 위 주석대로 일부러 안 바꾼다(대상/시트 추론이 그걸 읽는다).
            // 대신 '마지막으로 보낸 수정 요청문'을 따로 남겨 프리필만 이걸 쓰게 한다 —
            // 말풍선은 이미 수정 후 텍스트를 보여주고 있었으니 그 둘을 일치시키는 것이다.
            if (st && String(_src || "").trim()) st.lastEditPrompt = String(_src).trim();
          } catch (_) {}
        }
        if (result && !result.error) {
          editApplyBtn.disabled = true;
          rejectBtn.disabled = true;
          // [제보 2026-08-21] 수정이 끝났으니 '해제'를 잊지 않게 알린다 — 안 풀고 다음 단계를
          // 이어 쓰면 그 입력이 새 단계가 아니라 '같은 단계 재수정'으로 들어간다.
          try {
            window.__b2bEditJustApplied = true;
            if (typeof renderEditingBanner === "function") renderEditingBanner();
            if (typeof toast === "function") {
              toast(`Step ${(state.pipeline || []).findIndex(x => x && x.id === editTargetId) + 1} 수정 완료 — `
                + "다음 단계를 만들려면 아래 [해제]를 먼저 누르세요.", "success");
            }
          } catch (_) {}
          finalizeActionButtonFromResult(
            editApplyBtn,
            result,
            "\u2713 \uC218\uC815 \uC801\uC6A9\uB428",
            () => restoreActionButtonsAfterFailure([editApplyBtn, rejectBtn], editApplyBtn, "\u2713 \uB2E4\uC2DC \uC218\uC815 \uC801\uC6A9"),
            { actions }
          );
        }
      };
      editApplyBtn.onclick = () => {
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.button.click", { action: "edit", disabled: !!editApplyBtn.disabled }); } catch (_) {}
        const validationContext = {
          ...(replyContext || {}),
          autoApplyMode: "edit",
          forceLabel: "\uAC15\uC81C\uB85C \uC218\uC815 \uC801\uC6A9",
          onForceApply: runEditApply,
        };
        if (!validateAssistantCodeBeforeApply(code, validationContext)) return;
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.button.run_apply", { action: "edit" }); } catch (_) {}
        runEditApply();
      };
      if (replyContext && replyContext.autoApplyMode === "edit") {
        setTimeout(() => {
          if (!editApplyBtn.disabled) editApplyBtn.click();
        }, 0);
      }
      rejectBtn.onclick = () => {
        editApplyBtn.disabled = true;
        rejectBtn.disabled = true;
        rejectBtn.textContent = "\uAC70\uC808\uB428";
      };
    } else {
      const applyBtn = document.createElement("button");
      applyBtn.className = "action-btn";
      applyBtn.textContent = "\u2713 \uC801\uC6A9";
      const insertBtn = document.createElement("button");
      insertBtn.className = "action-btn insert";
      insertBtn.textContent = "\u21B3 \uC0BD\uC785";
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "action-btn reject";
      rejectBtn.textContent = "\u2715 \uAC70\uC808";
      actions.appendChild(applyBtn);
      actions.appendChild(insertBtn);
      actions.appendChild(rejectBtn);
      div.appendChild(actions);

      const runApply = () => {
        const result = applyLogic({ id: uid(), prompt: replyStepPrompt(replyContext),
          originHistId: originHistIdForPrompt(replyStepPrompt(replyContext)),   // [번호표 연결]
          code, description: desc, language,
          // VBA 실패→에러복구가 Python 으로 다시 짠 코드(recoveredFromVba)는 대용량이라 다시 VBA 로 튕기면
          // 안 되고 75초에 잘려도 안 된다 → 백엔드 정적검사 우회 + 데드라인 확장으로 완주.
          extendedTimeout: !!(replyContext && replyContext.recoveredFromVba && language === "python") });
        applyBtn.disabled = true;
        insertBtn.disabled = true;
        rejectBtn.disabled = true;
        finalizeActionButtonFromResult(
          applyBtn,
          result,
          "\u2713 \uC801\uC6A9\uB428",
          () => restoreActionButtonsAfterFailure([applyBtn, insertBtn, rejectBtn], applyBtn, "\u2713 \uB2E4\uC2DC \uC801\uC6A9"),
          { actions }
        );
      };
      const runInsert = () => {
        const preferredPosition = replyContext && Number(replyContext.suggestInsertPosition);
        openInsertPositionDialog(state.pipeline.length, (position) => {
          const result = insertLogic({ id: uid(), prompt: replyStepPrompt(replyContext),
          originHistId: originHistIdForPrompt(replyStepPrompt(replyContext)),   // [번호표 연결]
          code, description: desc, language }, position);
          applyBtn.disabled = true;
          insertBtn.disabled = true;
          rejectBtn.disabled = true;
          finalizeActionButtonFromResult(
            insertBtn,
            result,
            `${position}\uBC88\uC5D0 \uC0BD\uC785\uB428`,
            () => restoreActionButtonsAfterFailure([applyBtn, insertBtn, rejectBtn], insertBtn, "\u21B3 \uB2E4\uC2DC \uC0BD\uC785"),
            { actions }
          );
        }, Number.isFinite(preferredPosition) ? preferredPosition : undefined);
      };
      applyBtn.onclick = () => {
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.button.click", { action: "apply", disabled: !!applyBtn.disabled }); } catch (_) {}
        const validationContext = {
          ...(replyContext || {}),
          autoApplyMode: "apply",
          forceLabel: "\uAC15\uC81C\uB85C \uC801\uC6A9",
          onForceApply: runApply,
        };
        if (!validateAssistantCodeBeforeApply(code, validationContext)) return;
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.button.run_apply", { action: "apply" }); } catch (_) {}
        runApply();
      };
      insertBtn.onclick = () => {
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.button.click", { action: "insert", disabled: !!insertBtn.disabled }); } catch (_) {}
        const validationContext = {
          ...(replyContext || {}),
          autoApplyMode: "insert",
          forceLabel: "\uAC15\uC81C\uB85C \uC0BD\uC785",
          onForceApply: runInsert,
        };
        if (!validateAssistantCodeBeforeApply(code, validationContext)) return;
        try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("apply.button.run_apply", { action: "insert" }); } catch (_) {}
        runInsert();
      };
      rejectBtn.onclick = () => {
        applyBtn.disabled = true;
        insertBtn.disabled = true;
        rejectBtn.disabled = true;
        rejectBtn.textContent = "\uAC70\uC808\uB428";
      };
      if (replyContext && replyContext.autoApplyMode === "apply") {
        setTimeout(() => {
          if (!applyBtn.disabled) applyBtn.click();
        }, 0);
      }
    }
  }
  $("chat-messages").appendChild(div);
  scrollChatToBottom();

  // 코드가 필요했는데 설명만/주석만 온 경우 자동 재생성(원본 응답은 위에 그대로 남긴다).
  if (replyContext && replyContext.sourceUserMessage) {
    const problems = assistantReplyCodeProblems(fullText, code);
    if (problems.length) {
      const attemptsSoFar = Number(replyContext.noCodeRegenAttempt || 0);
      if (attemptsSoFar < NO_CODE_MAX_REGEN) {
        autoRegenerateForMissingCode(fullText, problems, replyContext);
      } else {
        showCodeGuardBlock(
          "여러 번 다시 생성했지만 실행 가능한 코드를 받지 못했습니다:\n- " + problems.join("\n- ") +
            "\n요청을 더 구체적으로(대상 시트/열/값) 다시 보내 주세요.",
          {},
        );
      }
    }
  }
}

function createReasoningBox(text) {
  const box = document.createElement("div");
  box.className = "reasoning-box";
  const toggle = document.createElement("button");
  toggle.className = "reasoning-toggle";
  toggle.type = "button";
  toggle.textContent = "생각 펼치기";
  const content = document.createElement("div");
  content.className = "reasoning-content";
  content.textContent = text;
  toggle.onclick = () => {
    const open = box.classList.toggle("open");
    toggle.textContent = open ? "생각 접기" : "생각 펼치기";
    if (open) {
      scrollReasoningToBottom(content);
      scrollChatToBottom();
    }
  };
  box.appendChild(toggle);
  box.appendChild(content);
  return box;
}

function openInsertPositionDialog(currentCount, onConfirm, preferredPosition) {
  const modal = $("modal");
  const maxPos = currentCount + 1;
  const preferred = Number(preferredPosition);
  const defaultPos = Number.isFinite(preferred)
    ? Math.max(1, Math.min(maxPos, Math.floor(preferred)))
    : Math.max(1, currentCount); // 보통 마지막 단계 직전이 가장 자주 쓰임
  modal.innerHTML = `
    <h3>몇 번째 단계에 삽입할까요?</h3>
    <p style="font-size:12px; color:#666; margin-bottom:10px">
      현재 파이프라인은 <b>${currentCount}</b> 단계입니다.<br>
      <b>1</b> ~ <b>${maxPos}</b> 사이의 숫자를 입력하세요. (1: 맨 앞, ${maxPos}: 맨 뒤)
    </p>
    <input type="number" id="insert-pos" min="1" max="${maxPos}" value="${defaultPos}" />
    <div class="row">
      <button class="btn-secondary" id="modal-cancel">취소</button>
      <button class="btn-primary" id="modal-confirm">삽입</button>
    </div>
  `;
  $("modal-bg").classList.add("show");
  setTimeout(() => { const el = $("insert-pos"); if (el) el.select(); }, 50);
  const close = () => $("modal-bg").classList.remove("show");
  $("modal-cancel").onclick = close;
  const confirm = () => {
    const v = parseInt($("insert-pos").value, 10);
    if (isNaN(v) || v < 1 || v > maxPos) {
      toast(`1 ~ ${maxPos} 사이의 숫자를 입력하세요`, "error");
      return;
    }
    close();
    onConfirm(v);
  };
  $("modal-confirm").onclick = confirm;
  $("insert-pos").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); confirm(); }
  });
}

function setupStreamingAssistantMessage(container, modeLabel, aiName, onStop, onStopThinking) {
  let initialized = false;
  let reasoningBox;
  let reasoningToggle;
  let reasoningContent;
  let stopBtn;
  let stopThinkBtn;
  let answerText;
  let codeBlock;
  let statusText;
  let answerRenderer;
  let reasoningRenderer;

  // #10: think 모드면 '생각 중단'(thinking 만 끊고 답변 받기) + '요청 중단'(전체 종료) 두 버튼,
  // 아니면 기존처럼 단일 '중단'.
  const stopButtonsHtml = () => {
    if (!onStop) return "";
    if (onStopThinking) {
      return '<span class="stream-stop-group">'
        + '<button class="stream-stop-think-btn" type="button">생각 중단</button>'
        + '<button class="stream-stop-btn" type="button">요청 중단</button></span>';
    }
    return '<button class="stream-stop-btn" type="button">중단</button>';
  };
  const wireStopButtons = () => {
    stopBtn = container.querySelector(".stream-stop-btn");
    stopThinkBtn = container.querySelector(".stream-stop-think-btn");
    if (stopBtn && onStop) {
      stopBtn.onclick = () => {
        stopBtn.disabled = true;
        stopBtn.textContent = "중단 중...";
        if (stopThinkBtn) stopThinkBtn.disabled = true;
        onStop();
      };
    }
    if (stopThinkBtn && onStopThinking) {
      stopThinkBtn.onclick = () => {
        stopThinkBtn.disabled = true;
        stopThinkBtn.textContent = "생각 중단 중...";
        onStopThinking();
      };
    }
  };

  container.classList.add("loading");
  container.innerHTML = `
    <div class="streaming-topbar">
      <span><span class="loader"></span> ${escapeHtml(modeLabel)}${escapeHtml(aiName)}에게 전송 중...</span>
      ${stopButtonsHtml()}
    </div>
  `;
  wireStopButtons();
  scrollChatToBottom();

  function initialize() {
    if (initialized) return;
    initialized = true;
    container.classList.remove("loading");
    container.innerHTML = `
      ${onStop ? '<div class="streaming-topbar"><span class="stream-status"></span>' + stopButtonsHtml() + '</div>' : ""}
      <div class="reasoning-box" hidden>
        <button class="reasoning-toggle" type="button">생각 펼치기</button>
        <div class="reasoning-content"></div>
      </div>
      <div class="assistant-stream">
        <div class="assistant-stream-text"></div>
        <pre class="code-block assistant-stream-code" hidden></pre>
      </div>
    `;
    reasoningBox = container.querySelector(".reasoning-box");
    reasoningToggle = container.querySelector(".reasoning-toggle");
    reasoningContent = container.querySelector(".reasoning-content");
    answerText = container.querySelector(".assistant-stream-text");
    codeBlock = container.querySelector(".assistant-stream-code");
    statusText = container.querySelector(".stream-status");
    if (statusText) statusText.textContent = `${modeLabel}${aiName} 응답 수신 중...`;
    wireStopButtons();
    answerRenderer = createSmoothStructuredRenderer(
      answerText,
      codeBlock,
      `${modeLabel}${aiName} 응답 수신 중...`,
    );
    reasoningRenderer = createSmoothTextRenderer(reasoningContent, "", () => {
      if (reasoningBox && reasoningBox.classList.contains("open")) {
        scrollReasoningToBottom(reasoningContent);
      }
      scrollChatToBottom();
    });

    reasoningToggle.onclick = () => {
      const open = reasoningBox.classList.toggle("open");
      reasoningToggle.textContent = open ? "생각 접기" : "생각 펼치기";
      if (open) {
        scrollReasoningToBottom(reasoningContent);
        scrollChatToBottom();
      }
    };
  }

  return {
    setAnswer(text) {
      initialize();
      answerRenderer.setTarget(text);
      scrollChatToBottom();
    },
    setReasoning(text) {
      if (!text) return;
      initialize();
      reasoningBox.hidden = false;
      reasoningRenderer.setTarget(text);
      if (!reasoningBox.classList.contains("open")) reasoningToggle.textContent = "생각 펼치기";
      if (reasoningBox.classList.contains("open")) scrollReasoningToBottom(reasoningContent);
      scrollChatToBottom();
    },
    setStatus(text) {
      initialize();
      if (statusText) statusText.textContent = text || "";
      scrollChatToBottom();
    },
    flush() {
      if (!initialized) initialize();
      answerRenderer.flush();
      reasoningRenderer.flush();
      if (reasoningBox && reasoningBox.classList.contains("open")) scrollReasoningToBottom(reasoningContent);
      if (stopBtn) stopBtn.remove();
      if (stopThinkBtn) stopThinkBtn.remove();
    },
    stopped() {
      if (stopBtn) {
        stopBtn.disabled = true;
        stopBtn.textContent = "중단됨";
      }
      if (stopThinkBtn) stopThinkBtn.remove();
    },
  };
}

function showThinkRetryPrompt(container, context) {
  context = context || {};
  const prompt = context.prompt || "";
  const editTargetId = context.editTargetId || null;
  const sourceUserMessage = context.sourceUserMessage || latestUserRequestForSafety();
  const modeLabel = context.modeLabel || "";
  const aiName = context.aiName || "LLM";
  const message = context.message || "Think 요청이 중단되었습니다.";
  const detail = context.detail || "Think 없이 다시 요청할 수 있습니다.";
  container.classList.remove("streaming", "loading");
  container.classList.add("think-retry");
  container.innerHTML = `
    <div>${escapeHtml(message)}</div>
    <div style="font-size:12px; color:#666; margin-top:4px">${escapeHtml(detail)}</div>
    <div class="action-btns" style="margin-top:8px">
      <button class="action-btn" type="button">Think 없이 재요청</button>
    </div>
  `;
  const retryBtn = container.querySelector("button");
  retryBtn.onclick = async () => {
    const abortController = new AbortController();
    const streamView = setupStreamingAssistantMessage(container, modeLabel, aiName, () => abortController.abort());
    container.classList.add("streaming");
    $("chat-send").disabled = true;
    try {
      const reply = await callLLM(prompt, {
        editTargetId,
        thinkMode: false,
        skipHistoryPush: true,
        signal: abortController.signal,
        onDelta: (delta, full) => {
          streamView.setAnswer(full);
          scrollChatToBottom();
        },
      });
      streamView.flush();
      container.remove();
      addAssistantReply(reply, { editTargetId, sourceUserMessage, reasoning: "" });
      scrollChatToBottom();
    } catch (err) {
      try { streamView.flush(); } catch (_) {}   // [24시간 버벅임 수정] 오류/중단에도 타자기 RAF 정지 보장
      container.classList.remove("streaming", "loading");
      if (err && err.name === "AbortError") {
        streamView.stopped();
        container.textContent = "재요청을 중단했습니다.";
      } else {
        container.innerHTML = "재요청 실패: " + escapeHtml(err.message);
        container.classList.remove("assistant");
        container.classList.add("system", "error");
      }
      scrollChatToBottom();
    } finally {
      $("chat-send").disabled = false;
    }
  };
  // #10 '생각 중단': 버튼 클릭을 기다리지 않고 Think 없이 즉시 재요청.
  if (context.autoStart) retryBtn.click();
}

function createSmoothStructuredRenderer(textEl, codeEl, emptyText) {
  const textRenderer = createSmoothTextRenderer(textEl, emptyText, scrollChatToBottom);
  const codeRenderer = createSmoothTextRenderer(codeEl, "", () => {
    codeEl.scrollTop = codeEl.scrollHeight;
    scrollChatToBottom();
  });

  return {
    setTarget(text) {
      const parsed = splitStreamingReply(text);
      textRenderer.setTarget(parsed.text);
      codeEl.hidden = !parsed.hasCode;
      codeRenderer.setTarget(parsed.code);
    },
    flush() {
      textRenderer.flush();
      codeRenderer.flush();
    },
  };
}


// 키는 step id(없으면 코드 본문) — 복구 요청 횟수를 step 단위로 센다.
const PYTHON_RUNTIME_FAIL_VBA_THRESHOLD = 2;
const _pythonRuntimeFailCounts = new Map();

function _pythonRuntimeFailKey(step) {
  if (!step) return "";
  return String(step.id || "") || ("code:" + String(step.code || "").slice(0, 400));
}

function notePythonRuntimeFailure(step) {
  const key = _pythonRuntimeFailKey(step);
  if (!key) return 1;
  const next = (_pythonRuntimeFailCounts.get(key) || 0) + 1;
  _pythonRuntimeFailCounts.set(key, next);
  return next;
}

function clearPythonRuntimeFailures() {
  _pythonRuntimeFailCounts.clear();
}

function resolveErrorRecoveryStepIndex(stepIdx, errorInfo) {
  // 우선순위: 정확 식별자(stepId → code) → 설명 → '숫자 인덱스' 폴백.
  // [증상 B 수정] 예전엔 stepId/code 가 '있는데 안 맞으면'(hasIdentity) 곧바로 -1 을 반환해,
  // 바로 아래의 신뢰 가능한 숫자 인덱스 폴백(state.pipeline[24] = 25단계)에 도달조차 못 했다.
  // 그 결과 isExistingStep=false → editTargetId=null → 수정이 'in-place 교체'가 아니라 '새 스텝
  // append'(25 오류인데 30으로 추가)로 새어 나갔다. 병렬 함수 resolveRunnerRecoveryStepIndex 는
  // '숫자 우선'이라 서로 모순됐다 — 여기서도 숫자 폴백을 반드시 시도한다.
  if (errorInfo && errorInfo.stepId) {
    const byId = state.pipeline.findIndex(step => step && step.id === errorInfo.stepId);
    if (byId >= 0) return byId;
  }
  if (errorInfo && errorInfo.code) {
    const byCode = state.pipeline.findIndex(step => step && step.code === errorInfo.code);
    if (byCode >= 0) return byCode;
  }
  if (errorInfo && errorInfo.description) {
    const byDesc = state.pipeline.findIndex(step => step && step.description === errorInfo.description);
    if (byDesc >= 0) return byDesc;
  }
  const numeric = Number(stepIdx);
  if (Number.isInteger(numeric) && numeric >= 0 && state.pipeline[numeric]) return numeric;
  return -1;
}

// Python COM 의 읽기 셀 한도(PY_READ_MAX_CELLS) 초과 런타임 오류인지 판별한다.
// 이 오류는 범위가 작아진다고 풀리는 게 아니라 Python COM 의 구조적 한계라, 같은 작업을
// VBA 매크로(벌크 배열/AutoFilter)로 전환해 다시 시도하는 게 정답이다. → 즉시 VBA 전환 + 자동 복구.
function isPythonComReadLimitRuntimeError(message) {
  const m = String(message || "");
  return /읽기\s*범위가\s*너무\s*큽니다/.test(m)
    || /Python\s*COM\s*은?\s*단순\s*작업용으로\s*보수적으로\s*제한/.test(m)
    // 백엔드 정적 게이트가 "큰 표를 ctx.read 로 Python 리스트에 올려…" 로 막은 경우도 같은 범주
    // (Python COM 읽기가 너무 무겁다 → VBA 전환)라 동일하게 자동 VBA 복구 대상으로 본다.
    || /큰\s*표를\s*ctx\.read\s*로\s*Python\s*리스트에\s*올려/.test(m);
}

async function requestErrorRecovery(stepIdx, errorInfo, userNote) {
  const recoveryNoteText = String(userNote || "").trim();
  const reportedStepIdx = Number((errorInfo && errorInfo.stepIdx) ?? stepIdx);
  stepIdx = resolveErrorRecoveryStepIndex(stepIdx, errorInfo);
  const displayStepNumber = Number.isInteger(reportedStepIdx) && reportedStepIdx >= 0
    ? reportedStepIdx + 1
    : (stepIdx >= 0 ? stepIdx + 1 : (state.pipeline || []).length + 1);
  let failedStep = stepIdx >= 0 ? (state.pipeline[stepIdx] || null) : null;
  if (!failedStep || !failedStep.code) {
    failedStep = failedStep || {
      id: errorInfo && errorInfo.stepId,
      description: errorInfo && errorInfo.description,
      code: errorInfo && errorInfo.code,
      language: errorInfo && errorInfo.language,
    };
  }
  if (!failedStep || !failedStep.code) {
    // [버그수정] 예전엔 명시 타깃(stepIdx/stepId/설명)이 하나라도 있으면 이 '마지막 단계 추정' 폴백을
    // 건너뛰었다. 그래서 그 타깃 step 이 파이프라인에 없거나 errorInfo.code 가 비어 있으면(예: 라이브
    // 적용 실패 후 롤백된 step, 아직 파이프라인에 안 올라간 chat 재생성 코드) 곧바로 "복구에 사용할 스킬
    // 코드를 찾지 못했습니다" 로 막혔다. 이제 코드를 못 찾으면 타깃 유무와 무관하게 '적용 가능한 마지막
    // 단계(코드 있는)'를 복구 대상으로 추정한다(대개 방금 실패한 그 step 이라 정확하다).
    const enabledSteps = (state.pipeline || []).filter(s => s && s.enabled !== false && s.code);
    const guess = enabledSteps[enabledSteps.length - 1];
    if (guess) {
      failedStep = guess;
      stepIdx = state.pipeline.indexOf(guess);
    }
  }
  if (!failedStep || !failedStep.code) {
    toast("복구에 사용할 스킬 코드를 찾지 못했습니다(파이프라인에 코드가 있는 단계가 없습니다). 채팅에서 스킬을 먼저 만들어 적용해 주세요.", "error");
    return;
  }
  const isExistingStep = stepIdx >= 0 && state.pipeline[stepIdx] === failedStep;
  const recoveryLanguage = failedStep.language ||
    (typeof inferPipelineStepLanguage === "function" ? inferPipelineStepLanguage(failedStep) : "python");
  const recoverySignals = [
    recoveryLanguage,
    failedStep && failedStep.code,
    failedStep && failedStep.description,
    errorInfo && errorInfo.language,
    errorInfo && errorInfo.message,
    errorInfo && errorInfo.stack,
    recoveryNoteText,
  ].filter(Boolean).join("\n");
  const failedStepLooksVba = recoveryLanguage === "vba" || /Sub\s+B2BSkill\s*\(|End\s+Sub|B2B_RunSkill/i.test(recoverySignals);
  const failedStepLooksPython = recoveryLanguage === "python" || /def\s+transform\s*\(\s*ctx\s*\)\s*:|\bctx\.\w+\s*\(/i.test(recoverySignals);
  let recoveryBaseSourceUserMessage = [
    failedStep && failedStep.prompt,
    latestUserRequestForSafety(),
  ].filter(Boolean)[0] || "";
  // [하이브리드 2단계: 녹화 VBA → Python 번역 복구] 녹화 스텝은 대화 명세가 없어 복구 재생성의
  // 근거가 "[녹화됨/VBA] 제목" 한 줄뿐이었다(오귀속·빈약한 재생성의 원인). 원문 VBA 가 곧 완전한
  // 명세이므로, 복구 요청문에 VBA 원문+의도를 '번역 명세'로 넣어 기존 재생성 기계(스키마·정적검사·
  // 적용게이트·ctx 문서)가 등가 Python(ctx) 코드를 만들게 한다. 전면 전환이 아니라 실패 스텝만이며,
  // 결과 동일성은 재현 검증(record/verify 다이제스트)으로 확인한다. VBA 원문은 절대 요약하지 않는다.
  const recoveryRecordedVba = !!(failedStep
    && (failedStep.recorded || /\[녹화됨\/VBA\]/.test(String(failedStep.prompt || "")))
    && (recoveryLanguage === "vba" || /\bSub\s+B2BSkill\b/i.test(String(failedStep.code || ""))));
  if (recoveryRecordedVba) {
    recoveryBaseSourceUserMessage = [
      "다음 '녹화된 VBA 매크로' 단계가 실행 중 실패했습니다. 이 매크로가 수행하는 작업과 완전히 동일한",
      "결과를 내도록 재작성해 주세요(동작 순서·입력 값·대상 셀/시트/파일을 임의로 바꾸지 말 것).",
      "가능하면 ctx 헬퍼 기반 Python 으로 번역하세요 — 셀 좌표 하드코딩보다 헤더/마지막행 기반이 좋지만,",
      "녹화가 명시한 값·좌표의 '결과'는 반드시 보존해야 합니다.",
      "```vba",
      String((failedStep && failedStep.code) || "").trim(),
      "```",
      failedStep.intentReason ? `추가 의도(사용자가 검토창에 적음): ${failedStep.intentReason}` : "",
      failedStep.recordedWorkbook ? `대상 워크북: ${failedStep.recordedWorkbook}` : "",
      failedStep.targetSheetName ? `기준 시트: ${failedStep.targetSheetName}` : "",
    ].filter(Boolean).join("\n");
    try { if (typeof traceClientUiEvent === "function") traceClientUiEvent("recovery.recorded_vba_spec", { stepId: String(failedStep.id || "") }); } catch (_) {}
    // [검증 게이트 연동] 이 스텝이 번역 복구 대상임을 표시 — 이후 재실행 완료 시
    // 녹화 기대 다이제스트와 자동 대조(runIsolatedLivePipelineSteps 말미)하는 트리거.
    try { failedStep._recoveredFromVba = true; } catch (_) {}
  }
  // [사용자 지시] 에러복구에서는 "실패한 기존 Step 언어"보다 복구창의 사용자 메모가 우선이다.
  // 특히 VBA 로 생성된 코드가 실패한 뒤 복구 후보가 Python/ctx 로 나왔으면 그대로 적용 가능해야 하며,
  // 적용 직전 라우팅 규칙이 다시 VBA 로 되돌리면 안 된다. 사용자가 복구창에서 명시적으로 "vba로"라고
  // 쓴 경우에만 VBA 복구를 강제한다.
  const recoveryExplicitVba = (function () {
    const intent = recoveryNoteText;
    return typeof userExplicitlyRequestsVba === "function"
      && userExplicitlyRequestsVba(intent)
      && !(typeof userExplicitlyRequestsPython === "function" && userExplicitlyRequestsPython(intent));
  })();
  const recoveryExplicitPython = (function () {
    const intent = recoveryNoteText;
    return typeof userExplicitlyRequestsPython === "function"
      && userExplicitlyRequestsPython(intent)
      && !(typeof userExplicitlyRequestsVba === "function" && userExplicitlyRequestsVba(intent));
  })();
  // filter_to_sheet is a native ctx helper. Do not force filter recovery back to VBA
  // unless the later Python read-limit guard proves the generated code used a risky wide read.
  const hardFilterToSheetRecovery = false;
  const recoveryAllowsPython = !recoveryExplicitVba && !hardFilterToSheetRecovery;
  let isVbaRecovery = recoveryExplicitVba || hardFilterToSheetRecovery;
  let isPythonRecovery = !hardFilterToSheetRecovery && (recoveryExplicitPython ||
    (!isVbaRecovery && (failedStepLooksVba || failedStepLooksPython ||
      (typeof getSkillEngine === "function" && getSkillEngine() === "python"))));
  // [0.5.2.2 §4.2] Python COM 런타임 실패가 같은 step 에서 누적되면(기본 2회) Python COM 기반
  // 자체의 제약으로 판단하고 이번 복구부터 VBA 전환 생성을 시도한다(전역 엔진 설정은 불변).
  let vbaRuntimeSwitch = false;
  if (isPythonRecovery) {
    // [사용자 지시] Python COM 읽기 한도 초과 오류는 범위만 좁힌다고 풀리는 게 아니라 구조적 한계이므로,
    // 누적 실패 횟수를 기다리지 않고 첫 발생부터 곧바로 VBA 매크로로 전환해 복구한다(사용자가 복구창에서
    // 명시적으로 python 을 요구한 경우는 제외 — 기존 정책 일관성).
    const readLimitRuntime = !recoveryExplicitPython
      && isPythonComReadLimitRuntimeError((errorInfo && errorInfo.message) || "");
    const pythonFailCount = notePythonRuntimeFailure(failedStep);
    // [버그수정] 예전엔 이 누적-실패 전환을 '!recoveryAllowsPython' 으로 가드했는데, 이 블록(isPythonRecovery)
    // 에 오면 recoveryAllowsPython 은 사실상 항상 true(그렇지 않으면 애초에 VBA 복구로 갈렸음) → 조건이 죽어
    // Python 이 몇 번을 실패해도 계속 Python 만 재시도했다. 이제 '사용자가 명시적으로 Python 을 요구한 경우'만
    // 제외하고, 같은 step 에서 Python 런타임 실패가 임계치(기본 2회) 쌓이면 VBA 매크로로 전환한다.
    if (readLimitRuntime || (!recoveryExplicitPython && pythonFailCount >= PYTHON_RUNTIME_FAIL_VBA_THRESHOLD)) {
      vbaRuntimeSwitch = true;
      isVbaRecovery = true;
      isPythonRecovery = false;
      toast(readLimitRuntime
        ? "Python COM 읽기 범위 한도를 넘어 VBA 매크로로 전환해 자동 복구합니다."
        : `Python 실행이 ${pythonFailCount}회 실패해 VBA 매크로로 전환해 복구를 시도합니다.`, "success");
    }
  }
  const recoveryCodeRule = isVbaRecovery
    ? "Return exactly one VBA code block that defines Sub B2BSkill(). Do not return JavaScript or Python."
    : (isPythonRecovery
      ? "Return exactly one Python code block that defines def transform(ctx):. Do not return JavaScript."
      : "Return exactly one JavaScript code block that defines function transform(inputs, output).");
  const keepVbaRecoveryRule = isVbaRecovery
    ? "실패한 Step은 VBA입니다. 복구도 반드시 VBA로 유지하세요. Python COM으로 전환하면 대용량/조건/필터/매칭 작업에서 저사양 VM이 멈출 수 있으므로 Python def transform(ctx)는 절대 작성하지 마세요."
    : "";
  const allowPythonRecoveryRule = isPythonRecovery && recoveryAllowsPython
    ? "중요: 에러복구에서는 실패한 Step이 VBA였더라도 Python ctx 코드로 복구할 수 있습니다. 사용자가 복구창에서 명시적으로 VBA를 요구하지 않았으므로, ctx 헬퍼/ctx API로 해결 가능한 복구는 Python def transform(ctx): 로 작성하세요. 이후 적용 단계에서도 이 Python 복구 후보를 다시 VBA로 전환하지 않습니다."
    : "";
  const hardFilterRecoveryRule = hardFilterToSheetRecovery
    ? "중요: 이 Step은 대용량 열에서 특정 값을 찾아 새 시트를 만드는 작업입니다. Python ctx.read 로 전체 범위를 읽는 복구는 앱을 멈출 수 있으므로, ctx.filter_to_sheet 헬퍼 또는 VBA AutoFilter + SpecialCells(xlCellTypeVisible).Copy Destination 방식으로 작성하세요."
    : "";
  const useCompatibilityCheck = !!(errorInfo && errorInfo.compatibilityCheck);
  const sourceUserMessage = recoveryBaseSourceUserMessage;
  const recoveryApplySourceUserMessage = [
    sourceUserMessage,
    recoveryNoteText ? `에러복구 추가 설명: ${recoveryNoteText}` : "",
  ].filter(Boolean).join("\n");
  const schemaSummary = useCompatibilityCheck && typeof buildSchemaSummary === "function" ? buildSchemaSummary() : "";
  const recentHistory = useCompatibilityCheck ? (state.chatHistory || [])
    .slice(-8)
    .map(msg => {
      const role = msg && msg.role ? msg.role : "unknown";
      const content = msg && (msg.content || msg.text || msg.message) ? (msg.content || msg.text || msg.message) : "";
      return `${role}: ${String(content).slice(0, 1200)}`;
    })
    .filter(Boolean)
    .join("\n") : "";
  const compatibilityPrompt = useCompatibilityCheck && !isVbaRecovery ? [
    "",
    "## 복구 방식",
    "- 코드는 자동 교체하지 않습니다. 사용자가 '수정 적용' 버튼을 눌러 적용할 수 있도록 수정 후보만 제안하세요.",
    "- 실패한 Step 하나만 고치세요. 이전/다음 Step의 작업을 반복하거나 새 기능을 추가하지 마세요.",
    "- 먼저 호환성 검사를 수행한 뒤, 그 결과를 반영한 코드블록 하나를 작성하세요.",
    "",
    "## 실행기 호환성 검사 순서",
    "1. inputs[\"정확한_파일명.xlsx\"]처럼 파일명을 하드코딩해서 새 실행 파일명과 맞지 않는지 확인하세요.",
    "2. 날짜/월/버전/배치번호만 다른 파일이면 전체 파일명을 고정하지 말고 시트명/컬럼명 기준으로 찾으세요.",
    "3. 시트명이 기준이면 findInputBySheet(inputs, \"시트명\")을 사용하세요. 반환값은 {fileName, file, sheetName, sheet} 입니다.",
    "4. 컬럼은 고정 인덱스보다 col(sheet, \"컬럼명\")으로 다시 찾으세요.",
    "5. 회사명/월/날짜처럼 공백 차이가 날 수 있는 값은 equalsNormalizedText/includesNormalizedText/replaceNormalizedText를 사용하세요.",
    "6. 시트명이 여러 파일에 있을 수 있으면 사용자 의도와 현재 스키마를 기준으로 가장 맞는 파일을 선택하세요.",
    "",
    "## findInputBySheet 사용 예시",
    "```javascript",
    "const found = findInputBySheet(inputs, \"빈시트\");",
    "if (!found) return { inputs, output };",
    "const file = found.file;",
    "const sheet = found.sheet;",
    "```",
  ] : useCompatibilityCheck ? [
    "",
    "## 복구 방식",
    "- 코드는 자동 교체하지 않습니다. 사용자가 '수정 적용' 버튼을 눌러 적용할 수 있도록 수정 후보만 제안하세요.",
    "- 실패한 Step 하나만 고치세요. 이전/다음 Step의 작업을 반복하거나 새 기능을 추가하지 마세요.",
    "- 실패한 Step은 VBA입니다. 반드시 ActiveWorkbook/Workbooks(...).Worksheets(...) 기준의 VBA 코드로 복구하세요.",
  ] : [];

  const userNoteBlock = recoveryNoteText ? [
    "## ★ 사용자 추가 설명 — 최우선 반영",
    "아래는 사용자가 직접 적은 '하려던 작업 / 실제로 나온 결과 / 기대하는 결과'입니다. 다른 어떤 추론보다 이 설명을 가장 우선해서, 대화 히스토리·실패 코드·오류와 함께 반영해 코드를 고치세요.",
    recoveryNoteText,
    "",
  ] : [];

  const prompt = [
    ...(vbaRuntimeSwitch ? [
      "",
      "## Python → VBA 전환 (중요)",
      "아래 Python 스킬은 같은 작업에서 런타임 오류로 여러 번 실패했습니다. Python COM(ctx) 기반의 제약일 수 있으니, 이번에는 같은 작업을 수행하는 VBA 매크로(Sub B2BSkill())로 전환해 작성하세요.",
      "실패한 Python 코드를 그대로 번역하지 말고, 오류 원인을 피해 VBA 의 방식(헤더 이름으로 열 찾기, 실제 범위 한정, 벌크 배열 입출력)으로 다시 설계하세요.",
    ] : []),
    ...userNoteBlock,
    `Step ${displayStepNumber} 실행 중 오류가 발생했습니다.`,
    isExistingStep
      ? "대화 히스토리의 사용자 의도, 현재 파일 스키마, 수정 대상 코드, 아래 오류를 함께 분석해서 이 Step을 교체할 수정 코드를 다시 작성하세요."
      : "이 Step은 아직 파이프라인에 적용되지 못했습니다. 대화 히스토리의 사용자 의도, 현재 파일 스키마, 실패한 코드, 아래 오류를 함께 분석해서 적용 가능한 새 스킬 코드를 다시 작성하세요.",
    recoveryCodeRule,
    keepVbaRecoveryRule,
    allowPythonRecoveryRule,
    hardFilterRecoveryRule,
    "오류 복구는 실패 원인만 고치는 작업입니다. 사용자의 최신 요청에 없는 대상 파일/시트 변경이나 무관한 전체 범위 재작성은 새로 추가하지 마세요.",
    "사용자에게 보여줄 설명은 '간결하되 친절하게' 쓰세요: ① 무엇이 왜 안 됐는지 한 문장, ② (있으면) 사용자가 확인/입력할 것 한두 문장. 그게 전부입니다. 장황한 배경 서술·같은 말 반복·과한 공감/사과·이모지 남발은 빼고, 짧은 문장으로 핵심만 또렷하게. (코드블록은 설명과 별개로 그대로 출력)",
    "\"채워\", \"입력\", \"업데이트\", \"반영\"은 요청받은 대상 범위에 값을 쓰라는 뜻입니다. 그 대상 셀에 기존 수식이 있더라도 값으로 대체할 수 있습니다. 단, 표 끝의 합계/소계/부가세포함 같은 요약 행은 데이터 행이 아니므로 범위에서 제외하세요.",
    ...compatibilityPrompt,
    recoveryCodeRule,
    "",
    "## 실패한 Step",
    `설명: ${failedStep.description || ""}`,
    "",
    "## 실패한 코드",
    "```" + (vbaRuntimeSwitch ? "python" : (isVbaRecovery ? "vba" : (isPythonRecovery ? "python" : "javascript"))),
    failedStep.code || "",
    "```",
    "",
    "## 상세 오류",
    `메시지: ${(errorInfo && errorInfo.message) || ""}`,
    errorInfo && errorInfo.stack ? `\n스택:\n${errorInfo.stack}` : "",
    recentHistory ? "\n## 최근 대화/사용자 의도\n" + recentHistory : "",
    schemaSummary ? "\n## 현재 업로드 파일/시트/컬럼 스키마\n" + schemaSummary : "",
  ].filter(Boolean).join("\n");

  addMessage("system", `Step ${displayStepNumber} 에러 복구를 요청합니다.${recoveryNoteText ? "\n📝 추가 설명: " + recoveryNoteText : ""}`);
  const loading = addMessage("assistant", "", {});
  loading.classList.add("streaming");

  const aiName = settings.provider === "openai-compat" ? "ixi 모델" : "LLM";
  const thinkMode = typeof isThinkModeEnabled === "function" && isThinkModeEnabled();
  const abortController = new AbortController();
  const streamView = setupStreamingAssistantMessage(loading, "(에러 복구) ", aiName, () => abortController.abort());
  $("chat-send").disabled = true;
  let reasoningText = "";

  try {
    const requestOptions = {
      // 에러 복구는 실패 Step의 언어를 유지한다. 저장된 VBA 스킬 전체실행 실패 후 복구가
      // Python ctx 로 바뀌면 사용자가 "반드시 vba"를 다시 입력해야 했고, 혼합 파이프라인의
      // 엔진 호환성도 깨진다. 이 호출 1회만 강제하며 전역 엔진 설정은 건드리지 않는다.
      forceEngine: isVbaRecovery ? "vba" : (isPythonRecovery ? "python" : undefined),
      editTargetId: isExistingStep ? failedStep.id : null,
      thinkMode,
      signal: abortController.signal,
      onDelta: (delta, full) => {
        streamView.setAnswer(full);
        scrollChatToBottom();
      },
      onReconnect: (attempt, maxAttempts) => {
        streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${attempt}/${maxAttempts})`);
        scrollChatToBottom();
      },
    };
    if (thinkMode) {
      requestOptions.onReasoningDelta = (delta, full) => {
        reasoningText = full;
        streamView.setReasoning(full);
        scrollChatToBottom();
      };
      requestOptions.onReasoningWarning = () => {
        const warning = "정확한 동작을 위해 생각이 길어지고 있습니다. 다만, 같은 말을 여러 번 반복할 경우 중단해주세요.";
        streamView.setStatus(warning);
        toast(warning, "success");
      };
    }
    const reply = await callLLM(prompt, requestOptions);
    streamView.flush();
    loading.remove();
    addAssistantReply(reply, {
      editTargetId: isExistingStep ? failedStep.id : null,
      sourceUserMessage: recoveryApplySourceUserMessage,
      allowPythonRecovery: recoveryAllowsPython,
      // VBA 로 짠 Step 이 실패해 Python 으로 복구하는 경우 → 적용을 무조건 통과시켜 VBA↔Python 루프 차단.
      recoveredFromVba: failedStepLooksVba && isPythonRecovery,
      reasoning: reasoningText,
    });
    scrollChatToBottom();
  } catch (err) {
    try { streamView.flush(); } catch (_) {}   // [24시간 버벅임 수정] 오류/중단에도 타자기 RAF 정지 보장
    loading.classList.remove("streaming");
    loading.classList.remove("loading");
    if (err && err.name === "AbortError" && thinkMode) {
      showThinkRetryPrompt(loading, {
        prompt,
        editTargetId: isExistingStep ? failedStep.id : null,
        sourceUserMessage: recoveryApplySourceUserMessage,
        allowPythonRecovery: recoveryAllowsPython,
        recoveredFromVba: failedStepLooksVba && isPythonRecovery,
        modeLabel: "(에러 복구) ",
        aiName,
        message: "Think 요청을 중단했습니다.",
        detail: "필요하면 Think 없이 같은 복구 요청을 다시 보낼 수 있습니다.",
      });
      scrollChatToBottom();
      return;
    }
    if (err && err.name === "AbortError") {
      streamView.stopped();
      loading.textContent = "에러 복구 요청이 중단되었습니다.";
    } else {
      loading.innerHTML = "복구 요청 실패: " + escapeHtml(err.message);
      loading.classList.remove("assistant");
      loading.classList.add("system", "error");
    }
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
  }
}

function splitStreamingReply(text) {
  const value = String(text || "");
  const fenceStart = value.indexOf("```");
  if (fenceStart < 0) {
    return { text: value, code: "", hasCode: false };
  }

  const before = value.slice(0, fenceStart).trim();
  let rest = value.slice(fenceStart + 3);
  rest = rest.replace(/^(javascript|js)\s*\n/i, "");
  const fenceEnd = rest.indexOf("```");
  const code = fenceEnd >= 0 ? rest.slice(0, fenceEnd).trimEnd() : rest;
  const after = fenceEnd >= 0 ? rest.slice(fenceEnd + 3).trim() : "";
  return {
    text: [before, after].filter(Boolean).join("\n\n") || "코드 작성 중...",
    code,
    hasCode: true,
  };
}

function createSmoothTextRenderer(el, emptyText, onRender) {
  let target = "";
  let shown = "";
  let rafId = null;
  let lastTs = performance.now();

  function render(ts) {
    rafId = null;
    if (!target) {
      shown = "";
      el.textContent = emptyText || "";
      if (onRender) onRender();
      return;
    }
    const elapsed = lastTs ? Math.max(0, ts - lastTs) : 16;
    lastTs = ts;
    const remaining = target.length - shown.length;
    if (remaining <= 0) {
      // [24시간 버벅임 수정] 다 그렸으면 루프를 '정지'한다. 예전엔 여기서 schedule()을 다시 불러
      // 60fps 헛돌기가 영원히 돌았다 — flush() 없이 끝나는 오류/중단 경로에서는 아무도 안 꺼줘서,
      // 실패한 채팅이 하나 생길 때마다 영구 RAF 루프가 하나씩 쌓여 장시간 구동 시 점점 무거워졌다.
      // 스트리밍으로 target 이 더 자라면 setTarget() 이 schedule() 을 다시 불러 재개된다.
      return;
    }
    const charsPerFrame = getSmoothCharsPerFrame(remaining, elapsed);
    shown = target.slice(0, shown.length + Math.min(remaining, charsPerFrame));
    el.textContent = shown;
    if (onRender) onRender();
    schedule();
  }

  function schedule() {
    if (rafId === null) rafId = requestAnimationFrame(render);
  }

  return {
    setTarget(text) {
      target = String(text || "");
      if (!target) {
        shown = "";
        el.textContent = emptyText || "";
        if (onRender) onRender();
        return;
      }
      if (!target.startsWith(shown)) shown = "";
      schedule();
    },
    flush() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      shown = target;
      el.textContent = target || emptyText || "";
      if (onRender) onRender();
    },
  };
}

function getSmoothCharsPerFrame(remaining, elapsed) {
  if (remaining > 240) return Math.max(3, Math.min(12, Math.ceil(elapsed / 8)));
  if (remaining > 80) return Math.max(2, Math.min(6, Math.ceil(elapsed / 12)));
  return 1;
}

// ── 검증(명확화) 에이전트 ───────────────────────────────────────────────
// 사용자가 질의를 모호하게 적어 AI 가 엉뚱하게 알아듣는 걸 막기 위해, 생성 전에 '이 요청만으로 정확한
// 스킬을 짤 수 있는지'를 별도 verifier 가 점검한다. 단 너무 빡세게 잡지 않는다:
//  (1) 값싼 휴리스틱으로 '대상(파일/시트/열)도 동작도 다 빠진' 막연한 질의만 의심 대상으로 거른다
//      (멘션·셀/열 참조·구체 동작이 하나라도 있으면 그냥 통과 → 평범한 요청엔 지연 0).
//  (2) 의심될 때만 별도 LLM 에게 OK/되묻기를 맡기고, 그 LLM 도 '합리적 추론 가능하면 OK' 로 관대하게 판단.
// 되묻기는 질의당 한 번만(보충 답변 턴은 검사를 건너뛰어 루프·막힘을 방지), 검증 실패 시엔 막지 않고 통과.
function clarifyVerifierDeterministicQuestion(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const hasMentions = /@(범위|시트|파일|컬럼)\[/.test(s);
  const multiSheetCopy = /(여러\s*개\s*시트|여러\s*시트|각\s*시트|시트명(?:들)?|모든\s*시트)/i.test(s)
    && /(복사|붙여|채워|입력|기입|반영|가져|매칭)/i.test(s)
    && /(헤더|괄호\s*안|괄호안|IN|OUT|입력|출력|열|범위)/i.test(s);
  const hasSourceAndDest = hasMentions && /@(파일|범위)\[/.test(s) && /@(?:범위|시트)\[/.test(s);
  const rowAlignmentSpecified = /(행\s*순서|순서대로|그대로\s*(?:복사|붙여|채워)|같은\s*행|동일\s*행|A\s*열|시간\s*(?:기준|매칭)|날짜\s*(?:기준|매칭)|일자\s*(?:기준|매칭)|키\s*(?:기준|매칭)|기준\s*열)/i.test(s);
  if (hasSourceAndDest && multiSheetCopy && !rowAlignmentSpecified) {
    return "여러 시트의 값을 대상 열에 넣을 때, 행은 소스 데이터 순서 그대로 붙이면 될까요, 아니면 날짜/시간 같은 기준 열로 대상 행과 매칭해야 하나요?";
  }
  // 집계 경계(합계 행 이중 합산 등)는 단어가 아니라 '데이터 구조'로 판단한다 → clarifyVerifierAskIfNeeded 의
  // 구조 다이제스트 + LLM 경로에서 처리(여기서 키워드로 잡지 않는다).
  return null;
}

function clarifyVerifierLikelyUnderspecified(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (clarifyVerifierDeterministicQuestion(s)) return true;
  if (/@(범위|시트|파일|컬럼)\[/.test(s)) return false;                       // 대상 멘션 있음 → 구체적
  if (/!\$?[A-Z]{1,3}\$?\d*(?::\$?[A-Z]{1,3}\$?\d*)?\]/i.test(s)) return false; // 멘션 내 셀/범위
  const hasColOrCell = /[A-Z]{1,3}\s*열|\b[A-Z]{1,3}\d{1,7}\b/.test(s);
  const hasConcreteAction = /(합계|합산|더해|평균|개수|건수|정렬|오름차순|내림차순|복사|붙여|삭제|지워|제거|추가|생성|삽입|필터|추출|골라|걸러|피벗|크로스탭|병합|이름\s*(?:변경|바꿔|바꾸)|이동|옮겨|계산|환산|변환|채워|입력|기입|반영|덮어|매칭|중복)/.test(s);
  if (hasColOrCell || hasConcreteAction) return false;                        // 충분히 구체적 → 통과
  return true;                                                                // 대상·동작 모두 불명확 → 의심
}

// ── [데이터 구조 다이제스트] 검증의 근거를 '요청 단어'가 아니라 '실제 시트 구조'에서 뽑는다.
//    합산 시 이중계산을 유발하는 합계/총계/소계 행, 부가세 안내 행, 구분 제목(■), 상단 병합 제목 등
//    '지뢰'를 위치와 함께 요약해 LLM 검증자에게 넘긴다(문구는 LLM 이 의미로 해석 → 키워드 매칭 폐기).
function _clarifyCellText(v) { return String(v == null ? "" : v).trim(); }
function _clarifyRowHasNumber(row) {
  for (let c = 0; c < (row ? row.length : 0); c++) {
    const v = row[c];
    if (typeof v === "number" && isFinite(v)) return true;
    if (typeof v === "string") {
      const n = v.replace(/[,\s₩원%()]/g, "");
      if (n && n !== "-" && !isNaN(Number(n))) return true;
    }
  }
  return false;
}
function _clarifyRowLeftLabel(row) {
  for (let c = 0; c < Math.min(row ? row.length : 0, 3); c++) {
    const t = _clarifyCellText(row[c]);
    if (t) return t;
  }
  return "";
}
// aoa → { text, hasLandmarks, totalRows[] }. 순수 함수(테스트 가능).
function buildSheetStructureDigest(aoa, sheetName) {
  const res = { text: "", hasLandmarks: false, totalRows: [] };
  if (!aoa || !aoa.length) return res;
  const TOTAL = /^(합\s*계|총\s*계|총합계|총\s*합|소\s*계|누\s*계|계|total|sum)$/i;
  let nCols = 0;
  for (const r of aoa) if (r && r.length > nCols) nCols = r.length;
  let firstDataRow = null;
  for (let r = 0; r < aoa.length; r++) {
    if (_clarifyRowHasNumber(aoa[r] || [])) { firstDataRow = r + 1; break; }
  }
  const landmarks = [];
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const label = _clarifyRowLeftLabel(row);
    const rowStr = row.map(_clarifyCellText).join(" ");
    let kind = null, isTotal = false;
    if (r >= 4 && TOTAL.test(label)) {
      // 라벨 우측에 값/내용이 있어야 진짜 '총계 행'(헤더의 '합계' 컬럼명과 구분)
      const hasContent = _clarifyRowHasNumber(row) || row.slice(3).some(v => _clarifyCellText(v));
      if (hasContent) { kind = "합계/총계/소계 행(합산 시 이중계산 위험)"; isTotal = true; }
    }
    if (!kind && /부가세/.test(rowStr) && /(별도|포함)/.test(rowStr)) kind = "부가세 안내 행";
    if (!kind && label.startsWith("■")) kind = "구분 제목 행";
    if (kind) {
      landmarks.push({ row: r + 1, label: label || "(빈 라벨)", kind });
      if (isTotal) res.totalRows.push(r + 1);
    }
  }
  const lines = [];
  lines.push(`[${sheetName || "대상 시트"}] 약 ${aoa.length}행 × ${nCols}열`
    + (firstDataRow ? `, 숫자 데이터 시작 ≈ ${firstDataRow}행` : ""));
  if (landmarks.length) {
    res.hasLandmarks = true;
    lines.push("표 안의 특이 행(합산/집계 시 주의):");
    landmarks.slice(0, 12).forEach(l => lines.push(`  · ${l.row}행 "${l.label}" — ${l.kind}`));
    if (landmarks.length > 12) lines.push(`  · … 외 ${landmarks.length - 12}개`);
  } else {
    lines.push("표 안에 합계/총계/소계·부가세 등 특이 행 없음(평범한 표).");
  }
  res.text = lines.join("\n");
  return res;
}
// [따옴표 구분자 공백 불일치 → 되묻기] 사용자가 "' : ' 뒤 숫자"처럼 공백 포함 구분자를 따옴표로 지정했는데
// 실제 셀 값은 '03:20.0'처럼 공백 없이 붙어 있으면, "따옴표는 리터럴" 규칙대로면 전 행 0건이고
// 공백을 무시하면 의도 확대해석이라 의도가 갈린다 — 한 번 되묻는 게 정답(현장 실측: 한화테크윈 DSMC U열).
// 요청 '단어' 추측이 아니라 (요청의 명시적 따옴표 토큰) × (실제 셀 값) 대조라는 데이터 근거로만 판단한다.
function _clarifySeparatorWhitespaceQuestion(text, aoa) {
  const s = String(text || "");
  if (!aoa || !aoa.length) return null;
  const tokens = [];
  const re = /['"‘’“”]([^'"‘’“”]{2,8})['"‘’“”]/g;
  let m;
  while ((m = re.exec(s)) && tokens.length < 4) {
    const tok = m[1];
    const core = tok.trim();
    // 공백이 붙어 있고 알맹이가 짧은 '기호' 구분자(: - / 등)일 때만 대상 — '시내호' 같은 값 리터럴은 제외.
    if (tok !== core && core && core.length <= 3 && !/[\w가-힣]/.test(core)) tokens.push({ tok, core });
  }
  if (!tokens.length) return null;
  const maxRows = Math.min(aoa.length, 5000);
  for (const { tok, core } of tokens) {
    let spacedFound = false;
    let coreExample = null;
    for (let r = 0; r < maxRows && !spacedFound; r++) {
      const row = aoa[r] || [];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (typeof v !== "string") continue;
        if (v.indexOf(tok) >= 0) { spacedFound = true; break; }
        if (coreExample === null && v.indexOf(core) >= 0) coreExample = v;
      }
    }
    if (!spacedFound && coreExample !== null) {
      const shown = String(coreExample).trim().slice(0, 20);
      return `실제 데이터에는 '${shown}'처럼 '${core}' 양옆에 공백이 없는 값만 보이고, 요청하신 '${tok}'(공백 포함) 형태는 없습니다. 공백을 무시하고 '${core}' 기준으로 처리할까요, 아니면 공백이 포함된 값만 매칭할까요?`;
    }
  }
  return null;
}

// 되물음 대상 시트 추정: @범위[파일/시트!범위] / @시트[..] / "○○ 시트" / 현재 활성 시트.
function _clarifyResolveSheet(text) {
  const s = String(text || "");
  let m = /@(?:범위|시트|컬럼)\[[^\]]*?\/([^\/!\]\[]+)!/.exec(s);   // @범위[파일/요약!F:F]
  if (m && m[1]) return m[1].trim();
  m = /[\/!]([^\/!\]\[]+?)!\$?[A-Z]{1,3}(?:\$?\d|:)/i.exec(s);      // .../요약!J4 또는 요약!F:F
  if (m && m[1]) return m[1].trim();
  m = /@시트\[[^\]]*?([^\/!\]\[]+)\]/.exec(s);
  if (m && m[1]) return m[1].trim();
  m = /([가-힣A-Za-z0-9_()]+)\s*시트/.exec(s);                       // "요약 시트"
  if (m && m[1]) return m[1].trim();
  return (typeof state !== "undefined" && state && state.currentSheet) ? state.currentSheet : null;
}
function _clarifyGetAoa(sheet) {
  if (typeof state === "undefined" || !state) return null;
  const f = (typeof getFile === "function") ? getFile(state.currentFileId) : null;
  const sh = sheet || state.currentSheet;
  return (f && f.sheets && sh && f.sheets[sh]) ? f.sheets[sh] : null;
}

async function clarifyVerifierAskIfNeeded(userMessage, options) {
  options = options || {};
  if (typeof callLLMOneShot !== "function") return null;
  const deterministicQuestion = clarifyVerifierDeterministicQuestion(userMessage);
  if (deterministicQuestion) return deterministicQuestion;

  // [데이터 다이제스트] 대상 시트의 실제 구조를 뽑아 LLM 에게 근거로 준다.
  const resolveSheet = options.resolveSheet || _clarifyResolveSheet;
  const getAoa = options.getAoa || _clarifyGetAoa;
  let digest = { text: "", hasLandmarks: false, totalRows: [] };
  let aoaForChecks = null;
  try {
    const sheet = resolveSheet(String(userMessage || ""));
    const aoa = options.aoa || (typeof getAoa === "function" ? getAoa(sheet) : null);
    aoaForChecks = aoa;
    digest = buildSheetStructureDigest(aoa, sheet);
  } catch (_) { /* 데이터 못 보면 다이제스트 없이 진행 */ }

  // [데이터 근거 결정형] 따옴표 구분자의 공백이 실제 셀 값과 안 맞으면 LLM 게이트와 무관하게 되묻는다
  // (@범위 멘션이 있으면 아래 vague 게이트가 항상 통과라 이 경로가 유일한 검출 지점).
  try {
    const sepQ = _clarifySeparatorWhitespaceQuestion(userMessage, aoaForChecks);
    if (sepQ) return sepQ;
  } catch (_) {}

  // 게이트: '데이터에 지뢰가 있음'(구조) 또는 '요청이 막연함'(휴리스틱)일 때만 LLM 검증.
  // → 평범한 표 + 구체 요청이면 LLM 호출 없이 통과(지연 0). 단어에 의존하지 않는다.
  const vague = clarifyVerifierLikelyUnderspecified(userMessage);
  if (!digest.hasLandmarks && !vague) return null;

  const schema = options.schema || (typeof buildSchemaSummary === "function" ? buildSchemaSummary() : "");
  const sys = [
    typeof OUTPUT_LANGUAGE_RULE === "string" ? OUTPUT_LANGUAGE_RULE : "",
    "당신은 Excel 자동화 스킬을 '만들기 전에' 요청이 정확한 스킬을 짜기에 충분한지 점검하는 검증자입니다.",
    "코드는 절대 작성하지 말고, 아래 둘 중 하나만 출력하세요:",
    "- 지금 그대로 정확한 스킬을 짤 수 있으면 정확히 'OK' 한 단어만.",
    "- 결과가 틀리거나 의도가 갈릴 수 있으면 'ASK: ' 뒤에 사용자가 답하기 쉬운 한국어 질문 한 문장.",
    "매우 관대하게 판단하세요. 합리적으로 추론 가능하면 무조건 OK. 질문은 최대 한 개.",
    "특히 아래 '대상 시트 구조'를 근거로 판단하세요. 사용자가 표현을 어떻게 했든(합계/합/소계 총액/합을 구해 등 무관), 뜻이 '어떤 열/범위를 합산·집계'하는 것인데 그 범위 안에 이미 '합계/총계/소계' 행이 들어가 이중계산으로 값이 크게 달라질 수 있으면, 그 합계 행을 포함할지 각 항목 행까지만 더할지 ASK 로 되물으세요.",
    "단, 사용자가 범위(예: F5:F19)나 포함/제외를 이미 지정했거나, 표에 그런 특이 행이 없으면 OK 하세요. 합산이 아닌 작업(정렬·삭제·서식 등)이면 특이 행이 있어도 OK.",
    digest.text ? ("### 대상 시트 구조(실제 데이터 기반)\n" + digest.text) : "",
    schema ? ("### 참고용 업로드 파일/시트/열\n" + schema) : "",
  ].filter(Boolean).join("\n");
  let reply = "";
  try {
    reply = await callLLMOneShot(sys, String(userMessage || ""), { maxTokens: 160, signal: options.signal });
  } catch (_) {
    return null;                                                              // 검증 실패 시 막지 않고 통과
  }
  const m = /^\s*ASK\s*[:：]\s*([\s\S]+)$/i.exec(String(reply || "").trim());
  if (!m) return null;
  const q = m[1].trim().replace(/\s+/g, " ").slice(0, 200);
  return q || null;
}

async function sendChat() {
  const input = $("chat-text");
  const rawMsg = input.value.trim();
  if (!rawMsg) return;
  if (!state.output && state.inputs.length === 0) { toast("입력 또는 출력 파일을 먼저 업로드하세요", "error"); return; }
  // [#5] 인플라이트 락: 처리 중에는 버튼 클릭/Enter 재입력을 막아 같은 요청 중복 전송을 방지.
  // (락 설정 이후의 await 는 락이 잡힌 상태라 재진입이 끼어들 수 없음. 해제는 finally/조기반환 지점.)
  if (window.__b2bChatInFlight) { toast("이전 요청을 처리 중입니다. 잠시 후 다시 시도하세요.", "error"); return; }
  // [검토 #18] 역방향 상호배제 — AI 도움이 도구 루프를 도는 중에 생성기 채팅이 시작되면 두 대화가
  // 같은 Excel/파이프라인 상태를 두고 겹친다(assist 쪽은 시작 시 이쪽을 확인하는데 반대는 없었다).
  if (typeof assistIsBusy === "function" && assistIsBusy()) {
    toast("AI 도움 창이 응답 중입니다. 끝나거나 중단한 뒤 다시 시도하세요.", "error");
    return;
  }
  window.__b2bChatInFlight = true;
  // 전송 시점의 수정 대상 step을 캡처해두면, 이후 사용자가 수정 모드를 토글해도 응답 버튼은 올바른 step을 가리킨다.
  const editTargetId = state.editingStepId || null;
  // [검증 에이전트] 직전 턴에 verifier 가 되물어봤다면, 이번 입력은 그 답변이다. 원 질의와 합쳐서 진행하고
  // 이번 턴은 다시 되묻지 않는다(루프·막힘 방지). 합친 텍스트로 라우팅/프롬프트를 구성하되 화면엔 답변만 표시.
  const clarifyPending = window.__b2bClarifyPending || null;
  window.__b2bClarifyPending = null;
  const msg = clarifyPending ? `${clarifyPending.original}\n\n[사용자 보충 설명] ${rawMsg}` : rawMsg;
  // [B2B#5 진단] 한 번의 전송에 고유 id 부여. 같은 id 로 응답이 2번 렌더되면 표시측 중복,
  // 서로 다른 id 가 한 사용자 동작에서 2개 나오면 전송측 중복. llm-api 의 재전송 로그와 대조.
  const reqId = (window.__b2bChatReqSeq = (window.__b2bChatReqSeq || 0) + 1);
  console.debug(`[B2B#5] req#${reqId} sendChat 시작 (editTarget=${editTargetId || "none"}${clarifyPending ? ", clarifyReply" : ""})`);
  input.value = "";
  const userMsgDiv = addMessage("user", rawMsg);
  scrollChatToBottom(true); // 전송 직후에는 위로 스크롤돼 있었어도 바닥으로
  clearViewerDragSelection();

  // [검증 에이전트] 수정 모드/보충 답변/강제 진행이 아니고, 질의가 모호해 보이면 한 번만 정확히 되묻는다.
  {
    const forceProceed = typeof userExplicitlyRequestsForceProceed === "function" && userExplicitlyRequestsForceProceed(rawMsg);
    if (!editTargetId && !clarifyPending && !forceProceed && typeof clarifyVerifierAskIfNeeded === "function") {
      const checking = addMessage("assistant", "🤔 요청을 정확히 이해했는지 확인하는 중…", {});
      checking.classList.add("streaming");
      scrollChatToBottom();
      let clarifyQuestion = null;
      try { clarifyQuestion = await clarifyVerifierAskIfNeeded(msg); } catch (_) { clarifyQuestion = null; }
      checking.remove();
      if (clarifyQuestion) {
        const ask = addMessage("assistant", "", {});
        ask.innerHTML = `<div>❓ ${escapeHtml(clarifyQuestion)}</div>`
          + `<div style="font-size:11px;color:#888;margin-top:6px">조금만 더 정확히 알려주시면 한 번에 맞춰 만들어 드려요. 그대로 진행해도 되면 \"그냥 진행\"이라고 답해 주세요.</div>`;
        scrollChatToBottom();
        window.__b2bClarifyPending = { original: msg };   // 다음 입력은 이 원 질의의 보충 답변으로 합쳐 처리
        window.__b2bChatInFlight = false;                 // 락 해제: 사용자가 바로 답할 수 있게(이번 턴은 생성 안 함)
        return;
      }
    }
  }
  const loading = addMessage("assistant", "", {});
  loading.classList.add("streaming");
  // 외부 노출 시엔 내부 모델명을 표시하지 않고 LLM 으로 통일
  const aiName = settings.provider === "openai-compat" ? "ixi 모델" : "LLM";
  const explicitVbaRequest = userExplicitlyRequestsVba(msg);
  // [사용자 지시] 채팅에서 python/COM 을 명시하면 VBA 기본값·휴리스틱보다 최우선으로 python 라우팅.
  const explicitPythonRequest = !explicitVbaRequest
    && typeof userExplicitlyRequestsPython === "function" && userExplicitlyRequestsPython(msg);
  const routeToVba = !explicitPythonRequest && shouldRouteRequestToVba(msg);
  const routeToPython = explicitPythonRequest || (!routeToVba && shouldRouteRequestToPython(msg));
  const routeToSimplePythonStructure = routeToPython && shouldRouteSimpleStructureEditToPython(msg);
  const routeCtxHelper = routeToPython && typeof ctxHelperPreferredIntent === "function" && ctxHelperPreferredIntent(msg);
  const routeMonthShift = routeToPython && typeof monthShiftIntent === "function" && monthShiftIntent(msg);
  const routeSimpleRangeArithmetic = routeToPython && typeof simpleRangeArithmeticIntent === "function" && simpleRangeArithmeticIntent(msg);
  const routePivot = routeToPython && typeof pivotIntent === "function" && pivotIntent(msg);
  const routeAppendSameFormat = routeToPython && typeof appendSameFormatSheetsIntent === "function" && appendSameFormatSheetsIntent(msg);
  const routeMultiValueLookup = typeof multiValueLookupIntent === "function" && multiValueLookupIntent(msg);
  const routeDuplicateRowDelete = typeof duplicateRowDeleteIntent === "function" && duplicateRowDeleteIntent(msg);
  const routeConditionalRowDelete = typeof conditionalRowDeleteIntent === "function" && conditionalRowDeleteIntent(msg);
  const routeFilterToNewSheet = typeof filterToNewSheetIntent === "function" && filterToNewSheetIntent(msg);
  const routeMatchFill = routeToPython && typeof matchFillIntent === "function" && matchFillIntent(msg);
  const routeLookupJoin = routeToPython && typeof lookupJoinIntent === "function" && lookupJoinIntent(msg);
  const routeDedupe = routeToPython && typeof dedupeIntent === "function" && dedupeIntent(msg);
  const routeSplitColumn = routeToPython && typeof splitColumnIntent === "function" && splitColumnIntent(msg);
  const routeTotalRow = routeToPython && typeof totalRowIntent === "function" && totalRowIntent(msg);
  const routeHideUnhide = routeToPython && typeof hideUnhideIntent === "function" && hideUnhideIntent(msg);
  const routeColumnMove = routeToPython && typeof columnMoveIntent === "function" && columnMoveIntent(msg);
  const routeColumnCopyClear = routeToPython && typeof columnCopyClearIntent === "function" && columnCopyClearIntent(msg);
  const routeColumnSwap = routeToPython && typeof columnSwapIntent === "function" && columnSwapIntent(msg);
  const routeCopyValues = routeToPython && typeof copyValuesIntent === "function" && copyValuesIntent(msg);
  const routeColumnCopy = routeToPython && typeof columnCopyIntent === "function" && columnCopyIntent(msg);
  const routeClearData = routeToPython && typeof clearDataIntent === "function" && clearDataIntent(msg);
  const routeFillSumCol = routeToPython && typeof fillSumColIntent === "function" && fillSumColIntent(msg);
  const modeLabel = editTargetId ? "(수정 모드) " : (routeToVba ? "(VBA 라우팅) " : (routeToPython ? "(Python 라우팅) " : ""));
  const thinkMode = typeof isThinkModeEnabled === "function" && isThinkModeEnabled();
  const abortController = new AbortController();
  let stopThinkingRequested = false;
  const streamView = setupStreamingAssistantMessage(
    loading, modeLabel, aiName,
    () => abortController.abort(),                                   // 요청 중단: 전체 종료
    thinkMode ? () => { stopThinkingRequested = true; abortController.abort(); } : null  // 생각 중단: think만 끊고 답변
  );
  $("chat-send").disabled = true;
  let reasoningText = "";
  let prompt = "";
  try {
    prompt = typeof augmentUserPromptWithMentions === "function"
      ? augmentUserPromptWithMentions(msg)
      : msg;
    let routingHint = "";
    if (routeToVba) {
      if (explicitVbaRequest) {
        routingHint = "사용자가 이번 요청에서 VBA/매크로를 명시했습니다. 반드시 하나의 ```vba 코드 블록(Sub B2BSkill())만 작성하고 Python def transform(ctx)는 절대 출력하지 마세요. @범위/@컬럼의 파일명·시트명은 번역 없이 정확히 복사하세요.";
      } else if (routeDuplicateRowDelete) {
        routingHint = "조건이 붙은 중복 행 삭제 요청입니다. 이번 응답은 반드시 VBA로 작성하세요. Python def transform(ctx)는 절대 출력하지 마세요. 30만 행 이상도 처리 가능해야 하므로 성능상 필요한 열만 각각 1열 배열로 읽는 방식을 우선하세요. 예: E열 상품명, M열 수납금액, T열 EID. 단, 실제 lastRow/lastCol 로 한정된 데이터 범위 읽기는 허용되며, 행 번호 없는 전체 열(A:T, E:T) 또는 전체 시트 끝까지 읽는 코드는 쓰지 마세요. 'E열에서 안전제일만'은 정확히 '안전제일'인 행만 대상으로 하고 '안전제일(망개통용)' 같은 접미사 값은 포함하지 마세요. 같은 EID에서 수납금액이 1 이상인 행은 삭제 금지, 수납금액 1 미만 중복은 위쪽 행부터 삭제하고 가장 아래쪽 1개만 남기세요. Rows(...).Delete를 루프 안에서 반복하지 말고, 임시 보조열에 삭제 대상만 표시한 뒤 AutoFilter + SpecialCells(xlCellTypeVisible).EntireRow.Delete로 한 번에 삭제하세요. 삭제 대상 0건은 오류가 아니라 정상 종료입니다. System.Collections.ArrayList는 정렬용으로 사용 가능하지만 버블정렬 이중 For는 쓰지 마세요.";
      } else if (routeConditionalRowDelete) {
        routingHint = "조건이 붙은 행 삭제 요청입니다. 이번 응답은 반드시 VBA로 작성하세요. Python def transform(ctx)는 절대 출력하지 마세요. 선택한 열/요청 열의 실제 lastRow까지만 대상으로 하고, 전체 시트 끝까지 읽지 마세요. 날짜/숫자 조건(예: 20260403 이전)은 Range.Text와 Range.Value를 모두 안전하게 비교하되, 20260401/2026-03-31/2026/03/31 텍스트와 Excel 실제 날짜 시리얼을 모두 yyyymmdd 정수로 정규화하세요. 날짜 정규화 함수는 값 Variant가 아니라 셀 Range를 인자로 받게 하고, v > 0 And v < 1 은 시간 시리얼이므로 날짜 판정에 쓰지 마세요. Rows(...).Delete를 루프 안에서 반복하지 말고, 임시 보조열(마지막 열+1)에 삭제 대상 행만 표시한 뒤 AutoFilter를 걸고, 헤더를 제외한 명시적 데이터 본문 범위(hdrRow+1:lastRow)의 SpecialCells(xlCellTypeVisible).EntireRow.Delete로 한 번에 삭제하세요. usedRng.SpecialCells(...).Offset(1,0).Resize(...) 패턴은 쓰지 마세요. 삭제 대상 0건은 오류가 아니라 정상 종료입니다.";
      } else if (routeFilterToNewSheet) {
        routingHint = "특정 열 값/조건으로 행을 찾아 새 시트에 복사하는 요청입니다. 이번 응답은 반드시 VBA로 작성하세요. Python def transform(ctx)는 절대 출력하지 마세요. 27만 행 이상 같은 큰 파일도 처리해야 하므로 ctx.read 방식으로 전체 범위를 Python 배열에 올리지 말고 Excel AutoFilter + SpecialCells(xlCellTypeVisible).Copy Destination 방식으로 처리하세요. 전체 열/전체 시트 끝까지 읽지 말고 요청 열의 실제 lastRow와 헤더 행을 기준으로 데이터 범위를 한정하세요. 사용자가 마지막 행 번호를 제공했다면 그 행까지만 대상으로 쓰세요. AutoFilter Field 번호는 절대 열 번호가 아니라 필터 범위 안의 상대 번호입니다(targetCol-firstCol+1). Range가 E열부터 시작하면 Field:=1이고, A열부터 시작하면 E열은 Field:=5입니다. SpecialCells는 매칭 0건이면 오류가 나므로 호출 전에 Subtotal(103, 필터대상열 본문범위)로 보이는 데이터 행 수를 확인하고, 0건이면 새 시트에 헤더만 만들고 정상 종료하세요. 병합 해제 뒤 생긴 빈칸은 임의로 채우지 말고 현 상태에서 조건값이 실제로 들어 있는 행만 필터하세요. 새 시트에는 헤더와 필터된 행 전체를 복사하고, 원본 시트는 보존하세요. 긴 숫자 ID/계약번호/전화번호는 원본 형식이 텍스트라면 텍스트 그대로 보존되도록 원본 범위를 네이티브 Copy로 옮기고, Value 배열 재작성으로 과학표기/15자리 손실을 만들지 마세요.";
      } else if (routeMultiValueLookup) {
        routingHint = "한 셀에 여러 값이 들어 있는 열을 분해해 다른 파일 열과 정확 매칭하고 합산해 쓰는 요청입니다. 이번 응답은 반드시 VBA로 작성하세요. BP/BQ/AA 같은 다중문자 열은 숫자로 암산하지 말고 ws.Columns(\"BP\").Column 또는 ws.Cells(r, \"BP\")처럼 열 문자를 그대로 쓰세요. Excel VBA에는 Continue For가 없으므로 If Len(tok)>0 Then ... End If 구조를 쓰세요. 대상 H열 전체 범위를 배열로 다시 쓰지 말고, matchedAny=True인 데이터 행의 wsOut.Cells(r, \"H\").Value만 개별 갱신하세요. 매칭 없는 행, H열 기존 텍스트/수식, P열이 부가세포함/합계/소계 같은 요약 라벨인 행은 그대로 두세요.";
      } else {
        routingHint = "복합 조건/피벗성 집계/시트 전체 교차파일 복사/한 셀 여러 값 매칭 합산 요청은 저사양 PC에서 Python COM 경로가 멈추거나 행 위치가 밀릴 수 있으므로 이번 응답은 VBA로 작성합니다. 전체 열은 실제 데이터 범위로 한정하고, 합계/소계/부가세포함 같은 요약 행은 데이터 행에서 제외하세요. Excel VBA에는 Continue For가 없으므로 사용하지 마세요.";
      }
    } else if (routeToPython) {
      if (explicitPythonRequest) {
        routingHint = "사용자가 이번 요청에서 Python/COM 을 명시했습니다. 반드시 하나의 ```python def transform(ctx): 코드 블록만 작성하고 VBA(Sub B2BSkill())는 절대 출력하지 마세요. @범위/@컬럼의 파일명·시트명은 번역 없이 정확히 복사하세요.";
      } else if (routeMonthShift) {
        routingHint = "셀 텍스트의 월/날짜를 N개월 이동(예: '월 정보 +1', '다음달')하는 요청입니다. 반드시 ctx.shift_months(시트, 범위, N) 한 줄로 처리하세요(범위 안 모든 'N월'·앞 'YY년'·뒤 'D일'을 연도 넘김·말일 보정까지 자동 처리). 직접 정규식이나 루프를 짜지 말고, @시트/@범위의 시트명은 한 글자도 바꾸지 말고 그대로 쓰세요.";
      } else if (routeSimpleRangeArithmetic) {
        routingHint = "범위 값을 산술 계산해 다른 범위에 쓰는 단순 요청입니다. 반드시 Python ctx로 작성하고 VBA(Sub B2BSkill())는 출력하지 마세요. ctx.book(\"파일명.xlsx\").read(\"시트명\", \"E6:E16\")로 읽고 2차원 배열로 계산한 뒤 ctx.book(\"파일명.xlsx\").write(\"시트명\", \"D6\", out, overwrite_formulas=True)처럼 한 번에 쓰세요. @범위의 파일명·시트명·주소는 번역·영문화·띄어쓰기 보정 없이 그대로 사용하세요.";
      } else if (routeAppendSameFormat) {
        routingHint = "동일 포맷의 여러 입력 파일 표를 출력 파일 새 시트에 헤더 1회만 남기고 이어붙이는 요청입니다. 반드시 Python ctx 헬퍼만 쓰고 VBA(Sub B2BSkill())는 출력하지 마세요. 출력 파일 ctx에서 ctx.book(\"출력파일.xlsx\").append_same_format_sheets([\"입력1.xlsx\", \"입력2.xlsx\"], dest_sheet=\"가입자별청구내역_통합\", src_sheet=None) 형태로 작성하세요. src_sheet가 명확히 'sheet'이면 src_sheet=\"sheet\"를 넘기고, 아니면 None으로 두어 각 입력 파일 첫 시트를 쓰세요. 이 헬퍼가 상단 30행에서 실제 헤더를 자동 탐지하고 첫 파일은 헤더 포함, 이후 파일은 헤더 다음 행부터 Excel 네이티브 Copy로 붙입니다. 자유 VBA로 hdrRow=1/A열 lastRow/1행 lastCol을 직접 짜지 마세요. 빈 새 시트가 생기거나 긴 가입번호/EID/날짜/회계 서식이 손상됩니다.";
      } else if (routeMatchFill) {
        routingHint = "소스(피벗/요약)의 행을 대상 시트의 '구분명(키 열)'과 이름 맞춰 '여러 값 열'을 채우는 붙여넣기 요청입니다. 직접 read→딕셔너리→부분매칭 루프를 손코딩하지 말고(이름 정규화·중복포함 실수로 대부분 미매칭됩니다) 반드시 ctx.match_fill 한 줄로 처리하세요: ctx.match_fill(\"소스파일.xlsx!소스시트\", \"대상시트\", {\"소스값열\": \"대상값열\", ...}, key=(\"소스키열\",\"대상키열\"), source_header_row=1, header_row=대상헤더행). 값 열은 헤더명 또는 열문자로 지정합니다. 이름이 완전히 같지 않아도 헬퍼가 정확→공백무시→기호무시(\"안전제일(망개통용)\"=\"안전제일_망개통용\")→부분포함(\"인포콘 프리미엄\"↔\"프리미엄\", \"KGM FOTA\"↔\"FOTA\")으로 자동 매칭하고, \"올인원\"과 \"올인원2.0\"처럼 헷갈리는 건 유일 최선만 채택합니다. 대상 헤더가 4행이면 header_row=4, 키 열(구분명)이 A면 key 생략 가능. 못 맞춘 대상 이름은 후보와 함께 오류로 알리므로, 사용자가 확정하면 aliases={\"대상이름\":\"소스이름\"} 를 넣어 재실행하세요. 소스/대상 시트명·파일명은 한 글자도 바꾸지 말고 그대로 쓰고, VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routePivot) {
        routingHint = "그룹 요약/피벗/크로스탭 요청입니다. 직접 집계·정렬·헤더를 손코딩하지 말고 반드시 ctx.pivot 한 줄로 처리하세요. 1D 그룹요약: ctx.pivot(\"시트\", group_by=\"지점\", value=\"매출\", agg=\"sum\", dest_name=\"결과시트\"). 2D 크로스탭(행/열/값): ctx.pivot(\"시트\", group_by=\"지점\", column=\"월\", value=\"매출\", agg=\"sum\", dest_name=\"결과시트\"). agg는 sum/count/avg/max/min. group_by/column/value 는 헤더명을 쓰고, 시트명은 한 글자도 바꾸지 말고 그대로 쓰세요. dest_name 시트가 이미 있으면 다른 이름을 쓰세요. 헤더가 1행이 아니면 ctx.pivot(..., header_row=2) 처럼 헤더 '행 번호'를 넘기세요(header_row/header_rows 둘 다 같은 뜻으로 동작하며, 안 넘겨도 헤더 행을 자동으로 찾습니다). ctx.pivot 은 위에 적은 옵션만 받습니다 — 없는 옵션을 지어내지 말고, 헤더 위치는 데이터 범위를 직접 자르는 대신 header_row 로 알려주세요.";
      } else if (routeFilterToNewSheet) {
        routingHint = "특정 열 값/조건으로 행을 찾아 새 시트에 복사하는 요청입니다. 반드시 Python ctx.filter_to_sheet 헬퍼를 우선 사용하고 VBA(Sub B2BSkill())는 출력하지 마세요. 직접 ctx.read로 전체 범위를 읽어 Python 루프로 필터링하거나 ctx.write로 행을 재작성하지 마세요. 필터 대상 열은 ctx.find_header 또는 명시 열 주소로 정확히 찾고, 한글/텍스트 비교는 ctx.normalize(셀값) == ctx.normalize(\"조건값\") 형태로 비교하세요. 헤더가 2행이면 ctx.find_header(..., header_row=2)와 ctx.filter_to_sheet(..., header_rows=2)를 함께 쓰세요. 새 시트는 원본이 속한 워크북에 만들고, 원본 시트는 보존하세요. @범위/@시트의 파일명·시트명은 번역·영문화·띄어쓰기 보정 없이 그대로 사용하세요.";
      } else if (routeLookupJoin) {
        routingHint = "다른 시트/표(단가표 등)에서 키로 값을 찾아 채우는 VLOOKUP/조인 요청입니다. 직접 read→딕셔너리→write 로 손코딩하지 말고 반드시 ctx.lookup 한 줄로 처리하세요: ctx.lookup(\"청구내역\", key_col=\"상품\", into_col=\"단가\", table_sheet=\"단가표\", table_key_col=\"상품\", table_val_col=\"단가\"). 열은 헤더명/열문자/번호 모두 되고, 키 비교는 헬퍼가 normalize 로 안전 매칭합니다. VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routeTotalRow) {
        routingHint = "표 끝에 합계/소계 행을 추가하는 요청입니다. 행 위치·SUM 범위를 손코딩하지 말고 반드시 ctx.add_total_row 로 처리하세요: ctx.add_total_row(\"청구내역\", sum_cols=[\"금액\",\"수량\"], label_col=\"회사\", label=\"합계\"). 헬퍼가 마지막 데이터행 바로 아래에 =SUM(데이터범위) 를 넣습니다. VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routeDedupe) {
        routingHint = "키 기준 단순 중복 행 제거 요청입니다. 반드시 ctx.dedupe 로 처리하세요: ctx.dedupe(\"청구내역\", key_cols=[\"가입번호\"], keep=\"last\"). 비교는 normalize 기준이고 헤더는 보존됩니다. VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routeSplitColumn) {
        routingHint = "한 셀을 구분자로 나눠 여러 열로 분리하는 요청입니다(예: '1001/홍길동' → 가입번호/고객명). 반드시 ctx.split_column 으로 처리하세요: ctx.split_column(\"청구내역\", col=\"가입번호/고객명\", delimiter=\"/\", into=[\"가입번호\",\"고객명\"]). 원본 열 오른쪽에 새 열이 생깁니다. VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routeHideUnhide) {
        routingHint = "행/열 숨김 또는 숨김 해제 요청입니다. 반드시 ctx.hide_cols / ctx.hide_rows 로 처리하세요: 숨기기 ctx.hide_cols(\"시트\", \"C:E\", hidden=True), 숨김 해제 ctx.hide_cols(\"시트\", \"C:E\", hidden=False) (행은 ctx.hide_rows). VBA(Sub B2BSkill())는 출력하지 마세요. @범위/@시트 이름은 그대로 쓰세요.";
      } else if (routeColumnCopyClear) {
        routingHint = "'X열을 Y로 이동/복사하고 원래 열은 비우기' 요청입니다. '비우기'는 열 삭제가 아닙니다 — 원본을 ctx.delete_cols 로 지우거나 ctx.move_cols(원본 제거)로 처리하면 다른 열이 왼쪽으로 시프트돼 라벨이 어긋나고(E→D, F→E) SUMIF/SUM 수식이 #REF! 로 파손됩니다. 반드시 한 줄로: ctx.move_col_clear(\"시트\", \"D\", \"G\") — 원본 열의 헤더+데이터+서식+세로병합을 대상 열로 옮기고 원본은 내용만 비웁니다(열 구조 유지, 시프트 없음). 상단 제목/단위 행의 가로 병합(A2:F2 등)은 자동으로 건너뛰고 대상 열 병합도 먼저 정리하므로 '병합된 셀에서는 실행할 수 없습니다'(1004) 오류가 없습니다. 열은 헤더명 또는 열문자로, 헤더 행을 알면 header_row=4 처럼 넘겨도 됩니다. 직접 insert_cols/copy/clear 로 D1 부터 통 복사하지 마세요(제목 가로병합에 걸려 실패). VBA(Sub B2BSkill())는 출력하지 말고 @시트 이름은 그대로 쓰세요.";
      } else if (routeColumnSwap) {
        routingHint = "인접한 두 열의 '위치를 서로 맞바꿈' 요청입니다. move_cols 나 copy+delete 로 하면 =SUM(D..)/SUMIF 등 수식 참조가 #REF! 로 깨집니다. 반드시 ctx.swap_cols(\"시트\", \"D\", \"E\", header_row=4) 를 쓰세요 — 네이티브 Cut/Insert 로 옮겨 수식 참조가 Excel 방식으로 자동 보정되고, 제목처럼 두 열에 걸친 가로 병합은 자동으로 임시 해제 후 복원해 1004 도 없습니다. 열은 헤더명 또는 열문자. VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routeCopyValues) {
        routingHint = "'값으로/원문 텍스트 그대로 복사' 요청입니다. ctx.copy 는 수식을 그대로 옮겨 상대참조가 시프트되므로(예: 셀이 =다른시트!A2 이면 J로 옮길 때 =..!J2 로 어긋남) 쓰지 마세요. 반드시 ctx.copy_values(\"시트\", \"A2\", \"시트\", \"J2\") (또는 범위 \"D4:F28\"→\"J4\") 를 쓰세요 — 계산 결과값 + 서식/숫자서식/테두리/병합을 넣고 수식은 값으로 고정합니다(참조 시프트 없음, 긴 텍스트/EID 안전). VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routeColumnCopy) {
        routingHint = "한 열을 다른 열로 (서식째) 복사하는 요청입니다. ctx.copy 로 \"E1:E{last}\" 처럼 1행부터 통 복사하면 제목/헤더 가로병합에 걸려 1004 로 실패합니다. 반드시 ctx.copy_col(\"시트\", \"E\", \"L\") 를 쓰세요 — 상단 가로병합을 자동 회피하고 대상 열 병합을 정리한 뒤 값+수식+서식+세로병합을 복사합니다(원본 유지). 헤더 행을 알면 header_row=4. VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routeClearData) {
        routingHint = "'특정 열/범위의 데이터(값)만 비우기' 요청입니다. write 로 배열([[...]])을 만들어 지우려 하지 마세요 — 세로/가로 축을 뒤집어 아무것도 안 지워지는(changed=0) 실수가 잦습니다. 반드시 ctx.clear(\"시트\", \"B5:B{last}\") 한 줄로 하세요(범위는 실제 데이터 시작행부터). 수식 셀은 남기고 값 셀만 비우려면 ctx.clear(\"시트\", \"B5:B{last}\", keep_formulas=True) 를 쓰세요. 헤더/라벨 행은 범위에서 제외하고, 다른 시트/열은 건드리지 마세요. VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routeFillSumCol) {
        routingHint = "'합계 열에 여러 열의 합계 수식 채우기' 요청입니다. 요약표는 계정이 2행씩 세로 병합된 경우가 많아 단순 =D행+E행 을 넣으면 병합 그룹 합계가 틀리고 헤더/라벨 행을 덮습니다. 반드시 ctx.fill_sum_col(\"시트\", \"F\", [\"D\",\"E\"], header_row=4) 를 쓰세요 — 대상 열(F)의 병합 블록 단위로 =SUM(D_top:D_bottom)+SUM(E_top:E_bottom) 를 넣고, 원본이 숫자가 아닌 라벨 행은 자동으로 건너뜁니다. header_row 는 스키마의 헤더 행(예: 4)을 그대로 넘기세요(데이터는 그 아래부터). VBA(Sub B2BSkill())는 출력하지 마세요.";
      } else if (routeColumnMove) {
        routingHint = "열(컬럼)을 다른 위치로 '이동/재배치'하는 요청입니다(원본을 없애고 순서를 바꾸는 것이 목적). 직접 Columns.Cut/Insert 나 값 배열 재작성으로 짜지 말고 반드시 ctx.move_cols 로 처리하세요: ctx.move_cols(\"시트\", [\"금액\",\"할인\"], \"합계\", header_row=1) — 열목록을 기준열(합계) '앞'으로 헤더+데이터 통째 이동(원본 제거, 인덱스 시프트 자동). 옮길 열과 기준열(before) 모두 헤더명 또는 열문자(\"D\"). 헤더가 2행이면 header_row=2. (두 열 '맞바꿈'은 move_cols 가 아니라 ctx.swap_cols 를 쓰세요 — 수식 참조가 보존됩니다.) move_cols 는 병합 제목/헤더가 있어도 안전하니 UnMerge 를 직접 짜지 마세요. VBA(Sub B2BSkill())는 출력하지 말고, @시트 이름은 한 글자도 바꾸지 마세요.";
      } else if (routeCtxHelper) {
        routingHint = "시트 복사/복사후 이름변경/추가/삭제 또는 단순 정렬 요청입니다. 반드시 ctx 헬퍼를 쓰세요: ctx.copy_sheet(\"시트\", dst_book=\"대상.xlsx\", new_name=\"새이름\") / ctx.rename_sheet(\"기존\",\"새\") / ctx.add_sheet / ctx.delete_sheet / ctx.sort(시트, 범위, key_col=열문자, has_header=True). 정렬에서 @범위가 L2:L8929처럼 키 열만 가리키면 그 열만 정렬하지 말고 표 전체 범위(예: A1:L8929)를 잡고 key_col=\"L\"로 정렬하세요. 범위가 1행 헤더를 포함하면 has_header=True, 2행부터 시작해 헤더가 없으면 has_header=False를 쓰세요. 정렬은 기존 셀 값·수식·날짜·회계 서식이 행과 함께 이동해야 하므로, ctx.read/sorted/ctx.write 또는 값 배열 재작성으로 흉내내지 마세요(EID/가입번호 같은 긴 숫자 텍스트가 8.90E+31 형태로 손실될 수 있음). @시트/@파일 이름은 한 글자도 바꾸지 말고 그대로 쓰세요.";
      } else {
        routingHint = "단순 행/열 삽입·삭제 또는 범위 내용 삭제 요청입니다. VBA 매크로가 아니라 Python COM으로 작성하세요. 행/열 자체 삭제·추가는 ctx.delete_rows/delete_cols/insert_rows/insert_cols 를 쓰고, 셀/범위의 내용만 지우는 요청은 ctx.clear 를 쓰세요. @범위의 파일명·시트명·주소는 번역하거나 바꾸지 말고 그대로 쓰세요.";
      }
    }
    const exactSheetHint = exactSheetNameReminder(msg);
    if (exactSheetHint) {
      routingHint = [routingHint, exactSheetHint].filter(Boolean).join("\n");
    }
    const requestOptions = {
      editTargetId,
      reqId,
      thinkMode,
      forceEngine: routeToVba ? "vba" : (routeToPython ? "python" : undefined),
      routingHint,
      signal: abortController.signal,
      onDelta: (delta, full) => {
        streamView.setAnswer(full);
        scrollChatToBottom();
      },
      onReconnect: (attempt, maxAttempts) => {
        streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${attempt}/${maxAttempts})`);
        scrollChatToBottom();
      },
    };
    if (thinkMode) {
      requestOptions.onReasoningDelta = (delta, full) => {
        reasoningText = full;
        streamView.setReasoning(full);
        scrollChatToBottom();
      };
      requestOptions.onReasoningWarning = () => {
        const warning = "정확한 동작을 위해 생각이 길어지고 있습니다. 다만, 같은 말을 여러 번 반복할 경우 중단해주세요.";
        streamView.setStatus(warning);
        toast(warning, "success");
      };
    }
    const reply = await callLLM(prompt, requestOptions);
    streamView.flush();
    loading.remove();
    addAssistantReply(reply, { editTargetId, sourceUserMessage: msg, reasoning: reasoningText });
    bindChatHistoryEntryToMessage(userMsgDiv, "user", msg);
    console.debug(`[B2B#5] req#${reqId} addAssistantReply 렌더 (reply length=${reply ? reply.length : 0})`);
    scrollChatToBottom();
  } catch (err) {
    try { streamView.flush(); } catch (_) {}   // [24시간 버벅임 수정] 오류/중단에도 타자기 RAF 정지 보장
    loading.classList.remove("streaming");
    loading.classList.remove("loading");
    if (err && err.name === "AbortError" && thinkMode && stopThinkingRequested) {
      // '생각 중단': thinking 을 끊고 Think 없이 같은 요청으로 답변을 자동 재요청.
      showThinkRetryPrompt(loading, {
        prompt,
        editTargetId,
        sourceUserMessage: msg,
        modeLabel,
        aiName,
        autoStart: true,
        message: "생각을 중단하고 답변을 생성합니다…",
        detail: "Think 없이 같은 요청으로 다시 보냅니다.",
      });
      scrollChatToBottom();
      return;
    }
    if (err && err.name === "AbortError") {
      // '요청 중단'(또는 think 아님): 전체 종료.
      streamView.stopped();
      loading.textContent = "요청이 중단되었습니다.";
    } else {
      loading.innerHTML = "❌ " + escapeHtml(err.message);
      loading.classList.remove("assistant");
      loading.classList.add("system");
    }
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
    window.__b2bChatInFlight = false;   // [#5] 락 해제는 항상 여기서(완료/오류/중단 공통)
  }
}

$("chat-send").onclick = sendChat;
$("chat-text").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    if (typeof isMentionMenuOpen === "function" && isMentionMenuOpen()) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    sendChat();
  }
});

// ---- 스킬 설계창 도구: 대화 영역 확대/축소 + 대화 기억 비우기 ----
(function setupChatPanelTools() {
  const expandBtn = $("chat-expand-toggle");
  if (expandBtn) {
    expandBtn.onclick = (e) => {
      e.stopPropagation(); // panel-head 의 접기/펼치기 토글로 번지지 않게
      const section = document.getElementById("panel-chat-section");
      if (!section) return;
      const expanded = section.classList.toggle("chat-expanded");
      const messages = $("chat-messages");
      if (messages) messages.style.height = ""; // 수동 리사이즈(inline 높이) 초기화 → 클래스 높이 적용
      expandBtn.textContent = expanded ? "⤡ 축소" : "⤢ 확대";
      scrollChatToBottom(true);
    };
  }
  const clearBtn = $("chat-clear-history");
  if (clearBtn) {
    clearBtn.onclick = async (e) => {
      e.stopPropagation();
      // 미러(항상-위 네이티브 Excel 창)가 모달을 덮거나 클릭을 가로채지 않게 먼저 숨긴다.
      try { if (typeof hideAllExcelMirrorWindows === "function") await hideAllExcelMirrorWindows(); } catch (_) {}
      const confirmed = typeof openB2bConfirmModal === "function"
        ? await openB2bConfirmModal("대화 기억을 모두 비울까요?" + String.fromCharCode(10) + "(적용된 스킬 파이프라인과 파일은 그대로 유지됩니다)", { okLabel: "비우기" })
        : confirm("대화 기억을 모두 비울까요?");
      if (!confirmed) {
        try { if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0); } catch (_) {}
        return;
      }
      state.chatHistory = [];
      _boundChatHistIds.clear();
      // 새 세션처럼: 런타임 실패 카운터도 함께 리셋(이전 작업의 VBA 전환 누적이 새 대화에 안 넘어가게).
      if (typeof clearPythonRuntimeFailures === "function") clearPythonRuntimeFailures();
      const container = $("chat-messages");
      if (container) {
        // cleared-marker: refreshChatState 의 '단일 system 메시지' 재초기화 조건과 구분(덮어쓰기 방지).
        container.innerHTML = `<div class="msg system cleared-marker">대화 기억을 비웠습니다. 새 요청은 이전 대화의 영향을 받지 않습니다.</div>`;
      }
      if (typeof toast === "function") toast("대화 기억을 비웠습니다.", "success");
      try { if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(120); } catch (_) {}
    };
  }
})();
