// [실물 회귀] 고객 재현 스킬(test_data/issue_repro/*.logic.json)로 매핑·대상 추론을 검증.
//  SBAGENT-26/171: 교차파일 dict-매칭 덮어쓰기 스킬 — 두 파일 요구 + VBA 쓰기 대상 추론
//  SBAGENT-160: 네이버클라우드 시트명 매칭 lookup — For Each wb 관용구 대상/소스 인식
// node diagnostics/_test_issue_real_artifacts.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const ROOT = path.join(__dirname, "..");
const dropSrc = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8");
const pipeSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

function extract(src, name) {
  const mk = "function " + name + "(";
  let st = src.indexOf(mk);
  if (st < 0) throw new Error("not found: " + name);
  let p = src.indexOf("(", st), pd = 0;
  for (; p < src.length; p++) { if (src[p] === "(") pd++; else if (src[p] === ")") { pd--; if (pd === 0) break; } }
  let i = src.indexOf("{", p), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === "{") d++; else if (src[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(st, e);
}

const sb = { console, Map, Set, state: { pipeline: [] },
  normalizeText: s => String(s || "").trim().toLowerCase().replace(/\s+/g, "") };
vm.createContext(sb);
["runnerMappingNorm", "runnerMappingStem", "runnerMappingKey", "runnerCleanWorkbookRequirementName",
 "runnerAddRequirement", "runnerLooksLikeA1Address", "runnerAddGeneratedSheet", "runnerIsGeneratedSheet",
 "runnerPyBookVarMap", "runnerSplitTopLevelArgs", "runnerSliceCallArgs",
 "runnerExtractGeneratedSheetsFromCode", "runnerSheetOwnersFromCode",
 "runnerAddPairedCodeRequirements", "runnerExtractMappingRequirements"].forEach(f =>
  vm.runInContext(extract(dropSrc, f), sb));
// pipeline.js 의 이름 수집/대상 추론 계열 일괄 로드(의존 누락 방지)
[...pipeSrc.matchAll(/^function ((?:pipeline)\w*)\s*\(/gm)].map(m => m[1]).forEach(f => {
  try { vm.runInContext(extract(pipeSrc, f), sb); } catch (_) {}
});

function loadRepro(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "test_data", "issue_repro", name), "utf8"));
}
function reqsOf(pipeline) {
  sb.state.pipeline = pipeline;
  return vm.runInContext("runnerExtractMappingRequirements()", sb).map(r => [r.book, r.sheet, r.source]);
}
function vbaTargets(code) {
  sb.__c = code;
  return vm.runInContext("pipelineVbaTargetWorkbookNames(__c)", sb);
}

// ── SBAGENT-26/171: 교차파일 덮어쓰기(엎어씌우기 문제.zip) ──
{
  const j = loadRepro("sbagent026_overwrite.logic.json");
  const reqs = reqsOf(j.pipeline);
  const ROWDATA = "531611708899생명 로우데이터_DSMC_260616.xlsx";
  const LGU = "LGU 농협생명보험_2026_4월_청구내역 콜센터_최종_DSMC_260617.xlsx";
  ck("(26-1) 두 파일 모두 요구로 인식", reqs.some(r => r[0] === ROWDATA) && reqs.some(r => r[0] === LGU), reqs);
  ck("(26-2) A1 주소가 시트 요구로 새지 않음", reqs.every(r => !/^\$?[A-Z]{1,3}\$?\d/.test(r[1])), reqs);
  const t2 = vbaTargets(j.pipeline[1].code);
  ck("(26-3) step2 VBA 대상 = 로우데이터(쓰기 대상)", t2.length === 1 && t2[0] === ROWDATA, t2);
  const t3 = vbaTargets(j.pipeline[2].code);
  ck("(26-4) step3 VBA 대상 추론 유일(For Each 관용구)", t3.length === 1, t3);
}

// ── SBAGENT-171(예원): 생명 로우데이터 + LGU 멤버십 매칭 ──
{
  const j = loadRepro("sbagent171_yewon.logic.json");
  const reqs = reqsOf(j.pipeline);
  ck("(171-1) 요구 추출이 예외 없이 동작", Array.isArray(reqs) && reqs.length >= 1, reqs);
  ck("(171-2) 요구 파일명에 내부 임시명 없음", reqs.every(r => !/excel_open_|live_reset_/i.test(r[0])), reqs);
  ck("(171-3) A1 주소 시트 요구 없음", reqs.every(r => !/^\$?[A-Z]{1,3}\$?\d+$/.test(r[1])), reqs);
}

// ── SBAGENT-160: 네이버클라우드 시트명 매칭 lookup ──
{
  const j = loadRepro("sbagent160_naver_lookup.logic.json");
  const reqs = reqsOf(j.pipeline);
  const DST = "작업중_트래픽_청구내역서_LG유플러스_2026년_05월_청구_통합시트명변경_DSMC_260626.xlsx";
  const SRC = "네이버클라우드_5월 트래픽.xlsx";
  ck("(160-1) 대상 파일+시트(통합(국내)) 요구", reqs.some(r => r[0] === DST && r[1] === "통합(국내)"), reqs);
  ck("(160-2) 소스 파일(네이버클라우드) 요구 포함", reqs.some(r => r[0] === SRC), reqs);
  const t = vbaTargets(j.pipeline[1].code).filter(x => /\.xls[xmb]?$/i.test(x));  // 시트명 후보는 하류에서 걸러짐
  ck("(160-3) For Each 관용구에서 파일형 대상 추론 = 청구내역서 유일(소스 아님)", t.length === 1 && t[0] === DST, t);
}

// ── SBAGENT-207: 한전 서울 25단계 — 생성시트/오귀속 유령 요구 없음(인천본부 수정 수혜) ──
{
  const j = loadRepro("sbagent207_hanjeon_seoul.logic.json");
  const reqs = reqsOf(j.pipeline);
  const HJ = "한국전력공사_202606_v1.1_DSMC_260710.xlsx";
  ck("(207-1) 한국전력공사 요구 = 상품번호별+청구계정별만",
     reqs.filter(r => r[0] === HJ).map(r => r[1]).sort().join(",") === "상품번호별,청구계정별",
     reqs.filter(r => r[0] === HJ));
  ck("(207-2) 생성 시트(무선간선망/고압모계기/고압자계기) 유령 요구 없음",
     !reqs.some(r => ["무선간선망", "고압모계기", "고압자계기"].includes(r[1])), reqs);
  ck("(207-3) 세부내역 3파일 Sheet1 요구", reqs.filter(r => r[1] === "Sheet1").length === 3, reqs);
}

// ── SBAGENT-198: KB국민카드 14단계 — 캡처 요구가 사용자 원본명·실시트로 ──
{
  const j = loadRepro("sbagent198_kb.logic.json");
  const reqs = reqsOf(j.pipeline);
  ck("(198-1) 캡처 소스 시트((2) LGU+) 요구", reqs.some(r => r[0].includes("KB국민카드") && r[1] === "(2) LGU+"), reqs);
  ck("(198-2) 캡처 대상 시트(2026년) 요구", reqs.some(r => r[0].includes("KB카드_메시지_요금정산") && r[1] === "2026년"), reqs);
  ck("(198-3) 위장 .xls 파일 2건 파일 요구", reqs.filter(r => /\.xls$/i.test(r[0])).length === 2, reqs);
  ck("(198-4) 내부 임시명 없음", reqs.every(r => !/excel_open_/i.test(r[0])), reqs);
}

// ── SBAGENT-221/208: UCAP 03.3 — 괄호+공백 파일명 요구가 '전체 이름'으로(잘림 수정 실증) ──
{
  const j = loadRepro("sbagent221_ucap33.logic.json");
  const reqs = reqsOf(j.pipeline);
  ck("(221-1) input) 전체 이름 요구(산문 접두사 잘림 없음)",
     reqs.some(r => r[0] === "input)_기업DW추출_131 통화상세내역(마스킹)_2026-03-13 10_02_56_DSMC_260713.xlsx" && r[1] === "VIEW"), reqs);
  ck("(221-2) output) 요구(할인후합계)", reqs.some(r => r[0].startsWith("output)_LG_CNS") && r[1] === "할인후합계"), reqs);
  ck("(221-3) 꼬리만 남은 잘린 이름 없음", reqs.every(r => !/^10_02_56/.test(r[0])), reqs);
}

// ── SBAGENT-170: KGM 제경비 33단계 — 다중 교차파일 요구 정확 ──
{
  const j = loadRepro("sbagent170_kgm.logic.json");
  const reqs = reqsOf(j.pipeline);
  ck("(170-1) 5개 파일 요구", new Set(reqs.map(r => r[0])).size === 5, reqs);
  ck("(170-2) CCU 목록 시트 소유 정확", reqs.some(r => r[0].startsWith("교체된 CCU 목록") && r[1] === "교체된 CCU 목록"), reqs);
  ck("(170-3) 원본_DSMC 시트 요구", reqs.some(r => r[0] === "원본_DSMC_260624.xlsx" && r[1].startsWith("202605")), reqs);
}

// ── SBAGENT-186(=209 원본 스킬): 수리 전 내부명 존재 → 로드 수리 후 소멸(전체 체인) ──
{
  const saveSrc = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8");
  ["isInternalTempWorkbookName", "repairPasteCopiedInternalBookNames"].forEach(f =>
    vm.runInContext(extract(saveSrc, f), sb));
  const j = loadRepro("sbagent186_cns23.logic.json");
  const before = reqsOf(j.pipeline);
  ck("(186-1) 수리 전: 내부 임시명 요구 존재(원시 상태 확인)", before.some(r => /excel_open_/i.test(r[0])), before.length);
  sb.__steps = j.pipeline;
  const repaired = vm.runInContext("repairPasteCopiedInternalBookNames(__steps)", sb);
  const after = reqsOf(j.pipeline);
  ck("(186-2) 로드 수리 1단계 수행", repaired === 1, repaired);
  ck("(186-3) 수리 후: 내부 임시명 요구 소멸", after.every(r => !/excel_open_/i.test(r[0])), after);
  ck("(186-4) 가입자별 5파일 요구 유지", new Set(after.filter(r => r[0].startsWith("가입자별")).map(r => r[0])).size === 5, after);
  ck("(186-5) output) 취합 시트 요구 유지", after.some(r => r[0].startsWith("output)") && r[1].includes("유플러스")), after);
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
