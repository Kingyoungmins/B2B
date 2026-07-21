// [출력 언어 고정] 4개 시스템 프롬프트 맨 앞에 언어 규칙이 실제로 렌더링되는지 검증.
// 기본 모델(Qwen 계열)이 중국어로 미끄러지는 것을 막는 유일한 제약이므로, 프롬프트를 리팩터링할 때
// 조용히 빠지면 안 된다. 시트명/파일명 원문 보존 예외가 함께 붙는지도 확인(번역 회귀 방지).
// node diagnostics/_test_output_language_rule.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "scripts", "file-schema.js"), "utf8");

// 프롬프트 상수들은 서로를 참조하는 템플릿 리터럴이라, 선언부만 순서대로 평가해 실제 문자열을 얻는다.
const sb = { console };
vm.createContext(sb);
const NAMES = ["OUTPUT_LANGUAGE_RULE", "FORMULA_OVERWRITE_RULE", "PYTHON_EXCEL_SKILL_RULE",
               "VBA_SYSTEM_PROMPT", "PYTHON_COM_SYSTEM_PROMPT", "SYSTEM_PROMPT", "EDIT_SYSTEM_PROMPT"];
for (const name of NAMES) {
  const mk = "const " + name + " = `";
  const st = src.indexOf(mk);
  if (st < 0) { ck("상수 존재: " + name, false, "선언 없음"); continue; }
  // 백틱 리터럴의 끝(이스케이프 안 된 백틱)까지
  let i = st + mk.length;
  for (; i < src.length; i++) {
    if (src[i] === "\\") { i++; continue; }
    if (src[i] === "`") break;
  }
  vm.runInContext(src.slice(st, i + 1) + ";", sb);
}

const RULE = vm.runInContext("typeof OUTPUT_LANGUAGE_RULE === 'string' ? OUTPUT_LANGUAGE_RULE : ''", sb);
ck("(1) OUTPUT_LANGUAGE_RULE 정의됨", RULE.length > 0);
ck("(2) 한국어 출력 지시 포함", /사람이 읽는 모든 문장.*한국어/s.test(RULE), RULE.slice(0, 80));
ck("(3) 생각(reasoning) 과정도 고정", /생각\(reasoning\).*한국어/s.test(RULE));
ck("(4) 중국어 혼입 금지 명시", /중국어/.test(RULE) && /한자/.test(RULE));
ck("(5) 시트명·파일명 원문 보존 예외(번역 회귀 방지)",
   /파일명.*시트명/s.test(RULE) && /번역.*금지/s.test(RULE));

// 4개 프롬프트 각각의 '맨 앞'에 규칙이 있어야 한다 — 뒤쪽에 묻히면 장문 프롬프트에서 효력이 약하다.
const HEAD_WINDOW = 400;   // 앞부분 이 정도 안에 들어와야 '맨 앞'으로 인정
[["VBA_SYSTEM_PROMPT", "VBA 생성"],
 ["PYTHON_COM_SYSTEM_PROMPT", "Python COM 생성"],
 ["SYSTEM_PROMPT", "스킬 생성"],
 ["EDIT_SYSTEM_PROMPT", "단계 수정"]].forEach(([name, label], idx) => {
  const val = vm.runInContext(`typeof ${name} === 'string' ? ${name} : ''`, sb);
  const pos = val.indexOf("## 출력 언어");
  ck(`(${6 + idx}) ${label}(${name}) 맨 앞에 언어 규칙`,
     pos >= 0 && pos < HEAD_WINDOW, pos < 0 ? "없음" : "pos=" + pos);
});

// 회귀 방지: 기존 '시트명 원문 복사' 규칙이 살아 있어야 한다(언어 규칙이 이를 덮어쓰면 안 됨).
const PY = vm.runInContext("typeof SYSTEM_PROMPT === 'string' ? SYSTEM_PROMPT : ''", sb);
ck("(10) 기존 시트명 정확복사 규칙 유지",
   /문자 하나까지 정확히 복사|exactly/i.test(PY));

// 인라인 시스템 프롬프트(검증자 되물음·오류 설명)도 같은 규칙을 참조해야 한다 — 둘 다 사용자가
// 그대로 읽는 문장이고 생각 트레이스도 화면에 노출된다.
[["scripts/chat-ui.js", "clarify 검증자"], ["scripts/pipeline.js", "오류 설명"]].forEach(([f, label], i) => {
  const t = fs.readFileSync(path.join(ROOT, f), "utf8");
  ck(`(${11 + i}) ${label} 인라인 프롬프트도 언어 규칙 참조`,
     /typeof OUTPUT_LANGUAGE_RULE === "string" \? OUTPUT_LANGUAGE_RULE : ""/.test(t));
});

// 로드 순서: file-schema.js 가 이 둘보다 먼저여야 상수가 초기화돼 있다.
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const at = n => html.indexOf(`scripts/${n}`);
  ck("(13) index.html 로드 순서(file-schema 우선)",
     at("file-schema.js") >= 0 && at("file-schema.js") < at("chat-ui.js")
     && at("file-schema.js") < at("pipeline.js"));
}

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
