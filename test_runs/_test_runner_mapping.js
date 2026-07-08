// [코덱스 검증] 실행기 파일/시트 매핑: (1) 저장 스킬 코드의 옛 파일/시트명이 매핑값으로 치환되는가,
// (2) 스킬이 생성하는 시트(add_sheet "Validation_Result")가 '필수 업로드 시트'로 오인 안 되는가.
// drop-handling.js 의 '실제 함수'를 슬라이스해서 zip 안 실제 스킬 코드로 검증(추측금지).
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "drop-handling.js"), "utf8");
function slice(a, b) { const i = src.indexOf(a); const j = src.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error("slice fail: " + a); return src.slice(i, j); }

const G = globalThis;
G.window = G;
// 실제 함수 블록 3개를 그대로 평가(슬라이스)
eval(slice("function runnerMappingNorm", "function runnerAddPairedCodeRequirements"));  // norm/stem/key/A1/addGenerated/isGenerated/extractGenerated
eval(slice("function runnerReplaceLiteral", "\nwindow.buildRunnerMappedPipeline"));
G.state = { runnerMappingChecked: true, pipeline: [] };
eval(slice("window.buildRunnerMappedPipeline = function", "\nfunction renderRunnerWorkflow"));

// zip 안 실제 스킬 코드(step1: 옛 파일/시트 참조, step4: add_sheet 로 시트 생성)
const STEP1 = `# mapping_test_saved_skill step 1
def transform(ctx):
    sales = ctx.book("expected_sales.xlsx")
    out = ctx.book("expected_output.xlsx")
    rows = sales.read("SalesData", "A2:D5")
    result = []
    out.write("ResultSheet", "A2", result)`;
const STEP4 = `# mapping_test_saved_skill step 4
def transform(ctx):
    out = ctx.book("expected_output.xlsx")
    rows = out.read("ResultSheet", "A2:H5")
    try:
        out.add_sheet("Validation_Result")
    except Exception:
        pass
    out.write("Validation_Result", "A1", [["Check", "Value"]])`;

let pass = 0, fail = 0;
function ck(name, cond, got) { if (cond) { pass++; console.log(" OK  " + name); } else { fail++; console.log("FAIL " + name + (got !== undefined ? "  got=" + JSON.stringify(got).slice(0,160) : "")); } }

// ── (A) 생성 시트 감지 & 제외 ──
const gen4 = runnerExtractGeneratedSheetsFromCode(STEP4);
ck("(A1) step4 add_sheet 'Validation_Result' 를 생성시트로 감지",
   gen4.some(g => g.sheet === "Validation_Result" && runnerMappingNorm(g.book) === runnerMappingNorm("expected_output.xlsx")), gen4);
ck("(A2) Validation_Result 는 '필수 시트' 제외 대상", runnerIsGeneratedSheet(gen4, "", "Validation_Result") === true);
ck("(A3) ResultSheet 는 생성시트 아님(실제 필수)", runnerIsGeneratedSheet(gen4, "", "ResultSheet") === false);
ck("(A4) A1 주소는 시트로 오인 안 함", runnerExtractGeneratedSheetsFromCode('ctx.add_sheet("A2:H5")').length === 0);

// ── (B) runnerReplaceLiteral: 따옴표 리터럴만 안전 치환 ──
ck("(B1) 따옴표 파일명 치환", runnerReplaceLiteral(STEP1, "expected_sales.xlsx", "actual_sales_2026_06.xlsx").includes('"actual_sales_2026_06.xlsx"'));
ck("(B2) 옛 파일명 흔적 제거", !runnerReplaceLiteral(STEP1, "expected_sales.xlsx", "actual_sales_2026_06.xlsx").includes('"expected_sales.xlsx"'));
ck("(B3) 시트명 치환(ResultSheet 는 안 건드림)", (function(){ const r = runnerReplaceLiteral(STEP1, "SalesData", "ActualSales"); return r.includes('"ActualSales"') && r.includes('"ResultSheet"'); })());
ck("(B4) 비따옴표(변수 sales)는 치환 안 함(오탐 방지)", runnerReplaceLiteral(STEP1, "sales", "XX") === STEP1);

// ── (C) buildRunnerMappedPipeline: 실제 스킬 코드 전체 치환(end-to-end) ──
G.runnerBuildMappingRows = () => ([
  { req: { book: "expected_sales.xlsx", sheet: "SalesData", key: "k1" }, fileItem: { id: "input:actual_sales_2026_06.xlsx", name: "actual_sales_2026_06.xlsx" }, sheet: "ActualSales" },
  { req: { book: "expected_output.xlsx", sheet: "ResultSheet", key: "k2" }, fileItem: { id: "output:0", name: "actual_output_template_2026_06.xlsx" }, sheet: "ActualResult" },
]);
const step1 = { id: "s1", code: STEP1, targetFileId: "input:expected_sales.xlsx", targetSheetName: "SalesData" };
const step4 = { id: "s4", code: STEP4, targetFileId: "input:expected_output.xlsx", targetSheetName: "ResultSheet" };
G.state.pipeline = [step1, step4];
const mapped = window.buildRunnerMappedPipeline([step1, step4]);

const m1 = mapped[0].code, m4 = mapped[1].code;
ck("(C1) step1: 파일/시트 전부 실제값으로 치환",
   m1.includes('"actual_sales_2026_06.xlsx"') && m1.includes('"ActualSales"') && m1.includes('"actual_output_template_2026_06.xlsx"') && m1.includes('"ActualResult"'), m1);
ck("(C2) step1: 옛 이름 잔존 없음",
   !m1.includes("expected_sales.xlsx") && !m1.includes("SalesData") && !m1.includes("expected_output.xlsx") && !m1.includes('"ResultSheet"'), m1);
// step1 은 두 파일(sales 읽기 + output 쓰기)을 참조 → targetFileId 는 마지막 참조(=쓰기대상 output)로 갱신됨.
// 핵심 검증: 옛 이름이 아니라 '매핑된 실제 파일 id + 실제 시트'로 바뀌었는가(라우팅이 옛 파일 가리키지 않음).
ck("(C3) step1: targetFileId/Sheet 가 옛 이름 아닌 매핑된 실제값으로 갱신",
   mapped[0].targetFileId !== "input:expected_sales.xlsx"
   && (mapped[0].targetFileId === "output:0" || mapped[0].targetFileId === "input:actual_sales_2026_06.xlsx")
   && (mapped[0].targetSheetName === "ActualResult" || mapped[0].targetSheetName === "ActualSales"),
   { f: mapped[0].targetFileId, s: mapped[0].targetSheetName });
ck("(C4) step4: 생성시트 'Validation_Result' 는 그대로 유지(매핑 안 됨)", m4.includes('"Validation_Result"'));
ck("(C5) step4: 출력 파일/ResultSheet 는 실제값으로 치환",
   m4.includes('"actual_output_template_2026_06.xlsx"') && m4.includes('"ActualResult"') && !m4.includes('"ResultSheet"'), m4);
ck("(C6) 원본 step 객체는 불변(치환은 사본에)", step1.code === STEP1);

console.log(`\n=== RESULT: ${fail ? fail + " FAIL" : "ALL PASS"} (${pass}/${pass + fail}) ===`);
process.exit(fail ? 1 : 0);
