---
type: function
title: _copy_source_workbook_into_target
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, target_wb, source_path)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:19444-19512"

# ── 입출력 ──
inputs:
  - "app"
  - "target_wb"
  - "source_path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_excel_names"
  - "_hide_excel_app_window"
  - "_park_excel_app_offscreen"
  - "excel_workbooks_open"
  - "range"
calls_external:
  - "Add"
  - "Close"
  - "Copy"
  - "Delete"
  - "Path"
  - "RuntimeError"
  - "Windows"
  - "_src_names"
  - "app"
  - "copy2"
  - "exists"
  - "idx"
  - "issubset"
  - "list"
  - "open_path"
  - "placeholder"
  - "set"
  - "sorted"
  - "source_path"
  - "source_temp_path"
  - "str"
  - "temp_copy"
  - "unlink"
  - "uuid4"
called_by:
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_pipeline_on_session_impl"
  - "_sync_modified_companions_into_live"
reads:
  - "BACKEND_DIR"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `Worksheets`, `_excel_names`, `_hide_excel_app_window`, `_park_excel_app_offscreen`, `excel_workbooks_open`, `range`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`, `_run_vba_pipeline_on_session_impl`, `_sync_modified_companions_into_live`

## 실패/예외
- `RuntimeError`
