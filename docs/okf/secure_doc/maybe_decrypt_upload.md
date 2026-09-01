---
type: function
title: maybe_decrypt_upload
module: secure_doc.py
lang: python
extraction: ast
signature: "(path, name, encrypted_checker=None)"
role: "업로드 직후 훅. 보안문서면 서버로 풀어 '작업본을 제자리에서' 교체한다."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:442-514"

# ── 입출력 ──
inputs:
  - "path"
  - "name"
  - "encrypted_checker"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _STATE"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "available"
  - "config"
  - "decrypt_bytes"
  - "looks_secured"
  - "read"
  - "secret_check"
  - "source_label_for_restore"
calls_external:
  - "Path"
  - "_local_says_plain"
  - "bool"
  - "data"
  - "encrypted_checker"
  - "err"
  - "get"
  - "getattr"
  - "head"
  - "len"
  - "name"
  - "open"
  - "out"
  - "p"
  - "path"
  - "perf_counter"
  - "read_bytes"
  - "round"
  - "str"
  - "type"
  - "write_bytes"
  - "write_text"
called_by:
  - "B2BHandler.handle_workbook_upload"
reads:
  - "MARKER_SUFFIX"
  - "_LOCK"
  - "_STATE"
writes:
  - "_STATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
업로드 직후 훅. 보안문서면 서버로 풀어 '작업본을 제자리에서' 교체한다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _STATE
- 파일시스템 변경/IO
- 변경 상태 `_STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `available`, `config`, `decrypt_bytes`, `looks_secured`, `read`, `secret_check`, `source_label_for_restore`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_upload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
