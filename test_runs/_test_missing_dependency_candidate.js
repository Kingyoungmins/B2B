const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");
const start = src.indexOf("function pipelineExtractAssistantCode");
const end = src.indexOf("function resolveRunnerRecoveryStepIndex");
if (start < 0 || end < 0 || end <= start) throw new Error("missing dependency helper slice not found");

let suggested = [];
globalThis.state = { chatHistory: [] };
globalThis.extractCode = (text) => {
  const m = /```(?:vba|vb)?\s*([\s\S]*?)```/i.exec(String(text || ""));
  return m ? m[1].trim() : "";
};
globalThis.addMessage = (role, text) => suggested.push({ role, text });
globalThis.addAssistantReply = (content, ctx) => suggested.push({ role: "assistant", content, ctx });
globalThis.window = {};

eval(src.slice(start, end) + "\nglobalThis.H = { pipelineCodeCreatesSheetNamed, findChatHistorySheetCreationCandidate, findMissingDependencySkillSuggestion, offerMissingDependencySkillCandidate };");

const pivotPrompt = "피벗의 형태로 만들껀데. 새로운 시트에 VIEW D/H/R 기준으로 피벗_결과를 만들어줘";
const staticPrompt = "방금 생성한 VBA 가 적용 직전 정적 안전 검사에서 막혔습니다.\n## 막힌 코드\n...";
const pivotCode = `
Sub B2BSkill()
    Set wsNew = ActiveWorkbook.Worksheets.Add(After:=ActiveWorkbook.Worksheets(ActiveWorkbook.Worksheets.Count))
    wsNew.Name = "피벗_결과"
End Sub`;
const failedCode = `
Sub B2BSkill()
    Set ws = ActiveWorkbook.Worksheets("피벗_결과")
    ws.Cells(1, 9).Value = "총합계"
End Sub`;

state.chatHistory = [
  { role: "user", content: pivotPrompt },
  { role: "assistant", content: "```vba\n" + pivotCode + "\n```" },
  { role: "user", content: staticPrompt },
  { role: "assistant", content: "```vba\n" + pivotCode + "\n```" },
];

if (!globalThis.H.pipelineCodeCreatesSheetNamed(pivotCode, "피벗_결과")) {
  throw new Error("pivot sheet creation was not detected");
}
const candidate = globalThis.H.findChatHistorySheetCreationCandidate("피벗_결과", failedCode);
if (!candidate) throw new Error("chatHistory candidate not found");
if (candidate.sourceUserMessage !== pivotPrompt) {
  throw new Error("candidate source prompt should skip static regen prompt");
}
const suggestion = globalThis.H.findMissingDependencySkillSuggestion({
  stepIdx: 2,
  code: failedCode,
  message: "backend/runner stage",
});
if (!suggestion || !suggestion.candidate || suggestion.insertPos !== 3) {
  throw new Error("missing dependency suggestion not detected before auto repair");
}

globalThis.H.offerMissingDependencySkillCandidate({
  stepIdx: 2,
  code: failedCode,
  message: "VBA 실행 실패: 아래 첨자 사용이 잘못되었습니다.",
});
if (!suggested.some(x => x.role === "assistant" && x.ctx && x.ctx.suggestInsertPosition === 3)) {
  throw new Error("candidate assistant reply with insert position was not offered");
}

suggested = [];
window.__b2bMissingDependencySuggestions = new Set();
globalThis.H.offerMissingDependencySkillCandidate({
  stepIdx: 2,
  code: failedCode,
  message: "backend/runner stage",
});
if (!suggested.some(x => x.role === "assistant" && x.ctx && x.ctx.suggestInsertPosition === 3)) {
  throw new Error("candidate should be offered even when backend error message loses subscript wording");
}

console.log("missing dependency candidate OK");
