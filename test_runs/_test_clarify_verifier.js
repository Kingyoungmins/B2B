// [검증/명확화 에이전트] 모호 질의만 한 번 되묻고, 구체적 질의는 그냥 통과(빡세지 않게).
// 휴리스틱(clarifyVerifierLikelyUnderspecified) + verifier 호출/파싱(clarifyVerifierAskIfNeeded) 검증.
const fs = require("fs");
const path = require("path");

// oneShotImpl: callLLMOneShot 대역 함수 본문(문자열). 호출 여부는 globalThis.__called 로 추적.
function loadVerifier(oneShotImpl) {
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
  const start = src.indexOf("function clarifyVerifierLikelyUnderspecified");
  const end = src.indexOf("async function sendChat", start);
  let block = `
globalThis.__called = false;
globalThis.buildSchemaSummary = () => "테스트.xlsx > Sheet1 (A:매출, B:지점)";
globalThis.callLLMOneShot = ${oneShotImpl};
`;
  block += src.slice(start, end);
  block += `
globalThis.__cv = { heur: clarifyVerifierLikelyUnderspecified, ask: clarifyVerifierAskIfNeeded };`;
  eval(block);
  return globalThis.__cv;
}

let pass = 0, fail = 0;
function ck(name, cond) { if (cond) { pass++; console.log(" OK  " + name); } else { fail++; console.log("FAIL " + name); } }

async function main() {
  // ── 휴리스틱: 구체적 질의는 의심하지 않는다(통과) ──────────────────────
  const { heur } = loadVerifier("async () => 'OK'");
  ck("[통과] @멘션 있는 질의", heur("@범위[a.xlsx!A1:C10] 합계 내줘") === false);
  ck("[통과] 셀/열 참조 있는 질의", heur("B/C 최대값을 D열에 넣어줘") === false);
  ck("[통과] 구체 동작(정렬)", heur("이 표 정렬해줘") === false);
  ck("[통과] 구체 동작(중복 제거)", heur("중복된 행 지워줘") === false);
  // ── 휴리스틱: 대상·동작 다 빠진 막연한 질의만 의심 ─────────────────────
  ck("[의심] 막연한 '정리해줘'", heur("이거 좀 보기 좋게 해줘") === true);
  ck("[의심] '알아서 처리'", heur("알아서 적당히 처리해줘") === true);
  ck("[의심] 빈 동작", heur("이거 어떻게 좀 해봐") === true);
  ck("[경계] 빈 문자열", heur("") === false);

  // ── verifier: 구체 질의는 LLM 호출조차 안 한다(지연 0, 빡세지 않음) ─────
  {
    const { ask } = loadVerifier("async () => { globalThis.__called = true; return 'ASK: ?'; }");
    const r = await ask("B열 합계를 C에 써줘");
    ck("[비호출] 구체 질의는 verifier LLM 미호출", globalThis.__called === false && r === null);
  }
  // ── verifier: 모호 질의 + LLM 이 OK → 되묻지 않음 ─────────────────────
  {
    const { ask } = loadVerifier("async () => 'OK'");
    const r = await ask("이거 좀 정리해줘");
    ck("[관대] 모호해도 LLM 이 OK 면 통과", r === null);
  }
  // ── verifier: 모호 질의 + LLM 이 ASK → 그 질문을 돌려준다 ───────────────
  {
    const { ask } = loadVerifier("async () => 'ASK: 어느 파일의 어느 시트를 정리할까요?'");
    const r = await ask("이거 좀 정리해줘");
    ck("[되묻기] ASK 면 질문 반환", r === "어느 파일의 어느 시트를 정리할까요?");
  }
  // ── verifier: LLM 실패해도 막지 않고 통과(null) ───────────────────────
  {
    const { ask } = loadVerifier("async () => { throw new Error('network'); }");
    const r = await ask("이거 좀 정리해줘");
    ck("[견고] verifier 실패 시 막지 않고 통과", r === null);
  }
  // ── verifier: 전각 콜론(：) ASK 도 파싱 ───────────────────────────────
  {
    const { ask } = loadVerifier("async () => 'ASK： 무엇을 어디에 쓸까요?'");
    const r = await ask("이거 좀 해줘");
    ck("[파싱] 전각 콜론 ASK 도 인식", r === "무엇을 어디에 쓸까요?");
  }

  console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}

main();
