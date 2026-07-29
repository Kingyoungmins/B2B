// [회귀] 녹화 재현 직전 '회색 엑셀' — 숨김 세션 교체(replace)가 프레임을 표시로 승격하던 문제.
// 실측(2026-07-29): 녹화 재현 직전 회색 엑셀 창이 뜨고 사라지지 않음. python/vba 스킬 적용은 정상.
// 원인 — 녹화 재현만 유일하게 '숨겨진 세션 포함 전 세션'을 /api/excel/replace 로 복원하는데,
// _replace_excel_session_workbook_impl 이 숨김 여부와 무관하게 session["hidden"]=False +
// new_wb.Activate() + _present_live_session_frame(표시)를 수행 → 비활성 파일 프레임이 화면에
// 뜨고 남았다. 수정 — replace 는 '내용만' 바꾸고 표시는 show-only/탭 전환의 몫(관심 분리):
//   ① was_hidden 캡처 → hidden 보존 ② 숨김+frame 모드 전용 브랜치(표시·Activate 안 함,
//   새 프레임은 오픈 직후 offscreen 파킹 그대로) ③ 숨김이면 Worksheet.Activate 도 스킵
//   ④ 클라: 재현 복원 루프에서 녹화 세션을 마지막에 교체 ⑤ 클라: keptAliveForRecording 응답이면
//   매핑 유지(관리 밖 고아 창 방지).
// 실행: node diagnostics/_test_replace_hidden_no_present.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const py = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8");
const pipe = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
const mirror = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8");

let pass = 0, fail = 0;
const t = (n, c, got) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + (got !== undefined ? "  got=" + JSON.stringify(got) : "")); } };

// ── 1. 서버: replace 가 숨김 상태를 보존한다 ──
const implStart = py.indexOf("def _replace_excel_session_workbook_impl");
const impl = py.slice(implStart, py.indexOf("\ndef ", implStart + 10));
t("1a was_hidden 을 세션 변형 전에 캡처", /was_hidden = bool\(session\.get\("hidden"\)\)/.test(impl)
  && impl.indexOf('was_hidden = bool(session.get("hidden"))') < impl.indexOf('wb.Close(SaveChanges=False)'));
t("1b hidden 무조건 False 금지 — was_hidden 보존", /session\["hidden"\] = was_hidden/.test(impl)
  && !/session\["hidden"\] = False\s*\n\s*session\["snapshots"\]/.test(impl));

// ── 2. 서버: 숨김+frame 전용 브랜치 — 표시/Activate 없음 ──
const hiddenBranchIdx = impl.indexOf("elif live_editable and was_hidden and LIVE_FRAME_MODE:");
const generalBranchIdx = impl.indexOf("elif live_editable:");
t("2a 숨김 전용 브랜치가 일반 브랜치보다 먼저", hiddenBranchIdx >= 0 && generalBranchIdx > hiddenBranchIdx);
const hiddenBranch = impl.slice(hiddenBranchIdx, generalBranchIdx);
t("2b 숨김 브랜치는 표시 호출(_present_live_session_frame( )·Activate 안 함(주석 언급은 무관)",
  !/_present_live_session_frame\(/.test(hiddenBranch) && !/new_wb\.Activate\(\)/.test(hiddenBranch));
t("2c 숨김 브랜치: hidden=True 유지 + ScreenUpdating 복원",
  /session\["hidden"\] = True/.test(hiddenBranch) && /app\.ScreenUpdating = True/.test(hiddenBranch));
t("2d 숨김 브랜치: 보호/그리드 설정은 유지(표시 시점 품질)",
  /_protect_workbook_for_read_only_mirror\(new_wb, True\)/.test(hiddenBranch)
  && /_configure_excel_grid_window\(app, new_wb\)/.test(hiddenBranch));
t("2e 숨김이면 Worksheet.Activate(활성 워크북 새치기) 스킵",
  /if active_sheet and active_sheet in sheets and not \(live_editable and was_hidden and LIVE_FRAME_MODE\):/.test(impl));

// ── 3. 서버: 일반(표시 중) 세션 교체 동작은 그대로(회귀 없음) ──
const generalBranch = impl.slice(generalBranchIdx, impl.indexOf('else:', generalBranchIdx));
t("3a 표시 중 세션 교체는 여전히 프레임 재제시(_present_live_session_frame)",
  /_present_live_session_frame/.test(generalBranch));
t("3b 새 프레임 오픈 직후 offscreen 파킹은 유지(번쩍 방지)",
  /_move_hwnd_offscreen\(_new_frame_hwnd\)/.test(impl));

// ── 4. 클라: 재현 복원 루프 — 녹화 세션을 마지막에 교체 ──
t("4a 재현 replace 루프가 recExcelId 를 마지막으로 정렬",
  /_orderedSnaps = \[\.\.\.recPreSnapshots\]\.sort\(\(a, b\) =>\s*\n?\s*\(a\.excelId === recExcelId \? 1 : 0\) - \(b\.excelId === recExcelId \? 1 : 0\)\)/.test(pipe)
  && /for \(const snap of _orderedSnaps\)/.test(pipe));
{ // 정렬 로직 자체 검증
  const snaps = [{ excelId: "REC" }, { excelId: "OTHER1" }, { excelId: "OTHER2" }];
  const recExcelId = "REC";
  const ordered = [...snaps].sort((a, b) => (a.excelId === recExcelId ? 1 : 0) - (b.excelId === recExcelId ? 1 : 0));
  t("4b 정렬 결과: 녹화 세션이 맨 뒤", ordered[2].excelId === "REC" && ordered[0].excelId !== "REC", ordered);
}

// ── 5. 클라: keptAliveForRecording 이면 매핑 유지(고아 창 방지) ──
const keptIdx = mirror.indexOf("_closed && _closed.keptAliveForRecording");
const delIdx = mirror.indexOf("delete excelMirror.sessionsByFileId", keptIdx);
t("5a close 응답 keptAliveForRecording → 매핑 삭제 전에 return",
  keptIdx >= 0 && delIdx > keptIdx
  && /keptAliveForRecording\) \{[\s\S]{0,400}?return;/.test(mirror.slice(keptIdx - 40, keptIdx + 500)));

// ── 6. 서버 close 가드가 실제로 keptAliveForRecording 를 반환(계약 짝 맞음) ──
t("6 서버 close 녹화 가드 keptAliveForRecording 반환", /"keptAliveForRecording": True/.test(py));

console.log(pass + "/" + (pass + fail) + " PASS");
process.exit(fail ? 1 : 0);
