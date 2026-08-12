---
type: function
title: _pipeline_snapshot_key
module: serve_b2b.py
lang: python
extraction: ast
signature: "(input_items, input_wbs, output_item, output_wb_record, steps_prefix)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:18104-18121"

# ── 입출력 ──
inputs:
  - "input_items"
  - "input_wbs"
  - "output_item"
  - "output_wb_record"
  - "steps_prefix"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_step_signature"
  - "_workbook_fingerprint"
  - "raw"
calls_external:
  - "dumps"
  - "encode"
  - "get"
  - "hexdigest"
  - "input_items"
  - "input_wbs"
  - "output_wb_record"
  - "payload"
  - "sha256"
  - "step"
  - "wb"
  - "zip"
called_by:
  - "_find_best_pipeline_snapshot"
  - "_run_excel_python_pipeline_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_step_signature`, `_workbook_fingerprint`, `raw`
- 피호출(영향 전파 경로): `_find_best_pipeline_snapshot`, `_run_excel_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
