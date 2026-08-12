// [회귀] 보류(pending) 배리어 불변식: '보류 스텝을 풀기 전에는 그 뒤 스텝이 실행되면 안 된다'.
// 실측(2026-07-28): 4번 보류 상태에서 3번에 스킬 삽입·적용 → 보류였던 5번이 같이 적용됨.
// 원인 ① runPipelineSuffixFromCheckpoint 가 start~끝까지 돌려 배리어 해제 ② 삽입이 resume 미시프트
//      ③ 교차파일 reapply 가 enabled 전체 적용(배리어 무시).
// 실행: node diagnostics/_test_pending_barrier.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass += 1; console.log("PASS " + name); } else { fail += 1; console.log("FAIL " + name); } }

function extractFn(s, name) {
  const idx = s.indexOf("function " + name + "(");
  let p = s.indexOf("(", idx), pd = 0, b = -1;
  for (let j = p; j < s.length; j++) { if (s[j] === "(") pd++; else if (s[j] === ")") { pd--; if (!pd) { b = s.indexOf("{", j); break; } } }
  let d = 0;
  for (let j = b; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}") { d--; if (!d) return s.slice(idx, j + 1); } }
}

// ── 상태전이 시뮬레이션: resume 헬퍼 + markPipelinePendingFromIndex 를 스텁으로 실행 ──
const harness = `
var window = {};
var _pipeline = [];
var state = { get pipeline(){return _pipeline;}, set pipeline(v){_pipeline=v;} };
function isStepEnabled(s){ return s && s.enabled !== false; }
var _status = {};
function setPipelineRuntimeStatus(ids, st){ (ids||[]).forEach(id=>_status[id]=st); }
function refreshRunButton(){}
${extractFn(src, "getPipelineResumeFromIndex")}
${extractFn(src, "setPipelineResumeFromIndex")}
${extractFn(src, "clearPipelineResumeFromIndex")}
${extractFn(src, "markPipelinePendingFromIndex")}
`;
const H = new Function(harness + `
  return { set(p){_pipeline=p;}, status:()=>_status,
    getResume:getPipelineResumeFromIndex, setResume:setPipelineResumeFromIndex,
    mark:markPipelinePendingFromIndex };
`)();

const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: "s" + (i + 1), enabled: true }));

// 1. mark(3) on 6-step: [0,3) 적용, [3,6) 보류, resume=3
H.set(mk(6)); H.mark(3);
t("1 markPending(3): resume=3", H.getResume() === 3);
t("1b [0,3) 적용·[3,6) 보류", H.status().s1 === "applied" && H.status().s3 === "applied"
  && H.status().s4 === "review" && H.status().s6 === "review");

// 2. 삽입 배리어 시프트: resume=3, idx=2(<=resume) 삽입 → 배열 7개, resume=4
H.set(mk(6)); H.mark(3);
{
  const next = H.status(); // (mark 후)
  const arr = mk(6); arr.splice(2, 0, { id: "NEW", enabled: true }); // 7 steps
  H.set(arr);
  const _r = 3; // 시프트 전 resume(삽입 직후 저장값)
  if (Number.isInteger(_r) && 2 <= _r) H.setResume(_r + 1);
  t("2 배리어 시프트: idx2<=resume3 → resume=4", H.getResume() === 4);
}
// 2b 배리어 뒤(idx>resume) 삽입은 시프트 안 함
H.set(mk(6)); H.mark(3);
{
  const arr = mk(6); arr.splice(5, 0, { id: "NEW", enabled: true });
  H.set(arr);
  const _r = 3; if (Number.isInteger(_r) && 5 <= _r) H.setResume(_r + 1);
  t("2b idx5>resume3 → 시프트 안 함(resume=3)", H.getResume() === 3);
}

// 3. runPipelineSuffixFromCheckpointImpl 의 endExclusive/barrierRemains 로직 재현
const isStepEnabled = (s) => s && s.enabled !== false;
function suffixCap(steps, start, endIndexExclusive) {
  const endExclusive = Number.isInteger(endIndexExclusive)
    ? Math.max(start, Math.min(endIndexExclusive, steps.length)) : steps.length;
  const barrierRemains = endExclusive < steps.length;
  const ran = steps.slice(start, endExclusive).filter(isStepEnabled).map(s => s.id);
  const heldAfter = barrierRemains ? steps.slice(endExclusive).map(s => s.id) : [];
  return { ran, barrierRemains, heldAfter, endExclusive };
}
// 시나리오: 7스텝, 삽입 후 배리어=4, start=2(삽입위치) → [2,4) 실행, [4,7) 보류(s4old,s5,s6)
const arr7 = [{id:"s1"},{id:"s2"},{id:"NEW"},{id:"s3"},{id:"s4",enabled:false},{id:"s5"},{id:"s6"}];
const r = suffixCap(arr7, 2, 4);
t("3 [2,4) 만 실행(NEW,s3) — 배리어 뒤 안 감", JSON.stringify(r.ran) === JSON.stringify(["NEW", "s3"]));
t("3b 배리어 유지·s5(보류였던 5번) 실행 안 됨", r.barrierRemains && r.heldAfter.includes("s5"));
// endIndexExclusive 없으면 끝까지(이어실행) — 기존 동작
const r2 = suffixCap(arr7, 2, undefined);
t("3c cap 없으면 끝까지(이어실행 유지)", r2.ran.includes("s5") && !r2.barrierRemains);

// ── 4. 배선 소스 검증 ──
t("4a runPipelineSuffix endIndexExclusive 배선",
  /const endExclusive = Number\.isInteger\(options\.endIndexExclusive\)/.test(src)
  && /const runSteps = barrierRemains \? steps\.slice\(0, endExclusive\)/.test(src));
t("4b runFromCheckpointAfterEdit cap 전달(배리어 '앞' 편집만)",
  /const _capEnd = \(Number\.isInteger\(existingResume\) && requestedStart < existingResume\)\s*\?\s*existingResume : undefined/.test(src)
  && /endIndexExclusive: _capEnd/.test(src));
t("4c insertLogic resume 시프트(체크포인트+VBA 경로)",
  (src.match(/if \(Number\.isInteger\(_r\) && idx <= _r\) setPipelineResumeFromIndex\(_r \+ 1\)/g) || []).length >= 2);
t("4d reapply capIndexExclusive(교차파일 배리어 유지)",
  /options\.capIndexExclusive/.test(src)
  && /sourceSteps = \(sourceSteps \|\| \[\]\)\.slice\(0, _capIdx\)/.test(src));

// ── 5. 보류 구간 토글 = 즉시 반영(캡 없음, 보류 해제) / 배리어 앞 편집 = 캡(held 유지) ──
// 실측(2026-07-29): 5,6 보류 → 5에 삽입 → 밀린 보류 스텝 ON 눌렀는데 '동작 안함'. 원인 —
// 삽입-배리어용 캡(_capEnd=resume)이 '보류 구간 안' 토글에도 걸려 [resume,resume)=무실행.
// 수정 — 캡은 배리어 '앞'(requestedStart < resume) 편집에만. runFromCheckpointAfterEdit 의
// start/_capEnd 결정 + suffixCap 실행을 결합해 재현.
function editResolve(existingResume, requestedStart) {
  const start = Number.isInteger(existingResume) ? Math.min(existingResume, requestedStart) : requestedStart;
  const capEnd = (Number.isInteger(existingResume) && requestedStart < existingResume) ? existingResume : undefined;
  return { start, capEnd };
}
{
  // 7스텝, 보류 resume=5 ([5,7)=s6,s7 held). 사용자가 held 스텝 idx5 를 토글.
  const steps = mk(7);
  const { start, capEnd } = editResolve(5, 5);
  const r = suffixCap(steps, start, capEnd);
  t("5a 보류 스텝(idx5) 토글 → 캡 없음", capEnd === undefined);
  t("5b start=resume(5)부터 끝까지 실행(s6,s7)", JSON.stringify(r.ran) === JSON.stringify(["s6", "s7"]));
  t("5c 보류 해제(배리어 안 남음)", r.barrierRemains === false);
}
{
  // 대비: 배리어 앞(idx2) 편집은 여전히 캡 → held 유지(불변식 회귀 방지).
  const steps = mk(7);
  const { start, capEnd } = editResolve(5, 2);
  const r = suffixCap(steps, start, capEnd);
  t("5d 배리어 앞(idx2) 편집 → cap=resume(5)", capEnd === 5);
  t("5e [2,5) 만 실행 · [5,7) held 유지",
    JSON.stringify(r.ran) === JSON.stringify(["s3", "s4", "s5"]) && r.barrierRemains);
}

// ── 6. [스위치=라이브 적용 상태 단일 축] (사용자 확정 모델 2026-07-29 — 시나리오 문답으로 확정)
//      ON=적용 · OFF=보류. 끄기=그 스텝+뒤 전부 OFF+보류(롤백) / 켜기=그 스텝 하나만 즉시 적용 /
//      삽입·추가=윗 스텝 OFF면 새 스텝도 OFF+보류 / 삭제=끄기와 동일.
//      실행 검증은 diagnostics/_test_switch_axis_model.js (실제 함수 추출-실행, 14시나리오).
// [2026-08-12] 연타 직렬화가 들어오면서 handlePipelineStepToggle 은 async 가 아닌 '큐 래퍼'가 되고
// 실제 로직은 _handlePipelineStepToggleImpl 로 갔다. 잠그려는 것은 여전히 '핸들러가 top-level 이라
// 테스트로 돌릴 수 있는가' 이므로 async 여부는 보지 않는다(실행 검증은 _test_switch_axis_model.js).
t("6a 토글 핸들러가 top-level 함수(테스트 가능하게 분리)",
  /\bfunction handlePipelineStepToggle\(stepId\)/.test(src)
  && /\basync function _handlePipelineStepToggleImpl\(stepId\)/.test(src)
  && /handlePipelineStepToggle\(step\.id\)/.test(src));
t("6b 끄기 = 캐스케이드 OFF(그 스텝부터 끝까지) + hold 롤백",
  /for \(let j = currentIdx; j < state\.pipeline\.length; j \+= 1\)/.test(src)
  && /restorePipelineToCheckpointAndHold\(currentIdx, beforeToggleSnapshot/.test(src));
t("6c 켜기 = 그 스텝 '하나만' 단일 적용(매핑본) + resume 해제",
  /const _applied = await applyMappedSingleStep\(stepId\)/.test(src)   // 실행기 매핑 경유(옛 파일명 치환)
  && /clearPipelineResumeFromIndex\(\);\s*\/\/ 라이브가 더는 순수 프리픽스가 아님/.test(src));
t("6d 삭제 = 캐스케이드 OFF + hold(자동 재적용 아님)",
  /restorePipelineToCheckpointAndHold\(currentIdx, beforeDeleteSnapshot/.test(src)
  && !/runFromCheckpointAfterEdit\(currentIdx, beforeDeleteSnapshot/.test(src));
t("6e 삽입/추가: 윗 스텝 OFF면 새 스텝도 OFF+보류",
  /idx > 0 && !isStepEnabled\(next\[idx - 1\]\)/.test(src)
  && /_lastStep && !isStepEnabled\(_lastStep\)/.test(src));
t("6f 오류복구 보류는 유지(정당한 실패-보류 — '오류 후 보류')",
  /restorePipelineToCheckpointAndHold\(stepIdx[\s\S]{0,160}오류 후 보류/.test(src));

console.log(pass + "/" + (pass + fail) + " PASS");
process.exit(fail ? 1 : 0);
