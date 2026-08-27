---
type: function
title: start
module: log_sync.py
lang: python
extraction: ast
signature: "(app_version='', log_dirs=(), skill_dirs=(), extra_files=(), app_dir='', config_values=None)"
role: "프로그램 시작 시 한 번 호출(멱등). 로그 초기화가 끝난 뒤에 불러야 한다."
role_source: docstring
version: "0.8.0"
loc: "log_sync.py:540-573"

# ── 입출력 ──
inputs:
  - "app_version"
  - "log_dirs"
  - "skill_dirs"
  - "extra_files"
  - "app_dir"
  - "config_values"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _CONTEXT, _THREAD"
raises: []

# ── 유기적 관계 ──
calls:
  - "_atexit_stop"
  - "_loop"
  - "_new_session_id"
  - "_now_iso"
  - "config"
  - "status"
  - "update_config"
calls_external:
  - "Thread"
  - "config_values"
  - "is_alive"
  - "p"
  - "register"
  - "str"
  - "time"
  - "update"
called_by:
  - "B2BHandler.do_POST"
  - "B2BHandler.handle_backend_pipeline_start"
  - "PythonComSkillContext.first_empty_col"
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_where"
  - "_extract_vba_source_for_injection"
  - "_force_restart_excel_sessions_direct"
  - "_shift_months_in_text"
  - "_spawn_dialog_confirmer"
  - "_start_excel_hide_guard"
  - "_start_log_sync"
  - "_start_vba_debug_suppressor"
  - "ensure_excel_worker"
  - "excel_record_start"
  - "render_pptx_to_slides_b64"
  - "start_lifecycle_monitor"
  - "start_runtime_maintenance_threads"
  - "start_server"
reads:
  - "_CONTEXT"
  - "_LOCK"
  - "_STATE"
  - "_THREAD"
writes:
  - "_CONTEXT"
  - "_THREAD"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
프로그램 시작 시 한 번 호출(멱등). 로그 초기화가 끝난 뒤에 불러야 한다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _CONTEXT, _THREAD
- 변경 상태 `_CONTEXT, _THREAD` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_atexit_stop`, `_loop`, `_new_session_id`, `_now_iso`, `config`, `status`, `update_config`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `B2BHandler.handle_backend_pipeline_start`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_where`, `_extract_vba_source_for_injection`, `_force_restart_excel_sessions_direct`, `_shift_months_in_text`, `_spawn_dialog_confirmer`, `_start_excel_hide_guard`, `_start_log_sync`, `_start_vba_debug_suppressor`, `ensure_excel_worker`, `excel_record_start`, `render_pptx_to_slides_b64`, `start_lifecycle_monitor`, `start_runtime_maintenance_threads`, `start_server`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
