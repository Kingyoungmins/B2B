// [사용자 요청 2026-08-10] ① AI 도움 창이 가끔 Excel 창에 가려짐 → 기본 최상단
//                          ② 기본 창 크기 2배
//
// 배경: 네이티브 셸의 AI 도움은 별도 OS 창(C#)이고, Excel 미러가 표시 갱신 때마다
//   위로 올라와(TOPMOST 순간 토글 트릭) 팝업을 덮었다. 예전엔 '다른 앱 방해' 우려로
//   TopMost 를 안 썼는데(742 주석), 가려지는 실측 불편이 더 커서 결정을 변경했다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail ? "  → " + String(detail).slice(0, 160) : "")); }
}

const cs = fs.readFileSync(path.join(ROOT, "native_host", "NativeHost.cs"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles", "panels.css"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "scripts", "assist-ui.js"), "utf8");

console.log("[1] 네이티브 팝업(C#) — 최상단 + 크기 2배");
check("TopMost = true", /assistForm\.TopMost = true;/.test(cs));
check("결정 변경 사유가 주석에 남음", /결정 변경.*TopMost/.test(cs) || /2026-08-10 결정 변경/.test(cs));
check("기본 크기 940x1280(2배)", /wantW = 940, wantH = 1280;/.test(cs));
check("화면 작업영역보다 크면 줄임(클램프)", /WorkingArea/.test(cs) && /Math\.Min\(wantW/.test(cs) && /Math\.Min\(wantH/.test(cs));
check("옛 고정 크기(470,640)는 제거", !/new Size\(470, 640\)/.test(cs));
check("위치가 새 폭 기준으로 계산", /this\.Width - wantW/.test(cs));
check("Owner 관계 유지(호스트 최소화 시 같이 숨음)", /assistForm\.Owner = this;/.test(cs));

console.log("[2] DOM 팝업(브라우저/폴백) — 크기 2배");
const popupBlock = (css.match(/\.assist-popup \{[\s\S]*?\}/) || [""])[0];
check("width 880px", /width:\s*880px/.test(popupBlock), popupBlock.slice(0, 200));
check("height 1120px", /height:\s*1120px/.test(popupBlock));
check("작은 화면 클램프 유지(max-width 96vw)", /max-width:\s*96vw/.test(popupBlock));
check("작은 화면 클램프 유지(max-height 92vh)", /max-height:\s*92vh/.test(popupBlock));

console.log("[3] 저장된 옛 크기가 새 기본을 가리지 않게 — 키 버전업");
check("저장 키가 _v2", /ASSIST_POS_KEY = "b2b_assist_popup_rect_v2"/.test(js));
check("버전업 이유가 주석에 남음", /키 버전업/.test(js));
check("기본 위치가 새 폭(880) 기준", /window\.innerWidth - 920/.test(js));
check("옛 위치 계산(-460)은 제거", !/window\.innerWidth - 460/.test(js));

console.log("[4] 컴파일 산출물 존재(빌드 스크립트가 실제로 통과)");
check("B2B_NativeHost.exe 재컴파일됨", (() => {
  try {
    const exe = path.join(ROOT, "native_host", "bin", "B2B_NativeHost.exe");
    const srcT = fs.statSync(path.join(ROOT, "native_host", "NativeHost.cs")).mtimeMs;
    return fs.statSync(exe).mtimeMs >= srcT - 1000;
  } catch (_) { return false; }
})());

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
