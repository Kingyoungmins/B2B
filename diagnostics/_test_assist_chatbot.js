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
const llmAssistSrc = rd("scripts/assist-llm.js");
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
// (3) core 의 로컬 `const callLLM` 워치독 래퍼는 callAssistLLM 을 경유한다 — 금지 대상은
//     생성기 전역 callLLMOneShot 직접 호출(히스토리 오염 경로)뿐이다.
ck("(3) assist 는 생성기 LLM 경로를 직접 쓰지 않음(callAssistLLM 경유)",
   !/\bcallLLMOneShot\s*\(/.test(coreSrc) && /callAssistLLM\(/.test(coreSrc));
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
// (27) [off-by-one 본수정 반영] 상태 경계(start)는 '수정된 스텝 자신(idx)'부터 — dropFrom(idx+1)을
//      쓰면 수정 스텝이 적용됨으로 찍히고 새 코드가 실행에서 빠진다. dropFrom 은 스냅샷 폐기 전용.
ck("(27) resume/보류 경계는 수정 스텝 자신(idx)부터 + 앞당기기만",
   /Math\.min\(existingResume, idx\)/.test(pipeSrc)
   && !/Math\.min\(existingResume, dropFrom\)/.test(pipeSrc));
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

// ── 11. 네이티브 팝업(진짜 OS 창) 브리지 ──────────────────────────────────
// WebView 는 SplitContainer 왼쪽에만 있어 DOM 팝업이 우측(네이티브 Excel 영역) 위로 못 올라간다
// (사용자 실측). C# 이 별도 창을 띄우고 메인 페이지와 메시지를 중계해야 한다.
{
  const csSrc = rd("native_host/NativeHost.cs");
  const popupHtml = rd("assist.html");
  const popupJs = rd("scripts/assist-popup.js");

  ck("(50) C# 이 팝업 명령·양방향 중계를 처리",
     /B2B_ASSIST_POPUP/.test(csSrc) && /B2B_ASSIST_TO_POPUP/.test(csSrc)
     && /B2B_ASSIST_TO_MAIN/.test(csSrc) && /EnsureAssistPopupAsync/.test(csSrc));
  ck("(51) 팝업 창은 TopMost 가 아니라 Owner 관계(다른 앱 방해 금지)",
     /assistForm\.Owner = this/.test(csSrc)
     && !/assistForm\.TopMost\s*=\s*true/.test(csSrc));
  ck("(52) 팝업 X = 숨김(상태 유지) + 메인에 닫힘 통지",
     /e2\.Cancel = true;\s*\n\s*assistForm\.Hide\(\)/.test(csSrc)
     && /popup-closed/.test(csSrc));
  ck("(53) 두 번째 WebView2 는 같은 환경 공유(같은 프로세스 필수 조건)",
     /sharedWebEnv = env/.test(csSrc) && /CoreWebView2Environment env = sharedWebEnv/.test(csSrc));

  ck("(54) assist.html 존재 + 팝업 뷰 로드 + 미연결 안내",
     /assist-popup\.js/.test(popupHtml) && /assist-offline/.test(popupHtml));
  ck("(55) 팝업 뷰는 상태를 직접 만지지 않음(순수 화면)",
     !/state\.pipeline|replaceLogicAt|assistCommitProposal|callAssistLLM/.test(popupJs));
  ck("(56) 팝업 뷰: ready 핸드셰이크 + 커밋은 메시지로 위임",
     /post\(\{ t: "ready" \}\)/.test(popupJs) && /t: "commit", pid/.test(popupJs));

  ck("(57) 메인 브리지: 이력 재생·user·commit·clear 처리",
     /case "ready":/.test(uiSrc) && /case "user":/.test(uiSrc)
     && /case "commit":/.test(uiSrc) && /case "clear":/.test(uiSrc));
  ck("(58) 구버전 exe 폴백(무응답 시 DOM 팝업)",
     /_assistNativeAckTimer = setTimeout/.test(uiSrc) && /assistToggleDrawer\(\)/.test(uiSrc));
  ck("(59) 브라우저 모드는 기존 DOM 팝업 유지",
     /assistNativeShellAvailable\(\)/.test(uiSrc) && /nativeShell=1/.test(uiSrc));
}

// ── 12. 이슈 제보 패키지: 해결 불가 시 zip 묶음 + 지라 안내 ────────────────
{
  const reportSrc = rd("scripts/assist-report.js");
  const popupJs2 = rd("scripts/assist-popup.js");
  const htmlIdx = rd("index.html");

  ck("(60) report 액션이 프롬프트·루프에 존재",
     /action="report"/.test(coreSrc) && /parsed\.action === "report"/.test(coreSrc));
  ck("(61) 다운로드는 카드 버튼(사용자 클릭)에서만 — 루프에서 번들 생성 금지",
     !/assistPrepareReportBundle/.test(coreSrc));
  ck("(62) 묶음에 스킬 zip(중첩)·원본 파일·양식·진단·대화록 포함",
     /스킬\//.test(reportSrc) && /파일\//.test(reportSrc)
     && /제보양식\.txt/.test(reportSrc) && /진단\.txt/.test(reportSrc) && /대화록\.txt/.test(reportSrc));
  ck("(63) 지라 안내(주소·프로젝트·절차·보안 주의) 포함",
     /lgucorp\.atlassian\.net/.test(reportSrc) && /SBAGENT/.test(reportSrc)
     && /보안 주의/.test(reportSrc));
  ck("(64) 원본은 백엔드 보관본에서 회수 + 실패는 missing 으로 정직하게",
     /backendDownloadUrl/.test(reportSrc) && /missing\.push/.test(reportSrc));
  ck("(65) 양쪽 UI 에 제보 카드 + 브리지(report/report-build/report-result)",
     /assistRenderReportCard/.test(uiSrc) && /case "report-build":/.test(uiSrc)
     && /case "report":/.test(popupJs2) && /case "report-result":/.test(popupJs2));
  ck("(66) assist-report.js 로드 등록", /scripts\/assist-report\.js/.test(htmlIdx));

  // 양식 내용 실검증: 실제 상태로 생성해 필수 항목이 들어가는지
  const rb = { console, JSON, Date, Math, String, Number, Array, Set, Map, RegExp,
    B2B_BUILD_STAMP: "b2b-test",
    state: { pipeline: [{ id: "s1", code: "x" }], logicSaveBaseName: "한전스킬",
             inputsOriginal: [{ name: "정산_2026-04.xlsx" }], assist: { history: [
               { role: "user", content: "안 돼요" }, { role: "assistant", content: "확인했습니다" }] } },
    ASSIST_TOOLS: { "pipeline.list": { fn: () => ({ ok: true }) }, "diag.stepStatus": { fn: () => ({ ok: true }) },
                    "preflight.check": { fn: () => ({ ok: true }) }, "literals.scan": { fn: () => ({ ok: true }) } },
  };
  vm.createContext(rb);
  vm.runInContext(reportSrc, rb);
  const guide = vm.runInContext('assistBuildJiraGuideText({summary:"3단계 멈춤", reason:"원인 미상"}, {})', rb);
  ck("(67) 양식에 증상·스킬명·파일명·버전이 실제로 들어감",
     guide.includes("3단계 멈춤") && guide.includes("한전스킬")
     && guide.includes("정산_2026-04.xlsx") && guide.includes("b2b-test"), guide.slice(0, 120));
  const conv = vm.runInContext("assistBuildConversationText()", rb);
  ck("(68) 대화록에 사용자/AI 발화 포함", conv.includes("안 돼요") && conv.includes("확인했습니다"));
}

// ── 8. 2차 수정 회귀 잠금(검증 대응) ────────────────────────────────────────
{
  const gb = { console, JSON, Date, Math, String, Number, Array, Set, Map, RegExp,
    Object, state: { pipeline: [] },
    ASSIST_TOOLS: { "pipeline.list": { fn: () => ({}) }, "diag.stepStatus": { fn: () => ({}) } } };
  vm.createContext(gb);
  vm.runInContext(guardSrc, gb);
  const parse = (s) => { gb.__in = s; return vm.runInContext("assistParseAction(__in)", gb); };

  // (69) [R8] 액션 키 없는 bare JSON(데이터 예시)은 액션으로 채택하지 않는다 → 본문에서 안 지워짐
  const r69 = parse('이 단계 매핑은 {"단가": 1000} 형태입니다.');
  ck("(69) bare 데이터 JSON 은 액션 아님(block=null)", r69.parsed === false && r69.block === null, JSON.stringify(r69).slice(0, 100));

  // (70) [#6] 도구명이 action 에 직접 온 흔한 위반 → tool 디스패치로 재작성
  const r70 = parse('```b2b-action\n{"action":"pipeline.list"}\n```');
  ck("(70) {action:도구명} → tool 재작성", r70.action === "tool" && r70.args.tool === "pipeline.list", JSON.stringify(r70).slice(0, 100));

  // (71) [R8 후속] 상속 키(constructor)를 도구로 오인하지 않음(hasOwnProperty)
  const r71 = parse('```b2b-action\n{"action":"constructor"}\n```');
  ck("(71) constructor 는 도구 아님", r71.action !== "tool", JSON.stringify(r71).slice(0, 100));

  // (72) 도구명 대소문자 변형도 흡수
  const r72 = parse('```b2b-action\n{"tool":"Pipeline.List"}\n```');
  ck("(72) 대소문자 변형 도구명 흡수", r72.action === "tool" && r72.args.tool === "pipeline.list", JSON.stringify(r72).slice(0, 100));

  // (73) b2b-action 펜스면 액션 키 없이도 채택(사용자가 명시)
  const r73 = parse('```b2b-action\n{"args":{"tool":"pipeline.list"}}\n```');
  ck("(73) b2b-action 펜스는 액션키 없어도 block 채택", r73.block !== null, JSON.stringify(r73).slice(0, 100));
}

// (74) [#7] replaceLiteral to:0 은 "0" 으로 보존(값 삭제 아님) — 문자열화 로직만 국소 검증
ck("(74) to:0 falsy 코어션 제거", /args\.to != null \? String\(args\.to\) : ""/.test(coreSrc));
// (75) [R1] replaceLiteral 은 prompt 기준 게이트를 건너뛴다(다음 달 시트명 치환 허용):
// exactReferenceFailures 호출은 gate 블록의 replaceStepCode 분기 '안'에만 있어야 한다.
{
  const gateAt = coreSrc.indexOf("교체 코드도 생성기와 같은 결정적 정적 검사");
  const branchAt = coreSrc.indexOf('if (kind === "replaceStepCode") {', gateAt);
  const exactAt = coreSrc.indexOf("run(exactReferenceFailures", gateAt);
  ck("(75) prompt 기준 검사는 replaceStepCode 분기에만",
     gateAt > 0 && branchAt > gateAt && exactAt > branchAt);
}
// (76) [R2] 미적용 수정이 suffix 에 있으면 복원(이중 반영 차단)
ck("(76) 미적용 수정 이중반영 복원 가드",
   /suffix\.some\(s => s && s\._unappliedEdit\)/.test(pipeSrc) && /restorePipelineCheckpointForSuffix/.test(pipeSrc));
// (77) [R3] _unappliedEdit 해제는 status='applied'+활성일 때만(실행 안 된 스텝 낙인 보존)
ck("(77) 낙인 해제는 status=applied 게이트",
   /st\.status === "applied"[\s\S]{0,40}delete s\._unappliedEdit/.test(pipeSrc));
// (78) [off-by-one] applyMode:"none" 의 상태 경계는 idx(수정 스텝 자신)부터
ck("(78) applyMode none 경계 start=idx",
   /Math\.min\(existingResume, idx\) : idx/.test(pipeSrc));
// (79) [#1] 유휴(stall) 워치독 — 델타 수신마다 재장전(정상 긴 응답 오중단 방지)
ck("(79) stall 워치독 재장전", /armStall\(\)/.test(coreSrc) && /ASSIST_STALL_TIMEOUT_MS/.test(coreSrc));
// (80) [#3] assist 는 재시도 래퍼(callOpenAICompat) 경유 + think 방어
ck("(80) 재시도 래퍼 경유 + stripThink",
   /callOpenAICompat\(systemPrompt/.test(llmAssistSrc) && /assistStripThink/.test(llmAssistSrc));

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
