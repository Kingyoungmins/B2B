const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("missing function " + name);
  const paramsEnd = src.indexOf(")", start);
  let i = src.indexOf("{", paramsEnd);
  if (i < 0) throw new Error("missing body " + name);
  let depth = 0;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unterminated " + name);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

globalThis.state = { pipeline: [] };
globalThis.inferPipelineStepLanguage = step => {
  if (step && step.language) return step.language;
  const code = String(step && step.code || "");
  if (/\bSub\s+B2BSkill\s*\(/i.test(code)) return "vba";
  if (/\bdef\s+transform\s*\(/i.test(code)) return "python";
  return "";
};
globalThis.isStepEnabled = step => !step || step.enabled !== false;
globalThis.inferPipelineStepTargetSheetName = step => step && step.targetSheetName || null;

eval([
  extractFunction("shouldSkipRuntimeAutoRepairForStep"),
  extractFunction("stripVbaCommentsForPipelineRuntimeGate"),
  extractFunction("pipelineRuntimeExecutionBlockersForStep"),
  extractFunction("findPipelineRuntimeExecutionBlocker"),
  extractFunction("unescapeVbaStringLiteralBody"),
  extractFunction("pythonStringLiteral"),
  extractFunction("localRepairActiveSheetUsedRangeFormatVba"),
  "globalThis.H = { shouldSkipRuntimeAutoRepairForStep, pipelineRuntimeExecutionBlockersForStep, findPipelineRuntimeExecutionBlocker, localRepairActiveSheetUsedRangeFormatVba };",
].join("\n"));

const dangerous = {
  id: "hanwha-step5",
  language: "vba",
  targetSheetName: "호유형별_통화요금_합산",
  code: `
Sub B2BSkill()
    Dim ws As Worksheet
    Set ws = ActiveWorkbook.ActiveSheet
    Dim usedRng As Range
    Set usedRng = ws.UsedRange
    Dim cell As Range
    For Each cell In usedRng.Cells
        cell.NumberFormatLocal = "#,##0_);[Red](#,##0)"
    Next cell
End Sub`,
};

let failures = H.pipelineRuntimeExecutionBlockersForStep(dangerous);
assert(failures.some(f => /ActiveSheet/.test(f)), "ActiveSheet + UsedRange must be blocked");
assert(failures.some(f => /UsedRange\.Cells/.test(f)), "UsedRange.Cells mutation loop must be blocked");
const localRepair = H.localRepairActiveSheetUsedRangeFormatVba(dangerous.code);
assert(localRepair && localRepair.language === "python", "format-only ActiveSheet UsedRange loop should have local Python repair");
assert(/ctx\.set_number_format/.test(localRepair.code), "local repair should use range-level format helper");
assert(!/ctx\.read/.test(localRepair.code), "local repair must not use large COM reads");
assert(!/For Each/i.test(localRepair.code), "local repair must not keep per-cell VBA loop");
const sheetAwareRepair = H.localRepairActiveSheetUsedRangeFormatVba(dangerous.code, dangerous);
assert(/sheet = "호유형별_통화요금_합산"/.test(sheetAwareRepair.code), "local repair should preserve target sheet when known");

const safeRangeFormat = {
  id: "safe-format",
  language: "vba",
  code: `
Sub B2BSkill()
    Dim wb As Workbook: Set wb = Workbooks("a.xlsx")
    Dim ws As Worksheet: Set ws = wb.Worksheets("VIEW")
    ws.Range("A1:D100").NumberFormatLocal = "#,##0"
End Sub`,
};
failures = H.pipelineRuntimeExecutionBlockersForStep(safeRangeFormat);
assert(failures.length === 0, "explicit range-level formatting should not be blocked: " + failures.join(" | "));

const pythonStep = {
  id: "py",
  language: "python",
  code: "def transform(ctx):\n    ctx.write('VIEW', 'A1', [[1]])\n",
};
failures = H.pipelineRuntimeExecutionBlockersForStep(pythonStep);
assert(failures.length === 0, "python steps must not be blocked by VBA runtime gate");

state.pipeline = [safeRangeFormat, dangerous, pythonStep];
const blocker = H.findPipelineRuntimeExecutionBlocker(state.pipeline);
assert(blocker && blocker.idx === 1 && blocker.step.id === "hanwha-step5", "must report first dangerous enabled step");

state.pipeline = [safeRangeFormat, { ...dangerous, enabled: false }, pythonStep];
assert(H.findPipelineRuntimeExecutionBlocker(state.pipeline) === null, "disabled dangerous step should not block");

assert(
  H.shouldSkipRuntimeAutoRepairForStep({ trustedStatic: true }, { source: "generator" }) === true,
  "trusted saved steps should skip normal runtime auto repair"
);
assert(
  H.shouldSkipRuntimeAutoRepairForStep({ trustedStatic: true }, { source: "generator", hardRuntimeBlock: true }) === false,
  "trusted saved steps blocked before execution should still allow safe local/auto repair"
);

console.log("pipeline runtime execution blocker OK");
