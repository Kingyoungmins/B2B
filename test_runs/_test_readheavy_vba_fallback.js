// [0.5.18] read 과다 정적위반 라우팅 검증:
//  (1) read 과다 → Python 재생성 건너뛰고 '바로' VBA 전환(autoRegenerateAsVbaFallback), originalPythonCode 보존.
//  (2) 일반 python 정적위반은 기존대로 Python 재생성.
//  (3) VBA 폴백 코드가 게이트에 또 막히면 → showCodeGuardBlock 이 '원본 Python 강제 적용' onForceApply 제공.
// validateAssistantCodeBeforeApply + applyForcedPythonFallback 만 슬라이스하고 나머지 협력자는 스텁.
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
function slice(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0) throw new Error("slice 실패: " + startMarker);
  return src.slice(a, b);
}
const applyFn = slice("function applyForcedPythonFallback", "async function autoRegenerateForStaticSafety");
const validateFn = slice("function validateAssistantCodeBeforeApply", "\nfunction latestUserRequestForSafety");

// ── 스텁(기본값). 시나리오마다 globalThis 로 덮어씀 ─────────────────────────
const G = globalThis;
G.PYTHON_STATIC_MAX_REGEN = 1;
G.VBA_STATIC_MAX_REGEN = 1;
G.calls = {};
function reset() {
  G.calls = { regenPy: null, regenVba: null, guard: null, applyLogic: null };
  G.userExplicitlyRequestsVba = () => false;
  G.userExplicitlyRequestsPython = () => false;
  G.exactReferenceFailures = () => [];
  G.wholeColumnCountRowTwoFailures = () => [];
  G.pythonComMustUseVbaReason = () => "";
  G.isHardPythonComVbaReason = () => false;
  G.pythonComStaticSafetyFailures = () => [];
  G.vbaExactSheetReferenceFailures = () => [];
  G.vbaStaticSafetyFailures = () => [];
  G.codeHasBroadValueRewrite = () => false;
  G.pythonDegenerateOutputFailure = () => "";
  G.userExplicitlyRequestsForceProceed = () => false;
  G.replyStepPrompt = (c) => (c && c.sourceUserMessage) || "";
  G.uid = () => "id1";
  G.toast = () => {};
  G.autoRegenerateForStaticSafety = (code, failures, ctx) => { G.calls.regenPy = { code, failures, ctx }; };
  G.autoRegenerateAsVbaFallback = (code, failures, ctx) => { G.calls.regenVba = { code, failures, ctx }; };
  G.showCodeGuardBlock = (msg, ctx) => { G.calls.guard = { msg, ctx }; };
  G.applyLogic = (step) => { G.calls.applyLogic = step; return { ok: true }; };
}
eval(applyFn + "\n" + validateFn + "\nG.__validate = validateAssistantCodeBeforeApply;");

let pass = 0, fail = 0;
function ck(name, cond) { if (cond) { pass++; console.log(" OK  " + name); } else { fail++; console.log("FAIL " + name); } }

const READ_HEAVY = "큰 표를 ctx.read 로 Python 리스트에 올려 가공한 뒤 ctx.write 로 다시 쓰지 마세요. 대용량 파일에서 멈춥니다.";
const PY_CODE = "def transform(ctx):\n    v = ctx.read('요약','A1:Z9999')\n    for r in v: pass\n    ctx.write('요약','A1',[[1]])";
const VBA_CODE = "Sub DoIt()\n  Range(\"A1\").Value = 1\nEnd Sub";

// (1) read 과다 → 바로 VBA, Python 재생성 안 함, originalPythonCode 보존
reset();
G.pythonComStaticSafetyFailures = () => [READ_HEAVY];
let ret = G.__validate(PY_CODE, {});
ck("(1) read 과다: 반환 false", ret === false);
ck("(1) read 과다: Python 재생성 호출 안 함", G.calls.regenPy === null);
ck("(1) read 과다: 바로 VBA 전환 호출", !!G.calls.regenVba);
ck("(1) read 과다: originalPythonCode = 원본 파이썬", G.calls.regenVba && G.calls.regenVba.ctx.originalPythonCode === PY_CODE);

// (2) 일반 python 정적위반은 기존대로 Python 재생성(바로 VBA 아님)
reset();
G.pythonComStaticSafetyFailures = () => ["루프 안에서 ctx.write 반복 금지"];
ret = G.__validate(PY_CODE, {});
ck("(2) 일반 위반: 반환 false", ret === false);
ck("(2) 일반 위반: Python 재생성 호출", !!G.calls.regenPy);
ck("(2) 일반 위반: VBA 전환은 아직 안 함", G.calls.regenVba === null);

// (3) VBA 폴백 코드가 또 막힘 → guard 가 '원본 Python 강제 적용' 제공
reset();
G.vbaStaticSafetyFailures = () => ["On Error Resume Next 금지"];
ret = G.__validate(VBA_CODE, { vbaFallbackTried: true, originalPythonCode: PY_CODE });
ck("(3) VBA 폴백 실패: 반환 false", ret === false);
ck("(3) VBA 폴백 실패: guard 표시", !!G.calls.guard);
ck("(3) guard 라벨이 '원본 Python' 강제적용", G.calls.guard && /원본 Python/.test(G.calls.guard.ctx.forceLabel || ""));
ck("(3) onForceApply 존재", G.calls.guard && typeof G.calls.guard.ctx.onForceApply === "function");
// 강제적용 버튼 클릭 시뮬 → 원본 Python 을 language=python 으로 applyLogic
if (G.calls.guard && G.calls.guard.ctx.onForceApply) G.calls.guard.ctx.onForceApply();
ck("(3) 강제적용 → applyLogic(language=python)", G.calls.applyLogic && G.calls.applyLogic.language === "python");
ck("(3) 강제적용 → 원본 Python 코드로 적용", G.calls.applyLogic && G.calls.applyLogic.code === PY_CODE);

// (4) read 과다라도 이미 VBA 폴백 시도했으면 무한 VBA 재전환 안 함(원본 Python 강제적용 경로)
reset();
G.pythonComStaticSafetyFailures = () => [READ_HEAVY];   // 하지만 코드가 VBA(파이썬 스킬 아님)
ret = G.__validate(VBA_CODE, { vbaFallbackTried: true, originalPythonCode: PY_CODE });
ck("(4) VBA 폴백 후엔 read 과다여도 재-VBA 전환 안 함", G.calls.regenVba === null);

// (5) VBA 적용실패 → 에러복구 Python(recoveredFromVba) 은 게이트 없이 '무조건 적용'(루프 차단)
reset();
G.pythonComStaticSafetyFailures = () => [READ_HEAVY];   // read 과다여도
ret = G.__validate(PY_CODE, { allowPythonRecovery: true, recoveredFromVba: true });
ck("(5) VBA→Python 복구: 무조건 적용(return true)", ret === true);
ck("(5) VBA→Python 복구: VBA 로 안 튕김", G.calls.regenVba === null);
ck("(5) VBA→Python 복구: Python 재생성도 안 함(바로 적용)", G.calls.regenPy === null);
ck("(5) VBA→Python 복구: 차단(guard)도 없음", G.calls.guard === null);

// (6) 순수 Python→Python 복구(recoveredFromVba 아님)는 우회 대상 아님 → 게이트 유지(그래도 VBA 로 안 튕김)
reset();
G.pythonComStaticSafetyFailures = () => [READ_HEAVY];
ret = G.__validate(PY_CODE, { allowPythonRecovery: true });   // recoveredFromVba 없음
ck("(6) 순수 Python 복구: 무조건적용 아님(return false)", ret === false);
ck("(6) 순수 Python 복구: read 과다여도 VBA 로 안 튕김(루프 방지)", G.calls.regenVba === null);
ck("(6) 순수 Python 복구: 게이트 유지(Python 재생성 시도)", !!G.calls.regenPy);

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
