---
type: function
title: _setup_isolated_pipeline_instance
module: serve_b2b.py
lang: python
extraction: ast
signature: "(session, excel_id, reset, work, steps=None)"
role: "격리 실행용 새 Excel 인스턴스를 띄우고 대상+동반 워크북을 '정확한 이름'으로 연다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:9677-9788"

# ── 입출력 ──
inputs:
  - "session"
  - "excel_id"
  - "reset"
  - "work"
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_companion_referenced"
  - "_disable_vba_break_on_all_errors"
  - "_ensure_vbom_access"
  - "_excel_process_id"
  - "_isolated_companion_reference_blob"
  - "_trace_workbook_info"
  - "_track_spawned_excel_app"
  - "_vba_trace"
  - "_workbook_link_source_names"
  - "add"
  - "append"
  - "excel_workbooks_open"
  - "session_workbook"
calls_external:
  - "DispatchEx"
  - "Path"
  - "SaveCopyAs"
  - "_link_names"
  - "_ref_blob"
  - "_skipped"
  - "attr"
  - "cname"
  - "companions"
  - "copy2"
  - "cpath"
  - "excel_id"
  - "fapp"
  - "fpid"
  - "ftarget"
  - "get"
  - "items"
  - "join"
  - "len"
  - "list"
  - "live_wb0"
  - "lower"
  - "mkdir"
  - "other"
  - "reset"
  - "session"
  - "setattr"
  - "src"
  - "steps"
  - "str"
  - "target_name"
  - "tpath"
  - "uuid4"
  - "val"
  - "work"
called_by:
  - "_run_vba_pipeline_on_session_impl"
reads:
  - "EXCEL_SESSIONS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
격리 실행용 새 Excel 인스턴스를 띄우고 대상+동반 워크북을 '정확한 이름'으로 연다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_companion_referenced`, `_disable_vba_break_on_all_errors`, `_ensure_vbom_access`, `_excel_process_id`, `_isolated_companion_reference_blob`, `_trace_workbook_info`, `_track_spawned_excel_app`, `_vba_trace`, `_workbook_link_source_names`, `add`, `append`, `excel_workbooks_open`, `session_workbook`
- 피호출(영향 전파 경로): `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
