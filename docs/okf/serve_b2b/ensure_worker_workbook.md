---
type: function
title: ensure_worker_workbook
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb_record)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:20353-20367"

# ── 입출력 ──
inputs:
  - "wb_record"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "get_workbook_aoa_for_run"
  - "node_worker_command"
calls_external:
  - "get"
  - "wb_record"
  - "workbook_id"
called_by:
  - "run_backend_pipeline_payload_with_worker"
reads:
  - "NODE_WORKER_READY"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `get_workbook_aoa_for_run`, `node_worker_command`
- 피호출(영향 전파 경로): `run_backend_pipeline_payload_with_worker`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
