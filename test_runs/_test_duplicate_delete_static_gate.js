const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const start = src.indexOf("function excelColumnLetterToIndex");
const end = src.indexOf("function buildStaticSafetyRegenPrompt");
if (start < 0 || end < 0 || end <= start) {
  throw new Error("failed to locate static gate functions in scripts/chat-ui.js");
}

let block = src.slice(start, end);
block += "\nglobalThis.G = { vbaStaticSafetyFailures, duplicateRowDeleteIntent, conditionalRowDeleteIntent };";
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

const conditionalPrompt = "\uc120\ud0dd\ud55c \uc5f4\uc5d0\uc11c 20260403 \uc774\uc804\uc774\uba74 \ud574\ub2f9 \ud589 \uc0ad\uc81c\ud574\uc918";
check("conditional row delete intent detected", G.conditionalRowDeleteIntent(conditionalPrompt) === true);

failures = G.vbaStaticSafetyFailures(rowDeleteLoop, conditionalPrompt);
check("conditional row delete loop is blocked", failures.some(f => /조건부 행 삭제|AutoFilter/.test(f)), failures.join(" | "));

const boundedConditionalRead = `
Sub B2BSkill()
    Dim arr As Variant, lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "F").End(xlUp).Row
    arr = ws.Range(ws.Cells(2, "F"), ws.Cells(lastRow, "F")).Value
End Sub`;
failures = G.vbaStaticSafetyFailures(boundedConditionalRead, conditionalPrompt);
check("conditional row delete bounded selected-column read is allowed", failures.length === 0, failures.join(" | "));

const badVisibleOffsetDelete = `
Sub B2BSkill()
    Dim usedRng As Range, visibleRng As Range, dataRng As Range
    Set usedRng = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, auxCol))
    usedRng.AutoFilter Field:=auxCol, Criteria1:="B2B_DELETE"
    Set visibleRng = usedRng.SpecialCells(xlCellTypeVisible)
    Set dataRng = visibleRng.Offset(1, 0).Resize(visibleRng.Rows.Count - 1, visibleRng.Columns.Count)
    If dataRng.Rows.Count > 0 Then dataRng.EntireRow.Delete
End Sub
Function NormalizeDate(ByVal v As Variant) As Long
    If IsNumeric(v) Then
        If v > 0 And v < 1 Then NormalizeDate = CLng(v * 86400): Exit Function
        If Len(CStr(v)) = 8 Then NormalizeDate = CLng(CStr(v)): Exit Function
    End If
End Function`;
failures = G.vbaStaticSafetyFailures(badVisibleOffsetDelete, conditionalPrompt);
check("conditional row delete bad SpecialCells Offset/Resize delete is blocked",
  failures.some(f => /Offset|Resize|SpecialCells/i.test(f)),
  failures.join(" | "));
check("conditional row delete bad date serial normalization is blocked",
  failures.some(f => /DateSerial|yyyymmdd|날짜|serial/i.test(f)),
  failures.join(" | "));

const goodVisibleDataBodyDelete = `
Sub B2BSkill()
    Dim hdrRow As Long, lastRow As Long, auxCol As Long, dataBody As Range, delRng As Range
    hdrRow = 1: lastRow = ws.Cells(ws.Rows.Count, "F").End(xlUp).Row: auxCol = 7
    ws.Range(ws.Cells(hdrRow, 1), ws.Cells(lastRow, auxCol)).AutoFilter Field:=auxCol, Criteria1:="B2B_DELETE"
    Set dataBody = ws.Range(ws.Cells(hdrRow + 1, 1), ws.Cells(lastRow, auxCol))
    Set delRng = dataBody.SpecialCells(xlCellTypeVisible)
    If Not delRng Is Nothing Then delRng.EntireRow.Delete
End Sub
Function B2BDateYmd(ByVal cell As Range) As Long
    Dim txt As String, raw As Variant
    txt = Replace(Replace(Replace(Trim(CStr(cell.Text)), "-", ""), "/", ""), ".", "")
    If Len(txt) >= 8 And IsNumeric(Left(txt, 8)) Then B2BDateYmd = CLng(Left(txt, 8)): Exit Function
    raw = cell.Value
    If IsDate(raw) Then B2BDateYmd = CLng(Format(CDate(raw), "yyyymmdd")): Exit Function
    If IsNumeric(raw) And CLng(raw) >= 20000 And CLng(raw) <= 60000 Then
        B2BDateYmd = CLng(Format(DateSerial(1899, 12, 30) + CLng(raw), "yyyymmdd"))
    End If
End Function`;
failures = G.vbaStaticSafetyFailures(goodVisibleDataBodyDelete, conditionalPrompt);
check("conditional row delete explicit data-body SpecialCells delete is allowed", failures.length === 0, failures.join(" | "));

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 2 : 0);
