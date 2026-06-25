# 30. 런타임 읽기-한도 초과 → 자동 VBA 전환 복구 + 라우팅 회귀(#2) 좁히기 (v0.5.13)

테스터 리포트/코드리뷰 후속. 사용자 지시 3건을 처리했다. **serve_b2b.py 는 안 건드렸다**(chat-ui.js + pipeline.js + 테스트만).

## 1) [사용자 지시] "읽기 범위가 너무 큽니다" 런타임 오류 → 멈추지 말고 자동 VBA 복구
- 배경: `ctx.read` 가 `PY_READ_MAX_CELLS(6,000,000)` 초과 시 `읽기 범위가 너무 큽니다… VBA 경로를 사용하세요` 로
  **에러를 내고 멈췄다**. 사용자는 "기존 ai 재생성 로직 있으니 자동으로 고쳐서 돌려라" 요청.
- 핵심 통찰: 이 오류는 **범위만 좁힌다고 풀리지 않는 Python COM 구조적 한계**라, 같은 작업을 VBA(벌크 배열/AutoFilter)로
  전환하는 게 정답. 이미 `requestErrorRecovery` 에 누적 실패 임계(`PYTHON_RUNTIME_FAIL_VBA_THRESHOLD`) 도달 시
  VBA 전환(`vbaRuntimeSwitch`)이 있었음 → 이 오류는 **임계 없이 첫 발생부터 즉시 전환 + 자동 발사**로 연결.
- 구현:
  - `chat-ui.js` `isPythonComReadLimitRuntimeError(message)` 판별기 신설(런타임 한도 메시지 + 백엔드 정적게이트
    "큰 표를 ctx.read 로 Python 리스트에 올려…" 메시지 둘 다 같은 범주로 인정).
  - `requestErrorRecovery`: 이 오류 + python 복구 + (복구창에서 명시적 python 요구 아님)이면
    `vbaRuntimeSwitch=true; isVbaRecovery=true` 즉시(누적 카운트 불문).
  - `pipeline.js` 자동 발사 2곳: chat-side `reportPipelineError`(복구 버튼 자동 click) / runner-side
    `showRunnerPipelineError`(읽기한도면 `attemptRunnerAutoRecovery` 구조보정 건너뛰고 `requestErrorRecovery` 로,
    버튼 자동 click). 중복 발사 방지 가드는 **공유 err 객체**의 `__autoReadLimitVbaTried`(runner 가 먼저 렌더돼
    먼저 set → chat 쪽은 skip).
- 테스트: `_test_python_read_limit_auto_vba.js` (8/8) — 런타임/정적게이트 메시지는 감지, 무관 오류는 비감지.

## 2) [코드리뷰 #2/#5] filterToNewSheetIntent 라우팅 회귀 좁히기
- 회귀: `같은/동일/찾아` + `복사/작성/넣어/옮겨` 만으로도 true 가 돼, **평범한 "새 시트에 복사"까지 대용량
  AutoFilter VBA 로 강제**. (이 함수가 true 면 VBA 강제 경로.)
- 수정 방향(Codex 합의): "**필터/추출 조건 + 새 시트 생성**"만 잡고, 단순 복사는 제외(단순 복사는 네이티브
  `ctx.copy` 가 안전·정확).
- 구현(`filterToNewSheetIntent`): (1) 목적지가 **'새/별도 시트'** 여야 함(단순 복사동사만으론 불인정).
  (2) 강한 필터신호(필터/추출/골라/걸러/조건에 맞/X만 새/연도만) **또는** 약신호(찾아/일치/같은/동일/중에)가
  **특정 값**(따옴표 값·3자리+숫자·"특정 ~"·"~인 행")과 함께일 때만 true.
- **왜 안전한가(사용자 질문: COM 으로 가면 대용량 read/write 또 터지나?)**: 강제 해제되는 건 "복사/붙여넣기"뿐인데
  `ctx.copy`/`copy_sheet` 는 **Excel 네이티브 복사(데이터를 python 으로 안 읽음)** 라 셀 한도 자체가 없다.
  한도가 걸리는 건 `ctx.read`(셀→python)뿐인데, 진짜 필터/추출은 좁힌 뒤에도 VBA 로 남고, 설령 닿아도
  위 (1) 의 자동 VBA 복구가 받는다.
- 테스트: `_test_filter_to_newsheet_narrowing.js` (11/11). 기존 라우팅 테스트 전부 유지
  (large_filter 7, ctx_helper 25, routing_cause 23, explicit_python 13).

## 3) [코드리뷰 #10] _a1_cells_estimate 열범위 inf — **정적 게이트 유지(변경 없음)**
- 리뷰는 "`A:E` → inf → 작은 시트 오차단"이라 했지만, **전제가 틀렸다**: `ctx.read(sheet, "A:E")` 는
  `ws.Range("A:E")`(리터럴 전체 열, 1,048,576행 × 5 = **5.2M셀**)을 읽는다 — used range 로 클립 안 함
  (range 생략 시에만 UsedRange). 따라서 시트가 작아도 5.2M셀 전송 → 저사양 VM hang. **차단이 true positive.**
- 게다가 `A:E`=5.2M < 6M 이라 **런타임 가드(6M)에 안 걸리고 실제 실행돼 hang** → 에러가 아니라 hang 이라
  (1)의 자동복구로 못 받는다. 즉 정적 게이트가 **유일한 hang 방어선**이라 약화하면 안 됨.
- 결론: 정적 게이트는 anti-hang(사전 차단), 런타임 가드+자동복구는 anti-overflow(>6M 깨끗한 에러→VBA).
  상보적이며 #10 은 **수정 불필요**.

## 발견한 stale 테스트 2건
- `_test_vba_pipeline_step_errorinfo.py`: mock 이 `_setup_isolated_pipeline_instance` 를 3-튜플로 반환했는데
  실제는 교차파일 되돌려쓰기 도입 후 **4-튜플**(`fapp, ftarget, fpid, companions`). → mock 을 4-튜플로 **수정함**
  (테스트 전용, 현재 실제 시그니처 반영).
- `_test_auto_reapply_after_restart.js`: 제거된 `maybeAutoReapplyAfterRestart` 를 찾음(현재 복구경로
  `maybeAutoReapplyAfterRecover` 로 **통합됨**, excel-mirror.js:1086). **미수정** — Codex 의 미러 통합 영역이고
  민감(미러 회귀 이력)해서 손대지 않음. Codex 가 삭제하거나 Recover 로 재지정 권고.

## 검증
- chat-ui.js / pipeline.js `node --check` OK, serve_b2b.py `py_compile` OK.
- JS 25 PASS / 1 stale(auto_reapply), Python 26 PASS / 0 FAIL.
