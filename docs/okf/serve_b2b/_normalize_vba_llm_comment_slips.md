---
type: function
title: _normalize_vba_llm_comment_slips
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "LLM 이 VBA 에 C 계열 주석(//)을 섞는 사고 교정 — 줄머리 // 는 ' 주석으로 변환."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:7601-7617"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "join"
  - "len"
  - "line"
  - "lstrip"
  - "out"
  - "splitlines"
  - "startswith"
  - "str"
  - "stripped"
called_by:
  - "_inject_and_run_vba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
LLM 이 VBA 에 C 계열 주석(//)을 섞는 사고 교정 — 줄머리 // 는 ' 주석으로 변환.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `_inject_and_run_vba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
