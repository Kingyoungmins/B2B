---
type: method
title: PythonComSkillContext.pivot
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, group_by, value=None, agg='sum', dest_name=None, header_rows=1, after=None, column=None)"
role: "그룹별 집계 요약 표를 **새 시트(현재 활성 파일)**에 만든다(Python 집계 — 안정적)."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:9165-9270"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "group_by"
  - "value"
  - "agg"
  - "dest_name"
  - "header_rows"
  - "after"
  - "column"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_col0"
  - "_col_index"
  - "_excel_collection_names"
  - "_pivot_crosstab"
  - "_tick"
  - "add_sheet"
  - "append"
  - "range"
  - "read"
  - "replace"
  - "sheet"
  - "value"
  - "values"
  - "write"
calls_external:
  - "PythonComSkillError"
  - "_agg"
  - "_to_num"
  - "after"
  - "agg"
  - "aggs"
  - "bool"
  - "c_i"
  - "ckeys"
  - "column"
  - "data"
  - "enumerate"
  - "float"
  - "fullmatch"
  - "g"
  - "g_i"
  - "gidx"
  - "grid"
  - "group_by"
  - "h"
  - "header"
  - "int"
  - "isinstance"
  - "key"
  - "len"
  - "list"
  - "lower"
  - "max"
  - "min"
  - "name"
  - "nums"
  - "order"
  - "out"
  - "r"
  - "rkeys"
  - "row_label"
  - "s"
  - "spec"
  - "str"
  - "strip"
called_by: []
reads:
  - "self._col_index"
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self.add_sheet"
  - "self.read"
  - "self.write"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
그룹별 집계 요약 표를 **새 시트(현재 활성 파일)**에 만든다(Python 집계 — 안정적).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_col0`, `_col_index`, `_excel_collection_names`, `_pivot_crosstab`, `_tick`, `add_sheet`, `append`, `range`, `read`, `replace`, `sheet`, `value`, `values`, `write`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
