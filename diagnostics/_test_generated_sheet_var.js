// [SBAGENT-198] 생성시트 변수 해석 검증 — drop-handling.js 의 실제 함수를 추출해 구동.
// Step5(첫 시트→"sheet1" rename, 변수 인자)가 생성시트로 등록되어 매핑 요구에서 제외되는지.
// node diagnostics/_test_generated_sheet_var.js
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
["runnerMappingNorm", "runnerLooksLikeA1Address", "runnerAddGeneratedSheet",
 "runnerIsGeneratedSheet", "runnerExtractGeneratedSheetsFromCode"].forEach(fn =>
  vm.runInContext(extract(fn), sandbox));
const gen = code => vm.runInContext("runnerExtractGeneratedSheetsFromCode(" + JSON.stringify(code) + ")", sandbox);
const isGen = (g, book, sheet) =>
  vm.runInContext("runnerIsGeneratedSheet(" + JSON.stringify(g) + "," + JSON.stringify(book) + "," + JSON.stringify(sheet) + ")", sandbox);

// ── 실제 실패 스킬의 Step 5 원문 (SBAGENT-198 첨부 zip) ──
const STEP5 = `def transform(ctx):
    book = ctx.book("서비스통합통계월별목록_20260709172636.xls")
    sheets = book.sheets()

    if not sheets:
        raise ValueError("파일에 시트가 없습니다.")

    old_name = sheets[0]
    new_name = "sheet1"

    if old_name != new_name:
        book.rename_sheet(old_name, new_name)`;

const g5 = gen(STEP5);
ck("(1) Step5 변수 rename: sheet1 생성시트 등록", isGen(g5, "서비스통합통계월별목록_20260709172636.xls", "sheet1") === true, g5);
ck("(2) Step5: book 스코프 정확(서비스…xls)", g5.some(x => x.sheet === "sheet1" && x.book === "서비스통합통계월별목록_20260709172636.xls"), g5);

// Step 6 (RCS, 동일 패턴)
const STEP6 = STEP5.replace(/서비스통합통계월별목록_20260709172636/g, "RCS통계월별목록_20260709172709");
ck("(3) Step6 동일 패턴 등록", isGen(gen(STEP6), "RCS통계월별목록_20260709172709.xls", "sheet1") === true);

// Step 7 (읽기 전용 — src_sheet="sheet1" 변수는 read_cell 에만 쓰임 → 생성 아님)
const STEP7 = `def transform(ctx):
    src_file = "서비스통합통계월별목록_20260709172636.xls"
    src_sheet = "sheet1"
    src_cell = "M4"
    src_book = ctx.book(src_file)
    val = src_book.read_cell(src_sheet, src_cell)
    dst_book = ctx.book("KB카드_메시지_요금정산_DSMC_260709.xlsx")
    dst_book.write_cell("2026년", "I5", val)`;
ck("(4) Step7 읽기 변수는 생성 등록 안 됨", isGen(gen(STEP7), "", "sheet1") === false, gen(STEP7));

// 기존 동작 비회귀: 인라인 리터럴 rename
ck("(5) 인라인 리터럴 rename 유지", isGen(gen(`ctx.book("A.xlsx").rename_sheet("원본", "결과")`), "A.xlsx", "결과") === true);

// kwarg 형태: rename_sheet(old, new_name="검증")
ck("(6) new_name= kwarg 리터럴", isGen(gen(`book = ctx.book("B.xlsx")\nbook.rename_sheet(old, new_name="검증")`), "B.xlsx", "검증") === true);

// add_sheet 변수 인자
ck("(7) add_sheet 변수 인자", isGen(gen(`name = "요약시트"\nctx.add_sheet(name)`), "", "요약시트") === true);

// VBA 비교문 비회귀(생성 오판 금지)
ck("(8) VBA If .Name= 비교문은 생성 아님", isGen(gen(`If sh.Name = "기존시트" Then\n  found = True\nEnd If`), "", "기존시트") === false);

// VBA 변수 .Name= 대입(기존 지원 유지)
ck("(9) VBA 변수 .Name= 유지", isGen(gen(`v = "새시트"\nws.Name = v`), "", "새시트") === true);

// A1 주소 변수는 필터
ck("(10) A1 주소 변수 필터", isGen(gen(`c = "M4"\nctx.add_sheet(c)`), "", "M4") === false);

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
