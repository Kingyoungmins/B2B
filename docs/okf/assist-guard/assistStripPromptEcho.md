---
type: endpoint
title: assistStripPromptEcho
module: assist-guard.js
lang: js
extraction: regex   # 정규식 근사
signature: "(visible, sources)"
role: "sources = 이번 요청에 보낸 system/user 텍스트 배열."
role_source: banner
version: "0.8.1"
loc: "assist-guard.js:212-212"

# ── 입출력 ──
inputs:
  - "visible"
  - "sources"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "splitSentences"
calls_external:
  - "Set"
  - "String"
  - "filter"
  - "includes"
  - "isArray"
  - "join"
  - "map"
  - "replace"
  - "split"
  - "trim"
called_by:
  - "assistCloseOut"
  - "assistHandleUserMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
sources = 이번 요청에 보낸 system/user 텍스트 배열.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `splitSentences`
- 피호출(영향 전파 경로): `assistCloseOut`, `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
