// ixi 설정 최신화 검증: config.js 의 신규 URL/키/모델 리터럴 + 마이그레이션 헬퍼 로직.
const fs = require("fs"), path = require("path");
const cfg = fs.readFileSync(path.join(__dirname, "..", "scripts", "config.js"), "utf8");

let pass = 0, fail = 0;
const check = (n, c) => { (c ? pass++ : fail++); console.log((c ? " OK  " : "FAIL ") + n); };

// --- 1) 파일 리터럴 값 ---
check("신규 upstream URL 적용", cfg.includes('IXI_VIOLET_BASE_URL = "https://e2e-ns-17786299267796664.mng-1.ip.violet.uplus.co.kr"'));
check("openai-compat apiKey = 653265", /"openai-compat":\s*\{\s*apiKey:\s*"653265"/.test(cfg));
check("모델 = Qwen3.6-27B-FP8", cfg.includes('["Qwen3.6", "27B", "FP8"].join("-")'));
check("레거시 upstream 마이그레이션 목록 존재", cfg.includes("canvas-ns-1727666527880704"));
check("레거시 apiKey(7365676d) 마이그레이션 목록 존재", /IXI_LEGACY_API_KEYS\s*=\s*\["7365676d"\]/.test(cfg));

// --- 2) 마이그레이션 헬퍼 로직 (config.js 에서 추출 후 eval) ---
const IXI_VIOLET_BASE_URL = "https://e2e-ns-17786299267796664.mng-1.ip.violet.uplus.co.kr";
const IXI_LEGACY_UPSTREAMS = ["http://canvas-ns-1727666527880704.mng.ip.violet.uplus.co.kr"];
const IXI_LEGACY_API_KEYS = ["7365676d"];
const DEFAULTS = { "openai-compat": { apiKey: "653265", proxyUpstream: IXI_VIOLET_BASE_URL } };
const s = cfg.indexOf("function normalizeIxiProxyUpstream");
const e = cfg.indexOf("function normalizeThinkControlMode");
let block = cfg.slice(s, e);
block += "\nglobalThis.__up = normalizeIxiProxyUpstream; globalThis.__key = normalizeIxiApiKey;";
eval(block);
const up = globalThis.__up, key = globalThis.__key;

// proxyUpstream
check("빈 upstream -> 신규", up("", null) === IXI_VIOLET_BASE_URL);
check("옛 canvas upstream -> 신규(마이그레이션)", up(IXI_LEGACY_UPSTREAMS[0], null) === IXI_VIOLET_BASE_URL);
check("커스텀 upstream 유지", up("http://my-host:8000", null) === "http://my-host:8000");
check("옛 upstream + devModeSet 유지", up(IXI_LEGACY_UPSTREAMS[0], { devModeSet: true }) === IXI_LEGACY_UPSTREAMS[0]);

// apiKey
check("ixi 빈 키 -> 653265", key("ixi", "", null, null) === "653265");
check("ixi 옛 키 7365676d -> 653265(마이그레이션)", key("ixi", "7365676d", null, null) === "653265");
check("ixi 커스텀 키 유지", key("ixi", "mykey", null, null) === "mykey");
check("ixi 옛 키 + devModeSet 유지", key("ixi", "7365676d", null, { devModeSet: true }) === "7365676d");
check("dev-vllm 키는 그대로(7365676d)", key("dev-vllm", "7365676d", { apiKey: "7365676d" }, null) === "7365676d");

console.log("\n=== RESULT: " + pass + " PASS / " + fail + " FAIL ===");
process.exit(fail ? 2 : 0);
