// [스킬 수정→원 요청 스크롤] _matchStepToChatIndex 를 실제 5단계 zip 데이터로 검증.
// renderChatFromHistory 와 동일하게 entries=[system, user, assistant(코드분리), ...] 를 만든 뒤
// 각 스텝이 어느 채팅 엔트리로 가는지 출력(특히 3단계).
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// --- 매칭 코어 슬라이스 로드 ---
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const a = src.indexOf("function _chatNormForMatch");
const b = src.indexOf("function scrollChatToStepRequest");
eval(src.slice(a, b) + "\nglobalThis.match=_matchStepToChatIndex; globalThis.clean=cleanChatDisplayText;");

// --- zip 에서 logic.json 읽기(STORED/DEFLATE 모두 대응, 최소 파서) ---
const ZIP = "C:\\Users\\Admin\\Downloads\\531611708899생명 로우데이터_DSMC_260616_5단계_2026-07-01-09-33-01.zip";
function readLogicJson(zipPath) {
  const buf = fs.readFileSync(zipPath);
  // central directory 안 쓰고 local file header 순회
  let off = 0; const out = {};
  while (off + 4 <= buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const method = buf.readUInt16LE(off + 8);
    const compSize = buf.readUInt32LE(off + 18);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const name = buf.toString("utf8", off + 30, off + 30 + nameLen);
    const dataStart = off + 30 + nameLen + extraLen;
    const comp = buf.slice(dataStart, dataStart + compSize);
    if (name.endsWith(".logic.json")) {
      const raw = method === 0 ? comp : zlib.inflateRawSync(comp);
      out.logic = JSON.parse(raw.toString("utf8"));
    }
    off = dataStart + compSize;
  }
  return out.logic;
}

function extractCode(text) {
  const m = /```(?:vba|python|javascript|js)?\s*([\s\S]*?)```/i.exec(String(text || ""));
  return m ? m[1].trim() : "";
}

const logic = readLogicJson(ZIP);
const steps = logic.pipeline;
const hist = logic.chatHistory || [];

// entries: renderChatFromHistory 와 동일(사용자 말풍선은 cleanChatDisplayText 로 정리, 빈 것은 숨김).
const entries = [{ role: "system", text: `저장된 대화 ${hist.length}개 복원`, code: "" }];
for (const m of hist) {
  if (m.role === "user") {
    const shown = clean(m.content);
    if (shown && shown.trim()) entries.push({ role: "user", text: shown, code: "" });
  } else if (m.role === "assistant") {
    entries.push({ role: "assistant", text: String(m.content || "").replace(/```[\s\S]*?```/g, "").trim(), code: extractCode(m.content) });
  }
}

console.log(`스텝 ${steps.length}개, 채팅엔트리 ${entries.length}개 (user ${entries.filter(e=>e.role==="user").length}, assistant ${entries.filter(e=>e.role==="assistant").length})\n`);
let pass = 0, fail = 0;
steps.forEach((step, i) => {
  const idx = match(step, entries, i);
  const e = idx >= 0 ? entries[idx] : null;
  const snip = e ? (e.text || "").replace(/\s+/g, " ").slice(0, 48) : "(매칭 실패)";
  console.log(`Step ${i + 1} [${step.description}] → entry#${idx} (${e ? e.role : "-"}): ${snip}`);
  if (idx >= 0) pass++; else fail++;
});
console.log(`\n매칭됨 ${pass}/${steps.length}`);
// 3단계는 반드시 어딘가로 이동해야 함(사용자 요구)
const idx3 = match(steps[2], entries, 2);
console.log("\n[핵심] Step 3 매칭 인덱스:", idx3, idx3 >= 0 ? "→ OK(이동함)" : "→ FAIL(안움직임)");
process.exit(idx3 >= 0 ? 0 : 1);
