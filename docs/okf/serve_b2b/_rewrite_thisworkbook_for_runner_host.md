---
type: function
title: _rewrite_thisworkbook_for_runner_host
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code, context_wb)"
role: "임시 .xlsm 러너에서 실행할 때 ThisWorkbook 은 러너 자신을 가리킨다."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:9277-9289"

# ── 입출력 ──
inputs:
  - "code"
  - "context_wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_vba_string_literal"
  - "_vba_workbook_name"
calls_external:
  - "context_wb"
  - "search"
  - "str"
  - "sub"
  - "text"
called_by:
  - "_inject_and_run_vba_in_host"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
임시 .xlsm 러너에서 실행할 때 ThisWorkbook 은 러너 자신을 가리킨다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_string_literal`, `_vba_workbook_name`
- 피호출(영향 전파 경로): `_inject_and_run_vba_in_host`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
