---
type: method
title: RecordService.start
module: record_service.py
lang: python
extraction: ast
class: RecordService
signature: "(self, app_stream=None)"
role: "---- 시작 ----"
role_source: banner
version: "0.8.2"
loc: "record_service.py:654-665"

# ── 입출력 ──
inputs:
  - "self"
  - "app_stream"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): self._error, self._recording, self._result, self._thread"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "clear"
calls_external:
  - "RuntimeError"
  - "Thread"
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
  - "init"
  - "render_pptx_to_slides_b64"
  - "start_lifecycle_monitor"
  - "start_runtime_maintenance_threads"
  - "start_server"
reads:
  - "self._lock"
  - "self._recording"
  - "self._run"
  - "self._stop_evt"
  - "self._thread"
writes:
  - "self._error"
  - "self._recording"
  - "self._result"
  - "self._thread"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
---- 시작 ----

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): self._error, self._recording, self._result, self._thread
- 변경 상태 `self._error, self._recording, self._result, self._thread` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `clear`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `B2BHandler.handle_backend_pipeline_start`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_where`, `_extract_vba_source_for_injection`, `_force_restart_excel_sessions_direct`, `_shift_months_in_text`, `_spawn_dialog_confirmer`, `_start_excel_hide_guard`, `_start_log_sync`, `_start_vba_debug_suppressor`, `ensure_excel_worker`, `excel_record_start`, `init`, `render_pptx_to_slides_b64`, `start_lifecycle_monitor`, `start_runtime_maintenance_threads`, `start_server`

## 실패/예외
- `RuntimeError`
