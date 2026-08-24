---
type: endpoint
title: mergeInvariantSignature
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "[병합 불변] 병합은 좌상단 외 셀 값을 지우는 파괴적 연산 — LLM 재작성이 행별 merge"
role_source: banner
version: "0.7.5"
loc: "record-review.js:205-205"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "String"
  - "forEach"
  - "join"
  - "match"
  - "replace"
  - "sort"
called_by:
  - "_mergeCallSignature"
  - "llmSplitRecordedVba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[병합 불변] 병합은 좌상단 외 셀 값을 지우는 파괴적 연산 — LLM 재작성이 행별 merge

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `_mergeCallSignature`, `llmSplitRecordedVba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
