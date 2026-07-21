// "헬퍼가 있는 것들은 VBA 전환 없이 실행" 검증 + 삭제 부정("삭제하지 마") 오판 수정 검증.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
function slice(a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error("slice fail: " + a);
  return src.slice(i, j);
}
const G = globalThis;
// 슬라이스하지 않는 협력자 스텁
G.routingIntentText = (s) => String(s || "");
G.requestedExcelColumnLetters = () => [];
G.appendSameFormatSheetsIntent = () => false;
G.ctxHelperPreferredIntent = () => false;
G.filterToNewSheetIntent = () => false;
G.multiValueLookupIntent = () => false;

const block =
  slice("function codeUsesSafeCtxHelper", "function pythonComMustUseVbaReason") + "\n" +
  slice("function pythonComMustUseVbaReason", "function isHardPythonComVbaReason") + "\n" +
  slice("function duplicateRowDeleteIntent", "function conditionalRowDeleteIntent") + "\n" +
  slice("function conditionalRowDeleteIntent", "function filterToNewSheetIntent") + "\n" +
  "G.__mustVba = pythonComMustUseVbaReason; G.__dup = duplicateRowDeleteIntent; G.__cond = conditionalRowDeleteIntent; G.__safe = codeUsesSafeCtxHelper;";
eval(block);

let pass = 0, fail = 0;
const ck = (n, c) => { if (c) { pass++; console.log(" OK  " + n); } else { fail++; console.log("FAIL " + n); } };

const CKB = 'def transform(ctx):\n    ctx.copy_key_blocks("a.xlsx!sheet","콜센터","B","B","N","B3:B345","B4:B89")';
const DUP_SRC = "가입번호 병합 블록 전체 복사. 첫 행만 말고 중복이라고 지우지 말고 삭제하지 마. 블록 전체를 넣어줘.";

// (1) 헬퍼(copy_key_blocks) 쓰는 코드는 소스 문구가 뭐든 VBA 강제 안 함
ck("(1) copy_key_blocks 코드 → mustUseVba '' (소스에 삭제어 있어도)", G.__mustVba(CKB, DUP_SRC) === "");
ck("(1b) codeUsesSafeCtxHelper=true", G.__safe(CKB) === true);

// 여러 헬퍼가 다 인식되는지
for (const h of ["copy_values","sort","pivot","filter_to_sheet","fill_sum_col","sum_column","move_col_clear","swap_cols","append_same_format_sheets","shift_months","clear"]) {
  ck(`(1c) ${h} 헬퍼 인식`, G.__safe(`def transform(ctx):\n    ctx.${h}(x)`) === true);
}
// 원시(read/write/book)만 쓰는 코드는 '안전 헬퍼' 아님(정적 게이트가 별도 판단)
ck("(1d) ctx.read/write 만은 safeHelper 아님", G.__safe("def transform(ctx):\n    v=ctx.read('s','A1:Z9')\n    ctx.write('s','A1',v)") === false);

// (2) 삭제 '하지 마' 부정은 삭제 의도 아님
ck("(2) '중복 삭제하지 마' → dup 의도 아님", G.__dup(DUP_SRC) === false);
ck("(2b) '중복 행 삭제하지 마' → dup false", G.__dup("가입번호 중복 행 삭제하지 마") === false);
ck("(2c) '조건 맞는 행 삭제하지 말고' → cond false", G.__cond("A열 조건 맞는 행 삭제하지 말고 복사만 해") === false);

// (3) 진짜 삭제는 그대로 VBA 강제(회귀 방지)
ck("(3) '중복된 행 지워줘' → dup true(진짜 삭제)", G.__dup("중복된 행 지워줘") === true);
ck("(3b) 진짜 중복삭제 코드(헬퍼 미사용) → mustUseVba 사유 있음",
   /중복 행 삭제/.test(G.__mustVba("def transform(ctx):\n    rows=ctx.read('s','A1:A999')\n    # delete loop", "중복된 행 지워줘")));

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
