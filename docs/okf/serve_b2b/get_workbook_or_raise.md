---
type: function
title: get_workbook_or_raise
module: serve_b2b.py
lang: python
extraction: ast
signature: "(workbook_id)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "serve_b2b.py:21857-21861"

# ── 입출력 ──
inputs:
  - "workbook_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "ValueError"

# ── 유기적 관계 ──
calls:
  - "recover_workbook_record"
calls_external:
  - "ValueError"
  - "workbook_id"
called_by:
  - "_pipeline_payload_needs_com"
  - "_run_excel_python_pipeline_impl"
  - "_run_openpyxl_python_pipeline_impl"
  - "run_backend_pipeline_payload"
  - "run_backend_pipeline_payload_with_worker"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `recover_workbook_record`
- 피호출(영향 전파 경로): `_pipeline_payload_needs_com`, `_run_excel_python_pipeline_impl`, `_run_openpyxl_python_pipeline_impl`, `run_backend_pipeline_payload`, `run_backend_pipeline_payload_with_worker`

## 실패/예외
- `ValueError`
