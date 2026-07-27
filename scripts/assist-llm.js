/* ===================================================================
   AI 도움 — LLM 배관 (생성기 채팅과 완전 격리)
   ===================================================================
   왜 별도 함수인가:
   - callLLM 은 '스킬 코드 생성' 시스템 프롬프트를 강제로 조립하고, 사용자/어시스턴트 메시지를
     state.chatHistory 에 push 한다(skipHistoryPush 는 user 쪽만 막고 assistant 는 여전히 들어간다).
     그대로 쓰면 도움 챗봇의 잡담이 생성기 대화기억을 오염시켜 다음 스킬 생성이 망가진다.
   - callLLMOneShot 은 히스토리는 안 건드리지만 '한 번 호출'이라 도구 왕복 루프를 못 돌린다.
   → 여기서 자체 messages 배열을 만들어 callOpenAICompatOnce(…, {messagesOverride}) 로 넘긴다.

   Qwen 대응(이 프로젝트 실측):
   - think 는 항상 OFF. 도움 챗봇은 JSON 액션을 뱉어야 하는데 think 가 켜지면 추론 본문이
     예산을 먹고 액션 블록이 잘린다. 또 폐기돼야 할 추론 속 액션을 파서가 주워 실행할 위험이 있다.
   - 샘플링은 기존 값을 그대로 쓴다(temp 0.7/top_p 0.8/top_k 20/presence_penalty 0.5).
     greedy 로 낮추면 같은 줄을 반복하는 degenerate 출력이 재현된다.
   =================================================================== */

const ASSIST_MAX_HISTORY_MESSAGES = 16;
const ASSIST_MAX_HISTORY_CHARS = 24000;

// state.assist.history 를 LLM 메시지 배열로. 도구 왕복(JSON)은 history 에 남기지 않는다 —
// 남기면 모델이 "지난 턴에도 액션을 냈으니 이번에도" 하며 불필요한 도구 호출을 모방한다.
function assistHistoryMessages(extraTail) {
  const src = (state.assist && Array.isArray(state.assist.history)) ? state.assist.history : [];
  const picked = [];
  let chars = 0;
  for (let i = src.length - 1; i >= 0 && picked.length < ASSIST_MAX_HISTORY_MESSAGES; i--) {
    const m = src[i];
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    // [검증 항목5] 최신(방금 보낸) 메시지는 넉넉히 — 사용자 발화가 tail 중복 제거 후 history 경유가
    // 유일한 사본이 되면서, 긴 오류로그/코드 붙여넣기가 4000자에서 무표시 절단되던 회귀 방지.
    const content = String(m.content || "").slice(0, i === src.length - 1 ? 12000 : 4000);
    if (!content.trim()) continue;
    chars += content.length;
    if (chars > ASSIST_MAX_HISTORY_CHARS) break;
    picked.push({ role: m.role, content });
  }
  picked.reverse();
  (extraTail || []).forEach(m => { if (m && m.role && m.content) picked.push(m); });
  return picked;
}

/**
 * 도움 챗봇 전용 LLM 호출.
 * @param {string} systemPrompt 이번 라운드의 시스템 프롬프트(그라운딩 팩트 포함)
 * @param {Array}  tailMessages 이번 라운드에만 붙일 메시지(사용자 발화, 도구 결과 되먹임 등)
 * @param {object} options {signal, onDelta, temperature}
 * @returns {Promise<string>} 어시스턴트 응답 전문
 */
// [검토 #3] think 태그 방어 — thinkMode:false 를 보내도 Qwen 이 규약을 어기고 <think> 를 뱉는
// 실측이 있다. 생성기 경로의 stripThink 는 callLLMOneShot 내부 로컬이라 여기서 자체 제거한다.
// 안 지우면 추론 본문이 사용자에게 노출되고, 폐기됐어야 할 추론 속 액션 블록을 파서가 주워 실행한다.
function assistStripThink(s) {
  let t = String(s || "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  // [검증 항목3] max_tokens 절단 등으로 </think> 없이 끝난 응답 — 추론 본문이 통째로 남아 노출되고
  // 그 속 액션을 파서가 주울 수 있다. 미폐 <think> 는 거기부터 끝까지 버린다.
  t = t.replace(/<think>[\s\S]*$/i, "");
  return t.trim();
}

async function callAssistLLM(systemPrompt, tailMessages, options) {
  options = options || {};
  const messages = assistHistoryMessages(tailMessages);
  // [첨부 비전] 첨부 이미지가 있으면 마지막 user 메시지 content 를 멀티모달 배열로 만든다.
  // OpenAI 호환(dev vLLM 등) 경로 전용 — 이 프로젝트 실측상 dev vLLM 이 이미지 content 를 읽는다.
  const imgs = (options.attachImages && options.attachImages.length) ? options.attachImages : null;
  if (imgs && settings.provider !== "anthropic") {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "user") continue;
      const parts = [{ type: "text", text: String(messages[i].content || "") }];
      imgs.forEach(im => parts.push({
        type: "image_url",
        image_url: { url: "data:" + (im.mime || "image/png") + ";base64," + im.imageB64 },
      }));
      messages[i] = { role: "user", content: parts };
      break;
    }
  }
  if (settings.provider === "anthropic") {
    // Anthropic 경로는 히스토리를 인자로 받는 형태가 아니라, 여기선 단발 호출로 충분하다
    // (도구 루프의 문맥은 tailMessages 로 매 라운드 재주입되므로 손실 없음).
    const merged = messages.map(m => `[${m.role}] ${m.content}`).join("\n\n");
    return assistStripThink(await callLLMOneShot(systemPrompt, merged, { signal: options.signal, maxTokens: 4096 }));
  }
  // [검토 #3] callOpenAICompatOnce 직접 호출은 생성기 경로의 3회 재시도·지수 대기·think 폴백을 전부
  // 잃어 일시 오류 1번에 라운드가 통째로 실패했다. 재시도 래퍼(callOpenAICompat)를 경유한다 —
  // messagesOverride/signal/onDelta 는 옵션 스프레드로 그대로 전달된다(중단 시에는 재시도 안 함).
  const reply = await callOpenAICompat(systemPrompt, {
    messagesOverride: messages,
    thinkMode: false,                 // 항상 OFF (위 주석 참조)
    signal: options.signal,
    onDelta: options.onDelta,
    temperature: options.temperature,
  });
  return assistStripThink(reply);
}
