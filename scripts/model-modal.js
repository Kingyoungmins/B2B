/* ===================================================================
   AI 모델 설정 모달
   =================================================================== */
$("btn-settings").onclick = openSettingsModal;

function openSettingsModal() {
  const modal = $("modal");
  const p = "openai-compat";
  modal.innerHTML = `
    <h3>AI 모델 설정</h3>
    <div style="font-size:12px; color:#666; margin-bottom:12px">
      내부망 ixi 모델 엔드포인트를 사용합니다.
    </div>

    <div id="group-openai">
      <label style="font-size:11.5px; color:#666">Base URL (exe 로컬 프록시 /v1)</label>
      <input type="text" id="set-o-url" value="${escapeHtml(DEFAULTS["openai-compat"].baseUrl)}" />
      <label style="font-size:11.5px; color:#666">API Key</label>
      <input type="text" id="set-o-key" value="${escapeHtml(DEFAULTS["openai-compat"].apiKey)}" />
    </div>

    <div class="row" style="margin-top:14px">
      <button class="btn-secondary" id="btn-test">🔌 연결 테스트</button>
      <button class="btn-secondary" id="modal-cancel">취소</button>
      <button class="btn-primary" id="modal-save">저장</button>
    </div>
    <div id="test-result" style="margin-top:8px; font-size:11.5px"></div>
  `;
  $("modal-bg").classList.add("show");

  // 현재 폼 상태 읽기
  const readForm = () => {
    return {
      provider: "openai-compat",
      baseUrl: $("set-o-url").value.trim() || DEFAULTS["openai-compat"].baseUrl,
      apiKey:  $("set-o-key").value.trim() || DEFAULTS["openai-compat"].apiKey,
      model:   DEFAULTS["openai-compat"].model,
    };
  };

  $("btn-test").onclick = async () => {
    const form = readForm();
    const res = $("test-result");
    res.innerHTML = '<span class="loader"></span> 연결 테스트 중...';
    try {
      const { resp: r, url } = await fetchOpenAICompat("/models", form.baseUrl.replace(/\/$/, ""), {
        method: "GET",
        headers: {
          "Api-Key": form.apiKey,
        },
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0,200));
      const data = await r.json();
      const count = Array.isArray(data.data) ? data.data.length : 0;
      res.innerHTML = `<span style="color:#28a745">✓ 연결 성공 · ${count}개 확인 · ${escapeHtml(url.replace(/\/models$/, ""))}</span>`;
    } catch (err) {
      res.innerHTML = `<span style="color:#dc3545">✗ 실패: ${escapeHtml(err.message)}</span>`;
    }
  };

  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  $("modal-save").onclick = () => {
    settings = readForm();
    saveSettings();
    $("modal-bg").classList.remove("show");
    toast("설정 저장 완료", "success");
  };
}
