// [회귀] 녹화 VBA 시트/파일 참조 가드 (오프라인 — LLM/Excel 불필요)
//
// 1. crossWriteDestinationFileIds 가 VBA Windows/Workbooks("X").Activate 를 교차 쓰기 대상으로
//    인식하는가 — 안 보이면 교차파일 녹화 스텝의 되돌리기/체크포인트 가드/리셋 집합에서 목적지가
//    빠져 조용한 데이터 어긋남·재실행 중복이 생긴다(실측 12단계 스킬).
// 2. runnerRecordedActivatePairs 가 녹화 관용구(Windows().Activate + Sheets().Select)에서
//    (파일,시트) 쌍을 뽑는가 — 안 뽑히면 실행기에서 두 번째 파일부터 시트 요구·재작성이 빠진다.
// 3. makeStep 조각별 바인딩(_chunkPrimaryBook/_isAnchorChunk) 배선 소스 확인.
//
// 실행: node diagnostics/_test_recorded_ref_guards.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass += 1; console.log("PASS " + name); }
  else { fail += 1; console.log("FAIL " + name); }
}

// 소스에서 top-level 함수 본문을 중괄호 균형으로 추출(파일 전체 eval 회피 — IIFE 부작용 차단).
function extractFn(src, name) {
  const idx = src.indexOf("function " + name + "(");
  if (idx < 0) throw new Error(name + " 정의를 못 찾음");
  // 파라미터 목록 괄호를 먼저 닫는다 — 기본값 `options = {}` 의 중괄호를 본문 시작으로 오인 방지.
  let p = src.indexOf("(", idx), pd = 0, bodyStart = -1;
  for (let j = p; j < src.length; j++) {
    if (src[j] === "(") pd += 1;
    else if (src[j] === ")") { pd -= 1; if (!pd) { bodyStart = src.indexOf("{", j); break; } }
  }
  if (bodyStart < 0) throw new Error(name + " 본문 시작을 못 찾음");
  let depth = 0;
  for (let j = bodyStart; j < src.length; j++) {
    const ch = src[j];
    if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (!depth) return src.slice(idx, j + 1); }
  }
  throw new Error(name + " 중괄호 불균형");
}

const pipelineSrc = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");
const dropSrc = fs.readFileSync(path.join(ROOT, "scripts", "drop-handling.js"), "utf8");

// ---------- 1. crossWriteDestinationFileIds ----------
const FILE_IDS = {
  "input_v056_정산서.xlsx": "input:input_v056_정산서.xlsx",
  "input_v056_청구내역.xlsx": "input:input_v056_청구내역.xlsx",
};
const stubs = {
  pipelineFileIdByWorkbookName: (name) => FILE_IDS[String(name || "").trim()] || null,
  pipelineConstStringVars: () => ({}),
  pipelineResolvePyArg: (token) => {
    const s = String(token || "").trim();
    const m = s.match(/^["'](.*)["']$/);
    return m ? m[1] : null;
  },
  pipelinePythonMutatedBookNames: () => [],
};
const fnSrc = extractFn(pipelineSrc, "pipelineStripCodeComments") + "\n"
  + extractFn(pipelineSrc, "crossWriteDestinationFileIds");
const maker = new Function(
  "pipelineFileIdByWorkbookName", "pipelineConstStringVars", "pipelineResolvePyArg", "pipelinePythonMutatedBookNames",
  fnSrc + "\nreturn crossWriteDestinationFileIds;");
const crossWrite = maker(stubs.pipelineFileIdByWorkbookName, stubs.pipelineConstStringVars,
  stubs.pipelineResolvePyArg, stubs.pipelinePythonMutatedBookNames);

const vbaCross = 'Sub B2BSkill()\n    Windows("input_v056_청구내역.xlsx").Activate\n    Range("J1").Select\n    ActiveCell.FormulaR1C1 = "123"\nEnd Sub';
t("1a VBA Activate 교차 쓰기 인식",
  JSON.stringify(crossWrite(vbaCross, { selfFileId: "input:input_v056_정산서.xlsx" })) === JSON.stringify(["input:input_v056_청구내역.xlsx"]));
t("1b 자기 파일 Activate 는 교차 아님",
  crossWrite(vbaCross, { selfFileId: "input:input_v056_청구내역.xlsx" }).length === 0);
const pyCross = 'def transform(ctx):\n    ctx.paste_copied("청구내역", "A1:G13", "정산", "E1", src_book="input_v056_청구내역.xlsx", dst_book="input_v056_정산서.xlsx")\n';
t("1c python dst_book 기존 동작 유지",
  JSON.stringify(crossWrite(pyCross, { selfFileId: "input:input_v056_청구내역.xlsx" })) === JSON.stringify(["input:input_v056_정산서.xlsx"]));
const vbaComment = "Sub B2BSkill()\n    ' Windows(\"input_v056_청구내역.xlsx\").Activate 는 주석\n    Range(\"A1\").Copy\nEnd Sub";
t("1d 주석 속 Activate 는 무시(오탐 방지)",
  crossWrite(vbaComment, { selfFileId: "input:input_v056_정산서.xlsx" }).length === 0);

// ---------- 2. runnerRecordedActivatePairs ----------
const pairsFn = new Function(extractFn(dropSrc, "runnerRecordedActivatePairs") + "\nreturn runnerRecordedActivatePairs;")();
const recIdiom = 'Sub B2BSkill()\n    Windows("A귀속_202604.xlsx").Activate\n    Sheets("202604").Select\n    Range("B2").Copy\n    Windows("B정산.xlsx").Activate\n    Sheets("정산").Select\n    ActiveSheet.Paste\nEnd Sub';
const got = pairsFn(recIdiom);
t("2a 녹화 관용구 (파일,시트) 쌍 추출",
  got.length === 2 && got[0].book === "A귀속_202604.xlsx" && got[0].sheet === "202604"
  && got[1].book === "B정산.xlsx" && got[1].sheet === "정산");
t("2b 창 미상 Select 는 쌍 미생성",
  pairsFn('Sub B2BSkill()\n    Sheets("정산").Select\nEnd Sub').length === 0);
t("2c 요구 추출기 배선(vba-recorded-pair)", /vba-recorded-pair/.test(dropSrc));
t("2d 소유쌍 추출기 배선(runnerSheetOwnersFromCode)",
  /runnerRecordedActivatePairs\(src\)\.forEach\(\(p\) => add\(p\.book, p\.sheet\)\)/.test(dropSrc));

// ---------- 3. makeStep 조각별 바인딩 + 서버 게이트 배선 ----------
t("3a makeStep 조각 주워크북 파싱(_chunkPrimaryBook)", /_chunkPrimaryBook/.test(pipelineSrc));
t("3b 비앵커 조각 앵커시트 오도장 방지(_isAnchorChunk)", /_isAnchorChunk/.test(pipelineSrc));
t("3c crossWrite VBA Activate 정규식 배선", /reVbaAct/.test(pipelineSrc));
const pySrc = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8");
t("3d 서버 VBA 보안 게이트 배선(_vba_security_scan)",
  /_sec = _vba_security_scan\(code\)/.test(pySrc) && /_VBA_FORBIDDEN_BARE/.test(pySrc));
t("3e 검토카드 차단 예고 배선(hazards)", /재생 차단 대상/.test(pySrc));

// ---------- 4. 교차파일 Ctrl+V 마퀴 + 정지 흐름 강건화 ----------
// Display* 속성은 '쓰기 자체'가 값 무관하게 CutCopyMode 를 취소(실측 프로브 7종 전부).
// 무조건 대입이 하나라도 남으면 탭 전환마다 교차 복붙이 죽는다 — 직접 대입 0 을 강제.
const rawDisplayWrites = (pySrc.match(/^\s*(?:app|win|w)\.Display\w+\s*=\s*True\s*$/gm) || []);
t("4a Display* 무조건 대입 잔존 0(마퀴 보존)", rawDisplayWrites.length === 0);
t("4b compare-set 헬퍼 배선(_set_display_prop_if_changed)",
  (pySrc.match(/_set_display_prop_if_changed\(/g) || []).length >= 4);
const saveSrc = fs.readFileSync(path.join(ROOT, "scripts", "save-load.js"), "utf8");
t("4c 녹화 메타 zip 왕복(recordedWorkbook 저장+복원)",
  (saveSrc.match(/recordedWorkbook: s\.recordedWorkbook \|\| null/g) || []).length >= 2);
t("4d 녹화 버튼 세션 자가복구 배선", /record\.start\.session_reopen/.test(pipelineSrc));
// 분할은 인위적 타임아웃 없이 끝까지 기다린다(40초 컷이 긴 녹화의 멀쩡한 분할을 1스텝 폴백시켰음).
const rrSrc = fs.readFileSync(path.join(ROOT, "scripts", "record-review.js"), "utf8");
const splitFnSrc = (() => {
  const i = rrSrc.indexOf("async function llmSplitRecordedVba");
  return i >= 0 ? rrSrc.slice(i, rrSrc.indexOf("\n}", i)) : "";
})();
t("4e 분할 인위 타임아웃 제거(abort 없음)", splitFnSrc.length > 0 && !/abort\(\)/.test(splitFnSrc));
const mirrorSrc = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8");
t("4f 탭 전환 침묵 실패 금지(mirror.switch.fail/ok 배선)",
  /mirror\.switch\.fail/.test(mirrorSrc) && /mirror\.switch\.ok/.test(mirrorSrc));
// 세션 사망 후 탭 클릭 = 재오픈(ensure) 분기 — 실패가 console.warn 으로만 삼켜지면 '무반응'.
t("4f2 재오픈 침묵 실패 금지(mirror.lazyopen.fail + applying 보류 트레이스)",
  /mirror\.lazyopen\.fail/.test(mirrorSrc) && /mirror\.switch\.deferred_applying/.test(mirrorSrc));
// 동명 고아 워크북이 남으면 재오픈이 영원히 실패(Excel 은 동명 2개 거부) — 자가치유 배선.
t("4h 동명 세션 재부착/고아 정리 배선",
  /excel\.open\.reattach/.test(pySrc) && /excel\.open\.orphan_close/.test(pySrc));
// 격리 라이브 재현에서 동반본 보호 미해제 → 교차파일 붙여넣기 1004(실측 14:02 step2).
// 타깃 해제 직후 동반본 전체 해제 루프가 있어야 한다(풀런 9372와 대칭).
t("4j 격리 동반본 보호 해제 배선",
  /_comp\.get\("wb"\), False/.test(pySrc));
// 에러 해설 오귀속 방지 — 녹화 스텝 실패에 최근 채팅("안녕?")을 사용자 요청으로 붙이지 않음.
t("4i 에러 해설 오귀속 방지 배선",
  /originHistId의 말풍선/.test(pipelineSrc) && /화면 녹화\/복붙 캡처로 만들어진 스킬/.test(pipelineSrc));
// SendKeys 는 NumLock 을 끄는 고질 버그 — 녹화 시작에서 상태 저장→복원 배선 필수.
const recSrc = fs.readFileSync(path.join(ROOT, "native_macro_recorder.py"), "utf8");
t("4g NumLock 보존: SendKeys 호출 제거 + 복원 배선",
  !/app\.SendKeys\(/.test(recSrc)
  && /_restore_numlock_state\(_numlock_before\)/.test(recSrc));

// ---------- 5. 하이브리드 2단계: 녹화 VBA → Python 번역 복구 + 결과 검증 게이트 ----------
const chatSrc = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8");
// 복구 요청문에 VBA 원문을 번역 명세로 주입(선언 let → 주입 → sourceUserMessage 사용 순서).
const _iLet = chatSrc.indexOf("let recoveryBaseSourceUserMessage");
const _iInj = chatSrc.indexOf("recoveryRecordedVba");
const _iUse = chatSrc.indexOf("const sourceUserMessage = recoveryBaseSourceUserMessage");
t("5a 녹화 복구 스펙 주입(위치+구성요소)",
  _iLet > 0 && _iInj > _iLet && _iUse > _iInj
  && /```vba/.test(chatSrc.slice(_iInj, _iUse))
  && /_recoveredFromVba = true/.test(chatSrc.slice(_iInj, _iUse)));
// 재실행 말미 검증 게이트: expected 스태시 + 변환 스텝 플래그 조건 + 파일모드 제외.
t("5b 번역 결과 검증 게이트 배선",
  /window\.__recordExpected = data\.expected/.test(pipelineSrc)
  && /_recoveredFromVba\)/.test(pipelineSrc)
  && /번역 검증/.test(pipelineSrc));
// 녹화 스텝 실패는 복구 버튼 자동 발사(스텝당 2회 상한 + err 공유 가드) — 녹화 재현은 끝까지 완주.
t("5c 녹화 자동 완주 배선(자동 발사+상한)",
  /__autoRecordedRecoveryTried/.test(pipelineSrc)
  && /_autoRecoverTries/.test(pipelineSrc)
  && /record\.auto_recovery\.fire/.test(pipelineSrc));

// ---------- 6. 초기 컨텍스트 결정론화(실측 15:30 — 1조각이 마지막에 연 동반본에서 실행) ----------
// 레코더: 시작 워크북 Activate 를 combined 맨 앞에 명시(단일 수확 케이스).
t("6a 레코더 초기 앵커 Activate 삽입",
  /Workbooks\("%s"\)\.Activate\\n%s/.test(recSrc) && /초기 컨텍스트 명시/.test(recSrc));
// 러너: 시트명 유무와 무관하게 스텝 전 ftarget.Activate (격리+풀런 양쪽).
t("6b 러너 스텝 전 앵커 워크북 활성화(격리+풀런)",
  (pySrc.match(/ftarget\.Activate\(\)/g) || []).length >= 2);
// _chunkPrimaryBook 위치 가드: 중간 Activate 는 앵커 유지, 선두(래퍼 뒤 포함) Activate 만 바인딩.
const _cpb = (() => {
  const i = pipelineSrc.indexOf("const _chunkPrimaryBook = (code) => {");
  const m = pipelineSrc.slice(i).match(/\(code\) => \{[\s\S]*?\n        \}/);
  return m ? eval("(" + m[0] + ")") : null;
})();
t("6c 중간 Activate 는 앵커 유지(실측 1조각 형태)",
  !!_cpb && _cpb('Sub B2BSkill()\n    Range("A1:G13").Copy\n    Range("I1").Select\n    ActiveSheet.Paste\nWindows("input_v056_정산서.xlsx").Activate\n    Range("E1").Select\nEnd Sub') === "");
t("6d 선두/래퍼 뒤 Activate 바인딩",
  !!_cpb && _cpb('Sub B2BSkill()\n    Windows("b.xlsx").Activate\n    Range("A1").Copy\nEnd Sub') === "b.xlsx"
  && _cpb('Sub B2BSkill()\n    Dim p As XlCalculation: p = Application.Calculation\n    On Error GoTo Cleanup\n    Windows("c.xlsx").Activate\n    Range("A1").Copy\nEnd Sub') === "c.xlsx");

// ---------- 7. 의도 반영 스텝 간 계약(실측 15:30 — 3조각 동적화를 4조각이 모른 채 G14 가드) ----------
// 녹화 스텝 제목의 파일명이 실행기 요구 카드를 오염(실측 16:09: "복사 + X.xlsx" 등 쓰레기 이름).
// 녹화 스텝은 자유 텍스트(prompt/description)를 파일명 스캔에서 제외하고 코드만 스캔.
{
  const collect = new Function(extractFn(pipelineSrc, "pipelineCollectWorkbookNames")
    + "\nreturn pipelineCollectWorkbookNames;")();
  // 실측 16:09 step1 description 원문 형태 — 뒤따르는 파일명 토큰이 있어야 loose 오염이 재현된다.
  const desc = "input_v056_청구내역.xlsx A1:H13 복사 + input_v056_청구내역.xlsx J1에 붙여넣기 + input_v056_정산서.xlsx로 창 전환 후 붙여넣기 — input_v056_청구내역.xlsx A1:H13 복사";
  const code = 'Sub B2BSkill()\n    Workbooks("input_v056_청구내역.xlsx").Activate\n    Windows("input_v056_정산서.xlsx").Activate\nEnd Sub';
  const polluted = collect(desc + "\n" + code).some(n => / \+ |로 창 전환/.test(n));
  const clean = collect(code).every(n => /^input_v056_(청구내역|정산서)\.xlsx$/.test(n));
  t("7c 녹화 스텝 자유텍스트 파일명 스캔 제외(요구 카드 오염 차단)",
    polluted && clean && /_recordedFreeTextExcluded/.test(dropSrc)
    && /파일명\(\.xlsx 포함 문자열\)은 title 에 절대 넣지 마세요/.test(rrSrc));
}

// AI 도움 run.trace — 서버 트레이스 타임라인 없이는 '어느 워크북에서 실제로 돌았나' 층 진단 불가.
const assistToolsSrc = fs.readFileSync(path.join(ROOT, "scripts", "assist-tools.js"), "utf8");
t("7b AI도움 run.trace 도구+서버 엔드포인트 배선",
  /assistDefineTool\("run\.trace"/.test(assistToolsSrc)
  && /\/api\/diag\/recent-trace/.test(assistToolsSrc)
  && /handle_diag_recent_trace/.test(pySrc));
t("7a 의도 반영 이웃 컨텍스트+계약 규칙 배선",
  /batchCtx/.test(rrSrc)
  && /직전 조각이 쓰는 위치를 동적으로 계산하게 됐다면/.test(rrSrc)
  && /Err\.Raise 가드를 새로 넣지 마세요/.test(rrSrc)
  && /llmApplyIntentToStep\(j\.entry, j\.intent, \{ entries, jobs: withIntent \}\)/.test(rrSrc));
// 한 행 밀림 함정(실측 16:48: 라벨 A122, 숫자 C123) — 직전 산출물을 데이터로 재계산 금지,
// 라벨 앵커(Match/Find) 또는 산출물 없는 열 기준 규칙이 프롬프트에 있어야 한다.
t("7a2 한 행 밀림 함정 규칙 배선",
  /한 행 밀림 함정/.test(rrSrc) && /그 산출물을 찾아 같은 행에/.test(rrSrc));

console.log(pass + "/" + (pass + fail) + " PASS");
process.exit(fail ? 1 : 0);
