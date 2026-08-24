---
type: function
title: _extract_pptx_slide_texts
module: serve_b2b.py
lang: python
extraction: ast
signature: "(pptx_path)"
role: "pptx(zip) 에서 슬라이드별 텍스트를 뽑는다(python-pptx 없이 XML 직접). 캡션/제목 보조용."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:1130-1147"

# ── 입출력 ──
inputs:
  - "pptx_path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "read"
calls_external:
  - "ZipFile"
  - "decode"
  - "findall"
  - "group"
  - "int"
  - "join"
  - "match"
  - "n"
  - "namelist"
  - "pptx_path"
  - "search"
  - "slides"
  - "snum"
  - "sorted"
  - "strip"
  - "xml"
called_by:
  - "render_pptx_to_slides_b64"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
pptx(zip) 에서 슬라이드별 텍스트를 뽑는다(python-pptx 없이 XML 직접). 캡션/제목 보조용.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `read`
- 피호출(영향 전파 경로): `render_pptx_to_slides_b64`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
