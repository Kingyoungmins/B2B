---
type: endpoint
title: _schemaDataStartRow
module: file-schema.js
lang: js
extraction: regex   # 정규식 근사
signature: "(aoa, headerRow)"
role: "숫자가 아예 없는 전체-텍스트 표(명단류)는 확장하지 않는다 — 데이터 행을 머리글로 오인 방지."
role_source: banner
version: "0.7.4"
loc: "file-schema.js:657-657"

# ── 입출력 ──
inputs:
  - "aoa"
  - "headerRow"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Number"
  - "String"
  - "filter"
  - "isNaN"
  - "min"
  - "nonEmptyCount"
  - "replace"
  - "rowHasNum"
  - "some"
  - "trim"
called_by:
  - "_describeFile"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
숫자가 아예 없는 전체-텍스트 표(명단류)는 확장하지 않는다 — 데이터 행을 머리글로 오인 방지.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_describeFile`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
