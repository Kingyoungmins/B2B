// [전체실행=원본부터 픽스 가드] 명시적 전체실행 버튼(생성기 btn-run / 실행기 runner-run-btn)은
// 남은 resume 체크포인트를 무시·초기화하고 ignoreCheckpoint 로 pristine 전체실행을 강제해야 한다.
// (저사양에서 직전 실패가 남긴 체크포인트로 skipReset 되어 입력 워크북이 오염상태로 1단계부터 터지던 버그.)
// DOM 핸들러라 유닛 실행 대신 소스 계약을 잠근다 + 백엔드 원본복원 검증(Fix B)도 존재 확인.
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
function ck(name, cond) { if (cond) { pass++; console.log(" OK  " + name); } else { fail++; console.log("FAIL " + name); } }

function handlerBody(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) return "";
  // 핸들러 시작부터 다음 '$("' 최상위 바인딩 전까지(대략) 잘라 본다.
  const next = src.indexOf('\n$("', start + marker.length);
  return src.slice(start, next < 0 ? start + 1600 : next);
}

const pipe = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");

// ── Fix A: 두 전체실행 버튼 ──────────────────────────────────────────────
const genBtn = handlerBody(pipe, '$("btn-run").onclick');
const runBtn = handlerBody(pipe, '$("runner-run-btn").onclick');
ck("[A] 생성기 btn-run 핸들러 찾음", genBtn.length > 0);
ck("[A] 생성기: clearPipelineResumeFromIndex() 호출", /clearPipelineResumeFromIndex\(\)/.test(genBtn));
ck("[A] 생성기: ignoreCheckpoint:true 로 runPipelineWithAutoRepair 호출",
   /runPipelineWithAutoRepair\(\s*\{[^}]*ignoreCheckpoint:\s*true/.test(genBtn));
ck("[A] 실행기 runner-run-btn 핸들러 찾음", runBtn.length > 0);
ck("[A] 실행기: clearPipelineResumeFromIndex() 호출", /clearPipelineResumeFromIndex\(\)/.test(runBtn));
ck("[A] 실행기: ignoreCheckpoint:true 로 runPipelineWithAutoRepair 호출",
   /runPipelineWithAutoRepair\(\s*\{[^}]*ignoreCheckpoint:\s*true/.test(runBtn));

// runPipelineWithAutoRepair 가 ignoreCheckpoint 를 존중해야(resume suffix 분기 가드)
const autoRepairIdx = pipe.indexOf("function runPipelineWithAutoRepair");
const autoRepairHead = pipe.slice(autoRepairIdx, autoRepairIdx + 700);
ck("[A] runPipelineWithAutoRepair 가 !ignoreCheckpoint 일 때만 suffix 로 분기",
   /!\s*runOptions\.ignoreCheckpoint[\s\S]*runPipelineSuffixFromCheckpoint/.test(autoRepairHead));

// ── Fix B: 백엔드 원본복원 검증 ──────────────────────────────────────────
const serve = fs.readFileSync(path.join(__dirname, "..", "serve_b2b.py"), "utf8");
ck("[B] _copy_source_workbook_into_target 에 원본 시트 subset 검증 존재",
   /issubset\([\s\S]{0,40}\)/.test(serve) && /원본 복원 실패/.test(serve));

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
