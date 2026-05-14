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

  const ixiUrl = settings.provider === "openai-compat"
    ? (settings.baseUrl || DEFAULTS["openai-compat"].baseUrl)
    : DEFAULTS["openai-compat"].baseUrl;
  const ixiKey = settings.provider === "openai-compat"
    ? (settings.apiKey || DEFAULTS["openai-compat"].apiKey)
    : DEFAULTS["openai-compat"].apiKey;
  const ixiThinkControlMode = settings.provider === "openai-compat"
    ? (settings.thinkControlMode || DEFAULTS["openai-compat"].thinkControlMode)
    : DEFAULTS["openai-compat"].thinkControlMode;

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
      ${devMode ? '개발자 옵션입니다. 기본 연결은 내부망 ixi이며, 필요할 때 Claude Opus 4.7로 전환할 수 있습니다.' : '내부망 ixi 호환 서버와 연결합니다.'}
    </div>

    ${devMode ? `
    <div class="row" style="gap:16px; margin-bottom:14px">
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
        <input type="radio" name="provider" value="openai-compat" ${!activeClaude ? "checked" : ""}>
        <span>ixi 모델</span>
      </label>
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer">
        <input type="radio" name="provider" value="anthropic" ${activeClaude ? "checked" : ""}>
        <span>Claude Opus 4.7</span>
      </label>
    </div>
    ` : ""}

    <div id="group-openai" style="${devMode && activeClaude ? "display:none" : ""}">
      <label style="font-size:11.5px; color:#666">Base URL (exe 로컬 프록시 /v1)</label>
      <input type="text" id="set-o-url" value="${escapeHtml(ixiUrl)}" />
      <label style="font-size:11.5px; color:#666">API Key</label>
      <input type="text" id="set-o-key" value="${escapeHtml(ixiKey)}" />
      <label style="font-size:11.5px; color:#666">Think 제어 방식</label>
      <select id="set-o-think-control">
        <option value="soft_switch" ${ixiThinkControlMode === "soft_switch" ? "selected" : ""}>Qwen3.5: /think, /no_think</option>
        <option value="chat_template_kwargs" ${ixiThinkControlMode === "chat_template_kwargs" ? "selected" : ""}>Qwen3.6/vLLM: chat_template_kwargs.enable_thinking</option>
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
      };
    });
  }

  const readForm = () => {
    const provider = devMode
      ? (document.querySelector('input[name="provider"]:checked')?.value || "openai-compat")
      : "openai-compat";
    if (provider === "anthropic") {
      return {
        provider: "anthropic",
        baseUrl: $("set-c-url").value.trim() || DEFAULTS.anthropic.baseUrl,
        apiKey: $("set-c-key").value.trim() || DEFAULTS.anthropic.apiKey,
        model: $("set-c-model").value || DEFAULTS.anthropic.model,
        devModeSet: true,
      };
    }
    return {
      provider: "openai-compat",
      baseUrl: $("set-o-url").value.trim() || DEFAULTS["openai-compat"].baseUrl,
      apiKey: $("set-o-key").value.trim() || DEFAULTS["openai-compat"].apiKey,
      model: DEFAULTS["openai-compat"].model,
      thinkMode: settings.thinkMode === true,
      thinkControlMode: normalizeThinkControlMode($("set-o-think-control").value),
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
    settings = form;
    saveSettings();
    $("modal-bg").classList.remove("show");
    toast("설정을 저장했습니다.", "success");
  };
}
