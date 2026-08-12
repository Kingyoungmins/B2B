---
type: endpoint
title: _stripSynthesizedSheetSelects
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(chunkCode, originalCode, initialWindow)"
role: "분할 LLM 이 조각마다 컨텍스트를 재삽입하며 '원본에 없던' Sheets(\"X\").Select 를 창 전환 직후에"
role_source: banner
version: "0.7.3"
loc: "record-review.js:578-578"

# ── 입출력 ──
inputs:
  - "chunkCode"
  - "originalCode"
  - "initialWindow"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_recordedWindowSheetPairs"
  - "push"
calls_external:
  - "String"
  - "has"
  - "info"
  - "join"
  - "match"
  - "split"
  - "toLowerCase"
called_by:
  - "llmSplitRecordedVba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
분할 LLM 이 조각마다 컨텍스트를 재삽입하며 '원본에 없던' Sheets("X").Select 를 창 전환 직후에

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_recordedWindowSheetPairs`, `push`
- 피호출(영향 전파 경로): `llmSplitRecordedVba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
