---
type: endpoint
title: originHistIdForPrompt
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(promptText)"
role: "[번호표 연결] 스텝 생성 시점에 '그 요청 말풍선'의 histId 를 찾아 스텝에 박는다."
role_source: banner
version: "0.7.4"
loc: "chat-ui.js:155-155"

# ── 입출력 ──
inputs:
  - "promptText"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "trim"
called_by:
  - "addAssistantReply"
  - "applyForcedPythonFallback"
  - "runApply"
  - "runEditApply"
  - "runInsert"
reads:
  - "state.chatHistory"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[번호표 연결] 스텝 생성 시점에 '그 요청 말풍선'의 histId 를 찾아 스텝에 박는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `addAssistantReply`, `applyForcedPythonFallback`, `runApply`, `runEditApply`, `runInsert`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
