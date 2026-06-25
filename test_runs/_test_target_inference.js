// 교차파일 변형 대상 추론 패치 검증.
// 패치된 pipeline.js 에서 순수 헬퍼(PIPELINE_CTX_READER_METHODS, pipelinePythonBookVarNames,
// pipelinePythonMutatedBookNames, pipelineStepMutatesMainCtx)만 추출해 실제 스킬 4스텝 코드로 단정.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const start = src.indexOf("const PIPELINE_CTX_READER_METHODS");
const end = src.indexOf("function inferPipelineStepTargetFileId(step)");
if (start < 0 || end < 0 || end < start) { console.error("FAIL: 헬퍼 블록 추출 실패"); process.exit(2); }
let block = src.slice(start, end);
block += "\nglobalThis.__mut = pipelinePythonMutatedBookNames; globalThis.__main = pipelineStepMutatesMainCtx;";
eval(block);
const mut = globalThis.__mut, main = globalThis.__main;

const LG = "연_LG_요금대사-NHN_판교IDC_10G_6회선_26년05월청구분.xlsx";
const NHN = "엔에치엔클라우드_트래픽추출_2605사용.xlsx";

const steps = {
  step1_vba: "Sub B2BSkill()\n  ' ... VBA, no ctx ...\n  Dim ws As Worksheet\nEnd Sub",
  step2_clear: 'def transform(ctx):\n    ctx.clear("NHN", "I2:N8641")\n',
  step3_read_write: 'def transform(ctx):\n    src_ctx = ctx.book("' + NHN + '")\n    data = src_ctx.read("트래픽_데이터", "A3:A8930")\n    ctx.write("NHN", "A2", data, overwrite_formulas=True)\n',
  step4_delete: 'def transform(ctx):\n    target_book = ctx.book("' + LG + '")\n    target_book.delete_sheet("청구금액")',
  // 보강 케이스
  chain_write: 'def transform(ctx):\n    ctx.book("F.xlsx").write("S", "A1", d)\n',
  read_only_book: 'def transform(ctx):\n    x = ctx.book("F.xlsx")\n    v = x.read("S", "A1")\n    ctx.write("S2", "A1", v)\n',
};

let pass = 0, fail = 0;
function check(name, cond) { (cond ? (pass++) : (fail++)); console.log((cond ? " OK  " : "FAIL ") + name); }
function arrEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// 핵심: step4 = 메인 ctx 변형 없음 + 변형북=[LG]  → 패치 분기가 LG 로 라우팅(버그 수정)
check("step4 mutatedBooks == [LG]", arrEq(mut(steps.step4_delete), [LG]));
check("step4 mainCtxMutates == false (분기 발동)", main(steps.step4_delete) === false);

// 회귀: step2/step3 는 메인 ctx 변형 → 분기 미발동(기존 로직 유지)
check("step2 mutatedBooks == []", arrEq(mut(steps.step2_clear), []));
check("step2 mainCtxMutates == true", main(steps.step2_clear) === true);
check("step3 mutatedBooks == [] (src_ctx.read 는 읽기)", arrEq(mut(steps.step3_read_write), []));
check("step3 mainCtxMutates == true (ctx.write)", main(steps.step3_read_write) === true);

// VBA 스텝: ctx 없음 → 둘 다 비어있음(분기 미발동)
check("step1(vba) mutatedBooks == []", arrEq(mut(steps.step1_vba), []));
check("step1(vba) mainCtxMutates == false", main(steps.step1_vba) === false);

// 보강: 직접 체이닝 변형 / 읽기전용 book
check("chain ctx.book(F).write -> [F.xlsx]", arrEq(mut(steps.chain_write), ["F.xlsx"]));
check("read-only book (x.read) -> mutatedBooks []", arrEq(mut(steps.read_only_book), []));
check("read-only book mainCtxMutates true (ctx.write)", main(steps.read_only_book) === true);

// 교차파일 라우팅 결정: ctx.book(B).clear/delete 는 hasCrossFileStep=true 가 되어 격리 경로로 가야 함
const bookClear = 'def transform(ctx):\n    ctx.book("B.xlsx").clear("S", "A1:C3")\n';
check("ctx.book(B).clear -> mutatedBooks=[B] (격리 라우팅 트리거)", arrEq(mut(bookClear), ["B.xlsx"]));
// python 전용 파이프라인 [step1=ctx.write(A), step2=ctx.book(B).clear] 에서 hasCrossFileStep 모사
const pipe = [steps.step2_clear, bookClear];
const hasCrossFile = pipe.some(c => mut(c).length > 0);
check("python-only 파이프라인에 ctx.book 변형 있으면 hasCrossFileStep=true", hasCrossFile === true);
// 단일파일 전용 파이프라인은 false (회귀 없음)
const pipeSingle = [steps.step2_clear, 'def transform(ctx):\n    ctx.write("S","A1",d)\n'];
check("단일파일 전용 파이프라인 hasCrossFileStep=false", pipeSingle.some(c => mut(c).length > 0) === false);

console.log("\n=== RESULT: " + pass + " PASS / " + fail + " FAIL ===");
process.exit(fail ? 2 : 0);
