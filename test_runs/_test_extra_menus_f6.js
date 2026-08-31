// [요청 2026-08-31] 좌측 3그룹 메뉴 중 AX-Cell 만 남기고 숨김 + F6 으로 표시 토글.
//
// 잠그는 것
//   1) AX-Trace·E2E 그룹(라벨 2 + 버튼 4)만 .menu-extra 표식 — AX-Cell 은 표식 없음
//   2) CSS: show-extra-menus 없으면 .menu-extra 숨김(!important — 원래 display 가 제각각이라)
//   3) F6: 토글 + preventDefault(브라우저 기본 '영역 포커스 이동' 차단) + 선택 유지(localStorage)
//   4) 숨기는 순간 그 그룹 페이지를 보고 있었으면 생성기로 복귀(갇힘 방지)
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
  const extras = HTML.match(/class="[^"]*menu-extra[^"]*"/g) || [];
  check("표식이 정확히 6개(라벨 2 + 버튼 4)", extras.length === 6, extras.length);
  for (const page of ["trace-generator", "trace-runner", "scheduler", "schedules"]) {
    const re = new RegExp('class="[^"]*menu-extra[^"]*"[^>]*data-page="' + page + '"');
    check("숨김 대상: " + page, re.test(HTML));
  }
  for (const page of ["generator", "runner"]) {
    const re = new RegExp('class="[^"]*menu-extra[^"]*"[^>]*data-page="' + page + '"');
    check("AX-Cell 은 표식 없음: " + page, !re.test(HTML));
  }
  check("AX-Cell 그룹 라벨은 표식 없음", /<div class="menu-group">AX-Cell<\/div>/.test(HTML));
}

console.log("[2] CSS — 기본 숨김 규칙");
check("show-extra-menus 없으면 숨김(!important)",
  /body:not\(\.show-extra-menus\) \.menu-extra \{ display: none !important; \}/.test(CSS));

console.log("[3] F6 토글 — 실제로 돌려본다");
{
  const i = MENU.indexOf("// [숨김 메뉴 2026-08-31]");
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
  check("안내 문구", seen.toasts.some(m => m.includes("표시")), seen.toasts);

  env.state.currentPage = "scheduler";       // 숨김 그룹 페이지를 보는 중에
  press("F6");
  check("F6 다시 → 숨김", !cls.has("show-extra-menus"));
  check("보고 있던 숨김 페이지에서 생성기로 복귀(갇힘 방지)", seen.page === "generator", seen.page);
  check("숨김도 저장", store.b2bShowExtraMenus === "0", store);

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
