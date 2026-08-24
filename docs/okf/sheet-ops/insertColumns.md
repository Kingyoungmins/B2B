---
type: endpoint
title: insertColumns
module: sheet-ops.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fileRef, sheetName, atColIdx, count)"
role: "시트 안 atColIdx 위치에 빈 컬럼 count 개 삽입. Excel 의 \"열 삽입\" 동작."
role_source: banner
version: "0.7.5"
loc: "sheet-ops.js:117-117"

# ── 입출력 ──
inputs:
  - "fileRef"
  - "sheetName"
  - "atColIdx"
  - "count"
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
  - "Array"
  - "Error"
  - "fill"
  - "forEach"
  - "isArray"
  - "keys"
  - "max"
  - "splice"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
시트 안 atColIdx 위치에 빈 컬럼 count 개 삽입. Excel 의 "열 삽입" 동작.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_addrToRC`, `_idxToColLetters`, `_resolveFileForOps`, `push`, `shiftFormulaText`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
