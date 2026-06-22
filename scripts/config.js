/* ===================================================================
   CONFIG
   =================================================================== */
const B2B_BUILD_STAMP = "b2b-0.5.10-20260618-runtime-guard";
window.B2B_BUILD_STAMP = B2B_BUILD_STAMP;

// 마우스 우클릭(컨텍스트 메뉴) 전역 차단. (네이티브 셸은 WebView 설정으로도 막지만 브라우저 모드 대비)
window.addEventListener("contextmenu", (e) => { e.preventDefault(); }, true);

const IXI_VIOLET_BASE_URL = "https://e2e-ns-17786299267796664.mng-1.ip.violet.uplus.co.kr";
const IXI_OPENAI_BASE_URL = `${IXI_VIOLET_BASE_URL}/v1`;
// 옛 ixi upstream/키 — 저장된 설정(localStorage)에 남아 있으면 새 값으로 승격(마이그레이션).
const IXI_LEGACY_UPSTREAMS = ["http://canvas-ns-1727666527880704.mng.ip.violet.uplus.co.kr"];
const IXI_LEGACY_API_KEYS = ["7365676d"];

const DEFAULTS = {
  anthropic: {
    apiKey: "",
    model: "claude-opus-4-7",
    baseUrl: "https://api.anthropic.com/v1",
  },
  "openai-compat": {
    apiKey: "653265",
    model: ["Qwen3.6", "27B", "FP8"].join("-"),
    // ixi는 0.4.12 방식(로컬 /v1 프록시)로 호출한다 — 서버(serve_b2b)가 /v1/* 를 Violet/vLLM 으로 전달.
    // (직접 호출은 게이트웨이 403/CORS 등 환경 이슈가 있어 프록시 경유로 복귀)
    baseUrl: location.protocol === "http:" || location.protocol === "https:"
      ? `${location.origin}/v1`
      : "http://127.0.0.1:8090/v1",
    // ixi 프록시(/v1/*)가 실제로 전달할 Violet/vLLM 상위 주소. 설정에서 변경 가능.
    proxyUpstream: IXI_VIOLET_BASE_URL,
    // [사용자 요청] Think 모드 기본 ON — 저장값이 명시적으로 false 일 때만 꺼진다.
    thinkMode: true,
    thinkControlMode: "chat_template_kwargs",
    network: "ixi",
  },
  devVllm: {
    apiKey: "7365676d",
    model: "Qwen3.5-27B-FP8",
    baseUrl: "http://localhost:8016/v1",
    // WSL의 vLLM은 NAT + localhostForwarding 으로 localhost 로 접근(권장). 죽은 LAN IP fallback 제거.
    fallbackBaseUrls: ["http://127.0.0.1:8016/v1"],
    thinkControlMode: "chat_template_kwargs",
  },
};

const OPENAI_COMPAT_FALLBACK_BASE_URLS = [
  DEFAULTS["openai-compat"].baseUrl,
  "http://127.0.0.1:8090/v1",
];

const SETTINGS_KEY = "mvno_llm_settings_v4";
const SETTINGS_KEY_MIGRATE = ["mvno_llm_settings_v3", "mvno_llm_settings_v2", "mvno_llm_settings_v1"];
const DEFAULT_SKILL_ENGINE = "vba";
const SKILL_ENGINE_LABELS = {
  python: "Python",
  vba: "VBA",
};
let settings = loadSettings();

function isLocalIxiProxyBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  return !raw ||
    /^(?:https?:\/\/[^/]+)?\/v1$/i.test(raw) ||
    /^https?:\/\/(?:127\.0\.0\.1|localhost):8090\/v1$/i.test(raw);
}

function normalizeIxiBaseUrl(value, parsed) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  // 로컬 프록시 변형(빈값, /v1, 127.0.0.1:8090 등)은 현재 origin 기준 프록시 기본값으로 정규화.
  if (isLocalIxiProxyBaseUrl(raw)) return DEFAULTS["openai-compat"].baseUrl;
  // 0.4.13 직접호출 시절 저장된 Violet 직접 주소는 프록시 기본값으로 복귀(DEV 모달 명시 저장만 유지).
  if (raw === IXI_OPENAI_BASE_URL && !(parsed && parsed.devModeSet === true)) {
    return DEFAULTS["openai-compat"].baseUrl;
  }
  return raw;
}

function defaultIxiSettings() {
  return {
    provider: "openai-compat",
    ...DEFAULTS["openai-compat"],
    network: "ixi",
    skillEngine: DEFAULT_SKILL_ENGINE,
    skillEngineUserSet: false,
  };
}

function normalizeSettings(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const skillEngine = normalizeStoredSkillEngine(parsed);
  const skillEngineUserSet = parsed.skillEngineUserSet === true;
  if (parsed.provider === "anthropic") {
    return {
      ...DEFAULTS.anthropic,
      ...parsed,
      provider: "anthropic",
      model: parsed.model || DEFAULTS.anthropic.model,
      baseUrl: parsed.baseUrl || DEFAULTS.anthropic.baseUrl,
      apiKey: parsed.apiKey || DEFAULTS.anthropic.apiKey,
      devModeSet: parsed.devModeSet === true,
      skillEngine,
      skillEngineUserSet,
    };
  }
  if (parsed.provider === "openai-compat") {
    const network = parsed.network === "dev-vllm" ? "dev-vllm" : "ixi";
    const networkDefaults = network === "dev-vllm" ? DEFAULTS.devVllm : DEFAULTS["openai-compat"];
    return {
      ...DEFAULTS["openai-compat"],
      ...networkDefaults,
      ...parsed,
      provider: "openai-compat",
      model: normalizeIxiModel(network, parsed.model, parsed) || networkDefaults.model || DEFAULTS["openai-compat"].model,
      baseUrl: network === "dev-vllm"
        ? (parsed.baseUrl || networkDefaults.baseUrl || DEFAULTS.devVllm.baseUrl)
        : normalizeIxiBaseUrl(parsed.baseUrl || networkDefaults.baseUrl || DEFAULTS["openai-compat"].baseUrl, parsed),
      proxyUpstream: network === "dev-vllm" ? "" : normalizeIxiProxyUpstream(parsed.proxyUpstream, parsed),
      apiKey: normalizeIxiApiKey(network, parsed.apiKey, networkDefaults, parsed),
      // [사용자 요청] Think 기본 ON. 과거 기본값(false)이 저장돼 있던 사용자도 ON 으로 올린다 —
      // 사용자가 토글 버튼으로 직접 바꾼 적 있는 경우(thinkModeUserSet)에만 저장값을 존중.
      thinkMode: parsed.thinkModeUserSet === true ? parsed.thinkMode === true : true,
      thinkModeUserSet: parsed.thinkModeUserSet === true,
      thinkControlMode: normalizeIxiThinkControlMode(
        network,
        normalizeThinkControlMode(parsed.thinkControlMode || networkDefaults.thinkControlMode),
        parsed
      ),
      network,
      devModeSet: parsed.devModeSet === true,
      skillEngine,
      skillEngineUserSet,
    };
  }
  return null;
}

function normalizeSkillEngine(value) {
  value = String(value || "").trim().toLowerCase();
  if (value === "python") return "python";
  if (value === "vba") return "vba";
  return DEFAULT_SKILL_ENGINE;
}

function normalizeStoredSkillEngine(parsed) {
  const raw = String((parsed && parsed.skillEngine) || "").trim().toLowerCase();
  if (parsed && parsed.skillEngineUserSet === true) return normalizeSkillEngine(raw);
  // 0.5.10부터 기본 엔진은 VBA다. 0.5.9 이하에서 기본값처럼 저장된 "python"은
  // 새 기본값으로 올리고, 이미 VBA로 저장된 환경만 그대로 유지한다.
  if (raw === "vba") return "vba";
  return DEFAULT_SKILL_ENGINE;
}

function normalizeIxiModel(network, value, parsed) {
  // 저장 설정에 남은 옛 ixi 기본 모델(Qwen3.5)은 새 기본(Qwen3.6)으로 승격한다.
  // DEV 모달에서 명시 저장한 설정(devModeSet)만 그대로 유지. dev-vllm 네트워크는 건드리지 않는다.
  if (network === "ixi" && String(value || "") === "Qwen3.5-27B-FP8" && !(parsed && parsed.devModeSet === true)) {
    return DEFAULTS["openai-compat"].model;
  }
  return value;
}

function normalizeIxiProxyUpstream(value, parsed) {
  // 저장 설정에 남은 옛 ixi upstream 주소는 새 기본 upstream 으로 승격(DEV 명시 저장 제외).
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return DEFAULTS["openai-compat"].proxyUpstream;
  if (IXI_LEGACY_UPSTREAMS.includes(raw) && !(parsed && parsed.devModeSet === true)) {
    return DEFAULTS["openai-compat"].proxyUpstream;
  }
  return raw;
}

function normalizeIxiApiKey(network, value, networkDefaults, parsed) {
  // 옛 ixi API 키는 새 키로 승격(DEV 명시 저장 제외). dev-vllm 네트워크 키는 그대로 둔다.
  const raw = String(value || "").trim();
  const fallback = (networkDefaults && networkDefaults.apiKey) || DEFAULTS["openai-compat"].apiKey;
  if (!raw) return fallback;
  if (network === "ixi" && IXI_LEGACY_API_KEYS.includes(raw) && !(parsed && parsed.devModeSet === true)) {
    return DEFAULTS["openai-compat"].apiKey;
  }
  return raw;
}

function normalizeThinkControlMode(value) {
  if (value === "soft_switch") return value;
  if (value === "chat_template_kwargs") return value;
  return DEFAULTS["openai-compat"].thinkControlMode;
}

function normalizeIxiThinkControlMode(network, value, parsed) {
  // v4 개발 중 저장된 ixi 기본값(soft_switch)은 Qwen3.6/vLLM 기본값으로 승격한다.
  // DEV 모달에서 명시 저장한 설정만 legacy soft_switch를 유지한다.
  if (network === "ixi" && value === "soft_switch" && !(parsed && parsed.devModeSet === true)) {
    return DEFAULTS["openai-compat"].thinkControlMode;
  }
  return value;
}

function loadSettings() {
  const ixiDefault = defaultIxiSettings();

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
        // 0.4.13 개발 중 dev-vLLM이 기본값처럼 저장된 v3 설정은 새 기본값(ixi)로 교체한다.
        // 이후 사용자가 DEV 모달에서 직접 dev-vLLM을 저장하면 devModeSet=true로 유지된다.
        if (normalized.network === "dev-vllm" && normalized.devModeSet !== true) continue;
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
  updateSkillEngineToggle();
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
      thinkModeUserSet: true, // 직접 토글 — 이후 부팅에서 이 선택을 존중
    };
    saveSettings();
    toast(`Think 모드 ${settings.thinkMode ? "켜짐" : "꺼짐"}`, "success");
  };
  updateThinkToggle();
}

/* ===================================================================
   스킬 실행 엔진(0.4.13):
   - 기본 VBA: Excel 라이브 작업의 서식/수식/복붙 의미를 우선 보존한다.
   - 보조 Python: 사용자가 F7로 선택했을 때만 Python 스킬 생성/실행을 사용한다.
   =================================================================== */
function getSkillEngine() {
  return normalizeSkillEngine(settings && settings.skillEngine);
}

function setSkillEngine(engine, options = {}) {
  const next = normalizeSkillEngine(engine);
  if (settings.skillEngine === next) {
    updateSkillEngineToggle();
    return next;
  }
  settings = { ...settings, skillEngine: next, skillEngineUserSet: true };
  saveSettings();
  if (!options.silent && typeof toast === "function") {
    toast(`스킬 실행 엔진: ${SKILL_ENGINE_LABELS[next]}`, "success");
  }
  return next;
}

function toggleSkillEngine() {
  return setSkillEngine(getSkillEngine() === "python" ? "vba" : "python");
}

function updateSkillEngineToggle() {
  const btn = document.getElementById("btn-skill-engine");
  if (!btn) return;
  const engine = getSkillEngine();
  btn.classList.toggle("vba", engine === "vba");
  btn.setAttribute("aria-pressed", engine === "vba" ? "true" : "false");
  btn.title = `스킬 실행 엔진: ${SKILL_ENGINE_LABELS[engine]} (F7로 전환)`;
  const label = btn.querySelector(".engine-toggle-label");
  if (label) label.textContent = SKILL_ENGINE_LABELS[engine];
}

function setupSkillEngineToggle() {
  const btn = document.getElementById("btn-skill-engine");
  if (btn) btn.onclick = () => toggleSkillEngine();
  if (!window.__b2bSkillEngineF7Installed) {
    window.__b2bSkillEngineF7Installed = true;
    document.addEventListener("keydown", (event) => {
      if (event.key !== "F7") return;
      event.preventDefault();
      event.stopPropagation();
      toggleSkillEngine();
    }, true);
  }
  updateSkillEngineToggle();
}
