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
check("착지는 미러 복원 '앞에서 동기로' — 늦으면 복원이 옛 탭 창을 되살려 증상이 뒤집혀 재현된다",
  /landAppTabOnExcelSession\(excelId\);[\s\S]{0,80}scheduleRestoreActiveExcelMirror/.test(pj));
check("디바운스를 걷어냈다(복원이 파일당 수십 초라 아무것도 안 모였다)",
  !/_pipelineTabLandTimer/.test(pj));
check("이미 그 탭이면 아무것도 안 한다", /if \(!fid \|\| fid === state\.currentFileId\) return;/.test(pj));
check("교차파일 목적지 복원은 탭을 옮기지 않는다(사용자가 보던 파일이 아니다)",
  /restoreSnapshotIntoSession\(ex, \{ message: label, landTab: false \}\)/.test(pj));
check("전환 소스 화이트리스트에 pipeline-land 가 있다(없으면 setCurrentView 가 무시된다)",
  /source === "pipeline-land"/.test(ev));

console.log("[4] 최소화 — 자동 복귀의 부작용 차단");
check("busy 중 자동 복귀는 그대로 둔다(창 상태는 안 건드린다 — 철회)",
  /Auto-restore: minimized during busy work/.test(cs));
check("철회 사유를 코드에 남겼다(다음 사람이 같은 판단을 반복하지 않게)",
  /인과가 이 경로에선 성립하지 않았다/.test(cs));
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

console.log("[6] 적대 검증에서 나온 결함들");
check("A1 배치 후 이어실행 지점은 '뒤쪽에도 켜진 게 없을 때'만 세운다(이중 적용 방지)",
  /_tailAllOff[\s\S]{0,400}if \(_headAllOn && _tailAllOff\) setPipelineResumeFromIndex\(_firstOff\);/.test(pj));
check("D1 배치 요청(position)도 건너뛴 응답을 캐시하지 않는다",
  /if \(posData && posData\.skipped\) return false;/.test(em));
check("D2 복구(recover)도 마찬가지", /복구도 같은 게이트 아래다/.test(em));
check("C 네이티브의 lastWindowState 조작은 철회됐다", !/lastWindowState = FormWindowState\.Minimized;/.test(cs));
check("C 대신 최소화 알림에 순서 보장(세대 번호)을 넣었다", /hostMinimizedGeneration/.test(cs));
check("E1 failsafe 를 네이티브에 함께 보낸다", /publishNativeUiBusy\(true, label, options\.failsafeMs\)/.test(em));
check("E1 네이티브가 그 값을 타이머 간격으로 쓴다", /uiBusyFailsafeTimer\.Interval = uiBusyFailsafeMs;/.test(cs));
check("E2 적용 잠금이 중첩 카운트로 보호된다(내부 end 가 바깥을 안 닫는다)",
  /applyDepth/.test(em) && /if \(excelMirror\.applyDepth > 0\) \{[\s\S]{0,400}return;/.test(em));
// [2026-08-24] 카운트만으로는 부족했다 — begin/end 짝이 깨지면(실측 12/10) 깊이가 0 이 안 돼
// 오버레이가 영구히 남아 화면이 회색으로 굳었다. 중첩 보호는 유지하되 자가 회복을 넣었다.
check("E2b 짝이 깨져도 회복된다(회색 화면 영구 잔류 방지)",
  /applyDepthTouchedAt/.test(em) && /excel\.apply_loading\.depth_forced/.test(em)
  && /excelMirror\.applyDepth = 0;/.test(em));
check("F2 출력 슬롯 미해결은 '파일 확인' 대신 할 수 있는 안내를 준다",
  /출력 파일을 올린 뒤 다시 실행하세요/.test(pj));

console.log("[2] 배치 속도 — 코드가 아니라 구조 비용임을 기록으로 남긴다");
check("동반본 여는 비용을 사본/열기로 갈라 찍는다(어디를 고쳐야 하는지 가르려고)",
  /copySec=round\(_t_copy, 2\), openSec=round\(_t_open, 2\)/.test(
    fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8")));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
