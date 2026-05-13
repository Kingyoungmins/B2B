# B2B 빌링 Agent ver3.31

엑셀 입력 파일과 출력 템플릿을 업로드한 뒤, AI가 생성한 JavaScript 로직을 단계별 파이프라인으로 실행해 결과 xlsx를 만드는 로컬 웹앱입니다.

브라우저에서 동작하는 SPA와 로컬 Python HTTP 서버로 구성되어 있으며, `/v1/*` 요청은 로컬 OpenAI-compatible Qwen 모델 서버로 프록시됩니다. F9 개발자 모드에서는 Claude API를 선택해 테스트할 수 있습니다.

## 최근 변경사항

### ver3.31
- `/v1/*` 프록시 기본 대상을 사내 violet 서버가 아니라 로컬 Qwen 서버 `http://127.0.0.1:8080`으로 변경했습니다.
- `KGM_VLLM_BASE` 환경변수를 지정하면 기존처럼 다른 OpenAI-compatible 서버 주소로 덮어쓸 수 있습니다.
- Ubuntu/Linux 실행용 `start_kgm.sh`를 추가했습니다. Ubuntu에서는 EXE나 `index.html` 직접 열기가 아니라 이 스크립트 또는 `python3 launch_kgm.py`로 로컬 프록시 서버를 먼저 띄워야 합니다.
- UI 제목과 EXE 빌드 이름을 ver3.31로 갱신했습니다.
- EXE 빌드 결과 파일명은 `KGM_B2B_ver3.31.exe`입니다.

### ver3.3
- API 요청에 보낼 채팅 기록에 sliding window를 적용했습니다.
- 저장/화면에 보이는 전체 대화 기록은 유지하되, 모델 호출 시에는 최근 메시지 최대 18개와 약 32,000자까지만 전송합니다.
- 오래 사용한 채팅에서 입력 토큰이 계속 커져 응답이 느려지거나 context limit에 걸리는 문제를 줄였습니다.
- EXE로 실행한 브라우저 창을 닫으면 로컬 서버 프로세스도 자동 종료되도록 브라우저 heartbeat 기반 종료 처리를 추가했습니다.
- 엑셀 미리보기/분리 창에서 Ctrl+click 다중 선택, Shift+click 범위 선택, 선택 범위별 채팅 참조 고정을 지원합니다.
- 분리된 엑셀 시뮬레이터에서 직접 셀을 편집해도 메인 파이프라인에 수동 편집 단계로 반영되도록 정리했습니다.
- UI 제목과 EXE 빌드 이름을 ver3.3로 갱신했습니다.
- EXE 빌드 결과 파일명은 `KGM_B2B_ver3.3.exe`입니다.

### ver3.2
- ixi/OpenAI-compatible 모델 호출에 스트리밍 응답을 적용했습니다.
- 채팅 응답을 기다리는 동안 전체 완료를 기다리지 않고 수신되는 토큰을 실시간으로 표시합니다.
- 로컬 `/v1/*` Python 프록시도 응답을 한 번에 버퍼링하지 않고 chunk 단위로 브라우저에 전달합니다.
- 공백 차이를 무시하는 문자열 치환 헬퍼 `replaceNormalizedText(value, from, to)`를 추가했습니다. 예: `2월`, `2 월`, `2   월`을 모두 `3월`로 바꿀 수 있습니다.
- UI 제목과 EXE 빌드 이름을 ver3.2로 갱신했습니다.
- EXE 빌드 결과 파일명은 `KGM_B2B_ver3.2.exe`입니다.

### ver3.1
- AI 로직 생성 프롬프트에 `코드 작성 원칙`을 추가했습니다.
- 요청받은 작업만 수행하고 이전 단계 작업을 반복하지 않도록 명시했습니다.
- 단일 작업에 불필요한 추상화, 설정, 범용 헬퍼를 만들지 않도록 제한했습니다.
- 전체 시트 순회 전에 대상 시트, 헤더, 행, 열을 먼저 좁히도록 안내했습니다.
- 파일/시트/범위가 불명확할 때는 현재 선택된 대상을 우선 사용하고, 그래도 모호할 때만 질문하도록 정리했습니다.
- 수정 모드에서도 관련 코드만 바꾸고 기존 단계의 다른 동작을 임의로 리팩터링하지 않도록 별도 규칙을 추가했습니다.
- UI 제목과 EXE 빌드 이름을 ver3.1로 갱신했습니다.
- 듀얼 모니터 사용을 위해 엑셀 시뮬레이터를 별도 창으로 분리하는 기능을 추가했습니다.
- 분리 창은 메인 창과 미리보기 상태를 동기화하며 파일/시트 탭 전환, 스크롤, 셀 직접 편집을 지원합니다. 분리 중에는 메인 창의 기존 시뮬레이터를 숨기고, 분리해제로 다시 복구할 수 있습니다.

### ver3
- 기본 AI 모델을 ixi 모델로 고정했습니다. 새 창을 열 때 이전 Claude 설정이 남아 있어도 상단 라벨은 `AI: ixi 모델`로 시작합니다.
- F9 개발자 모드에서 Claude를 명시적으로 선택하고 저장한 경우에만 현재 실행 중인 창에서 `AI: Claude`로 전환됩니다.
- 문자열 검색용 `normalizeText(value)` 헬퍼를 추가했습니다. `"안전제일"`과 `"안전 제일"`처럼 공백만 다른 값도 같은 값으로 비교할 수 있습니다.
- AI 프롬프트에 `String(cell).includes(...)` 대신 `normalizeText(cell).includes(normalizeText(...))` 패턴을 사용하도록 안내를 추가했습니다.
- LLM 호출 모듈을 `llm-api.js`로 정리하고, ixi/OpenAI-compatible 호출과 Claude 호출을 함께 관리합니다.
- 로직 저장/불러오기, 멘션, 직접 셀 편집, undo/redo, runner 화면 관련 ver3 모듈을 포함합니다.

### ver2 기반 기능
- 파일명, 시트명, 컬럼명 유사도 매칭
- 여러 시트 선택 및 현재 선택 범위 기반 AI 컨텍스트
- 시트 내 여러 표 후보 감지
- 대용량 시트 가상 스크롤
- Ctrl+F 검색
- 수식 재계산 미리보기
- 단계별 실행 오류 표시

## 실행 방법

### Ubuntu/Linux 실행

Qwen OpenAI-compatible 서버가 먼저 떠 있어야 합니다.

```text
http://127.0.0.1:8080/v1/chat/completions
```

그 다음 앱은 `index.html`을 직접 열지 말고 로컬 Python 서버로 실행합니다.

```bash
chmod +x start_kgm.sh
./start_kgm.sh
```

또는:

```bash
python3 launch_kgm.py
```

기본 주소:

```text
http://127.0.0.1:8090/index.html
```

포트가 사용 중이면 `18090`부터 `18095`까지 자동 fallback 합니다.

AI 연결 설정의 Base URL은 Qwen의 `8080`이 아니라 KGM 프록시 주소를 사용합니다.

```text
http://127.0.0.1:8090/v1
```

AI 연결 설정 값:

```text
Provider: Qwen 로컬
Base URL: http://127.0.0.1:8090/v1
API Key: local
Model: Qwen3.6
```

Ubuntu 서버를 다른 PC 브라우저에서 접속해야 하면 다음처럼 바인딩 주소를 열고 실행합니다.

```bash
KGM_HOST=0.0.0.0 KGM_LAUNCH_HOST=<Ubuntu_IP> ./start_kgm.sh
```

브라우저에서는:

```text
http://<Ubuntu_IP>:8090/index.html
```

### Windows 실행

```bat
start_kgm.bat
```

또는:

```bat
python launch_kgm.py
```

### Windows EXE 빌드

```bat
build_exe.bat
```

빌드 결과:

```text
dist\KGM_B2B_ver3.31.exe
```

`dist/`와 `build/`는 git 추적 대상이 아닙니다.

## 환경 변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `KGM_PORT` | `8090` | 로컬 서버 포트 |
| `KGM_HOST` | `127.0.0.1` | 서버 바인딩 주소 |
| `KGM_LAUNCH_HOST` | `127.0.0.1` | 브라우저에서 여는 주소 |
| `KGM_VLLM_BASE` | `http://127.0.0.1:8080` | `/v1/*` 프록시 대상 |
| `KGM_NO_BROWSER` | 없음 | `1`이면 브라우저 자동 실행 안 함 |
| `KGM_LOG_REQUESTS` | 없음 | `1`이면 HTTP 요청 로그 출력 |

## 주요 기능

### 입력/출력 파일
- 입력 파일 여러 개 업로드: `.xlsx`, `.xls`, `.csv`
- 출력 템플릿 여러 개 업로드: `.xlsx`, `.xls`
- 시트별 미리보기와 현재 선택 범위 관리
- 엑셀 시뮬레이터 우측 상단의 `분리` 버튼으로 미리보기를 별도 창에 표시
- 원본 xlsx의 스타일과 수식을 최대한 보존해 다운로드

### AI 로직 생성
- 기본 모델은 로컬 Qwen 모델입니다.
- 일반 설정 버튼에서는 Qwen/OpenAI-compatible 연결 정보를 노출합니다.
- F9 개발자 모드에서 Claude provider를 선택할 수 있습니다.
- AI는 `function transform(inputs, output) { ... return { inputs, output }; }` 형태의 JavaScript 코드를 생성합니다.

### 파이프라인
- AI가 만든 로직을 단계별로 적용, 수정, 삭제, 비활성화할 수 있습니다.
- 셀 직접 편집도 파이프라인 단계로 기록됩니다.
- 전체 실행 시 원본 입력/출력 상태에서 모든 단계를 순서대로 재실행합니다.
- 실행 실패 시 어느 단계에서 실패했는지 메시지와 stack을 표시합니다.

### 문자열/유사도 매칭
AI 생성 코드에서 사용할 수 있는 헬퍼:

```javascript
col(sheetAoA, "회사명")
findColumnGlobal(inputs, "회사명")
similarity("안전제일", "안전 제일")
normalizeText("안전 제일")
replaceNormalizedText("2월 데이터", "2 월", "3월")
```

행이나 셀을 찾을 때 권장 패턴:

```javascript
normalizeText(cell).includes(normalizeText("안전제일"))
```

이 패턴은 공백, 줄바꿈, 탭, 대소문자 차이를 제거해 비교합니다.

### 저장/불러오기
- 로직 파이프라인을 zip으로 저장합니다.
- zip 안에는 `.logic.json` 매니페스트와 단계별 `.js` 파일이 포함됩니다.
- 저장된 대화 기록도 함께 복원됩니다.

## 디렉터리 구조

```text
B2B_ver3.31/
├─ index.html
├─ styles/
│  ├─ base.css
│  ├─ layout.css
│  ├─ panels.css
│  ├─ components.css
│  ├─ chat.css
│  ├─ pipeline.css
│  ├─ workflow.css
│  └─ runner.css
├─ scripts/
│  ├─ config.js
│  ├─ state.js
│  ├─ util.js
│  ├─ history.js
│  ├─ fuzzy.js
│  ├─ formula-engine.js
│  ├─ table-detect.js
│  ├─ sheet-ops.js
│  ├─ file-parsing.js
│  ├─ drop-handling.js
│  ├─ excel-viewer.js
│  ├─ search.js
│  ├─ file-schema.js
│  ├─ llm-api.js
│  ├─ disambiguate.js
│  ├─ chat-ui.js
│  ├─ mentions.js
│  ├─ pipeline.js
│  ├─ output-template.js
│  ├─ save-load.js
│  ├─ menu.js
│  ├─ resizer.js
│  ├─ model-modal.js
│  └─ main.js
├─ vendor/
│  ├─ xlsx.full.js
│  └─ pretendard-variable.woff2
├─ test_data/
├─ serve_kgm.py
├─ launch_kgm.py
├─ launch_kgm.spec
├─ start_kgm.bat
└─ build_exe.bat
```

## 개발 메모

- JS 파일은 `index.html`의 script 로딩 순서에 의존합니다. 새 모듈을 추가하면 의존하는 파일보다 뒤에 배치해야 합니다.
- `launch_kgm.spec`는 `styles/`, `scripts/`, `vendor/` 전체를 EXE에 포함합니다.
- AI가 생성한 로직은 브라우저에서 `new Function(...)`으로 실행됩니다. 신뢰하지 않는 로직 파일은 불러오지 마세요.
- API key는 브라우저 `localStorage`에 저장됩니다. 코드에 실제 키를 하드코딩하지 마세요.
