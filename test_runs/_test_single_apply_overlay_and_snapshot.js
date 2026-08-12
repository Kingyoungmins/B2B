// [VM 실측 2026-08-12] 단계 켜기(단일 적용) 경로의 두 가지 결함을 고정한다.
//
//   ① 34초 무표시 — VM 로그 13:06:53~13:07:27 구간에 apply_loading 이 아예 없었다.
//      사용자는 화면이 잠기지도 않고 아무 안내도 없이 34초를 기다렸다("멈춘 줄 알았다").
//   ② 중복 스냅샷 — applyLastEnabledStepFast 가 찍고, 그 안에서 부르는
//      runLivePipelineStepSequentially 가 또 찍었다. 32MB 파일에서 6.1초 + 6.2초.
//   ③ 교차파일 스텝을 켜면 리셋+전체 재적용으로 도망갔다(4분 35초, 실제 일한 시간 35초).
//      이제 격리 1스텝으로 돈다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

// 기본 인자(`options = {}`)의 중괄호를 본문 시작으로 착각하지 않게, 괄호부터 균형을 맞춘 뒤
// 그다음 '{' 를 본문으로 잡는다(다른 테스트들과 같은 관례).
function fnBody(name) {
  const at = pj.indexOf("async function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const paren = pj.indexOf("(", at);
  let d = 0, paramEnd = -1;
  for (let i = paren; i < pj.length; i++) {
    if (pj[i] === "(") d++;
    else if (pj[i] === ")") { d--; if (d === 0) { paramEnd = i; break; } }
  }
  const s = pj.indexOf("{", paramEnd);
  d = 0;
  for (let i = s; i < pj.length; i++) {
    if (pj[i] === "{") d++;
    else if (pj[i] === "}") { d--; if (!d) return pj.slice(at, i + 1); }
  }
  throw new Error("unbalanced");
}

const mapped = fnBody("applyMappedSingleStep");
const fast = fnBody("applyLastEnabledStepFast");
const seq = fnBody("runLivePipelineStepSequentially");

console.log("[1] 단계 켜기에 로딩 오버레이가 뜬다  ← 34초 무표시 수정");
check("오버레이 시작", /beginExcelMirrorApplyLoading\("스킬 재적용 중\.\.\."/.test(mapped), mapped.slice(0, 400));
check("전체 재적용과 같은 문구", /스킬 재적용 중/.test(mapped));
check("반드시 해제(finally)", /finally \{[\s\S]{0,220}endExcelMirrorApplyLoading\(\)/.test(mapped));
check("해제가 실패해도 나머지 정리는 진행(try/catch)", /try \{ endExcelMirrorApplyLoading\(\); \} catch \(_\) \{\}/.test(mapped));
check("헬퍼가 없으면 건너뛴다(구버전 안전)", /typeof beginExcelMirrorApplyLoading === "function"/.test(mapped));

console.log("[2] 스냅샷은 한 번만 찍는다  ← 6초×2 낭비 제거");
check("호출자가 이미 찍었다고 알려준다", /skipPreApplySnapshot: true/.test(fast), fast.slice(-500));
check("실행 함수가 그 신호를 존중한다", /if \(options\.skipPreApplySnapshot !== true\) \{[\s\S]{0,120}captureStepPreApplySnapshot\(step, excelId\);/.test(seq));
check("신호가 없으면 예전처럼 찍는다(다른 호출자 회귀 금지)", /options\.skipPreApplySnapshot !== true/.test(seq));
check("호출자는 여전히 스냅샷을 만든다(OFF 롤백 보장)", /const snap = await captureStepPreApplySnapshot\(step, excelId\);/.test(fast));
check("스냅샷 실패는 여전히 적용 중단", /복구 스냅샷을 만들지 못했습니다/.test(fast));

console.log("[3] 교차파일 스텝은 격리 1스텝으로  ← 전체 재적용 제거");
check("교차파일이면 격리 경로", /const isVbaSeq = lang !== "python" \|\| writesCrossFile;/.test(seq));
check("교차파일 판정은 헬퍼로", /pipelineStepWritesCrossFile\(step\)/.test(seq));
check("헬퍼 없으면 예전 동작", /typeof pipelineStepWritesCrossFile === "function"/.test(seq));
check("격리는 reset:false(현재 상태 위에 얹는다)", /reset: false/.test(seq));
check("ON 판정에서 교차파일 조건 제거", !/\|\| _crossFile\)/.test(pj));
check("교차파일 여부는 기록에 남는다", /crossFile: _crossFileStep/.test(pj));

console.log("[4] 되돌리기(OFF) 쪽 교차파일 가드는 그대로 — 여긴 손대지 않았다");
check("OFF 는 여전히 교차파일이면 사본 복원을 건너뛴다", /const _crossSuffix = \(typeof pipelineSuffixWritesCrossFile === "function"\)/.test(pj));
check("OFF 폴백(reconcile) 유지", /traceOff\("reconcile_fallback"/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
