// [한전 스킬셋] 시트 생성 헬퍼(filter_to_sheet/pivot/native_pivot) 산출물의 생성시트 인식 검증.
// 실제 Step 3 원문(청구계정번호 필터 → 무선간선망/고압모계기/고압자계기) 기반.
// node diagnostics/_test_creator_sheets.js
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
const sb = { console };
vm.createContext(sb);
["runnerMappingNorm", "runnerLooksLikeA1Address", "runnerAddGeneratedSheet",
 "runnerIsGeneratedSheet", "runnerExtractGeneratedSheetsFromCode"].forEach(f => vm.runInContext(extract(f), sb));
const gen = c => vm.runInContext("runnerExtractGeneratedSheetsFromCode(" + JSON.stringify(c) + ")", sb);
const isG = (g, b, s) => vm.runInContext("runnerIsGeneratedSheet(" + JSON.stringify(g) + "," + JSON.stringify(b) + "," + JSON.stringify(s) + ")", sb);

// 실제 한전 스킬셋 Step 3 원문
const STEP3 = `def transform(ctx):
    book = ctx.book("한국전력공사_202606_v1.1_DSMC_260710.xlsx")
    sheet = "상품번호별"
    header_row = 1
    col_idx = book.find_header(sheet, "청구계정번호", header_row=header_row) - 1
    book.filter_to_sheet(sheet, lambda r: str(r[col_idx]) == "512102397744", "무선간선망")
    book.filter_to_sheet(sheet, lambda r: str(r[col_idx]) == "611769344898", "고압모계기")
    book.filter_to_sheet(sheet, lambda r: str(r[col_idx]) == "619299519426", "고압자계기")`;
const BOOK = "한국전력공사_202606_v1.1_DSMC_260710.xlsx";
const g = gen(STEP3);
ck("(1) 무선간선망 = 생성시트", isG(g, BOOK, "무선간선망") === true, g);
ck("(2) 고압모계기 = 생성시트", isG(g, BOOK, "고압모계기") === true);
ck("(3) 고압자계기 = 생성시트", isG(g, BOOK, "고압자계기") === true);
ck("(4) 조건 키(512...)는 생성시트 아님", isG(g, "", "512102397744") === false, g);
ck("(5) 원본 상품번호별은 생성시트 아님", isG(g, "", "상품번호별") === false, g);
ck("(6) pivot 기본 산출 '피벗요약'", isG(gen(`ctx.pivot("데이터", group_by="지점", value="금액")`), "", "피벗요약") === true);
ck("(7) pivot dest_name= 리터럴", isG(gen(`ctx.native_pivot("데이터", group_by="지점", dest_name="요약P")`), "", "요약P") === true);
ck("(8) filter_to_sheet + header_rows= 꼬리", isG(gen(`book2 = ctx.book("A.xlsx")\nbook2.filter_to_sheet("원본", lambda r: r[0]=="x", "결과시트", header_rows=2)`), "A.xlsx", "결과시트") === true);
ck("(9) dest_name= 변수 해석", isG(gen(`dst = "월요약"\nctx.pivot("데이터", group_by="지점", dest_name=dst)`), "", "월요약") === true);

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
