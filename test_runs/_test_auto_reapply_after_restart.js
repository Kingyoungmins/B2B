// Excel 창 복구 후 '자동 재적용'의 게이트 검증.
//
// ※ 이 하네스는 오랫동안 죽어 있었다(2026-08-26 발견). 대상 함수가
//   maybeAutoReapplyAfterRestart(wasApplied)  →  maybeAutoReapplyAfterRecover(excelId)
//   로 이름과 인자가 바뀌었는데, 하네스는 옛 이름을 찾다 exit 2 로 끝나서 아무도 몰랐다.
//   현재 함수에 맞춰 다시 쓴다.
//
// 잠그는 것
//   1) 실행기에서는 자동 재적용을 하지 않는다 — 실행기의 결과물은 라이브가 아니라 출력 파일이고,
//      반영 수단은 [전체실행]뿐이다. 여기서 라이브에 스킬을 얹어 봐야 결과는 안 바뀌고 시간만 쓰며,
//      [전체실행]의 경계 스냅샷 이어실행까지 버린다. (제보 2026-08-26 "갑자기 알아서 실행되더라")
//   2) 생성기에서는 종전대로 1회 자동 재적용 + 쿨다운(루프 가드).
//   3) 재적용을 못 하는 상황이면 '적용됨' 표시를 사실대로 걷어낸다(조용한 오답 방지).
"use strict";
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "excel-mirror.js"), "utf8").replace(/^﻿/, "");

const start = src.indexOf("function maybeAutoReapplyAfterRecover");
if (start < 0) { console.error("maybeAutoReapplyAfterRecover 정의를 찾지 못함"); process.exit(2); }
const after = src.indexOf("\nfunction ", start + 10);
const block = src.slice(start, after < 0 ? src.length : after);

let pass = 0, fail = 0;
const check = (n, c, d) => {
  (c ? pass++ : fail++);
  console.log((c ? " OK  " : "FAIL ") + n + (c || d === undefined ? "" : "  → " + JSON.stringify(d).slice(0, 200)));
};

function makeEnv({ page = "generator", pipeline = [{ id: "a", code: "x", enabled: true }], now = 1000 } = {}) {
  const calls = { reapply: 0, outOfSync: [], toasts: [] };
  const env = {
    state: { pipeline, currentPage: page },
    excelMirror: {},
    pipelineUsesLiveSkill: () => true,
    pipelineUsesVba: () => true,
    reapplyVbaPipelineToLive: () => { calls.reapply += 1; return Promise.resolve(true); },
    markLivePipelineOutOfSync: (r) => calls.outOfSync.push(String(r)),
    toast: (msg) => calls.toasts.push(String(msg)),
    Date: { now: () => now },
    console,
  };
  const fn = new Function("env", `with(env){ ${block}\nreturn maybeAutoReapplyAfterRecover; }`)(env);
  return { fn, env, calls };
}

// 1) 실행기 — 자동 재적용 금지(이번 제보의 핵심)
{
  const t = makeEnv({ page: "runner" });
  t.fn("ex1");
  check("[실행기] 자동 재적용을 부르지 않는다", t.calls.reapply === 0, t.calls);
  check("[실행기] '적용 상태 풀림' 경고로 사용자를 놀래키지도 않는다", t.calls.outOfSync.length === 0, t.calls);
  check("[실행기] 토스트도 띄우지 않는다", t.calls.toasts.length === 0, t.calls);
}

// 2) 생성기 — 종전대로 1회 재적용(회귀 금지)
{
  const t = makeEnv({ page: "generator" });
  t.fn("ex1");
  check("[생성기] 1회 자동 재적용", t.calls.reapply === 1, t.calls);
  check("[생성기] 무엇을 하는지 알린다", t.calls.toasts.some(m => /자동으로 재적용/.test(m)), t.calls.toasts);
}

// 3) 루프 가드 — 쿨다운 안에서는 다시 돌지 않고, 상태를 사실대로 되돌린다
{
  const t = makeEnv({ page: "generator" });
  t.fn("ex1");
  const first = t.calls.reapply;
  t.fn("ex1");   // 같은 시각 = 쿨다운 내
  check("[루프가드] 쿨다운 내 2회차는 재적용 안 함", t.calls.reapply === first, t.calls);
  check("[루프가드] 대신 '적용됨'을 사실대로 걷어낸다", t.calls.outOfSync.includes("cooldown"), t.calls.outOfSync);
}

// 4) 켤 스텝이 없으면 아무 일도 하지 않는다
{
  const t = makeEnv({ page: "generator", pipeline: [{ id: "a", code: "x", enabled: false }] });
  t.fn("ex1");
  check("[게이트] 활성 스텝 없음 → 재적용 0회", t.calls.reapply === 0, t.calls);
}

// 5) excelId 가 없으면 아무 일도 하지 않는다
{
  const t = makeEnv({ page: "generator" });
  t.fn("");
  check("[게이트] 대상 세션 없음 → 재적용 0회", t.calls.reapply === 0, t.calls);
}

console.log("");
console.log(fail === 0 ? `RESULT: ${pass} PASS / 0 FAIL` : `RESULT: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
