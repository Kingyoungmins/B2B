---
type: function
title: secret_check
module: secure_doc.py
lang: python
extraction: ast
signature: "(data, filename)"
role: "비밀문서인가 — drmSecretAPI. 반환 \"S_DOC\" / \"N_DOC\" / \"\" (판단 못 함)."
role_source: docstring
version: "0.8.1"
loc: "secure_doc.py:246-267"

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
  - "decode"
  - "dict"
  - "filename"
  - "get"
  - "isinstance"
  - "loads"
  - "out"
  - "str"
called_by:
  - "maybe_decrypt_upload"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
비밀문서인가 — drmSecretAPI. 반환 "S_DOC" / "N_DOC" / "" (판단 못 함).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_post_drm`, `config`
- 피호출(영향 전파 경로): `maybe_decrypt_upload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
