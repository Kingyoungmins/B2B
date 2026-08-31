---
type: function
title: _capture_copypaste_on_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, values_only=False)"
role: "라이브 세션에서 '방금 한 복붙'을 캡처한다."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:12069-12214"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "values_only"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "Worksheets"
  - "_read_excel_clipboard_source"
  - "_user_facing_workbook_name_for_live"
  - "_vba_trace"
  - "_workbook_name_lookup_key"
  - "get_excel_session"
  - "replace"
  - "session_workbook"
calls_external:
  - "RuntimeError"
  - "Windows"
  - "app"
  - "bool"
  - "desc"
  - "dims_match"
  - "dst_book"
  - "dst_book_out"
  - "dst_cell"
  - "dst_sheet"
  - "dst_via"
  - "e"
  - "excel_id"
  - "get"
  - "global_sel_book"
  - "int"
  - "monotonic"
  - "open_books"
  - "sel_cols"
  - "sel_rows"
  - "session"
  - "session_book"
  - "snap_used"
  - "source"
  - "src_book_out"
  - "src_cols"
  - "src_found"
  - "src_rows"
  - "str"
  - "values_only"
called_by:
  - "run_capture_copypaste"
reads:
  - "EXCEL_LOCK"
  - "LAST_COPY_SOURCE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
라이브 세션에서 '방금 한 복붙'을 캡처한다.

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `Worksheets`, `_read_excel_clipboard_source`, `_user_facing_workbook_name_for_live`, `_vba_trace`, `_workbook_name_lookup_key`, `get_excel_session`, `replace`, `session_workbook`
- 피호출(영향 전파 경로): `run_capture_copypaste`

## 실패/예외
- `RuntimeError`
