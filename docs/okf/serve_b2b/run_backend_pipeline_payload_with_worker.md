---
type: function
title: run_backend_pipeline_payload_with_worker
module: serve_b2b.py
lang: python
extraction: ast
signature: "(payload, job_id=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:20109-20238"

# ── 입출력 ──
inputs:
  - "payload"
  - "job_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): DIFFS, RESULTS"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "append"
  - "ensure_worker_workbook"
  - "get_workbook_or_raise"
  - "node_worker_command"
  - "update_pipeline_job"
calls_external:
  - "RuntimeError"
  - "active_steps"
  - "bool"
  - "enumerate"
  - "extend"
  - "get"
  - "input_items"
  - "input_name"
  - "job_id"
  - "len"
  - "output_wb"
  - "perf_counter"
  - "round"
  - "startswith"
  - "str"
  - "time"
  - "uuid4"
  - "wb"
  - "worker_workbook_id"
called_by:
  - "run_backend_pipeline_payload"
reads:
  - "DIFFS"
  - "RESULTS"
writes:
  - "DIFFS"
  - "RESULTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): DIFFS, RESULTS
- 변경 상태 `DIFFS, RESULTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `append`, `ensure_worker_workbook`, `get_workbook_or_raise`, `node_worker_command`, `update_pipeline_job`
- 피호출(영향 전파 경로): `run_backend_pipeline_payload`

## 실패/예외
- `RuntimeError`
