---
type: endpoint
title: _evalAst
module: formula-engine.js
lang: js
extraction: regex   # 정규식 근사
signature: "(node, ctx)"
role: "----- Evaluator -----"
role_source: banner
version: "0.5.18"
loc: "formula-engine.js:286-286"

# ── 입출력 ──
inputs:
  - "node"
  - "ctx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_applyOp"
  - "_parseCellRef"
  - "_readCell"
  - "push"
calls_external:
  - "Number"
  - "fn"
  - "map"
  - "max"
  - "min"
called_by:
  - "evalFormula"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
----- Evaluator -----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_applyOp`, `_parseCellRef`, `_readCell`, `push`
- 피호출(영향 전파 경로): `evalFormula`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
