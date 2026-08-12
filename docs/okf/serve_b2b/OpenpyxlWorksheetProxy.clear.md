---
type: method
title: OpenpyxlWorksheetProxy.clear
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlWorksheetProxy
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:16752-16761"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "delete_rows"
  - "flush_pending_rows"
  - "max_row"
calls_external:
  - "int"
called_by:
  - "PythonComSkillContext.move_col_clear"
  - "_cleanup_excel_sessions_impl"
  - "_cleanup_stale_copy_source"
  - "_force_restart_excel_sessions_direct"
  - "cleanup_backend_runtime_files"
  - "cleanup_excel_sessions"
  - "cleanup_node_worker"
  - "ensure_node_worker"
  - "excel_record_start"
  - "excel_record_stop"
  - "run_backend_pipeline_payload"
reads:
  - "self._ws"
  - "self.flush_pending_rows"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `delete_rows`, `flush_pending_rows`, `max_row`
- 피호출(영향 전파 경로): `PythonComSkillContext.move_col_clear`, `_cleanup_excel_sessions_impl`, `_cleanup_stale_copy_source`, `_force_restart_excel_sessions_direct`, `cleanup_backend_runtime_files`, `cleanup_excel_sessions`, `cleanup_node_worker`, `ensure_node_worker`, `excel_record_start`, `excel_record_stop`, `run_backend_pipeline_payload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
