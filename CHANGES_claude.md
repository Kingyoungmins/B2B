# 0.4.11_claude 변경 요약 (테스트 이슈 대응)

0.4.11(`B2B_ver0.4.11`, HEAD `42b75bf`)을 복사해 만든 작업 폴더. Claude+Codex 진단을 종합한
하이브리드 계획대로 **저위험 → 검증 인프라 → 진단 로깅 → UI** 순서로 적용. 전부 `git diff` 로 검토 가능.

원칙: ① 같은 파일은 순차 편집(충돌 방지) ② 사후검증은 비파괴('확인 필요'만, 절대 '오류' 강등 금지)
③ 프롬프트 보강을 검증보다 먼저 안정화.

## 적용한 변경 (파일별)

### scripts/file-schema.js — 프롬프트/스키마 (이슈 2,3,4,6,7,11,12,13,14,15,17)
- **정렬 행 무결성(#4)**: 정렬 절을 "표 전체 열 포함 범위로 한 번에 Sort, Header:=xlYes" 정석 + 키열만 정렬 금지 경고로 교체.
- **삽입/삭제(#11,15,14)**: 작업원칙에 `Columns("J").Insert`(임의위치), `Rows(5).Insert`(전체행, 단일셀 Insert 금지), `ClearContents` vs `Clear` vs `Delete` 의미 구분 추가.
- **값/수식 복사·작성(#6,7,17)**: 복사 절을 케이스 분기로 통합 — 기본=수식+서식 복사, "값만"=`.Calculate` 후 `.Value2`(소스 미계산 시 빈값 방지, #6), 수식 쓰기=`.NumberFormat="General"` 후 `.Formula`(`.Value` 에 "=" 문자열 금지, #17).
- **열문자 우선/매핑(#2)**: 헤더 섹션에 "사용자가 'T열' 처럼 열문자 지정 시 그 열문자 그대로 사용, 모호하면 Err.Raise" 규칙 + `_describeFile` 가 시트마다 **[열문자=헤더명] 매핑** 출력(`_colLetter` 헬퍼 추가).
- **편집 컨텍스트 언어 버그(#3,13)**: `buildEditingContext` 가 기존 코드를 ```python 펜스로 감싸던 것을 실제 단계 언어(VBA)로 표기하도록 수정(0.4.11은 VBA 엔진).
- **집계 화이트리스트(#12)**: 텍스트 매칭 절에 "지정 항목 합산은 Trim 정확일치만, 열거 안 된 유사 라벨 InStr 부분일치로 포함 금지" 규칙 추가.

### serve_b2b.py — VBA 사전검증 오탐 수정 (이슈 16) ★실사용 재현
- `_validate_vba_source_before_inject` 의 "줄 끝 식 미완성" 정규식이 단어 연산자(`And/Or/Xor/Mod`)를 \b 단어경계 없이 검사해, **`Exit For`(끝이 'or')·변수명 `color/vendor/cursor` 등 정상 코드를 컴파일 오류로 오탐**하던 버그 수정. 기호 연산자와 단어 연산자를 분리하고 단어 연산자에 \b 적용. (실제 "매출 채워" 스킬이 56행 `Exit For` 에서 막힌 케이스)

### serve_b2b.py — 적용 사후검증 인프라 (이슈 1,16,14, 보조 4/9/13)
- `_change_probe(app, target_wb)` / `_diff_change_probe(before, after)` 추가: VBA 실행 전후로 쓰기가능 워크북 + **대상 워크북(ReadOnly여도 항상 포함)** 의 시트 스냅샷을 떠 `changedCells/sheetsAdded/sheetsRemoved` 계산(셀 10만 cap, best-effort).
- `_run_vba_on_session_impl` / `_run_vba_pipeline_on_session_impl` 가 응답에 `verify` 를 실어 보냄. **실패해도 적용은 성공으로 두고, changedCells==0 을 서버가 오류로 만들지 않음**.

### scripts/pipeline.js + styles/pipeline.css — 결과 표시 (이슈 1,16)
- 단일 step 적용 성공 경로에서 `data.verify` 확인 → 변경 0건이면 '적용됨' 대신 **'변경 없음 · 확인 필요'**(`review` 상태, 주황 배지, 비파괴) + 토스트/시스템 메시지. verify 없으면(검증 불가) 기존대로 '적용됨'. **'오류'로 강등하지 않음**(#16 양방향 안전). 파이프라인 경로는 verify 를 반환만 하고 상태 강등은 안 함(멱등 재적용 오탐 방지).

### scripts/chat-ui.js + styles/chat.css — UI/중단/스크롤/로깅 (이슈 5,10,18,20)
- **스크롤(#20)**: `scrollChatToBottom` 을 stick-to-bottom 으로 — 사용자가 위로 스크롤하면 자동 스크롤 보류(스크롤 워처 + 맨아래 근처 판정). 사용자 본인 메시지는 강제 스크롤.
- **중단 분리(#10)**: think 모드에서 '생각 중단'(thinking 끊고 Think 없이 자동 재요청) / '요청 중단'(전체 종료) 두 버튼. think 아니면 기존 단일 '중단'. `showThinkRetryPrompt` 에 `autoStart` 추가.
- **#18 가시성**: 가드 차단 시 안내/강제적용 버튼을 강제 스크롤로 항상 보이게 + 로그.
- **#5 진단 로깅**: 전송마다 reqId 부여, 렌더 시점 로그.

### scripts/llm-api.js — #5 진단 로깅
- `callOpenAICompat` 재전송(attempt>1) 경고 로그 + 응답 길이 로그(서버 중복 vs 표시 중복 구분용).

## 2차 (코덱스 비교 후 합의 항목 반영)

### scripts/chat-ui.js — #5 인플라이트 락
- `sendChat` 에 `window.__b2bChatInFlight` 락 추가. 처리 중에는 버튼/Enter 재입력을 "이전 요청 처리 중"으로 막고, 해제는 finally 단일 지점(완료/오류/중단 공통). (top 체크~첫 await 사이 동기 코드라 재진입 불가.) `[B2B#5]` 로그와 병행해 잔여 중복(서버 재전송/스트림 중복)도 추적.

### scripts/llm-api.js — #12 temperature 정책 + #3/#12 정정 우선
- temperature: 기본 낮게(0.2) 유지 + `options.temperature` 오버라이드 지원, **seed 는 일부러 박지 않음** → 재요청/재생성 시 다른 시도가 나올 여지 유지(사용자 선택: "기본 낮게+재생성 다양"). 코덱스의 전역 seed 고정은 채택하지 않음.
- `_looksLikeCorrection()` 로 최신 메시지가 정정으로 보이면 시스템 프롬프트에 "사용자 정정(최우선)" 블록을 덧붙여, 이전 코드/해석(특히 잘못 고른 열·조건)을 고집하지 않고 정정을 최우선 반영하도록 강화(정정일 때만 → 무관 요청 과가중 방지).

### #19 작업 중단 — 안전형 (채팅 가시버튼 + 스냅샷/리셋 복귀)
- **scripts/excel-mirror.js + styles/components.css**: `position:fixed` 좌측 하단 "■ 작업 중단" 버튼. 네이티브 셸에서 우측은 실제 Excel top-level 오버레이라 그 위 HTML 이 가려지므로, 가려지지 않는 채팅(WebView2) 영역에 배치. `beginExcelMirrorApplyLoading`/`endExcelMirrorApplyLoading` 에서 표시/숨김.
- **scripts/pipeline.js**: `applyVbaStepToLiveExcel` 에 취소 토큰(`window.__activeVbaApply`) 등록. `requestExcelApplyCancel()` 은 진행 단계를 파이프라인에서 제거하고, 원본 리셋+남은 enabled 스텝 재적용(`reapplyVbaPipelineToLive`)으로 **이전 정상 상태로 안전 복귀**. 취소된 적용의 (지연된) 성공/오류 결과는 토큰으로 무시.
- **한계(명시)**: 서버 VBA 는 `EXCEL_LOCK` 동기 `app.Run` 이라 실행 중 매크로를 즉시 인터럽트하는 것은 불가. 그래서 "인터럽트"가 아니라 "결과 무시 + 리셋 복귀"로 안전성을 보장(매크로의 부분 변경은 재적용이 덮어씀). EnableCancelKey/SendInput 기반 강제 인터럽트(코덱스 풀버전)는 불안정+디버거 억제정책 충돌로 채택하지 않음.

## 3차 (실사용 버그: 매출 칸에 회사명이 들어감)

### scripts/file-schema.js — 배열 열폭 ↔ 범위 열폭 일치 규칙
- 증상: 생성된 VBA 가 매칭용으로 A:B(회사명+매출) 2열을 한 배열로 읽고, 그 2열 배열을 매출 1열 범위에 대입 → Excel 이 배열의 **첫 열(회사명)** 만 써넣어 **매출 칸에 회사명**이 들어가고 마진 수식이 #VALUE! 가 됨.
- 수정: VBA_SYSTEM_PROMPT 벌크 입출력 절에 "쓰는 배열의 열 개수와 대상 범위의 열 개수가 정확히 같아야 한다(2D 배열을 더 좁은 범위에 대입하면 첫 열만 들어감). 매칭은 여러 열로 하더라도 쓸 때는 대상 열만 담는 1열 배열(ReDim outArr(1 To n, 1 To 1))로 쓰거나 셀단위로 쓰라"는 규칙 + 예시 추가.
- 검증: 같은 "매출 채워" 프롬프트 3회 재생성 → 3/3 모두 `ReDim outArr(.,1 To 1)` 1열 쓰기로 생성, 검증기 통과(이전엔 2열→1열 버그 변형이 나왔음). 비결정성(#12)은 남지만 안전 패턴 비율이 크게 올라감.
- 한계: 사후검증(#1)은 "값이 바뀌었는지"만 보므로 "엉뚱한 값(회사명)이 들어감"은 못 잡음 → 이런 의미적 오류는 프롬프트 예방이 1차 방어.

## 미적용/추가 검토 필요 (의도적 보류)
- **#5 실제 수정**: 위 로그로 원인(서버 2회 생성 vs 표시 2회) 확인 후 결정.
- **#12 결정성**: temperature 0/seed 는 "같은 오답 반복" 위험이 있어 미적용(프롬프트 화이트리스트만 적용). 필요 시 집계류에 한정 권장.
- **#3 대화 리셋**: "잊고 다시 시작" 감지/히스토리 트림은 오탐 위험으로 보류(열문자 우선 + 편집펜스 수정으로 부분 완화).
- **#8/#9 reset 의미론**: 코드 구조 변경은 회귀 위험 최대 → 프롬프트 강제(복사/정렬 절)로만 완화. 서버 reset 의미론은 손대지 않음.
- **#19 작업 중단/안전복귀**: COM `app.Run` 동기 + `EnableCancelKey=0` + `EXCEL_LOCK` 직렬화라 fetch abort 로 못 멈춤. 체크포인트 스냅샷 + 서버 취소 API + 복구가 필요해 별도 설계 후 진행 권장(가장 복잡).

## 검증
- JS 5개 `node --check` 통과, serve_b2b.py `ast.parse` 통과(BOM/CRLF 보존).
- 회귀 주의: 사후검증 false-positive 는 모두 비파괴('확인 필요')로만 표기. 대상 워크북은 ReadOnly여도 probe 에 항상 포함(매 적용 오탐 방지).

## 헤드리스 테스트 결과 (창 안 띄움, test_data + 개발망 vLLM localhost:8016 Qwen3.5-27B-FP8)
정적 로직(실제 코드 함수 추출 실행):
- VBA 검증기: '매출채워'(Exit For/Next/Do-Loop/단일행 If) 통과, Exit For/Do/`Dim vendor`/`x = color` 오탐 제거, 진짜 오류(연산자 끝/Or 끝/As 빈자료형/Next 없는 For) 정상 차단. → **#16 거짓차단 해소 확인.**
- `_diff_change_probe`: 무변경→changedCells 0, 1셀→1, 새시트→sheetsAdded 1, probe 실패→None(검증불가). → **#1 사후검증 로직 정상.**
- `_colLetter` 1→A/20→T/24→X/27→AA 정확. `_looksLikeCorrection` 정정 5/5 감지·일반 4/4 무오탐.
- 서버 헤드리스 부팅 + `/api/backend/health` ok(openpyxl/excelCom/node true). → serve_b2b.py 편집이 기동 안 깸.

스킬 생성(실제 VBA_SYSTEM_PROMPT + test_data 스키마로 vLLM 호출, 생성물 검증기 통과 확인):
- **정렬(#4)**: `ws.Range(ws.Cells(hdrRow,1), ws.Cells(lastRow,lastCol)).Sort ... Header:=xlYes`, keyCol 헤더로 탐색 → 전체 열 행단위 정렬(행 무결성).
- **열문자(#2)**: "C열 기준" → `keyCol = 3 ' C 열 (원가)` + 전체범위 정렬 → 사용자가 준 열 문자 그대로 사용.
- **열삽입(#11)**: `ws.Columns("B").Insert Shift:=xlToRight`.
- **행삽입(#15)**: `ws.Rows(5).Insert Shift:=xlDown` (단일 셀 아님).
- **매출채워(원래 실패 케이스)**: 검증기 통과, `Workbooks("input_...").Worksheets("매출")` 교차참조, salesCol 헤더 탐색, **매출 열 범위만 기록**(원가/마진 수식 열 보존), 못 찾으면 Err.Raise.
- 5개 중 매출채워 1차는 90s 타임아웃(하니스 한계) → 150s 재시도 통과. 생성된 모든 VBA가 검증기 통과(거짓 차단 0).

라이브 Excel 의존 경로(#3 사후검증 표시, #19 취소/복귀, 미러 동작)는 창/Excel 없이는 기능 검증 불가 → GUI 수동 테스트 필요(로직 단위는 통과).

---

## 0.4.13.1 (2026-06-10) — 탭 전환 UX 3종 수정 (회색 플래시 / 작업표시줄 유령 / 버벅임)

증상: ① 탭 전환 시 회색 엑셀이 잠깐 보였다 사라짐 ② 작업표시줄에 파일 수만큼 빈 회색 Excel 버튼 ③ 전환이 alt-tab처럼 즉각적이지 않음.

근원인:
- (②) 파일마다 별도 Excel 프로세스(owner 모드)인데 XLMAIN의 WS_EX_APPWINDOW를 안 떼서 owner가 있어도 작업표시줄 버튼이 강제 표시.
- (①) 첫 방문 탭은 클릭 시점에 Excel 콜드 부팅(lazy open) + show가 페인트 준비(ScreenUpdating/워크북 뷰) 전에 실행 → 빈 회색 프레임 먼저 표시. 매 전환마다 SWP_FRAMECHANGED 전체 리드로우 + SW_SHOWNORMAL이 배경 창을 활성화하며 위로 튀어나옴.
- (③) 탭 클릭마다 scheduleExcelMirrorPosition(true)가 모든 세션을 강제 재배치(COM 폭풍, EXCEL_LOCK 직렬화) + 전환이 position→raise→베이스라인 폴(시트 스냅샷)을 순차 await.

수정(serve_b2b.py):
- `_suppress_excel_taskbar_button()` 신설: WS_EX_APPWINDOW 제거(owner 실패 시 TOOLWINDOW 폴백). 적용 지점: open(라이브)×2, replace(라이브), position 재확인, raise, _restore_live_window.
- open(라이브): show 전에 ScreenUpdating=True + 워크북 뷰 켬(회색 프레임 방지). `background=True` 오픈 지원(rect 배치만 하고 숨김 — 사전 오픈용).
- `_position_excel_window`: SWP_NOACTIVATE 항상 적용, SWP_FRAMECHANGED는 스타일이 실제 바뀐 호출만, SW_SHOWNORMAL→SW_SHOWNA(+IsIconic→SW_RESTORE).
- `/api/excel/hide`에 `light` 모드: 제자리 SW_HIDE만(rect/스타일 유지) → 다음 raise 한 번으로 즉시 복귀.
- raise 시 owner+억제 재보장, hidden=False 동기화.

수정(scripts/excel-mirror.js):
- 탭 클릭 래퍼의 scheduleExcelMirrorPosition(true) 제거(재배치 폭풍 — 리사이즈 리스너가 이미 커버).
- 전환: raise 후 비활성 세션 light-hide(fire-and-forget), 베이스라인 폴 비대기.
- `ensureExcelMirrorSession({background:true})` + 업로드 후 나머지 탭 백그라운드 사전 오픈(preopenAllExcelMirrors) → 첫 전환도 부팅 없이 즉시. 결과(open-result) 파일은 사전 오픈 제외.

기대 동작: 전환 = raise 1왕복(+이전 창 비동기 숨김), 작업표시줄에 Excel 버튼 0개, 회색 플래시 없음.
트레이드오프: 업로드 직후 백그라운드에서 나머지 파일의 Excel 프로세스를 순차 기동(파일당 수 초, 그동안 폴/전환이 잠깐 느릴 수 있음, RAM 파일당 ~수십MB).

### 추가 수정 (같은 날) — 스킬 적용 후 회색 엑셀 1회 플래시
적용 후 결과 반영 경로 3곳이 여전히 "페인트 준비 전 show" 패턴이었음 → 탭 전환과 동일하게 reorder:
- `_replace_excel_session_workbook_impl` live 분기(결과 파일 교체 — Python 엔진 주 경로): show 전에 ScreenUpdating=True + 워크북 뷰 켬.
- `_position_excel_session_impl`: 숨김(hard-hide) 상태에서 재표시할 때 ensure-view 를 position(show) 앞으로.
- `_restore_live_window`(VBA 엔진 적용 후 복원): ensure-view 를 position(show) 앞으로.
