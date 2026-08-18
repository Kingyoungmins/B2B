---
type: endpoint
title: _recordedAssignRhsMultiset
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "[데이터 보존 검증용] 코드에서 .Value/.Formula/.FormulaR1C1 대입의 우변(리터럴)을 멀티셋으로"
role_source: banner
version: "0.7.4"
loc: "record-review.js:513-513"

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
  - "exec"
  - "sort"
  - "trim"
called_by:
  - "llmSplitRecordedVba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[데이터 보존 검증용] 코드에서 .Value/.Formula/.FormulaR1C1 대입의 우변(리터럴)을 멀티셋으로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `llmSplitRecordedVba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
