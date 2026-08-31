---
type: function
title: _save_live_final_snapshot
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb_record, state_sig, src_path, move=False, link=False)"
role: "이미 디스크에 있는 결과 파일(src_path)을 최종상태 사본으로 등록한다. 모드 3가지:"
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:20021-20059"

# ── 입출력 ──
inputs:
  - "wb_record"
  - "state_sig"
  - "src_path"
  - "move"
  - "link"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): LIVE_FINAL_SNAPSHOTS"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_cleanup_live_final_snapshots"
  - "_live_final_snapshot_key"
  - "_warn_excel_nonfatal"
calls_external:
  - "Path"
  - "copy2"
  - "dest"
  - "err"
  - "exists"
  - "get"
  - "mkdir"
  - "move"
  - "src"
  - "src_path"
  - "state_sig"
  - "str"
  - "time"
  - "wb_record"
called_by:
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
reads:
  - "BACKEND_DIR"
  - "LIVE_FINAL_SNAPSHOTS"
  - "LIVE_FINAL_SNAPSHOT_DIRNAME"
writes:
  - "LIVE_FINAL_SNAPSHOTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
이미 디스크에 있는 결과 파일(src_path)을 최종상태 사본으로 등록한다. 모드 3가지:

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): LIVE_FINAL_SNAPSHOTS
- 파일시스템 변경/IO
- 변경 상태 `LIVE_FINAL_SNAPSHOTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_cleanup_live_final_snapshots`, `_live_final_snapshot_key`, `_warn_excel_nonfatal`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
