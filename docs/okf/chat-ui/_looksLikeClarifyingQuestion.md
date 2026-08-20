---
type: endpoint
title: _looksLikeClarifyingQuestion
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "사용자에게 되묻는 정상적인 명확화 질문이면 재생성하지 않는다."
role_source: banner
version: "0.7.4"
loc: "chat-ui.js:2281-2281"

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
called_by:
  - "assistantReplyCodeProblems"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
사용자에게 되묻는 정상적인 명확화 질문이면 재생성하지 않는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistantReplyCodeProblems`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
