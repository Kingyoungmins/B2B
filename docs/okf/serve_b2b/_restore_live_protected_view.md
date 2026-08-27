---
type: function
title: _restore_live_protected_view
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, wb)"
role: "VBA 실행 후 라이브 보기 상태(편집 차단+선택 허용, 리본/우클릭 숨김, 화면갱신)를 복구."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:9776-9797"

# ── 입출력 ──
inputs:
  - "app"
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_configure_excel_grid_window"
  - "_hide_vba_editor"
  - "_protect_workbook_for_read_only_mirror"
calls_external:
  - "app"
  - "wb"
called_by:
  - "_recover_excel_session_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
VBA 실행 후 라이브 보기 상태(편집 차단+선택 허용, 리본/우클릭 숨김, 화면갱신)를 복구.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_configure_excel_grid_window`, `_hide_vba_editor`, `_protect_workbook_for_read_only_mirror`
- 피호출(영향 전파 경로): `_recover_excel_session_impl`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_on_session_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
