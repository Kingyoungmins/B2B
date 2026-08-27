---
type: function
title: raise_if_pipeline_cancelled
module: serve_b2b.py
lang: python
extraction: ast
signature: "(job_id)"
role: "협조적 취소 체크포인트 — 스텝 경계에서 호출. 취소 요청이 있으면 cancelled 플래그가"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:2852-2874"

# ── 입출력 ──
inputs:
  - "job_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PipelineExecutionError"

# ── 유기적 관계 ──
calls:
  - "_vba_trace"
  - "pipeline_job_cancel_requested"
calls_external:
  - "PipelineExecutionError"
  - "cur"
  - "float"
  - "get"
  - "job_id"
  - "req_at"
  - "round"
  - "str"
  - "time"
  - "waited"
called_by:
  - "_run_excel_python_pipeline_impl"
  - "_run_openpyxl_python_pipeline_impl"
reads:
  - "PIPELINE_JOBS"
  - "PIPELINE_JOBS_LOCK"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
협조적 취소 체크포인트 — 스텝 경계에서 호출. 취소 요청이 있으면 cancelled 플래그가

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_trace`, `pipeline_job_cancel_requested`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`, `_run_openpyxl_python_pipeline_impl`

## 실패/예외
- `PipelineExecutionError`
