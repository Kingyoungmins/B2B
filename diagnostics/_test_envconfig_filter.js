// [회귀] 환경 config 교집합 필터(0.6.2 아이디어 채용) — 저장 시점의 실제 파일·시트 정본으로
// 실행기 요구를 검증: 정본에 없는 파일명(휴리스틱 오인) 제거, 그 파일에 없던 시트는 '자동' 강등,
// config 없는 구버전 zip 은 무동작 폴백, 전멸 시 fail-open, 월 표기 차이는 안정키로 허용.
// 실행: node diagnostics/_test_envconfig_filter.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const dropSrc = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8");
const pipelineSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
const saveSrc = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8");

function extractFn(s, name) {
  const i = s.indexOf("function " + name + "(");
  if (i < 0) throw new Error(name + " 정의를 못 찾음");
  let p = s.indexOf("(", i), pd = 0, b = -1;
  for (let j = p; j < s.length; j++) {
    if (s[j] === "(") pd += 1;
    else if (s[j] === ")") { pd -= 1; if (!pd) { b = s.indexOf("{", j); break; } }
  }
  let d = 0;
  for (let j = b; j < s.length; j++) {
    if (s[j] === "{") d += 1;
    else if (s[j] === "}") { d -= 1; if (!d) return s.slice(i, j + 1); }
  }
  throw new Error(name + " 중괄호 불균형");
}

const consts = [...pipelineSrc.matchAll(/const PIPELINE_VOLATILE_\w+ = \[[\s\S]*?\n\];/g)].map(m => m[0]);
const bundle = [
  extractFn(pipelineSrc, "pipelineLooksLikeDateNumber"),
  ...consts,
  extractFn(dropSrc, "runnerMappingNorm"), extractFn(dropSrc, "runnerMappingKey"),
  extractFn(dropSrc, "runnerCleanWorkbookRequirementName"), extractFn(dropSrc, "runnerAddRequirement"),
  extractFn(pipelineSrc, "pipelineDecodeWorkbookName"), extractFn(pipelineSrc, "pipelineWorkbookNameKey"),
  extractFn(pipelineSrc, "pipelineStableWorkbookKey"),
  extractFn(dropSrc, "runnerApplyEnvConfigFilter"),
].join("\n");
const F = new Function(bundle + "\nreturn {runnerApplyEnvConfigFilter, runnerAddRequirement};")();
const filter = F.runnerApplyEnvConfigFilter, addReq = F.runnerAddRequirement;

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass += 1; console.log("PASS " + name); }
  else { fail += 1; console.log("FAIL " + name); }
}

const cfg = { inputs: [
  { name: "input_v056_청구내역.xlsx", sheetNames: ["청구내역", "단가표", "양식"] },
  { name: "input_v056_정산서.xlsx", sheetNames: ["정산"] },
], outputs: [] };

let m = new Map();
addReq(m, "input_v056_청구내역.xlsx", "청구내역", "recorded");
addReq(m, "복사 + input_v056_청구내역.xlsx", "", "code-book");
addReq(m, "J1에 붙여넣기 + input_v056_정산서.xlsx로 창 전환 후 붙여넣기 — input_v056_청구내역.xlsx", "", "code-book");
addReq(m, "input_v056_정산서.xlsx", "", "code-book");
let r = filter(m, cfg);
t("1 쓰레기 이름 제거·정상 유지(실측 16:09 형태)", r.dropped.length === 2 && m.size === 2
  && [...m.values()].every(x => /^input_v056_(청구내역|정산서)\.xlsx$/.test(x.book)));

m = new Map(); addReq(m, "input_v056_정산서.xlsx", "청구내역", "target");
r = filter(m, cfg);
t("2 (파일,시트) 오귀속 → 시트 자동 강등", r.downgraded.length === 1
  && m.size === 1 && [...m.values()][0].sheet === "");

m = new Map(); addReq(m, "아무거나.xlsx", "", "code-book");
r = filter(m, null);
t("3 config 없음(구버전 zip) → 무동작 폴백", m.size === 1 && !r.dropped.length);

m = new Map(); addReq(m, "완전다른파일.xlsx", "", "code-book");
r = filter(m, cfg);
t("4 전멸 시 fail-open(정본 캡처 누락 대비)", m.size === 1 && !r.dropped.length);

m = new Map(); addReq(m, "input_v056_청구내역_202605.xlsx", "", "code-book");
r = filter(m, { inputs: [
  { name: "input_v056_청구내역_202604.xlsx", sheetNames: ["청구내역"] },
  { name: "기타.xlsx", sheetNames: [] },
], outputs: [] });
t("5 월만 다른 이름 → 안정키 매칭 유지", m.size === 1 && !r.dropped.length);

// 6. [B-미스 방지] 표시명 편집된 파일 — 코드 리터럴(실제 name) 요구가 displayName 만 담긴
//    config 에 오폐기되지 않아야 한다(name+displayName 이중 수록·이중 매칭).
m = new Map(); addReq(m, "진짜파일명_202604.xlsx", "", "code-book");
r = filter(m, { inputs: [
  { name: "진짜파일명_202604.xlsx", displayName: "4월 정산 원본", sheetNames: ["정산"] },
  { name: "기타.xlsx", displayName: "", sheetNames: [] },
], outputs: [] });
t("6 표시명 편집 파일의 실제명 요구 유지", m.size === 1 && !r.dropped.length);
m = new Map(); addReq(m, "4월 정산 원본", "", "recorded");
r = filter(m, { inputs: [
  { name: "진짜파일명_202604.xlsx", displayName: "4월 정산 원본", sheetNames: ["정산"] },
  { name: "기타.xlsx", displayName: "", sheetNames: [] },
], outputs: [] });
t("6b 표시명 기준 요구도 유지", m.size === 1 && !r.dropped.length);

// 7. [A-미탐 역보완] 추출 전멸(동적 파일명 스킬) → 정본 파일을 폴백 요구로(단일 시트면 그 시트).
m = new Map();
r = filter(m, cfg);
t("7 추출 전멸 → config 폴백 요구 생성", r.fallbackAdded.length === 2 && m.size === 2
  && [...m.values()].some(x => x.book === "input_v056_정산서.xlsx" && x.sheet === "정산")
  && [...m.values()].some(x => x.book === "input_v056_청구내역.xlsx" && x.sheet === ""));

// 8. 부분 미탐은 uncovered 로만 보고(과요구 방지).
m = new Map(); addReq(m, "input_v056_청구내역.xlsx", "", "code-book");
r = filter(m, cfg);
t("8 부분 미탐 → uncovered 트레이스만", m.size === 1
  && r.uncovered.length === 1 && /정산서/.test(r.uncovered[0]));

// 배선: 저장 매니페스트 envConfig + 로드 스태시 + 추출 말미 필터 호출
t("9 저장 envConfig 배선(name+displayName)", /envConfig: \{/.test(saveSrc)
  && /displayName: \(typeof workbookDisplayName/.test(saveSrc));
t("10 로드 스태시 배선", /state\.skillEnvConfig = \(data && data\.envConfig/.test(saveSrc));
t("11 추출 말미 필터 호출 배선", /runnerApplyEnvConfigFilter\(map, state\.skillEnvConfig\)/.test(dropSrc)
  && /runner\.envconfig\.filter/.test(dropSrc) && /fallbackAdded/.test(dropSrc));

console.log(pass + "/" + (pass + fail) + " PASS");
process.exit(fail ? 1 : 0);
