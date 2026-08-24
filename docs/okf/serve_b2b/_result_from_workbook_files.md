---
type: function
title: _result_from_workbook_files
module: serve_b2b.py
lang: python
extraction: ast
signature: "(output_path, input_paths_by_name, output_item, output_wb_record, input_wb_records, payload, resume_from)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:19070-19121"

# ── 입출력 ──
inputs:
  - "output_path"
  - "input_paths_by_name"
  - "output_item"
  - "output_wb_record"
  - "input_wb_records"
  - "payload"
  - "resume_from"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): RESULTS"
raises: []

# ── 유기적 관계 ──
calls:
  - "build_result_previews"
  - "inspect_workbook"
  - "rows_only_sheets"
  - "update_workbook_current_cache"
calls_external:
  - "Path"
  - "current"
  - "exists"
  - "get"
  - "input_previews"
  - "input_wb_records"
  - "ip"
  - "items"
  - "name"
  - "out_path"
  - "output_file_id"
  - "output_path"
  - "output_wb_record"
  - "path"
  - "rec"
  - "result_output"
  - "str"
  - "time"
  - "uuid4"
  - "zip"
called_by:
  - "_run_excel_python_pipeline_impl"
reads:
  - "RESULTS"
writes:
  - "RESULTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): RESULTS
- 변경 상태 `RESULTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `build_result_previews`, `inspect_workbook`, `rows_only_sheets`, `update_workbook_current_cache`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
