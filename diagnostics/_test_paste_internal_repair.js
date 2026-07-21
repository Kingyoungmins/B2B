// [SBAGENT-209] 복붙 캡처가 저장한 '내부 작업본 이름'(excel_open_<hash>.xls) 로드 수리 검증.
// 실측: CNS메시징 23단계 스킬의 step11 paste_copied 가 src/dst 둘 다 내부명이라, 실행기
// 파일확인에 영원히 못 채우는 '파일 선택 필요' 행 2개가 떴다(모든 파일 업로드했는데도).
// node diagnostics/_test_paste_internal_repair.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

function extractFrom(file, name) {
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", file), "utf8");
  const marker = "function " + name + "(";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name + " in " + file);
  let i = src.indexOf("{", start), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

const sandbox = { console, Map, Set };
vm.createContext(sandbox);
["isInternalTempWorkbookName", "repairPasteCopiedInternalBookNames"].forEach(fn =>
  vm.runInContext(extractFrom("save-load.js", fn), sandbox));
["runnerMappingNorm", "runnerMappingKey", "runnerCleanWorkbookRequirementName",
 "runnerAddRequirement", "runnerLooksLikeA1Address", "runnerPyBookVarMap",
 "runnerAddPairedCodeRequirements"].forEach(fn =>
  vm.runInContext(extractFrom("drop-handling.js", fn), sandbox));

const run = steps => { sandbox.__s = steps; return vm.runInContext("repairPasteCopiedInternalBookNames(__s)", sandbox); };

// 내부명 판정 — 순수 해시만. 원본명이 박힌 <hash>_원본명 형태는 기존 체계로 동작하므로 제외.
const isInt = n => vm.runInContext(`isInternalTempWorkbookName(${JSON.stringify(n)})`, sandbox);
ck("(1) excel_open_<hash>.xls = 내부명", isInt("excel_open_bfbf3e127226ab1d4342a3adc927b77a49af983fda084c4533d2.xls") === true);
ck("(2) <hash>_원본명.xlsx 는 내부명 아님(기존 체계 유지)", isInt("a1b2c3d4e5f60718_원가내역.xlsx") === false);
ck("(3) 일반 파일명 아님", isInt("가입자별청구내역_260624.xlsx") === false);

// 실측 재현(SBAGENT-209): input 스텝들이 'sheet' 시트를 쓰고, paste 스텝은 output:0 대상.
const INPUT = "가입자별청구내역_20260624_3월청구_581702980619_DSMC_260624.xlsx";
const PASTE = "def transform(ctx):\n    ctx.paste_copied('sheet', 'A:K', '유플러스 요청양식_취합_26년3월', 'A1', src_book='excel_open_bfbf3e127226ab1d4342a3adc927b77a49af983fda084c4533d2.xls', dst_book='excel_open_a5df42224ca67aac3a679e08f8c233fc450d8573d3227ad202e7.xls')\n";
const mkSteps = () => [
  { targetFileId: "input:" + INPUT, targetSheetName: "sheet", code: "def transform(ctx):\n    ctx.write('A1', 1)" },
  { targetFileId: "output:0", targetSheetName: null, code: PASTE },
];

const steps = mkSteps();
const n = run(steps);
ck("(4) 수리 1단계", n === 1, n);
ck("(5) dst_book 내부명 kwarg 제거", !/dst_book/.test(steps[1].code), steps[1].code);
ck("(6) src_book → 소스시트 유일 소유 input 파일명", steps[1].code.includes("src_book='" + INPUT + "'"), steps[1].code);
ck("(7) 위치 인자 보존", steps[1].code.includes("paste_copied('sheet', 'A:K', '유플러스 요청양식_취합_26년3월', 'A1'"), steps[1].code);

// 수리 후 요구 추출: 유령 행 소멸, src 는 기존 input 요구와 같은 (book,sheet)로 정착.
sandbox.__map = new Map();
sandbox.__code = steps[1].code;
vm.runInContext("runnerAddPairedCodeRequirements(__map, __code, null)", sandbox);
const rows = Array.from(sandbox.__map.values()).map(r => [r.book, r.sheet, r.source]);
ck("(8) excel_open_ 유령 요구 없음", rows.every(r => !/excel_open_/i.test(r[0])), rows);
ck("(9) src 요구 = 원본 input 파일", rows.some(r => r[0] === INPUT && r[1] === "sheet"), rows);

// 안전 가드들
const amb = [
  { targetFileId: "input:A.xlsx", targetSheetName: "sheet", code: "x" },
  { targetFileId: "input:B.xlsx", targetSheetName: "sheet", code: "x" },
  { targetFileId: "output:0", code: PASTE },
];
run(amb);
ck("(10) 소유 모호(같은 시트 input 2개) → src 유지", /src_book='excel_open_bfbf/.test(amb[2].code), amb[2].code);
ck("(11) 모호해도 dst 는 제거(targetFileId 고정)", !/dst_book/.test(amb[2].code), amb[2].code);

const noTarget = [{ targetFileId: null, code: PASTE }];
run(noTarget);
ck("(12) targetFileId 없으면 dst 유지(현행)", /dst_book='excel_open_a5df/.test(noTarget[0].code), noTarget[0].code);

const normal = [{ targetFileId: "output:0", code: "def transform(ctx):\n    ctx.paste_copied('S', 'A:K', 'T', 'A1', src_book='월간.xlsx', dst_book='정산.xlsx')" }];
const n2 = run(normal);
ck("(13) 일반 파일명 절대 불변", n2 === 0 && /src_book='월간\.xlsx'/.test(normal[0].code) && /dst_book='정산\.xlsx'/.test(normal[0].code));

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
