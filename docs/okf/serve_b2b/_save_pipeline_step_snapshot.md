---
type: function
title: _save_pipeline_step_snapshot
module: serve_b2b.py
lang: python
extraction: ast
signature: "(key, step_idx, app, output_wb, input_wb_by_name, input_stable_src=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:18520-18550"

# ── 입출력 ──
inputs:
  - "key"
  - "step_idx"
  - "app"
  - "output_wb"
  - "input_wb_by_name"
  - "input_stable_src"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): PIPELINE_STEP_SNAPSHOTS"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_cleanup_pipeline_step_snapshots"
calls_external:
  - "Path"
  - "SaveCopyAs"
  - "bool"
  - "exists"
  - "get"
  - "input_path"
  - "items"
  - "mkdir"
  - "name"
  - "output_path"
  - "stable"
  - "str"
  - "sub"
  - "time"
called_by:
  - "_run_excel_python_pipeline_impl"
reads:
  - "BACKEND_DIR"
  - "PIPELINE_STEP_SNAPSHOTS"
writes:
  - "PIPELINE_STEP_SNAPSHOTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): PIPELINE_STEP_SNAPSHOTS
- 파일시스템 변경/IO
- 변경 상태 `PIPELINE_STEP_SNAPSHOTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_cleanup_pipeline_step_snapshots`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
