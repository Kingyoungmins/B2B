---
type: function
title: skill_docs_from_zip
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(blob)"
role: "스킬 zip 바이트 → 필요한 문서 이름 목록(정렬). 스킬이 아니면 None."
role_source: docstring
version: "0.8.2"
loc: "b2b_scheduler.py:455-532"

# ── 입출력 ──
inputs:
  - "blob"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_basename"
  - "_zip_entry_names"
  - "add"
  - "append"
  - "raw"
  - "read"
  - "replace"
calls_external:
  - "BytesIO"
  - "ZipFile"
  - "blob"
  - "data"
  - "decode"
  - "dict"
  - "docs"
  - "endswith"
  - "enumerate"
  - "finditer"
  - "get"
  - "group"
  - "handle"
  - "isinstance"
  - "items"
  - "len"
  - "loads"
  - "lower"
  - "nm"
  - "real"
  - "rf"
  - "set"
  - "sorted"
  - "st"
  - "startswith"
  - "str"
  - "strip"
  - "zf"
called_by:
  - "update_files"
reads:
  - "_BOOK_RE"
  - "_WORKBOOKS_RE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
스킬 zip 바이트 → 필요한 문서 이름 목록(정렬). 스킬이 아니면 None.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_basename`, `_zip_entry_names`, `add`, `append`, `raw`, `read`, `replace`
- 피호출(영향 전파 경로): `update_files`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
