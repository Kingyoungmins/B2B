const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const start = src.indexOf("function excelColumnLetterToIndex");
const end = src.indexOf("function buildStaticSafetyRegenPrompt");
if (start < 0 || end < 0 || end <= start) {
  throw new Error("failed to locate static gate functions in scripts/chat-ui.js");
}

let block = src.slice(start, end);
block += "\nglobalThis.G = { vbaStaticSafetyFailures, duplicateRowDeleteIntent };";
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

const prompt = "E\uc5f4 MVNO\uc0c1\ud488\uba85\uc5d0\uc11c '\uc548\uc804\uc81c\uc77c'\ub9cc T\uc5f4 'EID' \uc911\ubcf5\uac12\uc81c\uac70\ud574. \uc911\ubcf5\uac12 \uc81c\uac70\ud560\ub54c \ubc29\ubc95\uc740 \uc704\uc5d0 \uc788\ub294 \uac12\ubd80\ud130 \uc9c0\uc6cc. \ub300\uc2e0 \uc218\ub0a9\uae08\uc561\uc774 1 \uc774\uc0c1\uc778\uac70\ub294 \uc9c0\uc6b0\uba74 \uc548\ub3fc";
check("duplicate row delete intent detected", G.duplicateRowDeleteIntent(prompt) === true);

const dataBoundCellsRange = `
Sub B2BSkill()
    Dim arr As Variant, lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 20).End(xlUp).Row
    arr = ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, 20)).Value
End Sub`;
let failures = G.vbaStaticSafetyFailures(dataBoundCellsRange, prompt);
check("data-bound ws.Cells(2,1):ws.Cells(lastRow,20) read is allowed", failures.length === 0, failures.join(" | "));

const dataBoundA1Range = `
Sub B2BSkill()
    Dim arr As Variant, lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "T").End(xlUp).Row
    arr = ws.Range("A2:T" & lastRow).Value
End Sub`;
failures = G.vbaStaticSafetyFailures(dataBoundA1Range, prompt);
check("data-bound A2:T & lastRow read is allowed", failures.length === 0, failures.join(" | "));

const wholeColumnRead = `
Sub B2BSkill()
    Dim arr As Variant
    arr = ws.Range("A:T").Value
End Sub`;
failures = G.vbaStaticSafetyFailures(wholeColumnRead, prompt);
check("whole-column A:T read is blocked", failures.some(f => /전체 열|전체 시트/.test(f)), failures.join(" | "));

const rowDeleteLoop = `
Sub B2BSkill()
    Dim r As Long
    For r = 100 To 2 Step -1
        ws.Rows(r).Delete
    Next r
End Sub`;
failures = G.vbaStaticSafetyFailures(rowDeleteLoop, prompt);
check("row-by-row delete loop is blocked", failures.some(f => /Rows\(\.\.\.\)\.Delete|루프 안에서 반복/.test(f)), failures.join(" | "));

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 2 : 0);
