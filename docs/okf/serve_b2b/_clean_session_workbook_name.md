---
type: function
title: _clean_session_workbook_name
module: serve_b2b.py
lang: python
extraction: ast
signature: "(name)"
role: "스냅샷/결과 파일명에 붙는 우리 접두사(prestep_<32hex>_, <32hex>_)를 반복 제거해 원본 표시명을 복원한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:5770-5781"

# ── 입출력 ──
inputs:
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Path"
  - "n"
  - "str"
  - "sub"
called_by:
  - "_resolve_live_identity_name"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
스냅샷/결과 파일명에 붙는 우리 접두사(prestep_<32hex>_, <32hex>_)를 반복 제거해 원본 표시명을 복원한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_resolve_live_identity_name`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
