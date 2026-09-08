// [요청 2026-08-31→2026-09-08] 추가 그룹(AX-Trace·E2E)은 항상 보이되 'Coming soon'
// 반투명 블락으로 덮는다. F6 = 블락 해제/복귀 토글.
//
// 잠그는 것
//   1) 추가 그룹(라벨 2 + 버튼 4)만 .menu-extra 표식 + .menu-extra-block 컨테이너
//   2) CSS: show-extra-menus 없으면 블락 오버레이(::after 'Coming soon') + 클릭 차단
//   3) F6: 토글 + preventDefault(브라우저 기본 '영역 포커스 이동' 차단) + 선택 유지(localStorage)
//   4) 다시 잠그는 순간 그 그룹 페이지를 보고 있었으면 생성기로 복귀(갇힘 방지)
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const NL = String.fromCharCode(10);
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "");
const HTML = read("index.html");
const CSS = read("styles/scheduler.css");
const MENU = read("scripts/menu.js");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 마크업 — 숨길 것만 정확히 표식");
{
  const extras = (HTML.match(/class="[^"]*menu-extra[^"]*"/g) || [])
    .filter(m => !m.includes("menu-extra-block"));
  check("표식이 정확히 6개(라벨 2 + 버튼 4)", extras.length === 6, extras.length);
  for (const page of ["trace-generator", "trace-runner", "scheduler", "schedules"]) {
    const re = new RegExp('class="[^"]*menu-extra[^"]*"[^>]*data-page="' + page + '"');
    check("숨김 대상: " + page, re.test(HTML));
  }
  for (const page of ["generator", "runner"]) {
    const re = new RegExp('class="[^"]*menu-extra[^"]*"[^>]*data-page="' + page + '"');
    check("AX-Cell 은 표식 없음: " + page, !re.test(HTML));
  }
  check("본체 그룹 라벨(B2B 스마트 빌링 에이전트)은 표식 없음",
    /<div class="menu-group">B2B 스마트 빌링 에이전트<\/div>/.test(HTML));
}

console.log("[2] CSS — Coming soon 블락(항상 보임, 잠금 시 덮개)");
check("옛 숨김 규칙 제거(항상 보이게)", !CSS.includes(".menu-extra { display: none !important; }"));
check("잠금 시 반투명 덮개(::after Coming soon)",
  CSS.includes("body:not(.show-extra-menus) .menu-extra-block::after")
  && CSS.includes('content: "Coming soon";') && /background: rgba\(255, 255, 255, 0\.7\d\)/.test(CSS));
check("덮개가 클릭을 막는다(pointer-events + 전체 덮음)",
  CSS.includes("body:not(.show-extra-menus) .menu-extra-block .menu-item { pointer-events: none; }")
  && CSS.includes("position: absolute; inset: 0;"));
check("마크업이 블락 컨테이너로 감싼다",
  HTML.includes('<div class="menu-extra-block">') && HTML.includes("/.menu-extra-block"));

console.log("[3] F6 토글 — 실제로 돌려본다");
{
  const i = MENU.indexOf("// [Coming soon 2026-09-08]");
  if (i < 0) throw new Error("토글 블록을 못 찾음");
  const block = MENU.slice(i);
  const cls = new Set();
  const store = {};
  const seen = { page: null, toasts: [], prevented: 0 };
  let keyHandler = null;
  const env = {
    document: {
      body: { classList: {
        toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); },
        contains: c => cls.has(c),
      } },
      addEventListener: (ev, fn) => { if (ev === "keydown") keyHandler = fn; },
    },
    localStorage: {
      setItem: (k, v) => { store[k] = v; },
      getItem: k => (k in store ? store[k] : null),
    },
    state: { currentPage: "generator" },
    setPage: p => { seen.page = p; },
    toast: m => seen.toasts.push(String(m)),
  };
  const names = Object.keys(env);
  new Function(...names, block)(...names.map(k => env[k]));
  check("keydown 핸들러 등록", typeof keyHandler === "function");
  const press = key => keyHandler({ key, preventDefault: () => { seen.prevented++; } });

  press("F5");
  check("다른 키는 무시(preventDefault 안 함)", seen.prevented === 0 && !cls.has("show-extra-menus"));

  press("F6");
  check("F6 → 표시", cls.has("show-extra-menus"));
  check("F6 은 기본 동작 차단(포커스 이동 방지)", seen.prevented === 1);
  check("선택이 저장된다", store.b2bShowExtraMenus === "1", store);
  check("안내 문구(잠금 해제)", seen.toasts.some(m => m.includes("잠금을 해제")), seen.toasts);

  env.state.currentPage = "scheduler";       // 숨김 그룹 페이지를 보는 중에
  press("F6");
  check("F6 다시 → 잠금(블락 복귀)", !cls.has("show-extra-menus"));
  check("보고 있던 추가 페이지에서 생성기로 복귀(갇힘 방지)", seen.page === "generator", seen.page);
  check("잠금도 저장", store.b2bShowExtraMenus === "0", store);

  seen.page = null;
  env.state.currentPage = "generator";
  press("F6"); press("F6");
  check("생성기를 보는 중이면 페이지를 건드리지 않는다", seen.page === null, seen.page);
}

console.log("[4] 시작 시 복원 — 저장된 선택을 따른다");
check("localStorage 1 이면 시작부터 표시", /getItem\(KEY\) === "1"\) applyExtraMenus\(true\)/.test(MENU));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
