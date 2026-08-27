---
type: function
title: _wrap_vba_skill_code
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code, entry)"
role: "사용자 VBA를 내부 Sub로 바꾸고, 런타임 오류를 팝업 대신 상태값으로 전달하는 래퍼를 붙인다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:8445-8498"

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
calls: []
calls_external:
  - "code"
  - "compile"
  - "end"
  - "entry"
  - "escape"
  - "match"
  - "strip"
  - "subn"
  - "wrapped_user_code"
called_by:
  - "_inject_and_run_vba_in_host"
reads:
  - "VBA_SKILL_ENTRY"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
사용자 VBA를 내부 Sub로 바꾸고, 런타임 오류를 팝업 대신 상태값으로 전달하는 래퍼를 붙인다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_inject_and_run_vba_in_host`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
