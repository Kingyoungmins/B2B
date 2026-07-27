/* ===================================================================
   AI 도움 — 액션 파서 / 가드
   ===================================================================
   Qwen 급 모델이 규약을 자주 어긴다는 전제로 만든다. 원칙:
   - 파서는 절대 throw 하지 않는다. 실패하면 {action:"final"} 로 강등해 대화를 이어간다.
   - 별칭을 넓게 받아준다(tool/name/function → action, arguments/parameters/input → args).
   - 액션 블록이 여러 개면 첫 번째만 채택하고 다음 라운드에 '하나만' 노트를 준다.
   - 펜스 태그는 b2b-action 고정. json/python 을 쓰면 기존 코드 추출기가 스킬 코드로 오인한다.
   =================================================================== */

const ASSIST_FENCE = "b2b-action";
// 액션 블록 스캔 상한. replaceStepCode 의 newCode 는 pipeline.step 이 주는 코드(최대 12000자)에
// JSON 이스케이프(줄바꿈/따옴표)가 붙어 1.5~2배로 불어난다 — 8000이면 통짜 제안이 파싱 실패로
// 유실되고 원문 JSON 이 노출됐다(검토 #12). 32000 이면 12000자 코드도 여유 있게 담긴다.
const ASSIST_ACTION_SCAN_MAX = 32000;

// 응답에서 액션 JSON 을 뽑는다. 3단 폴백(펜스 → 느슨한 펜스 → 중괄호 균형 스캔).
function assistParseAction(reply) {
  const text = String(reply || "");
  const tryJson = (raw) => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) {}
    // 흔한 깨짐: 후행 콤마, 스마트 따옴표
    try {
      return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1").replace(/[""]/g, '"').replace(/['']/g, "'"));
    } catch (_) {}
    return null;
  };

  let obj = null;
  // block = 응답에서 액션으로 채택한 원문 조각. 오케스트레이터가 '사람이 읽을 부분'을 만들 때
  // 이 조각을 정확히 걷어낸다(펜스 없는 bare JSON 은 정규식 스트립으로는 못 걷어내 노출됐다 — 검토 #6).
  let block = null;
  const fenced = new RegExp("```\\s*" + ASSIST_FENCE + "\\s*\\n([\\s\\S]{0," + ASSIST_ACTION_SCAN_MAX + "}?)```", "i").exec(text);
  if (fenced) { obj = tryJson(fenced[1].trim()); if (obj) block = fenced[0]; }
  if (!obj) {
    const anyFence = new RegExp("```[a-z-]{0,16}\\s*\\n(\\{[\\s\\S]{0," + ASSIST_ACTION_SCAN_MAX + "}?\\})\\s*```", "i").exec(text);
    if (anyFence) { obj = tryJson(anyFence[1].trim()); if (obj) block = anyFence[0]; }
  }
  if (!obj) {
    // 펜스 없이 뱉은 경우: 첫 '{' 부터 균형 잡힌 곳까지
    const st = text.indexOf("{");
    if (st >= 0) {
      let depth = 0, inStr = false, esc = false;
      for (let i = st; i < text.length && i < st + ASSIST_ACTION_SCAN_MAX; i++) {
        const ch = text[i];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) { obj = tryJson(text.slice(st, i + 1)); if (obj) block = text.slice(st, i + 1); break; } }
      }
    }
  }
  if (!obj || typeof obj !== "object") return { action: "final", args: {}, raw: text, parsed: false, block: null };

  // [검증 R8] 액션 키(action/tool/name/function)가 하나도 없는 객체는 답변 속 '데이터 예시'일 수
  // 있다({"단가":1000} 등). b2b-action 펜스로 명시한 경우가 아니면 액션으로 채택하지 않는다 —
  // 채택하면 오케스트레이터가 block 을 본문에서 걷어내 정상 답변에 구멍이 난다.
  const hasActionKey = !!(obj.action || obj.tool || obj.name || obj.function);
  const fromActionFence = !!(fenced && block === fenced[0]);
  if (!hasActionKey && !fromActionFence) {
    return { action: "final", args: {}, raw: text, parsed: false, block: null };
  }

  // 별칭 정규화
  let action = String(obj.action || obj.tool || obj.name || obj.function || "final").trim();
  let args = obj.args || obj.arguments || obj.parameters || obj.input || {};
  args = (args && typeof args === "object") ? args : {};
  // [단계별 핸드오프] 실측: 모델이 action="steps" 로 내거나 steps/request/reason 을 args 밖(최상위)에
  // 두는 변형이 흔하다. handoff 로 정규화하고 최상위 필드를 args 로 흡수한다.
  if (action === "steps" || action === "handoff" || action === "handoffsteps"
      || action.toLowerCase() === "handoff_steps" || action.toLowerCase() === "handoffsteps") {
    action = "handoff";
    if (!args.steps && Array.isArray(obj.steps)) args = { ...args, steps: obj.steps };
    if (!args.request && obj.request) args = { ...args, request: obj.request };
    if (!args.reason && obj.reason) args = { ...args, reason: obj.reason };
  }
  // [검토 #6] 모델이 {"action":"pipeline.list"} / {"tool":"diag.stepStatus"} 처럼 도구명을 action 에
  // 직접 쓰는 위반이 흔한데, 오케스트레이터는 action==="tool" 만 디스패치한다 — 등록된 도구명이면
  // 정식 형태로 재작성한다. hasOwnProperty 로 상속 키(constructor 등) 오인을 막고, 대소문자 변형
  // (Pipeline.List)도 소문자 대조로 흡수한다.
  if (action !== "tool" && action !== "propose" && action !== "final"
      && typeof ASSIST_TOOLS === "object" && ASSIST_TOOLS) {
    let toolKey = Object.prototype.hasOwnProperty.call(ASSIST_TOOLS, action) ? action : null;
    if (!toolKey) {
      const lower = action.toLowerCase();
      toolKey = Object.keys(ASSIST_TOOLS).find(k => k.toLowerCase() === lower) || null;
    }
    if (toolKey) {
      args = { tool: toolKey, ...args };
      action = "tool";
    }
  }
  return { action, args, raw: text, parsed: true, block };
}

// 응답 본문에서 액션 블록을 걷어낸 '사람이 읽을 부분'
function assistStripActionBlock(reply) {
  return String(reply || "")
    .replace(new RegExp("```\\s*" + ASSIST_FENCE + "[\\s\\S]{0," + ASSIST_ACTION_SCAN_MAX + "}?```", "gi"), "")
    .replace(new RegExp("```[a-z-]{0,16}\\s*\\n\\{[\\s\\S]{0," + ASSIST_ACTION_SCAN_MAX + "}?\\}\\s*```", "gi"), "")
    .trim();
}

// 한자(중국어) 혼입 검사 — Qwen 실측 대응. 한글 대비 한자 비율이 높으면 재생성 신호.
function assistHasChineseLeak(text) {
  const s = String(text || "");
  const han = (s.match(/[一-鿿]/g) || []).length;
  if (han === 0) return false;
  const hangul = (s.match(/[가-힣]/g) || []).length;
  return han >= 4 && han > hangul * 0.15;
}

// 같은 (도구,인자) 반복 호출 감지 — 압축으로 앞 라운드를 잊고 같은 조회를 되풀이하는 것 방지
function assistCallSignature(action, args) {
  try { return action + "|" + JSON.stringify(args || {}); } catch (_) { return action + "|?"; }
}

/* ── 제안(proposal) 보관소 ─────────────────────────────────────────────────
   state 에 넣지 않는다 — 히스토리/저장에 섞이면 안 되고, 신선도 검사가 필요하다.
   커밋 시 baseHash(그 시점 코드)와 파이프라인 길이를 재검사해 그 사이 바뀌었으면 거부한다. */
const _assistProposals = new Map();
const ASSIST_PROPOSAL_TTL_MS = 10 * 60 * 1000;

function assistHashCode(s) {
  let h = 5381;
  const t = String(s || "");
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return String(h);
}

function assistStoreProposal(p) {
  const id = "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  _assistProposals.set(id, { ...p, id, createdAt: Date.now() });
  // 오래된 것 정리
  for (const [k, v] of _assistProposals) {
    if (Date.now() - v.createdAt > ASSIST_PROPOSAL_TTL_MS) _assistProposals.delete(k);
  }
  return id;
}

function assistTakeProposal(id) {
  const p = _assistProposals.get(id);
  if (!p) return { ok: false, error: "제안을 찾을 수 없습니다(시간이 지나 만료됐거나 이미 반영됐습니다)." };
  if (Date.now() - p.createdAt > ASSIST_PROPOSAL_TTL_MS) {
    _assistProposals.delete(id);
    return { ok: false, error: "제안이 만료됐습니다. 다시 요청해 주세요." };
  }
  // 신선도: 그 사이 스텝이 바뀌었으면 거부(다른 수정 위에 덮어쓰기 방지)
  const steps = Array.isArray(state.pipeline) ? state.pipeline : [];
  if (steps.length !== p.pipelineLen) {
    return { ok: false, error: "제안을 만든 뒤 스킬 단계 수가 바뀌었습니다. 다시 확인해 주세요." };
  }
  // [Tier1] 일괄 치환은 대상 여러 개 — 전부 신선해야 통과(하나라도 바뀌었으면 거부).
  if (p.kind === "replaceLiteralAll") {
    for (const t of (p.targets || [])) {
      const c = steps.find(s => s && String(s.id) === String(t.stepId));
      if (!c) return { ok: false, error: `대상 Step ${t.stepNo} 을 찾을 수 없습니다.` };
      if (assistHashCode(c.code) !== t.baseHash) {
        return { ok: false, error: `제안을 만든 뒤 Step ${t.stepNo} 코드가 바뀌었습니다. 다시 확인해 주세요.` };
      }
    }
    return { ok: true, proposal: p, step: null };
  }
  const cur = steps.find(s => s && String(s.id) === String(p.stepId));
  if (!cur) return { ok: false, error: "대상 단계를 찾을 수 없습니다." };
  // setStepEnabled 는 코드를 안 건드리니 코드 해시가 같아야 하고(그 사이 코드 수정 방지), 나머지 kind 도 동일.
  if (assistHashCode(cur.code) !== p.baseHash) {
    return { ok: false, error: "제안을 만든 뒤 이 단계의 코드가 바뀌었습니다. 다시 확인해 주세요." };
  }
  // [검토 #8] 여기서 지우지 않는다 — 커밋이 일시 사유(Excel 적용 중 등)로 실패하면 카드 버튼으로
  // 재시도할 수 있어야 한다. 소거는 커밋 '성공' 후 assistConsumeProposal 로 한다(이중 커밋 방지).
  return { ok: true, proposal: p, step: cur };
}

function assistConsumeProposal(id) {
  _assistProposals.delete(id);
}
