// [한전 오류신고 2026-07-20 재현/회귀] v4 스킬 왕복: zip(.logic.json) 로드 → 러너 요구행 → 매핑 실행 코드.
// 증상(실측): 0.6.2가 저장한 v4 스킬을 구버전(0.6.1)이 열면
//   (1) 코드에 자리표(@@FILE_n@@)가 그대로 남아 "워크북 '@@FILE_1@@' 이 열려 있지 않습니다"
//   (2) 자리표 때문에 생성시트 판정의 book 키가 안 맞아 유령 시트(무선간선망/고압모계기/고압자계기) 요구
// 수정: 구버전에도 로드 시 자리표→원본 이름 복원 백포트(요구 표 자체는 계속 무시 = 기존 추론).
// 사용: node diagnostics/_repro_hanjeon_v4_roundtrip.js [zip|logic.json] [--root <버전폴더>]
// 종료코드: 실행 코드에 자리표 잔존 또는 유령 시트 요구 시 1 (회귀 게이트용).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const rootArgIdx = process.argv.indexOf("--root");
const ROOT = rootArgIdx > 0 ? path.resolve(process.argv[rootArgIdx + 1]) : path.join(__dirname, "..");
const posArgs = process.argv.slice(2).filter((a, i, arr) => a !== "--root" && arr[i - 1] !== "--root");
const SRC = posArgs[0] || path.join(__dirname, "..", "test_data", "issue_repro", "hanjeon_v4_resaved.logic.json");

// ── 스킬 로드(zip 이면 파이썬 zipfile 경유 — 한글 파일명 안전) ──
let manifestJson;
if (/\.zip$/i.test(SRC)) {
  manifestJson = execSync(
    `python -c "import json,zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);lj=[n for n in z.namelist() if n.endswith('.logic.json')][0];sys.stdout.buffer.write(z.read(lj))" "${SRC}"`,
    { maxBuffer: 64 * 1024 * 1024 }
  ).toString("utf8");
} else {
  manifestJson = fs.readFileSync(SRC, "utf8");
}
const data = JSON.parse(manifestJson);
console.log(`대상: ${path.basename(SRC)} (version ${data.version || 1}) / 스크립트: ${path.basename(ROOT)}`);

const dropSrc = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8");
const saveSrc = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8");

function extract(src, name) {
  let st = src.indexOf("function " + name + "(");
  if (st < 0) {
    const alt = src.indexOf("window." + name + " = function");
    if (alt < 0) throw new Error("not found: " + name);
    st = alt;
  }
  // 파라미터 괄호를 먼저 균형 매칭 — `options = {}` 같은 기본값 중괄호에서 본문 탐색이 시작되면 추출이 깨진다.
  let p = src.indexOf("(", st), pd = 0;
  for (; p < src.length; p++) { if (src[p] === "(") pd++; else if (src[p] === ")") { pd--; if (pd === 0) break; } }
  let i = src.indexOf("{", p), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === "{") d++; else if (src[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } }
  let out = src.slice(st, e);
  if (out.startsWith("window.")) out = out.replace(/^window\.(\w+) = function/, "var $1 = function");
  return out;
}

// ── 샌드박스: 실제 앱과 동일한 전역/상태 ──
const sb = {
  console, Map, Set, JSON, Array, String, RegExp, Number, Math, Date,
  window: {}, document: { getElementById: () => null },
  $: () => null, toast: () => {}, deepClone: o => JSON.parse(JSON.stringify(o)),
  normalizeText: s => String(s || "").trim().toLowerCase().replace(/\s+/g, ""),
  isStepEnabled: s => s && s.enabled !== false,
  ensurePipelineStepIds: () => {},
  rememberLogicSaveBaseName: () => {}, currentLogicSaveBaseName: n => n, stripLogicTimestampSuffix: n => n,
  invalidateLivePipelineApplied: () => {}, renderPipeline: () => {}, renderChatFromHistory: () => {},
  refreshChatState: () => {}, refreshRunButton: () => {}, addMessage: () => {},
  scheduleLogicAutoBackup: () => {}, openRunnerLogicEditor: () => {},
  getPipelineRuntimeStatus: () => null,
  workbookDisplayName: (f, fb) => (f && f.name) || fb,
  outputTemplateFileId: i => "output:" + i,
  state: {},
};
vm.createContext(sb);

// 러너 함수 전부 + 저장/로드 함수(실제 코드). 버전에 없는 함수는 건너뛴다(0.6.1 = v4 미지원).
const runnerFnNames = [...new Set([...dropSrc.matchAll(/^(?:window\.)?(?:async )?(?:function (runner\w+)|(runner\w+|buildRunnerMappedPipeline) = (?:async )?function)/gm)]
  .map(m => m[1] || m[2]))];
[...runnerFnNames, "buildRunnerMappedPipeline"].forEach(f => {
  try { vm.runInContext(extract(dropSrc, f), sb); } catch (_) {}
});
["loadedSkillReqSignature", "loadLogic"].forEach(f => {
  try { vm.runInContext(extract(saveSrc, f), sb); } catch (e) { console.log("  (미로드)", f); }
});
try {
  const pipeSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
  // 안정키/이름 정규화 계열은 loadLogic 의 v4 재바인딩과 러너 자동 매칭(rebound 티어)이 쓴다.
  const pipeFns = [...new Set([...pipeSrc.matchAll(/^function (pipelineLooksLike\w+)\(/gm)].map(m => m[1]))]
    .concat(["pipelineCollectWorkbookNames", "pipelineFileIdByWorkbookName", "pipelineKnownFiles",
             "pipelineDecodeWorkbookName", "pipelineEncodeWorkbookName", "pipelineWorkbookNameKey",
             "pipelineStableWorkbookKey"]);
  pipeFns.forEach(f => { try { vm.runInContext(extract(pipeSrc, f), sb); } catch (_) {} });
  for (const m of pipeSrc.matchAll(/^const (PIPELINE_VOLATILE_\w+)\s*=\s*\[/gm)) {
    try { vm.runInContext(pipeSrc.slice(m.index, pipeSrc.indexOf("\n];", m.index) + 3), sb); } catch (_) {}
  }
} catch (_) {}
for (const m of dropSrc.matchAll(/^const (RUNNER_\w+) = ("[^"\n]*"|\d+|\[[^\]]*\]);/gm)) {
  try { vm.runInContext(m[0], sb); } catch (_) {}
}

// ── 1) 실제 업로드 상황: 오류신고 폴더의 파일 6종(시트명 실측) ──
const INPUTS = [
  { name: "한국전력공사_202606_v1.1_DSMC_260710.xlsx", sheetNames: ["상품번호별", "청구계정별"] },
  { name: "한국전력공사_202606_v1.1_DSMC_260710_원본.xlsx", sheetNames: ["상품번호별", "청구계정별"] },
  { name: "01. 한전_DAS_배전자동화_청구세부내역_도서_2026-07-14 13_25_33_DSMC_260714 - 복사본 (2).xlsx",
    sheetNames: ["01. 한전_DAS_배전자동화_청구세부내역_도서_2026-07-14 13_25_33_DSMC_260714"] },
  { name: "01. 한전_DAS_배전자동화_청구세부내역_시내_2026-07-14 13_25_33_DSMC_260714 - 복사본.xlsx",
    sheetNames: ["01. 한전_DAS_배전자동화_청구세부내역_시내_2026-07-14 13_25_33_DSMC_260714"] },
  { name: "02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 13_07_47_DSMC_260714.xlsx",
    sheetNames: ["02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 13_07_47_DSMC_260714"] },
  { name: "03. 한전_AMI_무선인입망합산_청구세부내역_2026-07-14 13_11_11_DSMC_260714.xlsx",
    sheetNames: ["03. 한전_AMI_무선인입망합산_청구세부내역_2026-07-14 13_11_11_DSMC_260714"] },
];
sb.state = {
  pipeline: [], chatHistory: [],
  inputs: JSON.parse(JSON.stringify(INPUTS)),
  inputsOriginal: JSON.parse(JSON.stringify(INPUTS)),
  outputTemplates: [], runnerMappings: {}, runnerMappingChecked: false,
};
vm.runInContext(`getFile = id => {
  const t = String(id || "");
  if (t.startsWith("input:")) return (state.inputs || []).find(f => f.name === t.slice(6)) || null;
  return null;
};`, sb);

// ── 2) 실제 loadLogic 으로 로드(v4 지원 버전이면 자리표 복원 포함) ──
sb.__data = data;
vm.runInContext('loadLogic(__data, "재현.zip", {})', sb);

const handleScan = steps => {
  const hits = [];
  (steps || []).forEach((s, i) => {
    const m = String(s.code || "").match(/@@FILE_\d+@@/g);
    if (m) hits.push(`step${i + 1}:${[...new Set(m)].join(",")}`);
  });
  return hits;
};
console.log("\n=== (A) loadLogic 직후 ===");
const loadLeak = handleScan(vm.runInContext("state.pipeline", sb));
console.log(" 코드 내 자리표 잔존:", loadLeak.join(" ") || "없음");
// v4 지원 버전인지(= 자리표 복원/표 재바인딩이 있어야 하는 버전인지)
const v4Capable = vm.runInContext("typeof loadedSkillReqSignature === 'function' && !!state.loadedSkillRequirements", sb);
console.log(" v4 지원 버전:", v4Capable);

// ── 3) 러너 요구행(파일확인 목록) ──
let reqRows = [];
try { reqRows = vm.runInContext("runnerExtractMappingRequirements()", sb) || []; }
catch (e) { console.log(" runnerExtractMappingRequirements 예외:", e.message); }
console.log("\n=== (B) 파일확인 요구행 ===");
reqRows.forEach(r => console.log(`  [${r.source || "infer"}] book=${r.book} | sheet=${r.sheet || "-"}`));
const PHANTOMS = ["무선간선망", "고압모계기", "고압자계기"];
const phantomRows = reqRows.filter(r => PHANTOMS.includes(String(r.sheet || "")));
console.log(" 유령 시트 요구:", phantomRows.length ? phantomRows.map(r => r.sheet).join(",") : "없음");
// [한전 Step15 계열] v4 표에 없는 '미해결 실참조'(01 파일)도 매핑 행으로 노출돼야 한다 — 숨기면
// 사용자가 매핑할 기회 없이 해당 스텝이 실행에서 죽는다.
let missingUnresolvedRows = [];
if (v4Capable) {
  const unresolvedReal = (vm.runInContext("state.loadedSkillRequirements.unresolvedRefs || []", sb) || [])
    .filter(n => /\.(xls[xmb]?|csv)$/i.test(String(n || "")) && !/^(?:excel_open_|live_reset_)?[0-9a-f]{12,}/i.test(String(n || "")));
  const rowBooks = reqRows.map(r => String(r.book || ""));
  missingUnresolvedRows = unresolvedReal.filter(n => !rowBooks.includes(String(n)));
  console.log(" 미해결 실참조 행 노출:", unresolvedReal.length
    ? unresolvedReal.map(n => `${n}${missingUnresolvedRows.includes(n) ? "(누락!)" : "(OK)"}`).join(" | ")
    : "해당 없음");
}

// ── 4) 매핑 rows(자동 매칭) → 사용자 행동 재현: 유령 행 '스킬 기본값' + 미매칭 파일 행 수동 매핑 ──
// 실제 사용자는 01 요구를 업로드된 '01 도서' 파일에 매핑한다(모호해서 자동 매칭 안 됨 → 수동).
const MANUAL_FILE_MAP = {
  "01. 한전_DAS_배전자동화_청구세부내역_2026-07-12 19_00_54_DSMC_260712.xlsx":
    "01. 한전_DAS_배전자동화_청구세부내역_도서_2026-07-14 13_25_33_DSMC_260714 - 복사본 (2).xlsx",
};
let mapped = null;
try {
  sb.__manualMap = MANUAL_FILE_MAP;
  vm.runInContext(`
    (runnerBuildMappingRows() || []).forEach(row => {
      const key = row.req && row.req.key;
      if (!key) return;
      if (${JSON.stringify(PHANTOMS)}.includes(String(row.req.sheet || ""))) {
        state.runnerMappings[key] = Object.assign({}, state.runnerMappings[key] || {},
          { sheet: (typeof RUNNER_SHEET_SKILL_DEFAULT !== "undefined" && RUNNER_SHEET_SKILL_DEFAULT) || "__b2b_skill_default__" });
      }
      const wantName = __manualMap[String(row.req.book || "")];
      if (wantName && !row.fileItem) {
        const files = runnerMappingKnownFiles();
        const hit = files.find(f => f.name === wantName);
        if (hit) state.runnerMappings[key] = Object.assign({}, state.runnerMappings[key] || {},
          { fileId: hit.id, userSet: true });
      }
    });
    state.runnerMappingChecked = true;
  `, sb);
  const rows2 = vm.runInContext("runnerBuildMappingRows()", sb) || [];
  console.log("\n=== (C) 매핑 상태 ===");
  rows2.forEach(r => console.log(`  book=${r.req && r.req.book || "-"} sheet=${r.req && r.req.sheet || "-"} -> ${r.fileItem ? r.fileItem.name : "(미매칭)"} [${r.statusText}]`));
  mapped = vm.runInContext("buildRunnerMappedPipeline(state.pipeline)", sb);
} catch (e) {
  console.log("\n(매핑 단계 미지원/예외 — loadLogic 결과로 판정)", e.message.split("\n")[0]);
}

// ── 5) 실행 직전 코드(전체실행이 백엔드로 보내는 것) ──
const finalSteps = mapped || vm.runInContext("state.pipeline", sb);
const leak = handleScan(finalSteps);
console.log("\n=== (D) 실행 코드 판정 ===");
console.log(" 실행 코드 자리표 잔존:", leak.join(" ") || "없음");
// [한전 Step11 계열] v4 지원 버전이라면 옛 달 파일명이 실행 코드에 남으면 안 된다
// (표 재바인딩 or 매핑 치환으로 현재 업로드 이름이어야 함). 업로드는 전부 07-14/260710 계열.
const OLD_TOKENS = ["2026-07-07", "260707", "2026-07-12 19_00_54", "2026-07-12 19_01_11", "260712"];
let oldHits = [];
if (v4Capable && mapped) {
  finalSteps.forEach((s, i) => {
    const c = String((s && s.code) || "") + " " + String((s && s.targetFileId) || "");
    OLD_TOKENS.forEach(tok => { if (c.includes(tok)) oldHits.push(`step${i + 1}:${tok}`); });
  });
  console.log(" 실행 코드 내 옛 달 파일명:", oldHits.join(" ") || "없음");
}

const bad = leak.length > 0 || phantomRows.length > 0 || missingUnresolvedRows.length > 0 || oldHits.length > 0;
console.log("\n결론:", bad
  ? "재현됨 — 자리표/유령/옛이름/미해결누락이 살아남음(하위호환 또는 v4 매핑 결함)"
  : "정상 — 자리표·요구행·옛 이름 재바인딩 모두 문제 없음");
process.exit(bad ? 1 : 0);
