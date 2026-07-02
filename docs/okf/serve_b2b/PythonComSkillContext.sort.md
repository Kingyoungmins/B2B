---
type: method
title: PythonComSkillContext.sort
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range, key_col, ascending=True, has_header=True)"
role: "실제 범위 정렬. key_col 은 범위 내 1-based 열 번호/'B' 열 문자, 또는 이들의 리스트(다중키)."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:9706-9768"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
  - "key_col"
  - "ascending"
  - "has_header"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Columns"
  - "_col_index"
  - "_journal_save"
  - "_rng"
  - "_tick"
  - "_ws"
  - "append"
  - "find_header"
  - "sheet"
calls_external:
  - "Add"
  - "Apply"
  - "Calculate"
  - "Clear"
  - "PythonComSkillError"
  - "SetRange"
  - "a1_range"
  - "asc"
  - "ascending"
  - "enumerate"
  - "fullmatch"
  - "int"
  - "isinstance"
  - "k"
  - "key_col"
  - "key_idx"
  - "key_rngs"
  - "keys"
  - "kr"
  - "len"
  - "list"
  - "rng"
  - "s"
  - "str"
  - "strip"
  - "ws"
called_by:
  - "_browser_content_target"
reads:
  - "self._col_index"
  - "self._journal_save"
  - "self._rng"
  - "self._tick"
  - "self._ws"
  - "self.find_header"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
실제 범위 정렬. key_col 은 범위 내 1-based 열 번호/'B' 열 문자, 또는 이들의 리스트(다중키).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Columns`, `_col_index`, `_journal_save`, `_rng`, `_tick`, `_ws`, `append`, `find_header`, `sheet`
- 피호출(영향 전파 경로): `_browser_content_target`

## 실패/예외
- `PythonComSkillError`
