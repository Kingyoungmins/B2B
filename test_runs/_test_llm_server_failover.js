// [사용자 요청 2026-08-24] "메인서버로 잡고 있는데 연결이 끊어지면 자동으로 서브서버로 넘어가게."
//
// 고치기 전 상태 — 폴백이 있긴 했는데 두 가지가 빠져 있었다.
//   (1) 폴백 목록에 서브 서버(프리셋)가 아예 없었다. OPENAI_COMPAT_FALLBACK_BASE_URLS 는
//       로컬 프록시 주소뿐이라, 메인이 죽으면 그냥 실패로 끝났다.
//   (2) fetch 가 '예외'를 던질 때만 다음 후보로 넘어갔다. 서버가 살아는 있는데 못 받는 상태
//       (502/503/504 — 게이트웨이 오류)는 정상 응답으로 쳐서 전환이 안 됐다.
//       사내망 게이트웨이 뒤에 있는 구성에서는 이쪽이 오히려 흔한 실패 모양이다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const cfg = fs.readFileSync(path.join(ROOT, "scripts", "config.js"), "utf8").replace(/^﻿/, "");
const api = fs.readFileSync(path.join(ROOT, "scripts", "llm-api.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
function sliceBalanced(src, startIdx, open, close) {
  let d = 0;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === open) d++;
    else if (src[i] === close) { d--; if (d === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}

// 실제 주소는 config.js 에서 읽어 온다(테스트가 주소를 따로 들고 있으면 바뀔 때 어긋난다).
function constOf(name) {
  const m = cfg.match(new RegExp("const " + name + '\\s*=\\s*"([^"]+)"'));
  if (!m) throw new Error("못 찾음: " + name);
  return m[1];
}
const MAIN = constOf("IXI_VIOLET_BASE_URL");
const SUB = constOf("IXI_SUB_VIOLET_BASE_URL");
const SUB2 = constOf("IXI_SUB2_VIOLET_BASE_URL");

const PRESETS = [
  { id: "main", label: "메인 서버", upstream: MAIN },
  { id: "sub", label: "서브 서버", upstream: SUB },
  { id: "sub2", label: "서브 서버2", upstream: SUB2 },
];
function getIxiServerPresetId(u) {
  const raw = String(u || "").trim().replace(/\/$/, "");
  const f = PRESETS.find(p => p.upstream.replace(/\/$/, "") === raw);
  return f ? f.id : "main";
}

// 소스에 있는 함수 본문을 그대로 실행한다(정규식 확인이 아니라 동작 확인).
const at = cfg.indexOf("function ixiFailoverUpstreams");
if (at < 0) throw new Error("ixiFailoverUpstreams 를 찾지 못함");
const body = sliceBalanced(cfg, cfg.indexOf("{", cfg.indexOf(")", at)), "{", "}").slice(1, -1);
const failover = new Function("currentUpstream", "IXI_SERVER_PRESETS", "getIxiServerPresetId", body);
const order = u => failover(u, PRESETS, getIxiServerPresetId);

console.log("[1] 전환 순서 — 지금 쓰는 서버가 먼저, 나머지가 뒤");
{
  const r = order(MAIN);
  check("현재 서버가 1순위(멀쩡한데 다른 데로 새지 않는다)", r[0] === MAIN, r[0]);
  check("서브·서브2까지 후보에 들어간다", r.length === 3, r.length);
  check("서브가 2순위", r[1] === SUB);
  check("중복 없음", new Set(r).size === r.length);
}
{
  const r = order(SUB);
  check("서브를 쓰고 있으면 서브가 1순위", r[0] === SUB, r[0]);
  check("그 경우에도 메인이 후보에 남는다", r.indexOf(MAIN) > 0);
}

console.log("[2] 사용자가 직접 넣은 주소를 우리 목록으로 덮지 않는다");
{
  const r = order("https://my-own-server.example");
  check("사용자 지정 주소가 1순위로 유지된다", r[0] === "https://my-own-server.example", r[0]);
  check("그 뒤에 프리셋들이 붙는다(끊겼을 때 갈 곳은 있어야 한다)", r.length === 4, r.length);
}

console.log("[3] 빈 값·슬래시 차이로 후보가 어긋나지 않는다");
{
  check("빈 값이면 프리셋만", order("").length === 3);
  const r = order(MAIN + "/");
  check("끝 슬래시가 있어도 같은 서버로 본다(중복 후보 생성 금지)", r.length === 3, r.length);
}

console.log("[4] 호출 경로 — '못 받는 상태'도 전환 대상");
check("502/503/504 를 재시도 대상으로 본다",
  /RETRYABLE_STATUS = new Set\(\[502, 503, 504/.test(api));
check("예외뿐 아니라 상태코드로도 다음 후보로 넘어간다",
  /if \(RETRYABLE_STATUS\.has\(resp\.status\)[\s\S]{0,160}continue;/.test(api));
check("후보마다 upstream 헤더를 바꿔 시도한다(로컬 프록시 구성에서 실제 목적지가 이 헤더다)",
  /"X-B2B-Vllm-Base": up/.test(api));
check("전환이 일어나면 어디로 갔는지 로그로 남긴다",
  /llm\.upstream\.failover/.test(api) && /getIxiServerLabel\(up\)/.test(api));
check("후보가 하나뿐이면 상태코드로 건너뛰지 않는다(원래 오류를 그대로 돌려준다)",
  /upstreamCandidates\.length > 1 \|\| bases\.length > 1/.test(api));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
