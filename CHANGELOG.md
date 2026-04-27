# Changelog

## ver1.2 (2026-04-27)

### 추가
- **로직 중간 삽입** — AI 응답 코드 블록의 액션 버튼에 `↳ 삽입` 추가. 클릭 시 팝업이 열리며 1 ~ N+1 사이의 단계 위치를 입력하면 해당 위치에 새 단계가 끼어든다. 기존 `✓ 적용 (맨 뒤)`, `✕ 거절` 과 함께 노출 ([scripts/chat-ui.js](scripts/chat-ui.js)).
  - 내부적으로 `insertLogic(step, position)` 이 추가됨 ([scripts/pipeline.js](scripts/pipeline.js)).
- **로직 단계 인라인 수정** — 파이프라인 항목마다 `✎` 수정 버튼이 생기고, 누르면 해당 단계가 수정 모드로 진입한다. 다시 누르거나 채팅 입력창 위 배너의 `해제` 버튼을 누르면 비활성화. 수정 모드에서 채팅을 보내면 LLM에게 다음 세 가지가 함께 전달된다:
  - 수정 대상 단계의 **현재 코드**
  - 그 단계 **직전의 입력/출력 데이터 상태** (앞 단계들이 적용된 결과)
  - 사용자의 수정 요청
  
  덕분에 모델이 의도와 컨텍스트를 더 정확히 이해한다. 응답의 `✓ 수정 적용` 을 누르면 해당 단계의 코드가 통째로 교체되며 파이프라인이 재실행된다 ([scripts/chat-ui.js](scripts/chat-ui.js), [scripts/file-schema.js](scripts/file-schema.js), [scripts/pipeline.js](scripts/pipeline.js)).

### 변경
- `state.editingStepId` 필드 추가 ([scripts/state.js](scripts/state.js)).
- `callLLM(userMessage, options)` 에 `editTargetId` 옵션 도입. 수정 모드 호출 시 별도의 `EDIT_SYSTEM_PROMPT` + 편집 컨텍스트가 system 프롬프트로 주입됨 ([scripts/claude-api.js](scripts/claude-api.js), [scripts/file-schema.js](scripts/file-schema.js)).
- `renderPipeline()` 이 수정 중인 단계를 `editing` 클래스로 강조하고 채팅 입력창 위에 수정 배너를 자동으로 표시한다 ([styles/pipeline.css](styles/pipeline.css), [styles/chat.css](styles/chat.css)).
- 초기화 / 로직 불러오기 시 `editingStepId` 가 함께 정리된다 ([scripts/save-load.js](scripts/save-load.js)).

### 비고
- 새 헬퍼 `computeStateBeforeStep(stepIdx)` 가 `state` 를 변경하지 않고 K번째 단계 직전의 데이터를 시뮬레이션해 반환함. 이 결과가 LLM 편집 컨텍스트의 입력/출력 미리보기에 사용된다.
- 단계 삭제 시 그 단계가 수정 모드 대상이었다면 모드도 함께 해제된다.

---

## ver1.1.1 (2026-04-27)

### 추가
- **히든 개발자 모드** — `F9` 키로 설정 모달을 dev 모드로 열면 Claude API 직접 호출 옵션이 노출됨. 일반 ⚙ 버튼은 기존대로 ixi 모델만 표시 ([scripts/model-modal.js](scripts/model-modal.js)).
- Claude 모델 선택 드롭다운: `claude-opus-4-7`(기본), `claude-opus-4-7[1m]`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`.
- `localStorage`에 anthropic 설정(apiKey/model/baseUrl) 영속화 — 새로고침해도 유지.
- 연결 테스트 버튼이 provider별로 다른 엔드포인트로 ping 호출.

### 변경
- `DEFAULTS.anthropic.model`: `claude-sonnet-4-5-20250929` → `claude-opus-4-7`.
- `loadSettings()`가 `provider: "anthropic"` 케이스를 처리하도록 확장.

### 비고
- API 키는 사용자가 직접 입력하며 저장도 로컬에만 됨. 코드/리포에 키 박지 않음.

---

## ver1.1 (2026-04-27)

### 변경 요약
3.4MB 단일 `sym2.html`을 디자인(CSS) / 기능(JS) 단위로 모듈화. bundler/unpacker 구조를 제거하고 정적 파일 로딩으로 단순화했습니다.

### 디렉토리 구조
```
B2B_ver1.1/
├── index.html              # slim HTML shell (14KB) — body 마크업 + link/script 태그만
├── styles/                 # CSS 8개 모듈 (총 41KB)
│   ├── base.css            # 디자인 토큰, 폰트, body, 스크롤바
│   ├── layout.css          # 메뉴 드로어, 좌우 분할 리사이저
│   ├── panels.css          # 좌측/우측 패널, 패널 섹션 카드
│   ├── components.css      # dropzone, file chip, button, toast, modal
│   ├── chat.css            # 채팅 UI
│   ├── pipeline.css        # 파이프라인 리스트
│   ├── workflow.css        # 워크플로우 패널
│   └── runner.css          # 러너 hero + 삼각형 레이아웃
├── scripts/                # JS 16개 모듈 (총 76KB) — 로드 순서대로
│   ├── config.js           # DEFAULTS, settings, 모델 라벨
│   ├── state.js            # 전역 state 객체
│   ├── util.js             # 공통 유틸
│   ├── file-parsing.js     # XLSX/CSV 파싱
│   ├── drop-handling.js    # 드롭존, 파일 처리
│   ├── excel-viewer.js     # 엑셀 미리보기 렌더링
│   ├── file-schema.js      # Claude용 파일 스키마
│   ├── claude-api.js       # Claude/OpenAI-compat API 호출
│   ├── chat-ui.js          # 채팅 메시지 UI
│   ├── pipeline.js         # 로직 파이프라인 실행
│   ├── output-template.js  # 출력 xlsx 다운로드 (원본 양식 보존)
│   ├── save-load.js        # 로직 저장/불러오기
│   ├── menu.js             # 페이지 전환, 메뉴 드로어, 패널 접기
│   ├── resizer.js          # 좌우 너비 드래그
│   ├── model-modal.js      # AI 모델 설정 모달
│   └── main.js             # 초기 렌더 부트스트랩
├── vendor/
│   ├── xlsx.full.js        # SheetJS (이전엔 base64+gzip 번들 → 평문 추출)
│   └── pretendard-variable.woff2
├── launch_kgm.py           # `index.html` 오픈하도록 변경
├── launch_kgm.spec         # styles/, scripts/, vendor/ 자동 collect
├── serve_kgm.py            # 변경 없음 (정적 + /v1/* 프록시)
├── build_exe.bat           # 변경 없음
├── start_kgm.bat           # 변경 없음
└── CHANGELOG.md
```

### 주요 변경
- **bundler 제거**: 기존 `sym2.html`은 base64+gzip로 압축한 라이브러리/템플릿을 런타임에 풀어서 blob URL로 주입하는 구조였음. ver1.1은 `vendor/xlsx.full.js`로 직접 로드.
- **CSS 분리**: 단일 1394줄 `<style>` 블록 → 기능 영역별 8개 파일.
- **JS 분리**: 단일 2045줄 `<script>` 블록 → 섹션 헤더 주석(`/* === */`) 기준 16개 파일. 로드 순서는 원본 JS 순서 그대로 유지(상위에서 정의된 함수/상수를 하위가 참조하는 의존성 보존).
- **중복 코드 제거**: 원본의 `setupResizer` IIFE 2회 정의(L3504, L3642) → 1회로 통합.
- **폰트 경로 수정**: UUID 참조(`url("a993db03-...")`) → 실제 파일 경로(`url("../vendor/pretendard-variable.woff2")`).
- **launcher**: `sym2.html` → `index.html`.
- **PyInstaller spec**: `styles/`, `scripts/`, `vendor/` 폴더의 모든 파일을 datas로 자동 수집.

### 호환성
- 빌드: `build_exe.bat` 실행 방식 동일. `dist/KGM_업무망.exe` 결과물.
- 실행: `start_kgm.bat` 실행 방식 동일. `http://127.0.0.1:8090/index.html` 자동 오픈.
- 프록시: `/v1/*` → vLLM 서버 프록시 동작 변경 없음.

### 알려진 제한
- `vendor/xlsx.full.js`는 ver1의 `sym2.html` manifest에서 추출한 사본입니다. SheetJS 업스트림 업데이트 시 수동 교체 필요.
