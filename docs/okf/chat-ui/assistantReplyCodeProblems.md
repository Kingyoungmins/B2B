---
type: endpoint
title: assistantReplyCodeProblems
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fullText, code)"
role: "코드를 만들어야 하는 응답인데 코드가 없거나 비어 있으면 문제 목록을 돌려준다."
role_source: banner
version: "0.7.3"
loc: "chat-ui.js:2284-2284"

# ── 입출력 ──
inputs:
  - "fullText"
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_isCommentOnlyCode"
  - "_looksLikeClarifyingQuestion"
  - "inferCodeLanguage"
calls_external:
  - "B2BSkill"
  - "String"
  - "replace"
  - "test"
  - "transform"
  - "trim"
called_by:
  - "addAssistantReply"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
코드를 만들어야 하는 응답인데 코드가 없거나 비어 있으면 문제 목록을 돌려준다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_isCommentOnlyCode`, `_looksLikeClarifyingQuestion`, `inferCodeLanguage`
- 피호출(영향 전파 경로): `addAssistantReply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
