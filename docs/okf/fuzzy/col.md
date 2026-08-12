---
type: endpoint
title: col
module: fuzzy.js
lang: js
extraction: regex   # 정규식 근사
signature: "(sheetAoA, name, options)"
role: "step 코드에서 호출 가능한 헬퍼: col(sheetAoA, \"회사명\") → 컬럼 인덱스"
role_source: banner
version: "0.7.3"
loc: "fuzzy.js:183-183"

# ── 입출력 ──
inputs:
  - "sheetAoA"
  - "name"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "detectHeaderRow"
  - "fuzzyMatch"
calls_external:
  - "String"
  - "filter"
  - "findIndex"
  - "indexOf"
  - "isArray"
  - "map"
called_by:
  - "findColumnGlobal"
  - "requestErrorRecovery"
  - "runPipeline"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
step 코드에서 호출 가능한 헬퍼: col(sheetAoA, "회사명") → 컬럼 인덱스

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `detectHeaderRow`, `fuzzyMatch`
- 피호출(영향 전파 경로): `findColumnGlobal`, `requestErrorRecovery`, `runPipeline`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
