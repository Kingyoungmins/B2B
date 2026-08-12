---
type: method
title: B2BHandler.handle_excel_run_vba
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:2055-2083"

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
  - "_trace_hash"
  - "_trace_text"
  - "_vba_trace"
  - "read_json_body"
  - "run_vba_on_session"
  - "send_json"
calls_external:
  - "code"
  - "err"
  - "get"
  - "len"
  - "result"
  - "str"
  - "trace_id"
  - "type"
  - "uuid4"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "self.read_json_body"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_trace_hash`, `_trace_text`, `_vba_trace`, `read_json_body`, `run_vba_on_session`, `send_json`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
