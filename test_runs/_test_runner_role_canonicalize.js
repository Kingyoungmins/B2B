// [역할(안정키) 정규화 검증] 같은 파일의 다른 달 이름(4월/5월)이 요구 행으로 갈라지지 않고
// envConfig 정본 이름 '한 행'으로 합쳐지는가 + 실행 치환이 별칭(옛 달 이름)까지 전부 바꾸는가.
// 사용자 실측 zip 2건(꼬리표 혼재 / @범위 에코) 시나리오를 실제 함수(슬라이스 eval)로 재현한다.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const pj = fs.readFileSync(path.join(root, "scripts", "pipeline.js"), "utf8");
const dj = fs.readFileSync(path.join(root, "scripts", "drop-handling.js"), "utf8");
function slice(src, a, b) {
  const i = src.indexOf(a); const j = src.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error("slice fail: " + a + " .. " + b);
  return src.slice(i, j);
}

const G = globalThis;
G.window = G;
// ── 실제 함수 로드(요구 추출 테스트와 동일 슬라이스) ──
eval(slice(pj, "function inferPipelineStepLanguage", "function normalizeStep"));
eval(slice(pj, "function pipelineDecodeWorkbookName", "function inferPipelineStepTargetSheetName")); // decode/안정키/collect 등
eval(slice(pj, "function pipelineSheetLiteralsFromCode", "function pipelineCodeCreatesSheetNamed"));
eval(slice(dj, "function runnerMappingSheetNames", "function runnerMappingScoreFile"));   // canonicalize/filter/extract 포함

let pass = 0, fail = 0;
function ck(name, cond, got) {
  if (cond) { pass++; console.log(" OK  " + name); }
  else { fail++; console.log("FAIL " + name + (got !== undefined ? "  got=" + JSON.stringify(got).slice(0, 220) : "")); }
}

const PY = 'def transform(ctx):\n    ctx.write_cell("원가", "F3", 100)';
const step4월에코 = {
  prompt: "선택 범위: @범위[input_원가_2026_4월.xlsx/원가!F3] 숫자 100적어",
  description: "F3 에 100 기입", code: PY, language: "python",
  targetFileId: "input:input_원가_2026_5월.xlsx", targetSheetName: "원가",
};
const step5월 = {
  prompt: "선택 범위: @범위[input_원가_2026_5월.xlsx/원가!G8]숫자 200적어",
  description: "G8 에 200 기입", code: PY.replace("F3", "G8"), language: "python",
  targetFileId: "input:input_원가_2026_5월.xlsx", targetSheetName: "원가",
};

// ── (1) 실측 시나리오: @범위 4월 에코 + 5월 꼬리표 → 정본(5월) '한 행' + 별칭에 4월 보존 ──
G.state = {
  pipeline: [step4월에코, step5월],
  skillEnvConfig: { inputs: [{ name: "input_원가_2026_5월.xlsx", displayName: "input_원가_2026_5월.xlsx", sheetNames: ["원가"] }] },
};
{
  const reqs = runnerExtractMappingRequirements();
  const books = reqs.filter(r => r.book).map(r => r.book);
  ck("(1a) 파일 요구가 정본 이름 '한 행'뿐(4월 행 없음)",
    books.length === 1 && books[0] === "input_원가_2026_5월.xlsx", reqs.map(r => r.book + "/" + r.sheet));
  const row = reqs.find(r => r.book === "input_원가_2026_5월.xlsx");
  ck("(1b) 옛 달 이름은 별칭으로 보존(실행 치환용)",
    !!row && Array.isArray(row.aliases) && row.aliases.includes("input_원가_2026_4월.xlsx"), row);
}

// ── (2) 모호 가드: 정본에 4월·5월 둘 다(진짜 두 달 사용) → 정규화 금지, 두 행 유지 ──
G.state = {
  pipeline: [
    { ...step4월에코, targetFileId: "input:input_원가_2026_4월.xlsx" },
    step5월,
  ],
  skillEnvConfig: { inputs: [
    { name: "input_원가_2026_4월.xlsx", sheetNames: ["원가"] },
    { name: "input_원가_2026_5월.xlsx", sheetNames: ["원가"] },
  ] },
};
{
  const reqs = runnerExtractMappingRequirements();
  const books = new Set(reqs.filter(r => r.book).map(r => r.book));
  ck("(2) 정본에 두 달 실존 → 합치지 않음(각자 요구 유지)",
    books.has("input_원가_2026_4월.xlsx") && books.has("input_원가_2026_5월.xlsx"),
    Array.from(books));
}

// ── (3) 구버전 zip(envConfig 없음) → 기존 동작 그대로(정규화 없음) ──
G.state = {
  pipeline: [{ ...step4월에코, targetFileId: "input:input_원가_2026_4월.xlsx" }, step5월],
  skillEnvConfig: null,
};
{
  const reqs = runnerExtractMappingRequirements();
  const books = new Set(reqs.filter(r => r.book).map(r => r.book));
  ck("(3) envConfig 없음 → 무변화(두 행)",
    books.has("input_원가_2026_4월.xlsx") && books.has("input_원가_2026_5월.xlsx"),
    Array.from(books));
}

// ── (4) 별칭 치환 e2e: 코드/프롬프트에 옛 달 이름이 남아 있어도 실제 파일명으로 전부 치환 ──
eval(slice(dj, "function runnerReplaceLiteral", "\nwindow.buildRunnerMappedPipeline"));
G.state = { runnerMappingChecked: true, pipeline: [] };
eval(slice(dj, "window.buildRunnerMappedPipeline = function", "\nfunction renderRunnerWorkflow"));
{
  const CODE = 'def transform(ctx):\n    a = ctx.book("input_원가_2026_4월.xlsx")\n    b = ctx.book("input_원가_2026_5월.xlsx")\n    a.write("원가", "F3", 100)';
  const step = { id: "s1", code: CODE,
                 prompt: "@범위[input_원가_2026_4월.xlsx/원가!F3] 100",
                 targetFileId: "input:input_원가_2026_5월.xlsx", targetSheetName: "원가" };
  G.state.pipeline = [step];
  G.runnerBuildMappingRows = () => ([
    { req: { book: "input_원가_2026_5월.xlsx", sheet: "원가", key: "k1",
             aliases: ["input_원가_2026_4월.xlsx"] },
      fileItem: { id: "input:input_원가_2026_6월.xlsx", name: "input_원가_2026_6월.xlsx" },
      sheet: "원가" },
  ]);
  const mapped = window.buildRunnerMappedPipeline([step]);
  const m = mapped[0].code;
  ck("(4a) canonical(5월)과 별칭(4월) 리터럴 모두 6월로 치환",
    m.includes('"input_원가_2026_6월.xlsx"') && !m.includes("4월") && !m.includes("5월"), m);
  ck("(4b) targetFileId 도 매핑된 6월 파일로 갱신",
    mapped[0].targetFileId === "input:input_원가_2026_6월.xlsx", mapped[0].targetFileId);
  ck("(4c) 원본 step 불변", step.code === CODE);
}

// ── (5) 시트 월 변형 정규화: "원가_4월" 시트 요구가 정본 시트("원가_5월") 한 행으로 + 별칭 보존 ──
G.state = {
  pipeline: [{
    prompt: "선택 범위: @범위[input_원가_2026_5월.xlsx/원가_4월!F3] 숫자 100적어",
    description: "", language: "python",
    code: 'def transform(ctx):\n    ctx.write_cell("원가_5월", "F3", 100)',
    targetFileId: "input:input_원가_2026_5월.xlsx", targetSheetName: "원가_5월",
  }],
  skillEnvConfig: { inputs: [{ name: "input_원가_2026_5월.xlsx", sheetNames: ["원가_5월"] }] },
};
{
  const reqs = runnerExtractMappingRequirements();
  const sheetRows = reqs.filter(r => r.book && r.sheet);
  ck("(5a) 시트 요구가 정본 시트 '한 행'뿐(원가_4월 행 없음)",
    sheetRows.length === 1 && sheetRows[0].sheet === "원가_5월",
    reqs.map(r => r.book + "/" + r.sheet));
  ck("(5b) 옛 시트명은 sheetAliases 로 보존",
    Array.isArray(sheetRows[0] && sheetRows[0].sheetAliases)
    && sheetRows[0].sheetAliases.includes("원가_4월"), sheetRows[0]);
}

// ── (6) runnerFindSheet 안정키 4단계: 월 변형 시트 자동 연결(유일 시만) ──
eval(slice(dj, "function runnerFindSheet", "// [매핑 보존]"));
{
  const mk = (names) => ({ sheetNames: names });
  ck("(6a) '원가_5월' 요구 → 6월 파일의 '원가_6월' 유일 일치 채택",
    runnerFindSheet({ sheet: "원가_5월" }, mk(["원가_6월", "검증_6월"]), null, new Set()) === "원가_6월");
  ck("(6b) 후보 2개(원가_6월/원가_7월) → 모호, 채택 안 함",
    runnerFindSheet({ sheet: "원가_5월" }, mk(["원가_6월", "원가_7월"]), null, new Set()) === "");
  ck("(6c) 생성시트 이름은 후보 제외",
    runnerFindSheet({ sheet: "요약_5월" }, mk(["요약_6월", "검증_6월"]), null,
      new Set([runnerMappingNorm("요약_6월")])) !== "요약_6월");
  ck("(6d) 표기 정규화 우선(정확 일치가 이김)",
    runnerFindSheet({ sheet: "원가_6월" }, mk(["원가_6월", "원가_7월"]), null, new Set()) === "원가_6월");
}

// ── (7) 시트 별칭 치환 e2e: 코드 속 원가_4월·원가_5월 전부 실제 시트(원가_6월)로 ──
{
  const CODE = 'def transform(ctx):\n    a = ctx.book("input_원가_2026_4월.xlsx")\n    a.write("원가_4월", "F3", 100)\n    a.write("원가_5월", "G8", 200)';
  const step = { id: "s2", code: CODE, prompt: "",
                 targetFileId: "input:input_원가_2026_5월.xlsx", targetSheetName: "원가_5월" };
  G.state = { runnerMappingChecked: true, pipeline: [step] };
  G.runnerBuildMappingRows = () => ([
    { req: { book: "input_원가_2026_5월.xlsx", sheet: "원가_5월", key: "k1",
             aliases: ["input_원가_2026_4월.xlsx"], sheetAliases: ["원가_4월"] },
      fileItem: { id: "input:input_원가_2026_6월.xlsx", name: "input_원가_2026_6월.xlsx" },
      sheet: "원가_6월" },
  ]);
  const mapped = window.buildRunnerMappedPipeline([step]);
  const m = mapped[0].code;
  ck("(7) 파일(4·5월)·시트(원가_4월·원가_5월) 전부 6월 실제값으로 치환",
    m.includes('"input_원가_2026_6월.xlsx"') && m.split('"원가_6월"').length === 3
    && !m.includes("원가_4월") && !m.includes("원가_5월"), m);
}

console.log("\n=== RESULT: " + (fail === 0 ? `ALL PASS (${pass}/${pass})` : fail + " FAIL") + " ===");
process.exit(fail ? 1 : 0);
