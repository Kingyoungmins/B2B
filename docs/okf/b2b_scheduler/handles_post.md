---
type: function
title: handles_post
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(path)"
role: "본체가 본문을 읽기 전에 '내 것인지'만 먼저 판단할 수 있게 한다."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:711-713"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "path"
  - "split"
  - "str"
called_by:
  - "B2BHandler._addon_scheduler_dispatch"
reads:
  - "_POST_ROUTES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
본체가 본문을 읽기 전에 '내 것인지'만 먼저 판단할 수 있게 한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler._addon_scheduler_dispatch`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
