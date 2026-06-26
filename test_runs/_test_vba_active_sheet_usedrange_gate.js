const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const start = src.indexOf("function excelColumnLetterToIndex");
const end = src.indexOf("function buildStaticSafetyRegenPrompt");
if (start < 0 || end < 0 || end <= start) {
  throw new Error("failed to locate static gate functions in scripts/chat-ui.js");
}

let block = src.slice(start, end);
block += "\nglobalThis.G = { vbaStaticSafetyFailures };";
eval(block);

const G = globalThis.G;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const exactPrompt = [
  "선택 범위: @범위[input.xlsx/매출!A1:B10] 데이터를 지워줘",
  "[정확 참조]",
  "- 정확 파일명: \"input.xlsx\"",
  "- 정확 시트명: \"매출\"",
  "- 정확 주소: \"A1:B10\"",
].join("\n");

let failures = G.vbaStaticSafetyFailures(`
Sub B2BSkill()
    Dim ws As Worksheet
    Set ws = ActiveWorkbook.ActiveSheet
    ws.Range("A1:B10").ClearContents
End Sub`, exactPrompt);
assert(failures.some(f => /ActiveSheet/.test(f)), "exact references must block ActiveSheet-dependent VBA: " + failures.join(" | "));

failures = G.vbaStaticSafetyFailures(`
Sub B2BSkill()
    Dim ws As Worksheet
    Set ws = Workbooks("input.xlsx").Worksheets("매출")
    ws.Range("A1:B10").ClearContents
End Sub`, exactPrompt);
assert(!failures.some(f => /ActiveSheet/.test(f)), "exact worksheet reference should not trigger ActiveSheet gate: " + failures.join(" | "));

failures = G.vbaStaticSafetyFailures(`
Sub B2BSkill()
    Dim usedRng As Range, cell As Range
    Set usedRng = ws.UsedRange
    For Each cell In usedRng.Cells
        If IsNumeric(cell.Value) Then cell.NumberFormat = "#,##0"
    Next cell
End Sub`, "사용된 범위 숫자 서식을 바꿔줘");
assert(failures.some(f => /UsedRange\.Cells/.test(f)), "UsedRange.Cells loop must be blocked: " + failures.join(" | "));

console.log("vba ActiveSheet/UsedRange static gate OK");
