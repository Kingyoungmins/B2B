---
type: function
title: _secure_outgoing_data
module: serve_b2b.py
lang: python
extraction: ast
signature: "(data, filename, query='')"
role: "[문서보안 0.7.5] 사용자에게 나가는 문서 다운로드 직전 훅."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:5126-5146"

# ── 입출력 ──
inputs:
  - "data"
  - "filename"
  - "query"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_vba_trace"
calls_external:
  - "BACKEND_DIR"
  - "any_secured"
  - "data"
  - "encrypt_for_download"
  - "err"
  - "filename"
  - "len"
  - "out"
  - "str"
called_by:
  - "B2BHandler.handle_backend_download"
  - "B2BHandler.handle_workbook_source_download"
  - "build_workbook_archive"
reads:
  - "BACKEND_DIR"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[문서보안 0.7.5] 사용자에게 나가는 문서 다운로드 직전 훅.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_trace`
- 피호출(영향 전파 경로): `B2BHandler.handle_backend_download`, `B2BHandler.handle_workbook_source_download`, `build_workbook_archive`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
