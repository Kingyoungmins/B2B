---
type: function
title: _vba_trace
module: serve_b2b.py
lang: python
extraction: ast
signature: "(event, **fields)"
role: "Structured VBA/pipeline trace for field failures."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:6372-6388"

# ── 입출력 ──
inputs:
  - "event"
  - "**fields"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_vba_trace_path"
  - "write"
calls_external:
  - "dumps"
  - "fields"
  - "getpid"
  - "isoformat"
  - "now"
  - "open"
  - "payload"
  - "str"
  - "update"
called_by:
  - "B2BHandler.handle_excel_capture_copypaste"
  - "B2BHandler.handle_excel_run_full_pipeline"
  - "B2BHandler.handle_excel_run_vba"
  - "B2BHandler.handle_excel_run_vba_pipeline"
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.last_row"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.read"
  - "PythonComSkillContext.write"
  - "_capture_copypaste_on_session_impl"
  - "_inject_and_run_vba"
  - "_inject_and_run_vba_in_host"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_macro_any_ref"
  - "_run_vba_pipeline_on_session_impl"
  - "_save_excel_session_impl"
  - "_setup_isolated_pipeline_instance"
  - "_sync_modified_companions_into_live"
  - "cleanup_stale_temp_artifacts"
  - "run_python_on_session"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
Structured VBA/pipeline trace for field failures.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_vba_trace_path`, `write`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_capture_copypaste`, `B2BHandler.handle_excel_run_full_pipeline`, `B2BHandler.handle_excel_run_vba`, `B2BHandler.handle_excel_run_vba_pipeline`, `PythonComSkillContext._ws`, `PythonComSkillContext.copy`, `PythonComSkillContext.last_row`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.read`, `PythonComSkillContext.write`, `_capture_copypaste_on_session_impl`, `_inject_and_run_vba`, `_inject_and_run_vba_in_host`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_macro_any_ref`, `_run_vba_pipeline_on_session_impl`, `_save_excel_session_impl`, `_setup_isolated_pipeline_instance`, `_sync_modified_companions_into_live`, `cleanup_stale_temp_artifacts`, `run_python_on_session`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
