# B2B Agent 교훈 문서 모음

이 폴더는 0.5.10 이후 비슷한 문제를 다시 만났을 때 바로 참고하기 위한 문서 묶음입니다.
0.5.6, 0.5.7, 0.5.8, 0.5.9의 핵심 MD를 훑어서 교훈성 문서를 모았고, 파일명 앞 숫자는 읽는 우선순위입니다.

정리 기준일: 2026-06-18

전체 파일 목록은 `MANIFEST.md`에서 확인합니다.

## 먼저 볼 문서

0. `LESSONS_0.5.6_TO_0.5.9.md`
   - 0.5.6~0.5.9 전체를 훑어 뽑은 핵심 교훈 요약입니다.
   - 새 문제를 고치기 전 체크리스트로 먼저 봅니다.

1. `06_vba_full_run_investigation.md`
   - 단일 적용은 되는데 전체실행만 실패했던 핵심 조사 기록입니다.
   - Excel 매크로 보안 문제가 아니라 저장 스킬 payload, VBA 주입 정규화, 전체실행 경로 차이가 원인이었습니다.
   - 비슷한 오류 문구가 다시 나오면 이 문서부터 봅니다.

2. `01_project_readme_changelog.md`
   - 0.5.4부터 0.5.10까지 큰 설계 변화와 재발 방지 체크리스트가 들어 있습니다.
   - 특히 0.5.8, 0.5.9 섹션은 전체실행, Python COM/VBA 혼합, 안전 재생성, 값/수식 복사 규칙의 기준입니다.

3. `02_python_engine_risks.md`
   - Python/openpyxl/Python COM/VBA 선택 기준과 위험 패턴 정리입니다.
   - 앱 멈춤, 셀 단위 COM 루프, 수식 재계산, 서식/병합/피벗 문제를 볼 때 참고합니다.

4. `04_vba_regression_checklist.md`
   - VBA 생성 품질을 회귀 테스트하는 기준 문서입니다.
   - LLM 생성물의 수식 보존, 숨김/병합, 행열 삽입, 값 복사, 정적 검사 기준을 확인할 때 봅니다.

5. `08_v059_freeze_regression_scenarios.md`
   - 조건+for문, HCN류 다중 가입번호 매칭 합산, Python COM 멈춤 방어 시나리오입니다.
   - “엑셀은 움직이는데 앱이 멈춤” 유형의 재현 기준입니다.

## 상황별 참고

| 상황 | 먼저 볼 파일 |
| --- | --- |
| 전체실행/VBA만 실패 | `06_vba_full_run_investigation.md`, `01_project_readme_changelog.md` |
| Python COM이 느리거나 앱이 멈춤 | `02_python_engine_risks.md`, `08_v059_freeze_regression_scenarios.md` |
| 값만 복사, 그냥 복사, 수식/서식 보존 혼동 | `07_v058_regression_scenarios.md`, `09_v059_copy_paste_capture_scenarios.md` |
| 교차파일 복붙이 전체실행만 실패(보호 시트 오류)·복붙 캡처 동작/함정 | `14_v0510_cross_file_copy_paste_full_run.md`, `09_v059_copy_paste_capture_scenarios.md` |
| 단순 작업이 엉뚱한 엔진(VBA/Python)으로 라우팅됨·엔진 선택 규칙 | `16_v0510_routing_mention_keyword_collision.md`, `01_project_readme_changelog.md` |
| VBA 행/열 숨김·숨김해제가 적용됐는데 "변경 없음" 오류로 스킬 생성이 막힘 | `17_v0510_vba_hidden_noop_smoke.md` |
| 피벗/유사 피벗, 선행 0 보존, 시간 환산 | `07_v058_regression_scenarios.md`, `04_vba_regression_checklist.md` |
| VBA 생성 흐름 전체를 설명해야 함 | `05_chat_to_excel_flow_prompt.md` |
| Excel 미러/네이티브 구조 파악 | `03_excel_mirror_architecture.md` |
| 테스트 데이터가 왜 있는지 확인 | `11_test_data_guide.md`, `10_v056_bug_validation_scenarios.md` |
| 과거 Claude 패치/검토 근거 확인 | `12_changes_claude_review_notes.md` |
| 오래된 변경 이력 확인 | `13_legacy_changelog.md` |
| 버전별 원본 문서 대조 | `by_version/v0.5.6/` ~ `by_version/v0.5.9/` |

## 버전별 원본 묶음

아래 폴더에는 각 버전에서 교훈으로 가져갈 만한 MD를 원문 그대로 복사했습니다.

| 폴더 | 핵심 내용 |
| --- | --- |
| `by_version/v0.5.6/` | Python COM 기본 전환, 값/수식 의도 분리, VBA 정적검사 오탐, 취소/복구 한계, v056 버그검증 |
| `by_version/v0.5.7/` | 0.5.6과 문서 해시가 대부분 동일한 기준선. 문서화 누락 자체가 교훈 |
| `by_version/v0.5.8/` | 안전 재생성 완화, VBA 전체실행 실패 조사, 혼합 파이프라인, v058 회귀 시나리오, VBA 회귀 리포트 |
| `by_version/v0.5.9/` | Python COM 멈춤 방어, HCN류 다중 매칭 합산, 복붙 캡처, 셀 삭제 캡처, 사용자 가이드 기반 정리 |

## 포함 파일 출처

| 파일 | 원본 |
| --- | --- |
| `01_project_readme_changelog.md` | `README.md` |
| `02_python_engine_risks.md` | `PYTHON_ENGINE_RISKS.md` |
| `03_excel_mirror_architecture.md` | `EXCEL_MIRROR_ARCHITECTURE.md` |
| `04_vba_regression_checklist.md` | `tests/vba_regression/README.md` |
| `05_chat_to_excel_flow_prompt.md` | `tests/vba_regression/CHAT_TO_EXCEL_FLOW_PROMPT.md` |
| `06_vba_full_run_investigation.md` | `../B2B_ver0.5.8/test_runs/VBA_전체실행_조사리포트.md` |
| `07_v058_regression_scenarios.md` | `test_data/시나리오_v058_회귀검증.md` |
| `08_v059_freeze_regression_scenarios.md` | `test_data/시나리오_v059_튕김_회귀검증.md` |
| `09_v059_copy_paste_capture_scenarios.md` | `test_data/시나리오_v059_복붙캡처.md` |
| `10_v056_bug_validation_scenarios.md` | `test_data/시나리오_v056_버그검증.md` |
| `11_test_data_guide.md` | `test_data/README.md` |
| `12_changes_claude_review_notes.md` | `CHANGES_claude.md` |
| `13_legacy_changelog.md` | `CHANGELOG.md` |
| `14_v0510_cross_file_copy_paste_full_run.md` | 2026-06-18 교차파일 전체실행 조사 세션에서 신규 작성(단일 원본 복사 아님) |
| `16_v0510_routing_mention_keyword_collision.md` | 2026-06-22 라우팅 오분류(파일명 키워드 충돌) 조사 세션에서 신규 작성 |
| `17_v0510_vba_hidden_noop_smoke.md` | 2026-06-22 VBA 행/열 숨김 상태 no-op 실패 조사 세션에서 신규 작성 |
| `by_version/v0.5.6/*` | `../B2B_ver0.5.6`의 교훈성 MD |
| `by_version/v0.5.7/*` | `../B2B_ver0.5.7`의 교훈성 MD |
| `by_version/v0.5.8/*` | `../B2B_ver0.5.8`의 교훈성 MD와 회귀 리포트 |
| `by_version/v0.5.9/*` | `../B2B_ver0.5.9`의 교훈성 MD |

## 유지 원칙

- 이 폴더는 런타임 코드가 아니라 교훈/회귀/조사 문서 묶음입니다.
- 원본 문서를 바꿨다면 이 폴더의 복사본도 같이 갱신합니다.
- 새로 큰 삽질을 했으면 조사 리포트와 최소 재현 시나리오를 이 폴더에 추가합니다.
- 이름은 `NN_topic.md` 형식으로 유지해 읽는 순서가 흔들리지 않게 합니다.
