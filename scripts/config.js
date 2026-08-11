/* ===================================================================
   CONFIG
   =================================================================== */
const B2B_BUILD_STAMP = "b2b-0.7.0-20260724";
window.B2B_BUILD_STAMP = B2B_BUILD_STAMP;

// 마우스 우클릭(컨텍스트 메뉴) 전역 차단. (네이티브 셸은 WebView 설정으로도 막지만 브라우저 모드 대비)
window.addEventListener("contextmenu", (e) => { e.preventDefault(); }, true);

const IXI_VIOLET_BASE_URL = "https://e2e-ns-17786299267796664.mng-1.ip.violet.uplus.co.kr";
const IXI_SUB_VIOLET_BASE_URL = "https://canvas-ns-1727666527880704.mng.ip.violet.uplus.co.kr";
const IXI_SUB2_VIOLET_BASE_URL = "https://vlmmtp-ns-1727666527880704.mng.ip.violet.uplus.co.kr";
const IXI_OPENAI_BASE_URL = `${IXI_VIOLET_BASE_URL}/v1`;
// 옛 ixi upstream/키 — 저장된 설정(localStorage)에 남아 있으면 새 값으로 승격(마이그레이션).
const IXI_LEGACY_UPSTREAMS = ["http://canvas-ns-1727666527880704.mng.ip.violet.uplus.co.kr"];
const IXI_LEGACY_API_KEYS = ["7365676d"];

const DEFAULTS = {
  anthropic: {
    // [사용자 요청] F9 → Claude 전환 시 기본으로 채워지는 Anthropic API 키.
    apiKey: "",
    model: "claude-opus-4-8",
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
    apiKey: "khkim",
    model: "Qwen/Qwen3.6-27B-FP8",
    // 개발망 vLLM — 별도 PC(LAN)의 vLLM 서버. --api-key 를 켜고 떠 있어 Authorization: Bearer 필수.
    baseUrl: "http://192.168.219.111:8000/v1",
    fallbackBaseUrls: [],
    thinkControlMode: "chat_template_kwargs",
  },
};

// openai-compat 호출 인증 헤더. ixi 게이트웨이는 Api-Key 헤더를 보고, dev-vllm(vLLM --api-key)은
// Authorization: Bearer 만 인식한다(Api-Key 는 무시 → 401). 네트워크에 맞춰 함께 구성한다.
function openAICompatAuthHeaders(apiKey, network) {
  const key = String(apiKey || "").trim();
  const headers = { "Api-Key": key };
  if (network === "dev-vllm" && key) headers["Authorization"] = "Bearer " + key;
  return headers;
}

const OPENAI_COMPAT_FALLBACK_BASE_URLS = [
  DEFAULTS["openai-compat"].baseUrl,
  "http://127.0.0.1:8090/v1",
];

const IXI_SERVER_PRESETS = [
  { id: "main", label: "메인 서버", upstream: IXI_VIOLET_BASE_URL },
  { id: "sub", label: "서브 서버", upstream: IXI_SUB_VIOLET_BASE_URL },
  { id: "sub2", label: "서브 서버2", upstream: IXI_SUB2_VIOLET_BASE_URL },
];

const SETTINGS_KEY = "mvno_llm_settings_v4";
const SETTINGS_KEY_MIGRATE = ["mvno_llm_settings_v3", "mvno_llm_settings_v2", "mvno_llm_settings_v1"];

/* [버전 확인 2026-08-04] AX-Cell.exe 의 파일 버전(예 0.7.2.0)과 버전 서버의 version.txt 를 비교한다.

   [2026-08-04 변경] 통신은 AI 호출과 '똑같은 길'을 쓴다 — 기존 Base URL(로컬 /v1 프록시)로 보내고,
   서버가 X-B2B-Vllm-Base 헤더의 주소로 전달한다. 그래서 버전 확인용으로 새로 정할 값은
   **실제 주소 하나뿐**이다(버전 서버는 AI 서버와 다른 곳에 있으므로).
     프론트 fetch(baseUrl + "/version")  →  serve_b2b /v1/* 프록시  →  <실제주소>/v1/version
   버전 서버(versionTest)가 /v1/version 별칭을 받아주는 이유가 이것이다.

   저장은 AI 설정과 별도 키로 한다 — AI 쪽 normalizeSettings 가 모르는 키를 버려서
   같이 넣으면 저장이 남지 않는다. */
const VERSION_CHECK_KEY = "axcell_version_check_v1";
// 기본 실제주소 — 사용자가 F9 설정에서 비워 두면 이 주소로 버전을 확인한다(2026-08-11 지정).
const VERSION_CHECK_UPSTREAM_URL = "https://version-ns-17786299267796664.mng-1.ip.violet.uplus.co.kr";
// 인증 키는 코드에 박지 않는다 — 설정(F9)에서 받아 이 PC 에만 저장한다.
// 비워 두면 AI 설정의 키를 그대로 쓴다(같은 게이트웨이면 그것으로 통과).
const VERSION_CHECK_DEFAULTS = { upstreamUrl: VERSION_CHECK_UPSTREAM_URL, apiKey: "" };

function loadVersionCheckSettings() {
  try {
    const raw = localStorage.getItem(VERSION_CHECK_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      // baseUrl 은 0.7.2 초기 구현에서 쓰던 칸 — 지금은 기존 AI Base URL 을 그대로 쓴다.
      // 예전 저장값에 실제 주소가 baseUrl 쪽에만 남아 있으면 그걸 살려 준다(설정 유실 방지).
      // 저장값이 비어 있으면 기본 주소로 — '한 번 저장했다가 지운' 사용자도 기본값으로 돌아온다.
      const saved = String(parsed.upstreamUrl || parsed.baseUrl || "").trim();
      return {
        upstreamUrl: saved || VERSION_CHECK_UPSTREAM_URL,
        apiKey: String(parsed.apiKey || "").trim(),
      };
    }
  } catch {}
  return { ...VERSION_CHECK_DEFAULTS };
}

/* 실제주소 칸에 무엇을 넣든 '버전 서버가 받는 완성 주소'로 만들어 준다.
   AI 호출과 같은 길이라 로컬 /v1 프록시가 경로를 그대로 붙여 <실제주소>/v1/version 으로 보낸다.
   사용자가 주소 뒤에 /v1 이나 /version 을 이미 붙여 놨어도 두 번 붙지 않게 잘라낸다.
   (versionTest/main.py 는 /version 과 /v1/version 을 모두 받는다 — curl 로도 그대로 확인 가능) */
function versionCheckUpstreamBase(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\/+$/, "")
    .replace(/\/v1\/version$/i, "")
    .replace(/\/version$/i, "")
    .replace(/\/v1$/i, "");
}

function versionCheckUpstreamEndpoint(raw) {
  const base = versionCheckUpstreamBase(raw);
  return base ? base + "/v1/version" : "";
}

function saveVersionCheckSettings(next) {
  // 저장은 '기본 주소' 형태로 통일한다(끝의 /v1, /version 은 떼어낸다) — 화면에 다시 채울 때도 깔끔하고,
  // 호출 직전에 /v1/version 을 붙이므로 중복될 일이 없다.
  const clean = {
    upstreamUrl: versionCheckUpstreamBase((next && next.upstreamUrl) || ""),
    apiKey: String((next && next.apiKey) || "").trim(),
  };
  try { localStorage.setItem(VERSION_CHECK_KEY, JSON.stringify(clean)); } catch {}
  return clean;
}

/* '0.7.2' 와 '0.7.2.0' 은 같은 버전이다. 문자열 그대로 비교하면 다르다고 나와서
   멀쩡한 사용자에게 업데이트 안내가 뜬다. 서버(serve_b2b._normalize_version_text /
   versionTest.normalize_version)와 같은 규칙 — 한쪽만 바꾸면 안 된다. */
function normalizeVersionText(text) {
  const s = String(text == null ? "" : text).trim().replace(/^[vV]/, "").trim();
  if (!s) return "";
  const parts = s.split(".").filter(p => p !== "");
  if (!parts.length || !parts.every(p => /^\d+$/.test(p))) return "";
  return parts.concat(["0", "0", "0", "0"]).slice(0, 4).map(p => String(parseInt(p, 10))).join(".");
}

/* 버전 확인 실행. 반환 {ok, current, latest, match, checkedUrl, upstreamUrl, error}
   현재 버전은 백엔드(exe 파일 속성)에서, 최신 버전은 기존 프록시를 통해 버전 서버에서 받는다.
   upstreamUrl 은 버전 서버가 실제로 받은 완성 주소 — 그대로 curl 로 확인할 수 있다. */
async function runVersionCheck(cfg) {
  const conf = cfg || loadVersionCheckSettings();
  const out = { ok: false, current: null, latest: null, match: null, checkedUrl: "", upstreamUrl: "", authHeader: "", error: "" };

  // 1) 지금 이 AX-Cell 의 버전 — 배포본이면 exe 파일 버전, 소스 실행이면 CURRENT_VERSION.
  try {
    const r = await fetch("/api/app/version");
    out.current = await r.json();
  } catch (err) {
    out.error = `현재 버전을 읽지 못했습니다: ${err.message || err}`;
    return out;
  }

  if (!conf.upstreamUrl) {
    out.error = "버전 서버의 실제 주소를 입력해 주세요.";
    return out;
  }

  // 2) 최신 버전 — AI 호출과 같은 길(기존 Base URL → /v1 프록시 → 실제 주소).
  const proxyBase = String(
    (typeof settings === "object" && settings && settings.provider === "openai-compat" && settings.baseUrl)
      || (DEFAULTS && DEFAULTS["openai-compat"] && DEFAULTS["openai-compat"].baseUrl)
      || `${location.origin}/v1`
  ).replace(/\/$/, "");
  const url = proxyBase + "/version";
  // 실제로 버전 서버가 받는 주소. 사용자가 그대로 curl 로 확인할 수 있게 완성형으로 만든다.
  // (LLM 호출과 같은 규칙 — 로컬 /v1 프록시가 경로를 그대로 붙여 <실제주소>/v1/version 으로 보낸다)
  out.upstreamUrl = versionCheckUpstreamEndpoint(conf.upstreamUrl);
  out.checkedUrl = `${url}  →  ${out.upstreamUrl}`;
  // [인증 2026-08-11] 게이트웨이가 Api-Key 헤더를 요구한다(curl 실측: 헤더 없이는 통과 못 함).
  // AI 호출이 쓰는 것과 같은 헤더를 그대로 붙인다 — 프록시(serve_b2b)가 api-key 를 그대로 전달한다.
  // 버전 서버 키가 AI 키와 다를 수 있어 설정에 따로 받고, 비어 있으면 AI 키로 폴백한다.
  const _verKey = String(conf.apiKey || "").trim()
    || String((typeof settings === "object" && settings && settings.apiKey) || "").trim()
    || String((DEFAULTS && DEFAULTS["openai-compat"] && DEFAULTS["openai-compat"].apiKey) || "").trim();
  const _authHeaders = (typeof openAICompatAuthHeaders === "function")
    ? openAICompatAuthHeaders(_verKey, (typeof settings === "object" && settings && settings.network) || "ixi")
    : (_verKey ? { "Api-Key": _verKey } : {});
  out.authHeader = _verKey ? "Api-Key" : "";
  let body = "";
  try {
    const resp = await fetch(url, {
      headers: { accept: "application/json", "X-B2B-Vllm-Base": conf.upstreamUrl, ..._authHeaders },
    });
    body = (await resp.text()).trim();
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${body.slice(0, 120)}`);
  } catch (err) {
    out.error = `버전 서버에 연결하지 못했습니다: ${err.message || err}`;
    return out;
  }

  // 우리 서버(JSON)든 평문 version.txt(쉐어포인트 등)든 받아준다.
  let latestRaw = "";
  let updatedAt = null;
  try {
    const data = JSON.parse(body);
    if (data && typeof data === "object") {
      if (!data.ok && data.error) { out.error = String(data.error); return out; }
      latestRaw = data.version || data.normalized || "";
      updatedAt = data.updatedAt || null;
    }
  } catch {
    latestRaw = (body.split("\n")[0] || "").trim();
  }
  const latestNorm = normalizeVersionText(latestRaw);
  if (!latestNorm) {
    out.error = `버전 형식이 아닙니다: ${JSON.stringify(latestRaw.slice(0, 60))}`;
    return out;
  }

  out.latest = { version: latestRaw, normalized: latestNorm, updatedAt };
  out.ok = true;
  const curNorm = (out.current && out.current.normalized) || "";
  out.match = !!curNorm && curNorm === latestNorm;
  return out;
}
const DEFAULT_SKILL_ENGINE = "python";
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
        ? normalizeDevVllmBaseUrl(parsed.baseUrl || networkDefaults.baseUrl || DEFAULTS.devVllm.baseUrl)
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
  // 0.5.18부터 기본 엔진은 Python(COM)이다. 사용자가 직접 고른 적이 없으면(비 user-set) 항상 현재 기본값을
  // 따른다 — 과거 기본값(VBA)으로 저장돼 있어도 새 기본(Python)으로 올린다. 명시적으로 VBA를 고른 사용자만 유지.
  return DEFAULT_SKILL_ENGINE;
}

// 옛 개발망 vLLM(WSL 8016 계열) 잔재 — 서버가 192.168.219.111:8000(다른 PC)으로 이전됐다.
// 저장 설정이 죽은 주소·키·모델을 물고 있으면 devModeSet 여부와 무관하게 새 값으로 승격한다.
const DEV_VLLM_LEGACY_BASE_URLS = [
  "http://localhost:8016/v1",
  "http://127.0.0.1:8016/v1",
  "http://192.168.219.105:8016/v1",
];
function normalizeDevVllmBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw || DEV_VLLM_LEGACY_BASE_URLS.includes(raw)) return DEFAULTS.devVllm.baseUrl;
  return raw;
}

function normalizeIxiModel(network, value, parsed) {
  // 저장 설정에 남은 옛 ixi 기본 모델(Qwen3.5)은 새 기본(Qwen3.6)으로 승격한다.
  // DEV 모달에서 명시 저장한 설정(devModeSet)만 그대로 유지.
  if (network === "ixi" && String(value || "") === "Qwen3.5-27B-FP8" && !(parsed && parsed.devModeSet === true)) {
    return DEFAULTS["openai-compat"].model;
  }
  // dev-vllm: 옛 서버 모델명은 새 서버에 없어 호출이 전부 실패하므로 무조건 승격.
  if (network === "dev-vllm" && (!value || String(value) === "Qwen3.5-27B-FP8")) {
    return DEFAULTS.devVllm.model;
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

function getIxiServerPresetId(upstream) {
  const raw = String(upstream || DEFAULTS["openai-compat"].proxyUpstream || "").trim().replace(/\/$/, "");
  const found = IXI_SERVER_PRESETS.find(p => p.upstream.replace(/\/$/, "") === raw);
  return found ? found.id : "main";
}

function getIxiServerPresetById(id) {
  return IXI_SERVER_PRESETS.find(p => p.id === id) || IXI_SERVER_PRESETS[0];
}

function getIxiServerLabel(upstream) {
  return getIxiServerPresetById(getIxiServerPresetId(upstream)).label;
}

function normalizeIxiApiKey(network, value, networkDefaults, parsed) {
  // 옛 ixi API 키는 새 키로 승격(DEV 명시 저장 제외).
  const raw = String(value || "").trim();
  const fallback = (networkDefaults && networkDefaults.apiKey) || DEFAULTS["openai-compat"].apiKey;
  if (!raw) return fallback;
  if (network === "ixi" && IXI_LEGACY_API_KEYS.includes(raw) && !(parsed && parsed.devModeSet === true)) {
    return DEFAULTS["openai-compat"].apiKey;
  }
  // dev-vllm: 옛 서버 키(7365676d)는 새 서버가 거부하므로 무조건 새 키로 승격.
  if (network === "dev-vllm" && raw === "7365676d") {
    return DEFAULTS.devVllm.apiKey;
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
    el.textContent = settings.network === "dev-vllm"
      ? "AI: 개발망 vLLM"
      : `AI: ${getIxiServerLabel(settings.proxyUpstream)}`;
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

