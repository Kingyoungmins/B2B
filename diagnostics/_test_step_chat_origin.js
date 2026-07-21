// [번호표 연결] 스텝 ↔ 원 요청 말풍선을 텍스트 매칭이 아니라 histId 로 잇는 기능의 회귀 테스트.
// 배경(사용자 실측): 복붙 캡처 스텝은 대화가 없어서, 수정 버튼을 누르면 텍스트 매칭의 순서 폴백이
// '남의 채팅'을 잡아 강조했다. 같은 문장으로 두 번 요청한 스텝도 첫 말풍선에 잘못 붙었다.
// node diagnostics/_test_step_chat_origin.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const ROOT = path.join(__dirname, "..");
const rd = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const chatSrc = rd("scripts/chat-ui.js");
const saveSrc = rd("scripts/save-load.js");
const schemaSrc = rd("scripts/file-schema.js");

function extract(src, name) {
  const st = src.indexOf("function " + name + "(");
  if (st < 0) throw new Error("not found: " + name);
  let p = src.indexOf("(", st), pd = 0;
  for (; p < src.length; p++) { if (src[p] === "(") pd++; else if (src[p] === ")") { pd--; if (pd === 0) break; } }
  let i = src.indexOf("{", p), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === "{") d++; else if (src[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(st, e);
}

const sb = { console, JSON, String, Number, Array, Set, Map, RegExp, state: {} };
vm.createContext(sb);
["originHistIdForPrompt", "stepChatOriginless", "_chatNormForMatch"].forEach(f => vm.runInContext(extract(chatSrc, f), sb));
vm.runInContext(extract(saveSrc, "promoteStepChatOrigins"), sb);

// ── 1. 생성 시 번호표 조회: 정확 일치, 뒤에서부터(가장 최근) ──────────────────
sb.state = { chatHistory: [
  { role: "user", content: "피벗 만들어줘", histId: "h1" },
  { role: "assistant", content: "만들었습니다", histId: "h2" },
  { role: "user", content: "피벗 만들어줘", histId: "h3" },     // 같은 문장 두 번째
] };
ck("(1) 같은 문장이면 '가장 최근' 말풍선의 번호표",
   vm.runInContext('originHistIdForPrompt("피벗 만들어줘")', sb) === "h3");
ck("(2) 없는 문장은 null", vm.runInContext('originHistIdForPrompt("없는 요청")', sb) === null);
ck("(3) 빈 문장은 null", vm.runInContext('originHistIdForPrompt("")', sb) === null);

// ── 2. 출처 없는 스텝 판정 ───────────────────────────────────────────────────
sb.__s1 = { prompt: "", code: "x" };
sb.__s2 = { prompt: "manual cell edit", code: "x" };
sb.__s3 = { prompt: "", code: "# [복붙 캡처] A→B\nctx.write(...)" };
sb.__s4 = { prompt: "피벗 만들어줘", code: "x" };
ck("(4) 빈 prompt = 출처 없음", vm.runInContext("stepChatOriginless(__s1)", sb) === true);
ck("(5) 수동 셀편집 = 출처 없음", vm.runInContext("stepChatOriginless(__s2)", sb) === true);
ck("(6) 복붙 캡처 코드 표식 = 출처 없음", vm.runInContext("stepChatOriginless(__s3)", sb) === true);
ck("(7) 정상 요청 스텝 = 출처 있음", vm.runInContext("stepChatOriginless(__s4)", sb) === false);

// ── 3. 구버전 승격: 유일할 때만 ─────────────────────────────────────────────
sb.state = {
  chatHistory: [
    { role: "user", content: "A열 합계 구해줘", histId: "u1" },
    { role: "user", content: "중복 문장", histId: "u2" },
    { role: "user", content: "중복 문장", histId: "u3" },
  ],
  pipeline: [
    { id: "s1", prompt: "A열 합계 구해줘", code: "x" },              // 유일 → 승격
    { id: "s2", prompt: "중복 문장", code: "x" },                    // 2개 → 모호, 승격 금지
    { id: "s3", prompt: "대화에 없는 요청", code: "x" },             // 0개 → 승격 금지
    { id: "s4", prompt: "manual cell edit", code: "x" },             // 캡처류 → 대상 아님
    { id: "s5", prompt: "A열 합계 구해줘", code: "x", originHistId: "keep" },  // 이미 있음 → 유지
  ],
};
const promoted = vm.runInContext("promoteStepChatOrigins()", sb);
ck("(8) 유일 일치만 승격(1건)", promoted === 1, promoted);
ck("(9) 유일 스텝은 그 말풍선 번호표", sb.state.pipeline[0].originHistId === "u1");
ck("(10) 중복 문장은 승격 안 함(오매핑 방지)", !sb.state.pipeline[1].originHistId);
ck("(11) 대화에 없으면 승격 안 함", !sb.state.pipeline[2].originHistId);
ck("(12) 캡처류는 대상 아님", !sb.state.pipeline[3].originHistId);
ck("(13) 기존 번호표는 덮지 않음", sb.state.pipeline[4].originHistId === "keep");

// ── 4. 배선(정적) ───────────────────────────────────────────────────────────
ck("(14) 스텝 생성 3경로에 번호표 부여",
   (chatSrc.match(/originHistId: originHistIdForPrompt\(/g) || []).length >= 3);
ck("(15) 채팅 수정 성공 시 번호표 갱신(시나리오②)",
   /st\.originHistId = oh/.test(chatSrc));
ck("(16) 수정 갱신이 prompt 는 건드리지 않음(대상 추론 보호)",
   /prompt 는 건드리지 않는다/.test(chatSrc));
ck("(17) 스크롤 0단: 번호표로 DOM 조회",
   /dataset\.histId === String\(step\.originHistId\)/.test(chatSrc));
ck("(18) 번호표 말풍선이 사라졌으면 텍스트 폴백 금지(정직하게 중단)",
   /삭제되었거나 비워져 찾을 수 없습니다/.test(chatSrc));
ck("(19) 출처 없는 스텝은 매칭 자체를 안 함 + 안내",
   /연결된 대화가 없습니다/.test(chatSrc));
ck("(20) 라이브·재렌더 양쪽에서 DOM 에 histId 바인딩",
   (chatSrc.match(/div\.dataset\.histId = /g) || []).length >= 1
   && /div\.dataset\.histId = msg\.histId/.test(saveSrc));
ck("(21) 저장 매니페스트·로드 화이트리스트에 originHistId 왕복",
   /originHistId: s\.originHistId \|\| null/.test(saveSrc)
   && (saveSrc.match(/originHistId: s\.originHistId \|\| null/g) || []).length >= 2);
ck("(22) 로드 시 구버전 승격 1회 호출",
   /promoteStepChatOrigins\(\);/.test(saveSrc));
ck("(23) 캡처 스텝 수정 시 '코드가 곧 명세' 문맥 주입",
   /코드가 곧 명세/.test(schemaSrc));
ck("(24) 매칭 코어(_matchStepToChatIndex)는 변경 없음(기존 테스트 보호)",
   /function _matchStepToChatIndex\(step, entries, stepIdx\) \{/.test(chatSrc));

// ── 5. [수정 모드 캡처 = 대체] 수정 버튼이 켜진 채 캡처하면 새 단계 추가가 아니라 대체 ──
// 실측: 1단계 수정 중 복붙 캡처 → 3단계로 새로 붙었음. 수정이면 그 단계가 바뀌어야 한다.
{
  const pipeSrc = rd("scripts/pipeline.js");
  const seg = pipeSrc.slice(pipeSrc.indexOf("btn-capture-copypaste"));
  ck("(25) 캡처 핸들러가 수정 모드를 분기(editingStepId → replaceLogicAt)",
     /state\.editingStepId && typeof replaceLogicAt === "function"/.test(seg)
     && /replaceLogicAt\(editId, data\.code/.test(seg));
  ck("(26) 대체 후 정체성 갱신: 캡처 prompt + 번호표 해제 + 대상 파일",
     /st\.prompt = "복붙 캡처: "/.test(seg) && /delete st\.originHistId/.test(seg)
     && /st\.targetFileId = step\.targetFileId/.test(seg));
  ck("(27) 대체 후 수정 모드 해제 + 실패 시 추가로도 안 붙임(return)",
     /state\.editingStepId = null/.test(seg)
     && /추가로도 붙이지 않는다/.test(seg));
  ck("(28) 수정 모드가 아니면 기존 동작(applyLogic 추가) 유지",
     /applyLogic\(step\);/.test(seg));
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
