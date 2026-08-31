---
type: endpoint
title: copyColumns
module: sheet-ops.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fileRef, sheetName, srcStart, srcCount, destStart)"
role: "컬럼 범위 [srcStart, srcStart+srcCount) 를 destStart 위치로 복사."
role_source: banner
version: "0.8.2"
loc: "sheet-ops.js:185-185"

# ── 입출력 ──
inputs:
  - "fileRef"
  - "sheetName"
  - "srcStart"
  - "srcCount"
  - "destStart"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_addrToRC"
  - "_idxToColLetters"
  - "_resolveFileForOps"
  - "push"
  - "shiftFormulaText"
calls_external:
  - "Error"
  - "filter"
  - "forEach"
  - "keys"
  - "map"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
컬럼 범위 [srcStart, srcStart+srcCount) 를 destStart 위치로 복사.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_addrToRC`, `_idxToColLetters`, `_resolveFileForOps`, `push`, `shiftFormulaText`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
