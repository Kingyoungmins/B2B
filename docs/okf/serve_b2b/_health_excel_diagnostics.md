---
type: function
title: _health_excel_diagnostics
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "Health polling should be cheap. Excel process diagnostics are cached and"
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:4450-4461"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): HEALTH_CACHED_EXCEL_DIAG, HEALTH_LAST_EXCEL_DIAG_AT"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_runtime_diagnostics"
calls_external:
  - "float"
  - "time"
called_by:
  - "B2BHandler.do_GET"
reads:
  - "HEALTH_CACHED_EXCEL_DIAG"
  - "HEALTH_EXCEL_DIAG_INTERVAL_SECONDS"
  - "HEALTH_LAST_EXCEL_DIAG_AT"
writes:
  - "HEALTH_CACHED_EXCEL_DIAG"
  - "HEALTH_LAST_EXCEL_DIAG_AT"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
Health polling should be cheap. Excel process diagnostics are cached and

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): HEALTH_CACHED_EXCEL_DIAG, HEALTH_LAST_EXCEL_DIAG_AT
- 변경 상태 `HEALTH_CACHED_EXCEL_DIAG, HEALTH_LAST_EXCEL_DIAG_AT` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_excel_runtime_diagnostics`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
