---
type: endpoint
title: _isCommentOnlyCode
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, language)"
role: "실행 가능한 문장이 없는 주석-only 코드인지 검사(파이썬 # / VBA '·Rem)."
role_source: banner
version: "0.7.4"
loc: "chat-ui.js:2288-2288"

# ── 입출력 ──
inputs:
  - "code"
  - "language"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "isComment"
calls_external:
  - "String"
  - "every"
  - "filter"
  - "map"
  - "split"
  - "startsWith"
  - "test"
  - "trim"
called_by:
  - "assistantReplyCodeProblems"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
실행 가능한 문장이 없는 주석-only 코드인지 검사(파이썬 # / VBA '·Rem).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `isComment`
- 피호출(영향 전파 경로): `assistantReplyCodeProblems`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
