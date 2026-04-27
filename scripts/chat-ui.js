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
  refreshRunButton();
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

function addAssistantReply(fullText) {
  const code = extractCode(fullText);
  const desc = extractDescription(fullText);
  const stripped = fullText.replace(/```[\s\S]*?```/g, "").trim();

  const div = document.createElement("div");
  div.className = "msg assistant";
  div.innerHTML = `<div>${escapeHtml(stripped)}</div>`;
  if (code) {
    const codeBlk = document.createElement("pre");
    codeBlk.className = "code-block";
    codeBlk.textContent = code;
    div.appendChild(codeBlk);

    const actions = document.createElement("div");
    actions.className = "action-btns";
    const applyBtn = document.createElement("button");
    applyBtn.className = "action-btn";
    applyBtn.textContent = "✓ 적용 (파이프라인 추가)";
    const rejectBtn = document.createElement("button");
    rejectBtn.className = "action-btn reject";
    rejectBtn.textContent = "✕ 거절";
    actions.appendChild(applyBtn);
    actions.appendChild(rejectBtn);
    div.appendChild(actions);

    applyBtn.onclick = () => {
      applyLogic({ id: uid(), prompt: "", code, description: desc });
      applyBtn.disabled = true; rejectBtn.disabled = true;
      applyBtn.textContent = "✓ 적용됨";
    };
    rejectBtn.onclick = () => {
      applyBtn.disabled = true; rejectBtn.disabled = true;
      rejectBtn.textContent = "거절됨";
    };
  }
  $("chat-messages").appendChild(div);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
}

async function sendChat() {
  const input = $("chat-text");
  const msg = input.value.trim();
  if (!msg) return;
  if (!state.output && state.inputs.length === 0) { toast("입력 또는 출력 파일을 먼저 업로드하세요", "error"); return; }
  input.value = "";
  addMessage("user", msg);
  const loading = addMessage("assistant", "", {});
  const aiName = settings.provider === "openai-compat" ? "로컬 LLM" : "Claude";
  loading.innerHTML = `<span class="loader"></span> ${aiName}에게 전송 중...`;
  $("chat-send").disabled = true;
  try {
    const reply = await callLLM(msg);
    loading.remove();
    addAssistantReply(reply);
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
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
