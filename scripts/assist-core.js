/* ===================================================================
   AI 도움 — 오케스트레이터 (읽기는 자율 루프, 쓰기는 승인 카드)
   ===================================================================
   구조:
     사용자 발화
       → (라운드 루프, 최대 4회)
           LLM 이 {action:"tool"|"propose"|"final"} 중 하나를 낸다
           · tool    → 읽기 도구 즉시 실행, 결과를 다음 라운드에 되먹임 (자율)
           · propose → 승인 카드로 렌더하고 루프 종료 (사용자가 눌러야 반영)
           · final   → 답변 출력하고 종료
     상태를 바꾸는 코드 경로는 이 파일의 승인 핸들러(assistCommitProposal)에만 있다.
     LLM 은 그 함수를 호출할 수단이 없다 — 액션 어휘에 apply/run/save 가 아예 없다.
   =================================================================== */

const ASSIST_MAX_ROUNDS = 4;
const ASSIST_MAX_TOOL_CALLS = 6;
const ASSIST_BUDGET_MS = 90000;

function assistSystemPrompt() {
  const steps = Array.isArray(state.pipeline) ? state.pipeline : [];
  const files = (state.inputs || []).map(f => f && f.name).filter(Boolean);
  const outs = (state.outputTemplates || []).map(t => (t && (t.file || t.original) || {}).name).filter(Boolean);
  // 그라운딩 팩트: 모델이 지어낼 수 없도록 '실재하는 것'만 열거해 준다.
  const facts = [
    `현재 스킬 단계 수: ${steps.length}`,
    steps.length ? `단계 목록: ${steps.map((s, i) => `${i + 1}:${s.id}`).join(", ")}` : "",
    files.length ? `업로드 입력 파일: ${files.join(" | ")}` : "업로드된 입력 파일 없음",
    outs.length ? `출력 템플릿: ${outs.join(" | ")}` : "",
  ].filter(Boolean).join("\n");

  return `${typeof OUTPUT_LANGUAGE_RULE === "string" ? OUTPUT_LANGUAGE_RULE + "\n\n" : ""}당신은 B2B 빌링 Agent 프로그램 '안에서' 동작하는 도우미입니다.
사용자는 이미 만들어진 Excel 자동화 '스킬'(여러 단계로 된 파이프라인)을 쓰고 있고,
스킬이 뜻대로 안 되거나 어떻게 고칠지 모를 때 당신에게 묻습니다.

## 당신이 할 수 있는 것
- 도구로 스킬·파일·상태를 **읽어서** 사실에 근거해 답한다.
- 코드 수정이 필요하면 **제안**한다. 제안은 사용자가 카드의 버튼을 눌러야 반영된다.

## 당신이 할 수 없는 것 (중요)
- 스킬을 **실행/적용**할 수 없다. 그런 도구는 존재하지 않는다. 요청받아도 "실행은 사용자가
  전체실행 버튼으로 해야 한다"고 안내하라.
- 단계를 새로 만들거나 삭제할 수 없다. 그건 ③ 스킬 설계 채팅의 일이다.

## 응답 규약
매 응답은 아래 셋 중 **하나**의 액션 블록으로 끝난다. 블록은 정확히 이 형식이어야 한다:

\`\`\`${ASSIST_FENCE}
{"action":"tool","args":{"tool":"도구이름","...":"인자"}}
\`\`\`

- 사실을 더 알아야 하면 action="tool" (한 응답에 도구 하나만).
- 코드 수정을 제안하려면 action="propose", args={"kind":"replaceStepCode","stepId":"...","newCode":"전체 코드","reason":"왜"}
  또는 args={"kind":"replaceLiteral","stepId":"...","from":"바꿀 문자열","to":"새 문자열","reason":"왜"}
- 더 알아볼 게 없으면 action="final" 로 끝내고, 블록 위에 사용자에게 할 답변을 쓴다.

### 값 하나만 바꿀 때는 반드시 replaceLiteral 을 쓸 것
숫자·문자 하나를 바꾸는 요청(예: "100을 1000으로")에 replaceStepCode 로 코드 전체를 다시 쓰면
엉뚱한 곳까지 바뀔 위험이 있다. from/to 만 정확히 지정하라.
단계 이름·설명·과거 대화에 남은 같은 값은 **프로그램이 자동으로 함께 고쳐 준다** — 그것까지
제안에 넣지 말고, 답변에서 "이름과 설명도 같이 정리했다"고만 알려 주면 된다.
코드 전체를 바꿔야 하는 경우(replaceStepCode)에는 바뀐 내용에 맞는 새 설명을
args.newDescription 으로 함께 주면 카드에서 같이 반영된다.

## 사용 가능한 도구
${typeof assistToolCatalog === "function" ? assistToolCatalog() : ""}

## 사실 (지어내지 말 것)
${facts}

## 태도
- 근거 없는 단정 금지. 모르면 "확인할 수 없다"고 말하라. 특히 VBA 단계가 조용히 아무것도 안 한 경우는
  프로그램 구조상 판정할 수 없다 — 추측하지 말고 그렇게 밝혀라.
- 파일명·시트명·열 이름은 위 '사실' 목록에 있는 것만 그대로 쓴다. 번역·변형 금지.
- 답변은 짧고 구체적으로. 사용자는 엑셀 실무자이지 개발자가 아니다.`;
}

let _assistInFlight = false;
let _assistAbort = null;

function assistIsBusy() { return _assistInFlight; }
function assistAbortCurrent() {
  try { if (_assistAbort) _assistAbort.abort(); } catch (_) {}
}

/**
 * 사용자 발화 1건 처리. UI 콜백으로 진행 상황을 알린다.
 * @param {string} userText
 * @param {object} ui {onStatus, onAssistantText, onProposal, onToolTrace}
 */
async function assistHandleUserMessage(userText, ui) {
  ui = ui || {};
  const say = (s) => { try { ui.onStatus && ui.onStatus(s); } catch (_) {} };
  if (_assistInFlight) {
    say("이전 요청을 처리 중입니다. 잠시만요.");
    return;
  }
  // 생성기 채팅이 돌고 있으면 거절한다(대기하지 않는다 — 두 대화가 같은 Excel 을 두고 겹치면 위험).
  if (typeof window !== "undefined" && window.__b2bChatInFlight) {
    say("스킬 설계 채팅이 응답 중입니다. 끝난 뒤 다시 시도해 주세요.");
    return;
  }
  _assistInFlight = true;
  _assistAbort = (typeof AbortController === "function") ? new AbortController() : null;
  const signal = _assistAbort ? _assistAbort.signal : undefined;
  const t0 = Date.now();
  const seenCalls = new Set();
  let toolCalls = 0;

  state.assist = state.assist || { history: [] };
  state.assist.history.push({ role: "user", content: String(userText || "") });

  // 이번 라운드에만 붙는 꼬리 메시지(도구 결과 되먹임이 여기 쌓인다 — history 에는 안 남긴다)
  const tail = [{ role: "user", content: String(userText || "") }];

  try {
    for (let round = 1; round <= ASSIST_MAX_ROUNDS; round++) {
      if (Date.now() - t0 > ASSIST_BUDGET_MS) {
        say("시간이 오래 걸려 여기서 정리합니다.");
        break;
      }
      const lastRound = (round === ASSIST_MAX_ROUNDS) || (toolCalls >= ASSIST_MAX_TOOL_CALLS);
      const sys = assistSystemPrompt() + (lastRound
        ? "\n\n## 지금 라운드\n도구를 더 쓸 수 없다. 지금까지 알아낸 것으로 action=\"final\" 답변을 작성하라."
        : "");

      say(round === 1 ? "생각 중..." : `확인 중... (${round})`);
      let reply = "";
      try {
        reply = await callAssistLLM(sys, tail, { signal });
      } catch (err) {
        if (signal && signal.aborted) { say("중단했습니다."); return; }
        throw err;
      }

      // 중국어 혼입이면 한 번만 재요청
      if (assistHasChineseLeak(reply)) {
        tail.push({ role: "assistant", content: "(생략)" });
        tail.push({ role: "user", content: "방금 응답에 한국어가 아닌 문장이 섞였습니다. 같은 내용을 한국어로만 다시 작성하세요." });
        try { reply = await callAssistLLM(sys, tail, { signal }); } catch (_) {}
      }

      const parsed = assistParseAction(reply);
      const visible = assistStripActionBlock(reply);

      if (parsed.action === "tool" && !lastRound) {
        const toolName = String(parsed.args.tool || parsed.args.name || "").trim();
        const toolArgs = { ...parsed.args };
        delete toolArgs.tool; delete toolArgs.name;
        const sig = assistCallSignature(toolName, toolArgs);
        if (seenCalls.has(sig)) {
          tail.push({ role: "assistant", content: reply.slice(0, 1500) });
          tail.push({ role: "user", content: "같은 조회를 반복했습니다. 이미 받은 결과로 답을 작성하세요(action=\"final\")." });
          continue;
        }
        seenCalls.add(sig);
        toolCalls += 1;
        say(`${toolName} 확인 중...`);
        const result = await assistRunTool(toolName, toolArgs);
        try { ui.onToolTrace && ui.onToolTrace(toolName, result); } catch (_) {}
        tail.push({ role: "assistant", content: reply.slice(0, 1500) });
        tail.push({ role: "user", content: `[도구 결과 ${toolName}]\n${JSON.stringify(result).slice(0, 6000)}` });
        continue;
      }

      if (parsed.action === "propose") {
        const p = assistBuildProposal(parsed.args);
        if (!p.ok) {
          tail.push({ role: "assistant", content: reply.slice(0, 1500) });
          tail.push({ role: "user", content: `[제안 거부] ${p.error}\n다시 시도하거나 action="final" 로 설명하세요.` });
          continue;
        }
        if (visible) assistPushAssistant(visible, ui);
        try { ui.onProposal && ui.onProposal(p.proposal); } catch (_) {}
        return;
      }

      // final (또는 파싱 실패 → final 강등)
      assistPushAssistant(visible || reply.trim() || "답변을 만들지 못했습니다. 다시 물어봐 주세요.", ui);
      return;
    }
    assistPushAssistant("확인을 마치지 못했습니다. 질문을 조금 더 좁혀서 다시 물어봐 주세요.", ui);
  } catch (err) {
    assistPushAssistant("오류가 났습니다: " + String((err && err.message) || err).slice(0, 200), ui);
  } finally {
    _assistInFlight = false;
    _assistAbort = null;
    say("");
  }
}

function assistPushAssistant(text, ui) {
  state.assist = state.assist || { history: [] };
  state.assist.history.push({ role: "assistant", content: String(text || "") });
  try { ui && ui.onAssistantText && ui.onAssistantText(String(text || "")); } catch (_) {}
}

// LLM 이 낸 제안을 검증해 보관한다. 여기서 통과한 것만 카드로 뜬다.
function assistBuildProposal(args) {
  const steps = Array.isArray(state.pipeline) ? state.pipeline : [];
  const kind = String(args.kind || "").trim();
  const idx = (typeof _assistStepIndexById === "function") ? _assistStepIndexById(args.stepId) : -1;
  if (idx < 0) {
    return { ok: false, error: `stepId '${args.stepId}' 를 찾을 수 없습니다. 사용 가능: ${steps.map((s, i) => `${i + 1}:${s.id}`).join(", ")}` };
  }
  const step = steps[idx];
  const oldCode = String(step.code || "");
  let newCode = null;

  if (kind === "replaceStepCode") {
    newCode = String(args.newCode || "");
    if (!newCode.trim()) return { ok: false, error: "newCode 가 비어 있습니다." };
  } else if (kind === "replaceLiteral") {
    const from = String(args.from || "");
    const to = String(args.to || "");
    if (!from) return { ok: false, error: "from 이 비어 있습니다." };
    if (from === to) return { ok: false, error: "from 과 to 가 같습니다." };
    if (!oldCode.includes(from)) {
      return { ok: false, error: `코드에 '${from.slice(0, 60)}' 가 없습니다(0건). 정확한 문자열을 확인하세요.` };
    }
    newCode = oldCode.split(from).join(to);
  } else {
    return { ok: false, error: `kind '${kind}' 는 지원하지 않습니다. replaceStepCode 또는 replaceLiteral 만 가능합니다.` };
  }

  if (newCode === oldCode) return { ok: false, error: "바뀌는 내용이 없습니다." };

  // ── [동반 수정] 코드만 고치면 단계 이름·설명·대화기록에 옛 값이 남아 사용자가 헷갈린다.
  // 게다가 그 기록은 다음 스킬 생성의 LLM 문맥으로 들어가 옛 값으로 되돌리는 원인이 된다
  // (사용자 실측: 코드는 1000인데 설명/대화는 100으로 남음).
  // 값 치환(from→to)일 때만 '같은 리터럴'을 결정적으로 찾아 후보를 만든다 — LLM 이 자유롭게
  // 다시 쓰게 두지 않는다(요약이 사실을 왜곡하는 것보다 기계적 치환이 안전하다).
  const companions = [];
  if (kind === "replaceLiteral" && args.from) {
    const from = String(args.from), to = String(args.to != null ? args.to : "");
    const addField = (field, label) => {
      const cur = String(step[field] || "");
      if (cur && cur.includes(from)) {
        companions.push({ target: "step", field, label, before: cur, after: cur.split(from).join(to) });
      }
    };
    addField("title", "단계 이름");
    addField("description", "단계 설명");
    addField("prompt", "원래 요청문");

    // 이 단계를 만든 대화(사용자 요청 말풍선 + 바로 뒤 어시스턴트 응답)만 대상으로 한다.
    // 대화 전체를 훑어 '100'을 모두 바꾸면 무관한 숫자까지 건드린다.
    try {
      const hist = Array.isArray(state.chatHistory) ? state.chatHistory : [];
      const norm = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, 200);
      const want = norm(step.prompt);
      if (want) {
        for (let i = 0; i < hist.length; i++) {
          const m = hist[i];
          if (!m || m.role !== "user" || norm(m.content) !== want) continue;
          [i, i + 1].forEach(j => {
            const t = hist[j];
            if (!t || !t.content || !String(t.content).includes(from)) return;
            companions.push({
              target: "chat", index: j, label: t.role === "user" ? "대화(내 요청)" : "대화(AI 답변)",
              before: String(t.content), after: String(t.content).split(from).join(to),
            });
          });
          break;
        }
      }
    } catch (_) {}
  } else if (kind === "replaceStepCode") {
    // 코드 전체 교체는 기계적 치환이 불가하므로, 모델이 새 설명을 준 경우에만 반영한다.
    const nt = String(args.newTitle || "").trim();
    const nd = String(args.newDescription || "").trim();
    if (nt && nt !== String(step.title || "")) {
      companions.push({ target: "step", field: "title", label: "단계 이름", before: String(step.title || ""), after: nt });
    }
    if (nd && nd !== String(step.description || "")) {
      companions.push({ target: "step", field: "description", label: "단계 설명", before: String(step.description || ""), after: nd });
    }
  }

  // 파일명/시트명 변경은 사고 위험이 크므로 카드에 경고를 띄우도록 표시만 해 둔다.
  const touchesNames = /\.(xls[xmb]?|csv)["']/i.test(String(args.from || "")) ||
    (kind === "replaceLiteral" && /^[^\r\n]{1,60}$/.test(String(args.from || "")) &&
     (state.inputs || []).some(f => f && f.name && String(args.from) === f.name));

  const id = assistStoreProposal({
    kind, stepId: step.id, stepNo: idx + 1, oldCode, newCode,
    reason: String(args.reason || "").slice(0, 400),
    from: args.from ? String(args.from) : null,
    to: args.to != null ? String(args.to) : null,
    baseHash: assistHashCode(oldCode),
    pipelineLen: steps.length,
    touchesNames,
    companions,
  });
  return { ok: true, proposal: { ..._assistProposalPeek(id), id } };
}

function _assistProposalPeek(id) {
  // 카드 렌더에 필요한 필드만(코드 전문 포함 — diff 표시용)
  const steps = Array.isArray(state.pipeline) ? state.pipeline : [];
  for (const [k, v] of _assistProposals) if (k === id) return { ...v, stepCount: steps.length };
  return {};
}

/** 사용자가 승인 버튼을 눌렀을 때만 호출된다. 여기가 유일한 상태 변경 지점. */
function assistApplyCompanions(p, pickedIdx) {
  const out = { step: 0, chat: 0 };
  const steps = Array.isArray(state.pipeline) ? state.pipeline : [];
  const target = steps.find(s => s && String(s.id) === String(p.stepId));
  (p.companions || []).forEach((c, i) => {
    if (!pickedIdx.includes(i)) return;
    try {
      if (c.target === "step" && target) {
        // 현재 값이 제안 시점과 같을 때만(그 사이 사용자가 이름을 직접 고쳤으면 건드리지 않는다)
        if (String(target[c.field] || "") === c.before) { target[c.field] = c.after; out.step += 1; }
      } else if (c.target === "chat") {
        const h = state.chatHistory || [];
        const m = h[c.index];
        if (m && String(m.content || "") === c.before) { m.content = c.after; out.chat += 1; }
      }
    } catch (_) {}
  });
  return out;
}

function assistCommitProposal(proposalId, accepted) {
  const taken = assistTakeProposal(proposalId);
  if (!taken.ok) return { ok: false, error: taken.error };
  const p = taken.proposal;
  if (typeof replaceLogicAt !== "function") return { ok: false, error: "수정 함수를 찾을 수 없습니다." };
  // applyMode:"none" — 라이브에 적용하지 않고 스킬만 갱신(가드는 replaceLogicAt 안에 있다).
  const r = replaceLogicAt(p.stepId, p.newCode, null, taken.step.language || "python", { applyMode: "none" });
  if (r && r.unapplied) {
    // 동반 수정은 코드 교체가 성공한 뒤에만 반영한다(코드가 안 바뀌었는데 라벨만 바뀌면 더 헷갈린다).
    const picked = Array.isArray(accepted) ? accepted : (p.companions || []).map((_, i) => i);
    const applied = assistApplyCompanions(p, picked);
    try { if (typeof renderPipeline === "function") renderPipeline(); } catch (_) {}
    try { if (typeof renderChatFromHistory === "function" && applied.chat > 0) renderChatFromHistory(); } catch (_) {}
    return { ok: true, startIndex: r.startIndex, companions: applied };
  }
  if (r === false) return { ok: false, error: "수정을 적용하지 못했습니다(위 안내 참조)." };
  return { ok: true };
}
