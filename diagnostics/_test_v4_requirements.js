// [v4 스킬 포맷] 요구 파일/시트 선언표 + 바인딩 변수(핸들) + 러너 우선/폴백 회귀 테스트.
//  (A) computeSkillRequirements: pristine ∩ 사용 교집합, 생성 시트 배제, 코드 리터럴 시트 귀속(보완),
//      unresolvedRefs(excel_open_* 유령) 분리
//  (B) 핸들 왕복: 저장 핸들화(@@FILE_n@@) ↔ 로드 복원(runnerReplaceLiteral 기반)
//  (C) 러너: v4 표 우선(생성 시트 자연 배제) / 서명 불일치 시 추론 폴백 + 유령 제거
// node diagnostics/_test_v4_requirements.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const ROOT = path.join(__dirname, "..");
const saveSrc = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8");
const dropSrc = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8");

function extract(src, name) {
  const mk = "function " + name + "(";
  const st = src.indexOf(mk);
  if (st < 0) throw new Error("not found: " + name);
  let i = src.indexOf("{", st), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === "{") d++; else if (src[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(st, e);
}

const sb = { console, Map, Set, JSON, Array, String,
  normalizeText: s => String(s || "").trim().toLowerCase().replace(/\s+/g, ""),
  state: {} };
vm.createContext(sb);
["runnerMappingNorm", "runnerMappingStem", "runnerMappingKey", "runnerCleanWorkbookRequirementName",
 "runnerAddRequirement", "runnerLooksLikeA1Address", "runnerAddGeneratedSheet", "runnerIsGeneratedSheet",
 "runnerPyBookVarMap", "runnerSplitTopLevelArgs", "runnerSliceCallArgs",
 "runnerExtractGeneratedSheetsFromCode", "runnerSheetOwnersFromCode",
 "runnerAddPairedCodeRequirements", "runnerExtractMappingRequirements", "runnerReplaceLiteral",
 "runnerHandleForName"].forEach(f => vm.runInContext(extract(dropSrc, f), sb));
["computeSkillRequirements", "loadedSkillReqSignature"].forEach(f => vm.runInContext(extract(saveSrc, f), sb));
const pipeSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
vm.runInContext(extract(pipeSrc, "pipelineCollectWorkbookNames"), sb);
// 파일명→fileId 해석 스텁(pristine 이름 기준)
vm.runInContext(`pipelineFileIdByWorkbookName = name => {
  const n = normalizeText(name);
  for (const f of (state.inputsOriginal || [])) if (normalizeText(f.name) === n) return "input:" + f.name;
  (state.outputTemplates || []).forEach(() => {});
  for (let i = 0; i < (state.outputTemplates || []).length; i++) {
    const o = state.outputTemplates[i].original || state.outputTemplates[i];
    if (normalizeText(o.name) === n) return "output:" + i;
  }
  return null;
};`, sb);

// ── (A) 선언표 계산 ──
sb.state = {
  inputsOriginal: [
    { name: "정산.xlsx", sheetNames: ["상품번호별", "청구계정별"] },
    { name: "세부내역.xlsx", sheetNames: ["Sheet1"] },
    { name: "안쓰는파일.xlsx", sheetNames: ["A"] },
  ],
  outputTemplates: [{ original: { name: "출력.xlsx", sheetNames: ["취합"] } }],
  pipeline: [
    { id: "s1", targetFileId: "input:정산.xlsx", targetSheetName: "상품번호별",
      code: 'def transform(ctx):\n    ctx.filter_to_sheet("상품번호별", lambda r: f(r, "512"), "무선간선망")' },
    { id: "s2", targetFileId: "input:정산.xlsx", targetSheetName: "무선간선망",
      code: 'def transform(ctx):\n    ctx.write("A1", 1)' },
    { id: "s3", targetFileId: "input:세부내역.xlsx", targetSheetName: null,
      code: 'def transform(ctx):\n    b = ctx.book("세부내역.xlsx")\n    b.read("Sheet1", "A1")\n    x = ctx.book("excel_open_abcdef1234567890abcdef1234567890.xls")\n    x.read("sheet", "A1")' },
    { id: "s4", targetFileId: "output:0", targetSheetName: "취합",
      code: 'def transform(ctx):\n    ctx.write("A1", 2)' },
  ],
};
const req = vm.runInContext("computeSkillRequirements()", sb);
const byName = Object.fromEntries(req.requiredFiles.map(r => [r.name, r]));
ck("(A1) 사용 파일 3종만 요구(안쓰는파일 제외)",
   req.requiredFiles.length === 3 && !byName["안쓰는파일.xlsx"], req.requiredFiles.map(r => r.name));
ck("(A2) 생성 시트(무선간선망)는 requiredSheets 에서 배제",
   !(byName["정산.xlsx"].requiredSheets || []).includes("무선간선망"), byName["정산.xlsx"]);
ck("(A3) 생성 시트는 generatedSheets 로 분리",
   req.generatedSheets.some(g => g.sheet === "무선간선망"), req.generatedSheets);
ck("(A4) [보완] 코드 리터럴 시트(Sheet1) 귀속",
   (byName["세부내역.xlsx"].requiredSheets || []).includes("Sheet1"), byName["세부내역.xlsx"]);
ck("(A5) 유령(excel_open_*)은 unresolvedRefs 로",
   req.unresolvedRefs.some(u => /excel_open_/i.test(u)), req.unresolvedRefs);
ck("(A6) 출력 템플릿 요구(취합)",
   (byName["출력.xlsx"].requiredSheets || []).includes("취합"), byName["출력.xlsx"]);

// ── (B) 핸들 왕복 ──
{
  const rfs = req.requiredFiles.map((r, i) => ({ ...r, handle: "@@FILE_" + (i + 1) + "@@" }));
  const code0 = 'ctx.book("세부내역.xlsx").read("Sheet1", "A1")';
  sb.__c = code0; sb.__from = "세부내역.xlsx"; sb.__to = rfs.find(r => r.name === "세부내역.xlsx").handle;
  const saved = vm.runInContext("runnerReplaceLiteral(__c, __from, __to)", sb);
  ck("(B1) 저장 핸들화", saved.includes("@@FILE_") && !saved.includes("세부내역.xlsx"), saved);
  sb.__c = saved; sb.__from = sb.__to; sb.__to = "세부내역_202607.xlsx";
  const restored = vm.runInContext("runnerReplaceLiteral(__c, __from, __to)", sb);
  ck("(B2) 실행 시 핸들→실제 파일 복원", restored.includes("세부내역_202607.xlsx") && !restored.includes("@@FILE_"), restored);
  // runnerHandleForName: v4 표에서 origName → handle
  sb.state.loadedSkillRequirements = { requiredFiles: rfs };
  const h = vm.runInContext('runnerHandleForName("세부내역.xlsx")', sb);
  ck("(B3) runnerHandleForName 핸들 조회", /^@@FILE_\d+@@$/.test(h), h);
  sb.state.loadedSkillRequirements = null;
}

// ── (C) 러너 v4 우선/폴백 ──
{
  const sig = vm.runInContext("loadedSkillReqSignature(state.pipeline)", sb);
  sb.state.loadedSkillRequirements = {
    requiredFiles: req.requiredFiles,
    generatedSheets: req.generatedSheets,
    unresolvedRefs: req.unresolvedRefs,
  };
  sb.state.loadedSkillReqPipelineSig = sig;
  const v4rows = vm.runInContext("runnerExtractMappingRequirements()", sb).map(r => [r.book, r.sheet, r.source]);
  ck("(C1) v4 표 우선 사용(source=v4)", v4rows.length && v4rows.every(r => r[2] === "v4"), v4rows);
  ck("(C2) v4 경로에 생성 시트 요구 없음", !v4rows.some(r => r[1] === "무선간선망"), v4rows);
  ck("(C3) v4 경로에 유령 요구 없음", !v4rows.some(r => /excel_open_/i.test(r[0])), v4rows);
  // 편집(서명 불일치) → 추론 폴백 + 유령 제거
  sb.state.pipeline[0].code += "\n# edited";
  const fbRows = vm.runInContext("runnerExtractMappingRequirements()", sb).map(r => [r.book, r.sheet, r.source]);
  ck("(C4) 서명 불일치 → 추론 폴백(source≠v4)", fbRows.length && fbRows.every(r => r[2] !== "v4"), fbRows);
  ck("(C5) 폴백에서도 unresolvedRefs 유령 제거", !fbRows.some(r => /excel_open_/i.test(r[0])), fbRows);
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
