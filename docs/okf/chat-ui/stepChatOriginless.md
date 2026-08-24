---
type: endpoint
title: stepChatOriginless
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step)"
role: "대화 없이 태어난 스텝(복붙 캡처·수동 셀편집)인가 — 이런 스텝은 텍스트 매칭을 시도하는 것"
role_source: banner
version: "0.7.5"
loc: "chat-ui.js:177-177"

# ── 입출력 ──
inputs:
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "test"
  - "trim"
called_by:
  - "_editPrefillPromptOf"
  - "scrollChatToStepRequest"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
대화 없이 태어난 스텝(복붙 캡처·수동 셀편집)인가 — 이런 스텝은 텍스트 매칭을 시도하는 것

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_editPrefillPromptOf`, `scrollChatToStepRequest`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
