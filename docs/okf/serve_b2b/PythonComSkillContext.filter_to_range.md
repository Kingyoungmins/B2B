---
type: method
title: PythonComSkillContext.filter_to_range
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, predicate, dest_sheet, dest_cell, header_rows=1, include_header=False, clear_existing=False)"
role: "조건에 맞는 행을 **이미 있는 시트의 정한 자리**에 붙인다(서식 보존, 원본은 그대로)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:13575-13733"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "predicate"
  - "dest_sheet"
  - "dest_cell"
  - "header_rows"
  - "include_header"
  - "clear_existing"
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
  - "_as_declarative_filter"
  - "_col_index"
  - "_journal_save"
  - "_mark_mutated"
  - "_rng"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "append"
  - "header_row"
  - "last_col"
  - "last_row"
  - "read"
  - "row"
  - "sheet"
calls_external:
  - "AutoFilter"
  - "ClearContents"
  - "Copy"
  - "PythonComSkillError"
  - "SpecialCells"
  - "_clear_block"
  - "a"
  - "b"
  - "blk"
  - "bool"
  - "col_idx"
  - "dest_cell"
  - "dest_sheet"
  - "dlast"
  - "dws"
  - "enumerate"
  - "field"
  - "first_col"
  - "first_row"
  - "header_rows"
  - "int"
  - "isinstance"
  - "len"
  - "list"
  - "matched_rows"
  - "max"
  - "n"
  - "out_col0"
  - "out_row0"
  - "predicate"
  - "r"
  - "row_at"
  - "str"
  - "sum"
  - "v"
called_by: []
reads:
  - "self._app"
  - "self._col_index"
  - "self._journal_save"
  - "self._mark_mutated"
  - "self._rng"
  - "self._shared"
  - "self._tick"
  - "self._ws"
  - "self.read"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
조건에 맞는 행을 **이미 있는 시트의 정한 자리**에 붙인다(서식 보존, 원본은 그대로).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `_as_declarative_filter`, `_col_index`, `_journal_save`, `_mark_mutated`, `_rng`, `_tick`, `_vba_trace`, `_ws`, `append`, `header_row`, `last_col`, `last_row`, `read`, `row`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
