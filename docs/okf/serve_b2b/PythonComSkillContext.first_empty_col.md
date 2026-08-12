---
type: method
title: PythonComSkillContext.first_empty_col
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, after=None, header_row=1)"
role: "'빈 보조열'을 찾아 그 열 '문자'(예 \"N\")를 돌려준다. after(마지막 데이터 열, 예 \"L\")를 주면 그 다음"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:11349-11391"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "after"
  - "header_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_col_index"
  - "_col_letter"
  - "_tick"
  - "_ws"
  - "row"
  - "sheet"
  - "used_last_col"
  - "used_last_row"
calls_external:
  - "_col_empty"
  - "after"
  - "c"
  - "fullmatch"
  - "hr"
  - "int"
  - "isinstance"
  - "last_r"
  - "max"
  - "s"
  - "start"
  - "str"
  - "strip"
  - "vals"
called_by: []
reads:
  - "self._col_index"
  - "self._tick"
  - "self._ws"
  - "self.used_last_col"
  - "self.used_last_row"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
'빈 보조열'을 찾아 그 열 '문자'(예 "N")를 돌려준다. after(마지막 데이터 열, 예 "L")를 주면 그 다음

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `_col_index`, `_col_letter`, `_tick`, `_ws`, `row`, `sheet`, `used_last_col`, `used_last_row`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
