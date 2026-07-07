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
version: "0.5.19"
loc: "serve_b2b.py:9313-9356"

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
  - "_excel_collection_names"
  - "_tick"
  - "_ws"
  - "add_sheet"
  - "append"
  - "read"
  - "row"
  - "sheet"
  - "write"
calls_external:
  - "PythonComSkillError"
  - "after"
  - "bool"
  - "dest_name"
  - "header_rows"
  - "int"
  - "len"
  - "list"
  - "matched"
  - "max"
  - "out"
  - "predicate"
  - "r"
  - "str"
called_by: []
reads:
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self._ws"
  - "self.add_sheet"
  - "self.read"
  - "self.write"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
조건에 맞는 행만 골라 **새 시트(현재 활성 파일)**에 정리한다 — 원본은 그대로 둔다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_collection_names`, `_tick`, `_ws`, `add_sheet`, `append`, `read`, `row`, `sheet`, `write`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
