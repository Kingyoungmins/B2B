---
type: endpoint
title: assistStripActionBlock
module: assist-guard.js
lang: js
extraction: regex   # 정규식 근사
signature: "(reply)"
role: "응답 본문에서 액션 블록을 걷어낸 '사람이 읽을 부분'"
role_source: banner
version: "0.8.1"
loc: "assist-guard.js:195-195"

# ── 입출력 ──
inputs:
  - "reply"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "RegExp"
  - "String"
  - "replace"
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
응답 본문에서 액션 블록을 걷어낸 '사람이 읽을 부분'

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistCloseOut`, `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
