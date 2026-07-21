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
  const fenced = new RegExp("```\\s*" + ASSIST_FENCE + "\\s*\\n([\\s\\S]{0,8000}?)```", "i").exec(text);
  if (fenced) obj = tryJson(fenced[1].trim());
  if (!obj) {
    const anyFence = /```[a-z-]{0,16}\s*\n(\{[\s\S]{0,8000}?\})\s*```/i.exec(text);
    if (anyFence) obj = tryJson(anyFence[1].trim());
  }
  if (!obj) {
    // 펜스 없이 뱉은 경우: 첫 '{' 부터 균형 잡힌 곳까지
    const st = text.indexOf("{");
    if (st >= 0) {
      let depth = 0, inStr = false, esc = false;
      for (let i = st; i < text.length && i < st + 8000; i++) {
        const ch = text[i];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) { obj = tryJson(text.slice(st, i + 1)); break; } }
      }
    }
  }
  if (!obj || typeof obj !== "object") return { action: "final", args: {}, raw: text, parsed: false };

  // 별칭 정규화
  const action = String(obj.action || obj.tool || obj.name || obj.function || "final").trim();
  const args = obj.args || obj.arguments || obj.parameters || obj.input || {};
  return { action, args: (args && typeof args === "object") ? args : {}, raw: text, parsed: true };
}

// 응답 본문에서 액션 블록을 걷어낸 '사람이 읽을 부분'
function assistStripActionBlock(reply) {
  return String(reply || "")
    .replace(new RegExp("```\\s*" + ASSIST_FENCE + "[\\s\\S]{0,8000}?```", "gi"), "")
    .replace(/```[a-z-]{0,16}\s*\n\{[\s\S]{0,8000}?\}\s*```/gi, "")
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
  if (!p) return { ok: false, error: "제안을 찾을 수 없습니다(시간이 지나 만료됐을 수 있습니다)." };
  if (Date.now() - p.createdAt > ASSIST_PROPOSAL_TTL_MS) {
    _assistProposals.delete(id);
    return { ok: false, error: "제안이 만료됐습니다. 다시 요청해 주세요." };
  }
  // 신선도: 그 사이 스텝이 바뀌었으면 거부(다른 수정 위에 덮어쓰기 방지)
  const steps = Array.isArray(state.pipeline) ? state.pipeline : [];
  if (steps.length !== p.pipelineLen) {
    return { ok: false, error: "제안을 만든 뒤 스킬 단계 수가 바뀌었습니다. 다시 확인해 주세요." };
  }
  const cur = steps.find(s => s && String(s.id) === String(p.stepId));
  if (!cur) return { ok: false, error: "대상 단계를 찾을 수 없습니다." };
  if (assistHashCode(cur.code) !== p.baseHash) {
    return { ok: false, error: "제안을 만든 뒤 이 단계의 코드가 바뀌었습니다. 다시 확인해 주세요." };
  }
  _assistProposals.delete(id);
  return { ok: true, proposal: p, step: cur };
}
