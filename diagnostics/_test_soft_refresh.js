// [새로고침(작업 유지)] 소프트 리프레시 회귀 — 실측 요청(2026-07-31): 프로그램/Excel 먹통 때
// '초기화'(전부 삭제) 말고, 업로드 파일·스킬·대화를 유지한 채 프로그램만 새로 시작.
// scripts/soft-refresh.js 의 '실제 함수'(collectSoftRefreshSnapshot/restoreSoftRefreshSnapshot)를
// 추출해 가짜 state/fetch 로 스냅샷→복원 왕복을 구동한다(Excel 불필요). AI 도움 버튼 노출과
// index.html 배선(버튼/스크립트 태그)도 소스에서 확인한다.
// 실행: node diagnostics/_test_soft_refresh.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const srcSoft = fs.readFileSync(path.join(ROOT, "scripts", "soft-refresh.js"), "utf8");
const srcBackend = fs.readFileSync(path.join(ROOT, "scripts", "backend-workbooks.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const t = (n, c, got) => {
  if (c) { pass++; console.log("PASS " + n); }
  else { fail++; console.log("FAIL " + n + (got !== undefined ? "  got=" + JSON.stringify(got) : "")); }
};

function extractFn(str, name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(");
  const m = re.exec(str);
  if (!m) throw new Error("not found: " + name);
  const start = m.index;
  let i = start + m[0].length - 1, pd = 0;
  for (; i < str.length; i++) {
    if (str[i] === "(") pd++;
    else if (str[i] === ")") { pd--; if (pd === 0) { i++; break; } }
  }
  const open = str.indexOf("{", i);
  let d = 0;
  for (let j = open; j < str.length; j++) {
    if (str[j] === "{") d++;
    else if (str[j] === "}") { d--; if (d === 0) return str.slice(start, j + 1); }
  }
  throw new Error("unbalanced: " + name);
}

// ── 가짜 환경 구성 ──
function makeEnv() {
  const state = {
    inputs: [], inputsOriginal: [], outputTemplates: [], activeOutputIndex: -1,
    pipeline: [], chatHistory: [], currentFileId: null, fuzzyResolution: {},
    output: null, outputOriginal: null, currentSheet: null, selectedSheets: [],
  };
  const store = {};
  const sessionStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const serverMeta = {   // reinspect 가 돌려줄 meta (업로드와 동일 형태)
    "wb-1": { sheetNames: ["시트A", "시트B"], sheets: { "시트A": { rows: [["h"], ["v"]], maxRow: 2, maxCol: 1 } } },
    "wb-2": { sheetNames: ["출력1"], sheets: { "출력1": { rows: [["o"]], maxRow: 1, maxCol: 1 } } },
  };
  const fetchCalls = [];
  const env = {
    state, sessionStorage,
    location: { reload: () => { env._reloaded = true; } },
    fetch: async (url, opts) => {
      fetchCalls.push(url);
      const body = JSON.parse((opts && opts.body) || "{}");
      const meta = serverMeta[body.workbookId];
      return {
        ok: !!meta, status: meta ? 200 : 404,
        json: async () => meta ? { ok: true, workbookId: body.workbookId, name: body.workbookId === "wb-1" ? "입력.xlsx" : "출력.xlsx", meta } : { ok: false, error: "unknown workbookId" },
      };
    },
    // save-load 의존 — 스킬 매니페스트는 진짜 빌더 대신 최소 동형(계약: entries[0].text = manifest JSON)
    buildLogicZipEntries: name => [{ name: name + ".logic.json", text: JSON.stringify({ version: 3, name, pipeline: state.pipeline, chatHistory: state.chatHistory, envConfig: null, saveBaseName: name }) }],
    defaultLogicBaseNameFromInputs: () => "logic",
    timestampedLogicArchiveName: b => b + "_t",
    loadLogic: (data) => { state.pipeline = JSON.parse(JSON.stringify(data.pipeline || [])); state.chatHistory = data.chatHistory || []; env._logicLoaded = true; },
    // drop-handling/file-parsing 의존
    ensureWorkbookDisplayName: (rec, f, fb) => { if (!rec.name) rec.name = (f && f.name) || fb; },
    cloneFileRecord: r => JSON.parse(JSON.stringify(r)),
    makeOutputTemplate: parsed => ({ id: "tpl", file: parsed, original: JSON.parse(JSON.stringify(parsed)) }),
    activateOutputTemplate: idx => { state.activeOutputIndex = idx; state.output = state.outputTemplates[idx] && state.outputTemplates[idx].file; return true; },
    getFile: id => (id && String(id).startsWith("input:")) ? state.inputs[0] || null : null,
    renderInputList: () => {}, renderOutputChip: () => {}, refreshTabs: () => {}, refreshChatState: () => {},
    preopenAllExcelMirrors: async () => { env._preopened = true; },
    runPipelineWithAutoRepair: async (opts) => { env._autoApplied = opts; },
    toast: (msg) => { env._toasts = (env._toasts || []).concat(msg); },
    beginUiBusy: () => "tok", endUiBusy: () => {},
    console, JSON, Promise, Date, Math, String, Object, Array, Number, setTimeout,
    workbookDisplayName: (f, fb) => (f && f.name) || fb || "",
  };
  // createBackendPreviewRecord 는 '실제' 구현을 쓴다(업로드와 복원의 레코드 동형성 보장 핵심)
  const H = [
    extractFn(srcBackend, "createBackendPreviewRecord"),
    extractFn(srcSoft, "collectSoftRefreshSnapshot"),
    extractFn(srcSoft, "_softRefreshRebuildFile"),
    extractFn(srcSoft, "restoreSoftRefreshSnapshot"),
    'const SOFT_REFRESH_KEY = "b2bSoftRefreshState";',
  ].join("\n\n") + "\nreturn { collectSoftRefreshSnapshot, restoreSoftRefreshSnapshot, createBackendPreviewRecord };";
  const api = new Function(...Object.keys(env), H)(...Object.values(env));
  return { env, state, sessionStorage, api, fetchCalls };
}

(async () => {
  // ── 왕복: 스냅샷(파일2+스킬1) → state 초기화 → 복원 ──
  const { env, state, sessionStorage, api } = makeEnv();
  state.inputs = [{ name: "입력.xlsx", backendWorkbookId: "wb-1", size: 100, sheetNames: ["시트A", "시트B"] }];
  state.outputTemplates = [{ file: { name: "출력.xlsx", backendWorkbookId: "wb-2", size: 50 }, original: { name: "출력.xlsx", backendWorkbookId: "wb-2", size: 50 } }];
  state.activeOutputIndex = 0;
  state.currentFileId = "input:입력.xlsx";
  state.pipeline = [{ id: "s1", code: "def transform(ctx): pass", language: "python", description: "테스트", enabled: true }];
  state.chatHistory = [{ role: "user", content: "질문" }];

  const snap = api.collectSoftRefreshSnapshot();
  t("스냅샷: 입력/출력 workbookId 수집", snap.inputs.length === 1 && snap.inputs[0].workbookId === "wb-1" && snap.outputs.length === 1 && snap.outputs[0].workbookId === "wb-2", snap);
  t("스냅샷: 스킬 매니페스트 포함(파이프라인+대화)", !!snap.logic && snap.logic.pipeline.length === 1 && snap.logic.chatHistory.length === 1);
  t("스냅샷: currentFileId 보존", snap.currentFileId === "input:입력.xlsx");

  sessionStorage.setItem("b2bSoftRefreshState", JSON.stringify(snap));
  // 리로드 후 부팅 상태 재현: state 전부 비움
  state.inputs = []; state.inputsOriginal = []; state.outputTemplates = []; state.activeOutputIndex = -1;
  state.pipeline = []; state.chatHistory = []; state.currentFileId = null;

  const restored = await api.restoreSoftRefreshSnapshot();
  t("복원: 수행됨(true)", restored === true);
  t("복원: 입력 파일 재구성(백엔드 meta 기반, 업로드와 동형)", state.inputs.length === 1 && state.inputs[0].backendWorkbookId === "wb-1" && state.inputs[0].sheetNames.join(",") === "시트A,시트B", state.inputs[0] && state.inputs[0].sheetNames);
  t("복원: inputsOriginal(pristine)도 채움", state.inputsOriginal.length === 1);
  t("복원: 출력 템플릿 재구성+활성화", state.outputTemplates.length === 1 && state.activeOutputIndex === 0);
  t("복원: 스킬+대화 loadLogic 경유", env._logicLoaded === true && state.pipeline.length === 1 && state.chatHistory.length === 1);
  t("복원: 미러 재오픈 시도", env._preopened === true);
  t("복원: 스킬 자동 재적용(runPipelineWithAutoRepair, ignoreCheckpoint)", !!env._autoApplied && env._autoApplied.ignoreCheckpoint === true, env._autoApplied);
  t("복원: 스냅샷 1회용(재부팅 시 재실행 안 함)", sessionStorage.getItem("b2bSoftRefreshState") === null);
  const again = await api.restoreSoftRefreshSnapshot();
  t("복원: 두 번째 호출은 no-op(false)", again === false);

  // ── 실패 파일 부분 복원: 서버에 없는 workbookId 는 실패 목록, 나머지는 복원 ──
  {
    const { env: e2, state: s2, sessionStorage: ss2, api: a2 } = makeEnv();
    ss2.setItem("b2bSoftRefreshState", JSON.stringify({
      v: 1, at: 1, inputs: [{ workbookId: "wb-1", name: "입력.xlsx", size: 1 }, { workbookId: "wb-없음", name: "삭제됨.xlsx", size: 1 }],
      outputs: [], activeOutputIndex: 0, currentFileId: null, logic: null,
    }));
    const ok2 = await a2.restoreSoftRefreshSnapshot();
    t("부분 복원: 성공 1개 + 실패 토스트", ok2 === true && s2.inputs.length === 1 && (e2._toasts || []).some(m => /실패/.test(m)), { inputs: s2.inputs.length, toasts: e2._toasts });
  }

  // ── 배선: index.html 버튼/스크립트, AI 도움 버튼 노출 ──
  t("배선: index.html 에 btn-soft-refresh 버튼", /id="btn-soft-refresh"/.test(indexHtml));
  t("배선: soft-refresh.js 스크립트 로드", /scripts\/soft-refresh\.js/.test(indexHtml));
  const aiBtn = /<button[^>]*id="btn-ai-help"[^>]*>/.exec(indexHtml);
  t("AI 도움 버튼: index.html 에 존재하고 숨김 아님", !!aiBtn && !/hidden|display:\s*none/i.test(aiBtn[0]), aiBtn && aiBtn[0]);
  t("배선: F5/Ctrl+R 가로채기(soft-refresh.js)", /"F5"/.test(srcSoft) && /preventDefault/.test(srcSoft));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
