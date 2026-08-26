---
type: function
title: excel_compatible_open_path
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:3066-3093"

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
  - "_excel_suffix_matches_content"
  - "excel_zip_file_suffix"
  - "is_encrypted_ooxml"
  - "is_ole_excel_file"
  - "sniff_text_excel_suffix"
calls_external:
  - "Path"
  - "copy2"
  - "encode"
  - "hexdigest"
  - "lower"
  - "md5"
  - "mkdir"
  - "path"
  - "suffix"
  - "temp_path"
  - "uuid4"
  - "zip_suffix"
called_by:
  - "excel_workbooks_open"
reads:
  - "BACKEND_DIR"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_excel_suffix_matches_content`, `excel_zip_file_suffix`, `is_encrypted_ooxml`, `is_ole_excel_file`, `sniff_text_excel_suffix`
- 피호출(영향 전파 경로): `excel_workbooks_open`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
