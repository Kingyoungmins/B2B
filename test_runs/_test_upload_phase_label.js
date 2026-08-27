// [제보 2026-08-27] 입력 파일을 올렸을 때 잠금 문구에 같은 말이 두 번 나왔다.
//   본 것: "입력파일 업로드 중...(1/1) 실제 Excel 창 여는중 ... Excel 창 준비중(1/4)"
// 원인: 업로드 쪽이 마지막에 '실제 Excel 창 여는 중...'을 문구에 끼워 넣고, 곧바로 미러
//   준비기가 'Excel 창 준비 중 (1/4)'를 보조 상태로 또 덧붙였다. 게다가 (1/1)은 올린 파일 수,
//   (1/4)는 준비할 Excel 창 수라 뜻이 다른 숫자가 같은 모양으로 나란히 떴다.
// 계약: 한 구간의 문구는 한 곳에서만 만든다.
//   업로드 구간 → "입력 파일 업로드 중... (n/총) · 파일명"
//   준비 구간   → "Excel 창 준비 중... (n/총)"   (앞 문구를 덮고, 끝나면 원래대로 되돌림)
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const em = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8").replace(/^﻿/, "");
const dh = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8").replace(/^﻿/, "");

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

console.log("[1] 실제로 그려지는 한 줄 — 두 구간이 섞이지 않는다");
{
  const labelEl = { textContent: "" };
  const el = { querySelector: () => labelEl };
  const api = new Function("uiBusy", "document", "publishNativeUiBusy",
    fnOf(em, "_uiBusyRender") + "\n" + fnOf(em, "updateUiBusyLabel") + "\n" + fnOf(em, "setUiBusySuffix")
    + "\n" + fnOf(dh, "_uploadBusyText")
    + "\nreturn { update: updateUiBusyLabel, suffix: setUiBusySuffix, uploadText: _uploadBusyText };");
  const uiBusy = { count: 1, el, mainLabel: "", suffixLabel: "" };
  const a = api(uiBusy, { getElementById: () => el }, () => {});

  // 업로드 구간: 파일 1개 중 1개째
  const job = { total: 1, label: "입력 파일 업로드" };
  a.update(a.uploadText(job, 1, "청구내역.xlsx"));
  check("업로드 구간 문구",
    labelEl.textContent === "입력 파일 업로드 중... (1/1) · 청구내역.xlsx", labelEl.textContent);

  // 업로드가 끝나면 '실제 Excel 창 여는 중'을 여기에 얹지 않는다(파일명 자리를 비운다)
  a.update(a.uploadText(job, 1));
  check("업로드 마지막 문구에 다음 구간 말을 섞지 않는다",
    labelEl.textContent === "입력 파일 업로드 중... (1/1)", labelEl.textContent);

  // 준비 구간: 미러 준비기가 본문구를 통째로 갈아 끼운다(보조 상태는 걷고)
  a.suffix("");
  a.update("Excel 창 준비 중... (1/4)");
  check("준비 구간 문구", labelEl.textContent === "Excel 창 준비 중... (1/4)", labelEl.textContent);
  check("업로드 문구가 남아 있지 않다", !/업로드/.test(labelEl.textContent), labelEl.textContent);
  check("같은 말이 두 번 나오지 않는다",
    (labelEl.textContent.match(/Excel 창/g) || []).length === 1, labelEl.textContent);
  check("뜻이 다른 숫자가 나란히 뜨지 않는다",
    (labelEl.textContent.match(/\(\d+\/\d+\)/g) || []).length === 1, labelEl.textContent);

  a.update("Excel 창 준비 중... (4/4)");
  check("준비 진행률이 갱신된다", labelEl.textContent === "Excel 창 준비 중... (4/4)", labelEl.textContent);

  // 보안문서는 여전히 보조 상태로 붙는다(이 구조는 유지)
  a.update(a.uploadText(job, 0));
  a.suffix("문서 보안 해제 중");
  check("보안 해제는 종전대로 옆에 붙는다",
    labelEl.textContent === "입력 파일 업로드 중... (0/1) · 문서 보안 해제 중", labelEl.textContent);
}

console.log("[2] 소스 계약 — 구간의 주인이 하나여야 한다");
check("업로드가 'Excel 창 여는 중'을 문구에 끼워 넣지 않는다",
  !/updateUpload\(job, files\.length, "실제 Excel 창 여는 중\.\.\."\)/.test(dh));
check("준비기는 보조 상태가 아니라 본문구를 쓴다",
  /updateUiBusyLabel\(`Excel 창 준비 중\.\.\. \(1\/\$\{total\}\)`\)/.test(em)
  && /updateUiBusyLabel\(`Excel 창 준비 중\.\.\. \(\$\{done\}\/\$\{total\}\)`\)/.test(em));
check("준비기가 남은 보조 상태를 먼저 걷는다",
  /setUiBusySuffix\(""\);[\s\S]{0,400}updateUiBusyLabel\(`Excel 창 준비 중/.test(em));
check("'Excel 창 준비 중'을 보조 상태로 붙이는 코드는 더 없다",
  !/setUiBusySuffix\(`Excel 창 준비 중/.test(em));

console.log("[3] 준비가 끝나면 원래 문구로 되돌린다(멈춘 것처럼 보이지 않게)");
check("직전 문구를 기억한다", /_busyLabelBefore/.test(em));
check("finally 에서 되돌린다",
  /finally \{[\s\S]{0,300}_busyLabelBefore && typeof updateUiBusyLabel === "function"\) updateUiBusyLabel\(_busyLabelBefore\)/.test(em));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
