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
// ver2.0: 디폴트는 항상 사내 ixi 모델. 과거 v1 키는 ixi/Claude 둘 다 자동 복원했지만,
// 그러다 보니 F9 로 한번 Claude를 시험한 사용자는 새로고침 후에도 계속 Claude가 켜져 있는
// 문제가 있어 KEY 를 올려 무효화한다.
const SETTINGS_KEY = "mvno_llm_settings_v2";
const SETTINGS_KEY_LEGACY = "mvno_llm_settings_v1";
let settings = loadSettings();

function loadSettings() {
  // 레거시 키가 있으면 청소 — 사용자에게 혼란을 안 주려고 한 번만 비운다.
  try { localStorage.removeItem(SETTINGS_KEY_LEGACY); } catch {}
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Claude 설정도 dev 가 명시적으로 저장한 경우에만 복원 (F9 → 저장 클릭).
      if (parsed && parsed.provider === "anthropic" && parsed.devModeSet) {
        return { ...DEFAULTS.anthropic, ...parsed, provider: "anthropic" };
      }
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
  // 기본값 = 사내 ixi
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
    // Claude 사용 중에도 외부엔 모델 이름을 노출하지 않는다 (F9 설정 모달에선 그대로 보여줌).
    el.textContent = "AI: LLM";
    el.style.color = "#777";
  }
}
