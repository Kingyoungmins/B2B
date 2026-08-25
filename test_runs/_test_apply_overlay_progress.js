// [제보 2026-08-25] AI 수정 반영 후 재적용이 8분 22초(실측 17:03:01~17:11:24) 도는 동안
// 화면 오버레이는 '스킬 재적용 중...' 한 줄로 고정이라 사용자가 "멈춘 것 같다"고 겪었다.
// 진행률(N/총단계)을 오버레이 문구에 덧붙여, 무엇이 얼마나 남았는지 보이게 한다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const em = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8").replace(/^﻿/, "");
const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 오버레이 문구가 진행률을 반영한다(동작 검증)");
{
  // begin/end 와 진행률 세터만 떼어 최소 환경에서 돌린다.
  const at = em.indexOf("function beginExcelMirrorApplyLoading");
  const nx = em.indexOf("\nfunction setExcelMirrorApplyLoadingProgress");
  const beginSrc = em.slice(at, nx);
  const at2 = em.indexOf("function setExcelMirrorApplyLoadingProgress");
  const nx2 = em.indexOf("\nfunction endExcelMirrorApplyLoading");
  const setSrc = em.slice(at2, nx2);

  const published = [];
  const env = {
    excelMirror: { applyDepth: 0, applyOpenLabels: [], zOrderTimers: [] },
    EXCEL_MIRROR_SPINNER_FRAMES: ["-"],
    traceClientUiEvent: () => {},
    beginUiBusy: () => "tok",
    showExcelApplyCancelButton: () => {},
    isNativeExcelShell: () => true,
    hideAllExcelMirrorWindows: () => Promise.resolve(),
    publishNativeExcelLoading: (on, text) => { if (on) published.push(text); },
    updateMirrorShellStatus: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    requestExcelApplyCancel: () => false,
  };
  const keys = Object.keys(env);
  const fn = new Function(...keys,
    beginSrc + "\n" + setSrc + "\nreturn { begin: beginExcelMirrorApplyLoading, setProgress: setExcelMirrorApplyLoadingProgress };");
  const api = fn(...keys.map(k => env[k]));

  api.begin("스킬 재적용 중...", { failsafeMs: 1000 });
  check("시작 문구가 그대로 나온다", published.some(t => t.includes("스킬 재적용 중")), JSON.stringify(published));
  const before = published.length;
  api.setProgress("12/36단계");
  // tick 은 인터벌이라 직접 호출되지 않는다 — 상태만 검증하고, 문구 조립은 아래 소스 계약으로 본다.
  check("진행률이 상태에 반영", env.excelMirror.applyLoadingProgress === "12/36단계", env.excelMirror.applyLoadingProgress);
  check("기본 문구는 유지(중첩 잠금 보호)", env.excelMirror.applyLoadingBaseLabel === "스킬 재적용 중...", env.excelMirror.applyLoadingBaseLabel);
  check("빈 값이면 접미 제거", (api.setProgress(""), env.excelMirror.applyLoadingProgress === ""));
  void before;
}

console.log("[2] 소스 계약 — 문구 조립과 해제");
check("tick 이 기본문구+진행률을 합쳐 쓴다",
  /applyLoadingBaseLabel[\s\S]{0,200}applyLoadingProgress \? "  " \+ excelMirror\.applyLoadingProgress/.test(em));
check("작업이 끝나면 진행률을 비운다(다음 작업에 안 샘)",
  /applyLoadingProgress = "";\s*\/\/ 다음 작업에 옛 진행률이 새지 않게/.test(em));

console.log("[3] 배선 — 두 진행률 폴링이 오버레이도 갱신한다");
check("헬퍼 존재", /function _setOverlayProgress\(text\)/.test(pj));
check("전체실행(anchor) 폴링에 연결", /_setOverlayProgress\(_cur \+ "\/" \+ pj\.total \+ "단계"\)/.test(pj));
check("그룹 배치 폴링에 연결", /_setOverlayProgress\(cur \+ "\/" \+ _progressTotal \+ "단계"\)/.test(pj));
check("결과 반영 단계도 표시", /_setOverlayProgress\("결과 반영 중" \+ st\)/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
