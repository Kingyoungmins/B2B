---
type: function
title: _current_app_version
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "지금 돌고 있는 AX-Cell 의 버전. 반환 {version, normalized, source}."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:234-278"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_exe_file_version"
  - "_normalize_version_text"
  - "add"
  - "app_base_dir"
  - "append"
  - "raw"
calls_external:
  - "Path"
  - "cand"
  - "getattr"
  - "group"
  - "key"
  - "lower"
  - "read_text"
  - "resolve"
  - "search"
  - "set"
  - "src"
  - "str"
  - "sys"
called_by:
  - "B2BHandler.do_GET"
  - "_start_log_sync"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
지금 돌고 있는 AX-Cell 의 버전. 반환 {version, normalized, source}.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_exe_file_version`, `_normalize_version_text`, `add`, `app_base_dir`, `append`, `raw`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `_start_log_sync`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
