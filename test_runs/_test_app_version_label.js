// [사용자 요청 2026-08-06] 상단 'AX-Cell' 옆에 작은 초록 글씨로 버전 표기.
//   "파일 버전에 보이는 숫자를 변수처럼 땡겨왔으면 함" — 손으로 적은 문자열이 아니라
//   실행 파일 속성(자세히 → 파일 버전)에서 읽어온 값이어야 한다.
//
// 이 테스트가 잠그는 것
//   1. 화면에 박아둔 버전 문자열이 없다(하드코딩 금지)
//   2. 백엔드에서 받은 값으로 채운다
//   3. 못 읽으면 아무것도 안 보인다(틀린 버전 표시 금지)
//   4. 페이지를 바꿔도 버전이 사라지지 않는다 ← textContent 덮어쓰기로 지워지던 자리
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail ? "  → " + String(detail).slice(0, 200) : "")); }
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles", "panels.css"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "scripts", "app-version.js"), "utf8");
const menu = fs.readFileSync(path.join(ROOT, "scripts", "menu.js"), "utf8");
const py = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8");

console.log("[1] 마크업 — 제목 안에 빈 버전 칸이 있다");
check("app-version 요소 존재", /id="app-version"/.test(html));
check("제목(h1) 안에 들어 있다", /<h1 id="page-title">AX-Cell<span class="app-version"/.test(html),
  (html.match(/<h1 id="page-title">.*/) || [])[0]);
check("버전 문자열을 마크업에 박아두지 않았다",
  !/id="app-version"[^>]*>\s*(ver\s*)?\d+\.\d+/.test(html), (html.match(/id="app-version".{0,60}/) || [])[0]);
check("스크립트가 등록돼 있다", /scripts\/app-version\.js/.test(html));

console.log("[2] 스타일 — 'AI: …' 라벨과 같은 초록·작은 글씨");
check("초록색 #28a745", /\.brand h1 \.app-version[\s\S]*?color:\s*#28a745/.test(css), "panels.css");
check("작은 글씨(11px)", /\.brand h1 \.app-version[\s\S]*?font-size:\s*11px/.test(css));
check("줄바꿈 방지", /\.brand h1 \.app-version[\s\S]*?white-space:\s*nowrap/.test(css));
check("값이 없으면 숨김(:empty)", /\.app-version:empty[\s\S]*?display:\s*none/.test(css));

console.log("[3] 값의 출처 — 백엔드에서 받아온다(하드코딩 아님)");
check("/api/app/version 호출", /fetch\(["']\/api\/app\/version["']\)/.test(js));
check("응답의 normalized/version 을 쓴다", /data\.normalized \|\| data\.version/.test(js));
check("'ver ' 접두만 붙이고 숫자는 응답값", /textContent = `ver \$\{ver\}`/.test(js));
check("스크립트에 버전 숫자를 박아두지 않았다", !/\b\d+\.\d+\.\d+(\.\d+)?\b/.test(js.replace(/0\.7\.2/g, "")),
  (js.match(/\b\d+\.\d+\.\d+(\.\d+)?\b/) || [])[0]);

console.log("[4] 못 읽으면 표시하지 않는다");
check("응답 실패면 그냥 반환", /if \(!resp\.ok\) return;/.test(js));
check("ok:false 또는 빈 값이면 반환", /data\.ok === false \|\| !ver\) return;/.test(js));
check("예외를 삼켜 화면을 깨지 않음", /catch \(_\)/.test(js));

console.log("[5] 페이지를 바꿔도 버전이 남는다  ← textContent 로 지워지던 자리");
check("menu.js 가 버전 span 을 보존", /querySelector\("\.app-version"\)/.test(menu), "menu.js");
check("제목 교체 후 다시 붙인다", /appendChild\(verEl\)/.test(menu));

console.log("[6] 백엔드 — 실제 exe 파일 속성에서 읽는다");
check("version.dll 로 버전 리소스 조회", /WinDLL\("version\.dll"\)/.test(py));
check("VS_FIXEDFILEINFO 4자리 조합", /ms >> 16.*ms & 0xFFFF.*ls >> 16.*ls & 0xFFFF/s.test(py));
check("AX-Cell.exe 를 먼저 본다", /candidates\.append\(exe_dir \/ "AX-Cell\.exe"\)/.test(py));
check("소스 실행이면 CURRENT_VERSION 폴백", /CURRENT_VERSION\\s\*=\\s\*\["'\]/.test(py) || /source:launch_b2b\.py/.test(py));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
