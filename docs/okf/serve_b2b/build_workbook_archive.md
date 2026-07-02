---
type: function
title: build_workbook_archive
module: serve_b2b.py
lang: python
extraction: ast
signature: "(payload)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:2156-2176"

# ── 입출력 ──
inputs:
  - "payload"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises:
  - "ValueError"

# ── 유기적 관계 ──
calls:
  - "resolve_archive_item"
  - "safe_archive_filename"
  - "unique_archive_name"
  - "write"
calls_external:
  - "ValueError"
  - "ZipFile"
  - "archive_path"
  - "arcname"
  - "dict"
  - "display_name"
  - "endswith"
  - "files"
  - "folder"
  - "get"
  - "isinstance"
  - "item"
  - "list"
  - "lower"
  - "mkdir"
  - "now"
  - "payload"
  - "raw_filename"
  - "set"
  - "src_path"
  - "str"
  - "strftime"
  - "used_names"
  - "uuid4"
called_by:
  - "B2BHandler.handle_workbook_archive"
reads:
  - "BACKEND_DIR"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `resolve_archive_item`, `safe_archive_filename`, `unique_archive_name`, `write`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_archive`

## 실패/예외
- `ValueError`
