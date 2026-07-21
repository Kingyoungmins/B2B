---
type: method
title: B2BHandler.do_POST
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "serve_b2b.py:993-1127"

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
  - "_excel_queue_size"
  - "_excel_runtime_diagnostics"
  - "_force_restart_excel_sessions_direct"
  - "_maintenance_status"
  - "_pipeline_job_stats"
  - "_pipeline_snapshot_stats"
  - "_runtime_counts_snapshot"
  - "choose_logic_backup_dir_dialog"
  - "cleanup_excel_sessions"
  - "handle_backend_pipeline_run"
  - "handle_backend_pipeline_start"
  - "handle_client_trace"
  - "handle_current_view_diff"
  - "handle_excel_activate"
  - "handle_excel_capture_copypaste"
  - "handle_excel_changes"
  - "handle_excel_close"
  - "handle_excel_hide"
  - "handle_excel_hover_info"
  - "handle_excel_open"
  - "handle_excel_open_result"
  - "handle_excel_position"
  - "handle_excel_raise"
  - "handle_excel_recover"
  - "handle_excel_replace"
  - "handle_excel_run_full_pipeline"
  - "handle_excel_run_python"
  - "handle_excel_run_vba"
  - "handle_excel_run_vba_pipeline"
  - "handle_excel_save"
  - "handle_excel_selection"
  - "handle_excel_show_only"
  - "handle_logic_backup"
  - "handle_pipeline_cancel"
  - "handle_workbook_archive"
  - "handle_workbook_upload"
  - "hide_all_excel_sessions"
  - "hide_inactive_excel_sessions"
  - "proxy"
  - "read_json_body"
  - "reset_logic_backup_dir"
  - "send_json"
calls_external:
  - "Thread"
  - "bool"
  - "err"
  - "get"
  - "send_error"
  - "start"
  - "startswith"
  - "str"
called_by: []
reads:
  - "self.handle_backend_pipeline_run"
  - "self.handle_backend_pipeline_start"
  - "self.handle_client_trace"
  - "self.handle_current_view_diff"
  - "self.handle_excel_activate"
  - "self.handle_excel_capture_copypaste"
  - "self.handle_excel_changes"
  - "self.handle_excel_close"
  - "self.handle_excel_hide"
  - "self.handle_excel_hover_info"
  - "self.handle_excel_open"
  - "self.handle_excel_open_result"
  - "self.handle_excel_position"
  - "self.handle_excel_raise"
  - "self.handle_excel_recover"
  - "self.handle_excel_replace"
  - "self.handle_excel_run_full_pipeline"
  - "self.handle_excel_run_python"
  - "self.handle_excel_run_vba"
  - "self.handle_excel_run_vba_pipeline"
  - "self.handle_excel_save"
  - "self.handle_excel_selection"
  - "self.handle_excel_show_only"
  - "self.handle_logic_backup"
  - "self.handle_pipeline_cancel"
  - "self.handle_workbook_archive"
  - "self.handle_workbook_upload"
  - "self.path"
  - "self.proxy"
  - "self.read_json_body"
  - "self.send_error"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_excel_queue_size`, `_excel_runtime_diagnostics`, `_force_restart_excel_sessions_direct`, `_maintenance_status`, `_pipeline_job_stats`, `_pipeline_snapshot_stats`, `_runtime_counts_snapshot`, `choose_logic_backup_dir_dialog`, `cleanup_excel_sessions`, `handle_backend_pipeline_run`, `handle_backend_pipeline_start`, `handle_client_trace`, `handle_current_view_diff`, `handle_excel_activate`, `handle_excel_capture_copypaste`, `handle_excel_changes`, `handle_excel_close`, `handle_excel_hide`, `handle_excel_hover_info`, `handle_excel_open`, `handle_excel_open_result`, `handle_excel_position`, `handle_excel_raise`, `handle_excel_recover`, `handle_excel_replace`, `handle_excel_run_full_pipeline`, `handle_excel_run_python`, `handle_excel_run_vba`, `handle_excel_run_vba_pipeline`, `handle_excel_save`, `handle_excel_selection`, `handle_excel_show_only`, `handle_logic_backup`, `handle_pipeline_cancel`, `handle_workbook_archive`, `handle_workbook_upload`, `hide_all_excel_sessions`, `hide_inactive_excel_sessions`, `proxy`, `read_json_body`, `reset_logic_backup_dir`, `send_json`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
