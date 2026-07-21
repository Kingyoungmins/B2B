# 43. 실행기 매핑이 rename '목적지' 리터럴까지 치환해 스텝이 터진 회귀 (SBAGENT-198)

## 증상
- "첫 시트 이름을 sheet1 로 변경" 스킬이 0.5.18 에선 정상, 0.5.19/0.6.0 실행기에서 Step 실패.
- 실패하면서 `excel_open_<hash>.xlsb` Excel 창이 화면에 뜸(실행기는 headless 인데).
- 매핑 패널: 칩 `sheet1` ↔ 드롭다운 `<32자해시>_<파일명>`(31자 초과) "AI 자동매칭".

## 원인 (3중)
1. **생성시트 감지의 Python 변수 사각지대** — `runnerExtractGeneratedSheetsFromCode` 는
   rename/add 의 '인라인 리터럴' 인자만 인식. `new_name = "sheet1"` 대입 후
   `book.rename_sheet(old_name, new_name)` 변수 호출은 못 잡음(VBA 쪽엔 `v="X"` → `.Name = v`
   변수 해석이 있었는데 Python 엔 없었음). → "sheet1" 이 생성시트로 등록 안 돼
   후속 스텝 `targetSheetName` 메타를 타고 '필요 시트' 요구로 등록됨.
2. **자동매칭도 치환 대상** — `buildRunnerMappedPipeline` 의 행 필터는 `row.fileItem` 뿐
   (userSet 게이트 없음). 단일시트 폴백(`sheets.length===1`)이 `sheet1`↔실제 시트명을 짝지어
   `runnerReplaceLiteral` 이 **모든 스텝 코드의 따옴표 리터럴을 전역 치환** →
   rename 목적지 `new_name="sheet1"` 까지 59자 이름으로 바뀜.
3. **rename_sheet 무검증** — 새 이름을 그대로 COM 에 넘겨 31자 제한(0x800A03EC)으로 실패.
   시트 '생성' 경로들([:31] 절단)과 정책이 달랐음.

창 노출: 실패 → 자동복구 catch → `restorePipelineToCheckpointAndHold` → `/api/excel/replace`
경로만 runnerHeadless 가드가 없어 백엔드 `_replace_excel_session_workbook_impl` 이
`app.Visible=True` + 프레임 표시. 게다가 실행기 파일출력 전체실행은 라이브 무손상인데
이 복원이 라이브를 격리 실행 '중간 스냅샷'으로 교체까지 함.

## 수정 (0.6.0, b513c2d)
- drop-handling.js: Python 리터럴 변수 해석 추가(단독 대입 맵 → rename/add 변수 인자 해석,
  수신자 ctx/ctx.book("X")/book변수 스코프, `new_name=` kwarg 포함).
- serve_b2b.py rename_sheet: 새 이름 [:31] 절단(생성 경로와 동일 정책). 긴 이름 조회는
  `_ws` 절단 폴백이 이어받아 자기일관.
- pipeline.js 자동복구 catch: `excelMirror.runnerHeadless` 면 체크포인트 복원 스킵.

## 교훈
- **'읽을 시트' 요구와 '만들 시트'(rename/add 목적지)는 다르다.** 매핑 요구 추출은 생성물을
  먼저 빼야 하고, 생성물 감지는 리터럴뿐 아니라 **변수 경유 호출**까지 커버해야 한다
  (LLM 생성 코드는 `old_name/new_name` 변수 스타일을 즐겨 씀).
- 전역 리터럴 치환(runnerReplaceLiteral)은 위치 무차별이라, 요구 등록 단계에서 못 거르면
  치환 단계에서 막을 방법이 없다 — 게이트는 상류(요구 추출)에.
- headless 가드는 '표시 함수' 안에만 있으면 부족하다. **백엔드를 부르는 우회 경로**
  (/api/excel/replace 처럼 서버가 창을 띄우는 API)마다 호출부 가드가 필요.
- 버전 회귀 조사는 "이전 버전엔 그 기능이 아예 없었다"(grep 0건)가 가장 강한 증거.
