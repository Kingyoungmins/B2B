# 31. 모호 질의 명확화(검증) 에이전트 (v0.5.13)

사용자가 질의를 모호하게 적어 AI 가 엉뚱하게 알아듣는 걸 줄이기 위해, 스킬 생성 **전에** 별도 verifier 가
"이 요청만으로 정확한 스킬을 짤 수 있는지"를 점검하고 필요할 때만 한 번 되묻는다. 단 **빡세게 잡지 않는다.**

## 구조 (chat-ui.js)
- `clarifyVerifierLikelyUnderspecified(text)` — 값싼 휴리스틱. `@범위/@시트/@파일/@컬럼` 멘션, 셀/열 참조,
  또는 구체 동작 동사(합계/정렬/복사/삭제/필터/추출/피벗/병합/이동/계산/매칭/중복/…)가 **하나라도 있으면 통과**(false).
  대상도 동작도 다 빠진 막연한 질의("이거 좀 정리해줘")만 의심(true). → 평범한 요청엔 verifier LLM 호출조차 안 함(지연 0).
- `clarifyVerifierAskIfNeeded(msg)` — 휴리스틱이 의심할 때만 `callLLMOneShot`(별도 호출, 대화 history 안 건드림)에게
  OK/되묻기를 맡긴다. 시스템 프롬프트가 "합리적 추론 가능하면 무조건 OK, 핵심 정보가 없을 때만 한 문장 ASK"로 **관대**하게 지시.
  반환: `null`(통과) 또는 질문 문자열. 파싱 실패/네트워크 실패 시 `null`(막지 않음).
- `sendChat()` 진입부에 삽입: `editTargetId`(수정 모드)·보충 답변 턴·`userExplicitlyRequestsForceProceed` 가 아니고
  모호하면, "🤔 확인 중…" 잠깐 띄운 뒤 질문을 말풍선으로 보여주고 **생성하지 않고 return**.

## 루프·막힘 방지 (핵심)
- 되묻기 시 `window.__b2bClarifyPending = { original: msg }` 저장 + 인플라이트 락 해제(사용자가 바로 답하게).
- 다음 입력(보충 답변) 턴: `clarifyPending` 가 있으면 `msg = 원질의 + "\n\n[사용자 보충 설명] " + 답변` 으로 합치고
  **그 턴은 verifier 를 건너뛴다**(재질문 금지). 합친 텍스트로 라우팅/프롬프트를 구성하되 화면엔 답변만 표시.
  `callLLM(prompt)` 이 prompt 를 user 턴으로 history 에 push 하므로(llm-api.js:26), 합친 의도가 그대로 생성에 반영됨.
- 탈출구: 사용자가 "그냥 진행"이라고 답하면 `userExplicitlyRequestsForceProceed` + pending 건너뛰기로 바로 생성.
  → 사용자는 절대 갇히지 않는다.

## 테스트
- `_test_clarify_verifier.js` (13/13): 휴리스틱(구체→통과 / 막연→의심), 구체 질의 LLM 미호출, OK→통과,
  ASK→질문 반환, 실패→통과, 전각 콜론(：) ASK 파싱.

## 동시작업(코덱스) 충돌 메모
- pipeline.js 가 11:02 에 코덱스에 의해 수정됨 — `findPipelineRuntimeExecutionBlocker`(실행 전 하드블록 게이트,
  pipeline.js:3260)를 `runIsolatedLivePipelineSteps` 안에서 호출하도록 추가. 그 함수가 테스트 슬라이스 밖이라
  `_test_isolated_pipeline_sequential_apply.js` 가 ReferenceError. → 테스트 prelude 에 `findPipelineRuntimeExecutionBlocker = () => null`
  stub 추가(테스트 전용, 코덱스 production 코드는 안 건드림). **코덱스가 pipeline.js 를 계속 편집 중일 수 있음.**
- `_test_auto_reapply_after_restart.js` 는 기존 stale(제거된 `maybeAutoReapplyAfterRestart` 참조, 29/30 메모 참조) — 미수정.

## 검증
- chat-ui.js / pipeline.js / config.js / model-modal.js `node --check` OK. JS 스모크 27 PASS / 1 stale.
