// [결과 편집하기 → 셀 선택 채팅 미반영] 실측(2026-07-31): 전체실행 후 '결과 편집하기'로 결과를 라이브에
// 불러오면, 보이는 결과 창에서 셀을 선택해도 채팅에 @범위가 안 찍히고, 상단 탭을 한 번 클릭해야 찍혔다.
// 근본: showOnlyExcelMirrorWindow 는 '화면(미러)'만 결과 파일로 바꾸고 앱 탭(state.currentFileId)은 안 바꿈
//   → pollExcelSelection 이 excelId = sessionsByFileId[state.currentFileId](옛 탭 세션) 를 폴링
//   → 사용자가 클릭하는 '보이는 창'과 다른 세션이라 선택 변화가 안 잡힘. 탭 클릭(setCurrentView)이 우연히 고침.
// 수정: edit-result 착지 — setCurrentView(viewFileId, {source:"edit-result"}) 로 탭도 함께 착지 +
//   suppressExcelMirrorSelection + baseline 폴로 '이전 선택' 오발사 방지.
// 검증: excel-viewer.js / excel-mirror.js 의 '실제 함수'를 추출해 게이트 시나리오를 구동하고,
//   pipeline.js 결과편집 핸들러의 착지 배선을 소스에서 확인한다(Excel 불필요).
// 실행: node diagnostics/_test_edit_result_selection_echo.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const viewerSrc = fs.readFileSync(path.join(ROOT, "scripts", "excel-viewer.js"), "utf8");
const mirrorSrc = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8");
const pipelineSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

let pass = 0, fail = 0;
const t = (n, c, got) => {
  if (c) { pass++; console.log("PASS " + n); }
  else { fail++; console.log("FAIL " + n + (got !== undefined ? "  got=" + JSON.stringify(got) : "")); }
};

function extractFn(str, name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(");
  const m = re.exec(str);
  if (!m) throw new Error("not found: " + name);
  const start = m.index;
  let i = start + m[0].length - 1, pd = 0;
  for (; i < str.length; i++) {
    if (str[i] === "(") pd++;
    else if (str[i] === ")") { pd--; if (pd === 0) { i++; break; } }
  }
  const open = str.indexOf("{", i);
  let d = 0;
  for (let j = open; j < str.length; j++) {
    if (str[j] === "{") d++;
    else if (str[j] === "}") { d--; if (d === 0) return str.slice(start, j + 1); }
  }
  throw new Error("unbalanced: " + name);
}

// ── 실제 함수 추출: isExplicitViewSwitchSource / setCurrentView (excel-viewer.js),
//    excelSelectionKey / shouldAppendExcelSelectionFromPoll / fileIdForExcelMirrorId / currentExcelId (excel-mirror.js)
const H = [
  extractFn(viewerSrc, "isExplicitViewSwitchSource"),
  extractFn(viewerSrc, "setCurrentView"),
  extractFn(mirrorSrc, "excelSelectionKey"),
  extractFn(mirrorSrc, "shouldAppendExcelSelectionFromPoll"),
  extractFn(mirrorSrc, "fileIdForExcelMirrorId"),
  extractFn(mirrorSrc, "currentExcelId"),
  extractFn(mirrorSrc, "currentExcelMirrorTarget"),
].join("\n\n") + `
return { isExplicitViewSwitchSource, setCurrentView, shouldAppendExcelSelectionFromPoll, fileIdForExcelMirrorId, currentExcelId };
`;

// setCurrentView 의 렌더/파일 의존 스텁 + excelMirror/state 환경
function makeEnv() {
  const state = { currentFileId: "input1", currentSheet: null, selectedSheets: [], outputTemplates: [], activeOutputIndex: -1 };
  const excelMirror = { sessionsByFileId: { input1: "ex-in", out1: "ex-out" }, activeExcelId: "ex-in", lastSelectionByExcelId: {}, selectionMutedUntil: 0 };
  const env = {
    state, excelMirror,
    getFile: id => ({ id, sheetNames: ["S1"] }),
    renderInputList: () => {}, renderOutputChip: () => {}, refreshTabs: () => {}, renderExcelViewer: () => {},
    activateOutputTemplate: () => {}, outputTemplateFileId: () => null, outputTemplateIndexFromFileId: () => -1,
    Date, Object, String, JSON, Math,
  };
  const api = new Function(...Object.keys(env), H)(...Object.values(env));
  return { state, excelMirror, api };
}

// ── 시나리오: 결과편집 직후(탭=input1, 보이는 창=out1) — 선택 폴 게이트 재현 ──
{
  const { state, excelMirror, api } = makeEnv();
  // pollExcelSelection 의 게이트와 동일: excelId = currentExcelId() = sessionsByFileId[currentFileId]
  const polledExcelId = api.currentExcelId();
  t("버그 재현: 착지 전 selection 폴 대상 = 옛 탭 세션(ex-in) — 보이는 결과 창(ex-out)이 아님",
    polledExcelId === "ex-in", polledExcelId);
  // 사용자가 결과 창(ex-out)에서 셀을 클릭해도, 폴은 ex-in 을 읽으므로 변화 없음 → 채팅 미반영과 동형.

  // 수정: edit-result 착지 — setCurrentView 가 새 소스를 받아들이고 탭을 결과 파일로 바꾼다.
  t("edit-result 는 명시 전환 소스", api.isExplicitViewSwitchSource({ source: "edit-result" }) === true);
  const ok = api.setCurrentView("out1", { source: "edit-result" });
  t("setCurrentView(edit-result) 수행됨", ok === true && state.currentFileId === "out1", state.currentFileId);
  const polledAfter = api.currentExcelId();
  t("착지 후 selection 폴 대상 = 결과 세션(ex-out)", polledAfter === "ex-out", polledAfter);

  // 착지 후 선택 변화 → 채팅 반영(append=true) 흐름
  api.shouldAppendExcelSelectionFromPoll("ex-out", "요약", "$A$5", { baselineOnly: true });   // 착지 baseline
  const noChange = api.shouldAppendExcelSelectionFromPoll("ex-out", "요약", "$A$5", {});
  t("baseline 과 같은 선택은 미반영(오발사 방지)", noChange === false, noChange);
  const changed = api.shouldAppendExcelSelectionFromPoll("ex-out", "요약", "$B$9", {});
  t("사용자 새 선택은 반영(append=true)", changed === true, changed);

  // 무회귀: 임의 소스는 여전히 거부(자동 전환 남발 방지)
  t("무회귀: 임의 소스 전환 거부", api.setCurrentView("input1", { source: "poll" }) === false && state.currentFileId === "out1");
}

// ── 배선 확인: 결과편집 핸들러가 착지(setCurrentView edit-result) + 억제 + baseline 을 수행 ──
{
  const btnIdx = pipelineSrc.indexOf("runner-edit-result-btn");
  const seg = btnIdx >= 0 ? pipelineSrc.slice(btnIdx, btnIdx + 9000) : "";
  t("배선: 결과편집 핸들러 존재", btnIdx >= 0);
  t("배선: setCurrentView(..., source:\"edit-result\") 호출", /setCurrentView\([^)]*edit-result/.test(seg));
  t("배선: suppressExcelMirrorSelection 선호출", /suppressExcelMirrorSelection\(/.test(seg));
  t("배선: scheduleExcelMirrorBaselinePoll 후호출", /scheduleExcelMirrorBaselinePoll\(/.test(seg));
  const iSet = seg.indexOf("edit-result");
  const iShow = seg.indexOf("showOnlyExcelMirrorWindow");
  t("배선: 탭 착지가 showOnly(표시)보다 먼저", iSet >= 0 && iShow > iSet, { iSet, iShow });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
