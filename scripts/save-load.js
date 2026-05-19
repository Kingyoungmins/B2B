/* ===================================================================
   SAVE / LOAD
   =================================================================== */
$("btn-save").onclick = () => {
  openSaveModal();
};
$("btn-load").onclick = () => {
  openLoadDialog();
};
$("btn-reset").onclick = () => {
  if (!confirm("현재 화면 상태를 초기화할까요? (다운로드한 .logic.json 파일은 영향 없음)")) return;
  state.inputs = [];
  state.inputsOriginal = [];
  state.output = null;
  state.outputOriginal = null;
  state.outputTemplates = [];
  state.activeOutputIndex = -1;
  state.pipeline = [];
  state.chatHistory = [];
  state.currentFileId = null;
  state.currentSheet = null;
  state.editingStepId = null;
  state.fuzzyResolution = {};
  state.lastError = null;
  state.formulaResults = {};
  state.selectedSheets = [];
  state.selectedCell = null;
  state.selectedRange = null;
  state.selectedRanges = [];
  state.selectionAnchor = null;
  $("chat-messages").innerHTML = `<div class="msg system">입력 또는 출력 파일 업로드 후 활성화됩니다.</div>`;
  renderInputList();
  renderOutputChip();
  renderPipeline();
  refreshTabs();
  refreshChatState();
  renderExcelViewer();
  refreshRunButton();
};

function openSaveModal() {
  if (state.pipeline.length === 0) { toast("저장할 단계가 없습니다", "error"); return; }
  const modal = $("modal");
  const defaultName = "logic_" + new Date().toISOString().slice(0,16).replace(/[T:]/g,"-");
  modal.innerHTML = `
    <h3>스킬 저장 (ZIP 다운로드)</h3>
    <p style="font-size:12px; color:#666; margin-bottom:10px">
      아래 파일들을 ZIP 하나로 묶어 다운로드합니다:
    </p>
    <ul style="font-size:12px; color:#444; margin:0 0 10px 18px; line-height:1.7">
      <li><b>{이름}.logic.json</b> — 파이프라인 매니페스트 + 채팅 히스토리 (${state.chatHistory.length}개 메시지)</li>
      <li><b>{이름}_step_1.js ~ step_${state.pipeline.length}.js</b> — 각 단계별 실행 코드 파일</li>
    </ul>
    <p style="font-size:11.5px; color:#888; margin-bottom:10px">
      .js 파일은 VSCode 등 외부 에디터에서 직접 수정 가능합니다. 불러오기 시 JSON 과 함께 선택하면 수정된 코드가 반영됩니다.
    </p>
    <input type="text" id="save-name" placeholder="파일 이름 (확장자 제외)" value="${defaultName}" />
    <div class="row">
      <button class="btn-secondary" id="modal-cancel">취소</button>
      <button class="btn-primary" id="modal-save">💾 ZIP 다운로드</button>
    </div>
  `;
  $("modal-bg").classList.add("show");
  setTimeout(() => $("save-name").select(), 50);
  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  $("modal-save").onclick = () => {
    const name = $("save-name").value.trim();
    if (!name) return;

    // 각 단계를 개별 .js 파일로 저장하고, 매니페스트에서 파일명 참조
    const safeBase = name.replace(/[^\w가-힣\-]/g, "_");
    const stepFiles = state.pipeline.map((s, idx) =>
      `${safeBase}_step_${idx + 1}.js`);

    const manifest = {
      version: 3,
      type: "mvno-logic",
      name,
      createdAt: new Date().toISOString(),
      stepCount: state.pipeline.length,
      pipeline: state.pipeline.map((s, idx) => ({
        id: s.id,
        description: s.description,
        enabled: isStepEnabled(s),
        stepFile: stepFiles[idx],
        code: s.code, // .js 파일이 누락되어도 동작하도록 임베딩 fallback 유지
      })),
      chatHistory: state.chatHistory, // 복원 시 대화 내용도 표시되도록 함께 저장
    };

    const zipEntries = [{
      name: name + ".logic.json",
      text: JSON.stringify(manifest, null, 2),
      mime: "application/json",
    }];

    state.pipeline.forEach((step, idx) => {
      const header =
        `// ${name}\n` +
        `// Step ${idx + 1}: ${step.description}\n` +
        `// 생성: ${new Date().toISOString()}\n` +
        `// ──────────────────────────────────────────────────────────\n` +
        `// 이 파일은 자동 생성되었습니다. 직접 수정 후 저장한 뒤\n` +
        `// "스킬 불러오기" 에서 .logic.json 과 함께 선택하면 반영됩니다.\n` +
        `// 함수 시그니처: function transform(inputs, output) { ... return { inputs, output }; }\n` +
        `// ──────────────────────────────────────────────────────────\n\n`;
      zipEntries.push({
        name: stepFiles[idx],
        text: header + step.code,
        mime: "text/javascript",
      });
    });

    downloadZip(zipEntries, name + ".zip");
    $("modal-bg").classList.remove("show");
    toast(`"${name}.zip" 다운로드 시작`, "success");
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w가-힣\.\-\s]/g, "_");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime || "text/plain" });
  downloadBlob(blob, filename);
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename);
}

const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = ZIP_CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function downloadZip(entries, filename) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(entry => {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = typeof entry.text === "string" ? encoder.encode(entry.text) : new Uint8Array(entry.bytes || []);
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, entry.mime === "application/json" ? 0x20 : 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + dataBytes.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const blob = new Blob([...localParts, ...centralParts, endHeader], { type: "application/zip" });
  downloadBlob(blob, filename);
}

async function normalizeLoadedFiles(files) {
  const normalized = [];
  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const extracted = await readStoredZip(file);
      normalized.push(...extracted);
    } else {
      normalized.push(file);
    }
  }
  return normalized;
}

async function readStoredZip(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const decoder = new TextDecoder();
  const files = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    const sig = view.getUint32(0, true);
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    if (sig !== 0x04034b50) throw new Error("지원하지 않는 ZIP 형식입니다");
    const compression = view.getUint16(8, true);
    if (compression !== 0) throw new Error("ZIP 파일을 확인해 주세요");
    const compressedSize = view.getUint32(18, true);
    const nameLen = view.getUint16(26, true);
    const extraLen = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLen));
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    files.push(new File([data], name));
    offset = dataStart + compressedSize;
  }
  return files;
}

async function loadLogicFiles(files) {
  if (files.length === 0) return;
  files = await normalizeLoadedFiles(files);
  // 매니페스트 JSON 찾기 — 파일명이 바뀌어 있을 수 있으니 내용으로 검증.
  const jsonCandidates = files.filter(f => f.name.toLowerCase().endsWith(".json"));
  if (jsonCandidates.length === 0) {
    throw new Error(".logic.json 매니페스트 파일을 포함해서 선택해주세요");
  }
  let manifestFile = null, manifestData = null, manifestText = "";
  for (const f of jsonCandidates) {
    try {
      const t = await f.text();
      const parsed = JSON.parse(t);
      if (parsed && Array.isArray(parsed.pipeline)) {
        if (manifestFile) {
          throw new Error(`매니페스트 JSON이 여러 개 발견됨 (${manifestFile.name}, ${f.name}). 1개만 선택하세요.`);
        }
        manifestFile = f; manifestData = parsed; manifestText = t;
      }
    } catch (e) {
      if (e.message && e.message.startsWith("매니페스트")) throw e;
      // JSON 파싱 실패는 그냥 후보에서 제외
    }
  }
  if (!manifestFile) {
    throw new Error("유효한 스킬 매니페스트(.logic.json)를 찾지 못했습니다 — pipeline 필드 있는 JSON이 필요합니다");
  }
  const data = manifestData;

  // step 파일 후보 — .js / .py
  const stepFiles = files.filter(f => /\.(js|py)$/i.test(f.name));
  const stepContents = {};
  for (const sf of stepFiles) {
    stepContents[sf.name] = await sf.text();
  }
  const consumed = new Set(); // 이미 매칭된 파일명

  // 보조: 파일명에서 step 번호 힌트 추출. "foo_step_3.js" 또는 "step3.js" 모두 OK.
  function stepNumFromName(name) {
    const m = /step[\s_-]*(\d+)/i.exec(name);
    return m ? parseInt(m[1], 10) : NaN;
  }

  let externallyLoaded = 0;
  let fuzzyMatched = 0;
  const resolvedPipeline = data.pipeline.map((s, idx) => {
    let code = s.code || "";
    const expected = s.stepFile || "";
    let matchedName = null;

    // 1) 정확 매칭
    if (expected && stepContents[expected] && !consumed.has(expected)) {
      matchedName = expected;
    }

    // 2) step 번호 매칭 (파일명에 step_N 이 들어 있고 N 이 idx+1 이면)
    if (!matchedName) {
      for (const f of stepFiles) {
        if (consumed.has(f.name)) continue;
        const n = stepNumFromName(f.name);
        if (n === idx + 1) { matchedName = f.name; break; }
      }
    }

    // 3) 파일명 유사도 매칭 (사용자가 이름을 바꿔둔 경우)
    if (!matchedName && expected && typeof similarity === "function") {
      const candidates = stepFiles.filter(f => !consumed.has(f.name));
      let best = null, bestScore = 0;
      for (const f of candidates) {
        // 확장자 빼고 비교 — 더 너그럽게
        const a = expected.replace(/\.[^.]+$/, "");
        const b = f.name.replace(/\.[^.]+$/, "");
        const score = similarity(a, b);
        if (score > bestScore) { bestScore = score; best = f.name; }
      }
      if (best && bestScore >= 0.6) matchedName = best;
    }

    // 4) 위치 기반 fallback — i 번째 미사용 .js → i 번째 step
    if (!matchedName) {
      const remaining = stepFiles.filter(f => !consumed.has(f.name));
      if (remaining[0] && !s.code) matchedName = remaining[0].name;
    }

    if (matchedName && stepContents[matchedName] !== undefined) {
      code = stepContents[matchedName];
      consumed.add(matchedName);
      externallyLoaded++;
      if (expected && matchedName !== expected) fuzzyMatched++;
    }

    return {
      id: s.id || uid(),
      description: s.description || `Step ${idx + 1}`,
      enabled: s.enabled !== false,
      code,
    };
  });

  loadLogic({ ...data, pipeline: resolvedPipeline }, manifestFile.name, {
    externallyLoaded,
    fuzzyMatched,
    totalSteps: resolvedPipeline.length,
    jsCount: stepFiles.length,
  });
}

function openLoadDialog() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".zip,.json,application/json,.js,.py,text/javascript";
  input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    try {
      await loadLogicFiles(files);
    } catch (err) {
      toast("불러오기 실패: " + err.message, "error");
      console.error(err);
    }
  };
  input.click();
}

function loadLogic(data, filename, meta) {
  // 파이프라인 복원. 자동 실행 X (사용자가 "전체 실행" 을 눌러야 적용됨).
  state.pipeline = deepClone(data.pipeline || []);
  if (typeof ensurePipelineStepIds === "function") ensurePipelineStepIds();
  // 채팅 히스토리도 함께 복원 (있으면)
  state.chatHistory = Array.isArray(data.chatHistory) ? deepClone(data.chatHistory) : [];
  state.editingStepId = null;
  renderPipeline();
  renderChatFromHistory();
  refreshChatState();
  refreshRunButton();
  const label = data.name || filename;
  const n = state.pipeline.length;
  const extInfo = meta && meta.externallyLoaded > 0
    ? ` (외부 .js 파일 ${meta.externallyLoaded}/${n}개 반영${meta.fuzzyMatched ? `, 그중 ${meta.fuzzyMatched}개는 이름 변경 자동 매칭` : ""})`
    : " (매니페스트 임베딩 코드 사용)";
  const chatInfo = state.chatHistory.length > 0
    ? `, 대화 ${state.chatHistory.length}개 복원`
    : "";
  toast(`"${label}" ${n}단계 로드됨${extInfo}${chatInfo}. 입력/출력 업로드 후 "전체 실행" 을 눌러 적용하세요.`, "success");
}

function renderChatFromHistory() {
  const container = $("chat-messages");
  container.innerHTML = "";
  if (state.chatHistory.length === 0) {
    const text = state.output
      ? `출력 템플릿 "${state.output.name}" 이 로드되었습니다. 스킬을 만들어보세요.`
      : (state.inputs.length > 0 ? `입력 파일 ${state.inputs.length}개가 로드되었습니다. 스킬을 만들어보세요.` : "입력 또는 출력 파일 업로드 후 활성화됩니다.");
    addMessage("system", text);
    return;
  }
  addMessage("system", `저장된 대화 ${state.chatHistory.length}개 복원 · 이어서 질문 가능`);
  state.chatHistory.forEach(msg => {
    if (msg.role === "user") {
      addMessage("user", msg.content);
    } else if (msg.role === "assistant") {
      addHistoricAssistant(msg.content);
    }
  });
}

function addHistoricAssistant(fullText) {
  const code = extractCode(fullText);
  const stripped = fullText.replace(/```[\s\S]*?```/g, "").trim();
  const div = document.createElement("div");
  div.className = "msg assistant";
  div.innerHTML = `<div>${escapeHtml(stripped)}</div>`;
  if (code) {
    const codeBlk = document.createElement("pre");
    codeBlk.className = "code-block";
    codeBlk.textContent = code;
    div.appendChild(codeBlk);
    const badge = document.createElement("div");
    badge.style.cssText = "margin-top:6px; font-size:11px; color:#28a745; font-weight:bold;";
    badge.textContent = "✓ 이미 적용된 단계";
    div.appendChild(badge);
  }
  $("chat-messages").appendChild(div);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
}

/* Close modal on backdrop click */
$("modal-bg").addEventListener("click", e => {
  if (e.target === $("modal-bg")) $("modal-bg").classList.remove("show");
});
