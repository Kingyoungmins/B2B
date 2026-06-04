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
  scrollChatToBottom();
  return div;
}

function scrollChatToBottom() {
  const container = $("chat-messages");
  if (!container) return;
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  });
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

function finalizeActionButtonFromResult(button, result, doneText, onFailure) {
  if (!button) return;
  if (result && result.pending && result.promise) {
    setActionButtonPending(button);
    result.promise
      .then(() => {
        button.textContent = doneText || "\u2713 \uC801\uC6A9\uB428";
        button.classList.remove("pending");
      })
      .catch(() => {
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
  button.textContent = doneText || "\u2713 \uC801\uC6A9\uB428";
}

function restoreActionButtonsAfterFailure(buttons, primaryButton, retryText) {
  (buttons || []).forEach(btn => {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove("pending", "error");
  });
  if (primaryButton) primaryButton.textContent = retryText || "\uC7AC\uC2DC\uB3C4";
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

      editApplyBtn.onclick = () => {
        const result = replaceLogicAt(editTargetId, code, desc, language);
        if (result && !result.error) {
          editApplyBtn.disabled = true;
          rejectBtn.disabled = true;
          finalizeActionButtonFromResult(
            editApplyBtn,
            result,
            "\u2713 \uC218\uC815 \uC801\uC6A9\uB428",
            () => restoreActionButtonsAfterFailure([editApplyBtn, rejectBtn], editApplyBtn, "\u2713 \uB2E4\uC2DC \uC218\uC815 \uC801\uC6A9")
          );
        }
      };
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

      applyBtn.onclick = () => {
        const result = applyLogic({ id: uid(), prompt: "", code, description: desc, language });
        applyBtn.disabled = true;
        insertBtn.disabled = true;
        rejectBtn.disabled = true;
        finalizeActionButtonFromResult(
          applyBtn,
          result,
          "\u2713 \uC801\uC6A9\uB428",
          () => restoreActionButtonsAfterFailure([applyBtn, insertBtn, rejectBtn], applyBtn, "\u2713 \uB2E4\uC2DC \uC801\uC6A9")
        );
      };
      insertBtn.onclick = () => {
        openInsertPositionDialog(state.pipeline.length, (position) => {
          const result = insertLogic({ id: uid(), prompt: "", code, description: desc, language }, position);
          applyBtn.disabled = true;
          insertBtn.disabled = true;
          rejectBtn.disabled = true;
          finalizeActionButtonFromResult(
            insertBtn,
            result,
            `${position}\uBC88\uC5D0 \uC0BD\uC785\uB428`,
            () => restoreActionButtonsAfterFailure([applyBtn, insertBtn, rejectBtn], insertBtn, "\u21B3 \uB2E4\uC2DC \uC0BD\uC785")
          );
        });
      };
      rejectBtn.onclick = () => {
        applyBtn.disabled = true;
        insertBtn.disabled = true;
        rejectBtn.disabled = true;
        rejectBtn.textContent = "\uAC70\uC808\uB428";
      };
    }
  }
  $("chat-messages").appendChild(div);
  scrollChatToBottom();
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

function setupStreamingAssistantMessage(container, modeLabel, aiName, onStop) {
  let initialized = false;
  let reasoningBox;
  let reasoningToggle;
  let reasoningContent;
  let stopBtn;
  let answerText;
  let codeBlock;
  let statusText;
  let answerRenderer;
  let reasoningRenderer;

  container.classList.add("loading");
  container.innerHTML = `
    <div class="streaming-topbar">
      <span><span class="loader"></span> ${escapeHtml(modeLabel)}${escapeHtml(aiName)}에게 전송 중...</span>
      ${onStop ? '<button class="stream-stop-btn" type="button">중단</button>' : ""}
    </div>
  `;
  stopBtn = container.querySelector(".stream-stop-btn");
  if (stopBtn && onStop) {
    stopBtn.onclick = () => {
      stopBtn.disabled = true;
      stopBtn.textContent = "중단 중...";
      onStop();
    };
  }
  scrollChatToBottom();

  function initialize() {
    if (initialized) return;
    initialized = true;
    container.classList.remove("loading");
    container.innerHTML = `
      ${onStop ? '<div class="streaming-topbar"><span class="stream-status"></span><button class="stream-stop-btn" type="button">중단</button></div>' : ""}
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
    stopBtn = container.querySelector(".stream-stop-btn");
    answerText = container.querySelector(".assistant-stream-text");
    codeBlock = container.querySelector(".assistant-stream-code");
    statusText = container.querySelector(".stream-status");
    if (statusText) statusText.textContent = `${modeLabel}${aiName} 응답 수신 중...`;
    if (stopBtn && onStop) {
      stopBtn.onclick = () => {
        stopBtn.disabled = true;
        stopBtn.textContent = "중단 중...";
        onStop();
      };
    }
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
    },
    stopped() {
      if (stopBtn) {
        stopBtn.disabled = true;
        stopBtn.textContent = "중단됨";
      }
    },
  };
}

function showThinkRetryPrompt(container, context) {
  context = context || {};
  const prompt = context.prompt || "";
  const editTargetId = context.editTargetId || null;
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
      addAssistantReply(reply, { editTargetId, reasoning: "" });
      scrollChatToBottom();
    } catch (err) {
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

function resolveErrorRecoveryStepIndex(stepIdx, errorInfo) {
  const numeric = Number(stepIdx);
  if (Number.isInteger(numeric) && numeric >= 0 && state.pipeline[numeric]) return numeric;
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
  return -1;
}

async function requestErrorRecovery(stepIdx, errorInfo) {
  const reportedStepIdx = Number((errorInfo && errorInfo.stepIdx) ?? stepIdx);
  stepIdx = resolveErrorRecoveryStepIndex(stepIdx, errorInfo);
  const displayStepNumber = Number.isInteger(reportedStepIdx) && reportedStepIdx >= 0
    ? reportedStepIdx + 1
    : (stepIdx >= 0 ? stepIdx + 1 : (state.pipeline || []).length + 1);
  const existingStep = stepIdx >= 0 ? (state.pipeline[stepIdx] || null) : null;
  const failedStep = existingStep || {
    id: errorInfo && errorInfo.stepId,
    description: errorInfo && errorInfo.description,
    code: errorInfo && errorInfo.code,
    language: errorInfo && errorInfo.language,
  };
  if (!failedStep || !failedStep.code) {
    toast("복구에 사용할 스킬 코드를 찾지 못했습니다.", "error");
    return;
  }
  const isExistingStep = !!existingStep;
  const recoveryLanguage = failedStep.language ||
    (typeof inferPipelineStepLanguage === "function" ? inferPipelineStepLanguage(failedStep) : "python");
  const isPythonRecovery = recoveryLanguage === "python";
  const recoveryCodeRule = isPythonRecovery
    ? "Return exactly one Python code block that defines def transform(ctx):. Do not return JavaScript."
    : "Return exactly one JavaScript code block that defines function transform(inputs, output).";
  const useCompatibilityCheck = !!(errorInfo && errorInfo.compatibilityCheck);
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
  const compatibilityPrompt = useCompatibilityCheck ? [
    "",
    "## 복구 방식",
    "- 코드는 자동 교체하지 않습니다. 사용자가 '수정 적용' 버튼을 눌러 적용할 수 있도록 수정 후보만 제안하세요.",
    "- 실패한 Step 하나만 고치세요. 이전/다음 Step의 작업을 반복하거나 새 기능을 추가하지 마세요.",
    "- 먼저 호환성 검사를 수행한 뒤, 그 결과를 반영한 javascript 코드블록 하나를 작성하세요.",
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
  ] : [];

  const prompt = [
    `Step ${displayStepNumber} 실행 중 오류가 발생했습니다.`,
    isExistingStep
      ? "대화 히스토리의 사용자 의도, 현재 파일 스키마, 수정 대상 코드, 아래 오류를 함께 분석해서 이 Step을 교체할 수정 코드를 다시 작성하세요."
      : "이 Step은 아직 파이프라인에 적용되지 못했습니다. 대화 히스토리의 사용자 의도, 현재 파일 스키마, 실패한 코드, 아래 오류를 함께 분석해서 적용 가능한 새 스킬 코드를 다시 작성하세요.",
    recoveryCodeRule,
    ...compatibilityPrompt,
    recoveryCodeRule,
    "",
    "## 실패한 Step",
    `설명: ${failedStep.description || ""}`,
    "",
    "## 실패한 코드",
    "```" + (isPythonRecovery ? "python" : "javascript"),
    failedStep.code || "",
    "```",
    "",
    "## 상세 오류",
    `메시지: ${(errorInfo && errorInfo.message) || ""}`,
    errorInfo && errorInfo.stack ? `\n스택:\n${errorInfo.stack}` : "",
    recentHistory ? "\n## 최근 대화/사용자 의도\n" + recentHistory : "",
    schemaSummary ? "\n## 현재 업로드 파일/시트/컬럼 스키마\n" + schemaSummary : "",
  ].filter(Boolean).join("\n");

  addMessage("system", `Step ${displayStepNumber} 에러 복구를 요청합니다.`);
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
    addAssistantReply(reply, { editTargetId: isExistingStep ? failedStep.id : null, reasoning: reasoningText });
    scrollChatToBottom();
  } catch (err) {
    loading.classList.remove("streaming");
    loading.classList.remove("loading");
    if (err && err.name === "AbortError" && thinkMode) {
      showThinkRetryPrompt(loading, {
        prompt,
        editTargetId: isExistingStep ? failedStep.id : null,
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
      schedule();
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

async function sendChat() {
  const input = $("chat-text");
  const msg = input.value.trim();
  if (!msg) return;
  if (!state.output && state.inputs.length === 0) { toast("입력 또는 출력 파일을 먼저 업로드하세요", "error"); return; }
  // 전송 시점의 수정 대상 step을 캡처해두면, 이후 사용자가 수정 모드를 토글해도 응답 버튼은 올바른 step을 가리킨다.
  const editTargetId = state.editingStepId || null;
  input.value = "";
  addMessage("user", msg);
  clearViewerDragSelection();
  const loading = addMessage("assistant", "", {});
  loading.classList.add("streaming");
  // 외부 노출 시엔 내부 모델명을 표시하지 않고 LLM 으로 통일
  const aiName = settings.provider === "openai-compat" ? "ixi 모델" : "LLM";
  const modeLabel = editTargetId ? "(수정 모드) " : "";
  const thinkMode = typeof isThinkModeEnabled === "function" && isThinkModeEnabled();
  const abortController = new AbortController();
  const streamView = setupStreamingAssistantMessage(loading, modeLabel, aiName, () => abortController.abort());
  $("chat-send").disabled = true;
  let reasoningText = "";
  let prompt = "";
  try {
    prompt = typeof augmentUserPromptWithMentions === "function"
      ? augmentUserPromptWithMentions(msg)
      : msg;
    const requestOptions = {
      editTargetId,
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
    addAssistantReply(reply, { editTargetId, reasoning: reasoningText });
    scrollChatToBottom();
  } catch (err) {
    loading.classList.remove("streaming");
    loading.classList.remove("loading");
    if (err && err.name === "AbortError" && thinkMode) {
      showThinkRetryPrompt(loading, {
        prompt,
        editTargetId,
        modeLabel,
        aiName,
        message: "Think 요청을 중단했습니다.",
        detail: "필요하면 Think 없이 같은 요청을 다시 보낼 수 있습니다.",
      });
      scrollChatToBottom();
      return;
    }
    if (err && err.name === "AbortError") {
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
