# v0.5.10 교훈: 라우팅이 @멘션 파일명 키워드와 충돌 (단순작업이 VBA로 샘)

정리 기준일: 2026-06-22

## 증상
`@범위[output_HCN…_LG작성.xlsx/SO사업자별요금!H90:H104] 셀 삭제` 처럼 **단순 셀/범위 삭제**를 요청했는데,
프롬프트 규칙("간단한 셀/행/열 추가·삭제는 Python COM")과 달리 **VBA로 생성**되고, 그 VBA가 `On Error Resume Next`를
포함해 **"안전 재생성"**까지 도는 현상.

## 원인 (코드로 입증)
1. **라우팅 키워드 충돌(진짜 버그)**: `shouldRouteSimpleStructureEditToPython` 등 라우팅 함수가 **메시지 전체**를
   키워드 매칭한다. 그런데 `@범위[...]` 안의 **파일명** `output_…_LG작성.xlsx` 의 **"작성"** 이 simple→Python
   **제외어 목록**(`…|입력|작성|채워|가져` — scripts/chat-ui.js)에 걸린다. → 단순 삭제인데 "복잡 작업"으로 오분류 →
   `simple→Python = false` → `routeVba/routePython` 둘 다 false → **강제 엔진 없음 → 기본 엔진으로 떨어짐**.
   - 영어 부분문자열도 위험: 조건어 정규식의 `and|or|if` 가 파일명/단어의 부분문자열(`report`의 `or` 등)과 충돌 가능.
2. **5.10 기본 엔진 변경(트리거)**: 5.10부터 **기본 스킬 엔진이 VBA**(`DEFAULT_SKILL_ENGINE="vba"`, config.js). 이전(≤0.5.9)엔
   기본이 Python이라 **같은 오분류여도 기본값(Python)으로 떨어져** 단순 삭제가 우연히 Python으로 갔다. 5.10에서 기본이
   VBA가 되면서 **잠복해 있던 라우팅 오분류가 "왜 VBA?"로 표면화**됐다.
3. **안전 재생성은 버그 아님**: VBA로 간 뒤 모델이 1차 출력에 `On Error Resume Next`(금지어, 실패를 "적용됨"으로 오보)를
   써서 정적 게이트가 자동 재생성으로 교정한 것. 정상 동작이며, 라우팅을 고치면 이 요청은 VBA 경로 자체를 안 탄다.

## 처방 (적용)
- 라우팅 의도 판정을 **@멘션 내용을 제거한 "의도 텍스트"로** 한다. `routingIntentText(t) = t.replace(/@(?:범위|컬럼|시트)\[[^\]]*\]/g, " ")`.
  - `shouldRouteSimpleStructureEditToPython` / `shouldRouteRequestToVba` / `shouldRouteRequestToPython` 의 **키워드/조건/제외어 정규식은 intent(제거본)** 로 검사.
  - **대상 '존재' 판정만 원문**: `@범위[...]` 유무, `rangeRefs` 개수, `explicitColumns`(`!H:H]`), `colRefs`(@컬럼 멘션 포함)는 원문 `t` 그대로(파일명과 충돌 안 함).
- 검증: `test_runs/_test_routing_cause.js` 10/10 — 신고 케이스 → Python(`ctx.clear`), 회귀(피벗/시트전체 교차파일 복사/명시적 VBA/매칭+합산 복합)는 VBA 유지.

## 유지 기준
- 라우팅·정적검사 등 **사용자 의도를 키워드로 판정하는 로직은 항상 @멘션(파일명/시트명/범위)을 제거한 텍스트로** 매칭한다. 파일명에는 업무 단어(정산/작성/복사/계산…)와 영어 토큰(and/or/if)이 흔하다.
- 기본 엔진을 바꾸면(예: Python↔VBA) **기존 라우팅 오분류가 다른 방향으로 표면화**될 수 있다. 기본값 변경 시 라우팅 회귀 세트를 같이 돌릴 것.
- "단순 작업이 VBA로 샌다" 류 신고는 (1) 라우팅이 그 메시지를 어떻게 분류하는지(simple/vba/python), (2) 기본 엔진이 뭔지부터 본다.

## 부차 발견 (미수정)
- 맨 A1 범위 `H90:H104`는 `@범위`/`열:열`/`행:행`/"선택" 표기가 없으면 `hasDirectTarget`에 안 잡힌다. @멘션으로 주면 인식되므로 이번 건의 주원인은 아님. 필요 시 `[A-Z]{1,3}\d+\s*:\s*[A-Z]{1,3}\d+` 패턴 추가.

## 관련
- `01_project_readme_changelog.md`(엔진 선택/기본값), `04_vba_regression_checklist.md`(생성 품질), `06_vba_full_run_investigation.md`(VBA 경로).
> 출처: 2026-06-22 라우팅 오분류 조사 세션에서 신규 작성(단일 원본 복사 아님).
