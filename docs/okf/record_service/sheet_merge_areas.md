---
type: function
title: sheet_merge_areas
module: record_service.py
lang: python
extraction: ast
signature: "(ws, max_rows=MERGE_SCAN_MAX_ROWS, max_cells=MERGE_SCAN_MAX_CELLS)"
role: "시트의 병합 영역 주소 목록(정렬) — 재현 검증용 병합 지문."
role_source: docstring
version: "0.8.2"
loc: "record_service.py:83-128"

# ── 입출력 ──
inputs:
  - "ws"
  - "max_rows"
  - "max_cells"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Rows"
  - "add"
  - "append"
  - "range"
  - "replace"
  - "rows"
calls_external:
  - "areas"
  - "c"
  - "int"
  - "max_rows"
  - "min"
  - "r"
  - "set"
  - "sorted"
  - "str"
called_by:
  - "sheet_expected_state"
reads:
  - "MERGE_SCAN_MAX_CELLS"
  - "MERGE_SCAN_MAX_ROWS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
시트의 병합 영역 주소 목록(정렬) — 재현 검증용 병합 지문.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Rows`, `add`, `append`, `range`, `replace`, `rows`
- 피호출(영향 전파 경로): `sheet_expected_state`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
