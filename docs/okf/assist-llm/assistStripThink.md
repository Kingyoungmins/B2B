---
type: endpoint
title: assistStripThink
module: assist-llm.js
lang: js
extraction: regex   # 정규식 근사
signature: "(s)"
role: "도움 챗봇 전용 LLM 호출."
role_source: banner
version: "0.8.0"
loc: "assist-llm.js:53-53"

# ── 입출력 ──
inputs:
  - "s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "replace"
  - "trim"
called_by:
  - "callAssistLLM"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
도움 챗봇 전용 LLM 호출.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `callAssistLLM`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
