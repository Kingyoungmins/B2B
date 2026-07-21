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
globalThis.__cv = { det: clarifyVerifierDeterministicQuestion, heur: clarifyVerifierLikelyUnderspecified, ask: clarifyVerifierAskIfNeeded, digest: buildSheetStructureDigest };`;
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

  // ── 구조 다이제스트(순수): 근거를 '단어'가 아니라 '실제 데이터'에서 뽑는다 ─────────
  // 상단 헤더(1~4행) + 데이터(5~) + 맨 아래 '합계' 총계 행(엑셀 7행)이 있는 표
  const aoaWithTotal = [
    ["요약"], [null], [null], ["구분", "명칭", null, null, null, "합계"],
    ["서초", "A", null, null, null, 100],
    ["동작", "B", null, null, null, 200],
    ["합계", null, null, null, null, 300],   // ← 본문 총계 행 (엑셀 7행)
  ];
  const aoaNoTotal = [
    ["요약"], [null], [null], ["구분", "명칭", null, null, null, "값"],
    ["서초", "A", null, null, null, 100],
    ["동작", "B", null, null, null, 200],
    ["강남", "C", null, null, null, 400],
  ];
  const { digest } = loadVerifier("async () => 'OK'");
  const dWith = digest(aoaWithTotal, "요약");
  const dNo = digest(aoaNoTotal, "요약");
  ck("[다이제스트] 총계 행 있으면 hasLandmarks=true", dWith.hasLandmarks === true);
  ck("[다이제스트] 총계 행 위치(7행) 포착", dWith.totalRows.indexOf(7) >= 0 && /7행/.test(dWith.text));
  ck("[다이제스트] 헤더의 '합계' 컬럼명은 총계 행으로 오인 안 함", dWith.totalRows.indexOf(4) < 0);
  ck("[다이제스트] 평범한 표는 hasLandmarks=false", dNo.hasLandmarks === false && dNo.totalRows.length === 0);

  const jReq = "요약 시트 F열 데이터 합계를 J4에 값으로 적어줘";

  // ── verifier: 시트에 총계 행이 '실재'하면(표현 무관) LLM 검증 → 되묻는다 ──────────
  {
    const { ask } = loadVerifier("async (sys) => { globalThis.__called = true; globalThis.__sys = sys; return 'ASK: 맨 아래 합계 행도 포함할까요?'; }");
    globalThis.__called = false; globalThis.__sys = "";
    const r = await ask(jReq, { aoa: aoaWithTotal });
    ck("[되묻기] 총계 행 실재 → LLM 호출되어 되물음", globalThis.__called === true && /합계 행도 포함/.test(r || ""));
    ck("[근거주입] LLM 프롬프트에 실제 시트 구조(7행 합계)가 들어감", /7행/.test(globalThis.__sys) && /특이 행|합계\/총계\/소계/.test(globalThis.__sys));
  }
  // 다양한 표현이어도 동일하게 동작(단어에 의존하지 않음): "합을 구해서"/@범위 멘션
  {
    const { ask } = loadVerifier("async () => { globalThis.__called = true; return 'ASK: 합계 행 포함 여부?'; }");
    globalThis.__called = false;
    const r = await ask("@범위[a.xlsx/요약!F:F] 합을 구해서 @범위[a.xlsx/요약!J4]에 써줘", { aoa: aoaWithTotal });
    ck("[표현무관] '합을 구해서'+멘션도 총계 행 있으면 되물음", globalThis.__called === true && /합계/.test(r || ""));
  }
  // ── verifier: 총계 행 있어도 LLM 이 OK(정렬 등 비합산·이미 지정)면 통과 ──────────
  {
    const { ask } = loadVerifier("async () => 'OK'");
    const r = await ask(jReq, { aoa: aoaWithTotal });
    ck("[관대] 총계 행 있어도 LLM 이 OK 면 통과", r === null);
  }
  // ── verifier: 총계 행 없는 평범한 표 + 구체 요청 → LLM 미호출(빠른 통과) ──────────
  {
    const { ask } = loadVerifier("async () => { globalThis.__called = true; return 'ASK: ?'; }");
    globalThis.__called = false;
    const r = await ask(jReq, { aoa: aoaNoTotal });
    ck("[비호출] 평범한 표 + 구체 요청은 LLM 미호출", globalThis.__called === false && r === null);
  }
  // ── verifier: 데이터 못 보는(aoa 없음) 구체 질의도 미호출 ─────────────────────
  {
    const { ask } = loadVerifier("async () => { globalThis.__called = true; return 'ASK: ?'; }");
    globalThis.__called = false;
    const r = await ask("B열 합계를 C에 써줘");
    ck("[비호출] 데이터 없고 구체적이면 미호출", globalThis.__called === false && r === null);
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
