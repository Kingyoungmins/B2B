---
type: function
title: _clear_workbook_name_aliases
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:8064-8071"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_process_id"
calls_external:
  - "app"
  - "int"
  - "pid"
  - "pop"
called_by:
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_pipeline_on_session_impl"
reads:
  - "_WB_NAME_ALIASES"
  - "_WB_NAME_REVERSE_ALIASES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_excel_process_id`
- 피호출(영향 전파 경로): `_run_full_pipeline_single_instance_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
