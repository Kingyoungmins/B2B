// [스킬 기본값] 시트 드롭다운의 '스킬 기본값(그대로 실행)' 옵션 검증.
// 매핑은 스킬 코드의 시트 리터럴을 실제 시트명으로 바꿔치기하는데(runnerReplaceLiteral), 그 판단이
// 틀리면 원래 잘 돌던 스킬이 깨진다(SBAGENT-198 계열). 이 옵션은 치환을 꺼서 스킬에 일임하는 탈출구다.
// node diagnostics/_test_skill_default_sheet.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "drop-handling.js"), "utf8");
function extract(name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("not found: " + name);
  let p = src.indexOf("(", start), pd = 0;
  for (; p < src.length; p++) {
    if (src[p] === "(") pd++;
    else if (src[p] === ")") { pd--; if (pd === 0) break; }
  }
  let i = src.indexOf("{", p), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}
const sb = { console };
vm.createContext(sb);
const constLine = /const RUNNER_SHEET_SKILL_DEFAULT = "[^"]+";/.exec(src);
if (!constLine) throw new Error("RUNNER_SHEET_SKILL_DEFAULT 상수를 찾지 못함");
vm.runInContext(constLine[0], sb);
["runnerIsSkillDefaultSheet", "runnerReplaceLiteral"].forEach(f => vm.runInContext(extract(f), sb));
const SENT = vm.runInContext("RUNNER_SHEET_SKILL_DEFAULT", sb);
const isSD = v => vm.runInContext("runnerIsSkillDefaultSheet(" + JSON.stringify(v) + ")", sb);

// (1) 센티넬 판정
ck("(1) 센티넬을 스킬 기본값으로 인식", isSD(SENT) === true);
ck("(2) 실제 시트명은 스킬 기본값 아님", isSD("콜센터") === false);
ck("(3) 빈 값은 스킬 기본값 아님(= 자동/미선택)", isSD("") === false);
// 센티넬이 실제 시트명과 충돌할 여지가 없어야 한다(Excel 시트명에 못 쓰는 형태여야 안전)
ck("(4) 센티넬이 평범한 시트명과 겹치지 않음", /^__b2b_/.test(SENT), SENT);

// (5) 렌더러가 옵션을 실제로 그리는가 + 선택 상태를 반영하는가
ck("(5) 드롭다운에 '스킬 기본값' 옵션 존재", src.includes("스킬 기본값(그대로 실행)"));
ck("(6) 선택 상태(m.skillDefault)로 selected 표시", /m\.skillDefault \? "selected" : ""/.test(src));

// (7) 핵심: 치환이 일어나지 않아야 한다.
//     buildRunnerMappedPipeline 은 `if (row.req.sheet && row.sheet)` 일 때만 시트를 치환하므로,
//     스킬 기본값이면 row.sheet 가 "" 여서 원본이 그대로 남는다.
{
  const code = 'tgt_ctx.read("sheet", "B3:B345")';
  const withSheet = vm.runInContext("runnerReplaceLiteral(" + JSON.stringify(code) + ', "sheet", "콜센터")', sb);
  ck("(7) 시트 지정 시엔 치환됨(대조군)", withSheet === 'tgt_ctx.read("콜센터", "B3:B345")', withSheet);
  ck("(8) 스킬 기본값이면 row.sheet 가 비어 치환 조건이 거짓",
     src.includes("if (row.req.sheet && row.sheet) code = runnerReplaceLiteral"));
}
// (9) 파일명 치환은 스킬 기본값에서도 유지돼야 한다 — 안 하면 옛 파일명이 남아 워크북을 못 찾는다.
ck("(9) 파일명 치환은 조건 없이 유지", src.includes("if (row.req.book && actualName) code = runnerReplaceLiteral"));
// (10) 실행 차단(status 'bad')에 걸리지 않아야 한다 — 막히면 탈출구 의미가 없다.
ck("(10) 스킬 기본값은 상태 ok(실행 차단 안 됨)", /skillDefault\)\s*\{\s*status = "ok"/.test(src.replace(/\s+/g, " ").replace(/ \{/g, "{")) || src.includes('statusText = "스킬 기본값"'));

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
