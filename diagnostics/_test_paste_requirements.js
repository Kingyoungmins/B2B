// [매핑] paste_copied src/dst 시트 요구 추출 검증 — drop-handling.js 실제 함수 추출 구동.
// node diagnostics/_test_paste_requirements.js
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

const sandbox = { console };
vm.createContext(sandbox);
["runnerMappingNorm", "runnerMappingKey", "runnerCleanWorkbookRequirementName",
 "runnerAddRequirement", "runnerLooksLikeA1Address", "runnerAddPairedCodeRequirements"].forEach(fn =>
  vm.runInContext(extract(fn), sandbox));

function reqs(code, skips) {
  sandbox.__map = new Map();
  sandbox.__skips = skips || [];
  vm.runInContext(
    `runnerAddPairedCodeRequirements(__map, ${JSON.stringify(code)}, (b, s) => __skips.some(x => x[0] === b && x[1] === s))`,
    sandbox);
  return Array.from(sandbox.__map.values()).map(r => [r.book, r.sheet, r.source]);
}

// 실제 Step 4 원문(SBAGENT-198)
const STEP4 = `def transform(ctx):
    ctx.paste_copied('(2) LGU+', 'C38:E43', '2026년', 'C24', src_book='KB국민카드 메시지 채널 발송 현황 대사 자료26년 06월_LGU+_DSMC_260709.xlsx', dst_book='KB카드_메시지_요금정산_DSMC_260709.xlsx', values_only=True)`;

const r4 = reqs(STEP4);
ck("(1) src_book+'(2) LGU+' 요구 추출", r4.some(r => r[0].includes("KB국민카드") && r[1] === "(2) LGU+" && r[2] === "paste-src"), r4);
ck("(2) dst_book+'2026년' 요구 추출", r4.some(r => r[0] === "KB카드_메시지_요금정산_DSMC_260709.xlsx" && r[1] === "2026년" && r[2] === "paste-dst"), r4);

// 생성시트 skip 존중(대상 시트가 스킬이 만든 시트면 요구 아님)
const rSkip = reqs(STEP4, [["KB카드_메시지_요금정산_DSMC_260709.xlsx", "2026년"]]);
ck("(3) shouldSkip 존중(dst 제외)", !rSkip.some(r => r[1] === "2026년") && rSkip.some(r => r[1] === "(2) LGU+"), rSkip);

// src_book 없는 라이브 복붙(동일 파일)은 요구 미추가
ck("(4) book 인자 없으면 미추가", reqs(`ctx.paste_copied('A시트', 'B2:C3', 'D시트', 'E1')`).length === 0);

// 기존 pyDirect 쌍 비회귀
ck("(5) 기존 read 쌍 유지", reqs(`ctx.book("월간.xlsx").read("데이터", "A1:B2")`).some(r => r[0] === "월간.xlsx" && r[1] === "데이터"));

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
