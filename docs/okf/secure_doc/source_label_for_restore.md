---
type: function
title: source_label_for_restore
module: secure_doc.py
lang: python
extraction: ast
signature: "(data)"
role: "이 원본을 되돌릴 때 쓸 라벨 값. 못 정하면 \"\" (게이트웨이 기본값)."
role_source: docstring
version: "0.8.0"
loc: "secure_doc.py:503-515"

# ── 입출력 ──
inputs:
  - "data"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "raw"
  - "read_label_id"
calls_external:
  - "bytes"
called_by:
  - "maybe_decrypt_upload"
reads:
  - "VENDOR_DRM_MAGIC"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
이 원본을 되돌릴 때 쓸 라벨 값. 못 정하면 "" (게이트웨이 기본값).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `raw`, `read_label_id`
- 피호출(영향 전파 경로): `maybe_decrypt_upload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
