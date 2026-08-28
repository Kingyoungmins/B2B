---
type: function
title: looks_secured
module: secure_doc.py
lang: python
extraction: ast
signature: "(head, name='', encrypted_checker=None, path=None)"
role: "작업본이 보안문서로 '보이는가' — 최종 판정은 Gateway(-200)가 한다."
role_source: docstring
version: "0.8.1"
loc: "secure_doc.py:328-395"

# ── 입출력 ──
inputs:
  - "head"
  - "name"
  - "encrypted_checker"
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_is_readable_office_zip"
calls_external:
  - "any"
  - "bytes"
  - "decode"
  - "encrypted_checker"
  - "head"
  - "len"
  - "path"
called_by:
  - "maybe_decrypt_upload"
reads:
  - "VENDOR_DRM_MAGIC"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
작업본이 보안문서로 '보이는가' — 최종 판정은 Gateway(-200)가 한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_is_readable_office_zip`
- 피호출(영향 전파 경로): `maybe_decrypt_upload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
