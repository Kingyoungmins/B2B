---
type: endpoint
title: promoteStepChatOrigins
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[구버전 승격] originHistId 없는 스텝(옛 zip): prompt 가 복원된 대화의 user 말풍선과 '정확히 1개'"
role_source: banner
version: "0.7.5"
loc: "save-load.js:1003-1003"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "norm"
calls_external:
  - "String"
  - "filter"
  - "forEach"
  - "replace"
  - "slice"
  - "trim"
called_by:
  - "loadLogic"
reads:
  - "state.chatHistory"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[구버전 승격] originHistId 없는 스텝(옛 zip): prompt 가 복원된 대화의 user 말풍선과 '정확히 1개'

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `norm`
- 피호출(영향 전파 경로): `loadLogic`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
