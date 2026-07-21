// [사용자 지시] Python COM 읽기 한도 초과 런타임 오류는 "에러로 멈추지 말고" 자동으로 VBA 전환 복구한다.
// 그 트리거 판별기 isPythonComReadLimitRuntimeError 가 (a) 런타임 읽기한도 메시지와 (b) 백엔드 정적
// 게이트의 "큰 표를 ctx.read…" 메시지를 잡고, (c) 무관한 오류는 잡지 않는지 검증한다.
const fs = require("fs");
const path = require("path");

function loadDetector() {
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
  const start = src.indexOf("function isPythonComReadLimitRuntimeError");
  const end = src.indexOf("async function requestErrorRecovery", start);
  let block = src.slice(start, end);
  block += "\nglobalThis.__readLimitDetector = isPythonComReadLimitRuntimeError;";
  eval(block);
  return globalThis.__readLimitDetector;
}

const isReadLimit = loadDetector();
let pass = 0, fail = 0;
function ck(name, cond) {
  if (cond) { pass += 1; console.log(" OK  " + name); }
  else { fail += 1; console.log("FAIL " + name); }
}

// (a) 런타임 읽기 한도 초과 메시지(serve_b2b.py:7622) — 자동 VBA 복구 대상
ck("[감지] 런타임 읽기 한도 초과",
   isReadLimit("읽기 범위가 너무 큽니다(10,485,760셀 > 6,000,000). Python COM은 단순 작업용으로 보수적으로 제한됩니다. 범위를 더 좁히거나 VBA 경로를 사용하세요.") === true);
ck("[감지] '단순 작업용으로 보수적으로 제한' 단독",
   isReadLimit("Python COM은 단순 작업용으로 보수적으로 제한됩니다.") === true);

// (b) 백엔드 정적 게이트 거부 메시지(같은 범주: python read 너무 무거움 → VBA)
ck("[감지] 정적 게이트 '큰 표를 ctx.read 로 Python 리스트에 올려'",
   isReadLimit("큰 표를 ctx.read 로 Python 리스트에 올려 가공한 뒤 다시 쓰거나 복사하지 마세요. 대용량 파일에서 WebView/COM 응답이 멈추고…") === true);

// (c) 무관한 오류는 자동 VBA 전환 대상이 아님(false positive 방지)
ck("[비감지] subscript out of range",
   isReadLimit("Subscript out of range (워크시트 '결과' 를 찾을 수 없습니다)") === false);
ck("[비감지] #VALUE! 계산 오류",
   isReadLimit("수식 평가 결과 #VALUE! 오류") === false);
ck("[비감지] 일반 시트 없음",
   isReadLimit("'요약' 시트를 찾지 못했습니다") === false);
ck("[비감지] 빈 메시지", isReadLimit("") === false);
ck("[비감지] null", isReadLimit(null) === false);

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
