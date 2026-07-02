// [검증/명확화 에이전트] 모호 질의만 한 번 되묻고, 구체적 질의는 그냥 통과(빡세지 않게).
// 휴리스틱(clarifyVerifierLikelyUnderspecified) + verifier 호출/파싱(clarifyVerifierAskIfNeeded) 검증.
const fs = require("fs");
const path = require("path");

// oneShotImpl: callLLMOneShot 대역 함수 본문(문자열). 호출 여부는 globalThis.__called 로 추적.
function loadVerifier(oneShotImpl) {
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
  const start = src.indexOf("function clarifyVerifierDeterministicQuestion");
  const end = src.indexOf("async function sendChat", start);
  let block = `
globalThis.__called = false;
globalThis.buildSchemaSummary = () => "테스트.xlsx > Sheet1 (A:매출, B:지점)";
globalThis.callLLMOneShot = ${oneShotImpl};
`;
  block += src.slice(start, end);
  block += `
globalThis.__cv = { det: clarifyVerifierDeterministicQuestion, heur: clarifyVerifierLikelyUnderspecified, ask: clarifyVerifierAskIfNeeded };`;
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
  const naverAmbiguous =
    "\u0040\uD30C\uC77C[\uB124\uC774\uBC84\uD074\uB77C\uC6B0\uB4DC_5\uC6D4 \uD2B8\uB798\uD53D.xlsx] " +
    "\uC2DC\uD2B8\uBA85\uB4E4\uC740 '500164014578' \uC774\uB7F0\uC2DD\uC73C\uB85C \uC5EC\uB7EC\uAC1C \uC2DC\uD2B8\uAC00 \uAD6C\uC131\uB418\uC5B4\uC788\uC74C. " +
    "\uAC01 \uC2DC\uD2B8\uC5D0\uC11C 3\uD589 \uD5E4\uB354 IN\uACFC OUT\uC744 \uCC38\uACE0\uD558\uC5EC OUT \uC5F4\uC5D0 \uD574\uB2F9\uD558\uB294 \uB370\uC774\uD130\uB294 " +
    "\uC120\uD0DD \uBC94\uC704: \u0040\uBC94\uC704[\uC791\uC5C5\uC911.xlsx/\uD1B5\uD569(\uAD6D\uB0B4)!B:BI]\uC5D0 \uC801\uC5B4\uC57C\uD568. " +
    "\uD5E4\uB354 \uAD04\uD638\uC548 \uBC88\uD638\uC640 \uC2DC\uD2B8\uBA85\uC744 \uB9E4\uCE6D\uD574\uC11C \uCC44\uC6CC\uC918.";
  const naverExplicitOrder = naverAmbiguous + " \uD589\uC740 \uC18C\uC2A4 \uB370\uC774\uD130 \uC21C\uC11C\uB300\uB85C \uBD99\uC5EC\uB123\uC5B4.";
  const detQ = globalThis.__cv.det(naverAmbiguous) || "";
  ck("[추가질문] 여러 시트→대상 열 채우기에서 행 기준 누락 감지", /행은/.test(detQ) && /날짜|시간/.test(detQ));
  ck("[통과] 행 순서 명시 시 추가질문 없음", globalThis.__cv.det(naverExplicitOrder) === null);

  // ── 집계 경계 모호(소계+합계): 합계행 포함 여부를 결정적으로 되묻는다 ─────────
  const { det } = loadVerifier("async () => 'OK'");
  const sumQ = det("요약 시트 D열 소계 총액을 구하는 SUM 수식을 J5에 넣으세요. 나중에 D열이 바뀌면 자동 갱신되어야 합니다.") || "";
  ck("[추가질문] '소계 총액' 집계 → 합계행 포함 여부 되물음", /합계.*(?:행|포함)|두\s*배/.test(sumQ));
  ck("[추가질문] '소계 합계' 도 되물음", /합계/.test(det("D열 소계 합계 내줘") || ""));
  ck("[통과] 명시 범위(D6:D19) 주면 안 되물음", det("D6:D19 소계 합계를 J5에 넣어줘") === null);
  ck("[통과] '합계 행은 제외' 명시하면 안 되물음", det("소계 총액을 구하되 맨 아래 합계 행은 제외하고 J5에") === null);
  ck("[통과] '소계 항목까지만' 명시하면 안 되물음", det("소계 항목 행까지만 합산해서 J5에") === null);
  ck("[통과] 소계 없는 일반 합계는 안 되물음", det("B열 합계를 C에 써줘") === null);
  ck("[통과] 소계 행 '추가'는 집계가 아니라 안 되물음", det("각 그룹마다 소계 행 추가해줘") === null);

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
