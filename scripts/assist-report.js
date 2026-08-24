/* ===================================================================
   AI 도움 — 이슈 제보 패키지
   ===================================================================
   AI 가 해결할 수 없는 문제(프로그램 오류로 보이는 것)를 만나면, 개발팀이 그대로 재현할 수
   있는 묶음(zip)을 만들어 주고 지라 제보 방법을 안내한다. 묶음에는:
     · 스킬 zip(현재 파이프라인 그대로 — 실행기에 바로 올릴 수 있는 중첩 zip)
     · 업로드했던 입력/출력 원본 파일(백엔드 보관본에서 회수)
     · 제보양식.txt(지라에 붙여넣을 내용 + 절차)
     · 진단.txt(단계 상태·실행 전 점검 — 개발자가 첫 단서로 쓰는 것들)
     · 대화록.txt(AI 도움 대화 — 사용자가 뭘 시도했는지)
   다운로드는 항상 '사용자가 카드 버튼을 눌러야' 일어난다(LLM 은 트리거만 제안).
   =================================================================== */

function assistReportTimestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// 지라에 그대로 붙여넣을 제보 본문 + 절차 안내.
function assistBuildJiraGuideText(meta, extras) {
  meta = meta || {};
  extras = extras || {};
  const stamp = (typeof B2B_BUILD_STAMP === "string") ? B2B_BUILD_STAMP : "(버전 미상)";
  const steps = Array.isArray(state.pipeline) ? state.pipeline : [];
  const skillName = String(state.logicSaveBaseName || "").trim() || "(이름 없는 스킬)";
  const files = (state.inputsOriginal || []).map(f => f && f.name).filter(Boolean);
  const lines = [
    "==========================================",
    " AX-Cell — 이슈 제보 안내",
    "==========================================",
    "",
    "이 zip 하나에 재현에 필요한 것이 모두 들어 있습니다.",
    "(입력 파일 + 스킬 + 진단 기록 + 대화록)",
    "",
    "------------------------------------------",
    "1) 어디에 제보하나요?",
    "------------------------------------------",
    "- 사내 지라: https://lgucorp.atlassian.net  (SBAGENT 프로젝트)",
    "- 왼쪽 위 [만들기] 버튼 → 프로젝트: SBAGENT → 유형: 버그",
    "- 지라 접근이 안 되면 담당자에게 이 zip 을 그대로 전달해 주세요.",
    "",
    "------------------------------------------",
    "2) 제목은 이렇게",
    "------------------------------------------",
    `- 예) [${skillName}] ${String(meta.summary || "증상 한 줄").slice(0, 60)}`,
    "",
    "------------------------------------------",
    "3) 설명에 아래를 붙여넣고 빈칸을 채워 주세요",
    "------------------------------------------",
    "■ 하려던 작업:",
    "  (예: 4월 정산 파일에서 사업자별 합계 뽑기)",
    "",
    "■ 실제로 벌어진 일(증상):",
    `  ${String(meta.summary || "").trim() || "(여기에 증상을 적어 주세요)"}`,
    "",
    "■ AI 도움에서 확인한 것:",
    `  ${String(meta.reason || "").trim() || "(AI 도움이 해결하지 못한 이유)"}`,
    meta.tried ? `  시도한 것: ${String(meta.tried).trim()}` : "",
    "",
    "■ 재현 순서:",
    "  1. 이 zip 안의 '파일' 폴더에 있는 파일들을 입력으로 업로드",
    "  2. '스킬' 폴더의 zip 을 실행기(또는 생성기)에 업로드",
    "  3. 전체실행",
    "  4. (몇 단계에서 / 어떤 화면에서 문제가 나는지 적어 주세요)",
    "",
    "■ 환경:",
    `  - 프로그램 버전: ${stamp}`,
    `  - 발생 시각: ${new Date().toLocaleString("ko-KR")}`,
    `  - 스킬 단계 수: ${steps.length}`,
    files.length ? `  - 입력 파일: ${files.join(" / ")}` : "  - 입력 파일: (없음)",
    "",
    "------------------------------------------",
    "4) 첨부",
    "------------------------------------------",
    "- 이 zip 파일을 통째로 첨부해 주세요.",
    extras.missingNote ? `- 주의: ${extras.missingNote}` : "",
    "",
    "------------------------------------------",
    "※ 보안 주의",
    "------------------------------------------",
    "- 실제 고객/정산 데이터가 들어 있습니다. 사내 지라·담당자 외부로 보내지 마세요.",
    "",
  ];
  return lines.filter(l => l !== null && l !== undefined).join("\r\n");
}

// 진단 스냅샷 — 개발자가 zip 만 열어도 첫 단서를 얻게.
function assistBuildDiagnosticsText() {
  const out = [];
  const dump = (title, name) => {
    out.push("### " + title);
    try {
      const t = ASSIST_TOOLS[name];
      out.push(JSON.stringify(t ? t.fn({}) : { ok: false, error: "tool missing" }, null, 2));
    } catch (err) {
      out.push("(수집 실패: " + String(err && err.message).slice(0, 120) + ")");
    }
    out.push("");
  };
  dump("단계 목록", "pipeline.list");
  dump("적용 상태 진단", "diag.stepStatus");
  dump("실행 전 점검", "preflight.check");
  dump("코드 속 하드코딩", "literals.scan");
  try {
    if (state.lastError) {
      out.push("### 마지막 오류");
      out.push(JSON.stringify(state.lastError, null, 2).slice(0, 4000));
    }
  } catch (_) {}
  return out.join("\r\n");
}

function assistBuildConversationText() {
  const hist = (state.assist && state.assist.history) || [];
  return hist.map(m => `[${m.role === "user" ? "사용자" : "AI"}] ${m.content}`).join("\r\n\r\n")
    || "(대화 없음)";
}

/**
 * 제보 패키지를 만들어 다운로드한다. 사용자 버튼 클릭에서만 호출할 것.
 * @returns {Promise<{ok, fileName, included:string[], missing:string[]}>}
 */
async function assistPrepareReportBundle(meta) {
  const included = [];
  const missing = [];
  const entries = [];

  // 1) 스킬 zip (중첩 — 그대로 실행기에 올릴 수 있는 형태)
  try {
    const base = String(state.logicSaveBaseName || "스킬").trim() || "스킬";
    const stepN = (state.pipeline || []).length;
    if (stepN > 0 && typeof buildLogicZipEntries === "function" && typeof createZipBlob === "function") {
      const skillEntries = buildLogicZipEntries(base);
      const blob = createZipBlob(skillEntries);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      entries.push({ name: `스킬/${base}_${stepN}단계.zip`, bytes });
      included.push(`스킬 zip (${stepN}단계)`);
    } else if (stepN === 0) {
      missing.push("스킬(단계가 없음)");
    }
  } catch (err) {
    missing.push("스킬 zip (" + String(err && err.message).slice(0, 80) + ")");
  }

  // 2) 입력/출력 원본 — 백엔드 보관본에서 회수(클라 메모리에는 원본 바이트가 없다).
  const pulls = [];
  (state.inputsOriginal || []).forEach(f => { if (f && f.name) pulls.push({ role: "입력", f }); });
  (state.outputTemplates || []).forEach(t => {
    const f = t && t.original;
    if (f && f.name) pulls.push({ role: "출력템플릿", f });
  });
  for (const { role, f } of pulls) {
    // [문서보안 0.7.5] 이 fetch 는 '사람에게 저장'이 아니라 제보 첨부용 내부 읽기 — 보안 재적용을
    // 건너뛴다(plain=1). 재적용하면 첨부를 열어 볼 수 없다.
    const rawUrl = f.backendDownloadUrl
      || (f.backendWorkbookId ? `/api/workbooks/source/${encodeURIComponent(f.backendWorkbookId)}` : null);
    const url = rawUrl ? rawUrl + (rawUrl.includes("?") ? "&" : "?") + "plain=1" : null;
    if (!url) {
      missing.push(`${role} ${f.name} (원본 미보관 — 제보 시 직접 첨부 필요)`);
      continue;
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const bytes = new Uint8Array(await resp.arrayBuffer());
      entries.push({ name: `파일/${role}_${f.name}`, bytes });
      included.push(`${role} ${f.name}`);
    } catch (err) {
      missing.push(`${role} ${f.name} (다운로드 실패: ${String(err && err.message).slice(0, 60)})`);
    }
  }

  // 3) 텍스트 기록들
  const missingNote = missing.length
    ? `다음 항목은 자동으로 담지 못했습니다 — 직접 첨부해 주세요: ${missing.join(", ")}`
    : "";
  entries.push({ name: "제보양식.txt", text: assistBuildJiraGuideText(meta, { missingNote }), mime: "text/plain" });
  entries.push({ name: "진단.txt", text: assistBuildDiagnosticsText(), mime: "text/plain" });
  entries.push({ name: "대화록.txt", text: assistBuildConversationText(), mime: "text/plain" });
  included.push("제보양식.txt / 진단.txt / 대화록.txt");

  const fileName = `이슈제보_${assistReportTimestamp()}.zip`;
  try {
    downloadZip(entries, fileName);
  } catch (err) {
    return { ok: false, fileName, included, missing,
             error: "zip 생성 실패: " + String(err && err.message).slice(0, 120) };
  }
  return { ok: true, fileName, included, missing };
}
