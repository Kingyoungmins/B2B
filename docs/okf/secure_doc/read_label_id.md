---
type: function
title: read_label_id
module: secure_doc.py
lang: python
extraction: ast
signature: "(path_or_bytes)"
role: "보호 문서 안에 적힌 **원본 라벨 GUID** 를 읽는다. 못 찾으면 \"\"."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:520-544"

# ── 입출력 ──
inputs:
  - "path_or_bytes"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "raw"
calls_external:
  - "Path"
  - "bytes"
  - "decode"
  - "encode"
  - "group"
  - "isinstance"
  - "lower"
  - "path_or_bytes"
  - "read_bytes"
  - "search"
  - "wide"
called_by:
  - "source_label_for_restore"
reads:
  - "_LABEL_RE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
보호 문서 안에 적힌 **원본 라벨 GUID** 를 읽는다. 못 찾으면 "".

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `raw`
- 피호출(영향 전파 경로): `source_label_for_restore`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
