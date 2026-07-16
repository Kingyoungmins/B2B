// 교차파일 삭제 원복 — crossWriteDestinationFileIds / pipelineStepWritesCrossFile 로직 검증.
// pipeline.js 를 vm 에 로드하되, 의존 전역은 최소 스텁으로 채운다(state.inputs 로 이름→fileId 해석).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

// pipeline.js 전체를 로드하면 다른 전역 의존으로 깨질 수 있어, 필요한 두 함수 + 그 의존만 추출해 평가.
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
function extract(name) {
  const marker = "function " + name + "(";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  // 시그니처의 기본 파라미터 `options = {}` 에 속지 않도록 파라미터 괄호를 먼저 매칭한 뒤
  // 본문 `{` 를 찾는다(먼저 나오는 `{` 를 본문으로 오인하면 함수가 잘려 SyntaxError).
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

const needed = [
  "pipelineStripCodeComments",   // 주석 속 dst_book 오탐 제거
  "pipelineConstStringVars",     // 변수 dst_book 해석
  "pipelineResolvePyArg",
  "pipelinePythonBookVarNames",  // ctx.book("X").<변형> 감지 의존
  "pipelinePythonMutatedBookNames",
  // inferPipelineStepTargetFileId 는 의존 체인이 커서 로드하지 않는다(typeof 가드로 생략됨).
  // 자기파일 제외는 step.targetFileId 경로로 검증한다.
  "crossWriteDestinationFileIds",
  "pipelineStepWritesCrossFile",
  "pipelineSuffixWritesCrossFile",
  "pipelineFileIdByWorkbookName",
  "pipelineKnownFiles",
  "pipelineStableWorkbookKey",   // pipelineFileIdByWorkbookName 4단계(안정키) 의존
];
const sandbox = {
  console,
  // 최소 스텁: 이름 정규화/디코드
  pipelineWorkbookNameKey: (n, opt) => String(n || "").trim().toLowerCase().replace(/\s+/g, ""),
  pipelineDecodeWorkbookName: n => String(n || ""),
  workbookDisplayName: (f, fb) => (f && f.name) || fb,
  outputTemplateFileId: idx => "output:" + idx,
  state: {
    inputs: [{ name: "input_원가_2026_4월.xlsx" }, { name: "input_매출_2026_4월.xlsx" }],
    outputTemplates: [],
    output: null,
  },
};
vm.createContext(sandbox);
// 안정키 토큰 상수(4단계 매칭 의존) 먼저 로드 — 이름토큰 + 접미사토큰 + 날짜판정 헬퍼까지
// 한 덩어리로(끝 경계 = pipelineStableWorkbookKey). 토큰만 집어오면 그 함수가 참조하는
// PIPELINE_VOLATILE_SUFFIX_TOKENS/pipelineLooksLike* 가 없어 ReferenceError 로 죽는다.
{
  const cs = src.indexOf("const PIPELINE_VOLATILE_NAME_TOKENS");
  const ce = src.indexOf("function pipelineStableWorkbookKey", cs);
  if (cs < 0 || ce < 0) throw new Error("안정키 토큰 블록을 찾지 못함");
  vm.runInContext(src.slice(cs, ce), sandbox);
}
// ctx 읽기전용 메서드 집합(pipelinePythonMutatedBookNames 의존)
{
  const rx = /const PIPELINE_CTX_READER_METHODS = new Set\(\[[^\]]*\]\);/.exec(src);
  if (!rx) throw new Error("PIPELINE_CTX_READER_METHODS 를 찾지 못함");
  vm.runInContext(rx[0], sandbox);
}
needed.forEach(fn => vm.runInContext(extract(fn), sandbox));

// 사용자의 실제 스킬 코드
const code = 'def transform(ctx):\n    ctx.copy_sheet("원가", dst_book="input_매출_2026_4월.xlsx")\n';

const ids = vm.runInContext("crossWriteDestinationFileIds(" + JSON.stringify(code) + ")", sandbox);
ck("(1) dst_book(입력파일) → fileId 해석", JSON.stringify(ids) === JSON.stringify(["input:input_매출_2026_4월.xlsx"]), ids);

const writes = vm.runInContext("pipelineStepWritesCrossFile(" + JSON.stringify({ code }) + ")", sandbox);
ck("(2) 교차파일 쓰기 스텝으로 판정", writes === true, writes);

// dst_book 없는 일반 스텝은 교차파일 아님
const plain = 'def transform(ctx):\n    ctx.sort("원가", "A")\n';
ck("(3) 일반 스텝은 교차 아님", vm.runInContext("pipelineStepWritesCrossFile(" + JSON.stringify({ code: plain }) + ")", sandbox) === false);

// 미지의 파일명은 해석 실패 → 빈 배열(안전)
const unknown = 'ctx.copy_sheet("원가", dst_book="없는파일.xlsx")';
ck("(4) 미지 파일명은 리셋대상 없음(안전)", JSON.stringify(vm.runInContext("crossWriteDestinationFileIds(" + JSON.stringify(unknown) + ")", sandbox)) === "[]");

const call = (fn, ...args) =>
  vm.runInContext(fn + "(" + args.map(a => JSON.stringify(a)).join(", ") + ")", sandbox);

// (5) [회귀] ctx.book("X").<변형> 방언 — 정식 지원 패턴인데 dst_book 정규식만 봐서 놓쳤다.
//     스텝이 주 ctx 도 함께 변형하면 대상 추론이 A 를 반환해 B 가 어디에서도 리셋되지 않았다.
{
  const code = 'def transform(ctx):\n    ctx.write("원가", 1, 1, "x")\n    ctx.book("input_매출_2026_4월.xlsx").write("요약", 1, 1, 9)\n';
  const ids = call("crossWriteDestinationFileIds", code);
  ck("(5) ctx.book(...).write 교차 목적지 감지", ids.includes("input:input_매출_2026_4월.xlsx"), ids);
}
// (6) [회귀] 변수로 넘기는 dst_book — 리터럴만 보던 정규식이 놓쳤다.
{
  const code = 'dst = "input_매출_2026_4월.xlsx"\ndef transform(ctx):\n    ctx.copy_sheet("원가", dst_book=dst)\n';
  const ids = call("crossWriteDestinationFileIds", code);
  ck("(6) 변수 dst_book 해석", ids.includes("input:input_매출_2026_4월.xlsx"), ids);
}
// (7) [회귀] 주석 속 dst_book 은 오탐 금지 — 실제로 안 쓰는 스텝이 교차로 오판되면 토글마다
//     전체 pristine 리셋+재적용을 타고(저사양 수 배 느려짐) 파이프라인 밖 상태까지 날아간다.
{
  const code = 'def transform(ctx):\n    # 예: ctx.copy_sheet("원가", dst_book="input_매출_2026_4월.xlsx")\n    ctx.sort("원가", "A")\n';
  const ids = call("crossWriteDestinationFileIds", code);
  ck("(7) 주석 속 dst_book 오탐 없음", ids.length === 0, ids);
}
// (8) [회귀] 자기 대상 파일에 쓰는 건 교차가 아니다(같은 파일 복붙 캡처가 전부 교차로 오판됐다).
{
  const code = 'ctx.paste_copied("원가", dst_book="input_원가_2026_4월.xlsx")';
  const self = call("crossWriteDestinationFileIds", code, { selfFileId: "input:input_원가_2026_4월.xlsx" });
  const cross = call("crossWriteDestinationFileIds", code, {});
  ck("(8) 자기파일은 교차 아님", self.length === 0 && cross.length === 1, { self, cross });
}
// (9) [회귀] 빠른경로 가드는 조작한 스텝이 아니라 '되돌려지는 suffix 전체'를 봐야 한다.
//     Step1(일반) OFF 여도 suffix 안의 Step2(교차)가 목적지를 더럽힌 채 남았다.
{
  const steps = [
    { code: 'ctx.sort("원가", "A")', targetFileId: "input:input_원가_2026_4월.xlsx" },
    { code: 'ctx.copy_sheet("원가", dst_book="input_매출_2026_4월.xlsx")', targetFileId: "input:input_원가_2026_4월.xlsx" },
  ];
  const suffixFrom0 = call("pipelineSuffixWritesCrossFile", steps, 0);
  const stepOnly = call("pipelineStepWritesCrossFile", steps[0]);
  ck("(9) suffix 에 교차 있으면 빠른경로 금지", suffixFrom0 === true && stepOnly === false, { suffixFrom0, stepOnly });
  ck("(9b) 교차 뒤쪽만 남으면 suffix 도 교차 아님", call("pipelineSuffixWritesCrossFile", [steps[0]], 0) === false);
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
