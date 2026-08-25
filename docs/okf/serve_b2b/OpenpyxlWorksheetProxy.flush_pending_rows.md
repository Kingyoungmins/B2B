---
type: method
title: OpenpyxlWorksheetProxy.flush_pending_rows
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlWorksheetProxy
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:17732-17785"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_opxl_write_cell"
  - "append"
  - "cell"
  - "range"
  - "value"
  - "values"
calls_external:
  - "bool"
  - "c"
  - "current_max_col"
  - "current_max_row"
  - "getattr"
  - "int"
  - "is_blank_initial_row"
  - "items"
  - "len"
  - "max"
  - "row_idx"
  - "setattr"
  - "sorted"
  - "write_direct"
called_by:
  - "OpenpyxlSkillContext.display_rows"
  - "OpenpyxlSkillContext.rows"
  - "OpenpyxlSkillContext.value"
  - "OpenpyxlWorksheetProxy.Cells"
  - "OpenpyxlWorksheetProxy.Range"
  - "OpenpyxlWorksheetProxy.UsedRange"
  - "OpenpyxlWorksheetProxy._formula_cells"
  - "OpenpyxlWorksheetProxy.append"
  - "OpenpyxlWorksheetProxy.cell"
  - "OpenpyxlWorksheetProxy.clear"
  - "OpenpyxlWorksheetProxy.delete_cols"
  - "OpenpyxlWorksheetProxy.delete_rows"
  - "OpenpyxlWorksheetProxy.insert_cols"
  - "OpenpyxlWorksheetProxy.insert_rows"
  - "_OpxlRowProxy.values"
  - "_run_openpyxl_python_pipeline_impl"
reads:
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_opxl_write_cell`, `append`, `cell`, `range`, `value`, `values`
- 피호출(영향 전파 경로): `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.rows`, `OpenpyxlSkillContext.value`, `OpenpyxlWorksheetProxy.Cells`, `OpenpyxlWorksheetProxy.Range`, `OpenpyxlWorksheetProxy.UsedRange`, `OpenpyxlWorksheetProxy._formula_cells`, `OpenpyxlWorksheetProxy.append`, `OpenpyxlWorksheetProxy.cell`, `OpenpyxlWorksheetProxy.clear`, `OpenpyxlWorksheetProxy.delete_cols`, `OpenpyxlWorksheetProxy.delete_rows`, `OpenpyxlWorksheetProxy.insert_cols`, `OpenpyxlWorksheetProxy.insert_rows`, `_OpxlRowProxy.values`, `_run_openpyxl_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
