const fs = require("fs");
const path = require("path");

function loadChatRouting() {
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
  const start = src.indexOf("function userExplicitlyRequestsVba");
  const end = src.indexOf("function buildPythonStaticSafetyRegenPrompt", start);
  let block = src.slice(start, end);
  block += `
ctxHelperPreferredIntent = function(){ return false; };
shouldRouteSimpleStructureEditToPython = function(){ return false; };
globalThis.__largeFilterRouting = {
  filter: filterToNewSheetIntent,
  vba: shouldRouteRequestToVba,
  py: shouldRouteRequestToPython,
  must: pythonComMustUseVbaReason,
  hard: isHardPythonComVbaReason,
  explicitPy: userExplicitlyRequestsPython,
};`;
  eval(block);
  return globalThis.__largeFilterRouting;
}

function loadPipelineChooser() {
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
  const start = src.indexOf("function choosePipelineRepairLanguage");
  const end = src.indexOf("function pipelineRepairSystemPrompt", start);
  let block = src.slice(start, end);
  block = `
globalThis.inferPipelineStepLanguage = (step) => step.language || "vba";
globalThis.pipelineStepRepairSourceMessage = (step) => step.prompt || "";
globalThis.userExplicitlyRequestsVba = (text) => /vba/i.test(String(text || ""));
globalThis.userExplicitlyRequestsPython = (text) => /python|\\ud30c\\uc774\\uc36c/i.test(String(text || ""));
globalThis.filterToNewSheetIntent = (text) => /\\ucc3e\\uc544|\\uc911|\\ud544\\ud130|\\ucd94\\ucd9c/.test(String(text || "")) && /\\uc0c8\\s*\\uc2dc\\ud2b8|\\uc0c8\\s*\\ud0ed|\\ub9cc\\ub4e4|\\ub123\\uc5b4|\\ubcf5\\uc0ac/.test(String(text || ""));
globalThis.shouldRouteRequestToVba = (text) => filterToNewSheetIntent(text);
` + block + `
globalThis.__largeFilterChooser = choosePipelineRepairLanguage;`;
  eval(block);
  return globalThis.__largeFilterChooser;
}

const prompt = "c\uc5f4 \uac12\ub4e4 \uc911 '611769344898'\uc774 \uac12\ub4e4\uc744 \ucc3e\uc544\uc11c \uc0c8 \uc2dc\ud2b8\uc5d0 \ub9cc\ub4e4\uc5b4\uc918";
const recoveryPrompt = prompt + "\n\uc5d0\ub7ec\ubcf5\uad6c \ucd94\uac00 \uc124\uba85: \ub9c8\uc9c0\ub9c9\ud589\uc740 270761 \uc774\uc57c";
const pyCode = `def transform(ctx):
    rows = ctx.read("Sheet1", "A1:C270761")
    out = [r for r in rows if str(r[2]) == "611769344898"]
    ctx.write("결과", "A1", out)`;

const R = loadChatRouting();
const reason = R.must(pyCode, recoveryPrompt);
const chatCases = [
  ["large filter intent detected", R.filter(recoveryPrompt) === true],
  ["large filter routes to VBA", R.vba(prompt) === true],
  ["large filter does not route to Python", R.py(prompt) === false],
  ["plain recovery note is not explicit Python", R.explicitPy(recoveryPrompt) === false],
  ["Python ctx candidate is hard-blocked", Boolean(reason) && R.hard(reason) === true],
];

const choose = loadPipelineChooser();
const pipelineCases = [
  ["pipeline repair keeps hard large filter as VBA", choose({ language: "vba", prompt }, {}, 0) === "vba"],
  ["explicit Python still wins in pipeline repair", choose({ language: "vba", prompt: prompt + " python\uc73c\ub85c \uc9dc" }, {}, 0) === "python"],
];

let pass = 0;
let fail = 0;
for (const [name, ok] of chatCases.concat(pipelineCases)) {
  if (ok) pass += 1;
  else fail += 1;
  console.log((ok ? " OK  " : "FAIL ") + name);
}
console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
if (fail) process.exit(1);
