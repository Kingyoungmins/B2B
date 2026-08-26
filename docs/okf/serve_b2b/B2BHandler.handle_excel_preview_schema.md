---
type: method
title: B2BHandler.handle_excel_preview_schema
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "[AI 도움 라이브 직독] 열린 라이브 세션의 '현재' 시트/그리드(경량 60행 미리보기)를 돌려준다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:2547-2575"

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
  - "_live_preview_schema"
  - "_vba_trace"
  - "excel_call"
  - "get_excel_session"
  - "read_json_body"
  - "send_json"
  - "session_workbook"
calls_external:
  - "_ms"
  - "_read"
  - "bool"
  - "err"
  - "excel_id"
  - "get"
  - "len"
  - "only_sheet"
  - "perf_counter"
  - "round"
  - "session"
  - "str"
  - "strip"
  - "wb"
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
[AI 도움 라이브 직독] 열린 라이브 세션의 '현재' 시트/그리드(경량 60행 미리보기)를 돌려준다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_live_preview_schema`, `_vba_trace`, `excel_call`, `get_excel_session`, `read_json_body`, `send_json`, `session_workbook`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
