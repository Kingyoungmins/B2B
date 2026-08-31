---
type: function
title: decrypt_bytes
module: secure_doc.py
lang: python
extraction: ast
signature: "(data, filename)"
role: "보안 해제. 반환 (released, out_bytes)."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:270-287"

# ── 입출력 ──
inputs:
  - "data"
  - "filename"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_post_drm"
  - "config"
calls_external:
  - "bytes"
  - "data"
  - "filename"
called_by:
  - "maybe_decrypt_upload"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
보안 해제. 반환 (released, out_bytes).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_post_drm`, `config`
- 피호출(영향 전파 경로): `maybe_decrypt_upload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
