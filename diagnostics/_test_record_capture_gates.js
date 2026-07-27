// [회귀] 녹화 관련 두 실측 버그의 가드 검증 (오프라인 — LLM 불필요)
//
// A. 녹화중 복붙 캡처 이중 주입: 녹화 VBA + 캡처 스텝으로 같은 복붙이 스킬에 두 번 들어감
//    → 클라 버튼 잠금(setUi) + onclick 가드 + 서버 handle_excel_capture_copypaste 거부 3중 게이트.
// B. 분할 LLM 이 창 전환 직후 원본에 없던 Sheets("X").Select 를 합성 → 그 창에 X 시트가 없어
//    subscript out of range(실측: 정산서 창 + 청구내역 Select) → _stripSynthesizedSheetSelects 세정.
//
// 실행: node diagnostics/_test_record_capture_gates.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass += 1; console.log("PASS " + name); }
  else { fail += 1; console.log("FAIL " + name); }
}

// ---------- B. 세정기 유닛 (실제 record-review.js 로드) ----------
const P = new Proxy(function () {}, { get: () => P, apply: () => P, construct: () => P });
globalThis.document = P; globalThis.window = globalThis; globalThis.toast = () => {};
globalThis.escapeHtml = (x) => String(x == null ? "" : x); globalThis.uid = () => "x";
globalThis.callLLMOneShot = async () => { throw new Error("no-llm"); };
eval(fs.readFileSync(path.join(ROOT, "scripts", "record-review.js"), "utf8")
  + "\n;globalThis.__T={_stripSynthesizedSheetSelects};");
const F = globalThis.__T;

// 실측 사고 재구성 원본(교차창, 원본엔 시트 Select 없음 — MS 레코더 실제 출력 형태)
const REC_CROSSWIN = [
  'Sub B2BSkill()',
  '    Windows("input_v056_청구내역.xlsx").Activate',
  '    Range("A1:G13").Copy',
  '    Windows("input_v056_정산서.xlsx").Activate',
  '    Range("E1").Select',
  '    ActiveSheet.Paste',
  '    Range("K2:K13").Copy',
  'End Sub'].join("\n");
// 새시트 rename 원본(리터럴 Select 없음, .Name="요약" 만)
const REC_RENAME = [
  'Sub B2BSkill()',
  '    Sheets.Add After:=ActiveSheet',
  '    B2B_NewSheet1 = ActiveSheet.Name',
  '    Sheets(B2B_NewSheet1).Select',
  '    Sheets(B2B_NewSheet1).Name = "요약"',
  '    ActiveCell.FormulaR1C1 = "제목"',
  'End Sub'].join("\n");

// 1. 실측 사고 조각: 정산서 창 + 청구내역 Select → 제거돼야 함
const bad = 'Sub B2BSkill()\n    Windows("input_v056_정산서.xlsx").Activate\n    Sheets("청구내역").Select\n    Range("K2:K13").Copy\nEnd Sub';
t("B1 사고조각 stale Select 제거",
  !/Sheets\("청구내역"\)/.test(F._stripSynthesizedSheetSelects(bad, REC_CROSSWIN, "input_v056_정산서.xlsx")));
// 2. 올바른 창의 정당 Select 보존
const orig2 = 'Sub B2BSkill()\n    Windows("a.xlsx").Activate\n    Sheets("요약").Select\n    Range("A1").Copy\nEnd Sub';
t("B2 정당 (창,시트) Select 보존",
  /Sheets\("요약"\)\.Select/.test(F._stripSynthesizedSheetSelects(orig2, orig2, "a.xlsx")));
// 3. rename 확정이름 Select 보존(프롬프트가 rename 후 확정 이름 사용을 지시 — 합법 합성)
const chunkRename = 'Sub B2BSkill()\n    Sheets("요약").Select\n    Range("A1").Select\n    ActiveCell.FormulaR1C1 = "제목"\nEnd Sub';
t("B3 rename 확정이름 Select 보존",
  /Sheets\("요약"\)\.Select/.test(F._stripSynthesizedSheetSelects(chunkRename, REC_RENAME, "")));
// 4. 참조만 된 시트의 Select 보존(원본 Sheets("단가표").Range 참조)
const orig4 = 'Sub B2BSkill()\n    Sheets("단가표").Range("A1").Copy\nEnd Sub';
const chunk4 = 'Sub B2BSkill()\n    Sheets("단가표").Select\n    Range("A1").Copy\nEnd Sub';
t("B4 참조된 시트 Select 보존",
  /Sheets\("단가표"\)\.Select/.test(F._stripSynthesizedSheetSelects(chunk4, orig4, "")));
// 5. 타창 구간에만 있던 시트의 교차창 Select → 제거(엄격 (창,시트) 쌍 검사)
const orig5 = 'Sub B2BSkill()\n    Windows("a.xlsx").Activate\n    Sheets("정산").Select\n    Windows("b.xlsx").Activate\n    Range("A1").Copy\nEnd Sub';
const chunk5 = 'Sub B2BSkill()\n    Windows("b.xlsx").Activate\n    Sheets("정산").Select\n    Range("A1").Copy\nEnd Sub';
t("B5 타창 시트의 교차창 Select 제거",
  !/Sheets\("정산"\)\.Select/.test(F._stripSynthesizedSheetSelects(chunk5, orig5, "a.xlsx")));
// 6. 동적 변수 Select(B2B_NewSheetN)는 비간섭
const chunk6 = 'Sub B2BSkill()\n    Sheets.Add After:=ActiveSheet\n    B2B_NewSheet1 = ActiveSheet.Name\n    Sheets(B2B_NewSheet1).Select\nEnd Sub';
t("B6 동적 변수 Select 비간섭",
  /Sheets\(B2B_NewSheet1\)\.Select/.test(F._stripSynthesizedSheetSelects(chunk6, REC_RENAME, "")));
// 7. 세정기가 llmSplitRecordedVba 에 실제 배선돼 있는가(소스 검사)
const rr = fs.readFileSync(path.join(ROOT, "scripts", "record-review.js"), "utf8");
t("B7 세정기 분할함수 배선", /cleaned\.push\(_stripSynthesizedSheetSelects\(/.test(rr));
// 8-10. [클립보드 원자성] 붙여넣기 조각에 선행 복사 없으면 직전 조각과 병합 — 조각 사이
// 모듈 주입이 클립보드를 초기화해 Paste 1004 로 죽는다(실측 12:51 step4).
eval("globalThis.__T2={_chunkNeedsClipboard,_mergeVbaChunkPair};");
const F2 = globalThis.__T2;
t("B8 고아 붙여넣기 감지",
  F2._chunkNeedsClipboard('Sub B2BSkill()\n    Range("J1").Select\n    ActiveSheet.Paste\nEnd Sub')
  && !F2._chunkNeedsClipboard('Sub B2BSkill()\n    Range("A1:H13").Copy\n    Range("J1").Select\n    ActiveSheet.Paste\nEnd Sub')
  && !F2._chunkNeedsClipboard('Sub B2BSkill()\n    Range("A1").Select\nEnd Sub'));
const merged = F2._mergeVbaChunkPair(
  'Sub B2BSkill()\n    Range("A1:H13").Copy\nEnd Sub',
  'Sub B2BSkill()\n    Range("J1").Select\n    ActiveSheet.Paste\nEnd Sub');
t("B9 병합 결과 단일 Sub + 순서 보존",
  (merged.match(/Sub\s+B2BSkill/gi) || []).length === 1
  && (merged.match(/End\s+Sub/gi) || []).length === 1
  && merged.indexOf(".Copy") < merged.indexOf(".Paste")
  && !F2._chunkNeedsClipboard(merged));
t("B10 병합 패스 분할함수 배선", /_mergeVbaChunkPair\(cleaned\[mi - 1\], cleaned\[mi\]\)/.test(rr));

// ---------- A. 녹화중 캡처 게이트 (소스 검사) ----------
const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
t("A1 클라 전역 플래그 동기화(setUi)", /globalThis\.__excelRecordingActive = recording/.test(pj));
t("A2 캡처 버튼 잠금(setUi)", /cap\.disabled = recording/.test(pj));
t("A3 캡처 onclick 가드", /globalThis\.__excelRecordingActive\)\s*\{\s*\n?\s*toast\("녹화 중에는 복붙 캡처/.test(pj));
const py = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8");
t("A4 서버 캡처 거부 게이트", /def handle_excel_capture_copypaste[\s\S]{0,1200}excel_record_status\(\)\.get\("recording"\)[\s\S]{0,600}녹화 중에는 복붙 캡처/.test(py));

console.log(pass + "/" + (pass + fail) + " PASS");
process.exit(fail ? 1 : 0);
