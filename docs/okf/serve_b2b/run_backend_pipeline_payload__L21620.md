---
type: function
title: run_backend_pipeline_payload
module: serve_b2b.py
lang: python
extraction: ast
signature: "(payload, job_id=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:21620-21755"

# ── 입출력 ──
inputs:
  - "payload"
  - "job_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): DIFFS, RESULTS"
raises: []

# ── 유기적 관계 ──
calls:
  - "_pipeline_payload_has_vba"
  - "_pipeline_payload_needs_com"
  - "build_pipeline_diffs"
  - "build_result_previews"
  - "clear"
  - "get_workbook_aoa_for_run"
  - "get_workbook_or_raise"
  - "pipeline_has_python"
  - "run_backend_pipeline_payload_with_worker"
  - "run_excel_python_pipeline_payload"
  - "run_js_pipeline_with_node"
  - "run_openpyxl_python_pipeline_payload"
  - "update_pipeline_job"
  - "update_workbook_current_cache"
calls_external:
  - "active_steps"
  - "base_mode"
  - "current"
  - "dict"
  - "diffs"
  - "enumerate"
  - "forced_value_cells"
  - "get"
  - "input_items"
  - "inputs"
  - "isinstance"
  - "job_id"
  - "len"
  - "lower"
  - "output"
  - "output_wb"
  - "payload"
  - "res"
  - "result_inputs"
  - "result_output"
  - "str"
  - "time"
  - "uuid4"
  - "wb"
called_by:
  - "B2BHandler.handle_backend_pipeline_run"
  - "B2BHandler.handle_backend_pipeline_start"
reads:
  - "DIFFS"
  - "NODE_WORKER_READY"
  - "RESULTS"
writes:
  - "DIFFS"
  - "RESULTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): DIFFS, RESULTS
- 변경 상태 `DIFFS, RESULTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_pipeline_payload_has_vba`, `_pipeline_payload_needs_com`, `build_pipeline_diffs`, `build_result_previews`, `clear`, `get_workbook_aoa_for_run`, `get_workbook_or_raise`, `pipeline_has_python`, `run_backend_pipeline_payload_with_worker`, `run_excel_python_pipeline_payload`, `run_js_pipeline_with_node`, `run_openpyxl_python_pipeline_payload`, `update_pipeline_job`, `update_workbook_current_cache`
- 피호출(영향 전파 경로): `B2BHandler.handle_backend_pipeline_run`, `B2BHandler.handle_backend_pipeline_start`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
