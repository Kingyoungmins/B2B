/* ===================================================================
   SAVE / LOAD
   =================================================================== */
$("btn-save").onclick = () => {
  openSaveModal();
};
$("btn-load").onclick = () => {
  openLoadDialog();
};
const logicBackupDirButton = $("btn-backup-dir");
if (logicBackupDirButton) {
  logicBackupDirButton.onclick = () => {
    chooseLogicAutoBackupDir();
  };
}
$("btn-reset").onclick = async () => {
  // [사용자 요청] 초기화 = 띄운 Excel 전부 종료 + 프로그램 재시작처럼 동작.
  // confirm() 이 항상-위 Excel 미러 창 뒤에 가려져 화면이 굳어 보이는 문제(0.5.2.2 §7)가 있어
  // 묻기 전에 미러를 먼저 숨긴다. 취소하면 활성 미러를 복원한다.
  try { if (typeof hideAllExcelMirrorWindows === "function") await hideAllExcelMirrorWindows(); } catch (_) {}
  const confirmed = typeof openB2bConfirmModal === "function"
    ? await openB2bConfirmModal("초기화할까요? 띄워진 Excel 창을 모두 닫고 프로그램을 새로 시작한 상태로 되돌립니다." + String.fromCharCode(10) + "(다운로드한 .logic.json 파일은 영향 없음)", { okLabel: "초기화" })
    : confirm("초기화할까요?");
  if (!confirmed) {
    try { if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0); } catch (_) {}
    return;
  }
  // 1) Excel 전부 강제 종료: 서버가 즉시 응답하고 백그라운드 스레드가 세션/워커/고아 EXCEL.EXE 까지 정리.
  try {
    if (typeof forceCloseAllExcelMirrorSessions === "function") {
      await forceCloseAllExcelMirrorSessions();
    } else if (typeof closeAllExcelMirrorSessions === "function") {
      await closeAllExcelMirrorSessions();
    }
  } catch (err) {
    console.warn("초기화 중 Excel 종료 실패(리로드는 계속 진행):", err);
  }
  // [필드#4] 초기화 직후 첫 업로드에서 Excel 창이 빈 화면으로 남는 케이스 자가복구용 표식.
  try { sessionStorage.setItem("b2bJustReset", "1"); } catch (_) {}
  // 2) SPA 전체 리로드 = 프로그램 재시작과 동일한 상태 초기화.
  //    이전의 수동 state 필드 초기화는 새 상태/타이머/토큰이 생길 때마다 누락돼 '반쯤 초기화'가 됐다 —
  //    리로드는 모든 JS 상태·타이머·busy 토큰·취소 토큰이 부팅 직후와 같아진다(서버/설정은 유지).
  location.reload();
};

function logicBackupTimestamp() {
  // [수정] toISOString() 은 UTC 라 파일명 시각이 로컬(KST=UTC+9)보다 9시간 느렸다.
  // 백업 파일명은 사용자가 보는 로컬 시각으로 만든다(메타데이터 createdAt 의 ISO 는 표준이라 UTC 유지).
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function safeLogicBaseName(name) {
  return String(name || "logic").trim().replace(/[^\w\uAC00-\uD7A3\-\s]/g, "_").replace(/\s+/g, " ").trim() || "logic";
}

function stripLogicTimestampSuffix(name) {
  let base = String(name || "").trim();
  base = base.replace(/\.(?:zip|logic\.json|json)$/i, "");
  base = base.replace(/_step\d+$/i, "");
  base = base.replace(/(?:[_-])?\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/i, "");
  base = base.replace(/(?:[_-])?\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/i, "");
  base = base.replace(/(?:[_-])?\d+\s*(?:단계|steps?)$/i, "");  // 스텝 수 표기(_3단계) 제거 → 재저장 시 누적 방지
  return safeLogicBaseName(base || "logic");
}

function currentLogicSaveBaseName(fallback) {
  const fromState = state && state.logicSaveBaseName ? state.logicSaveBaseName : "";
  let fromStorage = "";
  try { fromStorage = localStorage.getItem("b2b_logic_save_base_name") || ""; } catch (_) {}
  const remembered = fromState || fromStorage;
  // 명시적으로 기억된 이름이 있으면 그걸 쓰되, 옛 기본값 "logic" 이면 호출자 fallback(입력 파일명)을 우선.
  const chosen = (remembered && remembered.trim().toLowerCase() !== "logic")
    ? remembered
    : (fallback || remembered || "logic");
  return stripLogicTimestampSuffix(chosen || "logic");
}

function defaultLogicBaseNameFromInputs() {
  // 스킬 기본 이름 = 첫 입력 파일명(확장자 제거). 없으면 출력 템플릿명, 그래도 없으면 "logic".
  // 어떤 입력으로 만든 스킬인지 파일명으로 식별되게 한다(저장/자동저장 공통).
  try {
    let nm = "";
    const inputs = (state && state.inputs) || [];
    if (inputs.length) {
      nm = (typeof workbookDisplayName === "function") ? workbookDisplayName(inputs[0], "") : (inputs[0] && inputs[0].name) || "";
    }
    if (!nm) {
      const tpls = (state && state.outputTemplates) || [];
      if (tpls.length && tpls[0] && tpls[0].file) nm = tpls[0].file.name || "";
      else if (state && state.output && state.output.name) nm = state.output.name;
    }
    nm = String(nm || "").replace(/\.(xls[xmb]?|csv|tsv)$/i, "");
    return stripLogicTimestampSuffix(nm || "logic");
  } catch (_) {
    return "logic";
  }
}

function rememberLogicSaveBaseName(name) {
  const base = stripLogicTimestampSuffix(name || "logic");
  state.logicSaveBaseName = base;
  try { localStorage.setItem("b2b_logic_save_base_name", base); } catch (_) {}
  return base;
}

function timestampedLogicArchiveName(baseName) {
  const base = safeLogicBaseName(baseName || "logic");
  const n = (state && Array.isArray(state.pipeline)) ? state.pipeline.length : 0;
  const stepPart = n > 0 ? `_${n}단계` : "";  // 몇 스텝짜리 스킬인지 파일명에 표기
  return `${base}${stepPart}_${logicBackupTimestamp()}`;
}

function buildLogicZipEntries(name) {
  const safeBase = safeLogicBaseName(name);
  const stepFiles = state.pipeline.map((s, idx) => {
    const lang = s && s.language ? s.language : "javascript";
    return `${safeBase}_step_${idx + 1}.${lang === "python" ? "py" : "js"}`;
  });

  const manifest = {
    version: 3,
    type: "mvno-logic",
    name,
    saveBaseName: currentLogicSaveBaseName(stripLogicTimestampSuffix(name)),
    createdAt: new Date().toISOString(),
    stepCount: state.pipeline.length,
    pipeline: state.pipeline.map((s, idx) => ({
      id: s.id,
      description: s.description,
      enabled: isStepEnabled(s),
      language: s.language || "javascript",
      stepFile: stepFiles[idx],
      code: s.code,
      targetFileId: s.targetFileId || null,  // [#18] 스텝의 대상 파일 바인딩 — 저장/불러오기로 유지되어야 재실행 시 올바른 파일에 적용됨
    })),
    chatHistory: state.chatHistory,
  };

  const zipEntries = [{
    name: name + ".logic.json",
    text: JSON.stringify(manifest, null, 2),
    mime: "application/json",
  }];

  state.pipeline.forEach((step, idx) => {
    const lang = step.language || "javascript";
    const comment = lang === "python" ? "#" : "//";
    const header = [
      `${comment} ${name}`,
      `${comment} Step ${idx + 1}: ${step.description}`,
      `${comment} Created: ${new Date().toISOString()}`,
      "",
    ].join("\n");
    zipEntries.push({
      name: stepFiles[idx],
      text: header + String(step.code || ""),
      mime: lang === "python" ? "text/x-python" : "text/javascript",
    });
  });

  return zipEntries;
}

let logicAutoBackupTimer = null;
let logicAutoBackupSeq = 0;
let logicAutoBackupLastAt = 0;
const LOGIC_AUTO_BACKUP_MIN_INTERVAL_MS = 20000;
const LOGIC_AUTO_BACKUP_DELAY_MS = 1500;

function updateLogicBackupDirButton(info) {
  const btn = $("btn-backup-dir");
  if (!btn || !info || !info.path) return;
  btn.title = `스킬 자동저장 폴더: ${info.path}`;
}

async function refreshLogicAutoBackupDirStatus() {
  if (!window.fetch || location.protocol === "file:") return null;
  try {
    const resp = await fetch("/api/logic/backup-dir");
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 404) throw new Error("현재 실행 중인 서버가 자동저장 폴더 API를 지원하지 않습니다. 프로그램을 완전히 종료한 뒤 다시 실행하세요.");
    if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    updateLogicBackupDirButton(data);
    return data;
  } catch (err) {
    console.warn("Logic auto-backup dir status failed:", err);
    return null;
  }
}

async function chooseLogicAutoBackupDir() {
  if (!window.fetch || location.protocol === "file:") {
    toast("로컬 서버 실행 상태에서만 자동저장 폴더를 선택할 수 있습니다.", "error");
    return;
  }
  const btn = $("btn-backup-dir");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "📁 선택 중...";
  }
  try {
    const resp = await fetch("/api/logic/backup-dir/select", { method: "POST" });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 404) {
      throw new Error("현재 실행 중인 서버가 자동저장 폴더 API를 지원하지 않습니다. 프로그램을 완전히 종료한 뒤 다시 실행하세요.");
    }
    if (data && data.cancelled) {
      toast("자동저장 폴더 선택을 취소했습니다.", "success");
      updateLogicBackupDirButton(data);
      return;
    }
    if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    updateLogicBackupDirButton(data);
    toast(`스킬 자동저장 폴더를 변경했습니다: ${data.path}`, "success");
  } catch (err) {
    toast("자동저장 폴더 선택 실패: " + (err && err.message ? err.message : String(err)), "error");
    console.warn("Logic auto-backup dir select failed:", err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "📁 자동저장 폴더";
    }
  }
}

setTimeout(() => { refreshLogicAutoBackupDirStatus(); }, 0);

function scheduleLogicAutoBackup(reason) {
  if (!state.pipeline || state.pipeline.length === 0) return;
  if (!window.fetch || location.protocol === "file:") return;
  logicAutoBackupSeq += 1;
  const seq = logicAutoBackupSeq;
  clearTimeout(logicAutoBackupTimer);
  const elapsed = Date.now() - logicAutoBackupLastAt;
  const minDelay = state.pipeline.length >= 20 ? 5000 : LOGIC_AUTO_BACKUP_DELAY_MS;
  const delay = Math.max(minDelay, LOGIC_AUTO_BACKUP_MIN_INTERVAL_MS - elapsed);
  logicAutoBackupTimer = setTimeout(() => saveLogicAutoBackup(reason, seq), delay);
}

async function saveLogicAutoBackup(reason, seq) {
  if (seq !== logicAutoBackupSeq) return;
  logicAutoBackupLastAt = Date.now();
  try {
    const name = timestampedLogicArchiveName(currentLogicSaveBaseName(defaultLogicBaseNameFromInputs()));
    const blob = createZipBlob(buildLogicZipEntries(name));
    const resp = await fetch("/api/logic/backup", {
      method: "POST",
      headers: {
        "content-type": "application/zip",
        "x-filename": `${name}.zip`,
        "x-backup-reason": String(reason || "pipeline-step"),
      },
      body: blob,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    window.lastLogicAutoBackup = data;
    console.info("Logic auto-backup saved:", data.path || data.name);
  } catch (err) {
    console.warn("Logic auto-backup failed:", err);
  }
}

function openSaveModal() {
  if (state.pipeline.length === 0) { toast("저장할 단계가 없습니다", "error"); return; }
  const modal = $("modal");
  const defaultName = currentLogicSaveBaseName(defaultLogicBaseNameFromInputs());
  const previewName = timestampedLogicArchiveName(defaultName) + ".zip";
  modal.innerHTML = `
    <h3>스킬 저장 (ZIP 다운로드)</h3>
    <p style="font-size:12px; color:#666; margin-bottom:10px">
      아래 파일들을 ZIP 하나로 묶어 다운로드합니다:
    </p>
    <ul style="font-size:12px; color:#444; margin:0 0 10px 18px; line-height:1.7">
      <li><b>{이름}.logic.json</b> - 파이프라인 매니페스트 + 채팅 히스토리 (${state.chatHistory.length}개 메시지)</li>
      <li><b>{이름}_step_1.js ~ step_${state.pipeline.length}.js</b> - 각 단계별 실행 코드 파일</li>
    </ul>
    <p style="font-size:11.5px; color:#888; margin-bottom:10px">
      .js/.py 파일은 VSCode 등 외부 에디터에서 직접 수정 가능합니다. 불러오기 시 JSON과 함께 선택하면 수정된 코드가 반영됩니다.
    </p>
    <input type="text" id="save-name" placeholder="파일 이름 (확장자/일시 제외)" value="${escapeHtml(defaultName)}" />
    <p id="save-name-preview" style="font-size:11.5px; color:#666; margin:8px 0 0">
      저장 파일명: ${escapeHtml(previewName)}
    </p>
    <div class="row">
      <button class="btn-secondary" id="modal-cancel">취소</button>
      <button class="btn-primary" id="modal-save">ZIP 다운로드</button>
    </div>
  `;
  $("modal-bg").classList.add("show");
  setTimeout(() => $("save-name").select(), 50);
  const refreshPreview = () => {
    const base = stripLogicTimestampSuffix(($("save-name") && $("save-name").value) || defaultName);
    const preview = $("save-name-preview");
    if (preview) preview.textContent = `저장 파일명: ${timestampedLogicArchiveName(base)}.zip`;
  };
  $("save-name").addEventListener("input", refreshPreview);
  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  $("modal-save").onclick = () => {
    const baseName = rememberLogicSaveBaseName($("save-name").value.trim());
    if (!baseName) return;
    const name = timestampedLogicArchiveName(baseName);
    downloadZip(buildLogicZipEntries(name), name + ".zip");
    $("modal-bg").classList.remove("show");
    toast(`"${name}.zip" 다운로드 시작`, "success");
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w\uAC00-\uD7A3.\-\s]/g, "_");
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

function createZipBlob(entries) {
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

  return new Blob([...localParts, ...centralParts, endHeader], { type: "application/zip" });
}

function downloadZip(entries, filename) {
  const blob = createZipBlob(entries);
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
    if (sig !== 0x04034b50) throw new Error("Unsupported ZIP format.");
    const compression = view.getUint16(8, true);
    if (compression !== 0) throw new Error("Compressed ZIP entries are not supported.");
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

function normalizeLoadedLogicCode(code, language) {
  if (language !== "python") return String(code || "");
  let text = String(code || "").replace(/^\uFEFF/, "");
  const fence = text.match(/```(?:python|py)?\s*\n([\s\S]*?)```/i);
  if (fence) text = fence[1];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let seenPython = false;
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!seenPython) {
      if (!trimmed) return;
      if (trimmed.startsWith("```")) return;
      if (trimmed.startsWith("//")) return;
      if (/^(제목|설명|설명문|title|description)\s*[:：]/i.test(trimmed)) return;
    }
    if (/^(def|import|from|class|@)\b/.test(trimmed)) seenPython = true;
    if (trimmed.startsWith("//")) {
      line = line.slice(0, line.length - line.trimStart().length) + "#" + trimmed.slice(2);
    }
    out.push(line);
  });
  return out.join("\n").trim() + "\n";
}

async function loadLogicFiles(files) {
  if (files.length === 0) return;
  files = await normalizeLoadedFiles(files);
  // 매니페스트 JSON 찾기. 파일명이 바뀌어 있을 수 있으므로 내용으로 검증한다.
  const jsonCandidates = files.filter(f => f.name.toLowerCase().endsWith(".json"));
  if (jsonCandidates.length === 0) {
    throw new Error(".logic.json 매니페스트 파일을 포함해서 선택해 주세요");
  }
  let manifestFile = null, manifestData = null, manifestText = "";
  for (const f of jsonCandidates) {
    try {
      const t = await f.text();
      const parsed = JSON.parse(t);
      if (parsed && Array.isArray(parsed.pipeline)) {
        if (manifestFile) {
          throw new Error(`Multiple logic manifests found (${manifestFile.name}, ${f.name}). Select only one manifest.`);
        }
        manifestFile = f; manifestData = parsed; manifestText = t;
      }
    } catch (e) {
      if (e.message && e.message.startsWith("Multiple logic manifests")) throw e;
      // JSON 파싱 실패 시 후보에서 제외
    }
  }
  if (!manifestFile) {
    throw new Error("Valid .logic.json manifest was not found. A JSON file with a pipeline field is required.");
  }
  const data = manifestData;

  // step 파일 후보 - .js / .py
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

    // 2) step 번호 매칭 (파일명에 step_N이 들어 있고 N이 idx+1이면)
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
        // 확장자를 빼고 비교해 더 너그럽게 매칭
        const a = expected.replace(/\.[^.]+$/, "");
        const b = f.name.replace(/\.[^.]+$/, "");
        const score = similarity(a, b);
        if (score > bestScore) { bestScore = score; best = f.name; }
      }
      if (best && bestScore >= 0.6) matchedName = best;
    }

    // 4) 위치 기반 fallback: i번째 미사용 step 파일을 i번째 step에 연결
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

    const language = s.language || (matchedName && /\.py$/i.test(matchedName) ? "python" : "javascript");
    code = normalizeLoadedLogicCode(code, language);

    return {
      id: s.id || uid(),
      description: s.description || `Step ${idx + 1}`,
      enabled: s.enabled !== false,
      language,
      code,
      targetFileId: s.targetFileId || null,  // [#18] 저장된 대상 파일 바인딩 복원(재실행이 올바른 파일에 적용되도록)
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
  // 파이프라인 복원. 자동 실행 X (사용자가 "전체 실행"을 눌러야 적용됨).
  state.pipeline = deepClone(data.pipeline || []);
  rememberLogicSaveBaseName(data.saveBaseName || data.name || filename || "logic");
  if (typeof ensurePipelineStepIds === "function") ensurePipelineStepIds();
  // 채팅 히스토리도 함께 복원 (있으면)
  state.chatHistory = Array.isArray(data.chatHistory) ? deepClone(data.chatHistory) : [];
  state.editingStepId = null;
  // 불러온 파이프라인은 라이브에 아직 적용 안 됨 → 적용추적 시그니처 무효화. 안 하면 첫 '전체 실행'이
  // no-op 으로 거부되거나 옛 서명과 충돌해 "스킬을 적용하지 못했습니다" 가 뜬다. [#18]
  if (typeof invalidateLivePipelineApplied === "function") {
    try { invalidateLivePipelineApplied(); } catch (_) {}
  }
  renderPipeline();
  renderChatFromHistory();
  refreshChatState();
  refreshRunButton();
  const label = data.name || filename;
  const n = state.pipeline.length;
  const extInfo = meta && meta.externallyLoaded > 0
    ? ` (외부 step 파일 ${meta.externallyLoaded}/${n}개 반영${meta.fuzzyMatched ? `, 그중 ${meta.fuzzyMatched}개는 이름 변경 자동 매칭` : ""})`
    : " (매니페스트 임베딩 코드 사용)";
  const chatInfo = state.chatHistory.length > 0
    ? `, 대화 ${state.chatHistory.length}개 복원`
    : "";
  toast(`"${label}" ${n}단계 로드됨${extInfo}${chatInfo}. 입력/출력 업로드 후 "전체 실행"으로 적용하세요.`, "success");
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
    const inPipeline = (state.pipeline || []).some(step => String((step && step.code) || "").trim() === String(code || "").trim());
    if (inPipeline) {
      badge.textContent = "파이프라인에 저장된 단계";
    } else {
      badge.style.color = "#b36b00";
      badge.textContent = "대화 기록 코드 · 파이프라인 미저장";
    }
    div.appendChild(badge);
  }
  $("chat-messages").appendChild(div);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
}

/* Close modal on backdrop click */
$("modal-bg").addEventListener("click", e => {
  if (e.target === $("modal-bg")) $("modal-bg").classList.remove("show");
});
