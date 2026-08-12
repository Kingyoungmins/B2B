---
type: function
title: update_pipeline_job
module: serve_b2b.py
lang: python
extraction: ast
signature: "(job_id, patch)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:2579-2587"

# ── 입출력 ──
inputs:
  - "job_id"
  - "patch"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): PIPELINE_JOBS"
raises: []

# ── 유기적 관계 ──
calls:
  - "prune_pipeline_jobs_locked"
calls_external:
  - "get"
  - "job_id"
  - "patch"
  - "time"
  - "update"
called_by:
  - "B2BHandler.handle_backend_pipeline_start"
  - "_run_excel_python_pipeline_impl"
  - "_run_openpyxl_python_pipeline_impl"
  - "run_backend_pipeline_payload"
  - "run_backend_pipeline_payload_with_worker"
  - "run_js_pipeline_with_node"
reads:
  - "PIPELINE_JOBS"
  - "PIPELINE_JOBS_LOCK"
writes:
  - "PIPELINE_JOBS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): PIPELINE_JOBS
- 변경 상태 `PIPELINE_JOBS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `prune_pipeline_jobs_locked`
- 피호출(영향 전파 경로): `B2BHandler.handle_backend_pipeline_start`, `_run_excel_python_pipeline_impl`, `_run_openpyxl_python_pipeline_impl`, `run_backend_pipeline_payload`, `run_backend_pipeline_payload_with_worker`, `run_js_pipeline_with_node`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
