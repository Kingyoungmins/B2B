// [0.8.3] F1 기능키 도움말 — 매핑 표가 '실제로 걸려 있는 키'와 일치하는지.
//
// 핵심: 도움말이 코드와 어긋나면 없느니만 못하다. 여기서는 FKEY_MAP 의 키들이
// 실제 핸들러(소스의 e.key === "Fn")와 서로 맞는지 교차 검증한다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "");
const HELP = read("scripts/fkey-help.js");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 도움말 표의 키 ↔ 실제 핸들러 교차 검증");
// 도움말에 적힌 키 목록
const mapped = [...HELP.matchAll(/\["(F\d+)",/g)].map(m => m[1]);
check("표에 키가 있다", mapped.length >= 8, mapped);

// 실제 소스에서 F키 핸들러 수집 (테스트/도움말 자신 제외)
const srcFiles = fs.readdirSync(path.join(ROOT, "scripts"))
  .filter(f => f.endsWith(".js") && f !== "fkey-help.js");
const found = new Set();
for (const f of srcFiles) {
  const s = read(path.join("scripts", f));
  for (const m of s.matchAll(/e(?:vent)?\.key\s*[!=]==?\s*"(F\d+)"/g)) found.add(m[1]);
  for (const m of s.matchAll(/\.key\s*===\s*"(F\d+)"/g)) found.add(m[1]);
}
for (const k of found) {
  check("실제 핸들러 " + k + " 가 표에 있다", mapped.includes(k), [...found].join(","));
}
check("표의 F1 은 이 도움말 자신", mapped.includes("F1"));

console.log("[2] 동작 — 열기/닫기");
check("F1 토글", HELP.includes('e.key === "F1"') && HELP.includes("toggleFkeyHelp"));
check("브라우저 기본 도움말 차단", /F1[\s\S]{0,80}preventDefault/.test(HELP));
check("ESC 로 닫기", HELP.includes('e.key === "Escape"'));
check("바깥 클릭으로 닫기", HELP.includes("e.target === overlay"));
check("다시 누르면 닫힘(토글)", HELP.includes("if (old) { old.remove(); return; }"));

console.log("[3] 연결");
check("index.html 포함", read("index.html").includes("scripts/fkey-help.js"));
check("새 키 추가 시 표도 갱신하라는 안내 주석", HELP.includes("FKEY_MAP 에도 한 줄 추가"));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
