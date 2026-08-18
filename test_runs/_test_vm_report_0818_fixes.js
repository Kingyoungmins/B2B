// [VM 제보 5건 2026-08-18 / 0.7.4] 교육 현장에서 나온 제보들. 원인 분석과 수정 근거는 커밋 메시지에.
//
//   1. 스킬 오류 → AI 도움 요청 → 생뚱맞게 VBA 피벗 이야기
//      원인 두 갈래: (a) 오류 설명 프롬프트에 '피벗' 실명 예시가 박혀 있어 약한 모델이 앵무새처럼
//      베낌, (b) AI 도움 대화가 앱 세션 내내 이어져(비우기 전까지) 오전의 피벗 대화 문맥 위에
//      오후의 새 오류 진단이 얹힘.
//   2. '채팅에 넣기' 카드가 잘 안 생김 — 모델이 고친 요청문을 말로만 제시(따옴표)하고
//      action="handoff" 블록을 안 내면 버튼이 없다.
//   3. 머리글이 2~3행일 때 첫 데이터 행 소실/시작 행 오락가락 — 데이터 시작 행의 단일 기준 부재.
//   4. (치명) 수정한 스킬이 수정 전 코드로 저장·실행 — 매핑 실행 상태가 남아 있으면 저장이
//      실행 시작 시점의 옛 배열을 통째로 사용.
//   5. 스킬 추가가 "적용됨"인데 뷰에 안 보임 — 다른 파일 세션에 적용되고 탭은 그대로.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const pj = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const sl = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8").replace(/^﻿/, "");
const ac = fs.readFileSync(path.join(ROOT, "scripts", "assist-core.js"), "utf8").replace(/^﻿/, "");
const au = fs.readFileSync(path.join(ROOT, "scripts", "assist-ui.js"), "utf8").replace(/^﻿/, "");
const fsch = fs.readFileSync(path.join(ROOT, "scripts", "file-schema.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
function sliceBalanced(src, startIdx, open, close) {
  let d = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === open) d++;
    else if (ch === close) { d--; if (d === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error("unbalanced");
}
function fnBody(src, name) {
  const at = src.indexOf("function " + name);
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const b = src.indexOf("{", src.indexOf(")", at));
  return sliceBalanced(src, b, "{", "}").slice(1, -1);
}

console.log("[4] (치명) 저장이 실행-시작 시점의 옛 코드를 쓰던 문제 — 수정 병합");
{
  // pipelineForSave 를 실제 소스로 실행 — 매핑 실행 상태가 남은 채 저장하는 상황 재현
  const stubs = {
    state: {
      runnerMappingRunActive: true,
      pipelineOriginalDuringRun: [
        { id: "a", code: "OLD_A", targetFileId: "input:옛달.xlsx", targetSheetName: "S" },
        { id: "b", code: "OLD_B", targetFileId: "input:옛달.xlsx", targetSheetName: "S" },
      ],
      pipelineMappedDuringRun: [
        { id: "a", code: "MAPPED_A" },
        { id: "b", code: "MAPPED_B" },
      ],
      pipeline: [
        { id: "a", code: "MAPPED_A", targetFileId: "input:새달.xlsx" },   // 손 안 댐(매핑본 그대로)
        { id: "b", code: "EDITED_B", targetFileId: "input:새달.xlsx" },   // 사용자가 수정함
        { id: "c", code: "NEW_C" },                                        // 실행 중 새로 생김
      ],
    },
    traceClientUiEvent: () => {},
  };
  const f = new Function("state", "traceClientUiEvent", fnBody(sl, "pipelineForSave") + "");
  const out = f(stubs.state, stubs.traceClientUiEvent);
  check("손 안 댄 스텝은 원본(제네릭 이름)으로 — 치환본 유출 방지 유지",
    out[0].code === "OLD_A" && out[0].targetFileId === "input:옛달.xlsx", JSON.stringify(out[0]));
  check("수정한 스텝은 수정 코드 유지  ← 치명 제보의 핵심", out[1].code === "EDITED_B", out[1].code);
  check("실행 중 생긴 스텝은 그대로", out[2].code === "NEW_C");
  check("어느 쪽을 저장했는지 로그로 남긴다", /save\.pipeline\.source/.test(sl));
}
check("스킬 불러오기가 남아 있던 실행 상태를 걷어낸다(위생)",
  /load\.mapped_run_state\.leak/.test(sl) && /state\.runnerMappingRunActive = false;/.test(sl));

console.log("[1] AI 도움 생뚱맞은 진단 — 두 누출 경로 차단");
check("오류 설명 프롬프트의 '피벗' 실명 예시가 사라짐",
  !/피벗을 만드는 명령에 제가 알지 못하는 설정이/.test(pj));
check("예시를 베끼지 말라는 지시가 들어감",
  /예시 문구를 그대로 베끼거나/.test(pj) && /나오지도 않은 작업 이름\(피벗 등\)/.test(pj));
check("오류 진단 요청은 어시스트 대화를 새 주제로 시작",
  /function assistStartFreshTopicForDiagnosis/.test(au)
  && /assistStartFreshTopicForDiagnosis\(\);/.test(au));
{
  // 동작: history 가 있으면 비우고 구분선을 남긴다 / 없으면 아무것도 안 한다
  const body = fnBody(au, "assistStartFreshTopicForDiagnosis");
  const calls = [];
  const env = {
    state: { assist: { history: [{ role: "user", content: "옛 피벗 얘기" }] } },
    assistIsBusy: () => false,
    assistAbortCurrent: () => calls.push("abort"),
    assistAddMsg: (r, t) => calls.push("msg:" + t.slice(0, 12)),
    traceClientUiEvent: () => calls.push("trace"),
  };
  const f = new Function("state", "assistIsBusy", "assistAbortCurrent", "assistAddMsg", "traceClientUiEvent", body);
  f(env.state, env.assistIsBusy, env.assistAbortCurrent, env.assistAddMsg, env.traceClientUiEvent);
  check("이전 대화가 모델 문맥에서 비워짐", env.state.assist.history.length === 0, env.state.assist.history.length);
  check("화면에는 구분선만 남김(대화 삭제 아님)", calls.some(c => c.startsWith("msg:")), calls.join(","));
  const env2 = { state: { assist: { history: [] } }, calls: [] };
  f(env2.state, () => false, () => env2.calls.push("abort"), () => env2.calls.push("msg"), () => {});
  check("빈 대화면 아무것도 안 함", env2.calls.length === 0);
}

console.log("[2] '채팅에 넣기' 카드 활성화 — 말로만 제시 감지·재촉");
check("감지기 존재", /function assistLooksLikeProseRequestSuggestion/.test(ac));
check("재촉 분기 배선(모델이 handoff/메모칸을 다시 판단)",
  /assistLooksLikeProseRequestSuggestion\(finalText\)/.test(ac)
  && /카드가 떠서/.test(ac));
check("프롬프트 규칙: 고친 요청문은 말로만 제시 금지",
  /고친 요청문은 말로만 제시하지 말고 handoff 로 내라/.test(ac));
check("메모칸 문장은 예외로 명시(오탐 방지)", /메모칸이 목적지이므로 말\(따옴표\)로 준다/.test(ac));
{
  const body = fnBody(ac, "assistLooksLikeProseRequestSuggestion");
  const det = new Function("text", body);
  check("요청문 제시(따옴표+지시어미) → 감지",
    det('이렇게 요청해 보세요: "H열에 타사부가호가 있으면 I열에 부가라고 입력해줘"') === true);
  check("메모칸 안내는 감지 안 함",
    det('오류 창 메모칸에 붙여넣으세요: "머리글이 2행에 있어요. 2행 기준으로 처리해 주세요"') === false);
  check("오류 서술 인용은 감지 안 함",
    det('"이 단계에서 오류가 납니다" 라고 다시 요청해 보세요') === false);
  check("일반 안내문은 감지 안 함", det("원인은 시트 보호입니다. 보호를 해제한 뒤 다시 실행하세요.") === false);
}

console.log("[3] 머리글 2~3행 — 데이터 시작 행의 단일 기준");
{
  const body = fnBody(fsch, "_schemaDataStartRow");
  const f = new Function("aoa", "headerRow", body);
  const multi = [["제목", "", ""], ["가입번호", "상품", "요금"], ["", "기본", "할인"], [1001, "폰A", 5000]];
  check("여러 줄 머리글 → 데이터 시작을 내림(4행)", f(multi, 1) === 3, f(multi, 1));
  const simple = [["이름", "금액"], ["갑", 10]];
  check("1행 헤더는 그대로(2행)", f(simple, 0) === 1);
  const names = [["이름", "부서"], ["김철수", "영업"], ["이영희", "재무"]];
  check("숫자 없는 명단은 확장 안 함(오탐 방지)", f(names, 0) === 1);
}
check("스키마가 '데이터 시작: N행'을 명시", /데이터 시작: \$\{ds \+ 1\}행/.test(fsch));
check("여러 줄 머리글이면 그 사실도 표기", /여러 줄\) · 데이터 시작/.test(fsch));
check("프롬프트: 머리글 2~3행 가능 + 데이터 시작 기준 강제",
  /머리글은 2~3행에 걸치기도 합니다/.test(fsch) && /모든 행 계산을 그 N행 기준으로/.test(fsch));
check("프롬프트: 단계 간 시작 행 일관성 강제(2·3·4 오락가락 실측)",
  /같은 시트를 다루는 단계들은 같은 데이터 시작 행/.test(fsch));

console.log("[5] 스킬 추가 '적용됨'인데 뷰 미반영 — 착지 + 진단");
check("적용된 파일이 보는 탭과 다르면 그 파일로 탭 착지(새 단계 추가 시)",
  /appendToPipeline && _appliedFid && _appliedFid !== state\.currentFileId[\s\S]{0,80}landAppTabOnExcelSession\(excelId\)/.test(pj));
check("적용 세션·보던 탭·백엔드 applied 수를 로그로 남긴다(다음 제보 원인 확정용)",
  /pipeline\.apply_live\.landed/.test(pj) && /viewMismatch/.test(pj) && /backendApplied/.test(pj));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
