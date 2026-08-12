---
type: method
title: PythonComSkillContext.add_total_row
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, sum_cols, label_col=None, label='합계', header_row=1)"
role: "표 끝(마지막 데이터행 바로 아래)에 합계 행을 만든다. sum_cols(열 리스트/단일)에 =SUM(데이터범위) 수식을"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:13848-13867"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "sum_cols"
  - "label_col"
  - "label"
  - "header_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_col_letter"
  - "_resolve_col"
  - "header_row"
  - "last_row"
  - "sheet"
  - "write"
  - "write_formulas"
calls_external:
  - "PythonComSkillError"
  - "c"
  - "hr"
  - "int"
  - "isinstance"
  - "label_col"
  - "last"
  - "max"
  - "sum_cols"
called_by: []
reads:
  - "self._resolve_col"
  - "self.last_row"
  - "self.write"
  - "self.write_formulas"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
표 끝(마지막 데이터행 바로 아래)에 합계 행을 만든다. sum_cols(열 리스트/단일)에 =SUM(데이터범위) 수식을

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col_letter`, `_resolve_col`, `header_row`, `last_row`, `sheet`, `write`, `write_formulas`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
