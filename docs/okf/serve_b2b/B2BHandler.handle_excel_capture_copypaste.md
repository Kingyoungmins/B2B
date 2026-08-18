---
type: method
title: B2BHandler.handle_excel_capture_copypaste
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "[복붙 캡처] 사용자가 라이브 Excel에서 방금 한 Ctrl+C/Ctrl+V 를 역추적해"
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:2028-2053"

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
  - "_vba_trace"
  - "excel_record_status"
  - "read_json_body"
  - "run_capture_copypaste"
  - "send_json"
calls_external:
  - "bool"
  - "err"
  - "get"
  - "lower"
  - "result"
  - "str"
  - "strip"
  - "values_only"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "NATIVE_RECORDING"
  - "self.read_json_body"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[복붙 캡처] 사용자가 라이브 Excel에서 방금 한 Ctrl+C/Ctrl+V 를 역추적해

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_trace`, `excel_record_status`, `read_json_body`, `run_capture_copypaste`, `send_json`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
