---
type: function
title: _ole_office_verdict
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "[코드리뷰 2026-08-24] OLE 복합문서의 정체를 스트림 '내용'으로 3상 판정한다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3000-3018"

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
  - "_ole_directory_stream_names"
calls_external:
  - "path"
called_by:
  - "B2BHandler.handle_workbook_upload"
  - "is_encrypted_ooxml"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[코드리뷰 2026-08-24] OLE 복합문서의 정체를 스트림 '내용'으로 3상 판정한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_ole_directory_stream_names`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_upload`, `is_encrypted_ooxml`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
