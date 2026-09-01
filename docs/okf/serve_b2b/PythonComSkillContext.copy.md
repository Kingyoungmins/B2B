---
type: method
title: PythonComSkillContext.copy
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, src_sheet, src_range, dst_sheet, dst_cell)"
role: "Excel 네이티브 복사(값+수식+서식+병합 보존). '복사/복붙' 요청의 기본 수단."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:13126-13172"

# ── 입출력 ──
inputs:
  - "self"
  - "src_sheet"
  - "src_range"
  - "dst_sheet"
  - "dst_cell"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_clamp_full_span"
  - "_ctx_and_sheet_from_spec"
  - "_journal_save"
  - "_mirror_unprotected_for_paste"
  - "_resize_rng"
  - "_rng"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "append"
calls_external:
  - "Copy"
  - "cells"
  - "dst"
  - "dst_cell"
  - "dst_sheet"
  - "dst_sheet_name"
  - "dst_target"
  - "dst_ws"
  - "int"
  - "ms"
  - "perf_counter"
  - "round"
  - "src"
  - "src_range"
  - "src_sheet"
  - "src_sheet_name"
  - "src_ws"
  - "str"
called_by:
  - "PythonComSkillContext.move_col_clear"
  - "PythonComSkillContext.move_cols"
  - "_opxl_copy_cell_presentation"
reads:
  - "self._app"
  - "self._ctx_and_sheet_from_spec"
  - "self._resize_rng"
  - "self._shared"
  - "self._tick"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
Excel 네이티브 복사(값+수식+서식+병합 보존). '복사/복붙' 요청의 기본 수단.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_clamp_full_span`, `_ctx_and_sheet_from_spec`, `_journal_save`, `_mirror_unprotected_for_paste`, `_resize_rng`, `_rng`, `_tick`, `_vba_trace`, `_ws`, `append`
- 피호출(영향 전파 경로): `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.move_cols`, `_opxl_copy_cell_presentation`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
