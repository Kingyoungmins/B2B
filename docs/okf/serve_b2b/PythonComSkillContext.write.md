---
type: method
title: PythonComSkillContext.write
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_start, values, overwrite_formulas=True)"
role: "2차원 리스트를 시작 셀 기준으로 한 번에 쓴다(COM 1회)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12292-12331"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_start"
  - "values"
  - "overwrite_formulas"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_apply_com_text_format_for_long_digit_columns"
  - "_as_2d"
  - "_journal_save"
  - "_resize_rng"
  - "_rng"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "rows"
  - "sheet"
  - "values"
calls_external:
  - "_v"
  - "a1_start"
  - "anchor"
  - "cells"
  - "cols"
  - "data"
  - "int"
  - "ms"
  - "perf_counter"
  - "rng"
  - "round"
  - "str"
  - "strip"
  - "sum"
  - "ws"
called_by:
  - "B2BHandler.do_POST"
  - "B2BHandler.handle_assist_attachment"
  - "B2BHandler.handle_backend_download"
  - "B2BHandler.handle_workbook_source_download"
  - "B2BHandler.handle_workbook_upload"
  - "B2BHandler.proxy"
  - "B2BHandler.send_json"
  - "PythonComSkillContext._pivot_value_table"
  - "PythonComSkillContext.add_total_row"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.lookup"
  - "PythonComSkillContext.match_fill"
  - "PythonComSkillContext.split_column"
  - "PythonComSkillContext.write_cell"
  - "_diag_prerun_window_state"
  - "_diag_vba_log_line"
  - "_diag_vba_run_failure"
  - "_perf_trace"
  - "_vba_trace"
  - "node_worker_command"
  - "run_js_pipeline_with_node"
reads:
  - "self._as_2d"
  - "self._journal_save"
  - "self._resize_rng"
  - "self._rng"
  - "self._shared"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
2차원 리스트를 시작 셀 기준으로 한 번에 쓴다(COM 1회).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_apply_com_text_format_for_long_digit_columns`, `_as_2d`, `_journal_save`, `_resize_rng`, `_rng`, `_tick`, `_vba_trace`, `_ws`, `rows`, `sheet`, `values`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `B2BHandler.handle_assist_attachment`, `B2BHandler.handle_backend_download`, `B2BHandler.handle_workbook_source_download`, `B2BHandler.handle_workbook_upload`, `B2BHandler.proxy`, `B2BHandler.send_json`, `PythonComSkillContext._pivot_value_table`, `PythonComSkillContext.add_total_row`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.lookup`, `PythonComSkillContext.match_fill`, `PythonComSkillContext.split_column`, `PythonComSkillContext.write_cell`, `_diag_prerun_window_state`, `_diag_vba_log_line`, `_diag_vba_run_failure`, `_perf_trace`, `_vba_trace`, `node_worker_command`, `run_js_pipeline_with_node`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
