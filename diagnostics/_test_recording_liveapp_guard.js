// [회귀] 녹화 중 공유 라이브 Excel 을 죽이는 경로를 모두 차단했는가.
// 실측(2026-07-28): "이번엔 아예 첫단계부터 녹화된 동작이 없음". 트레이스 —
//   record.native.start 12:38:09 labelStateAfter='recording' (레코더는 켜짐)
//   record.native.stop  12:38:24 harvested=0, stopLabelBefore='idle'
//   excel.spawned       12:38:24 (_get_live_excel_app 이 죽은 LIVE_EXCEL_APP 재생성)
//   → 시작~정지 사이 공유 인스턴스 사망. 그 사이 서버 COM 활동은 없었음.
// 진범: 클라 COM 행 워치독(noteExcelComTimeout: 90s 내 2회 타임아웃)이 녹화 중 매크로
//       레코더의 '정상' COM 블록을 '행'으로 오판 → /api/excel/force-restart →
//       _force_restart_excel_sessions_direct 가 COM 없이 pid kill(=COM 트레이스 안 남음)로
//       공유 Excel 을 죽임. 정지는 새 빈 인스턴스에서 돌아 harvested=0.
// 수정: ① 서버 force-restart 녹화 중 스킵(종료 제외) ② 서버 close 녹화 중 라이브세션 스킵
//       ③ 클라 워치독 녹화 중 무력화 ④ 클라 forceRestart 자체 녹화 중 no-op
//       ⑤ 클라: 준비 구간부터 __excelRecordingActive=true 로 세션 전체 커버.
// 실행: node diagnostics/_test_recording_liveapp_guard.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const py = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8");
const mirror = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8");
const pipeline = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass += 1; console.log("PASS " + name); } else { fail += 1; console.log("FAIL " + name); } }

function fnBody(s, name) {
  const idx = s.indexOf("def " + name + "(");
  if (idx < 0) return "";
  // 다음 top-level def 까지(간이) — 들여쓰기 def 는 무시하고 파일 끝/다음 'def ' 열0 기준.
  const after = s.slice(idx + 4);
  const m = after.search(/\ndef [A-Za-z_]/);
  return m < 0 ? after : after.slice(0, m);
}

// ── 1. 서버: force-restart 녹화 중 스킵(종료=wait 는 예외) ──
const fr = fnBody(py, "_force_restart_excel_sessions_direct");
t("1a force-restart 녹화 스킵 가드 존재",
  /if not wait and .*NATIVE_RECORDING.*\.get\("active"\)/.test(fr));
t("1b 스킵은 종료 전(EXCEL_LOCK.acquire 앞)에서 반환",
  fr.indexOf("force_restart_skipped_during_recording") < fr.indexOf("EXCEL_LOCK.acquire"));
t("1c 스킵 시 _note_live_app_reset(skipped) 트레이스",
  /_note_live_app_reset\("force_restart_skipped_during_recording", skipped=True\)/.test(fr));
// wait=True(종료)에는 스킵하지 않는다 — 'not wait' 조건이 반드시 있어야
t("1d 종료(wait=True)는 스킵 예외(not wait 조건)", /if not wait and/.test(fr));

// ── 2. 서버: close 녹화 중 라이브세션 스킵(registry pop 전) ──
const cs = fnBody(py, "_close_excel_session_impl");
t("2a close 녹화 가드가 registry pop '전'에 있음",
  cs.indexOf('NATIVE_RECORDING.get("active")') >= 0
  && cs.indexOf('NATIVE_RECORDING.get("active")') < cs.indexOf("EXCEL_SESSIONS.pop(excel_id"));
t("2b 라이브 공유/liveEditable 세션만 스킵",
  /_is_live_shared_app\(_peek\.get\("app"\)\) or bool\(_peek\.get\("liveEditable"\)\)/.test(cs));
t("2c 스킵 시 keptAliveForRecording 반환",
  /keptAliveForRecording": True/.test(cs));

// ── 3. 클라: 워치독(noteExcelComTimeout) 녹화 중 무력화 ──
const ncomIdx = mirror.indexOf("function noteExcelComTimeout");
const ncom = mirror.slice(ncomIdx, mirror.indexOf("\n}", ncomIdx) + 2);
t("3a noteExcelComTimeout 녹화 중 조기반환",
  /globalThis\.__excelRecordingActive\) return;/.test(ncom));
t("3b 그 반환은 타임아웃 카운트(comTimeoutTimes.push) '전'에 있음",
  ncom.indexOf("__excelRecordingActive) return;") < ncom.indexOf("comTimeoutTimes"));

// ── 4. 클라: forceRestartExcelMirrors 자체도 녹화 중 no-op ──
const frmIdx = mirror.indexOf("async function forceRestartExcelMirrors");
const frm = mirror.slice(frmIdx, frmIdx + 900);
t("4a forceRestartExcelMirrors 녹화 중 no-op(return false)",
  /__excelRecordingActive\) \{[\s\S]*?return false;/.test(frm));
t("4b no-op 은 실제 fetch 앞에서 반환",
  frm.indexOf("__excelRecordingActive") < frm.indexOf('/api/excel/force-restart'));

// ── 5. 클라: 준비 구간부터 __excelRecordingActive=true(세션 전체 커버) ──
t("5a 준비('… 준비 중') 직전 플래그 true 설정",
  /globalThis\.__excelRecordingActive = true;[\s\S]{0,120}btn\.textContent = "… 준비 중";/.test(pipeline));
// finally 의 setUi() 가 recording=false 시 플래그를 내린다(기존 배선 유지)
t("5b setUi() 가 __excelRecordingActive=recording 로 정지/실패 시 해제",
  /globalThis\.__excelRecordingActive = recording;/.test(pipeline));

// ── 6. 상태전이: 워치독 카운터가 녹화 중엔 절대 안 쌓임(로직 재현) ──
function watchdog(recordingActive, applying, preopening) {
  // noteExcelComTimeout 의 게이트 순서를 그대로 재현
  if (recordingActive) return "suppressed";       // ← 새 가드
  if (applying || preopening) return "busy";
  return "counted";
}
t("6a 녹화 중이면 무조건 suppressed", watchdog(true, false, false) === "suppressed");
t("6b 비녹화·유휴면 counted(기존 동작 유지)", watchdog(false, false, false) === "counted");
t("6c 비녹화·적용중이면 busy(기존 동작 유지)", watchdog(false, true, false) === "busy");

// ── 7. [죽음 오판 방지] Workbooks.Count 예외를 pid 생존 확인 없이 '사망'으로 처리하던 것 ──
// 실측(2026-07-29 15:34:21): 녹화2 시작 3초 뒤 사용자 셀 편집 중 COM 일시 거부(RPC_E_CALL_REJECTED)
// → get_live_found_dead 오판 → 빈 EXCEL.EXE(62860) 재스폰. pid 13124 는 15:34:39 샘플에서도 생존.
// 결과: ① 빈 인스턴스가 회색 창 고아로 잔존 ② stop 이 빈 앱을 조회해 harvested=0(캡쳐된 동작 없음).
// 수정: LIVE_EXCEL_APP_PID 추적 — 프로브 예외여도 pid 살아 있으면 기존 프록시 반환(재스폰 금지).
const ga = fnBody(py, "_get_live_excel_app");
t("7a LIVE_EXCEL_APP_PID 전역 선언", /\nLIVE_EXCEL_APP_PID = None/.test(py));
t("7b 프로브 예외 시 pid 생존이면 기존 앱 반환(재스폰 금지)",
  /_alive = bool\(LIVE_EXCEL_APP_PID\) and _is_pid_alive\(LIVE_EXCEL_APP_PID\)/.test(ga)
  && /if _alive:/.test(ga)
  && ga.indexOf("if _alive:") < ga.indexOf('_note_live_app_reset("get_live_found_dead")'));
t("7c 오판 케이스 트레이스(live_app.busy_not_dead + duringRecording)",
  /live_app\.busy_not_dead/.test(ga) && /duringRecording=bool\(NATIVE_RECORDING\.get\("active"\)\)/.test(ga));
t("7d 스폰 시 pid 기록·진짜 사망 시 pid 초기화",
  /LIVE_EXCEL_APP_PID = int\(_excel_process_id\(app\) or 0\) or None/.test(ga)
  && /LIVE_EXCEL_APP = None\s*\n\s*LIVE_EXCEL_APP_PID = None/.test(ga));
// 판정 로직 재현: (COM 예외, pid 생존) → 유지 / (COM 예외, pid 사망) → 재스폰
function deadDecision(comThrew, pidAlive) {
  if (!comThrew) return "use";
  return pidAlive ? "keep_existing" : "respawn";
}
t("7e 일시 거부(pid 생존) → 기존 유지", deadDecision(true, true) === "keep_existing");
t("7f 진짜 사망(pid 죽음) → 재스폰(기존 회복 동작 유지)", deadDecision(true, false) === "respawn");
t("7g 정상 프로브는 그대로 사용", deadDecision(false, true) === "use");

// ── 8. [셀 편집 중 정지] in-cell edit 중 COM 거부로 정지 실패 → 버튼만 풀리는 이중 상태 ──
// 실측(2026-07-29): "셀 편집 중일 때 녹화 종료가 안 되는데 버튼은 눌려서 다시 찍어야 함".
// 수정: ① 서버 — 정지/시작 전에 EXCEL7 그리드에 PostMessage Enter 로 편집을 '확정'(포커스 안 훔침,
//        정상 상태면 키 전송 0회) ② 클라 — 수확 전 정지 실패는 녹화 상태 유지(재시도 가능).
const commit = fnBody(py, "_commit_pending_excel_cell_edit");
t("8a 확정 헬퍼: 프로브 먼저(정상이면 키 전송 없이 True — 실제 호출 기준, docstring 무관)",
  commit.indexOf("app.Workbooks.Count") >= 0
  && commit.indexOf("app.Workbooks.Count") < commit.indexOf("win32gui.PostMessage("));
t("8b Enter 는 PostMessage(포그라운드 강탈 없음 — SetForegroundWindow 미사용)",
  /win32gui\.PostMessage\(hwnd, win32con\.WM_KEYDOWN, win32con\.VK_RETURN, 0\)/.test(commit)
  && !/SetForegroundWindow/.test(commit));
t("8c EXCEL7 그리드 대상 + 재시도 후 성공/실패 트레이스",
  /_excel_grid_hwnds_for_pid/.test(commit)
  && /record\.cell_edit\.committed/.test(commit) && /record\.cell_edit\.commit_failed/.test(commit));
const stopFn = fnBody(py, "excel_record_stop");
t("8d 정지: 수확 전에 편집 확정 호출", /_commit_pending_excel_cell_edit\(app\)/.test(stopFn)
  && stopFn.indexOf("_commit_pending_excel_cell_edit(app)") < stopFn.indexOf("stop_native_recording_impl(app"));
const startFn = fnBody(py, "excel_record_start");
t("8e 시작: 잠금해제 COM 호출 전에 편집 확정", /_commit_pending_excel_cell_edit\(_get_live_excel_app\(\)\)/.test(startFn)
  && startFn.indexOf("_commit_pending_excel_cell_edit") < startFn.indexOf("_set_live_sessions_edit_unlock, True"));
// 클라: 수확 전 정지 실패 → 녹화 상태 유지(recording=false 안 함) + 재시도 안내
const pipeSrc = require("fs").readFileSync(require("path").join(ROOT, "scripts", "pipeline.js"), "utf8");
t("8f 클라 정지 실패 분기(_isStopAttempt && !_stopHarvested) 존재",
  /const _isStopAttempt = recording;/.test(pipeSrc) && /let _stopHarvested = false;/.test(pipeSrc)
  && /_stopHarvested = true;/.test(pipeSrc)
  && /if \(_isStopAttempt && !_stopHarvested\) \{/.test(pipeSrc));
{
  const brIdx = pipeSrc.indexOf("if (_isStopAttempt && !_stopHarvested) {");
  const br = pipeSrc.slice(brIdx, pipeSrc.indexOf("} else {", brIdx));
  t("8g 그 분기 안에서 recording=false 안 함(녹화 유지)", !/recording = false/.test(br)
    && /다시 눌러 주세요/.test(br));
}
// 상태전이 재현: (정지시도, 수확여부, 오류) → 유지/리셋
function stopFailDecision(isStopAttempt, harvested) {
  return (isStopAttempt && !harvested) ? "keep_recording" : "reset";
}
t("8h 수확 전 정지 실패 → 녹화 유지", stopFailDecision(true, false) === "keep_recording");
t("8i 수확 후(분할/재현) 실패 → 리셋(레코더는 이미 꺼짐)", stopFailDecision(true, true) === "reset");
t("8j 시작 실패 → 리셋(기존 동작)", stopFailDecision(false, false) === "reset");

// ── 9. [녹화 취소 = 원상복구] 검토에서 스텝 미추가(취소) 시 녹화 전 스냅샷으로 복원 ──
// 실측(2026-07-29): "녹화 취소하면 녹화 전으로 돌아가야 하는데 그대로 남음" — 취소가 그냥 return.
{
  const cancelIdx = pipeSrc.indexOf("if (!picked || !picked.length) {");
  const cancelBlock = pipeSrc.slice(cancelIdx, cancelIdx + 2600);
  t("9a 취소 시 recPreSnapshots 로 /api/excel/replace 복원",
    /recPreSnapshots\.length/.test(cancelBlock)
    && /postExcelMirror\("\/api\/excel\/replace"/.test(cancelBlock));
  t("9b 복원 순서: 녹화 세션 마지막(재현 루프와 동일)",
    /_cancelOrder = \[\.\.\.recPreSnapshots\]\.sort/.test(cancelBlock)
    && /a\.excelId === recExcelId \? 1 : 0/.test(cancelBlock));
  t("9c 완전 복원=성공 토스트 · 실패/불완전=경고 토스트",
    /녹화를 취소하고 녹화 전 상태로 되돌렸습니다/.test(cancelBlock)
    && /_cancelFailed \|\| !recSnapshotsComplete/.test(cancelBlock));
  t("9d 스냅샷 없으면 화면 유지 안내(파괴 없음)",
    /녹화 전 스냅샷이 없어 화면은 그대로입니다/.test(cancelBlock));
  t("9e 취소 후 녹화 세션으로 착지(showOnly)",
    /showOnlyExcelMirrorWindow === "function" && recExcelId/.test(cancelBlock));
  // '캡처된 동작 없음'(entries 비어있음) 경로는 복원하지 않는다 — 캡처가 없는데 복원하면
  // 사용자의 수작업 변경만 지워지고 재생할 스텝도 없다(파괴적). 의도된 비복원.
  const emptyIdx = pipeSrc.indexOf('toast("녹화 완료 — 캡처된 동작이 없습니다"');
  const emptyBlock = pipeSrc.slice(Math.max(0, emptyIdx - 300), emptyIdx + 200);
  t("9f '캡처 없음' 경로는 복원 안 함(수작업 보호)", emptyIdx >= 0 && !/api\/excel\/replace/.test(emptyBlock));
}

console.log(pass + "/" + (pass + fail) + " PASS");
process.exit(fail ? 1 : 0);
