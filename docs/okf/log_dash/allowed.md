---
type: function
title: allowed
module: log_dash.py
lang: python
extraction: ast
signature: "(sub_path)"
role: "'stats?from=...' → 허용 여부. 경로 부분만 보고 쿼리는 그대로 통과시킨다."
role_source: docstring
version: "0.8.0"
loc: "log_dash.py:44-47"

# ── 입출력 ──
inputs:
  - "sub_path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "split"
  - "str"
  - "strip"
called_by:
  - "_install_ctx_kwarg_tolerance"
  - "_wrap_ctx_helper_kwargs"
  - "build_request"
reads:
  - "ALLOWED_PATHS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
'stats?from=...' → 허용 여부. 경로 부분만 보고 쿼리는 그대로 통과시킨다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_install_ctx_kwarg_tolerance`, `_wrap_ctx_helper_kwargs`, `build_request`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
