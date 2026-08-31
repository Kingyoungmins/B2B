---
type: function
title: sheet_expected_state
module: record_service.py
lang: python
extraction: ast
signature: "(ws, max_cells=DIGEST_MAX_CELLS)"
role: "시트 하나의 기대 상태 {sheet, rows, cols, hashRows, hash, merges}."
role_source: docstring
version: "0.8.2"
loc: "record_service.py:156-174"

# ── 입출력 ──
inputs:
  - "ws"
  - "max_cells"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "digest_grid"
  - "sheet_merge_areas"
  - "values"
calls_external:
  - "Resize"
  - "cols"
  - "hash_rows"
  - "int"
  - "max"
  - "str"
  - "ws"
called_by:
  - "_verify_recorded_expected_live"
  - "capture_expected_states"
reads:
  - "DIGEST_MAX_CELLS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
시트 하나의 기대 상태 {sheet, rows, cols, hashRows, hash, merges}.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `digest_grid`, `sheet_merge_areas`, `values`
- 피호출(영향 전파 경로): `_verify_recorded_expected_live`, `capture_expected_states`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
