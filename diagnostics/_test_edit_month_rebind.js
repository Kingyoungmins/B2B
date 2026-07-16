// [스킬 수정 재바인딩] 클라 파일명 해석 4단계(안정키) 검증 — 2606 저장 스킬 + 2607 업로드.
// 수정 전: 3단(정확/정규화/어간) 전부 실패 → null → 현재 탭 폴백(다파일 스킬 격리실행 실패의 뿌리).
// 수정 후: 월·날짜·버전 무시 안정키 '유일' 매칭으로 2607 에 재바인딩.
// node diagnostics/_test_edit_month_rebind.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
function extractFn(name) {
  const marker = "function " + name + "(";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  // 시그니처의 기본 파라미터 `{}` 에 속지 않도록, 파라미터 괄호를 먼저 매칭해 본문 `{` 를 찾는다.
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
function extractConst(name) {
  const marker = "const " + name;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  const end = src.indexOf("];", start);
  return src.slice(start, end + 2);
}

function makeSandbox(inputNames) {
  const sb = {
    console,
    state: { inputs: inputNames.map(n => ({ name: n })), outputTemplates: [], output: null },
    workbookDisplayName: (f, fb) => (f && f.name) || fb,
    outputTemplateFileId: idx => "output:" + idx,
    getFile: id => {
      if (String(id || "").startsWith("input:")) {
        const nm = String(id).slice(6);
        return inputNames.includes(nm) ? { name: nm } : null;
      }
      return null;
    },
  };
  vm.createContext(sb);
  ["pipelineDecodeWorkbookName", "pipelineWorkbookNameKey", "pipelineKnownFiles",
   "pipelineFileIdByWorkbookName", "pipelineResolveSavedTargetFileId", "pipelineStableWorkbookKey"]
    .forEach(f => vm.runInContext(extractFn(f), sb));
  // 이름토큰 + 접미사토큰 + 날짜판정 헬퍼 — pipelineStableWorkbookKey 가 전부 참조한다.
  vm.runInContext(extractConst("PIPELINE_VOLATILE_NAME_TOKENS"), sb);
  vm.runInContext(extractConst("PIPELINE_VOLATILE_SUFFIX_TOKENS"), sb);
  ["pipelineLooksLikeHms", "pipelineLooksLikeYmd", "pipelineLooksLikeDateNumber"].forEach(f => vm.runInContext(extractFn(f), sb));
  // pipelineStableWorkbookKey 는 const 앞에 정의되어도 hoisting 으로 동작하지만, 위 순서로 재정의해 확실히.
  vm.runInContext(extractFn("pipelineStableWorkbookKey"), sb);
  return sb;
}
const resolve = (sb, name) => vm.runInContext("pipelineFileIdByWorkbookName(" + JSON.stringify(name) + ")", sb);
const resolveSaved = (sb, tid) => vm.runInContext("pipelineResolveSavedTargetFileId(" + JSON.stringify(tid) + ")", sb);

const OLD = "한국전력공사_202606_v1.1_DSMC_260710.xlsx";
const NEW = "한국전력공사_202607_v1.1_DSMC_260810.xlsx";

// (1) 핵심: 2607만 업로드 → 2606 요청이 2607 로 재바인딩
{
  const sb = makeSandbox([NEW]);
  ck("(1) 2606→2607 안정키 재바인딩", resolve(sb, OLD) === "input:" + NEW, resolve(sb, OLD));
  ck("(2) 저장 targetFileId(input:2606) 해석", resolveSaved(sb, "input:" + OLD) === "input:" + NEW, resolveSaved(sb, "input:" + OLD));
}
// (3) 정확 일치 우선(기존 동작 보존): 둘 다 있으면 요청 그대로
{
  const sb = makeSandbox([OLD, NEW]);
  ck("(3) 정확 일치 우선", resolve(sb, OLD) === "input:" + OLD);
}
// (4) 모호성 안전: 요청(2605 부재), 후보 2개 → null
{
  const sb = makeSandbox([OLD, NEW]);
  const req = "한국전력공사_202605_v1.1_DSMC_260610.xlsx";
  ck("(4) 후보 2개(모호) → null 유지", resolve(sb, req) === null, resolve(sb, req));
}
// (5) 다른 템플릿은 불일치
{
  const sb = makeSandbox([NEW]);
  ck("(5) 다른 템플릿 불일치", resolve(sb, "RCS통계월별목록_20260709172709.xls") === null);
}
// (6) 중복 다운로드 "(2)" 접미사 — 백엔드 패리티
{
  const sb = makeSandbox(["02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 10_55_33_DSMC_260714 (2).xlsx"]);
  const req = "02. 한전_AMI_유선간선망_청구세부내역_2026-07-07 09_23_01_DSMC_260707.xlsx";
  ck("(6) '(2)' 접미사 매칭(백엔드 패리티)", resolve(sb, req) === "input:02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 10_55_33_DSMC_260714 (2).xlsx", resolve(sb, req));
}
// (7) 짧은 키 가드: 휘발성 토큰뿐인 이름은 매칭 금지
{
  const sb = makeSandbox(["202607.xlsx"]);
  ck("(7) 키<4 매칭 금지", resolve(sb, "202606.xlsx") === null, resolve(sb, "202606.xlsx"));
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
