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
 "runnerIsGeneratedSheet", "runnerSliceCallArgs", "runnerSplitTopLevelArgs", "runnerPyBookVarMap", "runnerExtractGeneratedSheetsFromCode"].forEach(f => vm.runInContext(extract(f), sb));
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

// ── [회귀] 수신자가 ctx.book(변수) 인 호출 — 한전 Step22 계열 ──────────────────────
// 예전엔 ctx.book( 뒤에 '따옴표 리터럴'만 허용해 정규식 자체가 매칭되지 않았다(전 헬퍼 미탐).
// 그러면 산출 시트가 '업로드 파일에 있어야 할 시트'로 요구되고, 단일시트(raw) 파일이면
// Sheet1 과 짝지어져 rename_sheet("Sheet1","Sheet1") 로 목적지 리터럴까지 치환 —
// 오류도 없이 이름이 안 바뀌고 매핑 패널은 정상처럼 보인다(SBAGENT-198 재발, 예외조차 없음).
const TF = `target_file = "03. 한전_무선인입망_202606.xlsx"\n`;
ck("(A1) ctx.book(변수).rename_sheet", isG(gen(TF + `ctx.book(target_file).rename_sheet("Sheet1", "무선인입망")`), "03. 한전_무선인입망_202606.xlsx", "무선인입망") === true);
ck("(A2) ctx.book(변수).add_sheet(리터럴)", isG(gen(TF + `ctx.book(target_file).add_sheet("검증")`), "03. 한전_무선인입망_202606.xlsx", "검증") === true);
ck("(A3) ctx.book(변수).filter_to_sheet", isG(gen(TF + `ctx.book(target_file).filter_to_sheet("원본", lambda r: r[0]=="x", "필터결과")`), "03. 한전_무선인입망_202606.xlsx", "필터결과") === true);
ck("(A4) ctx.book(변수).pivot 기본 산출", isG(gen(TF + `ctx.book(target_file).pivot("데이터", group_by="지점")`), "03. 한전_무선인입망_202606.xlsx", "피벗요약") === true);
ck("(A5) ctx.book(변수).rename_sheet(변수 목적지)", isG(gen(TF + `nm = "무선인입망"\nctx.book(target_file).rename_sheet("Sheet1", nm)`), "03. 한전_무선인입망_202606.xlsx", "무선인입망") === true);

// ── [회귀] filter_to_sheet 3번째 '위치' 인자가 변수 (구멍 B: kwarg 변수만 보던 문제) ──
ck("(B1) filter_to_sheet(위치 인자 변수)", isG(gen(`dest = "결과시트"\nctx.filter_to_sheet("원본", lambda r: r[0]=="x", dest)`), "", "결과시트") === true);
ck("(B2) 변수 수신자 + 위치 인자 변수", isG(gen(`b = ctx.book("A.xlsx")\ndest = "결과2"\nb.filter_to_sheet("원본", lambda r: r[0]=="x", dest)`), "A.xlsx", "결과2") === true);

// ── [회귀] 구멍 C: 수신자 변수의 출처가 ctx.book(변수) ────────────────────────────
ck("(C1) b = ctx.book(변수); b.add_sheet(리터럴)", isG(gen(TF + `b = ctx.book(target_file)\nb.add_sheet("검증")`), "03. 한전_무선인입망_202606.xlsx", "검증") === true);
ck("(C2) b = ctx.book(변수); b.rename_sheet", isG(gen(TF + `b = ctx.book(target_file)\nb.rename_sheet("Sheet1", "무선인입망")`), "03. 한전_무선인입망_202606.xlsx", "무선인입망") === true);

// ── [회귀] P2: 400자 고정창이 '인접 호출'의 dest_name 을 훔치지 않아야 한다 ─────────
{
  const two = `ctx.filter_to_sheet("원본", lambda r: r[0]=="x", "첫번째")\nctx.pivot("데이터", group_by="지점", dest_name="두번째")`;
  const g = gen(two);
  ck("(P2-a) 앞 호출은 자기 산출만", isG(g, "", "첫번째") === true);
  ck("(P2-b) 뒤 호출도 자기 산출만", isG(g, "", "두번째") === true);
  // 앞 filter 가 뒤 pivot 의 dest_name("두번째")을 훔쳐 '피벗요약'이 안 나오면 안 된다
  ck("(P2-c) 인접 인자 훔침 없음(피벗요약 오등록 금지)", isG(g, "", "피벗요약") === false);
}

// ── [회귀] VBA `&` 문자열 연결은 이름을 확정할 수 없다 → 등록 금지(오탐 방지) ──────────
// `wsNew.Name = base & "_" & idx` 에서 base 만 떼서 등록하면, 실제로 만들어지지도 않는 접두사가
// 생성시트가 돼 '진짜 필요한 시트 요구'를 지워버린다. 오탐은 미탐보다 나쁘다.
{
  const dyn = ['    base = "C_611"', '    wsNew.Name = base & "_" & idx'].join("\n");
  ck("(AMP) & 연결은 생성시트로 등록 안 함", isG(gen(dyn), "", "C_611") === false, gen(dyn));
  const plain = ['    base = "C_611"', "    wsNew.Name = base"].join("\n");
  ck("(AMP-대조) 순수 변수는 정상 등록", isG(gen(plain), "", "C_611") === true, gen(plain));
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
