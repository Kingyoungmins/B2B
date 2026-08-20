---
type: function
title: _trace_workbook_info
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:8745-8758"

# ── 입출력 ──
inputs:
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_collection_names"
calls_external:
  - "getattr"
  - "key"
  - "str"
  - "wb"
called_by:
  - "_inject_and_run_vba"
  - "_inject_and_run_vba_in_host"
  - "_run_vba_macro_any_ref"
  - "_run_vba_pipeline_on_session_impl"
  - "_setup_isolated_pipeline_instance"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_collection_names`
- 피호출(영향 전파 경로): `_inject_and_run_vba`, `_inject_and_run_vba_in_host`, `_run_vba_macro_any_ref`, `_run_vba_pipeline_on_session_impl`, `_setup_isolated_pipeline_instance`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
