---
type: method
title: PythonComSkillContext.pivot
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, group_by, value=None, agg='sum', dest_name=None, header_rows=1, after=None, column=None)"
role: "그룹별 집계 피벗을 새 시트에 만든다. **기본은 엑셀 '진짜 피벗테이블(PivotTable 개체)'**(원본과 연결돼"
role_source: docstring
version: "0.8.1"
loc: "serve_b2b.py:14188-14217"

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
  - "Worksheets"
  - "_excel_collection_names"
  - "_vba_trace"
  - "native_pivot"
  - "sheet"
  - "value"
calls_external:
  - "Delete"
  - "PythonComSkillError"
  - "_e"
  - "agg"
  - "column"
  - "dest_name"
  - "eff"
  - "group_by"
  - "header_rows"
  - "lower"
  - "str"
called_by: []
reads:
  - "self._wb"
  - "self.native_pivot"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
그룹별 집계 피벗을 새 시트에 만든다. **기본은 엑셀 '진짜 피벗테이블(PivotTable 개체)'**(원본과 연결돼

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `_excel_collection_names`, `_vba_trace`, `native_pivot`, `sheet`, `value`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
