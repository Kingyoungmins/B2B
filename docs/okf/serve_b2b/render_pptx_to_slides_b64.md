---
type: function
title: render_pptx_to_slides_b64
module: serve_b2b.py
lang: python
extraction: ast
signature: "(pptx_path, max_slides=40)"
role: "PowerPoint COM 으로 슬라이드를 PNG 로 렌더해 base64 로 돌려준다. Excel STA 와 섞이지 않도록"
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:1150-1215"

# ── 입출력 ──
inputs:
  - "pptx_path"
  - "max_slides"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_extract_pptx_slide_texts"
  - "append"
  - "range"
  - "read"
calls_external:
  - "Close"
  - "CoInitialize"
  - "CoUninitialize"
  - "Dispatch"
  - "Export"
  - "Open"
  - "Quit"
  - "Slides"
  - "Thread"
  - "b64encode"
  - "decode"
  - "e"
  - "get"
  - "i"
  - "int"
  - "is_alive"
  - "join"
  - "max_slides"
  - "min"
  - "mkdtemp"
  - "open"
  - "png"
  - "pptx_path"
  - "rmtree"
  - "start"
  - "str"
  - "tmpdir"
  - "total"
  - "worker"
called_by:
  - "B2BHandler.handle_assist_attachment"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
PowerPoint COM 으로 슬라이드를 PNG 로 렌더해 base64 로 돌려준다. Excel STA 와 섞이지 않도록

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_extract_pptx_slide_texts`, `append`, `range`, `read`
- 피호출(영향 전파 경로): `B2BHandler.handle_assist_attachment`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
