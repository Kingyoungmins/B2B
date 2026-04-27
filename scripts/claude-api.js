/* ===================================================================
   CLAUDE API
   =================================================================== */
async function callLLM(userMessage) {
  state.chatHistory.push({ role: "user", content: userMessage });
  const schema = buildSchemaSummary();
  const fullSystem = SYSTEM_PROMPT + "\n\n## 현재 파일 스키마\n" + schema;

  if (settings.provider === "openai-compat") {
    return await callOpenAICompat(fullSystem);
  }
  return await callAnthropic(fullSystem);
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

async function callOpenAICompat(system) {
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
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM API 오류 ${resp.status}: ${text.slice(0, 300)}\n(URL: ${url})`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  state.chatHistory.push({ role: "assistant", content });
  return content;
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
      errors.push(`${url} → ${err.message || err}`);
    }
  }

  const secureHint = location.protocol === "https:"
    ? "\n현재 페이지가 HTTPS라서 HTTP vLLM 호출이 브라우저에서 차단될 수 있습니다. KGM을 file:// 또는 http:// 로 여세요."
    : "";
  throw new Error("vLLM 서버에 연결할 수 없습니다.\n" + errors.join("\n") + secureHint);
}

function extractCode(text) {
  const m = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}
function extractDescription(text) {
  // remove code blocks, take first line
  const stripped = text.replace(/```[\s\S]*?```/g, "").trim();
  const firstLine = stripped.split("\n").find(l => l.trim()) || "로직 생성";
  return firstLine.trim().slice(0, 100);
}
