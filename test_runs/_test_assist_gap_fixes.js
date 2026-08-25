/* AI 도움 가시성 감사(2026-08-25) 수리 회귀 테스트 — 실행: node test_runs/_test_assist_gap_fixes.js
   ① 알림 링버퍼/오류 히스토리는 util.js 에서 실제 함수를 추출해 '동작'으로 검증하고,
   ②~⑤ 배선(도구 3종·run.trace 확장·저장 실패 가시화·프롬프트 사전)은 소스 계약으로 고정한다. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? "  PASS  " : "  FAIL  ") + name + (!cond && detail ? "  -> " + detail : ""));
  if (!cond) fails += 1;
}

/* ── [1] util.js 후킹 — 추출해서 실제로 돌려 본다 ── */
const util = read("scripts/util.js");
const fnStart = util.indexOf("function installAssistVisibilityHooks");
const fnEnd = util.indexOf("if (typeof window !== \"undefined\")", fnStart);
check("훅 함수가 util.js 에 있다", fnStart > 0 && fnEnd > fnStart);
let hooksOk = false;
try {
  // toast 전역과 window 흉내를 만들어 추출 실행
  let toastCalls = [];
  const sandbox = { Date, Object, Number, String, Array, console };
  const g = {};
  const src = "let toast = (m, t) => { toastCalls.push([m, t]); };\n"
    + util.slice(fnStart, fnEnd)
    + "\ninstallAssistVisibilityHooks(g, true);\n"
    + "return { g, callToast: (m, t) => toast(m, t) };";
  const out = new Function("g", "toastCalls", src)(g, toastCalls);
  hooksOk = true;

  console.log("[1] 알림 링버퍼 — 토스트가 기록으로 남는다");
  out.callToast("업로드 실패: 파일이 깨졌습니다", "error");
  out.callToast("저장 완료", "success");
  check("토스트가 원래대로도 뜬다", toastCalls.length === 2, toastCalls.length);
  check("기록이 쌓인다", g.__recentNotices.length === 2 && g.__recentNotices[0].type === "error");
  check("문구 보존", g.__recentNotices[0].msg.includes("업로드 실패"));
  for (let i = 0; i < 60; i++) out.callToast("msg" + i, "info");
  check("최대 50건 링버퍼", g.__recentNotices.length === 50, g.__recentNotices.length);
  check("오래된 것부터 밀려난다", g.__recentNotices[49].msg === "msg59");

  console.log("[2] 실행 오류 히스토리 — 단일 슬롯이 덮여도 최근 5건이 남는다");
  for (let i = 1; i <= 7; i++) {
    g.__lastPipelineErrorInfo = { stepIdx: i - 1, description: "단계" + i, message: "오류" + i };
  }
  check("현재 값은 마지막 오류", g.__lastPipelineErrorInfo.message === "오류7");
  check("히스토리 5건 유지", g.__pipelineErrorHistory.length === 5, g.__pipelineErrorHistory.length);
  check("가장 오래된 것은 오류3(1·2는 밀려남)", g.__pipelineErrorHistory[0].message === "오류3");
  check("step 은 1부터", g.__pipelineErrorHistory[4].step === 7);
  g.__lastPipelineErrorInfo = null;
  check("null 대입은 히스토리에 안 쌓인다", g.__pipelineErrorHistory.length === 5);
} catch (err) {
  check("훅 추출 실행", false, err && err.message);
}
check("페이지 로드시 자동 설치", /if \(typeof window !== "undefined"\) installAssistVisibilityHooks\(window, true\);/.test(util));

console.log("[3] 새 도구 3종 — app.notices / backup.status / secure.status");
const tools = read("scripts/assist-tools.js");
check("app.notices 정의", tools.includes('assistDefineTool("app.notices"'));
check("backup.status 정의 + 폴더 조회", tools.includes('assistDefineTool("backup.status"') && tools.includes('fetch("/api/logic/backup-dir")'));
check("secure.status 정의 + 상태 조회", tools.includes('assistDefineTool("secure.status"') && tools.includes('fetch("/api/secure-doc/status")'));
check("STORED zip 규칙을 도구가 안내", tools.includes("Compressed ZIP entries"));
check("step.error 에 recentErrors 히스토리", tools.includes("recentErrors:") && tools.includes("__pipelineErrorHistory"));
check("파일 목록에 신뢰도 필드", tools.includes("unreliableSheets") && tools.includes("inspectError") && tools.includes("backendOnly"));

console.log("[4] run.trace 확장 — perf(client.*) 트레이스 합산 + 화이트리스트");
const serve = read("serve_b2b.py");
const handler = serve.slice(serve.indexOf("def handle_diag_recent_trace"), serve.indexOf("def handle_excel_record_verify"));
check("vba+perf 두 트레이스를 읽는다", handler.includes("_vba_trace_path(), _perf_trace_path()"));
["upload.done", "secure.upload", "download.secure_applied", "download.secure_failed",
 "client.excel.apply_loading.depth_forced", "client.mirror.replace.reshow",
 "client.mirror.lazyopen.fail", "client.mirror.selection.gate",
 "client.llm.upstream.failover", "client.save.backup.failed"].forEach(ev =>
  check("keep: " + ev, handler.includes('"' + ev + '"')));
check("합산 후 시간순 정렬", handler.includes('events.sort(key=lambda e: str(e.get("ts") or ""))'));
check("잠금 라벨 필드(open) 추출", handler.includes('"open"'));

console.log("[5] 저장 실패 가시화 — save-load.js");
const save = read("scripts/save-load.js");
check("자동백업 실패 기록", save.includes("__lastLogicBackupError"));
check("서버 트레이스로도 남긴다", save.includes('traceClientUiEvent("save.backup.failed"'));
check("세션당 1회 토스트(도배 방지)", save.includes("__logicBackupFailToasted"));
check("성공 기록에 시각 포함", save.includes("window.lastLogicAutoBackup = { ...data, at: Date.now() }"));
check("수동 저장 try/catch + 실패 토스트", /try \{\s*\n\s*downloadZip\(buildLogicZipEntries\(name\)/.test(save)
  && save.includes("스킬 저장(zip 만들기)에 실패했습니다"));

console.log("[6] 프롬프트 사전 — 실행 밖 문제 지식");
const core = read("scripts/assist-core.js");
["app.notices", "backup.status", "secure.status", "문서를 보안해제", "보안적용 실패",
 "depth_forced", "llm.upstream.failover", "Compressed ZIP entries",
 "F9(개발자 설정)에 실제로 있는 것", "전체 파일 다운로드"].forEach(key =>
  check("프롬프트에: " + key, core.includes(key)));
check("사전이 실패 진단 절 앞에 위치(도구 소개가 늦지 않게)",
  core.indexOf("실행 '밖' 문제들") < core.indexOf('"방금 왜 실패했어?" — 실패 진단 시'));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails ? 1 : 0);
