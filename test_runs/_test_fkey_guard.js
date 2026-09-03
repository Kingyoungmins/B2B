// [0.8.4] F키 접근 권한 가드 — 판정/차단/6연타 버프.
//
// 요구(2026-09-03):
//   · F키(F2/F6/F7/F8/F9)는 접근 권한 필요 — 기본 보유: "Foundation리서치팀"
//   · F1 을 6번 연속 누르면 권한 획득 → "서영민님으로부터 버프 획득." 팝업
//   · 개발망(조직 정보 없음)은 충돌 없이 그대로(허용)
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "");
const SRC = read("scripts/fkey-guard.js");
const HTML = read("index.html");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 로드 순서 — 가드가 '첫 번째' 스크립트다 (capture 등록 순서 = 차단 능력)");
const firstScript = (HTML.match(/<script src="([^"]+)"/) || [])[1];
check("첫 스크립트 = fkey-guard.js", firstScript === "scripts/fkey-guard.js", firstScript);

// ── 실행 환경 구성: 리스너/스토리지/팝업을 가짜로 물리고 소스 전체를 돌린다 ──
function makeEnv(team, buffStored) {
  const store = {};
  if (buffStored) store.b2bFkeyBuff = "1";
  const popups = [];
  const listeners = [];
  const env = {
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = v; } },
    document: {
      addEventListener: (ev, fn, cap) => listeners.push({ ev, fn, cap }),
      getElementById: () => null,
      createElement: () => ({ style: {}, remove() {}, set innerHTML(v) { popups.push(v); } }),
      head: { appendChild() {} }, body: { appendChild() {} },
    },
    fetch: async () => ({ json: async () => ({ ok: true, team }) }),
    setTimeout: (fn) => 0,
    Date,
  };
  const fn = new Function(...Object.keys(env), SRC + "\nreturn { fkeyGuard, fkeyTap, fkeyComputeAllowed, listeners: arguments[arguments.length] };");
  // arguments 트릭 대신 명시 반환
  const fn2 = new Function(...Object.keys(env),
    SRC + "\nreturn { fkeyGuard, fkeyTap, fkeyComputeAllowed, fkeyOnKeydown };");
  const api = fn2(...Object.values(env));
  return { api, store, popups, listeners };
}

function press(api, key, opts) {
  const calls = { prevented: 0, stoppedImm: 0 };
  api.fkeyOnKeydown({
    key, repeat: false,
    preventDefault: () => calls.prevented++,
    stopImmediatePropagation: () => calls.stoppedImm++,
    stopPropagation: () => {},
    ...(opts || {}),
  });
  return calls;
}

(async () => {
  console.log("[2] 권한 판정");
  {
    const { api } = makeEnv("", false);
    check("개발망(팀 정보 없음) → 허용", api.fkeyComputeAllowed("") === true);
    check("Foundation리서치팀 → 허용", api.fkeyComputeAllowed("Foundation리서치팀") === true);
    check("다른 팀 + 버프 없음 → 차단", api.fkeyComputeAllowed("빌링플랫폼팀") === false);
  }
  {
    const { api } = makeEnv("빌링플랫폼팀", true);
    check("다른 팀 + 버프 보유 → 허용", api.fkeyComputeAllowed("빌링플랫폼팀") === true);
  }

  console.log("[3] 차단 동작 — 비권한자");
  {
    const { api } = makeEnv("빌링플랫폼팀", false);
    await Promise.resolve(); await Promise.resolve();   // fkeyGuardInit 완료 대기
    check("가드 상태 반영(known+차단)", api.fkeyGuard.known === true && api.fkeyGuard.allowed === false,
      JSON.stringify(api.fkeyGuard));
    const f8 = press(api, "F8");
    check("F8 차단(preventDefault + 즉시 전파 중단)", f8.prevented === 1 && f8.stoppedImm === 1, f8);
    for (const k of ["F2", "F6", "F7", "F9"]) {
      const c = press(api, k);
      check(k + " 차단", c.prevented === 1 && c.stoppedImm === 1, c);
    }
    const f10 = press(api, "F10");
    check("F10(녹화)은 막지 않는다", f10.prevented === 0 && f10.stoppedImm === 0, f10);
    const f1 = press(api, "F1");
    check("F1(도움말)은 막지 않는다", f1.prevented === 0 && f1.stoppedImm === 0, f1);
  }

  console.log("[4] F1 6연타 → 버프 획득 + 팝업");
  {
    const { api, store, popups } = makeEnv("빌링플랫폼팀", false);
    await Promise.resolve(); await Promise.resolve();
    for (let i = 0; i < 6; i++) press(api, "F1");
    check("버프 저장(localStorage)", store.b2bFkeyBuff === "1", store);
    check("권한 즉시 활성화", api.fkeyGuard.allowed === true);
    check("팝업 문구 그대로", popups.some(h => h.includes("서영민님으로부터 버프 획득.")), popups);
    const after = press(api, "F8");
    check("버프 후 F8 통과", after.prevented === 0, after);
  }

  console.log("[5] 연타 규칙");
  {
    const { api, popups } = makeEnv("빌링플랫폼팀", false);
    await Promise.resolve(); await Promise.resolve();
    for (let i = 0; i < 4; i++) press(api, "F1");
    press(api, "A");                                     // 다른 키가 끼면 리셋
    for (let i = 0; i < 5; i++) press(api, "F1");
    check("다른 키가 끼면 처음부터(4+5≠획득)", api.fkeyGuard.allowed === false && popups.length === 0);
    press(api, "F1");                                    // 이어서 6번째
    check("연속 6번을 채우면 획득", api.fkeyGuard.allowed === true);
  }
  {
    const { api } = makeEnv("빌링플랫폼팀", false);
    await Promise.resolve(); await Promise.resolve();
    for (let i = 0; i < 5; i++) press(api, "F1");
    api.fkeyTap.last -= 2000;                            // 1.5초 초과 공백 재현
    press(api, "F1");
    check("느린 연타(1.5초 초과)는 리셋", api.fkeyGuard.allowed === false);
  }

  console.log("[6] 이미 권한 보유자 — 6연타에 팝업 안 뜸(중복 획득 없음)");
  {
    const { api, popups } = makeEnv("Foundation리서치팀", false);
    await Promise.resolve(); await Promise.resolve();
    for (let i = 0; i < 6; i++) press(api, "F1");
    check("팝업 없음", popups.length === 0, popups);
  }

  console.log("[7] 판정 전(whoami 응답 전)에는 차단하지 않는다");
  {
    const { api } = makeEnv("빌링플랫폼팀", false);
    // init 대기 없이 즉시 — known=false 상태
    const c = press(api, "F8");
    check("초기 수백 ms 는 통과(정상 사용자 보호)", c.prevented === 0, c);
  }

  console.log("");
  console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
  process.exit(fails === 0 ? 0 : 1);
})();
