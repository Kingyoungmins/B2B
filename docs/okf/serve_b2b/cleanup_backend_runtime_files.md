---
type: function
title: cleanup_backend_runtime_files
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "Delete runtime-only result/snapshot files created under BACKEND_DIR."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:482-533"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_delete_pipeline_snapshot_entry"
  - "_perf_trace"
  - "clear"
  - "values"
calls_external:
  - "Path"
  - "_safe_unlink"
  - "dict"
  - "exists"
  - "failed"
  - "get"
  - "is_file"
  - "isinstance"
  - "item"
  - "items"
  - "key"
  - "list"
  - "raw_path"
  - "removed"
  - "resolve"
  - "rmtree"
  - "snapshot"
  - "unlink"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "BACKEND_DIR"
  - "PIPELINE_STEP_SNAPSHOTS"
  - "RESULTS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Delete runtime-only result/snapshot files created under BACKEND_DIR.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_delete_pipeline_snapshot_entry`, `_perf_trace`, `clear`, `values`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
