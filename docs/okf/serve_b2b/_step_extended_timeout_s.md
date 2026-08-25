---
type: function
title: _step_extended_timeout_s
module: serve_b2b.py
lang: python
extraction: ast
signature: "(st)"
role: "스텝 dict 이 extendedTimeout=True(VBA→Python 복구/강제 대용량)면 확장 데드라인(초)을, 아니면 None 을"
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:15116-15124"

# ── 입출력 ──
inputs:
  - "st"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "dict"
  - "get"
  - "isinstance"
  - "st"
called_by:
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_pipeline_on_session_impl"
reads:
  - "PY_SKILL_RECOVERY_TIMEOUT_S"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
스텝 dict 이 extendedTimeout=True(VBA→Python 복구/강제 대용량)면 확장 데드라인(초)을, 아니면 None 을

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
