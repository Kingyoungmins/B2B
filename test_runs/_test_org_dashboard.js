// [0.8.3 조직 정보 — 대시보드] 조직(팀) 열·필터가 실제로 배선됐는지.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "dashboard.html"), "utf8");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 필터 바 — 조직/팀 셀렉트");
check("f-org 셀렉트 존재", HTML.includes('id="f-org"'));
check("변경 즉시 재조회", HTML.includes('$("f-org").onchange = load'));
check("필터 칩(해제 UI)", HTML.includes('"조직: " + $("f-org").value'));

console.log("[2] 세션 표 — 조직(팀) 열");
check("머리글에 조직(팀)", /<th>사용자<\/th><th>조직\(팀\)<\/th>/.test(HTML));
check("셀에 팀 표시 + 마우스오버로 전체 경로", HTML.includes('title="${esc(s.orgPath || "")}"')
  && HTML.includes('${esc(s.team || "-")}'));
check("빈 행 colspan 11 로 갱신", HTML.includes('colspan="11"'));

console.log("[3] 데이터 배선");
check("세션 필터에 team 적용", HTML.includes("s.team === orgv"));
check("옵션은 세션의 팀 목록으로 채움", HTML.includes("function fillOrgs")
  && HTML.includes("r.team"));
check("구버전 세션(팀 없음)도 그대로 그림('-' 표시)", HTML.includes('s.team || "-"'));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
