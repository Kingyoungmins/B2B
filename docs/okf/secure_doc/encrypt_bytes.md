---
type: function
title: encrypt_bytes
module: secure_doc.py
lang: python
extraction: ast
signature: "(data, filename, label_id='')"
role: "보안 재적용. 실패는 예외 — 부르는 쪽(다운로드)이 반드시 중단해야 한다."
role_source: docstring
version: "0.8.1"
loc: "secure_doc.py:290-299"

# ── 입출력 ──
inputs:
  - "data"
  - "filename"
  - "label_id"
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
  - "data"
  - "filename"
  - "form"
called_by:
  - "encrypt_for_download"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
보안 재적용. 실패는 예외 — 부르는 쪽(다운로드)이 반드시 중단해야 한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_post_drm`, `config`
- 피호출(영향 전파 경로): `encrypt_for_download`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
