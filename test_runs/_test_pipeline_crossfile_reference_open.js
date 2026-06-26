// SBAGENT-138: 느린 PC 교차파일 race 수정 검증.
// 교차파일 스텝(한전의 05_DAS 를 읽어 DAS 에 쓰기)의 '읽기 소스(한전)'를 실행 전에 열어야 한다.
// 기존 라우팅/리셋은 쓰기 대상(+출력)만 잡아 읽기 소스를 놓쳤다 → 느린 PC에서 companion 부재로
// "시트 못찾음". collectPipelineReferencedFileIds 가 '읽기 소스'까지 모으는지(실제 추출 함수로) 검증.
const fs = require("fs"), path = require("path");
const fuzzySrc = fs.readFileSync(path.join(__dirname, "..", "scripts", "fuzzy.js"), "utf8");
const full = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
// runIsolatedLivePipelineSteps 직전까지(= 신규 헬퍼 포함). 그 뒤는 top-level UI 글루가 있어 제외.
const pipeSrc = full.slice(0, full.indexOf("async function runIsolatedLivePipelineSteps"));
if (pipeSrc.indexOf("function collectPipelineReferencedFileIds") < 0) {
  throw new Error("collectPipelineReferencedFileIds 가 슬라이스에 없음");
}

const DAS = "파워빌_전력통신_DAS_서울본부.xlsx";
const HAN = "2026_한전_서울본부_05월분_전력회선_세부내역.xlsx";
const mk = (name) => ({ name, sheetNames: ["Sheet1"], sheets: { Sheet1: {} } });
// 한전을 '입력'으로 등록(순수 읽기 소스 — 출력 미등록인 어려운 케이스). 출력 아니면 crossOutput 이 못 잡음.
const state = {
  inputs: [mk(DAS), mk(HAN)],
  outputTemplates: [],
  output: null,
  pipeline: [],
  currentFileId: "input:" + DAS,
};

const stubs = `
  const _noop = new Proxy(function(){}, { get: () => _noop, set: () => true, apply: () => _noop });
  var window = _noop, document = _noop, $ = () => _noop, performance = { now: () => 0 }, addEventListener = () => {}, toast = () => {};
  var workbookDisplayName = (f, fb) => (f && f.name) ? f.name : fb;
  var outputTemplateFileId = (i) => "output:" + i;
  var state = __S__;
  function getFile(id) {
    if (!id) return null;
    if (id.indexOf("output:") === 0) { const i = +id.slice(7); const t = state.outputTemplates[i]; return t ? t.file : null; }
    if (id.indexOf("input:") === 0) { const n = id.slice(6); return state.inputs.find(x => x.name === n) || null; }
    return null;
  }
`;
const api = new Function("__S__", stubs.replace("__S__", "arguments[0]") + "\n" + fuzzySrc + "\n" + pipeSrc +
  "\n return { collectPipelineReferencedFileIds, byName: pipelineFileIdByWorkbookName };")(state);

let pass = 0, fail = 0;
const ck = (n, c) => { (c ? pass++ : fail++); console.log((c ? " OK  " : "FAIL ") + n); };

// step8: 한전(읽기 소스)의 05_DAS 를 읽어 DAS 에 씀. targetFileId=input:DAS(쓰기 대상).
const step8 = {
  id: "s8", language: "vba", enabled: true, targetFileId: "input:" + DAS,
  code: 'Sub B2BSkill()\n    Dim wbDstName As String: wbDstName = "' + DAS + '"\n' +
        '    Dim wbSrcName As String: wbSrcName = "' + HAN + '"\n' +
        '    Set wsSrc = wbSrc.Worksheets("05_DAS")\n' +
        'End Sub',
};
state.pipeline = [step8];

// 사전 확인: 이름→fileId 변환이 한전을 input:한전 으로 잡는가
ck("[전제] 한전 이름→fileId 변환됨", api.byName(HAN) === "input:" + HAN);

const refs = api.collectPipelineReferencedFileIds([step8]);
console.log("수집된 참조 fileIds:", JSON.stringify(refs));

ck("[핵심] 읽기 소스(한전) 포함됨", refs.includes("input:" + HAN));
ck("[쓰기] 쓰기 대상(DAS) 포함됨", refs.includes("input:" + DAS));

// 회귀: 단일 파일 스텝은 자기 파일만(불필요 파일 안 끌어옴)
const single = { id: "p1", language: "python", enabled: true, targetFileId: "input:" + DAS,
  code: "def transform(ctx):\n    ctx.write('Sheet1','A1',[[1]])\n" };
const refsSingle = api.collectPipelineReferencedFileIds([single]);
ck("[회귀] 단일파일 스텝은 한전 안 끌어옴", !refsSingle.includes("input:" + HAN) && refsSingle.includes("input:" + DAS));

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 2 : 0);
