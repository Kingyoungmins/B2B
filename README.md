# B2B 빌링 Agent — ver1.2

엑셀 입력 파일과 출력 템플릿을 받아 AI(Claude 또는 사내 ixi 모델)와의 대화로 로직을 설계하고, 결과 xlsx를 원본 양식 그대로 보존해 다운로드하는 데스크톱 웹앱.

브라우저에서 실행되는 SPA + 로컬 HTTP 서버 + vLLM 프록시 구조이며, EXE로 단일 실행 파일 배포가 가능합니다.

---

## 최근 변경사항

> 자세한 항목은 [CHANGELOG.md](CHANGELOG.md) 참고.

### ver1.2 (로직 파이프라인 편집 강화)
- **로직 중간 삽입** — AI 응답에 `↳ 삽입` 버튼 추가. 팝업으로 단계 위치(1 ~ N+1)를 입력해 원하는 자리에 끼워넣을 수 있다. 더 이상 중간 단계 수정을 위해 전체를 지울 필요 없음
- **로직 인라인 수정** — 파이프라인 항목의 `✎` 버튼으로 특정 단계만 수정 모드 진입. 수정 모드에서 채팅하면 그 단계의 **현재 코드 + 직전 데이터 상태**가 LLM에 함께 전달되어 의도 파악이 쉬워진다. 응답의 `✓ 수정 적용` 으로 단계 코드만 교체

### ver1.1.1 (개발자 모드 추가)
- **F9 히든 개발자 모드** — 설정 모달을 dev 모드로 열어 Claude API 직접 호출 옵션 노출. 사용자가 API 키를 직접 입력
- **Claude 모델 선택** 드롭다운 (기본 `claude-opus-4-7`)
- anthropic 설정 localStorage에 영속화

### ver1.1 (vs ver1)
- **모듈화**: 3.4MB 단일 `sym2.html` → CSS 8개 / JS 16개 모듈 + slim `index.html`
- **Bundler 제거**: base64+gzip 압축으로 묶여 있던 SheetJS·Pretendard를 [vendor/](vendor/)에 평문 파일로 분리. 런타임 unpacker 코드 제거
- **중복 코드 정리**: `setupResizer` IIFE가 두 번 정의되어 있던 부분을 1회로 통합
- **빌드 spec**: `styles/`, `scripts/`, `vendor/` 폴더의 모든 파일을 PyInstaller가 자동으로 collect

---

## 사용법

### 1. 개발 모드 (Python 설치 환경)

```bat
start_kgm.bat
```

- `python launch_kgm.py`를 실행해 [serve_kgm.py](serve_kgm.py)가 8090 포트에서 정적 파일 서빙 + `/v1/*` 경로를 vLLM(canvas) 서버로 프록시
- 브라우저에서 `http://127.0.0.1:8090/index.html` 자동 오픈
- 코드 수정 후 새로고침하면 즉시 반영 (서버 재시작 불필요)

환경 변수:

| 변수 | 기본값 | 설명 |
|---|---|---|
| `KGM_PORT` | `8090` | 서버 포트 (점유 시 `18090–18095` 자동 fallback) |
| `KGM_HOST` | `127.0.0.1` | 바인딩 주소 |
| `KGM_VLLM_BASE` | `http://canvas-ns-...violet.uplus.co.kr` | `/v1/*` 프록시 대상 |
| `KGM_NO_BROWSER` | — | `1`이면 브라우저 자동 오픈 안 함 |
| `KGM_LOG_REQUESTS` | — | `1`이면 정적 요청 로깅 |

### 2. EXE 빌드 (배포용)

```bat
build_exe.bat
```

- PyInstaller 미설치면 자동 설치
- 결과물: `dist/KGM_업무망.exe` (Python 없는 PC에서도 단독 실행)
- spec 직접 수정 시: `pyinstaller --clean launch_kgm.spec`

### 3. EXE 실행

`dist/KGM_업무망.exe` 더블클릭 → 자동으로 로컬 서버 기동 + 브라우저에 앱 표시.

---

## 현재 기능

### 📥 입력 / 출력 파일
- 입력 파일 다중 업로드 (`.xlsx` / `.xls` / `.csv`, 드래그앤드롭 또는 클릭)
- 출력 템플릿 업로드 (`.xlsx` / `.xls`, 1개)
- 시트별 자동 파싱, 셀 스타일 보존
- 우측 패널에서 실시간 엑셀 미리보기 (파일 탭 / 시트 탭 전환)

### 🤖 AI 로직 설계 (③ 패널)
- Claude API (`claude-sonnet-4-5-20250929` 등) 또는 사내 ixi 모델(OpenAI-compatible) 선택
- 자연어로 단계별 로직 요청 → AI가 JS 코드 생성
- 단계별 코드 미리보기, 적용/거부 선택

### 🔧 로직 파이프라인 (④ 패널)
- 적용한 단계가 누적되어 파이프라인 구성
- 단계 순서 변경 / 삭제 / 비활성화
- "▶ 전체 실행"으로 입력 파일에 순차 적용 → 출력 템플릿에 결과 채움

### 📥 출력 xlsx 다운로드
- 원본 출력 템플릿의 셀 스타일·병합·서식 그대로 보존
- 결과 데이터만 셀 값으로 주입

### 💾 저장 / 불러오기
- 현재 로직 파이프라인을 zip/json으로 저장
- 저장본을 불러와 다른 입력 파일에 재사용

### 🚀 로직 실행기 (러너 페이지)
- 입력·템플릿·로직 파일을 4단계 삼각형 UI에 드롭하면 한 번에 실행
- 실행 후 우측에 결과 시뮬레이터 표시

### 🎛️ 환경
- AI 모델 설정 모달 (provider, apiKey, model, baseUrl) — ⚙ 버튼
- **F9: 히든 개발자 모드** — Claude API 직접 호출 옵션 노출 (개발자 테스트용)
- 좌우 패널 너비 드래그 조절 (더블클릭 시 기본값 복원, localStorage에 저장)
- 메뉴 드로어로 페이지 전환 (생성기 ↔ 러너)
- 패널 헤더 클릭으로 섹션 접기/펼치기

### 🔐 개발자 모드 (F9)
일반 사용자는 `⚙ AI 모델 설정` 버튼으로 ixi 모델만 사용. 개발자는 `F9` 키로 설정 모달을 열면 추가로 Claude provider 옵션이 보입니다.

- Provider 토글: ixi / Claude
- Claude API Key 입력 (사용자가 직접 입력, 로컬 `localStorage`에만 저장)
- 모델 드롭다운: `claude-opus-4-7`(기본), `claude-opus-4-7[1m]`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`
- Base URL 변경 가능 (기본 `https://api.anthropic.com/v1`)
- "🔌 연결 테스트" 버튼이 provider에 맞춰 ping 요청 수행

---

## 디렉토리 구조

```
B2B_ver1.2/
├── index.html              # slim shell — link/script 태그로 모듈 조립
├── styles/                 # CSS 8개 (base/layout/panels/components/chat/pipeline/workflow/runner)
├── scripts/                # JS 16개 (config/state/util/file-parsing/drop-handling/excel-viewer/
│                           #         file-schema/claude-api/chat-ui/pipeline/output-template/
│                           #         save-load/menu/resizer/model-modal/main)
├── vendor/                 # SheetJS xlsx.full.js, Pretendard variable woff2
├── launch_kgm.py           # 로컬 서버 기동 + 브라우저 오픈
├── serve_kgm.py            # SimpleHTTPServer + /v1/* vLLM 프록시
├── launch_kgm.spec         # PyInstaller 빌드 스펙
├── build_exe.bat           # EXE 빌드 자동화
├── start_kgm.bat           # 개발 모드 실행
├── CHANGELOG.md            # 버전별 변경 내역
└── README.md               # 이 파일
```

---

## 개발 가이드

### 파일을 새로 추가할 때
- CSS 새 모듈: `styles/`에 `.css` 추가 → [index.html](index.html)의 `<link>` 목록에 등록
- JS 새 모듈: `scripts/`에 `.js` 추가 → [index.html](index.html)의 `<script>` 목록에 의존 순서대로 등록 (상위 모듈에서 정의된 함수/상수는 하위에서 참조 가능)
- 외부 라이브러리: `vendor/`에 추가 → index.html의 `<head>`에 `<script>` 추가

### 빌드 spec 수정
[launch_kgm.spec](launch_kgm.spec)의 `collect()` 헬퍼가 `styles/`, `scripts/`, `vendor/` 모든 파일을 자동 수집합니다. 새 폴더를 만들면 `datas` 리스트에 `*collect('새폴더')`만 추가하면 됩니다.

### API 키 관리
[scripts/config.js](scripts/config.js)의 `DEFAULTS.anthropic.apiKey`는 비어 있습니다. 사용자가 ⚙ 모델 설정 모달에서 입력 → `localStorage`(`mvno_llm_settings_v1`)에 저장. 코드에 키를 직접 박지 마세요 (GitHub push protection이 차단합니다).
