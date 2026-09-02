// [0.8.3 버전 게이트 — 화면 쪽] 팝업 문구/버튼과 표시 조건, 다운로드 주소 우선순위.
//
// 요구(2026-09-02):
//   · 목록에 없는 버전 → "오래된 버전을 사용하고 있습니다. 최신 버전으로 교체 해주세요."
//                        + [다운로드 하러가기] [무시하고 사용하기]
//   · 버전 정보를 못 가져오면 → "점검중입니다. 문의사항이 있으시면 팀즈로 문의 부탁드립니다"
//                        + [확인] (닫고 계속 사용)
//   · 다운로드 기본 주소 = 슬기 스마트빌링, F9 에서 변경 가능
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const NL = String.fromCharCode(10);
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "");
const GATE = read("scripts/version-gate.js");
const MODAL = read("scripts/model-modal.js");
const HTML = read("index.html");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 팝업 문구 — 요구 문구 그대로");
check("오래된 버전 문구", GATE.includes("오래된 버전을 사용하고 있습니다. 최신 버전으로 교체 해주세요."));
check("다운로드 버튼", GATE.includes(">다운로드 하러가기<") || GATE.includes('"다운로드 하러가기<'));
check("무시 버튼", GATE.includes("무시하고 사용하기"));
check("점검중 문구", GATE.includes("점검중입니다. 문의사항이 있으시면 팀즈로 문의 부탁드립니다"));
check("점검중은 확인 버튼", />확인</.test(GATE));
check("기본 다운로드 주소 = 슬기 스마트빌링",
  GATE.includes('"https://seulgi.lguplus.co.kr/desk/smart-billing"'));

console.log("[2] 다운로드 주소 우선순위 — F9 저장값 > 서버값 > 기본값 (실행)");
{
  const store = {};
  const env = { localStorage: { getItem: k => (k in store ? store[k] : null) } };
  const i = GATE.indexOf("function versionGateDownloadUrl");
  const j = GATE.indexOf(NL + "function ", i + 1);
  const fn = new Function("localStorage",
    'const VERSION_GATE_DOWNLOAD_DEFAULT = "https://seulgi.lguplus.co.kr/desk/smart-billing";' +
    NL + GATE.slice(i, j) + NL + "return versionGateDownloadUrl;")(env.localStorage);
  check("아무것도 없으면 기본값(슬기)",
    fn("") === "https://seulgi.lguplus.co.kr/desk/smart-billing", fn(""));
  check("서버 값이 있으면 서버 값", fn("https://srv/dl") === "https://srv/dl");
  store.b2bUpdateDownloadUrl = "https://my.custom/dl";
  check("F9 저장값이 최우선", fn("https://srv/dl") === "https://my.custom/dl");
}

console.log("[3] 표시 조건 — show + kind 일 때만 팝업 (실행)");
{
  const i = GATE.indexOf("async function initVersionGate");
  const j = GATE.indexOf(NL + "if (document.readyState", i);
  const calls = [];
  const mk = (data, ok = true) => new Function("fetch", "showVersionGatePopup",
    GATE.slice(i, j) + NL + "return initVersionGate();")(
      async () => ({ ok, json: async () => data }),
      info => calls.push(info));
  return (async () => {
    await mk({ show: true, kind: "outdated", match: false });
    check("outdated + show → 팝업", calls.length === 1 && calls[0].kind === "outdated");
    await mk({ show: true, kind: "maintenance", match: null });
    check("maintenance + show → 팝업", calls.length === 2 && calls[1].kind === "maintenance");
    await mk({ show: false, kind: "outdated", match: false });
    check("show=false 면 안 띄움(실행당 1회 계약)", calls.length === 2);
    await mk({ show: true, kind: "", match: true });
    check("kind 없으면 안 띄움", calls.length === 2);
    await mk(null, false);
    check("게이트 자체가 실패해도 조용히 통과", calls.length === 2);

    console.log("[4] F9 — 다운로드 주소 변경 UI");
    check("입력칸(set-ver-download)이 있다", MODAL.includes('id="set-ver-download"'));
    check("저장 버튼이 있다", MODAL.includes('id="btn-version-download-save"') &&
      MODAL.includes("다운로드 주소 저장"));
    check("localStorage b2bUpdateDownloadUrl 에 저장",
      /b2bUpdateDownloadUrl/.test(MODAL));
    check("http(s) 검사", MODAL.includes('^https?:\\/\\/'));
    check("비우면 기본 주소 안내", MODAL.includes("기본 주소(슬기 스마트빌링)"));

    console.log("[5] 연결 — index.html 이 게이트를 로드한다");
    check("version-gate.js 포함", HTML.includes('scripts/version-gate.js'));

    console.log("");
    console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
    process.exit(fails === 0 ? 0 : 1);
  })();
}
