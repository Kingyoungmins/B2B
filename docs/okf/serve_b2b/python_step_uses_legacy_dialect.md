---
type: function
title: python_step_uses_legacy_dialect
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "[혼합 호환] 구버전 openpyxl/excel-com 방언인가 — True 면 ExcelSkillContext(레거시 ctx)로,"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:16642-16645"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "bool"
  - "search"
  - "str"
called_by:
  - "_pipeline_payload_needs_com"
  - "_run_excel_python_pipeline_impl"
reads:
  - "_LEGACY_PY_DIALECT_RE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[혼합 호환] 구버전 openpyxl/excel-com 방언인가 — True 면 ExcelSkillContext(레거시 ctx)로,

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_pipeline_payload_needs_com`, `_run_excel_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
