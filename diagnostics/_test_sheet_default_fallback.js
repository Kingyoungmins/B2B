// [안전판] 시트 자동 매칭 실패 시 기본 선택을 '시트 선택'(강요) 대신 '스킬 기본값(그대로 실행)'으로.
// 요구 추출이 놓친 케이스(생성 시트 감지 누락 등)가 사용자를 헤매게 하지 않게 — 치환만 생략하고 실행.
// node diagnostics/_test_sheet_default_fallback.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "drop-handling.js"), "utf8");
function extract(name) {
  const marker = "function " + name + "(";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  let i = src.indexOf("{", start), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

const sandbox = { console, Map, Set, RegExp, state: { runnerMappings: {}, runnerMappingChecked: true } };
vm.createContext(sandbox);
vm.runInContext('const RUNNER_SHEET_SKILL_DEFAULT = "__b2b_skill_default__";', sandbox);
["runnerIsSkillDefaultSheet", "runnerMappingNorm", "runnerMappingStem", "runnerMappingKey",
 "runnerMappingSheetNames", "runnerFindSheet", "runnerBuildMappingRows", "runnerGroupMappingRowsByFile",
 "runnerMappingHasBlockingMissing"].forEach(fn => vm.runInContext(extract(fn), sandbox));

// 요구/파일/자동매칭은 스텁 — 이 테스트의 관심사는 '미매칭 시트의 기본 선택'뿐이다.
sandbox.__REQS = [];
sandbox.__FILES = [];
vm.runInContext(`
  runnerExtractMappingRequirements = () => __REQS;
  runnerMappingKnownFiles = () => __FILES;
  runnerFindAutoFile = (req, files) => files.length ? { item: files[0], score: 100 } : null;
  normalizeText = s => String(s||"").trim().toLowerCase().replace(/\\s+/g, "");
`, sandbox);

const FILE = { id: "input:한전.xlsx", name: "한전.xlsx", role: "input",
  file: { name: "한전.xlsx", sheetNames: ["상품번호별", "청구계정별"], sheets: {} } };

function rows() { return vm.runInContext("runnerBuildMappingRows()", sandbox); }
function groups() { return vm.runInContext("runnerGroupMappingRowsByFile(runnerBuildMappingRows())", sandbox); }

// (1) 요구 시트가 파일에 없음(감지 누락 시나리오) → 스킬 기본값(자동) 기본 선택
sandbox.__FILES = [FILE];
sandbox.__REQS = [{ key: "k1", book: "한전.xlsx", sheet: "무선간선망", source: "target" }];
let r = rows();
ck("(1) [핵심] 미매칭 시트 → skillDefault 자동 선택", r[0].skillDefault === true && r[0].autoSkillDefault === true, r[0]);
ck("(2) 상태는 ok('스킬 기본값(자동)') — 선택 강요 없음", r[0].status === "ok" && r[0].statusText === "스킬 기본값(자동)", r[0].statusText);
let g = groups();
ck("(3) 그룹 라벨 '스킬 기본값 포함'(정확 매칭 과장 없음)", g[0].status === "ok" && g[0].statusText === "스킬 기본값 포함", g[0].statusText);
ck("(4) 실행 차단 없음", vm.runInContext("runnerMappingHasBlockingMissing()", sandbox) === false);

// (5) 요구 시트가 실제로 있으면 기존 동작(자동 매칭) 불변
sandbox.__REQS = [{ key: "k2", book: "한전.xlsx", sheet: "상품번호별", source: "target" }];
r = rows();
ck("(5) 실존 시트는 기존처럼 자동 매칭", r[0].sheet === "상품번호별" && !r[0].skillDefault, r[0]);
g = groups();
ck("(6) 그룹 '정확 매칭' 유지", g[0].statusText === "정확 매칭", g[0].statusText);

// (7) 사용자가 시트를 직접 골랐으면 그 선택 우선(자동 기본값 미개입)
sandbox.state.runnerMappings = { k1: { fileId: "input:한전.xlsx", sheet: "청구계정별", userSet: true } };
sandbox.__REQS = [{ key: "k1", book: "한전.xlsx", sheet: "무선간선망", source: "target" }];
r = rows();
ck("(7) 사용자 선택 우선", r[0].sheet === "청구계정별" && !r[0].skillDefault, r[0]);

// (8) 사용자가 명시적으로 스킬 기본값 선택 → '(자동)' 아님
sandbox.state.runnerMappings = { k1: { fileId: "input:한전.xlsx", sheet: "__b2b_skill_default__", userSet: true } };
r = rows();
ck("(8) 명시 스킬 기본값 라벨 구분", r[0].skillDefault === true && r[0].autoSkillDefault === false && r[0].statusText === "스킬 기본값", r[0].statusText);

// (9) 파일 자체가 미매칭이면 여전히 '파일 선택 필요'(안전판은 시트에만)
sandbox.state.runnerMappings = {};
sandbox.__FILES = [];
sandbox.__REQS = [{ key: "k3", book: "없는파일.xlsx", sheet: "시트", source: "target" }];
g = groups();
ck("(9) 파일 미매칭은 여전히 차단(bad)", g[0].status === "bad" && g[0].statusText === "파일 선택 필요", g[0]);

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
