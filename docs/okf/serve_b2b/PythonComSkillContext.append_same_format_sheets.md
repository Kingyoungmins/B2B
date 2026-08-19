---
type: method
title: PythonComSkillContext.append_same_format_sheets
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, src_books, dest_sheet='통합', src_sheet=None, header_row=None, scan_rows=30)"
role: "동일 포맷 여러 입력 파일의 표를 현재 워크북 새 시트에 이어붙인다."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:13325-13453"

# ── 입출력 ──
inputs:
  - "self"
  - "src_books"
  - "dest_sheet"
  - "src_sheet"
  - "header_row"
  - "scan_rows"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "Worksheets"
  - "_excel_collection_names"
  - "_shaped_matrix"
  - "_tick"
  - "_ws"
  - "append"
  - "book"
  - "header_row"
  - "last_col"
  - "last_row"
  - "raw"
  - "row"
  - "used_last_col"
  - "used_last_row"
calls_external:
  - "Add"
  - "Copy"
  - "Delete"
  - "End"
  - "Find"
  - "PythonComSkillError"
  - "_XL_UP"
  - "book_name"
  - "books"
  - "c"
  - "dest_sheet"
  - "detect_bounds"
  - "dst_next"
  - "enumerate"
  - "first_or_named_ws"
  - "hdr"
  - "header_cols"
  - "int"
  - "isinstance"
  - "len"
  - "list"
  - "max"
  - "min"
  - "rng"
  - "row_values"
  - "sample"
  - "sample_rng"
  - "scan_end"
  - "set"
  - "src_books"
  - "src_ctx"
  - "src_sheet"
  - "src_ws"
  - "start_row"
  - "str"
  - "strip"
  - "sub"
  - "suffix"
  - "sum"
  - "unique_sheet_name"
called_by: []
reads:
  - "_XL_UP"
  - "self._app"
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self.book"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
동일 포맷 여러 입력 파일의 표를 현재 워크북 새 시트에 이어붙인다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `Worksheets`, `_excel_collection_names`, `_shaped_matrix`, `_tick`, `_ws`, `append`, `book`, `header_row`, `last_col`, `last_row`, `raw`, `row`, `used_last_col`, `used_last_row`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
