---
type: function
title: is_encrypted_ooxml
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "[사내 MIP 라벨 2026-08-12] 암호화된 xlsx 인가 — 구형 .xls 와 구분한다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3021-3030"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_ole_office_verdict"
calls_external:
  - "path"
called_by:
  - "_file_label_kind"
  - "excel_compatible_open_path"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[사내 MIP 라벨 2026-08-12] 암호화된 xlsx 인가 — 구형 .xls 와 구분한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_ole_office_verdict`
- 피호출(영향 전파 경로): `_file_label_kind`, `excel_compatible_open_path`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
