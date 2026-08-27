---
type: function
title: _live_preview_schema
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb, max_rows=60, max_cols=_SNAPSHOT_MAX_COLS, only_sheet=None)"
role: "라이브 적용 후 클라 스키마 캐시 갱신용 경량 미리보기(시트명 + 상위 N행 AoA + 차원)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:16026-16066"

# ── 입출력 ──
inputs:
  - "wb"
  - "max_rows"
  - "max_cols"
  - "only_sheet"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "Worksheets"
  - "_excel_collection_names"
  - "_range_matrix"
calls_external:
  - "int"
  - "list"
  - "max"
  - "max_cols"
  - "max_rows"
  - "min"
  - "n"
  - "ncols"
  - "next"
  - "nm"
  - "nrows"
  - "only_sheet"
  - "str"
  - "total_cols"
  - "total_rows"
called_by:
  - "B2BHandler.handle_excel_preview_schema"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
reads:
  - "_SNAPSHOT_MAX_COLS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
라이브 적용 후 클라 스키마 캐시 갱신용 경량 미리보기(시트명 + 상위 N행 AoA + 차원).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `Worksheets`, `_excel_collection_names`, `_range_matrix`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_preview_schema`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_on_session_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
