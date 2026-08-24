---
type: endpoint
title: shiftFormulaText
module: sheet-ops.js
lang: js
extraction: regex   # 정규식 근사
signature: "(formulaStr, delta, atColIdx, mode)"
role: "수식 텍스트 안의 셀 참조를 컬럼 방향으로 delta 만큼 이동."
role_source: banner
version: "0.7.5"
loc: "sheet-ops.js:100-100"

# ── 입출력 ──
inputs:
  - "formulaStr"
  - "delta"
  - "atColIdx"
  - "mode"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_colLettersToIdx"
  - "_idxToColLetters"
calls_external:
  - "String"
  - "replace"
called_by:
  - "copyColumns"
  - "deleteColumns"
  - "insertColumns"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
수식 텍스트 안의 셀 참조를 컬럼 방향으로 delta 만큼 이동.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_colLettersToIdx`, `_idxToColLetters`
- 피호출(영향 전파 경로): `copyColumns`, `deleteColumns`, `insertColumns`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
