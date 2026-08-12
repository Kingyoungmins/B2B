---
type: function
title: _ensure_vbom_access
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "매크로 주입·실행에 필요한 Trust Center 플래그를 켠다(HKCU)."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:5007-5037"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_ensure_runner_trusted_location"
calls_external:
  - "CloseKey"
  - "CreateKey"
  - "SetValueEx"
  - "key"
called_by:
  - "_get_live_excel_app"
  - "_open_excel_session_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_setup_isolated_pipeline_instance"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
매크로 주입·실행에 필요한 Trust Center 플래그를 켠다(HKCU).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_ensure_runner_trusted_location`
- 피호출(영향 전파 경로): `_get_live_excel_app`, `_open_excel_session_impl`, `_run_full_pipeline_single_instance_impl`, `_setup_isolated_pipeline_instance`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
