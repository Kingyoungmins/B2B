// [지라 SBAGENT-289 / 2026-08-24 VM 실측] 3건 — 첨부 로그·스킬 zip 으로 원인을 확정하고 고쳤다.
//
//  1. 수정된 스킬에서 ✎ → "최초 프롬프트로 이동". 원인 둘 다 실물로 확인:
//     (a) lastEditPrompt 를 저장은 하는데 로드 화이트리스트에서 떨어뜨렸다 — 첨부 스킬
//         step4 저장본에 "*100"(수정본)이 있는데 zip 왕복 후 프리필이 "*5"(최초)로 돌아감.
//     (b) originHistId 갱신이 '완전 일치' 텍스트 매칭이라 조용히 실패 — step4 를 두 번
//         수정("*10"→"*100")했는데 번호표가 최초 "*5" 말풍선(0lg9f4lx)을 그대로 가리켰다.
//  2. ✎ 눌렀는데 입력창에 프롬프트가 안 찍힘 — 로그로 특정 불가(계측 부재) → 계측 추가.
//  3. 결과편집 후 마지막 단계만 수정했는데 5분 5초(리셋 3회 + 1단계부터 스텝별 격리 재구축).
//     빠른 경로가 삭제·토글에만 있고 '수정'에는 없었다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const sl = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8").replace(/^﻿/, "");
const cu = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
function sliceBalanced(src, startIdx, open, close) {
  let d = 0;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === open) d++;
    else if (src[i] === close) { d--; if (d === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}
function fnBody(src, name) {
  const at = src.indexOf("function " + name);
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const b = src.indexOf("{", src.indexOf(")", at));
  return sliceBalanced(src, b, "{", "}").slice(1, -1);
}

console.log("[1a] lastEditPrompt 가 zip 왕복에서 살아남는다");
check("저장 화이트리스트", /lastEditPrompt: \(typeof normalizeStaleBooksInSavedText/.test(sl));
check("로드 화이트리스트  ← 이번에 빠져 있던 자리", /lastEditPrompt: s\.lastEditPrompt \|\| null,/.test(sl));

console.log("[1b] originHistId 갱신 — 완전 일치 실패 시에도 갱신된다(동작 검증)");
{
  const body = fnBody(cu, "originHistIdForPromptLoose");
  // 의존 함수(완전 일치)도 실제 소스로
  const exactBody = fnBody(cu, "originHistIdForPrompt");
  const mk = new Function("state",
    "function originHistIdForPrompt(promptText){" + exactBody + "}\n"
    + "return function(promptText){" + body + "};");
  const hist = [
    { role: "user", histId: "h1", content: "R열 데이터를 *5 해서 s열에 써줘  [정확 참조] - 선택 범위: ..." },
    { role: "assistant", histId: "a1", content: "..." },
    { role: "user", histId: "h2", content: "R열 데이터를 *100 해서 s열에 써줘  [정확 참조] - 선택 범위: ..." },
    { role: "assistant", histId: "a2", content: "..." },
  ];
  const loose = mk({ chatHistory: hist });
  check("완전 일치가 되면 그대로(via=exact)",
    JSON.stringify(loose(hist[2].content)) === JSON.stringify({ histId: "h2", via: "exact" }));
  // VM 실측 케이스: sourceUserMessage 에는 [정확 참조] 블록이 없어 완전 일치가 깨진다
  const r = loose("R열 데이터를 *100 해서 s열에 써줘");
  check("블록 부착 차이는 접두 일치로 흡수(via=prefix)  ← 실측 실패 케이스",
    r.histId === "h2" && r.via === "prefix", JSON.stringify(r));
  const r2 = loose("완전히 다른 문장");
  check("그래도 못 찾으면 마지막 user(수정 적용은 방금 요청의 응답에 붙는다)",
    r2.histId === "h2" && r2.via === "last", JSON.stringify(r2));
  check("최신 것을 우선한다(h1 이 아니라 h2)", loose("R열 데이터를").histId === "h2");
  const r3 = mk({ chatHistory: [] })("아무거나");
  check("히스토리가 비면 null(엉뚱한 갱신 금지)", r3.histId === null && r3.via === "none");
  // [코드리뷰 2026-08-24] 빈 프롬프트(replyContext 유실)가 '마지막 user' 폴백까지 흘러가면
  // 근거 없이 최신 말풍선을 스탬프한다 — 갱신 안 함이 정답.
  const r4 = loose("");
  check("빈 프롬프트면 null(최신 말풍선 오스탬프 금지)", r4.histId === null && r4.via === "none");
}
check("수정 적용부가 loose 매칭을 쓰고 어느 단계로 잡혔는지 남긴다",
  /originHistIdForPromptLoose\(_src\)/.test(cu) && /edit\.histid\.update/.test(cu));

console.log("[2] 프리필 계측 — '안 찍힘'을 다음 로그가 특정하게");
check("프리필 결정 지점에 트레이스", /edit\.prefill/.test(pj)
  && /skippedDraft/.test(pj) && /lastEdit/.test(pj));

console.log("[2b] 자동 선택 줄은 초안이 아니다(실측 2026-08-25 skippedDraft 오인) — 동작 검증");
{
  // _applyEditPrefill 을 최소 스텁으로 실행한다(컬럼 0 'function ' 경계로 추출 — 중괄호
  // 카운팅은 함수 안 정규식의 '}' 에 속는다, _test_delete_rows_inplace_gate 와 동일 방식).
  const at = pj.indexOf("function _applyEditPrefill");
  const nx = pj.indexOf("\nfunction ", at + 1);
  let fsrcBody = pj.slice(at, nx < 0 ? pj.length : nx);
  fsrcBody = fsrcBody.slice(0, fsrcBody.lastIndexOf("\n}") + 2);
  const run = (taValue, step) => {
    const ta = {
      value: taValue,
      dispatchEvent() {}, focus() {}, setSelectionRange() {},
    };
    const fn = new Function("document", "window", "Event", "_editPrefillPromptOf", "traceClientUiEvent",
      fsrcBody + "\nreturn _applyEditPrefill;");
    const traced = [];
    fn({ getElementById: () => ta }, {}, function Event() {},
      s => (s && (s.lastEditPrompt || s.prompt)) || "",
      (ev, data) => traced.push({ ev, ...data }))(step);
    return { ta, traced };
  };
  const step = { id: "s1", prompt: "R열 데이터를 *100 해서 s열에 써줘" };
  const auto = "선택 범위: @범위[VIEW!A1:B2]";
  const r1 = run(auto, step);
  check("자동 선택 줄만 있으면 덮어쓴다  ← 실측 실패 케이스", r1.ta.value === step.prompt, r1.ta.value);
  check("트레이스에 autoSelOnly 가 남는다", r1.traced.some(t => t.ev === "edit.prefill" && t.autoSelOnly === true));
  const r2 = run("내가 쓰다 만 문장", step);
  check("진짜 초안은 기존대로 보호", r2.ta.value === "내가 쓰다 만 문장");
  const r3 = run(auto + "\n덧붙인 메모", step);
  check("자동 줄+타이핑 혼합도 보호", r3.ta.value === auto + "\n덧붙인 메모");
  const r4 = run("", step);
  check("빈 입력창은 채운다", r4.ta.value === step.prompt);
}

console.log("[3] 마지막 단계 '수정' 빠른 경로 — 삭제·토글과 같은 부품 재사용");
check("수정 경로에 빠른 판정이 생겼다",
  /_fastEditLast = canFastEditLastPipelineStep\(originalStep, idx, beforeReplaceSnapshot\)/.test(pj));
check("직전 사본이 있어야만 탄다(없으면 기존 전체 경로)",
  /_fastEditLast[\s\S]{0,200}_preApplySnapshot && originalStep\._preApplySnapshot\.resultId/.test(pj));
check("새 코드가 교차파일 쓰기면 안 탄다(사본 복원이 목적지를 못 되돌린다)",
  /_fastEditLast[\s\S]{0,400}pipelineStepWritesCrossFile\(next\[idx\]\)/.test(pj));
check("복원(삭제 경로와 동일 부품) 후 단일 적용(토글 ON 과 동일 부품)",
  /restoreLastStepPreApplySnapshot\(originalStep, \{ message: "마지막 단계 수정 반영 중\.\.\." \}\)[\s\S]{0,300}applyMappedSingleStep\(stepId\)/.test(pj));
check("성공 시 적용 서명 기록(다음 편집의 no-op 판정 유지)",
  /edit\.lastStep\.fast[\s\S]{0,60}ok: true[\s\S]{0,300}/.test(pj)
  && /applied = await applyMappedSingleStep\(stepId\);[\s\S]{0,400}noteLivePipelineApplied\(state\.pipeline\)/.test(pj));
check("실패하면 기존 전체 reconcile 로 폴백(결과 보장)",
  /edit\.lastStep\.fast[\s\S]{0,80}fallback: "reconcile"/.test(pj)
  && /_fastEditLast[\s\S]{0,3000}reconcilePipelineSimulationAfterEdit\(\{ forceBackend: true/.test(pj));
check("폴백까지 실패하면 원본 복원 + 오류 보고(기존 계약 유지)",
  /_fastEditLast[\s\S]{0,3000}restorePipelineStep\(stepId, originalStep\)/.test(pj));
check("마지막이 아닌 스텝 수정은 기존 경로 그대로(빠른 경로는 조건부)",
  /if \(_fastEditLast\) \{/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
