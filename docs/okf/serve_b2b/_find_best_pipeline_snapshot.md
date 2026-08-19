---
type: function
title: _find_best_pipeline_snapshot
module: serve_b2b.py
lang: python
extraction: ast
signature: "(input_items, input_wbs, output_item, output_wb_record, active_steps)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:18140-18148"

# ── 입출력 ──
inputs:
  - "input_items"
  - "input_wbs"
  - "output_item"
  - "output_wb_record"
  - "active_steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_pipeline_snapshot_key"
  - "_snapshot_files_exist"
  - "range"
calls_external:
  - "active_steps"
  - "get"
  - "input_items"
  - "input_wbs"
  - "key"
  - "len"
  - "output_item"
  - "output_wb_record"
  - "snapshot"
called_by:
  - "_run_excel_python_pipeline_impl"
reads:
  - "PIPELINE_STEP_SNAPSHOTS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_pipeline_snapshot_key`, `_snapshot_files_exist`, `range`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
