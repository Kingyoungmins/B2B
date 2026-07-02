---
type: method
title: PythonComSkillContext.read
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range=None)"
role: "범위를 2차원 리스트로 한 번에 읽는다(COM 1회). a1_range 생략 시 used range."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:8751-8778"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_rng"
  - "_shaped_matrix"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "a1_range"
  - "cells"
  - "int"
  - "ms"
  - "perf_counter"
  - "rng"
  - "round"
  - "str"
  - "ws"
called_by:
  - "B2BHandler.handle_logic_backup"
  - "B2BHandler.handle_workbook_upload"
  - "B2BHandler.proxy"
  - "B2BHandler.read_json_body"
  - "PythonComSkillContext.dedupe"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.lookup"
  - "PythonComSkillContext.move_cols"
  - "PythonComSkillContext.pivot"
  - "PythonComSkillContext.read_cell"
  - "PythonComSkillContext.split_column"
  - "_xlsx_has_formulas"
  - "_xlsx_has_merged_cells"
  - "office_file_signature"
  - "run_js_pipeline_with_node"
reads:
  - "PY_READ_MAX_CELLS"
  - "self._rng"
  - "self._shaped_matrix"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
범위를 2차원 리스트로 한 번에 읽는다(COM 1회). a1_range 생략 시 used range.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_rng`, `_shaped_matrix`, `_tick`, `_vba_trace`, `_ws`, `sheet`
- 피호출(영향 전파 경로): `B2BHandler.handle_logic_backup`, `B2BHandler.handle_workbook_upload`, `B2BHandler.proxy`, `B2BHandler.read_json_body`, `PythonComSkillContext.dedupe`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.lookup`, `PythonComSkillContext.move_cols`, `PythonComSkillContext.pivot`, `PythonComSkillContext.read_cell`, `PythonComSkillContext.split_column`, `_xlsx_has_formulas`, `_xlsx_has_merged_cells`, `office_file_signature`, `run_js_pipeline_with_node`

## 실패/예외
- `PythonComSkillError`
