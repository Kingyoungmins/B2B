/* ===================================================================
   CHAT UI
   =================================================================== */
function refreshChatState() {
  const ready = state.output !== null || state.inputs.length > 0;
  const panel = $("panel-chat");
  panel.classList.toggle("disabled", !ready);
  $("chat-send").disabled = !ready;
  if (ready && $("chat-messages").children.length === 1 && $("chat-messages").children[0].classList.contains("system")) {
    $("chat-messages").innerHTML = "";
    const targetLabel = state.output
      ? `출력 템플릿 "${state.output.name}" 이 로드되었습니다.`
      : `입력 파일 ${state.inputs.length}개가 로드되었습니다.`;
    addMessage("system", `${targetLabel} 입력/출력 파일을 함께 수정하는 로직을 만들어보세요.`);
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
  container.scrollTop = container.scrollHeight;
  return div;
}

function addAssistantReply(fullText, replyContext) {
  const code = extractCode(fullText);
  const desc = extractDescription(fullText);
  const stripped = fullText.replace(/```[\s\S]*?```/g, "").trim();
  const editTargetId = replyContext && replyContext.editTargetId;
  const reasoning = replyContext && replyContext.reasoning;

  const div = document.createElement("div");
  div.className = "msg assistant";
  div.innerHTML = `<div>${escapeHtml(stripped)}</div>`;
  if (reasoning) div.insertBefore(createReasoningBox(reasoning), div.firstChild);
  if (code) {
    const codeBlk = document.createElement("pre");
    codeBlk.className = "code-block";
    codeBlk.textContent = code;
    div.appendChild(codeBlk);

    const actions = document.createElement("div");
    actions.className = "action-btns";

    if (editTargetId) {
      // 수정 모드 응답: 해당 step의 코드만 교체
      const editApplyBtn = document.createElement("button");
      editApplyBtn.className = "action-btn";
      editApplyBtn.textContent = "✓ 수정 적용";
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "action-btn reject";
      rejectBtn.textContent = "✕ 거절";
      actions.appendChild(editApplyBtn);
      actions.appendChild(rejectBtn);
      div.appendChild(actions);

      editApplyBtn.onclick = () => {
        const ok = replaceLogicAt(editTargetId, code, desc);
        if (ok) {
          editApplyBtn.disabled = true; rejectBtn.disabled = true;
          editApplyBtn.textContent = "✓ 수정 적용됨";
        }
      };
      rejectBtn.onclick = () => {
        editApplyBtn.disabled = true; rejectBtn.disabled = true;
        rejectBtn.textContent = "거절됨";
      };
    } else {
      // 일반 모드: 적용(맨 뒤 추가) / 삽입(원하는 위치) / 거절
      const applyBtn = document.createElement("button");
      applyBtn.className = "action-btn";
      applyBtn.textContent = "✓ 적용 (맨 뒤)";
      const insertBtn = document.createElement("button");
      insertBtn.className = "action-btn insert";
      insertBtn.textContent = "↳ 삽입";
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "action-btn reject";
      rejectBtn.textContent = "✕ 거절";
      actions.appendChild(applyBtn);
      actions.appendChild(insertBtn);
      actions.appendChild(rejectBtn);
      div.appendChild(actions);

      applyBtn.onclick = () => {
        applyLogic({ id: uid(), prompt: "", code, description: desc });
        applyBtn.disabled = true; insertBtn.disabled = true; rejectBtn.disabled = true;
        applyBtn.textContent = "✓ 적용됨";
      };
      insertBtn.onclick = () => {
        openInsertPositionDialog(state.pipeline.length, (position) => {
          insertLogic({ id: uid(), prompt: "", code, description: desc }, position);
          applyBtn.disabled = true; insertBtn.disabled = true; rejectBtn.disabled = true;
          insertBtn.textContent = `✓ ${position}번에 삽입됨`;
        });
      };
      rejectBtn.onclick = () => {
        applyBtn.disabled = true; insertBtn.disabled = true; rejectBtn.disabled = true;
        rejectBtn.textContent = "거절됨";
      };
    }
  }
  $("chat-messages").appendChild(div);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
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
  };
  box.appendChild(toggle);
  box.appendChild(content);
  return box;
}

function openInsertPositionDialog(currentCount, onConfirm) {
  const modal = $("modal");
  const maxPos = currentCount + 1;
  const defaultPos = Math.max(1, currentCount); // 보통 마지막 단계 직전이 가장 자주 쓰임
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

function setupStreamingAssistantMessage(container, modeLabel, aiName) {
  container.innerHTML = `
    <div class="reasoning-box" hidden>
      <button class="reasoning-toggle" type="button">생각 펼치기</button>
      <div class="reasoning-content"></div>
    </div>
    <div class="assistant-stream"><span class="loader"></span> ${modeLabel}${aiName}에게 전송 중...</div>
  `;
  const reasoningBox = container.querySelector(".reasoning-box");
  const reasoningToggle = container.querySelector(".reasoning-toggle");
  const reasoningContent = container.querySelector(".reasoning-content");
  const answer = container.querySelector(".assistant-stream");
  const answerRenderer = createSmoothTextRenderer(
    answer,
    `${modeLabel}${aiName} 응답 수신 중...`,
  );
  const reasoningRenderer = createSmoothTextRenderer(reasoningContent, "");

  reasoningToggle.onclick = () => {
    const open = reasoningBox.classList.toggle("open");
    reasoningToggle.textContent = open ? "생각 접기" : "생각 펼치기";
  };

  return {
    setAnswer(text) {
      answerRenderer.setTarget(text);
    },
    setReasoning(text) {
      if (!text) return;
      reasoningBox.hidden = false;
      reasoningRenderer.setTarget(text);
      if (!reasoningBox.classList.contains("open")) reasoningToggle.textContent = "생각 펼치기";
    },
    flush() {
      answerRenderer.flush();
      reasoningRenderer.flush();
    },
  };
}

function createSmoothTextRenderer(el, emptyText) {
  let target = "";
  let shown = "";
  let rafId = null;
  let lastTs = 0;

  function render(ts) {
    rafId = null;
    if (!target) {
      shown = "";
      el.textContent = emptyText || "";
      return;
    }
    const elapsed = lastTs ? Math.max(0, ts - lastTs) : 16;
    lastTs = ts;
    const remaining = target.length - shown.length;
    if (remaining <= 0) return;
    const charsPerFrame = Math.max(1, Math.min(10, Math.ceil(elapsed / 12)));
    shown = target.slice(0, shown.length + Math.min(remaining, charsPerFrame));
    el.textContent = shown;
    if (shown.length < target.length) schedule();
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
    },
  };
}

async function sendChat() {
  const input = $("chat-text");
  const msg = input.value.trim();
  if (!msg) return;
  if (!state.output && state.inputs.length === 0) { toast("입력 또는 출력 파일을 먼저 업로드하세요", "error"); return; }
  // 전송 시점의 수정 대상 step을 캡처해두면, 이후 사용자가 수정 모드를 토글해도 응답 버튼은 올바른 step을 가리킨다.
  const editTargetId = state.editingStepId || null;
  input.value = "";
  addMessage("user", msg);
  const loading = addMessage("assistant", "", {});
  // 외부 노출 시엔 내부 모델명을 표시하지 않고 LLM 으로 통일
  const aiName = settings.provider === "openai-compat" ? "ixi 모델" : "LLM";
  const modeLabel = editTargetId ? "(수정 모드) " : "";
  const thinkMode = typeof isThinkModeEnabled === "function" && isThinkModeEnabled();
  const streamView = setupStreamingAssistantMessage(loading, modeLabel, aiName);
  $("chat-send").disabled = true;
  let reasoningText = "";
  try {
    const prompt = typeof augmentUserPromptWithMentions === "function"
      ? augmentUserPromptWithMentions(msg)
      : msg;
    const requestOptions = {
      editTargetId,
      thinkMode,
      onDelta: (delta, full) => {
        streamView.setAnswer(full);
        $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
      },
    };
    if (thinkMode) {
      requestOptions.onReasoningDelta = (delta, full) => {
        reasoningText = full;
        streamView.setReasoning(full);
        $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
      };
    }
    const reply = await callLLM(prompt, requestOptions);
    streamView.flush();
    loading.remove();
    addAssistantReply(reply, { editTargetId, reasoning: reasoningText });
  } catch (err) {
    loading.innerHTML = "❌ " + escapeHtml(err.message);
    loading.classList.remove("assistant");
    loading.classList.add("system");
  } finally {
    $("chat-send").disabled = false;
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
