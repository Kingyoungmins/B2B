---
type: method
title: B2BHandler.handle_excel_record_start
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "---- 녹화 (기본: 네이티브 매크로 레코더/VBA · 폴백: ixi-Cell-R recorder) ----"
role_source: banner
version: "0.8.0"
loc: "serve_b2b.py:2549-2555"

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
  - "excel_record_start"
  - "read_json_body"
  - "send_json"
calls_external:
  - "engine"
  - "err"
  - "get"
  - "lower"
  - "str"
  - "strip"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "self.read_json_body"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
---- 녹화 (기본: 네이티브 매크로 레코더/VBA · 폴백: ixi-Cell-R recorder) ----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `excel_record_start`, `read_json_body`, `send_json`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
