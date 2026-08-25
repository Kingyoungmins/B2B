---
type: method
title: PythonComSkillContext.filter_to_sheet
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, predicate, dest_name, header_rows=1, after=None)"
role: "조건에 맞는 행만 골라 **새 시트(현재 활성 파일)**에 정리한다 — 원본은 그대로 둔다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:13016-13132"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "predicate"
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
  - "_as_declarative_filter"
  - "_excel_collection_names"
  - "_filter_native_worth_it"
  - "_filter_to_sheet_native"
  - "_tick"
  - "_ws"
  - "add_sheet"
  - "append"
  - "range"
  - "read"
  - "row"
  - "sheet"
  - "write"
calls_external:
  - "Copy"
  - "PasteSpecial"
  - "PythonComSkillError"
  - "Union"
  - "_CHUNK"
  - "_decl"
  - "_first_row"
  - "_row_runs"
  - "a"
  - "after"
  - "all_runs"
  - "b"
  - "bool"
  - "dest_name"
  - "enumerate"
  - "header_rows"
  - "int"
  - "len"
  - "list"
  - "matched"
  - "matched_rows"
  - "max"
  - "out"
  - "out_row"
  - "part"
  - "predicate"
  - "r"
  - "rng"
  - "str"
  - "sum"
  - "ws"
called_by: []
reads:
  - "self._app"
  - "self._filter_native_worth_it"
  - "self._filter_to_sheet_native"
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self._ws"
  - "self.add_sheet"
  - "self.read"
  - "self.write"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
조건에 맞는 행만 골라 **새 시트(현재 활성 파일)**에 정리한다 — 원본은 그대로 둔다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `Rows`, `_as_declarative_filter`, `_excel_collection_names`, `_filter_native_worth_it`, `_filter_to_sheet_native`, `_tick`, `_ws`, `add_sheet`, `append`, `range`, `read`, `row`, `sheet`, `write`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
