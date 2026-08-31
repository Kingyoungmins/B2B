---
type: endpoint
title: evalFormula
module: formula-engine.js
lang: js
extraction: regex   # 정규식 근사
signature: "(formulaStr, sheet, position, results)"
role: "메인 진입점. results 는 다른 수식 셀의 평가 결과 맵 (의존 체인 해소용)."
role_source: banner
version: "0.8.2"
loc: "formula-engine.js:361-361"

# ── 입출력 ──
inputs:
  - "formulaStr"
  - "sheet"
  - "position"
  - "results"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_evalAst"
  - "_parser"
  - "_tokenize"
calls_external:
  - "String"
  - "indexOf"
  - "slice"
  - "startsWith"
  - "trim"
called_by:
  - "recomputeSheetFormulas"
  - "resolveFormulaStringValue"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
메인 진입점. results 는 다른 수식 셀의 평가 결과 맵 (의존 체인 해소용).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_evalAst`, `_parser`, `_tokenize`
- 피호출(영향 전파 경로): `recomputeSheetFormulas`, `resolveFormulaStringValue`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
