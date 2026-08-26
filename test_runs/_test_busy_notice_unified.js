// [사용자 지시 2026-08-26] 진행 알림이 두 군데 뜨는 걸 '화면 잠금' 한 곳으로 모은다.
//  1) 파일 업로드: 잠금("입력 파일 업로드 중...") + 별도 상태 박스("… 3/6 - 파일명") → 잠금 하나로,
//     대신 잠금 문구에 진행률(3/6)을 싣는다.
//  2) 스킬 적용: 같은 진행률을 잠금 문구에도 실어 잠금이 메인이 되게.
//  3) 보안문서: 별도 배너 대신 잠금 문구 옆에 "문서 보안 해제 중"으로 붙인다.
// 토스트(완료/실패 알림)는 별개 — 건드리지 않는다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const em = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8").replace(/^﻿/, "");
const dh = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8").replace(/^﻿/, "");
const sd = fs.readFileSync(path.join(ROOT, "scripts", "secure-doc.js"), "utf8").replace(/^﻿/, "");
const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}
function fnOf(src, name) {
  const i = src.indexOf("function " + name);
  if (i < 0) throw new Error("함수 못 찾음: " + name);
  const nx = src.indexOf("\nfunction ", i + 1);
  const body = src.slice(i, nx < 0 ? src.length : nx);
  return body.slice(0, body.lastIndexOf("\n}") + 2);
}

console.log("[1] 잠금 문구 갱신 API — 본문구 + 보조상태가 한 줄로 합쳐진다(동작 검증)");
{
  const labelEl = { textContent: "" };
  const el = { querySelector: () => labelEl };
  const published = [];
  const api = new Function("uiBusy", "document", "publishNativeUiBusy",
    fnOf(em, "_uiBusyRender") + "\n" + fnOf(em, "updateUiBusyLabel") + "\n" + fnOf(em, "setUiBusySuffix")
    + "\nreturn { update: updateUiBusyLabel, suffix: setUiBusySuffix };");
  const uiBusy = { count: 1, el, mainLabel: "", suffixLabel: "" };
  const a = api(uiBusy, { getElementById: () => el }, (on, t) => published.push(t));
  check("본문구 반영", a.update("입력 파일 업로드 중... (3/6)") === true && labelEl.textContent === "입력 파일 업로드 중... (3/6)", labelEl.textContent);
  a.suffix("문서 보안 해제 중");
  check("보조상태가 옆에 붙는다(본문구 유지)", labelEl.textContent === "입력 파일 업로드 중... (3/6) · 문서 보안 해제 중", labelEl.textContent);
  a.update("입력 파일 업로드 중... (4/6)");
  check("진행률만 갱신돼도 보조상태 유지", labelEl.textContent === "입력 파일 업로드 중... (4/6) · 문서 보안 해제 중", labelEl.textContent);
  a.suffix("");
  check("보조상태 해제", labelEl.textContent === "입력 파일 업로드 중... (4/6)", labelEl.textContent);
  check("네이티브에도 같은 문구를 보낸다", published[published.length - 1] === "입력 파일 업로드 중... (4/6)", published.slice(-1));

  const idle = api({ count: 0, el, mainLabel: "", suffixLabel: "" }, { getElementById: () => el }, () => {});
  check("잠금이 없으면 false(호출자가 폴백)", idle.update("무언가") === false && idle.suffix("x") === false);
}

console.log("[2] 업로드 — 진행률을 잠금 문구에 싣고 별도 박스는 숨긴다");
check("진행률 문구 조립기", /function _uploadBusyText/.test(dh) && /\(\$\{cur\}\/\$\{total\}\)/.test(dh));
check("시작 시 잠금에 싣는다", /updateUiBusyLabel\(_uploadBusyText\(job, 0\)\)/.test(dh));
check("갱신 시에도 잠금이 메인", /const onBusy = \(typeof updateUiBusyLabel === "function"\) && updateUiBusyLabel\(msg\)/.test(dh));
check("잠금에 실렸으면 박스를 숨긴다", /box\.hidden = !!onBusy/.test(dh));
check("못 실었으면 박스를 폴백으로 보여준다(진행률 실종 방지)", (dh.match(/box\.hidden = !!onBusy/g) || []).length >= 2);
check("접근성용 텍스트는 계속 갱신", /text\.textContent = msg/.test(dh));

console.log("[3] 스킬 적용 — 같은 진행률이 잠금 문구에도 실린다");
check("_setOverlayProgress 가 잠금에도 반영", /_setOverlayProgress[\s\S]{0,400}setUiBusySuffix\(text\)/.test(pj));
check("Excel 패널 표시는 유지(네이티브 잠금은 시각 표시가 없다)", /setExcelMirrorApplyLoadingProgress\(text\)/.test(pj));

console.log("[4] 보안문서 — 잠금이 있으면 배너 대신 보조상태로");
check("잠금에 실으면 배너를 띄우지 않는다", /setUiBusySuffix\(short\)[\s\S]{0,120}return;/.test(sd));
check("해제/적용 문구 구분", /보안적용/.test(sd) && /문서 보안 해제 중/.test(sd));
check("잠금이 없으면 기존 배너 폴백", /_secureDocBannerShow\(msg\)/.test(sd));
check("끝나면 보조상태만 걷어낸다(본문구 유지)", /onBusyLabel[\s\S]{0,140}setUiBusySuffix\(""\)/.test(sd));

console.log("[5] 사이드이펙트 — 새 작업에 옛 문구가 새지 않는다");
check("beginUiBusy 가 본문구/보조상태 초기화", /uiBusy\.mainLabel = label;[\s\S]{0,60}uiBusy\.suffixLabel = "";/.test(em));
check("endUiBusy(마지막 해제) 가 비운다", /uiBusy\.mainLabel = "";[\s\S]{0,60}uiBusy\.suffixLabel = "";/.test(em));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
