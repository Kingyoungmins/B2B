// [코덱스 검증] 실행기 매핑 요구목록: 스킬이 중간에 만드는 시트(Validation_Result)나 자연어 프롬프트에
// 섞인 파일명("Create Validation_Result sheet from expected_output.xlsx")이 '필수 업로드' 행으로 새지 않는가.
// 실제 zip 스킬(mapping_test_saved_skill.logic.json)의 4개 스텝 + pipeline.js/drop-handling.js '실제 함수'로 검증(추측금지).
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const pj = fs.readFileSync(path.join(root, "scripts", "pipeline.js"), "utf8");
const dj = fs.readFileSync(path.join(root, "scripts", "drop-handling.js"), "utf8");
function slice(src, a, b) {
  const i = src.indexOf(a); const j = src.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error("slice fail: " + a + " .. " + b);
  return src.slice(i, j);
}

const G = globalThis;
G.window = G;
// ── 실제 함수 로드 (연속 블록 슬라이스, 추측 없이 소스 그대로 eval) ──
eval(slice(pj, "function inferPipelineStepLanguage", "function normalizeStep"));            // 언어추론
eval(slice(pj, "function pipelineDecodeWorkbookName", "function inferPipelineStepTargetSheetName")); // decode/key/knownFiles/collect/source/target/constVars/resolve/targetSheets
eval(slice(pj, "function pipelineSheetLiteralsFromCode", "function pipelineCodeCreatesSheetNamed"));
eval(slice(dj, "function runnerMappingSheetNames", "function runnerMappingScoreFile"));     // norm/clean/add/generated/paired/extractRequirements

// ── 실제 저장 스킬(zip) 파이프라인 ──
const logic = JSON.parse(fs.readFileSync(path.join(root, "test_mapping", "mapping_test_saved_skill.logic.json"), "utf8"));
G.state = { pipeline: logic.pipeline };

let pass = 0, fail = 0;
function ck(name, cond, got) { if (cond) { pass++; console.log(" OK  " + name); } else { fail++; console.log("FAIL " + name + (got !== undefined ? "  got=" + JSON.stringify(got) : "")); } }

// ── (0) 과포집 재현 확인: collect 가 프롬프트 프로즈를 파일명으로 잡는가(수정 전 버그의 근원) ──
const step4 = logic.pipeline[3];
const collected = pipelineCollectWorkbookNames([step4.prompt, step4.description, step4.code].filter(Boolean).join("\n"));
ck("(0) collect 는 프롬프트 프로즈까지 파일명으로 과포집(버그 근원 재현)",
   collected.some(n => /^create /i.test(n)), collected);

// ── (1) 실제 요구목록 추출 ──
const reqs = runnerExtractMappingRequirements();
const asStr = reqs.map(r => `${r.book}/${r.sheet}`);
console.log("\n요구목록:", JSON.stringify(asStr, null, 0), "\n");

const want = [
  { book: "expected_sales.xlsx", sheet: "SalesData" },
  { book: "expected_adjustments.xlsx", sheet: "AdjustData" },
  { book: "expected_codes.xlsx", sheet: "CodeMap" },
  { book: "expected_output.xlsx", sheet: "ResultSheet" },
];
const norm = s => String(s || "").trim().toLowerCase();
const has = (b, s) => reqs.some(r => norm(r.book) === norm(b) && norm(r.sheet) === norm(s));

ck("(1) 정확히 4개 요구", reqs.length === 4, asStr);
want.forEach(w => ck(`(1) 포함: ${w.book} / ${w.sheet}`, has(w.book, w.sheet)));

// ── (2) 새면 안 되는 오탐 행들 ──
ck("(2a) 프로즈('Create ...') 파일명 행 없음", !reqs.some(r => /create /i.test(r.book)), asStr);
ck("(2b) expected_output.xlsx 의 '시트 자동'(빈 시트) 중복행 없음",
   !reqs.some(r => norm(r.book) === "expected_output.xlsx" && !String(r.sheet).trim()), asStr);
ck("(2c) 생성시트 'Validation_Result' 는 요구 아님",
   !reqs.some(r => norm(r.sheet) === "validation_result"), asStr);
ck("(2d) 빈 시트(시트 자동) 행이 아예 없음(모든 요구가 시트 지정됨)",
   reqs.every(r => String(r.sheet).trim().length > 0), asStr);

// ── (D) VBA `If sh.Name = "X" Then`(기존 시트 찾기 비교문)이 생성시트로 오탐되면
//        그 시트가 요구에서 빠져 UI 에 '시트 자동'(빈 시트)으로 뜬다. 실제 사용자 스킬 재현. ──
const VBA_FIND = `Sub B2BSkill()
    Dim wb As Workbook, sh As Worksheet, ws As Worksheet
    For Each wb In Application.Workbooks
        If wb.Name = "input_v056_청구내역.xlsx" Then Exit For
    Next wb
    For Each sh In wb.Worksheets
        If sh.Name = "청구내역" Then Set ws = sh: Exit For
    Next sh
    ws.Range("G14").Value = 100
End Sub`;
const PY_CELL = `def transform(ctx):\n    ctx.write_cell("청구내역", "I17", 200)`;
// (D1) 비교문 .Name= 은 생성으로 보지 않음
const genFind = runnerExtractGeneratedSheetsFromCode(VBA_FIND);
ck("(D1) VBA 'If sh.Name=\"청구내역\" Then' 는 생성시트 아님", genFind.length === 0, genFind);
// (D2) 단독 대입(Add 후 이름지정)은 여전히 생성으로 감지
const VBA_ADD = `Sub B2BSkill()\n    Dim ws As Worksheet\n    Set ws = Worksheets.Add\n    ws.Name = "요약결과"\nEnd Sub`;
ck("(D2) VBA 'ws.Name=\"요약결과\"'(단독 대입) 는 생성시트로 감지",
   runnerExtractGeneratedSheetsFromCode(VBA_ADD).some(g => g.sheet === "요약결과"),
   runnerExtractGeneratedSheetsFromCode(VBA_ADD));
// (D3) 사용자 스킬 구조로 추출 → 요구 1개, 시트='청구내역'(빈 시트 아님)
G.state = { pipeline: [
  { id: "s1", language: "vba", code: VBA_FIND, targetFileId: "input:input_v056_청구내역.xlsx", targetSheetName: "청구내역" },
  { id: "s5", language: "python", code: PY_CELL, targetFileId: "input:input_v056_청구내역.xlsx", targetSheetName: "청구내역" },
]};
const reqs2 = runnerExtractMappingRequirements();
const s2 = reqs2.map(r => `${r.book}/${r.sheet}`);
ck("(D3) 요구 정확히 1개", reqs2.length === 1, s2);
ck("(D4) 시트가 '청구내역'으로 잡힘(‘시트 자동’ 아님)",
   reqs2.some(r => norm(r.book) === "input_v056_청구내역.xlsx" && norm(r.sheet) === "청구내역"), s2);
ck("(D5) 파일 없는 '시트만' 중복행 없음", !reqs2.some(r => !String(r.book).trim()), s2);

// ── (E) VBA `.Name="시트"` 비교/이름지정에서 시트명이 '워크북명'으로 새어 파일 요구로 잡히던 오탐 ──
//        (실제 KGM 33단계 스킬: 올인원중복제거값/세부내역/피벗_결과 시트가 '올려야 할 파일'로 뜸)
const VBA_SHEETLEAK = `Sub B2BSkill()
    Dim wb As Workbook, sh As Worksheet, wbOut As Workbook
    For Each sh In ActiveWorkbook.Worksheets
        If sh.Name = "올인원중복제거값" Then
            Set wbOut = wb
            Exit For
        End If
    Next sh
    wb.Worksheets(1).Name = "세부내역"
    ActiveWorkbook.Range("A1").Value = 1
End Sub`;
G.state = { pipeline: [
  { id: "e1", language: "vba", code: VBA_SHEETLEAK, targetFileId: "input:원본_DSMC.xlsx", targetSheetName: "202605_SS001643" },
]};
const reqs3 = runnerExtractMappingRequirements();
const s3 = reqs3.map(r => `${r.book}/${r.sheet}`);
const hasExt = n => /\.(?:xls[xmb]?|csv|tsv)$/i.test(String(n || ""));
ck("(E1) 시트명(올인원중복제거값)이 파일 요구로 안 뜸", !reqs3.some(r => norm(r.book) === "올인원중복제거값"), s3);
ck("(E2) 시트명(세부내역)이 파일 요구로 안 뜸", !reqs3.some(r => norm(r.book) === "세부내역"), s3);
ck("(E3) 확장자 없는 book-only 요구가 아예 없음", !reqs3.some(r => r.book && !String(r.sheet).trim() && !hasExt(r.book)), s3);
ck("(E4) 실제 파일 요구(원본_DSMC.xlsx/202605_SS001643)는 유지", reqs3.some(r => hasExt(r.book) && norm(r.book) === "원본_dsmc.xlsx"), s3);

// ── (F) 교차파일 오귀속: 소스 시트가 대상 파일에 '복사 생성'되거나(copy_sheet dst_book), 다른 파일 소유
//        시트가 targetSheet 로 저장된 경우, 그 파일의 '필수 시트'로 잡히면 안 된다(실제 KGM 33단계 패턴). ──
const PY_COPYSHEET = `def transform(ctx):\n    ctx.copy_sheet("202605_SS001643", dst_book="KG모빌리티.xlsx")`;
const VBA_RENAME_COPIED = `Sub B2BSkill()
    Dim wb As Workbook, i As Long
    Set wb = Application.Workbooks("KG모빌리티.xlsx")
    For i = 1 To wb.Worksheets.Count
        If Left(wb.Worksheets(i).Name, 6) = "202605" Then
            wb.Worksheets(i).Name = "세부내역"
        End If
    Next i
End Sub`;
const VBA_CROSSFILE = `Sub B2BSkill()
    Dim wbDst As Workbook, wsDst As Worksheet, wbSrc As Workbook, wsSrc As Worksheet
    Set wbDst = Workbooks("원본_DSMC.xlsx")
    Set wsDst = wbDst.Worksheets("202605_SS001643")
    Set wbSrc = Workbooks("교체된 CCU 목록.xlsx")
    Set wsSrc = wbSrc.Worksheets("교체된 CCU 목록")
    wsSrc.Range("A1:C10").Copy wsDst.Range("A1")
End Sub`;
G.state = { pipeline: [
  { id: "f0", language: "python", code: `def transform(ctx):\n    ctx.write_cell("202605_SS001643", "A1", 1)`, targetFileId: "input:원본_DSMC.xlsx", targetSheetName: "202605_SS001643" },
  { id: "f1", language: "python", code: PY_COPYSHEET, targetFileId: "input:원본_DSMC.xlsx", targetSheetName: null },
  { id: "f2", language: "vba", code: VBA_RENAME_COPIED, targetFileId: "input:KG모빌리티.xlsx", targetSheetName: "202605_SS001643" },
  { id: "f3", language: "vba", code: VBA_CROSSFILE, targetFileId: "input:교체된 CCU 목록.xlsx", targetSheetName: "202605_SS001643" },
]};
const reqs4 = runnerExtractMappingRequirements();
const s4 = reqs4.map(r => `${r.book}/${r.sheet}`);
ck("(F1) copy_sheet 대상(KG모빌리티)+202605 는 요구 아님(복사 생성)",
   !reqs4.some(r => norm(r.book) === "kg모빌리티.xlsx" && norm(r.sheet) === "202605_ss001643"), s4);
ck("(F2) 교차파일: CCU 는 202605(원본_DSMC 소유)로 요구되지 않음",
   !reqs4.some(r => /ccu|목록/i.test(r.book) && norm(r.sheet) === "202605_ss001643"), s4);
ck("(F3) 202605 는 원본_DSMC 요구로 유지",
   reqs4.some(r => norm(r.book) === "원본_dsmc.xlsx" && norm(r.sheet) === "202605_ss001643"), s4);

console.log(`\n=== RESULT: ${fail ? fail + " FAIL" : "ALL PASS"} (${pass}/${pass + fail}) ===`);
process.exit(fail ? 1 : 0);
