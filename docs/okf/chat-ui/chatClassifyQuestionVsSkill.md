---
type: endpoint
title: chatClassifyQuestionVsSkill
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(userMessage, options)"
role: "최종 판단 — 파일 구조를 근거로 LLM 이 고른다. 실패/애매 = 작업(종전 동작)."
role_source: banner
version: "0.8.2"
loc: "chat-ui.js:3748-3748"

# ── 입출력 ──
inputs:
  - "userMessage"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "buildSheetStructureDigest"
  - "callLLMOneShot"
calls_external:
  - "String"
  - "filter"
  - "getAoa"
  - "join"
  - "resolveSheet"
  - "test"
called_by:
  - "sendChat"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
최종 판단 — 파일 구조를 근거로 LLM 이 고른다. 실패/애매 = 작업(종전 동작).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `buildSheetStructureDigest`, `callLLMOneShot`
- 피호출(영향 전파 경로): `sendChat`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
