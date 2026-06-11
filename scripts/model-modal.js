/* ===================================================================
   AI MODEL SETTINGS
   =================================================================== */
$("btn-settings").onclick = () => openSettingsModal(false);

document.addEventListener("keydown", (e) => {
  if (e.key === "F9") {
    e.preventDefault();
    openSettingsModal(true);
  }
});

const CLAUDE_MODELS = [
  "claude-opus-4-7",
  "claude-opus-4-7[1m]",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-5-20250929",
];

function openSettingsModal(devMode) {
  const modal = $("modal");
  const activeProvider = devMode ? (settings.provider || "openai-compat") : "openai-compat";
  const activeClaude = activeProvider === "anthropic";
  const activeDevVllm = !activeClaude && settings.network === "dev-vllm";

  const openaiDefaults = activeDevVllm ? DEFAULTS.devVllm : DEFAULTS["openai-compat"];
  const ixiUrl = settings.provider === "openai-compat"
    ? (settings.baseUrl || DEFAULTS["openai-compat"].baseUrl)
    : openaiDefaults.baseUrl;
  const ixiKey = settings.provider === "openai-compat"
    ? (settings.apiKey || DEFAULTS["openai-compat"].apiKey)
    : openaiDefaults.apiKey;
  const ixiThinkControlMode = settings.provider === "openai-compat"
    ? (settings.thinkControlMode || DEFAULTS["openai-compat"].thinkControlMode)
    : openaiDefaults.thinkControlMode;
  const ixiUpstream = (settings.provider === "openai-compat" && settings.proxyUpstream)
    ? settings.proxyUpstream
    : DEFAULTS["openai-compat"].proxyUpstream;

  const claudeKey = settings.provider === "anthropic"
    ? (settings.apiKey || DEFAULTS.anthropic.apiKey)
    : DEFAULTS.anthropic.apiKey;
  const claudeModel = settings.provider === "anthropic"
    ? (settings.model || DEFAULTS.anthropic.model)
    : DEFAULTS.anthropic.model;
  const claudeUrl = settings.provider === "anthropic"
    ? (settings.baseUrl || DEFAULTS.anthropic.baseUrl)
    : DEFAULTS.anthropic.baseUrl;

  modal.innerHTML = `
    <h3>AI 연결 설정${devMode ? ' <span style="font-size:11px;color:#FF0080;background:#FFE0F2;padding:2px 8px;border-radius:8px;font-weight:600;margin-left:6px;">DEV</span>' : ''}</h3>
    <div style="font-size:12px; color:#666; margin-bottom:12px">
      ${devMode ? '개발자 옵션입니다. 기본 연결은 내부망 ixi이며, 필요할 때 개발망 vLLM 또는 Claude Opus 4.7로 전환할 수 있습니다.' : '내부망 ixi 호환 서버와 연결합니다.'}
    </div>

    ${devMode ? `
    <div class="row" style="gap:16px; margin-bottom:14px">
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
        <input type="radio" name="provider" value="openai-compat" data-network="ixi" ${!activeClaude && !activeDevVllm ? "checked" : ""}>
        <span>ixi 모델</span>
      </label>
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
        <input type="radio" name="provider" value="openai-compat" data-network="dev-vllm" ${activeDevVllm ? "checked" : ""}>
        <span>개발망 vLLM</span>
      </label>
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
        <input type="radio" name="provider" value="anthropic" ${activeClaude ? "checked" : ""}>
        <span>Claude Opus 4.7</span>
      </label>
    </div>
    ` : ""}

    <div id="group-openai" style="${devMode && activeClaude ? "display:none" : ""}">
      <label style="font-size:11.5px; color:#666">Base URL (로컬 /v1 프록시 → Violet 전달)</label>
      <input type="text" id="set-o-url" value="${escapeHtml(ixiUrl)}" />
      ${devMode ? `<div style="font-size:11px; color:#777; margin:-6px 0 8px">
        개발망 vLLM은 Windows에서 <code>http://localhost:8016/v1</code>을 먼저 사용하고, 실패하면 <code>http://192.168.219.105:8016/v1</code>을 자동 시도합니다.
      </div>` : ""}
      ${devMode ? `
      <label style="font-size:11.5px; color:#666">Violet/vLLM 실제 주소 (ixi 프록시 전달 대상)</label>
      <input type="text" id="set-o-upstream" value="${escapeHtml(ixiUpstream)}" placeholder="http://...violet.uplus.co.kr" />
      <div style="font-size:11px; color:#777; margin:-6px 0 8px">
        legacy 로컬 프록시를 강제로 쓸 때만 사용합니다. 기본 ixi 호출은 프록시 없이 Violet/vLLM으로 직접 전송됩니다.
      </div>
      ` : ""}
      <label style="font-size:11.5px; color:#666">API Key</label>
      <input type="text" id="set-o-key" value="${escapeHtml(ixiKey)}" />
      <label style="font-size:11.5px; color:#666">Think 제어 방식</label>
      <select id="set-o-think-control">
        <option value="chat_template_kwargs" ${ixiThinkControlMode === "chat_template_kwargs" ? "selected" : ""}>Qwen3.6/vLLM: chat_template_kwargs.enable_thinking</option>
        ${devMode ? `<option value="soft_switch" ${ixiThinkControlMode === "soft_switch" ? "selected" : ""}>Qwen3.5 legacy: /think, /no_think</option>` : ""}
      </select>
    </div>

    ${devMode ? `
    <div id="group-claude" style="${activeClaude ? "" : "display:none"}">
      <label style="font-size:11.5px; color:#666">Anthropic API Key</label>
      <input type="password" id="set-c-key" placeholder="sk-ant-..." value="${escapeHtml(claudeKey)}" autocomplete="off" />
      <label style="font-size:11.5px; color:#666">모델</label>
      <select id="set-c-model">
        ${CLAUDE_MODELS.map(m => `<option value="${escapeHtml(m)}" ${m === claudeModel ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}
      </select>
      <label style="font-size:11.5px; color:#666">Base URL</label>
      <input type="text" id="set-c-url" value="${escapeHtml(claudeUrl)}" />
    </div>
    ` : ""}

    <div class="row" style="margin-top:14px">
      <button class="btn-secondary" id="btn-test">연결 테스트</button>
      <button class="btn-secondary" id="modal-cancel">취소</button>
      <button class="btn-primary" id="modal-save">저장</button>
    </div>
    <div id="test-result" style="margin-top:8px; font-size:11.5px"></div>
  `;
  $("modal-bg").classList.add("show");

  if (devMode) {
    document.querySelectorAll('input[name="provider"]').forEach(r => {
      r.onchange = () => {
        if (!r.checked) return;
        const isClaude = r.value === "anthropic";
        $("group-openai").style.display = isClaude ? "none" : "";
        $("group-claude").style.display = isClaude ? "" : "none";
        if (!isClaude && r.dataset.network === "dev-vllm") {
          $("set-o-url").value = DEFAULTS.devVllm.baseUrl;
          $("set-o-key").value = DEFAULTS.devVllm.apiKey;
          $("set-o-think-control").value = DEFAULTS.devVllm.thinkControlMode;
        } else if (!isClaude && r.dataset.network !== "dev-vllm") {
          $("set-o-url").value = DEFAULTS["openai-compat"].baseUrl;
          $("set-o-key").value = DEFAULTS["openai-compat"].apiKey;
          $("set-o-think-control").value = DEFAULTS["openai-compat"].thinkControlMode;
        }
      };
    });
  }

  const readForm = () => {
    const provider = devMode
      ? (document.querySelector('input[name="provider"]:checked')?.value || "openai-compat")
      : "openai-compat";
    const network = devMode
      ? (document.querySelector('input[name="provider"]:checked')?.dataset.network || "ixi")
      : "ixi";
    if (provider === "anthropic") {
      return {
        provider: "anthropic",
        baseUrl: $("set-c-url").value.trim() || DEFAULTS.anthropic.baseUrl,
        apiKey: $("set-c-key").value.trim() || DEFAULTS.anthropic.apiKey,
        model: $("set-c-model").value || DEFAULTS.anthropic.model,
        devModeSet: devMode === true,
      };
    }
    return {
      provider: "openai-compat",
      network,
      baseUrl: $("set-o-url").value.trim() || (network === "dev-vllm" ? DEFAULTS.devVllm.baseUrl : DEFAULTS["openai-compat"].baseUrl),
      proxyUpstream: ($("set-o-upstream") ? $("set-o-upstream").value.trim() : "") || DEFAULTS["openai-compat"].proxyUpstream,
      apiKey: $("set-o-key").value.trim() || (network === "dev-vllm" ? DEFAULTS.devVllm.apiKey : DEFAULTS["openai-compat"].apiKey),
      model: network === "dev-vllm" ? DEFAULTS.devVllm.model : DEFAULTS["openai-compat"].model,
      thinkMode: settings.thinkMode === true,
      thinkModeUserSet: settings.thinkModeUserSet === true, // 토글 선택 이력 보존(부팅 시 기본 ON 마이그레이션과 구분)
      thinkControlMode: normalizeThinkControlMode($("set-o-think-control").value),
      devModeSet: devMode === true,
    };
  };

  $("btn-test").onclick = async () => {
    const form = readForm();
    const res = $("test-result");
    res.innerHTML = '<span class="loader"></span> 연결 테스트 중...';
    try {
      if (form.provider === "anthropic") {
        if (!form.apiKey) throw new Error("Anthropic API Key가 비어 있습니다.");
        const r = await fetch(form.baseUrl.replace(/\/$/, "") + "/messages", {
          method: "POST",
          headers: {
            "x-api-key": form.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: form.model,
            max_tokens: 8,
            messages: [{ role: "user", content: "ping" }],
          }),
        });
        if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
        res.innerHTML = `<span style="color:#28a745">Claude 연결 성공 · ${escapeHtml(form.model)}</span>`;
        return;
      }

      const { resp: r, url } = await fetchOpenAICompat("/models", form.baseUrl.replace(/\/$/, ""), {
        method: "GET",
        headers: { "Api-Key": form.apiKey },
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
      const data = await r.json();
      const count = Array.isArray(data.data) ? data.data.length : 0;
      res.innerHTML = `<span style="color:#28a745">연결 성공 · ${count}개 모델 확인 · ${escapeHtml(url.replace(/\/models$/, ""))}</span>`;
    } catch (err) {
      res.innerHTML = `<span style="color:#dc3545">실패: ${escapeHtml(err.message)}</span>`;
    }
  };

  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  $("modal-save").onclick = () => {
    const form = readForm();
    if (form.provider === "anthropic" && !form.apiKey) {
      toast("Claude API Key가 비어 있습니다.", "error");
      return;
    }
    settings = {
      ...settings,
      ...form,
      skillEngine: typeof normalizeSkillEngine === "function" ? normalizeSkillEngine(settings.skillEngine) : (settings.skillEngine || "python"),
    };
    saveSettings();
    $("modal-bg").classList.remove("show");
    toast("설정을 저장했습니다.", "success");
  };
}
