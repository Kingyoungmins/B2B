---
type: method
title: B2BHandler._reject_show_while_host_minimized
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "호스트 최소화 중엔 표시 계열 요청을 조용히 스킵(True 반환 시 호출측은 응답 완료)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:2376-2382"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "send_json"
calls_external: []
called_by:
  - "B2BHandler.handle_excel_activate"
  - "B2BHandler.handle_excel_position"
  - "B2BHandler.handle_excel_raise"
  - "B2BHandler.handle_excel_recover"
  - "B2BHandler.handle_excel_show_only"
reads:
  - "HOST_MINIMIZED"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
호스트 최소화 중엔 표시 계열 요청을 조용히 스킵(True 반환 시 호출측은 응답 완료).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `send_json`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_activate`, `B2BHandler.handle_excel_position`, `B2BHandler.handle_excel_raise`, `B2BHandler.handle_excel_recover`, `B2BHandler.handle_excel_show_only`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
