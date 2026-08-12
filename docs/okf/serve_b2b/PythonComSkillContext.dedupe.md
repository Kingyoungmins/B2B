---
type: method
title: PythonComSkillContext.dedupe
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, key_cols, header_row=1, keep='first')"
role: "key_cols(열 리스트/단일) 조합이 같은 중복 행을 삭제한다. keep='first'면 처음 것, 'last'면 마지막 것을"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:13663-13694"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "key_cols"
  - "header_row"
  - "keep"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_col_letter"
  - "_resolve_col"
  - "add"
  - "append"
  - "delete_rows"
  - "header_row"
  - "last_row"
  - "normalize"
  - "range"
  - "read"
  - "sheet"
calls_external:
  - "all"
  - "c"
  - "dup_rows"
  - "hr"
  - "idx"
  - "int"
  - "isinstance"
  - "keep"
  - "key"
  - "key_cols"
  - "last"
  - "len"
  - "max"
  - "n"
  - "r"
  - "set"
  - "sorted"
  - "str"
  - "tuple"
called_by: []
reads:
  - "self._resolve_col"
  - "self.delete_rows"
  - "self.last_row"
  - "self.normalize"
  - "self.read"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
key_cols(열 리스트/단일) 조합이 같은 중복 행을 삭제한다. keep='first'면 처음 것, 'last'면 마지막 것을

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col_letter`, `_resolve_col`, `add`, `append`, `delete_rows`, `header_row`, `last_row`, `normalize`, `range`, `read`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
