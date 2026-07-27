/* ===================================================================
   녹화 스텝 의도 검토 (P4)
   - llmRegroupRecordedSteps(steps): 결정론(역할) 묶음을 LLM 이 업무 의도
     단위로 재그룹핑 + 제목/의도 요약. 실패/비가용 시 null (호출측 폴백).
   - showRecordReviewDialog(entries): 삽입 전 의도 카드 검토 모달.
     resolve: 선택된 entries 배열 | null(취소)
   =================================================================== */

const RECORD_REGROUP_SYSTEM = `당신은 엑셀 업무 자동화 스킬 정리 도우미입니다.
사용자가 엑셀에서 직접 작업한 것을 녹화해 만든 스텝 목록이 주어집니다.
연속된 스텝들이 같은 업무 의도(예: "4월 시트 준비", "단가 입력", "보고서 서식 정리")에
속하면 하나의 묶음으로 합치고, 묶음마다 짧은 제목과 의도 한 문장을 답니다.

규칙(엄수):
- 출력은 JSON 하나만. 설명/마크다운/코드펜스 금지.
- 형식: {"groups":[{"indices":[0,1],"title":"...","intent":"..."}]}
- indices 는 입력 i 값. 각 묶음은 연속 오름차순이어야 하고(예: [2,3,4]),
  모든 i 가 정확히 한 번씩 나와야 하며, 묶음 순서는 원래 순서 그대로.
- 순서를 바꾸거나 스텝을 빼면 재현이 깨집니다. 절대 금지.
- 한 묶음에 속한 입력들의 stepCount 합이 40을 넘으면 안 됩니다(실행 예산).
  넘을 것 같으면 그 입력들은 합치지 마세요.
- title 은 4~30자 한국어 명사구 — 대상 시트/월/업무가 드러나게(좋음: "4월 정산 시트 값 입력",
  나쁨: "값 입력", "작업 1"). intent 는 "왜 했는지" 한 문장.
- sheets(대상 시트)와 description 의 범위를 근거로 판단하세요. 같은 시트에 대한 연속
  작업(값 입력→서식→병합)은 대개 하나의 업무 의도입니다.
- [비연속 병합 금지 — 최우선] 같은 시트라도 그 사이에 다른 스텝이 끼어 인덱스가 떨어져
  있으면(비연속) 절대 합치지 마세요. 오직 '바로 이웃한(연속된)' 인덱스만 한 묶음이 될 수
  있습니다. 시트가 같다는 이유로 멀리 떨어진 스텝을 끌어모으면 순서가 깨져 재현이 실패합니다.
- 확신이 없으면 합치지 말고 입력 묶음을 그대로 두세요.

예시 — 입력이
[{"i":0,"role":"literal_data","sheets":["4월정산"],"stepCount":8,...},
 {"i":1,"role":"format","sheets":["4월정산"],"stepCount":3,...},
 {"i":2,"role":"copy","sheets":["요약"],"stepCount":5,...}]
이면 출력은
{"groups":[{"indices":[0,1],"title":"4월정산 시트 값·서식 정리","intent":"당월 정산값을 채우고 표 서식을 맞춤"},
 {"indices":[2],"title":"요약 시트로 결과 복사","intent":"정산 결과를 보고용 요약 시트에 옮김"}]}

반례(절대 하지 말 것) — 입력이
[{"i":0,"sheets":["요약"]},{"i":1,"sheets":["원본"]},{"i":2,"sheets":["원본"]},{"i":3,"sheets":["요약"]}]
일 때 요약이 같다고 {"groups":[{"indices":[0,3]},{"indices":[1,2]}]} 로 묶으면 인덱스가 비연속(0,3)이라 금지입니다.
올바른 출력은 이웃한 것만 묶은
{"groups":[{"indices":[0],"title":"요약 값 입력","intent":"..."},{"indices":[1,2],"title":"원본 시트 정리","intent":"..."},{"indices":[3],"title":"요약 서식","intent":"..."}]}`;

function _recordStepsSummary(steps) {
  return JSON.stringify(steps.map((s, i) => ({
    i,
    title: s.title || "",
    description: String(s.description || "").slice(0, 160),
    role: s.role || "",
    sheets: (s.sheets || []).slice(0, 4),
    stepCount: Number(s.stepCount) || _estimateSubsteps(s),
    hazards: (s.hazards || []).map((h) => String(h).split("—")[0].trim()),
  })), null, 0);
}

// 재그룹 프롬프트의 실제 토큰 추정치(≈ 요약 문자열 길이 / 4 + 시스템 프롬프트 오버헤드).
// 개수 게이트('entries<=24')는 카드가 작아도 많으면 축소기를 꺼버렸다 — 재그룹은 카드의
// '요약'만 보내므로(코드 본문 아님) 카드가 많아도 요약 총량이 작으면 안전히 돌릴 수 있다.
// pipeline.js 정지 핸들러가 이 값으로 토큰 예산 게이트를 판정한다.
function estimateRegroupPromptTokens(steps) {
  if (!Array.isArray(steps) || !steps.length) return 0;
  const summaryChars = _recordStepsSummary(steps).length;
  const systemChars = (typeof RECORD_REGROUP_SYSTEM === "string")
    ? RECORD_REGROUP_SYSTEM.length : 800;
  return Math.ceil((summaryChars + systemChars) / 4);
}

function _validRegroup(groups, n) {
  if (!Array.isArray(groups) || !groups.length) return false;
  const flat = [];
  for (const g of groups) {
    if (!g || !Array.isArray(g.indices) || !g.indices.length) return false;
    for (let k = 0; k < g.indices.length; k++) {
      const v = Number(g.indices[k]);
      if (!Number.isInteger(v)) return false;
      if (k > 0 && v !== Number(g.indices[k - 1]) + 1) return false; // 연속 오름차순
      flat.push(v);
    }
  }
  if (flat.length !== n) return false;
  return flat.every((v, idx) => v === idx); // 전체 = 0..n-1 순서 그대로
}

// 병합 허용 상한 — record_service.chunk_groups(limit=40)와 같은 값. 이보다 큰 묶음은
// 실행기 COM 예산 초과 위험이 있어 LLM 이 합쳐도 도로 풀어 원본 묶음을 유지한다.
const RECORD_MERGE_SUBSTEP_LIMIT = 40;

function _estimateSubsteps(entry) {
  // 구버전 서버(stepCount 미제공) 폴백 — 코드의 실제 실행문(ctx. 호출) 수로 추정.
  const lines = String((entry && entry.code) || "").split("\n");
  const n = lines.filter((l) => l.trim().startsWith("ctx.")).length;
  return n || 1;
}

function _mergeTransformCode(codes) {
  // 각 코드는 record_service 가 생성한 "def transform(ctx):\n<본문>" 형태.
  const bodies = codes.map((c) => {
    const lines = String(c || "").split("\n");
    const at = lines.findIndex((l) => l.trim().startsWith("def transform"));
    return lines.slice(at + 1).filter((l) => l.trim() !== "").join("\n");
  });
  return "def transform(ctx):\n" + (bodies.filter(Boolean).join("\n") || "    pass") + "\n";
}

async function llmRegroupRecordedSteps(steps, opts) {
  if (!Array.isArray(steps) || steps.length < 2) return null;
  if (typeof callLLMOneShot !== "function") return null;
  let raw;
  try {
    raw = await callLLMOneShot(RECORD_REGROUP_SYSTEM, _recordStepsSummary(steps),
      { maxTokens: 900, signal: opts && opts.signal, forceNoThink: true });
  } catch (err) {
    return null; // LLM 비가용/타임아웃 → 결정론 묶음 폴백
  }
  let parsed;
  try {
    const m = String(raw || "").match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : null;
  } catch (err) {
    parsed = null;
  }
  const groups = parsed && parsed.groups;
  if (!_validRegroup(groups, steps.length)) return null;
  if (groups.length === steps.length) return null; // 재그룹 없음 → 원본 유지
  return groups.flatMap((g) => {
    const members = g.indices.map((i) => steps[i]);
    // [COM 예산 보호] chunk_groups 가 40스텝 이하로 일부러 쪼갠 묶음을 LLM 이 도로 합치면
    // 한 스텝(=run-python 1회)이 예산(PY_COM_BUDGET)을 넘어 중간 실패 → 부분 적용으로
    // 재현 결과가 꼬인다. 병합 후 원시 스텝 합계가 한도를 넘으면 병합하지 않고 원본 유지.
    const substeps = members.reduce((n, s) => n + (Number(s.stepCount) || _estimateSubsteps(s)), 0);
    if (members.length > 1 && substeps > RECORD_MERGE_SUBSTEP_LIMIT) return members;
    const hazards = [];
    const sheets = [];
    members.forEach((s) => {
      (s.hazards || []).forEach((h) => { if (!hazards.includes(h)) hazards.push(h); });
      (s.sheets || []).forEach((sh) => { if (!sheets.includes(sh)) sheets.push(sh); });
    });
    return {
      ...members[0],
      code: _mergeTransformCode(members.map((s) => s.code)),
      title: String(g.title || members[0].title || "").slice(0, 40),
      description: String(g.intent || members.map((s) => s.description).join(" → ")).slice(0, 200),
      prompt: `[녹화됨] ${g.title || members[0].title}: ${g.intent || ""}`,
      hazards,
      sheets,
      stepCount: members.reduce((n, s) => n + (Number(s.stepCount) || _estimateSubsteps(s)), 0),
      mergedCount: members.length,
    };
  });
}

/* ── P5: 자연어 의도 반영 — 카드별 추가 의도를 LLM 이 코드에 반영 ── */

const RECORD_INTENT_FALLBACK_SYSTEM = `당신은 엑셀 자동화 Python 코드 수정 도우미입니다.
코드는 ctx API(벌크 read/write/sort/apply_format_state 등)만 사용하며,
def transform(ctx): 함수 하나로 구성됩니다. 셀 단위 루프 금지.
출력은 수정된 코드 전체를 \`\`\`python 블록 하나로만.`;

// [P5 안전망] 의도 반영은 LLM 이 코드를 통째로 다시 쓰는 경로라, 잘못 나오면 결정적
// 재현이 통째로 깨진다. ctx API 밖으로 나가는 구문이 보이면 반영을 포기하고 녹화
// 원본을 유지한다(호출측 null 폴백). 과탐이어도 안전한 방향(원본 유지)으로만 틀린다.
const RECORD_INTENT_FORBIDDEN = [
  /\bimport\b/, /__import__/, /\bexec\s*\(/, /\beval\s*\(/, /\bcompile\s*\(/,
  /\bopen\s*\(/, /\bsubprocess\b/, /\bos\./, /\bsys\./, /\bglobals\s*\(/,
];

const RECORD_INTENT_FORBIDDEN_VBA = [
  /\bShell\b/i, /\bKill\b/i, /CreateObject\s*\(\s*["']W?Script/i,
  /\bEnviron\b/i, /\bSendKeys\b/i, /FileSystemObject/i,
];

function _extractVbaCode(raw) {
  const m = String(raw || "").match(/```(?:vba)?\s*\n([\s\S]*?)```/i);
  let code = m ? m[1] : String(raw || "");
  if (!/\bSub\s+B2BSkill\b/i.test(code)) return null;
  if (RECORD_INTENT_FORBIDDEN_VBA.some((re) => re.test(code))) return null; // 위험 구문 → 원본 유지
  // [// 주석 교정] LLM 이 VBA 에 C 계열 주석(//)을 섞는 사고 — VBA 컴파일 오류라 숨김 인스턴스
  // Application.Run 이 VBE 모달로 영구 블록됐다(실측 14:45 의도 반영 코드). 줄머리 // 는 ' 로
  // 변환(의미 무손실), 줄 중간 // 가 남으면 이 조각을 거부해 원본 유지로 폴백시킨다.
  code = code.split(/\r?\n/).map((line) => {
    const st = line.replace(/^\s*/, "");
    return st.startsWith("//") ? line.slice(0, line.length - st.length) + "'" + st.slice(2) : line;
  }).join("\n");
  const _noStr = code.replace(/"(?:[^"]|"")*"/g, '""');
  if (_noStr.split(/\r?\n/).some((l) => { const i = l.indexOf("'"); return (i >= 0 ? l.slice(0, i) : l).includes("//"); })) return null;
  return code.trim() + "\n";
}

function _extractPythonCode(raw) {
  const m = String(raw || "").match(/```(?:python)?\s*\n([\s\S]*?)```/);
  const code = m ? m[1] : String(raw || "");
  if (!code.includes("def transform")) return null;
  if (RECORD_INTENT_FORBIDDEN.some((re) => re.test(code))) return null; // 위험 구문 → 원본 유지
  if (!/\bctx\./.test(code)) return null; // ctx 호출이 하나도 없으면 재현 불능 코드
  return code.trim() + "\n";
}

// [병합 불변] 병합은 좌상단 외 셀 값을 지우는 파괴적 연산 — LLM 재작성이 행별 merge
// 여러 개를 한 범위로 '정리'하면 아래 행 값/수식이 통째로 사라진다(실사례: E16:F22
// 통짜 병합). 재작성 전후 병합 시그니처가 다르면 원본을 유지한다.
// 엔진 불문 시그니처: ctx.merge/unmerge + apply_format_state 의 merge_area/merge 플래그
// + VBA Range(...).Merge / .MergeCells=True 까지 전부 잡는다 — 에러복구가 VBA 로
// 갈아타며 병합을 '정리'하는 우회까지 차단(chat-ui 복구 경로에서 공유).
function mergeInvariantSignature(code) {
  const s = String(code || "");
  const toks = [];
  (s.match(/ctx\.(?:merge|unmerge)\(\s*[^)]*\)/g) || [])
    .forEach((m) => toks.push("py:" + m.replace(/\s+/g, "")));
  (s.match(/merge_area['"]?\s*:\s*['"][^'"]+['"]/g) || [])
    .forEach((m) => toks.push("fmt:" + m.replace(/\s+/g, "")));
  (s.match(/['"]merge['"]\s*:\s*(?:True|true|1)/g) || [])
    .forEach(() => toks.push("fmt:mergeflag"));
  (s.match(/Range\(\s*"[^"]+"\s*\)[^\n]*?\.Merge\b/g) || [])
    .forEach((m) => toks.push("vba:" + m.replace(/\s+/g, "")));
  const bareMerge = (s.match(/\.Merge\b/g) || []).length;
  if (bareMerge) toks.push("mergeN:" + bareMerge);
  (s.match(/\.MergeCells\s*=\s*(?:True|true)/g) || [])
    .forEach(() => toks.push("vba:mergecells"));
  return toks.sort().join("|");
}

function _mergeCallSignature(code) {
  return mergeInvariantSignature(code);
}

/* ── 거대 값 리터럴 보호 ─────────────────────────────────────────
   녹화 스킬(특히 붙여넣기 통합)은 수천~수만 셀의 [[...]] 리터럴을 품는다. 이걸
   LLM 수정/복구 프롬프트에 그대로 보내면 ① 토큰 폭발 ② 모델이 재출력하다 생략/
   요약("...이하 동일")해 코드가 깨진다 → '수정 적용마다 오류'. 프롬프트에 넣기 전
   placeholder 로 치환하고, 응답을 적용하기 전 원본 리터럴로 복원한다. */

const GRID_PROTECT_MIN_CHARS = 400;

function protectLargeGridLiterals(code) {
  const grids = [];
  const out = String(code || "").replace(/\[\[[\s\S]*?\]\]/g, (m) => {
    if (m.length < GRID_PROTECT_MIN_CHARS) return m;
    grids.push(m);
    return `__B2B_GRID_${grids.length - 1}__`;
  });
  return { code: out, grids };
}

function restoreLargeGridLiterals(code, grids) {
  let s = String(code || "");
  (grids || []).forEach((g, i) => {
    s = s.split(`__B2B_GRID_${i}__`).join(g);
  });
  return s;
}

function stashGridVault(stepId, grids) {
  if (grids && grids.length) {
    window.__b2bGridVault = { stepId, grids };
  }
}

function gridVaultFor(stepId) {
  const v = window.__b2bGridVault;
  return (v && v.stepId === stepId && v.grids && v.grids.length) ? v.grids : null;
}

async function llmApplyIntentToStep(entry, intentText, batchCtx) {
  if (typeof callLLMOneShot !== "function") return null;
  // 네이티브 매크로 녹화(VBA 청킹) 카드는 VBA 프롬프트로 수정한다.
  const isVba = String(entry.language || "").toLowerCase() === "vba"
    || /\bSub\s+B2BSkill\b/i.test(String(entry.code || ""));
  const system = isVba
    ? ((typeof VBA_SYSTEM_PROMPT !== "undefined" && VBA_SYSTEM_PROMPT) || RECORD_INTENT_FALLBACK_SYSTEM)
    : ((typeof PYTHON_COM_SYSTEM_PROMPT !== "undefined" && PYTHON_COM_SYSTEM_PROMPT) || RECORD_INTENT_FALLBACK_SYSTEM);
  const fence = isVba ? "vba" : "python";
  // [스텝 간 계약 컨텍스트] 의도 반영이 조각마다 독립이면 좌표 계약이 깨진다(실측 15:30:
  // 3조각 의도가 합계를 '마지막 행' 동적으로 옮겼는데 4조각 의도 반영은 그걸 모른 채 G14
  // 하드코딩+검증 가드를 유지 → 재현이 "데이터가 부족합니다"로 사망). 앞뒤 조각 코드와
  // 같은 배치의 다른 의도를 함께 보여 계약을 유지시킨다. 순차 처리라 앞 조각은 이미 반영본.
  let neighborBlock = "";
  try {
    const entries = (batchCtx && batchCtx.entries) || [];
    const idx = entries.indexOf(entry);
    const parts = [];
    for (const off of [-1, 1]) {
      const nb = entries[idx + off];
      if (!nb || !nb.code) continue;
      const nbCode = protectLargeGridLiterals(String(nb.code)).code;
      parts.push(`[${off < 0 ? "직전" : "직후"} 조각: ${nb.title || nb.description || ""}]\n`
        + nbCode.slice(0, 700));
    }
    const otherIntents = ((batchCtx && batchCtx.jobs) || [])
      .filter((j) => j && j.intent && j.entry !== entry)
      .map((j) => `- "${j.entry && (j.entry.title || j.entry.description) || ""}" 조각의 추가 의도: ${j.intent}`);
    if (parts.length || otherIntents.length) {
      neighborBlock = [
        "",
        "[참고 — 앞뒤 조각과 다른 의도들. 이 조각과의 셀/좌표 계약을 깨지 마세요]",
        ...parts,
        ...(otherIntents.length ? ["다른 조각들의 추가 의도:", ...otherIntents] : []),
      ].join("\n");
    }
  } catch (_) {}
  const user = [
    "아래는 사용자가 엑셀에서 직접 작업한 것을 녹화해 만든 스킬 코드입니다.",
    "```" + fence, String(entry.code || ""), "```",
    `이 묶음의 의도: ${entry.title || ""} — ${entry.description || ""}`,
    "",
    `사용자가 추가로 요청한 의도: ${intentText}`,
    neighborBlock,
    "",
    "요청 의도를 반영해 코드를 수정하세요. 대상 시트/파일명과 동작 순서는 유지하고,",
    "녹화된 고정 범위가 의도와 어긋나면 ctx.last_row/find_header 등으로 동적으로 바꾸세요.",
    "직전 조각이 쓰는 위치를 동적으로 계산하게 됐다면(예: 마지막 데이터 행), 이 조각도 같은",
    "동적 기준으로 그 위치를 다시 찾으세요 — 옛 고정 좌표(G14 등)를 그대로 두면 어긋납니다.",
    "⚠ 한 행 밀림 함정: 직전 조각이 '마지막 데이터 행+1' 행에 라벨·합계를 이미 썼다면, 이 조각이",
    "마지막 행을 재계산할 때 그 산출물까지 데이터로 세어 한 행 밀립니다(실측: 라벨 122행, 숫자 123행).",
    "직전 조각이 쓴 행에 이어서 써야 하면 재계산하지 말고 **그 산출물을 찾아 같은 행에** 쓰세요 —",
    '예: sumRow = Application.Match("합계", ws.Columns("A"), 0). 찾을 라벨이 없으면 직전 조각이',
    "쓰지 않은 열 기준으로만 마지막 행을 계산하세요.",
    "확인/방어용 Err.Raise 가드를 새로 넣지 마세요 — 재현 전체를 중단시킵니다(값이 없으면 없는 대로 진행).",
    "출력은 수정된 코드 전체를 ```" + fence + " 블록 하나로만.",
  ].join("\n");
  try {
    const raw = await callLLMOneShot(system, user, { maxTokens: 1600, forceNoThink: true });
    const revised = isVba ? _extractVbaCode(raw) : _extractPythonCode(raw);
    if (!revised) return null;
    // 병합 불변 가드 — 재작성이 merge/unmerge 호출을 바꿨으면 원본 유지(파괴적 병합 확장 차단)
    if (_mergeCallSignature(entry.code) !== _mergeCallSignature(revised)) return null;
    return revised;
  } catch (err) {
    return null;
  }
}

/* ── P6: 기존 ctx 헬퍼로 통합 — 저수준 다중 호출을 벌크 호출로(서버 등가 게이트) ──
   녹화가 셀/행마다 남긴 ctx.write/write_formulas/서식 호출을, 서버가 vLLM 으로 '기존
   ctx 헬퍼'만 써서 범위 하나로 재작성한다. 서버는 원본과 후보를 MemCtx 로 재현해 전 시트
   결과가 완전히 같을 때만 통합본을 돌려주므로(다르면 원본), 순서·값이 꼬이지 않는다. */
async function llmConsolidateEntries(entries) {
  if (typeof postExcelMirror !== "function" || !Array.isArray(entries)) return entries;
  // [속도] 묶음마다 순차 대기(최대 N×30초)하지 않고 병렬로 보낸다. 각 호출은 독립이고
  // 실패는 그 묶음만 원본 유지라 상호 간섭이 없다. 저사양 vLLM 도 큐잉은 서버가 하므로
  // 총 소요는 '가장 느린 1건'에 수렴한다.
  await Promise.all(entries.map(async (e) => {
    const code = e && e.code;
    // ctx 호출이 2회 미만이면 통합 여지 없음 → 서버 호출 생략(불필요한 LLM 대기 방지).
    if (!code || (code.match(/ctx\./g) || []).length < 2) return;
    try {
      const r = await postExcelMirror("/api/skill/consolidate", { code }, 0, { timeoutMs: 30000 });
      if (r && r.consolidated && r.code) {
        e.code = r.code;
        e.consolidatedCalls = r.calls || null;  // [원본호출수, 통합호출수]
      }
    } catch (err) { /* 보조 기능 — 실패 시 원본 유지(재현 안전) */ }
  }));
  return entries;
}

function showRecordReviewDialog(entries, meta) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal");
    const bg = document.getElementById("modal-bg");
    if (!modal || !bg) return resolve(entries); // 모달 없으면 전부 삽입
    const id = "recrev-" + Math.random().toString(36).slice(2, 8);
    // 설명이 길면(예: "서식 (1~40/214스텝) — 서식: 요약!A1 → …") 카드가 글자벽이 돼 읽기 어렵다.
    // 제목 위주로 보이고 상세는 한 줄로 줄여(title 속성으로 전체는 hover) 가독성을 확보한다.
    const clip = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
    const cards = entries.map((e, i) => {
      const nSub = Number(e.stepCount) || 0;
      const sheetsTxt = (e.sheets || []).slice(0, 2).join(", ")
        + ((e.sheets || []).length > 2 ? ` 외 ${e.sheets.length - 2}` : "");
      const badges = [
        `<small style="background:#eef;border-radius:6px;padding:1px 6px;color:#446">${i + 1}단계</small>`,
        nSub ? `<small style="background:#f2f2f2;border-radius:6px;padding:1px 6px;color:#555">${nSub}동작</small>` : "",
        sheetsTxt ? `<small style="background:#efe;border-radius:6px;padding:1px 6px;color:#464"
          title="${escapeHtml((e.sheets || []).join(", "))}">${escapeHtml(clip(sheetsTxt, 28))}</small>` : "",
      ].filter(Boolean).join(" ");
      return `
      <div style="border:1px solid #ddd;border-radius:8px;padding:8px 10px;margin:6px 0">
        <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">
          <input type="checkbox" name="${id}" value="${i}" checked style="margin-top:3px">
          <span style="flex:1;min-width:0">
            ${badges} <b>${escapeHtml(clip(e.title || "묶음 " + (i + 1), 48))}</b>
            ${e.mergedCount > 1 ? `<small style="color:#666"> · ${e.mergedCount}묶음 병합</small>` : ""}
            <br><small style="color:#555;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
              title="${escapeHtml(e.description || "")}">${escapeHtml(clip(e.description || "", 90))}</small>
            ${(e.hazards || []).slice(0, 2).map((h) => `<br><small style="color:#b26a00">⚠ ${escapeHtml(clip(h, 60))}</small>`).join("")}
            ${(e.hazards || []).length > 2 ? `<br><small style="color:#b26a00">⚠ 외 ${e.hazards.length - 2}건</small>` : ""}
          </span>
        </label>
        <input type="text" id="${id}-intent-${i}" placeholder="추가 의도(선택) — 예: 합계 행은 항상 마지막 데이터 행 아래에"
          style="width:100%;margin-top:6px;font-size:12px;padding:4px 6px;box-sizing:border-box">
      </div>`;
    }).join("");
    modal.innerHTML = `
      <h3>녹화 검토 — 의도 ${entries.length}묶음</h3>
      <p style="color:#666;font-size:13px;margin:4px 0 8px">${escapeHtml(meta || "")}
        카드는 <b>위에서 아래 순서 그대로</b> 재현됩니다. 체크된 묶음만 스킬 단계로 추가됩니다.
        ⚠ 표시는 다음 파일/다음 달 재현 시 확인이 필요한 항목입니다.
        추가 의도를 적으면 추가 시 AI가 코드에 반영합니다.</p>
      <div class="row" style="margin:0 0 6px">
        <button class="btn-secondary" id="${id}-toggle-all" style="font-size:12px;padding:2px 10px">전체 해제</button>
      </div>
      <div style="max-height:340px;overflow:auto">${cards}</div>
      <div class="row" style="margin-top:10px">
        <button class="btn-secondary" id="${id}-cancel">취소</button>
        <button class="btn-primary" id="${id}-ok">파이프라인에 추가</button>
      </div>`;
    bg.classList.add("show");
    const close = (result) => { bg.classList.remove("show"); resolve(result); };
    document.getElementById(id + "-cancel").onclick = () => close(null);
    const toggleBtn = document.getElementById(id + "-toggle-all");
    toggleBtn.onclick = () => {
      const boxes = [...document.querySelectorAll(`input[name="${id}"]`)];
      const anyChecked = boxes.some((b) => b.checked);
      boxes.forEach((b) => { b.checked = !anyChecked; });
      toggleBtn.textContent = anyChecked ? "전체 선택" : "전체 해제";
    };
    const okBtn = document.getElementById(id + "-ok");
    okBtn.onclick = async () => {
      const jobs = [...document.querySelectorAll(`input[name="${id}"]:checked`)]
        .map((el) => {
          const i = Number(el.value);
          const intentEl = document.getElementById(`${id}-intent-${i}`);
          return { entry: entries[i], intent: (intentEl && intentEl.value.trim()) || "" };
        });
      const withIntent = jobs.filter((j) => j.intent);
      if (withIntent.length) {
        okBtn.disabled = true;
        okBtn.textContent = `… 의도 반영 중 (${withIntent.length}건)`;
        for (const j of withIntent) {
          const revised = await llmApplyIntentToStep(j.entry, j.intent, { entries, jobs: withIntent });
          if (revised) {
            j.entry.code = revised;
            j.entry.description = `${j.entry.description} · 의도 반영: ${j.intent}`;
            j.entry.prompt = `${j.entry.prompt} / 추가 의도: ${j.intent}`;
          } else {
            j.entry.description = `${j.entry.description} · (의도 반영 실패 — 원본 유지: ${j.intent})`;
          }
        }
      }
      close(jobs.map((j) => j.entry));
    };
  });
}

/* ===================================================================
   P7: 녹화 VBA 분할 + 의도색
   - 백엔드 VBA 녹화는 스텝 1개(Sub B2BSkill …)만 돌려준다. 이걸 업무 의도 단위
     N조각(각각 독립 실행 가능한 Sub B2BSkill)으로 LLM 이 쪼갠다 → 파이프라인에서
     스텝별로 켜고/끄고/수정 가능. 러너는 스텝당 Sub 를 독립 주입·실행하므로 Sub
     이름이 같아도 충돌하지 않는다.
   - 하드코딩된 월/분기/연/날짜 리터럴처럼 '다음 달/다음 파일 재현 시 값 확인이
     필요한' 조각은 intentNeeded 로 표시해(카드 의도색) 사용자가 놓치지 않게 한다.
   - 어떤 실패(미가용/타임아웃/파싱/검증)에도 null 을 돌려 호출측이 원본 1스텝
     그대로 진행하도록 한다 — 녹화 흐름을 절대 throw 로 깨지 않는다.
   =================================================================== */

const RECORD_SPLIT_SYSTEM = `당신은 엑셀 매크로(VBA) 녹화를 개별 작업 단위로 잘게 나누는 도우미입니다.
사용자가 엑셀에서 한 여러 작업이 하나의 Sub B2BSkill() 매크로로 녹화돼 주어집니다.
이걸 **가능한 한 잘게, 개별 작업(action) 단위**로 N조각으로 나누세요. 목표는 각 조각을
켜고/끄고/수정하고 "의도"를 따로 검토할 수 있게 하는 것이라, 넉넉히 나누는 편이 좋습니다.

무엇이 한 조각인가(잘게):
- 값 입력: 셀 하나(또는 =SUM 등 연속으로 채운 같은 의미의 인접 셀 묶음) 하나가 한 조각.
- 정렬 1회, 복사-붙여넣기 1회, 서식(굵게/색/병합) 1덩어리, 필터 1회, 행/열 삽입·삭제 1회,
  시트 이름변경 1회 — 각각 별개 조각.
- **월·분기·연·날짜 값을 넣는 셀은 반드시 그 자체로 별도 조각**으로 떼세요(의도 검토 대상).

절대 규칙(어기면 재현이 깨집니다):
- 순서·값 그대로. 스텝 누락·값 변경 금지. 원본의 모든 동작이 어느 한 조각엔 들어가야 함.
- 각 조각은 독립 실행 가능한 완결된 "Sub B2BSkill() ... End Sub".
- 시트 선택(Sheets("...").Select) 재삽입은 **원본 코드에 실제로 있는 Select 만** 허용:
  원본에서 그 작업 앞(같은 창 구간)에 있던 Sheets("X").Select 를 조각 맨 앞에 다시 넣는 건 좋음.
  **원본에 없는 Sheets().Select 를 새로 만들어 넣는 것은 절대 금지** — 특히 창 전환
  Windows("파일").Activate 직후에 임의의 시트명을 붙이지 마세요. 다른 워크북엔 그 시트가
  없어서 즉시 오류가 납니다. 창은 자기 활성 시트를 기억하므로 Activate 만으로 충분합니다.
- 여러 워크북(창)이 나오면: 각 조각은 자기 작업이 속한 창의 Windows("파일명").Activate 로
  시작하세요(원본의 창 전환 순서 그대로). 시트 Select 는 위 규칙대로 원본에 있던 것만.
- ActiveCell. 을 쓰는 조각엔 그 앞의 Range(...).Select(무엇이 ActiveCell 인지)도 함께.
- [붙여야만 하는 것 — 이것만 예외] 새 시트 생성(Sheets.Add/Worksheets.Add)과 그 시트를 자동
  캡처 변수(예: B2B_NewSheet1)로 참조하는 줄들은 한 조각에 함께(쪼개면 시트 참조가 빈 값이 됨).
  피벗테이블(PivotTable) 관련도 한 조각.
  **복사(Copy/Cut)와 그것을 소비하는 붙여넣기(Paste/PasteSpecial)도 반드시 한 조각에** —
  클립보드 상태는 조각 경계를 넘지 못합니다(조각마다 별도 실행이라 붙여넣기 직전에 복사가 풀림).
  창 전환(Windows().Activate)이 사이에 있어도 복사~붙여넣기 구간은 통째로 한 조각입니다.
  **이 셋만 붙이고, 나머지는 최대한 잘게 나누세요.**
  ⚠ 자동 캡처 변수(B2B_NewSheetN)는 **어느 조각에서도 그 변수의 대입(= ActiveSheet.Name) 없이
  참조하면 절대 안 됩니다.** 그래서: 새 시트를 Sheets(...).Name = "확정이름" 으로 이름 지었다면,
  **생성 + 캡처변수 참조 + 이름변경까지를 첫 조각**에 함께 담고, **그 다음부터 그 시트 작업은
  확정 이름 Sheets("확정이름").Select 로** 참조해 잘게 나누세요(자동 변수 재사용 금지). 이름변경이
  없으면 그 시트의 모든 작업을 생성 조각에 함께 두세요.

각 조각에 대해:
- title: 4~30자 한국어 명사구. 대상 시트/셀/값이 드러나게("정산 시트 C2에 3월 입력" 좋음, "작업 1" 나쁨).
  **파일명(.xlsx 포함 문자열)은 title 에 절대 넣지 마세요** — 제목의 파일명이 실행기 파일 인식을
  오염시킵니다. 창 전환 조각은 "정산서로 창 전환"처럼 확장자 없이 줄여 쓰세요.
- intentNeeded(bool): 값이 월/분기/연/날짜라 다음 달·다음 파일 재현 시 사람이 바꿔줘야 하면 true
  (예 "2월","3월","1분기","2026년","2/15"). 그 외 false.
- intentReason: true 면 한 문장, false 면 빈 문자열.
- hazards: 재현 주의점(선택). 없으면 빈 배열.

출력은 JSON 하나만. 설명/마크다운/코드펜스 금지. 형식:
{"steps":[{"title":"...","code":"Sub B2BSkill()\\n...\\nEnd Sub","intentNeeded":false,"intentReason":"","hazards":[]}]}`;

// 월/분기/연/날짜 리터럴을 값·수식에 박은 조각 감지 — LLM 이 intentNeeded 를 안 달아도
// 이 정규식으로 승격한다(카드 의도색 시드). 과탐이어도 안전(안내만 뜸).
function _recordedIntentNeeded(code) {
  return /\.(?:Value|Formula|FormulaR1C1)\s*=\s*"[^"]*(?:\d{1,2}\s*월|분기|Q[1-4]|\d{4}\s*년|\d{1,2}\/\d{1,2})[^"]*"/i
    .test(String(code || ""));
}

// [데이터 보존 검증용] 코드에서 .Value/.Formula/.FormulaR1C1 대입의 우변(리터럴)을 멀티셋으로
// 뽑는다. 분할 후 조각들의 우변 멀티셋이 원본을 모두 포함해야(값 유실/변경 금지) 통과시킨다.
function _recordedAssignRhsMultiset(code) {
  const out = [];
  const re = /\.(?:Value|Formula|FormulaR1C1)\s*=\s*([^\r\n]+)/gi;
  let m;
  while ((m = re.exec(String(code || "")))) out.push(m[1].trim());
  return out.sort();
}

function _recordedMultisetContains(superset, subset) {
  const counts = Object.create(null);
  superset.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  for (const v of subset) {
    if (!counts[v]) return false;
    counts[v] -= 1;
  }
  return true;
}

// [교차창 stale Select 방지] 원본 VBA 를 줄 단위로 걸어 '어느 창(Windows/Workbooks) 활성 구간에서
// 어떤 시트가 Select 됐는가' (창,시트) 쌍을 수집한다. 창 이름 미상 구간(첫 Activate 이전)은
// initialWindow(녹화 시작 워크북명)로 간주. 비교는 소문자.
function _recordedWindowSheetPairs(code, initialWindow) {
  const pairs = new Set();      // "창||시트" — 그 창 활성 구간에서 원본이 언급한 시트
  const sheetsEver = new Set(); // 창 무관 — 원본에 등장(Select/참조/rename 대상)한 시트 전부
  let win = String(initialWindow || "").toLowerCase();
  for (const line of String(code || "").split(/\r?\n/)) {
    const w = line.match(/^\s*(?:Windows|Workbooks)\(\s*"([^"]+)"\s*\)\.Activate\b/i);
    if (w) { win = w[1].toLowerCase(); continue; }
    // 리터럴 시트 언급 전부(Select 만이 아니라 Sheets("X").Range(...) 참조 포함) — 그 창에서
    // 원본이 그 시트를 다뤘다는 증거이므로 정당한 (창,시트) 쌍으로 인정한다.
    let m; const re = /(?:Sheets|Worksheets)\(\s*"([^"]+)"\s*\)/gi;
    while ((m = re.exec(line))) { pairs.add(win + "||" + m[1].toLowerCase()); sheetsEver.add(m[1].toLowerCase()); }
    // rename 대상(.Name = "확정이름")도 정당 — 분할 프롬프트가 rename 후엔 확정 이름으로
    // Sheets("확정이름").Select 를 쓰라고 지시한다(원본엔 그 리터럴 Select 가 없어도 합법).
    const rn = line.match(/\.Name\s*=\s*"([^"]+)"/i);
    if (rn) { pairs.add(win + "||" + rn[1].toLowerCase()); sheetsEver.add(rn[1].toLowerCase()); }
  }
  return { pairs, sheetsEver };
}

// [클립보드 원자성] 조각이 붙여넣기(Paste/PasteSpecial)로 시작하는데 같은 조각 안에 선행
// 복사(Copy/Cut)가 없으면, 재생 시 반드시 죽는다 — 조각 사이 VBA 모듈 주입이 클립보드를
// 초기화하기 때문(실측 12:51: 3조각 Copy OK → 4조각 ActiveSheet.Paste 1004). 그런 조각은
// 직전 조각과 병합해 복사~붙여넣기를 원자로 만든다.
function _chunkNeedsClipboard(code) {
  const text = String(code || "");
  const p = text.search(/\.\s*Paste(?:Special)?\b/i);
  if (p < 0) return false;
  const c = text.search(/\.\s*(?:Copy|Cut)\b/i);
  return c < 0 || c > p; // 붙여넣기보다 앞선 복사가 조각 안에 없다
}

function _mergeVbaChunkPair(a, b) {
  const bodyB = String(b || "")
    .replace(/^[\s\S]*?\bSub\s+B2BSkill\s*\(\s*\)\s*\r?\n?/i, "")
    .replace(/\bEnd\s+Sub\b[\s\S]*$/i, "")
    .replace(/^\n+|\n+$/g, "");
  return String(a || "").replace(/\bEnd\s+Sub\b[\s\S]*$/i, "").replace(/\n+$/, "")
    + "\n" + bodyB + "\nEnd Sub\n";
}

// 분할 LLM 이 조각마다 컨텍스트를 재삽입하며 '원본에 없던' Sheets("X").Select 를 창 전환 직후에
// 합성하는 사례가 실측됐다(정산서 창에 청구내역 시트 Select → subscript out of range 로 재현 사망).
// 원본의 (창,시트) 쌍에 실제 존재한 Select 만 남기고 합성분은 지운다 — 창은 자기 활성 시트를
// 기억하므로, 원본이 안 하던 Select 를 지우는 쪽이 원본 재현 의미와 정확히 같다.
function _stripSynthesizedSheetSelects(chunkCode, originalCode, initialWindow) {
  const { pairs, sheetsEver } = _recordedWindowSheetPairs(originalCode, initialWindow);
  let win = ""; // 조각 시작 창 미상 — 창 미상 컨텍스트에선 원본 전체 기준(sheetsEver)으로만 느슨히 검사
  const out = [];
  let removed = 0;
  for (const line of String(chunkCode || "").split(/\r?\n/)) {
    const w = line.match(/^\s*(?:Windows|Workbooks)\(\s*"([^"]+)"\s*\)\.Activate\b/i);
    if (w) { win = w[1].toLowerCase(); out.push(line); continue; }
    const s = line.match(/^\s*(?:Sheets|Worksheets)\(\s*"([^"]+)"\s*\)\.Select\s*$/i);
    if (s) {
      const sh = s[1].toLowerCase();
      const ok = win ? pairs.has(win + "||" + sh) : sheetsEver.has(sh);
      if (!ok) { removed += 1; continue; } // 원본에 없던 (창,시트) Select — 합성분 제거
    }
    out.push(line);
  }
  if (removed) { try { console.info("[녹화분할] 합성 시트 Select " + removed + "줄 제거(원본에 없는 창·시트 조합)"); } catch (_) {} }
  return out.join("\n");
}

// 녹화된 단일 VBA 스텝을 업무 의도 단위 N조각으로 분할한다. 실패/검증불가 시 null(원본 유지).
async function llmSplitRecordedVba(entry, meta) {
  const code = entry && entry.code;
  // [진단] 어떤 실패에도 원본 1스텝 유지하되, '왜' 유지됐는지 전역+콘솔에 남긴다.
  // pipeline.js 가 이 값을 읽어 토스트로 사용자에게 노출한다(앱에서만 1스텝 나오는 원인 추적용).
  const _diag = (r) => { try { globalThis.__recordSplitDiag = r; if (typeof console !== "undefined") console.warn("[녹화분할] 원본유지:", r); } catch (_) {} return null; };
  if (!code) return _diag("코드 없음");
  // [noSplit 게이트] 피벗은 참조 구조가 복잡해 통째로 한 조각이어야 재현이 성립 — 분할 자체를 포기.
  // (새 시트 Sheets.Add 는 아래 (d) '새시트 변수 무결성' 가드로 블록만 원자 유지하며 분할 허용한다.)
  if (/PivotTable|PivotCaches/i.test(code)) return _diag("피벗 포함(noSplit 게이트)");
  if (typeof RECORD_SPLIT_SYSTEM === "undefined" || !RECORD_SPLIT_SYSTEM) return _diag("RECORD_SPLIT_SYSTEM 미정의(구버전 JS 캐시)");
  if (typeof callLLMOneShot !== "function") return _diag("callLLMOneShot 미정의");

  // 코드가 건드리는 시트명 배열(프롬프트 힌트).
  const sheets = [];
  const shre = /(?:Sheets|Worksheets)\(\s*"([^"]+)"\s*\)/g;
  let sm;
  while ((sm = shre.exec(String(code)))) { if (!sheets.includes(sm[1])) sheets.push(sm[1]); }

  const payload = {
    vba: code,
    summary: (meta && meta.summary) || "",
    targetWorkbook: (meta && meta.workbook) || "",
    sheets,
  };

  // [타임아웃 없음] 분할은 끝까지 기다린다 — 40초 컷은 조각 20개급 긴 녹화(정상 부하 생성 23초+,
  // vLLM 동시부하 시 그 이상)에서 멀쩡한 분할을 1스텝으로 폴백시켰다(실측 10:39). 폴백 비용
  // (사용자 수동 분해)이 대기 비용보다 훨씬 크므로 인위적 중단을 두지 않는다(버튼이 '분할 중' 표시).
  let raw;
  try {
    // maxTokens 는 넉넉히 — 분할 출력은 원본 VBA 를 조각마다 Select 재삽입하며 되풀이하므로
    // 입력보다 커진다. 2000 이면 서식(테두리) 많은 긴 녹화에서 JSON 이 잘려 파싱 실패→분할 무산됐다.
    raw = await callLLMOneShot(RECORD_SPLIT_SYSTEM, JSON.stringify(payload),
      { maxTokens: 8000, forceNoThink: true });
  } catch (err) {
    return _diag("LLM 호출 오류: " + ((err && err.message) || err));
  }

  let parsed, _parseErr = null;
  try {
    const m = String(raw || "").match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : null;
  } catch (err) {
    parsed = null; _parseErr = err;
  }
  const steps = parsed && parsed.steps;
  if (!Array.isArray(steps)) return _diag("JSON 파싱 실패(raw " + String(raw || "").length + "자" + (_parseErr ? ", " + _parseErr.message : ", steps 없음") + ")");
  if (steps.length < 2) return _diag("LLM이 " + steps.length + "조각만 반환(안 쪼갬)");

  // (a) 조각별 안전 검증 + 정제 코드 확보(Sub B2BSkill 존재 + 위험구문 무위반). 하나라도 실패 → 원본 유지.
  const cleaned = [];
  for (let ci = 0; ci < steps.length; ci++) {
    const c = _extractVbaCode(steps[ci] && steps[ci].code);
    if (!c) return _diag("(a) 조각 " + (ci + 1) + "/" + steps.length + " Sub 추출·안전검증 실패");
    // [교차창 stale Select 제거] LLM 이 컨텍스트 재삽입 중 원본에 없던 Sheets().Select 를
    // 합성하면(다른 창의 시트명 → subscript out of range) 결정론적으로 걷어낸다.
    cleaned.push(_stripSynthesizedSheetSelects(c, code, (meta && meta.workbook) || ""));
  }

  // [클립보드 원자성 병합] 붙여넣기 조각에 같은 조각 내 선행 복사가 없으면 직전 조각과 병합
  // — 조각 사이 모듈 주입이 클립보드를 초기화해 Paste 가 1004 로 죽는다(실측 12:51 step4).
  // steps(메타)와 cleaned(코드)를 나란히 병합한다. 첫 조각이면 병합할 곳이 없으니 그대로 둔다.
  for (let mi = 1; mi < cleaned.length; ) {
    if (_chunkNeedsClipboard(cleaned[mi])) {
      cleaned[mi - 1] = _mergeVbaChunkPair(cleaned[mi - 1], cleaned[mi]);
      const prev = steps[mi - 1] || {}, cur = steps[mi] || {};
      prev.title = [prev.title, cur.title].filter(Boolean).join(" + ");
      prev.intentNeeded = !!(prev.intentNeeded || cur.intentNeeded);
      prev.intentReason = prev.intentReason || cur.intentReason || "";
      prev.hazards = [...(prev.hazards || []), ...(cur.hazards || [])];
      cleaned.splice(mi, 1);
      steps.splice(mi, 1);
      try { console.info("[녹화분할] 붙여넣기 조각을 직전 복사 조각과 병합(클립보드 원자성)"); } catch (_) {}
      continue; // 같은 인덱스 재검사(연속 붙여넣기 병합)
    }
    mi += 1;
  }
  if (cleaned.length < 2) return _diag("클립보드 병합 후 조각 2개 미만");
  const joined = cleaned.join("\n");

  // (b) 데이터 보존 — 원본 대입 우변 리터럴 멀티셋이 조각들에 모두 포함돼야 한다(값 유실 방지).
  if (!_recordedMultisetContains(_recordedAssignRhsMultiset(joined), _recordedAssignRhsMultiset(code))) {
    return _diag("(b) 데이터 보존 실패(입력값 유실)");
  }

  // (c) 병합 불변 — 조각 전체의 병합 시그니처가 원본과 같아야 한다(파괴적 병합 확장/축소 차단).
  if (typeof mergeInvariantSignature === "function"
      && mergeInvariantSignature(joined) !== mergeInvariantSignature(code)) {
    return _diag("(c) 병합 불변 시그니처 불일치");
  }

  // (d) 새시트 캡처 변수 무결성 — 레코더가 넣은 B2B_NewSheetN(= ActiveSheet.Name)을 '참조'하는 조각은
  //     그 '대입'(B2B_NewSheetN = ...)도 반드시 같은 조각에 있어야 한다. Sheets.Add 와 이후 참조가
  //     다른 조각으로 갈리면 재현 시 조각2의 그 변수가 빈 Variant → 엉뚱한 시트/실패. 어긋나면 분할 폐기.
  for (const c of cleaned) {
    const refs = c.match(/B2B_NewSheet\d+/g) || [];
    if (!refs.length) continue;
    const assigned = new Set(c.match(/B2B_NewSheet\d+(?=\s*=(?!=))/g) || []);
    for (const r of refs) { if (!assigned.has(r)) return _diag("(d) 새시트 변수 무결성 실패(" + r + " 대입 없이 참조)"); }
  }

  const mapped = steps.map((chunk, i) => {
    const need = !!(chunk && chunk.intentNeeded) || _recordedIntentNeeded(cleaned[i]);
    const title = String((chunk && chunk.title) || "").trim();
    return {
      language: "vba",
      recorded: true,
      code: cleaned[i],
      title,
      description: title,
      prompt: "[녹화됨/VBA] " + title,
      intentNeeded: need,
      intentReason: (chunk && chunk.intentReason) || "",
      hazards: (chunk && Array.isArray(chunk.hazards)) ? chunk.hazards : [],
      stepCount: 1,
    };
  });
  if (mapped.length < 2) return _diag("최종 조각 2개 미만");
  try { globalThis.__recordSplitDiag = "OK(" + mapped.length + "조각)"; } catch (_) {}
  return mapped;
}
