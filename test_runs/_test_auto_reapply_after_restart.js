// 강제재시작 후 1회 자동 재적용 게이팅 검증.
// maybeAutoReapplyAfterRestart 를 소스에서 떼어내 목(mock) 전역으로 동작/루프가드를 검증한다.
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "excel-mirror.js"), "utf8");

const start = src.indexOf("async function maybeAutoReapplyAfterRestart");
if (start < 0) { console.error("maybeAutoReapplyAfterRestart 정의를 찾지 못함"); process.exit(2); }
// 함수 끝: 다음 함수 정의 직전까지 잘라낸다(이 함수 뒤에 다른 선언이 옴).
const after = src.indexOf("\nfunction ", start) > 0
  ? Math.min(...["\nfunction ", "\nasync function ", "\nconst ", "\n// ----"].map(m => { const i = src.indexOf(m, start + 10); return i < 0 ? Infinity : i; }))
  : src.length;
const block = src.slice(start, after);

let pass = 0, fail = 0;
const check = (n, c) => { (c ? pass++ : fail++); console.log((c ? " OK  " : "FAIL ") + n); };

// 공용 목 환경 빌더
function makeEnv({ pipeline, runImpl }) {
  const toasts = [];
  let runCalls = 0;
  const statuses = [];
  const env = {
    state: { pipeline },
    excelMirror: {},
    isStepEnabled: (s) => s.enabled !== false,
    getActivePipelineStepIds: () => (pipeline || []).map(s => s.id),
    setPipelineRuntimeStatus: (ids, status) => statuses.push(status),
    setGeneratorRunLoading: () => {},
    clearPipelineExecutionMemory: () => {},
    runPipelineWithAutoRepair: async () => { runCalls++; if (runImpl) return runImpl(); },
    toast: (msg, kind) => toasts.push({ msg, kind }),
    Date,
    console,
  };
  const fn = new Function("env", `with(env){ return (${block}); }`)(env);
  return { fn, env, get runCalls() { return runCalls; }, toasts, statuses };
}

(async () => {
  // 1) 적용 안 돼있던 상태(wasApplied=false) → 실행 안 함
  {
    const t = makeEnv({ pipeline: [{ id: "a", code: "x", enabled: true }] });
    await t.fn(false);
    check("[게이트] wasApplied=false → 재적용 호출 0회", t.runCalls === 0);
  }

  // 2) 켜진 스텝이 없으면 → 실행 안 함
  {
    const t = makeEnv({ pipeline: [{ id: "a", code: "x", enabled: false }] });
    await t.fn(true);
    check("[게이트] 활성 스텝 없음 → 재적용 호출 0회", t.runCalls === 0);
  }

  // 3) 정상 경로: wasApplied=true + 활성 스텝 → 1회 실행 + 성공 토스트
  {
    const t = makeEnv({ pipeline: [{ id: "a", code: "x", enabled: true }] });
    await t.fn(true);
    check("[정상] 1회 자동 재적용 호출", t.runCalls === 1);
    check("[정상] 성공 토스트 표시", t.toasts.some(x => /자동으로 다시 적용했습니다/.test(x.msg)));
    check("[정상] applied 상태로 마감", t.statuses[t.statuses.length - 1] === "applied");
  }

  // 4) 루프 가드: 쿨다운이 살아있으면 → 재실행 안 하고 안내만
  {
    const t = makeEnv({ pipeline: [{ id: "a", code: "x", enabled: true }] });
    await t.fn(true);                       // 1회차: 실행 + 쿨다운 설정
    const callsAfterFirst = t.runCalls;
    await t.fn(true);                       // 2회차(쿨다운 내): 실행 금지
    check("[루프가드] 쿨다운 내 2회차는 재실행 안 함", t.runCalls === callsAfterFirst);
    check("[루프가드] 2회차는 '전체 실행 다시' 안내만", t.toasts.some(x => /전체 실행을 다시 눌러/.test(x.msg)));
  }

  // 5) 1회 시도 실패 → 재시도 없이 안내만 + error 상태
  {
    const t = makeEnv({
      pipeline: [{ id: "a", code: "x", enabled: true }],
      runImpl: () => { throw new Error("boom"); },
    });
    await t.fn(true);
    check("[실패] 실패해도 호출은 1회뿐(재시도 없음)", t.runCalls === 1);
    check("[실패] '직접 전체실행' 안내 토스트", t.toasts.some(x => /직접 눌러/.test(x.msg)));
    check("[실패] error 상태로 마감", t.statuses[t.statuses.length - 1] === "error");
  }

  console.log("\n=== RESULT: " + pass + " PASS / " + fail + " FAIL ===");
  process.exit(fail ? 2 : 0);
})();
