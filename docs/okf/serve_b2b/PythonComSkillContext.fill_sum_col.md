---
type: method
title: PythonComSkillContext.fill_sum_col
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, dest_col, src_cols, header_row=None)"
role: "합계 열(dest_col)을 원본 열들(src_cols)의 합계 '수식'으로 채운다. dest_col 이 2행 등으로 '세로 병합'된"
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:13225-13261"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "dest_col"
  - "src_cols"
  - "header_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "_col_letter"
  - "_resolve_col"
  - "_tick"
  - "_ws"
  - "append"
  - "header_row"
  - "last_row"
  - "range"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "bool"
  - "c"
  - "dcol"
  - "dest_col"
  - "hr"
  - "int"
  - "isinstance"
  - "join"
  - "parts"
  - "r"
  - "rr"
  - "sc"
  - "src_cols"
  - "top"
  - "v"
called_by: []
reads:
  - "self._resolve_col"
  - "self._shared"
  - "self._tick"
  - "self._ws"
  - "self.last_row"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
합계 열(dest_col)을 원본 열들(src_cols)의 합계 '수식'으로 채운다. dest_col 이 2행 등으로 '세로 병합'된

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `_col_letter`, `_resolve_col`, `_tick`, `_ws`, `append`, `header_row`, `last_row`, `range`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
