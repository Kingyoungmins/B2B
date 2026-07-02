---
type: method
title: B2BHandler.send_json
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self, payload, status=200)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:1095-1106"

# ── 입출력 ──
inputs:
  - "self"
  - "payload"
  - "status"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "end_headers"
  - "write"
calls_external:
  - "body"
  - "dumps"
  - "encode"
  - "len"
  - "payload"
  - "send_header"
  - "send_response"
  - "status"
  - "str"
called_by:
  - "B2BHandler.do_GET"
  - "B2BHandler.do_POST"
  - "B2BHandler.handle_backend_pipeline_run"
  - "B2BHandler.handle_backend_pipeline_start"
  - "B2BHandler.handle_cached_diff"
  - "B2BHandler.handle_client_trace"
  - "B2BHandler.handle_current_view_diff"
  - "B2BHandler.handle_excel_activate"
  - "B2BHandler.handle_excel_capture_copypaste"
  - "B2BHandler.handle_excel_changes"
  - "B2BHandler.handle_excel_close"
  - "B2BHandler.handle_excel_hide"
  - "B2BHandler.handle_excel_hover_info"
  - "B2BHandler.handle_excel_open"
  - "B2BHandler.handle_excel_open_result"
  - "B2BHandler.handle_excel_position"
  - "B2BHandler.handle_excel_raise"
  - "B2BHandler.handle_excel_recover"
  - "B2BHandler.handle_excel_replace"
  - "B2BHandler.handle_excel_run_full_pipeline"
  - "B2BHandler.handle_excel_run_python"
  - "B2BHandler.handle_excel_run_vba"
  - "B2BHandler.handle_excel_run_vba_pipeline"
  - "B2BHandler.handle_excel_save"
  - "B2BHandler.handle_excel_selection"
  - "B2BHandler.handle_excel_show_only"
  - "B2BHandler.handle_logic_backup"
  - "B2BHandler.handle_pipeline_cancel"
  - "B2BHandler.handle_pipeline_progress"
  - "B2BHandler.handle_pipeline_status"
  - "B2BHandler.handle_workbook_archive"
  - "B2BHandler.handle_workbook_upload"
reads:
  - "self.end_headers"
  - "self.send_header"
  - "self.send_response"
  - "self.wfile"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `end_headers`, `write`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `B2BHandler.do_POST`, `B2BHandler.handle_backend_pipeline_run`, `B2BHandler.handle_backend_pipeline_start`, `B2BHandler.handle_cached_diff`, `B2BHandler.handle_client_trace`, `B2BHandler.handle_current_view_diff`, `B2BHandler.handle_excel_activate`, `B2BHandler.handle_excel_capture_copypaste`, `B2BHandler.handle_excel_changes`, `B2BHandler.handle_excel_close`, `B2BHandler.handle_excel_hide`, `B2BHandler.handle_excel_hover_info`, `B2BHandler.handle_excel_open`, `B2BHandler.handle_excel_open_result`, `B2BHandler.handle_excel_position`, `B2BHandler.handle_excel_raise`, `B2BHandler.handle_excel_recover`, `B2BHandler.handle_excel_replace`, `B2BHandler.handle_excel_run_full_pipeline`, `B2BHandler.handle_excel_run_python`, `B2BHandler.handle_excel_run_vba`, `B2BHandler.handle_excel_run_vba_pipeline`, `B2BHandler.handle_excel_save`, `B2BHandler.handle_excel_selection`, `B2BHandler.handle_excel_show_only`, `B2BHandler.handle_logic_backup`, `B2BHandler.handle_pipeline_cancel`, `B2BHandler.handle_pipeline_progress`, `B2BHandler.handle_pipeline_status`, `B2BHandler.handle_workbook_archive`, `B2BHandler.handle_workbook_upload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
