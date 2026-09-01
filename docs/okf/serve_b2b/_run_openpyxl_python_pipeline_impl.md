---
type: function
title: _run_openpyxl_python_pipeline_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(payload, job_id=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "serve_b2b.py:19624-19817"

# ── 입출력 ──
inputs:
  - "payload"
  - "job_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): RESULTS"
  - "파일시스템 변경/IO"
raises:
  - "PipelineExecutionError"
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_pipeline_error_guide"
  - "_safe_python_globals"
  - "build_result_previews"
  - "flush_pending_rows"
  - "get_workbook_or_raise"
  - "inspect_workbook"
  - "is_python_pipeline_step"
  - "normalize_python_pipeline_code"
  - "openpyxl_load_workbook_compatible"
  - "raise_if_pipeline_cancelled"
  - "rows_only_sheets"
  - "update_pipeline_job"
  - "update_workbook_current_cache"
calls_external:
  - "OpenpyxlSkillContext"
  - "Path"
  - "PipelineExecutionError"
  - "RuntimeError"
  - "_code_all"
  - "active_steps"
  - "bool"
  - "callable"
  - "chr"
  - "code"
  - "compile"
  - "ctx"
  - "current"
  - "dict"
  - "enumerate"
  - "err"
  - "exec"
  - "get"
  - "getattr"
  - "id"
  - "input_download_urls"
  - "input_items"
  - "input_previews"
  - "input_result_path"
  - "input_wb_records"
  - "input_wbs"
  - "job_id"
  - "join"
  - "len"
  - "lower"
  - "mkdir"
  - "name"
  - "namespace"
  - "original_code"
  - "original_name"
  - "output_cached_wb"
  - "output_name"
  - "output_path"
  - "output_wb"
  - "output_wb_record"
called_by:
  - "run_openpyxl_python_pipeline_payload"
reads:
  - "BACKEND_DIR"
  - "RESULTS"
writes:
  - "RESULTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): RESULTS
- 파일시스템 변경/IO
- 변경 상태 `RESULTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_pipeline_error_guide`, `_safe_python_globals`, `build_result_previews`, `flush_pending_rows`, `get_workbook_or_raise`, `inspect_workbook`, `is_python_pipeline_step`, `normalize_python_pipeline_code`, `openpyxl_load_workbook_compatible`, `raise_if_pipeline_cancelled`, `rows_only_sheets`, `update_pipeline_job`, `update_workbook_current_cache`
- 피호출(영향 전파 경로): `run_openpyxl_python_pipeline_payload`

## 실패/예외
- `PipelineExecutionError`
- `RuntimeError`
