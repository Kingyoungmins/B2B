/* ===================================================================
   LLM API
   =================================================================== */
const LLM_HISTORY_MAX_MESSAGES = 18;
const LLM_HISTORY_MAX_CHARS = 32000;
const LLM_REASONING_RUNAWAY_CHARS = 7000;
const LLM_REASONING_RUNAWAY_MS = 45000;
const OPENAI_COMPAT_MAX_ATTEMPTS = 3;
const OPENAI_COMPAT_RETRY_BASE_MS = 700;

async function callLLM(userMessage, options) {
  options = options || {};
  const thinkMode = settings.provider === "openai-compat"
    && (options.thinkMode === true || (options.thinkMode == null && isThinkModeEnabled()));
  if (!options.skipHistoryPush) {
    state.chatHistory.push({ role: "user", content: userMessage });
  }
  const editTargetId = options.editTargetId;
  const editIdx = editTargetId
    ? state.pipeline.findIndex(s => s.id === editTargetId)
    : -1;

  const fullSystem = editIdx >= 0
    ? EDIT_SYSTEM_PROMPT + "\n\n" + buildEditingContext(editIdx)
    : SYSTEM_PROMPT + "\n\n## 현재 파일 스키마\n" + buildSchemaSummary();

  if (settings.provider === "anthropic") {
    return await callAnthropic(fullSystem);
  }
  const requestOptions = {
    ...options,
    enableReasoning: thinkMode,
    thinkMode,
  };
  return await callOpenAICompat(fullSystem, requestOptions);
}

async function callAnthropic(system) {
  const base = (settings.baseUrl || DEFAULTS.anthropic.baseUrl).replace(/\/$/, "");
  const messages = getLLMChatHistory();
  const resp = await fetch(base + "/messages", {
    method: "POST",
    headers: {
      "x-api-key": settings.apiKey || DEFAULTS.anthropic.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model || DEFAULTS.anthropic.model,
      max_tokens: 4096,
      system,
      messages,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error("Anthropic API 오류 " + resp.status + ": " + text.slice(0, 300));
  }
  const data = await resp.json();
  const content = data.content?.[0]?.text || "";
  state.chatHistory.push({ role: "assistant", content });
  return content;
}

async function callOpenAICompat(system, options) {
  options = options || {};
  let lastError = null;
  for (let attempt = 1; attempt <= OPENAI_COMPAT_MAX_ATTEMPTS; attempt++) {
    if (attempt > 1 && typeof options.onReconnect === "function") {
      options.onReconnect(attempt, OPENAI_COMPAT_MAX_ATTEMPTS, lastError);
    }
    try {
      return await callOpenAICompatOnce(system, options);
    } catch (err) {
      if (!shouldRetryOpenAICompatError(err) || attempt >= OPENAI_COMPAT_MAX_ATTEMPTS) throw err;
      lastError = err;
      await delayOpenAICompatRetry(OPENAI_COMPAT_RETRY_BASE_MS * attempt, options.signal);
    }
  }
  throw lastError || new Error("LLM request failed");
}

async function callOpenAICompatOnce(system, options) {
  options = options || {};
  const base = (settings.baseUrl || DEFAULTS["openai-compat"].baseUrl).replace(/\/$/, "");
  const messages = [
    { role: "system", content: system },
    ...getLLMChatHistory(),
  ];
  const payload = {
    model: settings.model || DEFAULTS["openai-compat"].model,
    messages,
    max_tokens: 4096,
    temperature: 0.2,
    stream: true,
  };
  applyQwenThinkControl(payload, options.thinkMode === true);
  const { resp, url } = await fetchOpenAICompat("/chat/completions", base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": settings.apiKey || DEFAULTS["openai-compat"].apiKey,
    },
    signal: options.signal,
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (isRetryableOpenAICompatStatus(resp.status)) {
      const err = new Error(`LLM API transient error ${resp.status}: ${text.slice(0, 300)}\n(URL: ${url})`);
      err.status = resp.status;
      err.retryable = true;
      throw err;
    }
    throw new Error(`LLM API 오류 ${resp.status}: ${text.slice(0, 300)}\n(URL: ${url})`);
  }
  const contentType = resp.headers.get("content-type") || "";
  if (resp.body && contentType.includes("text/event-stream")) {
    const content = await readOpenAICompatStream(resp, options);
    if (!content.trim() && options.thinkMode === true) {
      throw createReasoningRunawayError("thinking만 생성되고 답변 본문이 비어 있습니다.");
    }
    state.chatHistory.push({ role: "assistant", content });
    return content;
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content.trim() && options.thinkMode === true) {
    throw createReasoningRunawayError("thinking만 생성되고 답변 본문이 비어 있습니다.");
  }
  state.chatHistory.push({ role: "assistant", content });
  return content;
}

function getLLMChatHistory() {
  const source = Array.isArray(state.chatHistory) ? state.chatHistory : [];
  const picked = [];
  let totalChars = 0;

  for (let i = source.length - 1; i >= 0 && picked.length < LLM_HISTORY_MAX_MESSAGES; i--) {
    const msg = source[i];
    if (!msg || (msg.role !== "user" && msg.role !== "assistant")) continue;
    const content = String(msg.content || "");
    const nextChars = totalChars + content.length;
    if (picked.length > 0 && nextChars > LLM_HISTORY_MAX_CHARS) break;
    picked.push({ role: msg.role, content });
    totalChars = nextChars;
  }

  const history = picked.reverse();
  while (history.length && history[0].role !== "user") history.shift();
  return history;
}

async function readOpenAICompatStream(resp, options) {
  options = options || {};
  const allowReasoning = options.enableReasoning === true;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let full = "";
  let reasoningFull = "";
  let reasoningStartedAt = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return full;
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const choice = parsed.choices?.[0] || {};
      const deltaObj = choice.delta || {};
      const reasoningDelta = deltaObj.reasoning_content
        ?? deltaObj.reasoning
        ?? deltaObj.reasoningContent
        ?? choice.reasoning_content
        ?? choice.reasoning
        ?? "";
      if (allowReasoning && reasoningDelta) {
        if (!reasoningStartedAt) reasoningStartedAt = performance.now();
        reasoningFull += reasoningDelta;
        if (typeof options.onReasoningDelta === "function") {
          options.onReasoningDelta(reasoningDelta, reasoningFull);
        }
        if (!full.trim()) {
          const elapsed = performance.now() - reasoningStartedAt;
          if (reasoningFull.length >= LLM_REASONING_RUNAWAY_CHARS || elapsed >= LLM_REASONING_RUNAWAY_MS) {
            try { await reader.cancel(); } catch {}
            throw createReasoningRunawayError("thinking이 길어져 답변 본문으로 넘어오지 않았습니다.");
          }
        }
      }

      const delta = deltaObj.content
        ?? parsed.choices?.[0]?.text
        ?? "";
      if (!delta) continue;
      full += delta;
      if (typeof options.onDelta === "function") options.onDelta(delta, full);
    }
  }

  return full;
}

function createReasoningRunawayError(message) {
  const err = new Error(message);
  err.name = "ReasoningRunawayError";
  return err;
}

function isRetryableOpenAICompatStatus(status) {
  return [408, 429, 500, 502, 503, 504].includes(Number(status));
}

function shouldRetryOpenAICompatError(err) {
  if (!err) return false;
  if (err.name === "AbortError" || err.name === "ReasoningRunawayError") return false;
  if (err.retryable === true) return true;
  if (err.status && isRetryableOpenAICompatStatus(err.status)) return true;
  const message = String(err.message || err).toLowerCase();
  return /failed to fetch|networkerror|proxy error|connection|timeout|timed out|econnreset|ecconnreset|socket|502|503|504/.test(message);
}

function delayOpenAICompatRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      const err = new DOMException("Aborted", "AbortError");
      reject(err);
      return;
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    }
  });
}

function applyQwenThinkControl(payload, thinkMode) {
  const mode = settings.thinkControlMode || DEFAULTS["openai-compat"].thinkControlMode;
  if (mode === "chat_template_kwargs") {
    payload.chat_template_kwargs = {
      ...(payload.chat_template_kwargs || {}),
      enable_thinking: thinkMode,
    };
    return;
  }
  applyQwenThinkDirective(payload.messages, thinkMode);
}

function applyQwenThinkDirective(messages, thinkMode) {
  const directive = thinkMode ? "/think" : "/no_think";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    messages[i] = {
      ...messages[i],
      content: `${messages[i].content || ""}\n\n${directive}`,
    };
    return;
  }
}

async function fetchOpenAICompat(path, preferredBase, options = {}) {
  const networkFallbacks = settings.network === "dev-vllm"
    ? (DEFAULTS.devVllm.fallbackBaseUrls || [])
    : OPENAI_COMPAT_FALLBACK_BASE_URLS;
  const bases = [
    preferredBase,
    ...networkFallbacks,
  ]
    .filter(Boolean)
    .map(base => base.replace(/\/$/, ""))
    .filter((base, idx, arr) => arr.indexOf(base) === idx);

  const errors = [];
  for (const base of bases) {
    const url = base + path;
    try {
      const resp = await fetch(url, options);
      return { resp, url, base };
    } catch (err) {
      errors.push(`${url} -> ${err.message || err}`);
    }
  }

  const secureHint = location.protocol === "https:"
    ? "\n현재 페이지가 HTTPS라면 HTTP vLLM 호출이 브라우저에서 차단될 수 있습니다. exe 로컬 프록시 또는 http:// 실행을 사용하세요."
    : "";
  throw new Error("vLLM 서버에 연결할 수 없습니다.\n" + errors.join("\n") + secureHint);
}

function extractCodeBlock(text) {
  const m = String(text || "").match(/```([a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/);
  if (!m) return null;
  return {
    language: (m[1] || "").trim().toLowerCase(),
    code: (m[2] || "").trim(),
  };
}

function inferCodeLanguage(code, fullText) {
  const block = extractCodeBlock(fullText || "");
  const hinted = block && block.language;
  if (hinted === "python" || hinted === "py") return "python";
  if (hinted === "javascript" || hinted === "js") return "javascript";
  const src = String(code || "");
  if (/^\s*def\s+transform\s*\(\s*ctx\s*\)\s*:/m.test(src)) return "python";
  if (/^\s*def\s+transform\s*\(/m.test(src) || /\bctx\.(?:sheet|input|output|workbook|excel)\b/.test(src)) return "python";
  return "javascript";
}

function extractCode(text) {
  const block = extractCodeBlock(text);
  return block ? block.code : null;
}

function extractDescription(text) {
  const stripped = text.replace(/```[\s\S]*?```/g, "").trim();
  const titleLine = stripped
    .split("\n")
    .map(l => l.trim())
    .find(l => /^제목\s*[:：]/.test(l));
  const firstLine = titleLine
    ? titleLine.replace(/^제목\s*[:：]\s*/, "")
    : stripped.split("\n").find(l => l.trim()) || "스킬 생성";
  return firstLine.trim().slice(0, 100);
}
