// [0.8.4 크리티컬] 결과편집 후 "현재 상태 다운로드"가 옛 실행 결과를 서빙하던 버그.
//
// 실측(2026-09-03, desktop-ps07979 14:50 세션):
//   14:52:03 전체실행 19단계 결과 저장 → 14:52:11 결과편집(라이브 교체)
//   → 14:52:34 새 스킬 라이브 적용(insert_cols) → 14:52:39 다운로드
//   → 받은 파일 = 14:52:03 결과(새 스킬 미포함). 뷰에는 적용돼 보임.
// 원인: downloadCurrentWorkbookFile 이 window.lastRunnerOutputs(실행기 결과)를
//   라이브 저장보다 우선하는데, 결과편집이 결과를 라이브로 흡수한 뒤에도 항목이 남아
//   낡은 결과가 계속 이긴다.
// 수정: 결과편집이 불러온 결과 항목에 liveAbsorbed 표시 → 다운로드는 그 항목을
//   건너뛰고 /api/excel/save(라이브 현재 상태)로 받는다. 결과를 라이브에 안 불러온
//   파일은 기존대로 결과 우선(원본 오다운로드 방지 분기 보존).
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "");
const PIPE = read("scripts/pipeline.js");
const OUT = read("scripts/output-template.js");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 결과편집 — 불러온 결과에 liveAbsorbed 표시");
check("불러온 excelId 항목만 표시(전체가 아니라)",
  PIPE.includes("loadedExcelIds.includes(o.excelId)) o.liveAbsorbed = true"));
{ // 표시는 결과 불러오기 성공 흐름(noteLivePipelineApplied 직후)에 있어야 한다
  const i = PIPE.indexOf("noteLivePipelineApplied(state.pipeline);  // 라이브 = 최종");
  const j = PIPE.indexOf("o.liveAbsorbed = true");
  check("결과 불러오기 성공 직후에 표시", i > -1 && j > i && j - i < 900, j - i);
}

console.log("[2] 다운로드 — 흡수된 결과는 건너뛰고 라이브 저장으로");
check("runMatch 가 liveAbsorbed 제외",
  OUT.includes("runOuts.find(o => o && !o.liveAbsorbed && o.downloadId && o.excelId"));
check("라이브 저장 폴백은 그대로(/api/excel/save)",
  OUT.includes('postExcelMirror("/api/excel/save", { excelId })'));

console.log("[3] 정상 경로 보존 — 결과를 라이브에 안 불러온 경우는 결과 우선");
{
  // 실제 필터 로직을 그대로 실행해 행동 확인
  const excelId = "a167";
  const fileIdForExcelMirrorId = () => null;
  const fileId = "input:x";
  const run = (runOuts) => runOuts.find(o => o && !o.liveAbsorbed && o.downloadId && o.excelId && (
    (excelId && String(o.excelId) === String(excelId)) ||
    (typeof fileIdForExcelMirrorId === "function" && fileIdForExcelMirrorId(o.excelId) === fileId)
  ));
  const fresh = { excelId: "a167", downloadId: "d1" };
  check("흡수 전(결과편집 안 함) → 결과 우선 유지", run([fresh]) === fresh);
  check("흡수 후 → 결과 건너뜀(라이브 저장으로 폴백)",
    run([{ ...fresh, liveAbsorbed: true }]) === undefined);
  check("다른 파일 결과는 흡수돼도 이 파일 매칭에 영향 없음",
    run([{ excelId: "b999", downloadId: "d2", liveAbsorbed: true }, fresh]) === fresh);
}

console.log("[3b] 결과편집 재클릭 — 흡수된 결과가 라이브를 다시 덮지 않는다");
check("재클릭 outs 에서 liveAbsorbed 제외(전부 흡수 시 재적용 폴백)",
  PIPE.includes("window.lastRunnerOutputs.filter(o => o && !o.liveAbsorbed && o.excelId && o.downloadId)"));

console.log("[4] 실행기 파일출력은 여전히 라이브 장부를 안 만진다(무손상 원칙)");
check("outputMode=file → invalidateLivePipelineApplied(표시 없음)",
  /outputMode === "file"\) \{\s*\n\s*if \(typeof invalidateLivePipelineApplied === "function"\) invalidateLivePipelineApplied\(\);/.test(PIPE));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
