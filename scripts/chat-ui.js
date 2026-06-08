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

function userExplicitlyRequestsFormulaOverwrite(text) {
  return /수식\s*(제거|삭제|지워|없애|값으로|대체|덮어)|기존\s*수식.*(제거|삭제|지워|없애|값)|formula\s*(remove|delete|overwrite|replace)|값으로\s*(덮어|대체|바꿔)/i.test(String(text || ""));
}

function codeMentionsFormulaOverwrite(code) {
  return /수식\s*(제거|삭제|지워|없애)|수식을?\s*값으로|값으로\s*덮어쓰기|formula\s*(remove|delete|overwrite|replace)/i.test(String(code || ""));
}

function userRequestsCopyPaste(text) {
  return /(복사|붙여\s*넣|붙여넣|복붙|copy|paste)/i.test(String(text || ""));
}

function userRequestsValuesOnly(text) {
  return /(값만|값\s*복사|값\s*붙여|수식\s*(빼고|제외|없이)|values?\s*only|paste\s*values?)/i.test(String(text || ""));
}

function codeCopiesValuesOnly(code) {
  const text = String(code || "");
  return /\.Value\s*=\s*[^#\n\r;]+\.Value\b/i.test(text)
    || /PasteSpecial\s+[^'\n\r]*(xlPasteValues|-4163|Paste\s*:=\s*xlPasteValues|Paste\s*:=\s*-4163)/i.test(text)
    || /PasteSpecial\s*\([^)]*(xlPasteValues|-4163|Paste\s*=\s*-4163)/i.test(text)
    || /ctx\.(write_grid|set_range)\s*\([^)]*ctx\.rows\s*\(/i.test(text);
}

function codeHasBroadValueRewrite(code) {
  const text = String(code || "");
  if (/\bUsedRange\s*\.Value\s*=/.test(text)) return true;
  if (/\bRange\s*\([^'\n\r]*(lastCol|xlToLeft|Columns\.Count)[^'\n\r]*\)\s*\.Value\s*=/i.test(text)) return true;
  if (/\bRange\s*\(\s*"[$]?[A-Z]+:[$]?[A-Z]+"\s*\)\s*\.Value\s*=/i.test(text)) return true;

  const broadRangeVars = new Set();
  const setRe = /\bSet\s+([A-Za-z_]\w*)\s*=\s*([^\n\r']+)/gi;
  let match;
  while ((match = setRe.exec(text)) !== null) {
    const varName = match[1];
    const expr = match[2] || "";
    const isBroadRange = /\bUsedRange\b/i.test(expr)
      || (/\bRange\s*\(/i.test(expr) && /\b(lastCol|xlToLeft|Columns\.Count)\b/i.test(expr))
      || /\bRange\s*\(\s*"[$]?[A-Z]+:[$]?[A-Z]+"/i.test(expr);
    if (isBroadRange) {
      broadRangeVars.add(varName.toLowerCase());
    }
  }

  for (const varName of broadRangeVars) {
    const writeRe = new RegExp("\\b" + varName + "\\s*\\.\\s*Value\\s*=", "i");
    if (writeRe.test(text)) return true;
  }

  const roundTripRe = /\b([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*\.Value\b[\s\S]{0,4000}\b\2\s*\.Value\s*=\s*\1\b/i;
  const roundTrip = roundTripRe.exec(text);
  if (roundTrip) {
    const rangeVar = (roundTrip[2] || "").toLowerCase();
    return rangeVar === "rng" || broadRangeVars.has(rangeVar);
  }
  return false;
}

function validateAssistantCodeBeforeApply(code, context) {
  context = context || {};
  const sourceUserMessage = context.sourceUserMessage || "";
  if (codeMentionsFormulaOverwrite(code) && !userExplicitlyRequestsFormulaOverwrite(sourceUserMessage)) {
    const message = "사용자가 수식 제거를 명시하지 않았는데 생성 코드에 수식 제거/값 덮어쓰기 의도가 포함되어 적용을 막았습니다. 수식을 보존하는 코드로 다시 생성해 주세요.";
    toast(message, "error");
    addMessage("system", message);
    return false;
  }
  if (codeHasBroadValueRewrite(code) && !userExplicitlyRequestsFormulaOverwrite(sourceUserMessage)) {
    const message = "표 전체/UsedRange를 Value 배열로 다시 쓰는 VBA가 감지되어 적용을 막았습니다. 이 방식은 기존 수식을 값으로 바꿀 수 있으니 대상 열/셀만 쓰는 코드로 다시 생성해 주세요.";
    toast(message, "error");
    addMessage("system", message);
    return false;
  }
  if (userRequestsCopyPaste(sourceUserMessage) && !userRequestsValuesOnly(sourceUserMessage) && codeCopiesValuesOnly(code)) {
    const message = "복사/붙여넣기 요청에서 값만 복사하는 코드가 감지되어 적용을 막았습니다. 수식과 서식이 유지되도록 Range.Copy 또는 PasteSpecial xlPasteAll 방식으로 다시 생성해 주세요.";
    toast(message, "error");
    addMessage("system", message);
    return false;
  }
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
    return content;
  }
  return "";
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
        if (!validateAssistantCodeBeforeApply(code, replyContext)) return;
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
        if (!validateAssistantCodeBeforeApply(code, replyContext)) return;
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
        if (!validateAssistantCodeBeforeApply(code, replyContext)) return;
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
    // 특정 step을 못 짚었으면 적용 가능한 마지막 단계를 복구 대상으로 추정한다.
    const enabledSteps = (state.pipeline || []).filter(s => s && s.enabled !== false && s.code);
    const guess = enabledSteps[enabledSteps.length - 1];
    if (guess) {
      failedStep = guess;
      stepIdx = state.pipeline.indexOf(guess);
    }
  }
  if (!failedStep || !failedStep.code) {
    toast("복구에 사용할 스킬 코드를 찾지 못했습니다.", "error");
    return;
  }
  const isExistingStep = stepIdx >= 0 && state.pipeline[stepIdx] === failedStep;
  const recoveryLanguage = failedStep.language ||
    (typeof inferPipelineStepLanguage === "function" ? inferPipelineStepLanguage(failedStep) : "python");
  const isVbaRecovery = recoveryLanguage === "vba" || (typeof getSkillEngine === "function" && getSkillEngine() === "vba");
  const isPythonRecovery = !isVbaRecovery && recoveryLanguage === "python";
  const recoveryCodeRule = isVbaRecovery
    ? "Return exactly one VBA code block that defines Sub B2BSkill(). Do not return JavaScript or Python."
    : (isPythonRecovery
      ? "Return exactly one Python code block that defines def transform(ctx):. Do not return JavaScript."
      : "Return exactly one JavaScript code block that defines function transform(inputs, output).");
  const useCompatibilityCheck = !!(errorInfo && errorInfo.compatibilityCheck);
  const sourceUserMessage = latestUserRequestForSafety();
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
    "- 현재 0.4.9 실행기는 VBA입니다. 반드시 ActiveWorkbook/Workbooks(...).Worksheets(...) 기준의 VBA 코드로 복구하세요.",
  ] : [];

  const prompt = [
    `Step ${displayStepNumber} 실행 중 오류가 발생했습니다.`,
    isExistingStep
      ? "대화 히스토리의 사용자 의도, 현재 파일 스키마, 수정 대상 코드, 아래 오류를 함께 분석해서 이 Step을 교체할 수정 코드를 다시 작성하세요."
      : "이 Step은 아직 파이프라인에 적용되지 못했습니다. 대화 히스토리의 사용자 의도, 현재 파일 스키마, 실패한 코드, 아래 오류를 함께 분석해서 적용 가능한 새 스킬 코드를 다시 작성하세요.",
    recoveryCodeRule,
    "오류 복구는 실패 원인만 고치는 작업입니다. 사용자의 최신 요청에 없는 수식 제거, 값 덮어쓰기, 대상 파일/시트 변경을 새로 추가하지 마세요.",
    "\"채워\", \"입력\", \"업데이트\", \"반영\"은 수식 제거 지시가 아닙니다. 수식 셀을 값으로 바꾸는 코드는 사용자가 명시적으로 수식 제거/값 대체를 요청했을 때만 작성하세요.",
    ...compatibilityPrompt,
    recoveryCodeRule,
    "",
    "## 실패한 Step",
    `설명: ${failedStep.description || ""}`,
    "",
    "## 실패한 코드",
    "```" + (isVbaRecovery ? "vba" : (isPythonRecovery ? "python" : "javascript")),
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
    addAssistantReply(reply, {
      editTargetId: isExistingStep ? failedStep.id : null,
      sourceUserMessage,
      reasoning: reasoningText,
    });
    scrollChatToBottom();
  } catch (err) {
    loading.classList.remove("streaming");
    loading.classList.remove("loading");
    if (err && err.name === "AbortError" && thinkMode) {
      showThinkRetryPrompt(loading, {
        prompt,
        editTargetId: isExistingStep ? failedStep.id : null,
        sourceUserMessage,
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
    addAssistantReply(reply, { editTargetId, sourceUserMessage: msg, reasoning: reasoningText });
    scrollChatToBottom();
  } catch (err) {
    loading.classList.remove("streaming");
    loading.classList.remove("loading");
    if (err && err.name === "AbortError" && thinkMode) {
      showThinkRetryPrompt(loading, {
        prompt,
        editTargetId,
        sourceUserMessage: msg,
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
