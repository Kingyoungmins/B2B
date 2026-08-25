const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const start = src.indexOf("function userExplicitlyRequestsVba");
const end = src.indexOf("function latestUserRequestForSafety");
if (start < 0 || end < 0 || end <= start) {
  throw new Error("failed to locate validateAssistantCodeBeforeApply block in scripts/chat-ui.js");
}

let block = src.slice(start, end);
block += `
globalThis.H = {
  validateAssistantCodeBeforeApply,
  userExplicitlyRequestsPython,
  pythonComStaticSafetyFailures,
  vbaStaticSafetyFailures,
};
`;
eval(block);

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

let vbaFallbackCalls = 0;
let pythonRegenCalls = 0;
let guardCalls = 0;

autoRegenerateAsVbaFallback = function () {
  vbaFallbackCalls += 1;
};
autoRegenerateForStaticSafety = function () {
  pythonRegenCalls += 1;
};
showCodeGuardBlock = function () {
  guardCalls += 1;
};

// [SBAGENT-296] 제공 모듈(re/datetime/math)의 단순 import 는 이제 '허용'이 정책이라
// 정적 실패 픽스처로 못 쓴다 — 여전히 차단되는 미제공 모듈(os)로 바꿔 의도를 보존한다.
const pythonWithStaticFailure = `
def transform(ctx):
    import os
    rows = ctx.read("2026년", "B336:D336")
    ctx.write("2026년", "B336", rows)
`;

let ok = H.validateAssistantCodeBeforeApply(pythonWithStaticFailure, {
  sourceUserMessage: "에러복구 추가 설명: python으로 짜. B336:D336 범위의 월 정보를 +1 변경",
  staticRegenAttempt: 1,
});
check("explicit python with static failure is not accepted", ok === false);
check("explicit python does not call VBA fallback after max regen", vbaFallbackCalls === 0, `fallback=${vbaFallbackCalls}`);
check("explicit python shows final guard instead of VBA fallback", guardCalls === 1, `guard=${guardCalls}`);

vbaFallbackCalls = 0;
pythonRegenCalls = 0;
guardCalls = 0;
ok = H.validateAssistantCodeBeforeApply(pythonWithStaticFailure, {
  sourceUserMessage: "B336:D336 범위의 월 정보를 +1 변경",
  staticRegenAttempt: 1,
});
check("non-explicit python still falls back to VBA after max regen", ok === false && vbaFallbackCalls === 1, `fallback=${vbaFallbackCalls}`);

vbaFallbackCalls = 0;
pythonRegenCalls = 0;
guardCalls = 0;
ok = H.validateAssistantCodeBeforeApply(pythonWithStaticFailure, {
  sourceUserMessage: "에러복구 추가 설명: python으로 짜. B336:D336 범위의 월 정보를 +1 변경",
  staticRegenAttempt: 0,
});
check("explicit python first failure regenerates Python", ok === false && pythonRegenCalls === 1 && vbaFallbackCalls === 0, `pyRegen=${pythonRegenCalls}, fallback=${vbaFallbackCalls}`);

const pythonConditionalDelete = `
def transform(ctx):
    sheet = "조건삭제"
    rows = [2, 3, 6]
    for row in reversed(rows):
        ctx.delete_rows(sheet, row)
`;

vbaFallbackCalls = 0;
pythonRegenCalls = 0;
guardCalls = 0;
ok = H.validateAssistantCodeBeforeApply(pythonConditionalDelete, {
  sourceUserMessage: [
    "선택 범위: @범위[v0510_today_full_smoke.xlsx/조건삭제!F:F] 20260403 이전이면 해당 행 삭제해줘",
    "에러복구 추가 설명: python으로 짜",
  ].join("\\n"),
  staticRegenAttempt: 0,
});
check("error recovery explicit python keeps conditional row delete in Python", ok === true && vbaFallbackCalls === 0, `ok=${ok}, fallback=${vbaFallbackCalls}`);

vbaFallbackCalls = 0;
pythonRegenCalls = 0;
guardCalls = 0;
ok = H.validateAssistantCodeBeforeApply(pythonConditionalDelete, {
  sourceUserMessage: "선택 범위: @범위[v0510_today_full_smoke.xlsx/조건삭제!F:F] 20260403 이전이면 해당 행 삭제해줘",
  allowPythonRecovery: true,
  staticRegenAttempt: 0,
});
check("error recovery allowPythonRecovery keeps conditional row delete in Python without explicit note", ok === true && vbaFallbackCalls === 0, `ok=${ok}, fallback=${vbaFallbackCalls}`);

vbaFallbackCalls = 0;
pythonRegenCalls = 0;
guardCalls = 0;
ok = H.validateAssistantCodeBeforeApply(pythonWithStaticFailure, {
  sourceUserMessage: "선택 범위: @범위[v0510_today_full_smoke.xlsx/조건삭제!F:F] 20260403 이전이면 해당 행 삭제해줘",
  allowPythonRecovery: true,
  staticRegenAttempt: 1,
});
check("error recovery allowPythonRecovery does not fall back to VBA after Python static max", ok === false && vbaFallbackCalls === 0 && guardCalls === 1, `fallback=${vbaFallbackCalls}, guard=${guardCalls}`);

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 2 : 0);
