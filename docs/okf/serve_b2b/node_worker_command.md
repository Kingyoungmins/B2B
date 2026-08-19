---
type: function
title: node_worker_command
module: serve_b2b.py
lang: python
extraction: ast
signature: "(command)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:20404-20428"

# ── 입출력 ──
inputs:
  - "command"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PipelineExecutionError"
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "ensure_node_worker"
  - "write"
calls_external:
  - "PipelineExecutionError"
  - "RuntimeError"
  - "command"
  - "dict"
  - "dumps"
  - "flush"
  - "get"
  - "info"
  - "kill"
  - "line"
  - "loads"
  - "readline"
  - "response_line"
  - "uuid4"
called_by:
  - "ensure_worker_workbook"
  - "export_node_worker_workbook"
  - "run_backend_pipeline_payload_with_worker"
reads:
  - "NODE_WORKER_LOCK"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `ensure_node_worker`, `write`
- 피호출(영향 전파 경로): `ensure_worker_workbook`, `export_node_worker_workbook`, `run_backend_pipeline_payload_with_worker`

## 실패/예외
- `PipelineExecutionError`
- `RuntimeError`
