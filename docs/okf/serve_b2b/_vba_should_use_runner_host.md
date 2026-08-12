---
type: function
title: _vba_should_use_runner_host
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb)"
role: "Return True when the target workbook is not a reliable VBA host."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:8512-8527"

# ── 입출력 ──
inputs:
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_vba_workbook_name"
calls_external:
  - "endswith"
  - "int"
  - "lower"
  - "wb"
called_by:
  - "_inject_and_run_vba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
Return True when the target workbook is not a reliable VBA host.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_workbook_name`
- 피호출(영향 전파 경로): `_inject_and_run_vba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
