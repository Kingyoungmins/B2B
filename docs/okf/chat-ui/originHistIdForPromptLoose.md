---
type: endpoint
title: originHistIdForPromptLoose
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(promptText)"
role: "(수정 적용 버튼은 '방금 보낸 요청'의 응답에 붙으므로 마지막 user 가 곧 그 요청이다)."
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:181-181"

# ── 입출력 ──
inputs:
  - "promptText"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "originHistIdForPrompt"
calls_external:
  - "String"
  - "startsWith"
  - "trim"
called_by:
  - "addAssistantReply"
  - "runEditApply"
reads:
  - "state.chatHistory"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(수정 적용 버튼은 '방금 보낸 요청'의 응답에 붙으므로 마지막 user 가 곧 그 요청이다).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `originHistIdForPrompt`
- 피호출(영향 전파 경로): `addAssistantReply`, `runEditApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
