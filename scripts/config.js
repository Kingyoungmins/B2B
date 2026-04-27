/* ===================================================================
   CONFIG
   =================================================================== */
const DEFAULTS = {
  anthropic: {
    apiKey: "",
    model: "claude-sonnet-4-5-20250929",
    baseUrl: "https://api.anthropic.com/v1",
  },
  "openai-compat": {
    apiKey: "7365676d",
    model: "Qwen3.5-27B-FP8",
    baseUrl: location.protocol === "http:" || location.protocol === "https:"
      ? `${location.origin}/v1`
      : "http://127.0.0.1:8090/v1",
  },
};
const OPENAI_COMPAT_FALLBACK_BASE_URLS = [
  DEFAULTS["openai-compat"].baseUrl,
  "http://127.0.0.1:8090/v1",
];
const SETTINGS_KEY = "mvno_llm_settings_v1";
let settings = loadSettings();

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.provider === "openai-compat") {
        return {
          ...DEFAULTS["openai-compat"],
          ...parsed,
          provider: "openai-compat",
          baseUrl: DEFAULTS["openai-compat"].baseUrl,
          apiKey: DEFAULTS["openai-compat"].apiKey,
          model: DEFAULTS["openai-compat"].model,
        };
      }
    }
  } catch {}
  return { provider: "openai-compat", ...DEFAULTS["openai-compat"] };
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  updateModelLabel();
}
function updateModelLabel() {
  const el = document.getElementById("model-label");
  if (!el) return;
  if (settings.provider === "openai-compat") {
    el.textContent = "AI: ixi 모델";
    el.style.color = "#28a745";
  } else {
    el.textContent = `AI: ${settings.model || "Claude"}`;
    el.style.color = "#777";
  }
}
