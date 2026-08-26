---
type: method
title: PythonComSkillContext.clear
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range, keep_formulas=False)"
role: "범위 내용 삭제(서식 유지). keep_formulas=True 면 '수식 셀은 남기고 값(상수) 셀만' 비운다"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12890-12908"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
  - "keep_formulas"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_journal_save"
  - "_rng"
  - "_tick"
  - "_ws"
  - "sheet"
calls_external:
  - "ClearContents"
  - "SpecialCells"
  - "a1_range"
  - "rng"
  - "ws"
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
  - "self._journal_save"
  - "self._rng"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
범위 내용 삭제(서식 유지). keep_formulas=True 면 '수식 셀은 남기고 값(상수) 셀만' 비운다

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_journal_save`, `_rng`, `_tick`, `_ws`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext.move_col_clear`, `_cleanup_excel_sessions_impl`, `_cleanup_stale_copy_source`, `_force_restart_excel_sessions_direct`, `_trace_step_code_once`, `cleanup_backend_runtime_files`, `cleanup_excel_sessions`, `cleanup_node_worker`, `ensure_node_worker`, `excel_record_start`, `excel_record_stop`, `run_backend_pipeline_payload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
