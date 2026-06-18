# B2B 0.5.8 — VBA "전체실행" 매크로 실행 실패 조사 리포트
(작성: 디버깅 세션 전체 히스토리 정리 / Codex 인수인계용)

---

## 1. 증상

- **VBA 스텝이 포함된 스킬을 "전체실행"하면 실패.** 주입한 임시 러너 워크북의 매크로가 실행 안 됨:
  ```
  'b2b_vba_runner_*.xlsm'!Module1.B2B_RunSkill' 매크로를 실행할 수 없습니다.
  이 통합 문서에서 사용할 수 없는 매크로이거나 모든 매크로를 사용하지 못할 수 있습니다.
  COM HRESULT = -2146827284 (DISP 내부코드)
  ```
- 중간에 **"띠링" 소리 + VBA 디버그/오류 창이 0.1초 떴다 사라짐**(debug suppressor가 닫음).
- **채팅에서 스킬을 "적용"(단일적용)하면 정상 동작.** Python(ctx) 스텝도 정상.
- **VBA 스텝을 자동 전체실행할 때만** 실패. 사용자 표현: "한 단계씩 수동 실행은 되는데, 그걸 자동으로 연결한 전체실행만 에러."

## 2. 환경

- 같은 PC(`c:\Users\Admin`, 빠른 PC). 앱 = `B2B_NativeHost.exe`(C# WebView2) → 자식으로 `python serve_b2b.py`(백엔드) → win32com 으로 Excel 제어.
- 우측에 실제 Excel을 띄워 **오버레이(SetParent/owner로 WebView 패널에 임베드)**로 보여줌.
- 업로드 2개(.xlsx, 이메일/다운로드 파일이라 MOTW=Zone.Identifier 있음). 작업복사본은 `shutil.copy2`로 만들어 MOTW는 떨어짐.
- 스킬: `KB국민카드완성 스킬…zip` = **Python → VBA → VBA → Python** 4스텝(전부 출력 파일 대상). 단일 스킬(1 VBA 스텝)로도 동일 실패.
- 파일명: `KB카드_메시지_요금정산_26년06월_DSMC_260608.xlsx`, `KB국민카드 … 26년 05월_LGU .xlsx`(LGU 뒤 공백; 디스크는 `LGU%20.xlsx`, 업로드 시 공백으로 열림 → VBA 참조와 일치, 정규화 OK).

## 3. 핵심 결정적 사실 (실제 실패 앱에 진단 로깅 심어 확보)

1. **실패 지점은 주입이 아니라 `Application.Run`.** `B2B_RunSkill` 모듈은 정상 추가됨(=AccessVBOM OK). 실행만 차단.
2. **`FRESH_INSTANCE_PROBE: OK(=7)`** — 앱 프로세스 안에서 **새 DispatchEx Excel(유저 파일 안 엶)**은 트리비얼 매크로를 **정상 실행**.
3. **유저 .xlsx를 연 인스턴스(라이브든, 격리든)** → 러너 매크로 **실행 불가**. 한 인스턴스 내에서 **재시도해도 모두 동일 실패(결정적).**
4. **standalone 재현(셸 python, 같은 PC·파일·`serve_b2b` 함수 그대로)** → 러너 매크로 **항상 성공**, 4스텝 파이프라인 값까지 정확(B367 "07월", C371:E373 수식보존+0, B369 LGU복사).
5. 실패해도 결과가 거짓 성공으로 보고되기도(매크로 중단으로 B2B_LastErrNumber=0) → "적용됨"인데 실제 미반영 케이스 존재.
6. **매크로를 막을 만한 설정이 전부 "허용"인데도 실패**(아래 §6) → **더 이상 매크로 보안 문제가 아님**.

**한 줄 요약**: 같은 PC·같은 코드·같은 파일인데 **standalone(오버레이 없음)은 100% 되고, 앱(NativeHost+WebView+오버레이)이 유저 파일을 연 인스턴스에서만 매크로 실행이 막힌다.** 권한 설정으론 해결 안 됨.

## 4. 조사 히스토리 (가설 → 검증 → 결과)

| # | 가설 | 검증 | 결과 |
|---|---|---|---|
| 1 | `excel_workbooks_open`의 `AutomationSecurity=ForceDisable(3)`가 매크로 차단 | 실제 Excel `_repro_runner_macro.py`(AutoSec=3 vs 1) | 내 환경에선 3에서도 **OK**. 단독 원인 아님 |
| 2 | 파이프라인 구조 자체 문제 | `_repro_pipeline.py`(격리 세션 + reset=True 4스텝) | **4/4 PASS, 값 정확**. 재현 실패 |
| 3 | reset(`_copy_source_workbook_into_target`)가 라이브 인스턴스 오염 | 동일 reset 포함 재현 | standalone에선 **PASS** |
| 4 | 임베드(SetParent WS_CHILD) 창을 park하면 매크로 wedge | 더미 창 SetParent+park 재현 | **펌프 안 하는 부모창**일 때만 HANG(테스트 아티팩트). **펌프하는 부모창**(WebView 모방)이면 OK → 가설 기각 |
| 5 | 창 detach/restore로 해결 | app 프레임 detach, _restore_live_window | **실패**(SDI라 임베드된 건 워크북 창; restore도 무효) |
| 6 | NativeHost 자식·콘솔없음 프로세스 컨텍스트 | `_launch_noconsole.py`(CREATE_NO_WINDOW+파이프) | **PASS**. 프로세스 컨텍스트 아님 |
| 7 | 라이브 인스턴스만 문제 → 격리 새 인스턴스에서 실행+sync-back | `_run_vba_pipeline_on_session_impl` 격리 재작성 | 앱에선 **격리 인스턴스도 실패**(유저 파일 열면 동일) |
| 8 | run 직전 `AutomationSecurity=Low` | `_inject_and_run_vba_in_host` | **실패**(이미 차단된 인스턴스는 안 돌아옴) |
| 9 | `excel_workbooks_open`을 Low로 열기 | line 1406 | **실패** |
| 10 | 간헐 race → 재시도 | `_run_vba_via_runner_with_retry` | **세션 내 4/4 동일 실패**(결정적) |
| 11 | `VBAWarnings=1`(모든 매크로 사용) 미설정이 원인 | `_ensure_vbom_access`에 추가 | **실패** |
| 12 | Codex 정적게이트 자동복구가 매번 VBA 재생성(느림+코드 갈아치움) | preflight 자동복구를 VBA 파이프라인에서 스킵 | 느림은 개선, 매크로 실패는 그대로 |
| 13 | 러너를 Excel **신뢰 위치(Trusted Location)**에서 실행 | `_ensure_runner_trusted_location` + 고정폴더 생성 | **실패** |
| 14 | 기업 매크로 차단 정책/ASR | 레지스트리 직접 확인 | **차단 정책/ASR 전무** |

## 5. "단일적용은 되고 전체실행은 안 됨"의 코드 경로 차이

- **단일적용(채팅 '적용')**: `applyVbaStepToLiveExcel` → `POST /api/excel/run-vba {excelId, code}` → `_run_vba_on_session_impl` → `_ensure_companion_workbooks` → `_inject_and_run_vba`(.xlsx면 임시 .xlsm 러너) → `Application.Run`. **동작함.**
- **전체실행**: `btn-run` → `runPipelineWithAutoRepair` → `reapplyVbaPipelineToLive` → (현재 수정본) **VBA 포함이면 각 스텝을 위 단일 엔드포인트로 순차 호출**. **실패함.**
- 즉 백엔드 호출은 동일(`_run_vba_on_session_impl`). 차이는 프론트 프리프(ensurePinnedVbaTargetExcelId의 `setCurrentView` 탭전환, hideAllExcelMirrorWindows, mute 등 오버레이/창 조작)와 **그 시점 Excel 인스턴스의 창/UI 상태**뿐. 단독 재현엔 오버레이가 없어 못 잡힘.

## 6. 현재 레지스트리/환경 상태 (전부 "허용")

```
HKCU\…\Office\16.0\Excel\Security\AccessVBOM = 1
HKCU\…\Office\16.0\Excel\Security\VBAWarnings = 1   (모든 매크로 사용)
HKCU\…\Excel\Security\Trusted Locations\B2BRunner:
    Path = %TEMP%\b2b_runner_trusted\ , AllowSubFolders = 1
HKCU\…\Excel\Security\Trusted Locations\AllLocationsDisabled = 0
HKCU\…\VBA\7.1\Common\BreakOnAllErrors = 0
HKLM/HKCU 정책 키: 없음   blockcontentexecutionfrominternet: 없음   Defender ASR: 없음
```
→ **매크로 실행을 막을 표준 메커니즘이 모두 꺼져 있는데도 "매크로를 실행할 수 없습니다"가 남.**

## 7. 현재 코드 변경 (적용된 상태)

- `serve_b2b.py`
  - `excel_workbooks_open`: `AutomationSecurity` 3→**1(Low)**.
  - `_ensure_vbom_access`: AccessVBOM + **VBAWarnings=1** + `_ensure_runner_trusted_location()` 호출.
  - `_ensure_runner_trusted_location` / `_b2b_runner_trusted_dir`(신규): 러너 폴더를 신뢰 위치로 등록.
  - `_create_vba_runner_workbook`: 러너를 **신뢰폴더(`%TEMP%\b2b_runner_trusted\`) 하위**에 생성.
  - `_inject_and_run_vba_in_host`: run 직전 AutomationSecurity=Low(+finally 복원). 실패 로그에 **host(러너 경로)+autosec** 기록.
  - `_run_vba_via_runner_with_retry`: macro-blocked 시 러너 새로 만들어 **2회** 재시도.
  - `_run_vba_pipeline_on_session_impl`: 격리 인스턴스 실행+sync-back으로 재작성(+`_setup_isolated_pipeline_instance`). ※ 현재 VBA는 프론트가 단건 호출로 우회하므로 이 함수는 주로 Python전용/리셋에 쓰임.
  - 진단 로깅: `_diag_vba_log_line`(VBA-OK/RUNTIME-ERR/RUN-EXC/RUNNER-RETRY), `_diag_prerun_window_state`. **정리(제거) 필요.**
- `scripts/pipeline.js`
  - `reapplyVbaPipelineToLive`: **VBA 포함 파이프라인은 reset 없이 각 스텝을 단일 엔드포인트로 순차 실행**(Python전용은 기존 번들+reset 유지).
  - `runPipelineWithAutoRepair`: **VBA 포함이면 정적게이트 자동복구(실행 전 재생성) 스킵** + **macro-blocked 런타임 에러는 자동복구 안 하고 즉시 실패**.

## 8. 확정 결론

**매크로 권한 문제 아님(전부 허용).** **자동 전체실행이 Excel 인스턴스를 "매크로 실행 불가" 런타임 상태로 만드는 문제** — 앱의 오버레이/창 조작 + 유저 파일 오픈이 결합된 그 인스턴스에서만 `Application.Run`이 거부됨. 수동 단일적용은 그 상태를 안 만들어서 됨. standalone(오버레이 없음)은 항상 됨.

## 9. 다음 액션 (Codex용)

1. **라이브 Excel 인스턴스 직접 introspection**: 전체실행 실패 직후, 그 EXCEL.EXE에서 `Application.Run` 거부 시점의 상태 확인 — `Application.Interactive`, `Application.Ready`, 활성 모달, VBProject 컴파일 상태, 창 부모/스타일(GetParent/WS_CHILD), 그리고 무엇보다 **그 통합문서가 신뢰 위치로 인식되는지**(러너 경로 vs 등록 경로 정확 일치, trailing `\`). 같은 PC라 Codex가 라이브로 볼 수 있음.
2. **오버레이 조작 분리**: VBA 실행 구간 동안 프론트의 `hideAllExcelMirrorWindows`/`setCurrentView`/SetParent 등 창 조작을 멈추거나, 매크로 실행을 창이 안정된 상태에서만 하도록.
3. **마지막 로그 1줄 확인**: `vba_runner_fail.log`의 `VBA-RUN-EXC host=... autosec=...` — 러너가 `b2b_runner_trusted\…`에 있는데도 실패면 신뢰위치/권한 무관(=인스턴스 상태) 확정.

## 10. 재현/검증 자산 (test_runs/)
- `_repro_pipeline.py`(격리+syncback), `_repro_perstep.py`(per-step 단일적용), `_repro_runner_macro.py`(AutoSec 비교), `_repro_setparent*.py`(SetParent 임베드), `_launch_noconsole.py`(CREATE_NO_WINDOW). **전부 standalone에선 PASS** = 앱 런타임 컨텍스트만 미재현.
- 로그: `B2B_ver0.5.8/vba_runner_fail.log`.

---

## 11. 2026-06-17 Codex 후속 조사 최신화

> 이 섹션이 최신 결론이다. 위 1~10장은 Claude 코드/초기 조사 기준의 히스토리이며, 당시에는 "Excel 인스턴스가 매크로 실행 불가 상태가 된다" 쪽으로 결론이 기울어져 있었다. 이후 Codex가 실제 성공/실패 로그를 대조하면서 원인을 더 좁혔다.

### 11.1 최종 재현 패턴

- 사용자가 불러온 저장 스킬을 `전체실행` 또는 스킬 실행기에서 돌리면 VBA 1단계짜리 스킬도 실패했다.
- 같은 내용을 채팅에 다시 입력해서 생성된 VBA를 단일 적용하면 성공했다.
- 한 번 전체실행 실패 후 에러복구에서 같은 VBA로 다시 적용하면 성공하는 경우도 확인됐다.
- 따라서 이 문제는 Excel 매크로 보안 설정이 영구적으로 막은 것이 아니었다. 같은 PC, 같은 Excel, 같은 파일, 같은 작업이 다른 실행 payload/경로에서만 갈렸다.

### 11.2 핵심 원인 정정

초기에는 `Application.Run` 자체가 전체실행 시점의 Excel UI 상태/오버레이 때문에 막힌다고 봤다. 후속 로그에서 더 결정적인 원인이 확인됐다.

1. 저장된 스킬 payload가 순수 VBA 코드가 아니었다.
   - `// test_...`
   - `// Step 1 ...`
   - `Created ...`
   - `[정확 참조]`
   - `제목: ...`
   이런 설명/주석/메타 텍스트가 `Sub B2BSkill()` 앞에 섞여 들어왔다.
2. 채팅 단일 적용은 생성 직후 코드 블록을 비교적 깨끗하게 실행했지만, 저장 스킬 전체실행은 저장된 step code를 그대로 서버 주입에 넘겼다.
3. 서버가 이 오염된 문자열을 VBA 모듈에 주입하면, 실제 `Sub B2BSkill()`이 있어도 컴파일/등록 상태가 깨져 `B2B_RunSkill 매크로를 실행할 수 없습니다` 형태로 보였다.
4. Excel은 이 에러를 보안/매크로 차단 문구처럼 던지기 때문에 사용자는 "콘텐츠 사용/매크로 보안" 문제처럼 보게 된다. 하지만 실제로는 저장 스킬 코드 정규화 및 전체실행 경로 문제였다.

### 11.3 결정 로그

`vba_pipeline_trace.jsonl`에서 실제 성공 케이스가 확인됐다.

- `http.run_vba_pipeline.request`
  - step code head에 `// test_...`, `// Step 1...`, `Created...` 같은 설명 텍스트가 `Sub B2BSkill` 앞에 존재.
- `vba.code.normalized`
  - `beforeLen: 881`
  - `afterLen: 791`
  - `changed: true`
  - 즉 서버가 실제 VBA 본문만 추출해 정규화함.
- `vba.macro.ref.ok`
- `vba.macro.run.ok`
- `pipeline.step.ok`
- `http.run_vba_pipeline.response`
  - `ok: true`
  - `applied: 1`

이후 KB 4단계 혼합 파이프라인도 확인됐다.

- `http.run_vba_pipeline.response`
  - `ok: true`
  - `applied: 4`
- VBA와 Python step이 섞인 저장 스킬도 같은 격리 파이프라인 안에서 순서대로 처리됐다.

### 11.4 적용한 실제 패치

#### 서버 쪽 `serve_b2b.py`

- VBA 주입 직전 `_extract_vba_source_for_injection(code, entry)`를 추가했다.
- 역할:
  - fenced ```vba 코드 블록 우선 추출
  - `Sub ... End Sub` 본문만 보수적으로 추출
  - `//`, `#`, `제목:`, `[정확 참조]`, 일반 설명 텍스트가 `Sub B2BSkill()` 앞에 있어도 제거
- `_inject_and_run_vba()`가 이 정규화 이후의 코드만 주입한다.
- `/api/excel/run-vba-pipeline` 요청/응답/정규화/모듈 참조/매크로 실행 결과를 `vba_pipeline_trace.jsonl`에 JSONL로 남긴다.
- 기존 `vba_runner_fail.log`는 과거 실패 기록이 남아 있을 수 있으므로, 최신 판단은 `vba_pipeline_trace.jsonl`의 traceId와 timestamp를 우선 본다.

#### 프론트 파이프라인 `scripts/pipeline.js`

- VBA가 하나라도 포함된 전체실행은 공통적으로 `/api/excel/run-vba-pipeline` 격리 파이프라인을 탄다.
- 생성기 전체실행, 스킬 실행기 전체실행, 자동복구 후 재실행, on/off, 삭제, undo/redo 재적용 경로를 같은 함수로 모았다.
- Python COM + VBA 혼합 파이프라인도 언어별로 분리하지 않고 같은 파이프라인에서 순서를 유지한다.
- 마지막 VBA step을 OFF 하거나 삭제해 enabled step이 0개가 되는 경우도 `steps: []`, `reset: true`로 원본 복원만 수행한다. "아무것도 안 함"이 아니다.
- 탭 전환/오버레이 조작을 실행 직전에 억지로 넣지 않도록 정리했다.

#### 에러복구 `scripts/chat-ui.js`

- VBA 실패 후 에러복구가 Python ctx로 바뀌는 흐름을 막았다.
- 실패 step이 VBA 신호(`Sub B2BSkill`, `VBA 실행 실패`, `B2B_RunSkill`, `매크로`)를 포함하면 복구도 VBA로 유지한다.

### 11.5 반드시 지킬 재발 방지 규칙

1. `채팅 단일 적용은 성공`, `전체실행/실행기만 실패`면 Excel 보안설정부터 의심하지 않는다.
2. 먼저 저장 스킬 payload가 순수 실행 코드인지 본다. 설명, 제목, 정확참조, 주석이 실행 코드 앞에 섞여 있을 수 있다.
3. VBA 포함 전체실행을 개별 `/api/excel/run-vba` 반복 호출로 되돌리지 않는다.
4. 공통 기준은 `/api/excel/run-vba-pipeline`이다.
5. 실행기, 생성기, on/off, 삭제, undo/redo가 서로 다른 적용기를 쓰면 같은 문제가 재발한다.
6. 서버 주입 직전에는 항상 실제 `Sub ... End Sub`만 추출/정규화한다.
7. 오류 메시지에 `매크로를 실행할 수 없습니다`, `B2B_RunSkill`, `b2b_vba_runner_*.xlsm`가 보여도, 그것만으로 보안 문제라고 단정하지 않는다.
8. 성공 판정은 화면 토스트가 아니라 trace 로그의 `vba.macro.run.ok`와 `http.run_vba_pipeline.response ok:true`로 확인한다.
9. Python COM + VBA 혼합 스킬은 순서가 중요하므로 각 엔진을 따로 리셋/실행/복사하면 안 된다.
10. 마지막 step OFF/삭제는 원본 복원이어야 한다. 그렇지 않으면 UI는 꺼졌는데 Excel 값은 남는 유령 상태가 된다.

### 11.6 검증 결과

- `node --check scripts\pipeline.js`: PASS
- `node --check scripts\chat-ui.js`: PASS
- `python -m py_compile serve_b2b.py`: PASS
- `git diff --check`: PASS
- 로컬 정적 테스트 `tests\vba_regression\tests_local\test_python_static_checks.py`: 13 passed / 0 failed
- `tests\vba_regression\tests_local\test_python_exec_verifier.py`는 현재 fixture 시트명(`월별실적`, `회사별요약`)이 없어 실패했다. 이번 VBA 전체실행 패치의 문법/빌드 차단 사유는 아니다.
- 포터블 빌드: PASS
  - `dist\B2B_ver0.5.8\B2B_ver0.5.8.exe`
  - `dist\B2B_ver0.5.8\B2B_Server.exe`
  - `dist\B2B_ver0.5.8_portable.zip`
- single exe 빌드: PASS
  - `dist\B2B_ver0.5.8_single.exe`

### 11.7 Git 반영

- 코드 패치 커밋:
  - `b33bd69 fix: stabilize v0.5.8 live pipeline execution`
- README 재발 방지 기록 커밋:
  - `4a61128 docs: record v0.5.8 VBA pipeline lessons`
- 원격:
  - `origin/ver0.5.8`에 푸시 완료

### 11.8 다음에 같은 문제가 나오면 볼 순서

1. `vba_pipeline_trace.jsonl` 최신 timestamp를 찾는다.
2. 실패 trace에서 `vba.code.normalized`가 찍혔는지 확인한다.
3. `changed: true`인데 이후 `vba.macro.run.ok`면 저장 payload 오염은 정상 보정된 것이다.
4. `vba.macro.ref.fail`이면 모듈 주입/컴파일/엔트리포인트 등록 문제다.
5. `vba.macro.run.error`면 코드 런타임 문제다. 이때만 step 코드 자체를 본다.
6. trace에 `/api/excel/run-vba`가 보이면 잘못된 경로를 탄 것이다. VBA 포함 전체실행은 `/api/excel/run-vba-pipeline`이어야 한다.
7. 단일 적용만 성공하고 실행기만 실패하면 `runner-run-btn`이 `runPipelineWithAutoRepair({ source: "runner" })`를 통해 같은 공통 함수를 타는지 확인한다.
