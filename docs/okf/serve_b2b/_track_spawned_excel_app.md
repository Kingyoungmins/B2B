---
type: function
title: _track_spawned_excel_app
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "이 앱이 띄운 Excel 인스턴스의 pid 를 기록한다(고아 정리용)."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:4358-4367"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_process_id"
  - "_perf_trace"
  - "add"
calls_external:
  - "app"
  - "int"
  - "p"
  - "pid"
  - "sorted"
called_by:
  - "_diag_vba_run_failure"
  - "_get_live_excel_app"
  - "_get_python_skill_app"
  - "_open_excel_session_impl"
  - "_reopen_excel_session_workbook"
  - "_run_full_pipeline_single_instance_impl"
  - "_setup_isolated_pipeline_instance"
  - "_verify_step_isolated_impl"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa_with_excel"
reads:
  - "SPAWNED_EXCEL_PIDS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
이 앱이 띄운 Excel 인스턴스의 pid 를 기록한다(고아 정리용).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_excel_process_id`, `_perf_trace`, `add`
- 피호출(영향 전파 경로): `_diag_vba_run_failure`, `_get_live_excel_app`, `_get_python_skill_app`, `_open_excel_session_impl`, `_reopen_excel_session_workbook`, `_run_full_pipeline_single_instance_impl`, `_setup_isolated_pipeline_instance`, `_verify_step_isolated_impl`, `inspect_workbook_with_excel`, `load_workbook_aoa_with_excel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
