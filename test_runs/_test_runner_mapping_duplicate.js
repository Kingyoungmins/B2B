// [SBAGENT-293 29단계 실측 2026-08-25] 실행기 자동매칭이 슬롯마다 독립으로 돌아, 이름이 비슷한
// 파일(도서/시내/전력회선 '01. 한전_DAS_배전자동화_…')이 여럿이면 두 슬롯이 같은 파일을 집었다.
// → 1단계와 28단계의 '맨 위 9행 삭제'가 같은 파일에 두 번 적용돼 헤더가 사라지고 29단계 정렬이
//   전멸. 시내 파일은 아무 슬롯도 안 가리켜 companion 으로만 열렸다(로그 확인).
// 수정: ① 자동 후보를 '점수 높은 순'으로 확정해 확신 낮은 슬롯이 선점하지 못하게
//       ② 그래도 겹치면 매핑 화면에 경고(읽기 공유는 정당하므로 차단이 아니라 노출)
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
// 컬럼 0 'function ' 경계 추출(중괄호 카운팅은 함수 안 정규식의 '}' 에 속는다)
function fnSrc(name) {
  const at = src.indexOf("function " + name);
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const nx = src.indexOf("\nfunction ", at + 1);
  const body = src.slice(at, nx < 0 ? src.length : nx);
  return body.slice(0, body.lastIndexOf("\n}") + 2);
}

console.log("[1] 자동매칭 중복 회피 — 두 슬롯이 같은 파일을 집지 않는다(동작 검증)");
{
  const files = [
    { id: "f_dos", file: { name: "도서 01. 한전_DAS_배전자동화_청구세부내역_2026-08-24.xlsx" } },
    { id: "f_sin", file: { name: "시내 01. 한전_DAS_배전자동화_청구세부내역_2026-08-24.xlsx" } },
  ];
  const reqs = [
    { key: "k1", book: "01. 한전_DAS_배전자동화_청구세부내역.xlsx", sheet: "Sheet1" },
    { key: "k2", book: "01. 한전_DAS도서_배전자동화_청구세부내역.xlsx", sheet: "Sheet1" },
  ];
  // 실측 편향 재현: 두 파일 모두 슬롯 이름을 포함해 '일반' 슬롯도 도서 파일을 집으려 든다.
  // 다만 도서 슬롯의 확신(100)이 일반 슬롯(80)보다 높다.
  const stub = [
    "function runnerExtractMappingRequirements() { return REQS; }",
    "function runnerMappingKnownFiles() { return FILES; }",
    "function runnerGeneratedSheetNameSet() { return new Set(); }",
    "function runnerFindAutoFile(req, files) {",
    "  const dos = files.find(f => f.id === 'f_dos');",
    "  const sin = files.find(f => f.id === 'f_sin');",
    "  if (/도서/.test(req.book)) return dos ? { item: dos, score: 100 } : null;",
    "  return dos ? { item: dos, score: 80 } : (sin ? { item: sin, score: 80 } : null);",
    "}",
    "function runnerFindSheet() { return 'Sheet1'; }",
    "function runnerIsSkillDefaultSheet() { return false; }",
    "function runnerMappingNorm(v) { return String(v || '').trim().toLowerCase(); }",
  ].join("\n");
  const build = new Function("REQS", "FILES", "state",
    stub + "\n" + fnSrc("runnerBuildMappingRows") + "\nreturn runnerBuildMappingRows;");
  const rows = build(reqs, files, { runnerMappings: {} })();
  const picked = rows.map(r => r.fileItem && r.fileItem.id);
  check("두 슬롯이 서로 다른 파일에 배정된다  ← 실측 실패 케이스", new Set(picked).size === 2, JSON.stringify(picked));
  check("확신 높은 도서 슬롯이 도서 파일을 갖는다", picked[1] === "f_dos", JSON.stringify(picked));
  check("밀린 일반 슬롯은 남은 시내 파일로", picked[0] === "f_sin", JSON.stringify(picked));
}

console.log("[2] 사용자 지정은 절대 밀리지 않는다");
{
  const files = [
    { id: "f_dos", file: { name: "도서.xlsx" } },
    { id: "f_sin", file: { name: "시내.xlsx" } },
  ];
  const reqs = [
    { key: "k1", book: "A.xlsx", sheet: "Sheet1" },
    { key: "k2", book: "B.xlsx", sheet: "Sheet1" },
  ];
  const stub = [
    "function runnerExtractMappingRequirements() { return REQS; }",
    "function runnerMappingKnownFiles() { return FILES; }",
    "function runnerGeneratedSheetNameSet() { return new Set(); }",
    "function runnerFindAutoFile(req, files) {",
    "  const dos = files.find(f => f.id === 'f_dos');",
    "  return dos ? { item: dos, score: 100 } : null;",   // 자동은 무조건 도서를 원함
    "}",
    "function runnerFindSheet() { return 'Sheet1'; }",
    "function runnerIsSkillDefaultSheet() { return false; }",
    "function runnerMappingNorm(v) { return String(v || '').trim().toLowerCase(); }",
  ].join("\n");
  const build = new Function("REQS", "FILES", "state",
    stub + "\n" + fnSrc("runnerBuildMappingRows") + "\nreturn runnerBuildMappingRows;");
  // k1 을 사용자가 도서로 직접 지정 → k2 의 자동매칭은 도서를 피해야 한다.
  const rows = build(reqs, files, { runnerMappings: { k1: { fileId: "f_dos", userSet: true } } })();
  const picked = rows.map(r => r.fileItem && r.fileItem.id);
  check("사용자 지정 슬롯 유지", picked[0] === "f_dos", JSON.stringify(picked));
  check("자동 슬롯이 사용자 지정 파일을 침범하지 않는다", picked[1] !== "f_dos", JSON.stringify(picked));
  check("정할 수 없으면 미배정(= 파일 선택 필요)으로 남긴다", !picked[1], JSON.stringify(picked));
}

console.log("[3] 그래도 겹치면 매핑 화면에 경고");
{
  const stub2 = "function runnerMappingNorm(v){ return String(v||'').trim().toLowerCase(); }";
  const group = new Function(stub2 + "\n" + fnSrc("runnerGroupMappingRowsByFile") + "\nreturn runnerGroupMappingRowsByFile;")();
  const item = { id: "f_dos", file: { name: "도서.xlsx" } };
  const groups = group([
    { req: { book: "A.xlsx", sheet: "Sheet1" }, fileItem: item, sheet: "Sheet1", status: "ok", userSet: true },
    { req: { book: "B.xlsx", sheet: "Sheet1" }, fileItem: item, sheet: "Sheet1", status: "ok", userSet: true },
  ]);
  check("서로 다른 슬롯이 2그룹으로 잡힌다(빈 배열 거짓 PASS 방지)", groups.length === 2, groups.length);
  check("중복 배정이면 warn", groups.length === 2 && groups.every(g => g.status === "warn"), JSON.stringify(groups.map(g => g.status)));
  check("중복 사유가 보인다", groups.every(g => /중복 배정/.test(g.statusText)), JSON.stringify(groups.map(g => g.statusText)));
  check("어느 슬롯과 겹쳤는지 알려준다", !!(groups[0].duplicateWith || []).includes("B.xlsx"), JSON.stringify(groups[0].duplicateWith));
  const ok = group([{ req: { book: "A.xlsx", sheet: "S" }, fileItem: { id: "x", file: { name: "a" } }, sheet: "S", status: "ok", userSet: true }]);
  check("중복 아니면 기존 상태 유지", ok.length === 1 && ok[0].status === "ok" && !ok[0].duplicateWith, JSON.stringify(ok.map(g => g.status)));
}

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
