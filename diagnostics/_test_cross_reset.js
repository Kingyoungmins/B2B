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
  // 중괄호 매칭으로 함수 본문 끝 찾기
  let i = src.indexOf("{", start), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

const needed = [
  "crossWriteDestinationFileIds",
  "pipelineStepWritesCrossFile",
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
// 안정키 토큰 상수(4단계 매칭 의존) 먼저 로드
{
  const cs = src.indexOf("const PIPELINE_VOLATILE_NAME_TOKENS");
  vm.runInContext(src.slice(cs, src.indexOf("];", cs) + 2), sandbox);
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

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
