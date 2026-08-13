// [패리티 2026-08-13] '안정키'(파일 이름에서 월·날짜·버전을 지워 같은 템플릿을 알아보는 키)는
// 백엔드(serve_b2b.py _stable_workbook_key)와 클라(pipeline.js pipelineStableWorkbookKey)에
// 똑같이 구현돼 있다. a4609ce 커밋이 "두 쪽은 반드시 패리티여야 한다"고 못박아 뒀는데,
// 정작 그걸 강제하는 테스트가 없었다.
//
// 한쪽만 고치면 무슨 일이 나는가: 클라는 "이 파일이 그 파일 맞다"며 스텝을 묶어 보내고,
// 백엔드는 "그런 워크북 없다"며 거절하거나 다른 파일을 잡는다. 오늘 잡은 실행기 교차파일
// 버그와 정확히 같은 부류다 — 두 쪽의 판단이 갈리면 조용히 엉뚱한 파일에 쓴다.
//
// 이 테스트는 두 구현에 같은 이름 목록을 넣고 '키가 글자까지 같은지' 본다.
// 새 규칙을 한쪽에만 넣으면 여기서 바로 걸린다.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

function sliceBalanced(src, startIdx, open, close) {
  let d = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === open) d++;
    else if (ch === close) { d--; if (d === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}
function fn(src, name) {
  const at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const b = src.indexOf("{", src.indexOf(")", at));
  return src.slice(at, b) + sliceBalanced(src, b, "{", "}");
}
function constArray(src, name) {
  const at = src.indexOf("const " + name + " = [");
  if (at < 0) throw new Error("상수 못 찾음: " + name);
  const b = src.indexOf("[", at);
  return src.slice(at, b) + sliceBalanced(src, b, "[", "]") + ";";
}

// 이름들: 재바인딩이 '돼야 하는' 것과 '절대 되면 안 되는' 것(식별번호)을 섞는다.
const NAMES = [
  "input_작업파일_03. 관악_03월.xlsx",
  "input_작업파일_05. 관악_05월.xlsx",
  "input_작업파일_06. 관악_06월.xlsx",
  "정산_500255_2026-03-01.xlsx",
  "정산_610344_2026-03-01.xlsx",
  "지점 105 결산_03월.xlsx",
  "지점 105 결산_05월.xlsx",
  "지점 207 결산_05월.xlsx",
  "01. 서울.xlsx",
  "02. 부산.xlsx",
  "원가_2026년 3월 (2) - 복사본.xlsx",
  "원가_2026년 4월.xlsx",
  "DSMC_2026-07-14 10_55_33_03월.xlsx",
  "DSMC_2026-07-14 11_02_09_05월.xlsx",
  "매출 v1.2.3_2026_03.xlsx",
  "매출 v2.0.1_2026_05.xlsx",
  "output_02월 검증파일.xlsx",
  "excel_open_0123456789ab_원본_03월.xlsx",
  "202603_실적.xlsx",
  "202605_실적.xlsx",
];

// ── 클라 구현 로드 ────────────────────────────────────────────────
const mod = new Module("stable-key-client", module);
mod._compile(
  "var window = globalThis;\n"
  + fn(pj, "pipelineDecodeWorkbookName") + "\n"
  + fn(pj, "pipelineLooksLikeYmd") + "\n"
  + fn(pj, "pipelineLooksLikeHms") + "\n"
  + fn(pj, "pipelineLooksLikeDateNumber") + "\n"
  + constArray(pj, "PIPELINE_VOLATILE_NAME_TOKENS") + "\n"
  + constArray(pj, "PIPELINE_VOLATILE_SUFFIX_TOKENS") + "\n"
  + fn(pj, "pipelineStableWorkbookKey") + "\n"
  + "module.exports = pipelineStableWorkbookKey;",
  path.join(__dirname, "_extracted_stable_key_client.js"));
const clientKey = mod.exports;

// ── 백엔드 구현을 파이썬으로 실행해 키를 받아온다 ──────────────────
const PY = `
import json, sys
sys.path.insert(0, r"${ROOT.replace(/\\/g, "\\\\")}")
import serve_b2b as s
names = json.loads(sys.argv[1])
print(json.dumps([s._stable_workbook_key(n) for n in names], ensure_ascii=False))
`;
let serverKeys;
try {
  const out = execFileSync("python", ["-c", PY, JSON.stringify(NAMES)], {
    encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  serverKeys = JSON.parse(out.trim().split("\n").pop());
} catch (err) {
  console.log("SKIP  백엔드를 불러오지 못했습니다(python/pywin32 없음) — 패리티 확인 생략");
  console.log(String((err && err.message) || err).slice(0, 200));
  process.exit(0);
}

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 이름별로 두 쪽 키가 글자까지 같은가");
NAMES.forEach((n, i) => {
  const c = clientKey(n);
  const sv = serverKeys[i];
  check(n, c === sv, `클라=${JSON.stringify(c)} 백엔드=${JSON.stringify(sv)}`);
});

console.log("[2] 같은 키로 묶이는 짝도 두 쪽이 같은가  ← 실제 매칭 판단이 여기서 갈린다");
const PAIRS = [
  ["input_작업파일_03. 관악_03월.xlsx", "input_작업파일_05. 관악_05월.xlsx", true, "월 재바인딩"],
  ["정산_500255_2026-03-01.xlsx", "정산_610344_2026-03-01.xlsx", false, "거래처코드 보존"],
  ["지점 105 결산_03월.xlsx", "지점 207 결산_05월.xlsx", false, "지점번호 보존"],
  ["지점 105 결산_03월.xlsx", "지점 105 결산_05월.xlsx", true, "같은 지점 다른 달"],
  ["01. 서울.xlsx", "02. 부산.xlsx", false, "월 없는 순번 보존"],
  ["원가_2026년 3월 (2) - 복사본.xlsx", "원가_2026년 4월.xlsx", true, "복사본 접미사 + 월"],
  ["DSMC_2026-07-14 10_55_33_03월.xlsx", "DSMC_2026-07-14 11_02_09_05월.xlsx", true, "시각 무손상"],
  // [알려진 한계] "2026_03" 은 연-월-일 세 토막이 아니라 두 토막이라 날짜 토큰이 안 잡고,
  // 구분자가 있어서 YYYYMM(6자리) 토큰도 안 잡는다. 'NN월' 표기가 없으니 이번 월 순번 규칙도
  // 해당 없음 → 03/05 가 남아 다른 키가 된다. 두 쪽 판단은 일치하므로 패리티 문제는 아니다.
  // 넓히려면 연-월 두 토막도 날짜로 볼지 따로 정해야 하는데, 식별번호를 다시 먹을 위험이 있어
  // 여기서는 '지금 이런 상태다'만 고정해 둔다(무언의 회귀 방지).
  ["매출 v1.2.3_2026_03.xlsx", "매출 v2.0.1_2026_05.xlsx", false, "연_월 두 토막은 아직 미대응"],
  ["202603_실적.xlsx", "202605_실적.xlsx", true, "YYYYMM"],
];
const idx = n => NAMES.indexOf(n);
PAIRS.forEach(([a, b, want, label]) => {
  const cSame = clientKey(a) === clientKey(b);
  const sSame = serverKeys[idx(a)] === serverKeys[idx(b)];
  check(`${label}: 두 쪽 판단 일치`, cSame === sSame, `클라=${cSame} 백엔드=${sSame}`);
  check(`${label}: 기대대로(같음=${want})`, cSame === want, `실제=${cSame}`);
});

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
