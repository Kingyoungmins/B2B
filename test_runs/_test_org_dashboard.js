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
check("세션 필터에 소속 적용(sessionInOrg)", HTML.includes("sessionInOrg(s, orgv)"));
check("옵션은 세션의 팀 목록으로 채움", HTML.includes("function fillOrgs")
  && HTML.includes("r.team"));
check("구버전 세션(팀 없음)도 그대로 그림('-' 표시)", HTML.includes('s.team || "-"'));

console.log("[4] 이름(마당아이디) 표기");
check("라벨 헬퍼", HTML.includes("function userLabel") && HTML.includes('o.displayName + "(" + o.madangId + ")"'));
check("세션 표 사용자 셀에 적용(원계정은 호버)", HTML.includes('title="${esc(s.user)}">${esc(userLabel(s.user))}'));
check("사용자 표에도 적용", HTML.includes('title="${esc(r.user)}">${esc(userLabel(r.user))}'));
check("오류 표에도 적용", HTML.includes('title="${esc(e.user)}">${esc(userLabel(e.user))}'));
check("사용자 랭킹 차트에도 적용", HTML.includes("C.usersHTML(stats.byUsers || [], activeUser, userLabel)"));
check("사용자 셀렉트 라벨에도 적용", HTML.includes('${esc(userLabel(r.user))}</option>'));

console.log("[5] 소속별 필터 — 전 계층");
check("orgPath 모든 단위로 옵션 구성(회사 제외)", HTML.includes('if (i === 0) return;'));
check("깊이 들여쓰기", HTML.includes('repeat(depth - 1)'));
check("어느 계층이든 매칭(sessionInOrg)", HTML.includes('split(" > ").includes(unit)'));

console.log("[6] 추가 요소");
check("팀별 사용 랭킹 차트", HTML.includes('chartBox("팀별 사용"') && HTML.includes("function teamRankHTML"));
check("팀 막대 클릭=소속 필터", HTML.includes('data-filter-org'));
check("구버전 사용 카드(허용 목록 대조)", HTML.includes('"구버전 사용"') && HTML.includes("function outdatedUsers"));
check("게이트 정보 없으면 카드 생략", HTML.includes("...(outdated ? ["));
check("세션 표 구버전 버전 강조", HTML.includes("허용 버전 목록에 없는 버전"));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
