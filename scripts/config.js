/* ===================================================================
   CONFIG
   =================================================================== */
const B2B_BUILD_STAMP = "b2b-overlay-shell-20260605-045-01";
window.B2B_BUILD_STAMP = B2B_BUILD_STAMP;

// 마우스 우클릭(컨텍스트 메뉴) 전역 차단. (네이티브 셸은 WebView 설정으로도 막지만 브라우저 모드 대비)
window.addEventListener("contextmenu", (e) => { e.preventDefault(); }, true);

const DEFAULTS = {
  anthropic: {
    apiKey: "",
    model: "claude-opus-4-7",
    baseUrl: "https://api.anthropic.com/v1",
  },
  "openai-compat": {
    apiKey: "7365676d",
    model: ["Qwen3.5", "27B", "FP8"].join("-"),
    baseUrl: location.protocol === "http:" || location.protocol === "https:"
      ? `${location.origin}/v1`
      : "http://127.0.0.1:8090/v1",
    // ixi 프록시(/v1/*)가 실제로 전달할 Violet/vLLM 상위 주소. 설정에서 변경 가능.
    proxyUpstream: "http://canvas-ns-1727666527880704.mng.ip.violet.uplus.co.kr",
    thinkMode: false,
    thinkControlMode: "soft_switch",
    network: "ixi",
  },
  devVllm: {
    apiKey: "7365676d",
    model: "Qwen3.5-27B-FP8",
    baseUrl: "http://localhost:8016/v1",
    fallbackBaseUrls: ["http://192.168.219.105:8016/v1"],
    thinkControlMode: "chat_template_kwargs",
  },
};

const OPENAI_COMPAT_FALLBACK_BASE_URLS = [
  DEFAULTS["openai-compat"].baseUrl,
  "http://127.0.0.1:8090/v1",
];

const SETTINGS_KEY = "mvno_llm_settings_v3";
const SETTINGS_KEY_MIGRATE = ["mvno_llm_settings_v2", "mvno_llm_settings_v1"];
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
      proxyUpstream: parsed.proxyUpstream || DEFAULTS["openai-compat"].proxyUpstream,
      apiKey: parsed.apiKey || DEFAULTS["openai-compat"].apiKey,
      thinkMode: parsed.thinkMode === true,
      thinkControlMode: normalizeThinkControlMode(parsed.thinkControlMode),
      network: parsed.network === "dev-vllm" ? "dev-vllm" : "ixi",
    };
  }
  return null;
}

function normalizeThinkControlMode(value) {
  if (value === "chat_template_kwargs") return value;
  return DEFAULTS["openai-compat"].thinkControlMode;
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
  updateThinkToggle();
}

function updateModelLabel() {
  const el = document.getElementById("model-label");
  if (!el) return;
  if (settings.provider === "anthropic") {
    el.textContent = "AI: Claude";
    el.style.color = "#777";
  } else {
    el.textContent = settings.network === "dev-vllm" ? "AI: 개발망 vLLM" : "AI: ixi 모델";
    el.style.color = "#28a745";
  }
}

function isThinkModeEnabled() {
  return settings.provider === "openai-compat" && settings.thinkMode === true;
}

function updateThinkToggle() {
  const btn = document.getElementById("btn-think-toggle");
  if (!btn) return;
  const enabled = isThinkModeEnabled();
  const available = settings.provider === "openai-compat";
  btn.classList.toggle("on", enabled);
  btn.disabled = !available;
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  btn.title = available
    ? (enabled ? "Think 모드 끄기" : "Think 모드 켜기")
    : "ixi 모델에서만 Think 모드를 사용할 수 있습니다";
}

function setupThinkToggle() {
  const btn = document.getElementById("btn-think-toggle");
  if (!btn) return;
  btn.onclick = () => {
    if (settings.provider !== "openai-compat") return;
    settings = {
      ...settings,
      thinkMode: !isThinkModeEnabled(),
    };
    saveSettings();
    toast(`Think 모드 ${settings.thinkMode ? "켜짐" : "꺼짐"}`, "success");
  };
  updateThinkToggle();
}
