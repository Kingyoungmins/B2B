---
type: method
title: PythonComSkillContext._ctx_and_sheet_from_spec
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet_spec)"
role: "Resolve \"workbook.xlsx!Sheet1\" into a context + sheet name."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12331-12357"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_spec"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "book"
calls_external:
  - "book_part"
  - "group"
  - "match"
  - "rsplit"
  - "str"
  - "strip"
  - "text"
called_by:
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.copy_key_blocks"
  - "PythonComSkillContext.copy_values"
  - "PythonComSkillContext.match_fill"
  - "PythonComSkillContext.sum_lookup"
reads:
  - "self.book"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Resolve "workbook.xlsx!Sheet1" into a context + sheet name.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `book`
- 피호출(영향 전파 경로): `PythonComSkillContext.copy`, `PythonComSkillContext.copy_key_blocks`, `PythonComSkillContext.copy_values`, `PythonComSkillContext.match_fill`, `PythonComSkillContext.sum_lookup`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
