---
type: function
title: is_encrypted_ooxml
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "[사내 MIP 라벨 2026-08-12] 암호화된 xlsx 인가 — 구형 .xls 와 구분한다."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:2736-2808"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "range"
  - "read"
calls_external:
  - "MAX_DIR_SECTORS"
  - "Path"
  - "_fat_next"
  - "blk"
  - "cur"
  - "decode"
  - "dir_data"
  - "divmod"
  - "from_bytes"
  - "len"
  - "open"
  - "path"
  - "per"
  - "sect"
  - "sect_size"
  - "seek"
  - "set"
called_by:
  - "_file_label_kind"
  - "excel_compatible_open_path"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[사내 MIP 라벨 2026-08-12] 암호화된 xlsx 인가 — 구형 .xls 와 구분한다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `add`, `range`, `read`
- 피호출(영향 전파 경로): `_file_label_kind`, `excel_compatible_open_path`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
