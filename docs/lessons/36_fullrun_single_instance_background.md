# 36 — 전체실행 백그라운드 처리(격리 인스턴스 1개) [0.5.15 진행중]

## 배경 / 증상
전체실행 시 "45 작업중"에서 오래 멈췄다가 45·46·47이 한꺼번에 완료, 다시 48에서 멈췄다 확 됨.
원인: 0.4.14 배치 구조 = **연속 같은-파일 그룹마다 백엔드 호출 1번**, 호출마다 ① 격리 Excel 새로
spawn + 워크북 열기 ② 그룹 스텝 실행 ③ 결과를 라이브에 통째 동기화(`_copy_source_workbook_into_target`).
무거운 ①③가 그룹 양끝에 몰려 "멈춤"처럼 보이고, 스텝 상태는 그룹 단위로 원자 갱신.
(스폰/동기화는 "라이브 뷰를 실시간으로 보여주기 위한" 비용 — 사용자가 화면 잠그면 뷰는 무용한데 비용만 다 냄.)

## 결정 (사용자: "뷰 포기하자" → Option A 선택)
**전체실행 백그라운드 처리 모드 = 격리 인스턴스 1개 + 끝에 파일별 1회 반영.**
- 실행 중 라이브 뷰 실시간 갱신 포기(진행률만), 끝나면 최종 결과 1회 로드.
- 선택지 B(라이브에서 직접, sync 0)는 **기각** — 실패 시 라이브 손상 + 과거 "매크로 실행 불가" 재발 위험.

## 설계
### 신규 백엔드
- 엔드포인트 `POST /api/excel/run-full-pipeline` → `handle_excel_run_full_pipeline`
  → `run_full_pipeline_single_instance(groups, reset=True, view_sheet=None)`
- `groups` = 클라가 보내는 순서있는 목록 `[{fileId, excelId, steps:[payload...]}]` (지금 grouping 그대로).
- 처리:
  1. 각 distinct fileId → 세션(EXCEL_SESSIONS)·sourcePath 해석.
  2. 격리 `fapp` **1개** spawn(`DispatchEx`), `_ensure_vbom_access` 등.
  3. 각 distinct 파일을 **pristine source에서 1회씩** temp 복사→`excel_workbooks_open(intended_name=파일명)`.
     맵 `byFile[fileId] = {wb, session, excelId, name}`. (전체실행은 reset=True 고정 → 전부 원본.)
  4. groups 순서대로: `ftarget = byFile[g.fileId].wb`; 각 스텝마다
     - `PIPELINE_PROGRESS[anchor] = {current: 전역누계, total: 전역합계}` (전 스텝 통산 → 진행률 매끄럽게)
     - 스텝-전 `ftarget.SaveCopyAs(prestep_…)` → RESULTS → step_snapshots(전역) (Bug2 이어실행/빠른복구용)
     - 시트 활성화 + 실행: VBA `_inject_and_run_vba(fapp, ftarget, code)` / Python `_exec_python_com_skill(fapp, ftarget, session, code)`
     - 변경된 파일 id 기록(mutatedFileIds). VBA가 `Workbooks("타파일")` 교차쓰기 시 그 파일도 mutated 표시.
  5. 전 그룹 후: mutated 각 파일 → `ftarget.SaveCopyAs(result)` → `_copy_source_workbook_into_target(live_app, live_wb, result)`로 **파일당 1회** 라이브 반영. (companion 동기 불필요 — 모든 파일이 byFile에 있음.)
  6. `fapp` **1회** Quit + taskkill, temp 정리, `PIPELINE_PROGRESS.pop`.
  7. 반환 `{ok, applied, stepSnapshots(전역), perFileLiveSchema}`.
- 실패 시: 라이브 **반영 안 함**(무손상) + `errorInfo.stepSnapshots`(전역)로 이어실행 가능하게. fapp 정리는 finally.

### 클라
- 전체실행 경로(`runIsolatedLivePipelineSteps`)에 `options.backgroundMode`(전체실행 기본 true).
  true면 reset-only N콜 + group N콜 대신 **groups 한 번에** `/api/excel/run-full-pipeline` 1콜.
- 실행 중 라이브 창 숨김(`beginExcelMirrorApplyLoading({hideWindows:true})`), 진행률 폴링은 1콜 전체에서 전역 current/total로 매끄럽게.
- 완료 후 파일별 liveSchema 캐시 갱신 + 최종 뷰 1회 로드.
- **기존 per-group 경로는 폴백으로 유지**(backgroundMode off 또는 신규 엔드포인트 실패 시).

## 불변/주의
- "항상 원본부터": 각 파일 pristine 1회 오픈으로 보장(별도 reset-only 콜 불필요).
- 원본 파일(sourcePath)은 절대 안 건드림(copy2 FROM만). 결과는 temp/result 경유.
- 누수: fapp/temp 모두 finally 정리(0.5.x 디스크 누수 교훈 유지). 인스턴스를 콜 사이에 살려두지 않음(1콜=1인스턴스 수명).
- VBA는 Excel 필수 → 숨김 1개로 충족. Python-only 그룹도 같은 인스턴스에서 COM 실행(일관).

## 테스트
- 라이브 COM: 2파일·혼합(VBA+Python) 스텝을 1콜로 → 각 라이브에 결과 반영 + 원본 무손상 + spawn 1회 확인.
- 회귀: 단일파일 전체실행 결과가 기존 per-group과 동일(시트/값).
- 기존 `_test_isolated_pipeline_sequential_apply.js`(per-group 폴백) 유지 통과.

## 상태
- [x] 백엔드 `run_full_pipeline_single_instance` + 엔드포인트 `/api/excel/run-full-pipeline` (py_compile OK)
- [x] 라이브 COM 테스트 `_test_fullrun_single_instance_live.py` — 5/5 (2파일·cross-file 라우팅·파일별 동기화·원본 보존·applied=2)
- [x] 클라 backgroundMode 분기(1콜) + 폴백 — runIsolatedLivePipelineSteps 에 `useBg`(=`options.backgroundMode===true && !skipReset && groups.length`) 분기, early-return 금지·공용 정리로 fall-through. 전체실행 버튼 2곳(generator btn-run / runner-run-btn)에서 `backgroundMode:true` opt-in 전파(runPipelineWithAutoRepair→runPipelinePreferBackend→runVbaPipelinePreferLive→runIsolatedLivePipelineSteps). skipReset(suffix 이어실행)·recovery·기타 경로는 기존 per-group 유지.
- [x] 백엔드 step_snapshots 에 `excelId`(=gid) 추가 + 클라 wirePipelineStepSnapshots 가 `snap.excelId||excelId` 사용(다파일 이어실행 정확도)
- [x] node --check + JS 테스트 `_test_fullrun_background_client.js` 12/12 (1콜·2파일 그룹·resetExcelIds·per-step excelId·정리균형)
- [x] 회귀: per-group 폴백 14/14, pending-toggle 4/4, last-step-snapshot 4/4, auto-repair/checkpoint/last-edit OK, filter_to_sheet 5/5

## 후속 수정 — 동반 워크북 누락(교차참조 "열려 있지 않습니다")
실측 버그: 2파일 환경에서 전체실행 시 step2(VBA)가 `Workbooks("네이버클라우드_5월 트래픽.xlsx")` 를 "열려
있지 않습니다"로 실패. 원인: 백그라운드 함수가 **open_ids(그룹 대상 ∪ resetExcelIds)만** 열고, 구 per-group
`_setup_isolated_pipeline_instance` 가 열던 **'다른 라이브 세션=동반 워크북'을 안 열었다.** VBA 가 그룹 대상이
아닌 파일을 참조하면 격리 인스턴스에 그 파일이 없어 실패. (설계 시 "모든 파일이 byExcel 에 있다"는 가정이 틀림.)
수정: open_ids 오픈 후, byExcel 에 없는 **다른 liveEditable 세션을 현재 상태(SaveCopyAs)로 동반 오픈**(구
companion 과 동형). 변경되면 끝의 동기화 루프가 함께 반영. 복원 루프도 `sessions`(동반 포함) 순회로 변경.
테스트 `_test_fullrun_companion_crossref_live.py` 4/4 (비대상 파일 참조 성공 + 교차쓰기 반영).

## 완료 (구현+테스트). 남은 것
- 실서버 통합(HTTP) 스모크는 앱 구동 시 확인 권장(컴포넌트별로는 검증됨).
- 빌드/푸시는 사용자 지시 시. (백엔드 변경 포함 → 0.5.15 앱 '재시작' 필요, 단순 새로고침 아님)
