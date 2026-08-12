---
type: function
title: _companion_referenced
module: serve_b2b.py
lang: python
extraction: ast
signature: "(name, blob, link_names)"
role: "이 동반 파일을 격리 인스턴스에 열어야 하는가."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:9634-9648"

# ── 입출력 ──
inputs:
  - "name"
  - "blob"
  - "link_names"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "normalize"
calls_external:
  - "casefold"
  - "len"
  - "rsplit"
  - "set"
  - "stem"
  - "str"
called_by:
  - "_setup_isolated_pipeline_instance"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
이 동반 파일을 격리 인스턴스에 열어야 하는가.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `normalize`
- 피호출(영향 전파 경로): `_setup_isolated_pipeline_instance`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
