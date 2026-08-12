---
type: endpoint
title: fuzzyMatch
module: fuzzy.js
lang: js
extraction: regex   # 정규식 근사
signature: "(needle, candidates, threshold)"
role: "후보 중 가장 유사한 항목과 차순위, 모호 여부를 반환"
role_source: banner
version: "0.7.3"
loc: "fuzzy.js:78-78"

# ── 입출력 ──
inputs:
  - "needle"
  - "candidates"
  - "threshold"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "similarity"
calls_external:
  - "filter"
  - "map"
  - "slice"
  - "sort"
called_by:
  - "_resolveFileForOps"
  - "col"
  - "fuzzyProxy"
  - "resolveRunInputFile"
  - "resolveRunSheetName"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
후보 중 가장 유사한 항목과 차순위, 모호 여부를 반환

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `similarity`
- 피호출(영향 전파 경로): `_resolveFileForOps`, `col`, `fuzzyProxy`, `resolveRunInputFile`, `resolveRunSheetName`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
