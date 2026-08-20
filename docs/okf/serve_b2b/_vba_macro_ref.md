---
type: function
title: _vba_macro_ref
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb, module_name, macro_name)"
role: "Return a workbook-qualified macro reference for Application.Run."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:7955-7969"

# ── 입출력 ──
inputs:
  - "wb"
  - "module_name"
  - "macro_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "replace"
calls_external:
  - "str"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
Return a workbook-qualified macro reference for Application.Run.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `replace`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
