---
type: function
title: start_runtime_maintenance_threads
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "serve_b2b.py:5566-5595"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): RUNTIME_SAMPLER_STARTED"
raises: []

# ── 유기적 관계 ──
calls:
  - "_addon_telemetry_init"
  - "_reset_trace_logs"
  - "_runtime_maintenance_loop"
  - "_start_log_sync"
  - "cleanup_stale_temp_artifacts"
  - "start"
calls_external:
  - "Thread"
called_by:
  - "main"
reads:
  - "RUNTIME_SAMPLER_STARTED"
writes:
  - "RUNTIME_SAMPLER_STARTED"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): RUNTIME_SAMPLER_STARTED
- 변경 상태 `RUNTIME_SAMPLER_STARTED` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_addon_telemetry_init`, `_reset_trace_logs`, `_runtime_maintenance_loop`, `_start_log_sync`, `cleanup_stale_temp_artifacts`, `start`
- 피호출(영향 전파 경로): `main`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
