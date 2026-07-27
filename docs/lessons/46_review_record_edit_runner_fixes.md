# 46. 녹화→수정/삽입→실행기 경로 리뷰 수정 — 곁가지 경로가 본선 계약을 물려받게 하라

**버전**: 0.7.0 (2026-07-27) · **트리거**: 녹화 파이프라인/단계 수정·삽입/실행기 동작 전면 코드리뷰(3-에이전트 교차검증). 공통 패턴: **정상 경로는 견고한데 복구·이어실행·보류(resume) 곁가지가 본선 계약(파일출력·resume·교차 리셋)을 안 물려받았다.**

## 고친 것 (6건 — registry: RUNNER-RECOVERY-FILEMODE-CONTRACT / RECORD-FASTAPPEND-COVERAGE-BACKUP / PIPELINE-APPEND-RESUME-CROSSVBA-DIALECT)

1. **실행기 '에러 복구 시도' 버튼이 sync·비매핑 재실행** — `attemptRunnerAutoRecovery` 가 source 만 넘겨 라이브 동기화 모드로 돌았다(라이브 무손상 계약 위반 + outputFiles 미생성 → 다운로드/결과편집이 이전 실행 결과 서빙, 매핑 확정 무시). → 정상 실행 버튼과 동일 계약(outputMode:"file"+bg+`beginMappedPipelineRun`), 선복구는 래핑 '전'(원본 기준 — 치환 리터럴 저장 유출 방지).
2. **자동복구 후 이어실행이 파일모드를 잃음** — `runPipelineWithAutoRepair` 복구 성공 → `restorePipelineCheckpointForSuffix`(headless 가드 없음, 라이브 replace) → `runPipelineSuffixFromCheckpoint`(skipReset → useBg 꺼짐) → per-group `/run-vba-pipeline` 엔드포인트엔 **outputMode 개념이 없다** → 라이브 동기화. → outputMode:"file" 이면 이어실행 금지, 보류 비우고 전체 재실행(파일모드=pristine 격리 배치라 중복 없음).
3. **녹화 fast append 이중 반영** — 게이트가 `recPreSnapshots.length`(개수>0)만 봐서 앵커 스냅샷 저장 실패 시에도 진입 → 복원 안 된 세션에 수동분+재실행분 이중 반영. 스냅샷도 레코더 ON '후'에 떠서 준비 구간 편집이 스냅샷·매크로 양쪽에 들어갔다. → 스냅샷 선행 + 3중 게이트(전 세션 성공 recSnapshotsComplete·앵커 보유·녹화 중 새 세션 없음, 어긋나면 비파괴 전체실행 폴백+trace) + **파괴 복원 전 정지시점 백업**(백업 실패 시 파괴 복원 포기, 재현·폴백 전부 실패 시 백업 복구 — 사용자 작업 소실 방지).
4. **보류(resume) 중 채팅 append 이중 실행** — `insertLogic`/`replaceLogicAt` 은 resume 을 반영하는데 `applyLogic`(맨뒤 추가)만 즉시 라이브 적용 → 보류 재개 시 suffix 에 새 스텝 포함 = 2회 실행. → resume 존재 시 체크포인트 경로 합류, 불가(교차 등)면 insertLogic 맨뒤 위임. 부수: `reapplyVbaPipelineToLive` 성공 시 스테일 resume 정리(전체 재적용 후 resume 잔존 → 다음 편집이 접두 중복 실행하던 잠복 버그).
5. **채팅 생성 VBA 교차 쓰기 감지 사각** — `crossWriteDestinationFileIds` 가 dst_book/ctx.book/`Activate`(lesson 45, 녹화 방언)만 인식. LLM 지배 관용구 `Set wbDst = Workbooks("B")`·`If wb.Name = wbDstName … Set wbDst = wb` 는 불가시 → 목적지 미복원·재실행 중복. → `pipelineVbaTargetWorkbookNames` 연결. **게이트 함정**: `Workbooks(` 로 걸면 루프 관용구(괄호 없음)를 놓치고 python 코드까지 단일 폴백에 노출 → `Sub B2BSkill`(이 시스템 VBA 필수 형식)로 게이트.
6. **record/verify 死코드** — expected(정지 시점 다이제스트)는 python 엔진 stop 만 실었는데 엔진은 항상 VBA → 검증 인프라가 한 번도 안 돌았다(1~5류 조용한 오염을 잡을 유일한 그물). → 네이티브 stop 이 `_touched_sheet_pairs`(청크 시트 리터럴+활성 시트, 워크북당 상한 6)로 `capture_expected_states` 수확(동일 포맷 → 기존 소비자 무수정), stop 워커 타임아웃 60→120s.

## 스테일 테스트 6건 동시 수리 (내 수정과 무관 — 코드가 먼저 진화)
- `_test_pending_toggle_resume_fallback`: 복원 실패 시 false 반환(구계약) → pristine 재적용 폴백/명시적 throw(현 계약, '수정 미반영 수정')로 갱신.
- `_test_pipeline_checkpoint_edit_before_resume`: lesson 45 교차가드(`pipelineSuffixWritesCrossFile`)·suffix 전원 스냅샷 요구를 하네스에 반영.
- `_test_issue_real_artifacts`/`_test_paste_internal_repair`/`_test_paste_requirements`/`_test_lambda_dest_owner_var`: lesson 45 신설 `runnerRecordedActivatePairs` 를 하네스 추출 목록에 추가.

## 리뷰에서 확인만 하고 남긴 것 (미수정 — 후속 후보)
- fast append 실행 앵커가 recExcelId(시작 탭) 고정 — recordedExcelId(실제 녹화 창) 우선이 정확.
- recordedSheet=정지 시점 활성 시트 도장 + 스텝별 사전활성 → 시작/정지 시트가 다르면 초반 동작 시트 왜곡.
- intentNeeded(월/날짜 리터럴) 값 확인 UI 가 실행기에 없음(매핑 패널에 intentReason 경고 노출 후보).
- `lastRunnerOutputs`/`lastRunnerStepSnapshots` 실행 시작 시 미초기화(스테일 결과 서빙), 수정 성공 후 editingStepId 미해제, 채팅 수정/삽입 busy 가드 부재, computeStateBeforeStep 이 VBA/Python 을 JS 로 컴파일(항상 원본 폴백), stop 실패/리로드 시 녹화 상태 재동기화 부재.

## 교훈
- **곁가지 경로 감사**: 본선에 계약(outputMode 등)을 추가하면 복구/이어실행/보류 등 모든 재실행 곁가지가 그걸 물려받는지 전수 확인할 것 — per-group 엔드포인트처럼 개념 자체가 없는 하류가 조용히 계약을 깬다.
- **게이트는 '개수'가 아니라 '커버리지'**: 스냅샷 기반 복원의 진입 조건은 "몇 개 있냐"가 아니라 "되돌릴 대상 전부를 커버하냐".
- **파괴 연산 전 되돌릴 표를 먼저 끊어라**: 복원(replace)류는 실패 시나리오에서 사용자 작업을 지운다 — 백업 없으면 파괴 복원 자체를 포기하는 게 옳다.
- 새 함수/방언 추가 시(lesson 45 재확인) **테스트 하네스의 추출 목록도 방언 목록**이다 — 6개 스테일 테스트가 같은 날 생겼다.
