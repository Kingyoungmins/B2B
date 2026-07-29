// 실제 noteExcelComTimeout 본문을 소스에서 추출해 '실행'하여 행동을 검증한다.
// (regex 배선이 아니라, 진짜 게이트 순서/카운팅으로 force-restart 가 언제 불리는지 확인)
const fs = require("fs");
const path = require("path");
const ROOT = require("path").resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8");

// noteExcelComTimeout 함수 본문 추출(중괄호 매칭 — CRLF/중첩 안전)
function extractFn(str, name) {
  const start = str.indexOf("function " + name);
  const open = str.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") { depth--; if (depth === 0) return str.slice(start, i + 1); }
  }
  throw new Error("fn not found: " + name);
}
const body = extractFn(src, "noteExcelComTimeout");

let now = 1000000;               // 가짜 시계(Date.now)
let forceRestartCalls = 0;       // forceRestartExcelMirrors 호출 카운트
const globalThisStub = {};       // __excelRecordingActive 토글용

// 하네스: 실제 함수가 참조하는 심볼을 new Function 파라미터로 주입해 그대로 실행
const factory = new Function(
  "Date", "globalThis", "excelMirror", "forceRestartExcelMirrors",
  body + "\nreturn noteExcelComTimeout;"
);
function makeNote() {
  const excelMirror = { applying: false, preopening: false, comTimeoutTimes: [], forceRestartCooldownUntil: 0 };
  const DateStub = { now: () => now };
  const note = factory(DateStub, globalThisStub, excelMirror,
    () => { forceRestartCalls++; return Promise.resolve(true); });
  return { note, excelMirror };
}

const comErr = () => new Error("Excel COM 작업이 30초 안에 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.");

let pass = 0, fail = 0;
const t = (n, c) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n); } };

// ── A. 비녹화: COM 타임아웃 2회(90초 내) → force-restart 1회 발동(기존 동작 유지) ──
{
  forceRestartCalls = 0; now = 1000000;
  const h = makeNote();
  globalThisStub.__excelRecordingActive = false;
  h.note(comErr());            // 1회
  now += 1000;                 // 1초 뒤
  h.note(comErr());            // 2회 → 트립
  t("A 비녹화·90s내 2회 → force-restart 발동(1)", forceRestartCalls === 1);
}

// ── B. 녹화 중: COM 타임아웃 5회를 퍼부어도 force-restart 0회(가드) ──
{
  forceRestartCalls = 0; now = 1000000;
  const h = makeNote();
  globalThisStub.__excelRecordingActive = true;   // 녹화 중
  for (let i = 0; i < 5; i++) { h.note(comErr()); now += 500; }
  t("B 녹화 중 5회 타임아웃 → force-restart 0회", forceRestartCalls === 0);
  t("B2 녹화 중엔 카운터도 안 쌓임(comTimeoutTimes 비어있음)", (h.excelMirror.comTimeoutTimes || []).length === 0);
}

// ── C. COM 타임아웃이 아닌 다른 에러는 녹화 무관하게 무시(기존 동작) ──
{
  forceRestartCalls = 0; now = 1000000;
  const h = makeNote();
  globalThisStub.__excelRecordingActive = false;
  h.note(new Error("subscript out of range"));
  h.note(new Error("HTTP 500"));
  t("C COM 무관 에러는 카운트 안 됨 → force-restart 0", forceRestartCalls === 0);
}

// ── D. 비녹화라도 1회만이면 미발동(2회 임계) ──
{
  forceRestartCalls = 0; now = 1000000;
  const h = makeNote();
  globalThisStub.__excelRecordingActive = false;
  h.note(comErr());
  t("D 비녹화·1회면 미발동", forceRestartCalls === 0);
}

console.log(pass + "/" + (pass + fail) + " PASS");
process.exit(fail ? 1 : 0);
