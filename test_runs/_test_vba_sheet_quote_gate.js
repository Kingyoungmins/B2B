// SBAGENT-138: 시트명에 작은따옴표(')가 있으면 VBA 정적 검사기가 시트명을 잘라 오탐하던 버그 회귀.
// 예: "NHN(5분)_'26년04월_사용" → 추출 정규식 ["']([^"']+)["'] 가 ' 에서 끊겨 "NHN(5분)_" 로 오인 → 거절.
// VBA 문자열은 큰따옴표뿐(주석은 이미 제거됨)이므로 "([^"]+)" 로 고쳐 ' 를 보존한다.
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");

// 중괄호 매칭으로 함수 본문 추출(이 함수들엔 정규식/템플릿 안 중괄호가 균형이라 안전).
function extractFn(name) {
  const start = src.indexOf("function " + name);
  if (start < 0) throw new Error("not found: " + name);
  let i = src.indexOf("{", start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced: " + name);
}

const blob = [
  extractFn("exactSheetNamesFromMentions"),
  extractFn("vbaSheetReferenceLiterals"),
  extractFn("vbaExactSheetReferenceFailures"),
  extractFn("_stripVbaCommentsForGate"),
].join("\n\n") +
  "\nglobalThis.API = { fails: vbaExactSheetReferenceFailures, lits: vbaSheetReferenceLiterals, names: exactSheetNamesFromMentions };";
eval(blob);
const API = globalThis.API;

let pass = 0, fail = 0;
const ck = (n, c) => { (c ? pass++ : fail++); console.log((c ? " OK  " : "FAIL ") + n); };

const SHEET = "NHN(5분)_'26년04월_사용";
const source = "선택 범위: @범위[연_LG_요금대사-NHN_판교IDC_10G_6회선_26년05월청구분.xlsx/" + SHEET + "!Q1] 수식을 '=12*24*31'로 변경해줘";

// 멘션 파서가 중간 ' 를 보존해 정확 시트명을 뽑는지
ck("[멘션] 정확 시트명 추출(' 보존)", API.names(source).join("|") === SHEET);

// 신고 케이스: loop + sh.Name = "...'..." (정상 VBA) → 거절되면 안 됨
const codeOk = [
  "Sub B2BSkill()",
  "    Dim wb As Workbook, w As Workbook, ws As Worksheet, sh As Worksheet",
  "    For Each w In Application.Workbooks",
  '        If w.Name = "연_LG_요금대사-NHN_판교IDC_10G_6회선_26년05월청구분.xlsx" Then Set wb = w: Exit For',
  "    Next w",
  "    For Each sh In wb.Worksheets",
  '        If sh.Name = "NHN(5분)_\'26년04월_사용" Then Set ws = sh: Exit For',
  "    Next sh",
  '    ws.Range("Q1").Formula = "=12*24*31"',
  "End Sub",
].join("\n");
ck("[추출] 리터럴에 전체 시트명 포함(' 안 잘림)", API.lits(codeOk).includes(SHEET));
ck("[게이트] 정상 VBA(' 포함 시트명) → 거절 안 함", API.fails(codeOk, source).length === 0);

// 직접 Worksheets("...'...") 형태도
const codeDirect = 'Sub B2BSkill()\n    Worksheets("' + SHEET + '").Range("Q1").Formula = "=1"\nEnd Sub';
ck("[게이트] Worksheets(\"...'...\") 직접접근 → 거절 안 함", API.fails(codeDirect, source).length === 0);

// 회귀: 진짜로 시트명이 잘린(틀린) 코드는 여전히 거절해야 함
const codeWrong = [
  "Sub B2BSkill()",
  "    Dim ws As Worksheet, sh As Worksheet",
  "    For Each sh In ActiveWorkbook.Worksheets",
  '        If sh.Name = "NHN(5분)_" Then Set ws = sh: Exit For',
  "    Next sh",
  "End Sub",
].join("\n");
ck("[회귀] 틀린 시트명(NHN(5분)_)은 여전히 거절", API.fails(codeWrong, source).length > 0);

console.log("\n=== RESULT: " + pass + " PASS / " + fail + " FAIL ===");
process.exit(fail ? 2 : 0);
