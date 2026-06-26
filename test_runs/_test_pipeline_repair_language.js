const fs = require("fs");
const path = require("path");

let src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const end = src.indexOf("function extractPipelineRepairCode");
if (end < 0) throw new Error("failed to locate pipeline repair functions");

globalThis.userExplicitlyRequestsVba = function (text) {
  return /(?:^|[^\w])vba(?:[^\w]|$)|vba\s*(?:로|모드|버전|코드|작성|짜|해|써)|매크로|Sub\s+B2BSkill\s*\(/i.test(String(text || ""));
};
globalThis.userExplicitlyRequestsPython = function (text) {
  return /(?:^|[^\w])python(?:[^\w]|$)|python\s*(?:으|로|모드|버전|코드|작성|짜|해|써)|파이썬|(?:^|[^\w])py\s*(?:으로|로)|(?:^|[^\w])com\s*(?:으로|로)|def\s+transform\s*\(/i.test(String(text || ""));
};
globalThis.shouldRouteRequestToVba = function (text) {
  return /조건부\s*행\s*삭제|피벗|집계|매칭\s*합산/i.test(String(text || ""));
};
globalThis.window = {};

eval(src.slice(0, end) + `
globalThis.P = {
  choosePipelineRepairLanguage,
  shouldForceVbaForPipelineRepair,
  buildPipelineAutoRepairPrompt,
};
`);

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

const vbaStep = {
  language: "vba",
  prompt: "선택 범위: @범위[file.xlsx/VIEW!A:A] 값을 정리해줘",
  description: "VIEW 값 정리",
  code: "Sub B2BSkill()\nEnd Sub",
};

check("failed VBA step without explicit VBA repairs as Python",
  P.choosePipelineRepairLanguage(vbaStep, {}, 0) === "python");
check("failed VBA step without explicit VBA is not force-VBA",
  P.shouldForceVbaForPipelineRepair(vbaStep, {}, 0) === false);

const explicitVbaStep = {
  ...vbaStep,
  prompt: "선택 범위: @범위[file.xlsx/VIEW!A:A] 값을 정리해줘, vba로",
};
check("explicit VBA prompt keeps VBA repair",
  P.choosePipelineRepairLanguage(explicitVbaStep, {}, 0) === "vba");

check("forceLanguage vba still wins",
  P.choosePipelineRepairLanguage(vbaStep, { forceLanguage: "vba" }, 0) === "vba");
check("forceLanguage python wins",
  P.choosePipelineRepairLanguage(explicitVbaStep, { forceLanguage: "python" }, 0) === "python");

const prompt = P.buildPipelineAutoRepairPrompt(vbaStep, 2, {}, "python");
check("python repair prompt says VBA failure can be repaired with Python/ctx",
  /VBA였더라도.*Python\/ctx|저장된 VBA Step이 실패/.test(prompt));
check("python repair prompt does not tell model to convert back to VBA",
  !/Python이 아니라 VBA로 복구해야/.test(prompt));

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 2 : 0);
