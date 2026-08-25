---
type: endpoint
title: recomputeSheetFormulas
module: formula-engine.js
lang: js
extraction: regex   # 정규식 근사
signature: "(sheetAoA, formulasMap, originalCachedValues)"
role: "시트 전체에서 등록된 수식들을 순회하며 결과 맵을 만든다."
role_source: banner
version: "0.8.0"
loc: "formula-engine.js:379-379"

# ── 입출력 ──
inputs:
  - "sheetAoA"
  - "formulasMap"
  - "originalCachedValues"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_parseCellRef"
  - "_sameVal"
  - "evalFormula"
calls_external:
  - "forEach"
  - "keys"
called_by:
  - "recomputeAllFormulas"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
시트 전체에서 등록된 수식들을 순회하며 결과 맵을 만든다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_parseCellRef`, `_sameVal`, `evalFormula`
- 피호출(영향 전파 경로): `recomputeAllFormulas`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
