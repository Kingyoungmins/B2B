---
type: function
title: run_full_pipeline_single_instance
module: serve_b2b.py
lang: python
extraction: ast
signature: "(groups, reset_excel_ids=None, view_sheet=None, entry=None, output_mode='sync', state_sig=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "serve_b2b.py:11883-11886"

# ── 입출력 ──
inputs:
  - "groups"
  - "reset_excel_ids"
  - "view_sheet"
  - "entry"
  - "output_mode"
  - "state_sig"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_run_full_pipeline_single_instance_impl"
  - "excel_call"
calls_external:
  - "PY_UNLIMITED_OUTER_S"
  - "entry"
  - "groups"
  - "output_mode"
  - "reset_excel_ids"
  - "state_sig"
  - "view_sheet"
called_by:
  - "B2BHandler.handle_excel_run_full_pipeline"
reads:
  - "PY_UNLIMITED_OUTER_S"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_run_full_pipeline_single_instance_impl`, `excel_call`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_run_full_pipeline`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
