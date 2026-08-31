---
type: function
title: protected_open_reason
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "Excel 이 못 열었을 때, 그 원인이 '보안 문서라서' 인지 알려 준다. 아니면 \"\"."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:3205-3223"

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
  - "_file_label_kind"
calls_external:
  - "path"
called_by:
  - "excel_workbooks_open"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
Excel 이 못 열었을 때, 그 원인이 '보안 문서라서' 인지 알려 준다. 아니면 "".

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_file_label_kind`
- 피호출(영향 전파 경로): `excel_workbooks_open`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
