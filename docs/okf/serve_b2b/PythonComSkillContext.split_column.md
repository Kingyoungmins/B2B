---
type: method
title: PythonComSkillContext.split_column
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, col, delimiter, into=None, header_row=1)"
role: "col 셀을 delimiter 로 나눠 col 바로 오른쪽의 새 열들에 기록한다(예: \"1001/홍길동\" → 가입번호 / 고객명)."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:14736-14758"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "col"
  - "delimiter"
  - "into"
  - "header_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_col_letter"
  - "_resolve_col"
  - "col"
  - "header_row"
  - "insert_cols"
  - "last_row"
  - "range"
  - "read"
  - "sheet"
  - "write"
calls_external:
  - "ccol"
  - "d"
  - "delimiter"
  - "int"
  - "into"
  - "len"
  - "max"
  - "p"
  - "split"
  - "src"
  - "str"
  - "width"
called_by: []
reads:
  - "self._resolve_col"
  - "self.insert_cols"
  - "self.last_row"
  - "self.read"
  - "self.write"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
col 셀을 delimiter 로 나눠 col 바로 오른쪽의 새 열들에 기록한다(예: "1001/홍길동" → 가입번호 / 고객명).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col_letter`, `_resolve_col`, `col`, `header_row`, `insert_cols`, `last_row`, `range`, `read`, `sheet`, `write`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
