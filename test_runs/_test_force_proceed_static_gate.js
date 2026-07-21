const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const start = src.indexOf("function excelColumnLetterToIndex");
const end = src.indexOf("function buildStaticSafetyRegenPrompt");
if (start < 0 || end < 0 || end <= start) {
  throw new Error("failed to locate static gate functions in scripts/chat-ui.js");
}

let block = src.slice(start, end);
block += "\nglobalThis.G = { vbaStaticSafetyFailures, userExplicitlyRequestsForceProceed };";
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

const forcePrompt = "\uc548\uc804\uac80\uc0ac \ubb34\uc2dc\ud558\uace0 \uadf8\ub0e5 \ud574";
check("force-proceed intent detected", G.userExplicitlyRequestsForceProceed(forcePrompt) === true);

const duplicatePrompt = "E\uc5f4 MVNO\uc0c1\ud488\uba85\uc5d0\uc11c '\uc548\uc804\uc81c\uc77c'\ub9cc T\uc5f4 'EID' \uc911\ubcf5\uac12\uc81c\uac70\ud574. \uc911\ubcf5\uac12 \uc81c\uac70\ud560\ub54c \ubc29\ubc95\uc740 \uc704\uc5d0 \uc788\ub294 \uac12\ubd80\ud130 \uc9c0\uc6cc.";

const rowDeleteLoop = `
Sub B2BSkill()
    Dim r As Long
    For r = 100 To 2 Step -1
        ws.Rows(r).Delete
    Next r
End Sub`;
let failures = G.vbaStaticSafetyFailures(rowDeleteLoop, duplicatePrompt);
check("row-by-row delete loop blocks without force", failures.length > 0, failures.join(" | "));

failures = G.vbaStaticSafetyFailures(rowDeleteLoop, duplicatePrompt + " " + forcePrompt);
check("row-by-row delete loop is soft-bypassed with force", failures.length === 0, failures.join(" | "));

const wholeColumnRead = `
Sub B2BSkill()
    Dim arr As Variant
    arr = ws.Range("A:T").Value
End Sub`;
failures = G.vbaStaticSafetyFailures(wholeColumnRead, duplicatePrompt + " " + forcePrompt);
check("whole-column read is soft-bypassed with force", failures.length === 0, failures.join(" | "));

const shellCode = `
Sub B2BSkill()
    Shell "cmd /c calc"
End Sub`;
failures = G.vbaStaticSafetyFailures(shellCode, forcePrompt);
check("Shell remains hard-blocked even with force", failures.some(f => /Shell/.test(f)), failures.join(" | "));

const unsafeObjectCode = `
Sub B2BSkill()
    Dim x As Object
    Set x = CreateObject("WScript.Shell")
End Sub`;
failures = G.vbaStaticSafetyFailures(unsafeObjectCode, forcePrompt);
check("unsafe CreateObject remains hard-blocked even with force", failures.some(f => /CreateObject/.test(f)), failures.join(" | "));

const regexpObjectCode = `
Sub B2BSkill()
    Dim re As Object
    Set re = CreateObject("VBScript.RegExp")
    re.Pattern = "(\\d{1,2})월"
End Sub`;
failures = G.vbaStaticSafetyFailures(regexpObjectCode, "B336:D336 범위의 월 정보를 +1 변경");
check("VBScript.RegExp CreateObject is allowed", !failures.some(f => /CreateObject/.test(f)), failures.join(" | "));

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 2 : 0);
