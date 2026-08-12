---
type: function
title: _hide_vba_editor
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "VBE/디버거 창이 사용자 화면으로 올라오지 않게 숨긴다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:8285-8303"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "range"
calls_external:
  - "Windows"
  - "idx"
  - "int"
called_by:
  - "_inject_and_run_vba"
  - "_restore_live_protected_view"
  - "_run_vba_via_runner_with_retry"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
VBE/디버거 창이 사용자 화면으로 올라오지 않게 숨긴다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `range`
- 피호출(영향 전파 경로): `_inject_and_run_vba`, `_restore_live_protected_view`, `_run_vba_via_runner_with_retry`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
