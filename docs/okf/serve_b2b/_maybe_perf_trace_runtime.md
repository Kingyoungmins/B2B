---
type: function
title: _maybe_perf_trace_runtime
module: serve_b2b.py
lang: python
extraction: ast
signature: "(reason, diagnostics)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:4509-4536"

# ── 입출력 ──
inputs:
  - "reason"
  - "diagnostics"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): PERF_LAST_LOG_AT"
raises: []

# ── 유기적 관계 ──
calls:
  - "_perf_trace"
  - "_process_perf_snapshot"
  - "add"
calls_external:
  - "diagnostics"
  - "excel_pids"
  - "float"
  - "get"
  - "getpid"
  - "int"
  - "p"
  - "pid"
  - "python_pid"
  - "reason"
  - "set"
  - "sorted"
  - "time"
  - "update"
called_by:
  - "_excel_runtime_diagnostics"
reads:
  - "PERF_LAST_LOG_AT"
  - "PERF_LOG_INTERVAL_SECONDS"
writes:
  - "PERF_LAST_LOG_AT"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): PERF_LAST_LOG_AT
- 변경 상태 `PERF_LAST_LOG_AT` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_perf_trace`, `_process_perf_snapshot`, `add`
- 피호출(영향 전파 경로): `_excel_runtime_diagnostics`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
