---
type: function
title: run_js_pipeline_with_node
module: serve_b2b.py
lang: python
extraction: ast
signature: "(payload, job_id=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:21189-21579"

# ── 입출력 ──
inputs:
  - "payload"
  - "job_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "서브프로세스/OS 호출"
  - "파일시스템 변경/IO"
raises:
  - "PipelineExecutionError"
  - "RuntimeError"
  - "TimeoutError"

# ── 유기적 관계 ──
calls:
  - "hidden_subprocess_kwargs"
  - "node_executable"
  - "read"
  - "update_pipeline_job"
  - "write"
calls_external:
  - "NamedTemporaryFile"
  - "PipelineExecutionError"
  - "Popen"
  - "RuntimeError"
  - "TimeoutError"
  - "close"
  - "dict"
  - "dumps"
  - "exists"
  - "f"
  - "get"
  - "getmtime"
  - "info"
  - "job_id"
  - "kill"
  - "load"
  - "loads"
  - "message"
  - "open"
  - "payload"
  - "poll"
  - "progress"
  - "progress_path"
  - "seek"
  - "sleep"
  - "stderr_handle"
  - "stderr_path"
  - "stdout"
  - "stdout_handle"
  - "stdout_path"
  - "strip"
  - "temp_path"
  - "time"
  - "unlink"
called_by:
  - "run_backend_pipeline_payload"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 서브프로세스/OS 호출
- 파일시스템 변경/IO

## 관계
- 호출: `hidden_subprocess_kwargs`, `node_executable`, `read`, `update_pipeline_job`, `write`
- 피호출(영향 전파 경로): `run_backend_pipeline_payload`

## 실패/예외
- `PipelineExecutionError`
- `RuntimeError`
- `TimeoutError`
