# 45. HTTP 스레드에서 COM 호출 → 위장/보안 파일 시트명이 '파일명'으로 (2026-07-21)

## 증상
DRM(AIP/Softcamp) 문서를 열어 만든 스킬을 실행기에서 원본 파일로 돌리면 **step1 부터**
`시트를 찾을 수 없음`. 스킬이 요구하는 파일/시트(a.xlsx / 가입자 가입번호)는 화면에 정상 표시되는데,
업로드한 파일의 **시트 목록에 실제 시트명 대신 '파일명'** 이 한 개 들어 있었다.

## 근본원인 — DRM 이 아니라 스레드 초기화 누락
`inspect_workbook(path)` 는 openpyxl 실패 시 Excel COM 으로 재검사한다(2회 재시도).
그런데 이 호출이 **HTTP 워커 스레드에서 직접** 일어났고, 그 스레드는 `CoInitialize` 를 부른 적이 없다.
→ `DispatchEx("Excel.Application")` 가 **항상** `-2147221008 'CoInitialize가 호출되지 않았습니다'` 로 실패.

즉 '가끔 Excel 이 바빠서'가 아니라 **openpyxl 로 못 읽는 파일이면 100%** 폴백으로 떨어졌고,
`inspect_workbook_fallback` 이 `csv_sheet_name(path)`(= 파일명)을 시트명으로 지어냈다.
주석에 적힌 "requiresExcel=True 라 이후 실제 스키마로 대체됨" 은 **소비하는 코드가 없어 지켜진 적이 없다.**

실측 재현(한전 02번 = OLE 위장 xlsx, 앞 8바이트 `d0cf11e0`):
- 수정 전 업로드 → `sheetNames: ['test']` (= 업로드 파일명), `requiresExcel: True`
- 수정 후 업로드 → `sheetNames: ['Sheet1']` (Excel 이 읽은 실제 시트명)

## 왜 매핑이 망가졌나 (2차 피해)
`runnerFindSheet` 마지막 줄 `sheets.length === 1 ? sheets[0] : ""` — "시트가 하나뿐이면 당연히 그거".
자리표 목록에 딱 하나 있던 '파일명'이 채택돼 **스킬의 올바른 시트명을 파일명으로 치환**했다.
같은 줄이 '스킬이 만드는 새 시트' 요구에서도 엉뚱한 원본 시트를 물어오는 방아쇠였다(교훈 하단).

## 수정
1. **COM 은 CoInitialize 를 보유한 전용 워커에서만** — `excel_call(inspect_workbook_with_excel, ...)`
   로 마샬링. 워커 스레드 자신이 호출한 경우엔 큐에 넣으면 자기 자신을 기다려 데드락 → 직접 실행 가드.
2. 그래도 못 읽으면 `requiresExcel` → 레코드 `sheetNamesUnreliable` 로 전달하고,
   러너는 단일시트 자동채택을 건너뛴다 → 기존 `autoSkillDefault` 가 **'스킬 기본값(그대로 실행)'** 으로
   잡아 치환 없이 스킬 원래 시트명으로 실행(생성 시트라면 그 이름이 언제나 정답).
3. `/api/workbooks/reinspect` — 매핑 화면 진입 시 재시도(업로드 순간 Excel 바쁜 경우 구제).
4. `applyLiveSchemaToFileCache` — 라이브 실제 스키마가 오면 자리표 해제
   (안 풀면 스킬이 만든 새 시트가 목록에 보여도 계속 기본값에 묶여 사용자가 고를 수 없다).

## 함께 고친 것 — 생성 시트 오매칭
`runnerIsGeneratedSheet` 는 **(책, 시트) 쌍이 모두** 맞아야 생성시트로 본다. 교차파일 스킬은
만든 책과 참조하는 책의 이름 해석이 갈려 생성시트가 요구 목록으로 샌다. 실물 전수조사(11종) 결과 3종:
- KGM `202605_SS001643_ENTR_BY_STACC_P` (만든 책 KG모빌리티… vs 참조 책 원본_DSMC…)
- UCAP `VIEW` (`output)…` vs `input)…`)
- 한전 v4 zip(핸들 미복원 상태) 무선간선망/고압모계기/고압자계기

보수적 수정: 요구 추출·생성시트 판정은 그대로 두고 **'단일시트 추측' 한 가지만** 끈다
(요구 시트 이름이 이 스킬이 만드는 시트 집합에 있으면 추측 포기 → 스킬 기본값).
정확/정규화 일치는 살아 있어 **실행이 끝나 시트가 실제로 생긴 뒤엔 다시 정상 매칭**된다.

## 교훈
- **COM 은 스레드 지역(apartment) 자원이다.** 새 코드에서 `win32com` 을 부르기 전에
  "이 코드가 어느 스레드에서 도는가"를 먼저 물어라. HTTP 핸들러/타이머/콜백은 전부 위험하다.
- **"나중에 대체됨" 주석은 소비 코드가 있어야 사실이다.** 플래그를 세팅만 하고 읽는 곳이 없으면
  그건 설계가 아니라 미완성이다(`requiresExcel` 이 정확히 그랬다).
- **'하나뿐이면 그거겠지' 류의 추측은 입력이 오염됐을 때 가장 크게 틀린다.** 추측 자체를 없애기보다
  '입력을 믿을 수 있는가'를 플래그로 갈라 추측만 끄는 편이 회귀가 적다.
- 회귀: `diagnostics/_test_unreliable_sheet_names.js` (15케이스), 레지스트리
  `SHEETNAME-PLACEHOLDER-DRM`. 실물 전수조사 탐침은 scratchpad `probe_generated_sheets.js` 패턴 참고.
