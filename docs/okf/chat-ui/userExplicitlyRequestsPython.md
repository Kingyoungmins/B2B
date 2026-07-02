---
type: endpoint
title: userExplicitlyRequestsPython
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "사용자가 'python/파이썬/COM 으로 짜줘' 처럼 엔진을 명시했는지. [사용자 지시] 이 의도는"
role_source: banner
version: "0.5.18"
loc: "chat-ui.js:241-241"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "python"
  - "test"
called_by:
  - "choosePipelineRepairLanguage"
  - "recoveryExplicitPython"
  - "recoveryExplicitVba"
  - "requestErrorRecovery"
  - "sendChat"
  - "validateAssistantCodeBeforeApply"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
사용자가 'python/파이썬/COM 으로 짜줘' 처럼 엔진을 명시했는지. [사용자 지시] 이 의도는

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `choosePipelineRepairLanguage`, `recoveryExplicitPython`, `recoveryExplicitVba`, `requestErrorRecovery`, `sendChat`, `validateAssistantCodeBeforeApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
