# Changelog

개발자용 변경 이력입니다. "무엇을 왜 고쳤나"를 커밋 기준으로 적습니다.
사용자용 안내는 `patch_notes/vX.Y.Z.txt`(평문), 코드 단위 명세는 `docs/okf/`, 삽질 기록은 `docs/lessons/` 를 봅니다.

> 아래 `ver0.8.x` 가 현재 버전 체계입니다(단일 진실 = `launch_b2b.py` 의 `CURRENT_VERSION`).
> 문서 맨 아래 `ver2.0` / `ver1.x` 는 2026-04 초기 모듈화 시절의 옛 numbering 기록으로, 연속된 번호가 아닙니다.
> 0.5.14 ~ 0.8.2 구간은 이 파일에 없습니다 — `patch_notes/`(v0.5.16 이후 버전별 .txt)와 `docs/lessons/`(삽질·회귀 기록)를 보세요. 0.5.13 이하는 `README.md` 의 "최근 변경사항" 에 남아 있습니다.

---

## ver0.8.4 (2026-09-03 ~ 09-09)

0.8.3 그대로에서 버전만 올린 갈래(`cdc6f860`). 제품명 변경, F키 접근 권한, 대시보드 실사용 보강, 그리고 "화면은 맞는데 파일이 다르다" 부류의 조용한 오류 수정이 중심입니다.

### 수정 — 2026-09-10 (AI 도움: 시트명 없는 데이터 질문, docs/lessons/62)

- **"마진율 제일 적은거 3개 뽑아줘" 가 흔들림** — 제보(사내 Qwen3.6): "파일이 없다"며 못 찾음. 개발망 Qwen3.8 실기 3회:
  정답 1 / "짝짓기가 안 돼요" 포기 1 / 원본 두 시트를 머릿속에서 결합해 3위 오답 1. 세 가지 원인을 각각 고쳤다.
  - 도구 파일 인자가 **정확 일치만** 통과 → `_assistResolveFile/_assistResolveSheet`: 확장자·대소문자·이름 일부·"시트명을 파일로"
    를 **유일할 때만** 보정(모호하면 available 을 돌려준다). `data.query`·`sheet.headers`·`data.read` 공용. unknown_* 에 hint.
  - 프롬프트 그라운딩 팩트에 **파일별 시트(열 이름)** 추가(`_assistFileHeadersBrief`) + `columns.find(열 이름)` 도구 +
    `schema.summary.headersBySheet` — 'Sheet1' 추측·원본 뒤지기가 사라져 5/5 첫 호출부터 `회사별요약` 을 읽음.
  - **정렬은 도구가**: `data.query op=rank(column, order=asc|desc, topN, labelColumn?)`(별칭 bottom/lowest/min·top/highest/max),
    `groupSum/groupCount` 에 `order`, `groupBy` 배열(복합 키), `sample` 은 column 없이/콤마 목록 허용.
    모델이 21행 표를 눈으로 골라 3위를 틀리던 것(5회 중 2회)이 사라짐.
  - **본문 없는 final** — 도구 결과 직후 `{"action":"final","args":{}}` 만 보내 "응답을 정리하지 못했습니다" 로 끝나던
    것(6회 중 1회)을 1회 재촉(`emptyFinalNudges`, `assist.nudge kind=empty-final`)으로 회수. 상한 1.
  - 최종 실기: 같은 질문 6/6 정답, 다른 표현("마진율 낮은 회사 셋만", "매출이 제일 큰 회사 어디야?")도 rank 한 방으로 정답.
- 검증: `test_runs/_test_assist_resolve_file_columns_find.js`(실제 함수 실행 40여 건), `_test_assist_empty_final_nudge_e2e.py`
  (LLM 을 route 로 각본 모의 → 실제 루프에서 재촉 1회·상한·정상 경로 결정적 확인, 백엔드 없으면 스스로 띄움),
  `_e2e_assist_vague_margin_live.py`(개발망 Qwen 실기, 반복 횟수·질문 인자). registry `ASSIST-VAGUE-DATA-QUESTION-SHEET-RESOLVE`,
  `ASSIST-EMPTY-FINAL-NUDGE`.

### 추가 — 2026-09-09 저녁 (대시보드 골라 보기 4건, `dashboard.html`)

- **조직 단계별 보기** — `orgPath("회사 > 부문 > 센터 > Lab > 팀")` 를 단계로 쪼개는 "조직 단계별 사용" 차트.
  탭 `1단계…N단계·팀`(회사 0단계 제외, 경로가 짧은 사람은 그 단계에서 빠짐), 탭 전환은 재조회 없이
  `window.__lastSessions` 로 그 차트만 다시 그림, 상태는 URL `#lvl`.
- **실행 목록 조직 셀 조각화** — `orgCellHTML`: 상위 조직은 작은 조각(`.org-seg`, `data-filter-org`), 팀은 굵게.
  조각 클릭 = 그 단위 필터(`sessionInOrg` 재사용), 현재 필터 단위는 `.on` 강조. CSV(textContent)는
  `CTO › 센터 › Lab › 팀` 로 온전히 나오도록 구분자에 공백 + 팀 앞 숨김 구분자.
- **버전 필터** — 필터 바 `#f-ver`(세션에 나온 버전, 최신순) + `sessionInVer`(normVer 비교). 클릭 지점:
  실행 목록 버전 셀, 버전 도입률 조각/범례(`C.versionsHTML(vd, activeVer)`), 칩, URL `#ver`.
- **오류 → 세션 이동** — 오류 목록 이벤트/세션 셀(`data-filter-session`) 클릭 → `window.__filterSession` 으로
  실행 목록을 그 세션 한 줄로 좁히고(`row-pinned` 강조) 행을 화면 가운데로 스크롤 + 상세(로그·스킬) 자동 펼침,
  칩 "세션: … (오류에서 이동)", URL `#session`. 목록에 없으면 안내 문구. 사용자·조직·날짜·버전 등 다른 필터를
  누르면 세션 고정은 자동 해제(한 줄만 남은 목록에서 다른 사람을 눌러도 안 보이는 혼란 방지).
- 정책은 종전 조직 필터와 같다: 조직·버전·세션 필터는 세션 기반 구역(실행 목록·팀/조직 차트·체류 분포·스킬 TOP·
  시간대·버전 도입률)에 걸리고, 서버 집계 카드·사용자별·일별 표는 전체 기준 그대로. 힌트 문구에 명시.
- 검증: `test_runs/_test_dashboard_org_ver_session_e2e.py` — 정적 서버 + Playwright route 모의 API 로 실제 브라우저에서
  45개 동작(탭·필터·칩·URL # 기록/복원·스크롤·상세 펼침·CSV 텍스트) 확인. 같은 URL 에 `#` 만 바꾼 `goto` 는
  페이지를 다시 안 띄우므로(같은 문서 이동) 복원 테스트는 쿼리를 달리해 연다. registry `DASH-ORG-LEVELS-VER-SESSION-FILTERS`.

### 수정 — 2026-09-09 오후 (docs/lessons/61)

- **AI 도움이 도구를 안 부르고 숫자·회사명을 지어냄** — 검산/마진율 질문에 `assist.tool` 0건인 채 데이터에 없는 값(1,204,000, (주)삼영물산)을 답했다(실제 3,949,012,800). 루프에 '근거 없는 수치 가드'(이번 턴 도구 0회 + 답에 구체 수치 + 데이터 질문 → 1회 재촉: 도구로 확인하거나 '확인 못 했다'고 답하라), 프롬프트 날조 금지에 수치 명시, `assist.final{tools}` 트레이스 ([scripts/assist-core.js](scripts/assist-core.js)).
- **AI 도움 팝업: 진단 버튼을 눌러도 "창만 열리고 아무것도 안 뜸"** — 팝업 페이지는 닫아도 살아 있어 재오픈 땐 `ready` 가 다시 오지 않는데, 보관한 질문(`_assistPendingAsk`)을 `ready` 에서만 보내고 `popup-opened` 에서 폴백 타이머까지 지워 질문이 증발했다. `popup-opened` 에서도 보낸다(첫 로드는 1.5초 폴백). 팝업 쪽 `case "ask"` 가 busy 면 조용히 버리던 것도 busy 를 풀고 보내도록 ([scripts/assist-ui.js](scripts/assist-ui.js), [scripts/assist-popup.js](scripts/assist-popup.js)).
- **개발망 vLLM 이전(.111→.108)으로 모든 LLM 호출이 연결 타임아웃 → "확인 중" 에서 분 단위 매달림** — 기본 주소를 `.108` 로 바꾸고 저장 설정의 `.111` 은 레거시 목록으로 자동 승격. `effectiveDevVllmModel` 의 `/models` 탐색 fetch 에 4초 타임아웃(예전엔 없어서 매 호출 앞단에서 OS 연결 타임아웃을 통째로 먹음) ([scripts/config.js](scripts/config.js), [scripts/llm-api.js](scripts/llm-api.js)).
- **`ctx.sort` 가 합계 행까지 정렬해 맨 위로 올림** — 범위 맨 아래의 합계/평균/소계 행(과 빈 행)은 자동 제외해 그 자리에 둔다(`exclude_summary_rows=True` 기본). win32com `Range.Resize` 함정을 피해 `ws.Range(cells, cells)` 로 범위를 다시 잡는다. 실 Excel 검증 ([serve_b2b.py](serve_b2b.py), `test_runs/_test_sort_pins_summary_rows_com.py`).
- 재현 방법 기록: 네이티브 셸에 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333` 로 CDP 를 붙여 팝업 모드를 자동화 (`test_runs/_e2e_native_popup_assist_live.py`, 수동).

### 수정 — 조용히 틀린 결과 (docs/lessons/58)

- **[크리티컬] 결과편집 후 "현재 상태 다운로드"가 옛 실행 결과를 서빙** — 전체실행(19단계) → 결과편집 → 스킬 추가(라이브 적용) → 다운로드 시 **실행 시점**의 결과 파일이 받아져 추가한 스킬이 빠졌습니다(뷰에는 적용돼 보여 사용자가 받아 간 뒤에야 드러남). 결과편집이 라이브로 불러온 결과 항목에 `liveAbsorbed` 표시를 달고, 다운로드는 흡수된 항목을 건너뛰고 라이브 현재 상태를 `/api/excel/save` 로 저장합니다. 결과편집 재클릭 시 옛 결과가 라이브(추가 스킬)를 덮던 부수 구멍도 함께 막았습니다. 결과를 라이브에 안 불러온 파일의 "결과 우선 다운로드"(원본 방지)는 보존 ([scripts/output-template.js](scripts/output-template.js), [scripts/pipeline.js](scripts/pipeline.js), `3b79e27b`).
  - 회귀 테스트에 **단일 작성 지점 가드**를 추가 — 수정·ON/OFF·추가 같은 라이브 경로가 `lastRunnerOutputs` 를 새로 만들면 흡수 표시가 우회되므로, 작성 지점이 실행기 완료 1곳뿐임을 검사합니다 (`1ce824da`).
- **`ctx.write` 가 "제외한" 행의 기존 수식을 지웠다** — "합계 행(24행)은 제외합니다" 라던 생성 코드가 `out.append([None])` + 통짜 `ctx.write` 로 짜여 `C24` 의 `=SUM(...)` 이 사라졌습니다(`Value2=None` = 셀 비우기). 이제 **행 전체가 `None` 인 행은 스킵**하고 연속 구간별로 기록합니다(`skip_none_rows=True` 기본). 셀을 비우는 것은 `ctx.clear` 담당이고, 내부 헬퍼(`write_cell` · `match_fill` · 조회 채우기)는 `skip_none_rows=False` 로 예전 의미(빈 값=비움)를 고정했습니다 ([serve_b2b.py](serve_b2b.py), [scripts/file-schema.js](scripts/file-schema.js), `27041023`).
- **`ctx.match_fill` 이 반복 블록 시트를 과채움** — 월별 요약처럼 같은 표(`구분` 헤더)가 8번 반복되는 시트에서 끝행까지 스캔해 58행이 채워지고(의도 ~7행) 다른 달 블록의 같은 이름 값이 덮였습니다. 기본 `scope="block"` — 키 열에 대상 헤더 라벨이 다시 나오면 그 앞에서 멈춥니다(헤더 반복이 없는 일반 시트는 동작 동일). `scope="all"` 이 예전 전체 스캔이고, 끝을 명시한 `rows=(s,e)` 는 그대로 존중합니다 ([serve_b2b.py](serve_b2b.py), `3f80f2cc`).

### 수정 — AI 도움(F11) 조용한 실패 4건 (docs/lessons/60)

- **답이 "이유는 이래요." 하고 비었다** — 에코 제거기가 도구 결과(오류 메시지) 인용까지 지워 근거 문단이 통째로 사라졌습니다. 제거 소스에서 도구 결과·이전 답을 제외하고, 사용자 메시지는 긴 문단만 대상으로 삼습니다 ([scripts/assist-core.js](scripts/assist-core.js), `fe4df2f8`).
- **예고문 뒤에 부연이 붙으면 대화가 멈췄다** — "…맞춰 볼게요. 원본은 금액 열이에요." 처럼 한 문장이 더 붙으면 예고문 감지가 안 돼 재촉이 발동하지 않았습니다. 감지 보정 후, "먼저 1단계 코드를 볼게요." 에서 또 멈춘 건은 **동사 허용목록을 아예 제거**하고 약속 어미 전부(인사말 제외)를 감지하도록 바꿨습니다(`assist.nudge` 트레이스 추가) ([scripts/assist-guard.js](scripts/assist-guard.js), [scripts/assist-core.js](scripts/assist-core.js), `fe4df2f8` · `af0351a8`).
- **검산이 미리보기 60행만 보고 답을 포기** — `data.query` 가 preview 스키마만 읽어 1,200행 검산을 못 하고 설계 채팅으로 넘겼습니다. 라이브 파일은 실제 행수만큼 다시 읽어 전체 기준으로 집계합니다(단일 시트, `maxRows ≤ 20000`) ([scripts/assist-tools.js](scripts/assist-tools.js), [serve_b2b.py](serve_b2b.py), `fe4df2f8`).
- **검산 결과가 2배로 틀렸다** — 요약표의 합계/평균 행을 데이터 행과 함께 더해 중복 합산했습니다. `data.query` 집계에서 요약 행을 기본 제외하고(제외 개수 안내, `includeSummaryRows` 옵션), 프롬프트에 "두 값을 독립적으로 읽어 결론부터, 단계 탐색은 요청 시에만"을 명시했습니다 ([scripts/assist-tools.js](scripts/assist-tools.js), `af0351a8`).
- 도구 인자 `{args:{...}}` 포장을 자동으로 벗깁니다 (`fe4df2f8`). 실제 앱+LLM으로 검산 흐름을 확인하는 수동 e2e 스크립트 추가 (`test_runs/_e2e_assist_verify_live.py`, `333c5f45`).

### 변경 — 제품명 · 메뉴 · 접근 권한

- **제품명 `B2B 스마트 빌링 에이전트`** — 창 제목(NativeHost), 문서 title, 드로어 상단, 대시보드 제목/요약/AI 프롬프트, 제보 안내, 버전확인 문구를 교체. **예외로 유지**: 생성기 U+ 로고 옆 `#page-title` 의 `AX-Cell`, 좌측 메뉴 그룹 라벨, 스킬 종류 태그(AX-Cell/AX-Trace 스킬), 내부 식별자(`AXCellScheduler`, `axcell.ico`, exe명) ([index.html](index.html), [native_host/NativeHost.cs](native_host/NativeHost.cs), [dashboard.html](dashboard.html), `a2ccba19` · `cf6a1687`).
- **추가 메뉴는 숨김 대신 "Coming soon" 블락** — AX-Trace·E2E 메뉴를 항상 보이게 두고 반투명 블락으로 클릭만 차단합니다. **F6** = 블락 해제/복귀(저장키·복귀 로직·F키 가드는 기존 그대로) ([scripts/menu.js](scripts/menu.js), [styles/scheduler.css](styles/scheduler.css), `a2ccba19`).
- **F키 접근 권한(버프)** — 개발·관리성 F키(F2·F6·F7·F8·F9)는 권한이 있어야 동작합니다. 기본 보유는 조직 정보상 팀이 `Foundation리서치팀` 인 사용자(`/api/whoami` 재사용), **F1 6연타**(1.5초 간격 내 연속, 다른 키 개입 시 리셋)로 획득하면 그 PC에 유지됩니다. 비권한자에게는 조용히 무시해 권한의 존재를 광고하지 않고, 조직 정보가 없는 개발망은 허용하며 whoami 응답 전에도 차단하지 않습니다(시작 직후 정상 사용자 보호). F1/F5/F10/F11은 일반 기능이라 제외 ([scripts/fkey-guard.js](scripts/fkey-guard.js), `4beab04e`).
  - **`scripts/fkey-guard.js` 는 `index.html` 의 첫 번째 스크립트여야 합니다** — capture 리스너는 등록 순서대로 돌기 때문에, 먼저 등록해야 `stopImmediatePropagation` 으로 뒤의 F7/F8 핸들러를 막을 수 있습니다.

### 변경 — 파이프라인

- **마지막 교차파일 단계 삭제/OFF가 전체 재적용으로 돌던 것** — 적용 직전 사본이 두 파일 모두 있고 복원부가 교차 목적지를 지원하는데도 게이트가 교차 스텝을 무조건 거부해 `reset` ×3 + 전 스텝 재적용이 돌았습니다. `stepHasFullRollbackSnapshots` 를 통과할 때만 빠른 경로를 타고, 사본이 부족하거나 불일치면 종전대로 전체 reconcile 합니다 ([scripts/pipeline.js](scripts/pipeline.js), `da4c147d`).

### 추가 — 관리 대시보드

- 헤더에 **수동 `🔄 갱신`** 버튼 (`4beab04e`).
- **실행(세션) 목록 행 펼침** — 로그/스킬 개수 셀을 누르면 상세 행에 로그 파일 목록(크기·다운로드)과 스킬별 단계 수/켜짐 수/단계 제목이 나옵니다. `log_dash.ALLOWED_PATHS` 에 `session/detail` · `session/file` 추가, 수집 서버에 상세/파일 API 추가(별도 배포) ([dashboard.html](dashboard.html), [log_dash.py](log_dash.py), `30404899`). 세션 상세는 **펼칠 때마다 재조회** — 첫 응답을 영구 캐시해 수집 중 세션의 새 스킬이 안 보이던 문제 수정 (`efd906ac`).
- **표 10줄 페이지 나눔**(정렬·자동갱신과 공존, 상세 행은 부모 행을 따라감), **행 클릭 = 그 조건으로 필터**(사용자 행 → 그 사용자, 일별 행 → 시작·종료일, 실행/오류 목록의 날짜·사용자 셀 역방향 매핑, 재클릭 = 해제), **토큰 일별 추이 차트**(입력/출력 쌓은 막대) (`a89432ff`).
- **스킬 TOP 차트**(기간 내 저장 횟수·만든 사람 수), 표 4종 **CSV 내보내기**(현재 필터·정렬 그대로, BOM으로 한글 엑셀 호환), **조회 조건을 주소창 `#` 에 저장**(F5·링크 공유에도 보던 화면 유지), **`📋 요약 복사`**(팀즈 붙여넣기용 기간 요약, 직전 기간 증감 포함) (`0e9e35d4`).
- **세션당 토큰 합계 열**(호버 = 입력/출력/호출 수, 구서버는 `-`) (`0a9c9e65`).
- **활성 시간(추정)** — 앱을 고치지 않고 수집기에서 세션 로그 `ts` 간격으로 근사합니다. 간격이 기준 이내면 실사용으로 합산하고 초과는 자리비움. 기준은 5분으로 시작했다가 **10분**으로 완화했습니다(`_ACTIVE_GAP_SECONDS=600`, 캐시 v5로 기존 값 재계산, 경계 테스트 9분 포함/11분 제외) (`fcaaf8f3` · `6f3edde5`).
- **전체실행 카드**(성공·실패·평균 소요) — 세션 목록은 앱 실행 단위여서 전체실행 1건 기록(`telemetry_preview.jsonl`)이 앱 폴더에만 남고 보안망에 올라가지 않았습니다. `log_sync` 의 `extra_files` 에 그 파일을 추가해(새 통신선 없이 기존 전송 재사용) 수집기가 `agent.run` 을 `fullRuns` 로 집계하게 했습니다. AI 질문 요약본에도 포함 ([serve_b2b.py](serve_b2b.py), `3f98f55e`).
- **요약 복사가 전부 `undefined/0`** — `buildDashDigest` 반환값은 AI용 JSON 문자열(9KB 컷)인데 `copyReport` 가 객체로 읽었습니다. 자르기 전 원본 객체를 `window.__dashDigest` 로 보관하고 요약 복사는 그것을 읽습니다. 조회 전에 누르면 무반응 대신 안내 토스트. 회귀 테스트는 `copyReport` 를 실제 실행해 복사 텍스트 내용까지 검사 (`0cf7db20`).

### 회귀 테스트

`_test_result_edit_download.js`, `_test_write_skip_none_rows.py`, `_test_match_fill_block_scope.py`, `_test_fast_delete_cross_gate.js`, `_test_fkey_guard.js`(24항목), `_test_extra_menus_f6.js`, `_test_app_version_label.js`, `_test_assist_echo_fulldata_args.js`, `_test_assist_dangling_announce.js`, `_test_live_preview_maxrows_com.py`, `_test_org_dashboard.js`, `../versionTest/test_session_detail.py`, `../versionTest/test_active_time.py` — 전부 `tools/issue_recheck/registry.json` 에 등록됐습니다.

---

## ver0.8.3 (2026-09-02)

0.8.2 그대로에서 버전만 올린 갈래(`930a0a54`). 배포 관리(버전 게이트)와 사용 현황 파악(조직 정보·토큰 계측·대시보드)이 중심입니다.

### 추가 — 시작 시 버전 게이트

- **프로세스당 1회 허용 버전 확인** — 보안망 `version.txt` 의 허용 버전 목록(줄바꿈 구분)과 현재 버전을 대조합니다. 목록에 없으면 "오래된 버전을 사용하고 있습니다. 최신 버전으로 교체 해주세요." + `[다운로드 하러가기]`, 버전 정보를 못 가져오면(서버 오류 등) "점검중입니다. 문의사항이 있으시면 팀즈로 문의 부탁드립니다" + `[확인]`. 프로세스당 1회이므로 새로고침·다중 탭에 팝업이 반복되지 않고, 주소가 설정되지 않은 환경은 조용히 통과합니다 ([serve_b2b.py](serve_b2b.py) `/api/app/version/gate` · `/api/app/version/open-download`(http(s)만, 기본 브라우저), [scripts/version-gate.js](scripts/version-gate.js), `a34e2855`).
  - 다운로드 주소 우선순위 = **F9 저장값 > 서버 `downloadUrl` > 기본값**. F9 설정 창에 입력란 추가 ([scripts/model-modal.js](scripts/model-modal.js)).
  - 수집/버전 서버 쪽은 `version.txt` 여러 줄 = 허용 목록, `version` 필드는 최신값(구버전 앱 호환), `--download-url` 옵션 — `versionTest` 브랜치, **보안망 수동 배포 필요**.
- **`[무시하고 사용하기]` 기본 숨김** — 일반 사용자에게는 `[다운로드 하러가기]` 만 보여 업데이트로 유도하고, 개발/운영자는 팝업이 떠 있는 동안 **F2** 를 누르면 나타납니다(팝업이 닫히면 리스너 정리, 기존 F키와 충돌 없음). 점검중 팝업의 `[확인]` 은 종전대로 항상 표시 (`ba692292`).

### 추가 — 조직 정보 (whoami /fqdn)

- **조직 계층을 로그에 실어 대시보드에서 조직별 조회** — VM의 `whoami /fqdn` 이 상위 조직을 전부 줍니다(`CN=이름(마당아이디), OU=[..]4^Foundation리서치팀, OU=[..]3^AI R_D Lab, …`). `parse_fqdn_org` 가 `CN` → 이름/마당아이디, `[VDIGRP_x]N^이름` OU → 레벨 정렬로 `team`(가장 깊은 레벨)·`orgPath`(상위→하위)·`orgLevels` 를 만듭니다. 이름 안의 콤마에 안전하고, 레벨 표기가 없는 OU(`LGUPlus Users` 등)는 제외하며, 비도메인 PC는 빈 값(형식 유지 — 구버전/개발 환경 무해). `org_info` 는 `whoami /fqdn` 실행당 1회 캐시하고 워커 스레드에서만 돌려 시작을 막지 않습니다. 세션 시작 payload의 `extra.org` 로 전송 — `SessionStart.extra` 는 기존 자리라 구버전 서버에도 그대로 저장됩니다(수집 중단 없음) ([log_sync.py](log_sync.py), `1326542f`).
- **용어 정정: `CN` 괄호 값은 사번이 아니라 "마당 아이디"** — 필드명 `empId` → `madangId`, 주석·테스트 동반 수정 (`2e22028a`).
- **좌상단 계정 표기를 `사용자 : 실명` 으로** — 도메인 PC에서는 `/api/whoami` 가 `log_sync` 의 조직 캐시를 병합해 실명을 보여주고, 툴팁에 마당아이디·소속(조직 경로)·원래 로그인 계정을 남깁니다. 비도메인(개발망)은 종전 표기(`도메인\계정`)를 유지하되 응답 형태는 항상 동일합니다 ([scripts/whoami.js](scripts/whoami.js), `2e22028a`).
- **[수정] 한국어 콘솔(CP949)에서 사용자명 한글 깨짐(U+FFFD)** — `whoami /fqdn` 출력은 한국어 Windows 콘솔에서 CP949인데, UTF-8 `replace` 로 풀고 "`CN=` 이 보이면 성공"으로 판정해 **영문은 살아남으니 CP949 폴백이 영영 안 탔습니다**(한글만 깨진 채 통과). 판정 기준을 **strict UTF-8 디코드 실패**로 바꿔 실패 시 CP949로 폴백합니다. `current_user()` 의 같은 계열 죽은 폴백(`if not text`)도 동일하게 수정했고, CP949 실바이트와 UTF-8(chcp 65001) 양쪽을 실측으로 잠갔습니다 ([log_sync.py](log_sync.py), `bb100bf1`).

### 추가 — F1 기능키 도움말

- F키가 늘어나(F2/F5/F6/F7/F8/F9/F10/F11/F12) 무엇이 어디 있는지 알기 어려워, **F1** 에 매핑 표를 붙였습니다. F1 재입력/ESC/바깥 클릭/`[확인]` 으로 닫히고 브라우저 기본 도움말은 차단합니다. 테스트가 **실제 핸들러(`e.key === "Fn"`)를 소스에서 수집해 표와 교차검증**하므로, 새 F키를 달고 표를 안 고치면 테스트가 실패합니다(도움말이 코드와 어긋나는 것 방지) ([scripts/fkey-help.js](scripts/fkey-help.js), `66a4590f`).

### 추가 — LLM 토큰 사용량 계측

- **원천은 `/v1` 프록시** — 채팅·AI도움·대시보드 질문 등 모든 LLM 호출이 이 프록시를 지납니다. `_inject_stream_usage` 가 스트리밍 요청에 `stream_options.include_usage` 를 주입해 vLLM이 마지막 청크에 usage를 실어 주게 하고(클라 SSE 파서는 빈 `choices` 청크에 안전 — 실측 확인), 응답 꼬리 32KB 버퍼에서 마지막 usage 블록을 추출해 `llm.usage` 트레이스(model/promptTokens/completionTokens/totalTokens)를 남깁니다. **계측은 덤** — 어떤 실패도 프록시 중계를 막지 않도록 테스트로 잠갔습니다. 트레이스는 기존 `log_sync` 로 자동 동기화되므로 전송 경로 변경이 없습니다 ([serve_b2b.py](serve_b2b.py), `f95ba37f`).
- 수집기는 세션 스캔에 tokens 집계(총/입/출/호출 + 모델별)를 추가하고 캐시 v2로 옛 캐시를 자동 재스캔합니다(`/admin/events` 응답에 `tokens{byModel[], byUser[]}`) — `versionTest` 브랜치, 보안망 배포 필요.
- 대시보드에 `🔤 토큰 사용` 카드(총 + 입력/출력/호출수)와 사용자별·팀별·모델별 차트, AI 요약본에도 토큰 포함. 구서버/구앱 데이터면 안내 문구(0.8.3+ 앱부터 수집) ([dashboard.html](dashboard.html)).

### 변경 — 관리 대시보드 (상황판화)

- **고정 헤더**(마지막 갱신 시각 + 60초 자동 새로고침 토글), **KPI 카드**에 아이콘·톤 색(정상/주의/위험)·직전 같은 기간 대비 증감 배지(stats를 직전 기간으로 한 번 더 조회해 비교), 카드/차트 호버 효과 (`97230f3c`).
- 추가 요소: **신규 사용자** 카드(기간 내 최초 등장, 호버 = 명단), **오류율** 카드(5%↑ 주의, 20%↑ 위험), **체류 시간 분포**(5분 미만~2시간+ 4구간), **자주 나는 오류 TOP**(이벤트 종류별 묶음, 호버 = 대표 사례) (`97230f3c`).
- **`AI에게 묻기`** — 화면에 로드된 집계(기간/요약/직전기간/일별/사용자·팀 TOP/버전분포/오류종류/구버전/신규)를 9KB 상한으로 압축 요약해 질문과 함께 보냅니다. 앱 채팅과 **같은 AI 서버·설정을 그대로 재사용**(같은 출처 `localStorage`)하므로 F9에서 서버를 바꾸면 따라갑니다. "데이터만 근거로, 없으면 없다고" 시스템 계약 + think 태그 제거, 프리셋 질문 4종 (`97230f3c`).
- **사용자 표기 = `이름(마당아이디)`** (세션·사용자·오류 표, 사용자 랭킹 차트, 사용자 셀렉트 전부. 원래 계정은 호버로, 조직 정보 없는 사용자는 종전 표기). **소속 필터를 조직 경로 전 계층으로** — 팀만이 아니라 센터/Lab/팀 어느 계층을 골라도 그 아래 소속 전체가 걸립니다(전원 공통인 회사 레벨 제외, 깊이 들여쓰기) (`f2390900` · `1326542f`).
- **팀별 사용 랭킹** 차트(실행 횟수·인원, 막대 클릭 = 그 팀 필터)와 **구버전 사용** 카드(버전 게이트 허용 목록 × 사용자별 최신 세션 버전 대조 → 교체 안 한 사람 수, 호버 = 명단). 게이트 정보를 못 가져오면 카드를 생략해 잘못된 0을 만들지 않습니다. 세션 표에서 허용 목록 밖 버전은 빨강 강조 (`f2390900`).

### 수정 — 세션 상태 '수집 중' 고착

- 대시보드 세션 상태가 거의 전부 `수집 중` 이었습니다. `/api/app/shutdown` 이 응답을 **먼저** 보내고 0.5초 뒤 로그 flush + `session/end` 를 보냈는데, 호스트는 응답을 받자마자 `serverProcess.Kill()` — **X로 닫을 때마다 종료 신호가 유실**됐습니다. 종료 신호·잔여 로그 전송을 응답 **전**으로 옮기고 소스 순서(stop < respond < exit)를 테스트로 잠갔습니다. 수집기 쪽은 마지막 수신 후 10분 무소식 + 미종료를 `stale`(끊김)로 보아 크래시·전원꺼짐·기존 고착 세션까지 흡수하고, `수집 중` 카드에서도 stale을 제외합니다. 대시보드는 **종료 / 종료(추정) / 수집 중** 3단으로 표시합니다 ([serve_b2b.py](serve_b2b.py), [dashboard.html](dashboard.html), `c3364285`).

### 회귀 테스트

`_test_version_gate.py`(가짜 서버 실측), `_test_version_gate_client.js`, `_test_org_info.py`, `_test_whoami_display.py`, `_test_fkey_help.js`, `_test_llm_usage_capture.py`, `_test_org_dashboard.js`, `../versionTest/test_version_allowlist.py`, `../versionTest/test_token_stats.py`, `../versionTest/test_stale_sessions.py` — `VERSION-GATE-STARTUP` · `ORG-INFO-IN-LOGS` · `FKEY-HELP-F1` · `LLM-TOKEN-USAGE-STATS` · `SESSION-STATUS-STUCK-COLLECTING` 로 등록.

---

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
├── launch_b2b.py           # `index.html` 오픈하도록 변경
├── launch_b2b.spec         # styles/, scripts/, vendor/ 자동 collect
├── serve_b2b.py            # 변경 없음 (정적 + /v1/* 프록시)
├── build_exe.bat           # 변경 없음
├── start_b2b.bat           # 변경 없음
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
- 빌드: `build_exe.bat` 실행 방식 동일. `dist/B2B_업무망.exe` 결과물.
- 실행: `start_b2b.bat` 실행 방식 동일. `http://127.0.0.1:8090/index.html` 자동 오픈.
- 프록시: `/v1/*` → vLLM 서버 프록시 동작 변경 없음.

### 알려진 제한
- `vendor/xlsx.full.js`는 ver1의 `sym2.html` manifest에서 추출한 사본입니다. SheetJS 업스트림 업데이트 시 수동 교체 필요.
