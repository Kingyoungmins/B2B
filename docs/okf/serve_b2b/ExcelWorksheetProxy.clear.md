---
type: method
title: ExcelWorksheetProxy.clear
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelWorksheetProxy
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:17086-17088"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Clear"
called_by:
  - "PythonComSkillContext.move_col_clear"
  - "_cleanup_excel_sessions_impl"
  - "_cleanup_stale_copy_source"
  - "_force_restart_excel_sessions_direct"
  - "_trace_step_code_once"
  - "cleanup_backend_runtime_files"
  - "cleanup_excel_sessions"
  - "cleanup_node_worker"
  - "ensure_node_worker"
  - "excel_record_start"
  - "excel_record_stop"
  - "run_backend_pipeline_payload"
reads:
  - "self._worksheet"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext.move_col_clear`, `_cleanup_excel_sessions_impl`, `_cleanup_stale_copy_source`, `_force_restart_excel_sessions_direct`, `_trace_step_code_once`, `cleanup_backend_runtime_files`, `cleanup_excel_sessions`, `cleanup_node_worker`, `ensure_node_worker`, `excel_record_start`, `excel_record_stop`, `run_backend_pipeline_payload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
