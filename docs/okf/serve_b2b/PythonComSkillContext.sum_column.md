---
type: method
title: PythonComSkillContext.sum_column
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, col, header_row=None, exclude_total_rows=True)"
role: "열(col: 열문자 'F' / 헤더명 '합계' / 열번호 6)의 숫자 값을 더해 **합계 값을 반환**한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:12754-12797"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "col"
  - "header_row"
  - "exclude_total_rows"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "_coerce_number"
  - "_col_letter"
  - "_is_total_label"
  - "_resolve_col"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "col"
  - "header_row"
  - "last_row"
  - "range"
  - "read"
  - "sheet"
calls_external:
  - "L"
  - "bool"
  - "exclude_total_rows"
  - "excluded"
  - "hr"
  - "int"
  - "labels"
  - "last"
  - "len"
  - "row_labels"
  - "start"
  - "str"
  - "tcol"
  - "total"
  - "vals"
called_by: []
reads:
  - "self._resolve_col"
  - "self._tick"
  - "self._ws"
  - "self.last_row"
  - "self.read"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
열(col: 열문자 'F' / 헤더명 '합계' / 열번호 6)의 숫자 값을 더해 **합계 값을 반환**한다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `_coerce_number`, `_col_letter`, `_is_total_label`, `_resolve_col`, `_tick`, `_vba_trace`, `_ws`, `col`, `header_row`, `last_row`, `range`, `read`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
