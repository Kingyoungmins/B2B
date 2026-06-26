// [사용자 지시] 채팅/에러복구창에서 python·COM 을 명시하면 VBA 기본값보다 최우선으로 python 라우팅.
// userExplicitlyRequestsPython 감지 + (explicitVba 우선) 정밀도 검증.
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const s = src.indexOf("function userExplicitlyRequestsVba");
const e = src.indexOf("function exactSheetNamesFromMentions");
if (s < 0 || e < 0) { console.error("앵커 함수를 못 찾음"); process.exit(2); }
eval(src.slice(s, e));

let pass = 0, fail = 0;
const ck = (n, c) => { (c ? pass++ : fail++); console.log((c ? " OK  " : "FAIL ") + n); };

// 명시적 python/COM → true
ck("'python으로 짜줘'", userExplicitlyRequestsPython("이 작업 python으로 짜줘") === true);
ck("'파이썬으로 작성'", userExplicitlyRequestsPython("파이썬으로 작성해줘") === true);
ck("'COM으로 짜줘'", userExplicitlyRequestsPython("COM으로 짜줘") === true);
ck("'py로 해줘'", userExplicitlyRequestsPython("py로 해줘") === true);
ck("'python' 단독", userExplicitlyRequestsPython("python") === true);
ck("def transform(ctx) 포함", userExplicitlyRequestsPython("def transform(ctx):") === true);

// 비명시 → false (오탐 방지)
ck("'매출 합산해줘'", userExplicitlyRequestsPython("매출 합산해줘") === false);
ck("'천단위 콤마'", userExplicitlyRequestsPython("천단위 콤마 회계처리") === false);
ck("'command 실행'", userExplicitlyRequestsPython("command 실행") === false);
ck("'comma 서식'", userExplicitlyRequestsPython("comma 서식") === false);

// 우선순위: explicitPython = !explicitVba && py (메인 플로우 inline 로직과 동일)
const expl = (m) => { const v = userExplicitlyRequestsVba(m); return { v, p: !v && userExplicitlyRequestsPython(m) }; };
ck("'python으로' → python, not vba", (() => { const r = expl("python으로 짜줘"); return r.p === true && r.v === false; })());
ck("'vba로' → vba, not python", (() => { const r = expl("vba로 짜줘"); return r.v === true && r.p === false; })());
ck("'python 말고 vba로' → vba 우선", (() => { const r = expl("python 말고 vba로 짜줘"); return r.v === true && r.p === false; })());

console.log("\n=== RESULT: " + pass + " PASS / " + fail + " FAIL ===");
process.exit(fail ? 2 : 0);
