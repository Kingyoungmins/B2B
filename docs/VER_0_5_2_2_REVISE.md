# ver0.5.2.2 Revise — 구현 상세 보고서

기준: `a2c6f5b` (ver0.5.2) · 작업 브랜치: `ver0.5.2.2`

ver0.5.2 실사용 중 보고된 다음 계열 문제를 수정한다. 전부 `git diff a2c6f5b` 로 검토 가능.

1. Qwen3.6 생성이 장황/멍청하다(우회 표현·반복·함수 미생성)
2. Python COM 정적/런타임 제약에 부딪히면 같은 방식으로 계속 재시도한다
3. 정적 게이트가 **정상 Python 코드를 부당하게 차단**한다(for 루프, `re.compile`, 주석 등)
4. 스킬 ON/OFF·삭제가 입력↔출력이 얽힌 파이프라인에서 꼬인다
5. 탭 이동 후 ON 하면 "적용됨" 표시는 뜨지만 출력 파일에 값이 안 들어간다
6. 스킬 적용 실패 복구가 수 분씩 걸리고 `B2B_Server.exe` 가 뻗는다
7. 업로드 중 탭/뷰 클릭이 막히지 않는다
8. "초기화" 클릭 시 화면이 굳는다

설계 원칙: ① 라이브 Excel 무결성(잘못된 워크북에 쓰지 않기)을 속도보다 우선 ② 저사양 PC
기준으로 COM 호출 수를 늘리지 않기(매 수정마다 사이드이펙트 측정) ③ 게이트는 "위험 차단"만 하고
정상 코드는 통과 ④ 실패 시 UI 표시와 실제 라이브 상태가 어긋나지 않게 원복.

---

## 1. Qwen 생성 품질 — `scripts/llm-api.js`, `scripts/file-schema.js`

### 1.1 `presence_penalty` 상시 1.5 → 기본 0.5 (`llm-api.js` `callOpenAICompatOnce`)
- 기존: Qwen 요청에 항상 `presence_penalty = 1.5`. 이미 나온 토큰 전부에 벌점을 주는 파라미터라
  코드처럼 토큰 재사용이 본질적인 출력(`ctx.`, `Range`, `def`, 변수명)에서 정답 토큰을 피해
  장황한 우회 표현·이상한 변수명 변형(="멍청한 출력")을 유발.
- 변경: `payload.presence_penalty = (typeof options.presencePenalty === "number") ? options.presencePenalty : 0.5;`
  — 기본 0.5, 호출자가 명시할 때만 상향.
- 연계(`chat-ui.js` `autoRegenerateForStaticSafety`): degenerate(줄 반복/비정상 길이) 위반이
  포함된 재생성에서만 `presencePenalty: 1.5` 를 넘긴다(`hasDegenerateFailure`).

### 1.2 think 모드 `max_tokens` 4096 → 8192 (`llm-api.js`)
- vLLM 에서 reasoning+본문이 같은 토큰 예산을 나눠 쓰므로 4096 이면 생각이 길어질 때 본문이
  잘리거나 비어 no-think 폴백 재생성으로 이어졌다. `max_tokens: thinkOn ? 8192 : 4096`.

### 1.3 히스토리 축소 + 오래된 코드 블록 접기 (`llm-api.js` `getLLMChatHistory`)
- 상수: `LLM_HISTORY_MAX_MESSAGES` 18→12, `LLM_HISTORY_MAX_CHARS` 32000→20000,
  신설 `LLM_HISTORY_KEEP_CODE_TURNS = 1`.
- `_collapseHistoryCodeBlocks(content)`: ```` ``` ```` 펜스 블록을 `[이전 단계 코드 블록 생략: <첫 줄>]`
  로 치환. `getLLMChatHistory` 가 최근 assistant 턴 `LLM_HISTORY_KEEP_CODE_TURNS` 개만 원본 코드를
  남기고 그 이전 턴의 코드는 접는다 → 모델이 자기 과거의 장황한 출력을 그대로 모방하는 것을 차단.
  (수정 모드는 `buildEditingContext` 가 현재 코드를 따로 제공하므로 영향 없음.)

### 1.4 프롬프트 보강 (`file-schema.js` `PYTHON_COM_SYSTEM_PROMPT`)
- 출력 형식에 "설명·계획·주석만으로 응답을 끝내지 말 것 — 모호하면 합리적 기본값을 택해 코드로
  작성, 정말 특정 불가할 때만 코드 없이 한 가지 질문" 추가.
- `ctx.sort` 설명에 "key_col 은 시트 기준 열 문자('C')를 쓸 것 — 숫자는 범위 내 상대 번호라
  범위가 A열에서 시작하지 않으면 어긋남" 명시(§3.6 구현과 일치).
- 골격 예시의 `"ABC...Z"[amt_col-1]` (27열부터 IndexError) 을 `divmod` 기반 `col_letter_of(n)`
  헬퍼(AA, AB… 안전)로 교체.

---

## 2. "설명만/주석만" 응답 감지 + 자동 재생성 — `scripts/chat-ui.js`

LLM 응답을 렌더하는 `addAssistantReply` 끝에서, 코드가 필요한 응답인데 실행 코드가 없으면
교정 재생성을 건다(원본 응답은 화면에 남김). 상수 `NO_CODE_MAX_REGEN = 2`.

- `assistantReplyCodeProblems(fullText, code)` — 문제 목록 반환:
  - 코드 블록 없음 → 단, `_looksLikeClarifyingQuestion(stripped)`(물음표 + 어느/어떤/선택/알려주…)
    이면 정당한 되물음이므로 통과(빈 배열).
  - `_isCommentOnlyCode(code, language)` — 모든 줄이 주석(`#` / `'` / `Rem`) 또는
    뼈대(`def transform` / `Sub B2BSkill` / `End Sub` / `pass` / `return` / docstring)뿐이면 본문 없음.
  - 진입점 없음(`def transform(ctx):` / `Sub B2BSkill()`).
- `autoRegenerateForMissingCode(fullText, problems, context)` — 문제 목록 + 원래 요청 +
  "코드를 지금 바로 작성하라"는 지시 + `/no_think` 로 재호출, 결과를 `addAssistantReply` 로 다시
  흘려 재검사(카운터 `noCodeRegenAttempt` 전파). 2회 초과 시 `showCodeGuardBlock` 으로 안내.

---

## 3. 정적 게이트 오탐 제거 — `scripts/chat-ui.js`, `serve_b2b.py`

가장 영향이 큰 묶음. **정상 Python 코드를 차단해 재생성/VBA 폴백으로 밀어내던** 원인들.

### 3.1 루프 내 ctx 쓰기 검사: 들여쓰기 인식 (`chat-ui.js` `pythonComStaticSafetyFailures`)
- 기존 정규식 `(?:for|while)\s...:\s*\n(...)*?[ \t]+(?:ctx|\w+)\.(write|...)` 는 들여쓰기를 보지
  않아, 루프가 **끝난 다음**에 오는 `ctx.write()`(권장 패턴)까지 루프 본문으로 오인 → for 루프 +
  ctx.write 가 있으면 사실상 무조건 차단.
- 변경: 루프 헤더의 들여쓰기를 `^([ \t]*)` 로 캡처하고, 본문은 `\1` 보다 깊은 줄만 매칭하는
  멀티라인 정규식으로 교정(`m` 플래그). "루프 뒤 write" 는 통과, "루프 안 write" 만 차단.

### 3.2 루프 내 쓰기 검사: ctx 수신자 한정 (`chat-ui.js`, `serve_b2b.py`)
- 기존: 메서드 이름만 보고(`.copy()/.sort()/.clear()` 등) 차단 → 루프 안의 평범한 리스트 연산
  `r.copy()` / `out.sort()` 까지 오탐.
- 서버 AST(`_python_com_static_check`): `_is_ctx_receiver(value)` 추가 — 수신자가 `ctx` 또는
  `ctx.book(...)` 일 때만 차단. `visit_Assign` 으로 `book = ctx.book(...)` 별칭을 `ctx_aliases` 에
  추적해 별칭의 루프 내 쓰기도 잡는다. `if loop_stack and func.attr in write_ops and _is_ctx_receiver(func.value)`.
- 클라(정규식): `ctxAliases` 집합을 `book = ctx.book(...)` 연쇄까지 수렴시켜(`while grew`) 수신자를
  `ctx` + 별칭으로 한정. `ctx.book("...").write(...)` 체이닝도 포함.

### 3.3 빌트인 오탐: `re.compile()` 등 (`chat-ui.js`)
- 기존 `\b(?:open|eval|exec|__import__|input|compile)\s*\(` 가 제공 모듈/ctx 메서드 호출
  (`re.compile(...)`, `ctx.input(...)`) 까지 차단.
- 변경: 부정 룩비하인드 `(?<![\w.])` 로 bare 이름 호출만 차단(속성 호출 허용) — 서버 AST 게이트가
  `_ast.Name` 만 보는 것과 동일 의미.

### 3.4 게이트 검사 전 주석 제거 (`chat-ui.js`)
- 프롬프트에 금지 규칙이 많아 모델이 규칙을 주석으로 메아리치는 일이 흔한데
  (`# openpyxl 이 아니라 ctx 사용`, `' Workbooks.Open 금지`), 주석까지 검사하면 전부 오탐.
- `_stripPythonCommentsForGate(code)` / `_stripVbaCommentsForGate(code)`: 문자열 리터럴은 보존하고
  (`CreateObject("...")` 등 문자열 내용 검사 유지) `#` / `'` / `Rem` 주석만 제거. Python·VBA 게이트가
  이 `scanText` 로 금지 패턴을 검사.

### 3.5 기타
- `while\s+(?:True|1)\s*:` — `while 1` 무한 루프도 차단(기존엔 `while True` 만).

### 3.6 샌드박스 빌트인 보강 (`serve_b2b.py` `_PY_SAFE_BUILTINS`)
- 열 문자 계산(`chr(65+...)`, `divmod`)·코드 변환은 생성 코드가 흔히 쓰는 순수 함수인데 빠져 있어
  `name 'chr' is not defined` 런타임 실패가 났다. `chr, ord, divmod, map, filter` 추가.

---

## 4. Python COM 2회 실패 → VBA 전환 — `scripts/chat-ui.js`

### 4.1 정적 게이트 (`validateAssistantCodeBeforeApply`)
- 신설 `PYTHON_STATIC_MAX_REGEN = 1` (Python 전용). Python 정적 실패는 최초 1회 + 재생성 1회 =
  **2회** 통과 못하면 바로 `autoRegenerateAsVbaFallback` 으로 VBA 전환(기존 3회 → 2회).
- VBA 자체 재생성 한도는 `VBA_STATIC_MAX_REGEN = 2` 유지(VBA 에서 막히면 갈 곳이 없어 재시도 가치).
- `autoRegenerateForStaticSafety` 의 진행 표시/카운터를 언어별 한도(`maxRegen`)로 분기.

### 4.2 런타임 실패 (`requestErrorRecovery`)
- step 단위 실패 카운터: `_pythonRuntimeFailCounts`(Map), `notePythonRuntimeFailure(step)`,
  `clearPythonRuntimeFailures()`. 키는 step id(없으면 코드 앞 400자).
- Python 복구 시 카운트가 `PYTHON_RUNTIME_FAIL_VBA_THRESHOLD = 2` 이상이면 `vbaRuntimeSwitch=true`
  로 이번 복구부터 VBA 로 전환: 복구 프롬프트에 "## Python → VBA 전환" 절을 끼우고
  `requestOptions.forceEngine = "vba"`(이 호출 1회만 VBA 시스템 프롬프트, 전역 엔진 설정 불변).
  실패한 코드 펜스 언어도 원본대로 `python` 표기(`failedCodeLang`).

---

## 5. 스킬 ON/OFF·삭제 무결성 — `scripts/pipeline.js`, `serve_b2b.py`

### 5.1 다중 워크북 리셋 + 스텝별 대상 세션 실행 (`reapplyVbaPipelineToLive`)
- 기존: enabled 스텝 전부를 호출자 `excelId`(보통 현재 탭) 한 세션에 보내고 그 워크북 하나만
  리셋. 입력→출력 스킬(대상=입력, 출력에 기록)에서 출력이 리셋되지 않아 OFF 가 안 풀리고 ON
  재실행이 중복 기록. 다른 파일 대상 스텝이 엉뚱한 워크북(ActiveWorkbook/ctx 기본)에서 실행.
- 변경:
  - `allLiveSteps`(꺼진 스텝 포함, 리셋 대상 계산용) / `enabledSteps`(실행 대상, 각자 `targetFileId` 보유).
  - `stepTargetFileId(s)`: 살아있는 `targetFileId` > 고정 대상(`pinnedFileId`) > 현재 세션 파일.
  - 리셋 대상 `resetFileIds` = 모든 라이브 스텝의 대상 ∪ `crossOutputFileIdsReferencedInCode(code)`
    (스텝 코드가 파일명으로 참조하는 **출력 파일**까지 — 입력 탭 스킬이 출력에 쓴 값을 되돌리려면 필요).
  - 적용은 각 스텝을 자기 대상 파일 세션에서 전역 순서대로 실행, 같은 세션 연속 스텝은 한 호출로
    배칭(`groups`).

### 5.2 단일 파일 빠른 경로 + 다중 파일 배칭 (복구 장기화/서버 다운 회귀 수정)
- §5.1 을 그대로 두면 호출이 파일×스텝으로 늘고, 서버는 `run-vba-pipeline` 호출마다 동반 워크북
  전체를 `SaveCopyAs` 재스냅샷(`_ensure_companion_workbooks`)하므로 복구가 수 분씩 걸리고 COM
  타임아웃 누적 → 워치독이 리셋 중 EXCEL.EXE 강제 재시작 → 서버 다운.
- `singleFileFlow`: `resetFileIds` 가 1개이고 모든 enabled 스텝 대상이 그 파일이면 **기존처럼 서버
  호출 1번**(reset+전체 적용). 대부분의 파이프라인·에러 복구가 이 경로.
- 다중 파일만 리셋 루프 + 적용 그룹으로 분리. 리셋 타임아웃 180초, 적용 타임아웃
  `60s + 30s*steps`(90~300초 클램프).
- 서버(`_run_vba_pipeline_on_session_impl`): `if steps:` 일 때만 `_ensure_companion_workbooks` 호출
  — 스텝 없는 순수 리셋은 교차 읽기가 없으므로 동반 스냅샷 생략(다중 파일 리셋 비용 급감).

### 5.3 잘못된 워크북 폴백 제거 (탭 이동 후 ON 미반영 사고)
- `excelIdForPipelineFileId(fileId)`: fileId→세션 id(없으면 오픈 시도). 실패 시 null.
- `requirePipelineSessionExcelId(fileId, purpose)`: 세션 확보 실패 시 **현재 탭 세션으로 폴백하지
  않고 throw**. 기존 `(await excelIdForPipelineFileId(fid)) || excelId` 폴백이, 출력 세션 확보
  실패 시 스텝을 현재 탭 워크북에서 실행해 ① 그 파일이 오염되고 ② 출력은 비고 ③ 에러 없이
  "적용됨" 이 뜨던 사고의 원인. reset/single/group 적용 3곳 모두 이 함수로 교체.
- `reconcilePipelineSimulationAfterEdit`: 라이브 세션을 못 구했는데 라이브 스텝이 있으면 백엔드
  openpyxl 시뮬로 빠지지 않고 throw(미리보기만 바뀌고 "반영했다" 뜨는 유령 적용 차단).

### 5.4 no-op 편집 생략 (`reconcilePipelineSimulationAfterEdit`)
- `_lastLiveAppliedSignature` + `liveEnabledStepsSignature(steps)`(enabled 라이브 스텝의
  id+language+targetFileId+code 연결). 적용 성공 시 `noteLivePipelineApplied`, 실패/초기화/세션
  종료 시 `invalidateLivePipelineApplied`.
- 편집 후 시그니처가 직전 적용 상태와 같으면(이미 OFF 인 스킬 삭제, OFF 스킬 코드 수정 등) 느린
  전체 리셋+재적용을 건너뛰고 토스트만 표시. OFF 스킬 삭제마다 전체 복원이 다시 돌며 꼬이던 문제 해소.

### 5.5 실패 시 UI 원복 (`renderPipeline` 토글/삭제 핸들러)
- 토글: 라이브 반영 실패 시 `enabled` 를 이전 값으로 되돌림(ON 표시인데 미적용인 유령 상태 방지).
- 삭제: 실패 시 제거한 스텝을 원위치에 복원(UI 에선 지워졌는데 라이브엔 남는 어긋남 방지).

### 5.6 탭 전환 경합 제거 (`ensurePinnedVbaTargetExcelId`)
- 대상 파일로 `setCurrentView` 한 직후 `excelMirror.switchTimer` 를 취소 — setCurrentView 가 예약한
  비동기 미러 raise 가 곧 시작될 리셋·재적용의 hide/position 과 경합해 창 순서·탭이 꼬이던 것 방지.

---

## 6. 업로드 중 UI 차단 — `scripts/drop-handling.js`

- `loadInputFiles` / `loadOutputTemplates` 의 파싱~미러 오픈 전 구간을 `beginUiBusy(...)` 로 감싸고
  `finally` 에서 `endUiBusy`. 중단은 오버레이의 "업로드 중단" 버튼(`onStop: () => { job.cancelled = true; }`).
- 기존엔 미러 오픈만 busy 였고 업로드 본체는 무방비라, 업로드 중 탭/뷰 클릭이 끼어들어 상태가
  어긋났다.

---

## 7. 초기화 멈춤 — `scripts/save-load.js`, `scripts/excel-mirror.js`

### 7.1 비차단 DOM 모달 (`save-load.js`)
- `confirm()` 블로킹 다이얼로그는 항상-위 Excel 미러 창(별도 HWND) 뒤에 가려질 수 있고, 그러면
  JS 전체가 멈춰 "화면이 굳음". `btn-reset` 핸들러가 미러를 먼저 숨기고(`hideAllExcelMirrorWindows`)
  `openResetConfirmModal()`(DOM 모달)로 확인을 받는다. 확인 시 `performScreenReset()`, 취소 시
  미러 복원. 모달 셸이 없으면 즉시 진행(블로킹 confirm 회귀 방지).

### 7.2 busy 잠금 강제 해제 (`excel-mirror.js` `forceReleaseUiBusy`, `save-load.js`)
- 초기화가 EXCEL.EXE 를 강제 종료하면 그 위에서 돌던 COM/fetch 작업은 끝나지 않을 수 있고, 그
  busy 토큰이 `uiBusy.count` 를 쥔 채 남으면 화면+네이티브 입력이 failsafe(90초)까지 잠긴다.
- `forceReleaseUiBusy()`: `uiBusy.count=0`, 오버레이/중단버튼/`b2b-ui-busy` 클래스 해제,
  `publishNativeUiBusy(false)`. `performScreenReset` 가 가장 먼저 호출하고,
  `clearExcelMirrorClientState`(전부-폐기 정리)도 호출. 진행 중 업로드 루프는
  `state.uploadJob.cancelled = true` 로 중단, `clearPythonRuntimeFailures()` 도 함께 정리.
- `clearExcelMirrorClientState` 가 `invalidateLivePipelineApplied()` 도 호출(라이브 전부 닫힘 →
  다음 편집은 실제 재적용).

---

## 사이드이펙트/저사양 PC 영향 점검

- **추가 COM 부하 없음(정상 경로)**: §5.2 단일 파일 빠른 경로로 일반 토글/적용은 기존과 동일하게
  서버 호출 1회. §5.3 세션 조회는 in-memory map 조회, 실패 경로에서만 오픈 1회 재시도.
- **복구는 더 빨라짐**: §5.2 동반 스냅샷 생략으로 다중 파일 리셋 비용 급감.
- **게이트 완화의 안전성**: §3 은 "정상 코드 통과"만 넓혔고, 의도된 차단(루프 내 ctx 쓰기,
  bare 빌트인, MsgBox/Workbooks.Open/On Error Resume Next/FSO CreateObject, while True/1)은
  단위 테스트로 유지 확인.
- **유령 적용 차단의 트레이드오프**: §5.3 으로 세션 미확보 시 "조용한 성공" 대신 명시적 에러가
  뜬다 — 잘못된 파일 오염보다 안전. 직전에 `invalidateLivePipelineApplied()` 가 걸려 다음 편집은
  반드시 실제 재적용.

## 검증

- 변경 6개 JS + `serve_b2b.py` `node --check` / `ast.parse`(utf-8-sig) 통과.
- 정적 게이트: 클라/서버 단위 테스트 — `re.compile`·루프 뒤 write·루프 내 list.copy/sort·주석
  메아리는 통과, 루프 내 ctx 쓰기·별칭 쓰기·bare 빌트인·while 1·VBA 금지어는 차단 확인.
- no-op 생략 시그니처: OFF 삭제/OFF 수정→생략, ON 삭제/OFF→ON 토글→재적용, 무효화 후 항상 재적용 확인.
- 라이브 Excel COM·네이티브 호스트 실동작은 Windows 검증 필요(개발 환경은 mac).
