---
type: method
title: PythonComSkillContext.move_col_clear
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, src, dst, header_row=None, clear_source=True)"
role: "한 열의 내용(헤더+데이터+서식+세로병합)을 다른 열로 옮기고 원래 열은 '비운다'(열 구조는 유지 —"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:13858-13901"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "src"
  - "dst"
  - "header_row"
  - "clear_source"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_col_letter"
  - "_resolve_col"
  - "_tick"
  - "_ws"
  - "append"
  - "clear"
  - "copy"
  - "header_row"
  - "last_row"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "UnMerge"
  - "dst"
  - "dst_i"
  - "int"
  - "last"
  - "max"
  - "min"
  - "r"
  - "src"
  - "src_i"
  - "src_rng"
called_by:
  - "PythonComSkillContext.copy_col"
reads:
  - "self._resolve_col"
  - "self._shared"
  - "self._tick"
  - "self._ws"
  - "self.clear"
  - "self.copy"
  - "self.last_row"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
한 열의 내용(헤더+데이터+서식+세로병합)을 다른 열로 옮기고 원래 열은 '비운다'(열 구조는 유지 —

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `Cells`, `Range`, `_col_letter`, `_resolve_col`, `_tick`, `_ws`, `append`, `clear`, `copy`, `header_row`, `last_row`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext.copy_col`

## 실패/예외
- `PythonComSkillError`
