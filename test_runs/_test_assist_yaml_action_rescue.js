// [SBAGENT-293 / 2026-08-25] AI 도움이 답 대신 규약 원문을 노출 — "SET.ERROR만 뜬다"의 실체 2가지:
//   1. 모델이 액션을 JSON 이 아니라 YAML 로 냄 → 파싱 실패 → 도구 미실행 + block=null 이라
//      응답 원문(시스템 지시문 에코 + YAML)이 통째로 사용자 화면에 노출.
//   2. 파싱을 구제해도 프롬프트 에코가 본문에 남으면 내부 지시문이 그대로 보임.
// 수정: YAML 액션 구제(_assistParseYamlAction, 등록 도구만) + 액션 잔해/프롬프트 에코 스트립.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const g = fs.readFileSync(path.join(ROOT, "scripts", "assist-guard.js"), "utf8").replace(/^﻿/, "");
const api = new Function("ASSIST_TOOLS",
  g + "\nreturn { parse: assistParseAction, strip: assistStripActionBlock, echo: assistStripPromptEcho };",
)({ "step.error": {}, "run.trace": {} });

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] YAML 액션 구제 — 실측 형식이 도구 호출로 인식된다");
{
  const r = api.parse('원인을 확인해볼게요.\naction: "tool"\nargs:\n  tool_name: "step.error"\n  tool_args: {}');
  check("실측 YAML → tool/step.error", r.action === "tool" && r.args.tool === "step.error" && r.parsed === true, JSON.stringify(r));
  check("block 이 잡혀 원문 노출이 없다", !!r.block && r.block.includes("tool_name"));
  const r2 = api.parse('확인합니다. action: "tool" args: tool_name: "step.error" tool_args: {}');
  check("줄바꿈 뭉갠 YAML 도 구제", r2.action === "tool" && r2.args.tool === "step.error");
  const r3 = api.parse('action: "tool"\nargs:\n  tool: run.trace\n  step_id: s24');
  check("스칼라 인자 흡수(step_id)", r3.action === "tool" && r3.args.tool === "run.trace" && r3.args.step_id === "s24");
}
console.log("[2] 오탐 방지 — 정상 응답을 액션으로 오인하지 않는다");
{
  check("미등록 도구는 채택 안 함", api.parse('action: "tool"\nargs:\n  tool_name: "nope.xx"').parsed === false);
  check("본문 속 action: 문구 무시", api.parse("조치 방법: action: 없이 설명하는 문장입니다.").parsed === false);
  check("기존 JSON 규약 그대로(회귀)", api.parse('{"action":"tool","args":{"tool":"step.error"}}').args.tool === "step.error");
  check("코드 호출 구제 그대로(회귀)", api.parse("```python\nstep.error()\n```").args.tool === "step.error");
}
console.log("[3] 노출 차단 — 액션 잔해·프롬프트 에코가 화면에 안 남는다");
{
  const sys = "고칠 때 지켜줘: ① 추측하지 말고 도구로 실제 파일·시트·헤더 이름을 읽어 확인한 뒤 그 값에 맞춰라. 이건 시스템 지시문이다.";
  const reply = "24단계 확인. " + sys + '\naction: "tool"\nargs:\n  tool_name: "nope.xx"\n  tool_args: {}';
  const out = api.echo(api.strip(reply), [sys]);
  check("프롬프트 에코 제거", !out.includes("시스템 지시문"), out);
  check("액션 잔해 제거", !/action|tool_name/.test(out), out);
  const normal = "24단계는 청구계정번호 열을 찾지 못해 실패했습니다. 헤더 이름을 확인해 주세요.";
  check("정상 답변은 그대로", api.echo(normal, [sys]) === normal);
}


console.log("[4] 겹싸인 인자 평탄화(JSON 경로) — data.read given:'' 재발 방지(실측 세션 15:50)");
{
  const r = api.parse('{"action":"tool","args":{"tool_name":"step.error","tool_args":{"file":"도서.xlsx","range":"A1:C3"}}}');
  check("tool_name 별칭 흡수", r.action === "tool" && r.args.tool === "step.error", JSON.stringify(r.args));
  check("tool_args 안 인자가 평탄화된다", r.args.file === "도서.xlsx" && r.args.range === "A1:C3", JSON.stringify(r.args));
  const r2 = api.parse('{"action":"tool","args":{"tool":"run.trace","parameters":{"step_id":"s28"}}}');
  check("parameters 겹싸기도 평탄화", r2.args.tool === "run.trace" && r2.args.step_id === "s28", JSON.stringify(r2.args));
}

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
