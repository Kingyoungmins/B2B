---
type: function
title: _delete_pipeline_snapshot_entry
module: serve_b2b.py
lang: python
extraction: ast
signature: "(key, snapshot)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "serve_b2b.py:4793-4809"

# ── 입출력 ──
inputs:
  - "key"
  - "snapshot"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "values"
calls_external:
  - "Path"
  - "directory"
  - "dirs"
  - "get"
  - "len"
  - "p"
  - "raw_path"
  - "resolve"
  - "rmtree"
  - "set"
  - "sorted"
  - "str"
  - "unlink"
called_by:
  - "_cleanup_pipeline_snapshots_by_limits"
  - "cleanup_backend_runtime_files"
reads:
  - "BACKEND_DIR"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `add`, `values`
- 피호출(영향 전파 경로): `_cleanup_pipeline_snapshots_by_limits`, `cleanup_backend_runtime_files`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
