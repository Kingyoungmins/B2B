---
type: function
title: _python_step_has_values_only_formula_copy_risk
module: serve_b2b.py
lang: python
extraction: ast
signature: "(step)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:21470-21486"

# ── 입출력 ──
inputs:
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "normalize_python_pipeline_code"
calls_external:
  - "code"
  - "get"
  - "join"
  - "search"
  - "str"
  - "text"
called_by:
  - "_pipeline_payload_needs_com"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `normalize_python_pipeline_code`
- 피호출(영향 전파 경로): `_pipeline_payload_needs_com`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
