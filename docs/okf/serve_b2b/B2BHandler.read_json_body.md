---
type: method
title: B2BHandler.read_json_body
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:1529-1534"

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
  - "read"
calls_external:
  - "decode"
  - "get"
  - "int"
  - "length"
  - "loads"
called_by:
  - "B2BHandler.do_POST"
  - "B2BHandler.handle_backend_pipeline_run"
  - "B2BHandler.handle_backend_pipeline_start"
  - "B2BHandler.handle_client_trace"
  - "B2BHandler.handle_current_view_diff"
  - "B2BHandler.handle_diag_recent_trace"
  - "B2BHandler.handle_excel_activate"
  - "B2BHandler.handle_excel_capture_copypaste"
  - "B2BHandler.handle_excel_changes"
  - "B2BHandler.handle_excel_close"
  - "B2BHandler.handle_excel_hide"
  - "B2BHandler.handle_excel_hover_info"
  - "B2BHandler.handle_excel_open"
  - "B2BHandler.handle_excel_open_result"
  - "B2BHandler.handle_excel_position"
  - "B2BHandler.handle_excel_preview_schema"
  - "B2BHandler.handle_excel_raise"
  - "B2BHandler.handle_excel_record_start"
  - "B2BHandler.handle_excel_record_status"
  - "B2BHandler.handle_excel_record_stop"
  - "B2BHandler.handle_excel_record_verify"
  - "B2BHandler.handle_excel_recover"
  - "B2BHandler.handle_excel_replace"
  - "B2BHandler.handle_excel_run_full_pipeline"
  - "B2BHandler.handle_excel_run_python"
  - "B2BHandler.handle_excel_run_vba"
  - "B2BHandler.handle_excel_run_vba_pipeline"
  - "B2BHandler.handle_excel_runner_mode"
  - "B2BHandler.handle_excel_save"
  - "B2BHandler.handle_excel_selection"
  - "B2BHandler.handle_excel_show_only"
  - "B2BHandler.handle_excel_verify_step"
  - "B2BHandler.handle_pipeline_cancel"
  - "B2BHandler.handle_pipeline_live_final_snapshot"
  - "B2BHandler.handle_skill_consolidate"
  - "B2BHandler.handle_workbook_archive"
  - "B2BHandler.handle_workbook_reinspect"
reads:
  - "self.headers"
  - "self.rfile"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `read`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `B2BHandler.handle_backend_pipeline_run`, `B2BHandler.handle_backend_pipeline_start`, `B2BHandler.handle_client_trace`, `B2BHandler.handle_current_view_diff`, `B2BHandler.handle_diag_recent_trace`, `B2BHandler.handle_excel_activate`, `B2BHandler.handle_excel_capture_copypaste`, `B2BHandler.handle_excel_changes`, `B2BHandler.handle_excel_close`, `B2BHandler.handle_excel_hide`, `B2BHandler.handle_excel_hover_info`, `B2BHandler.handle_excel_open`, `B2BHandler.handle_excel_open_result`, `B2BHandler.handle_excel_position`, `B2BHandler.handle_excel_preview_schema`, `B2BHandler.handle_excel_raise`, `B2BHandler.handle_excel_record_start`, `B2BHandler.handle_excel_record_status`, `B2BHandler.handle_excel_record_stop`, `B2BHandler.handle_excel_record_verify`, `B2BHandler.handle_excel_recover`, `B2BHandler.handle_excel_replace`, `B2BHandler.handle_excel_run_full_pipeline`, `B2BHandler.handle_excel_run_python`, `B2BHandler.handle_excel_run_vba`, `B2BHandler.handle_excel_run_vba_pipeline`, `B2BHandler.handle_excel_runner_mode`, `B2BHandler.handle_excel_save`, `B2BHandler.handle_excel_selection`, `B2BHandler.handle_excel_show_only`, `B2BHandler.handle_excel_verify_step`, `B2BHandler.handle_pipeline_cancel`, `B2BHandler.handle_pipeline_live_final_snapshot`, `B2BHandler.handle_skill_consolidate`, `B2BHandler.handle_workbook_archive`, `B2BHandler.handle_workbook_reinspect`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
