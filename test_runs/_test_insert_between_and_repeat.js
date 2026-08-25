/* [재발 방지 2026-08-25] 실행: node test_runs/_test_insert_between_and_repeat.js
   ① "Q열과 R열 사이에 열 추가" 가 '열 이동'으로 오라우팅돼 Q 앞에 삽입되던 문제(S·T 로 1회, Q·R 로 2회 재발)
   ② 같은 요청을 다시 보내면 직전 오답 코드를 베끼던 문제([비우기]를 눌러야 고쳐지던 것)
   소스에서 판정 함수만 추출해 '동작'으로 검증한다(레포 diagnostics 관행). */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? "  PASS  " : "  FAIL  ") + name + (!cond && detail ? "  -> " + detail : ""));
  if (!cond) fails += 1;
}

/* 소스에서 함수 본문만 뽑는다(중괄호 균형). */
function grab(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error("함수 없음: " + name);
  let depth = 0, started = false;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") { depth++; started = true; }
    else if (src[i] === "}") { depth--; if (started && depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("본문 끝 없음: " + name);
}

/* ── ① 삽입 vs 이동 라우팅 ─────────────────────────────────────────────── */
console.log("[1] '사이에 추가'는 삽입, '사이로 옮겨'는 이동");
const chatUi = read("scripts/chat-ui.js");
const routing = new Function(
  ["routingIntentText", "columnMoveIntent", "columnCopyClearIntent", "columnSwapIntent", "columnCopyIntent"]
    .map(n => grab(chatUi, n)).join("\n\n") + "\nreturn { columnMoveIntent };"
)();

// want=false : 삽입(또는 이동 아님) 경로여야 정상 / want=true : 열 이동으로 분류돼야 정상
[
  ["Q열과 R열 사이에 열 1개 추가해줘", false, "제보건(2026-08-25)"],
  ["@시트[591812713845.xlsx/VIEW] Q열과 R열 사이에 열 1개 추가해줘", false, "@시트 멘션 포함 원문"],
  ["S열과 T열 사이에 열 1개 추가", false, "1차 사고(같은 원인)"],
  ["Q열과 R열 사이에 열 삽입", false, "삽입어 직접"],
  ["빈 열 하나를 Q열과 R열 사이에 넣어줘", false, "'넣어'지만 출발 열 없음 = 삽입"],
  ["Q열 앞에 열 1개 추가해줘", false, "원래 되던 것(회귀 방지)"],
  ["R열 왼쪽에 열 추가", false, "원래 되던 것(회귀 방지)"],
  ["D열을 Q열과 R열 사이로 옮겨줘", true, "진짜 이동"],
  ["D열을 Q열과 R열 사이에 넣어줘", true, "진짜 이동 — 제외목록 방식이면 여기서 깨진다"],
  ["D열을 맨 앞으로 보내줘", true, "진짜 이동"],
  ["G열을 D열 뒤로 이동", true, "진짜 이동"],
  ["열 순서를 바꿔줘", true, "진짜 이동"],
].forEach(([text, want, note]) => {
  let got;
  try { got = routing.columnMoveIntent(text); } catch (e) { got = "ERR:" + e.message; }
  check(`${want ? "이동" : "삽입"} — ${note}`, got === want, `got=${got} | ${text}`);
});

// 판정 근거가 '위치표현+출발열' 구조인지도 고정한다(제외목록 방식으로 되돌아가는 것을 막는다).
check("위치표현만으로 이동 판정하지 않는다(사이에가 moveVerb 목록에 없음)",
  /const explicitMoveVerb =/.test(chatUi) && /const hasSourceColumn =/.test(chatUi)
  && !/\|사이에\|맞바꾸/.test(chatUi), "구현 방식이 되돌아갔는지 확인");

/* ── ② 같은 요청 반복 감지 ────────────────────────────────────────────── */
console.log("[2] 같은 요청을 다시 보내면 '직전 코드 베끼지 마라'가 붙는다");
const llmApi = read("scripts/llm-api.js");
const repeatFn = grab(llmApi, "_looksLikeRepeatedRequest");
function judgeRepeat(history, text, selfPushed) {
  const state = { chatHistory: history };
  const args = JSON.stringify(text) + ", " + (selfPushed === false ? "false" : "true");
  return new Function("state", repeatFn + "\nreturn _looksLikeRepeatedRequest(" + args + ");")(state);
}
const REQ = "Q열과 R열 사이에 열 1개 추가해줘";
const hist = (...msgs) => msgs.map(m => ({ role: m[0], content: m[1] }));

check("첫 요청은 반복이 아니다",
  judgeRepeat(hist(["user", REQ]), REQ) === false);
check("같은 요청 재전송 → 반복으로 감지",
  judgeRepeat(hist(["user", REQ], ["assistant", "```python\n# 틀린 코드\n```"], ["user", REQ]), REQ) === true);
check("띄어쓰기만 다른 재전송도 감지",
  judgeRepeat(hist(["user", REQ], ["assistant", "x"], ["user", "Q열과 R열 사이에 열 1개  추가해줘"]),
    "Q열과 R열 사이에 열 1개  추가해줘") === true);
check("살짝 덧붙인 재요청도 감지(포함 관계)",
  judgeRepeat(hist(["user", REQ], ["assistant", "x"], ["user", REQ + " 다시"]), REQ + " 다시") === true);
check("다른 요청은 반복 아님",
  judgeRepeat(hist(["user", REQ], ["assistant", "x"], ["user", "A열 삭제해줘"]), "A열 삭제해줘") === false);
check("짧은 말(ㅇㅇ/다시)은 반복 판정에서 제외",
  judgeRepeat(hist(["user", "다시"], ["assistant", "x"], ["user", "다시"]), "다시") === false);
// selfPushed=false : 이번 메시지를 history 에 안 밀어넣은 호출(skipHistoryPush). 이때 마지막 user
// 항목은 '나 자신'이 아니라 진짜 직전 요청이므로 빼면 안 된다 — 빼면 바로 이 재시도를 놓친다.
// ('마지막이 나와 같으면 뺀다' 는 추측으로 구현했다가 이 케이스에서 실패해서 인자로 바꿨다)
check("skipHistoryPush 경로에서도 반복을 잡는다",
  judgeRepeat(hist(["user", REQ], ["assistant", "x"]), REQ, false) === true);
check("push 된 호출은 자기 자신과 비교하지 않는다(첫 요청 오탐 방지)",
  judgeRepeat(hist(["user", REQ]), REQ, true) === false);

check("callLLM 이 반복 감지를 실제로 배선했다(push 여부까지 전달)",
  /_looksLikeRepeatedRequest\(userMessage, !options\.skipHistoryPush\)/.test(llmApi)
  && /같은 요청 반복 \(최우선\)/.test(llmApi));
check("정정 감지(기존 경로)는 그대로 살아 있다",
  /if \(_looksLikeCorrection\(userMessage\)\)/.test(llmApi));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails ? 1 : 0);
