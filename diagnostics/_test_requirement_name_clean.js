// [실측][UCAP 고객] 요구 파일명 앞부분 잘림 — runnerCleanWorkbookRequirementName 검증.
// 파일명이 input)/output) 로 시작하고 공백(타임스탬프)을 품으면, 영어 산문 접두사 제거
// 휴리스틱(\b 부분일치)이 오발동해 마지막 토큰("10_02_56_….xlsx")만 남기던 버그.
// node diagnostics/_test_requirement_name_clean.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "drop-handling.js"), "utf8");
function extract(name) {
  const marker = "function " + name + "(";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  let i = src.indexOf("{", start), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(extract("runnerCleanWorkbookRequirementName"), sandbox);
const clean = v => vm.runInContext(`runnerCleanWorkbookRequirementName(${JSON.stringify(v)})`, sandbox);

// 실측 케이스(UCAP 고객): input) 시작 + 타임스탬프 공백 → 통째로 보존돼야 한다.
const UCAP_IN = "input)_기업DW추출_131 통화상세내역(마스킹)_2026-03-13 10_02_56_DSMC_260713.xlsx";
ck("(1) input) 시작 + 공백 파일명 통째 보존", clean(UCAP_IN) === UCAP_IN, clean(UCAP_IN));
const UCAP_OUT = "output)_LG_CNS_마곡_UCAP521606858760_26년03월_청구_고객.xlsx";
ck("(2) output) 시작(공백 없음) 보존", clean(UCAP_OUT) === UCAP_OUT, clean(UCAP_OUT));

// 원래 의도(영어 산문 접두사 제거)는 유지 — 독립 단어일 때만.
ck("(3) 영어 산문 접두사는 여전히 제거",
   clean("Create Validation_Result sheet from expected_output.xlsx") === "expected_output.xlsx",
   clean("Create Validation_Result sheet from expected_output.xlsx"));
ck("(4) 'copy the file to 결과.xlsx' → 결과.xlsx",
   clean("copy the file to 결과.xlsx") === "결과.xlsx", clean("copy the file to 결과.xlsx"));

// 파일명 안에 산문 단어가 '부분 포함'돼도(독립 토큰 아님) 안 자른다.
ck("(5) inputs_월간 정산 2026.xlsx 보존(부분일치 아님)",
   clean("inputs_월간 정산 2026.xlsx") === "inputs_월간 정산 2026.xlsx", clean("inputs_월간 정산 2026.xlsx"));
ck("(6) 공백 있는 일반 한글 파일명 보존", clean("월별 정산 결과.xlsx") === "월별 정산 결과.xlsx", clean("월별 정산 결과.xlsx"));

// 확장자 없는 값/공백 없는 값 등 기존 동작 비회귀
ck("(7) 확장자 없으면 그대로", clean("그냥텍스트") === "그냥텍스트");
ck("(8) 공백 없는 파일명 그대로", clean("월간정산_2026_06.xlsx") === "월간정산_2026_06.xlsx");

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
