// [0.5.18] VBA→Python 복구/강제 대용량: extendedTimeout 플래그가 적용 스텝/파이프라인 페이로드에 실려
// 백엔드로 전달되는지 검증(백엔드는 이 플래그로 정적검사 우회 + 데드라인 확장). 함수만 슬라이스+스텁.
const fs = require("fs");
const path = require("path");

const chatSrc = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const pipeSrc = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
function slice(src, startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0) throw new Error("slice 실패: " + startMarker);
  return src.slice(a, b);
}
const applyForcedFn = slice(chatSrc, "function applyForcedPythonFallback", "async function autoRegenerateForStaticSafety");
const payloadFn = slice(pipeSrc, "function isolatedPipelineStepPayload", "async function runIsolatedLivePipelineSteps");

const G = globalThis;
G.calls = {};
G.uid = () => "id1";
G.toast = () => {};
G.replyStepPrompt = (c) => (c && c.sourceUserMessage) || "";
G.applyLogic = (step) => { G.calls.applyLogic = step; return { ok: true }; };
G.inferPipelineStepTargetSheetName = () => null;
G.inferPipelineStepLanguage = (s) => (s && s.language) || "python";
eval(applyForcedFn + "\n" + payloadFn +
  "\nG.__applyForced = applyForcedPythonFallback; G.__payload = isolatedPipelineStepPayload;");

let pass = 0, fail = 0;
function ck(name, cond) { if (cond) { pass++; console.log(" OK  " + name); } else { fail++; console.log("FAIL " + name); } }

const PY = "def transform(ctx):\n    ctx.write('요약','A1',[[1]])";

// (1) 원본 Python 강제 적용 → applyLogic 스텝에 extendedTimeout:true
G.calls = {};
G.__applyForced(PY, { originalPythonDesc: "원본" });
ck("(1) 강제적용: language=python", G.calls.applyLogic && G.calls.applyLogic.language === "python");
ck("(1) 강제적용: extendedTimeout=true", G.calls.applyLogic && G.calls.applyLogic.extendedTimeout === true);

// (2) 파이프라인 페이로드: 복구/강제 스텝(extendedTimeout=true)이면 그대로 전달
const p1 = G.__payload({ code: "x", extendedTimeout: true, trustedStatic: true }, 0);
ck("(2) 복구 스텝 페이로드: extendedTimeout=true 전달", p1.extendedTimeout === true);
ck("(2) 복구 스텝 페이로드: trustedStatic=true 전달", p1.trustedStatic === true);

// (3) 일반 스텝은 extendedTimeout=false (오탐으로 대용량 데드라인 안 붙게)
const p2 = G.__payload({ code: "x" }, 0);
ck("(3) 일반 스텝 페이로드: extendedTimeout=false", p2.extendedTimeout === false);
ck("(3) 일반 스텝 페이로드: trustedStatic=false", p2.trustedStatic === false);

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
