---
type: method
title: B2BHandler._hide_if_host_minimized
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self, data)"
role: "열기(수 초 소요)가 최소화 '이후'에 끝나면 hide-all 을 이미 지나쳐 창이 화면에 남는다"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:2187-2197"

# ── 입출력 ──
inputs:
  - "self"
  - "data"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_vba_trace"
  - "hide_excel_session"
calls_external:
  - "data"
  - "dict"
  - "get"
  - "isinstance"
called_by:
  - "B2BHandler.handle_excel_open"
  - "B2BHandler.handle_excel_open_result"
reads:
  - "HOST_MINIMIZED"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
열기(수 초 소요)가 최소화 '이후'에 끝나면 hide-all 을 이미 지나쳐 창이 화면에 남는다

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_trace`, `hide_excel_session`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_open`, `B2BHandler.handle_excel_open_result`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
