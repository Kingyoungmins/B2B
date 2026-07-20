// [A안][지라] 스킬 저장 기본 이름이 '마지막 저장 이름'에 고착되지 않고 입력 파일을 따라오는가.
// 사고: 한화테크윈 스킬을 여러 번 저장 → 다른 파일로 새 스킬 만들어도 기본값이 계속 '한화테크윈'.
// node diagnostics/_test_save_name_follows_input.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "save-load.js"), "utf8");
function ex(name) {
  const mk = "function " + name + "(";
  let st = src.indexOf(mk); if (st < 0) throw new Error(name);
  let p = src.indexOf("(", st), pd = 0;
  for (; p < src.length; p++) { if (src[p] === "(") pd++; else if (src[p] === ")") { pd--; if (pd === 0) break; } }
  let i = src.indexOf("{", p), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === "{") d++; else if (src[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(st, e);
}

// 가짜 localStorage
function makeLS() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m };
}

function makeSandbox(inputNames) {
  const sb = {
    console,
    state: { inputs: (inputNames || []).map(n => ({ name: n })), outputTemplates: [], output: null, logicSaveBaseName: "", logicSaveInputSig: "" },
    localStorage: makeLS(),
    workbookDisplayName: (f, fb) => (f && f.name) || fb,
  };
  vm.createContext(sb);
  ["safeLogicBaseName", "stripLogicTimestampSuffix", "currentInputSignature",
   "currentLogicSaveBaseName", "rememberLogicSaveBaseName", "defaultLogicBaseNameFromInputs"]
    .forEach(f => vm.runInContext(ex(f), sb));
  return sb;
}
const dialogDefault = sb => vm.runInContext("currentLogicSaveBaseName(defaultLogicBaseNameFromInputs())", sb);
const save = (sb, name) => vm.runInContext("rememberLogicSaveBaseName(" + JSON.stringify(name) + ")", sb);
const setInputs = (sb, names) => { sb.state.inputs = names.map(n => ({ name: n })); };

// (1) 한화테크윈 파일로 저장을 여러 번
{
  const sb = makeSandbox(["한화테크윈_202605_v1.xlsx"]);
  save(sb, "한화테크윈 정산");
  save(sb, "한화테크윈 정산");
  ck("(1) 같은 입력 재저장 → 이름 유지", dialogDefault(sb) === "한화테크윈 정산", dialogDefault(sb));
}
// (2) [핵심] 그 다음 '다른 파일'로 새 스킬 → 기본값이 입력 파일명(테크윈 아님)
{
  const sb = makeSandbox(["한화테크윈_202605_v1.xlsx"]);
  save(sb, "한화테크윈 정산");
  setInputs(sb, ["삼성전자_매출_202606.xlsx"]);
  // 새 스킬 시작 = 세션 이름도 새로 시작(불러오지 않은 fresh) — 실제로는 새 세션/리셋이지만
  // 세션 유지 채로 파일만 바꾼 케이스도 포함해 검증(state 서명 게이팅).
  const d = dialogDefault(sb);
  ck("(2) 다른 파일 → 기본값이 새 입력 파일명", d === "삼성전자_매출_202606" && !/테크윈/.test(d), d);
}
// (3) 크로스 세션(page reload) 재현: state 비우고 localStorage 만 남음 + 다른 파일
{
  const sb = makeSandbox(["한화테크윈_202605_v1.xlsx"]);
  save(sb, "한화테크윈 정산");
  const persisted = { name: sb.localStorage.getItem("b2b_logic_save_base_name"), sig: sb.localStorage.getItem("b2b_logic_save_input_sig") };
  // 새 세션: state 초기화, localStorage 는 유지, 입력은 삼성
  const sb2 = makeSandbox(["삼성전자_매출_202606.xlsx"]);
  sb2.localStorage.setItem("b2b_logic_save_base_name", persisted.name);
  sb2.localStorage.setItem("b2b_logic_save_input_sig", persisted.sig);
  const d = dialogDefault(sb2);
  ck("(3) 새 세션+다른 파일 → 테크윈 안 따라옴", d === "삼성전자_매출_202606", d);
}
// (4) 크로스 세션 + '같은' 파일 → 마지막 이름 유지(편의 보존)
{
  const sb = makeSandbox(["한화테크윈_202605_v1.xlsx"]);
  save(sb, "한화테크윈 정산");
  const sb2 = makeSandbox(["한화테크윈_202605_v1.xlsx"]);
  sb2.localStorage.setItem("b2b_logic_save_base_name", sb.localStorage.getItem("b2b_logic_save_base_name"));
  sb2.localStorage.setItem("b2b_logic_save_input_sig", sb.localStorage.getItem("b2b_logic_save_input_sig"));
  ck("(4) 새 세션+같은 파일 → 마지막 이름 유지", dialogDefault(sb2) === "한화테크윈 정산", dialogDefault(sb2));
}
// (5) 월 교체(같은 스킬 편집): 세션 유지, 이름 세션에 있고 파일만 달→ 입력 파일명 폴백(테크윈 계열 유지)
{
  const sb = makeSandbox(["한화테크윈_202605_v1.xlsx"]);
  save(sb, "한화테크윈 정산");
  setInputs(sb, ["한화테크윈_202606_v1.xlsx"]);   // 다음 달
  const d = dialogDefault(sb);
  ck("(5) 월 교체 → 새 입력 파일명 제안(테크윈 계열)", d === "한화테크윈_202606_v1" && /테크윈/.test(d), d);
}
// (6) 입력 없이(서명 빈) 상태에서 저장한 이름은 계속 존중
{
  const sb = makeSandbox([]);
  save(sb, "빈입력스킬");
  ck("(6) 입력 없을 때 저장한 이름은 존중", dialogDefault(sb) === "빈입력스킬", dialogDefault(sb));
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
