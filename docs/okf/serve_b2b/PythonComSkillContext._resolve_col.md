---
type: method
title: PythonComSkillContext._resolve_col
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, col, header_row=1)"
role: "열 지정을 1-based 번호로 해석한다. 'A' 같은 열 문자 / 1 같은 번호 / 헤더명 모두 허용."
role_source: docstring
version: "0.5.19"
loc: "serve_b2b.py:10354-10363"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "col"
  - "header_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_col_index"
  - "col"
  - "find_header"
  - "header_row"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "bool"
  - "fullmatch"
  - "int"
  - "isinstance"
  - "s"
  - "str"
  - "strip"
called_by:
  - "PythonComSkillContext.add_total_row"
  - "PythonComSkillContext.copy_key_blocks"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.fill_sum_col"
  - "PythonComSkillContext.lookup"
  - "PythonComSkillContext.move_col_clear"
  - "PythonComSkillContext.split_column"
  - "PythonComSkillContext.sum_column"
  - "PythonComSkillContext.sum_lookup"
  - "PythonComSkillContext.sum_where"
  - "PythonComSkillContext.swap_cols"
reads:
  - "self._col_index"
  - "self.find_header"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
열 지정을 1-based 번호로 해석한다. 'A' 같은 열 문자 / 1 같은 번호 / 헤더명 모두 허용.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col_index`, `col`, `find_header`, `header_row`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext.add_total_row`, `PythonComSkillContext.copy_key_blocks`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.fill_sum_col`, `PythonComSkillContext.lookup`, `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.split_column`, `PythonComSkillContext.sum_column`, `PythonComSkillContext.sum_lookup`, `PythonComSkillContext.sum_where`, `PythonComSkillContext.swap_cols`

## 실패/예외
- `PythonComSkillError`
