// [실행 검증] '첫 녹화 → 취소 = 녹화 전 복원' — 녹화 버튼 IIFE 의 '실제 코드'를 추출해 그대로 실행.
// (regex 배선이 아니라 진짜 제어흐름: 앱 첫 실행 상태(파이프라인 0스텝, 실행 이력 0)에서
//  ① 시작 클릭 → 스냅샷이 레코더 시작보다 먼저 뜨는가 ② 정지→검토 취소 → 그 스냅샷으로
//  /api/excel/replace 복원되는가 ③ 스냅샷 저장 실패면 복원 없이 정직한 경고인가
//  ④ 수확 전 정지 실패면 녹화 상태가 유지되는가(재시도 가능)를 실행으로 확인)
// 실행: node diagnostics/_test_record_cancel_exec.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

let pass = 0, fail = 0;
const t = (n, c, got) => {
  if (c) { pass++; console.log("PASS " + n); }
  else { fail++; console.log("FAIL " + n + (got !== undefined ? "  got=" + JSON.stringify(got) : "")); }
};

// ── 녹화 IIFE 추출: 앵커 뒤 첫 "(function () {" 부터 중괄호 균형 → "})();" 확인 ──
const anchor = pj.indexOf("녹화 모드 (ixi-Cell-R recorder 통합)");
const iifeStart = pj.indexOf("(function () {", anchor);
let iife = null;
{
  const open = pj.indexOf("{", iifeStart);
  let d = 0;
  for (let i = open; i < pj.length; i++) {
    if (pj[i] === "{") d++;
    else if (pj[i] === "}") { d--; if (d === 0) { iife = pj.slice(iifeStart, i + 1) + ")();"; break; } }
  }
}
t("0 녹화 IIFE 추출(닫힘 검증)", !!iife && pj.slice(iifeStart + iife.length - 4, iifeStart + iife.length).includes(")()")
  && /btn\.onclick = async/.test(iife));

// ── 하네스: with(Proxy) 스코프 — 모든 자유 식별자를 가로채 스텁/전역을 공급 ──
function makeEnv(routes) {
  const CALLS = [];
  const btn = { textContent: "● 녹화(beta)", style: {}, disabled: false, onclick: null };
  const cap = { disabled: false, title: "" };
  const state = { pipeline: [], currentFileId: "input:월정산.xlsx", inputs: [] };
  const gt = {};   // globalThis 스텁
  const known = {
    // 전역(화이트리스트) — with 프록시가 전부 가로채므로 필요한 진짜 전역을 명시 공급
    Object, Array, String, Number, Boolean, JSON, Math, Date, Promise, Set, Map, RegExp, Error,
    Symbol, console, setTimeout, clearTimeout, parseInt, parseFloat, isFinite, performance,
    globalThis: gt, window: {},
    // DOM/앱 스텁
    $: (id) => (id === "btn-excel-record" ? btn : (id === "btn-capture-copypaste" ? cap : null)),
    toast: (msg, kind) => CALLS.push({ kind: "toast", level: kind, msg: String(msg).slice(0, 200) }),
    vbaTargetExcelId: () => "EX1",
    currentExcelId: () => "EX1",
    excelMirror: { sessionsByFileId: { "input:월정산.xlsx": "EX1" }, runnerHeadless: false },
    postExcelMirror: async (p, body) => {
      CALLS.push({ kind: "post", path: p, excelId: body && body.excelId, resultId: body && body.resultId });
      const r = routes[p];
      if (typeof r === "function") return r(body);
      if (r instanceof Error) throw r;
      return r || { ok: true };
    },
    showRecordReviewDialog: async (entries) => { CALLS.push({ kind: "review", entries: entries.length }); return routes.__picked || []; },
    beginExcelMirrorApplyLoading: (msg) => CALLS.push({ kind: "loading.begin", msg: String(msg).slice(0, 30) }),
    endExcelMirrorApplyLoading: () => CALLS.push({ kind: "loading.end" }),
    showOnlyExcelMirrorWindow: async (eid) => CALLS.push({ kind: "showOnly", excelId: eid }),
    state,
  };
  const scope = new Proxy(known, {
    has: () => true,                      // 모든 식별자를 이 스코프에서 해석
    get: (tgt, k) => {
      if (k === Symbol.unscopables) return undefined;
      if (k in tgt) return tgt[k];
      return undefined;                   // 미지 심볼 → undefined (typeof 가드가 자연 스킵)
    },
    set: (tgt, k, v) => { tgt[k] = v; return true; },
  });
  new Function("__scope", "with(__scope){\n" + iife + "\n}")(scope);
  return { CALLS, btn, state, gt };
}

const STOP_OK = {
  ok: true,
  steps: [{ language: "vba", code: "Sub B2BSkill()\n    Range(\"A1\").Select\nEnd Sub\n", description: "녹화된 작업", prompt: "[녹화됨/VBA]", recorded: true }],
  raw_actions: 3, distilled: 1, summary: "", expected: [],
  recordedWorkbook: "월정산.xlsx", recordedExcelId: "EX1",
};

(async () => {
  // ══ A. 첫 녹화(파이프라인 0스텝·실행 이력 0) → 시작 → 정지 → 검토 '취소' ══
  {
    const routes = {
      "/api/excel/save": { ok: true, downloadId: "SNAP-FIRST" },
      "/api/excel/record/start": { ok: true, recording: true },
      "/api/excel/record/stop": STOP_OK,
      "/api/excel/replace": { ok: true, replaced: true },
      __picked: [],                                    // 검토에서 취소(아무 스텝도 추가 안 함)
    };
    const { CALLS, btn, state, gt } = makeEnv(routes);
    await btn.onclick();                               // ① 시작 클릭
    const saveIdx = CALLS.findIndex(c => c.kind === "post" && c.path === "/api/excel/save");
    const startIdx = CALLS.findIndex(c => c.kind === "post" && c.path === "/api/excel/record/start");
    t("A1 첫 녹화에도 스냅샷이 뜬다(save 1회, EX1)", saveIdx >= 0 && CALLS[saveIdx].excelId === "EX1");
    t("A2 스냅샷이 레코더 시작보다 '먼저'(실행 순서)", startIdx > saveIdx);
    t("A3 녹화 중 표시(버튼·전역 플래그)", btn.textContent.includes("정지") && gt.__excelRecordingActive === true);
    await btn.onclick();                               // ② 정지 클릭 → 검토에서 취소
    const repIdx = CALLS.findIndex(c => c.kind === "post" && c.path === "/api/excel/replace");
    t("A4 취소 → 시작 때 그 스냅샷으로 복원(replace, resultId=SNAP-FIRST)",
      repIdx >= 0 && CALLS[repIdx].resultId === "SNAP-FIRST" && CALLS[repIdx].excelId === "EX1", CALLS.filter(c => c.kind === "post"));
    t("A5 복원 후 녹화 세션으로 착지(showOnly EX1)", CALLS.some(c => c.kind === "showOnly" && c.excelId === "EX1"));
    t("A6 성공 토스트(되돌렸습니다)", CALLS.some(c => c.kind === "toast" && /녹화 전 상태로 되돌렸습니다/.test(c.msg)));
    t("A7 파이프라인에 스텝 미추가(취소니까)", state.pipeline.length === 0);
    t("A8 녹화 상태 해제(버튼·플래그 복귀)", !btn.textContent.includes("정지") && gt.__excelRecordingActive === false);
  }

  // ══ B. 첫 녹화인데 스냅샷 저장이 '실패' → 취소해도 복원 없이 정직한 경고 ══
  {
    const routes = {
      "/api/excel/save": new Error("save timeout"),
      "/api/excel/record/start": { ok: true, recording: true },
      "/api/excel/record/stop": STOP_OK,
      "/api/excel/replace": { ok: true },
      __picked: [],
    };
    const { CALLS, btn } = makeEnv(routes);
    await btn.onclick();                               // 시작(스냅샷 실패해도 녹화는 진행)
    t("B1 스냅샷 실패해도 녹화는 시작됨", CALLS.some(c => c.path === "/api/excel/record/start") && btn.textContent.includes("정지"));
    await btn.onclick();                               // 정지 → 취소
    t("B2 스냅샷이 없으니 replace 호출 0회(파괴 없음)", !CALLS.some(c => c.path === "/api/excel/replace"));
    t("B3 '스냅샷이 없어 화면은 그대로' 경고", CALLS.some(c => c.kind === "toast" && /스냅샷이 없어 화면은 그대로/.test(c.msg)));
  }

  // ══ C. 셀 편집 등으로 '수확 전' 정지 실패 → 녹화 상태 유지(재시도 가능) ══
  {
    const routes = {
      "/api/excel/save": { ok: true, downloadId: "SNAP-C" },
      "/api/excel/record/start": { ok: true, recording: true },
      "/api/excel/record/stop": new Error("Excel COM 작업이 120초 안에 끝나지 않았습니다."),
      __picked: [],
    };
    const { CALLS, btn, gt } = makeEnv(routes);
    await btn.onclick();                               // 시작
    await btn.onclick();                               // 정지 시도 → 수확 실패
    t("C1 수확 전 정지 실패 → 녹화 유지(버튼 '정지' 그대로·플래그 true)",
      btn.textContent.includes("정지") && gt.__excelRecordingActive === true, btn.textContent);
    t("C2 재시도 안내 토스트", CALLS.some(c => c.kind === "toast" && /다시 눌러 주세요/.test(c.msg)));
    // 재시도(이번엔 성공) → 취소 흐름 정상 완주
    routes["/api/excel/record/stop"] = STOP_OK;
    routes["/api/excel/replace"] = { ok: true };
    await btn.onclick();                               // 재시도 정지 → 취소
    t("C3 재시도 정지 성공 → 취소 복원까지 완주(SNAP-C)",
      CALLS.some(c => c.path === "/api/excel/replace" && c.resultId === "SNAP-C"));
  }

  console.log(pass + "/" + (pass + fail) + " PASS");
  process.exit(fail ? 1 : 0);
})();
