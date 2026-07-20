// [실측][한전 인천본부] 생성 시트/소유자 판정의 3중 허점 회귀 테스트.
//  (1) filter_to_sheet(src, lambda …, "목적지") — 람다 내부 리터럴을 산출물로 오등록하고 목적지를 놓침
//  (2) 시트 인자가 변수(sheet = "Sheet1"; book.delete_rows(sheet, …))면 소유자 판정 미탐
//  (3) runnerPyBookVarMap 이 괄호 포함 파일명("…복사본 (2).xlsx")에서 매칭 실패
// node diagnostics/_test_lambda_dest_owner_var.js
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
const sandbox = { console, Map, Set, RegExp };
vm.createContext(sandbox);
["runnerMappingNorm", "runnerLooksLikeA1Address", "runnerAddGeneratedSheet", "runnerPyBookVarMap",
 "runnerSplitTopLevelArgs", "runnerSliceCallArgs", "runnerExtractGeneratedSheetsFromCode",
 "runnerSheetOwnersFromCode"].forEach(fn => vm.runInContext(extract(fn), sandbox));
sandbox.normalizeText = undefined;

const gen = code => vm.runInContext(`runnerExtractGeneratedSheetsFromCode(${JSON.stringify(code)})`, sandbox).map(g => g.sheet);
const owners = code => vm.runInContext(`runnerSheetOwnersFromCode(${JSON.stringify(code)})`, sandbox);

// (1)(2) 람다 조건의 filter_to_sheet — 한전 인천본부 Step 3 원문 축약
const STEP3 = `def transform(ctx):
    book = ctx.book("한국전력공사_202606_v1.1_DSMC_260710.xlsx")
    sheet = "상품번호별"
    def match_account(row, target):
        return str(row[0]).strip() == target
    book.filter_to_sheet(sheet, lambda r: match_account(r, "512102405339"), "무선간선망")
    book.filter_to_sheet(sheet, lambda r: match_account(r, "612192188403"), "고압모계기")
`;
const g3 = gen(STEP3);
ck("(1) 람다 조건에서도 목적지 리터럴 인식", g3.includes("무선간선망") && g3.includes("고압모계기"), g3);
ck("(2) 람다 내부 리터럴 오등록 없음", !g3.includes("512102405339") && !g3.includes("612192188403"), g3);

// (3) 목적지가 변수인 경우 비회귀
const gVar = gen(`def transform(ctx):
    dest = "결과시트"
    ctx.filter_to_sheet("원본", lambda r: r[0] == "x", dest)
`);
ck("(3) 목적지 변수 해석 비회귀", gVar.includes("결과시트"), gVar);

// (4) 단순 조건(비람다) 비회귀 + kwarg 비회귀
ck("(4) 단순 3인자 비회귀", gen(`ctx.filter_to_sheet("원본", cond, "새시트")`).includes("새시트"));
ck("(5) dest_name kwarg 비회귀", gen(`ctx.filter_to_sheet("원본", lambda r: f(r, "x"), dest_name="키워드시트")`).includes("키워드시트"));

// (6)(7) 시트 변수 소유자 판정 — 한전 인천본부 Step 26 원문
const STEP26 = `def transform(ctx):
    book = ctx.book("01. 한전_DAS_배전자동화_청구세부내역_도서_2026-07-14 13_25_33_DSMC_260714 - 복사본 (2).xlsx")
    sheet = "Sheet1"
    book.delete_rows(sheet, "1:9")
`;
const o26 = owners(STEP26);
ck("(6) [핵심] 변수 시트 + 괄호 파일명 소유자 판정", o26.some(p => p.sheet === "Sheet1" && p.book.includes("복사본 (2)")), o26);

// (7) 변수 재대입이 상이하면(모호) 해석 안 함 — 오탐은 미탐보다 나쁘다
const oAmb = owners(`def transform(ctx):
    book = ctx.book("A.xlsx")
    sheet = "첫째"
    book.read(sheet, "A1")
    sheet = "둘째"
    book.read(sheet, "A1")
`);
ck("(7) 모호 변수는 소유자 판정 제외", !oAmb.some(p => p.sheet === "첫째" || p.sheet === "둘째"), oAmb);

// (8) runnerPyBookVarMap 괄호 파일명 + 리터럴 소유자 비회귀
const pm = vm.runInContext(`Array.from(runnerPyBookVarMap(${JSON.stringify(STEP26)}).entries())`, sandbox);
ck("(8) 괄호 파일명 수신자 변수 해석", pm.some(e => e[0] === "book" && e[1].includes("복사본 (2)")), pm);
const oLit = owners(`ctx.book("월간.xlsx").delete_rows("데이터", "1:2")`);
ck("(9) delete_rows 리터럴 소유자 비회귀(동사 확장)", oLit.some(p => p.book === "월간.xlsx" && p.sheet === "데이터"), oLit);

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
