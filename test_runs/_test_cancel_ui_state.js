// [제보 2026-08-26] "작업 중단을 눌러도 중단 안 됨"의 절반은 UI 였다.
// 백엔드 취소는 협조적이라 지금 도는 단계가 끝나야 멈추는데(실측 단계 23초 + 스냅샷 4~9초),
//  · 전역 중단 버튼은 HTTP 응답을 받은 0.3초 뒤 '■ 작업 중단'으로 되돌아갔다 → 안 먹은 줄 알고 재클릭
//  · 클라가 서버 응답을 안 보고 무조건 '접수됨' 처리 → 잡을 못 찾아도 성공처럼 보임
//  · 문구가 '중단 중...'이라 즉시 멈춘다는 기대를 줌
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const em = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8").replace(/^﻿/, "");
const bw = fs.readFileSync(path.join(ROOT, "scripts", "backend-workbooks.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 220) : "")); }
}

console.log("[1] 취소 요청 결과를 서버 응답으로 판단한다(동작 검증)");
{
  const at = bw.indexOf("async function cancelActiveBackendPipeline");
  const nx = bw.indexOf("\nfunction ", at + 1);
  let body = bw.slice(at, nx < 0 ? bw.length : nx);
  body = body.slice(0, body.lastIndexOf("\n}") + 2);
  const mk = (resp) => new Function("window", "fetch", body + "\nreturn cancelActiveBackendPipeline;")(
    { __activeBackendPipelineJobId: "job-1" },
    async () => ({ json: async () => resp }),
  );
  const run = async () => {
    check("서버가 접수하면 true", (await mk({ ok: true, cancelRequested: true })()) === true);
    check("잡을 못 찾으면 false(거짓 성공 금지)", (await mk({ ok: true, cancelRequested: false })()) === false);
    check("응답이 이상하면 false", (await mk({ ok: false })()) === false);
    const noJob = new Function("window", "fetch", body + "\nreturn cancelActiveBackendPipeline;")({}, async () => ({}));
    check("진행 중인 잡이 없으면 false", (await noJob()) === false);
    console.log("[2] 상태 유지 — 접수됐으면 실행이 끝날 때까지 되돌리지 않는다");
    check("접수 시 '중단 요청됨' 유지", /중단 요청됨 · 현재 단계 끝나면 멈춤/.test(em));
    check("실패 시에만 버튼을 되살린다", /apply\.cancel\.failed[\s\S]{0,200}btn\.disabled = false/.test(em)
      || /btn\.disabled = false; btn\.textContent = "■ 작업 중단";[\s\S]{0,120}apply\.cancel\.failed/.test(em));
    check("오버레이에도 안내", /setExcelMirrorApplyLoadingProgress\("중단 요청됨 — 현재 단계가 끝나면 멈춥니다"\)/.test(em));
    check("말풍선 버튼 문구도 기대를 맞춘다", /stoppingLabel: "중단 요청됨 · 현재 단계 끝나면 멈춤"/.test(em));

    console.log("[3] 사이드이펙트 — 버튼은 재사용되므로 새 작업마다 초기화");
    check("표시할 때 상태 초기화", /if \(!show\) \{ btn\.style\.display = "none"; return; \}[\s\S]{0,400}btn\.disabled = false;[\s\S]{0,80}btn\.textContent = "■ 작업 중단";/.test(em));

    console.log("[4] onStop(말풍선 경로)도 실제 결과를 돌려준다");
    check("무조건 true 를 반환하지 않는다", !/await cancelActiveBackendPipeline\(\);\s*\n\s*return true;/.test(em));
    check("결과를 그대로 반환", /const ok = await cancelActiveBackendPipeline\(\);[\s\S]{0,300}return ok;/.test(em));

    console.log("[5] 계측 — 요청/접수/실패가 로그에 남는다");
    check("요청", /apply\.cancel\.request/.test(em));
    check("접수", /apply\.cancel\.accepted/.test(em));
    check("실패", /apply\.cancel\.failed/.test(em));

    console.log("");
    console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
    process.exit(fails === 0 ? 0 : 1);
  };
  run();
}
