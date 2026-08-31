---
type: function
title: _cleanup_live_final_snapshots
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "오래된 것부터 정리(개수·용량 한도는 스텝 스냅샷과 공유). 지워졌으면 조회가 실패하고"
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:19998-20018"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_live_final_snapshot_stats"
calls_external:
  - "Path"
  - "get"
  - "items"
  - "key"
  - "pop"
  - "resolve"
  - "rmtree"
  - "sorted"
  - "unlink"
called_by:
  - "_save_live_final_snapshot"
reads:
  - "BACKEND_DIR"
  - "HOUSEKEEPING_SNAPSHOT_MAX_BYTES"
  - "LIVE_FINAL_SNAPSHOTS"
  - "LIVE_FINAL_SNAPSHOT_DIRNAME"
  - "MAX_PIPELINE_STEP_SNAPSHOTS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
오래된 것부터 정리(개수·용량 한도는 스텝 스냅샷과 공유). 지워졌으면 조회가 실패하고

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_live_final_snapshot_stats`
- 피호출(영향 전파 경로): `_save_live_final_snapshot`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
