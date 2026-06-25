const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const start = src.indexOf("function exactSheetNamesFromMentions");
const end = src.indexOf("function shouldRouteSimpleStructureEditToPython");
if (start < 0 || end < 0 || end <= start) {
  throw new Error("failed to locate exact sheet reference functions in scripts/chat-ui.js");
}

let block = src.slice(start, end);
block += "\nglobalThis.G = { exactSheetNamesFromMentions, exactSheetNameReminder, vbaSheetReferenceLiterals, vbaExactSheetReferenceFailures };";
eval(block);

const G = globalThis.G;
let pass = 0;
let fail = 0;
const check = (name, condition, detail = "") => {
  if (condition) {
    pass += 1;
    console.log(" OK  " + name);
  } else {
    fail += 1;
    console.log("FAIL " + name + (detail ? " :: " + detail : ""));
  }
};

const source2026 = "선택 범위: @범위[v0510_today_full_smoke.xlsx/2026년!B337:D337] 월 정보를 +1 변경해줘, vba로";
const buggyWorkbookAndSheetNameCode = `
Sub B2BSkill()
    Dim wb As Workbook, ws As Worksheet
    Dim wbIter As Workbook
    For Each wbIter In Application.Workbooks
        If wbIter.Name = "v0510_today_full_smoke.xlsx" Then Set wb = wbIter: Exit For
    Next wbIter
    Dim sh As Worksheet
    For Each sh In wb.Worksheets
        If sh.Name = "2026 년" Then Set ws = sh: Exit For
    Next sh
End Sub`;

let literals = G.vbaSheetReferenceLiterals(buggyWorkbookAndSheetNameCode);
check("workbook .Name literal is not treated as sheet name", !literals.includes("v0510_today_full_smoke.xlsx"), literals.join(", "));
check("worksheet .Name literal is detected", literals.includes("2026 년"), literals.join(", "));

let failures = G.vbaExactSheetReferenceFailures(buggyWorkbookAndSheetNameCode, source2026);
check("wrong spaced VBA sheet name is blocked", failures.length === 1, failures.join(" | "));
check("failure message does not list workbook filename as detected sheet", !/v0510_today_full_smoke\.xlsx/.test(failures.join(" | ")), failures.join(" | "));

const reminder2026 = G.exactSheetNameReminder(source2026);
check("exact sheet reminder contains compact sheet name", /"2026년"/.test(reminder2026), reminder2026);
check("exact sheet reminder warns spaced year sheet is different", /"2026 년"/.test(reminder2026), reminder2026);

const sourceKorean = "선택 범위: @범위[v0510_today_full_smoke.xlsx/통합인터넷(국제)!I2:N8] 데이터를 지워줘, vba로";
const translatedSheetCode = `
Sub B2BSkill()
    Dim wb As Workbook, ws As Worksheet
    Set wb = Workbooks("v0510_today_full_smoke.xlsx")
    Set ws = wb.Worksheets("통합internet(국제)")
    ws.Range("I2:N8").ClearContents
End Sub`;
failures = G.vbaExactSheetReferenceFailures(translatedSheetCode, sourceKorean);
check("translated Korean sheet name is blocked", failures.length === 1, failures.join(" | "));

const variableSheetCode = `
Sub B2BSkill()
    Dim wb As Workbook, ws As Worksheet
    Dim sheetName As String
    sheetName = "통합인터넷(국제)"
    Set wb = Workbooks("v0510_today_full_smoke.xlsx")
    Set ws = wb.Worksheets(sheetName)
    ws.Range("I2:N8").ClearContents
End Sub`;
failures = G.vbaExactSheetReferenceFailures(variableSheetCode, sourceKorean);
check("exact sheet name via variable passed to Worksheets() is allowed", failures.length === 0, failures.join(" | "));

const workbookNameOnlyCode = `
Sub B2BSkill()
    Dim wb As Workbook, wbIter As Workbook
    For Each wbIter In Application.Workbooks
        If wbIter.Name = "통합인터넷(국제)" Then Set wb = wbIter
    Next wbIter
End Sub`;
literals = G.vbaSheetReferenceLiterals(workbookNameOnlyCode);
check("workbook .Name alone does not satisfy sheet exactness", !literals.includes("통합인터넷(국제)"), literals.join(", "));

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 2 : 0);
