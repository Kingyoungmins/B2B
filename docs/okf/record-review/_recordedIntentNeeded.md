---
type: endpoint
title: _recordedIntentNeeded
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "월/분기/연/날짜 리터럴을 값·수식에 박은 조각 감지 — LLM 이 intentNeeded 를 안 달아도"
role_source: banner
version: "0.7.4"
loc: "record-review.js:506-506"

# ── 입출력 ──
inputs:
  - "code"
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
  - "llmSplitRecordedVba"
  - "makeStep"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
월/분기/연/날짜 리터럴을 값·수식에 박은 조각 감지 — LLM 이 intentNeeded 를 안 달아도

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `llmSplitRecordedVba`, `makeStep`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
