// [실행기 자동매핑] runnerFindAutoFile 의 '조용한 오매핑' 검증.
// 최악 실패는 '잘못된 파일에 실행'이다. 4단계(안정키)가 모호해서 null 을 주면 fuzzy 폴백이
// 동점 1위(업로드 순서상 첫 파일)를 조용히 골라 지난달 파일에 실행되던 문제를 잡는다.
// node diagnostics/_test_runner_automap.js
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

// files: [{id, file:{name, sheetNames}}]
function makeSandbox(names, resolveFid) {
  const files = names.map(n => ({ id: "input:" + n, file: { name: n, sheetNames: ["Sheet1"] } }));
  const sb = {
    console,
    // 4단계 해석 스텁 — 실제 pipelineFileIdByWorkbookName 의 계약(모호하면 null)을 모사.
    pipelineFileIdByWorkbookName: req => (typeof resolveFid === "function" ? resolveFid(req, files) : null),
    pipelineWorkbookNameKey: n => String(n || "").trim().toLowerCase().replace(/\s+/g, ""),
    workbookDisplayName: (f, fb) => (f && f.name) || fb,
    runnerMappingSheetNames: f => (f && f.sheetNames) || [],
    runnerMappingNorm: s => String(s || "").trim().toLowerCase(),
    // 토큰 겹침 비율 기반 점수(실제 구현과 같은 축: 이름이 비슷할수록 높음)
    runnerMappingScoreFile: (book, item) => {
      const tok = s => String(s || "").toLowerCase().split(/[^0-9a-z가-힣]+/).filter(Boolean);
      const a = tok(book), b = tok(item.file.name);
      if (!a.length) return 0;
      const hit = a.filter(t => b.includes(t)).length;
      return Math.round((hit / a.length) * 70);
    },
  };
  vm.createContext(sb);
  vm.runInContext(extract("runnerFindAutoFile"), sb);
  sb.__files = files;
  return sb;
}
const find = (sb, req) => vm.runInContext("runnerFindAutoFile(" + JSON.stringify(req) + ", __files)", sb);

const JUN = "한전_AMI_청구세부내역_202606.xlsx";
const MAY = "한전_AMI_청구세부내역_202605.xlsx";
const JUL = "한전_AMI_청구세부내역_202607.xlsx";

// (1) [회귀·핵심] 4단계가 모호(null)일 때 fuzzy 동점을 조용히 고르면 안 된다.
//     지난달(먼저 업로드)과 이번달이 같이 있으면 둘 다 같은 점수 → 사용자 선택으로 넘겨야 한다.
{
  const sb = makeSandbox([MAY, JUL], () => null);   // 모호 → null (4단계 계약)
  const r = find(sb, { book: JUN, sheet: "" });
  ck("(1) 동점 후보 2개 → 자동 선택 안 함(null)", r === null, r && r.item.id);
}
// (2) 후보가 하나뿐이면(모호하지 않음) 기존대로 fuzzy 자동 매칭이 동작해야 한다(과도한 차단 방지).
{
  const sb = makeSandbox([JUL], () => null);
  const r = find(sb, { book: JUN, sheet: "" });
  ck("(2) 단일 후보는 자동 매칭 유지", !!r && r.item.id === "input:" + JUL, r && r.item.id);
}
// (3) [회귀] 안정키 재바인딩(4단계)은 '정확 매칭'과 구분돼야 한다 —
//     95 미만이라야 UI 가 '확인 필요'로 띄워 사용자 검토 게이트가 살아난다.
{
  const sb = makeSandbox([JUL], (req, files) => files[0].id);  // 4단계가 다른 달 파일로 해석
  const r = find(sb, { book: JUN, sheet: "" });
  ck("(3) 재바인딩은 100 아님(<95) + rebound 표시", !!r && r.score < 95 && r.rebound === true, r);
}
// (4) 이름이 실제로 같으면 정확 매칭 100 유지(기존 동작 보존).
{
  const sb = makeSandbox([JUN], (req, files) => files[0].id);
  const r = find(sb, { book: JUN, sheet: "" });
  ck("(4) 진짜 정확 일치는 100 유지", !!r && r.score === 100 && !r.rebound, r);
}
// (5) 점수차가 뚜렷하면(모호 아님) 1위를 고른다.
{
  const sb = makeSandbox(["전혀다른_파일.xlsx", JUL], () => null);
  const r = find(sb, { book: JUN, sheet: "" });
  ck("(5) 점수차 뚜렷하면 1위 선택", !!r && r.item.id === "input:" + JUL, r && r.item.id);
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
