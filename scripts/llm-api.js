/* ===================================================================
   LLM API
   =================================================================== */
const LLM_HISTORY_MAX_MESSAGES = 18;
const LLM_HISTORY_MAX_CHARS = 32000;
const LLM_REASONING_WARNING_CHARS = 7000;
const LLM_REASONING_WARNING_MS = 45000;
const LLM_REASONING_LOOP_CHARS = 12000;
const OPENAI_COMPAT_MAX_ATTEMPTS = 3;
const OPENAI_COMPAT_RETRY_BASE_MS = 700;

// [#3/#12] 사용자의 최신 메시지가 직전 결과에 대한 '정정'인지 추정(정정일 때만 정정-우선 지시 강화).
function _looksLikeCorrection(text) {
  const t = String(text || "");
  return /(아니[야라다]?|아닌데|틀렸|틀림|잘못|말고|대신에?|가 아니라|이 아니라|왜.{0,20}했|했잖아|하라고|다시 ?(?:해|작성|생성|만들)|보고 ?작업)/.test(t);
}

async function callLLM(userMessage, options) {
  options = options || {};
  const thinkMode = settings.provider === "openai-compat"
    && (options.thinkMode === true || (options.thinkMode == null && isThinkModeEnabled()));
  if (!options.skipHistoryPush) {
    // histId: 말풍선의 × 삭제 버튼이 이 항목을 대화 기억에서 제거할 때 쓰는 식별자.
    state.chatHistory.push({ role: "user", content: userMessage, histId: (typeof uid === "function" ? uid() : String(Date.now() + Math.random())) });
  }
  const editTargetId = options.editTargetId;
  const editIdx = editTargetId
    ? state.pipeline.findIndex(s => s.id === editTargetId)
    : -1;

  const engine = typeof getSkillEngine === "function" ? getSkillEngine() : "python";
  let fullSystem;
  if (engine === "vba" && typeof VBA_SYSTEM_PROMPT === "string") {
    // 0.4.9 리모콘 모델: VBA 매크로 생성. (편집 시에도 현재 코드 컨텍스트를 붙여 VBA로 수정.)
    fullSystem = VBA_SYSTEM_PROMPT + (editIdx >= 0
      ? "\n\n" + buildEditingContext(editIdx)
      : "\n\n## 현재 파일 스키마\n" + buildSchemaSummary());
  } else {
    const engineNote = typeof skillEnginePromptNote === "function" ? skillEnginePromptNote() : "";
    fullSystem = (editIdx >= 0
      ? EDIT_SYSTEM_PROMPT + "\n\n" + buildEditingContext(editIdx)
      : SYSTEM_PROMPT + "\n\n## 현재 파일 스키마\n" + buildSchemaSummary()) + engineNote;
  }

  // [#3/#12] 최신 메시지가 정정이면 이전 코드/해석을 고집하지 말고 정정을 최우선 반영하도록 강조.
  if (_looksLikeCorrection(userMessage)) {
    fullSystem += "\n\n## 사용자 정정 (최우선)\n사용자의 최신 메시지는 직전 작업/해석이 틀렸다는 정정입니다. 이전 단계 코드나 직전 해석(특히 잘못 고른 열·조건)을 그대로 반복하지 말고, 이 정정을 최우선으로 반영해 새로 작성하세요. 사용자가 지목한 열/항목/기준(열 문자나 헤더명)을 정확히 사용하세요.";
  }

  try {
    let reply;
    if (settings.provider === "anthropic") {
      reply = await callAnthropic(fullSystem);
    } else {
      const requestOptions = {
        ...options,
        enableReasoning: thinkMode,
        thinkMode,
      };
      reply = await callOpenAICompat(fullSystem, requestOptions);
    }
    // AI 모델 서버 정상 응답 → 업스트림 경고 배너 해제
    if (typeof window.b2bReportUpstreamOk === "function") window.b2bReportUpstreamOk();
    return reply;
  } catch (err) {
    // 사용자가 중단(AbortError)한 경우는 업스트림 실패가 아님
    if (!(err && err.name === "AbortError") && typeof window.b2bReportUpstreamError === "function") {
      window.b2bReportUpstreamError(err);
    }
    throw err;
  }
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
  state.chatHistory.push({ role: "assistant", content, histId: (typeof uid === "function" ? uid() : String(Date.now() + Math.random())) });
  return content;
}

async function callOpenAICompat(system, options) {
  options = options || {};
  let effectiveOptions = { ...options };
  let lastError = null;
  const reqId = options.reqId || "?";
  let didThinkFallback = false;
  for (let attempt = 1; attempt <= OPENAI_COMPAT_MAX_ATTEMPTS; attempt++) {
    if (attempt > 1 && typeof effectiveOptions.onReconnect === "function") {
      effectiveOptions.onReconnect(attempt, OPENAI_COMPAT_MAX_ATTEMPTS, lastError);
    }
    // [B2B#5 진단] attempt>1 = 같은 요청 재전송 → 서버가 두 번 생성하면 중복응답의 원인.
    if (attempt > 1) {
      console.warn(`[B2B#5] req#${reqId} 재전송 attempt=${attempt}/${OPENAI_COMPAT_MAX_ATTEMPTS} (직전 오류: ${lastError && lastError.message}) — 같은 프롬프트가 서버로 다시 전송됨(중복응답 의심 지점)`);
    }
    try {
      const reply = await callOpenAICompatOnce(system, effectiveOptions);
      // [B2B#5 진단] 응답 길이가 비정상적으로 길거나 attempt>1 이면 의심. 표시측 중복은 chat-ui 로그와 대조.
      console.debug(`[B2B#5] req#${reqId} 응답 수신 attempt=${attempt} length=${reply ? reply.length : 0}`);
      return reply;
    } catch (err) {
      if (err && err.retryWithoutThink === true && effectiveOptions.thinkMode === true && !didThinkFallback) {
        didThinkFallback = true;
        lastError = err;
        effectiveOptions = {
          ...effectiveOptions,
          thinkMode: false,
          enableReasoning: false,
        };
        console.warn(`[B2B] req#${reqId} think 반복 감지 → no-think로 같은 요청 재시도`);
        attempt -= 1;
        continue;
      }
      if (!shouldRetryOpenAICompatError(err) || attempt >= OPENAI_COMPAT_MAX_ATTEMPTS) throw err;
      lastError = err;
      await delayOpenAICompatRetry(OPENAI_COMPAT_RETRY_BASE_MS * attempt, effectiveOptions.signal);
    }
  }
  throw lastError || new Error("LLM request failed");
}

async function callOpenAICompatOnce(system, options) {
  options = options || {};
  const base = effectiveOpenAICompatBaseUrl();
  const networkDefaults = settings.network === "dev-vllm" ? DEFAULTS.devVllm : DEFAULTS["openai-compat"];
  const messages = [
    { role: "system", content: system },
    ...getLLMChatHistory(),
  ];
  const model = settings.model || networkDefaults.model || DEFAULTS["openai-compat"].model;
  const isQwen = /qwen/i.test(String(model || ""));
  const thinkOn = options.thinkMode === true;
  // [0.5.2 이식] Qwen3 계열은 공식 가이드가 greedy/저온 디코딩을 금지한다 — temperature 0.2 같은
  // 준-greedy 설정에서 같은 줄을 끝없이 반복하는 degenerate 출력이 발생한다(FP8 양자화는 더 심함).
  // 권장값: no-think temp 0.7/top_p 0.8, think temp 0.6/top_p 0.95, top_k 20, presence_penalty 1.5.
  const defaultTemperature = isQwen ? (thinkOn ? 0.6 : 0.7) : 0.2;
  const payload = {
    model,
    messages,
    max_tokens: 4096,
    // seed 는 일부러 박지 않음 → 재요청/재생성 때 다른 시도가 나올 여지 유지.
    // 호출자가 options.temperature 로 직접 지정할 수 있음.
    temperature: (typeof options.temperature === "number") ? options.temperature : defaultTemperature,
    stream: true,
  };
  if (isQwen) {
    payload.top_p = thinkOn ? 0.95 : 0.8;
    payload.top_k = 20;             // vLLM 확장 파라미터(Qwen 권장)
    payload.presence_penalty = 1.5; // FP8 양자화 반복 억제(Qwen 공식 권장 범위)
  }
  applyQwenThinkControl(payload, options.thinkMode === true);
  const { resp, url } = await fetchOpenAICompat("/chat/completions", base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": settings.apiKey || networkDefaults.apiKey || DEFAULTS["openai-compat"].apiKey,
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
    state.chatHistory.push({ role: "assistant", content, histId: (typeof uid === "function" ? uid() : String(Date.now() + Math.random())) });
    return content;
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  state.chatHistory.push({ role: "assistant", content, histId: (typeof uid === "function" ? uid() : String(Date.now() + Math.random())) });
  return content;
}

function effectiveOpenAICompatBaseUrl() {
  const raw = String(settings.baseUrl || "").trim().replace(/\/$/, "");
  if (settings.network === "dev-vllm") {
    const localProxyPattern = /^(?:https?:\/\/[^/]+)?\/v1$|^https?:\/\/(?:127\.0\.0\.1|localhost):8090\/v1$/i;
    if (!raw || localProxyPattern.test(raw)) {
      return DEFAULTS.devVllm.baseUrl.replace(/\/$/, "");
    }
    return raw;
  }
  if (typeof isLocalIxiProxyBaseUrl === "function" && isLocalIxiProxyBaseUrl(raw)) {
    return DEFAULTS["openai-compat"].baseUrl.replace(/\/$/, "");
  }
  return (raw || DEFAULTS["openai-compat"].baseUrl).replace(/\/$/, "");
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
  let reasoningWarningShown = false;

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
      if (data === "[DONE]") {
        if (!full.trim() && reasoningFull.trim()) {
          const err = new Error("reasoning stream ended without content");
          err.retryWithoutThink = true;
          throw err;
        }
        return full;
      }
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
        if (!full.trim() && reasoningFull.length >= LLM_REASONING_LOOP_CHARS && looksLikeRepeatedReasoning(reasoningFull)) {
          const err = new Error("reasoning stream repeated before content");
          err.retryWithoutThink = true;
          throw err;
        }
        if (!full.trim()) {
          const elapsed = performance.now() - reasoningStartedAt;
          if (!reasoningWarningShown
            && (reasoningFull.length >= LLM_REASONING_WARNING_CHARS || elapsed >= LLM_REASONING_WARNING_MS)) {
            reasoningWarningShown = true;
            if (typeof options.onReasoningWarning === "function") {
              options.onReasoningWarning(reasoningFull, {
                chars: reasoningFull.length,
                elapsedMs: elapsed,
              });
            }
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

  if (!full.trim() && reasoningFull.trim()) {
    const err = new Error("reasoning stream ended without content");
    err.retryWithoutThink = true;
    throw err;
  }
  return full;
}

function looksLikeRepeatedReasoning(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (compact.length < LLM_REASONING_LOOP_CHARS) return false;
  const tail = compact.slice(-3600);
  for (const size of [160, 240, 320, 480]) {
    const unit = tail.slice(-size);
    if (unit.trim().length >= size * 0.8 && tail.split(unit).length - 1 >= 3) return true;
  }
  const chunks = [];
  for (let i = 0; i < tail.length; i += 450) {
    const chunk = tail.slice(i, i + 450);
    if (chunk.length >= 320) chunks.push(chunk);
  }
  if (chunks.length >= 6 && new Set(chunks.slice(-6)).size <= 2) return true;
  return compact.length >= 26000;
}

function isRetryableOpenAICompatStatus(status) {
  return [408, 429, 500, 502, 503, 504].includes(Number(status));
}

function shouldRetryOpenAICompatError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return false;
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
  // 기본 ixi 경로는 Violet/vLLM 직접 호출이다. legacy 로컬 프록시(/v1)를 명시적으로 쓸 때만
  // 서버가 전달할 upstream 헤더를 붙인다.
  const preferred = String(preferredBase || "").trim().replace(/\/$/, "");
  const usingLegacyLocalProxy = settings.provider === "openai-compat"
    && settings.network !== "dev-vllm"
    && typeof isLocalIxiProxyBaseUrl === "function"
    && isLocalIxiProxyBaseUrl(preferred);
  const upstream = usingLegacyLocalProxy
    ? (settings.proxyUpstream || "")
    : "";
  if (upstream) {
    options = { ...options, headers: { ...(options.headers || {}), "X-B2B-Vllm-Base": upstream } };
  }
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
  if (hinted === "vba" || hinted === "vb" || hinted === "vbscript") return "vba";
  if (hinted === "python" || hinted === "py") return "python";
  if (hinted === "javascript" || hinted === "js") return "javascript";
  const src = String(code || "");
  if (/^\s*sub\s+\w+\s*\(/im.test(src) && /\bend\s+sub\b/i.test(src)) return "vba";
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
