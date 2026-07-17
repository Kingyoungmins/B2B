// [실행기 스킬 편집기] 삭제 → 재업로드 시 모달 목록이 "업로드된 스킬이 없습니다"로 남던 버그.
// loadLogic 이 (모달이 열려 있고 그 내용이 스킬 편집기일 때) openRunnerLogicEditor 를 다시
// 불러 목록을 갱신하는지 검증. node diagnostics/_test_runner_logic_modal_refresh.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
const ck = (n, c, g) => { console.log((c ? " OK  " : "FAIL ") + n + (c ? "" : "  got=" + JSON.stringify(g))); if (!c) fails++; };

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "save-load.js"), "utf8");
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

// DOM/의존 스텁 — 모달 표시 여부와 편집기 존재 여부를 케이스별로 조정한다.
const dom = { modalShown: false, editorOpen: false };
const sandbox = {
  console, JSON, Array, Object,
  state: {},
  deepClone: v => JSON.parse(JSON.stringify(v)),
  rememberLogicSaveBaseName: v => v,
  ensurePipelineStepIds: () => {},
  invalidateLivePipelineApplied: () => {},
  renderPipeline: () => {},
  renderChatFromHistory: () => {},
  refreshChatState: () => {},
  refreshRunButton: () => {},
  toast: () => {},
  openRunnerLogicEditor: () => { sandbox.__editorRefreshed = true; },
  document: {
    getElementById: id => {
      if (id === "modal-bg") return { classList: { contains: c => c === "show" && dom.modalShown } };
      if (id === "runner-logic-upload") return dom.editorOpen ? {} : null;
      return null;
    },
  },
  __editorRefreshed: false,
};
vm.createContext(sandbox);
vm.runInContext(extract("loadLogic"), sandbox);

const run = () => {
  sandbox.__editorRefreshed = false;
  vm.runInContext(`loadLogic({ pipeline: [{ id: "s1", code: "x" }], name: "테스트스킬" }, "테스트스킬.zip", null)`, sandbox);
  return sandbox.__editorRefreshed;
};

// (1) 스킬 편집기 모달이 열린 상태에서 zip 업로드 → 모달 재렌더(실측 버그의 수정)
dom.modalShown = true; dom.editorOpen = true;
ck("(1) [핵심] 편집기 모달 열림 + 업로드 → 모달 갱신", run() === true);

// (2) 모달이 닫혀 있으면 안 건드림(일반 업로드 경로 회귀 0)
dom.modalShown = false; dom.editorOpen = true;
ck("(2) 모달 닫힘 → 갱신 안 함", run() === false);

// (3) 다른 모달(편집기 아님)이 떠 있으면 안 건드림
dom.modalShown = true; dom.editorOpen = false;
ck("(3) 다른 모달 → 갱신 안 함", run() === false);

// (4) 로드 자체는 정상(파이프라인 반영)
ck("(4) 파이프라인 로드 정상", sandbox.state.pipeline && sandbox.state.pipeline.length === 1,
   sandbox.state.pipeline);

console.log("\n=== RESULT: " + (fails === 0 ? "ALL PASS" : fails + " FAIL") + " ===");
process.exit(fails ? 1 : 0);
