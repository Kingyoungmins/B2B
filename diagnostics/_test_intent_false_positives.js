// [의도판정 오탐] '정확 참조' 에코(시트/파일명·"코드에 그대로 복사")가 duplicateRowDelete/idPivot 등
//   의도판정을 오탐시켜, 값붙여넣기 요청이 '중복행 삭제'로 오분류(무관 규칙 주입)되거나 상품명 피벗이
//   '식별자 피벗'으로 오판(NumberFormat="@" 재생성)되던 것을 막는다.
//   근본: routingIntentText 가 @토큰만 지우고 "[정확 참조]"/"정확 시트명:"/"코드에 그대로 복사" 평문
//   에코를 안 지웠고, idPivotIntent 가 bare '코드/번호/계정' 토큰을 봐서 규칙문 '코드'에 오탐(실측 2026-07-31,
//   사용자 제보 output_02월 검증파일: 시트 "…CCU중복건 제거…" 값붙여넣기).
//   chat-ui.js 의 '실제 함수'(routingIntentText/duplicateRowDeleteIntent/conditionalRowDeleteIntent/
//   requestedExcelColumnLetters/excelColumnLetterToIndex)를 추출해 그대로 구동한다(Excel 불필요).
// 실행: node diagnostics/_test_intent_false_positives.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8");

let pass = 0, fail = 0;
const t = (n, c, got) => {
  if (c) { pass++; console.log("PASS " + n); }
  else { fail++; console.log("FAIL " + n + (got !== undefined ? "  got=" + JSON.stringify(got) : "")); }
};

function extractFn(str, name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(");
  const m = re.exec(str);
  if (!m) throw new Error("not found: " + name);
  const start = m.index;
  let i = start + m[0].length - 1, pd = 0;
  for (; i < str.length; i++) {
    if (str[i] === "(") pd++;
    else if (str[i] === ")") { pd--; if (pd === 0) { i++; break; } }
  }
  const open = str.indexOf("{", i);
  let d = 0;
  for (let j = open; j < str.length; j++) {
    if (str[j] === "{") d++;
    else if (str[j] === "}") { d--; if (d === 0) return str.slice(start, j + 1); }
  }
  throw new Error("unbalanced: " + name);
}

const REAL = [
  "routingIntentText", "duplicateRowDeleteIntent", "conditionalRowDeleteIntent",
  "requestedExcelColumnLetters", "excelColumnLetterToIndex",
  "matchFillIntent", "pivotIntent", "lookupJoinIntent",
].map(n => extractFn(src, n)).join("\n\n");

// idPivotIntent 는 검증 함수 내부의 const 표현식이라, 실제 routingIntentText(추출본)를 써서 소스와 동일하게 재구성.
// (token 정규식이 회귀하면 이 파일도 같이 고쳐야 하는 최소 중복만 남긴다.)
const HARNESS = REAL + `
function idPivotIntent(sourceUserMessage, code) {
  const blob = routingIntentText(String(sourceUserMessage || "")) + "\\n" + (code || "");
  return /(피벗|pivot|그룹|요약|호유형|분리|열로)/i.test(blob)
    && /(발신번호|전화번호|휴대폰번호|가입번호|고객번호|계약번호|계좌번호|사업자번호|주민(?:등록)?번호|우편번호|청구계정번호|계정번호|\\bEID\\b|\\bID\\b|식별자)/i.test(blob);
}
return { routingIntentText, duplicateRowDeleteIntent, conditionalRowDeleteIntent, idPivotIntent, matchFillIntent, pivotIntent, lookupJoinIntent };
`;
const api = new Function(HARNESS)();

// ── 실측 재현: output_02월 검증파일 값붙여넣기(대상 시트 "…CCU중복건 제거…") ──
const valuePaste = '@시트[input_202602_SS001643_ENTR_BY_STACC_001.xlsx/MVNO상품명별요약] 시트보고 선택 범위: @범위[output_02월 검증파일.xlsx/올인원_중고차_CCU중복건 제거_토레스무상제공 등 요약!A4:E12] 채워.\n\n[정확 참조]\n- 시트명: 파일 "input_202602_SS001643_ENTR_BY_STACC_001.xlsx", 시트 "MVNO상품명별요약"\n- 선택 범위: output_02월 검증파일.xlsx/올인원_중고차_CCU중복건 제거_토레스무상제공 등 요약!A4:E12\n[정확 참조 사용 규칙 - 강제]\n- 아래 파일명/시트명/범위/컬럼명은 코드에 그대로 복사하세요. 번역, 영문화, 띄어쓰기 보정, 대소문자 변경 금지.\n- 특히 한글 시트명은 절대 번역하지 마세요. 예: 통합인터넷(국제) -> 통합internet(국제) 는 실패입니다.\n- 정확 시트명: "올인원_중고차_CCU중복건 제거_토레스무상제공 등 요약"\n- 정확 주소: "A4:E12"';
const productVba = 'Sub B2BSkill()\n  colCount = FindColumnByKeyword(wsDst, 4, "건수")\n  wsDst.Range("A5").Value = out\nEnd Sub';

// ── 무회귀: 진짜 중복행 삭제 / 진짜 식별자 피벗 ──
const realDelete = '@범위[531_로우데이터.xlsx/sheet1!E2:T300000] E열 MVNO상품명이 안전제일인 행 중 같은 EID 그룹에서 수납금액이 1 미만인 중복 행을 삭제해줘. 수납금액 1 이상은 보호.';
const realDelete2 = '중복 행 삭제해줘. 같은 가입번호면 위쪽 먼저 지우고 아래 하나만 남겨.';
const idPivotSrc = '발신번호별로 피벗 만들어 요약해줘';

t("값붙여넣기 → duplicateRowDeleteIntent=false(오탐 제거)", api.duplicateRowDeleteIntent(valuePaste) === false, api.duplicateRowDeleteIntent(valuePaste));
t("값붙여넣기 → conditionalRowDeleteIntent=false", api.conditionalRowDeleteIntent(valuePaste) === false, api.conditionalRowDeleteIntent(valuePaste));
t("값붙여넣기(상품명 피벗) → idPivotIntent=false(오탐 제거)", api.idPivotIntent(valuePaste, productVba) === false, api.idPivotIntent(valuePaste, productVba));
t("routingIntentText 가 시트명 '중복/제거' 제거", !/중복|제거|삭제/.test(api.routingIntentText(valuePaste)), api.routingIntentText(valuePaste).replace(/\s+/g, " ").trim());

t("무회귀: 진짜 중복삭제1 → duplicateRowDeleteIntent=true", api.duplicateRowDeleteIntent(realDelete) === true);
t("무회귀: 진짜 중복삭제2 → duplicateRowDeleteIntent=true", api.duplicateRowDeleteIntent(realDelete2) === true);
t("무회귀: 발신번호 피벗 → idPivotIntent=true", api.idPivotIntent(idPivotSrc, "") === true);
t("무회귀: 가입번호 요약 → idPivotIntent=true", api.idPivotIntent("가입번호 기준 그룹 요약", "") === true);

// ── match_fill 라우팅: 이름 맞춰 값 채우기 → match_fill, 순수 피벗생성/단일 vlookup 은 아님 ──
t("값붙여넣기(이름 맞춰 값만 채워) → matchFillIntent=true", api.matchFillIntent(valuePaste + "\n구분명 이름 맞춰서 값만 채워. 이름 완전히 같지 않아도 매칭해줘.") === true);
t("무회귀: '피벗 만들어줘' → matchFillIntent=false", api.matchFillIntent("MVNO상품명별로 수납금액 합계 피벗 만들어줘") === false);
t("무회귀: 단가표 단일 vlookup → matchFillIntent=false", api.matchFillIntent("단가표에서 상품으로 단가 찾아 채워") === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
