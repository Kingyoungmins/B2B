---
type: method
title: PythonComSkillContext._filter_to_sheet_native
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, ws, sheet, decl, dest_name, header_rows, after)"
role: "[0.7.5] 자동필터 + 보이는 행 한 번 복사. 성공하면 시트명, 안 되면 None(호출자가 폴백)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:13195-13303"

# ── 입출력 ──
inputs:
  - "self"
  - "ws"
  - "sheet"
  - "decl"
  - "dest_name"
  - "header_rows"
  - "after"
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
  - "Rows"
  - "_col_index"
  - "_excel_collection_names"
  - "_mark_mutated"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "add_sheet"
  - "append"
  - "delete_sheet"
  - "header_row"
  - "last_col"
  - "last_row"
  - "sheet"
calls_external:
  - "AutoFilter"
  - "Copy"
  - "PasteSpecial"
  - "PythonComSkillError"
  - "SpecialCells"
  - "after"
  - "col_idx"
  - "dest_name"
  - "dest_ws"
  - "err"
  - "field"
  - "first_col"
  - "first_row"
  - "header_rows"
  - "int"
  - "isinstance"
  - "len"
  - "matched_n"
  - "max"
  - "out_row"
  - "str"
called_by:
  - "PythonComSkillContext.filter_to_sheet"
reads:
  - "self._app"
  - "self._col_index"
  - "self._mark_mutated"
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self._ws"
  - "self.add_sheet"
  - "self.delete_sheet"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[0.7.5] 자동필터 + 보이는 행 한 번 복사. 성공하면 시트명, 안 되면 None(호출자가 폴백).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `Rows`, `_col_index`, `_excel_collection_names`, `_mark_mutated`, `_tick`, `_vba_trace`, `_ws`, `add_sheet`, `append`, `delete_sheet`, `header_row`, `last_col`, `last_row`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext.filter_to_sheet`

## 실패/예외
- `PythonComSkillError`
