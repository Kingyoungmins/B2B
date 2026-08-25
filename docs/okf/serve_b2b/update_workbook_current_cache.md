---
type: function
title: update_workbook_current_cache
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb_record, sheets)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:20507-20512"

# ── 입출력 ──
inputs:
  - "wb_record"
  - "sheets"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "time"
called_by:
  - "_result_from_workbook_files"
  - "_run_excel_python_pipeline_impl"
  - "_run_openpyxl_python_pipeline_impl"
  - "run_backend_pipeline_payload"
reads:
  - "WORKBOOK_CACHE_LOCK"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_result_from_workbook_files`, `_run_excel_python_pipeline_impl`, `_run_openpyxl_python_pipeline_impl`, `run_backend_pipeline_payload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
