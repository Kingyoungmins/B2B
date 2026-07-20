# v0.5.10 교훈: VBA 기본 전환의 코드품질 트레이드오프 — few-shot 레시피 + 명시적 엔진 최우선

정리 기준일: 2026-06-23

## 증상

0.5.10에서 기본 엔진을 VBA 로 바꾼 뒤 프로그램이 멈추는(freeze) 일은 크게 줄었지만,
**코드 생성 품질이 떨어져 에러가 잦아졌다**(컴파일 오류·1004·데이터 불일치 등).

## 원인 (조사 결론)

"엔진을 바꾼 것" 자체보다, VBA 기본화하면서 **Python 이 갖고 있던 안전망이 같이 꺼진 것**이 핵심이다.
1. 모델(ixi/Qwen3.6-27B)이 Python 보다 VBA 를 약하게 쓴다(학습 데이터 편중) + VBA COM 함정이 많다.
2. VBA 파이프라인은 **정적게이트 자동복구를 통째로 스킵**(`pipeline.js` runVbaPipeline 분기, "느려서") →
   갓 생성한 미검증 VBA 가 거의 무검증으로 1차 적용된다.
3. 런타임 실패 시 재생성 프롬프트가 **실제 시트/헤더/데이터를 못 보고** prompt/code 만 보고 같은 추측을 반복 →
   1004/subscript 류 '데이터 불일치'에서 재시도 한도(Step당 2/전체 3)를 헛되이 소진한다.

즉 안정성은 "단일 STA COM 워커가 셀단위 루프에 멈추던 freeze 를 VBA 라우팅으로 회피"해서 얻었고,
대가로 "모델 오답률 높은 엔진을 약한 검증으로 1차 적용"하게 되어 에러 노출이 늘었다.

## 처방 (이번에 적용 — 안정성 구조 무손상, 가산 변경)

### (1) 자주 틀리는 VBA few-shot 레시피 (비차단, 순수 업사이드)
`scripts/file-schema.js` VBA_SYSTEM_PROMPT 에 "자주 틀리는 VBA — 나쁜→좋은 예" 섹션 추가:
표 전체 배열 재기록→매칭 행만 / `Continue For` 금지 / 바운드 Insert→전체열 / `For Each` 키변수 Variant /
선행 0 보존. **정적검사(차단) 룰은 추가하지 않았다** — 과거 오탐으로 정상 작업을 막은 전례
(`17_*` no-op 가드, 이후 변경없음 검증 전면 제거)가 있어, 비차단 프롬프트 안내를 우선했다.

### (2) 사용자가 python/COM 을 명시하면 최우선 (채팅 + 에러복구창)
`scripts/chat-ui.js` 에 `userExplicitlyRequestsPython` 추가. "python/파이썬/COM …으로 짜/작성" 의도면
VBA 기본값·휴리스틱보다 **우선해 Python 으로 생성**한다. 5개 가산 변경:
- 메인 채팅 라우팅: `explicitPython = !explicitVba && userExplicitlyRequestsPython(msg)` → `routeToPython` 강제.
- 전용 routingHint(반드시 `def transform(ctx)` 만).
- 위험작업(중복행삭제·다중매칭)이라도 명시 python 이면 `pythonComMustUseVbaReason` 의 VBA 강제전환을 우회.
- 에러복구창: 복구 메모/원요청에 python·COM 명시면 기본 VBA 복구를 덮고 python 복구.
- **안전망 유지**: python 이 임계횟수 실패하면 기존 `vbaRuntimeSwitch` 가 VBA 로 되돌린다
  → "어차피 복구는 VBA"라는 전제와 일치, 무한루프 없음. **명시 안 했을 때는 전부 기존 동작 그대로**(가드).

## 보류 (후속, 코덱스 영역이라 조율 필요)

조사에서 ROI 높게 나온 두 가지는 다음 단계로 남겼다:
- **(b) 재생성 프롬프트에 실제 시트/헤더/used_range 요약 주입** — 현재 최대 누수(데이터 못 봐 같은 오답 반복).
  + 신규 생성 VBA 한정 정적게이트 1회 + 재시도 한도 소폭↑. 단 기존 가드(매크로비활성 즉시 throw,
  복붙캡처 제외, 검증스킬 스킵)는 보존해야 함.
- **(a) 하이브리드 라우팅 — 부분 구현됨(2026-06-23)**: ctx 헬퍼가 결정적인 작업(시트 복사/복사후 이름변경/추가/삭제,
  단순 정렬)은 Python(ctx) 우선으로 라우팅한다(`sheetOpIntent`/`ctxSortIntent`/`ctxHelperPreferredIntent` +
  shouldRouteRequestToVba/Python + routingHint, Python 프롬프트 ctx API 머리에 "헬퍼 있으면 ctx 우선" 명시).
  헬퍼 없는 복합/매칭/대량 루프(중복행 삭제·다중값 매칭 합산)·필터/피벗은 안정성 위해 VBA 유지(나머지는 후속).
  **교차파일 시트 복사도 Python(ctx.copy_sheet/dst_book)으로 보낸다(2026-06-23 재변경).** 처음엔 VBA로 되돌렸으나,
  실패 원인이 "모델이 한글 파일명에 공백을 끼움"(`기업DW추출`→`기업 DW 추출`)이라 **VBA `Workbooks()` 정확매칭으로는
  못 고친다**(오히려 실패). 그래서 `ctx.book`/`_ws`/게이트(`exactReferenceFailures`)를 **공백·_·- 무시 정규화 매칭**으로
  보강해 Python 으로 동작시킨다. (`sheetCopyIsCrossFile` 게이트는 제거.) 명시 안 했을 때의 기존 라우팅은 보존(가드).
- **월/날짜 증감(ctx.shift_months, 2026-06-23)**: VBA 헬퍼를 모델이 정규식·시트명에 공백 끼워 깨뜨려서, 백엔드
  결정적 헬퍼 `ctx.shift_months(시트, 범위, delta)` 로 옮기고 `monthShiftIntent` 로 Python 라우팅(자세히는 `19_*`).
- **핵심 교훈**: 모델은 한글 식별자/정규식에 공백을 자주 끼운다. 정확매칭(VBA Workbooks/Worksheets, 게이트)으로는
  못 막으니, (a) 결정적 로직은 백엔드 ctx 헬퍼로, (b) 시트/파일/게이트 매칭은 `normalize_sheet_lookup`(공백·_·- 무시)로 보강.
- (d) Python freeze 자체를 고쳐 Python 기본 복귀 = 안정성 제약과 정면 충돌 → 제외.

## 검증

- `test_runs/_test_explicit_python_routing.js` — 명시 python/COM 감지 + 우선순위(explicitVba 우선) 13/13.
- `test_runs/_test_ctx_helper_routing.js` — 시트 복사/이름변경/추가/삭제·정렬·월증감 → Python(같은파일·교차파일 모두), 복합/매칭 제외 17/17.
- `test_runs/_test_routing_cause.js` — 라우팅 회귀 19/19(교차파일 시트복사 case 는 Python).
- `test_runs/_test_month_shift.py` — 백엔드 `_shift_months_in_text` 실함수 10/10(롤오버·윤년·음수·비패딩).
- `node --check scripts/chat-ui.js`, `scripts/file-schema.js` OK. few-shot 코드펜스 짝수 확인.

## 회귀 방지 기준

- "VBA 에러가 갑자기 다시 잦다" → few-shot 섹션이 프롬프트에서 사라졌는지, 정적검사가 과하게 차단(오탐)하는지 확인.
- "python 으로 짜달라 했는데 VBA 로 나온다" → `userExplicitlyRequestsPython` 가 매칭되는지 + 메인/복구/
  `pythonComMustUseVbaReason` 우회 분기가 살아있는지. **explicitVba 가 먼저라 "vba 말고 python" 같은 부정 표현은 오인 가능**(알려진 한계).
- 안정성 회귀(freeze) → 명시 python 으로 무거운 작업이 가면 멈출 수 있으나, 의도된 트레이드오프이며 복구가 VBA 로 되돌린다.

## 관련

- `scripts/file-schema.js`(few-shot 레시피), `scripts/chat-ui.js`(`userExplicitlyRequestsPython`, 라우팅/복구).
- `19_v0510_text_month_date_shift.md`(같은 계열: VBA 프롬프트 레시피).
- `02_python_engine_risks.md`/`08_v059_freeze_regression_scenarios.md`(Python freeze 배경), `06_vba_full_run_investigation.md`.

> 출처: 2026-06-23 "VBA 기본 전환 후 코드품질 저하" 진단 + (c)·명시엔진 라우팅 적용 세션에서 신규 작성.
