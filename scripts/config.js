/* ===================================================================
   CONFIG
   =================================================================== */
const DEFAULTS = {
  anthropic: {
    apiKey: "",
    model: "claude-opus-4-7",
    baseUrl: "https://api.anthropic.com/v1",
  },
  "openai-compat": {
    apiKey: "local",
    model: "Qwen3.6-35B-A3B-FP8",
    baseUrl: location.protocol === "http:" || location.protocol === "https:"
      ? `${location.origin}/v1`
      : "http://127.0.0.1:8090/v1",
  },
};

const OPENAI_COMPAT_FALLBACK_BASE_URLS = [
  DEFAULTS["openai-compat"].baseUrl,
  "http://127.0.0.1:8090/v1",
];

const SETTINGS_KEY = "mvno_llm_settings_v331";
const SETTINGS_KEY_MIGRATE = [];
let settings = loadSettings();

function normalizeSettings(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.provider === "anthropic") {
    return {
      ...DEFAULTS.anthropic,
      ...parsed,
      provider: "anthropic",
      model: parsed.model || DEFAULTS.anthropic.model,
      baseUrl: parsed.baseUrl || DEFAULTS.anthropic.baseUrl,
      apiKey: parsed.apiKey || DEFAULTS.anthropic.apiKey,
      devModeSet: true,
    };
  }
  if (parsed.provider === "openai-compat") {
    return {
      ...DEFAULTS["openai-compat"],
      ...parsed,
      provider: "openai-compat",
      model: parsed.model || DEFAULTS["openai-compat"].model,
      baseUrl: parsed.baseUrl || DEFAULTS["openai-compat"].baseUrl,
      apiKey: parsed.apiKey || DEFAULTS["openai-compat"].apiKey,
    };
  }
  return null;
}

function loadSettings() {
  const ixiDefault = { provider: "openai-compat", ...DEFAULTS["openai-compat"] };

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const normalized = normalizeSettings(raw ? JSON.parse(raw) : null);
    if (normalized && normalized.provider === "openai-compat") return normalized;
  } catch {}

  for (const key of SETTINGS_KEY_MIGRATE) {
    try {
      const raw = localStorage.getItem(key);
      const normalized = normalizeSettings(raw ? JSON.parse(raw) : null);
      if (normalized && normalized.provider === "openai-compat") {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized)); } catch {}
        return normalized;
      }
    } catch {}
  }

  return ixiDefault;
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  updateModelLabel();
}

function updateModelLabel() {
  const el = document.getElementById("model-label");
  if (!el) return;
  if (settings.provider === "anthropic") {
    el.textContent = "AI: Claude";
    el.style.color = "#777";
  } else {
    el.textContent = "AI: Qwen 로컬";
    el.style.color = "#28a745";
  }
}
