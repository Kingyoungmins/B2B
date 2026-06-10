# ver0.5.2 Merge Plan

작성일: 2026-06-10  
현재 작업 브랜치: `ver0.5.2`  
비교 대상:

- `origin/ver0.5.0`: 1 Excel.exe + N workbook view 안정화 기준
- `origin/ver0.5.1`: Python 기본 엔진 / ixi Qwen3.6 프록시 / 적용 UX 보강 브랜치
- local `ver0.5.2`: `origin/ver0.5.0` 위에 0.5.1 유효 변경, Python COM 실험, UI busy lock, 오프라인/단일 exe 빌드 변경을 누적한 상태

주의: 본 문서는 분석/병합 제언이다. 실제 반영 범위는 README와 커밋 내역을 기준으로 확인한다.

## 최우선 방향

최종 통합의 기준은 `ver0.5.2`의 저사양 Windows PC 안정성이다.

- 탭 전환, Excel 포커스, workbook 표시, 종료/복구가 안정적으로 움직이는 것이 1순위다.
- `ver0.5.1`의 모델/프록시/적용 UX 개선은 최대한 흡수하되, 0.5.2의 안정화 구조를 흔드는 방식은 채택하지 않는다.
- Python 적용 방향은 Python COM을 우선한다. Python을 쓴다면 실제 떠 있는 Excel workbook을 COM으로 제어하되, 셀 단위 반복 COM 호출을 금지하고 bulk read/write 중심으로 효율화하는 경로를 기본 후보로 둔다.
- openpyxl은 기본 경로로 두기 어렵지만, merge 방향에 따라 live preview가 필요 없는 파일 전용 보조 경로로 남길 수 있다. 즉 Python은 우선 "Excel COM을 효율적으로 다루는 생성 언어 후보"로 검토한다.

## 브랜치 계보 요약

`ver0.5.0`과 `ver0.5.1`은 선형 관계가 아니다. 두 브랜치의 공통 조상은 `ver0.4.9`이고, 각각 다른 의도를 가진 실험/안정화 흐름이다.

```text
ver0.4.9
├─ ver0.5.0  : 1 Excel.exe + N workbook view 안정화, 오프라인 배포/검증 문서
│  └─ ver0.5.2(local): 단일 exe 전달용 오프라인 빌드 보강
└─ ver0.4.11 → ver0.4.12 → ver0.5.1
   └─ Python 기본 엔진, ixi Qwen3.6 프록시, Python 적용 후 Excel 표시 UX 보강
```

따라서 `ver0.5.1`을 `ver0.5.2`에 단순 merge하면 대규모 충돌과 의도 역전이 발생할 가능성이 높다. 특히 `ver0.5.0`에서 추가한 문서/검증/오프라인 빌드 파일이 `ver0.5.1` 관점에서는 삭제처럼 보인다.

통합 방향은 `ver0.5.1`을 기준으로 덮어쓰는 것이 아니라, `ver0.5.2`의 안정화 구조를 기준으로 두고 `ver0.5.1`의 유효한 변경을 선별 흡수하는 것이다. Python 관련 변경은 openpyxl 기본 엔진으로 받아들이지 않고, Python COM bulk 제어 방향으로 재해석한다.

## ver0.5.0 의도

`ver0.5.0`의 핵심은 Excel 표시 안정화다.

- 하나의 앱 소유 `EXCEL.EXE`가 여러 workbook을 보유하는 구조를 기준으로 정리
- UI 탭 전환 시 현재 workbook만 표시하고 나머지는 숨기는 show-only 방식
- 탭 클릭 직후 늦게 도착한 Excel polling/active-sync 응답이 이전 탭으로 되돌리는 현상 방지
- 여러 파일 로드 시 workbook 창을 순차 노출하지 않고, 준비 후 활성 workbook만 보여주는 흐름
- WebView2/NativeHost 포커스 가드로 첫 클릭 씹힘과 최소화/복원 꼬임 완화
- VBA 스킬 실행 대상 pinning, 채팅 비우기/이력 삭제/스크롤 UX 보강
- 폐쇄망 오프라인 빌드 문서, Python 엔진 리스크 문서, VBA 회귀 테스트 인프라 추가
- README에 수정 예정 이슈로 남긴 두 항목을 후속 통합 요구사항으로 유지
  - 서로 다른 workbook에서 스킬 저장/실행 시 대상이 꼬일 수 있는 문제
  - 채팅창 비우기 시 전체 새로고침처럼 보이는 문제

기술적으로 중요한 파일:

- `serve_b2b.py`
- `scripts/excel-mirror.js`
- `native_host/NativeHost.cs`
- `scripts/pipeline.js`
- `scripts/chat-ui.js`
- `scripts/llm-api.js`
- `OFFLINE_PORTABLE_BUILD.md`
- `PYTHON_ENGINE_RISKS.md`
- `tests/vba_regression/**`
- `docs/images/ver0.4.11-one-excel-n-workbook-view.png`

## ver0.5.1 의도

`origin/ver0.5.1`은 `ver0.4.12` 기반에서 다음 의도로 만들어진 브랜치다.

- 기본 스킬 엔진을 Python/openpyxl로 둠
- F7 또는 설정으로 Python/VBA 엔진 선택 가능
- ixi 기본 모델을 `Qwen3.6-27B-FP8`로 정리
- ixi 호출을 로컬 `/v1` 프록시 경유로 되돌림
- Think 제어 방식을 Qwen3.6/vLLM에 맞춰 `chat_template_kwargs` 기본으로 조정
- Python 적용 후 output/input 결과 파일 표시, 다운로드, 미러 refresh UX 보강
- 적용 전 현재 view를 캡처하고, 적용 후 임의로 active sheet/output으로 튀지 않도록 복원
- openpyxl 결과 파일을 기존 Excel 미러 세션에 replace/refresh하는 흐름 보강
- 테스트 데이터 및 0.4.13 계열 변경 기록 추가
- 버전 문자열을 `0.5.1`로 정리

단, 위 의도 중 "Python/openpyxl 기본 엔진"은 `ver0.5.2` 통합 방향에서는 그대로 채택하지 않는다. openpyxl은 실제 Excel 화면과 파일 상태가 분리되어 0.5.2의 핵심 목표인 live Excel 안정성, 탭 전환 일관성, 저사양 PC 체감 안정성과 충돌한다.

기술적으로 중요한 파일:

- `scripts/config.js`
- `scripts/llm-api.js`
- `scripts/model-modal.js`
- `scripts/backend-workbooks.js`
- `scripts/pipeline.js`
- `scripts/excel-mirror.js`
- `serve_b2b.py`
- `native_host/NativeHost.cs`
- `build_exe.bat`
- `build_single_exe.bat`
- `single_exe/B2BSingleExeLauncher.cs`
- `test_data/**`
- `tools/test_logic_0413.py`

## local ver0.5.2 의도

현재 local `ver0.5.2`는 `origin/ver0.5.0` 위에 안정화/모델/Python COM/배포 변경을 누적한 상태다.

대표 변경 파일:

- `native_host/NativeHost.cs`
- `build_exe_offline.bat`
- `OFFLINE_PORTABLE_BUILD.md`
- `serve_b2b.py`
- `scripts/excel-mirror.js`
- `scripts/pipeline.js`
- `scripts/chat-ui.js`
- `scripts/llm-api.js`
- `scripts/file-schema.js`
- `scripts/config.js`
- `single_exe/B2BSingleExeLauncher.cs`

의도:

- `ver0.5.0`의 1 Excel.exe + N workbook view 안정성을 기준으로 유지
- `ver0.5.1`의 Qwen3.6/vLLM 프록시, Think 제어, view restore 개념을 선별 이식
- Python COM bulk 실행 경로와 정적 게이트, VBA 1회 폴백을 검토/반영
- 작업 중 UI busy lock과 force-restart 복구 흐름을 통해 탭/Excel view 클릭 꼬임을 줄임
- 단일 exe 전달 요구는 payload wrapper와 NativeHost embedded runtime을 모두 검토하되, 현재는 payload wrapper를 기본 후보로 둠

## 주요 충돌 지점

### 1. Excel view 안정화 방식

`ver0.5.2`는 `ver0.5.0`의 안정화 의도 위에 단일 exe 배포 보강을 더한 현재 기준 방향이다.

- 단일 Excel 프로세스
- show-only active workbook
- inactive workbook 숨김
- active-sync mute
- delayed baseline polling
- WebView focus guard

`ver0.5.1`도 탭/미러 UX를 많이 고쳤지만, 기반은 `ver0.4.12` 계열이다. `scripts/excel-mirror.js`, `serve_b2b.py`, `native_host/NativeHost.cs`가 넓게 겹치므로 자동 merge 시 안정화 로직이 섞여 회귀할 수 있다.

제언:

- Excel 표시/탭 전환의 기준은 `ver0.5.2`를 유지한다.
- `ver0.5.1`의 UX 보강 중 `preserveFocus`, `syncSelection:false`, 적용 후 view restore 같은 개념만 선별 이식한다.
- `preopenAllExcelMirrors`, `switchVisibleExcelMirrorToFileId`, `restoreActiveExcelMirrorWindow`, `/api/excel/hide`, `/api/excel/replace`는 수동 병합 대상이다.

### 2. Python 적용 방향: COM bulk 제어 우선, openpyxl은 제한적 보조 후보

`ver0.5.1`은 Python/openpyxl 기본 엔진을 전제로 한다. 반면 `ver0.5.0/0.5.2`는 실제 Excel live view와 VBA/COM 경로의 정확도와 안정성에 집중했다.

위험:

- openpyxl은 실제 떠 있는 workbook과 파일 상태가 분리된다.
- 결과를 보이게 하려면 Excel 미러 replace/reload가 필요하다.
- 현재 show-only 단일 Excel 구조와 충돌하면 탭 전환 안정성이 다시 흔들릴 수 있다.
- 수식 계산, 차트/피벗/이미지/매크로 보존, 파일 lock 처리가 더 복잡해진다.
- 저사양 Windows PC에서는 openpyxl 저장 후 Excel reload/replace 비용이 체감 성능을 갉아먹을 수 있다.

제언:

- Python COM을 기본 후보로 둔다.
- openpyxl은 live preview가 필요 없는 배치성 파일 변환이나 별도 옵션으로만 제한 검토한다.
- Python COM 코드는 반드시 bulk read/write 중심이어야 한다. 예: Range.Value2로 2D 배열을 한 번에 읽고, Python 메모리에서 계산한 뒤 대상 Range.Value2로 한 번에 쓴다.
- 셀 단위 반복 COM 호출은 프롬프트/정적검사/런타임 가드로 금지한다.
- 기본 실행 경로는 0.5.2에서 안정성이 확인된 live Excel 구조를 유지한다. Python COM은 별도 엔진 후보로 설계하되, openpyxl처럼 파일 replace/reload를 전제로 하지 않는다.
- `ver0.5.1`의 F7/설정 토글 구조는 이식할 수 있으나, 기본 선택지는 `VBA`와 `Python COM` 중심으로 재정의한다. openpyxl을 남긴다면 "파일 전용/고급 옵션"으로 명확히 분리한다.

### 3. ixi/Qwen3.6 프록시 설정

`ver0.5.1`의 `scripts/config.js`는 다음 의도를 갖는다.

- ixi 모델: `Qwen3.6-27B-FP8`
- baseUrl: 로컬 `/v1` 프록시
- proxyUpstream: Violet/vLLM host
- Think control: `chat_template_kwargs`
- 이전 localStorage 설정 마이그레이션

이 변경은 `ver0.5.2`에도 유효하다.

제언:

- `scripts/config.js`, `scripts/model-modal.js`, `scripts/llm-api.js`의 모델/프록시/마이그레이션 변경은 우선 이식 후보로 둔다.
- 단, `NativeHost.cs`의 WebView2 `--disable-web-security` 추가는 보류 검토한다. README/코드 주석은 로컬 프록시 경유를 말하는데, WebView2 보안 비활성화는 직접 호출 허용 의도와 섞여 있다. 폐쇄망/운영 배포에서는 불필요한 보안 완화일 수 있다.

### 4. 적용 후 view restore

`ver0.5.1`은 Python 적용 후 현재 파일/시트/선택 상태를 캡처하고, 결과 적용 후 임의로 output이나 activeSheet로 튀지 않도록 복원하는 로직을 추가했다. 이 개념은 유효하지만, `ver0.5.2`에서는 openpyxl 결과 replace 전제가 아니라 live Excel/COM 적용 후 view 보존 개념으로 재해석한다.

유효한 개선:

- `captureBackendCurrentViewForApply`
- `chooseBackendRestoreView`
- `forceShowBackendResultMirror`
- `refreshExcelMirrorForFileId(..., { preserveFocus, raiseAfter })`
- `baselineExcelMirrorSession(..., { syncSelection:false })`

제언:

- 이 부분은 0.5.2의 show-only 구조와 궁합이 좋을 수 있다.
- 다만 `forceShowBackendResultMirror`가 `refresh/open/raise`를 직접 호출하므로, 0.5.2의 `showOnlyExcelMirrorWindow`, `activeSyncMutedUntil`, hidden state 관리와 연결해서 수동 병합한다.
- openpyxl replace/reload를 위한 refresh 로직은 그대로 채택하지 않는다. 필요한 경우 Python COM/VBA 적용 후 현재 view를 유지하거나, 결과 workbook 세션이 실제로 바뀌는 경우에만 제한적으로 사용한다.

### 5. 단일 exe 배포 방식

`ver0.5.1`에는 이미 `single_exe/B2BSingleExeLauncher.cs` 방식이 있다.

- 폴더형 패키지 전체를 `payload.zip`으로 만들고 wrapper exe에 포함
- 실행 시 `%TEMP%` 아래에 payload 전체를 풀고, 그 안의 `B2B_ver0.5.1.exe`를 실행
- 원본 폴더 구조를 그대로 보존하므로 네이티브 호스트 코드를 덜 건드린다

local `ver0.5.2` 방식:

- `NativeHost.cs` 자체가 embedded resource를 추출
- `B2B_Server.exe`, `node.exe`, WebView2 DLL만 `%LOCALAPPDATA%`에 풀어 실행
- wrapper 프로세스는 없지만 NativeHost가 더 복잡해진다
- 현재 Windows 실험에서 local `ver0.5.2`의 embedded single exe는 반복 오류가 보고되었으므로, 최종 기본안으로 바로 채택하지 않는다

제언:

- 최종 병합에서는 `ver0.5.1`의 payload wrapper 방식을 우선 검토한다. 이유는 native host 런타임 로직 침습이 작고, 폴더형 패키지와 동일한 실행 환경을 재현하기 쉽기 때문이다.
- 특히 동료 PC에서 "exe 파일 하나만 복사해도 실행되는" 방식이 필요하므로, wrapper가 payload 전체를 임시 폴더에 풀어 폴더형 실행 환경을 복원하는 접근이 현재 embedded resource 방식보다 현실적일 가능성이 높다.
- 다만 폐쇄망 offline build에서 단일 exe까지 한 번에 생성하는 요구는 local `ver0.5.2`의 `build_exe_offline.bat` 아이디어를 이식한다.
- local `ver0.5.2`의 NativeHost embedded runtime 방식은 원인 분석 전까지 대안으로만 둔다. 사용하려면 추출 경로, WebView2 DLL resolve, B2B_Server/node 실행 위치, 백신/권한/임시 파일 정리 문제를 Windows에서 별도 검증해야 한다.
- 즉 권장 방향은 다음과 같다.

```text
빌드 방식: ver0.5.2 offline build 흐름 유지/확장
단일 exe 구현: ver0.5.1 payload wrapper 우선
NativeHost 직접 resource 추출: wrapper 방식 검증 실패 시 대안, 현재는 기본안 보류
```

### 6. 문서/테스트 삭제 위험

`origin/ver0.5.1`을 `origin/ver0.5.0` 기준으로 diff하면 다음 파일들이 삭제처럼 보인다.

- `OFFLINE_PORTABLE_BUILD.md`
- `PYTHON_ENGINE_RISKS.md`
- `docs/images/ver0.4.11-one-excel-n-workbook-view.png`
- `tests/vba_regression/**`
- `tools/offline/**`

이는 `ver0.5.1`이 0.5.0 후속이 아니기 때문에 생긴 계보 문제다.

제언:

- 위 파일들은 삭제하지 않는다.
- `ver0.5.1`의 `README.md`, `CHANGES_claude.md`, `test_data/**`, `tools/test_logic_0413.py`는 문서/테스트 자산으로 추가 병합한다.
- `tools/offline/**`는 Git에 최소 드롭존/필수 소형 wheel만 유지하고, full offline runtime은 계속 `dist_transfer` 패키징 산출물로 관리한다.

### 7. 0.5.0 README의 수정 예정 이슈 반영

`ver0.5.0` README에는 아직 해결 예정으로 공유한 이슈가 두 개 있다. `ver0.5.2` 병합 계획에서는 이 둘을 단순 문서 잔여물이 아니라 통합 후속 작업의 필수 요구사항으로 유지한다.

1. 서로 다른 workbook에서 스킬 저장/실행 시 대상이 꼬일 수 있는 문제

   현재 일부 스킬 적용/재적용 경로에서는 UI 탭 전환이 완료되지 않은 상태로 스킬 적용이 가능한 상황이 남아 있다. 이 경우 사용자가 의도한 workbook과 실제 적용 대상 workbook이 어긋날 수 있다.

   통합 방향:

   - step 생성 시점의 target workbook/fileId를 명시적으로 보존한다.
   - 실행/재실행/토글/편집/append 경로 모두 target pinning을 거치게 한다.
   - 실행 직전 현재 탭 상태보다 pinned target을 우선한다.
   - target workbook 세션이 닫혔거나 캐시에서 유실된 경우 재오픈 후 적용한다.
   - 적용 후 UI 탭과 실제 Excel active workbook이 같은 대상을 가리키는지 검증한다.

2. 채팅창 비우기 시 전체 새로고침처럼 보이는 문제

   대화 기억 초기화는 chat history만 비워야 한다. 파일 목록, Excel 미러, 현재 탭, 선택 범위, pipeline 상태까지 과하게 다시 렌더링되면 사용자는 전체 앱이 새로고침된 것으로 느낀다.

   통합 방향:

   - chat history 초기화와 파일/Excel view refresh를 분리한다.
   - "대화 기억을 비웠습니다" 안내 메시지가 파일 로드 안내 메시지로 덮이지 않게 한다.
   - clear 후에도 currentFileId/currentSheet/selectedRange/pipeline은 유지한다.
   - clear 동작 중 Excel mirror restore/raise/show-only가 불필요하게 호출되지 않도록 한다.
   - R5에서 들어간 `cleared-marker` 계열 보호 로직이 0.5.1 변경과 충돌하지 않는지 확인한다.
   - 특히 채팅 비우기 후 Excel.exe 또는 열린 workbook 세션이 내려가거나 숨김 상태로 남는지 확인한다. 채팅 기록 삭제는 Excel 세션 정리와 연결되면 안 된다.

### 8. 추가 확인 이슈: 저사양 PC 기준 UI 응답성

다음 이슈는 0.5.2의 핵심 목표인 "저사양 Windows PC에서 안정적으로 움직이는 체감"에 직접 영향을 준다. 병합 범위에서 UI/UX 대개편을 하지는 않더라도, 원인 분석과 개선 가능성 검토를 필수로 포함한다.

1. 새로고침 또는 채팅 비우기 버튼 클릭 시 추가 알럿/확인창이 뜨며 버벅이는 문제

   현상:

   - 버튼 클릭 후 브라우저/WebView 기본 alert/confirm/prompt 또는 동기 modal이 뜨는 경우, 저사양 PC에서는 화면이 멈춘 것처럼 느껴진다.
   - 특히 Excel COM 작업이나 polling이 겹친 상태에서 alert가 뜨면 사용자는 오류가 난 것으로 인식할 수 있다.
   - 채팅 비우기 시 Excel.exe 또는 workbook 뷰가 함께 비워지는 것처럼 보인다는 제보가 있으므로, 확인창 자체뿐 아니라 clear 동작이 Excel 세션 정리와 연결되어 있는지도 함께 봐야 한다.

   검토 방향:

   - `alert`, `confirm`, `prompt`, `beforeunload` 등 동기 브라우저 modal 사용 경로를 전수 확인한다.
   - 새로고침/채팅 비우기 확인은 가능하면 비동기 toast, inline confirm, lightweight modal로 바꾼다.
   - 확인 UI가 뜨는 동안 Excel mirror polling, restore, hide/show 호출이 연쇄 실행되지 않도록 한다.
   - 채팅 비우기는 chat state만 초기화하고 Excel session, currentFileId, pipeline, selected range에는 영향을 주지 않게 분리한다.
   - 저사양 PC에서는 "확인창 표시 → 사용자가 누름 → 처리 시작"의 각 단계에 로딩/버튼 disabled 상태가 명확히 보이도록 하되, 전체 앱을 blocking하지 않는다.

2. 상단 workbook 탭과 UI 버튼 클릭이 1회에 먹지 않고 2회 클릭을 요구하는 문제

   현상:

   - Excel workbook 뷰 자체의 셀 클릭이 아니라, 앱 상단 workbook 탭, 좌측 UI 버튼, 채팅/스킬 관련 버튼에서 첫 클릭이 포커스 전환에 소비되는 느낌이 있다.
   - 현재 탭 전환 최적화 성능은 유지해야 하므로, 해결 과정에서 다시 강제 raise/position 호출을 늘리면 안 된다.

   검토 방향:

   - NativeHost 활성화 시 WebView focus 선점 로직이 실제로 모든 복귀 경로에서 작동하는지 확인한다.
   - Excel owned/top-level window가 foreground인 상태에서 WebView 영역을 클릭할 때, 첫 클릭을 앱이 정상 이벤트로 받는지 확인한다.
   - 상단 workbook 탭 클릭은 `mousedown/pointerdown` 단계에서 target fileId를 먼저 기록하고, `click`이 누락되어도 전환 요청이 유실되지 않는 구조를 검토한다.
   - 버튼류는 비활성 WebView → 활성 WebView 전환 직후에도 첫 pointer event가 실제 버튼 handler에 닿도록 focus guard 또는 capture-phase handler를 검토한다.
   - 기존 탭 전환 최적화(`show-only`, active-sync mute, delayed baseline polling)는 유지하고, 클릭 안정화 때문에 `position/raise/show-only` 왕복을 늘리지 않는다.
   - UI 클릭 처리와 Excel mirror restore를 분리한다. UI 클릭 직후 Excel restore가 WebView 포커스를 다시 빼앗지 않게 한다.

   검증 기준:

   - Excel 셀을 클릭한 직후 좌측 UI 버튼을 한 번 눌러도 동작하는가
   - Excel 셀을 클릭한 직후 상단 workbook 탭을 한 번 눌러도 탭이 전환되는가
   - 채팅 입력창/전송/비우기/스킬 적용 버튼이 첫 클릭에서 반응하는가
   - 이 개선 후에도 workbook 탭 전환 속도와 show-only 안정성이 유지되는가

### 9. 추가 확인 이슈: Excel/COM 오류 복구 계약

스킬 적용 실패, Python COM/VBA 실행 오류, Excel COM 세션 끊김, workbook 창 숨김, workbook 미노출은 사용자가 보기에는 모두 "엑셀이 사라짐" 또는 "앱이 멈춤"으로 느껴진다. 0.5.2의 안정화 목표에서는 오류 발생 자체보다 오류 이후 복구 가능성이 중요하다.

복구 계약:

- 스킬 적용 전에는 현재 UI 탭, 실제 Excel active workbook, selected range, pipeline 상태, pinned target fileId를 스냅샷으로 저장한다.
- 적용 실패 시 실패한 step 이후의 적용을 중단하고, 가능하면 실패 전 visible workbook과 selected range를 복원한다.
- Excel COM object가 invalid/disconnected 상태이면 기존 세션을 폐기 표시하고, pinned target 또는 현재 탭 workbook을 재오픈한다.
- workbook이 열려 있으나 hidden/minimized/offscreen 상태로 남으면 show-only 복구 루틴으로 현재 대상 workbook만 다시 표시한다.
- Excel.exe가 살아 있지만 응답하지 않거나 `Responding=False`이면 즉시 반복 COM 호출을 하지 않고 사용자에게 복구 버튼 또는 재시도 버튼을 제공한다.
- 복구 중에는 WebView 버튼을 과도하게 막지 않고, "복구 중/재오픈 중/실패" 상태를 toast 또는 inline status로 보여준다.
- 복구 실패 시에도 파일 목록과 pipeline state를 잃지 않아야 한다. 사용자가 앱을 재시작하지 않고 같은 파일을 다시 열 수 있어야 한다.

필수 복구 시나리오:

- 스킬 적용 도중 VBA/Python COM 코드가 예외를 던진 뒤 현재 workbook이 다시 보이는가
- pinned target workbook 세션이 닫힌 상태에서 토글/재적용 시 재오픈 후 올바른 workbook에만 적용되는가
- Excel 창이 숨김 상태로 남은 뒤 다른 탭 클릭 또는 복구 버튼으로 다시 표시되는가
- 채팅 비우기/새로고침/실행 실패가 Excel 세션 종료와 연결되지 않는가
- 복구 후 UI 선택 탭, Excel active workbook, selected range 표시가 같은 대상을 가리키는가

## 권장 병합 전략

### 1단계: 기준은 `ver0.5.2`

현재 안정적으로 테스트 중인 `ver0.5.2`를 기준으로 둔다.

보존 우선:

- 1 Excel.exe + N workbook view 구조
- show-only 탭 전환
- active-sync mute
- WebView focus guard
- 스킬 target pinning / 채팅 UX 보강
- 오프라인 빌드 문서와 Python 리스크 문서
- VBA 회귀 테스트 인프라

### 2단계: 0.5.1에서 낮은 충돌 항목부터 이식

`origin/ver0.5.1`은 통째로 merge하지 않는다. `ver0.5.2`를 기준으로 두고 기능 단위로 수동 이식하거나, 충돌 위험이 낮은 작은 변경만 선별 cherry-pick한다. 각 단계 후에는 문법 검사와 Windows smoke test를 끊어서 수행한다.

우선 이식 후보:

- 버전 문자열/빌드명 정리. 단, 최종 버전은 `0.5.2` 또는 다음 합의 버전으로 통일
- `scripts/config.js`의 Qwen3.6 / proxyUpstream / settings migration
- `scripts/model-modal.js`의 네트워크/모델 설정 UI 보강
- `scripts/llm-api.js`의 Qwen3.6 Think 제어 및 reasoning loop 방어
- README의 0.5.1 변경 설명과 `CHANGES_claude.md`

이식 순서:

1. 모델/프록시/설정 마이그레이션처럼 Excel view와 직접 충돌하지 않는 변경
2. 적용 후 view restore처럼 0.5.2 show-only 구조에 연결해야 하는 변경
3. 테스트 데이터/문서/리포트 자산
4. 단일 exe/오프라인 빌드 정리

이 순서를 지키는 이유는 `ver0.5.2`의 저사양 PC 안정성을 최우선으로 보존하기 위해서다. 탭 전환, focus guard, show-only, active-sync mute를 건드리는 변경은 마지막까지 수동 검토한다.

### 3단계: 적용 후 view restore 이식

수동 병합 후보:

- `scripts/backend-workbooks.js`
- `scripts/pipeline.js`
- `scripts/excel-mirror.js`
- `serve_b2b.py`의 result refresh/replace 관련 함수

검증 기준:

- 스킬 적용 후 현재 탭이 임의로 output으로 튀지 않는가
- 결과 파일이 열린 상태에서 replace 후 show-only 상태가 유지되는가
- 적용 실패/취소 후 Excel 창이 사라지지 않는가
- active-sync mute가 적용 후 restore와 충돌하지 않는가

### 4단계: Python은 COM bulk 엔진 우선으로 별도 설계

Python/openpyxl 기본 전환은 현재 live Excel UX와 충돌 가능성이 크므로 기본값으로 채택하지 않는다. Python을 쓰는 경우에는 실제 Excel COM workbook을 직접 제어하는 경로를 우선 검토하고, openpyxl은 파일 전용 보조 경로로 남길지 별도 판단한다.

권장:

- 1차 병합에서는 `ver0.5.2`의 안정 엔진을 기본값으로 유지한다.
- F7/설정 토글은 이식하되, `python` 옵션은 openpyxl이 아니라 `Python COM` 의미로 재설계한다.
- Python COM 프롬프트에는 "Range 단위 bulk read/write, 셀 단위 COM loop 금지, Excel 계산/화면 갱신 제어"를 명시한다.
- 생성 코드는 명시적인 target workbook/fileId를 받아야 하며, wrapper가 보장한 경우를 제외하고 `ActiveWorkbook`에 의존하지 않는다.
- `.Select`/`.Activate`는 사용자가 보는 workbook 전환 wrapper에서만 제한적으로 허용하고, 데이터 처리 로직 내부에서는 금지한다.
- 수식이 있는 셀은 쓰기 전에 Formula/HasFormula 맵을 확인하고, 사용자 요청이 명확하지 않으면 값으로 덮어쓰지 않는다.
- 대량 데이터는 Python list/tuple 기반 2D 배열로 메모리에서 처리한 뒤 `Range.Value2`에 한 번에 쓴다.
- UsedRange 전체를 무조건 다시 쓰는 방식은 금지한다. 대상 범위와 출력 범위를 명시적으로 좁힌다.
- 정적 검사에는 `.Cells(r,c).Value = ...` 형태의 대량 반복 쓰기, 행 단위 COM 반복, `for` 루프 내부 COM write를 감지하는 규칙을 추가한다.
- 런타임에는 ScreenUpdating/Calculation/EnableEvents 제어와 finally 복구를 강제한다.
- `PYTHON_ENGINE_RISKS.md`는 openpyxl의 live UX 리스크와 Python COM bulk 설계 체크리스트를 함께 설명하는 방향으로 갱신한다.

필수 테스트:

- 수식 셀 유지/다운로드 후 계산
- 숨김 열/행 유지
- 병합셀 구조 복사
- 여러 workbook input/output 참조
- 입력 파일 수정 후 다운로드
- output template 적용 후 현재 탭 유지
- 대용량 workbook에서 COM bulk write와 셀 단위 COM loop의 성능 차이 측정
- Python COM 실행 실패 후 Excel 창/탭/selection 복구
- Python COM 실행 중 계산/화면 갱신 제어가 finally에서 원복되는지 확인

### 5단계: 단일 exe 배포 정리

권장 흐름:

1. `build_exe_offline.bat`는 유지한다.
2. offline build에서도 단일 exe 산출물을 만들도록 한다.
3. 단일 exe 구현은 우선 `single_exe/B2BSingleExeLauncher.cs` wrapper 방식으로 통일한다.
4. wrapper 방식이 폐쇄망/보안 정책에서 막히면 local `ver0.5.2`의 NativeHost embedded runtime 방식을 대안으로 검토한다.
5. 현재 local `ver0.5.2` embedded single exe는 Windows에서 오류가 반복되므로, 원인 확인 전에는 최종 배포 기준으로 삼지 않는다.
6. wrapper 방식 채택 시에도 임시 추출 경로, 중복 실행, stale payload 정리, 백신 오탐, 로그 위치를 별도 점검한다.

산출물명 예시:

```text
dist\B2B_ver0.5.2\
dist\B2B_ver0.5.2_portable.zip
dist\B2B_ver0.5.2_single.exe
```

### 6단계: 0.5.0 수정 예정 이슈와 추가 사용감 이슈 해결 확인

병합 후 최종 수동 테스트에 다음 두 시나리오를 반드시 포함한다.

- A workbook에서 만든 스킬을 B workbook 탭으로 이동한 뒤 실행/토글/편집 재적용해도 A에만 적용되는가
- 채팅창 비우기 후 파일 목록, 현재 Excel 탭, 선택 범위, pipeline이 유지되고 전체 새로고침처럼 보이지 않는가
- 채팅 비우기/새로고침 확인 UI가 저사양 PC에서 앱 오류처럼 버벅이지 않는가
- 채팅 비우기 후 Excel.exe/workbook 세션이 닫히거나 숨김 상태로 유실되지 않는가
- Excel 뷰를 클릭한 직후 상단 workbook 탭과 좌측 UI 버튼이 첫 클릭에서 바로 동작하는가
- 클릭 안정화 후에도 현재 탭 전환 성능, show-only 표시, active-sync mute 동작이 유지되는가
- 스킬 적용 실패 또는 COM 오류 후 현재 workbook이 복구되고, 복구 실패 시 사용자가 재오픈/재시도를 할 수 있는가
- Python COM 실행 경로가 도입될 경우 `ActiveWorkbook` 의존, `.Select/.Activate` 남용, 셀 단위 COM loop, 수식 덮어쓰기를 차단하는가

## 병합 시 피해야 할 것

- `origin/ver0.5.1`을 통째로 merge해서 0.5.0 문서/테스트를 삭제하는 것
- `serve_b2b.py`와 `scripts/excel-mirror.js`를 자동 conflict resolution으로 처리하는 것
- Python/openpyxl을 live Excel UX와 동기화 정책 없이 기본값으로 켜는 것
- Python COM을 셀 단위 반복 호출 방식으로 생성하게 두는 것
- WebView2 보안 비활성화 옵션을 목적 검증 없이 운영 기본으로 넣는 것
- `NativeHost.cs`에 단일 exe resource 추출 방식과 wrapper 방식을 동시에 중복 적용하는 것
- 현재 오류가 반복되는 local `ver0.5.2` embedded single exe 방식을 원인 분석 없이 기본 배포 방식으로 확정하는 것
- 채팅 비우기/새로고침 확인을 브라우저 동기 alert/confirm에 의존하는 것
- UI 첫 클릭 문제를 해결하기 위해 매 클릭마다 Excel window raise/position을 강제로 늘리는 것

## 제안 결론

최종 방향은 다음 순서가 가장 안전하다.

1. `ver0.5.2`를 기준 브랜치로 유지한다.
2. 0.5.2의 저사양 Windows PC 안정성, 탭 전환, 단일 Excel view 구조를 최우선 보존한다.
3. `ver0.5.1`의 모델/프록시 설정, README/테스트 자산, 적용 후 view restore 개념을 선별 이식한다.
4. 0.5.0 README의 수정 예정 이슈인 workbook target pinning 보강과 채팅 비우기 새로고침 문제를 통합 요구사항으로 반영한다.
5. 저사양 PC에서 새로고침/채팅 비우기 확인 UI와 UI 첫 클릭 씹힘 문제를 별도 사용감 안정화 과제로 포함한다.
6. Python 적용은 Python COM bulk 제어 엔진을 기본 후보로 재설계하고, openpyxl은 merge 방향에 따라 파일 전용 보조 경로로만 제한 검토한다.
7. Excel/COM 오류 복구 계약을 추가해, 스킬 실패/COM 끊김/창 숨김 후에도 현재 workbook을 재표시하거나 재오픈할 수 있게 한다.
8. `origin/ver0.5.1`은 통째로 merge하지 않고, 모델/프록시 설정 → view restore → 테스트/문서 → 패키징 순서로 기능 단위 이식한다.
9. 단일 exe는 `ver0.5.1`의 payload wrapper를 우선 채택하고, `ver0.5.2`의 offline build 자동 생성 요구를 붙인다. 현재 local embedded single exe는 오류 원인 확인 전까지 대안으로만 둔다.
10. 0.5.0의 문서/리스크/검증 인프라는 보존하고, `PYTHON_ENGINE_RISKS.md`는 openpyxl live UX 리스크 + Python COM bulk 설계 기준으로 갱신한다.

이렇게 가면 0.5.2에서 실제로 안정화된 탭 전환 체감과 저사양 PC 운용성을 유지하면서, 0.5.1의 모델/프록시/적용 UX 개선을 단계적으로 흡수할 수 있다. Python은 파일 편집 엔진이 아니라 live Excel을 더 효율적으로 제어하는 선택지로만 가져간다.
