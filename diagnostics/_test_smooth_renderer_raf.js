// [24시간 버벅임] 채팅 타자기 렌더러(createSmoothTextRenderer)의 영구 RAF 루프 수정 검증.
// 예전: 텍스트를 다 그린 뒤에도 매 프레임 재예약(60fps 헛돌기) — flush() 없이 끝나는
// 오류/중단 경로에서 아무도 안 꺼줘 실패 채팅마다 루프가 하나씩 쌓였다.
// node diagnostics/_test_smooth_renderer_raf.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
function extract(name) {
  const marker = "function " + name + "(";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("not found: " + name);
  let i = src.indexOf("{", start), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

// 수동 RAF 펌프: pending 큐를 우리가 돌린다 → '루프가 멈췄는가'를 큐 길이로 직접 관측.
const pending = new Map();
let rafSeq = 0, now = 0;
const sandbox = {
  console, Math, String,
  performance: { now: () => now },
  requestAnimationFrame: cb => { const id = ++rafSeq; pending.set(id, cb); return id; },
  cancelAnimationFrame: id => { pending.delete(id); },
};
vm.createContext(sandbox);
vm.runInContext(extract("getSmoothCharsPerFrame"), sandbox);
vm.runInContext(extract("createSmoothTextRenderer"), sandbox);

function pump(frames) {
  for (let i = 0; i < frames && pending.size; i++) {
    now += 16;
    const [id, cb] = pending.entries().next().value;
    pending.delete(id);
    cb(now);
  }
}

const el = { textContent: "" };
let renders = 0;
const r = vm.runInContext("createSmoothTextRenderer", sandbox)(el, "(비어있음)", () => { renders++; });

// (1) 스트리밍: 텍스트가 끝까지 그려진다
r.setTarget("안녕하세요 반갑습니다 테스트입니다");
pump(500);
ck("(1) 텍스트 전체 렌더", el.textContent === "안녕하세요 반갑습니다 테스트입니다", el.textContent);

// (2) [핵심] 다 그린 뒤 RAF 루프 정지 — 예전엔 pending 이 영원히 1 이상(헛돌기)
ck("(2) [핵심] 완료 후 RAF 재예약 없음(루프 정지)", pending.size === 0, pending.size);

// (3) 새 텍스트가 오면(스트리밍 계속) 루프가 다시 살아난다
r.setTarget("안녕하세요 반갑습니다 테스트입니다 — 이어지는 스트리밍 조각");
ck("(3) setTarget 으로 재개(예약 생김)", pending.size === 1, pending.size);
pump(500);
ck("(4) 이어진 텍스트도 끝까지 렌더 후 정지",
   el.textContent.endsWith("스트리밍 조각") && pending.size === 0,
   { text: el.textContent.slice(-20), pending: pending.size });

// (5) flush: 진행 중이던 예약 취소 + 전체 즉시 표시(오류/중단 경로 보장)
r.setTarget(el.textContent + " 그리고 아주 긴 추가 텍스트가 계속 이어집니다");
ck("(5) 사전조건: 예약 있음", pending.size === 1);
r.flush();
ck("(6) flush 후 예약 0 + 전체 표시",
   pending.size === 0 && el.textContent.endsWith("이어집니다"),
   { pending: pending.size, tail: el.textContent.slice(-12) });

// (7) 빈 target: 빈 문구 표시 후 정지(재예약 없음)
r.setTarget("");
pump(10);
ck("(7) 빈 텍스트 → 빈 문구 + 정지", el.textContent === "(비어있음)" && pending.size === 0,
   { text: el.textContent, pending: pending.size });

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
