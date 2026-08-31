---
type: function
title: _cleanup_pipeline_snapshots_by_limits
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "[SBAGENT-293 / 사용자 확정 2026-08-26] 실행 중 스냅샷 삭제는 '디스크가 정말 위험할 때'만."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:5191-5246"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_delete_pipeline_snapshot_entry"
  - "_perf_trace"
  - "_pipeline_snapshot_stats"
calls_external:
  - "PIPELINE_STEP_SNAPSHOTS"
  - "disk_usage"
  - "get"
  - "gettempdir"
  - "items"
  - "key"
  - "len"
  - "pop"
  - "removed"
  - "round"
  - "snapshot"
  - "sorted"
called_by:
  - "_cleanup_pipeline_step_snapshots"
  - "_run_low_risk_housekeeping"
reads:
  - "HOUSEKEEPING_SNAPSHOT_MAX_BYTES"
  - "MAX_PIPELINE_STEP_SNAPSHOTS"
  - "PIPELINE_STEP_SNAPSHOTS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
[SBAGENT-293 / 사용자 확정 2026-08-26] 실행 중 스냅샷 삭제는 '디스크가 정말 위험할 때'만.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_delete_pipeline_snapshot_entry`, `_perf_trace`, `_pipeline_snapshot_stats`
- 피호출(영향 전파 경로): `_cleanup_pipeline_step_snapshots`, `_run_low_risk_housekeeping`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
