# Changelog

## ver2.0 (2026-04-27)

### 추가 — 새 모듈 5개
- **[scripts/fuzzy.js](scripts/fuzzy.js)** — Levenshtein 기반 유사도 매칭 (`similarity`, `fuzzyMatch`), 파일/시트/컬럼명에 적용되는 `fuzzyProxy`, 헬퍼 `col(sheet, "이름")`, `findColumnGlobal(inputs, "이름")`. 기본 임계값 0.85, 차순위와 0.1 미만 차이면 모호로 분류.
- **[scripts/formula-engine.js](scripts/formula-engine.js)** — 미니 엑셀 수식 평가기. 지원 함수: `SUM/AVERAGE/COUNT/COUNTA/MAX/MIN/IF/IFERROR/ROUND/ROUNDUP/ROUNDDOWN/ABS/AND/OR/NOT/LEN`. 셀 참조, 범위(`A1:B10`), 산술/비교/문자열 결합/백분율 지원. 다른 시트 참조나 `VLOOKUP` 같은 lookup 은 미지원이며 원본 캐시 값으로 fallback.
- **[scripts/table-detect.js](scripts/table-detect.js)** — 한 시트 안 빈 행/열로 구분된 표 후보를 사각 영역으로 탐지. 라벨/헤더 행/A1 표기 범위 자동 추정.
- **[scripts/search.js](scripts/search.js)** — Ctrl+F 검색 바. 활성 시뮬레이터 안의 모든 셀에서 부분 문자열 매칭, ▲▼ 네비게이션, ESC 닫기. 가상 스크롤이 필요 시 자동으로 행을 확장해 매치 위치로 이동.
- **[scripts/disambiguate.js](scripts/disambiguate.js)** — `askUserChoice(질문, 후보, { allowFreeRange })` Promise 기반 모달. 직접 범위 입력란(예: `A12:G30`) 옵션 포함.

### 변경 — 핵심 모듈
- **[scripts/file-parsing.js](scripts/file-parsing.js)** — 셀별 수식(`.f`)과 원본 캐시 값(`.v`) 추출, `detectTables()` 자동 실행해 파일에 부착. `cloneFileRecord` 가 새 필드(`formulas`, `originalFormulaValues`, `tables`) 보존.
- **[scripts/state.js](scripts/state.js)** — `selectedSheets`, `fuzzyResolution`, `lastError`, `formulaResults` 추가.
- **[scripts/pipeline.js](scripts/pipeline.js)**
  - `runPipeline` 이 `inputs`/시트 객체를 `fuzzyProxy` 로 감싸 사용자 코드에 전달. 헬퍼(`col`, `findColumnGlobal`, `similarity`) 도 함께 주입.
  - 단계별 컴파일/실행 오류를 감싸 `Step N (description) — message + stack` 으로 던짐. 새 헬퍼 `reportPipelineError(err)` 가 토스트 + 채팅 영역에 풍부한 에러 메시지 표시 (item 9).
  - 매 실행 후 `recomputeAllFormulas()` 가 모든 파일의 수식 셀을 현재 데이터로 다시 평가해 `state.formulaResults` 채움 (item 10).
- **[scripts/excel-viewer.js](scripts/excel-viewer.js)** — 전면 재작성.
  - **가상 스크롤** (item 6): 초기 300행 렌더, IntersectionObserver 가 sentinel 감지 시 +300행씩 자동 추가. 모든 행 렌더까지 자동 진행. 페이지 버튼/Load more 없음.
  - **다중 시트 탭 선택** (item 3): Ctrl/Cmd+click 으로 시트 토글. 여러 개 선택되면 채팅 schema 의 "기본 대상" 에 모두 포함.
  - **수식 결과 표시** (item 10): 셀에 `data-r/data-c`, `has-formula` 클래스 + tooltip 으로 원본 수식. 표시값은 `state.formulaResults` 에서 평가된 값 우선.
  - 검색 매치 시 `ensureRowVisible()` 으로 가상 스크롤 펼쳐 위치 노출.
- **[scripts/file-schema.js](scripts/file-schema.js)** — `_describeFile()` 가 표 후보 리스트 + 수식 셀 개수 + preview 를 한꺼번에 출력. 새 섹션 "사용자가 현재 보고 있는 탭"(`_buildDefaultTargetHint`) 이 명시되지 않은 명령의 기본 대상을 LLM 에 알림. SYSTEM_PROMPT 에 헬퍼 사용법, 모호함(컬럼/표) 발생 시 코드 작성 전 사용자에게 되묻도록 명시.

### UI / CSS
- **[styles/components.css](styles/components.css)** — `.find-bar` (Ctrl+F), `.disamb-choices/.disamb-range` (모호 해소 모달), `.msg.system.error` (단계 오류 메시지).
- **[styles/panels.css](styles/panels.css)** — `.sheet-tab.selected` (다중 선택 표시), `td.has-formula` (우측 상단 모서리 표식), `td.find-hit/find-current` (검색 강조).
- 검색 바는 `position:fixed` 으로 화면 우상단 고정. Ctrl+F 핫키는 시뮬레이터가 보일 때만 가로채며 입력창 포커스 시 양보.

### 기능 매핑 — 사용자 요청 vs 구현
| # | 요청 | 구현 |
|---|---|---|
| 1 | 파일/컬럼 유사도 매칭 | `fuzzyProxy` + `col()` 헬퍼 + 시스템 프롬프트 |
| 2 | 같은 컬럼이 여러 파일 → 사용자 확인 | 시스템 프롬프트에서 LLM 이 코드 작성 전 되묻도록 명시 + `findColumnGlobal()` 로 후보 노출 |
| 3 | 파일 미특정 시 우측 선택 탭 사용, N개 선택 가능 | 시트 탭 Ctrl+click 다중 선택, `_buildDefaultTargetHint()` 가 schema 에 노출 |
| 4 | 한 파일 안 여러 시트 인식 | 기존부터 지원 (`file.sheets[sheetName]`) |
| 5 | 한 시트 안 여러 표 인식 | `detectTables()` + schema 에 후보 노출 + 시스템 프롬프트에서 모호 시 범위 요청 |
| 6 | 300행 유지 + 스크롤로 점차 확장 | 가상 스크롤 (`IntersectionObserver`, +300행 단위) |
| 7 | Ctrl+F 검색 | `search.js` + `.find-bar` |
| 8 | (스킵) | — |
| 9 | 실행 오류 시 단계/사유 표시 | `_stepError` + `reportPipelineError` (토스트 + 채팅) |
| 10 | 수식 실시간 반영 | `formula-engine.js` + `recomputeAllFormulas()` + 뷰어 표시 |

### 알려진 제약
- 수식 평가기는 미지원 케이스(다른 시트 참조, VLOOKUP 등)에서 원본 캐시 값으로 fallback. 정확도가 필요한 워크플로우라면 다운로드한 결과 xlsx 의 수식이 원본대로 보존되므로 Excel 에서 한 번 열어 재계산 권장.
- 표 자동 분할은 하지 않음 — 후보만 제시하고 어느 표를 쓸지는 사용자/LLM 이 결정.
- 새로 생성된 입력 파일(코드에서 `inputs["새파일.xlsx"]={}`) 은 기존 파일 옆에 노출되지 않음 (기존 한계 유지).

---

## ver1.2 (2026-04-27)

### 추가
- **스킬 중간 삽입** — AI 응답 코드 블록의 액션 버튼에 `↳ 삽입` 추가. 클릭 시 팝업이 열리며 1 ~ N+1 사이의 단계 위치를 입력하면 해당 위치에 새 단계가 끼어든다. 기존 `✓ 적용 (맨 뒤)`, `✕ 거절` 과 함께 노출 ([scripts/chat-ui.js](scripts/chat-ui.js)).
  - 내부적으로 `insertLogic(step, position)` 이 추가됨 ([scripts/pipeline.js](scripts/pipeline.js)).
- **스킬 단계 인라인 수정** — 파이프라인 항목마다 `✎` 수정 버튼이 생기고, 누르면 해당 단계가 수정 모드로 진입한다. 다시 누르거나 채팅 입력창 위 배너의 `해제` 버튼을 누르면 비활성화. 수정 모드에서 채팅을 보내면 LLM에게 다음 세 가지가 함께 전달된다:
  - 수정 대상 단계의 **현재 코드**
  - 그 단계 **직전의 입력/출력 데이터 상태** (앞 단계들이 적용된 결과)
  - 사용자의 수정 요청
  
  덕분에 모델이 의도와 컨텍스트를 더 정확히 이해한다. 응답의 `✓ 수정 적용` 을 누르면 해당 단계의 코드가 통째로 교체되며 파이프라인이 재실행된다 ([scripts/chat-ui.js](scripts/chat-ui.js), [scripts/file-schema.js](scripts/file-schema.js), [scripts/pipeline.js](scripts/pipeline.js)).

### 변경
- `state.editingStepId` 필드 추가 ([scripts/state.js](scripts/state.js)).
- `callLLM(userMessage, options)` 에 `editTargetId` 옵션 도입. 수정 모드 호출 시 별도의 `EDIT_SYSTEM_PROMPT` + 편집 컨텍스트가 system 프롬프트로 주입됨 ([scripts/claude-api.js](scripts/claude-api.js), [scripts/file-schema.js](scripts/file-schema.js)).
- `renderPipeline()` 이 수정 중인 단계를 `editing` 클래스로 강조하고 채팅 입력창 위에 수정 배너를 자동으로 표시한다 ([styles/pipeline.css](styles/pipeline.css), [styles/chat.css](styles/chat.css)).
- 초기화 / 스킬 불러오기 시 `editingStepId` 가 함께 정리된다 ([scripts/save-load.js](scripts/save-load.js)).

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
│   ├── pipeline.js         # 스킬 파이프라인 실행
│   ├── output-template.js  # 출력 xlsx 다운로드 (원본 양식 보존)
│   ├── save-load.js        # 스킬 저장/불러오기
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
