// [0.5.16] VBA 게이트: '.Value 배열 라운드트립'(긴 텍스트 EID 손상) 감지 단위테스트.
// chat-ui.js 의 검사 로직과 동일.
function detectsValueArrayMove(text) {
  const arrReadVars = [];
  const arrReadRe = /^[ \t]*([A-Za-z_]\w*)\s*=\s*[^\n]*(?:Cells\s*\([^\n]*Cells\s*\(|Range\s*\([^\n]*:|UsedRange)[^\n]*\.\s*(?:Value|Value2)\s*\r?$/gim;
  let arm;
  while ((arm = arrReadRe.exec(text)) !== null) arrReadVars.push(arm[1]);
  return arrReadVars.some(v =>
    new RegExp("\\.\\s*(?:Value|Value2)\\s*=\\s*" + v + "\\b", "i").test(text));
}

let pass = 0, fail = 0;
function ck(name, cond) { if (cond) { pass++; console.log(" OK  " + name); } else { fail++; console.log("FAIL " + name); } }

// 1) 문제의 Step 18 패턴 — 잡혀야 함
const step18 = [
  "    Dim srcData As Variant",
  "    srcData = wsSrc.Range(wsSrc.Cells(2, 1), wsSrc.Cells(lastRowSrc, lastColSrc)).Value",
  "    Dim destRange As Range",
  "    Set destRange = wsDst.Range(wsDst.Cells(91041, 1), wsDst.Cells(91100, 5))",
  "    destRange.Value = srcData",
].join("\n");
ck("Step18 Value 라운드트립 감지", detectsValueArrayMove(step18) === true);

// 2) UsedRange.Value 라운드트립 — 잡혀야 함
const used = [
  "    arr = ws.UsedRange.Value",
  "    ws2.Range(\"A1\").Resize(UBound(arr,1)).Value = arr",
].join("\n");
ck("UsedRange Value 라운드트립 감지", detectsValueArrayMove(used) === true);

// 3) 스칼라 단일셀 라운드트립 — 잡히면 안 됨(오탐 방지)
const scalar = [
  '    v = ws.Range("A1").Value',
  '    ws2.Range("B1").Value = v',
].join("\n");
ck("스칼라 단일셀은 오탐 안 함", detectsValueArrayMove(scalar) === false);

// 4) 네이티브 Copy(고친 버전) — 잡히면 안 됨
const fixed = [
  "    wsSrc.Range(wsSrc.Cells(2, 1), wsSrc.Cells(lastRowSrc, lastColSrc)).Copy",
  "    wsDst.Cells(91041, 1).PasteSpecial Paste:=xlPasteValuesAndNumberFormats",
].join("\n");
ck("네이티브 Copy/PasteSpecial 은 통과(오탐 없음)", detectsValueArrayMove(fixed) === false);

console.log(`\n=== ${pass}/${pass + fail} PASS ===`);
process.exit(fail ? 1 : 0);
