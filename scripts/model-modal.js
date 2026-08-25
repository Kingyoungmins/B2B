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
  // Opus 4.8 은 1M 컨텍스트가 기본 내장이라 별도 [1m] 변형이 필요 없다(그 접미사는 API에 그대로 가면 404).
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-7[1m]",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-5-20250929",
];

function openUserSettingsModal() {
  const modal = $("modal");
  const selectedId = getIxiServerPresetId(settings.proxyUpstream);
  modal.innerHTML = `
    <h3>AI 연결 설정</h3>
    <div style="font-size:12px; color:#666; margin-bottom:12px">
      사용할 AI 서버를 선택해 주세요. 보통은 메인 서버를 사용하면 됩니다.
    </div>

    <div id="ixi-server-options" style="display:grid; gap:8px; margin:8px 0 14px">
      ${IXI_SERVER_PRESETS.map(p => `
        <label style="display:flex; align-items:center; justify-content:flex-start; gap:10px; min-height:48px; padding:11px 12px; border:1px solid #e4dceb; border-radius:8px; cursor:pointer; background:${p.id === selectedId ? "#fff0fa" : "#fff"}">
          <input type="checkbox" name="ixi-server" value="${escapeHtml(p.id)}" ${p.id === selectedId ? "checked" : ""} style="width:16px; height:16px; flex:0 0 16px; margin:0; padding:0">
          <span style="font-weight:700; white-space:nowrap; line-height:1.2">${escapeHtml(p.label)}</span>
        </label>
      `).join("")}
    </div>

    <div class="row" style="margin-top:14px">
      <button class="btn-secondary" id="btn-test">연결 테스트</button>
      <button class="btn-secondary" id="modal-cancel">취소</button>
      <button class="btn-primary" id="modal-save">저장</button>
    </div>
    <div id="test-result" style="margin-top:8px; font-size:11.5px"></div>
  `;
  $("modal-bg").classList.add("show");

  const refreshServerCards = () => {
    document.querySelectorAll('#ixi-server-options label').forEach(label => {
      const input = label.querySelector('input[name="ixi-server"]');
      label.style.background = input && input.checked ? "#fff0fa" : "#fff";
    });
  };
  document.querySelectorAll('input[name="ixi-server"]').forEach(box => {
    box.onchange = () => {
      if (box.checked) {
        document.querySelectorAll('input[name="ixi-server"]').forEach(other => {
          if (other !== box) other.checked = false;
        });
      } else if (!document.querySelector('input[name="ixi-server"]:checked')) {
        box.checked = true;
      }
      refreshServerCards();
    };
  });

  const readServerForm = () => {
    const checked = document.querySelector('input[name="ixi-server"]:checked');
    const preset = getIxiServerPresetById(checked ? checked.value : "main");
    return {
      provider: "openai-compat",
      network: "ixi",
      baseUrl: DEFAULTS["openai-compat"].baseUrl,
      proxyUpstream: preset.upstream,
      apiKey: DEFAULTS["openai-compat"].apiKey,
      model: DEFAULTS["openai-compat"].model,
      thinkMode: settings.thinkMode === true,
      thinkModeUserSet: settings.thinkModeUserSet === true,
      thinkControlMode: DEFAULTS["openai-compat"].thinkControlMode,
      devModeSet: false,
    };
  };

  $("btn-test").onclick = async () => {
    const form = readServerForm();
    const res = $("test-result");
    res.innerHTML = '<span class="loader"></span> 연결 테스트 중...';
    try {
      const base = String(form.baseUrl || DEFAULTS["openai-compat"].baseUrl).replace(/\/$/, "");
      const r = await fetch(base + "/models", {
        method: "GET",
        headers: {
          "Api-Key": form.apiKey,
          "X-B2B-Vllm-Base": form.proxyUpstream,
        },
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
      const data = await r.json();
      const count = Array.isArray(data.data) ? data.data.length : 0;
      res.innerHTML = `<span style="color:#28a745">연결 성공 · ${escapeHtml(getIxiServerLabel(form.proxyUpstream))} · ${count}개 모델 확인</span>`;
    } catch (err) {
      res.innerHTML = `<span style="color:#dc3545">실패: ${escapeHtml(err.message)}</span>`;
    }
  };

  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  $("modal-save").onclick = () => {
    const form = readServerForm();
    settings = {
      ...settings,
      ...form,
      skillEngine: typeof normalizeSkillEngine === "function" ? normalizeSkillEngine(settings.skillEngine) : (settings.skillEngine || "vba"),
      skillEngineUserSet: settings.skillEngineUserSet === true,
    };
    saveSettings();
    $("modal-bg").classList.remove("show");
    toast(`${getIxiServerLabel(form.proxyUpstream)}로 저장했습니다.`, "success");
  };
}

function openSettingsModal(devMode) {
  if (!devMode) return openUserSettingsModal();

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
  // [버전 확인] AI 설정과 별도 저장(다른 서버라서). DEV 모달에서만 노출한다.
  const verCfg = (typeof loadVersionCheckSettings === "function")
    ? loadVersionCheckSettings() : { baseUrl: "", upstreamUrl: "" };

  modal.innerHTML = `
    <h3>AI 연결 설정${devMode ? ' <span style="font-size:11px;color:#2684FF;background:#DCEBFD;padding:2px 8px;border-radius:8px;font-weight:600;margin-left:6px;">DEV</span>' : ''}</h3>
    <div style="font-size:12px; color:#666; margin-bottom:12px">
      ${devMode ? '개발자 옵션입니다. 기본 연결은 내부망 ixi이며, 필요할 때 개발망 vLLM 또는 Claude Opus 4.8로 전환할 수 있습니다.' : '내부망 ixi 호환 서버와 연결합니다.'}
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
        <span>Claude Opus 4.8</span>
      </label>
    </div>
    ` : ""}

    <div id="group-openai" style="${devMode && activeClaude ? "display:none" : ""}">
      <label style="font-size:11.5px; color:#666">Base URL (로컬 /v1 프록시 → Violet 전달)</label>
      <input type="text" id="set-o-url" value="${escapeHtml(ixiUrl)}" />
      ${devMode ? `<div style="font-size:11px; color:#777; margin:-6px 0 8px">
        개발망 vLLM은 별도 PC의 <code>http://192.168.219.111:8000/v1</code>(Qwen3.6-27B-FP8)로 직접 연결합니다.
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
      <div class="row" style="gap:6px; align-items:center">
        <input type="password" id="set-c-key" placeholder="sk-ant-..." value="${escapeHtml(claudeKey)}" autocomplete="off" style="flex:1" />
        <button class="btn-secondary" id="btn-load-local-key" type="button"
          title="개발 PC 의 keys.local.json(git 제외)에서 키를 읽어 채웁니다">🔑 저장된 키</button>
      </div>
      <label style="font-size:11.5px; color:#666">모델</label>
      <select id="set-c-model">
        ${CLAUDE_MODELS.map(m => `<option value="${escapeHtml(m)}" ${m === claudeModel ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}
      </select>
      <label style="font-size:11.5px; color:#666">Base URL</label>
      <input type="text" id="set-c-url" value="${escapeHtml(claudeUrl)}" />
    </div>
    ` : ""}

    ${devMode ? `
    <div style="margin-top:16px; padding-top:14px; border-top:1px solid #eee">
      <div style="font-weight:700; font-size:12.5px; margin-bottom:2px">버전 확인</div>
      <div style="font-size:11px; color:#777; margin-bottom:8px">
        지금 AX-Cell 의 파일 버전과 버전 서버의 최신 버전을 비교합니다.
        (지금은 확인만 — 안내창은 배포 전에 붙일 예정)
      </div>
      <label style="font-size:11.5px; color:#666">버전 서버 실제 주소</label>
      <input type="text" id="set-ver-upstream" value="${escapeHtml(verCfg.upstreamUrl)}"
             placeholder="${escapeHtml(typeof VERSION_CHECK_UPSTREAM_URL === "string" ? VERSION_CHECK_UPSTREAM_URL : "http://10.0.0.5:8100")}" />
      <div style="font-size:11px; color:#777; margin:-6px 0 8px">
        AI 호출과 같은 길(위 Base URL → 로컬 /v1 프록시)로 나갑니다. 버전 서버만 다른 곳이라
        실제 주소만 여기서 정합니다.
      </div>
      <label style="font-size:11.5px; color:#666">인증 키 (Api-Key)</label>
      <input type="text" id="set-ver-apikey" value="${escapeHtml(verCfg.apiKey || "")}"
             placeholder="${escapeHtml(typeof VERSION_CHECK_API_KEY === "string" ? VERSION_CHECK_API_KEY : "")}" />
      <div style="font-size:11px; color:#777; margin:-6px 0 8px">
        게이트웨이가 Api-Key 헤더를 요구합니다. 기본값이 채워져 있으니 그대로 두시면 되고,
        키가 바뀌면 여기서 고치면 됩니다(바꾼 값은 이 PC 에만 저장됩니다).
      </div>
      <div class="row" style="margin-top:6px; gap:8px">
        <button class="btn-secondary" id="btn-version-check">버전 확인</button>
        <button class="btn-secondary" id="btn-log-dashboard" title="수집 서버에 쌓인 사용 기록(누가·언제·체류·스킬·오류)을 봅니다">📊 관리 대시보드</button>
      </div>
      <div id="version-result" style="margin-top:8px; font-size:11.5px"></div>
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
        headers: openAICompatAuthHeaders(form.apiKey, form.network),
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
      const data = await r.json();
      const count = Array.isArray(data.data) ? data.data.length : 0;
      res.innerHTML = `<span style="color:#28a745">연결 성공 · ${count}개 모델 확인 · ${escapeHtml(url.replace(/\/models$/, ""))}</span>`;
    } catch (err) {
      res.innerHTML = `<span style="color:#dc3545">실패: ${escapeHtml(err.message)}</span>`;
    }
  };

  // [편의 2026-08-24] Claude 키를 매번 복붙하지 않게 — 로컬 파일(keys.local.json, git 제외)에서
  // 버튼 한 번으로 채운다. 파일이 없는 PC(배포 VM 등)에서는 안내만 하고 아무것도 안 바꾼다.
  if (devMode && $("btn-load-local-key")) {
    $("btn-load-local-key").onclick = async () => {
      try {
        const r = await fetch("/api/local-keys");
        const d = await r.json();
        if (d && d.ok && d.anthropicApiKey) {
          $("set-c-key").value = d.anthropicApiKey;
          if (typeof toast === "function") toast("저장된 키를 채웠습니다. [저장]을 눌러야 적용됩니다.", "success");
        } else {
          if (typeof toast === "function") toast((d && d.error) || "저장된 키가 없습니다.", "error");
        }
      } catch (err) {
        if (typeof toast === "function") toast("키를 읽지 못했습니다: " + (err && err.message ? err.message : err), "error");
      }
    };
  }
  // [관리 대시보드 2026-08-24] 수집 서버(보안망) 데이터를 로컬 프록시(/api/logdash)로 보는 페이지.
  // 페이지 자체는 이 백엔드가 서빙하므로 same-origin — 게이트웨이 헤더 문제가 없다.
  // 위 '버전 서버 주소'(= log_sync 가 쓰는 그 주소)가 데이터 원천이라 이 자리에 둔다.
  if (devMode && $("btn-log-dashboard")) {
    $("btn-log-dashboard").onclick = () => {
      window.open("dashboard.html", "_blank", "noopener");
    };
  }
  // [버전 확인] 지금 AX-Cell 파일 버전 vs 버전 서버의 최신 버전. 확인만 하고 아무것도 강제하지 않는다.
  if (devMode && $("btn-version-check")) {
    $("btn-version-check").onclick = async () => {
      const res = $("version-result");
      // 누를 때 주소를 같이 저장 — 다음에 또 입력하지 않게.
      // 칸을 비워 뒀으면 기본 주소로 확인한다(입력 없이도 바로 동작).
      const _typed = String($("set-ver-upstream").value || "").trim();
      const cfg = saveVersionCheckSettings({
        upstreamUrl: _typed || (typeof VERSION_CHECK_UPSTREAM_URL === "string" ? VERSION_CHECK_UPSTREAM_URL : ""),
        apiKey: ($("set-ver-apikey") || {}).value || "",
      });
      if (!_typed && cfg.upstreamUrl) $("set-ver-upstream").value = cfg.upstreamUrl;
      if (!cfg.upstreamUrl) {
        res.innerHTML = '<span style="color:#dc3545">버전 서버 실제 주소를 먼저 입력해 주세요.</span>';
        return;
      }
      res.innerHTML = '<span class="loader"></span> 버전 확인 중...';
      try {
        const data = await runVersionCheck(cfg);
        const cur = (data.current && data.current.normalized) || "(알 수 없음)";
        const curSrc = (data.current && data.current.source) || "";
        if (!data.ok) {
          res.innerHTML = `<div style="color:#dc3545">확인 실패: ${escapeHtml(String(data.error || "알 수 없는 오류"))}</div>`
            + `<div style="color:#777; margin-top:2px">지금 버전: ${escapeHtml(cur)}${curSrc ? " · " + escapeHtml(curSrc) : ""}</div>`;
          return;
        }
        const latest = (data.latest && data.latest.normalized) || "";
        // 실제로 버전 서버가 받은 주소를 그대로 보여준다 — 복사해서 curl 로 확인할 수 있게.
        // 키 값 자체는 화면에 찍지 않는다(어깨너머 노출 방지) — 헤더 이름만 보여준다.
        const curlAuth = data.authHeader ? ` -H "${escapeHtml(data.authHeader)}: <설정한 키>"` : "";
        const where = data.upstreamUrl
          ? `<div style="color:#777; margin-top:4px">호출 주소: <code style="user-select:all">${escapeHtml(data.upstreamUrl)}</code></div>`
            + `<div style="color:#999; margin-top:2px">curl -s${curlAuth} "${escapeHtml(data.upstreamUrl)}"</div>`
          : (data.checkedUrl ? `<div style="color:#777; margin-top:2px">${escapeHtml(data.checkedUrl)}</div>` : "");
        if (data.match) {
          res.innerHTML = `<div style="color:#28a745">최신 버전입니다 · ${escapeHtml(latest)}</div>`
            + `<div style="color:#777; margin-top:2px">지금 버전: ${escapeHtml(cur)}${curSrc ? " · " + escapeHtml(curSrc) : ""}</div>` + where;
        } else {
          // 배포 전에는 여기서 "최신버전을 다운로드 해주세요" 안내 + 확인 시 종료를 붙일 자리다.
          res.innerHTML = `<div style="color:#dc3545">버전이 다릅니다 — 지금 ${escapeHtml(cur)} · 최신 ${escapeHtml(latest)}</div>`
            + `<div style="color:#777; margin-top:2px">${escapeHtml(curSrc)}</div>` + where;
        }
      } catch (err) {
        res.innerHTML = `<span style="color:#dc3545">확인 실패: ${escapeHtml(err.message)}</span>`;
      }
    };
  }

  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  $("modal-save").onclick = () => {
    const form = readForm();
    if (form.provider === "anthropic" && !form.apiKey) {
      toast("Claude API Key가 비어 있습니다.", "error");
      return;
    }
    if (devMode && $("set-ver-upstream")) {
      saveVersionCheckSettings({
        upstreamUrl: $("set-ver-upstream").value,
        apiKey: ($("set-ver-apikey") || {}).value || "",
      });
    }
    settings = {
      ...settings,
      ...form,
      skillEngine: typeof normalizeSkillEngine === "function" ? normalizeSkillEngine(settings.skillEngine) : (settings.skillEngine || "vba"),
      skillEngineUserSet: settings.skillEngineUserSet === true,
    };
    saveSettings();
    $("modal-bg").classList.remove("show");
    toast("설정을 저장했습니다.", "success");
  };
}
