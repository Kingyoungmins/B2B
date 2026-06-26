# 29. xhigh 코드 리뷰 결과 패치 (v0.5.13)

이번 세션 변경(0.5.12→0.5.13)에 대한 10앵글 코드리뷰(62후보→15확정). **제 코드의 명확한 버그만** 패치하고,
**코덱스(동시 작업) 코드 findings 는 플래그만** 했다. 모두 스모크 12/12 PASS, 컴파일/구문 OK.

## 패치한 것 (제 코드)
- **#11 (sev3) companion 보호 재적용**: `_sync_modified_companions_into_live` 가 동반본을 보호 해제(`..._read_only_mirror(owb,False)`)한 뒤
  `_copy_source_workbook_into_target` 만 하고 **재보호를 안 해** 읽기전용 미러가 풀린 채 남았다. 복사 직후
  `_protect_workbook_for_read_only_mirror(owb, True)` 추가(primary 의 `_restore_live_protected_view` 와 대칭).
- **#6 (sev3) 별칭 누적에 강건화**: `_WB_NAME_ALIASES` 의 set 은 같은 위장파일 재오픈마다 새 실제명(uuid 변동)이 쌓여
  `len==1` 조건이 깨지면 해석이 멈췄다. `_alias_open_workbook_name` 을 "**현재 실제로 열린 actual 만 필터**해 정확히 1개일 때 사용"
  으로 변경(닫힌 옛 actual 자동 배제 → 누적/스테일 강건, 진짜 모호만 보류). #14(2회 열거)도 이 경로에서 1회로 감소.
- **#8 (sev3) ctx.book 별칭 대칭**: Python `ctx.book()` 이 별칭을 안 봐 위장파일을 VBA 는 찾는데 Python 만 못 찾던 비대칭.
  resolver 끝에 `_alias_open_workbook_name` fallback 추가.
- **#12 (sev2) 별칭 누수 정리**: 격리 `_run_vba_pipeline_on_session_impl` teardown(Quit 전)에 `_clear_workbook_name_aliases(fapp)` 추가(pid 누수/스테일 방지).

회귀 테스트 추가: `_test_vba_workbook_alias_format_convert.py` 에 누적(len>1) 케이스 2개(현재 열린 것만 해석 / 전부 미오픈 시 보류). 9/9.

## 코덱스 코드 — 플래그만(동시 작업 중, 충돌 위험 → 미패치)
- **#1 (sev4, 데이터 손상)** `runFromCheckpointAfterEdit`(pipeline.js): resume 체크포인트 활성 시 idx<resume 편집/삽입에서
  `restorePipelineCheckpointForSuffix` 를 **스킵** → 이미 적용된 스텝 위에 재적용(값 이중 붙여넣기/누적/교차파일 중복). **우선 수정 권고.**
- **#2/#5 (sev3) 라우팅 회귀**: `filterToNewSheetIntent` 가 `같은/동일/찾아` 로 과넓어 양성요청을 VBA 강제 / `shouldRouteRequestToVba` 순서 뒤집힘.
- **#10 (sev3)** `_a1_cells_estimate` 가 열범위(`A:E`)에 무조건 inf → 작은 시트 ctx.read+loop 오차단.

## 노트(엣지/설계상 — 미패치)
- #3/#13 range 문자열 + count 동시/역범위('D:A'): 모델이 모순·역순 인자를 줄 때만. 낮은 빈도.
- #7 비-Workbooks 리터럴(SaveAs/Open) 별칭 오치환: 위장파일명을 SaveAs 하는 드문 케이스.
- #9 for-loop per-step 스냅샷 비용: 사용자가 "모든 단계 사진"을 명시 선택(연속 OFF/삭제 대비). 의도된 트레이드오프.
- #15 ensurePipelineReferencedSessionsOpen 순차 await: 백엔드가 단일 워커로 세션오픈을 직렬화하므로 클라 병렬화는 실측 무의미.
