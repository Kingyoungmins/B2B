// [버전 확인 기본 주소 2026-08-11] F9 설정의 '버전 서버 실제 주소' 기본값과 URL 조립 규칙.
//
// 통신은 AI 호출과 같은 길을 쓴다: 프론트가 로컬 /v1 프록시로 보내고, 프록시가 경로를 그대로 붙여
// <실제주소>/v1/version 으로 전달한다(serve_b2b.py proxy: target = base + self.path).
// 버전 서버(versionTest/main.py)는 /version 과 /v1/version 을 모두 받는다.
//
// 이 테스트가 잠그는 것
//   1. 기본 실제주소가 지정된 값이다(비워 둬도 바로 확인 가능)
//   2. 주소 뒤에 무엇을 붙여 넣든 최종 호출은 <주소>/v1/version 하나로 정규화된다(중복 금지)
//   3. 저장은 '기본 주소' 형태로 통일된다
//   4. 결과에 curl 로 그대로 쓸 수 있는 완성 주소가 실려 나간다
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(ROOT, "scripts", "config.js"), "utf8").replace(/^﻿/, "");
const modal = fs.readFileSync(path.join(ROOT, "scripts", "model-modal.js"), "utf8").replace(/^﻿/, "");

function grab(src, name) {
  const at = src.indexOf("function " + name + "(");
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  let d = 0;
  const s = src.indexOf("{", at);
  for (let k = s; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(at, k + 1); }
  }
  throw new Error("unbalanced");
}

const DEFAULT_URL = "https://version-ns-17786299267796664.mng-1.ip.violet.uplus.co.kr";
let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

// "use strict" 안에서는 eval 로 선언한 함수가 바깥 스코프에 안 남는다 → 식으로 받아 온다.
// eslint-disable-next-line no-eval
const versionCheckUpstreamBase = eval("(" + grab(cfg, "versionCheckUpstreamBase") + ")");
// eslint-disable-next-line no-eval
const versionCheckUpstreamEndpoint = eval(
  "(" + grab(cfg, "versionCheckUpstreamEndpoint").replace("versionCheckUpstreamBase(raw)", "__base(raw)") + ")"
).bind(null);
globalThis.__base = versionCheckUpstreamBase;

console.log("[1] 기본 실제주소");
check("상수로 박혀 있음", cfg.includes(`const VERSION_CHECK_UPSTREAM_URL = "${DEFAULT_URL}"`));
check("기본값이 그 상수", /const VERSION_CHECK_DEFAULTS = \{ upstreamUrl: VERSION_CHECK_UPSTREAM_URL, apiKey: "" \};/.test(cfg));
check("저장값이 비어 있으면 기본값으로 되살림", /upstreamUrl: saved \|\| VERSION_CHECK_UPSTREAM_URL,/.test(cfg));
check("입력칸 placeholder 도 기본 주소", /placeholder="\$\{escapeHtml\(typeof VERSION_CHECK_UPSTREAM_URL/.test(modal));
check("비워 둔 채 눌러도 기본 주소로 확인", /_typed \|\| \(typeof VERSION_CHECK_UPSTREAM_URL === "string" \? VERSION_CHECK_UPSTREAM_URL : ""\)/.test(modal));

console.log("[2] 무엇을 붙여 넣든 최종 호출은 하나 — <주소>/v1/version");
const want = DEFAULT_URL + "/v1/version";
for (const input of [
  DEFAULT_URL,
  DEFAULT_URL + "/",
  DEFAULT_URL + "/v1",
  DEFAULT_URL + "/v1/",
  DEFAULT_URL + "/version",
  DEFAULT_URL + "/v1/version",
  "  " + DEFAULT_URL + "  ",
]) {
  const got = versionCheckUpstreamEndpoint(input);
  check(`"${input.trim().replace(DEFAULT_URL, "…")}" → /v1/version`, got === want, got);
}
check("포트 주소도 동일 규칙", versionCheckUpstreamEndpoint("http://10.0.0.5:8100/v1/") === "http://10.0.0.5:8100/v1/version",
  versionCheckUpstreamEndpoint("http://10.0.0.5:8100/v1/"));
check("빈 값은 빈 값", versionCheckUpstreamEndpoint("") === "");
check("/version 이 두 번 붙지 않음", !/\/version\/v1\/version|\/v1\/version\/v1/.test(versionCheckUpstreamEndpoint(DEFAULT_URL + "/v1/version")));

console.log("[3] 저장 형태 — 기본 주소로 통일");
check("saveVersionCheckSettings 가 정규화해 저장", /upstreamUrl: versionCheckUpstreamBase\(\(next && next\.upstreamUrl\) \|\| ""\)/.test(cfg));
check("base 는 끝의 /v1·/version 을 떼어냄",
  versionCheckUpstreamBase(DEFAULT_URL + "/v1/version") === DEFAULT_URL, versionCheckUpstreamBase(DEFAULT_URL + "/v1/version"));

console.log("[4] 결과에 curl 로 쓸 완성 주소가 나온다");
check("runVersionCheck 가 upstreamUrl 을 채움", /out\.upstreamUrl = versionCheckUpstreamEndpoint\(conf\.upstreamUrl\);/.test(cfg));
check("반환 초기값에 upstreamUrl·authHeader 포함", /const out = \{ ok: false,[^\n]*upstreamUrl: "", authHeader: "", error: "" \};/.test(cfg));
check("화면에 호출 주소 표시", /호출 주소: <code style="user-select:all">/.test(modal));
check("화면에 curl 예시 표시(인증 헤더 포함)", /curl -s\$\{curlAuth\} "\$\{escapeHtml\(data\.upstreamUrl\)\}"/.test(modal));

console.log("[5] 인증 헤더 — 게이트웨이가 Api-Key 를 요구한다(curl 실측)");
check("AI 호출과 같은 헤더 생성기를 쓴다", /openAICompatAuthHeaders\(_verKey,/.test(cfg));
check("요청에 인증 헤더를 실어 보낸다", /headers: \{ accept: "application\/json", "X-B2B-Vllm-Base": conf\.upstreamUrl, \.\.\._authHeaders \}/.test(cfg));
check("버전 서버 전용 키를 설정에서 받는다", /apiKey: String\(parsed\.apiKey \|\| ""\)\.trim\(\)/.test(cfg));
check("비어 있으면 AI 키로 폴백", /String\(conf\.apiKey \|\| ""\)\.trim\(\)\s*\|\|\s*String\(\(typeof settings === "object"/.test(cfg));
// 키 값은 이 파일에도 적지 않는다(테스트 파일도 저장소에 올라간다).
// '버전 확인용 키가 코드에 박혔는지'는 값을 몰라도 형태로 판별할 수 있다.
check("버전 확인 키 기본값은 빈 문자열", /VERSION_CHECK_DEFAULTS = \{[^}]*apiKey: ""/.test(cfg));
check("설정 화면 입력칸에 키가 미리 박혀 있지 않다", /id="set-ver-apikey" value="\$\{escapeHtml\(verCfg\.apiKey \|\| ""\)\}"/.test(modal));
check("설정 화면에 키 입력칸", /id="set-ver-apikey"/.test(modal));
check("버전 확인 누를 때 키도 저장", /apiKey: \(\$\("set-ver-apikey"\) \|\| \{\}\)\.value \|\| ""/.test(modal));
check("화면에는 키 값을 찍지 않는다(헤더 이름만)", /<설정한 키>/.test(modal) && !/data\.apiKey/.test(modal));

console.log("[6] 프록시 규칙과 어긋나지 않는가(서버 쪽 계약)");
const serve = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8");
check("프록시는 경로를 그대로 붙인다(target = base + path)", /target = base \+ self\.path/.test(serve));
check("실제주소 헤더를 읽는다", /x-b2b-vllm-base/.test(serve));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
