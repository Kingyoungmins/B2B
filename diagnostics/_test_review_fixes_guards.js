// [회귀] 2026-07-27 녹화→수정/삽입→실행기 경로 코드리뷰 수정 6건 가드 (오프라인 — LLM/Excel 불필요)
//
// F1. 실행기 '에러 복구 시도' 버튼: 실행기 계약(outputMode:file + backgroundMode + 매핑본) 복원
//     — 예전엔 source 만 넘겨 sync(라이브 동기화)·비매핑 재실행으로 실행기 '라이브 무손상' 계약 위반.
// F2. runPipelineWithAutoRepair: outputMode:"file" 이면 복구 후 '스냅샷 복원+이어실행' 금지(전체 재실행)
//     — 이어실행 per-group 경로엔 outputMode 가 없어 라이브 동기화 + outputFiles 미생성.
// F3. 녹화 fast append: 스냅샷 '레코더 시작 전' 선행 + 커버리지 게이트(recSnapshotsComplete)
//     + 파괴 복원 전 정지시점 백업/실패 시 복구 — 예전 게이트(개수>0)는 앵커 스냅샷 실패 시 이중 반영.
// F4. applyLogic: 보류(resume) 구간 존재 시 즉시 라이브 적용 금지(체크포인트 경로/insertLogic 위임)
//     + reapplyVbaPipelineToLive 성공 시 스테일 resume 정리.
// F5. crossWriteDestinationFileIds: 채팅 생성 VBA 방언(Set wbDst = Workbooks("B") / 루프 매칭) 인식.
// F6. 네이티브 녹화 stop 이 expected(정지 시점 시트 다이제스트)를 실어 record/verify 死코드 해소
//     (파이썬 쪽 상세는 diagnostics/_test_record_expected_harvest.py).
//
// 실행: node diagnostics/_test_review_fixes_guards.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass += 1; console.log("PASS " + name); }
  else { fail += 1; console.log("FAIL " + name); }
}

// 소스에서 top-level 함수 본문을 중괄호 균형으로 추출(파일 전체 eval 회피 — IIFE 부작용 차단).
function extractFn(src, name) {
  const idx = src.indexOf("function " + name + "(");
  if (idx < 0) throw new Error(name + " 정의를 못 찾음");
  let p = src.indexOf("(", idx), pd = 0, bodyStart = -1;
  for (let j = p; j < src.length; j++) {
    if (src[j] === "(") pd += 1;
    else if (src[j] === ")") { pd -= 1; if (!pd) { bodyStart = src.indexOf("{", j); break; } }
  }
  if (bodyStart < 0) throw new Error(name + " 본문 시작을 못 찾음");
  let depth = 0;
  for (let j = bodyStart; j < src.length; j++) {
    const ch = src[j];
    if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (!depth) return src.slice(idx, j + 1); }
  }
  throw new Error(name + " 중괄호 불균형");
}

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

// ---------- F5. crossWriteDestinationFileIds — 채팅 생성 VBA 방언 (유닛) ----------
const FILE_IDS = {
  "input_v056_정산서.xlsx": "input:input_v056_정산서.xlsx",
  "input_v056_청구내역.xlsx": "input:input_v056_청구내역.xlsx",
};
const fnSrc = [
  "pipelineStripCodeComments", "pipelineCollectWorkbookNames", "pipelineVbaStringVars",
  "pipelineVbaTargetWorkbookNames", "crossWriteDestinationFileIds",
].map(n => extractFn(pj, n)).join("\n");
const crossWrite = new Function(
  "pipelineFileIdByWorkbookName", "pipelineConstStringVars", "pipelineResolvePyArg", "pipelinePythonMutatedBookNames",
  fnSrc + "\nreturn crossWriteDestinationFileIds;")(
  (name) => FILE_IDS[String(name || "").trim()] || null,
  () => ({}),
  (token) => { const m = String(token || "").trim().match(/^["'](.*)["']$/); return m ? m[1] : null; },
  () => []);

// 1. 직접 참조 방언: Set wbDst = Workbooks("B") + 쓰기 (Activate 없음)
const vbaDirect = [
  'Sub B2BSkill()',
  '    Dim wbDst As Workbook',
  '    Set wbDst = Workbooks("input_v056_정산서.xlsx")',
  '    wbDst.Worksheets("정산").Range("E2").Value = "123"',
  'End Sub'].join("\n");
t("F5-1 Set wbDst = Workbooks() 직접 참조 쓰기 인식",
  JSON.stringify(crossWrite(vbaDirect, { selfFileId: "input:input_v056_청구내역.xlsx" }))
  === JSON.stringify(["input:input_v056_정산서.xlsx"]));
// 2. 지배 관용구: For Each 루프 + If wb.Name = wbDstName Then Set wbDst = wb (Workbooks( 괄호 없음)
const vbaLoop = [
  'Sub B2BSkill()',
  '    Dim wbDstName As String: wbDstName = "input_v056_정산서.xlsx"',
  '    Dim wb As Workbook, wbDst As Workbook',
  '    For Each wb In Application.Workbooks',
  '        If wb.Name = wbDstName Then Set wbDst = wb: Exit For',
  '    Next wb',
  '    wbDst.Worksheets("정산").Range("E2").Value = "1"',
  'End Sub'].join("\n");
t("F5-2 루프 매칭 관용구(wbDstName) 인식",
  JSON.stringify(crossWrite(vbaLoop, { selfFileId: "input:input_v056_청구내역.xlsx" }))
  === JSON.stringify(["input:input_v056_정산서.xlsx"]));
// 3. 소스/대상 변수 정밀도: wbSrc 는 대상 아님(두 파일 등장 → 단일 폴백 미발동)
const vbaSrcDst = [
  'Sub B2BSkill()',
  '    Dim wbSrc As Workbook, wbDst As Workbook',
  '    Set wbSrc = Workbooks("input_v056_청구내역.xlsx")',
  '    Set wbDst = Workbooks("input_v056_정산서.xlsx")',
  '    wbDst.Worksheets("정산").Range("E2").Value = wbSrc.Worksheets("청구").Range("A1").Value',
  'End Sub'].join("\n");
const gotSrcDst = crossWrite(vbaSrcDst, { selfFileId: "input:input_v056_청구내역.xlsx" });
t("F5-3 wbSrc(소스 변수)는 미포함·wbDst 만 대상",
  JSON.stringify(gotSrcDst) === JSON.stringify(["input:input_v056_정산서.xlsx"]));
// 4. 자기 파일 대상은 교차 아님
t("F5-4 자기 파일 Set wbDst 는 교차 아님",
  crossWrite(vbaDirect, { selfFileId: "input:input_v056_정산서.xlsx" }).length === 0);
// 5. python(ctx) 코드는 VBA 방언 게이트(Sub B2BSkill) 미통과 — 기존 동작 불변
const pyRead = 'def transform(ctx):\n    v = ctx.book("input_v056_정산서.xlsx").sheet("정산").read_cell("A1")\n    ctx.write_cell("청구", "B1", v)\n';
t("F5-5 python ctx 교차-읽기는 여전히 비교차(빠른경로 유지)",
  crossWrite(pyRead, { selfFileId: "input:input_v056_청구내역.xlsx" }).length === 0);
// 6. 기존 녹화 Activate 방언 회귀 없음
const vbaAct = 'Sub B2BSkill()\n    Windows("input_v056_정산서.xlsx").Activate\n    Range("A1").Select\n    ActiveCell.FormulaR1C1 = "1"\nEnd Sub';
t("F5-6 녹화 Activate 방언 기존 인식 유지",
  JSON.stringify(crossWrite(vbaAct, { selfFileId: "input:input_v056_청구내역.xlsx" }))
  === JSON.stringify(["input:input_v056_정산서.xlsx"]));

// ---------- F4. applyLogic 보류 가드 + reapply resume 정리 (소스) ----------
const applyLogicSrc = extractFn(pj, "applyLogic");
t("F4-1 applyLogic 이 resume 포인터를 읽는다", /getPipelineResumeFromIndex/.test(applyLogicSrc));
t("F4-2 보류 시 체크포인트 경로(runFromCheckpointAfterEdit) 합류", /runFromCheckpointAfterEdit\(appendIdx/.test(applyLogicSrc));
t("F4-3 체크포인트 불가 시 insertLogic 맨뒤 위임", /insertLogic\(step, state\.pipeline\.length \+ 1\)/.test(applyLogicSrc));
const reapplySrc = extractFn(pj, "_reapplyVbaPipelineToLiveImpl");
t("F4-4 reapply 성공 시 스테일 resume 정리", /clearPipelineResumeFromIndex\(\);[\s\S]{0,400}noteLivePipelineApplied\(sourceSteps\)/.test(reapplySrc));

// ---------- F2. 자동복구 파일모드 가드 (소스) ----------
const autoRepairSrc = extractFn(pj, "runPipelineWithAutoRepair");
{
  const gateIdx = autoRepairSrc.indexOf('if (runOptions.outputMode === "file")');
  const suffixIdx = autoRepairSrc.indexOf("restorePipelineCheckpointForSuffix");
  t("F2-1 파일모드 가드 존재", gateIdx >= 0);
  t("F2-2 가드가 스냅샷 복원+이어실행보다 먼저", gateIdx >= 0 && suffixIdx > gateIdx);
  t("F2-3 가드가 보류를 비우고 전체 재실행(loop)", /if \(runOptions\.outputMode === "file"\) \{\s*clearPipelineResumeFromIndex\(\);\s*continue;/.test(autoRepairSrc));
}

// ---------- F1. 실행기 복구 버튼 계약 (소스) ----------
const recoverySrc = extractFn(pj, "attemptRunnerAutoRecovery");
t("F1-1 복구 재실행이 파일출력 모드", /outputMode:\s*"file"/.test(recoverySrc));
t("F1-2 복구 재실행이 백그라운드 배치", /backgroundMode:\s*true/.test(recoverySrc));
t("F1-3 복구 재실행이 매핑본 사용(beginMappedPipelineRun)", /beginMappedPipelineRun/.test(recoverySrc));
t("F1-4 매핑 복원 보장(finally restore)", /finally\s*\{\s*__mapRun\.restore\(\);?\s*\}/.test(recoverySrc));
t("F1-5 선복구가 매핑 래핑 전(원본 기준) — autoRepair 가 beginMapped 앞",
  recoverySrc.indexOf("autoRepairPipelineStep") < recoverySrc.indexOf("beginMappedPipelineRun"));

// ---------- F3. 녹화 fast append 게이트/백업 (소스 — IIFE 라 extractFn 불가) ----------
{
  const recStart = pj.indexOf("녹화 모드 (ixi-Cell-R recorder 통합)");
  // 윈도우 45000: 녹화 IIFE 가 커지며(취소 복원·셀편집 가드 등) 30000 을 넘었다 — 실제 IIFE 끝까지 커버.
  const rec = recStart >= 0 ? pj.slice(recStart, recStart + 45000) : "";
  t("F3-0 녹화 IIFE 존재", recStart >= 0);
  const snapDone = rec.indexOf("recSnapshotsComplete = ids.length > 0");
  const recStartCall = rec.indexOf('"/api/excel/record/start"');
  t("F3-1 스냅샷 완전성 계산이 레코더 시작 콜보다 앞(선행 스냅샷)",
    snapDone >= 0 && recStartCall > snapDone);
  t("F3-2 커버리지 게이트(recSnapshotsComplete + 앵커 스냅샷)",
    /allVba && recSnapshotsComplete && recExcelId\s*&&\s*recPreSnapshots\.some\(\(s\) => s\.excelId === recExcelId\)/.test(rec));
  t("F3-3 녹화 중 새 세션 감지 시 폴백", /nowIds\.some\(\(eid\) => !snapIds\.has\(eid\)\)/.test(rec));
  t("F3-4 파괴 복원 전 정지시점 백업", /stopBackups\.push\(\{ excelId: snap\.excelId, resultId: s\.downloadId \}\)/.test(rec));
  t("F3-5 백업 실패 시 파괴 복원 포기(비파괴 폴백)", /stopBackups = \[\];\s*fastAppendEligible = false;/.test(rec));
  t("F3-6 재현·폴백 전부 실패 시 정지시점 복구", /if \(stopBackups\.length\) \{[\s\S]{0,600}resultId: b\.resultId/.test(rec));
  t("F3-7 폴백 사유 트레이스(silent 금지)", /record\.append_replay\.coverage_fallback/.test(rec));
}

// ---------- F6. record/verify death 해소 — 프론트 게이트와 백엔드 공급 (소스) ----------
{
  t("F6-1 프론트 검증 블록 게이트 존재(data.expected)", /Array\.isArray\(data\.expected\) && data\.expected\.length/.test(pj));
  const sv = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8");
  t("F6-2 네이티브 stop 이 expected 를 실어 준다", /result\["expected"\] = rec\.get\("expected"\)/.test(sv));
  const nm = fs.readFileSync(path.join(ROOT, "native_macro_recorder.py"), "utf8");
  t("F6-3 네이티브 stop 에서 expected 수확(capture_expected_states)", /capture_expected_states\(/.test(nm) && /_touched_sheet_pairs/.test(nm));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
