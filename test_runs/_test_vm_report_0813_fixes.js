// [VM 제보 5건 2026-08-13] 사용자가 사내망 VM 에서 겪은 것들. 로그(runtime_load_trace / vba_pipeline_trace)
// 로 원인을 확정하고 고쳤다. 이 테스트는 '고친 자리가 실제 실행 경로에 붙어 있는가'를 잠근다.
//
//   1. 처음부터 꺼진 채 저장된 스킬이 실행기에 들어오면 보류 일괄 실행 버튼이 안 보임
//        → _test_batch_resume*.js 가 동작까지 잠근다(여기선 배선만 확인)
//   2. 보류 일괄 실행이 느림
//        → 버그가 아니라 구조 비용. 실측으로 분해해 두고(아래 주석) 사용자에게 보이게만 한다.
//   3. on/off 후 탭이 어긋나 엑셀 클릭이 안 먹음 (상단 탭 누르면 풀림)
//   4. 특정 단계에서 프로그램이 최소화됐다 올라옴
//   5. '반영 중'에도 스킬 적용 중처럼 화면 잠그고 로딩 표시
//
// 로그로 확정한 실측(2026-08-13 13:57~14:20, 38MB 파일)
//   동반본 열기      사본 6.23초 + 열기 9.42초 = 15.65초   ← 캐시로 줄일 수 있는 건 사본(40%)뿐
//   동반본 되돌려쓰기 약 34.6초                             ← 격리 실행 1회 중 최대 비용
//   스텝 실제 실행    2.5초                                 ← 전체 70초 중 3.6%
//   '반영 중' 구간    14:02:16~14:02:49 파일 3개 replace 33초, 그 사이 오버레이 0건
//                    → 사용자가 그 틈에 탭을 9번 눌렀다(로그에 mirror.switch.ok 9건)
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const dh = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8").replace(/^﻿/, "");
const em = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8").replace(/^﻿/, "");
const ev = fs.readFileSync(path.join(ROOT, "scripts", "excel-viewer.js"), "utf8").replace(/^﻿/, "");
const cs = fs.readFileSync(path.join(ROOT, "native_host", "NativeHost.cs"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 보류 일괄 실행 버튼 — 꺼진 단계가 있으면 뜬다");
check("resume 이 없으면 꺼진 첫 단계를 시작 지점으로 삼는다",
  /start = steps\.findIndex\(s => s && s\.code && !isStepEnabled\(s\)\);/.test(pj));
check("라이브를 믿을 수 있는지는 따로 판단한다(resume 또는 적용 서명)",
  /liveUnknown: steps\.slice\(start\)\.some[\s\S]{0,200}derived && !_liveMatchesEnabledSteps\(steps\)/.test(pj));
check("못 믿으면 구간 이어실행이 아니라 원본부터 전체 재적용",
  /if \(info\.liveUnknown\) \{[\s\S]{0,900}reapplyVbaPipelineToLive\(_excelId\)/.test(pj));
check("모달이 '처음부터 실행합니다'를 미리 알려 준다", /앞 단계가 아직 파일에 적용되지 않아/.test(pj));

console.log("[3] 되돌리기 후 앱 탭까지 착지 — '클릭이 안 먹는' 증상의 정체");
check("복원이 보여준 세션으로 앱 탭을 맞춘다", /landAppTabOnExcelSession\(excelId\);/.test(pj));
check("여러 파일 복원 시 탭 전환을 한 번으로 모은다(창 튀는 것 방지)",
  /_pipelineTabLandTimer/.test(pj) && /setTimeout\(\(\) => \{[\s\S]{0,900}setCurrentView\(fid, \{ source: "pipeline-land" \}\)/.test(pj));
check("이미 그 탭이면 아무것도 안 한다", /if \(!fid \|\| fid === state\.currentFileId\) return;/.test(pj));
check("기다리는 사이 사용자가 탭을 옮겼으면 덮어쓰지 않는다",
  /if \(state\.currentFileId !== from\) return;/.test(pj));
check("전환 소스 화이트리스트에 pipeline-land 가 있다(없으면 setCurrentView 가 무시된다)",
  /source === "pipeline-land"/.test(ev));

console.log("[4] 최소화 — 자동 복귀의 부작용 차단");
check("busy 중 자동 복귀가 창 상태를 최소화로 남긴다",
  /lastWindowState = FormWindowState\.Minimized;\s*\n\s*WindowState = FormWindowState\.Maximized;/.test(cs));
check("그래야 복귀 리사이즈가 정상 복원 경로를 탄다(주석으로 이유 보존)",
  /restoredFromMinimized 가 false 라/.test(cs));
check("건너뛴 표시 요청을 성공으로 캐시하지 않는다",
  /if \(data && data\.skipped\) return false;/.test(em));

console.log("[5] '반영 중'에도 화면 잠금 + 로딩 표시  ← 이번 요청");
check("결과 반영 경로가 적용 잠금 오버레이를 연다",
  /_applyLockStarted[\s\S]{0,300}beginExcelMirrorApplyLoading\(outs\.length \? "결과를 라이브에 반영 중\.\.\."/.test(pj));
check("끝나면 반드시 닫는다(finally)",
  /if \(_applyLockStarted && typeof endExcelMirrorApplyLoading === "function"\)/.test(pj));
check("'반영 중' 상태 표시는 그대로 남는다", /setPipelineRuntimeStatus\(activeStepIds, "running", "반영 중"\)/.test(pj));

console.log("[+] 실행기 매핑 — 출력 슬롯을 소스 파일로 끌고 가지 않는다(VM 로그의 target.ambiguous)");
check("output:N 은 슬롯이라 이름으로 다시 묶지 않는다", /const isOutputSlot = \/\^output:\/\.test\(/.test(dh));
check("슬롯이면 텍스트 매칭 후보를 비운다",
  /let pick = declaredRows\.length \? declaredRows : \(isOutputSlot \? \[\] : matchedRows\);/.test(dh));

console.log("[2] 배치 속도 — 코드가 아니라 구조 비용임을 기록으로 남긴다");
check("동반본 여는 비용을 사본/열기로 갈라 찍는다(어디를 고쳐야 하는지 가르려고)",
  /copySec=round\(_t_copy, 2\), openSec=round\(_t_open, 2\)/.test(
    fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8")));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
