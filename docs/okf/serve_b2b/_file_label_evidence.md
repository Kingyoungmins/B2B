---
type: function
title: _file_label_evidence
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path, tries=3, wait=0.15)"
role: "이 파일이 '그때 어떤 모양이었는지'를 증거로 남긴다 — 원본을 못 꺼내는 환경을 위해."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3833-3886"

# ── 입출력 ──
inputs:
  - "path"
  - "tries"
  - "wait"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_file_label_kind"
  - "_ole_directory_stream_names"
  - "range"
  - "read"
calls_external:
  - "Path"
  - "ZipFile"
  - "chunk"
  - "close"
  - "err"
  - "hex"
  - "hexdigest"
  - "iter"
  - "join"
  - "max"
  - "namelist"
  - "open"
  - "p"
  - "path"
  - "sha256"
  - "sleep"
  - "sorted"
  - "stat"
  - "str"
  - "strip"
  - "tries"
  - "type"
  - "update"
  - "upper"
  - "wait"
called_by:
  - "B2BHandler.handle_workbook_upload"
  - "_check_protection_loss"
  - "_save_excel_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
이 파일이 '그때 어떤 모양이었는지'를 증거로 남긴다 — 원본을 못 꺼내는 환경을 위해.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_file_label_kind`, `_ole_directory_stream_names`, `range`, `read`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_upload`, `_check_protection_loss`, `_save_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
