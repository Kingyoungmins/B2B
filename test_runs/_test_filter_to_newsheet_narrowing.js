// [회귀 #2] filterToNewSheetIntent 좁히기 검증.
// 목적: "조건으로 행을 걸러 새 시트로" 같은 진짜 필터/추출만 VBA 강제(true)이고,
//       "새 시트에 복사/작성/붙여넣기" 같은 단순 복사는 강제하지 않는다(false → 네이티브 ctx.copy/기본 경로).
const fs = require("fs");
const path = require("path");

function loadFilterFn() {
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
  const start = src.indexOf("function userExplicitlyRequestsVba");
  const end = src.indexOf("function buildPythonStaticSafetyRegenPrompt", start);
  let block = src.slice(start, end);
  block += "\nglobalThis.__filterFn = filterToNewSheetIntent;";
  eval(block);
  return globalThis.__filterFn;
}

const filter = loadFilterFn();
let pass = 0, fail = 0;
function ck(name, cond) {
  if (cond) { pass += 1; console.log(" OK  " + name); }
  else { fail += 1; console.log("FAIL " + name); }
}

// ── 진짜 필터/추출 → 반드시 VBA(true) 유지 ──────────────────────────────
ck("[유지] 특정 값을 찾아서 새 시트로(대용량 필터)",
   filter("c열 값들 중 '611769344898'인 값들을 찾아서 새 시트에 만들어줘") === true);
ck("[유지] 조건에 맞는 행을 새 시트로 추출",
   filter("조건에 맞는 행만 새 시트로 추출해줘") === true);
ck("[유지] 특정 값 행만 골라 별도 시트",
   filter("E열이 안전제일인 행만 골라 별도 시트에 모아줘") === true);
ck("[유지] 필터해서 새 탭",
   filter("매출 100 이상만 필터해서 새 탭에 정리") === true);
ck("[유지] 큰 숫자 식별자 매칭 추출",
   filter("계약번호 500255622398 인 행을 찾아 새 시트에 복사") === true);

// ── 단순 복사/작성 → 더 이상 VBA 강제 안 함(false) ──────────────────────
ck("[해제] 시트를 새 시트에 그대로 복사",
   filter("이 시트를 새 시트에 복사해줘") === false);
ck("[해제] 같은 형식으로 새 시트에 작성",
   filter("같은 형식으로 새 시트에 작성해줘") === false);
ck("[해제] 데이터를 새 시트에 붙여넣기",
   filter("데이터를 새 시트에 붙여넣어줘") === false);
ck("[해제] 동일 레이아웃을 새 시트로 옮겨",
   filter("동일한 레이아웃을 새 시트로 옮겨줘") === false);

// ── 새 시트 목적지가 아니면 무조건 false ───────────────────────────────
ck("[비대상] 새 시트 언급 없는 필터(행 삭제)",
   filter("조건에 맞는 행을 삭제해줘") === false);
ck("[비대상] 특정 값 찾기만(목적지 없음)",
   filter("'611769344898' 값을 찾아줘") === false);

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
