---
type: method
title: B2BHandler.handle_assist_attachment
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "[AI 도움 첨부] 첨부 파일을 슬라이드/이미지 base64 로 돌려준다."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:1705-1754"

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
  - "read"
  - "render_pptx_to_slides_b64"
  - "send_json"
  - "write"
calls_external:
  - "Path"
  - "b64encode"
  - "chunk"
  - "decode"
  - "get"
  - "int"
  - "len"
  - "lower"
  - "max_slides"
  - "min"
  - "mkdir"
  - "open"
  - "parse_qs"
  - "read_bytes"
  - "remaining"
  - "rsplit"
  - "str"
  - "tmp"
  - "unlink"
  - "unquote"
  - "urlparse"
  - "uuid4"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "BACKEND_DIR"
  - "self.headers"
  - "self.path"
  - "self.rfile"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[AI 도움 첨부] 첨부 파일을 슬라이드/이미지 base64 로 돌려준다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `read`, `render_pptx_to_slides_b64`, `send_json`, `write`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
