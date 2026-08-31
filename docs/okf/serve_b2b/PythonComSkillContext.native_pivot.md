---
type: method
title: PythonComSkillContext.native_pivot
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, group_by, value=None, agg='sum', dest_name=None, column=None, header_rows=1)"
role: "엑셀 '진짜 피벗테이블(PivotTable 개체)'을 새 시트에 만든다 — 원본 데이터와 연결돼 '새로 고침'이"
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:14051-14186"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "group_by"
  - "value"
  - "agg"
  - "dest_name"
  - "column"
  - "header_rows"
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
  - "_col_index"
  - "_excel_collection_names"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "add_sheet"
  - "append"
  - "range"
  - "sheet"
  - "used_last_col"
  - "used_last_row"
  - "value"
  - "values"
calls_external:
  - "AddDataField"
  - "Create"
  - "CreatePivotTable"
  - "Delete"
  - "PivotCaches"
  - "PivotFields"
  - "PythonComSkillError"
  - "XL_DB"
  - "_fname"
  - "_headers_at"
  - "_hits"
  - "_r"
  - "_spec"
  - "_wanted"
  - "a"
  - "agg"
  - "aggs"
  - "all"
  - "an"
  - "column"
  - "field_names"
  - "fn"
  - "fnm"
  - "fullmatch"
  - "g"
  - "get"
  - "gfn"
  - "group_by"
  - "h"
  - "hr"
  - "index"
  - "int"
  - "isinstance"
  - "last_c"
  - "last_r"
  - "len"
  - "list"
  - "lower"
  - "max"
  - "min"
called_by:
  - "PythonComSkillContext.pivot"
reads:
  - "self._col_index"
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self._ws"
  - "self.add_sheet"
  - "self.used_last_col"
  - "self.used_last_row"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
엑셀 '진짜 피벗테이블(PivotTable 개체)'을 새 시트에 만든다 — 원본 데이터와 연결돼 '새로 고침'이

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `Worksheets`, `_col_index`, `_excel_collection_names`, `_tick`, `_vba_trace`, `_ws`, `add_sheet`, `append`, `range`, `sheet`, `used_last_col`, `used_last_row`, `value`, `values`
- 피호출(영향 전파 경로): `PythonComSkillContext.pivot`

## 실패/예외
- `PythonComSkillError`
