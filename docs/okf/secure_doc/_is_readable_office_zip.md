---
type: function
title: _is_readable_office_zip
module: secure_doc.py
lang: python
extraction: ast
signature: "(path)"
role: "정말 열리는 Office 문서(zip)인가 — 헤더만 PK 인 것과 가른다."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:351-369"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "ZipFile"
  - "lower"
  - "namelist"
  - "path"
  - "str"
called_by:
  - "looks_secured"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
정말 열리는 Office 문서(zip)인가 — 헤더만 PK 인 것과 가른다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `looks_secured`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
