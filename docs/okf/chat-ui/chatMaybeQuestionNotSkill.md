---
type: endpoint
title: chatMaybeQuestionNotSkill
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "사전검사 — 결정자가 아니라 'LLM 에게 물어볼 값어치가 있나'만 본다(재현율 위주, 정밀도 아님)."
role_source: banner
version: "0.8.1"
loc: "chat-ui.js:3736-3736"

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
  - "test"
  - "trim"
called_by:
  - "sendChat"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
사전검사 — 결정자가 아니라 'LLM 에게 물어볼 값어치가 있나'만 본다(재현율 위주, 정밀도 아님).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `sendChat`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
