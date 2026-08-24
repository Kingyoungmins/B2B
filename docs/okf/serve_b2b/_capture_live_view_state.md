---
type: function
title: _capture_live_view_state
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, wb, session=None)"
role: "현재 워크북의 활성 시트/선택 주소를 보존한다."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:9562-9617"

# ── 입출력 ──
inputs:
  - "app"
  - "wb"
  - "session"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_address"
  - "_excel_collection_names"
  - "_same_excel_workbook"
  - "replace"
calls_external:
  - "Windows"
  - "active_cell"
  - "active_ws"
  - "cell_ws"
  - "get"
  - "getattr"
  - "parent"
  - "sel"
  - "sel_ws"
  - "str"
  - "wb"
called_by:
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
현재 워크북의 활성 시트/선택 주소를 보존한다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_address`, `_excel_collection_names`, `_same_excel_workbook`, `replace`
- 피호출(영향 전파 경로): `_run_full_pipeline_single_instance_impl`, `_run_vba_on_session_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
