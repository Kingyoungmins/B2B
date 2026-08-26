---
type: method
title: PythonComSkillContext.sheets
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self)"
role: "시트 이름 목록."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12108-12111"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_collection_names"
  - "_tick"
calls_external: []
called_by:
  - "build_result_previews"
  - "inspect_workbook"
  - "write_result_workbook"
reads:
  - "self._tick"
  - "self._wb"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
시트 이름 목록.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_collection_names`, `_tick`
- 피호출(영향 전파 경로): `build_result_previews`, `inspect_workbook`, `write_result_workbook`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
