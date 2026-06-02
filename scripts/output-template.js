/* ===================================================================
   출력 템플릿 다운로드 (원본 양식 보존)
   =================================================================== */
$("btn-download").onclick = () => {
  downloadAllFilesZip();
};

async function downloadCurrentWorkbookFile(fileId) {
  const file = getFile(fileId);
  const original = getOriginalFile(fileId) || {};
  if (!file) {
    toast("다운로드할 파일을 찾지 못했습니다.", "error");
    return;
  }

  const filename = safeCurrentWorkbookDownloadName(file.name);
  const excelId = typeof excelMirrorSessionIdForFileId === "function"
    ? excelMirrorSessionIdForFileId(fileId)
    : null;
  try {
    if (excelId && typeof postExcelMirror === "function") {
      const saved = await postExcelMirror("/api/excel/save", { excelId });
      if (saved.downloadUrl) {
        file.backendDownloadUrl = saved.downloadUrl;
        downloadBackendOutput(saved.downloadUrl, filename);
        toast(`"${filename}" 다운로드 시작`, "success");
        return;
      }
    }

    const url = file.backendDownloadUrl ||
      original.backendDownloadUrl ||
      (file.backendWorkbookId ? `/api/workbooks/source/${encodeURIComponent(file.backendWorkbookId)}` : "") ||
      (original.backendWorkbookId ? `/api/workbooks/source/${encodeURIComponent(original.backendWorkbookId)}` : "");
    if (url) {
      downloadBackendOutput(url, filename);
      toast(`"${filename}" 다운로드 시작`, "success");
      return;
    }

    if (/\.csv$/i.test(filename)) {
      exportOutputCsv(filename, file);
    } else {
      exportOutputXlsx(filename, file, original);
    }
    toast(`"${filename}" 다운로드 시작`, "success");
  } catch (err) {
    toast("파일 다운로드 오류: " + err.message, "error");
    console.error(err);
  }
}

function safeCurrentWorkbookDownloadName(name) {
  const fallback = "workbook.xlsx";
  const raw = String(name || fallback).trim() || fallback;
  return raw.replace(/[\\/:*?"<>|]/g, "_");
}

function collectAllDownloadFiles() {
  const files = [];
  (state.inputs || []).forEach((file, idx) => {
    const original = (state.inputsOriginal || [])[idx] || {};
    const fileId = "input:" + file.name;
    files.push({
      role: "input",
      fileId,
      name: file.name,
      workbookId: file.backendWorkbookId || original.backendWorkbookId || null,
      downloadUrl: file.backendDownloadUrl || original.backendDownloadUrl || null,
      excelId: typeof excelMirrorSessionIdForFileId === "function" ? excelMirrorSessionIdForFileId(fileId) : null,
    });
  });

  (state.outputTemplates || []).forEach((tpl, idx) => {
    if (!tpl || !tpl.file) return;
    const fileId = "output:" + idx;
    files.push({
      role: "output",
      fileId,
      name: tpl.file.name,
      workbookId: tpl.file.backendWorkbookId || (tpl.original && tpl.original.backendWorkbookId) || null,
      downloadUrl: tpl.file.backendDownloadUrl || (tpl.original && tpl.original.backendDownloadUrl) || null,
      excelId: typeof excelMirrorSessionIdForFileId === "function" ? excelMirrorSessionIdForFileId(fileId) : null,
    });
  });

  if (!files.some(file => file.role === "output") && state.output) {
    files.push({
      role: "output",
      fileId: "output",
      name: state.output.name,
      workbookId: state.output.backendWorkbookId || (state.outputOriginal && state.outputOriginal.backendWorkbookId) || null,
      downloadUrl: state.output.backendDownloadUrl || (state.outputOriginal && state.outputOriginal.backendDownloadUrl) || null,
      excelId: typeof excelMirrorSessionIdForFileId === "function" ? excelMirrorSessionIdForFileId("output") : null,
    });
  }

  return files.filter(file => file.workbookId || file.downloadUrl || file.excelId);
}

function archiveFilename() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `전체_파일_${stamp}.zip`;
}

async function downloadAllFilesZip() {
  const files = collectAllDownloadFiles();
  if (!files.length) {
    toast("다운로드할 입력/출력 파일이 없습니다.", "error");
    return;
  }

  const btn = $("btn-download");
  const originalText = btn ? btn.textContent : "";
  const filename = archiveFilename();
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "ZIP 생성 중...";
    }
    const resp = await fetch("/api/workbooks/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename, files }),
    });
    if (!resp.ok) {
      let message = `HTTP ${resp.status}`;
      try {
        const data = await resp.json();
        message = data.error || message;
      } catch (_) {}
      throw new Error(message);
    }
    const blob = await resp.blob();
    downloadArchiveBlob(blob, filename);
    toast(`"${filename}" 다운로드 시작`, "success");
  } catch (err) {
    toast("전체 파일 다운로드 오류: " + err.message, "error");
    console.error(err);
  } finally {
    if (btn) {
      btn.textContent = originalText || "📥 전체 파일 다운로드";
      if (typeof refreshRunButton === "function") refreshRunButton();
      else btn.disabled = false;
    }
  }
}

function downloadArchiveBlob(blob, filename) {
  if (typeof downloadBlob === "function") {
    downloadBlob(blob, filename);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openDownloadModal() {
  const target = getDownloadOutputTarget();
  if (!target.file) { toast("다운로드할 결과 파일이 없습니다", "error"); return; }
  const isCsv = /\.csv$/i.test(target.file.name || "");
  const ext = isCsv ? ".csv" : ".xlsx";
  const baseName = target.file.name.replace(/\.(xlsx|xls|csv)$/i, "");
  const today = new Date().toISOString().slice(0, 10);
  const defaultName = `${baseName}_결과_${today}`;
  const modal = $("modal");
  modal.innerHTML = `
    <h3>출력 템플릿 다운로드 (.xlsx)</h3>
    <p style="font-size:12px; color:#666; margin-bottom:10px">
      파이프라인 ${state.pipeline.length}단계가 적용된 결과를 다운로드합니다.<br/>
      원본 파일의 서식·병합셀·열너비 등 양식이 그대로 유지됩니다.
    </p>
    <input type="text" id="dl-name" value="${escapeHtml(defaultName)}" placeholder="파일명 (확장자 제외)" />
    <div class="row">
      <button class="btn-secondary" id="modal-cancel">취소</button>
      <button class="btn-primary" id="modal-dl" style="background:#217346">📥 다운로드</button>
    </div>
  `;
  $("modal-bg").classList.add("show");
  setTimeout(() => $("dl-name").select(), 50);
  $("modal-cancel").onclick = () => $("modal-bg").classList.remove("show");
  $("modal-dl").onclick = () => {
    const name = $("dl-name").value.trim();
    if (!name) { toast("파일명을 입력하세요", "error"); return; }
    try {
      if (target.file && target.file.backendDownloadUrl) {
        downloadBackendOutput(target.file.backendDownloadUrl, name + ext);
      } else if (isCsv) {
        exportOutputCsv(name + ext, target.file);
      } else {
        exportOutputXlsx(name + ext, target.file, target.original);
      }
      $("modal-bg").classList.remove("show");
      toast(`"${name}.xlsx" 다운로드 시작`, "success");
    } catch (err) {
      toast("다운로드 오류: " + err.message, "error");
      console.error(err);
    }
  };
}

function getDownloadOutputTarget() {
  if (state.currentFileId && state.currentFileId.startsWith("input:")) {
    const file = getFile(state.currentFileId);
    if (file && file.backendDownloadUrl) return { file, original: getOriginalFile(state.currentFileId) };
  }
  if (state.currentFileId && state.currentFileId.startsWith("output:")) {
    const idx = outputTemplateIndexFromFileId(state.currentFileId);
    const tpl = state.outputTemplates && state.outputTemplates[idx];
    if (tpl) return { file: tpl.file, original: tpl.original };
  }
  return { file: state.output, original: state.outputOriginal };
}

function downloadBackendOutput(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function exportOutputCsv(filename, fileArg) {
  const outputFile = fileArg || state.output;
  if (!outputFile || !outputFile.sheets) throw new Error("CSV로 저장할 데이터가 없습니다");
  const sheetName = (outputFile.sheetNames && outputFile.sheetNames[0]) || Object.keys(outputFile.sheets)[0];
  const rows = outputFile.sheets[sheetName] || [];
  const csv = rows.map(row => (row || []).map(value => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportOutputXlsx(filename, fileArg, originalArg) {
  const outputFile = fileArg || state.output;
  const outputOriginal = originalArg || state.outputOriginal;
  if (!outputFile || !outputFile.originalBuffer) {
    throw new Error("원본 버퍼가 없습니다");
  }
  // 원본 xlsx 를 새로 파싱 (스타일·병합·열너비 포함)
  const freshBuf = outputFile.originalBuffer.slice(0);
  const wb = XLSX.read(freshBuf, {
    type: "array",
    cellDates: true,
    cellStyles: true,
    cellNF: true,
  });

  // 기존 시트: 셀 값만 in-place 업데이트 (스타일·수식 보존)
  Object.keys(outputFile.sheets).forEach(sheetName => {
    const aoa = outputFile.sheets[sheetName];
    const origAoa = outputOriginal && outputOriginal.sheets
      ? outputOriginal.sheets[sheetName]
      : null;
    if (wb.Sheets[sheetName]) {
      const formulaMap = outputFile.formulas && outputFile.formulas[sheetName];
      updateSheetCells(wb.Sheets[sheetName], aoa, origAoa, formulaMap);
    } else {
      // 파이프라인이 새로 만든 시트 (피벗 등)
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  });

  XLSX.writeFile(wb, filename);
}

function updateSheetCells(ws, aoa, origAoa, formulaMap) {
  const maxRows = Math.max(
    aoa.length,
    origAoa ? origAoa.length : 0
  );
  const maxCols = Math.max(
    aoa.reduce((m, r) => Math.max(m, r ? r.length : 0), 0),
    origAoa ? origAoa.reduce((m, r) => Math.max(m, r ? r.length : 0), 0) : 0
  );

  // 원본 값과 동일한지 비교 (문자/숫자/Date 모두 안정 비교)
  const sameVal = (a, b) => {
    const ea = (a === undefined || a === null) ? "" : a;
    const eb = (b === undefined || b === null) ? "" : b;
    if (ea === eb) return true;
    if (ea instanceof Date && eb instanceof Date) return ea.getTime() === eb.getTime();
    if (typeof ea === "number" && typeof eb === "number") return ea === eb;
    return String(ea) === String(eb);
  };

  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < maxCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      let newVal = (aoa[r] && aoa[r][c] !== undefined) ? aoa[r][c] : "";
      newVal = resolveFormulaStringValue(newVal, aoa, r, c);
      const oldVal = (origAoa && origAoa[r] && origAoa[r][c] !== undefined) ? origAoa[r][c] : "";
      const existing = ws[addr];
      const formulaWasRemoved = !!(existing && existing.f && (!formulaMap || !formulaMap[addr]));

      // ★ 값이 원본과 동일하면 셀 자체를 건드리지 않음
      //    → 기존 수식(.f), 스타일(.s), 숫자서식(.z) 모두 보존
      if (!formulaWasRemoved && sameVal(newVal, oldVal)) continue;

      // 빈 값으로 변경
      if (newVal === "" || newVal === null || newVal === undefined) {
        if (existing) {
          existing.t = "z";
          delete existing.v;
          delete existing.w;
          delete existing.f;  // 값을 비웠으므로 수식도 제거 (의도적 clear)
          delete existing.h;
          delete existing.r;
        }
        continue;
      }

      // 타입 결정 (AI가 문자열 형태 숫자를 반환해도 숫자로 저장)
      let t, v;
      if (typeof newVal === "number" && !isNaN(newVal)) {
        t = "n"; v = newVal;
      } else if (typeof newVal === "boolean") {
        t = "b"; v = newVal;
      } else if (newVal instanceof Date) {
        t = "d"; v = newVal;
      } else {
        const str = String(newVal);
        const trimmed = str.trim();
        if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
          t = "n"; v = Number(trimmed);
        } else {
          t = "s"; v = str;
        }
      }

      if (existing) {
        // 값이 바뀐 셀: 스타일(.s), 숫자서식(.z) 은 유지, 값/타입 교체
        existing.v = v;
        existing.t = t;
        delete existing.w; // 캐시된 표시값 (재생성)
        delete existing.f; // 수식은 이제 고정값으로 대체
        delete existing.h;
        delete existing.r;
      } else {
        ws[addr] = { v, t };
      }
    }
  }

  // 시트 범위 확장 (새로 추가된 셀 포함)
  const newEndR = Math.max(maxRows - 1, 0);
  const newEndC = Math.max(maxCols - 1, 0);
  if (ws["!ref"]) {
    const exist = XLSX.utils.decode_range(ws["!ref"]);
    ws["!ref"] = XLSX.utils.encode_range({
      s: exist.s,
      e: { r: Math.max(exist.e.r, newEndR), c: Math.max(exist.e.c, newEndC) },
    });
  } else {
    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: newEndR, c: newEndC },
    });
  }
}

function resolveFormulaStringValue(value, aoa, r, c) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("=")) return value;
  if (typeof evalFormula !== "function") return "";
  const result = evalFormula(trimmed, aoa, { r, c }, null);
  return (typeof FORMULA_UNSUPPORTED !== "undefined" && result === FORMULA_UNSUPPORTED) ? "" : result;
}
