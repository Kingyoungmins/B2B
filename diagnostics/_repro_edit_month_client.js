// [재현] 다른 달 파일(2607)만 업로드된 상태에서, 2606 파일로 저장된 스킬의
// targetFileId/워크북명 해석이 클라이언트 계층에서 어떻게 실패하는지 실측.
// 실제 소스(pipeline.js / excel-viewer.js / drop-handling.js / fuzzy.js)에서
// 함수를 브레이스 매칭으로 추출해 vm 에서 '진짜 코드'를 실행한다(_test_cross_reset.js 기법).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => {
  console.log((c ? " OK  " : "FAIL ") + n + "  got=" + JSON.stringify(g));
  if (!c) fails++;
};

const SCRIPTS = path.join(__dirname, "..", "scripts");
// drop-handling.js 는 U+0000 널문자 포함 → 제거 후 파싱
const read = f => fs.readFileSync(path.join(SCRIPTS, f), "utf8").replace(/\u0000/g, "");
const pipelineSrc = read("pipeline.js");
const viewerSrc = read("excel-viewer.js");
const dropSrc = read("drop-handling.js");
const fuzzySrc = read("fuzzy.js");

function extract(src, name) {
  const marker = "function " + name + "(";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  // 파라미터 기본값에 {} 가 올 수 있으니(예: options = {}) 먼저 파라미터 괄호를 넘긴다
  let i = start + marker.length - 1, pdepth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "(") pdepth++;
    else if (src[i] === ")") { pdepth--; if (pdepth === 0) { i++; break; } }
  }
  let depth = 0, end = -1;
  i = src.indexOf("{", i);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error("brace match failed: " + name);
  return src.slice(start, end);
}

// ---- 시나리오 상수 ----
const SAVED = "한국전력공사_202606_v1.1_DSMC_260710.xlsx"; // 스킬이 만들어진(저장된) 파일 — 지금은 없음
const UPLOADED = "한국전력공사_202607_v1.1_DSMC_260810.xlsx"; // 지금 업로드된 유일한 파일

const sandbox = {
  console,
  // 실제 state 모양 최소 재현: 2607 입력 1개만 존재(2606 없음)
  state: {
    inputs: [{ name: UPLOADED, sheetNames: ["청구내역", "요약"], sheets: {} }],
    inputsOriginal: [],
    outputTemplates: [],
    output: null,
    currentFileId: "input:" + UPLOADED,
    currentSheet: "청구내역",
    pipeline: [],
  },
  outputTemplateFileId: idx => "output:" + idx,           // output-template.js 동작 동일(출력 없음 → 미사용)
  outputTemplateIndexFromFileId: fid => Number(String(fid).slice(7)) || 0,
};
vm.createContext(sandbox);

// 실제 소스에서 추출 — 스텁이 아니라 원본 함수 본문 그대로
const fromPipeline = [
  "pipelineDecodeWorkbookName",   // pipeline.js:332
  "pipelineWorkbookNameKey",      // pipeline.js:346
  "pipelineKnownFiles",           // pipeline.js:356
  "pipelineFileIdByWorkbookName", // pipeline.js:383
  "pipelineFileIdsBySheetName",   // pipeline.js:407
  "pipelineResolveSavedTargetFileId", // pipeline.js:427
  "pipelineCollectWorkbookNames", // pipeline.js:435
  "pipelineVbaTargetWorkbookNames",
  "pipelinePythonSourceWorkbookNames",
  "pipelinePythonTargetWorkbookNames",
  "pipelineConstStringVars",
  "pipelineResolvePyArg",
  "pipelineTargetSheetNames",
  "pipelinePythonBookVarNames",
  "pipelinePythonMutatedBookNames",
  "pipelineStepMutatesMainCtx",
  "inferPipelineStepLanguage",
  "inferPipelineStepTargetFileId", // pipeline.js:623
];
fromPipeline.forEach(fn => vm.runInContext(extract(pipelineSrc, fn), sandbox));
// const 라인 추출(함수 아님): PIPELINE_CTX_READER_METHODS
const ctxReaderConst = /const PIPELINE_CTX_READER_METHODS = new Set\(\[[^\]]*\]\);/.exec(pipelineSrc);
if (!ctxReaderConst) throw new Error("PIPELINE_CTX_READER_METHODS not found");
vm.runInContext(ctxReaderConst[0], sandbox);
// 실제 getFile(excel-viewer.js:129) / workbookDisplayName(drop-handling.js:87) / normalizeText(fuzzy.js:15,_normalize:11)
vm.runInContext(extract(viewerSrc, "getFile"), sandbox);
vm.runInContext(extract(dropSrc, "workbookDisplayName"), sandbox);
vm.runInContext(extract(fuzzySrc, "_normalize"), sandbox);
vm.runInContext(extract(fuzzySrc, "normalizeText"), sandbox);

console.log("=== 재현: 2606 스킬 vs 2607 업로드(2606 부재) — 클라이언트 이름 해석 계층 ===\n");

// (1) 핵심: 저장된 워크북명(2606) → fileId 해석이 null 인가
const byName = vm.runInContext("pipelineFileIdByWorkbookName(" + JSON.stringify(SAVED) + ")", sandbox);
ck("(1) pipelineFileIdByWorkbookName('" + SAVED + "') === null (월이 달라 exact/normalized/stem 모두 불일치)",
  byName === null, byName);

// (2) 핵심: 저장된 targetFileId('input:2606…') 해석이 null 인가
const savedTid = "input:" + SAVED;
const resolved = vm.runInContext("pipelineResolveSavedTargetFileId(" + JSON.stringify(savedTid) + ")", sandbox);
ck("(2) pipelineResolveSavedTargetFileId('" + savedTid + "') === null (getFile 불일치 + 이름 재해석도 실패)",
  resolved === null, resolved);

// (2b) getFile 단독으로도 죽는지(“살아있는 targetFileId” 판정 실패 확인)
const gf = vm.runInContext("getFile(" + JSON.stringify(savedTid) + ") || null", sandbox);
ck("(2b) getFile('input:2606…') → 파일 없음", !gf, gf);

// (3) 대조군: '정확히 같은 이름'(2607)은 매칭되는가 — 스텁/추출이 멀쩡하다는 검증
const control = vm.runInContext("pipelineFileIdByWorkbookName(" + JSON.stringify(UPLOADED) + ")", sandbox);
ck("(3) [대조군] 같은 이름(2607)은 'input:2607…' 로 매칭", control === "input:" + UPLOADED, control);
const controlTid = vm.runInContext("pipelineResolveSavedTargetFileId(" + JSON.stringify("input:" + UPLOADED) + ")", sandbox);
ck("(3b) [대조군] pipelineResolveSavedTargetFileId('input:2607…') 매칭", controlTid === "input:" + UPLOADED, controlTid);

// (4) 정규화 키 비교 실측 — 왜 안 맞는지(월 202606 vs 202607, 날짜 260710 vs 260810 리터럴 차이)
const keySaved = vm.runInContext("pipelineWorkbookNameKey(" + JSON.stringify(SAVED) + ", {stem:true})", sandbox);
const keyUp = vm.runInContext("pipelineWorkbookNameKey(" + JSON.stringify(UPLOADED) + ", {stem:true})", sandbox);
console.log("      stem key(2606) = " + JSON.stringify(keySaved));
console.log("      stem key(2607) = " + JSON.stringify(keyUp));
ck("(4) stem 키조차 불일치(현행 키에 월·날짜 무시 규칙 없음)", keySaved !== keyUp, { keySaved, keyUp });

// (5) 실제 스텝 시뮬: Python 스텝(ctx.book('2606…') 리터럴 + targetFileId='input:2606…')
//     → inferPipelineStepTargetFileId 가 null → pipelinePinnedTargetFileId 도 null 로 이어짐
const pyStep = {
  id: "s1",
  language: "python",
  targetFileId: savedTid,
  code: 'def transform(ctx):\n    wb = ctx.book("' + SAVED + '")\n    wb.write("청구내역", 2, 1, [[1]])\n',
};
const pyInferred = vm.runInContext("inferPipelineStepTargetFileId(" + JSON.stringify(pyStep) + ")", sandbox);
ck("(5) Python 스텝(ctx.book 2606 리터럴) inferPipelineStepTargetFileId === null", pyInferred === null, pyInferred);

// (6) VBA 스텝 시뮬: Workbooks("2606…") 리터럴 — 워크북명 해석은 실패하고,
//     마지막 폴백(시트명 단일 매칭)이 2607 파일로 '조용히' 넘어가는지도 실측
const vbaStep = {
  id: "s2",
  language: "vba",
  targetFileId: savedTid,
  code: 'Sub Step1()\n  Dim wbOut As Workbook\n  Set wbOut = Workbooks("' + SAVED + '")\n  wbOut.Worksheets("청구내역").Range("A1").Value = 1\nEnd Sub',
};
const vbaInferred = vm.runInContext("inferPipelineStepTargetFileId(" + JSON.stringify(vbaStep) + ")", sandbox);
console.log("      VBA 스텝 inferPipelineStepTargetFileId → " + JSON.stringify(vbaInferred) +
  "  (시트명 '청구내역' 단일 매칭 폴백이 2607 을 잡으면 non-null — 단, 코드 리터럴은 여전히 2606)");
// 시트명이 겹치지 않으면 완전 null:
const vbaStep2 = { ...vbaStep, code: vbaStep.code.replace(/청구내역/g, "없는시트명XYZ") };
const vbaInferred2 = vm.runInContext("inferPipelineStepTargetFileId(" + JSON.stringify(vbaStep2) + ")", sandbox);
ck("(6) VBA 스텝(시트명도 안 겹칠 때) inferPipelineStepTargetFileId === null", vbaInferred2 === null, vbaInferred2);

// (7) 인코딩/공백 변형이 아니라 '월 숫자' 차이가 원인임을 고정하는 근거:
//     같은 이름을 URI 인코딩해 넣으면 decode 경로로는 매칭된다(디코드 로직은 정상)
const encoded = encodeURIComponent(UPLOADED);
const decMatch = vm.runInContext("pipelineFileIdByWorkbookName(" + JSON.stringify(encoded) + ")", sandbox);
ck("(7) [대조군] URI 인코딩된 2607 이름도 매칭(디코드 정상 → 실패 원인은 월/날짜 리터럴 차이)",
  decMatch === "input:" + UPLOADED, decMatch);

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS (클라 계층 실패 재현 확정)" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
