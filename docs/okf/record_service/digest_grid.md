---
type: function
title: digest_grid
module: record_service.py
lang: python
extraction: ast
signature: "(values)"
role: "UsedRange.Value2 결과(스칼라/1행/2D 튜플)를 정규화해 sha1 16자리 다이제스트."
role_source: docstring
version: "0.8.0"
loc: "record_service.py:63-76"

# ── 입출력 ──
inputs:
  - "values"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_norm_cell"
  - "values"
calls_external:
  - "c"
  - "encode"
  - "hexdigest"
  - "isinstance"
  - "join"
  - "r"
  - "sha1"
  - "update"
called_by:
  - "sheet_expected_state"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
UsedRange.Value2 결과(스칼라/1행/2D 튜플)를 정규화해 sha1 16자리 다이제스트.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_norm_cell`, `values`
- 피호출(영향 전파 경로): `sheet_expected_state`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
