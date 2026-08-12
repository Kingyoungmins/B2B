---
type: method
title: B2BHandler.handle_backend_download
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:1829-1844"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "content_disposition_attachment"
  - "end_headers"
  - "ensure_result_file"
  - "write"
calls_external:
  - "data"
  - "len"
  - "lower"
  - "read_bytes"
  - "result_id"
  - "rsplit"
  - "send_error"
  - "send_header"
  - "send_response"
  - "str"
called_by:
  - "B2BHandler.do_GET"
reads:
  - "self.end_headers"
  - "self.path"
  - "self.send_error"
  - "self.send_header"
  - "self.send_response"
  - "self.wfile"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `content_disposition_attachment`, `end_headers`, `ensure_result_file`, `write`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
