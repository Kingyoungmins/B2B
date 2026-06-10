# ver0.5.2 IDEA

작성일: 2026-06-10

이 문서는 `ver0.5.2`에서 검토/반영 중인 구현 아이디어를 정리한다. 기준은 `ver0.5.0`의 저사양 Windows PC 안정성과 1 Excel.exe + N workbook view 구조이며, `ver0.5.1`의 모델/프록시/Python 적용 아이디어는 기능 단위로 선별한다.

## 1. Python COM Qwen 코드 최적화

Python을 적용하더라도 핵심은 "파일을 따로 열어 저장하는 Python"이 아니라, 현재 화면에 떠 있는 Excel workbook을 정확하고 빠르게 제어하는 것이다. 따라서 기본 후보는 Python COM + bulk API다.

### 권장 실행 모델

- Qwen은 `def transform(ctx):` 형태의 Python 코드를 생성한다.
- 생성 코드는 `ctx`가 제공하는 제한된 API만 사용한다.
- `ctx.read(...)`, `ctx.write(...)`, `ctx.range_values(...)`처럼 범위 단위로 읽고 쓴다.
- Python 메모리에서 목록/딕셔너리/2D 배열을 계산한 뒤, Excel COM에는 최소 횟수로 반영한다.
- `.Select`, `.Activate`, `ActiveWorkbook`, 셀 단위 `.Cells(r, c).Value` 반복은 금지 또는 강한 경고 대상이다.
- `ScreenUpdating`, `Calculation`, `EnableEvents` 같은 Excel 상태 변경은 try/finally로 반드시 복구한다.

### Qwen3.6-FP8 생성 안정화

Qwen3 계열은 temperature가 지나치게 낮은 준-greedy 설정에서 같은 줄을 반복하거나 장황한 코드를 생성할 수 있다. 특히 FP8 양자화 모델은 이 증상이 더 잘 드러날 수 있으므로 다음 조합을 둔다.

- no-think: temperature 0.7, top_p 0.8
- think: temperature 0.6, top_p 0.95
- top_k 20
- presence_penalty 1.5
- reasoning 루프 감지 시 no-think로 1회 자동 폴백

프롬프트에는 간결성 규칙을 둔다.

- 단순 작업은 2~6줄 수준으로 끝낸다.
- 보통 작업도 10~40줄을 목표로 한다.
- 같은 블록을 반복 출력하지 않는다.
- 불필요한 방어 코드, 범용 헬퍼, 전체 시트 순회는 피한다.

정적 게이트는 다음을 차단한다.

- 동일 줄 8회 이상 반복
- 150줄 초과 코드
- `win32com`, `openpyxl`, `os`, `sys`, `subprocess` 직접 사용
- `ws["A1"]`, `load_workbook`, `ws.cell(...)` 같은 openpyxl 관용구
- `.Select`, `.Activate`, `ActiveWorkbook` 남용
- 셀 단위 COM 쓰기 루프

Python 게이트를 3회 연속 통과하지 못하면 같은 사용자 요청을 VBA 프롬프트로 1회 재생성한다. 이 폴백은 해당 호출에만 적용하며 전역 엔진 설정은 바꾸지 않는다. VBA도 막히면 다시 Python으로 되돌리지 않고 최종 차단한다.

### openpyxl의 위치

openpyxl은 완전히 배제된 기술로 보지 않는다. 다만 현재 제품의 핵심 UX가 "우측에 떠 있는 실제 Excel workbook이 곧 현재 상태"라는 점 때문에 기본 경로로 두기 어렵다.

선택지는 머지 방향에 따라 달라질 수 있다.

- 기본 경로: Python COM으로 live Excel을 직접 제어한다.
- 보조 경로: live preview가 필요 없는 배치성 파일 변환에서만 openpyxl을 제한적으로 허용한다.
- 폴백 경로: openpyxl이 차트, 피벗, 이미지, 매크로, 수식 계산, 파일 잠금과 충돌할 경우 Excel COM/VBA로 전환한다.
- 운영 정책: openpyxl 사용 시에는 "화면에 보이는 workbook과 파일에 저장된 workbook이 다를 수 있음"을 명확히 감지하고, replace/reload가 필요한 작업으로 분리한다.

즉 Python 적용의 핵심은 Python 자체가 아니라, Qwen이 생성한 코드가 Excel COM을 bulk 방식으로 안전하게 쓰도록 제한하는 것이다.

## 2. 작업 중 UI 상호작용 잠금

저사양 Windows PC에서는 Excel 로드, 탭 전환, 스킬 적용, 초기화, 복구가 진행되는 중에 사용자가 다른 버튼이나 workbook 탭을 누르면 포커스/세션/polling 상태가 꼬일 수 있다. 그래서 작업 중에는 UI가 "기다려야 하는 상태"임을 명확히 보여주고, 위험한 입력을 차단하는 계층이 필요하다.

### 잠금 대상

- 상단 workbook 탭
- 우측 Excel view 영역
- 파일 드래그앤드랍
- 보기/다운로드/삭제 버튼
- 스킬 파이프라인 토글/삭제/편집 버튼
- 코파일럿 입력/전송 버튼
- 초기화, 채팅 비우기, 복구 버튼

### 권장 동작

- 짧은 작업은 120~180ms 지연 후 busy 표시를 띄워 불필요한 깜빡임을 줄인다.
- 긴 작업은 overlay와 작업명을 표시한다.
- Excel view와 workbook 탭은 pointer/wheel/drop/click을 차단한다.
- 스킬 적용 중에는 "중단" 버튼만 예외적으로 허용한다.
- 중단은 이미 실행 중인 COM/VBA 루프를 세밀하게 중단하는 기능이 아니라, 앱 소유 Excel 세션을 force-restart하는 비상 복구로 정의한다.

### 중단 버튼의 한계

COM/VBA가 Excel 내부 for-loop에 들어간 뒤에는 브라우저 UI가 즉시 그 코드를 끊을 수 없다. 가능한 현실적 대응은 다음이다.

- 적용 시작 전 UI를 잠근다.
- 생성 코드에서 셀 단위 루프를 줄이도록 게이트를 둔다.
- 서버 요청 timeout과 job 상태를 둔다.
- 너무 오래 걸리면 force-restart로 Excel 세션을 재시작한다.
- 재시작 후 현재 탭 workbook을 다시 표시하고, 실패한 스킬은 중단 상태로 남긴다.

## 3. 초기화/채팅 비우기 알럿 후 멈춤

현재 저사양 PC에서 초기화 또는 채팅 비우기 확인 버튼을 누른 직후 UI가 멈춘 것처럼 보이는 이슈가 있다. 원인은 하나로 보기 어렵고, 다음 요인이 겹칠 수 있다.

- 브라우저의 blocking `confirm`/`alert`가 WebView 포커스를 잠시 빼앗는다.
- 동시에 Excel COM polling 또는 force-restart가 진행되면 UI 응답이 늦게 돌아온다.
- 채팅 비우기가 chat history만 지워야 하는데 Excel 상태 갱신/재초기화와 엮이면 workbook이 내려가는 것처럼 보인다.
- force-restart가 HTTP 응답을 잡은 채 taskkill/생존 확인을 동기로 수행하면 사용자는 앱이 멈췄다고 느낀다.

### 수정 방향

- blocking confirm 대신 앱 내부 경량 확인 모달 또는 inline confirm을 사용한다.
- 확인 클릭 직후 busy 상태를 표시하고, 버튼은 중복 클릭을 막는다.
- 채팅 비우기는 chat history만 초기화하며 파일/Excel 세션은 건드리지 않는다.
- 비우기 후 안내 메시지는 `cleared-marker` 같은 마커로 구분해 파일 로드 안내가 다시 덮어쓰지 않게 한다.
- force-restart는 즉시 HTTP 응답을 반환하고, taskkill/생존 확인은 백그라운드로 수행한다.
- COM 참조 해제는 UI 요청 경로에서 직접 기다리지 않고 graveyard로 넘겨 교착 가능성을 낮춘다.
- 앱이 생성한 Excel PID만 추적해 정리하고, 사용자가 직접 띄운 개인 Excel은 종료하지 않는다.

### 검증 항목

- 채팅 비우기 후 Excel workbook이 그대로 남아 있는가.
- 초기화 확인 후 UI가 즉시 돌아오는가.
- 초기화 후 앱 소유 `EXCEL.EXE`와 `B2B_Server.exe`가 고아로 남지 않는가.
- 확인 모달을 띄운 상태에서 workbook 탭/Excel view 클릭이 상태를 꼬지 않는가.
- 실패 후 복구 버튼 또는 자동 복구가 현재 탭 workbook을 다시 보여주는가.

## 4. 병합 원칙

`ver0.5.1`을 직접 merge하기보다 기능 단위로 수동 이식한다.

권장 순서:

1. 모델/프록시/Qwen 샘플링 설정
2. Python COM 프롬프트와 정적 게이트
3. live Excel 재적용/토글 경로 일반화
4. UI busy lock과 force-restart 복구 계약
5. view restore와 stale refresh 정책
6. 단일 exe 패키징 방식
7. README/리스크 문서/회귀 체크리스트

우선순위는 항상 저사양 Windows PC 안정성이다. 탭 전환, Excel 포커스, workbook 표시, 초기화/종료가 흔들리는 변경은 기능이 좋아도 기본값으로 두지 않는다.

## 5. 남은 결정

- openpyxl을 완전히 제거할지, 파일 전용 보조 경로로 남길지 결정해야 한다.
- 단일 exe는 payload wrapper를 기본으로 둘지, NativeHost embedded runtime을 계속 실험할지 결정해야 한다.
- 작업 중 UI lock 범위를 전체 앱으로 할지, Excel view/workbook 탭 중심으로 제한할지 사용자 테스트가 필요하다.
- 스킬 적용 중 중단 버튼은 graceful cancel이 아니라 emergency restart임을 UI에서 어떻게 표현할지 정해야 한다.
