---
type: endpoint
title: deleteColumns
module: sheet-ops.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fileRef, sheetName, atColIdx, count)"
role: "빈 컬럼 N개를 atColIdx 위치에서 제거 (insertColumns 의 역). 자주 안 쓰지만 대칭으로 제공."
role_source: banner
version: "0.5.18"
loc: "sheet-ops.js:234-234"

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
  - "shiftFormulaText"
calls_external:
  - "Error"
  - "filter"
  - "forEach"
  - "isArray"
  - "keys"
  - "map"
  - "max"
  - "splice"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
빈 컬럼 N개를 atColIdx 위치에서 제거 (insertColumns 의 역). 자주 안 쓰지만 대칭으로 제공.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_addrToRC`, `_idxToColLetters`, `_resolveFileForOps`, `shiftFormulaText`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
