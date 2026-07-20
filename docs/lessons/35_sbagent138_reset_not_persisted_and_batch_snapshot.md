# 35. SBAGENT-138 진짜 원인(리셋 디스크 미저장) + 한화 스냅샷 회귀 (v0.5.13/0.5.14)

저사양 PC 트레이스(2026-06-25)로 **확정**. lesson 33 의 "보류 체크포인트가 reset 을 스킵" 가설은 **반증됨**(아래).

## 1) SBAGENT-138 — 리셋이 메모리에서만 복원, 디스크 미저장
**트레이스(0.5.13 저사양):**
- 콜A `reset:true, steps:0` → impl.start 워크북 `["06_DAS"]`, ok 반환.
- 콜B `reset:false, steps:1`(step1=Sheet1 5~9행 삭제) → impl.start 워크북 **여전히 `["06_DAS"]`** → 격리 target 도 `["06_DAS"]` → step1 "시트 'Sheet1' 못 찾음(사용가능 ['06_DAS'])".

**근본 원인:** 리셋-only(`_run_vba_pipeline_on_session_impl` 의 `if not run_steps: if reset:` → `_copy_source_workbook_into_target`)는 라이브 워크북을 **메모리에서만** 원본으로 되돌리고 **디스크(작업복사본 session["path"])에는 저장하지 않는다**. 저사양은 콜 사이에 Excel COM 참조가 죽어 `session_workbook` 이 `GetObject(session["path"])` 로 **디스크에서 재오픈**(3948~3971) → 디스크는 아직 직전 실행의 06_DAS → step1 이 06_DAS 위에서 돌다 터짐. 고사양은 캐시된 wb 참조가 살아 메모리 복원본(Sheet1)을 봐서 정상.
- **step 재정렬 아님**(트레이스상 reset→step1 순서 정상). "뒤 스킬이 먼저 도는 느낌"은 착시.
- sourcePath 는 업로드 시 1회 설정(3882) 후 어디서도 덮어쓰지 않음(불변). 오염된 건 source 가 아니라 **작업복사본 디스크 + 메모리-복원의 비영속성**.
- lesson 33 의 Fix A(ignoreCheckpoint)/Fix B(subset 검증)는 무해하나 이 버그를 못 막았다(콜A 가 ok 반환 = Fix B 통과, 메모리는 복원됨).

**수정(0.5.13 + 0.5.14 공통):** 리셋-only 분기에서 `_copy_source_workbook_into_target` 직후 **`wb.Save()`** 로 복원본을 디스크에 저장(DisplayAlerts off, try/except, `pipeline.reset.persisted` 트레이스). 저사양이 재오픈해도 원본을 보장하고, 직후 `reset:false` 격리 SaveCopyAs 도 pristine 을 복사.

## 2) 전체실행 리셋 경로별 취약성 (왜 0.5.14 도 저사양에서 재발했나)
`reapply`/전체실행(pipeline.js ~2900)이 종류별로 리셋 방식이 갈린다:
- **python-only 단일파일**: `{steps:전부, reset:true}` 한 콜 → 격리 `shutil.copy2(sourcePath, tpath)` = **원본 디스크째 복사 → SBAGENT-138 면역**.
- **VBA 포함 / 교차파일 / 다중파일**: `resetFileIds` 로 **리셋-only(메모리) + reset:false 배치** → 위 1) 취약 경로. DAS 75단계=VBA+교차파일이라 0.5.14 도 저사양에서 재발 가능했음.
→ 1) 의 `wb.Save()` 가 이 취약 경로 전부(리셋-only 단일 진입점)를 한 번에 막는다.

## 3) 한화 5단계 "5단계 에러" = batch 스냅샷 회귀(별개 아님)
"첫 에러=스냅샷이 없어서 오류"로 확인. 한화는 step2 가 VBA → 전체실행이 **격리 batch 경로**(`runIsolatedLivePipelineSteps`) → 0.5.14 batch 가 per-step 스냅샷을 안 떠서, 마지막 단계 OFF/삭제 시 `restoreLastStepPreApplySnapshot` 가 false → "스냅샷 없음" 오류 토스트(취소). "4단계 on/off"는 reconcile 재실행을 강제한 우회. (1~4 는 첫 python 라이브 for-loop 실행 때 뜬 스냅샷이 남아 됐던 것 — VBA vs COM 경로 차이.)

**수정(0.5.14):** 격리 batch 가 **스텝 실행 '전' ftarget 을 BACKEND_DIR 에 SaveCopyAs → RESULTS 등록 → downloadId 를 `result["stepSnapshots"]` 로 반환**. 클라(`runIsolatedLivePipelineSteps`)가 헬퍼 `wirePipelineStepSnapshots` 로 각 `step._preApplySnapshot`(라이브 세션 excelId 동봉)에 wiring → VBA/격리 경로도 13 처럼 즉시 OFF/삭제 빠른복구. 파일은 종료 시 `cleanup_backend_runtime_files`(atexit)가 RESULTS 와 함께 정리.

### 3-b) 자동복구 이어실행도 같은 스냅샷이 필요 (실패 경로 전달)
증상: 전체실행 → step5 실패 → 자동복구 뱃지 → **"checkpoint snapshot missing after auto repair"** (`createPipelineStepError`, pipeline.js ~4071). `runPipelineWithAutoRepair` 는 복구 후 **실패 step 직전 스냅샷**으로 되돌려 이어실행(`restorePipelineCheckpointForSuffix`)하는데, batch 가 **실패하면 throw → 성공 경로 wiring 이 안 돌아** `step._preApplySnapshot` 부재 → 중복 적용 방지차 중단.
**수정:** 백엔드가 실패 시에도 `step_snapshots`(실패 step '직전'까지 = 실패 step 의 pre-snapshot 포함)를 **`PipelineExecutionError.info["stepSnapshots"]`** 에 실어 보냄(일반 raise + 스텝-내부 PipelineExecutionError 재raise 둘 다). HTTP 400 `errorInfo` 로 직렬화(serve_b2b.py:1322). 클라는 `runIsolatedLivePipelineSteps` **catch 에서** `err.errorInfo.stepSnapshots` 를 `wirePipelineStepSnapshots` 로 wiring 후 재throw → 자동복구가 `restoredToCheckpoint=true` 로 이어실행 성공.

### 3-c) 한화 "첫 전체실행에서 step5 안 됨" 최종 원인 = 하드블록→자동복구→데드엔드
실제 step5(kzr2hte3, logic.json) = **VBA**:
```vba
Set ws = ActiveWorkbook.ActiveSheet
Set usedRng = ws.UsedRange
For Each cell In usedRng.Cells: cell.NumberFormatLocal = "...": Next
```
→ `pipelineRuntimeExecutionBlockersForStep` 의 **두 하드블록 패턴**(ActiveSheet+UsedRange / UsedRange.Cells For-Each 셀단위 변경)에 걸림 → `runIsolatedLivePipelineSteps` 가 **백엔드 호출 전 클라단에서** `createPipelineRuntimeExecutionBlockError` throw(그래서 **trace 안 남음**) → 자동복구가 python(set_number_format 범위단위)으로 재생성 → **이어실행하려는데 스냅샷이 애초에 없음**(백엔드 미실행) → 예전엔 "checkpoint snapshot missing" **데드엔드**. 사용자가 step4 토글로 reconcile 재실행을 강제해야 풀렸음.
**수정:** `runPipelineWithAutoRepair` 에서 스냅샷 없으면 데드엔드 throw 대신 **`clearPipelineResumeFromIndex()` + `continue`(pristine 전체 재실행)**. 전체실행은 reset:true(+관련 파일 전부 리셋, +리셋 디스크-영속)라 중복 없이 안전. 재생성된 python step5 가 전체 재실행에 반영 → 성공(수동 토글 불필요). 반복 실패 시 repair 한도에서 '진짜 오류'로 보고(혼란스러운 "스냅샷 없음" 대신).

## 4) 토글 OFF/ON 후속 (스냅샷이 모든 스텝에 생기며 드러난 것들)
- **(2) 보류 구간 ON 무반응:** 보류 체크포인트가 있을 때 그 구간 스텝을 ON/OFF 하면 토글만 바뀌고 보류로 방치됐다(ON 해도 안 돌아옴). → 토글 핸들러에서 `runFromCheckpointAfterEdit(currentIdx, ...)`로 **보류 지점부터 즉시 이어실행**(실패 시 토글 원복).
- **(1) 복원 후 그리드 빈 화면:** 잠깐 깜빡 후 정상 → (2) 수정으로 자동 해소(재실행이 재표시). 미러 표시 로직은 민감해 그대로 둠.
- **(3) 워크북 이름 오염 → VBA "파일 못 찾음" (저사양 트레이스로 확정):** fast OFF 가 스냅샷을 `/api/excel/replace`(name 미지정)로 복원할 때, `excel_workbooks_open` 은 워크북을 **리네임하지 않으므로**(serve_b2b.py:1818, `intended_name→실제명` 별칭만 저장) **`wb.Name = 스냅샷 파일 basename`** 이 된다. 스냅샷 파일명은 `prestep_{32hex}_원본.xlsx`(+ `_replace` 이전 버그가 `session["name"]=path.name` 로 덮어써 **접두사가 복리로 쌓임**: `prestep_..._prestep_..._원본`). step2 류 VBA 는 `If wbIter.Name = "원본.xlsx"` **문자열 정확 비교**를 쓰는데, 별칭은 `Workbooks("name")` 호출만 치환하지 `.Name` 비교는 못 고친다 → wb.Name 이 임시명이라 못 찾음. 전체실행 격리경로는 `work/t/원본명` 으로 열어 wb.Name 이 깨끗 → 무사(비대칭).
  → **수정(Option A, 0.5.13/0.5.14):** `_replace_excel_session_workbook_impl` 이 스냅샷을 **원본 표시명(`_clean_session_workbook_name` 로 prestep_/uuid 접두사 복리 제거)으로 된 사본을 임시 dir 에 만들어 그 사본을 연다** → `wb.Name` = 원본명 항상 유지(+`session["name"]`/`path` 도 깨끗하게 → 재오픈·다음 격리실행도 깨끗, self-healing). 사본 dir 은 `session["replaceOpenDir"]` 로 추적해 다음 replace 에서 rmtree. (친절 메시지가 step5 "회계" 작업으로 오기된 건 `_pipeline_error_guide` 의 별개 휴리스틱 — 에러가 사라지면 무의미.)

### 3-d) 함정: handle_excel_replace 가 항상 name=path.name 을 넘긴다
Option A 1차 구현은 `clean_name = Path(name).name if name else _clean(...)` 였는데, **`handle_excel_replace`(serve_b2b.py:1223)가 항상 `name=path.name`(=prestep_ 접두사 붙은 결과파일명)을 넘긴다** → `if name` 지름길로 빠져 클린이 안 됐다(트레이스에서 b2b_replace_ 디렉토리는 생겼는데 그 안 파일이 여전히 prestep_ 접두사). → 최종: **`clean_name = _clean_session_workbook_name(name or session.get("name") or path.name)`** (name 도 항상 클린). 접두사 패턴은 우리 내부 마커라 사용자 파일명과 충돌 없음. **실제 코드 경로 검증**: 진짜 `_replace_excel_session_workbook_impl(excel_id, snap, name=snap.name)` 호출 시 wb.Name·session["name"] 모두 원본명 복원 + VBA식 Workbooks 순회 매칭 성공(실 Excel COM).

### 5) 회색창(VBA OFF 후): 라이브 프레임 페인트-전 표시
워크북 교체 직후(fast OFF→replace) 라이브 프레임을 페인트 전에 보여주면 그리드가 회색으로 남고, 다음 OFF(=다음 present)에서 자가복구됨. → replace 의 live 경로에 **프레임 강제 리페인트(win32gui.RedrawWindow INVALIDATE|ERASE|UPDATENOW) nudge** 추가(0.5.14, localized·additive·try-except). 미러 표시 로직 자체는 안 건드림([[mirror-active-sync-foreground]] 회귀 이력). 헤드리스 검증 불가 → 실측 확인 필요.

## 검증
- 양쪽 `py_compile` OK. `_test_isolated_pipeline_sequential_apply.js` 12/12(배치 1콜/혼합엔진/원자적 실패전파 + stepSnapshots→`_preApplySnapshot` wiring).
- **실측 확인 남음:** 저사양에서 0.5.14(또는 0.5.13)로 DAS 75단계 → SBAGENT-138 해소 + `pipeline.reset.persisted` 트레이스. 한화 5단계 → OFF/삭제가 "스냅샷 없음" 없이 빠른복구.

관련: [[no-build-until-asked]], lesson 33(정정됨), lesson 34(batch).
