/* ===================================================================
   LLM API
   =================================================================== */
async function callLLM(userMessage, options) {
  options = options || {};
  state.chatHistory.push({ role: "user", content: userMessage });
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
  return await callOpenAICompat(fullSystem, options);
}

async function callAnthropic(system) {
  const base = (settings.baseUrl || DEFAULTS.anthropic.baseUrl).replace(/\/$/, "");
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
      messages: state.chatHistory,
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
  const base = (settings.baseUrl || DEFAULTS["openai-compat"].baseUrl).replace(/\/$/, "");
  const messages = [
    { role: "system", content: system },
    ...state.chatHistory,
  ];
  const { resp, url } = await fetchOpenAICompat("/chat/completions", base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": settings.apiKey || DEFAULTS["openai-compat"].apiKey,
    },
    body: JSON.stringify({
      model: settings.model || DEFAULTS["openai-compat"].model,
      messages,
      max_tokens: 4096,
      temperature: 0.2,
      stream: true,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM API 오류 ${resp.status}: ${text.slice(0, 300)}\n(URL: ${url})`);
  }
  const contentType = resp.headers.get("content-type") || "";
  if (resp.body && contentType.includes("text/event-stream")) {
    const content = await readOpenAICompatStream(resp, options && options.onDelta);
    state.chatHistory.push({ role: "assistant", content });
    return content;
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  state.chatHistory.push({ role: "assistant", content });
  return content;
}

async function readOpenAICompatStream(resp, onDelta) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let full = "";

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
      const delta = parsed.choices?.[0]?.delta?.content
        ?? parsed.choices?.[0]?.text
        ?? "";
      if (!delta) continue;
      full += delta;
      if (typeof onDelta === "function") onDelta(delta, full);
    }
  }

  return full;
}

async function fetchOpenAICompat(path, preferredBase, options = {}) {
  const bases = [
    preferredBase,
    ...OPENAI_COMPAT_FALLBACK_BASE_URLS,
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

function extractCode(text) {
  const m = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}

function extractDescription(text) {
  const stripped = text.replace(/```[\s\S]*?```/g, "").trim();
  const firstLine = stripped.split("\n").find(l => l.trim()) || "로직 생성";
  return firstLine.trim().slice(0, 100);
}
