// 실제 HCN 요약 시트 AOA(파이썬이 덤프한 JSON)를 buildSheetStructureDigest 로 돌려 다이제스트 검증.
// 선행: python test_runs/_probe_summary_total_row.py  (AOA JSON 을 temp 에 씀)
const fs = require("fs");
const path = require("path");
const os = require("os");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const start = src.indexOf("function clarifyVerifierDeterministicQuestion");
const end = src.indexOf("async function sendChat", start);
eval(src.slice(start, end) + "\nglobalThis.__digest = buildSheetStructureDigest;");

const aoa = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "b2b_summary_aoa.json"), "utf8"));
const d = globalThis.__digest(aoa, "요약");
console.log("hasLandmarks:", d.hasLandmarks);
console.log("totalRows:", JSON.stringify(d.totalRows));
console.log("---- digest.text ----");
console.log(d.text);
