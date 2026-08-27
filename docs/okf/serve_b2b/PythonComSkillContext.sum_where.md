---
type: method
title: PythonComSkillContext.sum_where
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, value_col, conditions, header_row=None)"
role: "조건(AND 전부 만족)에 맞는 행의 value_col 숫자를 합산해 값을 반환한다(쓰기 X → 반환값을"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:14478-14521"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "value_col"
  - "conditions"
  - "header_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_coerce_number"
  - "_col_letter"
  - "_cond_match"
  - "_resolve_col"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "append"
  - "cell"
  - "col"
  - "header_row"
  - "last_row"
  - "range"
  - "read"
  - "sheet"
  - "start"
calls_external:
  - "all"
  - "c"
  - "cond"
  - "int"
  - "last"
  - "len"
  - "norm_conds"
  - "op"
  - "str"
  - "total"
  - "val"
  - "value_col"
  - "vc"
called_by: []
reads:
  - "self._resolve_col"
  - "self._tick"
  - "self._ws"
  - "self.last_row"
  - "self.read"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
조건(AND 전부 만족)에 맞는 행의 value_col 숫자를 합산해 값을 반환한다(쓰기 X → 반환값을

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_coerce_number`, `_col_letter`, `_cond_match`, `_resolve_col`, `_tick`, `_vba_trace`, `_ws`, `append`, `cell`, `col`, `header_row`, `last_row`, `range`, `read`, `sheet`, `start`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
