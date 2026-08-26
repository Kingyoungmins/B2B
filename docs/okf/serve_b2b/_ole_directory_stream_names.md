---
type: function
title: _ole_directory_stream_names
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "OLE 복합문서 디렉터리의 스트림 이름 집합. OLE 아니거나 구조를 못 읽으면 None."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3015-3081"

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
  - "nm"
  - "open"
  - "path"
  - "per"
  - "sect"
  - "sect_size"
  - "seek"
  - "set"
called_by:
  - "_ole_office_verdict"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
OLE 복합문서 디렉터리의 스트림 이름 집합. OLE 아니거나 구조를 못 읽으면 None.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `add`, `range`, `read`
- 피호출(영향 전파 경로): `_ole_office_verdict`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
