---
type: function
title: _extract_vba_source_for_injection
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code, entry=None)"
role: "Saved skills can contain the assistant reply text around the VBA block."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:8219-8273"

# ── 입출력 ──
inputs:
  - "code"
  - "entry"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "replace"
calls_external:
  - "compile"
  - "end"
  - "entry"
  - "escape"
  - "finditer"
  - "group"
  - "join"
  - "lines"
  - "list"
  - "lstrip"
  - "match"
  - "pop"
  - "prefix"
  - "search"
  - "split"
  - "start"
  - "startswith"
  - "str"
  - "strip"
  - "stripped"
  - "tail"
  - "text"
called_by:
  - "_inject_and_run_vba"
reads:
  - "VBA_SKILL_ENTRY"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
Saved skills can contain the assistant reply text around the VBA block.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `replace`
- 피호출(영향 전파 경로): `_inject_and_run_vba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
