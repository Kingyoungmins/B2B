// [AI 도움 챗봇] 격리·가드·도구·미적용 수정 회귀 테스트.
// 이 기능의 위험은 '조용히 상태를 망가뜨리는 것'이라, 검증 대상도 거기에 집중한다:
//  ① 생성기 대화기억 오염 금지 ② LLM 이 쓰기 함수를 부를 수 없음 ③ 미적용 수정이 스냅샷/적용표시를
//  올바르게 정리 ④ 파서가 어떤 쓰레기 입력에도 throw 하지 않음.
// node diagnostics/_test_assist_chatbot.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const ROOT = path.join(__dirname, "..");
const rd = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const guardSrc = rd("scripts/assist-guard.js");
const toolsSrc = rd("scripts/assist-tools.js");
const coreSrc = rd("scripts/assist-core.js");
const llmSrc = rd("scripts/llm-api.js");
const pipeSrc = rd("scripts/pipeline.js");
const saveSrc = rd("scripts/save-load.js");
const uiSrc = rd("scripts/assist-ui.js");
const htmlSrc = rd("index.html");

// ── 1. 격리: 생성기 대화기억 오염 방지 ──────────────────────────────────────
ck("(1) 격리 호출은 chatHistory 에 push 하지 않음",
   /const _keepHistory = !Array\.isArray\(options\.messagesOverride\)/.test(llmSrc)
   && /if \(!_keepHistory\) return content;/.test(llmSrc));
ck("(2) messagesOverride 로 자체 메시지만 사용",
   /Array\.isArray\(options\.messagesOverride\)\s*\?\s*\[\{ role: "system"/.test(llmSrc));
ck("(3) assist 는 callLLM\\/callLLMOneShot 을 직접 쓰지 않음(Anthropic 폴백 제외)",
   !/\bcallLLM\s*\(/.test(coreSrc), "core 에서 callLLM 직접 호출 발견");
ck("(4) state.assist 슬롯 분리", /assist: \{ history: \[\] \}/.test(rd("scripts/state.js")));

// ── 2. 능력 부재: LLM 이 부를 수 있는 쓰기 경로가 없어야 한다 ───────────────
const FORBIDDEN = ["applyLogic", "runPipeline", "reapplyVbaPipelineToLive", "runIsolatedLivePipelineSteps",
                   "validateAssistantCodeBeforeApply", "addAssistantReply", "applyVbaStepToLiveExcel"];
FORBIDDEN.forEach((fn, i) => {
  ck(`(${5 + i}) 도구 레지스트리에 ${fn} 없음`, !new RegExp("\\b" + fn + "\\s*\\(").test(toolsSrc));
});
ck("(12) 도구 이름에 apply/run/save 없음",
   !/assistDefineTool\("(?:[a-z.]*)(apply|run|save|exec)/i.test(toolsSrc));
ck("(13) 상태 변경은 승인 핸들러 1곳에서만",
   (coreSrc.match(/replaceLogicAt\(/g) || []).length === 1
   && /function assistCommitProposal/.test(coreSrc));
ck("(14) 승인 커밋은 applyMode:\"none\" 으로만 호출",
   /replaceLogicAt\([^)]*\{ applyMode: "none" \}\)/.test(coreSrc));

// ── 3. 파서: 어떤 입력에도 throw 하지 않고 final 로 강등 ───────────────────
const sb = { console, JSON, Date, Math, String, Number, Array, Set, Map, RegExp, state: { pipeline: [] } };
vm.createContext(sb);
vm.runInContext(guardSrc, sb);
const PARSER_INPUTS = [
  "",
  "그냥 텍스트만 있고 액션이 없음",
  "```b2b-action\n{\"action\":\"tool\",\"args\":{\"tool\":\"pipeline.list\"}}\n```",
  "```json\n{\"tool\":\"pipeline.step\",\"arguments\":{\"stepId\":\"s1\"}}\n```",     // 별칭
  "{\"action\":\"final\"}",                                                          // 펜스 없음
  "```b2b-action\n{\"action\":\"tool\", \"args\":{\"tool\":\"x\",},}\n```",           // 후행 콤마
  "```b2b-action\n{깨진 JSON\n```",
  "{{{{{{",
];
let threw = null;
PARSER_INPUTS.forEach((inp, i) => {
  try {
    sb.__in = inp;
    const r = vm.runInContext("assistParseAction(__in)", sb);
    if (!r || typeof r.action !== "string") threw = `입력 ${i}: action 문자열 아님`;
  } catch (e) { threw = `입력 ${i}: throw ${e.message}`; }
});
ck("(15) 파서가 어떤 입력에도 throw 하지 않음", threw === null, threw);
sb.__in = PARSER_INPUTS[3];
ck("(16) 별칭 정규화(tool/arguments → action/args)",
   vm.runInContext("assistParseAction(__in).action", sb) === "pipeline.step"
   || vm.runInContext("assistParseAction(__in).args.stepId", sb) === "s1");
sb.__in = PARSER_INPUTS[6];
ck("(17) 파싱 실패 시 final 로 강등",
   vm.runInContext("assistParseAction(__in).action", sb) === "final");

// ── 4. 중국어 혼입 감지 ────────────────────────────────────────────────────
sb.__ko = "3단계에서 값이 바뀌지 않았습니다. 조건을 확인하세요.";
sb.__cn = "第三步没有变化，请检查条件设置。数据表中没有匹配项。";
ck("(18) 한국어는 통과", vm.runInContext("assistHasChineseLeak(__ko)", sb) === false);
ck("(19) 중국어 혼입 감지", vm.runInContext("assistHasChineseLeak(__cn)", sb) === true);

// ── 5. 제안 신선도: 그 사이 코드가 바뀌면 커밋 거부 ────────────────────────
{
  sb.state = { pipeline: [{ id: "s1", code: "AAA" }] };
  const id = vm.runInContext(`assistStoreProposal({stepId:"s1", oldCode:"AAA", newCode:"BBB",
    baseHash: assistHashCode("AAA"), pipelineLen: 1})`, sb);
  sb.__id = id;
  ck("(20) 정상 제안은 회수됨", vm.runInContext("assistTakeProposal(__id).ok", sb) === true);
  const id2 = vm.runInContext(`assistStoreProposal({stepId:"s1", oldCode:"AAA", newCode:"BBB",
    baseHash: assistHashCode("AAA"), pipelineLen: 1})`, sb);
  sb.__id2 = id2;
  sb.state.pipeline[0].code = "CCC";                       // 그 사이 다른 수정이 일어남
  ck("(21) 코드가 바뀌면 커밋 거부(덮어쓰기 방지)",
     vm.runInContext("assistTakeProposal(__id2).ok", sb) === false);
  const id3 = vm.runInContext(`assistStoreProposal({stepId:"s1", oldCode:"CCC", newCode:"DDD",
    baseHash: assistHashCode("CCC"), pipelineLen: 1})`, sb);
  sb.__id3 = id3;
  sb.state.pipeline.push({ id: "s2", code: "X" });          // 단계 수가 바뀜
  ck("(22) 단계 수가 바뀌면 커밋 거부",
     vm.runInContext("assistTakeProposal(__id3).ok", sb) === false);
  ck("(23) 회수된 제안은 재사용 불가(1회성)",
     vm.runInContext("assistTakeProposal(__id).ok", sb) === false);
}

// ── 6. 미적용 수정 분기의 가드가 소스에 실재하는지 ─────────────────────────
ck("(24) applyMode:\"none\" 분기 존재", /opts && opts\.applyMode === "none"/.test(pipeSrc));
ck("(25) 하류 스냅샷 폐기", /delete next\[i\]\._preApplySnapshot/.test(pipeSrc));
ck("(26) 교차파일이면 자기 자신부터 폐기", /if \(writesCross\) dropFrom = idx;/.test(pipeSrc));
ck("(27) resume 는 앞당기기만(Math.min)", /Math\.min\(existingResume, dropFrom\)/.test(pipeSrc));
ck("(28) noteLivePipelineApplied 는 prefix 만",
   /noteLivePipelineApplied\(\(state\.pipeline \|\| \[\]\)\.slice\(0, start\)\)/.test(pipeSrc));
ck("(29) trustedStatic/extendedTimeout 해제",
   /next\[idx\]\.trustedStatic = false/.test(pipeSrc) && /next\[idx\]\.extendedTimeout = false/.test(pipeSrc));
ck("(30) 미적용 표식(_unappliedEdit) 부여", /next\[idx\]\._unappliedEdit = true/.test(pipeSrc));
ck("(31) 저장 시 미적용 코드는 trustedStatic 승격 금지",
   /s\._unappliedEdit === true\s*\n?\s*\?\s*false/.test(saveSrc));
ck("(32) 실행 중/백엔드전용이면 거부",
   /runnerMappingRunActive/.test(pipeSrc.slice(pipeSrc.indexOf('applyMode === "none"'), pipeSrc.indexOf('applyMode === "none"') + 2500))
   && /pipelineHasBackendOnlyStep\(next\)/.test(pipeSrc));

// ── 7. UI 격리: 기존 채팅 DOM 을 건드리지 않아야 한다 ──────────────────────
// 주석에는 설명 목적으로 기존 ID 가 등장할 수 있으므로 '실제 DOM 접근'만 본다.
{
  const uiNoComments = uiSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  const touchesChat = /(?:getElementById|\$)\(\s*["']chat-(?:messages|text|send)["']\s*\)/.test(uiNoComments);
  ck("(33) assist UI 가 기존 채팅 DOM 을 직접 만지지 않음", !touchesChat, touchesChat);
}
ck("(34) 버튼이 Think 왼쪽에 위치",
   htmlSrc.indexOf('id="btn-ai-help"') < htmlSrc.indexOf('id="btn-think-toggle"')
   && htmlSrc.indexOf('id="btn-ai-help"') > 0);
ck("(35) assist 스크립트가 pipeline/chat-ui 뒤에 로드",
   htmlSrc.indexOf("scripts/assist-core.js") > htmlSrc.indexOf("scripts/pipeline.js")
   && htmlSrc.indexOf("scripts/assist-core.js") > htmlSrc.indexOf("scripts/chat-ui.js"));

// ── 8. 도구가 throw 하지 않고 {ok} 를 반환하는지(빈 상태에서) ──────────────
{
  const tb = { console, JSON, Date, Math, String, Number, Array, Set, Map, RegExp, parseFloat, isFinite,
    state: { pipeline: [], inputs: [], outputTemplates: [] } };
  vm.createContext(tb);
  vm.runInContext(toolsSrc, tb);
  const names = vm.runInContext("Object.keys(ASSIST_TOOLS)", tb);
  ck("(36) 도구가 8종 이상 등록", names.length >= 8, names);
  let bad = null;
  for (const n of names) {
    try {
      tb.__n = n;
      const r = vm.runInContext(`(function(){ const t = ASSIST_TOOLS[__n];
        try { const o = t.fn({}); return (o && typeof o === "object") ? o : {ok:true}; }
        catch(e) { return {__threw: String(e && e.message)}; } })()`, tb);
      if (r && r.__threw) bad = `${n}: ${r.__threw}`;
      else if (!r || typeof r.ok !== "boolean") bad = `${n}: ok 필드 없음`;
    } catch (e) { bad = `${n}: ${e.message}`; }
  }
  ck("(37) 빈 상태에서도 모든 도구가 {ok}를 반환(throw 없음)", bad === null, bad);
  ck("(38) 알 수 없는 도구는 available 목록을 되먹임",
     /error: "unknown_tool"[\s\S]{0,80}available/.test(toolsSrc));
}

// ── 9. 동반 수정: 코드만 바뀌고 이름/설명/대화가 옛 값으로 남지 않아야 한다 ──────
// 사용자 실측: 4단계 100→1000 을 고쳤는데 카드 이름·설명·대화기록은 100으로 남아 헷갈렸다.
// 그 기록은 다음 스킬 생성의 LLM 문맥으로도 들어가 옛 값으로 되돌리는 원인이 된다.
{
  const cb = { console, JSON, Date, Math, String, Number, Array, Set, Map, RegExp, parseFloat, isFinite };
  cb.state = {
    pipeline: [{ id: "s4", code: 'ws.Range("I16").Value = 100', language: "vba",
                 title: "I16에 숫자 100 입력", description: "Step 4: I16에 숫자 100 입력",
                 prompt: "I16에 100 입력해줘" }],
    chatHistory: [
      { role: "user", content: "I16에 100 입력해줘" },
      { role: "assistant", content: "I16 셀에 100을 입력하는 코드를 만들었습니다." },
      { role: "user", content: "다른 작업 100건 처리" },      // 무관한 100 — 건드리면 안 됨
    ],
  };
  cb.replaceLogicAt = () => ({ applied: false, unapplied: true, startIndex: 4 });
  vm.createContext(cb);
  vm.runInContext(guardSrc, cb);
  vm.runInContext(toolsSrc, cb);
  vm.runInContext(coreSrc, cb);

  cb.__args = { kind: "replaceLiteral", stepId: "s4", from: "100", to: "1000", reason: "요청" };
  const built = vm.runInContext("assistBuildProposal(__args)", cb);
  ck("(39) 값 치환 제안 생성", !!(built && built.ok), built && built.error);
  const comps = (built.proposal && built.proposal.companions) || [];
  const labels = comps.map(c => c.label);
  ck("(40) 단계 이름·설명·요청문이 동반 후보에 포함",
     labels.includes("단계 이름") && labels.includes("단계 설명") && labels.includes("원래 요청문"), labels);
  const chatComps = comps.filter(c => c.target === "chat");
  ck("(41) 이 단계를 만든 대화만 후보(무관한 100은 제외)",
     chatComps.length === 2 && !chatComps.some(c => String(c.before).includes("다른 작업")),
     chatComps.map(c => c.before));

  cb.__pid = built.proposal.id;
  const res = vm.runInContext("assistCommitProposal(__pid, [0,1,2,3,4])", cb);
  ck("(42) 커밋 성공", !!(res && res.ok), res && res.error);
  const st = cb.state.pipeline[0];
  ck("(43) 단계 이름/설명/요청문이 1000으로 갱신",
     st.title.includes("1000") && st.description.includes("1000") && st.prompt.includes("1000"),
     [st.title, st.description, st.prompt]);
  ck("(44) 이 단계 대화만 1000으로, 무관한 대화는 그대로",
     cb.state.chatHistory[0].content.includes("1000")
     && cb.state.chatHistory[1].content.includes("1000")
     && cb.state.chatHistory[2].content === "다른 작업 100건 처리",
     cb.state.chatHistory.map(m => m.content));
}

// ── 10. 팝업 창(앱 레이아웃에 붙지 않음) ──────────────────────────────────
{
  const cssSrc = rd("styles/panels.css");
  ck("(45) 드로어가 아닌 떠 있는 팝업", /className = "assist-popup"/.test(uiSrc));
  ck("(46) 제목줄 드래그 이동 + 크기 조절 손잡이",
     /function assistBindDrag/.test(uiSrc) && /assist-resize/.test(uiSrc));
  ck("(47) 위치·크기 기억", /localStorage\.setItem\(ASSIST_POS_KEY/.test(uiSrc));
  ck("(48) 화면 밖으로 나가면 되돌림", /function assistClampIntoView/.test(uiSrc));
  ck("(49) CSS 가 fixed 팝업(우측 도킹 아님)",
     /\.assist-popup \{[\s\S]{0,400}position: fixed/.test(cssSrc) && !/\.assist-drawer \{/.test(cssSrc));
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
