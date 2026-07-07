// [검증] 개별 파일 다운로드가 '스킬 반영본'(실행 결과 URL)을 받는지 확인.
// downloadCurrentWorkbookFile 만 슬라이스하고 협력자는 스텁. 실제 다운로드 URL 을 캡처해 판정.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "output-template.js"), "utf8");
const a = src.indexOf("async function downloadCurrentWorkbookFile");
const b = src.indexOf("\nfunction safeCurrentWorkbookDownloadName", a);
const fn = src.slice(a, b);

const G = globalThis;
G.captured = null;
function reset() {
  G.captured = null;
  G.window = { lastRunnerOutputs: [] };
  G.toast = () => {};
  G.safeCurrentWorkbookDownloadName = (n) => String(n || "wb.xlsx");
  G.getOriginalFile = () => ({});
  G.getFile = () => ({ name: "매출.xlsx" });
  G.excelMirrorSessionIdForFileId = () => null;
  G.fileIdForExcelMirrorId = () => null;
  G.postExcelMirror = async () => ({});
  G.downloadBackendOutput = (url, filename) => { G.captured = { url, filename }; };
  G.exportOutputCsv = () => { G.captured = { url: "CLIENT_CSV" }; };
  G.exportOutputXlsx = () => { G.captured = { url: "CLIENT_XLSX" }; };
}
eval(fn + "\nG.__dl = downloadCurrentWorkbookFile;");

let pass = 0, fail = 0;
function ck(name, cond, got) { if (cond) { pass++; console.log(" OK  " + name); } else { fail++; console.log("FAIL " + name + "  got=" + JSON.stringify(got)); } }

(async () => {
  // 1) 전체실행 결과(파일모드) 존재 + excelId 직접 일치 → 결과 URL 다운로드
  reset();
  G.window.lastRunnerOutputs = [{ excelId: "E1", downloadId: "RID1", downloadUrl: "/api/workbooks/download/RID1", name: "결과_매출_20260707.xlsx" }];
  G.excelMirrorSessionIdForFileId = () => "E1";
  await G.__dl("output:0");
  ck("(1) 결과 존재+excelId일치 → 결과 URL", G.captured && G.captured.url === "/api/workbooks/download/RID1", G.captured);

  // 2) excelId 직접 불일치지만 fileIdForExcelMirrorId 로 매핑 → 결과 URL
  reset();
  G.window.lastRunnerOutputs = [{ excelId: "E9", downloadId: "RID2", downloadUrl: "/api/workbooks/download/RID2" }];
  G.excelMirrorSessionIdForFileId = () => "Elive";      // 직접 일치 안 함
  G.fileIdForExcelMirrorId = (eid) => (eid === "E9" ? "input:매출.xlsx" : null);
  await G.__dl("input:매출.xlsx");
  ck("(2) fileId 매핑으로 결과 URL", G.captured && G.captured.url === "/api/workbooks/download/RID2", G.captured);

  // 3) downloadUrl 없고 downloadId 만 있어도 /api/workbooks/download/{id} 구성
  reset();
  G.window.lastRunnerOutputs = [{ excelId: "E1", downloadId: "RID3" }];
  G.excelMirrorSessionIdForFileId = () => "E1";
  await G.__dl("output:0");
  ck("(3) downloadId만 → /download/RID3 구성", G.captured && G.captured.url === "/api/workbooks/download/RID3", G.captured);

  // 4) 실행 결과 없음 + 라이브 세션 있음 → /api/excel/save 결과(반영본) 다운로드
  reset();
  G.excelMirrorSessionIdForFileId = () => "E1";
  G.postExcelMirror = async () => ({ downloadUrl: "/api/workbooks/download/SAVED" });
  await G.__dl("output:0");
  ck("(4) 결과없음+라이브 → save 결과 URL", G.captured && G.captured.url === "/api/workbooks/download/SAVED", G.captured);

  // 5) 결과·라이브 모두 없음 → 소스(원본) 폴백
  reset();
  G.getFile = () => ({ name: "매출.xlsx", backendWorkbookId: "WID" });
  await G.__dl("input:매출.xlsx");
  ck("(5) 아무것도 없음 → 소스 폴백", G.captured && G.captured.url === "/api/workbooks/source/WID", G.captured);

  // 6) [회귀 방지] 결과가 있으면 소스 URL 로 안 감(핵심: 원본 다운 버그)
  reset();
  G.window.lastRunnerOutputs = [{ excelId: "E1", downloadId: "RID6", downloadUrl: "/api/workbooks/download/RID6" }];
  G.excelMirrorSessionIdForFileId = () => "E1";
  G.getFile = () => ({ name: "매출.xlsx", backendWorkbookId: "WID", backendDownloadUrl: "/api/workbooks/source/WID" });
  await G.__dl("output:0");
  ck("(6) 결과 있으면 소스로 안 감(반영본 우선)", G.captured && G.captured.url === "/api/workbooks/download/RID6", G.captured);

  console.log(`\n=== RESULT: ${fail ? fail + " FAIL" : "ALL PASS"} (${pass}/${pass + fail}) ===`);
  process.exit(fail ? 1 : 0);
})();
