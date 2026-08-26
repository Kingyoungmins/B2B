---
type: endpoint
title: applyForcedPythonFallback
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(pythonCode, context)"
role: "[사용자 지시] VBA 전환 재생성까지 실패(\"뻑나면\")하면, 게이트를 우회해 '원본 Python 코드'를 그대로"
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:2119-2119"

# ── 입출력 ──
inputs:
  - "pythonCode"
  - "context"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "applyLogic"
  - "originHistIdForPrompt"
  - "replyStepPrompt"
  - "toast"
  - "uid"
calls_external:
  - "String"
called_by:
  - "validateAssistantCodeBeforeApply"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[사용자 지시] VBA 전환 재생성까지 실패("뻑나면")하면, 게이트를 우회해 '원본 Python 코드'를 그대로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `applyLogic`, `originHistIdForPrompt`, `replyStepPrompt`, `toast`, `uid`
- 피호출(영향 전파 경로): `validateAssistantCodeBeforeApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
