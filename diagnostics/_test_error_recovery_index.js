// [증상 B] resolveErrorRecoveryStepIndex — 식별자가 '있지만 안 맞을' 때 숫자 인덱스 폴백에 도달해야
// isExistingStep=true → editTargetId 유지 → 수정이 in-place 교체(append+번호폭증 방지).
// node diagnostics/_test_error_recovery_index.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
function ex(name) {
  const mk = "function " + name + "(";
  let st = src.indexOf(mk);
  let p = src.indexOf("(", st), pd = 0;
  for (; p < src.length; p++) { if (src[p] === "(") pd++; else if (src[p] === ")") { pd--; if (pd === 0) break; } }
  let i = src.indexOf("{", p), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === "{") d++; else if (src[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(st, e);
}
const sb = { state: { pipeline: [] } };
vm.createContext(sb);
vm.runInContext(ex("resolveErrorRecoveryStepIndex"), sb);
const R = (idx, ei) => vm.runInContext("resolveErrorRecoveryStepIndex(" + JSON.stringify(idx) + "," + JSON.stringify(ei) + ")", sb);
sb.state.pipeline = Array.from({ length: 25 }, (_, i) => ({ id: "s" + (i + 1), code: "CODE" + (i + 1), description: "D" + (i + 1), enabled: true }));

ck("(1) [사고재현] stepId 불일치 + 숫자24 → 24(25단계) 찾음", R(24, { stepId: "live_x", stepIdx: 24 }) === 24, R(24, { stepId: "live_x", stepIdx: 24 }));
ck("(2) code 불일치 + 숫자 → 숫자 폴백", R(24, { code: "다른코드", stepIdx: 24 }) === 24);
ck("(3) 정확 id 일치가 최우선", R(0, { stepId: "s25" }) === 24);
ck("(4) 정확 code 일치", R(0, { code: "CODE10" }) === 9);
ck("(5) 설명 일치 폴백", R(-1, { description: "D7" }) === 6);
ck("(6) 숫자만", R(5, {}) === 5);
ck("(7) 범위 밖 숫자 + 없는 식별자 → -1(신규 추가 의도)", R(99, { stepId: "없음" }) === -1);

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
