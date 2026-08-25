---
type: method
title: B2BHandler.do_GET
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:1235-1371"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_current_app_version"
  - "_excel_queue_size"
  - "_health_excel_diagnostics"
  - "_is_own_origin"
  - "_maintenance_status"
  - "_pipeline_job_stats"
  - "_pipeline_snapshot_stats"
  - "_runtime_counts_snapshot"
  - "app_base_dir"
  - "end_headers"
  - "excel_available"
  - "handle_backend_download"
  - "handle_cached_diff"
  - "handle_pipeline_progress"
  - "handle_pipeline_status"
  - "handle_workbook_source_download"
  - "logic_backup_dir_info"
  - "node_executable"
  - "proxy"
  - "send_json"
calls_external:
  - "BACKEND_DIR"
  - "Path"
  - "__file__"
  - "_origin"
  - "_send_headers"
  - "app_dir"
  - "bool"
  - "clen"
  - "ctype"
  - "disp"
  - "err"
  - "exists"
  - "file_info"
  - "get"
  - "getcwd"
  - "getpid"
  - "int"
  - "len"
  - "loads"
  - "openpyxl"
  - "path"
  - "read_text"
  - "resolve"
  - "send_header"
  - "send_response"
  - "split"
  - "startswith"
  - "stat"
  - "status"
  - "str"
  - "stream"
  - "strip"
  - "sub"
  - "super"
called_by: []
reads:
  - "APP_BUILD_STAMP"
  - "BACKEND_DIR"
  - "self.end_headers"
  - "self.handle_backend_download"
  - "self.handle_cached_diff"
  - "self.handle_pipeline_progress"
  - "self.handle_pipeline_status"
  - "self.handle_workbook_source_download"
  - "self.headers"
  - "self.path"
  - "self.proxy"
  - "self.send_header"
  - "self.send_json"
  - "self.send_response"
  - "self.wfile"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_current_app_version`, `_excel_queue_size`, `_health_excel_diagnostics`, `_is_own_origin`, `_maintenance_status`, `_pipeline_job_stats`, `_pipeline_snapshot_stats`, `_runtime_counts_snapshot`, `app_base_dir`, `end_headers`, `excel_available`, `handle_backend_download`, `handle_cached_diff`, `handle_pipeline_progress`, `handle_pipeline_status`, `handle_workbook_source_download`, `logic_backup_dir_info`, `node_executable`, `proxy`, `send_json`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
