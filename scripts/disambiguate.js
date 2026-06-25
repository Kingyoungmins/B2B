/* ===================================================================
   DISAMBIGUATION MODAL
   ===================================================================
   유사도 매칭이 모호하거나 (item 2), 표 후보가 여러 개거나 (item 5),
   기본 대상 탭이 너무 많거나 (item 3) 할 때 사용자에게 한번 더 묻는다.

   사용법:
     const choice = await askUserChoice("회사명 컬럼이 어느 파일을 의미하나요?",
                                        ["A.xlsx", "B.xlsx"], { allowFreeRange: true });
     // choice: { value: "A.xlsx" } | { range: "A1:G30" } | null (취소)
   =================================================================== */

function askUserChoice(question, choices, options) {
  return new Promise((resolve) => {
    options = options || {};
    const modal = document.getElementById("modal");
    const bg = document.getElementById("modal-bg");
    if (!modal || !bg) return resolve(null);

    const id = "disamb-" + Math.random().toString(36).slice(2, 8);
    const choiceHtml = (choices || []).map((c, i) => `
      <label class="disamb-choice">
        <input type="radio" name="${id}" value="${i}" ${i === 0 ? "checked" : ""}>
        <span>${escapeHtml(typeof c === "string" ? c : (c.label || c.value || ""))}</span>
        ${typeof c === "object" && c.hint ? `<small>${escapeHtml(c.hint)}</small>` : ""}
      </label>
    `).join("");

    const rangeBlock = options.allowFreeRange ? `
      <div class="disamb-range">
        <label>또는 직접 범위 지정 (예: A12:G30)
          <input type="text" id="${id}-range" placeholder="A12:G30" />
        </label>
      </div>
    ` : "";

    modal.innerHTML = `
      <h3>${escapeHtml(question)}</h3>
      <div class="disamb-choices">${choiceHtml}</div>
      ${rangeBlock}
      <div class="row">
        <button class="btn-secondary" id="${id}-cancel">취소</button>
        <button class="btn-primary" id="${id}-ok">선택</button>
      </div>
    `;
    bg.classList.add("show");

    const close = (result) => {
      bg.classList.remove("show");
      resolve(result);
    };
    document.getElementById(id + "-cancel").onclick = () => close(null);
    document.getElementById(id + "-ok").onclick = () => {
      const rangeInput = document.getElementById(id + "-range");
      const rangeVal = rangeInput && rangeInput.value.trim();
      if (rangeVal) {
        close({ range: rangeVal });
        return;
      }
      const checked = modal.querySelector(`input[name="${id}"]:checked`);
      if (!checked) { close(null); return; }
      const idx = parseInt(checked.value, 10);
      const c = choices[idx];
      close({ value: typeof c === "string" ? c : (c.value !== undefined ? c.value : c) });
    };
  });
}

// 중간 단계에서 모호하게 매칭된 이름들을 한꺼번에 모아 일괄 해결.
// items: [{ key, candidates }]
// 반환: { [key]: chosenName } 사용자가 모두 결정한 매핑
async function resolveAmbiguities(items, contextLabel) {
  const out = {};
  for (const item of items) {
    const choice = await askUserChoice(
      `${contextLabel || "이름"} "${item.key}" 가 모호합니다. 어느 것인가요?`,
      item.candidates,
      { allowFreeRange: false }
    );
    if (!choice) return null; // user canceled
    out[item.key] = choice.value;
  }
  return out;
}
