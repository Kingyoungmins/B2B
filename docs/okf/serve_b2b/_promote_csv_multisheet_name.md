---
type: function
title: _promote_csv_multisheet_name
module: serve_b2b.py
lang: python
extraction: ast
signature: "(name, wb)"
role: "파일명이 .csv/.tsv 인데 워크북에 시트가 2개 이상이면 .xlsx 로 바꾼다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:11103-11118"

# ── 입출력 ──
inputs:
  - "name"
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Path"
  - "int"
  - "lower"
  - "name"
  - "stem"
  - "str"
called_by:
  - "_run_vba_pipeline_on_session_impl"
  - "_save_excel_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
파일명이 .csv/.tsv 인데 워크북에 시트가 2개 이상이면 .xlsx 로 바꾼다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_run_vba_pipeline_on_session_impl`, `_save_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
