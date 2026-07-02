---
type: method
title: ExcelSkillContext.pivot
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, sheet_or_name, group_by=None, value=None, agg='sum', dest_name=None, header_rows=1, workbook=None, **kwargs)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:11851-11917"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "group_by"
  - "value"
  - "agg"
  - "dest_name"
  - "header_rows"
  - "workbook"
  - "**kwargs"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_col0"
  - "_default_workbook"
  - "_merge_pivot_grid_into_base"
  - "_num"
  - "_write_grid"
  - "_ws_of"
  - "add_sheet"
  - "append"
  - "header_row"
  - "range"
  - "rows"
  - "value"
  - "values"
calls_external:
  - "_aggregate"
  - "agg"
  - "aggs"
  - "dest"
  - "dest_wb"
  - "enumerate"
  - "g"
  - "get"
  - "gidx"
  - "grid"
  - "group_by"
  - "hr"
  - "int"
  - "isinstance"
  - "key"
  - "label"
  - "len"
  - "list"
  - "lower"
  - "max"
  - "min"
  - "nums"
  - "r"
  - "sheet_or_name"
  - "str"
  - "sum"
  - "tuple"
  - "v"
  - "vals"
  - "vidxs"
  - "workbook"
  - "ws"
  - "zip"
called_by: []
reads:
  - "self._col0"
  - "self._default_workbook"
  - "self._merge_pivot_grid_into_base"
  - "self._num"
  - "self._write_grid"
  - "self._ws_of"
  - "self.add_sheet"
  - "self.rows"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col0`, `_default_workbook`, `_merge_pivot_grid_into_base`, `_num`, `_write_grid`, `_ws_of`, `add_sheet`, `append`, `header_row`, `range`, `rows`, `value`, `values`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
